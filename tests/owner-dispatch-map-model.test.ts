import { describe, expect, it } from "vitest";
import {
  buildOwnerDispatchMapModel,
  getOwnerDispatchMarkerPositions,
  type OwnerDispatchMapMarkerState,
} from "@/features/dispatch/owner-dispatch-map-model";
import type {
  OwnerDispatchBranch,
  OwnerDispatchTour,
} from "@/server/owner-dispatch-read-model";

const baseTour: OwnerDispatchTour = {
  id: "00000000-0000-4000-8000-000000000001",
  customerName: "Khach Ben",
  customerPhone: null,
  requestedAt: "2030-01-01T08:00:00Z",
  orderType: "NEW_TOUR",
  urgency: "PREBOOKED",
  status: "PENDING",
  notes: "",
  location: {
    id: "00000000-0000-4000-8000-000000000010",
    name: "Quan 1",
    address: "10 Nguyen Hue",
    latitude: 10.776,
    longitude: 106.7,
  },
  services: [],
  assignments: [],
  orderVersion: "2030-01-01T00:00:00.123456Z",
};

const branches: OwnerDispatchBranch[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    branchId: "CS1",
    name: "Co so 1",
    address: "Dia chi CS1",
    latitude: 10.75,
    longitude: 106.67,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    branchId: "CS2",
    name: "Co so 2",
    address: "Dia chi CS2",
    latitude: 10.8,
    longitude: 106.72,
  },
];

function assignment(status: string, overrides: Partial<OwnerDispatchTour["assignments"][number]> = {}): OwnerDispatchTour["assignments"][number] {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    employeeId: "00000000-0000-4000-8000-000000000301",
    employeeName: "Nhan vien mot",
    startsAt: "2030-01-01T08:00:00Z",
    endsAt: "2030-01-01T09:00:00Z",
    status,
    isOverride: false,
    overrideReason: null,
    ...overrides,
  };
}

describe("owner dispatch map model", () => {
  it("preserves durable UUIDs, customer coordinates, branch labels, employees, and persisted override data", () => {
    const tour = {
      ...baseTour,
      assignments: [
        assignment("SCHEDULED"),
        assignment("DELAYED", {
          id: "00000000-0000-4000-8000-000000000202",
          employeeName: "Nhan vien hai",
          isOverride: true,
          overrideReason: "Quyet dinh cua chu",
        }),
      ],
    };

    const model = buildOwnerDispatchMapModel([tour], branches);

    expect(model.tourMarkers[0]).toMatchObject({
      id: baseTour.id,
      latitude: 10.776,
      longitude: 106.7,
      markerState: "ASSIGNED",
    });
    expect(model.tourMarkers[0].assignments.map((item) => item.employeeName)).toEqual([
      "Nhan vien mot",
      "Nhan vien hai",
    ]);
    expect(model.tourMarkers[0].assignments[1]).toMatchObject({
      isOverride: true,
      overrideReason: "Quyet dinh cua chu",
    });
    expect(model.branchMarkers.map((branch) => branch.branchId)).toEqual(["CS1", "CS2"]);
    expect(model.warnings).toEqual([]);
  });

  it.each<[string, OwnerDispatchMapMarkerState]>([
    ["NONE", "UNASSIGNED"],
    ["SCHEDULED", "ASSIGNED"],
    ["IN_PROGRESS", "ASSIGNED"],
    ["DELAYED", "ASSIGNED"],
    ["COMPLETED", "HISTORY_ONLY"],
    ["CANCELLED", "HISTORY_ONLY"],
  ])("derives %s assignments as %s", (status, markerState) => {
    const assignments = status === "NONE" ? [] : [assignment(status)];
    const model = buildOwnerDispatchMapModel([{ ...baseTour, assignments }], branches);
    expect(model.tourMarkers[0].markerState).toBe(markerState);
  });

  it.each([
    ["latitude", 91],
    ["longitude", 181],
  ] as const)("keeps a tour in the list but omits its marker for invalid %s", (field, value) => {
    const invalidTour = {
      ...baseTour,
      location: { ...baseTour.location, [field]: value },
    };
    const model = buildOwnerDispatchMapModel([invalidTour], branches);
    expect(model.tours).toEqual([invalidTour]);
    expect(model.tourMarkers).toEqual([]);
    expect(model.warnings.join(" ")).toContain(baseTour.customerName);
  });

  it("creates warnings for missing durable branches without fabricating markers", () => {
    const model = buildOwnerDispatchMapModel([], branches.slice(0, 1));
    expect(model.tours).toEqual([]);
    expect(model.branchMarkers).toHaveLength(1);
    expect(model.warnings.join(" ")).toContain("CS2");
  });

  it("spreads overlapping tour markers without changing canonical coordinates", () => {
    const model = buildOwnerDispatchMapModel([
      baseTour,
      { ...baseTour, id: "00000000-0000-4000-8000-000000000002", customerName: "Khach Hai" },
    ], branches);
    const positions = getOwnerDispatchMarkerPositions(model.tourMarkers);
    expect(positions.get(baseTour.id)).not.toEqual(positions.get("00000000-0000-4000-8000-000000000002"));
    expect(positions.get(baseTour.id)).toMatchObject({ latitude: 10.776, longitude: 106.7 });
    expect(positions.get("00000000-0000-4000-8000-000000000002")).toMatchObject({ latitude: 10.776, longitude: 106.7 });
    expect(model.tourMarkers[0]).toMatchObject({ latitude: 10.776, longitude: 106.7 });
  });
});
