"use client";

import { Assignment, Employee, Location, Order, Service } from "@/types";
import { getTimelineOffsetPercentage, getTimelineWidthPercentage, ASSIGNMENT_STATUS_LABEL, PERFORMANCE_LEVEL_LABEL, BRANCH_LABEL, formatTimeHHMM, TIMELINE_START_HOUR, TIMELINE_END_HOUR } from "@/domain/timeline";
import { getAssignmentDisplayStatus as calcStatus } from "@/domain/demo-status";
import { Badge } from "@/components/ui/badge";
import { BedDouble } from "lucide-react";

interface TimelineProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  services: Service[];
  locations: Location[];
  demoTime: string;
  onAssignmentClick: (assignment: Assignment) => void;
}

const ASSIGNMENT_STATUS_COLORS: Record<Assignment["status"], string> = {
  SCHEDULED: "bg-sky-200 border-sky-400 text-sky-900",
  IN_PROGRESS: "bg-emerald-200 border-emerald-400 text-emerald-900",
  COMPLETED: "bg-gray-200 border-gray-400 text-gray-700",
  DELAYED: "bg-red-200 border-red-500 text-red-900",
};

const HOUR_LABELS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => `${(TIMELINE_START_HOUR + i).toString().padStart(2, "0")}:00`,
);

interface AssignmentBlockProps {
  assignment: Assignment;
  order: Order | undefined;
  location: Location | undefined;
  service: Service | undefined;
  demoTime: string;
  onClick: () => void;
}

function AssignmentBlock({ assignment, order, location, service, demoTime, onClick }: AssignmentBlockProps) {
  const displayStatus = calcStatus(assignment, demoTime);
  const colorClass = ASSIGNMENT_STATUS_COLORS[displayStatus];
  const left = getTimelineOffsetPercentage(assignment.startTime);
  const width = getTimelineWidthPercentage(assignment.startTime, assignment.endTime);

  if (width <= 0) return null;

  return (
    <button
      id={`assignment-block-${assignment.id}`}
      onClick={onClick}
      title={`${order?.customerName ?? "?"} — ${ASSIGNMENT_STATUS_LABEL[displayStatus]}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      className={`absolute top-1 bottom-1 rounded border ${colorClass} px-1.5 text-left overflow-hidden cursor-pointer hover:brightness-95 hover:ring-2 hover:ring-offset-1 hover:ring-current transition-all duration-100 min-w-[2rem]`}
    >
      <div className="flex flex-col gap-0 leading-tight truncate">
        <span className="text-xs font-semibold truncate">{order?.customerName ?? assignment.orderId}</span>
        <span className="text-[10px] opacity-75 truncate">{location?.name ?? ""}</span>
        <span className="text-[10px] opacity-75">{formatTimeHHMM(assignment.startTime)}–{formatTimeHHMM(assignment.endTime)}</span>
        {service && <span className="text-[10px] opacity-75 truncate">{service.name}</span>}
      </div>
    </button>
  );
}

export function DailyTimeline({
  employees,
  assignments,
  orders,
  services,
  locations,
  demoTime,
  onAssignmentClick,
}: TimelineProps) {
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const locationMap = new Map(locations.map((l) => [l.id, l]));

  const EMPLOYEE_COL_W = 180; // px - fixed left column

  return (
    <div className="flex-1 overflow-hidden border border-border rounded-xl mx-5 mb-5 bg-white shadow-sm">
      {/* Sticky header row with hour labels */}
      <div className="flex border-b border-border bg-gray-50 sticky top-0 z-10">
        {/* Employee column */}
        <div
          className="shrink-0 border-r border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
          style={{ width: EMPLOYEE_COL_W }}
        >
          Nhân viên
        </div>
        {/* Hour labels – scrollable together with timeline */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ minWidth: 900 }}>
            <div className="flex">
              {HOUR_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex-1 border-r border-dashed border-gray-200 text-[10px] text-muted-foreground py-2 pl-1 select-none"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Employee rows */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 900 + EMPLOYEE_COL_W }}>
          {employees.map((emp) => {
            const empAssignments = assignments.filter((a) => a.employeeId === emp.id);

            return (
              <div
                key={emp.id}
                id={`employee-row-${emp.id}`}
                className="flex border-b border-border last:border-b-0"
              >
                {/* Fixed employee info cell */}
                <div
                  className="shrink-0 flex flex-col justify-center gap-0.5 border-r border-border px-3 py-2 bg-white"
                  style={{ width: EMPLOYEE_COL_W }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{emp.name}</span>
                    {emp.isOff && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 bg-red-100 text-red-600 border-red-200 shrink-0"
                      >
                        Nghỉ
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {BRANCH_LABEL[emp.branchId]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {PERFORMANCE_LEVEL_LABEL[emp.performanceLevel]}
                    </span>
                  </div>
                </div>

                {/* Timeline row */}
                <div className="flex-1 relative" style={{ minWidth: 900 }}>
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {HOUR_LABELS.map((label) => (
                      <div key={label} className="flex-1 border-r border-dashed border-gray-100" />
                    ))}
                  </div>

                  {/* Current time indicator */}
                  {(() => {
                    const nowPct = getTimelineOffsetPercentage(demoTime);
                    if (nowPct <= 0 || nowPct >= 100) return null;
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                        style={{ left: `${nowPct}%` }}
                        aria-hidden="true"
                      />
                    );
                  })()}

                  {/* Off state */}
                  {emp.isOff ? (
                    <div className="absolute inset-0 flex items-center px-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <BedDouble className="h-4 w-4 shrink-0" />
                        <span>Nghỉ hôm nay</span>
                      </div>
                    </div>
                  ) : (
                    /* Assignment blocks */
                    empAssignments.map((assign) => {
                      const order = orderMap.get(assign.orderId);
                      const service = order ? serviceMap.get(order.serviceId) : undefined;
                      const location = order ? locationMap.get(order.locationId) : undefined;
                      return (
                        <AssignmentBlock
                          key={assign.id}
                          assignment={assign}
                          order={order}
                          service={service}
                          location={location}
                          demoTime={demoTime}
                          onClick={() => onAssignmentClick(assign)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
