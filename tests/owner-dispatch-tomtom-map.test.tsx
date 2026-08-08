/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";

const mapSpies = vi.hoisted(() => ({
  maps: [] as Array<{ handlers: Map<string, () => void>; remove: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; isStyleLoaded: ReturnType<typeof vi.fn>; options: { style?: string } }> ,
  markers: [] as Array<{ remove: ReturnType<typeof vi.fn> }> ,
}));

vi.mock("maplibre-gl", () => {
  class Map {
    handlers = new globalThis.Map<string, () => void>();
    remove = vi.fn();
    resize = vi.fn();
    isStyleLoaded = vi.fn(() => true);
    options: { style?: string };
    constructor(...args: unknown[]) { this.options = args[0] as { style?: string }; mapSpies.maps.push(this); }
    addControl = vi.fn();
    on = vi.fn((name: string, callback: () => void) => this.handlers.set(name, callback));
    off = vi.fn((name: string) => this.handlers.delete(name));
  }
  class Marker {
    remove = vi.fn();
    constructor(...args: unknown[]) { void args; mapSpies.markers.push(this); }
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
  }
  class NavigationControl {}
  return { Map, Marker, NavigationControl };
});

import { OwnerDispatchTomTomMap } from "@/features/dispatch/OwnerDispatchTomTomMap";

const emptyModel: OwnerDispatchMapModel = {
  tours: [], warnings: [], tourMarkers: [],
  branchMarkers: [
    { id: "cs1", branchId: "CS1", name: "Cơ sở 1", address: "A", latitude: 10, longitude: 106 },
    { id: "cs2", branchId: "CS2", name: "Cơ sở 2", address: "B", latitude: 10.1, longitude: 106.1 },
  ],
};

function tourModel(customerName = "Khách mới"): OwnerDispatchMapModel {
  return { ...emptyModel, tourMarkers: [{ id: "tour", customerName, status: "PENDING", requestedAt: "2026-08-09T08:00:00Z", latitude: 10.2, longitude: 106.2, locationName: "Nhà khách", address: "C", markerState: "UNASSIGNED", assignments: [] }] };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TOMTOM_MAPS_API_KEY", "test-key");
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  mapSpies.maps.length = 0;
  mapSpies.markers.length = 0;
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("OwnerDispatchTomTomMap lifecycle", () => {
  it("creates one TomTom map and keeps CS1/CS2 markers for an empty day", () => {
    render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(mapSpies.maps).toHaveLength(1);
    expect(mapSpies.markers).toHaveLength(2);
  });

  it("initializes the TomTom base style once, independently of dispatch data", () => {
    render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(mapSpies.maps[0].options.style).toContain("api.tomtom.com/style");
    expect(mapSpies.maps).toHaveLength(1);
  });

  it("does not recreate or remove the map when the date model changes", () => {
    const view = render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    const map = mapSpies.maps[0];
    view.rerender(<OwnerDispatchTomTomMap model={tourModel()} selectedTourId={null} onSelectTour={vi.fn()} />);
    view.rerender(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(mapSpies.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
    expect(map.resize).toHaveBeenCalled();
  });

  it("replaces operational markers while retaining branch markers after repeated date switches", () => {
    const view = render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    view.rerender(<OwnerDispatchTomTomMap model={tourModel()} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(mapSpies.markers).toHaveLength(5);
    view.rerender(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    expect(mapSpies.markers).toHaveLength(7);
    expect(mapSpies.markers.filter((marker) => marker.remove.mock.calls.length === 0)).toHaveLength(2);
  });

  it("waits for a style load before rendering markers", () => {
    render(<OwnerDispatchTomTomMap model={tourModel()} selectedTourId={null} onSelectTour={vi.fn()} />);
    const map = mapSpies.maps[0];
    map.isStyleLoaded.mockReturnValueOnce(false);
    map.handlers.get("load")?.();
    expect(map.resize).toHaveBeenCalled();
  });

  it("shows one safe warning for a basemap error", () => {
    render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    act(() => mapSpies.maps[0].handlers.get("error")?.());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a warning when MapLibre reports a style or tile error", () => {
    render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    const error = mapSpies.maps[0].handlers.get("error") as unknown as (event: { error: { message: string } }) => void;
    act(() => error({ error: { message: "style failed" } }));
    expect(screen.getByRole("alert").textContent).toContain("Không thể tải nền bản đồ");
  });

  it("deduplicates repeated basemap errors into one warning", () => {
    render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    const error = mapSpies.maps[0].handlers.get("error") as unknown as (event: { sourceId: string }) => void;
    act(() => { error({ sourceId: "tomtom" }); error({ sourceId: "tomtom" }); });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("removes the map only when unmounted", () => {
    const view = render(<OwnerDispatchTomTomMap model={emptyModel} selectedTourId={null} onSelectTour={vi.fn()} />);
    const map = mapSpies.maps[0];
    view.unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
