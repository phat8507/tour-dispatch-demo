import { Client, Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresDispatchAssignmentGateway } from "@/data/postgres-dispatch-assignment-gateway";
import { PostgresOwnerDispatchReadModel } from "@/server/owner-dispatch-read-model";

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
if (!migrationDatabaseUrl || !runtimeDatabaseUrl) throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required for PostgreSQL integration tests.");

const admin = new Client({ connectionString: migrationDatabaseUrl });
const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 4 });
const gateway = new PostgresDispatchAssignmentGateway(runtimePool);
const readModel = new PostgresOwnerDispatchReadModel(runtimePool);
const locationId = "00000000-0000-0000-0000-000000000001";
const employeeOneId = "00000000-0000-0000-0000-000000000011";
const employeeTwoId = "00000000-0000-0000-0000-000000000012";
const employeeThreeId = "00000000-0000-0000-0000-000000000013";
const employeeFourId = "00000000-0000-0000-0000-000000000014";
const orderOneId = "00000000-0000-0000-0000-000000000021";
const orderTwoId = "00000000-0000-0000-0000-000000000022";
const orderThreeId = "00000000-0000-0000-0000-000000000023";
const orderFourId = "00000000-0000-0000-0000-000000000024";
const startsAt = new Date("2030-01-01T08:00:00.000Z");
const endsAt = new Date("2030-01-01T09:00:00.000Z");
const laterEndsAt = new Date("2030-01-01T10:00:00.000Z");
function id(suffix: string): string { return `10000000-0000-0000-0000-${suffix.padStart(12, "0")}`; }

async function seed(): Promise<void> {
  await admin.query("truncate employee_daily_off, assignments, order_services, orders, employee_service_skills, services, employees, locations cascade");
  await admin.query("insert into locations (id, name, address, latitude, longitude, location_type) values ($1, 'Customer', 'Address', 10, 106, 'CUSTOMER')", [locationId]);
  await admin.query("insert into employees (id, name, home_branch_id, closing_level) values ($1, 'One', 'CS1', 'NORMAL'), ($2, 'Two', 'CS2', 'NORMAL'), ($3, 'Three', 'CS1', 'NORMAL'), ($4, 'Four', 'CS2', 'NORMAL')", [employeeOneId, employeeTwoId, employeeThreeId, employeeFourId]);
  await admin.query("insert into orders (id, customer_name, location_id, requested_at, order_type, urgency, status) values ($1, 'First', $5, $6, 'NEW_TOUR', 'PREBOOKED', 'PENDING'), ($2, 'Second', $5, $6, 'NEW_TOUR', 'PREBOOKED', 'PENDING'), ($3, 'Third', $5, $6, 'NEW_TOUR', 'PREBOOKED', 'PENDING'), ($4, 'Fourth', $5, $6, 'NEW_TOUR', 'PREBOOKED', 'PENDING')", [orderOneId, orderTwoId, orderThreeId, orderFourId, locationId, startsAt]);
}
async function insertAssignment(assignmentId: string, orderId: string, employeeId: string, status: string, start = startsAt, end = endsAt, isOverride = false): Promise<void> {
  await admin.query("insert into assignments (id, order_id, employee_id, starts_at, ends_at, status, is_override, override_reason) values ($1, $2, $3, $4, $5, $6, $7, $8)", [assignmentId, orderId, employeeId, start, end, status, isOverride, isOverride ? "Admin fixture override" : null]);
}

beforeAll(async () => { await admin.connect(); });
beforeEach(seed);
afterAll(async () => { await runtimePool.end(); await admin.end(); });

describe("durable dispatch schema", () => {
  it("projects primary and UNKNOWN fallback recommendations from one durable bulk load", async () => {
    const serviceId = id("301");
    await admin.query("insert into services (id, name, default_duration_minutes, refill_duration_minutes) values ($1, 'Recommendation service', 60, 30)", [serviceId]);
    await admin.query("insert into order_services (order_id, service_id, duration_minutes) values ($1, $2, 60)", [orderOneId, serviceId]);
    await admin.query("insert into employee_service_skills (employee_id, service_id, technical_level) values ($1, $2, 'STRONG')", [employeeOneId, serviceId]);
    const tours = await readModel.listOwnerDispatchTours();
    const recommendations = await readModel.listCandidateRecommendationsForTours(tours.filter((tour) => tour.id === orderOneId), new Date("2030-01-01T07:00:00Z"));
    expect(recommendations[0].recommendations[0]).toMatchObject({ employeeId: employeeOneId, category: "PRIMARY", requiresOverride: false });
    expect(recommendations[0].recommendations[1]).toMatchObject({ category: "UNKNOWN_SKILL_FALLBACK", requiresOverride: true });
    await expect(readModel.evaluateEligibility(orderOneId, employeeTwoId)).resolves.toBe("EMPLOYEE_MISSING_REQUIRED_SKILL");
    await expect(readModel.evaluateEligibility(orderOneId, employeeTwoId, { allowUnknownSkill: true })).resolves.toBe("ELIGIBLE");
    await gateway.markEmployeeOff(employeeTwoId, "2030-01-01");
    await expect(readModel.evaluateEligibility(orderOneId, employeeTwoId, { allowUnknownSkill: true })).resolves.toBe("EMPLOYEE_OFF");
  });
  it("has all migrations recorded and is safe to run repeatedly", async () => {
    const result = await admin.query<{ filename: string }>("select filename from dispatch_schema_migrations order by filename");
    expect(result.rows.map((row) => row.filename)).toEqual(["001_durable_dispatch_schema.sql", "002_assignment_invariant_functions.sql", "003_dispatch_runtime_privileges.sql", "004_dispatch_schema_ownership.sql", "005_harden_named_dispatch_functions.sql", "006_atomic_versioned_dispatch_commands.sql", "007_daily_employee_off.sql"]);
  });

  it("provides atomic versioned confirm and override commands without granting runtime DML", async () => {
    const version = (await admin.query<{ order_version: string }>("select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as order_version from public.orders where id = $1", [orderOneId])).rows[0].order_version;
    const confirmed = await runtimePool.query("select * from public.confirm_assignment_with_version($1, $2, $3, $4, $5, $6)", [id("101"), orderOneId, employeeOneId, startsAt, endsAt, version]);
    expect(confirmed.rows[0]).toMatchObject({ id: id("101"), is_override: false });
    expect(confirmed.rows[0].order_version).not.toBe(version);
    await expect(runtimePool.query("select * from public.confirm_assignment_with_version($1, $2, $3, $4, $5, $6)", [id("102"), orderOneId, employeeTwoId, startsAt, endsAt, version])).rejects.toMatchObject({ code: "PDA09" });
    expect((await gateway.loadOrderAssignments(orderOneId)).map((assignment) => assignment.id)).toEqual([id("101")]);

    const overrideOrderVersion = (await admin.query<{ order_version: string }>("select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as order_version from public.orders where id = $1", [orderTwoId])).rows[0].order_version;
    const overridden = await runtimePool.query("select * from public.override_assignment_with_version($1, $2, $3, $4, $5, $6, $7)", [id("103"), orderTwoId, employeeTwoId, startsAt, endsAt, "Owner decision", overrideOrderVersion]);
    expect(overridden.rows[0]).toMatchObject({ id: id("103"), is_override: true, override_reason: "Owner decision" });
    expect(overridden.rows[0].order_version).not.toBe(overrideOrderVersion);
    await expect(runtimePool.query("select * from public.override_assignment_with_version($1, $2, $3, $4, $5, $6, $7)", [id("104"), orderTwoId, employeeThreeId, startsAt, endsAt, "Stale", overrideOrderVersion])).rejects.toMatchObject({ code: "PDA09" });
    expect((await gateway.loadOrderAssignments(orderTwoId)).map((assignment) => assignment.id)).toEqual([id("103")]);
    const security = await admin.query<{ prosecdef: boolean; proconfig: string[]; owner: string; public_execute: boolean }>("select p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner, has_function_privilege('public', p.oid, 'EXECUTE') as public_execute from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('confirm_assignment_with_version', 'override_assignment_with_version') order by p.proname");
    expect(security.rows).toHaveLength(2);
    for (const functionSecurity of security.rows) expect(functionSecurity).toMatchObject({ prosecdef: true, proconfig: ["search_path=pg_catalog, public, pg_temp"], public_execute: false });
    expect(security.rows.every((functionSecurity) => functionSecurity.owner !== "dispatch_runtime")).toBe(true);
  });

  it("creates a normal assignment, reads it, and projects assigned and unassigned tours", async () => {
    await gateway.confirmAssignment({ assignmentId: id("1"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await gateway.overrideAssignment({ assignmentId: id("2"), orderId: orderOneId, employeeId: employeeTwoId, startsAt, endsAt, reason: "Second employee confirmed" });
    expect(await gateway.loadOrderAssignments(orderOneId)).toHaveLength(2);
    const tours = await gateway.listToursWithAssignedEmployees();
    expect(tours.find((tour) => tour.order.id === orderOneId)?.assignedEmployees.map((employee) => employee.id)).toEqual([employeeOneId, employeeTwoId]);
    expect(tours.find((tour) => tour.order.id === orderThreeId)?.assignedEmployees).toEqual([]);
  });

  it("rejects normal overlap against normal and override assignments by stable error code", async () => {
    await gateway.confirmAssignment({ assignmentId: id("3"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await expect(gateway.confirmAssignment({ assignmentId: id("4"), orderId: orderTwoId, employeeId: employeeOneId, startsAt: new Date("2030-01-01T08:30:00.000Z"), endsAt: new Date("2030-01-01T09:30:00.000Z") })).rejects.toMatchObject({ code: "ASSIGNMENT_OVERLAP" });
    await gateway.overrideAssignment({ assignmentId: id("5"), orderId: orderTwoId, employeeId: employeeTwoId, startsAt, endsAt, reason: "Exceptional overlap" });
    await expect(gateway.confirmAssignment({ assignmentId: id("6"), orderId: orderThreeId, employeeId: employeeTwoId, startsAt, endsAt })).rejects.toMatchObject({ code: "ASSIGNMENT_OVERLAP" });
    expect((await gateway.loadOrderAssignments(orderOneId)).find((assignment) => assignment.id === id("3"))?.status).toBe("SCHEDULED");
  });

  it("allows adjacent intervals and ignores completed and cancelled assignments for overlap", async () => {
    await gateway.confirmAssignment({ assignmentId: id("7"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await gateway.confirmAssignment({ assignmentId: id("8"), orderId: orderTwoId, employeeId: employeeOneId, startsAt: endsAt, endsAt: laterEndsAt });
    await insertAssignment(id("9"), orderThreeId, employeeTwoId, "COMPLETED");
    await gateway.confirmAssignment({ assignmentId: id("10"), orderId: orderTwoId, employeeId: employeeTwoId, startsAt, endsAt });
    await admin.query("update assignments set status = 'CANCELLED' where id = $1", [id("10")]);
    await gateway.confirmAssignment({ assignmentId: id("11"), orderId: orderFourId, employeeId: employeeTwoId, startsAt, endsAt });
  });

  it("persists valid overrides and rejects null, blank, and whitespace-only reasons", async () => {
    const overridden = await gateway.overrideAssignment({ assignmentId: id("12"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt, reason: "  Owner confirmation  " });
    expect(overridden).toMatchObject({ isOverride: true, overrideReason: "Owner confirmation" });
    await expect(gateway.overrideAssignment({ assignmentId: id("13"), orderId: orderTwoId, employeeId: employeeTwoId, startsAt, endsAt, reason: "" })).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
    await expect(gateway.overrideAssignment({ assignmentId: id("14"), orderId: orderTwoId, employeeId: employeeTwoId, startsAt, endsAt, reason: "   " })).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
    await expect(runtimePool.query("select * from public.override_assignment($1, $2, $3, $4, $5, $6)", [id("15"), orderTwoId, employeeTwoId, startsAt, endsAt, null])).rejects.toMatchObject({ code: "PDA02" });
  });

  it("replaces scheduled and delayed assignments, rejects invalid lifecycle states, and rolls back failed replacements", async () => {
    await gateway.confirmAssignment({ assignmentId: id("16"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("16"), newAssignmentId: id("17"), employeeId: employeeTwoId, startsAt, endsAt })).resolves.toMatchObject({ status: "SCHEDULED" });
    expect((await gateway.loadOrderAssignments(orderOneId)).find((assignment) => assignment.id === id("16"))?.status).toBe("CANCELLED");
    await insertAssignment(id("18"), orderTwoId, employeeOneId, "DELAYED", new Date("2030-01-01T10:00:00.000Z"), new Date("2030-01-01T11:00:00.000Z"));
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("18"), newAssignmentId: id("19"), employeeId: employeeTwoId, startsAt: new Date("2030-01-01T10:00:00.000Z"), endsAt: new Date("2030-01-01T11:00:00.000Z") })).resolves.toMatchObject({ status: "SCHEDULED" });
    await insertAssignment(id("20"), orderThreeId, employeeOneId, "IN_PROGRESS", new Date("2030-01-01T12:00:00.000Z"), new Date("2030-01-01T13:00:00.000Z"));
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("20"), newAssignmentId: id("21"), employeeId: employeeTwoId, startsAt, endsAt })).rejects.toMatchObject({ code: "ASSIGNMENT_ALREADY_STARTED" });
    await admin.query("update assignments set status = 'COMPLETED' where id = $1", [id("20")]);
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("20"), newAssignmentId: id("22"), employeeId: employeeTwoId, startsAt, endsAt })).rejects.toMatchObject({ code: "ASSIGNMENT_INVALID_STATE" });
    await admin.query("update assignments set status = 'CANCELLED' where id = $1", [id("20")]);
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("20"), newAssignmentId: id("221"), employeeId: employeeTwoId, startsAt, endsAt })).rejects.toMatchObject({ code: "ASSIGNMENT_INVALID_STATE" });
    await insertAssignment(id("23"), orderFourId, employeeOneId, "SCHEDULED", new Date("2030-01-01T14:00:00.000Z"), new Date("2030-01-01T15:00:00.000Z"));
    await insertAssignment(id("24"), orderThreeId, employeeTwoId, "SCHEDULED", new Date("2030-01-01T14:30:00.000Z"), new Date("2030-01-01T15:30:00.000Z"));
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("23"), newAssignmentId: id("25"), employeeId: employeeTwoId, startsAt: new Date("2030-01-01T14:30:00.000Z"), endsAt: new Date("2030-01-01T15:30:00.000Z") })).rejects.toMatchObject({ code: "ASSIGNMENT_OVERLAP" });
    expect((await gateway.loadOrderAssignments(orderFourId)).find((assignment) => assignment.id === id("23"))?.status).toBe("SCHEDULED");
  });

  it("cancels an order and active assignments without deleting completed history", async () => {
    await gateway.confirmAssignment({ assignmentId: id("26"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await insertAssignment(id("27"), orderOneId, employeeTwoId, "COMPLETED", new Date("2030-01-01T10:00:00.000Z"), new Date("2030-01-01T11:00:00.000Z"));
    await insertAssignment(id("32"), orderOneId, employeeThreeId, "IN_PROGRESS", new Date("2030-01-01T12:00:00.000Z"), new Date("2030-01-01T13:00:00.000Z"));
    await insertAssignment(id("33"), orderOneId, employeeFourId, "DELAYED", new Date("2030-01-01T14:00:00.000Z"), new Date("2030-01-01T15:00:00.000Z"));
    await gateway.cancelOrder(orderOneId);
    expect((await gateway.loadOrderAssignments(orderOneId)).map((assignment) => assignment.status)).toEqual(["CANCELLED", "COMPLETED", "CANCELLED", "CANCELLED"]);
  });

  it("maps stable lifecycle and lookup database codes to typed persistence errors", async () => {
    await expect(gateway.confirmAssignment({ assignmentId: id("34"), orderId: orderOneId, employeeId: employeeOneId, startsAt: endsAt, endsAt: startsAt })).rejects.toMatchObject({ code: "INVALID_INTERVAL" });
    await expect(gateway.confirmAssignment({ assignmentId: id("35"), orderId: id("999"), employeeId: employeeOneId, startsAt, endsAt })).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    await expect(gateway.confirmAssignment({ assignmentId: id("36"), orderId: orderOneId, employeeId: id("998"), startsAt, endsAt })).rejects.toMatchObject({ code: "EMPLOYEE_NOT_FOUND" });
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("997"), newAssignmentId: id("37"), employeeId: employeeOneId, startsAt, endsAt })).rejects.toMatchObject({ code: "ASSIGNMENT_NOT_FOUND" });
  });

  it("serializes concurrent normal confirmations without random sleeps", async () => {
    const first = new Client({ connectionString: runtimeDatabaseUrl });
    const second = new Client({ connectionString: runtimeDatabaseUrl });
    await Promise.all([first.connect(), second.connect()]);
    try {
      const results = await Promise.allSettled([first.query("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [id("28"), orderOneId, employeeOneId, startsAt, endsAt]), second.query("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [id("29"), orderTwoId, employeeOneId, new Date("2030-01-01T08:30:00.000Z"), new Date("2030-01-01T09:30:00.000Z")])]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "23P01" } });
    } finally { await Promise.all([first.end(), second.end()]); }
  });

  it("denies dispatch_runtime direct DML while allowing named function execution", async () => {
    const runtime = new Client({ connectionString: runtimeDatabaseUrl });
    await runtime.connect();
    try {
      await runtime.query("set role dispatch_runtime");
      await expect(runtime.query("insert into public.assignments (id, order_id, employee_id, starts_at, ends_at, status) values ($1, $2, $3, $4, $5, 'SCHEDULED')", [id("30"), orderOneId, employeeOneId, startsAt, endsAt])).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("update public.assignments set status = 'CANCELLED'")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("delete from public.assignments")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("update public.orders set status = 'ASSIGNED'")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [id("31"), orderOneId, employeeOneId, startsAt, endsAt])).resolves.toMatchObject({ rows: [{ id: id("31") }] });
      const version = (await admin.query<{ order_version: string }>("select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as order_version from public.orders where id = $1", [orderTwoId])).rows[0].order_version;
      await expect(runtime.query("select * from public.confirm_assignment_with_version($1, $2, $3, $4, $5, $6)", [id("105"), orderTwoId, employeeTwoId, startsAt, endsAt, version])).resolves.toMatchObject({ rows: [{ id: id("105") }] });
    } finally { await runtime.query("reset role").catch(() => undefined); await runtime.end(); }
  });

  it("blocks normal, versioned, override, and versioned override assignments on an OFF business date", async () => {
    await gateway.markEmployeeOff(employeeOneId, "2030-01-01");
    await expect(gateway.confirmAssignment({ assignmentId: id("201"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
    await expect(gateway.overrideAssignment({ assignmentId: id("202"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt, reason: "Owner" })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
    const version = (await admin.query<{ order_version: string }>("select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as order_version from public.orders where id = $1", [orderOneId])).rows[0].order_version;
    await expect(gateway.confirmAssignmentWithVersion({ assignmentId: id("203"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt, expectedOrderVersion: version })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
    await expect(gateway.overrideAssignmentWithVersion({ assignmentId: id("204"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt, reason: "Owner", expectedOrderVersion: version })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
  });

  it("blocks a replacement target on OFF and leaves the original assignment unchanged", async () => {
    await gateway.confirmAssignment({ assignmentId: id("205"), orderId: orderOneId, employeeId: employeeOneId, startsAt, endsAt });
    await gateway.markEmployeeOff(employeeTwoId, "2030-01-01");
    await expect(gateway.replaceOrderAssignment({ oldAssignmentId: id("205"), newAssignmentId: id("206"), employeeId: employeeTwoId, startsAt, endsAt })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
    expect((await gateway.loadOrderAssignments(orderOneId)).find((item) => item.id === id("205"))?.status).toBe("SCHEDULED");
  });

  it("rejects marking OFF with active assignments but ignores completed and cancelled history", async () => {
    await insertAssignment(id("207"), orderOneId, employeeOneId, "SCHEDULED");
    await expect(gateway.markEmployeeOff(employeeOneId, "2030-01-01")).rejects.toMatchObject({ code: "EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS" });
    await admin.query("update assignments set status = 'COMPLETED' where id = $1", [id("207")]);
    await insertAssignment(id("208"), orderTwoId, employeeOneId, "CANCELLED");
    await expect(gateway.markEmployeeOff(employeeOneId, "2030-01-01")).resolves.toMatchObject({ offDate: "2030-01-01" });
    await gateway.unmarkEmployeeOff(employeeOneId, "2030-01-01");
    await expect(gateway.confirmAssignment({ assignmentId: id("209"), orderId: orderThreeId, employeeId: employeeOneId, startsAt, endsAt })).resolves.toMatchObject({ status: "SCHEDULED" });
  });

  it("uses Asia/Ho_Chi_Minh half-open OFF boundaries without blocking adjacent dates", async () => {
    await gateway.markEmployeeOff(employeeOneId, "2030-01-02");
    await expect(gateway.confirmAssignment({ assignmentId: id("210"), orderId: orderOneId, employeeId: employeeOneId, startsAt: new Date("2030-01-01T16:00:00Z"), endsAt: new Date("2030-01-01T17:00:00Z") })).resolves.toMatchObject({ status: "SCHEDULED" });
    await expect(gateway.confirmAssignment({ assignmentId: id("211"), orderId: orderTwoId, employeeId: employeeTwoId, startsAt: new Date("2030-01-02T17:00:00Z"), endsAt: new Date("2030-01-02T18:00:00Z") })).resolves.toMatchObject({ status: "SCHEDULED" });
    await expect(gateway.confirmAssignment({ assignmentId: id("212"), orderId: orderThreeId, employeeId: employeeOneId, startsAt: new Date("2030-01-01T16:30:00Z"), endsAt: new Date("2030-01-01T17:30:00Z") })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
    await expect(gateway.overrideAssignment({ assignmentId: id("213"), orderId: orderFourId, employeeId: employeeOneId, startsAt: new Date("2030-01-02T16:00:00Z"), endsAt: new Date("2030-01-02T17:00:00Z"), reason: "Late OFF day" })).rejects.toMatchObject({ code: "EMPLOYEE_OFF" });
  });

  it("enforces at most two OFF employees under concurrent third inserts", async () => {
    await gateway.markEmployeeOff(employeeOneId, "2030-01-03");
    const results = await Promise.allSettled([gateway.markEmployeeOff(employeeTwoId, "2030-01-03"), gateway.markEmployeeOff(employeeThreeId, "2030-01-03")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "DAILY_OFF_LIMIT_REACHED" } });
    expect((await admin.query("select * from employee_daily_off where off_date = '2030-01-03'")).rows).toHaveLength(2);
  });

  it("serializes concurrent mark-OFF and assignment creation so both cannot persist", async () => {
    const marker = new Client({ connectionString: runtimeDatabaseUrl });
    const confirmer = new Client({ connectionString: runtimeDatabaseUrl });
    await Promise.all([marker.connect(), confirmer.connect()]);
    try {
      const results = await Promise.allSettled([
        marker.query("select * from public.mark_employee_off($1, $2)", [employeeOneId, "2030-01-01"]),
        confirmer.query("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [id("214"), orderOneId, employeeOneId, startsAt, endsAt]),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(["PDA10", "PDA12"]).toContain((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.code);
      const persisted = await admin.query("select (select count(*) from employee_daily_off where employee_id = $1 and off_date = '2030-01-01') as off_count, (select count(*) from assignments where employee_id = $1 and status in ('SCHEDULED','IN_PROGRESS','DELAYED')) as assignment_count", [employeeOneId]);
      expect(Number(persisted.rows[0].off_count) + Number(persisted.rows[0].assignment_count)).toBe(1);
    } finally { await Promise.all([marker.end(), confirmer.end()]); }
  });

  it("denies runtime OFF-table DML, permits named functions, and revokes PUBLIC execute", async () => {
    await expect(runtimePool.query("insert into public.employee_daily_off (employee_id, off_date) values ($1, '2030-01-04')", [employeeOneId])).rejects.toMatchObject({ code: "42501" });
    await expect(runtimePool.query("select * from public.mark_employee_off($1, '2030-01-04')", [employeeOneId])).resolves.toMatchObject({ rows: [expect.objectContaining({ employee_id: employeeOneId })] });
    await expect(runtimePool.query("select public.unmark_employee_off($1, '2030-01-04')", [employeeOneId])).resolves.toBeTruthy();
    const security = await admin.query<{ proname: string; prosecdef: boolean; proconfig: string[]; owner: string; public_execute: boolean }>("select p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner, has_function_privilege('public', p.oid, 'EXECUTE') as public_execute from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mark_employee_off', 'unmark_employee_off') order by p.proname");
    expect(security.rows).toHaveLength(2);
    for (const item of security.rows) expect(item).toMatchObject({ prosecdef: true, proconfig: ["search_path=pg_catalog, public, pg_temp"], public_execute: false });
    expect(security.rows.every((item) => item.owner !== "dispatch_runtime")).toBe(true);
  });
});
