import { describe, expect, it } from "vitest";
import { resolveEffectiveRoutingOrigin } from "@/domain/effective-routing-origin";

const point = { latitude: 1, longitude: 2 };
const base = { isActive: true, isOff: false, assignments: [], storedOrigin: point, homeBranch: null, proposedTourStartsAt: "2030-01-01T04:00:00Z", now: "2030-01-01T03:00:00Z" } as const;
describe("effective routing origin", () => {
  it("uses current assignment with persisted end plus fifteen minutes", () => {
    const result = resolveEffectiveRoutingOrigin({ ...base, assignments: [{ id: "a", startsAt: "2030-01-01T02:00:00Z", endsAt: "2030-01-01T03:20:00Z", status: "IN_PROGRESS", customer: point }] });
    expect(result).toMatchObject({ source: "CURRENT_ASSIGNMENT", availability: "NEAR_COMPLETION", departureAt: "2030-01-01T03:35:00.000Z" });
  });
  it("uses BUSY for more than thirty minutes and falls through missing customer coordinates", () => {
    const result = resolveEffectiveRoutingOrigin({ ...base, assignments: [{ id: "a", startsAt: "2030-01-01T02:00:00Z", endsAt: "2030-01-01T04:00:00Z", status: "DELAYED", customer: null }] });
    expect(result).toMatchObject({ source: "STORED_ORIGIN", warnings: ["CURRENT_CUSTOMER_COORDINATES_UNAVAILABLE"] });
  });
  it("chooses latest completed assignment on proposed local date with ID tie break", () => {
    const result = resolveEffectiveRoutingOrigin({ ...base, now: "2030-01-01T10:00:00Z", assignments: [{ id: "b", startsAt: "2030-01-01T00:00:00Z", endsAt: "2030-01-01T02:00:00Z", status: "COMPLETED", customer: { latitude: 3, longitude: 4 } }, { id: "a", startsAt: "2030-01-01T00:00:00Z", endsAt: "2030-01-01T02:00:00Z", status: "COMPLETED", customer: point }] });
    expect(result).toMatchObject({ source: "LATEST_COMPLETED", point });
  });
  it("excludes cancelled and hard blocked employees without mutating inputs", () => {
    const assignments = [{ id: "a", startsAt: "2030-01-01T02:00:00Z", endsAt: "2030-01-01T03:20:00Z", status: "CANCELLED" as const, customer: point }];
    expect(resolveEffectiveRoutingOrigin({ ...base, assignments, isOff: true })).toBeUndefined();
    expect(assignments[0].status).toBe("CANCELLED");
  });
});
