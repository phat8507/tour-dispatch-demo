/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions", () => ({ confirmOwnerDispatch: vi.fn(), overrideOwnerDispatch: vi.fn() }));
import { OwnerDispatchForm, OwnerDispatchStatus, OwnerSubmitButton } from "@/app/owner/OwnerDispatchForm";

describe("owner dispatch form", () => {
  afterEach(cleanup);
  it("renders only server-provided candidates and the permitted confirm fields", () => { const { container } = render(<OwnerDispatchForm orderId="00000000-0000-4000-8000-000000000001" orderVersion="version" requestedAt="2030-01-01T08:00:00.000Z" candidates={[{ id: "employee-uuid", name: "Server Employee" }]} />); expect(screen.getAllByRole("option").map((option) => option.textContent)).toContain("Server Employee"); expect(screen.queryByText("Yến")).toBeNull(); const confirm = container.querySelectorAll("form")[0]; for (const name of ["orderId", "employeeId", "startsAt", "endsAt", "expectedOrderVersion"]) expect(confirm.querySelector(`[name="${name}"]`)).not.toBeNull(); for (const name of ["ownerId", "role", "eligible", "isEligible", "score", "rank", "isOverride"]) expect(confirm.querySelector(`[name="${name}"]`)).toBeNull(); });
  it("keeps override separate with an explicit required reason", () => { const { container } = render(<OwnerDispatchForm orderId="00000000-0000-4000-8000-000000000001" orderVersion="version" requestedAt="2030-01-01T08:00:00.000Z" candidates={[]} />); const forms = container.querySelectorAll("form"); expect(forms).toHaveLength(2); expect(within(forms[0]).queryByPlaceholderText("Lý do ghi đè")).toBeNull(); expect(within(forms[1]).getByPlaceholderText("Lý do ghi đè").getAttribute("required")).not.toBeNull(); expect(screen.getByRole("button", { name: "Xác nhận phân công" }).hasAttribute("disabled")).toBe(false); expect(screen.getByRole("button", { name: "Ghi đè phân công" }).hasAttribute("disabled")).toBe(false); });
  it("renders safe stale and overlap status without infrastructure details", () => { render(<OwnerDispatchStatus confirmState={{ message: "Dữ liệu tour đã thay đổi. Hãy tải lại trước khi xác nhận." }} overrideState={{ message: "" }} />); expect(screen.getByRole("status").textContent).toContain("Dữ liệu tour đã thay đổi"); cleanup(); render(<OwnerDispatchStatus confirmState={{ message: "" }} overrideState={{ message: "Nhân viên đã có lịch trùng trong khoảng thời gian này." }} />); expect(screen.getByRole("status").textContent).toContain("lịch trùng"); expect(document.body.textContent).not.toMatch(/postgres|password|stack/i); });
  it("disables submit while a form action is pending", () => { render(<OwnerSubmitButton label="Xác nhận phân công" pending />); const button = screen.getByRole("button", { name: "Đang lưu…" }); expect(button.hasAttribute("disabled")).toBe(true); });
  it("keeps UNKNOWN skill fallbacks out of normal confirmation but available to explicit override", () => {
    const { container } = render(<OwnerDispatchForm orderId="00000000-0000-4000-8000-000000000001" orderVersion="version" requestedAt="2030-01-01T08:00:00.000Z" candidates={[{ id: "unknown", name: "Unknown Employee", requiresOverride: true }]} selectedEmployeeId="unknown" />);
    const forms = container.querySelectorAll("form");
    expect(within(forms[0]).getByRole("option", { name: /Unknown Employee/ }).hasAttribute("disabled")).toBe(true);
    expect(within(forms[1]).getByRole("option", { name: /Unknown Employee/ }).hasAttribute("disabled")).toBe(false);
  });
});
