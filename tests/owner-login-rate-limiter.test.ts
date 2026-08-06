import { describe, expect, it } from "vitest";
import { ownerLoginIp } from "@/server/owner-login-rate-limiter";

describe("owner login IP selection", () => {
  it("uses the left-most forwarded IP and keeps separate valid client addresses", () => {
    expect(ownerLoginIp(new Headers({ "x-forwarded-for": "198.51.100.10, 10.0.0.1" }))).toBe("198.51.100.10");
    expect(ownerLoginIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("uses one conservative fallback bucket for missing or malformed headers", () => {
    expect(ownerLoginIp(new Headers())).toBe("0.0.0.0");
    expect(ownerLoginIp(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBe("0.0.0.0");
  });
});
