/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({ markOwnerEmployeeOff: vi.fn(), unmarkOwnerEmployeeOff: vi.fn() }));
import { OwnerDailyOffPanel } from "@/app/owner/OwnerDailyOffPanel";

describe("owner daily OFF panel", () => {
  afterEach(cleanup);

  it("stays collapsed by default", () => {
    render(<OwnerDailyOffPanel selectedDate="2030-01-01" employees={[
      { id: "e1", name: "Employee One", isActive: true, isOff: true },
    ]} offCount={1} maxOff={2} />);
    const details = screen.getByText("Quản lý nhân viên nghỉ").closest("details");
    expect(details?.open).toBe(false);
  });

  it("shows the selected date, canonical count, and ON/OFF state", () => {
    render(<OwnerDailyOffPanel selectedDate="2030-01-01" employees={[
      { id: "e1", name: "Employee One", isActive: true, isOff: true },
      { id: "e2", name: "Employee Two", isActive: true, isOff: false },
    ]} offCount={1} maxOff={2} />);
    expect(screen.getByText("1/2 người nghỉ")).toBeTruthy();
    expect(screen.getByText("Employee One").parentElement?.textContent).toContain("Đang nghỉ");
    expect(screen.getByText("Employee Two").parentElement?.textContent).toContain("Đang làm");
  });

  it("uses named mark/unmark forms and disables a third OFF action at the limit", () => {
    const { container } = render(<OwnerDailyOffPanel selectedDate="2030-01-01" employees={[
      { id: "e1", name: "Employee One", isActive: true, isOff: true },
      { id: "e2", name: "Employee Two", isActive: true, isOff: true },
      { id: "e3", name: "Employee Three", isActive: true, isOff: false },
    ]} offCount={2} maxOff={2} />);
    expect(container.querySelectorAll('input[name="employeeId"]')).toHaveLength(3);
    expect(container.querySelectorAll('input[type="hidden"][name="offDate"]')).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Đánh dấu nghỉ.*Employee Three/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("button", { name: /Bỏ nghỉ/ })).toHaveLength(2);
  });
});
