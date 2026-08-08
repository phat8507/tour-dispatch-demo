/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  confirm: vi.fn(),
  override: vi.fn(),
}));

vi.mock("@/app/actions", () => ({ confirmOwnerDispatch: actions.confirm, overrideOwnerDispatch: actions.override }));

import { OwnerDispatchForm, OwnerDispatchStatus, OwnerSubmitButton } from "@/app/owner/OwnerDispatchForm";

const formProps = {
  orderId: "00000000-0000-4000-8000-000000000001",
  orderVersion: "version",
  requestedAt: "2030-01-01T08:00:00.000Z",
};

describe("owner dispatch form", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders a single selected employee assignment payload", () => {
    const { container } = render(<OwnerDispatchForm {...formProps} candidates={[{ id: "employee-uuid", name: "Server Employee" }]} selectedEmployeeId="employee-uuid" />);
    const form = container.querySelector("form")!;
    expect(new FormData(form).get("employeeId")).toBe("employee-uuid");
    expect(form.querySelectorAll('[name="employeeId"]')).toHaveLength(1);
    expect(screen.queryByText("Yến")).toBeNull();
  });

  it("shows the technical-skill override prompt and blocks blank or whitespace-only reasons", () => {
    render(<OwnerDispatchForm {...formProps} candidates={[{ id: "emp1", name: "Mai", requiresOverride: true, serviceName: "Chăm sóc da" }]} selectedEmployeeId="emp1" />);
    expect(screen.getByText("Chưa có đánh giá tay nghề kỹ thuật của Mai cho dịch vụ Chăm sóc da. Bạn vẫn muốn chọn nhân viên này?")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Xác nhận chọn Mai" });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Lý do ghi đè"), { target: { value: "   " } });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Lý do ghi đè"), { target: { value: "Khách yêu cầu" } });
    expect(confirm.hasAttribute("disabled")).toBe(false);
  });

  it("cancels an UNKNOWN-skill selection without submitting an override", () => {
    const onCancelSelection = vi.fn();
    render(<OwnerDispatchForm {...formProps} candidates={[{ id: "emp1", name: "Mai", requiresOverride: true }]} selectedEmployeeId="emp1" onCancelSelection={onCancelSelection} />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancelSelection).toHaveBeenCalledOnce();
    expect(actions.override).not.toHaveBeenCalled();
  });

  it("submits a valid override reason and shows assignment success", async () => {
    actions.override.mockResolvedValue({ ok: true, message: "Đã lưu điều phối." });
    const { container } = render(<OwnerDispatchForm {...formProps} candidates={[{ id: "emp1", name: "Mai", requiresOverride: true, serviceName: "Chăm sóc da" }]} selectedEmployeeId="emp1" />);
    fireEvent.change(screen.getByPlaceholderText("Lý do ghi đè"), { target: { value: "Khách yêu cầu" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(actions.override).toHaveBeenCalledTimes(1));
    const payload = actions.override.mock.calls[0][1] as FormData;
    expect(payload.get("overrideReason")).toBe("Khách yêu cầu");
    expect(payload.get("employeeId")).toBe("emp1");
    expect(await screen.findByText("Đã phân Mai")).toBeTruthy();
  });

  it("invokes the normal assignment action and shows the selected employee on success", async () => {
    actions.confirm.mockResolvedValue({ ok: true, message: "Đã lưu điều phối." });
    const { container } = render(<OwnerDispatchForm {...formProps} candidates={[{ id: "emp1", name: "Mai" }]} selectedEmployeeId="emp1" />);
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(actions.confirm).toHaveBeenCalledTimes(1));
    expect((actions.confirm.mock.calls[0][1] as FormData).get("employeeId")).toBe("emp1");
    expect(await screen.findByText("Đã phân Mai")).toBeTruthy();
  });

  it("shows a Vietnamese failure and permits retry", async () => {
    actions.confirm.mockResolvedValue({ ok: false, message: "Không thể phân nhân viên. Vui lòng thử lại." });
    const { container } = render(<OwnerDispatchForm {...formProps} candidates={[{ id: "emp1", name: "Mai" }]} selectedEmployeeId="emp1" />);
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể phân nhân viên. Vui lòng thử lại.");
    const retry = screen.getByRole("button", { name: "Xác nhận phân công" });
    expect(retry.hasAttribute("disabled")).toBe(false);
    fireEvent.submit(form);
    await waitFor(() => expect(actions.confirm).toHaveBeenCalledTimes(2));
  });

  it("renders safe stale and overlap status without infrastructure details", () => {
    render(<OwnerDispatchStatus confirmState={{ message: "Dữ liệu tour đã thay đổi. Hãy tải lại trước khi xác nhận." }} overrideState={{ message: "" }} />);
    expect(screen.getByRole("status").textContent).toContain("Dữ liệu tour đã thay đổi");
    expect(document.body.textContent).not.toMatch(/postgres|password|stack/i);
  });

  it("disables submit while a form action is pending", () => {
    render(<OwnerSubmitButton label="Xác nhận phân công" pending />);
    const button = screen.getByRole("button", { name: "Đang lưu…" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
