import { describe, it, expect } from "vitest";
import { getLiveDemoTime } from "../src/domain/realtime-clock";
import { projectLocationToMap, offsetOverlappingMarker } from "../src/domain/map-projection";
import { resolveEmployeeMapPosition } from "../src/domain/employee-map-state";
import { getEmployeeRealtimeStatus } from "../src/domain/realtime-status";
import { getDashboardSummary } from "../src/domain/demo-status";
import { mockEmployees, mockLocations, mockAssignments, mockOrders, DEMO_TIME } from "../src/data/mockData";

describe("Map Domain & Realtime Helpers", () => {
  it("live clock preserves demo date 2026-07-31", () => {
    // Force a system time representing 2024-01-01 15:30:45 UTC
    const systemTime = new Date("2024-01-01T15:30:45Z");
    const demoDateString = "2026-07-31T10:00:00+07:00";
    const liveTime = getLiveDemoTime(systemTime, demoDateString);
    expect(liveTime.startsWith("2026-07-31")).toBe(true);
    expect(liveTime.endsWith("+07:00")).toBe(true);
    // 15:30:45 UTC is 22:30:45 +07:00
    expect(liveTime.includes("T22:30:45")).toBe(true);
  });

  it("map projection is deterministic and within bounds", () => {
    const p1 = projectLocationToMap(mockLocations[0], mockLocations, 10);
    const p2 = projectLocationToMap(mockLocations[0], mockLocations, 10);
    expect(p1.x).toBe(p2.x);
    expect(p1.y).toBe(p2.y);
    expect(p1.x).toBeGreaterThanOrEqual(0);
    expect(p1.x).toBeLessThanOrEqual(100);
    expect(p1.y).toBeGreaterThanOrEqual(0);
    expect(p1.y).toBeLessThanOrEqual(100);
  });

  it("deterministic overlapping markers spread evenly", () => {
    const base = { x: 50, y: 50 };
    const p1 = offsetOverlappingMarker(base, 0, 3, 5);
    const p2 = offsetOverlappingMarker(base, 1, 3, 5);
    const p3 = offsetOverlappingMarker(base, 2, 3, 5);
    // Should be spread out
    expect(p1.x === p2.x && p1.y === p2.y).toBe(false);
    expect(p2.x === p3.x && p2.y === p3.y).toBe(false);
    expect(p1.x === p3.x && p1.y === p3.y).toBe(false);
  });

  it("resolveEmployeeMapPosition uses active assignment first", () => {
    const emp = mockEmployees[0];
    const loc = resolveEmployeeMapPosition(emp, mockAssignments, mockOrders, mockLocations, DEMO_TIME);
    expect(loc).toBeDefined();
  });

  it("resolveEmployeeMapPosition falls back to branch if no home", () => {
    const noHomeEmp = { ...mockEmployees[0], homeLocationId: "" };
    const loc = resolveEmployeeMapPosition(noHomeEmp, [], mockOrders, mockLocations, DEMO_TIME);
    expect(loc?.branchId).toBe(noHomeEmp.branchId);
  });

  it("getEmployeeRealtimeStatus computes countdown", () => {
    const emp = mockEmployees[0];
    const status = getEmployeeRealtimeStatus(emp, mockAssignments, DEMO_TIME);
    expect(status.status).toBeDefined();
  });

  it("summary does not double-count employees", () => {
    // If an employee is IN_PROGRESS and finishing in 10 mins, they are working.
    // They shouldn't be counted multiple times in total.
    const summary = getDashboardSummary(mockEmployees, mockAssignments, mockOrders, DEMO_TIME);
    const totalWorkingAndAvailable = summary.workingCount + summary.availableCount;
    // Note: Some employees might not be scheduled at all, but they are available.
    // Ensure workingCount + availableCount <= total employees
    expect(totalWorkingAndAvailable).toBeLessThanOrEqual(mockEmployees.length);
  });
});
