import { Assignment, AssignmentSuggestion, Employee, Location, Order, Service } from "../../types";
import { getCurrentAssignment, getLatestCompletedAssignment, parseTimestamp } from "../availability";

const BASE_SCORE = 100;
const SOON_MINUTES = 30;
const LOW_ARRIVAL_BUFFER_MINUTES = 15;

export interface CandidateContext {
  employee: Employee;
  origin: Location;
  availableAt: string;
  currentAssignment: Assignment | undefined;
}

export function requiredServiceIds(order: Order): string[] | undefined {
  const ids = order.serviceIds === undefined ? [order.serviceId] : order.serviceIds;
  return ids.length === 0 ? undefined : Array.from(new Set(ids));
}

export function totalServiceDuration(serviceIds: readonly string[], services: readonly Service[]): number | undefined {
  const durations = new Map(services.map((service) => [service.id, service.durationMinutes]));
  let total = 0;
  for (const serviceId of serviceIds) {
    const duration = durations.get(serviceId);
    if (duration === undefined) return undefined;
    total += duration;
  }
  return total;
}

export function findLocation(locationId: string, locations: readonly Location[]): Location | undefined {
  return locations.find((location) => location.id === locationId);
}

function orderLocation(assignment: Assignment, orders: readonly Order[], locations: readonly Location[]): Location | undefined {
  const order = orders.find((candidate) => candidate.id === assignment.orderId);
  return order ? findLocation(order.locationId, locations) : undefined;
}

export function buildCandidateContext(employee: Employee, assignments: readonly Assignment[], orders: readonly Order[], locations: readonly Location[], currentTime: string): CandidateContext | undefined {
  const current = getCurrentAssignment(employee.id, assignments, currentTime);
  if (current) {
    const origin = orderLocation(current, orders, locations);
    return origin ? { employee, origin, availableAt: current.endTime, currentAssignment: current } : undefined;
  }
  const latest = getLatestCompletedAssignment(employee.id, assignments, currentTime);
  if (latest) {
    const origin = orderLocation(latest, orders, locations);
    return origin ? { employee, origin, availableAt: currentTime, currentAssignment: undefined } : undefined;
  }
  const origin = findLocation(employee.homeLocationId, locations);
  return origin ? { employee, origin, availableAt: currentTime, currentAssignment: undefined } : undefined;
}

export function isRefill(order: Order): boolean { return order.orderType === "REFILL" || order.orderType === "MILEAGE"; }
function isStrong(employee: Employee): boolean { return employee.performanceLevel === "STRONG" || employee.performanceLevel === "EXPERT"; }
function isWeak(employee: Employee): boolean { return employee.performanceLevel === "NORMAL_WEAK" || employee.performanceLevel === "WEAK"; }

export function scoreCandidate(params: { context: CandidateContext; order: Order; requiredServices: readonly string[]; distanceKm: number; arrivalAt: string; currentTime: string; assignmentsToday: readonly Assignment[]; workingEmployeeCount: number }): Pick<AssignmentSuggestion, "score" | "reasons" | "warnings"> {
  const { context, order, requiredServices, distanceKm, arrivalAt, currentTime, assignmentsToday, workingEmployeeCount } = params;
  const reasons = ["Starting score: 100."];
  const warnings: string[] = [];
  let score = BASE_SCORE;
  const travelPenalty = distanceKm * 3;
  score -= travelPenalty;
  reasons.push(`Travel distance ${distanceKm.toFixed(2)} km: -${travelPenalty.toFixed(2)} points.`);
  if (!context.employee.preferredAreaIds.includes(order.locationId)) { score -= 20; reasons.push("Customer is outside the preferred branch zone: -20 points."); }
  if (requiredServices.length >= 2 && isStrong(context.employee)) { score += 25; reasons.push("Strong employee for an order with 2 or more services: +25 points."); }
  if ((requiredServices.length === 1 || isRefill(order)) && isWeak(context.employee)) { score += 15; reasons.push("Weak or normal-weak employee for a one-service or refill order: +15 points."); }
  if (context.currentAssignment) {
    const minutes = (parseTimestamp(context.availableAt) - parseTimestamp(currentTime)) / 60_000;
    if (minutes >= 0 && minutes <= SOON_MINUTES) { score += 10; reasons.push("Current assignment finishes within 30 minutes: +10 points."); }
  }
  const count = assignmentsToday.filter((assignment) => assignment.employeeId === context.employee.id).length;
  const average = workingEmployeeCount > 0 ? assignmentsToday.length / workingEmployeeCount : 0;
  const above = Math.max(0, count - average);
  if (above > 0) { const penalty = above * 8; score -= penalty; reasons.push(`${above.toFixed(2)} assignments above the working-employee average: -${penalty.toFixed(2)} points.`); }
  const buffer = (parseTimestamp(order.requestedTime) - parseTimestamp(arrivalAt)) / 60_000;
  if (buffer < LOW_ARRIVAL_BUFFER_MINUTES) warnings.push(`Arrival buffer is ${buffer.toFixed(0)} minutes, below 15 minutes.`);
  return { score, reasons, warnings };
}
