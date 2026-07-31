import { Assignment, Employee, Order } from "../types";

/**
 * All helpers accept explicit timestamps. None call new Date() internally.
 */

function toMs(isoString: string): number {
  return new Date(isoString).getTime();
}

/**
 * Returns true if the assignment overlaps DEMO_TIME using the rule:
 *   startTime <= demoTime < endTime
 * This is the definition of "currently in progress at demoTime".
 */
function isActiveAtTime(assignment: Assignment, demoTime: string): boolean {
  const demoMs = toMs(demoTime);
  return toMs(assignment.startTime) <= demoMs && demoMs < toMs(assignment.endTime);
}

/**
 * Compute the display status for an assignment given the fixed demo time.
 * - DELAYED is preserved from stored data (source of truth).
 * - Otherwise derived from the position of demoTime relative to start/end.
 */
export function getAssignmentDisplayStatus(
  assignment: Assignment,
  demoTime: string,
): Assignment["status"] {
  if (assignment.status === "DELAYED") return "DELAYED";
  const demoMs = toMs(demoTime);
  if (toMs(assignment.endTime) <= demoMs) return "COMPLETED";
  if (toMs(assignment.startTime) <= demoMs) return "IN_PROGRESS";
  return "SCHEDULED";
}

/**
 * Employees who have an assignment overlapping DEMO_TIME
 * (startTime <= demoTime < endTime), including DELAYED assignments.
 * Off employees are excluded.
 */
export function getCurrentlyWorkingEmployees(
  employees: Employee[],
  assignments: Assignment[],
  demoTime: string,
): Employee[] {
  const activeEmployeeIds = new Set(
    assignments
      .filter((a) => isActiveAtTime(a, demoTime))
      .map((a) => a.employeeId),
  );
  return employees.filter((e) => !e.isOff && activeEmployeeIds.has(e.id));
}

/**
 * Employees who are available at demoTime:
 * - isOff is false
 * - demoTime is within working hours
 * - no assignment overlaps demoTime (startTime <= demoTime < endTime)
 *
 * An employee with an assignment earlier or later in the day is still available.
 */
export function getAvailableEmployees(
  employees: Employee[],
  assignments: Assignment[],
  demoTime: string,
): Employee[] {
  // Only assignments that actively overlap DEMO_TIME make an employee unavailable.
  const busyEmployeeIds = new Set(
    assignments
      .filter((a) => isActiveAtTime(a, demoTime))
      .map((a) => a.employeeId),
  );

  const demoMs = toMs(demoTime);

  return employees.filter((e) => {
    if (e.isOff) return false;
    // Employee must be within their working hours at demoTime
    if (toMs(e.workingStart) > demoMs || toMs(e.workingEnd) <= demoMs) return false;
    // Employee must not have an active (overlapping) assignment
    return !busyEmployeeIds.has(e.id);
  });
}

/**
 * Assignments that are currently in progress at demoTime AND will end
 * within the next 30 minutes.
 *
 * Conditions:
 * - startTime <= demoTime < endTime  (currently active)
 * - endTime <= demoTime + 30 minutes
 */
export function getAssignmentsCompletingWithin30Minutes(
  assignments: Assignment[],
  demoTime: string,
): Assignment[] {
  const demoMs = toMs(demoTime);
  const thirtyMinsMs = 30 * 60 * 1000;
  return assignments.filter((a) => {
    // Must be active now
    if (!isActiveAtTime(a, demoTime)) return false;
    // Must end within 30 minutes
    const endMs = toMs(a.endTime);
    return endMs <= demoMs + thirtyMinsMs;
  });
}

/**
 * Assignments with stored DELAYED status.
 */
export function getDelayedAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter((a) => a.status === "DELAYED");
}

/**
 * Orders that have no corresponding assignment.
 */
export function getUnassignedOrders(
  orders: Order[],
  assignments: Assignment[],
): Order[] {
  const assignedOrderIds = new Set(assignments.map((a) => a.orderId));
  return orders.filter((o) => !assignedOrderIds.has(o.id));
}

export interface DashboardSummary {
  workingCount: number;
  availableCount: number;
  completingWithin30Count: number;
  unassignedOrderCount: number;
  delayedCount: number;
}

/**
 * Compute all summary card values from mock data and demoTime.
 * No hard-coded numbers.
 */
export function getDashboardSummary(
  employees: Employee[],
  assignments: Assignment[],
  orders: Order[],
  demoTime: string,
): DashboardSummary {
  return {
    workingCount: getCurrentlyWorkingEmployees(employees, assignments, demoTime).length,
    availableCount: getAvailableEmployees(employees, assignments, demoTime).length,
    completingWithin30Count: getAssignmentsCompletingWithin30Minutes(assignments, demoTime).length,
    unassignedOrderCount: getUnassignedOrders(orders, assignments).length,
    delayedCount: getDelayedAssignments(assignments).length,
  };
}
