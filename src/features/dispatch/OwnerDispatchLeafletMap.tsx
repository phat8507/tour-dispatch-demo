"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon } from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type {
  OwnerDispatchMapModel,
  OwnerDispatchMapTour,
} from "./owner-dispatch-map-model";
import { getOwnerDispatchMarkerPositions } from "./owner-dispatch-map-model";

const DEFAULT_CENTER: [number, number] = [16, 106];

const TOUR_COLORS = {
  UNASSIGNED: "#dc2626",
  ASSIGNED: "#2563eb",
  HISTORY_ONLY: "#64748b",
} as const;

function MapViewport({
  model,
  selectedTourId,
  tourPositions,
}: {
  model: OwnerDispatchMapModel;
  selectedTourId: string | null;
  tourPositions: ReturnType<typeof getOwnerDispatchMarkerPositions>;
}) {
  const map = useMap();
  useEffect(() => {
    const selected = model.tourMarkers.find((tour) => tour.id === selectedTourId);
    if (selected) {
      const position = tourPositions.get(selected.id) ?? selected;
      map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 14));
      return;
    }
    const points = [
      ...model.branchMarkers.map((branch) => [branch.latitude, branch.longitude] as [number, number]),
      ...model.tourMarkers.map((tour) => {
        const position = tourPositions.get(tour.id) ?? tour;
        return [position.latitude, position.longitude] as [number, number];
      }),
    ];
    if (points.length > 0) map.fitBounds(points, { padding: [32, 32], maxZoom: 14 });
  }, [map, model, selectedTourId, tourPositions]);
  return null;
}

function TourMarker({
  tour,
  selected,
  onSelect,
  position,
}: {
  tour: OwnerDispatchMapTour;
  selected: boolean;
  onSelect: () => void;
  position: { latitude: number; longitude: number; pixelOffsetX: number; pixelOffsetY: number };
}) {
  const markerRef = useRef<LeafletMarker | null>(null);
  useEffect(() => {
    if (selected) markerRef.current?.openPopup();
  }, [selected]);

  const employees = tour.assignments.map((assignment) => assignment.employeeName);
  const size = selected ? 24 : 18;
  const icon = divIcon({
    className: `owner-tour-marker owner-tour-marker-${tour.markerState.toLowerCase()}`,
    html: `<span aria-hidden="true" style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${TOUR_COLORS[tour.markerState]};border:${selected ? 4 : 2}px solid ${selected ? "#0f172a" : "#ffffff"};box-shadow:0 2px 8px rgb(15 23 42 / 0.28)"></span>`,
    iconSize: [size, size],
    iconAnchor: [
      size / 2 - position.pixelOffsetX,
      size / 2 - position.pixelOffsetY,
    ],
  });
  return (
    <Marker
      ref={markerRef}
      position={[position.latitude, position.longitude]}
      icon={icon}
      title={`${tour.customerName}, ${tour.markerState}`}
      alt={`${tour.customerName}, ${tour.markerState}`}
      keyboard
      eventHandlers={{ click: onSelect }}
    >
      <Popup>
        <div className="min-w-52 text-sm">
          <p className="font-semibold">{tour.customerName}</p>
          <p>{tour.locationName}</p>
          <p>{tour.address}</p>
          <p>{tour.requestedAt}</p>
          <p>Trạng thái: {tour.markerState}</p>
          <p>Nhân viên: {employees.join(", ") || "Chưa phân công"}</p>
          {tour.assignments
            .filter((assignment) => assignment.isOverride)
            .map((assignment) => (
              <p key={assignment.id}>
                Ghi đè: {assignment.overrideReason || "Không có lý do"}
              </p>
            ))}
        </div>
      </Popup>
    </Marker>
  );
}

export function OwnerDispatchLeafletMap({
  model,
  selectedTourId,
  onSelectTour,
}: {
  model: OwnerDispatchMapModel;
  selectedTourId: string | null;
  onSelectTour: (tourId: string) => void;
}) {
  const [tileFailed, setTileFailed] = useState(false);
  const tourPositions = useMemo(
    () => getOwnerDispatchMarkerPositions(model.tourMarkers),
    [model.tourMarkers],
  );
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {tileFailed && (
        <p
          role="status"
          className="absolute left-3 right-3 top-3 z-[1000] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm"
        >
          Không thể tải lớp nền bản đồ. Danh sách tour và dữ liệu phân công vẫn khả dụng.
        </p>
      )}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={6}
        scrollWheelZoom
        className="h-[60dvh] w-full lg:h-[calc(100dvh-14rem)] lg:min-h-[34rem]"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileFailed(true) }}
        />
        <MapViewport model={model} selectedTourId={selectedTourId} tourPositions={tourPositions} />
        {model.branchMarkers.map((branch) => (
          <CircleMarker
            key={branch.id}
            center={[branch.latitude, branch.longitude]}
            radius={10}
            pathOptions={{ color: "#166534", fillColor: "#22c55e", fillOpacity: 0.9, weight: 3 }}
          >
            <Popup>
              <p className="font-semibold">{branch.branchId}: {branch.name}</p>
              <p>{branch.address}</p>
            </Popup>
          </CircleMarker>
        ))}
        {model.tourMarkers.map((tour) => (
          <TourMarker
            key={tour.id}
            tour={tour}
            selected={selectedTourId === tour.id}
            onSelect={() => onSelectTour(tour.id)}
            position={tourPositions.get(tour.id) ?? { ...tour, pixelOffsetX: 0, pixelOffsetY: 0 }}
          />
        ))}
      </MapContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-600" aria-hidden="true" />Cơ sở</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-600" aria-hidden="true" />Đã phân</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-600" aria-hidden="true" />Chưa phân</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-500" aria-hidden="true" />Chỉ lịch sử</span>
      </div>
    </div>
  );
}
