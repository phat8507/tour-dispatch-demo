"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { OwnerDispatchMapModel } from "./owner-dispatch-map-model";

const defaultCenter: [number, number] = [106.7, 10.78];

function tomTomStyle(key: string): string {
  void key;
  return "https://api.tomtom.com/maps/orbis/assets/styles/0.0.0-0/style?map=basic_street-light";
}

function tomTomRequest(url: string, key: string): maplibregl.RequestParameters {
  const parsed = new URL(url);
  if (parsed.hostname !== "api.tomtom.com") return { url };
  return {
    url,
    headers: {
      "TomTom-Api-Key": key,
      "TomTom-Api-Version": parsed.pathname.includes("/assets/") ? "1" : "2",
    },
  };
}

type Props = {
  model: OwnerDispatchMapModel;
  selectedTourId: string | null;
  onSelectTour: (id: string) => void;
};

export function OwnerDispatchTomTomMap({ model, selectedTourId, onSelectTour }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const modelRef = useRef(model);
  const selectedTourIdRef = useRef(selectedTourId);
  const onSelectTourRef = useRef(onSelectTour);
  const [basemapFailed, setBasemapFailed] = useState(false);

  useEffect(() => {
    modelRef.current = model;
    selectedTourIdRef.current = selectedTourId;
    onSelectTourRef.current = onSelectTour;
  }, [model, onSelectTour, selectedTourId]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  }, []);

  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    clearMarkers();
    const addMarker = (longitude: number, latitude: number, label: string, color: string, tourId?: string) => {
      const element = document.createElement("button");
      element.type = "button";
      element.title = label;
      element.setAttribute("aria-label", label);
      element.style.cssText = `width:18px;height:18px;border-radius:999px;border:3px solid white;background:${color};box-shadow:0 1px 5px #334155`;
      if (tourId) element.onclick = () => onSelectTourRef.current(tourId);
      markersRef.current.push(new maplibregl.Marker({ element }).setLngLat([longitude, latitude]).addTo(map));
    };

    modelRef.current.branchMarkers.forEach((branch) =>
      addMarker(branch.longitude, branch.latitude, `${branch.branchId}: ${branch.name}`, "#16a34a"),
    );
    modelRef.current.tourMarkers.forEach((tour) =>
      addMarker(
        tour.longitude,
        tour.latitude,
        tour.customerName,
        tour.id === selectedTourIdRef.current ? "#1d4ed8" : tour.markerState === "UNASSIGNED" ? "#dc2626" : "#64748b",
        tour.id,
      ),
    );
  }, [clearMarkers]);

  useEffect(() => {
    const container = containerRef.current;
    const key = process.env.NEXT_PUBLIC_TOMTOM_MAPS_API_KEY;
    if (!container || !key || mapRef.current) return;

    let active = true;
    const map = new maplibregl.Map({ container, style: tomTomStyle(key), center: defaultCenter, zoom: 10, transformRequest: (url) => tomTomRequest(url, key) });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl());

    const onLoad = () => {
      if (!active || mapRef.current !== map) return;
      setBasemapFailed(false);
      renderMarkers();
      map.resize();
    };
    const onError = (event?: { error?: { message?: string }; sourceId?: string }) => {
      if (!active || mapRef.current !== map) return;
      // MapLibre deliberately omits request URLs here so an authenticated TomTom URL is never exposed.
      if (event?.error?.message || event?.sourceId) setBasemapFailed(true);
    };
    const observer = new ResizeObserver(() => {
      if (active && mapRef.current === map) map.resize();
    });

    map.on("load", onLoad);
    map.on("error", onError);
    observer.observe(container);
    return () => {
      active = false;
      observer.disconnect();
      map.off("load", onLoad);
      map.off("error", onError);
      clearMarkers();
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [clearMarkers, renderMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) renderMarkers();
    map.resize();
  }, [model, selectedTourId, renderMarkers]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {basemapFailed && <p role="alert" className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Không thể tải nền bản đồ. Vui lòng thử lại.</p>}
      <div ref={containerRef} className="h-[60dvh] w-full lg:h-[calc(100dvh-14rem)] lg:min-h-[34rem]" />
    </div>
  );
}
