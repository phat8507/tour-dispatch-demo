import { suggestAssignments } from "./assignment-engine";
import { addMinutesPreservingOffset } from "./dispatch/time";
import { getConfirmationPreconditionError } from "./dispatch/confirmation-policy";
import { TravelTimeProvider } from "./travel-time";
import {
  Assignment,
  AssignmentSuggestion,
  Employee,
  Location,
  Order,
  OrderType,
  Service,
  Urgency,
} from "../types";

export interface DispatchState {
  orders: Order[];
  assignments: Assignment[];
}

export interface OrderDraft {
  customerName: string;
  locationId: string;
  requestedTime: string;
  serviceIds: string[];
  orderType: Extract<OrderType, "NEW_TOUR" | "REFILL"> | "";
  urgency: Urgency | "";
  notes: string;
}

export type OrderDraftField =
  | "customerName"
  | "locationId"
  | "requestedTime"
  | "serviceIds"
  | "orderType"
  | "urgency";

export type OrderDraftErrors = Partial<Record<OrderDraftField, string>>;

export interface SuggestOrderInput {
  draft: OrderDraft;
  state: DispatchState;
  employees: Employee[];
  services: Service[];
  locations: Location[];
  currentTime: string;
  travelTimeProvider: TravelTimeProvider;
}

export type SuggestOrderResult =
  | {
      ok: true;
      order: Order;
      suggestions: AssignmentSuggestion[];
    }
  | {
      ok: false;
      errors: OrderDraftErrors;
    };

export interface ConfirmOrderInput {
  confirmed: boolean;
  order: Order;
  selectedEmployeeId: string | null;
  state: DispatchState;
  employees: Employee[];
  services: Service[];
  locations: Location[];
  currentTime: string;
  travelTimeProvider: TravelTimeProvider;
}

export type ConfirmOrderError =
  | "CONFIRMATION_REQUIRED"
  | "EMPLOYEE_REQUIRED"
  | "STALE_SUGGESTION"
  | "INVALID_SERVICES";

export type ConfirmOrderResult =
  | {
      ok: true;
      state: DispatchState;
      order: Order;
      assignment: Assignment;
      suggestion: AssignmentSuggestion;
    }
  | {
      ok: false;
      state: DispatchState;
      error: ConfirmOrderError;
    };

function cloneOrder(order: Order): Order {
  return {
    ...order,
    serviceIds: order.serviceIds ? [...order.serviceIds] : undefined,
  };
}

function cloneAssignment(assignment: Assignment): Assignment {
  return { ...assignment };
}

export function createDispatchState(
  orders: readonly Order[],
  assignments: readonly Assignment[],
): DispatchState {
  return {
    orders: orders.map(cloneOrder),
    assignments: assignments.map(cloneAssignment),
  };
}

export function resetDispatchState(
  seededOrders: readonly Order[],
  seededAssignments: readonly Assignment[],
): DispatchState {
  return createDispatchState(seededOrders, seededAssignments);
}

function nextNumericSuffix(ids: readonly string[]): number {
  return (
    ids.reduce((highest, id) => {
      const match = id.match(/(\d+)$/);
      if (!match) {
        return highest;
      }
      return Math.max(highest, Number(match[1]));
    }, 0) + 1
  );
}

export function generateOrderId(orders: readonly Order[]): string {
  return `order_demo_${nextNumericSuffix(orders.map((order) => order.id))}`;
}

export function generateAssignmentId(
  assignments: readonly Assignment[],
): string {
  return `assignment_demo_${nextNumericSuffix(
    assignments.map((assignment) => assignment.id),
  )}`;
}

function isValidExplicitTimestamp(timestamp: string): boolean {
  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2}))$/,
  );
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const offsetHour = Number(match[8] ?? "0");
  const offsetMinute = Number(match[9] ?? "0");
  const leapYear =
    year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(new Date(timestamp).getTime())
  );
}

export function validateOrderDraft(
  draft: OrderDraft,
  locations: readonly Location[],
  services: readonly Service[],
): OrderDraftErrors {
  const errors: OrderDraftErrors = {};
  const locationIds = new Set(locations.map((location) => location.id));
  const serviceIds = new Set(services.map((service) => service.id));
  const distinctServiceIds = new Set(draft.serviceIds);

  if (!draft.customerName.trim()) {
    errors.customerName = "Vui lòng nhập tên khách hàng.";
  }
  if (!draft.locationId || !locationIds.has(draft.locationId)) {
    errors.locationId = "Vui lòng chọn địa điểm hợp lệ.";
  }
  if (!draft.requestedTime) {
    errors.requestedTime = "Vui lòng chọn giờ khách yêu cầu.";
  } else if (!isValidExplicitTimestamp(draft.requestedTime)) {
    errors.requestedTime = "Giờ yêu cầu phải là thời gian ISO hợp lệ.";
  }
  if (draft.serviceIds.length === 0) {
    errors.serviceIds = "Vui lòng chọn ít nhất một dịch vụ.";
  } else if (distinctServiceIds.size !== draft.serviceIds.length) {
    errors.serviceIds = "Mỗi dịch vụ chỉ được chọn một lần.";
  } else if (draft.serviceIds.some((serviceId) => !serviceIds.has(serviceId))) {
    errors.serviceIds = "Danh sách dịch vụ không hợp lệ.";
  }
  if (!draft.orderType) {
    errors.orderType = "Vui lòng chọn loại đơn.";
  }
  if (!draft.urgency) {
    errors.urgency = "Vui lòng chọn mức độ.";
  }

  return errors;
}

export function calculateDistinctServiceDuration(
  selectedServiceIds: readonly string[],
  services: readonly Service[],
): number | undefined {
  const distinctIds = Array.from(new Set(selectedServiceIds));
  if (distinctIds.length === 0) {
    return undefined;
  }

  const durationById = new Map(
    services.map((service) => [service.id, service.durationMinutes]),
  );
  let durationMinutes = 0;

  for (const serviceId of distinctIds) {
    const duration = durationById.get(serviceId);
    if (duration === undefined || !Number.isFinite(duration) || duration < 0) {
      return undefined;
    }
    durationMinutes += duration;
  }

  return durationMinutes;
}

function buildOrder(draft: OrderDraft, id: string): Order {
  const serviceIds = Array.from(new Set(draft.serviceIds));
  if (!draft.orderType || !draft.urgency || serviceIds.length === 0) {
    throw new Error("Cannot build an order from an invalid draft.");
  }

  return {
    id,
    customerName: draft.customerName.trim(),
    locationId: draft.locationId,
    serviceId: serviceIds[0],
    serviceIds,
    requestedTime: draft.requestedTime,
    orderType: draft.orderType,
    urgency: draft.urgency,
    status: "PENDING",
    notes: draft.notes.trim(),
  };
}

export function suggestOrderAssignments(
  input: SuggestOrderInput,
): SuggestOrderResult {
  const errors = validateOrderDraft(
    input.draft,
    input.locations,
    input.services,
  );
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const order = buildOrder(input.draft, generateOrderId(input.state.orders));
  return {
    ok: true,
    order,
    suggestions: suggestAssignments({
      order,
      employees: input.employees,
      assignments: input.state.assignments,
      orders: input.state.orders,
      services: input.services,
      locations: input.locations,
      currentTime: input.currentTime,
      travelTimeProvider: input.travelTimeProvider,
    }),
  };
}

export { addMinutesPreservingOffset } from "./dispatch/time";

export function confirmOrderAssignment(
  input: ConfirmOrderInput,
): ConfirmOrderResult {
  const preconditionError = getConfirmationPreconditionError({
    confirmed: input.confirmed,
    selectedEmployeeId: input.selectedEmployeeId,
    orderId: input.order.id,
    existingOrderIds: input.state.orders.map((order) => order.id),
  });
  if (preconditionError || input.selectedEmployeeId === null) {
    return {
      ok: false,
      state: input.state,
      error: preconditionError ?? "EMPLOYEE_REQUIRED",
    };
  }

  const freshSuggestions = suggestAssignments({
    order: input.order,
    employees: input.employees,
    assignments: input.state.assignments,
    orders: input.state.orders,
    services: input.services,
    locations: input.locations,
    currentTime: input.currentTime,
    travelTimeProvider: input.travelTimeProvider,
  });
  const selectedSuggestion = freshSuggestions.find(
    (suggestion) => suggestion.employeeId === input.selectedEmployeeId,
  );
  if (!selectedSuggestion) {
    return {
      ok: false,
      state: input.state,
      error: "STALE_SUGGESTION",
    };
  }

  const serviceIds = input.order.serviceIds ?? [input.order.serviceId];
  const durationMinutes = calculateDistinctServiceDuration(
    serviceIds,
    input.services,
  );
  if (durationMinutes === undefined) {
    return {
      ok: false,
      state: input.state,
      error: "INVALID_SERVICES",
    };
  }

  const confirmedOrder: Order = {
    ...cloneOrder(input.order),
    status: "ASSIGNED",
  };
  const assignment: Assignment = {
    id: generateAssignmentId(input.state.assignments),
    orderId: confirmedOrder.id,
    employeeId: input.selectedEmployeeId,
    startTime: confirmedOrder.requestedTime,
    endTime: addMinutesPreservingOffset(
      confirmedOrder.requestedTime,
      durationMinutes,
    ),
    status: "SCHEDULED",
  };

  return {
    ok: true,
    state: {
      orders: [...input.state.orders, confirmedOrder],
      assignments: [...input.state.assignments, assignment],
    },
    order: confirmedOrder,
    assignment,
    suggestion: selectedSuggestion,
  };
}
