"use client";

import { useCallback, useState } from "react";
import { AssignmentDetailSheet } from "@/components/AssignmentDetailSheet";
import { DailyTimeline } from "@/components/DailyTimeline";
import { DashboardHeader } from "@/components/DashboardHeader";
import { MapTab } from "@/components/map/MapTab";
import { ListTab } from "@/components/map/ListTab";
import { SummaryCards } from "@/components/SummaryCards";
import { OrderFlowDialog, type OrderConfirmationRequest } from "@/components/order-flow/OrderFlowDialog";
import { createDemoTravelTimeProvider } from "@/data/demo-dispatch-composition";
import { getDashboardSummary } from "@/domain/demo-status";
import { confirmOrderAssignment, createDispatchState, resetDispatchState, type OrderDraft } from "@/domain/order-flow";
import { useDispatchDashboard } from "@/hooks/useDispatchDashboard";
import type { Assignment, AssignmentSuggestion, Employee, Location, Order, Service } from "@/types";

type TabState = "MAP" | "LIST" | "TIMELINE";

export function DemoDispatchDashboard({ employees, assignments, orders, services, locations }: {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  services: Service[];
  locations: Location[];
}) {
  const travelTimeProvider = createDemoTravelTimeProvider();
  const { timeMode, setTimeMode, currentTime } = useDispatchDashboard();
  const [dispatchState, setDispatchState] = useState(() => createDispatchState(orders, assignments));
  const [activeTab, setActiveTab] = useState<TabState>("MAP");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [newCustomerLocationId, setNewCustomerLocationId] = useState<string | null>(null);
  const [recommendedEmployeeIds, setRecommendedEmployeeIds] = useState<string[]>([]);
  const summary = getDashboardSummary(employees, dispatchState.assignments, dispatchState.orders, currentTime);

  const handleSuggest = useCallback((draft: OrderDraft, suggestions: AssignmentSuggestion[] | null) => {
    if (suggestions && suggestions.length > 0) {
      setNewCustomerLocationId(draft.locationId);
      setRecommendedEmployeeIds(suggestions.slice(0, 3).map((suggestion) => suggestion.employeeId));
    } else {
      setNewCustomerLocationId(null);
      setRecommendedEmployeeIds([]);
    }
  }, []);

  function handleOrderConfirmation(request: OrderConfirmationRequest) {
    const result = confirmOrderAssignment({
      confirmed: true,
      order: request.order,
      selectedEmployeeId: request.employeeId,
      state: dispatchState,
      employees,
      services,
      locations,
      currentTime,
      travelTimeProvider,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.error === "STALE_SUGGESTION"
          ? "Nhân viên đã chọn không còn phù hợp. Vui lòng tìm lại đề xuất."
          : "Không thể xác nhận đơn. Vui lòng kiểm tra lại thông tin.",
      };
    }
    setDispatchState(result.state);
    setActiveTab("MAP");
    setSelectedEmployeeId(result.assignment.employeeId);
    setMessage(`Đã giao đơn ${result.order.id} cho ${employees.find((employee) => employee.id === result.assignment.employeeId)?.name ?? result.assignment.employeeId}.`);
    return { ok: true };
  }

  function resetDemoPresentation() {
    setDispatchState(resetDispatchState(orders, assignments));
    setActiveTab("MAP");
    setSelectedAssignment(null);
    setSelectedEmployeeId(null);
    setSheetOpen(false);
    setMessage(null);
    setNewCustomerLocationId(null);
    setRecommendedEmployeeIds([]);
    setFlowKey((current) => current + 1);
    setTimeMode("SIMULATED");
  }

  const selectedOrder = selectedAssignment ? dispatchState.orders.find((order) => order.id === selectedAssignment.orderId) ?? null : null;
  const selectedEmployee = selectedAssignment ? employees.find((employee) => employee.id === selectedAssignment.employeeId) ?? null : null;
  const selectedLocation = selectedOrder ? locations.find((location) => location.id === selectedOrder.locationId) ?? null : null;
  const selectedServices = selectedOrder
    ? (selectedOrder.serviceIds ?? [selectedOrder.serviceId])
        .map((serviceId) => services.find((service) => service.id === serviceId))
        .filter((service): service is Service => Boolean(service))
    : [];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <DashboardHeader demoTime={currentTime} timeMode={timeMode} onTimeModeChange={setTimeMode} onReset={resetDemoPresentation} />
      <p className="mx-5 mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        Chế độ minh họa tách biệt. Thay đổi tại đây chỉ tồn tại trong bộ nhớ của bản demo và nút đặt lại không ảnh hưởng `/owner`.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <OrderFlowDialog key={flowKey} state={dispatchState} employees={employees} services={services} locations={locations} currentTime={currentTime} travelTimeProvider={travelTimeProvider} onSuggest={handleSuggest} onConfirm={handleOrderConfirmation} />
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      </div>
      <SummaryCards summary={summary} />
      <div className="px-5 mt-2">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {(["MAP", "LIST", "TIMELINE"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}`}>
                {tab === "MAP" ? "Bản đồ" : tab === "LIST" ? "Danh sách" : "Lịch chi tiết"}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 p-5 pt-4">
        {activeTab === "MAP" && <MapTab employees={employees} assignments={dispatchState.assignments} orders={dispatchState.orders} locations={locations} currentTime={currentTime} selectedEmployeeId={selectedEmployeeId} onSelectEmployee={setSelectedEmployeeId} newCustomerLocationId={newCustomerLocationId} recommendedEmployeeIds={recommendedEmployeeIds} />}
        {activeTab === "LIST" && <ListTab employees={employees} assignments={dispatchState.assignments} orders={dispatchState.orders} locations={locations} currentTime={currentTime} />}
        {activeTab === "TIMELINE" && (
          <div className="rounded-xl border border-border bg-white shadow-sm">
            <DailyTimeline employees={employees} assignments={dispatchState.assignments} orders={dispatchState.orders} services={services} locations={locations} demoTime={currentTime} onAssignmentClick={(assignment) => { setSelectedAssignment(assignment); setSheetOpen(true); }} />
          </div>
        )}
      </div>
      <AssignmentDetailSheet assignment={selectedAssignment} order={selectedOrder} employee={selectedEmployee} location={selectedLocation} services={selectedServices} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
