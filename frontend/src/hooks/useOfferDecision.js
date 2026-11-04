/**
 * Start Episode's explicit offer decision (Evoni's ruling: "Add an explicit
 * offer decision before starting an episode, but do not force acceptance.").
 * The server answers 409 OFFER_DECISION_REQUIRED, with the offer, when the
 * event's opportunity is not accepted yet (services/startOfferDecision).
 *
 * run(send) calls send(undefined); on that 409 it opens the choice
 * (`pending`) and waits. choose(decision) sends again with the decision and
 * settles run's promise with that answer; cancel() rejects it with
 * `offerDecisionCancelled: true`. Nothing is chosen for the user.
 */
import { useCallback, useRef, useState } from 'react';

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
        waiting.current = { send, resolve, reject };
        setPending({ offer: data.opportunity || null, message: data.error || '' });
      });
    }
  }, []);

  const choose = useCallback(async (decision) => {
    const w = waiting.current;
    if (!w) return;
    setBusy(true);
    try {
      const res = await w.send(decision);
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
