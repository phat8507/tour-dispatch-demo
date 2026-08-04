import type { Pool } from "pg";
import type { OwnerDispatchBranch, OwnerDispatchTour } from "@/features/dispatch/owner-dispatch-view-model";

export type { OwnerDispatchBranch, OwnerDispatchTour } from "@/features/dispatch/owner-dispatch-view-model";
export type ActiveEmployeeCandidate = { id: string; name: string; homeBranchId: "CS1" | "CS2"; closingLevel: "STRONG" | "NORMAL" | "WEAK"; isActive: boolean; skills: Array<{ serviceId: string; serviceName: string; technicalLevel: "STRONG" | "NORMAL" | "WEAK" }> };
export type EligibilityCause = "ORDER_NOT_FOUND" | "ORDER_NOT_ASSIGNABLE" | "EMPLOYEE_NOT_FOUND" | "EMPLOYEE_INACTIVE" | "EMPLOYEE_MISSING_REQUIRED_SKILL" | "ELIGIBLE";
export class OwnerDispatchReadError extends Error { constructor(cause?: unknown) { super("OWNER_DISPATCH_READ_FAILURE", { cause }); this.name = "OwnerDispatchReadError"; } }

export class PostgresOwnerDispatchReadModel {
  constructor(private readonly pool: Pool) {}
  async listOwnerDispatchTours(): Promise<OwnerDispatchTour[]> {
    try { const result = await this.pool.query<OwnerDispatchTour>(`select o.id, o.customer_name as "customerName", o.customer_phone as "customerPhone", o.requested_at::text as "requestedAt", o.order_type as "orderType", o.urgency, o.status, o.notes,
      json_build_object('id', l.id, 'name', l.name, 'address', l.address, 'latitude', l.latitude, 'longitude', l.longitude) as location,
      coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name, 'durationMinutes', os.duration_minutes) order by s.id) from public.order_services os join public.services s on s.id = os.service_id where os.order_id = o.id), '[]'::json) as services,
      coalesce((select json_agg(json_build_object('id', a.id, 'employeeId', a.employee_id, 'employeeName', e.name, 'startsAt', a.starts_at::text, 'endsAt', a.ends_at::text, 'status', a.status, 'isOverride', a.is_override, 'overrideReason', a.override_reason) order by a.starts_at, a.id) from public.assignments a join public.employees e on e.id = a.employee_id where a.order_id = o.id), '[]'::json) as assignments,
      to_char(o.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "orderVersion"
      from public.orders o join public.locations l on l.id = o.location_id order by o.requested_at, o.id`);
      return result.rows;
    } catch (error) { throw new OwnerDispatchReadError(error); }
  }
  async listOwnerDispatchBranches(): Promise<OwnerDispatchBranch[]> {
    try {
      const result = await this.pool.query<OwnerDispatchBranch>(`select id, branch_id as "branchId", name, address, latitude, longitude
        from public.locations
        where location_type = 'BRANCH' and branch_id in ('CS1', 'CS2')
        order by branch_id, id`);
      return result.rows;
    } catch (error) { throw new OwnerDispatchReadError(error); }
  }
  async loadOwnerDispatchTour(orderId: string): Promise<OwnerDispatchTour | undefined> { return (await this.listOwnerDispatchTours()).find((tour) => tour.id === orderId); }
  async listActiveEmployeeCandidatesForOrder(orderId: string): Promise<ActiveEmployeeCandidate[]> {
    try { const result = await this.pool.query<ActiveEmployeeCandidate>(`select e.id, e.name, e.home_branch_id as "homeBranchId", e.closing_level as "closingLevel", e.is_active as "isActive", coalesce(json_agg(json_build_object('serviceId', s.id, 'serviceName', s.name, 'technicalLevel', ess.technical_level) order by s.id) filter (where s.id is not null), '[]'::json) as skills from public.employees e left join public.employee_service_skills ess on ess.employee_id = e.id left join public.services s on s.id = ess.service_id where exists (select 1 from public.orders where id = $1) group by e.id order by e.id`, [orderId]);
      return result.rows.filter((employee) => employee.isActive);
    } catch (error) { throw new OwnerDispatchReadError(error); }
  }
  async evaluateEligibility(orderId: string, employeeId: string): Promise<EligibilityCause> {
    const tour = await this.loadOwnerDispatchTour(orderId); if (!tour) return "ORDER_NOT_FOUND";
    if (tour.status === "COMPLETED" || tour.status === "CANCELLED") return "ORDER_NOT_ASSIGNABLE";
    const employees = await this.listActiveEmployeeCandidatesForOrder(orderId);
    const activeEmployee = employees.find((employee) => employee.id === employeeId);
    if (activeEmployee) return tour.services.every((service) => activeEmployee.skills.some((skill) => skill.serviceId === service.id)) ? "ELIGIBLE" : "EMPLOYEE_MISSING_REQUIRED_SKILL";
    const employee = await this.pool.query<{ is_active: boolean }>("select is_active from public.employees where id = $1", [employeeId]);
    if (!employee.rows[0]) return "EMPLOYEE_NOT_FOUND";
    return "EMPLOYEE_INACTIVE";
  }
}
