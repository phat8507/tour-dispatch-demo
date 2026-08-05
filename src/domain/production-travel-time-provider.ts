import type { RoutingPoint } from "./effective-routing-origin";
export type TravelUnavailableReason = "NO_PROVIDER" | "MISSING_ORIGIN" | "MISSING_DESTINATION" | "TIMEOUT" | "RATE_LIMITED" | "MALFORMED_RESPONSE" | "PROVIDER_FAILURE";
export type TravelRequestItem = Readonly<{ id: string; origin: RoutingPoint; destination: RoutingPoint; departureAt?: string }>;
export type TravelResult = Readonly<{ id: string; kind: "ESTIMATE"; durationSeconds: number }> | Readonly<{ id: string; kind: "UNAVAILABLE"; reason: TravelUnavailableReason }>;
export interface ProductionTravelTimeProvider { estimateBatch(request: Readonly<{ items: readonly TravelRequestItem[]; signal?: AbortSignal }>): Promise<Readonly<{ results: readonly TravelResult[]; failure?: "PARTIAL_FAILURE" | "TOTAL_FAILURE" }>>; }
export const noProductionTravelTimeProvider: ProductionTravelTimeProvider = { async estimateBatch({ items }) { return { results: items.map((item) => ({ id: item.id, kind: "UNAVAILABLE" as const, reason: "NO_PROVIDER" as const })), failure: "TOTAL_FAILURE" }; } };
export function validateTravelResults(items: readonly TravelRequestItem[], result: Readonly<{ results: readonly TravelResult[] }>): TravelResult[] {
  const requested = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  const byId = new Map<string, TravelResult>();
  let malformed = false;
  for (const item of result.results) {
    if (!requested.has(item.id) || seen.has(item.id) || (item.kind === "ESTIMATE" && (!Number.isFinite(item.durationSeconds) || item.durationSeconds < 0))) {
      malformed = true;
      continue;
    }
    seen.add(item.id);
    byId.set(item.id, item);
  }
  if (seen.size !== requested.size) malformed = true;
  return items.map((item) => malformed
    ? { id: item.id, kind: "UNAVAILABLE" as const, reason: "MALFORMED_RESPONSE" as const }
    : byId.get(item.id)!);
}
