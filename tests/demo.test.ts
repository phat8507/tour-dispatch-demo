import { describe, it, expect } from "vitest";
import {
  DEMO_TIME,
  mockEmployees,
  mockOrders,
  mockAssignments,
  mockServices,
  mockLocations
} from "../src/data/mockData";

describe("Demo Data Validation", () => {
  it("should have exactly 13 employees", () => {
    expect(mockEmployees).toHaveLength(13);
  });

  it("employee names and IDs are unique", () => {
    const names = new Set(mockEmployees.map(e => e.name));
    const ids = new Set(mockEmployees.map(e => e.id));
    expect(names.size).toBe(13);
    expect(ids.size).toBe(13);
  });

  it("verifies exact employee branch and performance-level mapping", () => {
    // Map of expected [branchId, performanceLevel, count]
    const expected = [
      { branchId: "CS2", performanceLevel: "EXPERT", count: 3 }, // My, Hiền, Quỳnh
      { branchId: "CS1", performanceLevel: "EXPERT", count: 1 }, // Nhung
      { branchId: "CS2", performanceLevel: "NORMAL", count: 1 }, // Ngọc 2
      { branchId: "CS1", performanceLevel: "NORMAL", count: 2 }, // Anh, Hậu
      { branchId: "CS1", performanceLevel: "NORMAL_WEAK", count: 2 }, // Bình, Yến
      { branchId: "CS2", performanceLevel: "WEAK", count: 2 }, // Thương, Mơ
      { branchId: "CS1", performanceLevel: "WEAK", count: 2 }, // Lan, Thiện
    ];

    expected.forEach(ex => {
      const matched = mockEmployees.filter(
        e => e.branchId === ex.branchId && e.performanceLevel === ex.performanceLevel
      );
      expect(matched.length).toBe(ex.count);
    });
  });

  it("should have exactly 8 services", () => {
    expect(mockServices).toHaveLength(8);
  });

  it("should have exactly 18 orders", () => {
    expect(mockOrders).toHaveLength(18);
  });

  it("should have exactly 18 assignments", () => {
    expect(mockAssignments).toHaveLength(18);
  });

  it("every employee service ID and preferred area ID exists", () => {
    const serviceIds = new Set(mockServices.map(s => s.id));
    const locationIds = new Set(mockLocations.map(l => l.id));
    
    mockEmployees.forEach(emp => {
      emp.supportedServiceIds.forEach(id => {
        expect(serviceIds.has(id)).toBe(true);
      });
      emp.preferredAreaIds.forEach(id => {
        expect(locationIds.has(id)).toBe(true);
      });
    });
  });

  it("every order service ID and location ID exists", () => {
    const serviceIds = new Set(mockServices.map(s => s.id));
    const locationIds = new Set(mockLocations.map(l => l.id));
    
    mockOrders.forEach(order => {
      expect(serviceIds.has(order.serviceId)).toBe(true);
      expect(locationIds.has(order.locationId)).toBe(true);
    });
  });

  it("every assignment references an existing employee and order", () => {
    const employeeIds = new Set(mockEmployees.map(e => e.id));
    const orderIds = new Set(mockOrders.map(o => o.id));
    
    mockAssignments.forEach(assign => {
      expect(employeeIds.has(assign.employeeId)).toBe(true);
      expect(orderIds.has(assign.orderId)).toBe(true);
    });
  });

  it("DEMO_TIME is fixed and contains +07:00", () => {
    expect(DEMO_TIME).toContain("+07:00");
  });
});
