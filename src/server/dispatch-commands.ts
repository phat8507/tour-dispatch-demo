import { randomUUID } from "node:crypto";
import { DispatchPersistenceError } from "@/domain/dispatch-assignment-gateway";
import type { DispatchAssignmentGateway, VersionedDurableAssignment } from "@/domain/dispatch-assignment-gateway";
import { authenticateSession, type OwnerConfig } from "./owner-auth";
import type { EligibilityCause } from "./owner-dispatch-read-model";

export type DispatchCommandError = "UNAUTHENTICATED" | "UNAUTHORIZED" | "INVALID_INPUT" | "INVALID_INTERVAL" | "ORDER_NOT_FOUND" | "ORDER_NOT_ASSIGNABLE" | "EMPLOYEE_NOT_FOUND" | "EMPLOYEE_INACTIVE" | "EMPLOYEE_MISSING_REQUIRED_SKILL" | "STALE_VERSION" | "ASSIGNMENT_OVERLAP" | "PERSISTENCE_FAILURE";
export interface DispatchEligibility { evaluateEligibility(orderId: string, employeeId: string): Promise<EligibilityCause>; }
export interface ConfirmDispatchInput { orderId: string; employeeId: string; startsAt: string; endsAt: string; expectedOrderVersion: string; }
export interface OverrideDispatchInput extends ConfirmDispatchInput { reason: string; }
export type DispatchCommandResult = { ok: true; result: VersionedDurableAssignment } | { ok: false; error: DispatchCommandError; message: string };
const messages: Record<DispatchCommandError, string> = { UNAUTHENTICATED: "Vui lòng đăng nhập.", UNAUTHORIZED: "Bạn không có quyền thực hiện thao tác này.", INVALID_INPUT: "Thông tin điều phối không hợp lệ.", INVALID_INTERVAL: "Khoảng thời gian không hợp lệ.", ORDER_NOT_FOUND: "Không tìm thấy tour.", ORDER_NOT_ASSIGNABLE: "Tour này không thể được phân công.", EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên.", EMPLOYEE_INACTIVE: "Nhân viên đang không hoạt động.", EMPLOYEE_MISSING_REQUIRED_SKILL: "Nhân viên thiếu kỹ năng dịch vụ bắt buộc.", STALE_VERSION: "Dữ liệu tour đã thay đổi. Hãy tải lại trước khi xác nhận.", ASSIGNMENT_OVERLAP: "Lịch làm việc của nhân viên bị trùng.", PERSISTENCE_FAILURE: "Không thể lưu điều phối. Vui lòng thử lại." };
function failure(error: DispatchCommandError): DispatchCommandResult { return { ok: false, error, message: messages[error] }; }
function dates(input: ConfirmDispatchInput): { startsAt: Date; endsAt: Date } | undefined { const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt); return Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && input.orderId !== "" && input.employeeId !== "" && input.expectedOrderVersion !== "" ? { startsAt, endsAt } : undefined; }
function authorize(token: string | undefined, owner: OwnerConfig): DispatchCommandError | undefined { try { authenticateSession(token, owner); } catch (error) { return error instanceof Error && error.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : "UNAUTHENTICATED"; } }
function mapPersistence(error: unknown): DispatchCommandError { return error instanceof DispatchPersistenceError && (error.code === "STALE_VERSION" || error.code === "ASSIGNMENT_OVERLAP") ? error.code : "PERSISTENCE_FAILURE"; }
export async function confirmDispatchAssignment(input: ConfirmDispatchInput, token: string | undefined, dependencies: { owner: OwnerConfig; eligibility: DispatchEligibility; gateway: DispatchAssignmentGateway }): Promise<DispatchCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  const interval = dates(input); if (!interval) return failure("INVALID_INPUT");
  if (interval.startsAt >= interval.endsAt) return failure("INVALID_INTERVAL");
  const eligibility = await dependencies.eligibility.evaluateEligibility(input.orderId, input.employeeId); if (eligibility !== "ELIGIBLE") return failure(eligibility);
  try { return { ok: true, result: await dependencies.gateway.confirmAssignmentWithVersion({ assignmentId: randomUUID(), ...input, ...interval }) }; } catch (error) { return failure(mapPersistence(error)); }
}
export async function overrideDispatchAssignment(input: OverrideDispatchInput, token: string | undefined, dependencies: { owner: OwnerConfig; eligibility: DispatchEligibility; gateway: DispatchAssignmentGateway }): Promise<DispatchCommandResult> {
  const auth = authorize(token, dependencies.owner); if (auth) return failure(auth);
  const interval = dates(input); if (!interval || !input.reason.trim()) return failure("INVALID_INPUT");
  if (interval.startsAt >= interval.endsAt) return failure("INVALID_INTERVAL");
  const eligibility = await dependencies.eligibility.evaluateEligibility(input.orderId, input.employeeId); if (eligibility !== "ELIGIBLE") return failure(eligibility);
  try { return { ok: true, result: await dependencies.gateway.overrideAssignmentWithVersion({ assignmentId: randomUUID(), ...input, reason: input.reason.trim(), ...interval }) }; } catch (error) { return failure(mapPersistence(error)); }
}
