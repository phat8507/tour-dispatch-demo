import { Location } from "../types";

const EARTH_RADIUS_KM = 6_371;
export interface TravelEstimate {
  distanceKm: number;
  travelMinutes: number;
}

export interface TravelTimeProvider {
  estimate(origin: Location, destination: Location): TravelEstimate;
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function hasValidCoordinates(location: Location): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export function calculateHaversineDistanceKm(
  origin: Location,
  destination: Location,
): number {
  if (!hasValidCoordinates(origin) || !hasValidCoordinates(destination)) {
    return Number.NaN;
  }

  const latitudeDelta = degreesToRadians(
    destination.latitude - origin.latitude,
  );
  const longitudeDelta = degreesToRadians(
    destination.longitude - origin.longitude,
  );
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);

  const unboundedHaversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const haversine = Math.min(1, Math.max(0, unboundedHaversine));

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}
