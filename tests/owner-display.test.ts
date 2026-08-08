import { describe, expect, it } from "vitest";
import { formatOwnerDateTime } from "@/features/dispatch/owner-display";

describe("owner date display", () => {
  it("renders persisted timestamps in Asia/Ho_Chi_Minh without a raw UTC suffix", () => {
    const displayed = formatOwnerDateTime("2030-01-01T08:00:00.000Z");
    expect(displayed).toContain("15:00");
    expect(displayed).not.toContain("+00");
  });
});
