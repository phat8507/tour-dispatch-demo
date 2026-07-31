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
import { Assignment } from "@/types";

export default function DashboardPage() {
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Use fixed DEMO_TIME — never the current system time.
  const demoTime = DEMO_TIME;

  const summary = getDashboardSummary(
    mockEmployees,
    mockAssignments,
    mockOrders,
    demoTime,
  );

  function handleAssignmentClick(assignment: Assignment) {
    setSelectedAssignment(assignment);
    setSheetOpen(true);
  }

  function handleReset() {
    setSelectedAssignment(null);
    setSheetOpen(false);
    // Data is static; resetting state is sufficient for the demo.
  }

  const selectedOrder = selectedAssignment
    ? mockOrders.find((o) => o.id === selectedAssignment.orderId) ?? null
    : null;

  const selectedEmployee = selectedAssignment
    ? mockEmployees.find((e) => e.id === selectedAssignment.employeeId) ?? null
    : null;

  const selectedLocation = selectedOrder
    ? mockLocations.find((l) => l.id === selectedOrder.locationId) ?? null
    : null;

  const selectedService = selectedOrder
    ? mockServices.find((s) => s.id === selectedOrder.serviceId) ?? null
    : null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      <DashboardHeader demoTime={demoTime} onReset={handleReset} />

      <SummaryCards summary={summary} />

      <DailyTimeline
        employees={mockEmployees}
        assignments={mockAssignments}
        orders={mockOrders}
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
        service={selectedService}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
