import { describe, it, expect } from "vitest";
import {
  getTimelineOffsetPercentage,
  getTimelineWidthPercentage,
  formatTimeHHMMInTimeZone,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  ASSIGNMENT_STATUS_LABEL,
  PERFORMANCE_LEVEL_LABEL,
  ORDER_TYPE_LABEL,
  URGENCY_LABEL,
} from "../src/domain/timeline";
import {
  getAssignmentDisplayStatus,
  getCurrentlyWorkingEmployees,
  getAvailableEmployees,
  getAssignmentsCompletingWithin30Minutes,
  getDelayedAssignments,
  getDashboardSummary,
} from "../src/domain/demo-status";
import {
  DEMO_TIME,
  mockEmployees,
  mockAssignments,
  mockOrders,
  mockServices,
} from "../src/data/mockData";
import { Assignment, Employee } from "../src/types";

// ── Timeline offset/width tests ────────────────────────────────────────────

describe("getTimelineOffsetPercentage", () => {
  it("08:00 gives offset 0%", () => {
    expect(getTimelineOffsetPercentage("2026-07-31T08:00:00+07:00")).toBe(0);
  });

  it("20:00 gives offset 100%", () => {
    expect(getTimelineOffsetPercentage("2026-07-31T20:00:00+07:00")).toBe(100);
  });

  it("14:00 gives offset 50%", () => {
    expect(getTimelineOffsetPercentage("2026-07-31T14:00:00+07:00")).toBe(50);
  });

  it("times before 08:00 clamp to 0%", () => {
    expect(getTimelineOffsetPercentage("2026-07-31T06:00:00+07:00")).toBe(0);
    expect(getTimelineOffsetPercentage("2026-07-31T00:00:00+07:00")).toBe(0);
  });

  it("times after 20:00 clamp to 100%", () => {
    expect(getTimelineOffsetPercentage("2026-07-31T21:00:00+07:00")).toBe(100);
    expect(getTimelineOffsetPercentage("2026-07-31T23:59:00+07:00")).toBe(100);
  });
});

describe("getTimelineWidthPercentage", () => {
  const TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 720

  it("a 60-minute assignment has correct width", () => {
    const start = "2026-07-31T10:00:00+07:00";
    const end = "2026-07-31T11:00:00+07:00";
    const expectedWidth = (60 / TOTAL_MINUTES) * 100;
    expect(getTimelineWidthPercentage(start, end)).toBeCloseTo(expectedWidth, 5);
  });

  it("a 30-minute assignment has correct width", () => {
    const start = "2026-07-31T09:00:00+07:00";
    const end = "2026-07-31T09:30:00+07:00";
    const expectedWidth = (30 / TOTAL_MINUTES) * 100;
    expect(getTimelineWidthPercentage(start, end)).toBeCloseTo(expectedWidth, 5);
  });

  it("an assignment ending before 08:00 is clamped to 0 width", () => {
    const start = "2026-07-31T06:00:00+07:00";
    const end = "2026-07-31T07:30:00+07:00";
    expect(getTimelineWidthPercentage(start, end)).toBe(0);
  });

  it("an assignment starting after 20:00 is clamped to 0 width", () => {
    const start = "2026-07-31T20:30:00+07:00";
    const end = "2026-07-31T21:30:00+07:00";
    expect(getTimelineWidthPercentage(start, end)).toBe(0);
  });
});

// ── Status calculation tests ───────────────────────────────────────────────

describe("getAssignmentDisplayStatus", () => {
  const base = (overrides: Partial<Assignment>): Assignment => ({
    id: "test",
    orderId: "ord_1",
    employeeId: "emp_my",
    startTime: "2026-07-31T08:00:00+07:00",
    endTime: "2026-07-31T09:00:00+07:00",
    status: "SCHEDULED",
    ...overrides,
  });

  it("returns DELAYED when stored status is DELAYED, regardless of time", () => {
    const a = base({ status: "DELAYED" });
    expect(getAssignmentDisplayStatus(a, "2026-07-31T07:00:00+07:00")).toBe("DELAYED");
  });

  it("returns COMPLETED when endTime is before demoTime", () => {
    const a = base({ startTime: "2026-07-31T08:00:00+07:00", endTime: "2026-07-31T09:00:00+07:00", status: "COMPLETED" });
    expect(getAssignmentDisplayStatus(a, "2026-07-31T10:00:00+07:00")).toBe("COMPLETED");
  });

  it("returns IN_PROGRESS when startTime < demoTime < endTime", () => {
    const a = base({ startTime: "2026-07-31T09:00:00+07:00", endTime: "2026-07-31T11:00:00+07:00", status: "IN_PROGRESS" });
    expect(getAssignmentDisplayStatus(a, "2026-07-31T10:00:00+07:00")).toBe("IN_PROGRESS");
  });

  it("status calculations use DEMO_TIME (not current time)", () => {
    const a = base({ startTime: "2026-07-31T11:00:00+07:00", endTime: "2026-07-31T12:00:00+07:00", status: "SCHEDULED" });
    // DEMO_TIME = 10:00, so this future assignment should be SCHEDULED
    expect(getAssignmentDisplayStatus(a, DEMO_TIME)).toBe("SCHEDULED");
  });
});

// ── Employee availability tests ─────────────────────────────────────────────

// Shared fixture employees for availability tests
const baseEmployee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  name: id,
  branchId: "CS1",
  performanceLevel: "NORMAL",
  homeLocationId: "loc_cs1_center",
  preferredAreaIds: ["loc_cs1_center"],
  supportedServiceIds: ["s_standard"],
  workingStart: "2026-07-31T08:00:00+07:00",
  workingEnd: "2026-07-31T20:00:00+07:00",
  isOff: false,
  ...overrides,
});

const baseAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "a_test",
  orderId: "ord_1",
  employeeId: "emp_test",
  startTime: "2026-07-31T09:00:00+07:00",
  endTime: "2026-07-31T10:00:00+07:00",
  status: "COMPLETED",
  ...overrides,
});

describe("getAvailableEmployees", () => {
  it("Yến (isOff) is excluded from available employees", () => {
    const available = getAvailableEmployees(mockEmployees, mockAssignments, DEMO_TIME);
    const yen = available.find((e) => e.id === "emp_yen");
    expect(yen).toBeUndefined();
  });

  it("off employees are never available", () => {
    const available = getAvailableEmployees(mockEmployees, mockAssignments, DEMO_TIME);
    available.forEach((e) => expect(e.isOff).toBe(false));
  });

  it("employee with an assignment at 14:00–15:00 is available at 10:00", () => {
    const emp = baseEmployee("emp_future");
    // Assignment is entirely in the future — does not overlap 10:00
    const futureAssign = baseAssignment({
      id: "a_future",
      employeeId: "emp_future",
      startTime: "2026-07-31T14:00:00+07:00",
      endTime: "2026-07-31T15:00:00+07:00",
      status: "SCHEDULED",
    });
    const available = getAvailableEmployees([emp], [futureAssign], DEMO_TIME);
    expect(available.map((e) => e.id)).toContain("emp_future");
  });

  it("employee with an assignment ending before 10:00 is available at 10:00", () => {
    const emp = baseEmployee("emp_past");
    // Assignment ended at 09:30 — before DEMO_TIME 10:00
    const pastAssign = baseAssignment({
      id: "a_past",
      employeeId: "emp_past",
      startTime: "2026-07-31T08:00:00+07:00",
      endTime: "2026-07-31T09:30:00+07:00",
      status: "COMPLETED",
    });
    const available = getAvailableEmployees([emp], [pastAssign], DEMO_TIME);
    expect(available.map((e) => e.id)).toContain("emp_past");
  });

  it("employee with an assignment spanning 10:00 is NOT available", () => {
    const emp = baseEmployee("emp_active");
    // Assignment spans 09:00–11:00, overlapping DEMO_TIME 10:00
    const activeAssign = baseAssignment({
      id: "a_active",
      employeeId: "emp_active",
      startTime: "2026-07-31T09:00:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00",
      status: "IN_PROGRESS",
    });
    const available = getAvailableEmployees([emp], [activeAssign], DEMO_TIME);
    expect(available.map((e) => e.id)).not.toContain("emp_active");
  });

  it("an off employee is never available, even with no assignments", () => {
    const offEmp = baseEmployee("emp_off", { isOff: true });
    const available = getAvailableEmployees([offEmp], [], DEMO_TIME);
    expect(available).toHaveLength(0);
  });
});

describe("getAssignmentsCompletingWithin30Minutes", () => {
  it("counts an in-progress assignment ending 15 minutes after demoTime", () => {
    const soonEndingAssignment: Assignment = {
      id: "test_soon",
      orderId: "ord_1",
      employeeId: "emp_my",
      startTime: "2026-07-31T09:00:00+07:00",
      endTime: "2026-07-31T10:15:00+07:00", // active at 10:00, ends at 10:15
      status: "IN_PROGRESS",
    };
    const result = getAssignmentsCompletingWithin30Minutes([soonEndingAssignment], DEMO_TIME);
    expect(result).toHaveLength(1);
  });

  it("does not count an in-progress assignment ending 60 minutes after demoTime", () => {
    const laterAssignment: Assignment = {
      id: "test_later",
      orderId: "ord_1",
      employeeId: "emp_my",
      startTime: "2026-07-31T09:00:00+07:00",
      endTime: "2026-07-31T11:00:00+07:00", // active at 10:00, but ends at 11:00
      status: "IN_PROGRESS",
    };
    const result = getAssignmentsCompletingWithin30Minutes([laterAssignment], DEMO_TIME);
    expect(result).toHaveLength(0);
  });

  it("does not count a COMPLETED assignment even if endTime is within 30 minutes", () => {
    const completedAssignment: Assignment = {
      id: "test_completed",
      orderId: "ord_1",
      employeeId: "emp_my",
      startTime: "2026-07-31T08:00:00+07:00",
      endTime: "2026-07-31T09:00:00+07:00", // already ended before demoTime
      status: "COMPLETED",
    };
    const result = getAssignmentsCompletingWithin30Minutes([completedAssignment], DEMO_TIME);
    expect(result).toHaveLength(0);
  });

  it("does not count a SCHEDULED future assignment", () => {
    const futureAssignment: Assignment = {
      id: "test_future",
      orderId: "ord_1",
      employeeId: "emp_my",
      startTime: "2026-07-31T10:20:00+07:00",
      endTime: "2026-07-31T10:40:00+07:00", // starts after demoTime
      status: "SCHEDULED",
    };
    const result = getAssignmentsCompletingWithin30Minutes([futureAssignment], DEMO_TIME);
    expect(result).toHaveLength(0);
  });
});

// ── Dashboard summary tests ────────────────────────────────────────────────

describe("getDashboardSummary", () => {
  it("summary values match seeded data (no hard-coded numbers)", () => {
    const summary = getDashboardSummary(mockEmployees, mockAssignments, mockOrders, DEMO_TIME);

    // Delayed count must match number of assignments with status DELAYED
    const delayedCount = getDelayedAssignments(mockAssignments).length;
    expect(summary.delayedCount).toBe(delayedCount);

    // Working count must come from helper
    const workingCount = getCurrentlyWorkingEmployees(mockEmployees, mockAssignments, DEMO_TIME).length;
    expect(summary.workingCount).toBe(workingCount);

    // Available count from helper
    const availableCount = getAvailableEmployees(mockEmployees, mockAssignments, DEMO_TIME).length;
    expect(summary.availableCount).toBe(availableCount);
  });
});

// ── Domain identifier tests ────────────────────────────────────────────────

describe("Domain identifiers remain English", () => {
  it("AssignmentStatus values are English", () => {
    const statuses = Object.keys(ASSIGNMENT_STATUS_LABEL);
    statuses.forEach((s) => {
      expect(s).toMatch(/^[A-Z_]+$/);
    });
  });

  it("PerformanceLevel values are English", () => {
    const levels = Object.keys(PERFORMANCE_LEVEL_LABEL);
    levels.forEach((l) => {
      expect(l).toMatch(/^[A-Z_]+$/);
    });
  });

  it("OrderType values are English", () => {
    const types = Object.keys(ORDER_TYPE_LABEL);
    types.forEach((t) => {
      expect(t).toMatch(/^[A-Z_]+$/);
    });
  });

  it("Urgency values are English", () => {
    const urgencies = Object.keys(URGENCY_LABEL);
    urgencies.forEach((u) => {
      expect(u).toMatch(/^[A-Z_]+$/);
    });
  });
});

describe("formatTimeHHMMInTimeZone", () => {
  it("formats UTC engine timestamps in the demo timezone", () => {
    expect(
      formatTimeHHMMInTimeZone(
        "2026-07-31T03:15:00.000Z",
        "Asia/Ho_Chi_Minh",
      ),
    ).toBe("10:15");
  });

  it("returns a placeholder for an invalid timestamp", () => {
    expect(
      formatTimeHHMMInTimeZone("not-a-time", "Asia/Ho_Chi_Minh"),
    ).toBe("--:--");
  });
});

describe("Canonical and compatibility labels", () => {
  it("maps STRONG and EXPERT to Cứng", () => {
    expect(PERFORMANCE_LEVEL_LABEL.STRONG).toBe("Cứng");
    expect(PERFORMANCE_LEVEL_LABEL.EXPERT).toBe("Cứng");
  });

  it("maps REFILL and MILEAGE to Đơn dặm", () => {
    expect(ORDER_TYPE_LABEL.REFILL).toBe("Đơn dặm");
    expect(ORDER_TYPE_LABEL.MILEAGE).toBe("Đơn dặm");
  });
});

// ── Timeline coverage tests ────────────────────────────────────────────────

describe("Timeline coverage", () => {
  it("all 13 employee rows are represented in mock data", () => {
    expect(mockEmployees).toHaveLength(13);
  });

  it("the off employee (Yến) has no active assignments in mock data", () => {
    const yen = mockEmployees.find((e) => e.id === "emp_yen");
    expect(yen?.isOff).toBe(true);
    // No assignment should be linked to emp_yen
    const yenAssignments = mockAssignments.filter((a) => a.employeeId === "emp_yen");
    expect(yenAssignments).toHaveLength(0);
  });

  it("mock data includes services with correct durations", () => {
    mockServices.forEach((s) => {
      expect(s.durationMinutes).toBeGreaterThan(0);
    });
  });
});
