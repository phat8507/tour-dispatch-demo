import { Assignment, AssignmentStatus } from "../types";

export interface RuntimeOverride {
  startTime?: string;
  endTime?: string;
  status?: AssignmentStatus;
}

export type OverridesMap = Record<string, RuntimeOverride>;

export function getEffectiveAssignments(
  baseAssignments: Assignment[],
  overrides: OverridesMap
): Assignment[] {
  return baseAssignments.map(a => {
    const override = overrides[a.id];
    if (!override) return a;
    return {
      ...a,
      startTime: override.startTime ?? a.startTime,
      endTime: override.endTime ?? a.endTime,
      status: override.status ?? a.status,
    };
  });
}
