import { Location } from "../types";

const EARTH_RADIUS_KM = 6_371;
const AVERAGE_SPEED_KM_PER_HOUR = 25;
const PREPARATION_BUFFER_MINUTES = 5;

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

export function calculateHaversineDistanceKm(
  origin: Location,
  destination: Location,
): number {
  const latitudeDelta = degreesToRadians(
    destination.latitude - origin.latitude,
  );
  const longitudeDelta = degreesToRadians(
    destination.longitude - origin.longitude,
  );
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export class DeterministicTravelTimeProvider implements TravelTimeProvider {
  estimate(origin: Location, destination: Location): TravelEstimate {
    const distanceKm = calculateHaversineDistanceKm(origin, destination);
    const drivingMinutes =
      (distanceKm / AVERAGE_SPEED_KM_PER_HOUR) * 60;

    return {
      distanceKm,
      travelMinutes: Math.ceil(
        drivingMinutes + PREPARATION_BUFFER_MINUTES,
      ),
    };
  }
}

export const mockTravelTimeProvider = new DeterministicTravelTimeProvider();
