import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../actions";
import { OwnerDailyOffPanel } from "./OwnerDailyOffPanel";
import { OwnerRoutingOriginPanel } from "./OwnerRoutingOriginPanel";
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
  };
  try {
    authenticateSession(token, dependencies.owner);
  } catch {
    redirect("/login");
  }

  try {
    const tours = await dependencies.readModel.listOwnerDispatchTours();
    const [branches, dailyOff, routingOriginLoad] = await Promise.all([
      dependencies.readModel.listOwnerDispatchBranches(),
      dependencies.readModel.listDailyOffEmployees(offDate),
      dependencies.readModel.loadOwnerRoutingOrigins(),
    ]);
    const recommendationsByOrder = await dependencies.readModel.listCandidateRecommendationsForTours(tours, new Date(), routingOriginLoad.byEmployeeId, dependencies.travelProvider);
    prepareStoredOriginsForBaseline(recommendationsByOrder, routingOriginLoad.byEmployeeId);
    const recommendationMap = new Map(recommendationsByOrder.map((item) => [item.orderId, item.recommendations]));
    const recommendations = tours.map((tour) => recommendationMap.get(tour.id) ?? []);
    projection = { tours, recommendations, providerWarnings: tours.map((tour) => recommendationMap.has(tour.id) ? recommendationsByOrder.find((item) => item.orderId === tour.id)?.providerWarning : undefined), mapModel: buildOwnerDispatchMapModel(tours, branches), dailyOff, routingOrigins: routingOriginLoad.panelOrigins };
  } catch {
    return (
      <main className="mx-auto w-full max-w-5xl p-6">
        <p role="alert">Không thể tải dữ liệu điều phối. Vui lòng thử lại.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[1400px] bg-slate-50 p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Điều phối tour</h1>
          <p className="mt-1 text-sm text-slate-600">Chọn nhân viên phù hợp và xác nhận phân công tour.</p>
          <p className="mt-1 text-sm text-slate-600">Các phân công đã xác nhận được lưu tự động.</p>
        </div>
        <form action={logout}>
          <button className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Đăng xuất
          </button>
        </form>
      </header>
      <form method="get" action="/owner" className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">Ngày điều phối<input className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5" type="date" name="offDate" defaultValue={offDate} /></label>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium">Xem ngày</button>
      </form>
      <OwnerDispatchDashboard tours={projection.tours} recommendations={projection.recommendations} providerWarnings={projection.providerWarnings} mapModel={projection.mapModel} />
      <OwnerDailyOffPanel selectedDate={offDate} {...projection.dailyOff} />
      <OwnerRoutingOriginPanel origins={projection.routingOrigins} />
    </main>
  );
}
