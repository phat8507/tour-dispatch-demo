import { AssignmentSuggestion } from "../../types";
import { parseTimestamp } from "../availability";

export function compareSuggestions(
  left: AssignmentSuggestion,
  right: AssignmentSuggestion,
): number {
  return (
    right.score - left.score ||
    parseTimestamp(left.estimatedArrivalAt) - parseTimestamp(right.estimatedArrivalAt) ||
    left.employeeId.localeCompare(right.employeeId)
  );
}
