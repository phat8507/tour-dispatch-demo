"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { createSessionToken, verifyOwnerPassword } from "@/server/owner-auth";
import { confirmDispatchAssignment, overrideDispatchAssignment, type DispatchCommandResult } from "@/server/dispatch-commands";

export type OwnerMutationState = { message: string; ok: boolean };
function field(formData: FormData, name: string): string { const value = formData.get(name); return typeof value === "string" ? value : ""; }
function validUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function actionState(result: DispatchCommandResult): OwnerMutationState { return result.ok ? { ok: true, message: "Đã lưu điều phối." } : { ok: false, message: result.message }; }
async function mutationInput(formData: FormData) {
  const orderId = field(formData, "orderId"); const employeeId = field(formData, "employeeId"); const startsAt = field(formData, "startsAt"); const endsAt = field(formData, "endsAt"); const expectedOrderVersion = field(formData, "expectedOrderVersion");
  const start = new Date(startsAt); const end = new Date(endsAt);
  if (!validUuid(orderId) || !validUuid(employeeId) || !expectedOrderVersion || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return undefined;
  return { orderId, employeeId, startsAt, endsAt, expectedOrderVersion };
}
export async function confirmOwnerDispatch(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const input = await mutationInput(formData); if (!input) return { ok: false, message: "Thông tin điều phối không hợp lệ." };
  const dependencies = createDispatchServerDependencies(); const token = (await cookies()).get("dispatch_session")?.value;
  const result = await confirmDispatchAssignment(input, token, { ...dependencies, eligibility: dependencies.readModel });
  if (result.ok) revalidatePath("/owner"); return actionState(result);
}
export async function overrideOwnerDispatch(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const input = await mutationInput(formData); const reason = field(formData, "overrideReason"); if (!input || !reason.trim()) return { ok: false, message: "Cần nhập lý do ghi đè." };
  const dependencies = createDispatchServerDependencies(); const token = (await cookies()).get("dispatch_session")?.value;
  const result = await overrideDispatchAssignment({ ...input, reason: reason.trim() }, token, { ...dependencies, eligibility: dependencies.readModel });
  if (result.ok) revalidatePath("/owner"); return actionState(result);
}

export async function login(formData: FormData): Promise<void> {
  const dependencies = createDispatchServerDependencies();
  const username = formData.get("username"); const password = formData.get("password");
  if (typeof username !== "string" || typeof password !== "string" || username !== dependencies.owner.username || !await verifyOwnerPassword(password, dependencies.owner)) redirect("/login?error=invalid");
  (await cookies()).set("dispatch_session", createSessionToken(dependencies.owner), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60, path: "/" });
  redirect("/owner");
}
export async function logout(): Promise<void> { (await cookies()).set("dispatch_session", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" }); redirect("/login"); }
