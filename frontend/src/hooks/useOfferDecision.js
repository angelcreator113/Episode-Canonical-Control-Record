/**
 * Start Episode's explicit offer decision (Evoni's ruling: "Add an explicit
 * offer decision before starting an episode, but do not force acceptance.").
 * The server answers 409 OFFER_DECISION_REQUIRED, with the offer, when the
 * event's opportunity is not accepted yet (services/startOfferDecision).
 *
 * run(send) calls send(undefined); on that 409 it opens the choice
 * (`pending`) and waits. choose(decision, reason) sends again with the
 * decision and settles run's promise with that answer; cancel() rejects it
 * with `offerDecisionCancelled: true`. Nothing is chosen for the user.
 *
 * A decision says which offers it is about and why (A1, 2026-11-13):
 * send(decision, extra) gets `extra` to spread into the request body, the
 * ids of the offers shown (offer_decision_opportunity_ids; the server
 * refuses the decision when the open offers are no longer those) and the
 * reason (offer_decision_reason; needed to decline or to continue without
 * accepting).
 *
 * A decision the server refuses keeps the dialog open (review of
 * 2026-11-13): nothing typed is lost and nothing is sent again by itself.
 * `pending.refusal` says what happened:
 *   changed   (409) the offers are not as they were shown, or the step is
 *             no longer legal. pending.onRefresh() shows the offers the
 *             refusal itself carried; no request is made. A new choice is
 *             needed after it.
 *   forbidden (403) this person cannot decide; no choice can be sent.
 *   invalid   (400) the server's own words, e.g. a reason is needed.
 *   failed    anything else: the network, a server error, a refusal that
 *             is not about the offer (security and error review of
 *             2026-11-13). The dialog says what happened; choosing again
 *             is the person's to do. Closing it then hands that failure to
 *             the caller, which handles it as it always did (its own
 *             message, or its own next step such as a missing deal price).
 * A decision is never sent again by itself.
 */
import { useCallback, useRef, useState } from 'react';
import { cleanReason, startFailedText } from '../lib/transitionReason';

export const OFFER_DECISION_REQUIRED = 'OFFER_DECISION_REQUIRED';
// The refusals a decision can get (services/startOfferDecision OFFER_DECISION_CODES).
const OFFER_REFUSAL_CODES = [
  OFFER_DECISION_REQUIRED, 'OFFER_DECISION_INVALID', 'OFFER_DECISION_ILLEGAL',
  'OFFER_DECISION_FORBIDDEN', 'OFFER_DECISION_STALE', 'OFFER_REASON_REQUIRED',
];
const refusalKind = (status) => (status === 403 ? 'forbidden' : status === 409 ? 'changed' : 'invalid');

export function isOfferDecisionRequired(err) {
  return err?.response?.status === 409 && err.response.data?.code === OFFER_DECISION_REQUIRED;
}

const offersOf = (data) => (Array.isArray(data?.opportunities) && data.opportunities.length
  ? data.opportunities : (data?.opportunity ? [data.opportunity] : []));

export default function useOfferDecision() {
  const [pending, setPendingState] = useState(null);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(null);
  // The dialog's state as choose and refresh read it, without waiting for a render.
  const shown = useRef(null);
  const setPending = useCallback((next) => { shown.current = next; setPendingState(next); }, []);

  const refresh = useCallback(() => {
    const p = shown.current;
    if (!p?.refusal || p.refusal.kind !== 'changed') return;
    const offers = p.refusal.offers || [];
    setPending({ ...p, offers, offer: offers[0] || null, refusal: null, refreshed: true });
  }, [setPending]);

  const run = useCallback(async (send) => {
    try {
      return await send(undefined);
    } catch (err) {
      if (!isOfferDecisionRequired(err)) throw err;
      const data = err.response.data;
      return new Promise((resolve, reject) => {
        const offers = offersOf(data);
        waiting.current = { send, resolve, reject };
        // can_decide false: the offer needs an admin (the server refuses a
        // decision from anyone else), so the dialog explains and offers no choice.
        setPending({
          offer: data.opportunity || null, offers, message: data.error || '', canDecide: data.can_decide !== false,
          refusal: null, refreshed: false, onRefresh: refresh,
        });
      });
    }
  }, [refresh, setPending]);

  const choose = useCallback(async (decision, reason) => {
    const w = waiting.current;
    const p = shown.current;
    if (!w || !p) return;
    // Nothing is sent over a refusal that needs looking at first, or by someone who cannot decide.
    if (p.canDecide === false || p.refusal?.kind === 'changed' || p.refusal?.kind === 'forbidden') return;
    setBusy(true);
    try {
      const why = cleanReason(reason);
      const res = await w.send(decision, {
        offer_decision_opportunity_ids: (p.offers || []).map((o) => o.id),
        ...(why ? { offer_decision_reason: why } : {}),
      });
      waiting.current = null;
      setPending(null);
      w.resolve(res);
      return;
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (data && OFFER_REFUSAL_CODES.includes(data.code) && [400, 403, 409].includes(status)) {
        // Refused about the offer: the dialog stays, with what was typed.
        // Not sent again; the next step is the person's.
        console.error('[OfferDecision] the decision was refused:', data.code, data.error);
        w.lastError = null;
        setPending({
          ...shown.current,
          refusal: { kind: refusalKind(status), code: data.code, message: data.error || '', offers: offersOf(data) },
        });
        return;
      }
      // Not about the offer: the dialog still stays, with what was typed.
      // The failure is kept for the caller, who gets it if the dialog is closed.
      console.error('[OfferDecision] start with a decision failed:', err);
      w.lastError = err;
      setPending({ ...shown.current, refusal: { kind: 'failed', code: data?.code || null, message: startFailedText(err), offers: [] } });
    } finally {
      setBusy(false);
    }
  }, [setPending]);

  const cancel = useCallback(() => {
    const w = waiting.current;
    waiting.current = null;
    setPending(null);
    // After a failure that was not about the offer, closing hands that
    // failure to the caller; otherwise it is a plain cancel.
    w?.reject(w.lastError || Object.assign(new Error('Not started: no decision was made about the offer.'), { offerDecisionCancelled: true }));
  }, [setPending]);

  return { run, pending, busy, choose, cancel, refresh };
}
