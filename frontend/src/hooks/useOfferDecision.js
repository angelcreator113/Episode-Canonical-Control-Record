/**
 * Start Episode's explicit offer decision (Evoni's ruling: "Add an explicit
 * offer decision before starting an episode, but do not force acceptance.").
 * The server answers 409 OFFER_DECISION_REQUIRED, with the offer, when the
 * event's opportunity is not accepted yet (services/startOfferDecision).
 *
 * run(send, { check }) calls send(undefined, undefined, config); on that 409
 * it opens the choice (`pending`) and waits. choose(decision, reason) sends
 * again with the decision and settles run's promise with that answer;
 * cancel() rejects it with `offerDecisionCancelled: true`. Nothing is
 * chosen for the user, and nothing is ever sent again by itself.
 *
 * A decision says which offers it is about and why (A1, 2026-11-13):
 * send(decision, extra, config) gets `extra` to spread into the request
 * body, the ids of the offers shown (offer_decision_opportunity_ids) and the
 * reason (offer_decision_reason), and `config` to pass to the request.
 *
 * `config.headers['Idempotency-Key']` is the server's own retry protection
 * for Start Episode (services/startEpisodeIdempotency; Evoni's idempotency
 * ruling of 2026-11-13). The key is this attempt's id and a fingerprint of
 * what is being sent (the decision, the offers, the reason):
 *   - the same choice sent again after a failure carries the same key, so
 *     a Start whose answer was lost is answered with its episode, not
 *     started twice;
 *   - a different choice, different offers or a different reason carries a
 *     different key, and a new Start attempt (run again) a new id, so a key
 *     is never reused for something else.
 *
 * A decision the server refuses, or that fails, keeps the dialog open with
 * what was typed. `pending.refusal` says what happened:
 *   changed     (409 about the offer) the offers are not as shown.
 *               pending.onRefresh() shows the offers the refusal carried;
 *               no request is made. A new choice is needed after it.
 *   forbidden   (403) this person cannot decide; no choice can be sent.
 *   invalid     (400) the server's own words, e.g. a reason is needed.
 *   has_episode (409 EVENT_ALREADY_HAS_EPISODE, or a status check that
 *               found one) the event already has an episode, named in
 *               `refusal.episode`. No choice can be sent. It does not say
 *               whose request made it: the answer does not establish that.
 *   failed      anything else: the network, a server error, another
 *               refusal. `refusal.uncertain` is true when no answer came
 *               back at all, so the Start may or may not have happened;
 *               pending.onCheck() then asks the read-only start-readiness
 *               endpoint (the caller's `check`) whether the event has an
 *               episode, and the result is has_episode or not_started.
 *   not_started (a status check that found none) nothing was started;
 *               choosing again is the person's to do.
 * Closing after `failed` or `has_episode` hands that failure to the caller,
 * which handles it as it always did.
 */
import { useCallback, useRef, useState } from 'react';
import { cleanReason, startFailedText } from '../lib/transitionReason';

export const OFFER_DECISION_REQUIRED = 'OFFER_DECISION_REQUIRED';
export const EVENT_ALREADY_HAS_EPISODE = 'EVENT_ALREADY_HAS_EPISODE';
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

const newAttemptId = () => (globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/** A short, stable fingerprint of what is being sent (FNV-1a, hex). Pure. */
export function payloadFingerprint(payload) {
  const text = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The Idempotency-Key for one send of one attempt: the same for the same decision, offers and reason. Pure. */
export function startKey(attemptId, { decision = null, opportunityIds = [], reason = '' } = {}) {
  const fingerprint = decision
    ? payloadFingerprint({ decision, opportunityIds: [...opportunityIds].map(String).sort(), reason })
    : 'first';
  return `${attemptId}.${fingerprint}`;
}

/** The episode a start-readiness answer says the event already has, or null. Pure. */
export function episodeFromReadiness(res) {
  const blockers = res?.data?.data?.blockers;
  const found = Array.isArray(blockers) ? blockers.find((b) => b?.key === 'episode_exists') : null;
  return found ? (found.episode || {}) : null;
}

export default function useOfferDecision() {
  const [pending, setPendingState] = useState(null);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(null);
  // The dialog's state as choose, refresh and check read it, without waiting for a render.
  const shown = useRef(null);
  const setPending = useCallback((next) => { shown.current = next; setPendingState(next); }, []);

  const refresh = useCallback(() => {
    const p = shown.current;
    if (!p?.refusal || p.refusal.kind !== 'changed') return;
    const offers = p.refusal.offers || [];
    setPending({ ...p, offers, offer: offers[0] || null, refusal: null, refreshed: true });
  }, [setPending]);

  // Asks, read-only, whether the event has an episode. Never starts or decides anything.
  const checkStatus = useCallback(async () => {
    const w = waiting.current;
    const p = shown.current;
    if (!w?.check || !p) return;
    setBusy(true);
    try {
      const episode = episodeFromReadiness(await w.check());
      setPending({
        ...shown.current,
        refusal: episode
          ? { kind: 'has_episode', episode, message: '' }
          : { kind: 'not_started', message: '' },
      });
    } catch (err) {
      console.error('[OfferDecision] the episode status could not be checked:', err);
      setPending({
        ...shown.current,
        refusal: { ...shown.current.refusal, kind: 'failed', uncertain: true, checkFailed: true, message: startFailedText(err) },
      });
    } finally {
      setBusy(false);
    }
  }, [setPending]);

  const run = useCallback(async (send, { check = null } = {}) => {
    const attemptId = newAttemptId();
    const config = (payload) => ({ headers: { 'Idempotency-Key': startKey(attemptId, payload) } });
    try {
      return await send(undefined, undefined, config());
    } catch (err) {
      if (!isOfferDecisionRequired(err)) throw err;
      const data = err.response.data;
      return new Promise((resolve, reject) => {
        const offers = offersOf(data);
        waiting.current = { send, resolve, reject, check, config };
        // can_decide false: the offer needs an admin (the server refuses a
        // decision from anyone else), so the dialog explains and offers no choice.
        setPending({
          offer: data.opportunity || null, offers, message: data.error || '', canDecide: data.can_decide !== false,
          refusal: null, refreshed: false, onRefresh: refresh, onCheck: check ? checkStatus : null,
        });
      });
    }
  }, [refresh, checkStatus, setPending]);

  const choose = useCallback(async (decision, reason) => {
    const w = waiting.current;
    const p = shown.current;
    if (!w || !p) return;
    // Nothing is sent over a refusal that needs looking at first, by someone
    // who cannot decide, or for an event that already has an episode.
    if (p.canDecide === false || ['changed', 'forbidden', 'has_episode'].includes(p.refusal?.kind)) return;
    setBusy(true);
    try {
      const why = cleanReason(reason);
      const opportunityIds = (p.offers || []).map((o) => o.id);
      const res = await w.send(decision, {
        offer_decision_opportunity_ids: opportunityIds,
        ...(why ? { offer_decision_reason: why } : {}),
      }, w.config({ decision, opportunityIds, reason: why }));
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
      console.error('[OfferDecision] start with a decision failed:', err);
      w.lastError = err;
      if (status === 409 && data?.code === EVENT_ALREADY_HAS_EPISODE) {
        // The event has an episode. The answer names it; it does not say whose request made it.
        setPending({ ...shown.current, refusal: { kind: 'has_episode', code: data.code, episode: data.episode || {}, message: '' } });
        return;
      }
      // Not about the offer: the dialog still stays, with what was typed.
      // No answer at all (the network): the Start may or may not have happened.
      setPending({
        ...shown.current,
        refusal: { kind: 'failed', code: data?.code || null, message: startFailedText(err), uncertain: !err?.response, offers: [] },
      });
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

  return { run, pending, busy, choose, cancel, refresh, checkStatus };
}
