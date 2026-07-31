import { Location } from "../types";

export interface Point {
  x: number;
  y: number;
}

export function projectLocationToMap(
  location: Location | { latitude: number; longitude: number },
  allLocations: Location[],
  paddingPercentage = 15
): Point {
  if (allLocations.length === 0) return { x: 50, y: 50 };

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const loc of allLocations) {
    if (loc.latitude < minLat) minLat = loc.latitude;
    if (loc.latitude > maxLat) maxLat = loc.latitude;
    if (loc.longitude < minLng) minLng = loc.longitude;
    if (loc.longitude > maxLng) maxLng = loc.longitude;
  }

  // Handle single location or zero delta
  if (minLat === maxLat) {
    minLat -= 0.01;
    maxLat += 0.01;
  }
  if (minLng === maxLng) {
    minLng -= 0.01;
    maxLng += 0.01;
  }

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  // Project to a percentage from paddingPercentage to 100 - paddingPercentage
  const usableWidth = 100 - (paddingPercentage * 2);
  const usableHeight = 100 - (paddingPercentage * 2);

  // X goes left to right (longitude)
  const x = paddingPercentage + ((location.longitude - minLng) / lngRange) * usableWidth;
  // Y goes top to bottom, but latitude goes bottom to top, so invert it
  const y = paddingPercentage + (1 - (location.latitude - minLat) / latRange) * usableHeight;

  // Clamp to 0-100 to ensure we stay in bounds
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

export function offsetOverlappingMarker(
  basePoint: Point,
  overlapIndex: number,
  totalAtLocation: number,
  offsetRadius = 3
): Point {
  if (totalAtLocation <= 1) return basePoint;
  
  // Evenly distribute in a circle
  const angle = (overlapIndex / totalAtLocation) * 2 * Math.PI;

  return {
    x: basePoint.x + offsetRadius * Math.cos(angle),
    y: basePoint.y + offsetRadius * Math.sin(angle),
  };
}
