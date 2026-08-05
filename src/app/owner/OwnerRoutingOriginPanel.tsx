"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { upsertOwnerRoutingOrigin, removeOwnerRoutingOrigin, type OwnerMutationState } from "../actions";
import type { EmployeeRoutingOriginDto } from "@/features/dispatch/owner-dispatch-view-model";

const INITIAL_STATE: OwnerMutationState = { ok: false, message: "" };

function SubmitButton({ label, disabled = false, type = "submit" }: { label: string; disabled?: boolean; type?: "submit" | "button" }) {
  const { pending } = useFormStatus();
  return <button type={type} disabled={disabled || pending} aria-label={label} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Đang lưu…" : label}</button>;
}

function OriginForm({ origin }: { origin: EmployeeRoutingOriginDto }) {
  const [upsertState, upsertAction] = useActionState(upsertOwnerRoutingOrigin, INITIAL_STATE);
  const [removeState, removeAction] = useActionState(removeOwnerRoutingOrigin, INITIAL_STATE);

  const hasOrigin = origin.latitude !== null && origin.longitude !== null;

  return (
    <div className="mt-2 space-y-2">
      <form action={upsertAction} className="flex flex-col gap-2">
        <input type="hidden" name="employeeId" value={origin.employeeId} />
        <div className="flex gap-2">
          <label className="flex-1 text-xs">
            Vĩ độ
            <input type="number" step="any" name="latitude" defaultValue={origin.latitude ?? ""} required className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
          </label>
          <label className="flex-1 text-xs">
            Kinh độ
            <input type="number" step="any" name="longitude" defaultValue={origin.longitude ?? ""} required className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
          </label>
        </div>
        <label className="text-xs">
          Nhãn
          <input type="text" name="label" defaultValue={origin.label ?? ""} maxLength={100} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" placeholder="VD: Nhà riêng" />
        </label>
        <div className="mt-1">
          <SubmitButton label="Cập nhật" />
        </div>
        {upsertState.message && <p role="status" className={`text-xs ${upsertState.ok ? "text-emerald-700" : "text-rose-700"}`}>{upsertState.message}</p>}
      </form>
      
      {hasOrigin && (
        <form action={removeAction} className="mt-2 border-t border-slate-200 pt-2">
          <input type="hidden" name="employeeId" value={origin.employeeId} />
          <SubmitButton label="Xoá gốc" />
          {removeState.message && <p role="status" className={`mt-1 text-xs ${removeState.ok ? "text-emerald-700" : "text-rose-700"}`}>{removeState.message}</p>}
        </form>
      )}
    </div>
  );
}

function RoutingOriginControl({ origin }: { origin: EmployeeRoutingOriginDto }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{origin.employeeName}</p>
          <p className={`text-xs font-semibold ${origin.isActive ? "text-emerald-700" : "text-rose-700"}`}>{origin.isActive ? "ACTIVE" : "INACTIVE"}</p>
        </div>
      </div>
      <OriginForm origin={origin} />
    </div>
  );
}

export function OwnerRoutingOriginPanel({ origins }: { origins: EmployeeRoutingOriginDto[] }) {
  return (
    <section aria-labelledby="routing-origin-heading" className="mb-5 rounded-xl border border-slate-200 bg-slate-100 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="routing-origin-heading" className="font-semibold text-slate-950">Quản lý điểm xuất phát</h2>
          <p className="mt-1 text-sm text-slate-600">Dùng cho thuật toán tìm đường đầu ngày. Không hiển thị trên bản đồ.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {origins.map((origin) => (
          <RoutingOriginControl key={origin.employeeId} origin={origin} />
        ))}
      </div>
    </section>
  );
}
