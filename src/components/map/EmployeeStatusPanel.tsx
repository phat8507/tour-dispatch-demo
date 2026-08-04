import { useState } from "react";
import type { Assignment, Employee, Location, Order } from "@/types";
import { getEmployeeRealtimeStatus } from "@/domain/realtime-status";

interface EmployeeStatusPanelProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  locations: Location[];
  currentTime: string;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
}

const FILTER_OPTIONS = ["Tất cả", "Đang rảnh", "Đang làm", "Sắp xong", "Bị trễ", "Nghỉ", "CS1", "CS2"] as const;
type FilterType = (typeof FILTER_OPTIONS)[number];

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: "Đang rảnh",
    NEXT_ASSIGNMENT_PENDING: "Dự kiến di chuyển",
    IN_PROGRESS: "Đang làm",
    FINISHING_SOON: "Sắp xong",
    DELAYED: "Bị trễ",
    OFF: "Nghỉ",
  };
  return labels[status] ?? status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: "bg-emerald-100 text-emerald-800",
    NEXT_ASSIGNMENT_PENDING: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    FINISHING_SOON: "bg-amber-100 text-amber-800",
    DELAYED: "bg-red-100 text-red-800",
    OFF: "bg-gray-100 text-gray-800",
  };
  return colors[status] ?? "bg-gray-100 text-gray-800";
}

export function EmployeeStatusPanel({ employees, assignments, orders, locations, currentTime, selectedEmployeeId, onSelectEmployee }: EmployeeStatusPanelProps) {
  const [filter, setFilter] = useState<FilterType>("Tất cả");
  const statuses = employees.map((employee) => ({ employee, status: getEmployeeRealtimeStatus(employee, assignments, currentTime) }));
  const filtered = statuses.filter(({ employee, status }) => {
    if (filter === "Tất cả") return true;
    if (filter === "CS1" || filter === "CS2") return employee.branchId === filter;
    if (filter === "Nghỉ") return status.status === "OFF";
    if (filter === "Đang rảnh") return status.status === "AVAILABLE";
    if (filter === "Đang làm") return status.status === "IN_PROGRESS" || status.status === "FINISHING_SOON";
    if (filter === "Sắp xong") return status.status === "FINISHING_SOON";
    return status.status === "DELAYED";
  });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-100 p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Danh sách nhân viên</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((option) => (
            <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${filter === option ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {filtered.map(({ employee, status }) => {
          const isSelected = selectedEmployeeId === employee.id;
          const activeOrder = status.activeAssignment ? orders.find((order) => order.id === status.activeAssignment?.orderId) : null;
          const activeLocation = activeOrder ? locations.find((location) => location.id === activeOrder.locationId) : null;
          return (
            <button key={employee.id} type="button" aria-pressed={isSelected} onClick={() => onSelectEmployee(isSelected ? null : employee.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${isSelected ? "border-blue-500 bg-blue-50/30" : "border-transparent hover:bg-gray-50"}`}>
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{employee.name}</span>
                    <span className="rounded border bg-white px-1.5 text-[10px] font-medium text-gray-500">{employee.branchId}</span>
                  </span>
                  <span className={`mt-1.5 block w-max rounded-full px-2 py-0.5 text-[11px] font-bold ${statusColor(status.status)}`}>{statusLabel(status.status)}</span>
                </span>
                {status.countdownMinutes !== undefined && (
                  <span className={`text-sm font-bold ${status.status === "DELAYED" || status.countdownMinutes < 0 ? "text-red-600" : "text-blue-600"}`}>
                    {status.countdownMinutes < 0 ? `Trễ ${Math.abs(status.countdownMinutes)} phút` : `Còn ${status.countdownMinutes} phút`}
                  </span>
                )}
              </span>
              {activeLocation && <span className="mt-2.5 block text-xs font-medium text-gray-700">Đang ở: {activeLocation.name}</span>}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Không có nhân viên nào phù hợp với bộ lọc.</p>}
      </div>
    </div>
  );
}
