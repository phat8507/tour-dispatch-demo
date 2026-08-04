/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnerDispatchTour } from "@/server/owner-dispatch-read-model";

vi.mock("@/features/dispatch/OwnerDispatchMap", () => ({
  OwnerDispatchMap: ({ selectedTourId, onSelectTour }: { selectedTourId: string | null; onSelectTour: (id: string) => void }) => (
    <div data-testid="map-selection">
      {selectedTourId ?? "none"}
      <button onClick={() => onSelectTour("tour-two")}>Chon marker tour hai</button>
    </div>
  ),
}));
vi.mock("@/app/owner/OwnerDispatchForm", () => ({
  OwnerDispatchForm: () => <div data-testid="assignment-controls">Assignment controls</div>,
}));

import { OwnerDispatchDashboard } from "@/features/dispatch/OwnerDispatchDashboard";

function tour(id: string, customerName: string, latitude = 10): OwnerDispatchTour {
  return {
    id,
    customerName,
    customerPhone: null,
    requestedAt: "2030-01-01T08:00:00Z",
    orderType: "NEW_TOUR",
    urgency: "PREBOOKED",
    status: "PENDING",
    notes: "",
    location: { id: `${id}-location`, name: "Dia diem", address: "Dia chi", latitude, longitude: 106 },
    services: [],
    assignments: [],
    orderVersion: "version",
  };
}

describe("owner dispatch dashboard", () => {
  afterEach(cleanup);

  it("synchronizes list and marker selection while retaining assignment controls", () => {
    const tours = [tour("tour-one", "Khach mot"), tour("tour-two", "Khach hai")];
    render(
      <OwnerDispatchDashboard
        tours={tours}
        recommendations={[[], []]}
        mapModel={{ tours, tourMarkers: [], branchMarkers: [], warnings: [] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Khach mot/ }));
    expect(screen.getByTestId("map-selection").textContent).toContain("tour-one");
    fireEvent.click(screen.getByRole("button", { name: "Chon marker tour hai" }));
    expect(screen.getByRole("button", { name: /Khach hai/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getAllByTestId("assignment-controls")).toHaveLength(2);
  });

  it("keeps invalid-coordinate tours visible and shows safe map warnings", () => {
    const invalidTour = tour("invalid-tour", "Khach khong toa do", 91);
    render(
      <OwnerDispatchDashboard
        tours={[invalidTour]}
        recommendations={[[]]}
        mapModel={{ tours: [invalidTour], tourMarkers: [], branchMarkers: [], warnings: ["Khong the hien thi marker cho Khach khong toa do."] }}
      />,
    );
    expect(screen.getByRole("button", { name: /Khach khong toa do/ })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Khach khong toa do");
  });

  it("renders an empty durable state without mock fallback", () => {
    render(
      <OwnerDispatchDashboard
        tours={[]}
        recommendations={[]}
        mapModel={{ tours: [], tourMarkers: [], branchMarkers: [], warnings: [] }}
      />,
    );
    expect(screen.getByText("Chưa có tour cần điều phối.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Customer 1");
  });

  it("projects persisted assignment and override data again after a route reload", () => {
    const initialTour = tour("canonical-tour", "Khach canonical");
    const { rerender } = render(
      <OwnerDispatchDashboard
        tours={[initialTour]}
        recommendations={[[]]}
        mapModel={{ tours: [initialTour], tourMarkers: [], branchMarkers: [], warnings: [] }}
      />,
    );
    expect(screen.getByText("Chưa phân công")).toBeTruthy();

    const persistedTour = {
      ...initialTour,
      assignments: [{ id: "persisted", employeeId: "employee", employeeName: "Nhan vien persisted", startsAt: "start", endsAt: "end", status: "SCHEDULED", isOverride: true, overrideReason: "Ly do persisted" }],
    };
    rerender(
      <OwnerDispatchDashboard
        tours={[persistedTour]}
        recommendations={[[]]}
        mapModel={{ tours: [persistedTour], tourMarkers: [], branchMarkers: [], warnings: [] }}
      />,
    );
    expect(screen.getByText("Nhan vien persisted (SCHEDULED) | Ghi đè: Ly do persisted")).toBeTruthy();
  });
});
