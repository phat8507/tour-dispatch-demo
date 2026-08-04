import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../actions";
import { OwnerDispatchDashboard } from "@/features/dispatch/OwnerDispatchDashboard";
import { buildOwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchMapModel } from "@/features/dispatch/owner-dispatch-map-model";
import type { OwnerDispatchTour } from "@/features/dispatch/owner-dispatch-view-model";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { authenticateSession } from "@/server/owner-auth";

export const dynamic = "force-dynamic";

export default async function OwnerDispatchPage() {
  const dependencies = createDispatchServerDependencies();
  const token = (await cookies()).get("dispatch_session")?.value;
  let projection: {
    tours: OwnerDispatchTour[];
    candidates: Array<Array<{ id: string; name: string }>>;
    mapModel: OwnerDispatchMapModel;
  };
  try {
    authenticateSession(token, dependencies.owner);
  } catch {
    redirect("/login");
  }

  try {
    const [tours, branches] = await Promise.all([
      dependencies.readModel.listOwnerDispatchTours(),
      dependencies.readModel.listOwnerDispatchBranches(),
    ]);
    const candidates = await Promise.all(
      tours.map(async (tour) => {
        const employees = await dependencies.readModel.listActiveEmployeeCandidatesForOrder(tour.id);
        return employees.map((employee) => ({ id: employee.id, name: employee.name }));
      }),
    );
    projection = { tours, candidates, mapModel: buildOwnerDispatchMapModel(tours, branches) };
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
      <OwnerDispatchDashboard tours={projection.tours} candidates={projection.candidates} mapModel={projection.mapModel} />
    </main>
  );
}
