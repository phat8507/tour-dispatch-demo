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
  hasConfirmedOverlap,
  isValidInterval,
  isWithinWorkingHours,
  parseTimestamp,
} from "./availability";
import { mockTravelTimeProvider } from "./travel-time";
import {
  buildCandidateContext,
  findLocation,
  isRefill,
  requiredServiceIds,
  scoreCandidate as scoreDispatchCandidate,
  totalServiceDuration,
} from "./dispatch/candidate-scoring";
import { compareSuggestions } from "./dispatch/ranking";

const NEW_TOUR_MAX_DISTANCE_KM = 30;
const REFILL_MAX_DISTANCE_KM = 20;

export interface SuggestAssignmentsInput {
  order: Order;
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  services: Service[];
  locations: Location[];
  currentTime: string;
}


function assignmentsOnRequestedDay(
  assignments: readonly Assignment[],
  requestedTime: string,
  workingEmployeeIds: ReadonlySet<Employee["id"]>,
): Assignment[] {
  const requestedOffsetMinutes = getTimestampOffsetMinutes(requestedTime);
  const requestedDate = getDateAtOffset(
    requestedTime,
    requestedOffsetMinutes,
  );
  if (requestedDate === undefined) {
    return [];
  }

  return assignments.filter(
    (assignment) =>
      workingEmployeeIds.has(assignment.employeeId) &&
      getDateAtOffset(
        assignment.startTime,
        requestedOffsetMinutes,
      ) === requestedDate,
  );
}

function getTimestampOffsetMinutes(timestamp: string): number {
  if (timestamp.endsWith("Z")) {
    return 0;
  }

  const match = timestamp.match(/([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    return 0;
  }

  const direction = match[1] === "+" ? 1 : -1;
  return direction * (Number(match[2]) * 60 + Number(match[3]));
}

function getDateAtOffset(
  timestamp: string,
  offsetMinutes: number,
): string | undefined {
  const timestampMs = parseTimestamp(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return undefined;
  }

  return new Date(timestampMs + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function suggestAssignments(
  input: SuggestAssignmentsInput,
): AssignmentSuggestion[] {
  const requiredServices = requiredServiceIds(input.order);
  if (requiredServices === undefined) {
    return [];
  }

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
  const cancelledOrderIds = new Set(
    input.orders
      .filter((order) => order.status === "CANCELLED")
      .map((order) => order.id),
  );
  const activeAssignments = input.assignments.filter(
    (assignment) =>
      !cancelledOrderIds.has(assignment.orderId) &&
      isValidInterval(assignment.startTime, assignment.endTime),
  );
  const uniqueEmployees = Array.from(
    new Map(
      input.employees.map((employee) => [employee.id, employee]),
    ).values(),
  );
  const workingEmployees = uniqueEmployees.filter(
    (employee) => !employee.isOff,
  );
  const workingEmployeeIds = new Set(
    workingEmployees.map((employee) => employee.id),
  );
  const assignmentsToday = assignmentsOnRequestedDay(
    activeAssignments,
    input.order.requestedTime,
    workingEmployeeIds,
  );
  const suggestions: AssignmentSuggestion[] = [];

  for (const employee of uniqueEmployees) {
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
        activeAssignments,
        input.order.id,
      )
    ) {
      continue;
    }

    const context = buildCandidateContext(
      employee,
      activeAssignments,
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
    if (
      !Number.isFinite(travel.distanceKm) ||
      !Number.isFinite(travel.travelMinutes) ||
      travel.distanceKm > maximumDistance
    ) {
      continue;
    }

    const arrivalAt = addMinutes(
      context.availableAt,
      travel.travelMinutes,
    );
    if (parseTimestamp(arrivalAt) > parseTimestamp(input.order.requestedTime)) {
      continue;
    }

    const scored = scoreDispatchCandidate({
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
