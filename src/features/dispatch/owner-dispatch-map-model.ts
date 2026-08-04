import type { OwnerDispatchBranch, OwnerDispatchTour } from "./owner-dispatch-view-model";

export type OwnerDispatchMapMarkerState =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "HISTORY_ONLY";

export type OwnerDispatchMapTour = {
  id: string;
  customerName: string;
  status: string;
  requestedAt: string;
  latitude: number;
  longitude: number;
  locationName: string;
  address: string;
  markerState: OwnerDispatchMapMarkerState;
  assignments: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    status: string;
    isOverride: boolean;
    overrideReason: string | null;
  }>;
};

export type OwnerDispatchMapBranch = OwnerDispatchBranch;

export type OwnerDispatchMapModel = {
  tours: OwnerDispatchTour[];
  tourMarkers: OwnerDispatchMapTour[];
  branchMarkers: OwnerDispatchMapBranch[];
  warnings: string[];
};

export type OwnerDispatchMarkerPosition = {
  latitude: number;
  longitude: number;
  pixelOffsetX: number;
  pixelOffsetY: number;
};

const ACTIVE_ASSIGNMENT_STATUSES = new Set([
  "SCHEDULED",
  "IN_PROGRESS",
  "DELAYED",
]);

function hasValidCoordinates(location: {
  latitude: number;
  longitude: number;
}): boolean {
  return (
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function markerState(
  assignments: OwnerDispatchTour["assignments"],
): OwnerDispatchMapMarkerState {
  if (assignments.length === 0) return "UNASSIGNED";
  return assignments.some((assignment) =>
    ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status),
  )
    ? "ASSIGNED"
    : "HISTORY_ONLY";
}

export function buildOwnerDispatchMapModel(
  tours: OwnerDispatchTour[],
  branches: OwnerDispatchBranch[],
): OwnerDispatchMapModel {
  const warnings: string[] = [];
  const tourMarkers = tours.flatMap((tour): OwnerDispatchMapTour[] => {
    if (!hasValidCoordinates(tour.location)) {
      warnings.push(
        `Không thể hiển thị marker cho ${tour.customerName} vì tọa độ không hợp lệ.`,
      );
      return [];
    }
    return [
      {
        id: tour.id,
        customerName: tour.customerName,
        status: tour.status,
        requestedAt: tour.requestedAt,
        latitude: tour.location.latitude,
        longitude: tour.location.longitude,
        locationName: tour.location.name,
        address: tour.location.address,
        markerState: markerState(tour.assignments),
        assignments: tour.assignments.map((assignment) => ({
          id: assignment.id,
          employeeId: assignment.employeeId,
          employeeName: assignment.employeeName,
          status: assignment.status,
          isOverride: assignment.isOverride,
          overrideReason: assignment.overrideReason,
        })),
      },
    ];
  });

  const branchMarkers = branches.filter((branch) => {
    if (hasValidCoordinates(branch)) return true;
    warnings.push(
      `Không thể hiển thị marker cho ${branch.branchId} vì tọa độ không hợp lệ.`,
    );
    return false;
  });
  const availableBranchIds = new Set(
    branchMarkers.map((branch) => branch.branchId),
  );
  for (const branchId of ["CS1", "CS2"] as const) {
    if (!availableBranchIds.has(branchId)) {
      warnings.push(`Chưa có tọa độ cơ sở ${branchId} trong dữ liệu bền vững.`);
    }
  }

  return { tours, tourMarkers, branchMarkers, warnings };
}

export function getOwnerDispatchMarkerPositions(
  markers: OwnerDispatchMapTour[],
): Map<string, OwnerDispatchMarkerPosition> {
  const groups = new Map<string, OwnerDispatchMapTour[]>();
  for (const marker of markers) {
    const key = `${marker.latitude},${marker.longitude}`;
    groups.set(key, [...(groups.get(key) ?? []), marker]);
  }

  const positions = new Map<string, OwnerDispatchMarkerPosition>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      positions.set(group[0].id, {
        latitude: group[0].latitude,
        longitude: group[0].longitude,
        pixelOffsetX: 0,
        pixelOffsetY: 0,
      });
      continue;
    }
    group.forEach((marker, index) => {
      const angle = (index / group.length) * Math.PI * 2;
      const offset = 28;
      positions.set(marker.id, {
        latitude: marker.latitude,
        longitude: marker.longitude,
        pixelOffsetX: Math.cos(angle) * offset,
        pixelOffsetY: Math.sin(angle) * offset,
      });
    });
  }
  return positions;
}
