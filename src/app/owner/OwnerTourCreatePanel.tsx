"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOwnerTour, type OwnerMutationState } from "../actions";

type Service = { id: string; name: string; durationMinutes: number };
type Branch = { id: string; branchId: "CS1" | "CS2"; name: string };

export function OwnerTourCreatePanel({ selectedDate, services, branches }: { selectedDate: string; services: Service[]; branches: Branch[] }) {
  const [open, setOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState<"HOME" | "BRANCH">("HOME");
  const [state, action] = useActionState<OwnerMutationState, FormData>(createOwnerTour, { ok: false, message: "" });
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Tạo tour mới</button>;
  return <section aria-label="Tạo tour mới" className="mb-5 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">Tạo tour mới</h2><button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm text-slate-700">Đóng</button></div>
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Tên khách<input required name="customerName" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Số điện thoại<input name="customerPhone" inputMode="tel" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Ngày<input required name="date" type="date" defaultValue={selectedDate} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Giờ khách hẹn<input required name="time" type="time" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Loại tour<select name="orderType" defaultValue="NEW_TOUR" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="NEW_TOUR">Tour mới</option><option value="MILEAGE">Đơn dặm</option></select></label>
      <label className="text-sm font-medium text-slate-700">Dịch vụ<select required name="serviceId" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="" disabled>Chọn dịch vụ</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
      <fieldset className="sm:col-span-2"><legend className="text-sm font-medium text-slate-700">Điểm phục vụ</legend><div className="mt-1 flex gap-4"><label><input checked={fulfillment === "HOME"} onChange={() => setFulfillment("HOME")} type="radio" name="fulfillment" value="HOME" /> Tại nhà</label><label><input checked={fulfillment === "BRANCH"} onChange={() => setFulfillment("BRANCH")} type="radio" name="fulfillment" value="BRANCH" /> Tại tiệm</label></div></fieldset>
      {fulfillment === "HOME" ? <label className="sm:col-span-2 text-sm font-medium text-slate-700">Địa chỉ khách<input required name="customerAddress" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label> : <label className="sm:col-span-2 text-sm font-medium text-slate-700">Cơ sở<select required name="branchId" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="" disabled>Chọn cơ sở</option>{branches.map((branch) => <option key={branch.id} value={branch.branchId}>{branch.branchId} — {branch.name}</option>)}</select></label>}
      <label className="sm:col-span-2 text-sm font-medium text-slate-700">Ghi chú<textarea name="notes" className="mt-1 block min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      {state.message && <p role="status" className="sm:col-span-2 text-sm text-slate-700">{state.message}</p>}
      <button className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 sm:col-span-2">Lưu tour</button>
    </form>
  </section>;
}
