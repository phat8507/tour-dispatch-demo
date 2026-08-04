import { businessDateInHoChiMinh } from "./business-date";

export type ProductionAvailabilityState = "AVAILABLE_NOW" | "BUSY" | "NEAR_COMPLETION" | "SCHEDULED_LATER" | "OFF" | "INACTIVE";
export type RecommendationCategory = "PRIMARY" | "UNKNOWN_SKILL_FALLBACK";
export type TravelEvaluation = "NOT_EVALUATED" | "MISSING_ORIGIN" | "MISSING_DESTINATION" | "PROVIDER_UNAVAILABLE";
export type ProductionSkillLevel = "STRONG" | "NORMAL" | "WEAK";
export type ProductionAssignmentStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";

export type ProductionRecommendationAssignment = {
  orderId: string;
  startsAt: string;
  endsAt: string;
  status: ProductionAssignmentStatus;
  locationCoordinatesAvailable: boolean;
};

export type ProductionRecommendationEmployee = {
  id: string;
  name: string;
  isActive: boolean;
  isOff: boolean;
  homeBranchId: "CS1" | "CS2";
  homeBranchCoordinatesAvailable: boolean;
  closingLevel: ProductionSkillLevel;
  skills: Array<{ serviceId: string; serviceName: string; technicalLevel: ProductionSkillLevel }>;
  assignments: ProductionRecommendationAssignment[];
};

export type ProductionRecommendationTour = {
  id: string;
  requestedAt: string;
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
  destinationCoordinatesAvailable: boolean;
  services: Array<{ id: string; name: string; durationMinutes: number }>;
};

export type CandidateRecommendation = {
  employeeId: string;
  employeeName: string;
  rank: number;
  category: RecommendationCategory;
  requiresOverride: boolean;
  availabilityState: ProductionAvailabilityState;
  estimatedAvailableAt: string | null;
  workloadCount: number;
  closingLevel: ProductionSkillLevel;
  technicalSkills: Array<{ serviceId: string; serviceName: string; technicalLevel: ProductionSkillLevel | "UNKNOWN" }>;
  reasons: string[];
  warnings: string[];
  travelEvaluation: TravelEvaluation;
};

export type ProductionRecommendationInput = {
  tour: ProductionRecommendationTour;
  employees: ProductionRecommendationEmployee[];
  now: string;
};

const ACTIVE_STATUSES = new Set<ProductionAssignmentStatus>(["SCHEDULED", "IN_PROGRESS", "DELAYED"]);
const availabilityPriority: Record<ProductionAvailabilityState, number> = { AVAILABLE_NOW: 0, NEAR_COMPLETION: 1, SCHEDULED_LATER: 2, BUSY: 3, OFF: 4, INACTIVE: 5 };
const capabilityScore: Record<ProductionSkillLevel, number> = { STRONG: 3, NORMAL: 2, WEAK: 1 };

function validTime(value: string): number | undefined {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function overlaps(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function tourInterval(tour: ProductionRecommendationTour): { start: number; end: number } | undefined {
  const start = validTime(tour.requestedAt);
  const duration = tour.services.reduce((total, service) => total + service.durationMinutes, 0);
  return start === undefined || duration <= 0 ? undefined : { start, end: start + duration * 60_000 };
}

function businessDayInterval(requestedAt: string): { start: number; end: number } | undefined {
  const time = validTime(requestedAt);
  if (time === undefined) return undefined;
  const date = businessDateInHoChiMinh(new Date(time));
  const start = new Date(`${date}T00:00:00+07:00`).getTime();
  return { start, end: start + 24 * 60 * 60_000 };
}

function availability(employee: ProductionRecommendationEmployee, now: number): { state: ProductionAvailabilityState; estimatedAvailableAt: string | null; warnings: string[]; originCoordinatesAvailable: boolean } {
  if (!employee.isActive) return { state: "INACTIVE", estimatedAvailableAt: null, warnings: [], originCoordinatesAvailable: false };
  if (employee.isOff) return { state: "OFF", estimatedAvailableAt: null, warnings: [], originCoordinatesAvailable: false };
  const warnings: string[] = [];
  const active = employee.assignments.flatMap((assignment) => {
    if (!ACTIVE_STATUSES.has(assignment.status)) return [];
    const startsAt = validTime(assignment.startsAt); const endsAt = validTime(assignment.endsAt);
    if (startsAt === undefined || endsAt === undefined || startsAt >= endsAt) {
      warnings.push(`Assignment ${assignment.orderId} has inconsistent status or timestamps.`);
      return [];
    }
    if (endsAt <= now) warnings.push(`Assignment ${assignment.orderId} is still active after its persisted end time.`);
    return [{ ...assignment, startsAt, endsAt }];
  }).sort((left, right) => left.startsAt - right.startsAt || left.orderId.localeCompare(right.orderId));
  const current = active.find((assignment) => assignment.startsAt <= now && now < assignment.endsAt);
  if (current) {
    const near = (current.status === "IN_PROGRESS" || current.status === "DELAYED") && current.endsAt - now <= 30 * 60_000;
    if (current.status === "SCHEDULED") warnings.push(`Assignment ${current.orderId} covers now but remains SCHEDULED.`);
    if (!current.locationCoordinatesAvailable) warnings.push("Current assignment customer coordinates are unavailable.");
    return { state: near ? "NEAR_COMPLETION" : "BUSY", estimatedAvailableAt: new Date(current.endsAt).toISOString(), warnings, originCoordinatesAvailable: current.locationCoordinatesAvailable };
  }
  const next = active.find((assignment) => assignment.startsAt > now);
  return { state: next ? "SCHEDULED_LATER" : "AVAILABLE_NOW", estimatedAvailableAt: next ? new Date(next.startsAt).toISOString() : new Date(now).toISOString(), warnings, originCoordinatesAvailable: employee.homeBranchCoordinatesAvailable };
}

function workload(employee: ProductionRecommendationEmployee, tour: ProductionRecommendationTour): number {
  const day = businessDayInterval(tour.requestedAt);
  if (!day) return 0;
  return employee.assignments.filter((assignment) => {
    if (assignment.status === "CANCELLED") return false;
    const start = validTime(assignment.startsAt); const end = validTime(assignment.endsAt);
    return start !== undefined && end !== undefined && start < end && overlaps(start, end, day.start, day.end);
  }).length;
}

type RankedCandidate = Omit<CandidateRecommendation, "rank"> & { technicalMinimum: number; technicalTotal: number };

function projectEmployee(input: ProductionRecommendationInput, employee: ProductionRecommendationEmployee): RankedCandidate | undefined {
  const interval = tourInterval(input.tour); const now = validTime(input.now);
  if (!interval || now === undefined || input.tour.status === "COMPLETED" || input.tour.status === "CANCELLED") return undefined;
  const state = availability(employee, now);
  if (state.state === "OFF" || state.state === "INACTIVE") return undefined;
  const overlapsTour = employee.assignments.some((assignment) => {
    if (!ACTIVE_STATUSES.has(assignment.status)) return false;
    const start = validTime(assignment.startsAt); const end = validTime(assignment.endsAt);
    return start !== undefined && end !== undefined && start < end && overlaps(start, end, interval.start, interval.end);
  });
  if (overlapsTour) return undefined;
  const skills = new Map(employee.skills.map((skill) => [skill.serviceId, skill]));
  const technicalSkills = input.tour.services.map((service) => {
    const skill = skills.get(service.id);
    return { serviceId: service.id, serviceName: service.name, technicalLevel: skill?.technicalLevel ?? "UNKNOWN" as const };
  });
  const missing = technicalSkills.filter((skill) => skill.technicalLevel === "UNKNOWN");
  const knownScores = technicalSkills.flatMap((skill) => skill.technicalLevel === "UNKNOWN" ? [] : [capabilityScore[skill.technicalLevel]]);
  const category: RecommendationCategory = missing.length === 0 ? "PRIMARY" : "UNKNOWN_SKILL_FALLBACK";
  const reasons = [
    `${state.state === "NEAR_COMPLETION" ? "Estimated from persisted schedule: near completion within 30 minutes" : `Availability: ${state.state}`}.`,
    `Workload on the tour business date: ${workload(employee, input.tour)} non-cancelled assignment(s).`,
    `Closing capability: ${employee.closingLevel}.`,
  ];
  if (category === "PRIMARY") reasons.push(`Technical capability: ${technicalSkills.map((skill) => `${skill.serviceName}=${skill.technicalLevel}`).join(", ")}.`);
  const warnings = [...state.warnings];
  if (missing.length > 0) warnings.push(`Incomplete skill data for: ${missing.map((skill) => `${skill.serviceName} (${skill.serviceId})`).join(", ")}. Explicit override is required.`);
  let travelEvaluation: TravelEvaluation = "NOT_EVALUATED";
  if (!input.tour.destinationCoordinatesAvailable) { travelEvaluation = "MISSING_DESTINATION"; warnings.push("Customer coordinates are unavailable; travel was not evaluated."); }
  else if (!state.originCoordinatesAvailable) { travelEvaluation = "MISSING_ORIGIN"; warnings.push(state.state === "BUSY" || state.state === "NEAR_COMPLETION" ? "Current assignment origin coordinates are unavailable; travel was not evaluated." : `Home branch ${employee.homeBranchId} coordinates are unavailable; travel was not evaluated.`); }
  else warnings.push("Travel has not been evaluated by an authoritative routing provider.");
  const workloadCount = workload(employee, input.tour);
  return { employeeId: employee.id, employeeName: employee.name, category, requiresOverride: category === "UNKNOWN_SKILL_FALLBACK", availabilityState: state.state, estimatedAvailableAt: state.estimatedAvailableAt, workloadCount, closingLevel: employee.closingLevel, technicalSkills, reasons, warnings, travelEvaluation, technicalMinimum: knownScores.length ? Math.min(...knownScores) : 0, technicalTotal: knownScores.reduce((sum, score) => sum + score, 0) };
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return availabilityPriority[left.availabilityState] - availabilityPriority[right.availabilityState]
    || right.technicalMinimum - left.technicalMinimum
    || right.technicalTotal - left.technicalTotal
    || capabilityScore[right.closingLevel] - capabilityScore[left.closingLevel]
    || left.workloadCount - right.workloadCount
    || left.employeeId.localeCompare(right.employeeId);
}

export function recommendProductionCandidates(input: ProductionRecommendationInput): CandidateRecommendation[] {
  const candidates = input.employees.map((employee) => projectEmployee(input, employee)).filter((candidate): candidate is RankedCandidate => candidate !== undefined);
  const primary = candidates.filter((candidate) => candidate.category === "PRIMARY").sort(compareCandidates);
  const fallback = candidates.filter((candidate) => candidate.category === "UNKNOWN_SKILL_FALLBACK").sort(compareCandidates);
  const selected = primary.length >= 2 ? primary.slice(0, 3) : [...primary, ...fallback].slice(0, 3);
  return selected.map(({ technicalMinimum, technicalTotal, ...candidate }, index) => {
    void technicalMinimum; void technicalTotal;
    return { ...candidate, rank: index + 1 };
  });
}
