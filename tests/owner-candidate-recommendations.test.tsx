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
    expect(screen.getByText(/kỹ năng UNKNOWN/)).toBeTruthy();
    expect(screen.getByText(/Incomplete skill data/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Employee/ }));
    expect(onSelect).toHaveBeenCalledWith("employee");
  });
});
