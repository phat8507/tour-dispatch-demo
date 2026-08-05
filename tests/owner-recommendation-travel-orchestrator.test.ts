import { describe, expect, it, vi } from "vitest";
import { orchestrateRecommendationTravel, prepareStoredOriginsForBaseline } from "@/server/owner-recommendation-travel-orchestrator";
import { enrichBaselineRecommendations } from "@/domain/production-candidate-recommendations";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";
const point = { latitude: 1, longitude: 2 };
const forbidden = new Set(["latitude", "longitude", "origin", "destination", "routingPoint", "coordinates", "distance", "distanceMeters", "durationSeconds", "requestId", "providerRequestId", "provider", "providerName", "providerMetadata", "rawResponse", "responsePayload", "signal", "error", "databaseRow"]);
function expectSafe(value: unknown): void { if (Array.isArray(value)) return void value.forEach(expectSafe); if (value && typeof value === "object") { expect(value).not.toBeInstanceOf(Error); expect(value).not.toBeInstanceOf(Date); for (const [key, nested] of Object.entries(value)) { expect(forbidden.has(key)).toBe(false); expectSafe(nested); } } else expect(["function", "symbol", "bigint"]).not.toContain(typeof value); }
const baseline: CandidateRecommendation[] = ["one", "two", "three", "four"].map((employeeId, index) => ({ employeeId, employeeName: employeeId, rank: index + 1, category: "PRIMARY", requiresOverride: false, availabilityState: "AVAILABLE_NOW", estimatedAvailableAt: null, workloadCount: 0, closingLevel: "NORMAL", technicalSkills: [], reasons: [], warnings: [], travelEvaluation: "NOT_EVALUATED" }));
describe("owner recommendation travel orchestration", () => {
  it("prepares only baseline top-three employees from the shared origin lookup", () => {
    const origins = new Map([["one", { employeeId: "one", latitude: 1, longitude: 2 }], ["four", { employeeId: "four", latitude: 3, longitude: 4 }]]);
    const prepared = prepareStoredOriginsForBaseline([{ orderId: "tour", recommendations: ["one", "two", "three", "four"].map((employeeId, index) => ({ employeeId, rank: index + 1 })) as never }], origins);
    expect(prepared.get("tour")).toEqual(["one"]);
  });
  it("never sends a fourth baseline candidate to the controlled provider", async () => {
    const origins = new Map(["one", "two", "three", "four"].map((employeeId) => [employeeId, { employeeId, latitude: 1, longitude: 2 }]));
    const baseline = [{ orderId: "tour", recommendations: ["one", "two", "three", "four"].map((employeeId, index) => ({ employeeId, rank: index + 1 })) as never }];
    const selected = prepareStoredOriginsForBaseline(baseline, origins).get("tour") ?? [];
    const estimateBatch = vi.fn().mockImplementation(async ({ items }: { items: Array<{ id: string }> }) => ({ results: items.map((item) => ({ id: item.id, kind: "ESTIMATE" as const, durationSeconds: 60 })) }));
    await orchestrateRecommendationTravel({ candidates: selected.map((employeeId) => ({ employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null })), destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch } });
    const sent = (estimateBatch.mock.calls[0][0] as { items: Array<{ id: string }> }).items.map((item) => item.id);
    expect(selected).toEqual(["one", "two", "three"]);
    expect(sent.join(" ")).not.toContain("four");
  });
  it("keeps candidate-specific missing origin separate from one provider-wide warning", async () => {
    const result = await orchestrateRecommendationTravel({ candidates: [{ employeeId: "missing", isActive: true, isOff: false, assignments: [], storedOrigin: null, homeBranch: null }, { employeeId: "present", isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }], destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => ({ results: items.map((item) => ({ id: item.id, kind: "UNAVAILABLE" as const, reason: "NO_PROVIDER" as const })), failure: "TOTAL_FAILURE" }) } });
    expect(result.providerWarning).toBe("NO_PROVIDER");
    expect(result.enrichment.find((item) => item.employeeId === "missing")).toMatchObject({ candidateWarningCodes: ["MISSING_ORIGIN"] });
    expect(result.enrichment.find((item) => item.employeeId === "present")).not.toHaveProperty("durationSeconds");
  });
  it.each(["NO_PROVIDER", "TOTAL_FAILURE", "TIMEOUT", "RATE_LIMITED", "MALFORMED_RESPONSE"] as const)("preserves exact baseline order and emits one safe %s warning", async (mode) => {
    const provider = { estimateBatch: async ({ items }: { items: readonly { id: string }[] }) => {
      if (mode === "TIMEOUT") return { results: items.map((item) => ({ id: item.id, kind: "UNAVAILABLE" as const, reason: "TIMEOUT" as const })), failure: "TOTAL_FAILURE" as const };
      if (mode === "MALFORMED_RESPONSE") return { results: items.concat(items).map((item) => ({ id: item.id, kind: "ESTIMATE" as const, durationSeconds: -1 })), failure: "TOTAL_FAILURE" as const };
      return { results: items.map((item) => ({ id: item.id, kind: "UNAVAILABLE" as const, reason: mode === "RATE_LIMITED" ? "RATE_LIMITED" as const : "NO_PROVIDER" as const })), failure: "TOTAL_FAILURE" as const };
    } };
    const candidates = ["one", "two", "three"].map((employeeId) => ({ employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }));
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider });
    if (mode === "TIMEOUT" || mode === "RATE_LIMITED") expect(result.providerWarning).toBe(mode);
    const dto = { recommendations: enrichBaselineRecommendations(baseline, result.enrichment, false, false), providerWarning: result.providerWarning ?? (mode === "MALFORMED_RESPONSE" ? "MALFORMED_RESPONSE" : mode) };
    expect(dto.recommendations.map((candidate) => candidate.employeeId)).toEqual(["one", "two", "three", "four"]);
    expect(dto.recommendations).toHaveLength(4);
    expect(dto.recommendations.every((candidate) => candidate.estimatedTravelMinutes === undefined)).toBe(true);
    expect(dto.recommendations.every((candidate) => !candidate.candidateWarningCodes?.includes(dto.providerWarning as never))).toBe(true);
    const parsed = JSON.parse(JSON.stringify(dto)); expect(parsed).toEqual(dto); expectSafe(dto);
  });
  it("rounds real durations with Math.round and never uses zero for unavailable", () => {
    const result = enrichBaselineRecommendations(baseline.slice(0, 3), [{ employeeId: "one", durationSeconds: 29, feasibility: "FEASIBLE" }, { employeeId: "two", durationSeconds: 30, feasibility: "FEASIBLE" }, { employeeId: "three", feasibility: "UNAVAILABLE", candidateWarningCodes: ["MISSING_ORIGIN"] }], false, false);
    expect(result.map((item) => item.estimatedTravelMinutes)).toEqual([0, 1, undefined]);
    expect(result[2].candidateWarningCodes).toEqual(["MISSING_ORIGIN"]); expectSafe({ recommendations: result });
  });
  it("uses raw seconds and persisted current-assignment departure time at exact feasibility boundaries", async () => {
    const startsAt = "2030-01-01T03:30:00.000Z"; const now = "2030-01-01T03:00:00.000Z";
    const calls: Array<{ departureAt?: string }> = [];
    const candidate = { employeeId: "current", isActive: true, isOff: false, assignments: [{ id: "assignment", startsAt: "2030-01-01T02:00:00.000Z", endsAt: "2030-01-01T03:15:00.000Z", status: "IN_PROGRESS" as const, customer: point }], storedOrigin: null, homeBranch: null };
    for (const [durationSeconds, status] of [[0, "FEASIBLE"], [1, "INFEASIBLE"]] as const) {
      const result = await orchestrateRecommendationTravel({ candidates: [candidate], destination: point, proposedTourStartsAt: startsAt, proposedTourEndsAt: "2030-01-01T04:00:00.000Z", now, provider: { estimateBatch: async ({ items }) => { calls.push({ departureAt: items[0].departureAt }); return { results: [{ id: items[0].id, kind: "ESTIMATE", durationSeconds }] }; } } });
      expect(result.enrichment[0].feasibility).toBe(status);
    }
    expect(calls[0].departureAt).toBe("2030-01-01T03:30:00.000Z");
  });
  it("treats duplicate known provider result IDs as a tour-level malformed response", async () => {
    const expected = baseline.slice(0, 3);
    const candidates = expected.map((candidate) => ({ employeeId: candidate.employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }));
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => ({ results: [{ id: items[0].id, kind: "ESTIMATE" as const, durationSeconds: 60 }, { id: items[0].id, kind: "ESTIMATE" as const, durationSeconds: 60 }], failure: "TOTAL_FAILURE" }) } });
    const dto = { recommendations: enrichBaselineRecommendations(expected, result.enrichment, true, false), providerWarning: result.providerWarning };
    expect(dto.providerWarning).toBe("MALFORMED_RESPONSE");
    expect(dto.recommendations.map((candidate) => candidate.employeeId)).toEqual(expected.map((candidate) => candidate.employeeId));
    expect(dto.recommendations).toHaveLength(3);
    expect(dto.recommendations.every((candidate) => candidate.estimatedTravelMinutes === undefined && !candidate.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE"))).toBe(true);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto); expectSafe(dto);
  });
  it("treats an unknown provider response ID as an atomic malformed response", async () => {
    const expected = baseline.slice(0, 3);
    const candidates = expected.map((candidate) => ({ employeeId: candidate.employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }));
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => ({ results: [{ id: items[0].id, kind: "ESTIMATE" as const, durationSeconds: 60 }, { id: "unknown-response", kind: "ESTIMATE" as const, durationSeconds: 60 }], failure: "TOTAL_FAILURE" }) } });
    const dto = { recommendations: enrichBaselineRecommendations(expected, result.enrichment, true, false), providerWarning: result.providerWarning };
    expect(dto.providerWarning).toBe("MALFORMED_RESPONSE");
    expect(dto.recommendations.map((candidate) => candidate.employeeId)).toEqual(expected.map((candidate) => candidate.employeeId));
    expect(dto.recommendations).toHaveLength(3);
    expect(dto.recommendations.every((candidate) => candidate.estimatedTravelMinutes === undefined && candidate.travelStatus !== "ESTIMATED_FEASIBLE" && candidate.travelStatus !== "ESTIMATED_INFEASIBLE" && !candidate.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE"))).toBe(true);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto); expectSafe(dto);
  });
  it("treats a negative provider duration as an atomic malformed response", async () => {
    const expected = baseline.slice(0, 3);
    const candidates = expected.map((candidate) => ({ employeeId: candidate.employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }));
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => ({ results: [{ id: items[0].id, kind: "ESTIMATE" as const, durationSeconds: -1 }], failure: "TOTAL_FAILURE" }) } });
    const dto = { recommendations: enrichBaselineRecommendations(expected, result.enrichment, true, false), providerWarning: result.providerWarning };
    expect(dto.providerWarning).toBe("MALFORMED_RESPONSE");
    expect(dto.recommendations.map((candidate) => candidate.employeeId)).toEqual(expected.map((candidate) => candidate.employeeId));
    expect(dto.recommendations.every((candidate) => candidate.estimatedTravelMinutes === undefined && candidate.travelStatus !== "ESTIMATED_FEASIBLE" && candidate.travelStatus !== "ESTIMATED_INFEASIBLE" && !candidate.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE"))).toBe(true);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto); expectSafe(dto);
  });
  it("uses one deduplicated provider batch and fans results out", async () => {
    const estimateBatch = vi.fn().mockImplementation(async ({ items }: { items: Array<{ id: string }> }) => ({ results: items.map((item) => ({ id: item.id, kind: "ESTIMATE" as const, durationSeconds: 60 })) }));
    const result = await orchestrateRecommendationTravel({ candidates: ["a", "b"].map((employeeId) => ({ employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null })), destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch } });
    expect(estimateBatch).toHaveBeenCalledTimes(1); expect(result.enrichment).toHaveLength(2);
  });
  it.each([true, false])("keeps all-unavailable %s tours in exact baseline order without a fabricated provider warning", async (urgent) => {
    const candidates = baseline.slice(0, 3).map((candidate) => ({ employeeId: candidate.employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null }));
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: urgent ? "2030-01-01T03:20:00Z" : "2030-01-01T06:00:00Z", proposedTourEndsAt: "2030-01-01T07:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => ({ results: items.map((item) => ({ id: item.id, kind: "UNAVAILABLE" as const, reason: "PROVIDER_FAILURE" as const })) }) } });
    const dto = enrichBaselineRecommendations(baseline.slice(0, 3), result.enrichment, urgent);
    expect(dto.map((candidate) => candidate.employeeId)).toEqual(["one", "two", "three"]);
    expect(dto.every((candidate) => candidate.estimatedTravelMinutes === undefined && candidate.travelStatus === "UNAVAILABLE" && !candidate.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE"))).toBe(true);
    expect(result.providerWarning).toBeUndefined();
  });
  it("sorts physical requests, chunks deterministically, and isolates a failed chunk", async () => {
    const candidates = ["c", "a", "b"].map((employeeId, index) => ({ employeeId, isActive: true, isOff: false, assignments: [], storedOrigin: { latitude: index + 1, longitude: index + 1 }, homeBranch: null }));
    const calls: string[][] = [];
    const result = await orchestrateRecommendationTravel({ candidates, destination: point, proposedTourStartsAt: "2030-01-01T06:00:00Z", proposedTourEndsAt: "2030-01-01T07:00:00Z", now: "2030-01-01T03:00:00Z", maxBatchItems: 1, provider: { estimateBatch: async ({ items }) => { calls.push(items.map((item) => item.id)); if (calls.length === 2) throw new Error("controlled failure"); return { results: items.map((item) => ({ id: item.id, kind: "ESTIMATE" as const, durationSeconds: 60 })) }; } } });
    expect(calls).toEqual([["routing:1"], ["routing:2"], ["routing:3"]]);
    expect(result.enrichment.filter((item) => item.durationSeconds === 60)).toHaveLength(2);
    expect(result.enrichment.filter((item) => item.feasibility === "UNAVAILABLE")).toHaveLength(1);
  });
  it("selects the earliest non-cancelled next assignment and emits advisory chain warnings only", async () => {
    const candidate = { employeeId: "one", isActive: true, isOff: false, storedOrigin: point, homeBranch: null, assignments: [
      { id: "cancelled", startsAt: "2030-01-01T05:00:00Z", endsAt: "2030-01-01T06:00:00Z", status: "CANCELLED" as const, customer: point },
      { id: "b", startsAt: "2030-01-01T04:30:00Z", endsAt: "2030-01-01T05:00:00Z", status: "SCHEDULED" as const, customer: point },
      { id: "a", startsAt: "2030-01-01T04:30:00Z", endsAt: "2030-01-01T05:00:00Z", status: "SCHEDULED" as const, customer: point },
    ] };
    const calls: Array<{ departureAt?: string }> = [];
    const result = await orchestrateRecommendationTravel({ candidates: [candidate], destination: point, proposedTourStartsAt: "2030-01-01T03:20:00Z", proposedTourEndsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z", provider: { estimateBatch: async ({ items }) => { calls.push(...items); return { results: items.map((item) => ({ id: item.id, kind: "ESTIMATE" as const, durationSeconds: item.departureAt === "2030-01-01T04:00:00Z" ? 1900 : 60 })) }; } } });
    expect(calls).toHaveLength(2);
    expect(result.enrichment[0]).toMatchObject({ durationSeconds: 60, nextAssignmentWarning: "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE" });
  });
});
