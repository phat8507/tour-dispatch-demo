import { describe, expect, it, vi } from "vitest";
import { GeocodingProviderUnavailableError, LocationIqGeocodingProvider } from "@/server/locationiq-geocoding-provider";

describe("LocationIQ geocoding provider", () => {
  it("uses LocationIQ autocomplete with Vietnam restriction and local bias", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ place_id: "place", display_name: "123 Nguyễn Trãi, TP.HCM", lat: "10.76", lon: "106.68" }]), { status: 200 }));
    const results = await new LocationIqGeocodingProvider("secret", request).autocomplete("123 Nguyễn Trãi");
    const url = new URL(request.mock.calls[0][0]);
    expect(url.hostname).toBe("api.locationiq.com");
    expect(url.searchParams.get("countrycodes")).toBe("vn");
    expect(url.searchParams.get("viewbox")).toBe("106.35,11.15,107.10,10.35");
    expect(results).toEqual([{ id: "place", address: "123 Nguyễn Trãi, TP.HCM", latitude: 10.76, longitude: 106.68 }]);
  });

  it("does not expose provider failures as suggestions", async () => {
    await expect(new LocationIqGeocodingProvider(undefined).autocomplete("Nguyễn Trãi")).rejects.toBeInstanceOf(GeocodingProviderUnavailableError);
    await expect(new LocationIqGeocodingProvider("secret", vi.fn().mockResolvedValue(new Response("", { status: 500 }))).autocomplete("Nguyễn Trãi")).rejects.toBeInstanceOf(GeocodingProviderUnavailableError);
  });
});
