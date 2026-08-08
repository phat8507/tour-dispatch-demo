export type GeocodingSuggestion = Readonly<{ id: string; address: string; latitude: number; longitude: number }>;
export type GeocodingProvider = Readonly<{ autocomplete(query: string): Promise<GeocodingSuggestion[]> }>;

export function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}
