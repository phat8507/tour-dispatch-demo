"use client";

import { AssignmentSuggestion, Employee } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  BRANCH_LABEL,
  formatTimeHHMMInTimeZone,
  PERFORMANCE_LEVEL_LABEL,
} from "@/domain/timeline";
import { DEMO_TIMEZONE } from "@/data/mockData";

interface AssignmentSuggestionsProps {
  suggestions: AssignmentSuggestion[];
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

export function AssignmentSuggestions({
  suggestions,
  employees,
  selectedEmployeeId,
  onSelect,
}: AssignmentSuggestionsProps) {
  const employeeMap = new Map(
    employees.map((employee) => [employee.id, employee]),
  );

  if (suggestions.length === 0) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        role="status"
      >
        <p className="font-semibold">
          Không tìm thấy nhân viên phù hợp với thời gian và điều kiện hiện tại.
        </p>
        <p className="mt-1">
          Hãy thử thay đổi giờ yêu cầu, dịch vụ, địa điểm hoặc loại đơn.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="suggestions-title" className="space-y-3">
      <h3 id="suggestions-title" className="text-base font-semibold">
        Đề xuất nhân viên
      </h3>
      {suggestions.map((suggestion, index) => {
        const employee = employeeMap.get(suggestion.employeeId);
        if (!employee) {
          return null;
        }

        const selected = selectedEmployeeId === employee.id;
        return (
          <label
            key={employee.id}
            className={`block cursor-pointer rounded-xl border p-4 transition ${
              selected
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="selected-employee"
                value={employee.id}
                checked={selected}
                onChange={() => onSelect(employee.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    #{index + 1} · {employee.name}
                  </span>
                  {index === 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      Đề xuất tốt nhất
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {BRANCH_LABEL[employee.branchId]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {PERFORMANCE_LEVEL_LABEL[employee.performanceLevel]}
                  </span>
                </div>

                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Điểm</dt>
                    <dd className="font-semibold">
                      {suggestion.score.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Có thể đi từ</dt>
                    <dd>
                      {formatTimeHHMMInTimeZone(
                        suggestion.estimatedAvailableAt,
                        DEMO_TIMEZONE,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Thời gian di chuyển
                    </dt>
                    <dd>{suggestion.estimatedTravelMinutes} phút</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dự kiến đến</dt>
                    <dd>
                      {formatTimeHHMMInTimeZone(
                        suggestion.estimatedArrivalAt,
                        DEMO_TIMEZONE,
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold">Lý do</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {suggestion.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Cảnh báo</p>
                    {suggestion.warnings.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-700">
                        {suggestion.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        Không có cảnh báo.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </label>
        );
      })}
    </section>
  );
}
