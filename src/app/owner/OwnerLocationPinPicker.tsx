"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type OwnerLocationPinPickerProps = {
  open: boolean;
  initialLocation?: { lat: number; lon: number } | null;
  onConfirm: (location: { lat: number; lon: number }) => void;
  onCancel: () => void;
};

const defaultCenter: [number, number] = [106.7, 10.78];

export function OwnerLocationPinPicker({ open, initialLocation, onConfirm, onCancel }: OwnerLocationPinPickerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(initialLocation ?? null);

  useEffect(() => {
    if (!open || !host.current) return;

    const key = process.env.NEXT_PUBLIC_TOMTOM_MAPS_API_KEY;
    if (!key) return;

    const map = new maplibregl.Map({
      container: host.current,
      style: `https://api.tomtom.com/style/2/custom/style/1/json?key=${encodeURIComponent(key)}`,
      center: initialLocation ? [initialLocation.lon, initialLocation.lat] : defaultCenter,
      zoom: 11,
    });
    let marker: maplibregl.Marker | undefined;

    const select = (location: { lat: number; lon: number }) => {
      setPoint(location);
      marker?.remove();
      marker = new maplibregl.Marker({ draggable: true, color: "#2563eb" })
        .setLngLat([location.lon, location.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const next = marker?.getLngLat();
        if (next) setPoint({ lat: next.lat, lon: next.lng });
      });
    };

    if (initialLocation) select(initialLocation);
    map.on("click", (event) => select({ lat: event.lngLat.lat, lon: event.lngLat.lng }));

    return () => map.remove();
  }, [initialLocation, open]);

  if (!open) return null;

  return (
    <section aria-label="Chọn vị trí trên bản đồ" className="mt-2 rounded-lg border border-slate-200 p-3">
      <div ref={host} className="h-64 w-full" />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel}>Hủy</button>
        <button type="button" disabled={!point} onClick={() => point && onConfirm(point)}>Xác nhận vị trí</button>
      </div>
    </section>
  );
}
