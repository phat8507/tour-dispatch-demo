import type { GeocodingProvider, GeocodingSuggestion } from "@/domain/geocoding-provider";
import { hasValidCoordinates } from "@/domain/geocoding-provider";

type LocationIqResult = { place_id?: string | number; osm_id?: string | number; display_name?: string; lat?: string; lon?: string };

export class GeocodingProviderUnavailableError extends Error { constructor() { super("GEOCODING_PROVIDER_UNAVAILABLE"); } }

export class LocationIqGeocodingProvider implements GeocodingProvider {
  constructor(private readonly apiKey: string | undefined, private readonly request: typeof fetch = fetch) {}

  async autocomplete(query: string): Promise<GeocodingSuggestion[]> {
    if (!this.apiKey) throw new GeocodingProviderUnavailableError();
    const url = new URL("https://api.locationiq.com/v1/autocomplete");
    url.search = new URLSearchParams({ key: this.apiKey, q: query, countrycodes: "vn", limit: "5", viewbox: "106.35,11.15,107.10,10.35", "accept-language": "en" }).toString();
    let response: Response;
    try { response = await this.request(url, { signal: AbortSignal.timeout(8_000) }); } catch { throw new GeocodingProviderUnavailableError(); }
    if (!response.ok) throw new GeocodingProviderUnavailableError();
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new GeocodingProviderUnavailableError(); }
    if (!Array.isArray(payload)) throw new GeocodingProviderUnavailableError();
    return payload.flatMap((result: LocationIqResult): GeocodingSuggestion[] => {
      const latitude = Number(result.lat); const longitude = Number(result.lon); const address = result.display_name?.trim();
      const id = String(result.place_id ?? result.osm_id ?? "").trim();
      return address && id && hasValidCoordinates(latitude, longitude) ? [{ id, address, latitude, longitude }] : [];
    });
  }
}
