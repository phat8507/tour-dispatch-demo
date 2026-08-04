import { describe, expect, it } from "vitest";
import { businessDateInHoChiMinh, isValidBusinessDate } from "@/domain/business-date";

describe("Asia/Ho_Chi_Minh business dates", () => {
  it("crosses the calendar boundary at UTC+7 rather than UTC midnight", () => {
    expect(businessDateInHoChiMinh(new Date("2030-01-01T16:59:59Z"))).toBe("2030-01-01");
    expect(businessDateInHoChiMinh(new Date("2030-01-01T17:00:00Z"))).toBe("2030-01-02");
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(isValidBusinessDate("2030-02-28")).toBe(true);
    expect(isValidBusinessDate("2030-02-30")).toBe(false);
    expect(isValidBusinessDate("2030-2-3")).toBe(false);
  });
});
