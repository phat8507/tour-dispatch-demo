export type PerformanceLevel = "EXPERT" | "NORMAL" | "NORMAL_WEAK" | "WEAK";
export type BranchId = "CS1" | "CS2";
export type OrderType = "NEW_TOUR" | "MILEAGE";
export type Urgency = "PREBOOKED" | "IMMEDIATE";
export type OrderStatus = "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
export type AssignmentStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
export type AssignmentRiskType = "LATE_ARRIVAL" | "OVERLAP" | "INSUFFICIENT_BUFFER";

export interface Branch {
  id: BranchId;
  name: string;
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  branchId: BranchId;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}

export interface Employee {
  id: string;
  name: string;
  branchId: BranchId;
  performanceLevel: PerformanceLevel;
  homeLocationId: string;
  preferredAreaIds: string[];
  supportedServiceIds: string[];
  workingStart: string; // ISO 8601 with +07:00
  workingEnd: string;   // ISO 8601 with +07:00
  isOff: boolean;
}

export interface Order {
  id: string;
  customerName: string;
  locationId: string;
  serviceId: string;
  requestedTime: string; // ISO 8601 with +07:00
  orderType: OrderType;
  urgency: Urgency;
  status: OrderStatus;
  notes: string;
}

export interface Assignment {
  id: string;
  orderId: string;
  employeeId: string;
  startTime: string; // ISO 8601 with +07:00
  endTime: string;   // ISO 8601 with +07:00
  status: AssignmentStatus;
}

export interface AssignmentSuggestion {
  employeeId: string;
  score: number;
  estimatedCompletionTime: string;
  travelTimeMinutes: number;
  estimatedArrivalTime: string;
  reasons: string[];
  warnings: string[];
}
