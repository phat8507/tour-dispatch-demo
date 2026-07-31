import { useMemo } from "react";
import { Employee, Order, Assignment, Location } from "@/types";
import { projectLocationToMap, offsetOverlappingMarker } from "@/domain/map-projection";
import { resolveEmployeeMapPosition } from "@/domain/employee-map-state";
import { getEmployeeRealtimeStatus } from "@/domain/realtime-status";

interface OperationalMapProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  locations: Location[];
  currentTime: string;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
  newCustomerLocationId?: string | null;
  recommendedEmployeeIds?: string[];
}

const STATUS_COLORS = {
  AVAILABLE: "#10b981", // emerald-500
  NEXT_ASSIGNMENT_PENDING: "#3b82f6", // blue-500
  IN_PROGRESS: "#f59e0b", // amber-500
  DELAYED: "#ef4444", // red-500
  FINISHING_SOON: "#f59e0b",
  OFF: "#9ca3af", // gray-400
};

export function OperationalMap({
  employees,
  assignments,
  orders,
  locations,
  currentTime,
  selectedEmployeeId,
  onSelectEmployee,
  newCustomerLocationId,
  recommendedEmployeeIds = [],
}: OperationalMapProps) {
  const employeePositions = useMemo(() => {
    const positions: { emp: Employee; loc: Location; status: string }[] = [];
    const locationCounts: Record<string, number> = {};
    const employeeIndexAtLoc: Record<string, number> = {};

    employees.forEach(emp => {
      const loc = resolveEmployeeMapPosition(emp, assignments, orders, locations, currentTime);
      if (loc) {
        const { status } = getEmployeeRealtimeStatus(emp, assignments, currentTime);
        positions.push({ emp, loc, status });
        locationCounts[loc.id] = (locationCounts[loc.id] || 0) + 1;
      }
    });

    return positions.map(p => {
      const idx = employeeIndexAtLoc[p.loc.id] || 0;
      employeeIndexAtLoc[p.loc.id] = idx + 1;
      
      const basePoint = projectLocationToMap(p.loc, locations);
      const point = offsetOverlappingMarker(basePoint, idx, locationCounts[p.loc.id]);
      
      return { ...p, point };
    });
  }, [employees, assignments, orders, locations, currentTime]);

  const newCustomerPoint = newCustomerLocationId 
    ? projectLocationToMap(locations.find(l => l.id === newCustomerLocationId) || locations[0], locations) 
    : null;

  return (
    <div className="w-full h-full relative bg-blue-50/30 overflow-hidden" onClick={() => onSelectEmployee(null)}>
      <svg className="w-full h-full absolute inset-0 pointer-events-none">
        {newCustomerPoint && recommendedEmployeeIds.map(empId => {
          const empPos = employeePositions.find(p => p.emp.id === empId);
          if (!empPos) return null;
          return (
            <line
              key={`rec-${empId}`}
              x1={`${empPos.point.x}%`}
              y1={`${empPos.point.y}%`}
              x2={`${newCustomerPoint.x}%`}
              y2={`${newCustomerPoint.y}%`}
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="opacity-60"
            />
          );
        })}

        {!newCustomerLocationId && selectedEmployeeId && (
          (() => {
            const empPos = employeePositions.find(p => p.emp.id === selectedEmployeeId);
            if (!empPos) return null;
            const { nextAssignment } = getEmployeeRealtimeStatus(empPos.emp, assignments, currentTime);
            if (!nextAssignment) return null;
            const order = orders.find(o => o.id === nextAssignment.orderId);
            if (!order) return null;
            const nextLoc = locations.find(l => l.id === order.locationId);
            if (!nextLoc) return null;
            
            const nextPoint = projectLocationToMap(nextLoc, locations);
            return (
              <line
                x1={`${empPos.point.x}%`}
                y1={`${empPos.point.y}%`}
                x2={`${nextPoint.x}%`}
                y2={`${nextPoint.y}%`}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-50"
              />
            );
          })()
        )}
      </svg>
      
      {locations.map(loc => {
        const point = projectLocationToMap(loc, locations);
        return (
          <div 
            key={loc.id} 
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white shadow-sm" />
            <span className="text-[10px] text-gray-500 mt-1 font-medium select-none bg-white/80 px-1 rounded shadow-sm text-center max-w-[80px] leading-tight">
              {loc.name}
            </span>
          </div>
        );
      })}

      {newCustomerPoint && (
        <div 
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto z-10 animate-bounce"
          style={{ left: `${newCustomerPoint.x}%`, top: `${newCustomerPoint.y}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-md" />
          <span className="text-xs text-purple-700 mt-1 font-bold select-none bg-white px-1.5 py-0.5 rounded shadow-sm">Khách mới</span>
        </div>
      )}

      {employeePositions.map(pos => {
        const isSelected = selectedEmployeeId === pos.emp.id;
        const isRecommended = recommendedEmployeeIds.includes(pos.emp.id);
        const color = STATUS_COLORS[pos.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.AVAILABLE;
        
        return (
          <button
            key={pos.emp.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEmployee(pos.emp.id);
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-auto transition-transform ${isSelected ? 'scale-125 z-30' : 'hover:scale-110'}`}
            style={{ left: `${pos.point.x}%`, top: `${pos.point.y}%` }}
            aria-label={`Nhân viên ${pos.emp.name}, trạng thái ${pos.status}`}
            title={`${pos.emp.name} - ${pos.status}`}
          >
            <div 
              className={`w-5 h-5 rounded-full border-2 shadow-md flex items-center justify-center ${isSelected ? 'ring-4 ring-blue-300 ring-opacity-50' : ''}`}
              style={{ backgroundColor: color, borderColor: 'white' }}
            >
              {isRecommended && <span className="text-[10px] font-bold text-white leading-none">{recommendedEmployeeIds.indexOf(pos.emp.id) + 1}</span>}
            </div>
            {(isSelected || isRecommended) && (
              <span className="text-[11px] font-bold mt-1 px-1.5 py-0.5 bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                {pos.emp.name}
              </span>
            )}
          </button>
        );
      })}

      <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-sm border border-gray-200 text-xs flex flex-col gap-1.5 pointer-events-none z-10">
        <p className="font-semibold text-gray-800 mb-0.5">Chú giải trạng thái</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10b981]" /> Đang rảnh</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3b82f6]" /> Dự kiến di chuyển</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> Đang làm</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]" /> Bị trễ</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#9ca3af]" /> Nghỉ</div>
        <div className="mt-1.5 pt-1.5 border-t border-gray-100">
          <p className="text-[10px] text-gray-500 italic max-w-[150px] leading-tight">Vị trí nhân viên được ước tính theo đơn gần nhất, không phải GPS trực tiếp.</p>
        </div>
      </div>
    </div>
  );
}
