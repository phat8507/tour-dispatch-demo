/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";

const mapSpies = vi.hoisted(() => ({
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  openPopup: vi.fn(),
}));

vi.mock("leaflet", () => ({ divIcon: (options: { className: string }) => options }));
vi.mock("react-leaflet", async () => {
  const React = await import("react");
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="tile-container">{children}</div>,
    TileLayer: ({ attribution, eventHandlers }: { attribution: string; eventHandlers: { tileerror: () => void } }) => <div><span dangerouslySetInnerHTML={{ __html: attribution }} /><button onClick={eventHandlers.tileerror}>Fail tiles</button></div>,
    CircleMarker: ({ children }: { children: ReactNode }) => <div data-testid="branch-marker">{children}</div>,
    Marker: React.forwardRef(function MockMarker({ children, alt, icon, eventHandlers }: { children: ReactNode; alt: string; icon: { className: string }; eventHandlers: { click: () => void } }, ref) {
      React.useImperativeHandle(ref, () => ({ openPopup: mapSpies.openPopup }));
      return <button aria-label={alt} data-icon-class={icon.className} onClick={eventHandlers.click}>{children}</button>;
    }),
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    useMap: () => ({ flyTo: mapSpies.flyTo, fitBounds: mapSpies.fitBounds, getZoom: () => 12 }),
  };
});

import { OwnerDispatchLeafletMap } from "@/features/dispatch/OwnerDispatchLeafletMap";

const model: OwnerDispatchMapModel = {
  tours: [],
  warnings: [],
  branchMarkers: [{ id: "branch", branchId: "CS1", name: "Co so 1", address: "Branch address", latitude: 10, longitude: 106 }],
  tourMarkers: [
    {
      id: "assigned",
      customerName: "Khach da phan",
      status: "ASSIGNED",
      requestedAt: "2030-01-01T08:00:00Z",
      latitude: 10.1,
      longitude: 106.1,
      locationName: "Quan 1",
      address: "Tour address",
      markerState: "ASSIGNED",
      assignments: [
        { id: "a1", employeeId: "e1", employeeName: "Nhan vien mot", status: "SCHEDULED", isOverride: false, overrideReason: null },
        { id: "a2", employeeId: "e2", employeeName: "Nhan vien hai", status: "DELAYED", isOverride: true, overrideReason: "Chu xac nhan" },
      ],
    },
    {
      id: "unassigned",
      customerName: "Khach chua phan",
      status: "PENDING",
      requestedAt: "2030-01-01T09:00:00Z",
      latitude: 10.2,
      longitude: 106.2,
      locationName: "Quan 2",
      address: "Second address",
      markerState: "UNASSIGNED",
      assignments: [],
    },
  ],
};

describe("owner dispatch Leaflet map", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders durable branch and visually distinct accessible tour markers", () => {
    render(<OwnerDispatchLeafletMap model={model} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(screen.getByTestId("branch-marker")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Khach da phan, ASSIGNED" }).getAttribute("data-icon-class")).toContain("assigned");
    expect(screen.getByRole("button", { name: "Khach chua phan, UNASSIGNED" }).getAttribute("data-icon-class")).toContain("unassigned");
  });

  it("renders customer, address, all employees, override reason, and permanent OSM attribution", () => {
    render(<OwnerDispatchLeafletMap model={model} selectedTourId="assigned" onSelectTour={vi.fn()} />);
    for (const text of ["Khach da phan", "Tour address", "Nhan vien mot, Nhan vien hai", "Ghi đè: Chu xac nhan", "OpenStreetMap"]) {
      expect(screen.getByText(text, { exact: false })).toBeTruthy();
    }
    expect(mapSpies.openPopup).toHaveBeenCalled();
    expect(mapSpies.flyTo).toHaveBeenCalledWith([10.1, 106.1], 14);
  });

  it("selects a tour from its marker", () => {
    const onSelectTour = vi.fn();
    render(<OwnerDispatchLeafletMap model={model} selectedTourId={null} onSelectTour={onSelectTour} />);
    fireEvent.click(screen.getByRole("button", { name: "Khach chua phan, UNASSIGNED" }));
    expect(onSelectTour).toHaveBeenCalledWith("unassigned");
  });

  it("shows a safe tile warning without removing marker content", () => {
    render(<OwnerDispatchLeafletMap model={model} selectedTourId={null} onSelectTour={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fail tiles" }));
    expect(screen.getByRole("status").textContent).toContain("Danh sách tour và dữ liệu phân công vẫn khả dụng");
    expect(screen.getByRole("button", { name: "Khach da phan, ASSIGNED" })).toBeTruthy();
  });
});
