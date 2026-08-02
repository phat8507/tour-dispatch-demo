import { describe, expect, it, vi } from "vitest";
import { suggestAssignments } from "../src/domain/assignment-engine";
import { hasConfirmedOverlap } from "../src/domain/availability";
import {
  calculateHaversineDistanceKm,
  TravelTimeProvider,
} from "../src/domain/travel-time";
import { DeterministicTravelTimeProvider } from "../src/data/demo-dispatch-composition";
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
  travelTimeProvider?: TravelTimeProvider;
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
    travelTimeProvider:
      overrides.travelTimeProvider ?? new DeterministicTravelTimeProvider(),
  });
}

describe("travel-time provider contract", () => {
  it("uses the explicitly injected estimate", () => {
    const travelTimeProvider: TravelTimeProvider = {
      estimate: vi.fn(() => ({ distanceKm: 12, travelMinutes: 47 })),
    };

    const [suggestion] = run({ travelTimeProvider });

    expect(travelTimeProvider.estimate).toHaveBeenCalledWith(home, customer);
    expect(suggestion.estimatedTravelMinutes).toBe(47);
  });

  it("propagates provider errors without a fallback", () => {
    const travelTimeProvider: TravelTimeProvider = {
      estimate: () => {
        throw new Error("Travel-time provider unavailable");
      },
    };

    expect(() => run({ travelTimeProvider })).toThrow(
      "Travel-time provider unavailable",
    );
  });
});

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
  it("preserves the capped, deterministic suggestion contract", () => {
    const employees = [
      employee({ id: "employee-c" }),
      employee({ id: "employee-a" }),
      employee({ id: "employee-b" }),
      employee({ id: "employee-d" }),
    ];

    const first = run({ employees });
    const second = run({ employees: [...employees].reverse() });

    expect(first).toHaveLength(3);
    expect(first.map(({ employeeId }) => employeeId)).toEqual([
      "employee-a",
      "employee-b",
      "employee-c",
    ]);
    expect(second).toEqual(first);
  });

  it("does not mutate its inputs", () => {
    const input = {
      order: order({ serviceIds: ["standard"] }),
      employees: [employee({ id: "immutable" })],
      assignments: [] as Assignment[],
      orders: [] as Order[],
      services,
      locations: [home, customer],
      currentTime: CURRENT_TIME,
      travelTimeProvider: new DeterministicTravelTimeProvider(),
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

describe("adversarial interval handling", () => {
  it("treats adjacent half-open intervals as non-overlapping", () => {
    const endingAtStart = assignment({
      id: "ending-at-start",
      employeeId: "employee-a",
      orderId: "earlier",
      startTime: "2026-07-31T09:00:00+07:00",
      endTime: "2026-07-31T10:00:00+07:00",
      status: "SCHEDULED",
    });
    const startingAtEnd = assignment({
      id: "starting-at-end",
      employeeId: "employee-a",
      orderId: "later",
      startTime: "2026-07-31T10:30:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
      status: "SCHEDULED",
    });

    expect(
      hasConfirmedOverlap(
        "employee-a",
        REQUESTED_TIME,
        "2026-07-31T10:30:00+07:00",
        [endingAtStart, startingAtEnd],
        "new-order",
      ),
    ).toBe(false);
  });

  it.each([
    {
      name: "partial overlap",
      startTime: "2026-07-31T10:15:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
    },
    {
      name: "complete containment",
      startTime: "2026-07-31T09:30:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
    },
    {
      name: "midnight-spanning overlap",
      startTime: "2026-07-31T23:45:00+07:00",
      endTime: "2026-08-01T00:15:00+07:00",
      proposedStart: "2026-08-01T00:00:00+07:00",
      proposedEnd: "2026-08-01T00:30:00+07:00",
    },
  ])("detects $name", ({ startTime, endTime, proposedStart, proposedEnd }) => {
    const existing = assignment({
      id: "existing",
      employeeId: "employee-a",
      orderId: "existing-order",
      startTime,
      endTime,
      status: "SCHEDULED",
    });

    expect(
      hasConfirmedOverlap(
        "employee-a",
        proposedStart ?? REQUESTED_TIME,
        proposedEnd ?? "2026-07-31T10:30:00+07:00",
        [existing],
        "new-order",
      ),
    ).toBe(true);
  });

  it("ignores an invalid assignment whose end precedes its start", () => {
    const invalid = assignment({
      id: "invalid",
      employeeId: "employee-a",
      orderId: "invalid-order",
      startTime: "2026-07-31T10:15:00+07:00",
      endTime: "2026-07-31T10:05:00+07:00",
      status: "SCHEDULED",
    });

    expect(
      hasConfirmedOverlap(
        "employee-a",
        REQUESTED_TIME,
        "2026-07-31T10:30:00+07:00",
        [invalid],
        "new-order",
      ),
    ).toBe(false);
  });
});

describe("adversarial availability and cancellation handling", () => {
  it("keeps an employee with only a non-overlapping future assignment available now", () => {
    const future = assignment({
      id: "future",
      employeeId: "employee-a",
      orderId: "future-order",
      startTime: "2026-07-31T12:00:00+07:00",
      endTime: "2026-07-31T13:00:00+07:00",
      status: "SCHEDULED",
    });

    expect(run({ assignments: [future] })).toHaveLength(1);
  });

  it("does not let a completed assignment block the proposed interval", () => {
    const completed = assignment({
      id: "completed",
      employeeId: "employee-a",
      orderId: "completed-order",
      startTime: REQUESTED_TIME,
      endTime: "2026-07-31T10:30:00+07:00",
      status: "COMPLETED",
    });
    const completedOrder = order({ id: "completed-order" });

    expect(
      run({ assignments: [completed], orders: [completedOrder] }),
    ).toHaveLength(1);
  });

  it("does not let an assignment for a cancelled order block availability", () => {
    const cancelledOrder = order({
      id: "cancelled-order",
      status: "CANCELLED",
    });
    const cancelledAssignment = assignment({
      id: "cancelled-assignment",
      employeeId: "employee-a",
      orderId: cancelledOrder.id,
      startTime: "2026-07-31T10:15:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
      status: "SCHEDULED",
    });

    expect(
      run({
        assignments: [cancelledAssignment],
        orders: [cancelledOrder],
      }),
    ).toHaveLength(1);
  });

  it("does not use a cancelled current assignment as the travel origin", () => {
    const farLocation = location("cancelled-location", 40);
    const cancelledOrder = order({
      id: "cancelled-current-order",
      locationId: farLocation.id,
      status: "CANCELLED",
    });
    const cancelledAssignment = assignment({
      id: "cancelled-current-assignment",
      employeeId: "employee-a",
      orderId: cancelledOrder.id,
      startTime: "2026-07-31T08:30:00+07:00",
      endTime: "2026-07-31T09:20:00+07:00",
      status: "IN_PROGRESS",
    });

    const [suggestion] = run({
      assignments: [cancelledAssignment],
      orders: [cancelledOrder],
      locations: [home, customer, farLocation],
    });

    expect(suggestion.estimatedTravelMinutes).toBe(5);
    expect(suggestion.estimatedAvailableAt).toBe(
      "2026-07-31T02:00:00.000Z",
    );
  });
});

describe("adversarial travel and arrival calculations", () => {
  const provider = new DeterministicTravelTimeProvider();

  it("returns zero Haversine distance for identical coordinates", () => {
    expect(calculateHaversineDistanceKm(home, home)).toBe(0);
  });

  it("calculates the known distance for one latitude degree", () => {
    const oneDegreeNorth: Location = {
      ...home,
      id: "one-degree-north",
      latitude: 1,
    };

    expect(calculateHaversineDistanceKm(home, oneDegreeNorth)).toBeCloseTo(
      111.19,
      2,
    );
  });

  it("applies the preparation buffer exactly once and rounds travel upward", () => {
    const shortTrip = location("short-trip", 0.4);

    expect(provider.estimate(home, home).travelMinutes).toBe(5);
    expect(provider.estimate(home, shortTrip).travelMinutes).toBe(6);
  });

  it("does not mutate locations passed to the deterministic provider", () => {
    const origin = structuredClone(home);
    const destination = structuredClone(customer);
    const before = structuredClone({ origin, destination });

    provider.estimate(origin, destination);

    expect({ origin, destination }).toEqual(before);
  });

  it("handles invalid coordinates without throwing or suggesting an employee", () => {
    const invalidHome: Location = {
      ...home,
      id: "invalid-home",
      latitude: Number.NaN,
    };

    expect(() =>
      run({
        employees: [
          employee({ id: "invalid", homeLocationId: invalidHome.id }),
        ],
        locations: [invalidHome, customer],
      }),
    ).not.toThrow();
    expect(
      run({
        employees: [
          employee({ id: "invalid", homeLocationId: invalidHome.id }),
        ],
        locations: [invalidHome, customer],
      }),
    ).toEqual([]);
  });

  it("rejects finite coordinates outside geographic bounds", () => {
    const invalidLatitude: Location = {
      ...home,
      id: "invalid-latitude",
      latitude: 91,
    };

    expect(
      Number.isNaN(
        provider.estimate(invalidLatitude, customer).distanceKm,
      ),
    ).toBe(true);
  });

  it("accepts arrival exactly at the requested time", () => {
    expect(
      run({ currentTime: "2026-07-31T09:55:00+07:00" }),
    ).toHaveLength(1);
  });

  it("rejects arrival one minute after the requested time", () => {
    expect(
      run({ currentTime: "2026-07-31T09:56:00+07:00" }),
    ).toEqual([]);
  });

  it("accepts 30 km exactly and rejects above 30 km for NEW_TOUR", () => {
    const exactHome = location("exact-30", 30);
    const overHome = location("over-30", 30.0001);
    const laterOrder = order({
      requestedTime: "2026-07-31T11:00:00+07:00",
    });

    expect(
      run({
        order: laterOrder,
        employees: [
          employee({ id: "exact", homeLocationId: exactHome.id }),
        ],
        locations: [exactHome, customer],
      }),
    ).toHaveLength(1);
    expect(
      run({
        order: laterOrder,
        employees: [
          employee({ id: "over", homeLocationId: overHome.id }),
        ],
        locations: [overHome, customer],
      }),
    ).toEqual([]);
  });
});

describe("adversarial service and scoring handling", () => {
  it("treats an explicitly empty service list as invalid", () => {
    expect(run({ order: order({ serviceIds: [] }) })).toEqual([]);
  });

  it("does not let duplicate service IDs inflate duration or the multi-service bonus", () => {
    const future = assignment({
      id: "future",
      employeeId: "strong",
      orderId: "future-order",
      startTime: "2026-07-31T10:30:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
      status: "SCHEDULED",
    });
    const [suggestion] = run({
      order: order({ serviceIds: ["standard", "standard"] }),
      employees: [
        employee({ id: "strong", performanceLevel: "STRONG" }),
      ],
      assignments: [future],
    });

    expect(suggestion.score).toBe(100);
  });

  it("handles an unknown required service safely", () => {
    expect(
      run({ order: order({ serviceIds: ["unknown"] }) }),
    ).toEqual([]);
  });

  it("applies the REFILL weak bonus once for a multi-service order", () => {
    const [suggestion] = run({
      order: order({
        orderType: "REFILL",
        serviceIds: ["standard", "extra"],
      }),
      employees: [
        employee({ id: "weak", performanceLevel: "WEAK" }),
      ],
    });

    expect(suggestion.score).toBe(115);
    expect(
      suggestion.reasons.filter((reason) => reason.includes("+15 points")),
    ).toHaveLength(1);
  });

  it("excludes off-employee assignments from the workload average", () => {
    const employees = [
      employee({ id: "busy" }),
      employee({ id: "light" }),
      employee({ id: "off", isOff: true }),
    ];
    const workloadAssignments = [
      ...Array.from({ length: 2 }, (_, index) =>
        assignment({
          id: `busy-${index}`,
          employeeId: "busy",
          orderId: `busy-order-${index}`,
          status: "SCHEDULED",
        }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        assignment({
          id: `off-${index}`,
          employeeId: "off",
          orderId: `off-order-${index}`,
          status: "SCHEDULED",
        }),
      ),
    ];

    const suggestions = run({
      employees,
      assignments: workloadAssignments,
    });
    const busy = suggestions.find(
      (suggestion) => suggestion.employeeId === "busy",
    );
    const light = suggestions.find(
      (suggestion) => suggestion.employeeId === "light",
    );

    expect((light?.score ?? 0) - (busy?.score ?? 0)).toBe(8);
  });

  it("excludes invalid assignment intervals from workload scoring", () => {
    const invalidAssignments = Array.from({ length: 2 }, (_, index) =>
      assignment({
        id: `invalid-workload-${index}`,
        employeeId: "busy",
        orderId: `invalid-workload-order-${index}`,
        startTime: "2026-07-31T08:30:00+07:00",
        endTime: "2026-07-31T08:00:00+07:00",
        status: "SCHEDULED",
      }),
    );
    const suggestions = run({
      employees: [
        employee({ id: "busy" }),
        employee({ id: "light" }),
      ],
      assignments: invalidAssignments,
    });
    const busy = suggestions.find(
      (suggestion) => suggestion.employeeId === "busy",
    );
    const light = suggestions.find(
      (suggestion) => suggestion.employeeId === "light",
    );

    expect(busy?.score).toBe(light?.score);
  });

  it("ignores assignments from another day in workload scoring", () => {
    const previousDayAssignments = Array.from({ length: 4 }, (_, index) =>
      assignment({
        id: `previous-${index}`,
        employeeId: "busy",
        orderId: `previous-order-${index}`,
        startTime: "2026-07-30T08:00:00+07:00",
        endTime: "2026-07-30T08:30:00+07:00",
        status: "SCHEDULED",
      }),
    );

    const [suggestion] = run({
      employees: [employee({ id: "busy" })],
      assignments: previousDayAssignments,
    });

    expect(suggestion.score).toBe(100);
  });

  it("counts workload timestamps on the requested local day despite a different offset", () => {
    const sameLocalDayAssignments = Array.from({ length: 2 }, (_, index) =>
      assignment({
        id: `same-day-${index}`,
        employeeId: "busy",
        orderId: `same-day-order-${index}`,
        startTime: `2026-07-30T1${8 + index}:00:00Z`,
        endTime: `2026-07-30T1${8 + index}:30:00Z`,
        status: "SCHEDULED",
      }),
    );
    const suggestions = run({
      employees: [
        employee({ id: "busy" }),
        employee({ id: "light" }),
      ],
      assignments: sameLocalDayAssignments,
    });
    const busy = suggestions.find(
      (suggestion) => suggestion.employeeId === "busy",
    );
    const light = suggestions.find(
      (suggestion) => suggestion.employeeId === "light",
    );

    expect((light?.score ?? 0) - (busy?.score ?? 0)).toBe(8);
  });

  it("keeps negative scores and their reasons consistent", () => {
    const distantHome = location("distant-home", 29);
    const [suggestion] = run({
      order: order({
        requestedTime: "2026-07-31T12:00:00+07:00",
      }),
      employees: [
        employee({
          id: "negative",
          homeLocationId: distantHome.id,
          preferredAreaIds: [],
        }),
      ],
      locations: [distantHome, customer],
    });

    expect(suggestion.score).toBeLessThan(0);
    expect(suggestion.reasons).toContain(
      "Customer is outside the preferred branch zone: -20 points.",
    );
  });

  it("keeps EXPERT and MILEAGE as behavior-compatible legacy aliases", () => {
    const strongScore = run({
      order: order({ serviceIds: ["standard", "extra"] }),
      employees: [
        employee({ id: "strong", performanceLevel: "STRONG" }),
      ],
    })[0].score;
    const expertScore = run({
      order: order({ serviceIds: ["standard", "extra"] }),
      employees: [
        employee({ id: "expert", performanceLevel: "EXPERT" }),
      ],
    })[0].score;
    const refillScore = run({
      order: order({ orderType: "REFILL" }),
      employees: [
        employee({ id: "refill", performanceLevel: "WEAK" }),
      ],
    })[0].score;
    const mileageScore = run({
      order: order({ orderType: "MILEAGE" }),
      employees: [
        employee({ id: "mileage", performanceLevel: "WEAK" }),
      ],
    })[0].score;

    expect(expertScore).toBe(strongScore);
    expect(mileageScore).toBe(refillScore);
  });
});

describe("adversarial ranking and input safety", () => {
  it("does not return duplicate employee suggestions", () => {
    const duplicate = employee({ id: "duplicate" });

    expect(
      run({ employees: [duplicate, duplicate, duplicate, duplicate] }),
    ).toHaveLength(1);
  });

  it("produces the same ranking for reversed employee input", () => {
    const employees = [
      employee({ id: "c" }),
      employee({ id: "a" }),
      employee({ id: "b" }),
    ];

    expect(run({ employees })).toEqual(
      run({ employees: employees.slice().reverse() }),
    );
  });

  it("returns identical results across repeated calls", () => {
    const input: EngineOverrides = {
      order: order({ serviceIds: ["standard", "extra"] }),
      employees: [
        employee({ id: "strong", performanceLevel: "EXPERT" }),
        employee({ id: "weak", performanceLevel: "WEAK" }),
      ],
    };

    expect(run(input)).toEqual(run(input));
  });
});
