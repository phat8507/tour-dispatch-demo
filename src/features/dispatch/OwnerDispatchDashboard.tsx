"use client";

import { useEffect, useState } from "react";
import { OwnerDispatchForm } from "@/app/owner/OwnerDispatchForm";
import type { OwnerDispatchTour } from "./owner-dispatch-view-model";
import type { OwnerDispatchMapModel } from "./owner-dispatch-map-model";
import { OwnerDispatchMap } from "./OwnerDispatchMap";
import { OwnerCandidateRecommendations } from "./OwnerCandidateRecommendations";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";
import type { ReactNode } from "react";
import { formatOwnerDateTime } from "./owner-display";

export type OwnerDispatchDashboardProps = {
  tours: OwnerDispatchTour[];
  recommendations: CandidateRecommendation[][];
  providerWarnings?: Array<"NO_PROVIDER" | "TIMEOUT" | "RATE_LIMITED" | "MALFORMED_RESPONSE" | "TOTAL_FAILURE" | undefined>;
  mapModel: OwnerDispatchMapModel;
  emptyCreateTour?: ReactNode;
};

function statusLabel(value: string): string {
  return ({ PENDING: "Chờ phân công", ASSIGNED: "Đã phân công", CONFIRMED: "Đã xác nhận", AVAILABLE: "Sẵn sàng", BUSY: "Đang có tour", NEAR_COMPLETION: "Sắp hoàn thành tour", UNKNOWN: "Chưa đủ thông tin", UNAVAILABLE: "Chưa xác định thời gian di chuyển" }[value] ?? value);
}

export function OwnerDispatchDashboard({
  tours,
  recommendations,
  providerWarnings,
  mapModel,
  emptyCreateTour,
}: OwnerDispatchDashboardProps) {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedTourId) return;
    const tourButton = document.getElementById(`owner-tour-${selectedTourId}`);
    tourButton?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    tourButton?.focus({ preventScroll: true });
  }, [selectedTourId]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
      <section aria-label="Bản đồ điều phối" className="order-2 min-w-0">
        {mapModel.warnings.length > 0 && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-semibold">Dữ liệu bản đồ chưa đầy đủ</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {mapModel.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <OwnerDispatchMap
          model={mapModel}
          selectedTourId={selectedTourId}
          onSelectTour={setSelectedTourId}
        />
      </section>

      <section aria-label="Danh sách tour" className="order-1 min-w-0">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Tour cần điều phối</h2>
        {tours.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="font-medium text-slate-900">Chưa có tour trong ngày này.</p>
            <div className="mt-3">{emptyCreateTour}</div>
          </div>
        ) : (
          <div className="max-h-[72dvh] space-y-3 overflow-y-auto pr-1">
            {tours.map((tour, index) => {
              const isSelected = selectedTourId === tour.id;
              return (
                <article
                  key={tour.id}
                  className={`rounded-xl border bg-white p-4 transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/40"
                      : "border-slate-200"
                  }`}
                >
                  <button
                    id={`owner-tour-${tour.id}`}
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => setSelectedTourId(tour.id)}
                    className="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <span className="block font-semibold text-slate-950">
                      {tour.customerName}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {formatOwnerDateTime(tour.requestedAt)} | {tour.location.name} | {statusLabel(tour.status)}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      Dịch vụ: {tour.services.map((service) => service.name).join(", ") || "Không có dịch vụ"}
                    </span>
                    <span className="mt-2 block text-sm text-slate-800">
                      {tour.assignments.length === 0
                        ? "Chưa phân công"
                        : tour.assignments
                            .map(
                              (assignment) =>
                                `${assignment.employeeName} (${statusLabel(assignment.status)})${
                                  assignment.isOverride
                                    ? ` | Ghi đè: ${assignment.overrideReason}`
                                    : ""
                                }`,
                            )
                            .join(", ")}
                    </span>
                  </button>
                  <OwnerCandidateRecommendations recommendations={recommendations[index] ?? []} selectedEmployeeId={selectedEmployees[tour.id]} onSelect={(employeeId) => setSelectedEmployees((current) => ({ ...current, [tour.id]: employeeId }))} />
                  {providerWarnings?.[index] && <p role="alert" className="mt-2 text-xs font-medium text-amber-800">Không thể đánh giá thời gian di chuyển cho tour này.</p>}
                  <OwnerDispatchForm
                    orderId={tour.id}
                    orderVersion={tour.orderVersion}
                    requestedAt={tour.requestedAt}
                    durationMinutes={tour.services.reduce((total, service) => total + service.durationMinutes, 0)}
                    candidates={(recommendations[index] ?? []).map((candidate) => ({ id: candidate.employeeId, name: candidate.employeeName, requiresOverride: candidate.requiresOverride }))}
                    selectedEmployeeId={selectedEmployees[tour.id]}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
