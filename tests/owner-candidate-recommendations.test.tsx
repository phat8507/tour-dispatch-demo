/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerCandidateRecommendations } from "@/features/dispatch/OwnerCandidateRecommendations";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";

const recommendation: CandidateRecommendation = { employeeId: "employee", employeeName: "Employee", rank: 1, category: "UNKNOWN_SKILL_FALLBACK", requiresOverride: true, availabilityState: "AVAILABLE_NOW", estimatedAvailableAt: "2030-01-01T08:00:00Z", workloadCount: 0, closingLevel: "NORMAL", technicalSkills: [{ serviceId: "service", serviceName: "Service", technicalLevel: "UNKNOWN" }], reasons: ["Availability: AVAILABLE_NOW."], warnings: ["Incomplete skill data for Service."], travelEvaluation: "NOT_EVALUATED" };

describe("owner candidate recommendations", () => {
  afterEach(cleanup);
  it("shows explainable UNKNOWN warnings and selection remains client-only", () => {
    const onSelect = vi.fn();
    render(<OwnerCandidateRecommendations recommendations={[recommendation]} onSelect={onSelect} />);
    expect(screen.getByText(/chưa đủ thông tin kỹ năng/)).toBeTruthy();
    expect(screen.getByText(/Incomplete skill data/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Employee/ }));
    expect(onSelect).toHaveBeenCalledWith("employee");
  });
  it("shows only safe, candidate-local travel fields and never a zero unavailable placeholder", () => {
    const onSelect = vi.fn();
    render(<OwnerCandidateRecommendations recommendations={[{ ...recommendation, estimatedTravelMinutes: 2, candidateWarningCodes: ["TRAVEL_INFEASIBLE"], nextAssignmentWarning: "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE" }, { ...recommendation, employeeId: "unavailable", employeeName: "Unavailable", travelStatus: "UNAVAILABLE" }]} onSelect={onSelect} />);
    expect(screen.getByText("Estimated travel: 2 minutes")).toBeTruthy();
    expect(screen.getByText("Không đủ thời gian di chuyển trước giờ tour")).toBeTruthy();
    expect(screen.getByText("Không đủ thời gian di chuyển đến tour tiếp theo")).toBeTruthy();
    expect(screen.queryByText("Estimated travel: 0 minutes")).toBeNull();
    expect(document.body.textContent).not.toMatch(/distance|durationSeconds|departureAt|latitude|longitude|requestId/i);
  });
});
