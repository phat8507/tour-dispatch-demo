"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { confirmOwnerDispatch, overrideOwnerDispatch } from "../actions";
type Candidate = { id: string; name: string };
export function OwnerDispatchForm({ orderId, orderVersion, requestedAt, candidates }: { orderId: string; orderVersion: string; requestedAt: string; candidates: Candidate[] }) {
  const initialState = { message: "", ok: false };
  const [confirmState, confirmAction] = useActionState(confirmOwnerDispatch, initialState);
  const [overrideState, overrideAction] = useActionState(overrideOwnerDispatch, initialState);
  return <div className="mt-3 grid gap-2"><form action={confirmAction}><Fields orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} candidates={candidates} /><OwnerSubmit label="Xác nhận phân công" /></form><form action={overrideAction}><Fields orderId={orderId} orderVersion={orderVersion} requestedAt={requestedAt} candidates={candidates} reason /><OwnerSubmit label="Ghi đè phân công" /></form><OwnerDispatchStatus confirmState={confirmState} overrideState={overrideState} /></div>;
}
function Fields({ orderId, orderVersion, requestedAt, candidates, reason = false }: { orderId: string; orderVersion: string; requestedAt: string; candidates: Candidate[]; reason?: boolean }) { return <><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="expectedOrderVersion" value={orderVersion} /><select name="employeeId" required defaultValue=""><option value="" disabled>Chọn nhân viên</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><input name="startsAt" type="datetime-local" defaultValue={requestedAt.slice(0, 16)} required /><input name="endsAt" type="datetime-local" required />{reason && <input name="overrideReason" placeholder="Lý do ghi đè" required />}</>; }
export function OwnerSubmit({ label }: { label: string }) { const { pending } = useFormStatus(); return <OwnerSubmitButton label={label} pending={pending} />; }
export function OwnerSubmitButton({ label, pending }: { label: string; pending: boolean }) { return <button className="ml-2 rounded border px-2 py-1" disabled={pending}>{pending ? "Đang lưu…" : label}</button>; }
export function OwnerDispatchStatus({ confirmState, overrideState }: { confirmState: { message: string }; overrideState: { message: string } }) { const message = confirmState.message || overrideState.message; return message ? <p role="status">{message}</p> : null; }
