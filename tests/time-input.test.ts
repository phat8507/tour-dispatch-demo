import { describe, it, expect } from "vitest";
import { formatHumanReadable, applyQuickAction, parseRequestedTime, buildRequestedTime } from "../src/domain/time-input";

describe("time-input domain", () => {
  it("formatHumanReadable returns correct Vietnamese string", () => {
    // 2026-07-31 is a Friday
    expect(formatHumanReadable("2026-07-31T12:00:00+07:00")).toBe("Thứ Sáu, 31/07/2026 lúc 12:00");
    // 2026-08-01 is a Saturday
    expect(formatHumanReadable("2026-08-01T08:15:00+07:00")).toBe("Thứ Bảy, 01/08/2026 lúc 08:15");
  });

  it("parseRequestedTime splits ISO into date, hour, minute", () => {
    expect(parseRequestedTime("2026-07-31T12:30:00+07:00")).toEqual({
      date: "2026-07-31",
      hour: "12",
      minute: "30",
    });
  });

  it("buildRequestedTime creates valid +07:00 ISO string", () => {
    expect(buildRequestedTime("2026-07-31", "12", "30")).toBe("2026-07-31T12:30:00+07:00");
  });

  describe("applyQuickAction", () => {
    it("adds 30 minutes to demo time and rounds up to next 15-minute interval", () => {
      // DEMO_TIME is 10:00
      // +30m -> 10:30 (already on 15m boundary, so it stays 10:30)
      expect(applyQuickAction(30, "2026-07-31T10:00:00+07:00")).toBe("2026-07-31T10:30:00+07:00");
    });

    it("adds 60 minutes to demo time", () => {
      expect(applyQuickAction(60, "2026-07-31T10:00:00+07:00")).toBe("2026-07-31T11:00:00+07:00");
    });

    it("adds 120 minutes to demo time", () => {
      expect(applyQuickAction(120, "2026-07-31T10:00:00+07:00")).toBe("2026-07-31T12:00:00+07:00");
    });

    it("rounds upward to next 15-minute interval if not exact", () => {
      // Base time 10:05
      // +30m -> 10:35
      // Round up -> 10:45
      expect(applyQuickAction(30, "2026-07-31T10:05:00+07:00")).toBe("2026-07-31T10:45:00+07:00");
    });

    it("crossing an hour boundary", () => {
      // Base time 10:40
      // +30m -> 11:10
      // Round up -> 11:15
      expect(applyQuickAction(30, "2026-07-31T10:40:00+07:00")).toBe("2026-07-31T11:15:00+07:00");
    });

    it("crossing midnight", () => {
      // Base time 2026-07-31 23:30
      // +60m -> 2026-08-01 00:30
      expect(applyQuickAction(60, "2026-07-31T23:30:00+07:00")).toBe("2026-08-01T00:30:00+07:00");
    });
  });
});
