import { Employee, Assignment, Order, Location } from "../types";

export function resolveEmployeeMapPosition(
  employee: Employee,
  assignments: Assignment[],
  orders: Order[],
  locations: Location[],
  currentTime: string
): Location | null {
  const employeeAssignments = assignments.filter((a) => a.employeeId === employee.id);

  // 1. Active assignment
  const activeAssignment = employeeAssignments.find(
    (a) => a.startTime <= currentTime && currentTime < a.endTime && a.status !== "COMPLETED"
  );

  if (activeAssignment) {
    const order = orders.find((o) => o.id === activeAssignment.orderId);
    if (order) {
      const loc = locations.find((l) => l.id === order.locationId);
      if (loc) return loc;
    }
  }

  // 2. Most recently completed assignment
  const completedAssignments = employeeAssignments
    .filter((a) => a.endTime <= currentTime || a.status === "COMPLETED")
    .sort((a, b) => b.endTime.localeCompare(a.endTime));

  if (completedAssignments.length > 0) {
    const latest = completedAssignments[0];
    const order = orders.find((o) => o.id === latest.orderId);
    if (order) {
      const loc = locations.find((l) => l.id === order.locationId);
      if (loc) return loc;
    }
  }

  // 3. Home location
  if (employee.homeLocationId) {
    const loc = locations.find((l) => l.id === employee.homeLocationId);
    if (loc) return loc;
  }

  // 4. Branch fallback
  const branchLoc = locations.find((l) => l.branchId === employee.branchId);
  if (branchLoc) return branchLoc;

  return null;
}
