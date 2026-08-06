import { describe, expect, it } from "vitest";
import { enrichBaselineRecommendations, isUrgentTour, recommendProductionCandidates } from "@/domain/production-candidate-recommendations";
import type { ProductionRecommendationEmployee, ProductionRecommendationInput } from "@/domain/production-candidate-recommendations";

const services = [
  { id: "service-a", name: "Service A", durationMinutes: 60 },
  { id: "service-b", name: "Service B", durationMinutes: 30 },
];

function employee(id: string, overrides: Partial<ProductionRecommendationEmployee> = {}): ProductionRecommendationEmployee {
  return {
    id, name: id, isActive: true, isOff: false, homeBranchId: "CS1", homeBranchCoordinatesAvailable: true, closingLevel: "NORMAL",
    skills: services.map((service) => ({ serviceId: service.id, serviceName: service.name, technicalLevel: "NORMAL" })), assignments: [], ...overrides,
  };
}

function input(employees: ProductionRecommendationEmployee[]): ProductionRecommendationInput {
  return { tour: { id: "tour", requestedAt: "2030-01-01T10:00:00.000Z", status: "PENDING", destinationCoordinatesAvailable: true, services }, employees, now: "2030-01-01T08:00:00.000Z" };
}

describe("production candidate recommendations", () => {
  it("classifies urgency inclusively from now through exactly thirty minutes", () => {
    const now = "2030-01-01T00:00:00.000Z";
    expect(isUrgentTour("2029-12-31T23:59:59.999Z", now)).toBe(false);
    expect(isUrgentTour(now, now)).toBe(true);
    expect(isUrgentTour("2030-01-01T00:00:00.001Z", now)).toBe(true);
    expect(isUrgentTour("2030-01-01T00:30:00.000Z", now)).toBe(true);
    expect(isUrgentTour("2030-01-01T00:30:00.001Z", now)).toBe(false);
  });
  it("reorders only the fixed baseline candidates for urgent real travel", () => {
    const baseline = recommendProductionCandidates(input([employee("a"), employee("b")]));
    const result = enrichBaselineRecommendations(baseline, [{ employeeId: "a", durationSeconds: 120, feasibility: "INFEASIBLE" }, { employeeId: "b", durationSeconds: 60, feasibility: "FEASIBLE" }], true);
    expect(result.map((candidate) => candidate.employeeId)).toEqual(["b", "a"]);
    expect(result[0].estimatedTravelMinutes).toBe(1);
    expect(result[1].candidateWarningCodes).toEqual(["TRAVEL_INFEASIBLE"]);
  });
  it("orders urgent fixed baseline candidates by feasible, infeasible, unavailable, then raw duration", () => {
    const baseline = recommendProductionCandidates(input([employee("one"), employee("two"), employee("three"), employee("four")]));
    const fixed = baseline.slice(0, 3);
    const result = enrichBaselineRecommendations(fixed, [
      { employeeId: fixed[0].employeeId, durationSeconds: 120, feasibility: "INFEASIBLE" },
      { employeeId: fixed[1].employeeId, feasibility: "UNAVAILABLE" },
      { employeeId: fixed[2].employeeId, durationSeconds: 60, feasibility: "FEASIBLE" },
    ], true);
    expect(result.map((candidate) => candidate.employeeId)).toEqual([fixed[2].employeeId, fixed[0].employeeId, fixed[1].employeeId]);
    expect(result).toHaveLength(3);
    const outside = baseline.find((candidate) => !fixed.some((item) => item.employeeId === candidate.employeeId));
    if (outside) expect(result.map((candidate) => candidate.employeeId)).not.toContain(outside.employeeId);
  });
  it("preserves baseline order for equal urgent durations and unavailable candidates", () => {
    const baseline = recommendProductionCandidates(input([employee("one"), employee("two"), employee("three")]));
    const equal = enrichBaselineRecommendations(baseline, baseline.map((candidate) => ({ employeeId: candidate.employeeId, durationSeconds: 61, feasibility: "FEASIBLE" })), true);
    const unavailable = enrichBaselineRecommendations(baseline, baseline.map((candidate) => ({ employeeId: candidate.employeeId, feasibility: "UNAVAILABLE" })), true);
    expect(equal.map((candidate) => candidate.employeeId)).toEqual(baseline.map((candidate) => candidate.employeeId));
    expect(unavailable.map((candidate) => candidate.employeeId)).toEqual(baseline.map((candidate) => candidate.employeeId));
  });
  it("uses travel only for a non-urgent complete business-ranking tie", () => {
    const baseline = recommendProductionCandidates(input([employee("a"), employee("b"), employee("c", { workloadCount: 1 } as never)]));
    const tied = enrichBaselineRecommendations(baseline.slice(0, 2), [{ employeeId: "a", durationSeconds: 120, feasibility: "FEASIBLE" }, { employeeId: "b", durationSeconds: 60, feasibility: "FEASIBLE" }], false);
    expect(tied.map((candidate) => candidate.employeeId)).toEqual(["b", "a"]);
    const equal = enrichBaselineRecommendations(baseline.slice(0, 2), [{ employeeId: "a", durationSeconds: 60, feasibility: "FEASIBLE" }, { employeeId: "b", durationSeconds: 60, feasibility: "FEASIBLE" }], false);
    expect(equal.map((candidate) => candidate.employeeId)).toEqual(["a", "b"]);
    const unavailable = enrichBaselineRecommendations(baseline.slice(0, 2), [{ employeeId: "a", feasibility: "UNAVAILABLE" }, { employeeId: "b", durationSeconds: 1, feasibility: "FEASIBLE" }], false);
    expect(unavailable.map((candidate) => candidate.employeeId)).toEqual(["a", "b"]);
  });
  it("returns at most three deterministic primary candidates by availability, capability, workload, and ID", () => {
    const result = recommendProductionCandidates(input([
      employee("employee-d"),
      employee("employee-c", { skills: services.map((service) => ({ serviceId: service.id, serviceName: service.name, technicalLevel: "WEAK" })) }),
      employee("employee-b", { closingLevel: "STRONG" }),
      employee("employee-a", { closingLevel: "STRONG" }),
    ]));
    expect(result.map((candidate) => candidate.employeeId)).toEqual(["employee-a", "employee-b", "employee-d"]);
    expect(result.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
    expect(result.every((candidate) => candidate.category === "PRIMARY" && !candidate.requiresOverride)).toBe(true);
  });

  it("uses clearly labelled UNKNOWN fallbacks only when fewer than two complete candidates exist", () => {
    const unknown = employee("unknown", { skills: [{ serviceId: "service-a", serviceName: "Service A", technicalLevel: "STRONG" }] });
    const onePrimary = recommendProductionCandidates(input([employee("known"), unknown]));
    expect(onePrimary).toHaveLength(2);
    expect(onePrimary[1]).toMatchObject({ employeeId: "unknown", category: "UNKNOWN_SKILL_FALLBACK", requiresOverride: true });
    expect(onePrimary[1].technicalSkills).toContainEqual({ serviceId: "service-b", serviceName: "Service B", technicalLevel: "UNKNOWN" });
    expect(onePrimary[1].warnings.join(" ")).toContain("Service B (service-b)");
    const twoPrimary = recommendProductionCandidates(input([employee("known-a"), employee("known-b"), unknown]));
    expect(twoPrimary.map((candidate) => candidate.employeeId)).toEqual(["known-a", "known-b"]);
  });

  it("hard-blocks OFF, inactive, overlapping, completed-tour, and cancelled-tour candidates", () => {
    const overlapping = employee("overlap", { assignments: [{ orderId: "other", startsAt: "2030-01-01T10:30:00Z", endsAt: "2030-01-01T11:00:00Z", status: "SCHEDULED", locationCoordinatesAvailable: true }] });
    expect(recommendProductionCandidates(input([employee("off", { isOff: true }), employee("inactive", { isActive: false }), overlapping]))).toEqual([]);
    expect(recommendProductionCandidates({ ...input([employee("eligible")]), tour: { ...input([]).tour, status: "COMPLETED" } })).toEqual([]);
  });

  it("labels near completion as a schedule estimate and never fabricates travel metrics", () => {
    const near = employee("near", { assignments: [{ orderId: "current", startsAt: "2030-01-01T07:00:00Z", endsAt: "2030-01-01T08:20:00Z", status: "DELAYED", locationCoordinatesAvailable: true }] });
    const result = recommendProductionCandidates(input([near]));
    expect(result[0]).toMatchObject({ availabilityState: "NEAR_COMPLETION", estimatedAvailableAt: "2030-01-01T08:20:00.000Z", travelEvaluation: "NOT_EVALUATED" });
    expect(result[0].reasons.join(" ")).toContain("Estimated from persisted schedule");
    expect(JSON.stringify(result[0])).not.toMatch(/travelMinutes|distanceKm|arrivalAt/);
  });

  it("counts non-cancelled business-day workload and emits coordinate quality warnings", () => {
    const candidate = employee("candidate", { homeBranchCoordinatesAvailable: false, assignments: [
      { orderId: "completed", startsAt: "2030-01-01T01:00:00Z", endsAt: "2030-01-01T02:00:00Z", status: "COMPLETED", locationCoordinatesAvailable: true },
      { orderId: "cancelled", startsAt: "2030-01-01T03:00:00Z", endsAt: "2030-01-01T04:00:00Z", status: "CANCELLED", locationCoordinatesAvailable: true },
    ] });
    const result = recommendProductionCandidates(input([candidate]));
    expect(result[0]).toMatchObject({ workloadCount: 1, travelEvaluation: "MISSING_ORIGIN" });
    expect(result[0].warnings.join(" ")).toContain("Home branch CS1 coordinates are unavailable");
  });
});
