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
 *
 * A decision the server refuses leaves the dialog open with what was typed
 * (`pending.refusal`, hooks/useOfferDecision):
 *   changed    the offers are not as shown: the choices wait until "Show
 *              the current offer" has been pressed (pending.onRefresh; it
 *              shows what the refusal carried, and sends nothing), then a
 *              new choice is needed;
 *   forbidden  this person cannot decide: no choice, the reason still there;
 *   invalid    the server's own words, and the choices as they were;
 *   failed     the network, a server error or another refusal: what
 *              happened, the reason kept, and the choices as they were.
 *              Nothing is sent again until one is chosen.
 *
 * Keyboard (hooks/useDialogFocus): focus moves in on open, Tab stays
 * inside, Escape closes (not while a decision is being sent), and focus
 * goes back to where it was.
 */
import { useEffect, useRef, useState } from 'react';
import { Handshake, X } from 'lucide-react';
import { REASON_MAX, REASON_REQUIRED_DECISIONS, cleanReason } from '../lib/transitionReason';
import useDialogFocus from '../hooks/useDialogFocus';
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

const CHANGED_TEXT = 'The offer information has changed since this opened. Nothing was started.';

export default function OfferDecisionDialog({ pending, busy = false, onChoose, onCancel }) {
  const open = !!pending;
  const reasonRef = useRef(null);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(null);
  // Emptied when the dialog opens, never while it is open: a refusal or a
  // refresh keeps what was typed.
  useEffect(() => { if (open) { setReason(''); setMissing(null); } }, [open]);
  const dialogRef = useDialogFocus(open, () => { if (!busy) onCancel?.(); });
  // A refusal disables the choice that had the focus; a refresh brings the
  // choices back. Either way the focus is put somewhere inside the dialog,
  // on the thing to do next, so the keyboard never falls out of it.
  const refusalKind = pending?.refusal?.kind || null;
  const refreshed = !!pending?.refreshed;
  useEffect(() => {
    const el = dialogRef.current;
    if (!el || (!refusalKind && !refreshed)) return;
    const next = el.querySelector('[data-testid="offer-decision-refresh"]')
      || (refusalKind ? reasonRef.current : el.querySelector('.odd-choice:not(:disabled)'))
      || el.querySelector('[data-testid="offer-decision-cancel"]');
    next?.focus();
  }, [refusalKind, refreshed, dialogRef]);
  if (!pending) return null;

  const { refusal } = pending;
  const offers = Array.isArray(pending.offers) && pending.offers.length ? pending.offers : (pending.offer ? [pending.offer] : []);
  const cannotDecide = pending.canDecide === false;
  const forbidden = refusal?.kind === 'forbidden';
  const changed = refusal?.kind === 'changed';
  const noneLeft = pending.refreshed && offers.length === 0;
  // No choice can be sent while one of these holds.
  const blocked = busy || forbidden || changed || noneLeft;

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
      <div ref={dialogRef} className="odd-dialog" role="dialog" aria-modal="true" aria-labelledby="odd-title" data-testid="offer-decision"
        onClick={(e) => e.stopPropagation()}>
        <div className="odd-header">
          <h3 id="odd-title"><Handshake size={15} aria-hidden="true" /> {cannotDecide ? 'This offer needs an admin' : 'The offer is not accepted yet'}</h3>
          <button type="button" className="odd-close" onClick={onCancel} aria-label="Close" disabled={busy}><X size={16} /></button>
        </div>

        {offers.length === 0 ? (
          <div className="odd-offer" data-testid="offer-decision-offer"><strong>{noneLeft ? 'No open offer is left on this event' : 'This event\'s offer'}</strong></div>
        ) : offers.map((o, i) => (
          <div className="odd-offer" key={o.id || i} data-testid={i === 0 ? 'offer-decision-offer' : `offer-decision-offer-${i + 1}`}>
            <strong>{o.name || 'This event\'s offer'}</strong>
            <span>{STATUS_LABELS[o.status] || o.status || ''}{cannotDecide ? '' : ` · ${paymentText(o)}`}</span>
          </div>
        ))}

        {cannotDecide ? (
          <>
            <p className="odd-ask" data-testid="offer-decision-admin-only">
              The offer is not accepted yet, and only an admin can accept it, negotiate, decline it or start the episode without it.
              The episode was not started. Ask an admin to start it.
            </p>
            <div className="odd-actions">
              <button type="button" className="odd-cancel" onClick={onCancel} data-autofocus="" data-testid="offer-decision-cancel">Close</button>
            </div>
          </>
        ) : (
          <>
            {changed && (
              <div className="odd-refusal" role="alert" data-testid="offer-decision-changed">
                <p>{CHANGED_TEXT}</p>
                {refusal.message && <p>{refusal.message}</p>}
                <p>Your reason is still below. Look at the offer as it is now, then choose again.</p>
                <button type="button" className="odd-cancel" onClick={() => pending.onRefresh?.()} data-testid="offer-decision-refresh">Show the current offer</button>
              </div>
            )}
            {forbidden && (
              <div className="odd-refusal" role="alert" data-testid="offer-decision-forbidden">
                <p>{refusal.message || 'Only an admin can decide an offer.'}</p>
                <p>Nothing was started or changed. Your reason is still below if you want to pass it to an admin.</p>
              </div>
            )}
            {refusal?.kind === 'invalid' && (
              <div className="odd-refusal" role="alert" data-testid="offer-decision-refused">
                <p>{refusal.message || 'That decision was not accepted.'}</p>
                <p>Nothing was started. Your reason is still below.</p>
              </div>
            )}
            {refusal?.kind === 'failed' && (
              <div className="odd-refusal" role="alert" data-testid="offer-decision-failed">
                <p>{refusal.message}</p>
                <p>Nothing was sent again. Your reason is still below. Choose again to try once more, or close this.</p>
              </div>
            )}
            {noneLeft && (
              <div className="odd-refusal" role="status" data-testid="offer-decision-none-left">
                <p>There is no open offer to decide any more. Close this and start the episode again.</p>
              </div>
            )}
            {!changed && !forbidden && !noneLeft && <p className="odd-ask">Decide what happens to it before the episode starts.</p>}
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
                <button key={c.decision} type="button" className="odd-choice" {...(i === 0 ? { 'data-autofocus': '' } : {})}
                  onClick={() => choose(c.decision)} disabled={blocked} data-testid={`offer-decision-${c.decision}`}>
                  <strong>{c.label}</strong>
                  <span>{c.help}</span>
                </button>
              ))}
            </div>
            <div className="odd-actions">
              <button type="button" className="odd-cancel" onClick={onCancel} disabled={busy} data-testid="offer-decision-cancel">
                {busy ? 'Starting…' : (forbidden || noneLeft ? 'Close' : 'Cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
