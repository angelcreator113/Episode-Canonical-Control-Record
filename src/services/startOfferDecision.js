'use strict';

/**
 * Start Episode's offer decision (Evoni's ruling: "Add an explicit offer
 * decision before starting an episode, but do not force acceptance.
 * Preserve legitimate decline and negotiation paths.").
 *
 * Scheduling an opportunity as an event never accepts it
 * (feedEventPipelineService scheduleOpportunityAsEvent), so an event can
 * reach Start Episode while its opportunity is still open. Start Episode
 * then asks for an `offer_decision` instead of starting silently:
 *   accept             — walked to booked through STATUS_FLOW's own steps
 *                        (offered → considering → negotiating → booked)
 *   negotiate          — walked to negotiating (kept there if already)
 *   decline            — declined (one legal step from any open status);
 *                        the episode still starts, without an active deal
 *   proceed_unaccepted — the status is not changed; a history note says the
 *                        episode started without accepting it
 * Nothing is ever accepted without the decision. Every step is appended to
 * status_history with the event and episode ids, in Start Episode's own
 * transaction (applyOfferDecision).
 *
 * "Open" means not yet accepted and not closed: offered, considering,
 * negotiating, or held (beat 14's; STATUS_FLOW has no step out of held, so
 * only proceed_unaccepted is legal for it).
 *
 * Who, why and which offers (Evoni's A1 ruling, 2026-11-13). A decision is
 * an admin's (403 OFFER_DECISION_FORBIDDEN otherwise; an event with no open
 * offer starts for anyone who could start it before). It names the offers
 * it is about (`opportunityIds`, the ones the 409 listed): when the open
 * offers are no longer those, it is refused (409 OFFER_DECISION_STALE), so
 * an answer given about one offer never decides another. decline and
 * proceed_unaccepted need a reason (400 OFFER_REASON_REQUIRED). Each offer
 * decided gets its history entries (with by, reason, route) and one
 * activity_logs entry in Start Episode's transaction
 * (services/opportunityTransitionAudit).
 *
 * Accept is one decision that walks several steps (Evoni's review of
 * 2026-11-13). STATUS_FLOW has no step from offered to booked, so accept
 * passes through considering and negotiating on the way: workflow stages,
 * not approvals anyone gave. The history keeps one entry per status passed,
 * as it always has (Undo reads them as steps), and says which they are:
 * every entry of the walk carries `decided: { from, to }`, the one decision,
 * and each status only passed through carries `passed_through: true`. The
 * activity_logs entry is one, from the status it had to the one it reached,
 * with `passed_through` naming the stages in between.
 *
 * The question itself (409 OFFER_DECISION_REQUIRED) says whether the person
 * asking can answer it (`can_decide`), so a page shows the choices only to
 * someone who can make them.
 */

const { statusPath } = require('./opportunityStatusFlow');
const { ROUTES, historyFields, logTransition, readReason } = require('./opportunityTransitionAudit');

const ACCEPTED_STATUSES = Object.freeze(['booked', 'preparing', 'active', 'completed', 'paid']);
const CLOSED_STATUSES = Object.freeze(['declined', 'expired', 'cancelled', 'archived']);
const OFFER_DECISIONS = Object.freeze(['accept', 'negotiate', 'decline', 'proceed_unaccepted']);
const DECISION_TARGET = Object.freeze({ accept: 'booked', negotiate: 'negotiating', decline: 'declined' });

const OFFER_DECISION_REQUIRED_CODE = 'OFFER_DECISION_REQUIRED';
const OFFER_DECISION_INVALID_CODE = 'OFFER_DECISION_INVALID';
const OFFER_DECISION_ILLEGAL_CODE = 'OFFER_DECISION_ILLEGAL';
const OFFER_DECISION_FORBIDDEN_CODE = 'OFFER_DECISION_FORBIDDEN';
const OFFER_DECISION_STALE_CODE = 'OFFER_DECISION_STALE';
const OFFER_REASON_REQUIRED_CODE = 'OFFER_REASON_REQUIRED';
const OFFER_DECISION_CODES = Object.freeze([
  OFFER_DECISION_REQUIRED_CODE, OFFER_DECISION_INVALID_CODE, OFFER_DECISION_ILLEGAL_CODE,
  OFFER_DECISION_FORBIDDEN_CODE, OFFER_DECISION_STALE_CODE, OFFER_REASON_REQUIRED_CODE,
]);
// The decisions that need a reason: turning the offer down, and starting
// without accepting it.
const REASON_REQUIRED_DECISIONS = Object.freeze(['decline', 'proceed_unaccepted']);

const isOpenOffer = (status) => !ACCEPTED_STATUSES.includes(status) && !CLOSED_STATUSES.includes(status);

/**
 * What the page shows to ask. For someone who can decide (an admin): id,
 * name, status, brand and payment. For anyone else only what tells them
 * which offer waits for an admin: id, name and status. The payment and its
 * type are the deal's terms and are never sent to someone who cannot decide
 * (Evoni's security review of 2026-11-13); the page hiding them is not what
 * keeps them private.
 */
function offerSummary(opp, canDecide = false) {
  const named = { id: opp.id, name: opp.name, status: opp.status };
  if (!canDecide) return named;
  return {
    ...named,
    brand: opp.brand_or_company || null,
    payment_amount: opp.payment_amount == null ? null : Number(opp.payment_amount),
    payment_type: opp.payment_type || null,
  };
}

const offerError = (status, code, message, opportunities, canDecide = false) =>
  Object.assign(new Error(message), {
    status, code, canDecide, opportunities: (opportunities || []).map((o) => offerSummary(o, canDecide === true)),
  });

/**
 * The event's linked opportunities still open: the one world_events.
 * opportunity_id names, and any whose event_id is this event. `lock` takes
 * row locks (inside Start Episode's transaction).
 */
async function findOpenOffers(sequelize, eventId, { transaction, lock = false } = {}) {
  const [rows] = await sequelize.query(
    `SELECT o.id, o.show_id, o.name, o.status, o.status_history, o.brand_or_company, o.payment_amount, o.payment_type
       FROM opportunities o
      WHERE o.deleted_at IS NULL
        AND (o.event_id = :eventId
             OR o.id = (SELECT opportunity_id FROM world_events WHERE id = :eventId))
      ORDER BY o.created_at ASC${lock ? '\n      FOR UPDATE OF o' : ''}`,
    { replacements: { eventId }, ...(transaction ? { transaction } : {}) }
  );
  return (rows || []).filter((o) => isOpenOffer(o.status));
}

/** The same offers, whatever their order. Pure. */
function sameOffers(openOffers, opportunityIds) {
  if (!Array.isArray(opportunityIds)) return false;
  const named = new Set(opportunityIds.map(String));
  return named.size === openOffers.length && openOffers.every((o) => named.has(String(o.id)));
}

/**
 * Throws (with .status and .code) when the decision cannot start this
 * episode: missing while an offer is open (409 OFFER_DECISION_REQUIRED, with
 * the offers to ask about), not one of OFFER_DECISIONS (400), not an
 * admin's (403), about other offers than the open ones (409
 * OFFER_DECISION_STALE), without the reason decline and proceed_unaccepted
 * need (400), or a move STATUS_FLOW does not allow from an offer's status
 * (409). `by` is { actor: { id, isAdmin }, reason, opportunityIds }. Pure.
 */
function assertOfferDecision(openOffers, decision, by = {}) {
  if (!openOffers.length) return;
  const canDecide = by?.actor?.isAdmin === true;
  if (decision == null || decision === '') {
    const names = openOffers.map((o) => `"${o.name}" (${o.status})`).join(', ');
    throw offerError(409, OFFER_DECISION_REQUIRED_CODE,
      canDecide
        ? `This event's offer ${names} is not accepted yet. Choose whether to accept it, negotiate, decline it, or start the episode without accepting it.`
        : `This event's offer ${names} is not accepted yet. An admin decides what happens to it before the episode starts.`,
      openOffers, canDecide);
  }
  if (!OFFER_DECISIONS.includes(decision)) {
    throw offerError(400, OFFER_DECISION_INVALID_CODE, `offer_decision must be one of ${OFFER_DECISIONS.join(', ')}.`, openOffers, canDecide);
  }
  if (!canDecide) {
    throw offerError(403, OFFER_DECISION_FORBIDDEN_CODE,
      'Only an admin can decide an offer. The episode was not started.', openOffers, false);
  }
  if (!sameOffers(openOffers, by.opportunityIds)) {
    throw offerError(409, OFFER_DECISION_STALE_CODE,
      'The offers on this event are not the ones this decision was made about. Nothing was started; look at them again and decide.',
      openOffers, true);
  }
  const read = readReason(by.reason);
  if (read.error) throw offerError(400, OFFER_REASON_REQUIRED_CODE, read.error, openOffers, true);
  if (REASON_REQUIRED_DECISIONS.includes(decision) && !read.reason) {
    throw offerError(400, OFFER_REASON_REQUIRED_CODE,
      decision === 'decline' ? 'Say why the offer is declined.' : 'Say why the episode starts without accepting the offer.',
      openOffers, true);
  }
  const target = DECISION_TARGET[decision];
  if (!target) return;
  const stuck = openOffers.filter((o) => statusPath(o.status, target) === null);
  if (stuck.length) {
    throw offerError(409, OFFER_DECISION_ILLEGAL_CODE,
      `"${stuck[0].name}" is ${stuck[0].status}; it cannot move to ${target} from there. Start without accepting it, or settle it first.`,
      openOffers, true);
  }
}

/**
 * Applies the decision to the event's open offers, inside `transaction`
 * (rows locked, checked again under the lock), each step appended to
 * status_history with the event and episode, who decided and why, and one
 * activity_logs entry for each offer. Returns what was done:
 * [{ id, name, decision, from, to }]. No open offer: [] and nothing written.
 */
async function applyOfferDecision(sequelize, { eventId, episodeId, decision, transaction, actor = null, reason = null, opportunityIds = null }) {
  const open = await findOpenOffers(sequelize, eventId, { transaction, lock: true });
  if (!open.length) return [];
  assertOfferDecision(open, decision, { actor, reason, opportunityIds });
  const why = readReason(reason).reason;
  const done = [];
  for (const opp of open) {
    const date = new Date().toISOString();
    const base = { date, decision, event_id: eventId, episode_id: episodeId, ...historyFields({ actor, reason: why, route: ROUTES.START_DECISION }) };
    const target = DECISION_TARGET[decision];
    const steps = target ? statusPath(opp.status, target) : [];
    const entries = [];
    let from = opp.status;
    // One decision, however many steps it walks: each entry says what was
    // decided, and a status only passed on the way says so.
    const walked = steps.length > 1 ? { decided: { from: opp.status, to: steps[steps.length - 1] } } : {};
    steps.forEach((step, i) => {
      entries.push({
        status: step, from, note: `Offer decision at Start Episode: ${decision}`, ...base, ...walked,
        ...(i < steps.length - 1 ? { passed_through: true } : {}),
      });
      from = step;
    });
    if (!entries.length) {
      entries.push({
        status: opp.status,
        from: opp.status,
        note: decision === 'proceed_unaccepted'
          ? 'Episode started without accepting the offer; status unchanged'
          : `Offer decision at Start Episode: ${decision}; status unchanged`,
        ...base,
      });
    }
    const history = [...(Array.isArray(opp.status_history) ? opp.status_history : []), ...entries];
    const to = steps.length ? steps[steps.length - 1] : opp.status;
    await sequelize.query(
      `UPDATE opportunities
          SET status = :to,
              status_history = CAST(:history AS jsonb),
              booking_date = CASE WHEN :to = 'booked' THEN CURRENT_DATE ELSE booking_date END,
              updated_at = NOW()
        WHERE id = :id`,
      { replacements: { to, history: JSON.stringify(history), id: opp.id }, transaction }
    );
    await logTransition(transaction, {
      actor, opportunityId: opp.id, showId: opp.show_id || null, eventId, episodeId,
      from: opp.status, to, route: ROUTES.START_DECISION, reason: why, decision,
      passedThrough: steps.slice(0, -1),
    });
    done.push({ id: opp.id, name: opp.name, decision, from: opp.status, to });
  }
  return done;
}

/** The 409/400 body a route answers an offer-decision refusal with. */
function offerDecisionBody(err) {
  return {
    success: false,
    code: err.code,
    error: err.message,
    decisions: OFFER_DECISIONS,
    // Whether the person asking can answer: a decision is an admin's.
    can_decide: err.canDecide === true,
    opportunity: err.opportunities?.[0] || null,
    opportunities: err.opportunities || [],
  };
}

module.exports = {
  ACCEPTED_STATUSES,
  CLOSED_STATUSES,
  OFFER_DECISIONS,
  OFFER_DECISION_REQUIRED_CODE,
  OFFER_DECISION_INVALID_CODE,
  OFFER_DECISION_ILLEGAL_CODE,
  OFFER_DECISION_FORBIDDEN_CODE,
  OFFER_DECISION_STALE_CODE,
  OFFER_REASON_REQUIRED_CODE,
  OFFER_DECISION_CODES,
  REASON_REQUIRED_DECISIONS,
  isOpenOffer,
  offerSummary,
  findOpenOffers,
  assertOfferDecision,
  applyOfferDecision,
  offerDecisionBody,
};
