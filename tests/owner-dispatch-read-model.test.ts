import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { OwnerDispatchReadError, PostgresOwnerDispatchReadModel, type ActiveEmployeeCandidate, type OwnerDispatchTour } from "@/server/owner-dispatch-read-model";

const tour: OwnerDispatchTour = { id: "00000000-0000-4000-8000-000000000001", customerName: "Customer", customerPhone: null, requestedAt: "2030-01-01 08:00:00+00", orderType: "NEW_TOUR", urgency: "PREBOOKED", status: "ASSIGNED", notes: "", location: { id: "00000000-0000-4000-8000-000000000002", name: "Location", address: "Address", latitude: 10, longitude: 106 }, services: [{ id: "00000000-0000-4000-8000-000000000003", name: "Service", durationMinutes: 60 }], assignments: [{ id: "00000000-0000-4000-8000-000000000004", employeeId: "00000000-0000-4000-8000-000000000005", employeeName: "Employee One", startsAt: "2030-01-01 08:00:00+00", endsAt: "2030-01-01 09:00:00+00", status: "SCHEDULED", isOverride: false, overrideReason: null }, { id: "00000000-0000-4000-8000-000000000006", employeeId: "00000000-0000-4000-8000-000000000007", employeeName: "Employee Two", startsAt: "2030-01-01 09:00:00+00", endsAt: "2030-01-01 10:00:00+00", status: "DELAYED", isOverride: true, overrideReason: "Owner reason" }], orderVersion: "2030-01-01T00:00:00.123456Z" };
const candidate: ActiveEmployeeCandidate = { id: tour.assignments[0].employeeId, name: "Employee One", homeBranchId: "CS1", closingLevel: "NORMAL", isActive: true, skills: [{ serviceId: tour.services[0].id, serviceName: "Service", technicalLevel: "WEAK" }] };
function modelWithQuery(query: ReturnType<typeof vi.fn>) { return new PostgresOwnerDispatchReadModel({ query } as unknown as Pool); }
describe("PostgreSQL owner dispatch read model", () => {
  it("projects canonical UUID tours, durable services, assignments, override data, and exact version in one query", async () => { const query = vi.fn().mockResolvedValue({ rows: [tour, { ...tour, id: "00000000-0000-4000-8000-000000000008", assignments: [] }] }); const result = await modelWithQuery(query).listOwnerDispatchTours(); expect(result[0]).toEqual(tour); expect(result[0].assignments.map((item) => item.employeeName)).toEqual(["Employee One", "Employee Two"]); expect(result[0].assignments[1]).toMatchObject({ status: "DELAYED", isOverride: true, overrideReason: "Owner reason" }); expect(result[0].orderVersion).toBe("2030-01-01T00:00:00.123456Z"); expect(result[1].assignments).toEqual([]); expect(query).toHaveBeenCalledTimes(1); });
  it("projects only active candidates and their durable skills in one query", async () => { const query = vi.fn().mockResolvedValue({ rows: [candidate, { ...candidate, id: "00000000-0000-4000-8000-000000000009", isActive: false }] }); const result = await modelWithQuery(query).listActiveEmployeeCandidatesForOrder(tour.id); expect(result).toEqual([candidate]); expect(result[0].skills[0]).toMatchObject({ technicalLevel: "WEAK", serviceId: tour.services[0].id }); expect(query).toHaveBeenCalledTimes(1); });
  it("returns an empty durable state without mock fallback", async () => { const query = vi.fn().mockResolvedValue({ rows: [] }); await expect(modelWithQuery(query).listOwnerDispatchTours()).resolves.toEqual([]); });
  it("maps database failures to a safe typed read error", async () => { const query = vi.fn().mockRejectedValue(new Error("password secret raw sql")); await expect(modelWithQuery(query).listOwnerDispatchTours()).rejects.toBeInstanceOf(OwnerDispatchReadError); await expect(modelWithQuery(query).listActiveEmployeeCandidatesForOrder(tour.id)).rejects.toMatchObject({ message: "OWNER_DISPATCH_READ_FAILURE" }); });
  it("loads only durable CS1 and CS2 branch locations with valid database coordinates", async () => {
    const rows = [{ id: "branch-one", branchId: "CS1", name: "Co so 1", address: "Address", latitude: 10, longitude: 106 }];
    const query = vi.fn().mockResolvedValue({ rows });
    await expect(modelWithQuery(query).listOwnerDispatchBranches()).resolves.toEqual(rows);
    expect(query.mock.calls[0][0]).toContain("location_type = 'BRANCH'");
    expect(query.mock.calls[0][0]).toContain("branch_id in ('CS1', 'CS2')");
  });
  it("bulk-loads canonical daily OFF state with stable employee ordering", async () => {
    const rows = [{ id: "employee-one", name: "Employee One", isActive: true, isOff: true }];
    const query = vi.fn().mockResolvedValue({ rows });
    await expect(modelWithQuery(query).listDailyOffEmployees("2030-01-01")).resolves.toEqual({ employees: rows, offCount: 1, maxOff: 2 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(["2030-01-01"]);
  });

  it("bulk-loads candidates for all tours while excluding OFF employees by tour business date", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ...candidate, orderId: tour.id }] });
    const result = await modelWithQuery(query).listActiveEmployeeCandidatesForOrders([tour.id]);
    expect(result.get(tour.id)).toEqual([candidate]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("employee_daily_off");
    expect(query.mock.calls[0][0]).toContain("Asia/Ho_Chi_Minh");
  });
  it("bulk-loads production recommendation inputs in one query regardless of tour count", async () => {
    const rows = [{ orderId: tour.id, id: candidate.id, name: candidate.name, isActive: true, isOff: false, homeBranchId: "CS1", closingLevel: "NORMAL", homeBranchCoordinatesAvailable: true, skills: candidate.skills, assignments: [] }];
    const query = vi.fn().mockResolvedValue({ rows });
    const result = await modelWithQuery(query).listCandidateRecommendationsForTours([tour], new Date("2029-12-31T08:00:00Z"));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("employee_service_skills");
    expect(query.mock.calls[0][0]).toContain("employee_daily_off");
    expect(query.mock.calls[0][0]).toContain("public.assignments");
    expect(result[0].recommendations[0]).toMatchObject({ employeeId: candidate.id, category: "PRIMARY", requiresOverride: false });
  });

  it("does not turn recommendation query failures into an empty projection", async () => {
    const query = vi.fn().mockRejectedValue(new Error("raw SQL secret"));
    await expect(modelWithQuery(query).listCandidateRecommendationsForTours([tour])).rejects.toBeInstanceOf(OwnerDispatchReadError);
  });

  it("lists employee routing origins with minimum owner DTO fields and ISO string updated_at", async () => {
    const rows = [{ employee_id: candidate.id, employee_name: candidate.name, is_active: true, latitude: 10, longitude: 106, label: "Home", updated_at: new Date("2030-01-01T08:00:00Z") }];
    const query = vi.fn().mockResolvedValue({ rows });
    const result = await modelWithQuery(query).loadOwnerRoutingOrigins();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("public.list_employee_routing_origins()");
    expect(result.panelOrigins[0]).toEqual({
      employeeId: candidate.id,
      employeeName: candidate.name,
      isActive: true,
      latitude: 10,
      longitude: 106,
      label: "Home",
      updatedAt: "2030-01-01T08:00:00.000Z"
    });
    expect(result.byEmployeeId.get(candidate.id)).toMatchObject({ employeeId: candidate.id });
  });
});
