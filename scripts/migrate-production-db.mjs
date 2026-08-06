import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
const expectedDatabaseName = process.env.EXPECTED_DATABASE_NAME;

if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required for db:migrate:production.");
if (process.env.CONFIRM_PRODUCTION_MIGRATION !== "YES") throw new Error("CONFIRM_PRODUCTION_MIGRATION=YES is required for db:migrate:production.");
if (!expectedDatabaseName) throw new Error("EXPECTED_DATABASE_NAME is required for db:migrate:production.");

const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
if (databaseName !== expectedDatabaseName) throw new Error("MIGRATION_DATABASE_URL database name does not match EXPECTED_DATABASE_NAME.");

const client = new Client({ connectionString: databaseUrl });
await client.connect();
let lockHeld = false;
try {
  await client.query("select pg_advisory_lock(hashtext('dispatch_schema_migrations'))");
  lockHeld = true;
  await client.query("create table if not exists dispatch_schema_migrations (filename text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await client.query("select filename from dispatch_schema_migrations")).rows.map((row) => row.filename));
  const directory = join(process.cwd(), "db", "migrations");
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of filenames) {
    if (applied.has(filename)) continue;
    const sql = await readFile(join(directory, filename), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into dispatch_schema_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  if (lockHeld) await client.query("select pg_advisory_unlock(hashtext('dispatch_schema_migrations'))").catch(() => undefined);
  await client.end();
}
