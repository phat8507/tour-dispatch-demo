import { businessDateInHoChiMinh } from "./business-date";

export type RoutingPoint = Readonly<{ latitude: number; longitude: number }>;
export type OriginWarning = "CURRENT_CUSTOMER_COORDINATES_UNAVAILABLE" | "COMPLETED_CUSTOMER_COORDINATES_UNAVAILABLE" | "HOME_BRANCH_FALLBACK" | "MISSING_ORIGIN";
export type OriginSource = "CURRENT_ASSIGNMENT" | "LATEST_COMPLETED" | "STORED_ORIGIN" | "HOME_BRANCH" | "MISSING_ORIGIN";
export type OriginAssignment = Readonly<{ id: string; startsAt: string; endsAt: string; status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED"; customer: RoutingPoint | null }>;
export type EffectiveOrigin = Readonly<{ source: Exclude<OriginSource, "MISSING_ORIGIN">; point: RoutingPoint; departureAt: string; availability: "BUSY" | "NEAR_COMPLETION" | "AVAILABLE"; warnings: readonly OriginWarning[] }> | Readonly<{ source: "MISSING_ORIGIN"; warnings: readonly OriginWarning[] }>;

const active = new Set<OriginAssignment["status"]>(["SCHEDULED", "IN_PROGRESS", "DELAYED"]);
function timestamp(value: string): number | undefined { const result = new Date(value).getTime(); return Number.isFinite(result) ? result : undefined; }
function usable(point: RoutingPoint | null | undefined): point is RoutingPoint { return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180; }

export function resolveEffectiveRoutingOrigin(input: Readonly<{ isActive: boolean; isOff: boolean; assignments: readonly OriginAssignment[]; storedOrigin: RoutingPoint | null; homeBranch: RoutingPoint | null; proposedTourStartsAt: string; now: string }>): EffectiveOrigin | undefined {
  if (!input.isActive || input.isOff) return undefined;
  const now = timestamp(input.now); const proposed = timestamp(input.proposedTourStartsAt);
  if (now === undefined || proposed === undefined) return { source: "MISSING_ORIGIN", warnings: ["MISSING_ORIGIN"] };
  const warnings: OriginWarning[] = [];
  const current = input.assignments.filter((item) => active.has(item.status) && item.status !== "CANCELLED").filter((item) => { const start = timestamp(item.startsAt); const end = timestamp(item.endsAt); return start !== undefined && end !== undefined && start <= now && now < end; }).sort((a, b) => (timestamp(a.endsAt) ?? 0) - (timestamp(b.endsAt) ?? 0) || a.id.localeCompare(b.id))[0];
  if (current) { const end = timestamp(current.endsAt)!; if (usable(current.customer)) return { source: "CURRENT_ASSIGNMENT", point: current.customer, departureAt: new Date(end + 15 * 60_000).toISOString(), availability: end - now <= 30 * 60_000 ? "NEAR_COMPLETION" : "BUSY", warnings }; warnings.push("CURRENT_CUSTOMER_COORDINATES_UNAVAILABLE"); }
  const date = businessDateInHoChiMinh(new Date(proposed));
  const completed = input.assignments.filter((item) => item.status === "COMPLETED").filter((item) => { const end = timestamp(item.endsAt); return end !== undefined && end <= Math.min(now, proposed) && businessDateInHoChiMinh(new Date(end)) === date; }).sort((a, b) => (timestamp(b.endsAt) ?? 0) - (timestamp(a.endsAt) ?? 0) || a.id.localeCompare(b.id))[0];
  if (completed) { if (usable(completed.customer)) return { source: "LATEST_COMPLETED", point: completed.customer, departureAt: input.now, availability: "AVAILABLE", warnings }; warnings.push("COMPLETED_CUSTOMER_COORDINATES_UNAVAILABLE"); }
  if (usable(input.storedOrigin)) return { source: "STORED_ORIGIN", point: input.storedOrigin, departureAt: input.now, availability: "AVAILABLE", warnings };
  if (usable(input.homeBranch)) return { source: "HOME_BRANCH", point: input.homeBranch, departureAt: input.now, availability: "AVAILABLE", warnings: [...warnings, "HOME_BRANCH_FALLBACK"] };
  return { source: "MISSING_ORIGIN", warnings: [...warnings, "MISSING_ORIGIN"] };
}
