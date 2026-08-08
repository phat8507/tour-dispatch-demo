"use client";

import { useEffect, useRef, useState } from "react";
import { OwnerLocationPinPicker } from "./OwnerLocationPinPicker";

type Suggestion = { id: string; address: string; latitude: number; longitude: number };

export function OwnerAddressAutocomplete() {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    if (selected || value.trim().length < 3) return;
    const current = ++sequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        const payload: unknown = await response.json();
        if (current !== sequence.current) return;
        if (!response.ok || typeof payload !== "object" || payload === null || !("suggestions" in payload) || !Array.isArray(payload.suggestions)) {
          setUnavailable(true);
          setSuggestions([]);
          return;
        }
        setSuggestions(payload.suggestions as Suggestion[]);
        setUnavailable(false);
      } catch {
        if (current === sequence.current) {
          setUnavailable(true);
          setSuggestions([]);
        }
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [selected, value]);

  const needsLocation = value.trim().length > 0 && !selected;

  return (
    <label className="sm:col-span-2 text-sm font-medium text-slate-700">
      Địa chỉ khách
      <input
        required
        name="customerAddress"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSelected(null);
          setSuggestions([]);
          setUnavailable(false);
        }}
        autoComplete="off"
        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"
      />
      {selected && <>
        <input type="hidden" name="customerLatitude" value={selected.latitude} />
        <input type="hidden" name="customerLongitude" value={selected.longitude} />
      </>}
      {suggestions.length > 0 && <ul role="listbox" className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {suggestions.map((suggestion) => <li key={suggestion.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => {
              setSelected(suggestion);
              setValue(suggestion.address);
              setSuggestions([]);
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
          >
            {suggestion.address}
          </button>
        </li>)}
      </ul>}
      {needsLocation && <>
        <p role="status" className="mt-1 text-sm text-amber-800">
          {unavailable ? "Không thể xác định vị trí lúc này. Vui lòng thử lại." : "Chưa xác định được vị trí của địa chỉ này. Vui lòng chọn một địa chỉ trong danh sách gợi ý."}
        </p>
        <button type="button" onClick={() => setPinOpen(true)}>Không tìm thấy đúng địa chỉ? Chọn vị trí trên bản đồ</button>
      </>}
      <OwnerLocationPinPicker
        open={pinOpen}
        initialLocation={selected ? { lat: selected.latitude, lon: selected.longitude } : null}
        onCancel={() => setPinOpen(false)}
        onConfirm={({ lat, lon }) => {
          setSelected({ id: "map-pin", address: value, latitude: lat, longitude: lon });
          setPinOpen(false);
        }}
      />
      {selected?.id === "map-pin" && <p role="status">Đã chọn vị trí trên bản đồ</p>}
    </label>
  );
}
