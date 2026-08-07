import { NextRequest, NextResponse } from "next/server";
import { LocationIqGeocodingProvider, GeocodingProviderUnavailableError } from "@/server/locationiq-geocoding-provider";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ suggestions: [] });
  try {
    const suggestions = await new LocationIqGeocodingProvider(process.env.LOCATIONIQ_API_KEY).autocomplete(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof GeocodingProviderUnavailableError) return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
