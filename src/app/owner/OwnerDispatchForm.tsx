"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { confirmOwnerDispatch, overrideOwnerDispatch } from "../actions";

type Candidate = { id: string; name: string; requiresOverride?: boolean };

const fieldClassName =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-950 outline-none transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40";

export function OwnerDispatchForm({ orderId, orderVersion, requestedAt, durationMinutes = 60, candidates, selectedEmployeeId }: { orderId: string; orderVersion: string; requestedAt: string; durationMinutes?: number; candidates: Candidate[]; selectedEmployeeId?: string }) {
  const initialState = { message: "", ok: false };
  const [confirmState, confirmAction] = useActionState(confirmOwnerDispatch, initialState);
  const [overrideState, overrideAction] = useActionState(overrideOwnerDispatch, initialState);
  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <form action={confirmAction} className="flex flex-wrap items-center gap-2">
        <Fields key={`confirm-${selectedEmployeeId ?? "none"}`} orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} durationMinutes={durationMinutes} candidates={candidates} selectedEmployeeId={selectedEmployeeId} />
        <OwnerSubmit label="Xác nhận phân công" />
      </form>
      <form action={overrideAction} className="flex flex-wrap items-center gap-2">
        <Fields key={`override-${selectedEmployeeId ?? "none"}`} orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} durationMinutes={durationMinutes} candidates={candidates} selectedEmployeeId={selectedEmployeeId} reason />
        <OwnerSubmit label="Ghi đè phân công" />
      </form>
      <OwnerDispatchStatus confirmState={confirmState} overrideState={overrideState} />
    </div>
  );
}

function Fields({ orderId, orderVersion, requestedAt, durationMinutes, candidates, selectedEmployeeId, reason = false }: { orderId: string; orderVersion: string; requestedAt: string; durationMinutes: number; candidates: Candidate[]; selectedEmployeeId?: string; reason?: boolean }) {
  const startsAt = requestedAt.slice(0, 16); const endsAt = new Date(new Date(requestedAt).getTime() + durationMinutes * 60_000).toISOString().slice(0, 16);
  return (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="expectedOrderVersion" value={orderVersion} />
      <select name="employeeId" required defaultValue={selectedEmployeeId ?? ""} className={fieldClassName}>
        <option value="" disabled>Chọn nhân viên</option>
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={!reason && candidate.requiresOverride}>{candidate.name}{candidate.requiresOverride ? " (cần ghi đè)" : ""}</option>)}
      </select>
      <input name="startsAt" type="datetime-local" defaultValue={startsAt} required className={fieldClassName} />
      <input name="endsAt" type="datetime-local" defaultValue={endsAt} required className={fieldClassName} />
      {reason && <input name="overrideReason" placeholder="Lý do ghi đè" required className={`flex-1 ${fieldClassName}`} />}
    </>
  );
}

export function OwnerSubmit({ label }: { label: string }) { const { pending } = useFormStatus(); return <OwnerSubmitButton label={label} pending={pending} />; }
export function OwnerSubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      disabled={pending}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
    >
      {pending ? "Đang lưu…" : label}
    </button>
  );
}
export function OwnerDispatchStatus({ confirmState, overrideState }: { confirmState: { message: string }; overrideState: { message: string } }) { const message = confirmState.message || overrideState.message; return message ? <p role="status" className="text-xs font-medium text-slate-700">{message}</p> : null; }
