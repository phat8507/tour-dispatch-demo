import { describe, expect, it } from "vitest";
import {
  calculateDistinctServiceDuration,
  confirmOrderAssignment,
  createDispatchState,
  generateAssignmentId,
  generateOrderId,
  OrderDraft,
  resetDispatchState,
  suggestOrderAssignments,
} from "../src/domain/order-flow";
import {
  DEMO_TIME,
  mockAssignments,
  mockEmployees,
  mockLocations,
  mockOrders,
  mockServices,
} from "../src/data/mockData";
import { Assignment, Order } from "../src/types";

const feasibleDraft: OrderDraft = {
  customerName: "Khách demo",
  locationId: "loc_cs2_center",
  requestedTime: "2026-07-31T12:00:00+07:00",
  serviceIds: ["s_standard"],
  orderType: "NEW_TOUR",
  urgency: "IMMEDIATE",
  notes: "Gọi trước",
};

function getSuggestion() {
  const state = createDispatchState(mockOrders, mockAssignments);
  const result = suggestOrderAssignments({
    draft: feasibleDraft,
    state,
    employees: mockEmployees,
    services: mockServices,
    locations: mockLocations,
    currentTime: DEMO_TIME,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected a valid suggestion result.");
  }
  expect(result.suggestions.length).toBeGreaterThan(0);
  return { state, result };
}

describe("order-flow deterministic IDs", () => {
  it("generates the next deterministic order ID", () => {
    expect(generateOrderId(mockOrders)).toBe("order_demo_19");
  });

  it("generates the next deterministic assignment ID", () => {
    expect(generateAssignmentId(mockAssignments)).toBe(
      "assignment_demo_19",
    );
  });

  it("produces unique deterministic IDs across repeated creation", () => {
    const { state, result } = getSuggestion();
    const first = confirmOrderAssignment({
      confirmed: true,
      order: result.order,
      selectedEmployeeId: result.suggestions[0].employeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("Expected first confirmation to succeed.");
    }

    expect(generateOrderId(first.state.orders)).toBe("order_demo_20");
    expect(generateAssignmentId(first.state.assignments)).toBe(
      "assignment_demo_20",
    );
  });
});

describe("order-flow service duration", () => {
  it("sums the duration of distinct services", () => {
    expect(
      calculateDistinctServiceDuration(
        ["s_standard", "s_quick"],
        mockServices,
      ),
    ).toBe(90);
  });

  it("does not count duplicate service IDs twice", () => {
    expect(
      calculateDistinctServiceDuration(
        ["s_standard", "s_standard", "s_quick"],
        mockServices,
      ),
    ).toBe(90);
  });
});

describe("order-flow immutable state", () => {
  it("does not mutate seeded mock data when confirming", () => {
    const seededOrdersBefore = structuredClone(mockOrders);
    const seededAssignmentsBefore = structuredClone(mockAssignments);
    const { state, result } = getSuggestion();

    confirmOrderAssignment({
      confirmed: true,
      order: result.order,
      selectedEmployeeId: result.suggestions[0].employeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(mockOrders).toEqual(seededOrdersBefore);
    expect(mockAssignments).toEqual(seededAssignmentsBefore);
  });

  it("reset restores an exact cloned seeded state", () => {
    const reset = resetDispatchState(mockOrders, mockAssignments);

    expect(reset).toEqual({
      orders: mockOrders,
      assignments: mockAssignments,
    });
    expect(reset.orders).not.toBe(mockOrders);
    expect(reset.assignments).not.toBe(mockAssignments);
  });

  it("does not create an assignment without confirmation", () => {
    const { state, result } = getSuggestion();
    const confirmation = confirmOrderAssignment({
      confirmed: false,
      order: result.order,
      selectedEmployeeId: result.suggestions[0].employeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(confirmation).toEqual({
      ok: false,
      state,
      error: "CONFIRMATION_REQUIRED",
    });
    expect(state.assignments).toHaveLength(mockAssignments.length);
  });
});

describe("order-flow confirmation revalidation", () => {
  it("rejects a stale suggestion that has become unavailable", () => {
    const { state, result } = getSuggestion();
    const selectedEmployeeId = result.suggestions[0].employeeId;
    const conflictingAssignment: Assignment = {
      id: "conflict",
      orderId: "conflicting-order",
      employeeId: selectedEmployeeId,
      startTime: result.order.requestedTime,
      endTime: "2026-07-31T14:00:00+07:00",
      status: "SCHEDULED",
    };
    const staleState = {
      ...state,
      assignments: [...state.assignments, conflictingAssignment],
    };
    const confirmation = confirmOrderAssignment({
      confirmed: true,
      order: result.order,
      selectedEmployeeId,
      state: staleState,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(confirmation.ok).toBe(false);
    if (confirmation.ok) {
      throw new Error("Expected stale confirmation to fail.");
    }
    expect(confirmation.error).toBe("STALE_SUGGESTION");
    expect(confirmation.state).toBe(staleState);
  });

  it("does not create an assignment when no employee is eligible", () => {
    const state = createDispatchState(mockOrders, mockAssignments);
    const result = suggestOrderAssignments({
      draft: {
        ...feasibleDraft,
        requestedTime: "2026-07-31T10:01:00+07:00",
      },
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected valid input.");
    }
    expect(result.suggestions).toEqual([]);
    expect(state.assignments).toHaveLength(mockAssignments.length);
  });

  it("creates linked order and assignment for the selected employee", () => {
    const { state, result } = getSuggestion();
    const selectedEmployeeId = result.suggestions[0].employeeId;
    const confirmation = confirmOrderAssignment({
      confirmed: true,
      order: result.order,
      selectedEmployeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(confirmation.ok).toBe(true);
    if (!confirmation.ok) {
      throw new Error("Expected confirmation to succeed.");
    }
    expect(confirmation.assignment.employeeId).toBe(selectedEmployeeId);
    expect(confirmation.assignment.orderId).toBe(confirmation.order.id);
    expect(
      confirmation.state.orders.find(
        (order) => order.id === confirmation.order.id,
      ),
    ).toEqual(confirmation.order);
    expect(
      confirmation.state.assignments.find(
        (assignment) => assignment.id === confirmation.assignment.id,
      ),
    ).toEqual(confirmation.assignment);
  });

  it("calculates expectedEnd from all distinct selected services", () => {
    const state = createDispatchState(mockOrders, mockAssignments);
    const result = suggestOrderAssignments({
      draft: {
        ...feasibleDraft,
        serviceIds: ["s_standard", "s_quick"],
      },
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.suggestions.length === 0) {
      throw new Error("Expected suggestions for a valid multi-service order.");
    }

    const confirmation = confirmOrderAssignment({
      confirmed: true,
      order: result.order,
      selectedEmployeeId: result.suggestions[0].employeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });
    expect(confirmation.ok).toBe(true);
    if (!confirmation.ok) {
      throw new Error("Expected confirmation to succeed.");
    }
    expect(confirmation.assignment.startTime).toBe(
      "2026-07-31T12:00:00+07:00",
    );
    expect(confirmation.assignment.endTime).toBe(
      "2026-07-31T13:30:00+07:00",
    );
  });
});

describe("order-flow validation", () => {
  it("rejects unknown IDs, duplicate services, and invalid timestamps", () => {
    const state = createDispatchState(mockOrders, mockAssignments);
    const invalidDraft: OrderDraft = {
      ...feasibleDraft,
      customerName: "",
      locationId: "unknown-location",
      requestedTime: "not-a-time",
      serviceIds: ["s_standard", "s_standard"],
      orderType: "",
      urgency: "",
    };
    const result = suggestOrderAssignments({
      draft: invalidDraft,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation to fail.");
    }
    expect(result.errors).toEqual({
      customerName: "Vui lòng nhập tên khách hàng.",
      locationId: "Vui lòng chọn địa điểm hợp lệ.",
      requestedTime: "Giờ yêu cầu phải là thời gian ISO hợp lệ.",
      serviceIds: "Mỗi dịch vụ chỉ được chọn một lần.",
      orderType: "Vui lòng chọn loại đơn.",
      urgency: "Vui lòng chọn mức độ.",
    });
  });

  it("keeps generated orders compatible with the existing Order type", () => {
    const { result } = getSuggestion();
    const order: Order = result.order;

    expect(order.serviceId).toBe(order.serviceIds?.[0]);
    expect(order.status).toBe("PENDING");
  });
});
