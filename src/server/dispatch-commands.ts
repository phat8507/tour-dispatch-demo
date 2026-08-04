import { randomUUID } from "node:crypto";
import { DispatchPersistenceError } from "@/domain/dispatch-assignment-gateway";
import type { DispatchAssignmentGateway, VersionedDurableAssignment } from "@/domain/dispatch-assignment-gateway";
import { authenticateSession, type OwnerConfig } from "./owner-auth";
import type { EligibilityCause } from "./owner-dispatch-read-model";
import { isValidBusinessDate } from "@/domain/business-date";

export type DispatchCommandError =
  | "UNAUTHENTICATED" | "UNAUTHORIZED" | "INVALID_INPUT" | "INVALID_INTERVAL"
  | "ORDER_NOT_FOUND" | "ORDER_NOT_ASSIGNABLE" | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_INACTIVE" | "EMPLOYEE_MISSING_REQUIRED_SKILL" | "EMPLOYEE_OFF"
  | "EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS" | "DAILY_OFF_LIMIT_REACHED"
  | "STALE_VERSION" | "ASSIGNMENT_OVERLAP" | "PERSISTENCE_FAILURE";

export interface DispatchEligibility { evaluateEligibility(orderId: string, employeeId: string): Promise<EligibilityCause>; }
export interface ConfirmDispatchInput { orderId: string; employeeId: string; startsAt: string; endsAt: string; expectedOrderVersion: string; }
export interface OverrideDispatchInput extends ConfirmDispatchInput { reason: string; }
export interface DailyOffCommandInput { employeeId: string; offDate: string; }
export type DispatchCommandResult = { ok: true; result: VersionedDurableAssignment } | CommandFailure;
export type DailyOffCommandResult = { ok: true } | CommandFailure;
type CommandFailure = { ok: false; error: DispatchCommandError; message: string };

const messages: Record<DispatchCommandError, string> = {
  UNAUTHENTICATED: "Vui lòng đăng nhập.",
  UNAUTHORIZED: "Bạn không có quyền thực hiện thao tác này.",
  INVALID_INPUT: "Thông tin điều phối không hợp lệ.",
  INVALID_INTERVAL: "Khoảng thời gian không hợp lệ.",
  ORDER_NOT_FOUND: "Không tìm thấy tour.",
  ORDER_NOT_ASSIGNABLE: "Tour này không thể được phân công.",
  EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên.",
  EMPLOYEE_INACTIVE: "Nhân viên đang không hoạt động.",
  EMPLOYEE_MISSING_REQUIRED_SKILL: "Nhân viên thiếu kỹ năng dịch vụ bắt buộc.",
  EMPLOYEE_OFF: "Nhân viên đang nghỉ trong ngày của tour.",
  EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS: "Nhân viên còn phân công đang hoạt động trong ngày này.",
  DAILY_OFF_LIMIT_REACHED: "Ngày này đã có tối đa hai nhân viên nghỉ.",
  STALE_VERSION: "Dữ liệu tour đã thay đổi. Hãy tải lại trước khi xác nhận.",
  ASSIGNMENT_OVERLAP: "Lịch làm việc của nhân viên bị trùng.",
  PERSISTENCE_FAILURE: "Không thể lưu điều phối. Vui lòng thử lại.",
};

function failure(error: DispatchCommandError): CommandFailure { return { ok: false, error, message: messages[error] }; }
function dates(input: ConfirmDispatchInput): { startsAt: Date; endsAt: Date } | undefined {
  const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
  return Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && input.orderId !== "" && input.employeeId !== "" && input.expectedOrderVersion !== "" ? { startsAt, endsAt } : undefined;
}
function authorize(token: string | undefined, owner: OwnerConfig): DispatchCommandError | undefined {
  try { authenticateSession(token, owner); }
  catch (error) { return error instanceof Error && error.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : "UNAUTHENTICATED"; }
}
function mapPersistence(error: unknown): DispatchCommandError {
  if (!(error instanceof DispatchPersistenceError)) return "PERSISTENCE_FAILURE";
  const exposed = new Set<DispatchCommandError>(["STALE_VERSION", "ASSIGNMENT_OVERLAP", "EMPLOYEE_NOT_FOUND", "EMPLOYEE_INACTIVE", "EMPLOYEE_OFF", "EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS", "DAILY_OFF_LIMIT_REACHED"]);
  return exposed.has(error.code as DispatchCommandError) ? error.code as DispatchCommandError : "PERSISTENCE_FAILURE";
}
function validDailyOffInput(input: DailyOffCommandInput): boolean {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.employeeId)) return false;
  return isValidBusinessDate(input.offDate);
}

export async function confirmDispatchAssignment(input: ConfirmDispatchInput, token: string | undefined, dependencies: { owner: OwnerConfig; eligibility: DispatchEligibility; gateway: DispatchAssignmentGateway }): Promise<DispatchCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  const interval = dates(input); if (!interval) return failure("INVALID_INPUT");
  if (interval.startsAt >= interval.endsAt) return failure("INVALID_INTERVAL");
  const eligibility = await dependencies.eligibility.evaluateEligibility(input.orderId, input.employeeId); if (eligibility !== "ELIGIBLE") return failure(eligibility);
  try { return { ok: true, result: await dependencies.gateway.confirmAssignmentWithVersion({ assignmentId: randomUUID(), ...input, ...interval }) }; }
  catch (error) { return failure(mapPersistence(error)); }
}

export async function overrideDispatchAssignment(input: OverrideDispatchInput, token: string | undefined, dependencies: { owner: OwnerConfig; eligibility: DispatchEligibility; gateway: DispatchAssignmentGateway }): Promise<DispatchCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  const interval = dates(input); if (!interval || !input.reason.trim()) return failure("INVALID_INPUT");
  if (interval.startsAt >= interval.endsAt) return failure("INVALID_INTERVAL");
  const eligibility = await dependencies.eligibility.evaluateEligibility(input.orderId, input.employeeId); if (eligibility !== "ELIGIBLE") return failure(eligibility);
  try { return { ok: true, result: await dependencies.gateway.overrideAssignmentWithVersion({ assignmentId: randomUUID(), ...input, reason: input.reason.trim(), ...interval }) }; }
  catch (error) { return failure(mapPersistence(error)); }
}

export async function markEmployeeOff(input: DailyOffCommandInput, token: string | undefined, dependencies: { owner: OwnerConfig; gateway: DispatchAssignmentGateway }): Promise<DailyOffCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  if (!validDailyOffInput(input)) return failure("INVALID_INPUT");
  try { await dependencies.gateway.markEmployeeOff(input.employeeId, input.offDate); return { ok: true }; }
  catch (error) { return failure(mapPersistence(error)); }
}

export async function unmarkEmployeeOff(input: DailyOffCommandInput, token: string | undefined, dependencies: { owner: OwnerConfig; gateway: DispatchAssignmentGateway }): Promise<DailyOffCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  if (!validDailyOffInput(input)) return failure("INVALID_INPUT");
  try { await dependencies.gateway.unmarkEmployeeOff(input.employeeId, input.offDate); return { ok: true }; }
  catch (error) { return failure(mapPersistence(error)); }
}
