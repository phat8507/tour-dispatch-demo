"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { markOwnerEmployeeOff, unmarkOwnerEmployeeOff, type OwnerMutationState } from "../actions";
import type { DailyOffEmployee } from "@/features/dispatch/owner-dispatch-view-model";

const INITIAL_STATE: OwnerMutationState = { ok: false, message: "" };

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} aria-label={label} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Đang lưu…" : label}</button>;
}

function EmployeeOffForm({ employee, selectedDate, atLimit }: { employee: DailyOffEmployee; selectedDate: string; atLimit: boolean }) {
  const action = employee.isOff ? unmarkOwnerEmployeeOff : markOwnerEmployeeOff;
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const label = employee.isOff ? `Bỏ nghỉ ${employee.name}` : `Đánh dấu nghỉ ${employee.name}`;
  return (
    <><form action={formAction}><input type="hidden" name="employeeId" value={employee.id} /><input type="hidden" name="offDate" value={selectedDate} /><SubmitButton label={label} disabled={!employee.isOff && atLimit} /></form>{state.message && <p role="status" className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>}</>
  );
}

function EmployeeOffControl({ employee, selectedDate, atLimit }: { employee: DailyOffEmployee; selectedDate: string; atLimit: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-slate-900">{employee.name}</p><p className={`text-xs font-semibold ${employee.isOff ? "text-rose-700" : "text-emerald-700"}`}>{employee.isOff ? "Đang nghỉ" : "Đang làm"}</p></div><EmployeeOffForm key={employee.isOff ? "off" : "on"} employee={employee} selectedDate={selectedDate} atLimit={atLimit} /></div></div>;
}

export function OwnerDailyOffPanel({ selectedDate, employees, offCount, maxOff }: { selectedDate: string; employees: DailyOffEmployee[]; offCount: number; maxOff: 2 }) {
  return (
    <details className="mb-5 rounded-xl border border-slate-200 bg-slate-100 p-4">
      <summary id="daily-off-heading" className="cursor-pointer font-semibold text-slate-950">Quản lý nhân viên nghỉ</summary>
      <p className="mt-2 text-sm text-slate-600">Trạng thái nghỉ áp dụng cho ngày đã chọn.</p>
      <p className="mt-3 text-sm font-semibold text-slate-800">{offCount}/{maxOff} người nghỉ</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => <EmployeeOffControl key={employee.id} employee={employee} selectedDate={selectedDate} atLimit={offCount >= maxOff} />)}
      </div>
    </details>
  );
}
