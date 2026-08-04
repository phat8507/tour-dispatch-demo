"use client";

import dynamic from "next/dynamic";
import type { OwnerDispatchMapModel } from "./owner-dispatch-map-model";

const OwnerDispatchLeafletMap = dynamic(
  () => import("./OwnerDispatchLeafletMap").then((module) => module.OwnerDispatchLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[34rem] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600">
        Đang tải bản đồ...
      </div>
    ),
  },
);

export type OwnerDispatchMapProps = {
  model: OwnerDispatchMapModel;
  selectedTourId: string | null;
  onSelectTour: (tourId: string) => void;
};

export function OwnerDispatchMap(props: OwnerDispatchMapProps) {
  return <OwnerDispatchLeafletMap {...props} />;
}
