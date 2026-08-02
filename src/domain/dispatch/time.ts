export function addMinutesPreservingOffset(
  timestamp: string,
  minutes: number,
): string {
  const targetMs = new Date(timestamp).getTime() + minutes * 60_000;
  if (timestamp.endsWith("Z")) {
    return new Date(targetMs).toISOString();
  }

  const offsetMatch = timestamp.match(/([+-])(\d{2}):(\d{2})$/);
  if (!offsetMatch) {
    return new Date(targetMs).toISOString();
  }

  const direction = offsetMatch[1] === "+" ? 1 : -1;
  const offsetMinutes =
    direction * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  const localIso = new Date(targetMs + offsetMinutes * 60_000).toISOString();
  return `${localIso.slice(0, 19)}${offsetMatch[0]}`;
}
