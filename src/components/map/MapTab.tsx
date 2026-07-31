import { Employee, Order, Assignment, Location, Service } from "@/types";
import { RuntimeOverride } from "@/domain/effective-assignment";
import { OperationalMap } from "./OperationalMap";
import { EmployeeStatusPanel } from "./EmployeeStatusPanel";

export interface MapTabProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  locations: Location[];
  services: Service[];
  currentTime: string;
  onOverride: (assignmentId: string, override: RuntimeOverride) => void;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
  newCustomerLocationId?: string | null;
  recommendedEmployeeIds?: string[];
}

export function MapTab({
  employees,
  assignments,
  orders,
  locations,
  services,
  currentTime,
  onOverride,
  selectedEmployeeId,
  onSelectEmployee,
  newCustomerLocationId,
  recommendedEmployeeIds,
}: MapTabProps) {
  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 min-h-[600px]">
      <div className="flex-1 lg:w-2/3 h-[60vh] lg:h-auto min-h-[400px] bg-white rounded-xl shadow-sm border border-border relative overflow-hidden">
        <OperationalMap
          employees={employees}
          assignments={assignments}
          orders={orders}
          locations={locations}
          currentTime={currentTime}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={onSelectEmployee}
          newCustomerLocationId={newCustomerLocationId}
          recommendedEmployeeIds={recommendedEmployeeIds}
        />
      </div>
      <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-border flex flex-col overflow-hidden max-h-[80vh] lg:max-h-full">
        <EmployeeStatusPanel
          employees={employees}
          assignments={assignments}
          orders={orders}
          locations={locations}
          services={services}
          currentTime={currentTime}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={onSelectEmployee}
          onOverride={onOverride}
        />
      </div>
    </div>
  );
}
