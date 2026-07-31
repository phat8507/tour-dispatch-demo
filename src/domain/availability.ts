import { Assignment, Employee, Order } from "../types";

const CONFIRMED_ASSIGNMENT_STATUSES = new Set<Assignment["status"]>([
  "SCHEDULED",
  "IN_PROGRESS",
  "DELAYED",
]);

export function parseTimestamp(timestamp: string): number {
  return new Date(timestamp).getTime();
}

export function addMinutes(timestamp: string, minutes: number): string {
  return new Date(parseTimestamp(timestamp) + minutes * 60_000).toISOString();
}

export function isValidInterval(
  startTime: string,
  endTime: string,
): boolean {
  const startTimeMs = parseTimestamp(startTime);
  const endTimeMs = parseTimestamp(endTime);

  return (
    Number.isFinite(startTimeMs) &&
    Number.isFinite(endTimeMs) &&
    startTimeMs < endTimeMs
  );
}

export function isWithinWorkingHours(
  employee: Employee,
  startTime: string,
  endTime: string,
): boolean {
  return (
    isValidInterval(startTime, endTime) &&
    isValidInterval(employee.workingStart, employee.workingEnd) &&
    parseTimestamp(startTime) >= parseTimestamp(employee.workingStart) &&
    parseTimestamp(endTime) <= parseTimestamp(employee.workingEnd)
  );
}

export function getCurrentAssignment(
  employeeId: string,
  assignments: readonly Assignment[],
  currentTime: string,
): Assignment | undefined {
  const currentTimeMs = parseTimestamp(currentTime);

  return assignments
    .filter(
      (assignment) =>
        assignment.employeeId === employeeId &&
        CONFIRMED_ASSIGNMENT_STATUSES.has(assignment.status) &&
        isValidInterval(assignment.startTime, assignment.endTime) &&
        parseTimestamp(assignment.startTime) <= currentTimeMs &&
        parseTimestamp(assignment.endTime) > currentTimeMs,
    )
    .slice()
    .sort(
      (left, right) =>
        parseTimestamp(right.endTime) - parseTimestamp(left.endTime) ||
        left.id.localeCompare(right.id),
    )[0];
}

export function getLatestCompletedAssignment(
  employeeId: string,
  assignments: readonly Assignment[],
  currentTime: string,
): Assignment | undefined {
  const currentTimeMs = parseTimestamp(currentTime);

  return assignments
    .filter(
      (assignment) =>
        assignment.employeeId === employeeId &&
        assignment.status === "COMPLETED" &&
        isValidInterval(assignment.startTime, assignment.endTime) &&
        parseTimestamp(assignment.endTime) <= currentTimeMs,
    )
    .slice()
    .sort(
      (left, right) =>
        parseTimestamp(right.endTime) - parseTimestamp(left.endTime) ||
        left.id.localeCompare(right.id),
    )[0];
}

export function hasConfirmedOverlap(
  employeeId: string,
  proposedStartTime: string,
  proposedEndTime: string,
  assignments: readonly Assignment[],
  excludedOrderId: Order["id"],
): boolean {
  const proposedStartMs = parseTimestamp(proposedStartTime);
  const proposedEndMs = parseTimestamp(proposedEndTime);

  if (!isValidInterval(proposedStartTime, proposedEndTime)) {
    return false;
  }

  return assignments.some(
    (assignment) =>
      assignment.employeeId === employeeId &&
      assignment.orderId !== excludedOrderId &&
      CONFIRMED_ASSIGNMENT_STATUSES.has(assignment.status) &&
      isValidInterval(assignment.startTime, assignment.endTime) &&
      parseTimestamp(assignment.startTime) < proposedEndMs &&
      parseTimestamp(assignment.endTime) > proposedStartMs,
  );
}
