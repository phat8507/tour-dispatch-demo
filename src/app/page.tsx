"use client";

import { useState } from "react";
import {
  DEMO_TIME,
  mockEmployees,
  mockAssignments,
  mockOrders,
  mockServices,
  mockLocations,
} from "@/data/mockData";
import { getDashboardSummary } from "@/domain/demo-status";
import { DashboardHeader } from "@/components/DashboardHeader";
import { SummaryCards } from "@/components/SummaryCards";
import { DailyTimeline } from "@/components/DailyTimeline";
import { AssignmentDetailSheet } from "@/components/AssignmentDetailSheet";
import {
  OrderConfirmationRequest,
  OrderFlowDialog,
} from "@/components/order-flow/OrderFlowDialog";
import {
  confirmOrderAssignment,
  createDispatchState,
  resetDispatchState,
} from "@/domain/order-flow";
import { Assignment } from "@/types";

export default function DashboardPage() {
  const [dispatchState, setDispatchState] = useState(() =>
    createDispatchState(mockOrders, mockAssignments),
  );
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  // Use fixed DEMO_TIME — never the current system time.
  const demoTime = DEMO_TIME;

  const summary = getDashboardSummary(
    mockEmployees,
    dispatchState.assignments,
    dispatchState.orders,
    demoTime,
  );

  function handleAssignmentClick(assignment: Assignment) {
    setSelectedAssignment(assignment);
    setSheetOpen(true);
  }

  function handleReset() {
    setDispatchState(resetDispatchState(mockOrders, mockAssignments));
    setSelectedAssignment(null);
    setSheetOpen(false);
    setMessage(null);
    setFlowKey((current) => current + 1);
  }

  function handleOrderConfirmation(request: OrderConfirmationRequest) {
    const result = confirmOrderAssignment({
      confirmed: true,
      order: request.order,
      selectedEmployeeId: request.employeeId,
      state: dispatchState,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: demoTime,
    });

    if (!result.ok) {
      return {
        ok: false,
        message:
          result.error === "STALE_SUGGESTION"
            ? "Nhân viên đã chọn không còn phù hợp. Vui lòng tìm lại đề xuất."
            : "Không thể xác nhận đơn. Vui lòng kiểm tra lại thông tin.",
      };
    }

    setDispatchState(result.state);
    setMessage(
      `Đã giao đơn ${result.order.id} cho ${
        mockEmployees.find(
          (employee) => employee.id === result.assignment.employeeId,
        )?.name ?? result.assignment.employeeId
      }.`,
    );
    return { ok: true };
  }

  const selectedOrder = selectedAssignment
    ? dispatchState.orders.find((o) => o.id === selectedAssignment.orderId) ?? null
    : null;

  const selectedEmployee = selectedAssignment
    ? mockEmployees.find((e) => e.id === selectedAssignment.employeeId) ?? null
    : null;

  const selectedLocation = selectedOrder
    ? mockLocations.find((l) => l.id === selectedOrder.locationId) ?? null
    : null;

  const selectedServices = selectedOrder
    ? (selectedOrder.serviceIds ?? [selectedOrder.serviceId])
        .map((serviceId) =>
          mockServices.find((service) => service.id === serviceId),
        )
        .filter((service) => service !== undefined)
    : [];

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      <DashboardHeader demoTime={demoTime} onReset={handleReset} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <OrderFlowDialog
          key={flowKey}
          state={dispatchState}
          employees={mockEmployees}
          services={mockServices}
          locations={mockLocations}
          currentTime={demoTime}
          onConfirm={handleOrderConfirmation}
        />
        {message && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}
      </div>

      <SummaryCards summary={summary} />

      <DailyTimeline
        employees={mockEmployees}
        assignments={dispatchState.assignments}
        orders={dispatchState.orders}
        services={mockServices}
        locations={mockLocations}
        demoTime={demoTime}
        onAssignmentClick={handleAssignmentClick}
      />

      <AssignmentDetailSheet
        assignment={selectedAssignment}
        order={selectedOrder}
        employee={selectedEmployee}
        location={selectedLocation}
        services={selectedServices}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
