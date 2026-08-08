"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { authenticateSession, createSessionToken, verifyOwnerPassword } from "@/server/owner-auth";
import { confirmDispatchAssignment, markEmployeeOff, overrideDispatchAssignment, unmarkEmployeeOff, upsertEmployeeRoutingOrigin, removeEmployeeRoutingOrigin, replaceDispatchAssignment, overrideReplaceDispatchAssignment } from "@/server/dispatch-commands";
import { ownerLoginIp } from "@/server/owner-login-rate-limiter";
import { randomUUID } from "node:crypto";

export type OwnerMutationState = { message: string; ok: boolean };
function field(formData: FormData, name: string): string { const value = formData.get(name); return typeof value === "string" ? value : ""; }
function validUuid(value: string): boolean { return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value); }
function actionState(result: { ok: true } | { ok: false; message: string }): OwnerMutationState { return result.ok ? { ok: true, message: "Đã lưu điều phối." } : { ok: false, message: result.message }; }
function dailyOffInput(formData: FormData) { return { employeeId: field(formData, "employeeId"), offDate: field(formData, "offDate") }; }
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

export async function markOwnerEmployeeOff(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const input = dailyOffInput(formData);
  const dependencies = createDispatchServerDependencies(); const token = (await cookies()).get("dispatch_session")?.value;
  const result = await markEmployeeOff(input, token, dependencies);
  if (result.ok) revalidatePath("/owner"); return actionState(result);
}

export async function unmarkOwnerEmployeeOff(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const input = dailyOffInput(formData);
  const dependencies = createDispatchServerDependencies(); const token = (await cookies()).get("dispatch_session")?.value;
  const result = await unmarkEmployeeOff(input, token, dependencies);
  if (result.ok) revalidatePath("/owner"); return actionState(result);
}

export async function upsertOwnerRoutingOrigin(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const employeeId = field(formData, "employeeId");
  const latStr = field(formData, "latitude");
  const lngStr = field(formData, "longitude");
  const label = field(formData, "label");
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);
  if (!validUuid(employeeId)) return { ok: false, message: "Thông tin nhân viên không hợp lệ." };
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ok: false, message: "Toạ độ không hợp lệ." };

  const dependencies = createDispatchServerDependencies();
  const token = (await cookies()).get("dispatch_session")?.value;
  const result = await upsertEmployeeRoutingOrigin({ employeeId, latitude, longitude, label: label || null }, token, dependencies);
  if (result.ok) revalidatePath("/owner");
  return actionState(result);
}

export async function removeOwnerRoutingOrigin(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const employeeId = field(formData, "employeeId");
  if (!validUuid(employeeId)) return { ok: false, message: "Thông tin nhân viên không hợp lệ." };

  const dependencies = createDispatchServerDependencies();
  const token = (await cookies()).get("dispatch_session")?.value;
  const result = await removeEmployeeRoutingOrigin({ employeeId }, token, dependencies);
  if (result.ok) revalidatePath("/owner");
  return actionState(result);
}
export async function replaceOwnerDispatch(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> { const input = await mutationInput(formData); const oldAssignmentId = field(formData, "oldAssignmentId"); if (!input || !validUuid(oldAssignmentId)) return { ok: false, message: "Thông tin điều phối không hợp lệ." }; const d = createDispatchServerDependencies(); const result = await replaceDispatchAssignment({ ...input, oldAssignmentId }, (await cookies()).get("dispatch_session")?.value, { ...d, eligibility: d.readModel }); if (result.ok) revalidatePath("/owner"); return actionState(result); }
export async function overrideReplaceOwnerDispatch(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> { const input = await mutationInput(formData); const oldAssignmentId = field(formData, "oldAssignmentId"); const reason = field(formData, "overrideReason"); if (!input || !validUuid(oldAssignmentId) || !reason.trim()) return { ok: false, message: "Cần nhập lý do ghi đè." }; const d = createDispatchServerDependencies(); const result = await overrideReplaceDispatchAssignment({ ...input, oldAssignmentId, reason }, (await cookies()).get("dispatch_session")?.value, { ...d, eligibility: d.readModel }); if (result.ok) revalidatePath("/owner"); return actionState(result); }

export async function createOwnerTour(_: OwnerMutationState, formData: FormData): Promise<OwnerMutationState> {
  const customerName = field(formData, "customerName").trim(); const customerPhone = field(formData, "customerPhone").trim(); const customerAddress = field(formData, "customerAddress").trim();
  const date = field(formData, "date"); const time = field(formData, "time"); const orderType = field(formData, "orderType"); const serviceId = field(formData, "serviceId"); const notes = field(formData, "notes"); const fulfillment = field(formData, "fulfillment"); const branchId = field(formData, "branchId"); const customerLatitude = Number(field(formData, "customerLatitude")); const customerLongitude = Number(field(formData, "customerLongitude"));
  const requestedAt = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00+07:00` : "";
  if (!customerName || !requestedAt || !validUuid(serviceId) || !["NEW_TOUR", "MILEAGE"].includes(orderType) || !["HOME", "BRANCH"].includes(fulfillment) || (fulfillment === "HOME" && (!customerAddress || !Number.isFinite(customerLatitude) || customerLatitude < -90 || customerLatitude > 90 || !Number.isFinite(customerLongitude) || customerLongitude < -180 || customerLongitude > 180)) || (fulfillment === "BRANCH" && !["CS1", "CS2"].includes(branchId))) return { ok: false, message: "Chưa xác định được vị trí của địa chỉ này. Vui lòng chọn một địa chỉ trong danh sách gợi ý." };
  const dependencies = createDispatchServerDependencies(); const token = (await cookies()).get("dispatch_session")?.value;
  try {
    authenticateSession(token, dependencies.owner);
    await dependencies.gateway.createOwnerTour({ orderId: randomUUID(), customerName, customerPhone, customerAddress, customerLatitude: fulfillment === "HOME" ? customerLatitude : null, customerLongitude: fulfillment === "HOME" ? customerLongitude : null, requestedAt, orderType: orderType as "NEW_TOUR" | "MILEAGE", serviceId, notes, fulfillment: fulfillment as "HOME" | "BRANCH", branchId });
    revalidatePath("/owner"); return { ok: true, message: "Đã tạo tour." };
  } catch { return { ok: false, message: "Không thể lưu tour. Vui lòng thử lại." }; }
}

export async function login(formData: FormData): Promise<void> {
  const dependencies = createDispatchServerDependencies();
  const username = formData.get("username"); const password = formData.get("password");
  const ip = ownerLoginIp(await headers());
  if (await dependencies.loginRateLimiter.isLocked(ip)) redirect("/login?error=invalid");
  const passwordMatches = await verifyOwnerPassword(typeof password === "string" ? password : "", dependencies.owner);
  const valid = typeof username === "string" && typeof password === "string" && username === dependencies.owner.username && passwordMatches;
  if (!valid) {
    await dependencies.loginRateLimiter.recordFailure(ip);
    redirect("/login?error=invalid");
  }
  await dependencies.loginRateLimiter.reset(ip);
  (await cookies()).set("dispatch_session", createSessionToken(dependencies.owner), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60, path: "/" });
  redirect("/owner");
}
export async function logout(): Promise<void> { (await cookies()).set("dispatch_session", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" }); redirect("/login"); }
