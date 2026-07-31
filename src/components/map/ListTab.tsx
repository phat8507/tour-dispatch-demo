import { Employee, Order, Assignment, Location } from "@/types";
import { getEmployeeRealtimeStatus } from "@/domain/realtime-status";

interface ListTabProps {
  employees: Employee[];
  assignments: Assignment[];
  orders: Order[];
  locations: Location[];
  currentTime: string;
}

export function ListTab({ employees, assignments, orders, locations, currentTime }: ListTabProps) {
  return (
    <div className="p-5 bg-white h-full min-h-[600px] rounded-xl shadow-sm border border-border overflow-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân viên</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vị trí hiện tại</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khách hàng</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian dự kiến</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map(emp => {
            const status = getEmployeeRealtimeStatus(emp, assignments, currentTime);
            const activeAssignment = status.activeAssignment || status.nextAssignment;
            const order = activeAssignment ? orders.find(o => o.id === activeAssignment.orderId) : null;
            const location = order ? locations.find(l => l.id === order.locationId) : null;
            
            return (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                  <div className="text-sm text-gray-500">{emp.branchId}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {status.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {location ? location.name : "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order ? order.customerName : "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {activeAssignment ? (
                    <div>
                      <div>{new Date(activeAssignment.startTime).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })} - {new Date(activeAssignment.endTime).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</div>
                      {status.countdownMinutes !== undefined && (
                        <div className={`text-xs ${status.countdownMinutes < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {status.countdownMinutes < 0 ? `Trễ ${Math.abs(status.countdownMinutes)} phút` : `Còn ${status.countdownMinutes} phút`}
                        </div>
                      )}
                    </div>
                  ) : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
