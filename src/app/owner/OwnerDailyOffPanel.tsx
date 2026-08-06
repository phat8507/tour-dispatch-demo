"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { markOwnerEmployeeOff, unmarkOwnerEmployeeOff, type OwnerMutationState } from "../actions";
import type { DailyOffEmployee } from "@/features/dispatch/owner-dispatch-view-model";

const INITIAL_STATE: OwnerMutationState = { ok: false, message: "" };

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={label}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
    >
      {pending ? "Đang lưu…" : label}
    </button>
  );
}

function EmployeeOffForm({ employee, selectedDate, atLimit }: { employee: DailyOffEmployee; selectedDate: string; atLimit: boolean }) {
  const action = employee.isOff ? unmarkOwnerEmployeeOff : markOwnerEmployeeOff;
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const label = employee.isOff ? `Bỏ nghỉ ${employee.name}` : `Đánh dấu nghỉ ${employee.name}`;
  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="employeeId" value={employee.id} />
        <input type="hidden" name="offDate" value={selectedDate} />
        <SubmitButton label={label} disabled={!employee.isOff && atLimit} />
      </form>
      {state.message && (
        <p role="status" className={`mt-2 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      )}
    </>
  );
}

function EmployeeOffControl({ employee, selectedDate, atLimit }: { employee: DailyOffEmployee; selectedDate: string; atLimit: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{employee.name}</p>
          <p className={`text-xs font-semibold ${employee.isOff ? "text-rose-700" : "text-emerald-700"}`}>{employee.isOff ? "Đang nghỉ" : "Đang làm"}</p>
        </div>
        <EmployeeOffForm key={employee.isOff ? "off" : "on"} employee={employee} selectedDate={selectedDate} atLimit={atLimit} />
      </div>
    </div>
  );
}

export function OwnerDailyOffPanel({ selectedDate, employees, offCount, maxOff }: { selectedDate: string; employees: DailyOffEmployee[]; offCount: number; maxOff: 2 }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-100">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold text-slate-950 marker:content-none">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true">
          <path fillRule="evenodd" d="M6 4l6 6-6 6V4z" clipRule="evenodd" />
        </svg>
        <span id="daily-off-heading">Quản lý nhân viên nghỉ</span>
      </summary>
      <div className="px-4 pb-4">
        <p className="text-sm text-slate-600">Trạng thái nghỉ áp dụng cho ngày đã chọn.</p>
        <p className="mt-3 text-sm font-semibold text-slate-800">{offCount}/{maxOff} người nghỉ</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => <EmployeeOffControl key={employee.id} employee={employee} selectedDate={selectedDate} atLimit={offCount >= maxOff} />)}
        </div>
      </div>
    </details>
  );
}
