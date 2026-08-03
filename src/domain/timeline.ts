import { AssignmentStatus, PerformanceLevel, OrderType, Urgency, BranchId } from "../types";

export const TIMELINE_START_HOUR = 8; // 08:00
export const TIMELINE_END_HOUR = 20;  // 20:00
export const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 720

/**
 * Convert an ISO 8601 time string to total minutes since 00:00 local time.
 * Expects strings with +07:00 offset.
 */
function isoToMinutesSinceMidnight(isoString: string): number {
  // Parse HH:MM from the time portion. Safe since all our timestamps are +07:00.
  const match = isoString.match(/T(\d{2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Returns how far into the timeline a time is, as a percentage [0..100].
 * Times before 08:00 clamp to 0. Times after 20:00 clamp to 100.
 */
export function getTimelineOffsetPercentage(isoString: string): number {
  const totalMinutes = isoToMinutesSinceMidnight(isoString);
  const startMinutes = TIMELINE_START_HOUR * 60;
  const endMinutes = TIMELINE_END_HOUR * 60;
  const clamped = Math.max(startMinutes, Math.min(endMinutes, totalMinutes));
  return ((clamped - startMinutes) / TIMELINE_TOTAL_MINUTES) * 100;
}

/**
 * Returns the width of an assignment block as a percentage of the full timeline.
 * Clamps both start and end to 08:00–20:00 before computing width.
 */
export function getTimelineWidthPercentage(
  startIso: string,
  endIso: string,
): number {
  const startMinutes = isoToMinutesSinceMidnight(startIso);
  const endMinutes = isoToMinutesSinceMidnight(endIso);
  const timelineStart = TIMELINE_START_HOUR * 60;
  const timelineEnd = TIMELINE_END_HOUR * 60;

  const clampedStart = Math.max(timelineStart, Math.min(timelineEnd, startMinutes));
  const clampedEnd = Math.max(timelineStart, Math.min(timelineEnd, endMinutes));

  const durationMinutes = Math.max(0, clampedEnd - clampedStart);
  return (durationMinutes / TIMELINE_TOTAL_MINUTES) * 100;
}

// ── UI Label Mappings ──────────────────────────────────────────────────────────
// Vietnamese display labels are kept here only. Domain values remain English.

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  SCHEDULED: "Sắp tới",
  IN_PROGRESS: "Đang làm",
  COMPLETED: "Hoàn thành",
  DELAYED: "Cảnh báo trễ",
  CANCELLED: "Đã hủy",
};

export const PERFORMANCE_LEVEL_LABEL: Record<PerformanceLevel, string> = {
  STRONG: "Cứng",
  EXPERT: "Cứng",
  NORMAL: "Bình thường",
  NORMAL_WEAK: "Bình thường/Yếu",
  WEAK: "Yếu",
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  NEW_TOUR: "Tour mới",
  REFILL: "Đơn dặm",
  MILEAGE: "Đơn dặm",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  PREBOOKED: "Đặt trước",
  IMMEDIATE: "Qua liền",
};

export const BRANCH_LABEL: Record<BranchId, string> = {
  CS1: "CS1",
  CS2: "CS2",
};

/**
 * Format an ISO 8601 string to HH:MM (local +07:00 time).
 */
export function formatTimeHHMM(isoString: string): string {
  const match = isoString.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "--:--";
}

export function formatTimeHHMMInTimeZone(
  isoString: string,
  timeZone: string,
): string {
  const timestampMs = new Date(isoString).getTime();
  if (!Number.isFinite(timestampMs)) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(timestampMs));
}
