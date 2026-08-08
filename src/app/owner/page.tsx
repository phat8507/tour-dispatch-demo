import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../actions";
import { OwnerDailyOffPanel } from "./OwnerDailyOffPanel";
import { OwnerRoutingOriginPanel } from "./OwnerRoutingOriginPanel";
import { OwnerTourCreatePanel } from "./OwnerTourCreatePanel";
import { OwnerDispatchDashboard } from "@/features/dispatch/OwnerDispatchDashboard";
import { buildOwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchTour } from "@/features/dispatch/owner-dispatch-view-model";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { authenticateSession } from "@/server/owner-auth";
import type { DailyOffProjection, EmployeeRoutingOriginDto } from "@/server/owner-dispatch-read-model";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";
import { businessDateInHoChiMinh, isValidBusinessDate } from "@/domain/business-date";
import { prepareStoredOriginsForBaseline } from "@/server/owner-recommendation-travel-orchestrator";

export const dynamic = "force-dynamic";

function currentBusinessDate(): string {
  return businessDateInHoChiMinh(new Date());
}

function selectedBusinessDate(value: string | undefined): string {
  return value && isValidBusinessDate(value) ? value : currentBusinessDate();
}

export default async function OwnerDispatchPage({ searchParams }: { searchParams?: Promise<{ offDate?: string }> } = {}) {
  const dependencies = createDispatchServerDependencies();
  const token = (await cookies()).get("dispatch_session")?.value;
  const offDate = selectedBusinessDate((await searchParams)?.offDate);
  let projection: {
    tours: OwnerDispatchTour[];
    recommendations: CandidateRecommendation[][];
    providerWarnings: Array<"NO_PROVIDER" | "TIMEOUT" | "RATE_LIMITED" | "MALFORMED_RESPONSE" | "TOTAL_FAILURE" | undefined>;
    mapModel: OwnerDispatchMapModel;
    dailyOff: DailyOffProjection;
    routingOrigins: EmployeeRoutingOriginDto[];
    branches: Awaited<ReturnType<typeof dependencies.readModel.listOwnerDispatchBranches>>;
    services: Array<{ id: string; name: string; durationMinutes: number }>;
  };
  try {
    authenticateSession(token, dependencies.owner);
  } catch {
    redirect("/login");
  }

  try {
    const tours = await dependencies.readModel.listOwnerDispatchTours(offDate);
    const [branches, dailyOff, routingOriginLoad, services] = await Promise.all([
      dependencies.readModel.listOwnerDispatchBranches(),
      dependencies.readModel.listDailyOffEmployees(offDate),
      dependencies.readModel.loadOwnerRoutingOrigins(),
      dependencies.readModel.listOwnerDispatchServices(),
    ]);
    const recommendationsByOrder = await dependencies.readModel.listCandidateRecommendationsForTours(tours, new Date(), routingOriginLoad.byEmployeeId, dependencies.travelProvider);
    prepareStoredOriginsForBaseline(recommendationsByOrder, routingOriginLoad.byEmployeeId);
    const recommendationMap = new Map(recommendationsByOrder.map((item) => [item.orderId, item.recommendations]));
    const recommendations = tours.map((tour) => recommendationMap.get(tour.id) ?? []);
    projection = { tours, recommendations, providerWarnings: tours.map((tour) => recommendationMap.has(tour.id) ? recommendationsByOrder.find((item) => item.orderId === tour.id)?.providerWarning : undefined), mapModel: buildOwnerDispatchMapModel(tours, branches), dailyOff, routingOrigins: routingOriginLoad.panelOrigins, branches, services };
  } catch {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl items-center justify-center p-6">
        <div role="alert" className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-semibold text-red-800">Không thể tải dữ liệu điều phối.</p>
          <p className="mt-1 text-sm text-red-700">Vui lòng thử lại.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[1400px] bg-slate-50 p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Điều phối tour</h1>
          <p className="mt-1 text-sm text-slate-600">Chọn nhân viên phù hợp và xác nhận phân công tour.</p>
          <p className="text-sm text-slate-600">Các phân công đã xác nhận được lưu tự động.</p>
        </div>
        <form action={logout}>
          <button className="min-h-11 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Đăng xuất
          </button>
        </form>
      </header>
      <form method="get" action="/owner" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          <span className="block">Ngày điều phối</span>
          <input className="mt-1.5 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40" type="date" name="offDate" defaultValue={offDate} />
        </label>
        <button type="submit" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Xem ngày</button>
      </form>
      <OwnerTourCreatePanel selectedDate={offDate} services={projection.services} branches={projection.branches} />
      <OwnerDispatchDashboard tours={projection.tours} recommendations={projection.recommendations} providerWarnings={projection.providerWarnings} mapModel={projection.mapModel} emptyCreateTour={<OwnerTourCreatePanel selectedDate={offDate} services={projection.services} branches={projection.branches} />} />
      <div className="mt-5 space-y-3">
        <OwnerDailyOffPanel selectedDate={offDate} {...projection.dailyOff} />
        <OwnerRoutingOriginPanel origins={projection.routingOrigins} />
      </div>
    </main>
  );
}
