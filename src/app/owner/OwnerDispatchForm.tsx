"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmOwnerDispatch, overrideOwnerDispatch } from "../actions";

type Candidate = { id: string; name: string; requiresOverride?: boolean; serviceName?: string };

const fieldClassName =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-950 outline-none transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40";

export function OwnerDispatchForm({ orderId, orderVersion, requestedAt, durationMinutes = 60, candidates, selectedEmployeeId, onCancelSelection }: { orderId: string; orderVersion: string; requestedAt: string; durationMinutes?: number; candidates: Candidate[]; selectedEmployeeId?: string; onCancelSelection?: () => void }) {
  const initialState = { message: "", ok: false };
  const [confirmState, confirmAction] = useActionState(confirmOwnerDispatch, initialState);
  const [overrideState, overrideAction] = useActionState(overrideOwnerDispatch, initialState);
  const [reason, setReason] = useState("");
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedEmployeeId);
  const isOverride = selectedCandidate?.requiresOverride;
  const isSelected = Boolean(selectedEmployeeId);
  const success = confirmState.ok || overrideState.ok;
  const failure = confirmState.message || overrideState.message;
  const overridePrompt = isOverride && selectedCandidate
    ? `Chưa có đánh giá tay nghề kỹ thuật của ${selectedCandidate.name}${selectedCandidate.serviceName ? ` cho dịch vụ ${selectedCandidate.serviceName}` : ""}. Bạn vẫn muốn chọn nhân viên này?`
    : "";

  return (
    <div className={`mt-3 space-y-3 border-t border-slate-200 pt-3 ${isSelected ? "block" : "hidden"}`}>
      {!isOverride ? (
        <form action={confirmAction} className="flex flex-wrap items-center gap-2">
          <Fields orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} durationMinutes={durationMinutes} candidates={candidates} selectedEmployeeId={selectedEmployeeId} />
          <OwnerSubmit label="Xác nhận phân công" />
        </form>
      ) : (
        <form action={overrideAction} className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 font-medium text-amber-900">{overridePrompt}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Fields orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} durationMinutes={durationMinutes} candidates={candidates} selectedEmployeeId={selectedEmployeeId} reason={reason} onReasonChange={setReason} />
            <button type="button" onClick={() => { setReason(""); onCancelSelection?.(); }} className="min-h-11 px-3 text-sm font-medium text-slate-700">Hủy</button>
            <OwnerSubmit label={`Xác nhận chọn ${selectedCandidate?.name}`} disabled={!reason.trim()} />
          </div>
        </form>
      )}
      {success ? <p role="status" className="text-xs font-medium text-emerald-800">Đã phân {selectedCandidate?.name}</p> : failure ? <p role="alert" className="text-xs font-medium text-red-800">{failure || "Không thể phân nhân viên. Vui lòng thử lại."}</p> : <OwnerDispatchStatus confirmState={confirmState} overrideState={overrideState} />}
    </div>
  );
}

function Fields({ orderId, orderVersion, requestedAt, durationMinutes, candidates, selectedEmployeeId, reason, onReasonChange }: { orderId: string; orderVersion: string; requestedAt: string; durationMinutes: number; candidates: Candidate[]; selectedEmployeeId?: string; reason?: string; onReasonChange?: (value: string) => void }) {
  const startsAt = requestedAt.slice(0, 16);
  const endsAt = new Date(new Date(requestedAt).getTime() + durationMinutes * 60_000).toISOString().slice(0, 16);
  return <>
    <input type="hidden" name="orderId" value={orderId} />
    <input type="hidden" name="expectedOrderVersion" value={orderVersion} />
    <input type="hidden" name="employeeId" value={selectedEmployeeId ?? ""} />
    <select value={selectedEmployeeId ?? ""} disabled className={fieldClassName}>
      <option value="" disabled>Chọn nhân viên</option>
      {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
    </select>
    <input name="startsAt" type="datetime-local" value={startsAt} readOnly required className={fieldClassName} />
    <input name="endsAt" type="datetime-local" value={endsAt} readOnly required className={fieldClassName} />
    {onReasonChange && <input name="overrideReason" placeholder="Lý do ghi đè" required value={reason} onChange={(event) => onReasonChange(event.target.value)} className={`flex-1 ${fieldClassName}`} />}
  </>;
}

export function OwnerSubmit({ label, disabled = false }: { label: string; disabled?: boolean }) { const { pending } = useFormStatus(); return <OwnerSubmitButton label={label} pending={pending} disabled={disabled} />; }
export function OwnerSubmitButton({ label, pending, disabled = false }: { label: string; pending: boolean; disabled?: boolean }) {
  return <button disabled={pending || disabled} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white">{pending ? "Đang lưu…" : label}</button>;
}
export function OwnerDispatchStatus({ confirmState, overrideState }: { confirmState: { message: string }; overrideState: { message: string } }) { const message = confirmState.message || overrideState.message; return message ? <p role="status" className="text-xs font-medium text-slate-700">{message}</p> : null; }
