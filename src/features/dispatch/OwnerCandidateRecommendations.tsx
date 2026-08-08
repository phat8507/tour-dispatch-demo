"use client";

import { useState } from "react";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";

function presentationStatus(value: string): string {
  return ({ AVAILABLE_NOW: "Sẵn sàng", BUSY: "Đang có tour", NEAR_COMPLETION: "Sắp hoàn thành tour", SCHEDULED_LATER: "Có lịch sau đó", OFF: "Đang nghỉ", INACTIVE: "Không hoạt động", UNKNOWN: "Chưa đủ thông tin", UNAVAILABLE: "Chưa xác định thời gian di chuyển" }[value] ?? "Chưa đủ thông tin");
}

export function OwnerCandidateRecommendations({ recommendations, selectedEmployeeId, onSelect }: { recommendations: CandidateRecommendation[]; selectedEmployeeId?: string; onSelect: (employeeId: string) => void | Promise<void> }) {
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);

  async function select(employeeId: string) {
    if (pendingEmployeeId) return;
    setPendingEmployeeId(employeeId);
    try {
      await onSelect(employeeId);
    } finally {
      setPendingEmployeeId(null);
    }
  }

  return (
    <section aria-label="Gợi ý nhân viên" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Gợi ý nhân viên</h3><span className="text-xs text-slate-500">Tối đa 3</span></div>
      {recommendations.length === 0 ? <p className="mt-2 text-xs text-slate-600">Không có ứng viên hợp lệ từ dữ liệu hiện tại.</p> : (
        <div className="mt-2 grid gap-2">
          {recommendations.map((recommendation) => {
            const isSelected = selectedEmployeeId === recommendation.employeeId;
            const isPending = pendingEmployeeId === recommendation.employeeId;
            return (
              <div key={recommendation.employeeId} className={`rounded-md border p-2.5 text-left text-xs ${isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <span className="block font-semibold text-slate-900">#{recommendation.rank} {recommendation.employeeName}</span>
                <span className="mt-1 block text-slate-700">{recommendation.category === "PRIMARY" ? "Đủ dữ liệu kỹ năng" : "Dự phòng · chưa đủ thông tin kỹ năng · cần ghi đè"} · {presentationStatus(recommendation.availabilityState)}</span>
                <span className="mt-1 block text-slate-700">Mức độ chốt: {({ STRONG: "Cứng", NORMAL: "Thường", WEAK: "Yếu" }[recommendation.closingLevel] ?? "Chưa rõ")}</span>
                <span className="mt-1 block text-slate-700">Hôm nay: {recommendation.workloadCount} tour</span>
                {recommendation.estimatedTravelMinutes !== undefined && recommendation.estimatedTravelDistanceMeters !== undefined ? (
                  <span className="mt-1 block text-slate-700">
                    Di chuyển: khoảng {recommendation.estimatedTravelMinutes} phút · {(recommendation.estimatedTravelDistanceMeters / 1000).toLocaleString("vi-VN")} km
                  </span>
                ) : (
                  <span className="mt-1 block text-slate-700">Di chuyển: Chưa tính được thời gian di chuyển.</span>
                )}
                {recommendation.travelOriginSource && recommendation.travelOriginSource !== "MISSING_ORIGIN" && (
                  <span className="mt-1 block text-slate-700">Điểm xuất phát: {({ CURRENT_ASSIGNMENT: "Khách trước", LATEST_COMPLETED: "Khách trước", STORED_ORIGIN: "Vị trí đã lưu", HOME_BRANCH: "Cơ sở" }[recommendation.travelOriginSource] ?? "Cơ sở")}</span>
                )}
                {recommendation.warnings.map((warning, idx) => (
                  <span key={idx} className="mt-1 block font-medium text-amber-800">
                    ⚠ {warning.includes("Chưa đủ dữ liệu kỹ năng") ? warning.replace("Chưa đủ dữ liệu kỹ năng cho", "Chưa có đánh giá tay nghề kỹ thuật cho dịch vụ").replace(". Cần ghi đè rõ ràng.", "") : "Cần kiểm tra thêm dữ liệu điều phối."}
                  </span>
                ))}
                {recommendation.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE") && <span className="mt-1 block font-medium text-amber-800">Không đủ thời gian di chuyển trước giờ tour</span>}
                {recommendation.nextAssignmentWarning === "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE" && <span className="mt-1 block font-medium text-amber-800">Không đủ thời gian di chuyển đến tour tiếp theo</span>}
                <button type="button" aria-label={`Chọn nhân viên ${recommendation.employeeName}`} aria-pressed={isSelected} disabled={pendingEmployeeId !== null} onClick={() => void select(recommendation.employeeId)} className="mt-2 min-h-11 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                  {isPending ? "Đang chọn..." : isSelected ? "Đã chọn" : "Chọn nhân viên"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
