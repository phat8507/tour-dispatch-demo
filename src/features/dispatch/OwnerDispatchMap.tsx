"use client";

import dynamic from "next/dynamic";
import type { OwnerDispatchMapModel } from "./owner-dispatch-map-model";

const OwnerDispatchLeafletMap = dynamic(
  () => import("./OwnerDispatchLeafletMap").then((module) => module.OwnerDispatchLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60dvh] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600 lg:h-[calc(100dvh-14rem)] lg:min-h-[34rem]">
        Đang tải bản đồ...
      </div>
    ),
  },
);
const OwnerDispatchTomTomMap = dynamic(() => import("./OwnerDispatchTomTomMap").then((module) => module.OwnerDispatchTomTomMap), { ssr: false, loading: () => <div className="flex h-[60dvh] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600">Đang tải bản đồ...</div> });

export type OwnerDispatchMapProps = {
  model: OwnerDispatchMapModel;
  selectedTourId: string | null;
  onSelectTour: (tourId: string) => void;
};

export function OwnerDispatchMap(props: OwnerDispatchMapProps) {
  return process.env.NEXT_PUBLIC_TOMTOM_MAPS_API_KEY ? <OwnerDispatchTomTomMap {...props} /> : <OwnerDispatchLeafletMap {...props} />;
}
