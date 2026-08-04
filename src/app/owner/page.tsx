import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDispatchServerDependencies } from "@/server/dispatch-composition";
import { authenticateSession } from "@/server/owner-auth";
import { logout } from "../actions";
import { OwnerDispatchForm } from "./OwnerDispatchForm";
import type { ActiveEmployeeCandidate, OwnerDispatchTour } from "@/server/owner-dispatch-read-model";

export const dynamic = "force-dynamic";

export default async function OwnerDispatchPage() {
  const dependencies = createDispatchServerDependencies();
  const token = (await cookies()).get("dispatch_session")?.value;
  try { authenticateSession(token, dependencies.owner); } catch { redirect("/login"); }
  let tours: OwnerDispatchTour[]; let candidates: ActiveEmployeeCandidate[][];
  try { tours = await dependencies.readModel.listOwnerDispatchTours(); const activeCandidates = tours.length > 0 ? await dependencies.readModel.listActiveEmployeeCandidatesForOrder(tours[0].id) : []; candidates = tours.map(() => activeCandidates); }
  catch { return <main className="mx-auto w-full max-w-5xl p-6"><p role="alert">Không thể tải dữ liệu điều phối. Vui lòng thử lại.</p></main>; }
  return <main className="mx-auto w-full max-w-5xl p-6"><header className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-semibold">Điều phối tour</h1><form action={logout}><button className="rounded border px-3 py-2">Đăng xuất</button></form></header>{tours.length === 0 ? <p>Chưa có tour cần điều phối.</p> : <ul className="space-y-3">{tours.map((tour, index) => <li key={tour.id} className="rounded border p-4"><h2 className="font-medium">{tour.customerName}</h2><p>{tour.requestedAt} · {tour.location.name} · {tour.status}</p><p>Dịch vụ: {tour.services.map((service) => service.name).join(", ") || "Không có dịch vụ"}</p><p>{tour.assignments.length === 0 ? "Chưa phân công" : tour.assignments.map((assignment) => `${assignment.employeeName} (${assignment.status})${assignment.isOverride ? ` — Ghi đè: ${assignment.overrideReason}` : ""}`).join(", ")}</p><OwnerDispatchForm orderId={tour.id} orderVersion={tour.orderVersion} requestedAt={tour.requestedAt} candidates={candidates[index].map((candidate) => ({ id: candidate.id, name: candidate.name }))} /></li>)}</ul>}</main>;
}
