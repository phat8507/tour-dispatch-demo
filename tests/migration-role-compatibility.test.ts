import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = ["003_dispatch_runtime_privileges.sql", "004_dispatch_schema_ownership.sql", "006_atomic_versioned_dispatch_commands.sql", "007_daily_employee_off.sql", "008_employee_routing_origins.sql"];

describe("migration test-role compatibility", () => {
  it("keeps test-role operations conditional and grants production functions only to dispatch_runtime", async () => {
    const sources = await Promise.all(migrations.map(async (migration) => readFile(join(process.cwd(), "db", "migrations", migration), "utf8")));
    const [privileges, ownership, ...functionMigrations] = sources;
    expect(privileges).toContain("IF EXISTS (");
    expect(privileges).toContain("EXECUTE 'GRANT dispatch_runtime TO tour_dispatch_test'");
    expect(ownership).toContain("IF EXISTS (");
    expect(ownership).toContain("EXECUTE 'REVOKE ALL ON TABLE public.assignments FROM tour_dispatch_test'");
    for (const source of functionMigrations) expect(source).not.toMatch(/GRANT\s+EXECUTE[^;]*tour_dispatch_test/i);
  });
});
