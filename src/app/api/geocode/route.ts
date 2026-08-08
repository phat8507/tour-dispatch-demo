import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ suggestions: [] });
  try {
    if (!process.env.TOMTOM_API_KEY) throw new Error("unavailable");
    const response = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${encodeURIComponent(process.env.TOMTOM_API_KEY)}&countrySet=VN&limit=5&lat=10.78&lon=106.70`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("unavailable");
    const payload: unknown = await response.json();
    const rows = typeof payload === "object" && payload !== null && "results" in payload && Array.isArray(payload.results) ? payload.results : [];
    const suggestions = rows.flatMap((row): Array<{ id: string; address: string; latitude: number; longitude: number }> => { if (typeof row !== "object" || row === null || !("id" in row) || !("position" in row) || typeof row.position !== "object" || row.position === null || !("lat" in row.position) || !("lon" in row.position)) return []; const address = "address" in row && typeof row.address === "object" && row.address !== null && "freeformAddress" in row.address && typeof row.address.freeformAddress === "string" ? row.address.freeformAddress : ""; return typeof row.id === "string" && typeof row.position.lat === "number" && typeof row.position.lon === "number" ? [{ id: row.id, address, latitude: row.position.lat, longitude: row.position.lon }] : []; });
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
