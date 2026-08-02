"use client";

import { useCallback, useState } from "react";
import {
  mockEmployees,
  mockAssignments,
  mockOrders,
  mockServices,
  mockLocations,
} from "@/data/mockData";
import { getDashboardSummary } from "@/domain/demo-status";
import { getEffectiveAssignments, RuntimeOverride } from "@/domain/effective-assignment";
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
  OrderDraft,
} from "@/domain/order-flow";
import { Assignment, AssignmentSuggestion } from "@/types";
import { MapTab } from "@/components/map/MapTab";
import { ListTab } from "@/components/map/ListTab";
import { useDispatchDashboard } from "@/hooks/useDispatchDashboard";
import { createDemoTravelTimeProvider } from "@/data/demo-dispatch-composition";

type TabState = "MAP" | "LIST" | "TIMELINE";

export default function DashboardPage() {
  const travelTimeProvider = createDemoTravelTimeProvider();
  const { timeMode, setTimeMode, currentTime, runtimeOverrides, setRuntimeOverrides } = useDispatchDashboard();
  
  const [dispatchState, setDispatchState] = useState(() =>
    createDispatchState(mockOrders, mockAssignments),
  );
  
  const [activeTab, setActiveTab] = useState<TabState>("MAP");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [newCustomerLocationId, setNewCustomerLocationId] = useState<string | null>(null);
  const [recommendedEmployeeIds, setRecommendedEmployeeIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveAssignments = getEffectiveAssignments(dispatchState.assignments, runtimeOverrides);

  const summary = getDashboardSummary(
    mockEmployees,
    effectiveAssignments,
    dispatchState.orders,
    currentTime,
  );

  function handleOverride(assignmentId: string, override: RuntimeOverride) {
    setRuntimeOverrides(prev => ({
      ...prev,
      [assignmentId]: { ...(prev[assignmentId] || {}), ...override }
    }));
  }

  const handleSuggest = useCallback((draft: OrderDraft, suggestions: AssignmentSuggestion[] | null) => {
    if (suggestions && suggestions.length > 0) {
      setNewCustomerLocationId(draft.locationId);
      setRecommendedEmployeeIds(suggestions.slice(0, 3).map(s => s.employeeId));
    } else {
      setNewCustomerLocationId(null);
      setRecommendedEmployeeIds([]);
    }
  }, []);

  function handleAssignmentClick(assignment: Assignment) {
    setSelectedAssignment(assignment);
    setSheetOpen(true);
  }

  function handleReset() {
    setDispatchState(resetDispatchState(mockOrders, mockAssignments));
    setRuntimeOverrides({});
    setSelectedAssignment(null);
    setSelectedEmployeeId(null);
    setSheetOpen(false);
    setMessage(null);
    setFlowKey((current) => current + 1);
    setTimeMode("SIMULATED");
  }

  function handleOrderConfirmation(request: OrderConfirmationRequest) {
    // confirmation requires using the effective state so we apply overrides before checking stale
    const effectiveState = { ...dispatchState, assignments: effectiveAssignments };
    const result = confirmOrderAssignment({
      confirmed: true,
      order: request.order,
      selectedEmployeeId: request.employeeId,
      state: effectiveState,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: currentTime,
      travelTimeProvider,
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

    // result.state contains new orders and base assignments. We persist to real state.
    setDispatchState(result.state);
    
    // Switch to map view to see the new customer
    setActiveTab("MAP");
    setSelectedEmployeeId(result.assignment.employeeId);
    
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
      <DashboardHeader 
        demoTime={currentTime} 
        timeMode={timeMode} 
        onTimeModeChange={setTimeMode} 
        onReset={handleReset} 
      />

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <OrderFlowDialog
          key={flowKey}
          state={{ ...dispatchState, assignments: effectiveAssignments }}
          employees={mockEmployees}
          services={mockServices}
          locations={mockLocations}
          currentTime={currentTime}
          travelTimeProvider={travelTimeProvider}
          onSuggest={handleSuggest}
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

      <div className="px-5 mt-2">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("MAP")}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === "MAP"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Bản đồ
            </button>
            <button
              onClick={() => setActiveTab("LIST")}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === "LIST"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Danh sách
            </button>
            <button
              onClick={() => setActiveTab("TIMELINE")}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === "TIMELINE"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Lịch chi tiết
            </button>
          </nav>
        </div>
      </div>

      <div className="flex-1 p-5 pt-4">
        {activeTab === "MAP" && (
          <MapTab
            employees={mockEmployees}
            assignments={effectiveAssignments}
            orders={dispatchState.orders}
            locations={mockLocations}
            services={mockServices}
            currentTime={currentTime}
            onOverride={handleOverride}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            newCustomerLocationId={newCustomerLocationId}
            recommendedEmployeeIds={recommendedEmployeeIds}
          />
        )}
        
        {activeTab === "LIST" && (
          <ListTab
            employees={mockEmployees}
            assignments={effectiveAssignments}
            orders={dispatchState.orders}
            locations={mockLocations}
            currentTime={currentTime}
          />
        )}
        
        {activeTab === "TIMELINE" && (
          <div className="bg-white rounded-xl shadow-sm border border-border">
            <DailyTimeline
              employees={mockEmployees}
              assignments={effectiveAssignments}
              orders={dispatchState.orders}
              services={mockServices}
              locations={mockLocations}
              demoTime={currentTime}
              onAssignmentClick={handleAssignmentClick}
            />
          </div>
        )}
      </div>

      <AssignmentDetailSheet
        assignment={selectedAssignment}
        order={selectedOrder}
        employee={selectedEmployeeId ? mockEmployees.find(e => e.id === selectedEmployeeId) ?? null : selectedEmployee}
        location={selectedLocation}
        services={selectedServices}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
