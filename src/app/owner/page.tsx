import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../actions";
import { OwnerDailyOffPanel } from "./OwnerDailyOffPanel";
import { OwnerDispatchDashboard } from "@/features/dispatch/OwnerDispatchDashboard";
import { buildOwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchTour } from "@/features/dispatch/owner-dispatch-view-model";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { authenticateSession } from "@/server/owner-auth";
import type { DailyOffProjection } from "@/server/owner-dispatch-read-model";
import type { CandidateRecommendation } from "@/domain/production-candidate-recommendations";
import { businessDateInHoChiMinh, isValidBusinessDate } from "@/domain/business-date";

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
    mapModel: OwnerDispatchMapModel;
    dailyOff: DailyOffProjection;
  };
  try {
    authenticateSession(token, dependencies.owner);
  } catch {
    redirect("/login");
  }

  try {
    const tours = await dependencies.readModel.listOwnerDispatchTours();
    const [branches, dailyOff, recommendationsByOrder] = await Promise.all([
      dependencies.readModel.listOwnerDispatchBranches(),
      dependencies.readModel.listDailyOffEmployees(offDate),
      dependencies.readModel.listCandidateRecommendationsForTours(tours),
    ]);
    const recommendationMap = new Map(recommendationsByOrder.map((item) => [item.orderId, item.recommendations]));
    const recommendations = tours.map((tour) => recommendationMap.get(tour.id) ?? []);
    projection = { tours, recommendations, mapModel: buildOwnerDispatchMapModel(tours, branches), dailyOff };
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
          <p className="mt-1 text-sm text-slate-600">Bản đồ là lớp hiển thị. Phân công đã xác nhận trong PostgreSQL là dữ liệu chuẩn.</p>
        </div>
        <form action={logout}>
          <button className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Đăng xuất
          </button>
        </form>
      </header>
      <OwnerDailyOffPanel selectedDate={offDate} {...projection.dailyOff} />
      <OwnerDispatchDashboard tours={projection.tours} recommendations={projection.recommendations} mapModel={projection.mapModel} />
    </main>
  );
}
