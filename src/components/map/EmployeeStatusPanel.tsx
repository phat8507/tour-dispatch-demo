import { useState } from "react";
import { Employee, Order, Assignment, Location, Service } from "@/types";
import { getEmployeeRealtimeStatus } from "@/domain/realtime-status";
import { addMinutesPreservingOffset } from "@/domain/order-flow";
import { RuntimeOverride } from "@/domain/effective-assignment";
import { Button } from "@/components/ui/button";

interface EmployeeStatusPanelProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  locations: Location[];
  services: Service[];
  currentTime: string;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
  onOverride: (assignmentId: string, override: RuntimeOverride) => void;
}

const FILTER_OPTIONS = [
  "Tất cả", "Đang rảnh", "Đang làm", "Sắp xong", "Bị trễ", "Nghỉ", "CS1", "CS2"
] as const;

type FilterType = typeof FILTER_OPTIONS[number];

export function EmployeeStatusPanel({
  employees,
  assignments,
  orders,
  locations,
  currentTime,
  selectedEmployeeId,
  onSelectEmployee,
  onOverride,
}: EmployeeStatusPanelProps) {
  const [filter, setFilter] = useState<FilterType>("Tất cả");

  const statuses = employees.map(emp => {
    const status = getEmployeeRealtimeStatus(emp, assignments, currentTime);
    return { emp, status };
  });

  const filtered = statuses.filter(({ emp, status }) => {
    if (filter === "Tất cả") return true;
    if (filter === "CS1") return emp.branchId === "CS1";
    if (filter === "CS2") return emp.branchId === "CS2";
    if (filter === "Nghỉ") return status.status === "OFF";
    if (filter === "Đang rảnh") return status.status === "AVAILABLE";
    if (filter === "Đang làm") return status.status === "IN_PROGRESS" || status.status === "FINISHING_SOON";
    if (filter === "Sắp xong") return status.status === "FINISHING_SOON";
    if (filter === "Bị trễ") return status.status === "DELAYED";
    return true;
  });

  function getStatusLabel(s: string) {
    switch (s) {
      case "AVAILABLE": return "Đang rảnh";
      case "NEXT_ASSIGNMENT_PENDING": return "Dự kiến di chuyển";
      case "IN_PROGRESS": return "Đang làm";
      case "FINISHING_SOON": return "Sắp xong";
      case "DELAYED": return "Bị trễ";
      case "OFF": return "Nghỉ";
      default: return s;
    }
  }

  function getStatusColor(s: string) {
    switch (s) {
      case "AVAILABLE": return "bg-emerald-100 text-emerald-800";
      case "NEXT_ASSIGNMENT_PENDING": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-amber-100 text-amber-800";
      case "FINISHING_SOON": return "bg-amber-100 text-amber-800";
      case "DELAYED": return "bg-red-100 text-red-800";
      case "OFF": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 border-b border-gray-100 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Danh sách nhân viên</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filter === opt ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map(({ emp, status }) => {
          const isSelected = selectedEmployeeId === emp.id;
          const activeOrder = status.activeAssignment ? orders.find(o => o.id === status.activeAssignment?.orderId) : null;
          const activeLocation = activeOrder ? locations.find(l => l.id === activeOrder.locationId) : null;
          
          return (
            <div 
              key={emp.id}
              onClick={() => onSelectEmployee(isSelected ? null : emp.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/30 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{emp.name}</span>
                    <span className="text-[10px] text-gray-500 bg-white border px-1.5 rounded font-medium">{emp.branchId}</span>
                  </div>
                  <span className={`mt-1.5 text-[11px] px-2 py-0.5 rounded-full w-max font-bold ${getStatusColor(status.status)}`}>
                    {getStatusLabel(status.status)}
                  </span>
                </div>
                {status.countdownMinutes !== undefined && (
                  <div className="text-right flex flex-col items-end">
                    <span className={`text-sm font-bold ${status.status === 'DELAYED' || status.countdownMinutes < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {status.countdownMinutes < 0 ? `Trễ ${Math.abs(status.countdownMinutes)} phút` : `Còn ${status.countdownMinutes} phút`}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">đến dự kiến</span>
                  </div>
                )}
              </div>
              
              {activeLocation && (
                <p className="text-xs text-gray-700 mt-2.5 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Đang ở: {activeLocation.name}
                </p>
              )}

              {isSelected && status.activeAssignment && (
                <div className="mt-3 pt-3 border-t border-blue-200/50 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 bg-white" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { status: "IN_PROGRESS" }); }}>
                    Đã đến
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 bg-white" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { status: "IN_PROGRESS", startTime: currentTime }); }}>
                    Bắt đầu làm
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 bg-white" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { endTime: addMinutesPreservingOffset(currentTime, 15) }); }}>
                    Còn 15p
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 bg-white" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { endTime: addMinutesPreservingOffset(currentTime, 30) }); }}>
                    Còn 30p
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { status: "DELAYED", endTime: addMinutesPreservingOffset(status.activeAssignment!.endTime, 15) }); }}>
                    Trễ 15p
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { status: "DELAYED", endTime: addMinutesPreservingOffset(status.activeAssignment!.endTime, 30) }); }}>
                    Trễ 30p
                  </Button>
                  <Button size="sm" className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" onClick={(e) => { e.stopPropagation(); onOverride(status.activeAssignment!.id, { status: "COMPLETED", endTime: currentTime }); }}>
                    Hoàn thành
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            Không có nhân viên nào phù hợp với bộ lọc.
          </div>
        )}
      </div>
    </div>
  );
}
