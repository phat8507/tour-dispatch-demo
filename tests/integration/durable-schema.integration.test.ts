import { Client, Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresDispatchAssignmentGateway } from "@/data/postgres-dispatch-assignment-gateway";

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
if (!migrationDatabaseUrl || !runtimeDatabaseUrl) throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required for PostgreSQL integration tests.");

const admin = new Client({ connectionString: migrationDatabaseUrl });
const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 4 });
const gateway = new PostgresDispatchAssignmentGateway(runtimePool);
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
  await admin.query("truncate assignments, order_services, orders, employee_service_skills, services, employees, locations cascade");
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
  it("has all migrations recorded and is safe to run repeatedly", async () => {
    const result = await admin.query<{ filename: string }>("select filename from dispatch_schema_migrations order by filename");
    expect(result.rows.map((row) => row.filename)).toEqual(["001_durable_dispatch_schema.sql", "002_assignment_invariant_functions.sql", "003_dispatch_runtime_privileges.sql", "004_dispatch_schema_ownership.sql", "005_harden_named_dispatch_functions.sql"]);
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
      await expect(runtime.query("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [id("31"), orderOneId, employeeOneId, startsAt, endsAt])).resolves.toMatchObject({ rows: [{ id: id("31") }] });
    } finally { await runtime.query("reset role").catch(() => undefined); await runtime.end(); }
  });
});
