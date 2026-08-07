/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerAddressAutocomplete } from "@/app/owner/OwnerAddressAutocomplete";

describe("owner address autocomplete", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("persists a selected provider result in hidden coordinate fields", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions: [{ id: "place", address: "123 Nguyễn Trãi, TP.HCM", latitude: 10.76, longitude: 106.68 }] }), { status: 200 })));
    const { container } = render(<OwnerAddressAutocomplete />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nguyễn Trãi" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole("option", { name: "123 Nguyễn Trãi, TP.HCM" }));
    expect(container.querySelector('[name="customerLatitude"]')?.getAttribute("value")).toBe("10.76");
    expect(container.querySelector('[name="customerLongitude"]')?.getAttribute("value")).toBe("106.68");
    expect(screen.queryByText(/Chưa xác định được vị trí/)).toBeNull();
  });

  it("shows the Vietnamese unresolved and provider-unavailable states", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions: [] }), { status: 200 })));
    const { rerender } = render(<OwnerAddressAutocomplete />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Địa chỉ lạ" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByText(/Chưa xác định được vị trí/)).toBeTruthy();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    rerender(<OwnerAddressAutocomplete />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Địa chỉ khác" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByText(/Không thể xác định vị trí lúc này/)).toBeTruthy();
  });
});
