/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerCandidateRecommendations } from "@/features/dispatch/OwnerCandidateRecommendations";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";

const recommendation: CandidateRecommendation = { employeeId: "employee", employeeName: "Employee", rank: 1, category: "UNKNOWN_SKILL_FALLBACK", requiresOverride: true, availabilityState: "AVAILABLE_NOW", estimatedAvailableAt: "2030-01-01T08:00:00Z", workloadCount: 0, closingLevel: "NORMAL", technicalSkills: [{ serviceId: "service", serviceName: "Service", technicalLevel: "UNKNOWN" }], reasons: ["Availability: AVAILABLE_NOW."], warnings: ["Chưa đủ dữ liệu kỹ năng cho Service. Cần ghi đè rõ ràng."], travelEvaluation: "NOT_EVALUATED" };

describe("owner candidate recommendations", () => {
  afterEach(cleanup);
  it("shows explainable UNKNOWN warnings and selection remains client-only", () => {
    const onSelect = vi.fn();
    render(<OwnerCandidateRecommendations recommendations={[recommendation]} onSelect={onSelect} />);
    expect(screen.getByText(/chưa đủ thông tin kỹ năng/i)).toBeTruthy();
    expect(screen.getByText(/Chưa có đánh giá tay nghề kỹ thuật/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Employee/ }));
    expect(onSelect).toHaveBeenCalledWith("employee");
  });
  it("enters pending state synchronously and prevents a duplicate selection", async () => {
    let resolve: (() => void) | undefined;
    const onSelect = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<OwnerCandidateRecommendations recommendations={[recommendation]} onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: /Employee/ });
    fireEvent.click(button);
    expect(button.textContent).toBe("Đang chọn...");
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    await act(async () => resolve?.());
    expect(screen.getByRole("button", { name: /Chọn nhân viên/ }).hasAttribute("disabled")).toBe(false);
  });
  it("shows only safe, candidate-local travel fields and never a zero unavailable placeholder", () => {
    const onSelect = vi.fn();
    render(<OwnerCandidateRecommendations recommendations={[{ ...recommendation, estimatedTravelMinutes: 2, estimatedTravelDistanceMeters: 500, candidateWarningCodes: ["TRAVEL_INFEASIBLE"], nextAssignmentWarning: "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE" }, { ...recommendation, employeeId: "unavailable", employeeName: "Unavailable", travelStatus: "UNAVAILABLE" }]} onSelect={onSelect} />);
    expect(screen.getByText(/Di chuyển: khoảng 2 phút/)).toBeTruthy();
    expect(screen.getByText("Không đủ thời gian di chuyển trước giờ tour")).toBeTruthy();
    expect(screen.getByText("Không đủ thời gian di chuyển đến tour tiếp theo")).toBeTruthy();
    expect(screen.queryByText(/Di chuyển: khoảng 0 phút/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/distance|durationSeconds|departureAt|latitude|longitude|requestId/i);
  });
});
