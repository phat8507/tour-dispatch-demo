import {
  calculateHaversineDistanceKm,
  TravelEstimate,
  TravelTimeProvider,
} from "@/domain/travel-time";
import { Location } from "@/types";

const AVERAGE_SPEED_KM_PER_HOUR = 25;
const PREPARATION_BUFFER_MINUTES = 5;

export class DeterministicTravelTimeProvider implements TravelTimeProvider {
  estimate(origin: Location, destination: Location): TravelEstimate {
    const distanceKm = calculateHaversineDistanceKm(origin, destination);
    if (!Number.isFinite(distanceKm)) {
      return { distanceKm: Number.NaN, travelMinutes: Number.NaN };
    }

    return {
      distanceKm,
      travelMinutes: Math.ceil(
        (distanceKm / AVERAGE_SPEED_KM_PER_HOUR) * 60 +
          PREPARATION_BUFFER_MINUTES,
      ),
    };
  }
}

export function createDemoTravelTimeProvider(): TravelTimeProvider {
  return new DeterministicTravelTimeProvider();
}
