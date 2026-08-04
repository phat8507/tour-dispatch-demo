import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type OwnerAuthError = "UNAUTHENTICATED" | "UNAUTHORIZED";

export interface OwnerConfig {
  id: string;
  username: string;
  displayName: string;
  passwordScrypt: string;
  sessionSecret: string;
}

export interface OwnerSession { ownerId: string; role: "OWNER"; expiresAt: number; }

export function readOwnerConfig(environment: NodeJS.ProcessEnv = process.env): OwnerConfig {
  const id = environment.OWNER_ID;
  const username = environment.OWNER_USERNAME;
  const displayName = environment.OWNER_DISPLAY_NAME;
  const passwordScrypt = environment.OWNER_PASSWORD_SCRYPT;
  const sessionSecret = environment.SESSION_SECRET;
  if (!id || !username || !displayName || !passwordScrypt || !sessionSecret) throw new Error("Owner authentication is not configured.");
  return { id, username, displayName, passwordScrypt, sessionSecret };
}

function sign(encodedPayload: string, secret: string): string { return createHmac("sha256", secret).update(encodedPayload).digest("base64url"); }

export function createSessionToken(config: OwnerConfig, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ownerId: config.id, role: "OWNER", expiresAt: now + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, config.sessionSecret)}`;
}

export function authenticateSession(token: string | undefined, config: OwnerConfig, now = Date.now()): OwnerSession {
  if (!token) throw new Error("UNAUTHENTICATED");
  const [encodedPayload, receivedSignature, extra] = token.split(".");
  if (!encodedPayload || !receivedSignature || extra) throw new Error("UNAUTHENTICATED");
  const expectedSignature = sign(encodedPayload, config.sessionSecret);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("UNAUTHENTICATED");
  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") throw new Error("invalid");
    const { ownerId, role, expiresAt } = payload as Partial<OwnerSession>;
    if (typeof expiresAt !== "number" || expiresAt <= now) throw new Error("UNAUTHENTICATED");
    if (role !== "OWNER" || ownerId !== config.id) throw new Error("UNAUTHORIZED");
    return { ownerId, role, expiresAt };
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHENTICATED" || error.message === "UNAUTHORIZED")) throw error;
    throw new Error("UNAUTHENTICATED");
  }
}

export async function verifyOwnerPassword(password: string, config: OwnerConfig): Promise<boolean> {
  const [salt, expectedHash] = config.passwordScrypt.split(":");
  if (!salt || !expectedHash) return false;
  const derived = Buffer.from(await scrypt(password, salt, 64) as ArrayBuffer);
  const expected = Buffer.from(expectedHash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function sessionCookie(token: string, production = process.env.NODE_ENV === "production"): string {
  return `dispatch_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${production ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string { return "dispatch_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"; }
