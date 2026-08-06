import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runner = join(process.cwd(), "scripts", "migrate-production-db.mjs");

function run(environment: NodeJS.ProcessEnv): string {
  const result = spawnSync(process.execPath, [runner], { cwd: process.cwd(), env: environment, encoding: "utf8" });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
}

describe("production migration runner", () => {
  it("rejects missing URL and confirmation without exposing environment values", () => {
    expect(run({ ...process.env, MIGRATION_DATABASE_URL: undefined, EXPECTED_DATABASE_NAME: "dispatch" })).toContain("MIGRATION_DATABASE_URL is required");
    expect(run({ ...process.env, MIGRATION_DATABASE_URL: "postgresql://ignored@localhost/dispatch", EXPECTED_DATABASE_NAME: "dispatch", CONFIRM_PRODUCTION_MIGRATION: undefined })).toContain("CONFIRM_PRODUCTION_MIGRATION=YES is required");
  });

  it("rejects a database-name mismatch before opening a connection", () => {
    expect(run({ ...process.env, MIGRATION_DATABASE_URL: "postgresql://ignored@localhost/not_dispatch", EXPECTED_DATABASE_NAME: "dispatch", CONFIRM_PRODUCTION_MIGRATION: "YES" })).toContain("database name does not match");
  });

  it("uses a direct connection, advisory lock, ordered filenames, transactional records, and no test-only database restriction", async () => {
    const source = await readFile(runner, "utf8");
    expect(source).toContain("new Client({ connectionString: databaseUrl })");
    expect(source).toContain("pg_advisory_lock");
    expect(source).toContain(".sort()");
    expect(source).toContain("dispatch_schema_migrations");
    expect(source).toContain('await client.query("begin")');
    expect(source).toContain('await client.query("rollback")');
    expect(source).not.toContain("tour_dispatch_test");
  });
});
