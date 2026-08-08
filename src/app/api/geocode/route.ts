import { NextRequest, NextResponse } from "next/server";

type Suggestion = { id: string; address: string; latitude: number; longitude: number };
type PlaceType = "address" | "street" | "intersection" | "poi" | "area";

const placeTypes: ReadonlySet<string> = new Set(["address", "street", "intersection", "poi", "area"]);
const detailsType: Record<PlaceType, string> = { address: "addresses", street: "streets", intersection: "intersections", poi: "pois", area: "areas" };

function headers(key: string, sessionId: string): HeadersInit {
  return { "TomTom-Api-Key": key, "TomTom-Api-Version": "3", "Session-Id": sessionId, "Accept-Language": "vi-VN,vi", Accept: "application/json" };
}

function placeAddress(place: Record<string, unknown>): string {
  const title = typeof place.title === "string" ? place.title : "";
  const subtitles = Array.isArray(place.subtitles) ? place.subtitles.filter((value): value is string => typeof value === "string") : [];
  return [title, ...subtitles].filter(Boolean).join(", ");
}

function resolvedSuggestion(place: unknown): Suggestion | undefined {
  if (typeof place !== "object" || place === null) return undefined;
  const value = place as Record<string, unknown>;
  const position = value.position;
  if (typeof value.id !== "string" || typeof position !== "object" || position === null) return undefined;
  const coordinates = (position as Record<string, unknown>).coordinates;
  if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return undefined;
  const address = placeAddress(value);
  return address ? { id: value.id, address, longitude: coordinates[0], latitude: coordinates[1] } : undefined;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ suggestions: [] });
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });

  try {
    const sessionId = crypto.randomUUID();
    const suggestResponse = await fetch("https://api.tomtom.com/maps/orbis/places/suggest", {
      method: "POST",
      headers: { ...headers(key, sessionId), "Content-Type": "application/json", Attributes: "results" },
      body: JSON.stringify({ query, origin: { type: "point", coordinates: [106.70, 10.78] }, preferences: { geometry: { type: "point", coordinates: [106.70, 10.78] } }, filters: { types: ["address", "street", "intersection", "poi"], countryCodesIso2: ["VN"] } }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!suggestResponse.ok) throw new Error("suggest unavailable");
    const suggestPayload: unknown = await suggestResponse.json();
    const results = typeof suggestPayload === "object" && suggestPayload !== null && Array.isArray((suggestPayload as { results?: unknown }).results) ? (suggestPayload as { results: unknown[] }).results : [];
    const candidates = results.filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { type?: unknown }).type === "string" && placeTypes.has((value as { type: string }).type)).slice(0, 5);
    const details = await Promise.all(candidates.map(async (candidate) => {
      const type = candidate.type as PlaceType;
      const response = await fetch(`https://api.tomtom.com/maps/orbis/places/details/${detailsType[type]}/${encodeURIComponent(candidate.id as string)}`, { headers: { ...headers(key, sessionId), Attributes: "id,type,title,subtitles,position,address" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return undefined;
      return resolvedSuggestion(await response.json());
    }));
    return NextResponse.json({ suggestions: details.filter((value): value is Suggestion => Boolean(value)) });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
