'use strict';

/**
 * Effective Stop state (M0 addendum D/H and requirement R-3). Pure.
 *
 * Inputs (each read by the caller; nothing is read here):
 *   db:    { readable, state: 'RELEASED'|'STOPPED'|'RESUME_PENDING', version,
 *            readAt, pauses: { images, video, voice, writing } }
 *   local: { readable, stopped, readAt }       the local emergency control
 *   ack:   { version }                          the version this gateway applied
 *   service: 'images'|'video'|'voice'|'writing' (optional)
 *   now, limits.stateStaleMs
 *
 * Rules: the most restrictive VERIFIED state wins; a missing, unreadable or
 * stale required state is UNVERIFIED; RELEASED only when the database and
 * local states are both verified and released, the service is not paused and
 * the gateway has applied the current version. A database Resume can never
 * clear a local stop, and a local release can never clear a database Stop.
 *
 * Returns { effective, reasons, allowSubmissions, statusMode }:
 *   statusMode 'allowed'      status reads for known tasks may pass;
 *              'cached_only'  only task references this gateway already holds.
 */

const { DEFAULT_LIMITS } = require('./constants');

function isFresh(src, now, staleMs) {
  return Number.isFinite(src.readAt) && Number.isFinite(now) && now - src.readAt <= staleMs && now >= src.readAt - staleMs;
}

function effectiveState({ db, local, ack, service, now, limits = DEFAULT_LIMITS } = {}) {
  const staleMs = limits.stateStaleMs;
  const stoppedReasons = [];
  const unverifiedReasons = [];

  const dbVerified = Boolean(db && db.readable === true && isFresh(db, now, staleMs)
    && ['RELEASED', 'STOPPED', 'RESUME_PENDING'].includes(db.state));
  if (!db || db.readable !== true) unverifiedReasons.push('database_state_unreadable');
  else if (!isFresh(db, now, staleMs)) unverifiedReasons.push('database_state_stale');
  else if (!dbVerified) unverifiedReasons.push('database_state_invalid');

  const localVerified = Boolean(local && local.readable === true && isFresh(local, now, staleMs)
    && typeof local.stopped === 'boolean');
  if (!local || local.readable !== true) unverifiedReasons.push('local_state_unreadable');
  else if (!isFresh(local, now, staleMs)) unverifiedReasons.push('local_state_stale');
  else if (!localVerified) unverifiedReasons.push('local_state_invalid');

  // A source that says "stopped" restricts even if it is otherwise doubtful:
  // restriction is always safe.
  if (db && db.readable === true && db.state && db.state !== 'RELEASED') stoppedReasons.push(`database_${String(db.state).toLowerCase()}`);
  if (db && db.readable === true && service && db.pauses && db.pauses[service] === true) stoppedReasons.push(`service_paused_${service}`);
  if (local && local.stopped === true) stoppedReasons.push('local_emergency_stop');
  if (local && local.readable === false) stoppedReasons.push('local_state_unreadable_treated_as_stopped');

  if (dbVerified && (!ack || ack.version !== db.version)) unverifiedReasons.push('gateway_not_acknowledged');

  let effective;
  if (stoppedReasons.length > 0) effective = 'STOPPED';
  else if (unverifiedReasons.length > 0) effective = 'UNVERIFIED';
  else effective = 'RELEASED';

  return Object.freeze({
    effective,
    reasons: Object.freeze([...stoppedReasons, ...unverifiedReasons]),
    allowSubmissions: effective === 'RELEASED',
    statusMode: unverifiedReasons.length > 0 ? 'cached_only' : 'allowed',
  });
}

module.exports = { effectiveState };
