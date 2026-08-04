import type { AssignmentStatus } from "@/types";

export type DispatchPersistenceErrorCode =
  | "ASSIGNMENT_OVERLAP"
  | "OVERRIDE_REASON_REQUIRED"
  | "INVALID_INTERVAL"
  | "ORDER_NOT_FOUND"
  | "EMPLOYEE_NOT_FOUND"
  | "ASSIGNMENT_NOT_FOUND"
  | "ASSIGNMENT_ALREADY_STARTED"
  | "ASSIGNMENT_INVALID_STATE"
  | "STALE_VERSION"
  | "PERSISTENCE_FAILURE";

export class DispatchPersistenceError extends Error {
  constructor(readonly code: DispatchPersistenceErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = "DispatchPersistenceError";
  }
}

export interface DurableAssignment {
  id: string;
  orderId: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
  status: AssignmentStatus;
  isOverride: boolean;
  overrideReason: string | null;
}

export interface VersionedDurableAssignment {
  assignment: DurableAssignment;
  orderVersion: string;
}

export interface ConfirmAssignmentCommand {
  assignmentId: string;
  orderId: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface OverrideAssignmentCommand extends ConfirmAssignmentCommand {
  reason: string;
}

export interface VersionedConfirmAssignmentCommand extends ConfirmAssignmentCommand {
  expectedOrderVersion: string;
}

export interface VersionedOverrideAssignmentCommand extends OverrideAssignmentCommand {
  expectedOrderVersion: string;
}

export interface ReplaceOrderAssignmentCommand {
  oldAssignmentId: string;
  newAssignmentId: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface DurableOrder {
  id: string;
  customerName: string;
  requestedAt: Date;
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
}

export interface AssignedEmployee {
  id: string;
  name: string;
}

export interface TourWithAssignedEmployees {
  order: DurableOrder;
  assignedEmployees: AssignedEmployee[];
}

/** Named application boundary for durable dispatch mutations. */
export interface DispatchAssignmentGateway {
  confirmAssignment(command: ConfirmAssignmentCommand): Promise<DurableAssignment>;
  overrideAssignment(command: OverrideAssignmentCommand): Promise<DurableAssignment>;
  confirmAssignmentWithVersion(command: VersionedConfirmAssignmentCommand): Promise<VersionedDurableAssignment>;
  overrideAssignmentWithVersion(command: VersionedOverrideAssignmentCommand): Promise<VersionedDurableAssignment>;
  replaceOrderAssignment(command: ReplaceOrderAssignmentCommand): Promise<DurableAssignment>;
  cancelOrder(orderId: string): Promise<void>;
  loadOrderAssignments(orderId: string): Promise<DurableAssignment[]>;
  listToursWithAssignedEmployees(): Promise<TourWithAssignedEmployees[]>;
}
