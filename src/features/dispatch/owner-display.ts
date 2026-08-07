export function formatOwnerDateTime(value: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "Chưa xác định thời gian";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short", hour12: false }).format(instant);
}
