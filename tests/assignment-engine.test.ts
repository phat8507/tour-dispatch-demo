import { describe, expect, it, vi } from "vitest";
import { suggestAssignments } from "../src/domain/assignment-engine";
import { calculateHaversineDistanceKm } from "../src/domain/travel-time";
import {
  Assignment,
  Employee,
  Location,
  Order,
  Service,
} from "../src/types";

const CURRENT_TIME = "2026-07-31T09:00:00+07:00";
const REQUESTED_TIME = "2026-07-31T10:00:00+07:00";
const EARTH_RADIUS_KM = 6_371;

const services: Service[] = [
  { id: "standard", name: "Standard", durationMinutes: 30 },
  { id: "extra", name: "Extra", durationMinutes: 30 },
];

function latitudeAtDistance(distanceKm: number): number {
  return (distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI);
}

function location(
  id: string,
  distanceKm = 0,
  branchId: Location["branchId"] = "CS1",
): Location {
  return {
    id,
    name: id,
    latitude: latitudeAtDistance(distanceKm),
    longitude: 0,
    branchId,
  };
}

const home = location("home");
const customer = location("customer");

function employee(
  overrides: Partial<Employee> & Pick<Employee, "id">,
): Employee {
  const { id, ...optionalOverrides } = overrides;
  return {
    id,
    name: id,
    branchId: "CS1",
    performanceLevel: "NORMAL",
    homeLocationId: home.id,
    preferredAreaIds: [customer.id],
    supportedServiceIds: services.map((service) => service.id),
    workingStart: "2026-07-31T07:00:00+07:00",
    workingEnd: "2026-07-31T18:00:00+07:00",
    isOff: false,
    ...optionalOverrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "new-order",
    customerName: "Customer",
    locationId: customer.id,
    serviceId: "standard",
    requestedTime: REQUESTED_TIME,
    orderType: "NEW_TOUR",
    urgency: "PREBOOKED",
    status: "PENDING",
    notes: "",
    ...overrides,
  };
}

function assignment(
  overrides: Partial<Assignment> &
    Pick<Assignment, "id" | "employeeId" | "orderId">,
): Assignment {
  const { id, employeeId, orderId, ...optionalOverrides } = overrides;
  return {
    id,
    employeeId,
    orderId,
    startTime: "2026-07-31T08:00:00+07:00",
    endTime: "2026-07-31T08:30:00+07:00",
    status: "COMPLETED",
    ...optionalOverrides,
  };
}

interface EngineOverrides {
  order?: Order;
  employees?: Employee[];
  assignments?: Assignment[];
  orders?: Order[];
  services?: Service[];
  locations?: Location[];
  currentTime?: string;
}

function run(overrides: EngineOverrides = {}) {
  return suggestAssignments({
    order: overrides.order ?? order(),
    employees: overrides.employees ?? [employee({ id: "employee-a" })],
    assignments: overrides.assignments ?? [],
    orders: overrides.orders ?? [],
    services: overrides.services ?? services,
    locations: overrides.locations ?? [home, customer],
    currentTime: overrides.currentTime ?? CURRENT_TIME,
  });
}

describe("suggestAssignments eligibility", () => {
  it("excludes an employee who is off", () => {
    expect(
      run({ employees: [employee({ id: "off", isOff: true })] }),
    ).toEqual([]);
  });

  it("excludes an employee outside working hours", () => {
    expect(
      run({
        employees: [
          employee({
            id: "short-shift",
            workingEnd: "2026-07-31T10:15:00+07:00",
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("excludes an employee who lacks a required service", () => {
    expect(
      run({
        order: order({ serviceIds: ["standard", "extra"] }),
        employees: [
          employee({
            id: "standard-only",
            supportedServiceIds: ["standard"],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("includes an employee who is currently free", () => {
    const suggestions = run();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].estimatedAvailableAt).toBe(
      "2026-07-31T02:00:00.000Z",
    );
  });

  it("includes a busy employee who finishes soon", () => {
    const currentOrder = order({
      id: "current-order",
      locationId: "current-location",
    });
    const currentAssignment = assignment({
      id: "current-assignment",
      employeeId: "busy",
      orderId: currentOrder.id,
      startTime: "2026-07-31T08:30:00+07:00",
      endTime: "2026-07-31T09:20:00+07:00",
      status: "IN_PROGRESS",
    });

    const suggestions = run({
      employees: [employee({ id: "busy" })],
      assignments: [currentAssignment],
      orders: [currentOrder],
      locations: [home, customer, location("current-location")],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].estimatedAvailableAt).toBe(
      "2026-07-31T02:20:00.000Z",
    );
    expect(suggestions[0].reasons).toContain(
      "Current assignment finishes within 30 minutes: +10 points.",
    );
  });

  it("excludes an employee who cannot arrive on time", () => {
    const distantHome = location("distant-home", 10);
    expect(
      run({
        order: order({
          requestedTime: "2026-07-31T09:05:00+07:00",
        }),
        employees: [
          employee({ id: "late", homeLocationId: distantHome.id }),
        ],
        locations: [distantHome, customer],
      }),
    ).toEqual([]);
  });

  it("excludes an overlapping future confirmed assignment", () => {
    const futureAssignment = assignment({
      id: "future",
      employeeId: "employee-a",
      orderId: "future-order",
      startTime: "2026-07-31T10:15:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
      status: "SCHEDULED",
    });

    expect(run({ assignments: [futureAssignment] })).toEqual([]);
  });

  it("returns no suggestions when no employees are eligible", () => {
    expect(
      run({
        employees: [
          employee({ id: "off-a", isOff: true }),
          employee({ id: "off-b", isOff: true }),
        ],
      }),
    ).toEqual([]);
  });
});

describe("suggestAssignments distance rules", () => {
  it("enforces the 20 km REFILL limit", () => {
    const farHome = location("far-home", 20.01);
    expect(
      run({
        order: order({ orderType: "REFILL" }),
        employees: [
          employee({ id: "refill", homeLocationId: farHome.id }),
        ],
        locations: [farHome, customer],
      }),
    ).toEqual([]);
  });

  it("enforces the 30 km NEW_TOUR limit", () => {
    const farHome = location("far-home", 30.01);
    expect(
      run({
        employees: [
          employee({ id: "new-tour", homeLocationId: farHome.id }),
        ],
        locations: [farHome, customer],
      }),
    ).toEqual([]);
  });

  it("accepts the exact maximum-distance boundary", () => {
    const boundaryHome = location("boundary-home", 20);
    const actualDistance = calculateHaversineDistanceKm(
      boundaryHome,
      customer,
    );

    expect(actualDistance).toBeCloseTo(20, 10);
    expect(
      run({
        order: order({
          orderType: "REFILL",
          requestedTime: "2026-07-31T11:00:00+07:00",
        }),
        employees: [
          employee({ id: "boundary", homeLocationId: boundaryHome.id }),
        ],
        locations: [boundaryHome, customer],
      }),
    ).toHaveLength(1);
  });

  it("rejects distance immediately above the boundary", () => {
    const overBoundaryHome = location("over-boundary-home", 20.0001);
    expect(
      run({
        order: order({
          orderType: "REFILL",
          requestedTime: "2026-07-31T11:00:00+07:00",
        }),
        employees: [
          employee({
            id: "over-boundary",
            homeLocationId: overBoundaryHome.id,
          }),
        ],
        locations: [overBoundaryHome, customer],
      }),
    ).toEqual([]);
  });
});

describe("suggestAssignments scoring and ranking", () => {
  it("prefers a STRONG employee for a multi-service order", () => {
    const suggestions = run({
      order: order({ serviceIds: ["standard", "extra"] }),
      employees: [
        employee({ id: "normal", performanceLevel: "NORMAL" }),
        employee({ id: "strong", performanceLevel: "STRONG" }),
      ],
    });

    expect(suggestions.map((suggestion) => suggestion.employeeId)).toEqual([
      "strong",
      "normal",
    ]);
    expect(suggestions[0].score - suggestions[1].score).toBe(25);
  });

  it("prefers a WEAK or NORMAL_WEAK employee for a one-service order", () => {
    const suggestions = run({
      employees: [
        employee({ id: "normal", performanceLevel: "NORMAL" }),
        employee({ id: "normal-weak", performanceLevel: "NORMAL_WEAK" }),
        employee({ id: "weak", performanceLevel: "WEAK" }),
      ],
    });

    expect(suggestions.slice(0, 2).map(({ employeeId }) => employeeId)).toEqual([
      "normal-weak",
      "weak",
    ]);
    expect(suggestions[0].score - suggestions[2].score).toBe(15);
  });

  it("applies the different preferred branch zone penalty", () => {
    const [suggestion] = run({
      employees: [
        employee({
          id: "other-zone",
          preferredAreaIds: ["somewhere-else"],
        }),
      ],
    });

    expect(suggestion.score).toBe(80);
    expect(suggestion.reasons).toContain(
      "Customer is outside the preferred branch zone: -20 points.",
    );
  });

  it("applies the workload balancing penalty", () => {
    const employees = [
      employee({ id: "busy-worker" }),
      employee({ id: "light-worker" }),
    ];
    const pastOrders = [
      order({ id: "past-1" }),
      order({ id: "past-2" }),
    ];
    const pastAssignments = pastOrders.map((pastOrder, index) =>
      assignment({
        id: `past-assignment-${index}`,
        employeeId: "busy-worker",
        orderId: pastOrder.id,
      }),
    );

    const suggestions = run({
      employees,
      assignments: pastAssignments,
      orders: pastOrders,
    });
    const busy = suggestions.find(
      (suggestion) => suggestion.employeeId === "busy-worker",
    );
    const light = suggestions.find(
      (suggestion) => suggestion.employeeId === "light-worker",
    );

    expect(busy).toBeDefined();
    expect(light).toBeDefined();
    expect((light?.score ?? 0) - (busy?.score ?? 0)).toBe(8);
    expect(busy?.reasons).toContain(
      "1.00 assignments above the working-employee average: -8.00 points.",
    );
  });

  it("warns when the arrival buffer is below 15 minutes without changing score", () => {
    const [suggestion] = run({
      order: order({
        requestedTime: "2026-07-31T09:10:00+07:00",
      }),
    });

    expect(suggestion.score).toBe(100);
    expect(suggestion.warnings).toEqual([
      "Arrival buffer is 5 minutes, below 15 minutes.",
    ]);
  });

  it("uses employee ID as the last deterministic tie-breaker", () => {
    const suggestions = run({
      employees: [
        employee({ id: "employee-c" }),
        employee({ id: "employee-a" }),
        employee({ id: "employee-b" }),
        employee({ id: "employee-d" }),
      ],
    });

    expect(suggestions.map(({ employeeId }) => employeeId)).toEqual([
      "employee-a",
      "employee-b",
      "employee-c",
    ]);
  });

  it("uses earlier estimated arrival before employee ID for equal scores", () => {
    const busyLocation = location("busy-location", 10 / 3);
    const completedLocation = location("completed-location");
    const busyOrder = order({
      id: "busy-order",
      locationId: busyLocation.id,
    });
    const completedOrder = order({
      id: "completed-order",
      locationId: completedLocation.id,
    });
    const equalWorkloads = [
      assignment({
        id: "busy-assignment",
        employeeId: "a-busy",
        orderId: busyOrder.id,
        startTime: "2026-07-31T08:30:00+07:00",
        endTime: "2026-07-31T09:20:00+07:00",
        status: "IN_PROGRESS",
      }),
      assignment({
        id: "completed-assignment",
        employeeId: "z-free",
        orderId: completedOrder.id,
      }),
    ];

    const suggestions = run({
      employees: [
        employee({ id: "a-busy" }),
        employee({ id: "z-free" }),
      ],
      assignments: equalWorkloads,
      orders: [busyOrder, completedOrder],
      locations: [home, customer, busyLocation, completedLocation],
    });

    expect(suggestions[0].score).toBeCloseTo(suggestions[1].score, 10);
    expect(suggestions.map(({ employeeId }) => employeeId)).toEqual([
      "z-free",
      "a-busy",
    ]);
  });
});

describe("suggestAssignments determinism and travel origin", () => {
  it("does not mutate its inputs", () => {
    const input = {
      order: order({ serviceIds: ["standard"] }),
      employees: [employee({ id: "immutable" })],
      assignments: [] as Assignment[],
      orders: [] as Order[],
      services,
      locations: [home, customer],
      currentTime: CURRENT_TIME,
    };
    const before = structuredClone(input);

    suggestAssignments(input);

    expect(input).toEqual(before);
  });

  it("uses the explicitly supplied currentTime instead of system time", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
      const first = run();
      vi.setSystemTime(new Date("1990-01-01T00:00:00Z"));
      const second = run();

      expect(first).toEqual(second);
      expect(first[0].estimatedAvailableAt).toBe(
        "2026-07-31T02:00:00.000Z",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the current assignment location as travel origin", () => {
    const farHome = location("far-home", 40);
    const currentLocation = location("current-location");
    const currentOrder = order({
      id: "current-order",
      locationId: currentLocation.id,
    });
    const currentAssignment = assignment({
      id: "current",
      employeeId: "working",
      orderId: currentOrder.id,
      startTime: "2026-07-31T08:30:00+07:00",
      endTime: "2026-07-31T09:20:00+07:00",
      status: "IN_PROGRESS",
    });

    const [suggestion] = run({
      employees: [
        employee({ id: "working", homeLocationId: farHome.id }),
      ],
      assignments: [currentAssignment],
      orders: [currentOrder],
      locations: [farHome, currentLocation, customer],
    });

    expect(suggestion.estimatedTravelMinutes).toBe(5);
  });

  it("falls back to the latest completed assignment location", () => {
    const farHome = location("far-home", 40);
    const olderLocation = location("older-location", 10);
    const latestLocation = location("latest-location");
    const olderOrder = order({
      id: "older-order",
      locationId: olderLocation.id,
    });
    const latestOrder = order({
      id: "latest-order",
      locationId: latestLocation.id,
    });
    const completedAssignments = [
      assignment({
        id: "older",
        employeeId: "completed",
        orderId: olderOrder.id,
        endTime: "2026-07-31T08:00:00+07:00",
      }),
      assignment({
        id: "latest",
        employeeId: "completed",
        orderId: latestOrder.id,
        endTime: "2026-07-31T08:45:00+07:00",
      }),
    ];

    const [suggestion] = run({
      employees: [
        employee({ id: "completed", homeLocationId: farHome.id }),
      ],
      assignments: completedAssignments,
      orders: [olderOrder, latestOrder],
      locations: [farHome, olderLocation, latestLocation, customer],
    });

    expect(suggestion.estimatedTravelMinutes).toBe(5);
  });

  it("falls back to the employee home location", () => {
    const nearHome = location("near-home");
    const [suggestion] = run({
      employees: [
        employee({ id: "at-home", homeLocationId: nearHome.id }),
      ],
      locations: [nearHome, customer],
    });

    expect(suggestion.estimatedTravelMinutes).toBe(5);
  });
});
