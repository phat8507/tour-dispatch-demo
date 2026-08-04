import {
  mockAssignments,
  mockEmployees,
  mockLocations,
  mockOrders,
  mockServices,
} from "@/data/mockData";
import { DemoDispatchDashboard } from "@/features/dispatch/DemoDispatchDashboard";

export default function DashboardPage() {
  return (
    <DemoDispatchDashboard
      employees={mockEmployees}
      assignments={mockAssignments}
      orders={mockOrders}
      services={mockServices}
      locations={mockLocations}
    />
  );
}
