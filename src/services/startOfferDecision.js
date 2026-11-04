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
 */

const { statusPath } = require('./opportunityStatusFlow');

const ACCEPTED_STATUSES = Object.freeze(['booked', 'preparing', 'active', 'completed', 'paid']);
const CLOSED_STATUSES = Object.freeze(['declined', 'expired', 'cancelled', 'archived']);
const OFFER_DECISIONS = Object.freeze(['accept', 'negotiate', 'decline', 'proceed_unaccepted']);
const DECISION_TARGET = Object.freeze({ accept: 'booked', negotiate: 'negotiating', decline: 'declined' });

const OFFER_DECISION_REQUIRED_CODE = 'OFFER_DECISION_REQUIRED';
const OFFER_DECISION_INVALID_CODE = 'OFFER_DECISION_INVALID';
const OFFER_DECISION_ILLEGAL_CODE = 'OFFER_DECISION_ILLEGAL';
const OFFER_DECISION_CODES = Object.freeze([OFFER_DECISION_REQUIRED_CODE, OFFER_DECISION_INVALID_CODE, OFFER_DECISION_ILLEGAL_CODE]);

const isOpenOffer = (status) => !ACCEPTED_STATUSES.includes(status) && !CLOSED_STATUSES.includes(status);

/** What the page shows to ask: id, name, status, payment. */
function offerSummary(opp) {
  return {
    id: opp.id,
    name: opp.name,
    status: opp.status,
    brand: opp.brand_or_company || null,
    payment_amount: opp.payment_amount == null ? null : Number(opp.payment_amount),
    payment_type: opp.payment_type || null,
  };
}

const offerError = (status, code, message, opportunities) =>
  Object.assign(new Error(message), { status, code, opportunities: (opportunities || []).map(offerSummary) });

/**
 * The event's linked opportunities still open: the one world_events.
 * opportunity_id names, and any whose event_id is this event. `lock` takes
 * row locks (inside Start Episode's transaction).
 */
async function findOpenOffers(sequelize, eventId, { transaction, lock = false } = {}) {
  const [rows] = await sequelize.query(
    `SELECT o.id, o.name, o.status, o.status_history, o.brand_or_company, o.payment_amount, o.payment_type
       FROM opportunities o
      WHERE o.deleted_at IS NULL
        AND (o.event_id = :eventId
             OR o.id = (SELECT opportunity_id FROM world_events WHERE id = :eventId))
      ORDER BY o.created_at ASC${lock ? '\n      FOR UPDATE OF o' : ''}`,
    { replacements: { eventId }, ...(transaction ? { transaction } : {}) }
  );
  return (rows || []).filter((o) => isOpenOffer(o.status));
}

/**
 * Throws (with .status and .code) when the decision cannot start this
 * episode: missing while an offer is open (409 OFFER_DECISION_REQUIRED, with
 * the offers to ask about), not one of OFFER_DECISIONS (400), or a move
 * STATUS_FLOW does not allow from an offer's status (409). Pure.
 */
function assertOfferDecision(openOffers, decision) {
  if (!openOffers.length) return;
  if (decision == null || decision === '') {
    const names = openOffers.map((o) => `"${o.name}" (${o.status})`).join(', ');
    throw offerError(409, OFFER_DECISION_REQUIRED_CODE,
      `This event's offer ${names} is not accepted yet. Choose whether to accept it, negotiate, decline it, or start the episode without accepting it.`,
      openOffers);
  }
  if (!OFFER_DECISIONS.includes(decision)) {
    throw offerError(400, OFFER_DECISION_INVALID_CODE, `offer_decision must be one of ${OFFER_DECISIONS.join(', ')}.`, openOffers);
  }
  const target = DECISION_TARGET[decision];
  if (!target) return;
  const stuck = openOffers.filter((o) => statusPath(o.status, target) === null);
  if (stuck.length) {
    throw offerError(409, OFFER_DECISION_ILLEGAL_CODE,
      `"${stuck[0].name}" is ${stuck[0].status}; it cannot move to ${target} from there. Start without accepting it, or settle it first.`,
      openOffers);
  }
}

/**
 * Applies the decision to the event's open offers, inside `transaction`
 * (rows locked, checked again under the lock), each step appended to
 * status_history with the event and episode. Returns what was done:
 * [{ id, name, decision, from, to }]. No open offer: [] and nothing written.
 */
async function applyOfferDecision(sequelize, { eventId, episodeId, decision, transaction }) {
  const open = await findOpenOffers(sequelize, eventId, { transaction, lock: true });
  if (!open.length) return [];
  assertOfferDecision(open, decision);
  const done = [];
  for (const opp of open) {
    const date = new Date().toISOString();
    const base = { date, decision, event_id: eventId, episode_id: episodeId };
    const target = DECISION_TARGET[decision];
    const steps = target ? statusPath(opp.status, target) : [];
    const entries = [];
    let from = opp.status;
    for (const step of steps) {
      entries.push({ status: step, from, note: `Offer decision at Start Episode: ${decision}`, ...base });
      from = step;
    }
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
  OFFER_DECISION_CODES,
  isOpenOffer,
  offerSummary,
  findOpenOffers,
  assertOfferDecision,
  applyOfferDecision,
  offerDecisionBody,
};
