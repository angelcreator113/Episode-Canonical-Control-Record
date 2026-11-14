'use strict';

/**
 * The record of an opportunity's status transition (Evoni's A1 ruling,
 * 2026-11-13): who moved it, from what, to what, when, by which route, why,
 * and the event and episode it belongs to.
 *
 * Two places hold it, and no new one:
 *   - the opportunity's own status_history entry gains `by`, `reason` and
 *     `route` beside the keys each writer already used (historyFields);
 *   - one activity_logs entry through the audit trail's one transactional
 *     call (logger.logActionInTransaction in middleware/auditLog), so the
 *     entry commits or rolls back with the transition (logTransition).
 *
 * The entry names the transition and its linked records only: never the
 * payment, the terms or any of the opportunity's notes. A reason is what
 * the admin typed for this purpose; it is kept out of answers to people
 * who are not admins (historyWithoutReasons).
 *
 * Three routes write through here: Advance and Undo
 * (routes/opportunityRoutes) and Start Episode's offer decision
 * (services/startOfferDecision).
 */

const REASON_MAX = 500;
const AUDIT_ACTION = 'opportunity_status';
const AUDIT_RESOURCE = 'opportunity';
const ROUTES = Object.freeze({ ADVANCE: 'advance', UNDO: 'undo', START_DECISION: 'start_decision' });

const REASON_REQUIRED_CODE = 'OPPORTUNITY_REASON_REQUIRED';
const REASON_INVALID_CODE = 'OPPORTUNITY_REASON_INVALID';

/**
 * A reason as sent: { reason } trimmed, or null when none was given;
 * { error } when it is not text or is longer than REASON_MAX. Pure.
 */
function readReason(value) {
  if (value === undefined || value === null) return { reason: null };
  if (typeof value !== 'string') return { reason: null, error: 'reason must be text.' };
  const reason = value.trim();
  if (reason.length > REASON_MAX) return { reason: null, error: `reason must be at most ${REASON_MAX} characters.` };
  return { reason: reason || null };
}

/** The acting user as an entry names them: their id only. */
const actorId = (actor) => (actor?.id === undefined || actor?.id === null ? null : String(actor.id));

/** The keys a status_history entry gains: who, why and by which route. Pure. */
function historyFields({ actor, reason, route }) {
  return { by: { id: actorId(actor) }, reason: reason || null, route };
}

/**
 * One activity_logs entry for one transition, inside the caller's
 * transaction. Rejects when it cannot be written, so the transition rolls
 * back with it.
 */
async function logTransition(transaction, { actor, opportunityId, showId = null, eventId = null, episodeId = null, from, to, route, reason = null, decision = null, passedThrough = [] }) {
  const { logger } = require('../middleware/auditLog');
  return logger.logActionInTransaction(transaction, actorId(actor), AUDIT_ACTION, AUDIT_RESOURCE, opportunityId, {
    route,
    from_status: from,
    to_status: to,
    ...(decision ? { decision } : {}),
    // Stages one decision passed on the way (accept at Start): not steps anyone took one by one.
    ...(Array.isArray(passedThrough) && passedThrough.length ? { passed_through: passedThrough } : {}),
    reason: reason || null,
    show_id: showId,
    event_id: eventId,
    episode_id: episodeId,
  });
}

/** A status history without who and why, for an answer to someone who is not an admin. Pure. */
function historyWithoutReasons(history) {
  if (!Array.isArray(history)) return history;
  return history.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const { reason: _reason, by: _by, ...rest } = entry;
    return rest;
  });
}

module.exports = {
  REASON_MAX,
  AUDIT_ACTION,
  AUDIT_RESOURCE,
  ROUTES,
  REASON_REQUIRED_CODE,
  REASON_INVALID_CODE,
  readReason,
  actorId,
  historyFields,
  logTransition,
  historyWithoutReasons,
};
