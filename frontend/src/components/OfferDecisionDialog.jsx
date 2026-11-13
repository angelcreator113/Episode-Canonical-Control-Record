/**
 * OfferDecisionDialog — the explicit offer decision before an episode
 * starts (hooks/useOfferDecision; services/startOfferDecision on the
 * server). The event's offer is not accepted yet: Accept, Negotiate,
 * Decline, or Continue without accepting. Nothing is preselected; Cancel
 * starts nothing. Shared by the Event Package's Start Episode, the Event
 * Library's Generate and the What's next overlay.
 *
 * Declining and continuing without accepting need a reason (A1,
 * 2026-11-13): the choice is not sent without one, and the dialog says so.
 * The reason is kept with the decision, who made it and when.
 *
 * A decision is an admin's. When the person asking cannot make it
 * (`pending.canDecide` false, from the server's own answer), the dialog
 * says an admin decides and shows no choice at all: only Close, which
 * starts nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { Handshake, X } from 'lucide-react';
import { REASON_MAX, REASON_REQUIRED_DECISIONS, cleanReason } from '../lib/transitionReason';
import './OfferDecisionDialog.css';

const CHOICES = [
  { decision: 'accept', label: 'Accept', help: 'Book the deal (moves it to booked).' },
  { decision: 'negotiate', label: 'Negotiate', help: 'Keep talking (moves it to negotiating).' },
  { decision: 'decline', label: 'Decline', help: 'Turn the deal down; the episode still starts, without it.' },
  { decision: 'proceed_unaccepted', label: 'Continue without accepting', help: 'Start the episode; the offer stays as it is.' },
];

const STATUS_LABELS = { offered: 'Offered', considering: 'Considering', negotiating: 'Negotiating', held: 'Held for beat 14' };

function paymentText(offer) {
  const n = Number(offer?.payment_amount);
  if (!offer || offer.payment_amount == null || !Number.isFinite(n)) return 'No payment set';
  if (n === 0) return 'Unpaid';
  return `${n.toLocaleString()} coins`;
}

export default function OfferDecisionDialog({ pending, busy = false, onChoose, onCancel }) {
  const firstRef = useRef(null);
  const reasonRef = useRef(null);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(null);
  useEffect(() => { if (pending) firstRef.current?.focus(); setReason(''); setMissing(null); }, [pending]);
  if (!pending) return null;
  const { offer } = pending;
  if (pending.canDecide === false) {
    return (
      <div className="odd-backdrop" onClick={() => onCancel?.()}>
        <div className="odd-dialog" role="dialog" aria-modal="true" aria-labelledby="odd-title" data-testid="offer-decision"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel?.(); } }}>
          <div className="odd-header">
            <h3 id="odd-title"><Handshake size={15} aria-hidden="true" /> This offer needs an admin</h3>
            <button type="button" className="odd-close" onClick={onCancel} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="odd-offer" data-testid="offer-decision-offer">
            <strong>{offer?.name || 'This event\'s offer'}</strong>
            <span>{STATUS_LABELS[offer?.status] || offer?.status || ''}</span>
          </div>
          <p className="odd-ask" data-testid="offer-decision-admin-only">
            The offer is not accepted yet, and only an admin can accept it, negotiate, decline it or start the episode without it.
            The episode was not started. Ask an admin to start it.
          </p>
          <div className="odd-actions">
            <button ref={firstRef} type="button" className="odd-cancel" onClick={onCancel} data-testid="offer-decision-cancel">Close</button>
          </div>
        </div>
      </div>
    );
  }
  const choose = (decision) => {
    const why = cleanReason(reason);
    if (REASON_REQUIRED_DECISIONS.includes(decision) && !why) {
      setMissing(decision);
      reasonRef.current?.focus();
      return;
    }
    onChoose?.(decision, why);
  };
  return (
    <div className="odd-backdrop" onClick={() => { if (!busy) onCancel?.(); }}>
      <div className="odd-dialog" role="dialog" aria-modal="true" aria-labelledby="odd-title" data-testid="offer-decision"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onCancel?.(); } }}>
        <div className="odd-header">
          <h3 id="odd-title"><Handshake size={15} aria-hidden="true" /> The offer is not accepted yet</h3>
          <button type="button" className="odd-close" onClick={onCancel} aria-label="Close" disabled={busy}><X size={16} /></button>
        </div>
        <div className="odd-offer" data-testid="offer-decision-offer">
          <strong>{offer?.name || 'This event\'s offer'}</strong>
          <span>{STATUS_LABELS[offer?.status] || offer?.status || ''} · {paymentText(offer)}</span>
        </div>
        <p className="odd-ask">Decide what happens to it before the episode starts.</p>
        <label className="odd-reason">
          <span>Reason (needed to decline or to continue without accepting)</span>
          <textarea ref={reasonRef} value={reason} maxLength={REASON_MAX} rows={2} disabled={busy}
            onChange={(e) => { setReason(e.target.value); setMissing(null); }}
            aria-invalid={missing ? 'true' : 'false'} aria-describedby={missing ? 'odd-reason-missing' : undefined}
            data-testid="offer-decision-reason" />
        </label>
        {missing && (
          <p className="odd-reason-missing" id="odd-reason-missing" role="alert" data-testid="offer-decision-reason-missing">
            {missing === 'decline' ? 'Say why the offer is declined, then choose Decline again.' : 'Say why the episode starts without accepting it, then choose again.'}
          </p>
        )}
        <div className="odd-choices">
          {CHOICES.map((c, i) => (
            <button key={c.decision} ref={i === 0 ? firstRef : null} type="button" className="odd-choice"
              onClick={() => choose(c.decision)} disabled={busy} data-testid={`offer-decision-${c.decision}`}>
              <strong>{c.label}</strong>
              <span>{c.help}</span>
            </button>
          ))}
        </div>
        <div className="odd-actions">
          <button type="button" className="odd-cancel" onClick={onCancel} disabled={busy} data-testid="offer-decision-cancel">
            {busy ? 'Starting…' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
