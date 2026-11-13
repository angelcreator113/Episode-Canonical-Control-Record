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
 * ids of the offers the 409 listed (offer_decision_opportunity_ids; the
 * server refuses the decision when the open offers are no longer those)
 * and the reason (offer_decision_reason; needed to decline or to continue
 * without accepting).
 */
import { useCallback, useRef, useState } from 'react';
import { cleanReason } from '../lib/transitionReason';

export const OFFER_DECISION_REQUIRED = 'OFFER_DECISION_REQUIRED';

export function isOfferDecisionRequired(err) {
  return err?.response?.status === 409 && err.response.data?.code === OFFER_DECISION_REQUIRED;
}

export default function useOfferDecision() {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(null);

  const run = useCallback(async (send) => {
    try {
      return await send(undefined);
    } catch (err) {
      if (!isOfferDecisionRequired(err)) throw err;
      const data = err.response.data;
      return new Promise((resolve, reject) => {
        const offers = Array.isArray(data.opportunities) && data.opportunities.length
          ? data.opportunities : (data.opportunity ? [data.opportunity] : []);
        waiting.current = { send, resolve, reject, offerIds: offers.map((o) => o.id) };
        setPending({ offer: data.opportunity || null, offers, message: data.error || '' });
      });
    }
  }, []);

  const choose = useCallback(async (decision, reason) => {
    const w = waiting.current;
    if (!w) return;
    setBusy(true);
    try {
      const why = cleanReason(reason);
      const res = await w.send(decision, {
        offer_decision_opportunity_ids: w.offerIds,
        ...(why ? { offer_decision_reason: why } : {}),
      });
      waiting.current = null;
      setPending(null);
      w.resolve(res);
    } catch (err) {
      console.error('[OfferDecision] start with a decision failed:', err);
      waiting.current = null;
      setPending(null);
      w.reject(err);
    } finally {
      setBusy(false);
    }
  }, []);

  const cancel = useCallback(() => {
    const w = waiting.current;
    waiting.current = null;
    setPending(null);
    w?.reject(Object.assign(new Error('Not started: no decision was made about the offer.'), { offerDecisionCancelled: true }));
  }, []);

  return { run, pending, busy, choose, cancel };
}
