"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertOwnerRoutingOrigin, removeOwnerRoutingOrigin, type OwnerMutationState } from "../actions";
import type { EmployeeRoutingOriginDto } from "@/features/dispatch/owner-dispatch-view-model";

const INITIAL_STATE: OwnerMutationState = { ok: false, message: "" };

function SubmitButton({ label, disabled = false, type = "submit" }: { label: string; disabled?: boolean; type?: "submit" | "button" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-label={label}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
    >
      {pending ? "Đang lưu…" : label}
    </button>
  );
}

const coordinateInputClassName =
  "mt-1.5 w-full min-h-11 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-950 outline-none transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40";

function OriginForm({ origin }: { origin: EmployeeRoutingOriginDto }) {
  const [upsertState, upsertAction] = useActionState(upsertOwnerRoutingOrigin, INITIAL_STATE);
  const [removeState, removeAction] = useActionState(removeOwnerRoutingOrigin, INITIAL_STATE);

  const hasOrigin = origin.latitude !== null && origin.longitude !== null;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <form action={upsertAction} className="flex flex-col gap-3">
        <input type="hidden" name="employeeId" value={origin.employeeId} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-xs font-medium text-slate-700">
            Vĩ độ
            <input type="number" step="any" name="latitude" defaultValue={origin.latitude ?? ""} required className={coordinateInputClassName} />
          </label>
          <label className="flex-1 text-xs font-medium text-slate-700">
            Kinh độ
            <input type="number" step="any" name="longitude" defaultValue={origin.longitude ?? ""} required className={coordinateInputClassName} />
          </label>
        </div>
        <label className="text-xs font-medium text-slate-700">
          Nhãn
          <input type="text" name="label" defaultValue={origin.label ?? ""} maxLength={100} className={coordinateInputClassName} placeholder="VD: Nhà riêng" />
        </label>
        <div>
          <SubmitButton label="Cập nhật" />
        </div>
        {upsertState.message && <p role="status" className={`text-xs font-medium ${upsertState.ok ? "text-emerald-700" : "text-rose-700"}`}>{upsertState.message}</p>}
      </form>

      {hasOrigin && (
        <form action={removeAction} className="border-t border-slate-200 pt-3">
          <input type="hidden" name="employeeId" value={origin.employeeId} />
          <SubmitButton label="Xoá gốc" />
          {removeState.message && <p role="status" className={`mt-1 text-xs font-medium ${removeState.ok ? "text-emerald-700" : "text-rose-700"}`}>{removeState.message}</p>}
        </form>
      )}
    </div>
  );
}

function RoutingOriginControl({ origin }: { origin: EmployeeRoutingOriginDto }) {
  const [editing, setEditing] = useState(false);
  const hasOrigin = origin.latitude !== null && origin.longitude !== null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{origin.employeeName}</p>
          <p className={`text-xs font-semibold ${origin.isActive ? "text-emerald-700" : "text-rose-700"}`}>{origin.isActive ? "Đang hoạt động" : "Không hoạt động"}</p>
          <p className="text-xs text-slate-600">Cơ sở mặc định · {hasOrigin ? "Đã có điểm riêng" : "Chưa có điểm riêng"}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {editing ? "Đóng" : "Thiết lập điểm riêng"}
        </button>
      </div>
      {editing && <OriginForm origin={origin} />}
    </div>
  );
}

export function OwnerRoutingOriginPanel({ origins }: { origins: EmployeeRoutingOriginDto[] }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-100">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold text-slate-950 marker:content-none">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true">
          <path fillRule="evenodd" d="M6 4l6 6-6 6V4z" clipRule="evenodd" />
        </svg>
        <span id="routing-origin-heading">Cài đặt nâng cao</span>
      </summary>
      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Điểm bắt đầu riêng của nhân viên</h2>
            <p className="mt-1 text-sm text-slate-600">Mặc định, hệ thống sử dụng cơ sở của nhân viên. Chỉ thiết lập điểm riêng khi nhân viên thường bắt đầu ngày làm việc ở địa điểm khác.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {origins.map((origin) => (
            <RoutingOriginControl key={origin.employeeId} origin={origin} />
          ))}
        </div>
      </div>
    </details>
  );
}
