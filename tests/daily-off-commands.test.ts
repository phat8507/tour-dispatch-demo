import { scryptSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { DispatchAssignmentGateway } from "@/domain/dispatch-assignment-gateway";
import { DispatchPersistenceError } from "@/domain/dispatch-assignment-gateway";
import { markEmployeeOff, unmarkEmployeeOff } from "@/server/dispatch-commands";
import { createSessionToken, type OwnerConfig } from "@/server/owner-auth";

const owner: OwnerConfig = { id: "owner", username: "ngoc", displayName: "Ngoc", passwordScrypt: `salt:${scryptSync("pw", "salt", 64).toString("hex")}`, sessionSecret: "safe-secret" };

function gateway(): DispatchAssignmentGateway {
  return {
    confirmAssignment: vi.fn(), overrideAssignment: vi.fn(), confirmAssignmentWithVersion: vi.fn(),
    overrideAssignmentWithVersion: vi.fn(), replaceOrderAssignmentWithVersion: vi.fn(), replaceOrderAssignmentWithOverrideAndVersion: vi.fn(), replaceOrderAssignment: vi.fn(), cancelOrder: vi.fn(),
    loadOrderAssignments: vi.fn(), listToursWithAssignedEmployees: vi.fn(),
    markEmployeeOff: vi.fn().mockResolvedValue({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-01-01" }),
    unmarkEmployeeOff: vi.fn().mockResolvedValue(undefined),
  };
}

describe("daily employee OFF commands", () => {
  it("authenticates before database work", async () => {
    const persistence = gateway();
    await expect(markEmployeeOff({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-01-01" }, undefined, { owner, gateway: persistence })).resolves.toMatchObject({ ok: false, error: "UNAUTHENTICATED" });
    expect(persistence.markEmployeeOff).not.toHaveBeenCalled();
  });

  it("rejects invalid employee and calendar-date input", async () => {
    const persistence = gateway();
    const token = createSessionToken(owner);
    await expect(markEmployeeOff({ employeeId: "bad", offDate: "2030-01-01" }, token, { owner, gateway: persistence })).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
    await expect(markEmployeeOff({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-02-30" }, token, { owner, gateway: persistence })).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });

  it("marks and unmarks through explicit idempotent gateway commands", async () => {
    const persistence = gateway();
    const token = createSessionToken(owner);
    await expect(markEmployeeOff({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-01-01" }, token, { owner, gateway: persistence })).resolves.toMatchObject({ ok: true });
    await expect(unmarkEmployeeOff({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-01-01" }, token, { owner, gateway: persistence })).resolves.toMatchObject({ ok: true });
    expect(persistence.markEmployeeOff).toHaveBeenCalledTimes(1);
    expect(persistence.unmarkEmployeeOff).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["EMPLOYEE_INACTIVE", "EMPLOYEE_INACTIVE"],
    ["EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS", "EMPLOYEE_HAS_ACTIVE_ASSIGNMENTS"],
    ["DAILY_OFF_LIMIT_REACHED", "DAILY_OFF_LIMIT_REACHED"],
  ] as const)("maps stable %s failures without leaking database details", async (persistenceCode, commandError) => {
    const persistence = gateway();
    persistence.markEmployeeOff = vi.fn().mockRejectedValue(new DispatchPersistenceError(persistenceCode, new Error("raw sql secret")));
    const result = await markEmployeeOff({ employeeId: "00000000-0000-4000-8000-000000000001", offDate: "2030-01-01" }, createSessionToken(owner), { owner, gateway: persistence });
    expect(result).toMatchObject({ ok: false, error: commandError });
    expect(JSON.stringify(result)).not.toContain("raw sql secret");
  });
});
