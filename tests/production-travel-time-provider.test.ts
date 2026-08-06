import { describe, expect, it } from "vitest";
import { noProductionTravelTimeProvider, validateTravelResults } from "@/domain/production-travel-time-provider";
const item = { id: "a", origin: { latitude: 1, longitude: 2 }, destination: { latitude: 3, longitude: 4 } };
describe("production travel time provider boundary", () => {
  it("returns typed no-provider results without fake values", async () => expect(await noProductionTravelTimeProvider.estimateBatch({ items: [item] })).toMatchObject({ failure: "TOTAL_FAILURE", results: [{ id: "a", kind: "UNAVAILABLE", reason: "NO_PROVIDER" }] }));
  it("sanitizes malformed, duplicate, and missing responses", () => expect(validateTravelResults([item], { results: [{ id: "a", kind: "ESTIMATE", durationSeconds: -1 }, { id: "unknown", kind: "ESTIMATE", durationSeconds: 10 }] })).toEqual([{ id: "a", kind: "UNAVAILABLE", reason: "MALFORMED_RESPONSE" }]));
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("atomically rejects non-finite duration %s", (durationSeconds) => {
    expect(validateTravelResults([item], { results: [{ id: "a", kind: "ESTIMATE", durationSeconds }] })).toEqual([{ id: "a", kind: "UNAVAILABLE", reason: "MALFORMED_RESPONSE" }]);
  });
  it("rejects a valid result followed by a duplicate rather than retaining a partial estimate", () => {
    expect(validateTravelResults([item], { results: [{ id: "a", kind: "ESTIMATE", durationSeconds: 60 }, { id: "a", kind: "UNAVAILABLE", reason: "TIMEOUT" }] })).toEqual([{ id: "a", kind: "UNAVAILABLE", reason: "MALFORMED_RESPONSE" }]);
  });
});
