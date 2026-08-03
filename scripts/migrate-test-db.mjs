import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required for db:migrate:test.");
const parsed = new URL(databaseUrl);
if (parsed.hostname !== "localhost" || parsed.pathname !== "/tour_dispatch_test") {
  throw new Error("db:migrate:test only permits the dedicated local tour_dispatch_test database.");
}
const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
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
} finally { await client.end(); }
