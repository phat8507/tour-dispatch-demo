import { Employee, Assignment } from "../types";

export type RealtimeEmployeeStatus =
  | "OFF"
  | "AVAILABLE"
  | "NEXT_ASSIGNMENT_PENDING"
  | "IN_PROGRESS"
  | "DELAYED"
  | "FINISHING_SOON";

export interface RealtimeEmployeeState {
  status: RealtimeEmployeeStatus;
  activeAssignment?: Assignment;
  nextAssignment?: Assignment;
  countdownMinutes?: number;
  assignmentsToday: number;
}

export function getEmployeeRealtimeStatus(
  employee: Employee,
  effectiveAssignments: Assignment[],
  currentTime: string
): RealtimeEmployeeState {
  const todayAssignments = effectiveAssignments.filter((a) => a.employeeId === employee.id);
  
  if (employee.isOff) {
    return { status: "OFF", assignmentsToday: todayAssignments.length };
  }

  const activeAssignment = todayAssignments.find(
    (a) => a.startTime <= currentTime && currentTime < a.endTime && a.status !== "COMPLETED"
  );

  const futureAssignments = todayAssignments
    .filter((a) => a.startTime > currentTime && a.status !== "COMPLETED")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const nextAssignment = futureAssignments[0];

  let status: RealtimeEmployeeStatus = "AVAILABLE";
  let countdownMinutes: number | undefined;

  const currentMs = new Date(currentTime).getTime();
  const workStartMs = new Date(employee.workingStart).getTime();
  const workEndMs = new Date(employee.workingEnd).getTime();

  if (activeAssignment) {
    status = activeAssignment.status === "DELAYED" ? "DELAYED" : "IN_PROGRESS";
    
    const endMs = new Date(activeAssignment.endTime).getTime();
    const remainingMins = Math.floor((endMs - currentMs) / 60000);
    
    if (remainingMins <= 30 && status !== "DELAYED") {
      status = "FINISHING_SOON";
    }
    countdownMinutes = remainingMins;
  } else if (nextAssignment) {
    status = "NEXT_ASSIGNMENT_PENDING";
    const startMs = new Date(nextAssignment.startTime).getTime();
    countdownMinutes = Math.floor((startMs - currentMs) / 60000);
  } else {
    if (currentMs < workStartMs || currentMs >= workEndMs) {
      status = "OFF";
    }
  }

  return {
    status,
    activeAssignment,
    nextAssignment,
    countdownMinutes,
    assignmentsToday: todayAssignments.length
  };
}
