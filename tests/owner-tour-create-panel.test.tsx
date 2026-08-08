/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions", () => ({ createOwnerTour: vi.fn() }));
vi.mock("@/app/owner/OwnerAddressAutocomplete", () => ({
  OwnerAddressAutocomplete: () => <div data-testid="address-autocomplete">Địa chỉ khách</div>,
}));

import { OwnerTourCreatePanel } from "@/app/owner/OwnerTourCreatePanel";

describe("owner tour create panel", () => {
  afterEach(cleanup);

  it("keeps branch fulfillment independent from home-address pin selection", () => {
    render(
      <OwnerTourCreatePanel
        selectedDate="2030-01-01"
        services={[{ id: "00000000-0000-4000-8000-000000000001", name: "Dịch vụ", durationMinutes: 60 }]}
        branches={[
          { id: "cs1", branchId: "CS1", name: "Cơ sở 1" },
          { id: "cs2", branchId: "CS2", name: "Cơ sở 2" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tạo tour mới" }));
    expect(screen.getByTestId("address-autocomplete")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Tại tiệm" }));

    expect(screen.queryByTestId("address-autocomplete")).toBeNull();
    expect(screen.getByRole("option", { name: "CS1 — Cơ sở 1" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "CS2 — Cơ sở 2" })).toBeTruthy();
  });
});
