import { DEMO_TIME } from "../data/mockData";

export function formatHumanReadable(isoString: string): string {
  if (!isoString) return "";
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "";
  const [, y, m, d, H, M] = match;
  
  const dateObj = new Date(isoString);
  if (isNaN(dateObj.getTime())) return "";
  
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[dateObj.getDay()];
  
  return `${dayName}, ${d}/${m}/${y} lúc ${H}:${M}`;
}

export function applyQuickAction(minutesToAdd: number, demoTimeIso: string = DEMO_TIME): string {
  const ms = new Date(demoTimeIso).getTime() + minutesToAdd * 60_000;
  const date = new Date(ms);
  
  const currentMin = date.getUTCMinutes();
  const remainder = currentMin % 15;
  if (remainder > 0) {
    date.setUTCMinutes(currentMin + (15 - remainder));
  }
  
  const localMs = date.getTime() + 7 * 3600_000;
  const localDate = new Date(localMs);
  
  const yyyy = localDate.getUTCFullYear();
  const MM = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getUTCDate()).padStart(2, '0');
  const hh = String(localDate.getUTCHours()).padStart(2, '0');
  const mm = String(localDate.getUTCMinutes()).padStart(2, '0');
  
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:00+07:00`;
}

export function parseRequestedTime(isoString: string) {
  if (!isoString) return { date: "", hour: "", minute: "" };
  const match = isoString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return { date: match[1], hour: match[2], minute: match[3] };
  }
  return { date: "", hour: "", minute: "" };
}

export function buildRequestedTime(date: string, hour: string, minute: string): string {
  if (!date || !hour || !minute) return "INCOMPLETE";
  return `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00+07:00`;
}
