/**
 * OfferDecisionDialog — the explicit offer decision before an episode
 * starts (hooks/useOfferDecision; services/startOfferDecision on the
 * server). The event's offer is not accepted yet: Accept, Negotiate,
 * Decline, or Continue without accepting. Nothing is preselected; Cancel
 * starts nothing. Shared by the Event Package's Start Episode, the Event
 * Library's Generate and the What's next overlay.
 */
import { useEffect, useRef } from 'react';
import { Handshake, X } from 'lucide-react';
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
  useEffect(() => { if (pending) firstRef.current?.focus(); }, [pending]);
  if (!pending) return null;
  const { offer } = pending;
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
        <div className="odd-choices">
          {CHOICES.map((c, i) => (
            <button key={c.decision} ref={i === 0 ? firstRef : null} type="button" className="odd-choice"
              onClick={() => onChoose?.(c.decision)} disabled={busy} data-testid={`offer-decision-${c.decision}`}>
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
