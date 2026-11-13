/**
 * ReasonDialog — asks why, for a step that is recorded with its reason
 * (Evoni's A1 ruling, 2026-11-13): declining or cancelling an offer and
 * undoing a step (services/opportunityTransitionAudit on the server, which
 * refuses them without one).
 *
 * useReasonDialog() gives { ask, dialog }: `ask({ title, question, confirm })`
 * opens the dialog and resolves to the reason, or to null when it is
 * cancelled (the step is then not taken); render `dialog` once in the page.
 * Confirming without a reason sends nothing, says a reason is needed, and
 * keeps what was typed. Enter with Ctrl or Cmd confirms; Escape cancels.
 * Focus moves into the field on open, Tab stays inside the dialog, and
 * focus goes back to the button that opened it (hooks/useDialogFocus).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { REASON_MAX, cleanReason } from '../lib/transitionReason';
import useDialogFocus from '../hooks/useDialogFocus';
import './ReasonDialog.css';

export function ReasonDialog({ request, onConfirm, onCancel }) {
  const fieldRef = useRef(null);
  const [value, setValue] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => { if (request) { setValue(''); setMissing(false); } }, [request]);
  const dialogRef = useDialogFocus(!!request, () => onCancel?.());
  if (!request) return null;
  const confirm = () => {
    const reason = cleanReason(value);
    if (!reason) { setMissing(true); fieldRef.current?.focus(); return; }
    onConfirm?.(reason);
  };
  return (
    <div className="rsn-backdrop" onClick={() => onCancel?.()}>
      <form ref={dialogRef} className="rsn-dialog" role="dialog" aria-modal="true" aria-labelledby="rsn-title" data-testid="reason-dialog" noValidate
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); confirm(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm(); } }}>
        <div className="rsn-header">
          <h3 id="rsn-title">{request.title || 'Why?'}</h3>
          <button type="button" className="rsn-close" onClick={onCancel} aria-label="Close"><X size={16} /></button>
        </div>
        <label className="rsn-field" htmlFor="rsn-reason">
          <span>{request.question || 'The reason is kept with the change.'}</span>
          <textarea id="rsn-reason" ref={fieldRef} value={value} maxLength={REASON_MAX} rows={3} required data-autofocus=""
            onChange={(e) => { setValue(e.target.value); setMissing(false); }}
            aria-invalid={missing ? 'true' : 'false'} aria-describedby={missing ? 'rsn-missing' : 'rsn-kept'}
            data-testid="reason-dialog-field" />
        </label>
        {missing
          ? <p className="rsn-missing" id="rsn-missing" role="alert" data-testid="reason-dialog-missing">A reason is needed. Nothing was changed.</p>
          : <p className="rsn-kept" id="rsn-kept">Kept with the change, with who made it and when. Admins can read it.</p>}
        <div className="rsn-actions">
          <button type="button" className="rsn-btn" onClick={onCancel} data-testid="reason-dialog-cancel">Cancel</button>
          <button type="submit" className="rsn-btn is-primary" data-testid="reason-dialog-confirm">{request.confirm || 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
}

export default function useReasonDialog() {
  const [request, setRequest] = useState(null);
  const waiting = useRef(null);
  const settle = useCallback((reason) => {
    const resolve = waiting.current;
    waiting.current = null;
    setRequest(null);
    resolve?.(reason);
  }, []);
  // A second ask while one is open cancels the first: one question at a time.
  const ask = useCallback((req = {}) => new Promise((resolve) => {
    waiting.current?.(null);
    waiting.current = resolve;
    setRequest({ ...req });
  }), []);
  const dialog = <ReasonDialog request={request} onConfirm={settle} onCancel={() => settle(null)} />;
  return { ask, dialog };
}
