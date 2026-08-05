import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";

export function OwnerCandidateRecommendations({ recommendations, selectedEmployeeId, onSelect }: { recommendations: CandidateRecommendation[]; selectedEmployeeId?: string; onSelect: (employeeId: string) => void }) {
  return (
    <section aria-label="Gợi ý nhân viên" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Gợi ý nhân viên</h3><span className="text-xs text-slate-500">Tối đa 3 · chưa đánh giá thời gian di chuyển</span></div>
      {recommendations.length === 0 ? <p className="mt-2 text-xs text-slate-600">Không có ứng viên hợp lệ từ dữ liệu hiện tại.</p> : (
        <div className="mt-2 grid gap-2">
          {recommendations.map((recommendation) => (
            <button key={recommendation.employeeId} type="button" aria-pressed={selectedEmployeeId === recommendation.employeeId} onClick={() => onSelect(recommendation.employeeId)} className={`rounded-md border p-2 text-left text-xs ${selectedEmployeeId === recommendation.employeeId ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
              <span className="block font-semibold text-slate-900">#{recommendation.rank} {recommendation.employeeName}</span>
              <span className="mt-1 block text-slate-700">{recommendation.category === "PRIMARY" ? "Đủ dữ liệu kỹ năng" : "Dự phòng · kỹ năng UNKNOWN · cần ghi đè"} · {recommendation.availabilityState} · {recommendation.workloadCount} tour/ngày</span>
              {recommendation.reasons.map((reason) => <span key={reason} className="mt-1 block text-slate-600">• {reason}</span>)}
              {recommendation.warnings.map((warning) => <span key={warning} className="mt-1 block text-amber-800">⚠ {warning}</span>)}
              {recommendation.estimatedTravelMinutes !== undefined && <span className="mt-1 block text-slate-700">Estimated travel: {recommendation.estimatedTravelMinutes} minutes</span>}
              {recommendation.candidateWarningCodes?.includes("TRAVEL_INFEASIBLE") && <span className="mt-1 block text-amber-800">Không đủ thời gian di chuyển trước giờ tour</span>}
              {recommendation.candidateWarningCodes?.includes("MISSING_ORIGIN") && <span className="mt-1 block text-amber-800">Không có điểm xuất phát để ước tính di chuyển</span>}
              {recommendation.candidateWarningCodes?.includes("MISSING_DESTINATION") && <span className="mt-1 block text-amber-800">Không có điểm đến để ước tính di chuyển</span>}
              {recommendation.nextAssignmentWarning && <span className="mt-1 block text-amber-800">{recommendation.nextAssignmentWarning === "NEXT_ASSIGNMENT_TRAVEL_INFEASIBLE" ? "Không đủ thời gian di chuyển đến tour tiếp theo" : "Không thể ước tính di chuyển đến tour tiếp theo"}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
