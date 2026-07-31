import {
  Assignment,
  Branch,
  Employee,
  Location,
  Order,
  Service,
} from "../types";

export const DEMO_TIME = "2026-07-31T10:00:00+07:00";
export const DEMO_TIMEZONE = "Asia/Ho_Chi_Minh";

export const mockBranches: Branch[] = [
  { id: "CS1", name: "Cơ sở 1" },
  { id: "CS2", name: "Cơ sở 2" },
];

export const mockLocations: Location[] = [
  { id: "loc_cs1_center", name: "Khu vực trung tâm CS1", latitude: 10.7626, longitude: 106.6601, branchId: "CS1" },
  { id: "loc_cs1_suburb", name: "Khu vực ngoại ô CS1", latitude: 10.7726, longitude: 106.6701, branchId: "CS1" },
  { id: "loc_cs2_center", name: "Khu vực trung tâm CS2", latitude: 10.7826, longitude: 106.6801, branchId: "CS2" },
  { id: "loc_cs2_suburb", name: "Khu vực ngoại ô CS2", latitude: 10.7926, longitude: 106.6901, branchId: "CS2" },
];

// MOCK_ASSUMPTION: Services and their durations are not yet specified.
export const mockServices: Service[] = [
  { id: "s_standard", name: "Standard", durationMinutes: 60 },
  { id: "s_premium", name: "Premium", durationMinutes: 90 },
  { id: "s_quick", name: "Quick", durationMinutes: 30 },
  { id: "s_deep", name: "Deep Cleaning", durationMinutes: 120 },
  { id: "s_maint", name: "Maintenance", durationMinutes: 45 },
  { id: "s_inspect", name: "Inspection", durationMinutes: 20 },
  { id: "s_consult", name: "Consultation", durationMinutes: 60 },
  { id: "s_full", name: "Full Package", durationMinutes: 180 },
];

// MOCK_ASSUMPTION: preferredAreaIds and supportedServiceIds are not strictly defined yet, so we mock them explicitly to ensure tests pass.
export const mockEmployees: Employee[] = [
  // CS2 / Cứng: My, Hiền, Quỳnh
  { id: "emp_my", name: "My", branchId: "CS2", performanceLevel: "EXPERT", homeLocationId: "loc_cs2_center", preferredAreaIds: ["loc_cs2_center", "loc_cs2_suburb"], supportedServiceIds: ["s_standard", "s_premium", "s_quick", "s_deep", "s_maint", "s_inspect", "s_consult", "s_full"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  { id: "emp_hien", name: "Hiền", branchId: "CS2", performanceLevel: "EXPERT", homeLocationId: "loc_cs2_center", preferredAreaIds: ["loc_cs2_center"], supportedServiceIds: ["s_standard", "s_premium", "s_quick", "s_deep", "s_maint", "s_inspect", "s_consult", "s_full"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  { id: "emp_quynh", name: "Quỳnh", branchId: "CS2", performanceLevel: "EXPERT", homeLocationId: "loc_cs2_suburb", preferredAreaIds: ["loc_cs2_center", "loc_cs2_suburb"], supportedServiceIds: ["s_standard", "s_premium", "s_quick", "s_deep", "s_maint", "s_inspect", "s_consult", "s_full"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },

  // CS1 / Cứng: Nhung
  { id: "emp_nhung", name: "Nhung", branchId: "CS1", performanceLevel: "EXPERT", homeLocationId: "loc_cs1_center", preferredAreaIds: ["loc_cs1_center", "loc_cs1_suburb"], supportedServiceIds: ["s_standard", "s_premium", "s_quick", "s_deep", "s_maint", "s_inspect", "s_consult", "s_full"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },

  // CS2 / Bình thường: Ngọc 2
  { id: "emp_ngoc2", name: "Ngọc 2", branchId: "CS2", performanceLevel: "NORMAL", homeLocationId: "loc_cs2_center", preferredAreaIds: ["loc_cs2_center"], supportedServiceIds: ["s_standard", "s_quick", "s_maint"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },

  // CS1 / Bình thường: Anh, Hậu
  { id: "emp_anh", name: "Anh", branchId: "CS1", performanceLevel: "NORMAL", homeLocationId: "loc_cs1_center", preferredAreaIds: ["loc_cs1_center"], supportedServiceIds: ["s_standard", "s_quick"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  { id: "emp_hau", name: "Hậu", branchId: "CS1", performanceLevel: "NORMAL", homeLocationId: "loc_cs1_suburb", preferredAreaIds: ["loc_cs1_suburb"], supportedServiceIds: ["s_standard", "s_maint"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },

  // CS1 / Bình thường/Yếu: Bình, Yến
  { id: "emp_binh", name: "Bình", branchId: "CS1", performanceLevel: "NORMAL_WEAK", homeLocationId: "loc_cs1_center", preferredAreaIds: ["loc_cs1_center"], supportedServiceIds: ["s_standard", "s_quick"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  // Yến is off
  { id: "emp_yen", name: "Yến", branchId: "CS1", performanceLevel: "NORMAL_WEAK", homeLocationId: "loc_cs1_suburb", preferredAreaIds: ["loc_cs1_suburb"], supportedServiceIds: ["s_standard", "s_inspect"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: true },

  // CS2 / Yếu: Thương, Mơ
  { id: "emp_thuong", name: "Thương", branchId: "CS2", performanceLevel: "WEAK", homeLocationId: "loc_cs2_center", preferredAreaIds: ["loc_cs2_center"], supportedServiceIds: ["s_standard"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  { id: "emp_mo", name: "Mơ", branchId: "CS2", performanceLevel: "WEAK", homeLocationId: "loc_cs2_suburb", preferredAreaIds: ["loc_cs2_suburb"], supportedServiceIds: ["s_quick"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },

  // CS1 / Yếu: Lan, Thiện
  { id: "emp_lan", name: "Lan", branchId: "CS1", performanceLevel: "WEAK", homeLocationId: "loc_cs1_center", preferredAreaIds: ["loc_cs1_center"], supportedServiceIds: ["s_standard"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
  { id: "emp_thien", name: "Thiện", branchId: "CS1", performanceLevel: "WEAK", homeLocationId: "loc_cs1_suburb", preferredAreaIds: ["loc_cs1_suburb"], supportedServiceIds: ["s_quick"], workingStart: "2026-07-31T08:00:00+07:00", workingEnd: "2026-07-31T20:00:00+07:00", isOff: false },
];

// Helper deterministic generators (no Math.random)
const deterministicLocations = ["loc_cs1_center", "loc_cs1_suburb", "loc_cs2_center", "loc_cs2_suburb"];
const deterministicServices = ["s_standard", "s_premium", "s_quick", "s_deep", "s_maint", "s_inspect", "s_consult", "s_full"];

export const mockOrders: Order[] = Array.from({ length: 18 }, (_, i) => ({
  id: `ord_${i + 1}`,
  customerName: `Customer ${i + 1}`,
  locationId: deterministicLocations[i % 4],
  serviceId: deterministicServices[i % 8],
  requestedTime: `2026-07-31T${(8 + Math.floor(i / 2)).toString().padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}:00+07:00`,
  orderType: i % 3 === 0 ? "MILEAGE" : "NEW_TOUR",
  urgency: i % 4 === 0 ? "IMMEDIATE" : "PREBOOKED",
  status: "ASSIGNED",
  notes: `Mock note ${i + 1}`,
}));

export const mockAssignments: Assignment[] = mockOrders.map((order, i) => {
  // MOCK_ASSUMPTION: We deterministically pick an employee that is not off (skipping emp_yen at index 8)
  const employeeIds = mockEmployees.filter(e => !e.isOff).map(e => e.id);
  const employeeId = employeeIds[i % employeeIds.length];
  const isDelayed = i === 5; // one explicit delayed assignment
  
  const startHour = 8 + Math.floor(i / 2);
  const startMinute = i % 2 === 0 ? 0 : 30;
  const startTimeStr = `2026-07-31T${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}:00+07:00`;
  
  // Deterministic end time based on service
  const duration = mockServices.find(s => s.id === order.serviceId)?.durationMinutes || 60;
  // Convert to date just for manipulation
  const startObj = new Date(startTimeStr);
  const endObj = new Date(startObj.getTime() + duration * 60000);
  
  // Format end time safely back to ISO string with +07:00 manually to avoid JS timezone shifts
  const eHours = endObj.getUTCHours() + 7; // Convert to +07 manually for string
  const fixedHours = eHours >= 24 ? eHours - 24 : eHours;
  const hStr = fixedHours.toString().padStart(2, "0");
  const mStr = endObj.getUTCMinutes().toString().padStart(2, "0");
  const endTimeStr = `2026-07-31T${hStr}:${mStr}:00+07:00`;

  let status: Assignment["status"] = "COMPLETED";
  if (isDelayed) {
    status = "DELAYED";
  } else if (i >= 16) {
    status = "SCHEDULED";
  } else if (i >= 12) {
    status = "IN_PROGRESS";
  }

  return {
    id: `assign_${i + 1}`,
    orderId: order.id,
    employeeId,
    startTime: startTimeStr,
    endTime: endTimeStr,
    status,
  };
});
