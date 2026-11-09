'use strict';

/**
 * Postgres ledger (phase G2). The same interface as the in-memory reference
 * ledger (memoryLedger.js), backed by the SECURITY DEFINER functions of the
 * migration 20261108120000-create-aigw-ledger.js. UNWIRED: nothing in the
 * application constructs it; G3 decides where it runs.
 *
 * No driver is required here. Each role's connection is an injected port:
 *   query(sql, params) -> Promise<rows>
 * so the module loads nothing outside src/aiGateway and opens no connection
 * of its own. Every call is one statement, so one short transaction; no
 * transaction is ever held across a provider call.
 *
 *   caller   (aigw_caller)   authorize, abandon an unused permit, read control
 *   gateway  (aigw_gateway)  getPermit, dispatch, markNotSent, recordOutcome,
 *                            sweep, findByTaskRef, exposure, ack
 *   admin    (aigw_admin)    createPgAdmin: Stop, Resume, pauses, caps,
 *                            reconciliation (never given to the application)
 *
 * Refusals are returned as { ok: false, code }, as the reference ledger
 * returns them; the two it throws (an illegal transition and a not_sent
 * without proof, plus UNKNOWN_REQUIRES_RECONCILIATION) are thrown here as
 * LedgerRefusal too. A database error (connection lost, lock timeout) is
 * thrown as it is: the caller must treat the outcome as uncertain, and a
 * dispatch whose result is lost is never assumed to have stayed unsent.
 */

const { buildPermit, issuePermitSecret } = require('./permit');
const { canonicalJson } = require('./canonical');
const { operationById } = require('./operationCatalog');
const { DEFAULT_LIMITS } = require('./constants');
const { LedgerRefusal } = require('./memoryLedger');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THROWN = /^(ILLEGAL_TRANSITION_|NOT_SENT_REQUIRES_PROOF$|UNKNOWN_REQUIRES_RECONCILIATION$)/;

async function call(port, sql, params) {
  const rows = await port(sql, params);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('aiGateway: ledger function returned no row');
  const v = rows[0][Object.keys(rows[0])[0]];
  return typeof v === 'string' ? JSON.parse(v) : v;
}

function refuse(res) {
  if (res && res.ok === false && THROWN.test(res.code || '')) throw new LedgerRefusal(res.code);
  return res;
}

function permitFromRow(j) {
  if (!j) return null;
  if (j.billing_fields != null && canonicalJson(j.billing_fields) !== j.billing_fields_canonical) {
    throw new Error(`aiGateway: permit ${j.id} billing fields do not match their canonical form`);
  }
  return buildPermit({
    id: j.id,
    callerClass: j.caller_class,
    callerInstance: j.caller_instance,
    secretHash: j.secret_hash,
    provider: j.provider,
    operation: j.operation,
    model: j.model,
    job: { type: j.job_type, id: j.job_id, logicalKey: j.logical_key, attempt: j.attempt },
    reservation: {
      estimateMicros: Number(j.estimate_micros),
      priceCatalogId: j.price_catalog_id == null ? null : Number(j.price_catalog_id),
      strict: j.strict,
      unpriced: j.unpriced,
      day: j.reservation_day,
      sessionId: j.session_id,
      activationId: j.activation_id,
    },
    expiresAt: Number(j.expires_at_ms),
    body: { sha256: j.body_sha256, bytes: Number(j.body_bytes) },
    billingFields: j.billing_fields,
    billingHeaders: j.billing_headers || {},
  });
}

function createPgLedger({ caller, gateway, instance, limits = DEFAULT_LIMITS, randomBytes } = {}) {
  if (typeof caller !== 'function' || typeof gateway !== 'function' || typeof instance !== 'string' || !instance) {
    throw new Error('aiGateway: pg ledger needs caller and gateway query ports and a gateway instance name');
  }

  async function authorize(input = {}) {
    const op = operationById(input.operation);
    if (!op || op.cls !== 'submission') return { ok: false, code: 'NOT_A_SUBMISSION' };
    const reservation = input.reservation || {};
    const estimate = reservation.estimateMicros == null ? null : reservation.estimateMicros;
    if (estimate != null && (!Number.isInteger(estimate) || estimate < 0)) return { ok: false, code: 'ESTIMATE_INVALID' };
    const { secret, secretHash } = issuePermitSecret(randomBytes);
    // Validate every bound field before the database is asked (throws, as the
    // reference ledger does, on anything missing).
    const draft = buildPermit({
      ...input, id: 'pending', secretHash, expiresAt: 0,
      reservation: { ...reservation, estimateMicros: estimate == null ? 0 : estimate },
    });
    const res = await call(caller, 'SELECT public.aigw_authorize($1::jsonb) AS r', [JSON.stringify({
      secret_hash: secretHash,
      caller_class: draft.callerClass,
      caller_instance: draft.callerInstance,
      provider: draft.provider,
      operation: draft.operation,
      body_kind: op.bodyKind,
      model: draft.model,
      model_version: input.modelVersion || null,
      job_type: draft.job.type,
      job_id: draft.job.id,
      logical_key: draft.job.logicalKey,
      attempt: draft.job.attempt,
      estimate_micros: estimate,
      strict: draft.reservation.strict,
      price_catalog_id: draft.reservation.priceCatalogId,
      reservation_day: draft.reservation.day,
      session_id: draft.reservation.sessionId,
      activation_id: draft.reservation.activationId,
      ttl_ms: limits.permitTtlMs,
      body_sha256: draft.body.sha256,
      body_bytes: draft.body.bytes,
      billing_fields: op.bodyKind === 'json' ? input.billingFields : null,
      billing_fields_canonical: draft.billingFields,
      billing_headers: draft.billingHeaders,
    })]);
    if (!res.ok) return { ok: false, code: res.code };
    const permit = buildPermit({
      ...input, id: res.permit_id, secretHash, expiresAt: Number(res.expires_at_ms),
      reservation: { ...reservation, estimateMicros: estimate == null ? 0 : estimate, unpriced: res.unpriced === true },
    });
    return { ok: true, permit, secret, authorizedVersion: Number(res.authorized_version) };
  }

  async function getPermit(id) {
    if (!UUID.test(String(id || ''))) return null;
    const j = await call(gateway, 'SELECT public.aigw_get_permit($1::uuid) AS r', [id]);
    if (!j) return null;
    return { permit: permitFromRow(j), phase: j.phase };
  }

  async function dispatch(id, { operation } = {}) {
    if (!UUID.test(String(id || ''))) return { ok: false, code: 'PERMIT_UNKNOWN' };
    const res = await call(gateway, 'SELECT public.aigw_dispatch($1::uuid, $2::text, $3::text) AS r', [id, operation || '', instance]);
    if (!res.ok) return { ok: false, code: res.code };
    return { ok: true, dispatchVersion: Number(res.dispatch_version) };
  }

  async function markNotSent(id, cause, { provenNotForwarded = false } = {}) {
    if (!UUID.test(String(id || ''))) return { ok: false, code: 'PERMIT_UNKNOWN' };
    const res = provenNotForwarded
      ? await call(gateway, 'SELECT public.aigw_mark_not_forwarded($1::uuid, $2::text, $3::text) AS r', [id, cause || null, instance])
      : await call(gateway, 'SELECT public.aigw_abandon_authorized($1::uuid, $2::text) AS r', [id, cause || null]);
    return refuse(res);
  }

  /** The caller gives up an authorized permit it will not use. */
  async function abandon(id, cause) {
    if (!UUID.test(String(id || ''))) return { ok: false, code: 'PERMIT_UNKNOWN' };
    return refuse(await call(caller, 'SELECT public.aigw_abandon_authorized($1::uuid, $2::text) AS r', [id, cause || null]));
  }

  async function recordOutcome(id, { phase, preSendProof = false, taskId = null, confirmedMicros = null, billed = null } = {}) {
    if (!UUID.test(String(id || ''))) return { ok: false, code: 'PERMIT_UNKNOWN' };
    return refuse(await call(gateway, 'SELECT public.aigw_record_outcome($1::uuid, $2::jsonb) AS r', [id, JSON.stringify({
      phase,
      pre_send_proof: preSendProof === true,
      task_id: taskId == null ? null : String(taskId),
      confirmed_micros: Number.isInteger(confirmedMicros) ? confirmedMicros : null,
      billed: billed === 'yes' || billed === 'no' ? billed : null,
      instance,
    })]));
  }

  async function sweep({ submissionTimeoutMs, limit = 1000 } = {}) {
    if (!Number.isInteger(submissionTimeoutMs) || submissionTimeoutMs < 0) throw new Error('aiGateway: sweep needs submissionTimeoutMs');
    return call(gateway, "SELECT public.aigw_sweep(make_interval(secs => $1::double precision / 1000), $2::integer) AS r",
      [submissionTimeoutMs, limit]);
  }

  async function findByTaskRef(provider, taskRef) {
    const j = await call(gateway, 'SELECT public.aigw_find_by_task($1::text, $2::text) AS r', [provider, String(taskRef)]);
    return j ? { id: j.id, phase: j.phase, taskId: j.task_id } : null;
  }

  async function exposure({ day, service = null } = {}) {
    const j = await call(gateway, 'SELECT public.aigw_exposure($1::date, $2::text) AS r', [day, service]);
    return { reserved: Number(j.reserved), confirmed: Number(j.confirmed), uncertain: Number(j.uncertain), exposure: Number(j.exposure) };
  }

  async function readControl() {
    return call(gateway, 'SELECT public.aigw_read_control() AS r', []);
  }

  async function ack({ version, effective, inflightAtApply = [] } = {}) {
    return call(gateway, 'SELECT public.aigw_gateway_ack($1::jsonb) AS r', [JSON.stringify({
      version, effective, inflight: inflightAtApply, instance,
    })]);
  }

  return {
    authorize, getPermit, dispatch, markNotSent, abandon, recordOutcome, sweep, findByTaskRef, exposure, readControl, ack,
  };
}

/** The control row as the database input of stopState.effectiveState. */
function dbStateFromControl(c) {
  if (!c || typeof c !== 'object') return { readable: false };
  return {
    readable: true,
    state: c.global_state,
    version: Number(c.version),
    readAt: Number(c.read_at_ms),
    pauses: { ...(c.paused || {}) },
  };
}

function createPgAdmin({ admin } = {}) {
  if (typeof admin !== 'function') throw new Error('aiGateway: pg admin needs the admin query port');
  const run = (sql, params) => call(admin, sql, params);
  return {
    stop: (actor, reason) => run('SELECT public.aigw_stop($1::text, $2::text) AS r', [actor, reason]),
    requestResume: ({ actor, reason, challengeId, nonceHash, ttlSeconds }) => run('SELECT public.aigw_request_resume($1::jsonb) AS r',
      [JSON.stringify({ actor, reason, challenge_id: challengeId, nonce_hash: nonceHash, ttl_seconds: ttlSeconds })]),
    confirmResume: ({ actor, reason, challengeId, nonceHash, targetVersion }) => run('SELECT public.aigw_confirm_resume($1::jsonb) AS r',
      [JSON.stringify({ actor, reason, challenge_id: challengeId, nonce_hash: nonceHash, target_version: targetVersion })]),
    cancelResume: (actor, reason) => run('SELECT public.aigw_cancel_resume($1::text, $2::text) AS r', [actor, reason]),
    setPause: (service, paused, actor, reason) => run('SELECT public.aigw_set_pause($1::text, $2::boolean, $3::text, $4::text) AS r',
      [service, paused, actor, reason]),
    setCaps: ({ dailyMicros, imageDailyMicros, actor, reason }) => run('SELECT public.aigw_set_caps($1::jsonb) AS r',
      [JSON.stringify({ daily_cap_micros: dailyMicros, image_daily_cap_micros: imageDailyMicros, actor, reason })]),
    reconcile: (id, { to, method, evidence, billed, confirmedMicros = null, reason, actor }) => run('SELECT public.aigw_reconcile($1::uuid, $2::jsonb) AS r',
      [id, JSON.stringify({ to, method, evidence, billed, confirmed_micros: confirmedMicros, reason, actor })]),
    readControl: () => run('SELECT public.aigw_read_control() AS r', []),
    exposure: (day, service = null) => run('SELECT public.aigw_exposure($1::date, $2::text) AS r', [day, service]),
  };
}

module.exports = { createPgLedger, createPgAdmin, dbStateFromControl, permitFromRow };
