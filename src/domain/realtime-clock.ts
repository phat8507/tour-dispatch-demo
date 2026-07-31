export function getLiveDemoTime(systemTime: Date, demoDateString: string): string {
  // Use Intl.DateTimeFormat to reliably extract time components in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(systemTime);
  let hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const second = parts.find((p) => p.type === "second")?.value || "00";

  // Intl sometimes returns '24' for midnight when hour12 is false
  if (hour === "24") hour = "00";

  const datePart = demoDateString.substring(0, 10);
  const offsetPart = demoDateString.substring(19); // "+07:00" or similar
  
  return `${datePart}T${hour}:${minute}:${second}${offsetPart}`;
}
