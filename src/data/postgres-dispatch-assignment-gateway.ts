import type { Pool } from "pg";
import { DispatchPersistenceError } from "@/domain/dispatch-assignment-gateway";
import type {
  ConfirmAssignmentCommand,
  DispatchAssignmentGateway,
  DurableAssignment,
  DailyEmployeeOff,
  OverrideAssignmentCommand,
  ReplaceOrderAssignmentCommand,
  TourWithAssignedEmployees,
  VersionedConfirmAssignmentCommand,
  VersionedDurableAssignment,
  VersionedOverrideAssignmentCommand,
} from "@/domain/dispatch-assignment-gateway";

interface AssignmentRow {
  id: string;
  order_id: string;
  employee_id: string;
  starts_at: Date;
  ends_at: Date;
  status: DurableAssignment["status"];
  is_override: boolean;
  override_reason: string | null;
}

interface VersionedAssignmentRow extends AssignmentRow { order_version: string; }
interface DailyEmployeeOffRow { employee_id: string; off_date: string; }

function toAssignment(row: AssignmentRow): DurableAssignment {
  return {
    id: row.id,
    orderId: row.order_id,
    employeeId: row.employee_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    isOverride: row.is_override,
    overrideReason: row.override_reason,
  };
}

function toPersistenceError(error: unknown): DispatchPersistenceError {
  const databaseCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
  const codeByDatabaseCode: Record<string, DispatchPersistenceError["code"]> = {
    "23P01": "ASSIGNMENT_OVERLAP",
    PDA02: "OVERRIDE_REASON_REQUIRED",
    PDA03: "INVALID_INTERVAL",
    PDA04: "ORDER_NOT_FOUND",
    PDA05: "EMPLOYEE_NOT_FOUND",
    PDA06: "ASSIGNMENT_NOT_FOUND",
    PDA07: "ASSIGNMENT_ALREADY_STARTED",
    PDA08: "ASSIGNMENT_INVALID_STATE",
    PDA09: "STALE_VERSION",
    PDA10: "EMPLOYEE_OFF",
    PDA11: "EMPLOYEE_INACTIVE",
    PDA12: "EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS",
    PDA13: "DAILY_OFF_LIMIT_REACHED",
    PDA14: "INVALID_COORDINATES",
    PDA15: "INVALID_LABEL",
  };
  return new DispatchPersistenceError(databaseCode ? (codeByDatabaseCode[databaseCode] ?? "PERSISTENCE_FAILURE") : "PERSISTENCE_FAILURE", error);
}

interface TourRow {
  id: string;
  customer_name: string;
  requested_at: Date;
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
  assigned_employees: TourWithAssignedEmployees["assignedEmployees"];
}

/** PostgreSQL implementation which can mutate assignments only through named functions. */
export class PostgresDispatchAssignmentGateway implements DispatchAssignmentGateway {
  constructor(private readonly pool: Pool) {}

  async confirmAssignment(command: ConfirmAssignmentCommand): Promise<DurableAssignment> {
    try {
      const result = await this.pool.query<AssignmentRow>("select * from public.confirm_assignment($1, $2, $3, $4, $5)", [command.assignmentId, command.orderId, command.employeeId, command.startsAt, command.endsAt]);
      return toAssignment(result.rows[0]);
    } catch (error) { throw toPersistenceError(error); }
  }

  async overrideAssignment(command: OverrideAssignmentCommand): Promise<DurableAssignment> {
    try {
      const result = await this.pool.query<AssignmentRow>("select * from public.override_assignment($1, $2, $3, $4, $5, $6)", [command.assignmentId, command.orderId, command.employeeId, command.startsAt, command.endsAt, command.reason]);
      return toAssignment(result.rows[0]);
    } catch (error) { throw toPersistenceError(error); }
  }

  async confirmAssignmentWithVersion(command: VersionedConfirmAssignmentCommand): Promise<VersionedDurableAssignment> {
    try {
      const result = await this.pool.query<VersionedAssignmentRow>("select * from public.confirm_assignment_with_version($1, $2, $3, $4, $5, $6)", [command.assignmentId, command.orderId, command.employeeId, command.startsAt, command.endsAt, command.expectedOrderVersion]);
      return { assignment: toAssignment(result.rows[0]), orderVersion: result.rows[0].order_version };
    } catch (error) { throw toPersistenceError(error); }
  }

  async overrideAssignmentWithVersion(command: VersionedOverrideAssignmentCommand): Promise<VersionedDurableAssignment> {
    try {
      const result = await this.pool.query<VersionedAssignmentRow>("select * from public.override_assignment_with_version($1, $2, $3, $4, $5, $6, $7)", [command.assignmentId, command.orderId, command.employeeId, command.startsAt, command.endsAt, command.reason, command.expectedOrderVersion]);
      return { assignment: toAssignment(result.rows[0]), orderVersion: result.rows[0].order_version };
    } catch (error) { throw toPersistenceError(error); }
  }

  async replaceOrderAssignment(command: ReplaceOrderAssignmentCommand): Promise<DurableAssignment> {
    try {
      const result = await this.pool.query<AssignmentRow>("select * from public.replace_order_assignment($1, $2, $3, $4, $5)", [command.oldAssignmentId, command.newAssignmentId, command.employeeId, command.startsAt, command.endsAt]);
      return toAssignment(result.rows[0]);
    } catch (error) { throw toPersistenceError(error); }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try { await this.pool.query("select public.cancel_order($1)", [orderId]); } catch (error) { throw toPersistenceError(error); }
  }

  async loadOrderAssignments(orderId: string): Promise<DurableAssignment[]> {
    const result = await this.pool.query<AssignmentRow>("select id, order_id, employee_id, starts_at, ends_at, status, is_override, override_reason from public.assignments where order_id = $1 order by starts_at, id", [orderId]);
    return result.rows.map(toAssignment);
  }

  async listToursWithAssignedEmployees(): Promise<TourWithAssignedEmployees[]> {
    const result = await this.pool.query<TourRow>(`
      select o.id, o.customer_name, o.requested_at, o.status,
        coalesce(json_agg(json_build_object('id', e.id, 'name', e.name) order by e.id)
          filter (where a.id is not null), '[]'::json) as assigned_employees
      from public.orders o
      left join public.assignments a on a.order_id = o.id and a.status <> 'CANCELLED'
      left join public.employees e on e.id = a.employee_id
      group by o.id
      order by o.requested_at, o.id
    `);
    return result.rows.map((row) => ({ order: { id: row.id, customerName: row.customer_name, requestedAt: row.requested_at, status: row.status }, assignedEmployees: row.assigned_employees }));
  }

  async markEmployeeOff(employeeId: string, offDate: string): Promise<DailyEmployeeOff> {
    try {
      const result = await this.pool.query<DailyEmployeeOffRow>("select employee_id, off_date::text from public.mark_employee_off($1, $2)", [employeeId, offDate]);
      return { employeeId: result.rows[0].employee_id, offDate: result.rows[0].off_date };
    } catch (error) { throw toPersistenceError(error); }
  }

  async unmarkEmployeeOff(employeeId: string, offDate: string): Promise<void> {
    try { await this.pool.query("select public.unmark_employee_off($1, $2)", [employeeId, offDate]); }
    catch (error) { throw toPersistenceError(error); }
  }

  async upsertRoutingOrigin(employeeId: string, latitude: number, longitude: number, label: string | null): Promise<void> {
    try { await this.pool.query("select public.upsert_employee_routing_origin($1, $2, $3, $4)", [employeeId, latitude, longitude, label]); }
    catch (error) { throw toPersistenceError(error); }
  }

  async removeRoutingOrigin(employeeId: string): Promise<void> {
    try { await this.pool.query("select public.remove_employee_routing_origin($1)", [employeeId]); }
    catch (error) { throw toPersistenceError(error); }
  }
}
