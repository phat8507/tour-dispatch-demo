/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pickerProps = vi.hoisted(() => ({ current: null as null | { onConfirm: (location: { lat: number; lon: number }) => void } }));

vi.mock("@/app/owner/OwnerLocationPinPicker", () => ({
  OwnerLocationPinPicker: ({ open, onConfirm }: { open: boolean; onConfirm: (location: { lat: number; lon: number }) => void }) => {
    if (!open) return null;
    pickerProps.current = { onConfirm };
    return <div aria-label="Chọn vị trí trên bản đồ"><button type="button" onClick={() => onConfirm({ lat: 10.76, lon: 106.68 })}>Xác nhận vị trí thử nghiệm</button></div>;
  },
}));

import { OwnerAddressAutocomplete } from "@/app/owner/OwnerAddressAutocomplete";

describe("owner address autocomplete", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    pickerProps.current = null;
  });

  it("persists a selected autocomplete result in the existing coordinate fields", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: [{ id: "place", address: "123 Nguyễn Trãi, TP.HCM", latitude: 10.76, longitude: 106.68 }] }) }));
    const { container } = render(<OwnerAddressAutocomplete />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nguyễn Trãi" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole("option", { name: "123 Nguyễn Trãi, TP.HCM" }));

    expect(container.querySelector('[name="customerLatitude"]')?.getAttribute("value")).toBe("10.76");
    expect(container.querySelector('[name="customerLongitude"]')?.getAttribute("value")).toBe("106.68");
  });

  it("opens the local picker and keeps typed address plus pin coordinates in the form payload", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) }));
    const { container } = render(<form><OwnerAddressAutocomplete /></form>);
    const address = "Địa chỉ Ngọc đã nhập";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: address } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole("button", { name: "Không tìm thấy đúng địa chỉ? Chọn vị trí trên bản đồ" }));

    expect(screen.getByLabelText("Chọn vị trí trên bản đồ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vị trí thử nghiệm" }));

    const formData = new FormData(container.querySelector("form")!);
    expect(formData.get("customerAddress")).toBe(address);
    expect(formData.get("customerLatitude")).toBe("10.76");
    expect(formData.get("customerLongitude")).toBe("106.68");
    expect(screen.getByText("Đã chọn vị trí trên bản đồ")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();
  });

  it("offers the local picker when geocoding is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    render(<OwnerAddressAutocomplete />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Địa chỉ lạ" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(screen.getByText("Không thể xác định vị trí lúc này. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Không tìm thấy đúng địa chỉ? Chọn vị trí trên bản đồ" })).toBeTruthy();
  });
});
