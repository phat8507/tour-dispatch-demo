import { createHmac, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for owner smoke.");
const port = await new Promise((resolve, reject) => { const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); if (!address || typeof address === "string") return reject(new Error("Could not allocate smoke port.")); const selected = address.port; server.close((error) => error ? reject(error) : resolve(selected)); }); });
const ownerId = "smoke-owner"; const username = "smoke-owner"; const password = "smoke-password"; const salt = "smoke-salt"; const secret = "smoke-session-secret-at-least-32-bytes";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: process.cwd(), env: { ...process.env, OWNER_ID: ownerId, OWNER_USERNAME: username, OWNER_DISPLAY_NAME: "Smoke Owner", OWNER_PASSWORD_SCRYPT: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, SESSION_SECRET: secret }, stdio: ["ignore", "ignore", "ignore"], windowsHide: true });
const base = `http://127.0.0.1:${port}`;
function sessionCookie() { const payload = Buffer.from(JSON.stringify({ ownerId, role: "OWNER", expiresAt: Date.now() + 60_000 })).toString("base64url"); const signature = createHmac("sha256", secret).update(payload).digest("base64url"); return `dispatch_session=${payload}.${signature}`; }
async function ready() { const deadline = Date.now() + 20_000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error("Smoke server exited before readiness."); try { const response = await fetch(`${base}/login`); if (response.status === 200) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error("Smoke server readiness timeout."); }
function clean(body) { for (const value of [process.env.DATABASE_URL, secret, `${salt}:${scryptSync(password, salt, 64).toString("hex")}`]) if (value && body.includes(value)) throw new Error("Smoke response exposed protected configuration."); if (/password raw sql|Error:\s|at\s+\w+\s*\(/i.test(body)) throw new Error("Smoke response exposed internal error details."); }
try {
  await ready();
  const login = await fetch(`${base}/login`); if (login.status !== 200) throw new Error("Login page smoke failed."); clean(await login.text());
  const anonymous = await fetch(`${base}/owner`, { redirect: "manual" }); if (![307, 308].includes(anonymous.status) || !anonymous.headers.get("location")?.endsWith("/login")) throw new Error("Owner guard smoke failed.");
  const owner = await fetch(`${base}/owner`, { headers: { cookie: sessionCookie() } }); if (owner.status !== 200) throw new Error("Authenticated owner smoke failed."); const ownerBody = await owner.text(); clean(ownerBody); if (!ownerBody.includes("Điều phối tour") && !ownerBody.includes("Không thể tải dữ liệu điều phối")) throw new Error("Owner page did not render a durable or safe state."); if (ownerBody.includes("Khách demo")) throw new Error("Owner page fell back to mock data.");
  process.stdout.write(`owner smoke passed on port ${port}: login, guard, authenticated owner, secret scan\n`);
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await new Promise((resolve) => { if (child.exitCode !== null) return resolve(); const timer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 5_000); child.once("exit", () => { clearTimeout(timer); resolve(); }); });
}
