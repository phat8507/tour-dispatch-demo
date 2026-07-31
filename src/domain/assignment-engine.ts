import {
  Assignment,
  AssignmentSuggestion,
  Employee,
  Location,
  Order,
  Service,
} from "../types";
import {
  addMinutes,
  getCurrentAssignment,
  getLatestCompletedAssignment,
  hasConfirmedOverlap,
  isWithinWorkingHours,
  parseTimestamp,
} from "./availability";
import { mockTravelTimeProvider } from "./travel-time";

const BASE_SCORE = 100;
const NEW_TOUR_MAX_DISTANCE_KM = 30;
const REFILL_MAX_DISTANCE_KM = 20;
const SOON_MINUTES = 30;
const LOW_ARRIVAL_BUFFER_MINUTES = 15;

export interface SuggestAssignmentsInput {
  order: Order;
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  services: Service[];
  locations: Location[];
  currentTime: string;
}

interface CandidateContext {
  employee: Employee;
  origin: Location;
  availableAt: string;
  currentAssignment: Assignment | undefined;
}

function requiredServiceIds(order: Order): string[] {
  const ids =
    order.serviceIds && order.serviceIds.length > 0
      ? order.serviceIds
      : [order.serviceId];

  return Array.from(new Set(ids));
}

function totalServiceDuration(
  serviceIds: readonly string[],
  services: readonly Service[],
): number | undefined {
  const durationById = new Map(
    services.map((service) => [service.id, service.durationMinutes]),
  );
  let total = 0;

  for (const serviceId of serviceIds) {
    const duration = durationById.get(serviceId);
    if (duration === undefined) {
      return undefined;
    }
    total += duration;
  }

  return total;
}

function isRefill(order: Order): boolean {
  return order.orderType === "REFILL" || order.orderType === "MILEAGE";
}

function isStrong(employee: Employee): boolean {
  return (
    employee.performanceLevel === "STRONG" ||
    employee.performanceLevel === "EXPERT"
  );
}

function isWeakOrNormalWeak(employee: Employee): boolean {
  return (
    employee.performanceLevel === "NORMAL_WEAK" ||
    employee.performanceLevel === "WEAK"
  );
}

function findLocation(
  locationId: string,
  locations: readonly Location[],
): Location | undefined {
  return locations.find((location) => location.id === locationId);
}

function getOrderLocation(
  assignment: Assignment,
  orders: readonly Order[],
  locations: readonly Location[],
): Location | undefined {
  const assignmentOrder = orders.find(
    (order) => order.id === assignment.orderId,
  );
  return assignmentOrder
    ? findLocation(assignmentOrder.locationId, locations)
    : undefined;
}

function buildCandidateContext(
  employee: Employee,
  assignments: readonly Assignment[],
  orders: readonly Order[],
  locations: readonly Location[],
  currentTime: string,
): CandidateContext | undefined {
  const currentAssignment = getCurrentAssignment(
    employee.id,
    assignments,
    currentTime,
  );

  if (currentAssignment) {
    const origin = getOrderLocation(currentAssignment, orders, locations);
    return origin
      ? {
          employee,
          origin,
          availableAt: currentAssignment.endTime,
          currentAssignment,
        }
      : undefined;
  }

  const latestCompletedAssignment = getLatestCompletedAssignment(
    employee.id,
    assignments,
    currentTime,
  );
  if (latestCompletedAssignment) {
    const origin = getOrderLocation(
      latestCompletedAssignment,
      orders,
      locations,
    );
    return origin
      ? {
          employee,
          origin,
          availableAt: currentTime,
          currentAssignment: undefined,
        }
      : undefined;
  }

  const home = findLocation(employee.homeLocationId, locations);
  return home
    ? {
        employee,
        origin: home,
        availableAt: currentTime,
        currentAssignment: undefined,
      }
    : undefined;
}

function assignmentsOnRequestedDay(
  assignments: readonly Assignment[],
  requestedTime: string,
): Assignment[] {
  const requestedDate = requestedTime.slice(0, 10);
  return assignments.filter(
    (assignment) => assignment.startTime.slice(0, 10) === requestedDate,
  );
}

function scoreCandidate(params: {
  context: CandidateContext;
  order: Order;
  requiredServices: readonly string[];
  distanceKm: number;
  arrivalAt: string;
  currentTime: string;
  assignmentsToday: readonly Assignment[];
  workingEmployeeCount: number;
}): Pick<AssignmentSuggestion, "score" | "reasons" | "warnings"> {
  const {
    context,
    order,
    requiredServices,
    distanceKm,
    arrivalAt,
    currentTime,
    assignmentsToday,
    workingEmployeeCount,
  } = params;
  const reasons: string[] = ["Starting score: 100."];
  const warnings: string[] = [];
  let score = BASE_SCORE;

  const travelPenalty = distanceKm * 3;
  score -= travelPenalty;
  reasons.push(
    `Travel distance ${distanceKm.toFixed(2)} km: -${travelPenalty.toFixed(2)} points.`,
  );

  if (!context.employee.preferredAreaIds.includes(order.locationId)) {
    score -= 20;
    reasons.push("Customer is outside the preferred branch zone: -20 points.");
  }

  if (requiredServices.length >= 2 && isStrong(context.employee)) {
    score += 25;
    reasons.push("Strong employee for an order with 2 or more services: +25 points.");
  }

  if (
    (requiredServices.length === 1 || isRefill(order)) &&
    isWeakOrNormalWeak(context.employee)
  ) {
    score += 15;
    reasons.push(
      "Weak or normal-weak employee for a one-service or refill order: +15 points.",
    );
  }

  if (context.currentAssignment) {
    const minutesUntilAvailable =
      (parseTimestamp(context.availableAt) - parseTimestamp(currentTime)) /
      60_000;
    if (minutesUntilAvailable >= 0 && minutesUntilAvailable <= SOON_MINUTES) {
      score += 10;
      reasons.push("Current assignment finishes within 30 minutes: +10 points.");
    }
  }

  const employeeAssignmentCount = assignmentsToday.filter(
    (assignment) => assignment.employeeId === context.employee.id,
  ).length;
  const averageAssignments =
    workingEmployeeCount > 0
      ? assignmentsToday.length / workingEmployeeCount
      : 0;
  const assignmentsAboveAverage = Math.max(
    0,
    employeeAssignmentCount - averageAssignments,
  );
  if (assignmentsAboveAverage > 0) {
    const workloadPenalty = assignmentsAboveAverage * 8;
    score -= workloadPenalty;
    reasons.push(
      `${assignmentsAboveAverage.toFixed(2)} assignments above the working-employee average: -${workloadPenalty.toFixed(2)} points.`,
    );
  }

  const arrivalBufferMinutes =
    (parseTimestamp(order.requestedTime) - parseTimestamp(arrivalAt)) / 60_000;
  if (arrivalBufferMinutes < LOW_ARRIVAL_BUFFER_MINUTES) {
    warnings.push(
      `Arrival buffer is ${arrivalBufferMinutes.toFixed(0)} minutes, below 15 minutes.`,
    );
  }

  return { score, reasons, warnings };
}

function compareSuggestions(
  left: AssignmentSuggestion,
  right: AssignmentSuggestion,
): number {
  return (
    right.score - left.score ||
    parseTimestamp(left.estimatedArrivalAt) -
      parseTimestamp(right.estimatedArrivalAt) ||
    left.employeeId.localeCompare(right.employeeId)
  );
}

export function suggestAssignments(
  input: SuggestAssignmentsInput,
): AssignmentSuggestion[] {
  const requiredServices = requiredServiceIds(input.order);
  const serviceDuration = totalServiceDuration(
    requiredServices,
    input.services,
  );
  const destination = findLocation(
    input.order.locationId,
    input.locations,
  );

  if (serviceDuration === undefined || !destination) {
    return [];
  }

  const proposedEndTime = addMinutes(
    input.order.requestedTime,
    serviceDuration,
  );
  const assignmentsToday = assignmentsOnRequestedDay(
    input.assignments,
    input.order.requestedTime,
  );
  const workingEmployees = input.employees.filter(
    (employee) => !employee.isOff,
  );
  const suggestions: AssignmentSuggestion[] = [];

  for (const employee of input.employees) {
    if (
      employee.isOff ||
      !isWithinWorkingHours(
        employee,
        input.order.requestedTime,
        proposedEndTime,
      ) ||
      !requiredServices.every((serviceId) =>
        employee.supportedServiceIds.includes(serviceId),
      ) ||
      hasConfirmedOverlap(
        employee.id,
        input.order.requestedTime,
        proposedEndTime,
        input.assignments,
        input.order.id,
      )
    ) {
      continue;
    }

    const context = buildCandidateContext(
      employee,
      input.assignments,
      input.orders,
      input.locations,
      input.currentTime,
    );
    if (!context) {
      continue;
    }

    const travel = mockTravelTimeProvider.estimate(
      context.origin,
      destination,
    );
    const maximumDistance = isRefill(input.order)
      ? REFILL_MAX_DISTANCE_KM
      : NEW_TOUR_MAX_DISTANCE_KM;
    if (travel.distanceKm > maximumDistance) {
      continue;
    }

    const arrivalAt = addMinutes(
      context.availableAt,
      travel.travelMinutes,
    );
    if (parseTimestamp(arrivalAt) > parseTimestamp(input.order.requestedTime)) {
      continue;
    }

    const scored = scoreCandidate({
      context,
      order: input.order,
      requiredServices,
      distanceKm: travel.distanceKm,
      arrivalAt,
      currentTime: input.currentTime,
      assignmentsToday,
      workingEmployeeCount: workingEmployees.length,
    });

    suggestions.push({
      employeeId: employee.id,
      score: scored.score,
      estimatedAvailableAt: new Date(
        parseTimestamp(context.availableAt),
      ).toISOString(),
      estimatedTravelMinutes: travel.travelMinutes,
      estimatedArrivalAt: arrivalAt,
      reasons: scored.reasons,
      warnings: scored.warnings,
    });
  }

  return suggestions.slice().sort(compareSuggestions).slice(0, 3);
}
