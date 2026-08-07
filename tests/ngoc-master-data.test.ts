import { describe, expect, it } from "vitest";

const data = await import("../scripts/ngoc-master-data.mjs");

describe("Ngọc master data", () => {
  it("contains the source-supported branches, services, and employees without a technical skill matrix", () => {
    expect(data.ngocMasterData.branches.map((branch: { branchId: string }) => branch.branchId)).toEqual(["CS1", "CS2"]);
    expect(data.ngocMasterData.services.map((service: { name: string }) => service.name)).toEqual(["Bi", "Nhũ", "Mông", "Bẹn", "Môi", "Mày"]);
    expect(data.ngocMasterData.employees).toHaveLength(13);
    expect(data.ngocMasterData.employees.map((employee: { name: string }) => employee.name)).toEqual(["My", "Hiền", "Quỳnh", "Nhung", "Ngọc 2", "Anh", "Hậu", "Bình", "Yến", "Thương", "Mơ", "Lan", "Thiện"]);
    expect(data.ngocMasterData.employees.filter((employee: { closingLevelSource: string }) => employee.closingLevelSource === "Bth / Yếu")).toHaveLength(2);
  });
});
