"use client";

import { useEffect, useState } from "react";

type Suggestion = { id: string; address: string; latitude: number; longitude: number };

export function OwnerAddressAutocomplete() {
  const [value, setValue] = useState(""); const [selected, setSelected] = useState<Suggestion | null>(null); const [suggestions, setSuggestions] = useState<Suggestion[]>([]); const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (selected || value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try { const response = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal }); if (!response.ok) { setUnavailable(true); setSuggestions([]); return; } const payload: unknown = await response.json(); const results = typeof payload === "object" && payload !== null && "suggestions" in payload && Array.isArray(payload.suggestions) ? payload.suggestions as Suggestion[] : []; setUnavailable(false); setSuggestions(results); }
      catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) { setUnavailable(true); setSuggestions([]); } }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selected, value]);
  const unresolved = value.trim().length > 0 && !selected && !unavailable;
  return <label className="sm:col-span-2 text-sm font-medium text-slate-700">Địa chỉ khách
    <input required name="customerAddress" value={value} onChange={(event) => { setValue(event.target.value); setSelected(null); setSuggestions([]); setUnavailable(false); }} autoComplete="off" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" />
    {selected && <><input type="hidden" name="customerLatitude" value={selected.latitude} /><input type="hidden" name="customerLongitude" value={selected.longitude} /><input type="hidden" name="customerPlaceId" value={selected.id} /></>}
    {suggestions.length > 0 && <ul role="listbox" className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{suggestions.map((suggestion) => <li key={suggestion.id}><button type="button" role="option" aria-selected={false} onClick={() => { setSelected(suggestion); setValue(suggestion.address); setSuggestions([]); }} className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">{suggestion.address}</button></li>)}</ul>}
    {unavailable ? <p role="status" className="mt-1 text-sm text-amber-800">Không thể xác định vị trí lúc này. Vui lòng thử lại.</p> : unresolved && <p role="status" className="mt-1 text-sm text-amber-800">Chưa xác định được vị trí của địa chỉ này. Vui lòng chọn một địa chỉ trong danh sách gợi ý.</p>}
  </label>;
}
