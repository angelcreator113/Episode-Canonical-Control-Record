'use strict';

/**
 * In-memory REFERENCE ledger. NON-PRODUCTION: it exists to define, and test,
 * the exact semantics the future Postgres ledger (phase G2) must reproduce.
 * It holds state in process memory only and is never used by the application.
 *
 * Steps (each one atomic; `yieldFn` simulates database latency between them
 * so tests can interleave concurrent callers):
 *   authorize  T1  Stop gate, prior-unknown-attempt gate, budget gate, permit
 *   dispatch   T2  single use: authorized -> dispatching, if unexpired, same
 *                  operation and still allowed by the safety state
 *   recordOutcome  T3  dispatching/accepted/... -> classified outcome
 *   markNotSent    only from authorized, or from dispatching with proof that
 *                  the request was never forwarded
 *   sweep      expired authorized -> not_sent; stale dispatching -> unknown
 *              (age NEVER yields not_sent for a dispatched request)
 */

const { buildPermit, issuePermitSecret } = require('./permit');
const { checkAuthorization, exposureOf } = require('./budget');
const { DEFAULT_LIMITS } = require('./constants');
const { operationById } = require('./operationCatalog');

const TRANSITIONS = Object.freeze({
  authorized: ['dispatching', 'not_sent'],
  dispatching: ['not_sent', 'accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'unknown'],
  accepted: ['provider_succeeded', 'succeeded', 'failed_confirmed', 'unknown'],
  provider_succeeded: ['succeeded', 'failed_confirmed', 'unknown'],
  unknown: ['accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'abandoned'], // reconciliation only
  succeeded: [], failed_confirmed: [], not_sent: [], abandoned: [],
});

class LedgerRefusal extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function createReferenceLedger({
  clock, caps, priceOf = () => null, readSafety, limits = DEFAULT_LIMITS,
  randomBytes, idFactory, yieldFn = () => Promise.resolve(),
} = {}) {
  if (!clock || !caps || typeof readSafety !== 'function') throw new Error('aiGateway: reference ledger needs clock, caps and readSafety');
  const rows = new Map();
  const events = [];
  let seq = 0;
  const nextId = idFactory || (() => `permit-${(seq += 1)}`);

  function emit(row, from, to, cause) {
    events.push(Object.freeze({ n: events.length + 1, id: row.id, from, to, cause, at: clock.now() }));
  }

  function transition(row, to, cause, { provenNotForwarded = false, preSendProof = false } = {}) {
    if (!TRANSITIONS[row.phase] || !TRANSITIONS[row.phase].includes(to)) {
      throw new LedgerRefusal(`ILLEGAL_TRANSITION_${row.phase}_TO_${to}`);
    }
    // A dispatched request may become not_sent only with proof it never left.
    if (row.phase === 'dispatching' && to === 'not_sent' && !(provenNotForwarded || preSendProof)) {
      throw new LedgerRefusal('NOT_SENT_REQUIRES_PROOF');
    }
    const from = row.phase;
    row.phase = to;
    emit(row, from, to, cause);
  }

  function dayRows(day) {
    return [...rows.values()].filter((r) => r.day === day);
  }

  async function authorize(input) {
    await yieldFn();
    const now = clock.now();
    const safety = readSafety();
    if (!safety || !safety.state || safety.state.allowSubmissions !== true) return { ok: false, code: 'STOPPED' };
    const job = input.job || {};
    for (const r of rows.values()) {
      if (r.permit.job.logicalKey === job.logicalKey && r.phase === 'unknown') return { ok: false, code: 'PRIOR_ATTEMPT_UNKNOWN' };
    }
    const op = operationById(input.operation);
    if (!op || op.cls !== 'submission') return { ok: false, code: 'NOT_A_SUBMISSION' };
    const reservation = input.reservation || {};
    const strict = reservation.strict === true;
    const estimate = reservation.estimateMicros == null ? null : reservation.estimateMicros;
    const price = reservation.priceCatalogId ? priceOf(reservation.priceCatalogId) : null;
    const today = dayRows(reservation.day);
    const decision = checkAuthorization({
      estimateMicros: estimate,
      strict,
      price,
      service: op.service, // from the catalogue, never from the caller
      dayExposureMicros: exposureOf(today).exposure,
      imageDayExposureMicros: exposureOf(today.filter((r) => r.permit.service === 'images')).exposure,
      caps,
    });
    if (!decision.ok) return { ok: false, code: decision.code };
    const { secret, secretHash } = issuePermitSecret(randomBytes);
    const permit = buildPermit({
      ...input,
      id: nextId(),
      secretHash,
      expiresAt: now + limits.permitTtlMs,
      reservation: { ...reservation, estimateMicros: estimate == null ? 0 : estimate, unpriced: decision.unpriced },
    });
    const row = {
      id: permit.id, permit, phase: 'authorized', billed: 'unknown', day: reservation.day,
      estimateMicros: permit.reservation.estimateMicros, confirmedMicros: null, taskId: null,
      dispatchVersion: null, dispatchedAt: null,
    };
    rows.set(row.id, row);
    emit(row, null, 'authorized', 'authorize');
    return { ok: true, permit, secret };
  }

  async function getPermit(id) {
    await yieldFn();
    const row = rows.get(id);
    return row ? { permit: row.permit, phase: row.phase } : null;
  }

  async function dispatch(id, { operation, controlVersion } = {}) {
    await yieldFn();
    const row = rows.get(id);
    if (!row) return { ok: false, code: 'PERMIT_UNKNOWN' };
    if (row.phase !== 'authorized') return { ok: false, code: 'PERMIT_USED' };
    if (operation !== row.permit.operation) return { ok: false, code: 'OPERATION_MISMATCH' };
    if (clock.now() >= row.permit.expiresAt) {
      transition(row, 'not_sent', 'permit_expired');
      return { ok: false, code: 'PERMIT_EXPIRED' };
    }
    const safety = readSafety();
    if (!safety || !safety.state || safety.state.allowSubmissions !== true) {
      transition(row, 'not_sent', 'stopped_at_dispatch');
      return { ok: false, code: 'STOPPED' };
    }
    transition(row, 'dispatching', 'dispatch');
    row.dispatchVersion = controlVersion == null ? null : controlVersion;
    row.dispatchedAt = clock.now();
    return { ok: true, permit: row.permit };
  }

  async function markNotSent(id, cause, { provenNotForwarded = false } = {}) {
    await yieldFn();
    const row = rows.get(id);
    if (!row) return { ok: false, code: 'PERMIT_UNKNOWN' };
    if (row.phase === 'not_sent') return { ok: true };
    if (row.phase !== 'authorized' && row.phase !== 'dispatching') return { ok: false, code: 'NOT_SENT_NOT_ALLOWED' };
    transition(row, 'not_sent', cause, { provenNotForwarded });
    return { ok: true };
  }

  async function recordOutcome(id, { phase, preSendProof = false, taskId = null, confirmedMicros = null, billed = null } = {}) {
    await yieldFn();
    const row = rows.get(id);
    if (!row) return { ok: false, code: 'PERMIT_UNKNOWN' };
    transition(row, phase, 'outcome', { preSendProof });
    if (taskId) row.taskId = String(taskId);
    if (Number.isInteger(confirmedMicros)) row.confirmedMicros = confirmedMicros;
    if (phase === 'not_sent') row.billed = 'no';
    else if (billed === 'yes' || billed === 'no') row.billed = billed;
    return { ok: true };
  }

  /** Reconciliation (reference only): unknown -> a settled phase, with evidence. */
  async function reconcile(id, { to, evidence, billed, confirmedMicros = null } = {}) {
    await yieldFn();
    const row = rows.get(id);
    if (!row) return { ok: false, code: 'PERMIT_UNKNOWN' };
    if (!evidence || typeof evidence !== 'object' || Object.keys(evidence).length === 0) return { ok: false, code: 'EVIDENCE_REQUIRED' };
    transition(row, to, 'reconcile');
    if (billed === 'yes' || billed === 'no' || billed === 'unknown') row.billed = billed;
    if (Number.isInteger(confirmedMicros)) row.confirmedMicros = confirmedMicros;
    return { ok: true };
  }

  async function sweep({ submissionTimeoutMs }) {
    await yieldFn();
    const now = clock.now();
    for (const row of rows.values()) {
      if (row.phase === 'authorized' && now >= row.permit.expiresAt) transition(row, 'not_sent', 'permit_expired_unused');
      else if (row.phase === 'dispatching' && now - row.dispatchedAt > submissionTimeoutMs) transition(row, 'unknown', 'submission_timeout');
    }
  }

  async function findByTaskRef(provider, taskRef) {
    await yieldFn();
    for (const row of rows.values()) {
      if (row.permit.provider === provider && row.taskId === String(taskRef)) return { id: row.id, phase: row.phase, taskId: row.taskId };
    }
    return null;
  }

  function exposure({ day, service } = {}) {
    let list = [...rows.values()];
    if (day) list = list.filter((r) => r.day === day);
    if (service) list = list.filter((r) => r.permit.service === service);
    return exposureOf(list);
  }

  function snapshotRows() {
    return [...rows.values()].map((r) => Object.freeze({
      id: r.id, phase: r.phase, billed: r.billed, estimateMicros: r.estimateMicros,
      confirmedMicros: r.confirmedMicros, taskId: r.taskId, dispatchVersion: r.dispatchVersion,
    }));
  }

  return {
    authorize, getPermit, dispatch, markNotSent, recordOutcome, reconcile, sweep, findByTaskRef,
    exposure, rows: snapshotRows, events: () => events.slice(),
  };
}

module.exports = { createReferenceLedger, TRANSITIONS, LedgerRefusal };
