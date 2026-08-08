import type { ProductionTravelTimeProvider, TravelRequestItem, TravelResult } from "@/domain/production-travel-time-provider";

export class TomTomTravelTimeProvider implements ProductionTravelTimeProvider {
  constructor(private readonly apiKey: string, private readonly request: typeof fetch = fetch) {}
  async estimateBatch({ items, signal }: { items: readonly TravelRequestItem[]; signal?: AbortSignal }) {
    const results = await Promise.all(items.slice(0, 3).map(async (item): Promise<TravelResult> => {
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${item.origin.latitude},${item.origin.longitude}:${item.destination.latitude},${item.destination.longitude}/json?key=${encodeURIComponent(this.apiKey)}&traffic=true&travelMode=car`;
      try { const response = await this.request(url, { signal: signal ?? AbortSignal.timeout(10_000) }); if (!response.ok) return { id: item.id, kind: "UNAVAILABLE", reason: response.status === 429 ? "RATE_LIMITED" : "PROVIDER_FAILURE" }; const json: unknown = await response.json(); const summary = typeof json === "object" && json !== null && "routes" in json && Array.isArray(json.routes) ? (json.routes[0] as { summary?: { travelTimeInSeconds?: number; lengthInMeters?: number } })?.summary : undefined; return Number.isFinite(summary?.travelTimeInSeconds) ? { id: item.id, kind: "ESTIMATE", durationSeconds: summary!.travelTimeInSeconds!, distanceMeters: summary?.lengthInMeters } : { id: item.id, kind: "UNAVAILABLE", reason: "MALFORMED_RESPONSE" }; } catch { return { id: item.id, kind: "UNAVAILABLE", reason: "PROVIDER_FAILURE" }; }
    }));
    return { results, ...(results.every((item) => item.kind === "UNAVAILABLE") ? { failure: "TOTAL_FAILURE" as const } : {}) };
  }
}
