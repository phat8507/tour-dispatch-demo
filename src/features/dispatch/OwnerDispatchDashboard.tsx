"use client";

import { useEffect, useState } from "react";
import { OwnerDispatchForm } from "@/app/owner/OwnerDispatchForm";
import type { OwnerDispatchTour } from "./owner-dispatch-view-model";
import type { OwnerDispatchMapModel } from "./owner-dispatch-map-model";
import { OwnerDispatchMap } from "./OwnerDispatchMap";

type Candidate = { id: string; name: string };

export type OwnerDispatchDashboardProps = {
  tours: OwnerDispatchTour[];
  candidates: Candidate[][];
  mapModel: OwnerDispatchMapModel;
};

export function OwnerDispatchDashboard({
  tours,
  candidates,
  mapModel,
}: OwnerDispatchDashboardProps) {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTourId) return;
    const tourButton = document.getElementById(`owner-tour-${selectedTourId}`);
    tourButton?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    tourButton?.focus({ preventScroll: true });
  }, [selectedTourId]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
      <section aria-label="Bản đồ điều phối" className="min-w-0">
        {mapModel.warnings.length > 0 && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-semibold">Dữ liệu bản đồ chưa đầy đủ</p>
            <ul className="mt-1 list-disc pl-5">
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

      <section aria-label="Danh sách tour" className="min-w-0">
        {tours.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Chưa có tour cần điều phối.
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
                      {tour.requestedAt} | {tour.location.name} | {tour.status}
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
                                `${assignment.employeeName} (${assignment.status})${
                                  assignment.isOverride
                                    ? ` | Ghi đè: ${assignment.overrideReason}`
                                    : ""
                                }`,
                            )
                            .join(", ")}
                    </span>
                  </button>
                  <OwnerDispatchForm
                    orderId={tour.id}
                    orderVersion={tour.orderVersion}
                    requestedAt={tour.requestedAt}
                    candidates={candidates[index] ?? []}
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
