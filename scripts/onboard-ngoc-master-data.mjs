import pg from "pg";
import { ngocMasterData } from "./ngoc-master-data.mjs";

if (process.env.CONFIRM_NGOC_MASTER_DATA_ONBOARDING !== "YES") throw new Error("CONFIRM_NGOC_MASTER_DATA_ONBOARDING=YES is required.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  for (const branch of ngocMasterData.branches) await client.query(`insert into public.locations (id, name, address, latitude, longitude, location_type, branch_id)
    values ($1, $2, $3, $4, $5, 'BRANCH', $6)
    on conflict (id) do update set name = excluded.name, address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude, branch_id = excluded.branch_id, updated_at = now()`, [branch.id, branch.name, branch.address, branch.latitude, branch.longitude, branch.branchId]);
  for (const service of ngocMasterData.services) await client.query(`insert into public.services (id, name, default_duration_minutes, refill_duration_minutes)
    values ($1, $2, $3, $4)
    on conflict (name) do update set default_duration_minutes = excluded.default_duration_minutes, refill_duration_minutes = excluded.refill_duration_minutes, is_active = true`, [service.id, service.name, service.defaultDurationMinutes, service.refillDurationMinutes]);
  for (const employee of ngocMasterData.employees) {
    await client.query(`insert into public.employees (id, name, home_branch_id, closing_level)
      values ($1, $2, $3, $4)
      on conflict (id) do update set name = excluded.name, home_branch_id = excluded.home_branch_id, closing_level = excluded.closing_level, is_active = true, updated_at = now()`, [employee.id, employee.name, employee.homeBranchId, employee.closingLevel]);
    await client.query(`insert into public.employee_master_data (employee_id, home_area, dispatch_note, closing_level_source)
      values ($1, $2, $3, $4)
      on conflict (employee_id) do update set home_area = excluded.home_area, dispatch_note = excluded.dispatch_note, closing_level_source = excluded.closing_level_source, updated_at = now()`, [employee.id, employee.homeArea, employee.dispatchNote, employee.closingLevelSource]);
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
