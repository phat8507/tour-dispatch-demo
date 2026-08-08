import { resolveEffectiveRoutingOrigin, type OriginAssignment, type RoutingPoint } from "@/domain/effective-routing-origin";
import { validateTravelResults, type ProductionTravelTimeProvider, type TravelRequestItem, type TravelResult } from "@/domain/production-travel-time-provider";
import type { CandidateTravelEnrichment } from "@/domain/production-candidate-recommendations";
import type { OwnerTourRecommendations, StoredRoutingOrigin } from "./owner-dispatch-read-model";

export const MAX_TRAVEL_BATCH_ITEMS = 300;
export type ProviderWarning = "NO_PROVIDER" | "TIMEOUT" | "RATE_LIMITED" | "MALFORMED_RESPONSE" | "TOTAL_FAILURE";
export type RoutingCandidate = Readonly<{ employeeId: string; isActive: boolean; isOff: boolean; assignments: readonly OriginAssignment[]; storedOrigin: RoutingPoint | null; homeBranch: RoutingPoint | null }>;
type LogicalRequest = Readonly<{ employeeId: string; kind: "TOUR" | "CHAIN"; request: TravelRequestItem; departureAt: string; originSource?: string }>;

export function prepareStoredOriginsForBaseline(recommendations: readonly OwnerTourRecommendations[], origins: ReadonlyMap<string, StoredRoutingOrigin>): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, readonly string[]>();
  for (const tour of recommendations) result.set(tour.orderId, tour.recommendations.slice(0, 3).filter((candidate) => origins.has(candidate.employeeId)).map((candidate) => candidate.employeeId));
  return result;
}

function warningFromResults(results: readonly TravelResult[], failure: "PARTIAL_FAILURE" | "TOTAL_FAILURE" | undefined): ProviderWarning | undefined {
  if (results.some((item) => item.kind === "UNAVAILABLE" && item.reason === "MALFORMED_RESPONSE")) return "MALFORMED_RESPONSE";
  if (failure !== "TOTAL_FAILURE") return undefined;
  const reason = results.find((item): item is Extract<TravelResult, { kind: "UNAVAILABLE" }> => item.kind === "UNAVAILABLE")?.reason;
  return reason === "NO_PROVIDER" || reason === "TIMEOUT" || reason === "RATE_LIMITED" ? reason : "TOTAL_FAILURE";
}

export async function orchestrateRecommendationTravel(input: Readonly<{ candidates: readonly RoutingCandidate[]; destination: RoutingPoint | null; proposedTourStartsAt: string; proposedTourEndsAt: string; now: string; provider: ProductionTravelTimeProvider; maxBatchItems?: number }>): Promise<Readonly<{ enrichment: readonly CandidateTravelEnrichment[]; providerWarning?: ProviderWarning }>> {
  if (!input.destination) return { enrichment: input.candidates.map((candidate) => ({ employeeId: candidate.employeeId, feasibility: "UNAVAILABLE", candidateWarningCodes: ["MISSING_DESTINATION"] })) };
  const requested: LogicalRequest[] = [];
  const unavailable = new Map<string, CandidateTravelEnrichment>();
  const unavailableChain = new Set<string>();
  const proposedEnd = new Date(input.proposedTourEndsAt).getTime();
  for (const candidate of input.candidates) {
    const origin = resolveEffectiveRoutingOrigin({ ...candidate, proposedTourStartsAt: input.proposedTourStartsAt, now: input.now });
    if (!origin) continue;
    if (origin.source === "MISSING_ORIGIN") {
      unavailable.set(candidate.employeeId, { employeeId: candidate.employeeId, feasibility: "UNAVAILABLE", candidateWarningCodes: ["MISSING_ORIGIN"] });
      continue;
    }
    requested.push({ employeeId: candidate.employeeId, kind: "TOUR", departureAt: origin.departureAt, originSource: origin.source, request: { id: `tour:${candidate.employeeId}:${input.proposedTourStartsAt}:${origin.departureAt}`, origin: origin.point, destination: input.destination, departureAt: origin.departureAt } });
    const next = candidate.assignments.filter((assignment) => assignment.status !== "CANCELLED" && new Date(assignment.startsAt).getTime() >= proposedEnd).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() || left.id.localeCompare(right.id))[0];
    if (next) {
      if (!next.customer) unavailableChain.add(candidate.employeeId);
      else requested.push({ employeeId: candidate.employeeId, kind: "CHAIN", departureAt: input.proposedTourEndsAt, request: { id: `chain:${candidate.employeeId}:${input.proposedTourEndsAt}:${next.id}`, origin: input.destination, destination: next.customer, departureAt: input.proposedTourEndsAt } });
    }
  }
  const signature = (request: TravelRequestItem): string => `${request.origin.latitude}|${request.origin.longitude}|${request.destination.latitude}|${request.destination.longitude}|${request.departureAt ?? ""}`;
  const grouped = new Map<string, TravelRequestItem>();
  for (const item of requested) grouped.set(signature(item.request), item.request);
  const physicalIdByLogicalId = new Map<string, string>();
  const physical = Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, request], index) => {
    const id = `routing:${index + 1}`;
    for (const logical of requested) if (signature(logical.request) === key) physicalIdByLogicalId.set(logical.request.id, id);
    return { ...request, id };
  });
  const results = new Map<string, TravelResult>();
  let providerWarning: ProviderWarning | undefined;
  let malformed = false;
  const cap = input.maxBatchItems ?? MAX_TRAVEL_BATCH_ITEMS;
  for (let index = 0; index < physical.length; index += cap) {
    const chunk = physical.slice(index, index + cap);
    try {
      const response = await input.provider.estimateBatch({ items: chunk });
      const validated = validateTravelResults(chunk, response);
      const warning = warningFromResults(validated, response.failure);
      if (warning === "MALFORMED_RESPONSE") malformed = true;
      if (warning && warning !== "MALFORMED_RESPONSE") providerWarning = warning;
      for (const result of validated) results.set(result.id, result);
    } catch {
      for (const request of chunk) results.set(request.id, { id: request.id, kind: "UNAVAILABLE", reason: "PROVIDER_FAILURE" });
    }
  }
  if (malformed) return { enrichment: input.candidates.map((candidate) => ({ employeeId: candidate.employeeId, feasibility: "UNAVAILABLE" })), providerWarning: "MALFORMED_RESPONSE" };
  const now = new Date(input.now).getTime(); const start = new Date(input.proposedTourStartsAt).getTime();
  const urgent = Number.isFinite(now) && Number.isFinite(start) && start >= now && start - now <= 30 * 60_000;
  const enrichment = input.candidates.map((candidate) => {
    const tour = requested.find((item) => item.employeeId === candidate.employeeId && item.kind === "TOUR");
    const chain = requested.find((item) => item.employeeId === candidate.employeeId && item.kind === "CHAIN");
    const existing = unavailable.get(candidate.employeeId);
    const chainResult = chain ? results.get(physicalIdByLogicalId.get(chain.request.id) ?? "") : undefined;
    const nextStart = candidate.assignments.filter((assignment) => assignment.status !== "CANCELLED" && new Date(assignment.startsAt).getTime() >= proposedEnd).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() || left.id.localeCompare(right.id))[0]?.startsAt;
    const chainWarning: CandidateTravelEnrichment["nextAssignmentWarning"] = unavailableChain.has(candidate.employeeId)
      ? "NEXT_ASSIGNMENT_TRAVEL_UNAVAILABLE"
      : !chainResult || chainResult.kind === "UNAVAILABLE"
        ? (chain ? "NEXT_ASSIGNMENT_TRAVEL_UNAVAILABLE" : undefined)
        : chain && nextStart && new Date(chain.departureAt).getTime() + chainResult.durationSeconds * 1000 > new Date(nextStart).getTime()
          ? "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE"
          : undefined;
    if (existing?.candidateWarningCodes) return { ...existing, ...(chainWarning === undefined ? {} : { nextAssignmentWarning: chainWarning }) };
    const result = tour ? results.get(physicalIdByLogicalId.get(tour.request.id) ?? "") : undefined;
    if (!tour || !result || result.kind === "UNAVAILABLE") return { employeeId: candidate.employeeId, feasibility: "UNAVAILABLE" as const, ...(chainWarning === undefined ? {} : { nextAssignmentWarning: chainWarning }) };
    const feasible = new Date(tour.departureAt).getTime() + result.durationSeconds * 1000 <= start;
    return { employeeId: candidate.employeeId, durationSeconds: result.durationSeconds, distanceMeters: result.distanceMeters, originSource: tour?.originSource, feasibility: (!urgent || feasible ? "FEASIBLE" : "INFEASIBLE") as "FEASIBLE" | "INFEASIBLE", ...(chainWarning === undefined ? {} : { nextAssignmentWarning: chainWarning }) };
  });
  return { enrichment, ...(providerWarning === undefined ? {} : { providerWarning }) };
}
