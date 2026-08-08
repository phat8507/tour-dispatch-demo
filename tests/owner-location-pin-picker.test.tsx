/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Location = { lat: number; lng: number };
type Handler = (event?: { lngLat: Location }) => void;

const maplibre = vi.hoisted(() => ({ maps: [] as Array<{ handlers: Record<string, Handler>; remove: ReturnType<typeof vi.fn> }>, markers: [] as Array<{ handlers: Record<string, Handler>; location: Location; remove: ReturnType<typeof vi.fn> }> }));

vi.mock("maplibre-gl", () => ({
  Map: class {
    handlers: Record<string, Handler> = {};
    remove = vi.fn();
    constructor() { maplibre.maps.push(this); }
    on(event: string, handler: Handler) { this.handlers[event] = handler; return this; }
  },
  Marker: class {
    handlers: Record<string, Handler> = {};
    location: Location = { lat: 0, lng: 0 };
    remove = vi.fn();
    constructor() { maplibre.markers.push(this); }
    setLngLat([lng, lat]: [number, number]) { this.location = { lat, lng }; return this; }
    addTo() { return this; }
    on(event: string, handler: Handler) { this.handlers[event] = handler; return this; }
    getLngLat() { return this.location; }
  },
}));

import { OwnerLocationPinPicker } from "@/app/owner/OwnerLocationPinPicker";

describe("owner location pin picker", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    maplibre.maps.length = 0;
    maplibre.markers.length = 0;
  });

  it("keeps confirmation disabled until a map point is selected", () => {
    vi.stubEnv("NEXT_PUBLIC_TOMTOM_MAPS_API_KEY", "test-key");
    render(<OwnerLocationPinPicker open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Xác nhận vị trí" }).hasAttribute("disabled")).toBe(true);
  });

  it("uses the latest map click and confirms its latitude and longitude", () => {
    vi.stubEnv("NEXT_PUBLIC_TOMTOM_MAPS_API_KEY", "test-key");
    const onConfirm = vi.fn();
    render(<OwnerLocationPinPicker open onConfirm={onConfirm} onCancel={vi.fn()} />);
    act(() => {
      maplibre.maps[0].handlers.click({ lngLat: { lat: 10.7, lng: 106.6 } });
      maplibre.maps[0].handlers.click({ lngLat: { lat: 10.8, lng: 106.7 } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vị trí" }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 10.8, lon: 106.7 });
  });

  it("updates the selected point when the marker is dragged", () => {
    vi.stubEnv("NEXT_PUBLIC_TOMTOM_MAPS_API_KEY", "test-key");
    const onConfirm = vi.fn();
    render(<OwnerLocationPinPicker open onConfirm={onConfirm} onCancel={vi.fn()} />);
    act(() => maplibre.maps[0].handlers.click({ lngLat: { lat: 10.7, lng: 106.6 } }));
    const marker = maplibre.markers.at(-1)!;
    marker.location = { lat: 10.75, lng: 106.65 };
    act(() => marker.handlers.dragend());
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vị trí" }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 10.75, lon: 106.65 });
  });
});
