export type ConfirmationPreconditionError =
  | "CONFIRMATION_REQUIRED"
  | "EMPLOYEE_REQUIRED"
  | "STALE_SUGGESTION";

export function getConfirmationPreconditionError(input: {
  confirmed: boolean;
  selectedEmployeeId: string | null;
  orderId: string;
  existingOrderIds: readonly string[];
}): ConfirmationPreconditionError | undefined {
  if (!input.confirmed) {
    return "CONFIRMATION_REQUIRED";
  }
  if (!input.selectedEmployeeId) {
    return "EMPLOYEE_REQUIRED";
  }
  if (input.existingOrderIds.includes(input.orderId)) {
    return "STALE_SUGGESTION";
  }
  return undefined;
}
