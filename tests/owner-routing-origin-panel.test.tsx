/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OwnerRoutingOriginPanel } from "@/app/owner/OwnerRoutingOriginPanel";

describe("owner routing-origin panel", () => {
  afterEach(cleanup);

  it("keeps advanced settings and coordinate fields collapsed until custom editing is explicit", () => {
    render(<OwnerRoutingOriginPanel origins={[{ employeeId: "employee", employeeName: "Employee", isActive: true, latitude: null, longitude: null, label: null, updatedAt: null }]} />);
    const settings = screen.getByText("Cài đặt nâng cao").closest("details");
    expect(settings?.open).toBe(false);
    expect(screen.queryByLabelText("Vĩ độ")).toBeNull();
    expect(screen.getByText(/Cơ sở mặc định/)).toBeTruthy();
    settings?.setAttribute("open", "");
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập điểm riêng" }));
    expect(screen.getByLabelText("Vĩ độ")).toBeTruthy();
    expect(screen.getByLabelText("Kinh độ")).toBeTruthy();
  });
});
