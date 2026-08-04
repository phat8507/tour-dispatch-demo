import { createHmac, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authenticateSession, clearSessionCookie, createSessionToken, sessionCookie, verifyOwnerPassword, type OwnerConfig } from "@/server/owner-auth";

const config: OwnerConfig = { id: "owner-1", username: "ngoc", displayName: "Anh Ngoc", passwordScrypt: `salt:${scryptSync("correct", "salt", 64).toString("hex")}`, sessionSecret: "session-secret" };

describe("single owner authentication", () => {
  it("rejects missing, malformed, invalid, expired, wrong-role, and wrong-owner sessions", () => {
    expect(() => authenticateSession(undefined, config)).toThrow("UNAUTHENTICATED");
    expect(() => authenticateSession("bad", config)).toThrow("UNAUTHENTICATED");
    const token = createSessionToken(config, 1000);
    expect(() => authenticateSession(`${token}x`, config, 1001)).toThrow("UNAUTHENTICATED");
    expect(() => authenticateSession(token, config, 1000 + 8 * 60 * 60 * 1000)).toThrow("UNAUTHENTICATED");
    const payload = Buffer.from(JSON.stringify({ ownerId: "other", role: "OWNER", expiresAt: Date.now() + 1000 })).toString("base64url");
    const forged = `${payload}.${createHmac("sha256", config.sessionSecret).update(payload).digest("base64url")}`;
    expect(() => authenticateSession(forged, config)).toThrow("UNAUTHORIZED");
  });

  it("accepts the configured owner, verifies passwords, and uses safe cookie policy", async () => {
    const token = createSessionToken(config);
    expect(authenticateSession(token, config).ownerId).toBe(config.id);
    await expect(verifyOwnerPassword("correct", config)).resolves.toBe(true);
    await expect(verifyOwnerPassword("wrong", config)).resolves.toBe(false);
    expect(sessionCookie(token, true)).toContain("HttpOnly; SameSite=Lax; Max-Age=28800; Secure");
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});
