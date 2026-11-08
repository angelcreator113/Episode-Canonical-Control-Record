'use strict';

/**
 * Gateway decision procedure (M0 design section 8; addendum B, F, G, H). No
 * HTTP and no provider code: the upstream call is the injected `forward`
 * port, and the ledger, body intake and safety-state reader are injected.
 *
 * Submission sequence:
 *   1. safety state must allow submissions (fail closed otherwise)
 *   2. permit must exist and be unused
 *   3. body read within bounds and hashed (bodyReader)
 *   4. request verified against the permit (requestVerifier)
 *   5. ledger dispatch (T2): single use, unexpired, still allowed
 *   6. in ONE synchronous section: re-check the local Stop flag and the safety
 *      state, then either refuse (proven not forwarded) or register the
 *      request as in flight and call forward()
 *   7. classify the outcome (outcome.js) and record it. Never retried.
 *
 * Stop: applyStop() runs synchronously: it sets the local flag, records the
 * version it applied and snapshots the in-flight set, then hands the
 * acknowledgement to ackSink. Because step 6 is synchronous, no forward() can
 * start after the turn in which a Stop was applied; a request already
 * forwarded stays in flight and is never reclassified as not sent.
 *
 * Status reads (handleStatus) for previously submitted tasks pass under Stop;
 * when the safety state is unverified only task references this gateway has
 * itself recorded may pass.
 */

const { resolveOperation } = require('./operationCatalog');
const { verifyAgainstPermit } = require('./requestVerifier');
const { classifyOutcome } = require('./outcome');

const STATUS_PHASES = new Set(['accepted', 'provider_succeeded', 'unknown']);

function createDispatcher({ ledger, bodyIntake, readSafety, forward, clock, ackSink = () => {} } = {}) {
  if (!ledger || !bodyIntake || typeof readSafety !== 'function' || typeof forward !== 'function' || !clock) {
    throw new Error('aiGateway: dispatcher needs ledger, bodyIntake, readSafety, forward and clock');
  }
  // Boot state: stopped until a safety state has been read and applied.
  const local = { stopApplied: true, appliedVersion: null };
  const inflight = new Map();
  const knownTasks = new Set();
  const trace = [];
  let turn = 0;

  function record(type, data = {}) {
    trace.push(Object.freeze({ n: (turn += 1), type, ...data }));
  }

  function safetyAllows() {
    let s;
    try {
      s = readSafety();
    } catch (err) {
      console.error(`[aiGateway] safety state could not be read; refusing: ${err.message}`);
      return { allowed: false, s: null };
    }
    return { allowed: Boolean(s && s.state && s.state.allowSubmissions === true), s };
  }

  function emitAck(ack) {
    try {
      const p = ackSink(ack);
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.error(`[aiGateway] acknowledgement not recorded: ${err.message}`));
      }
    } catch (err) {
      console.error(`[aiGateway] acknowledgement not recorded: ${err.message}`);
    }
  }

  /** Apply the current safety state. Synchronous. Returns the acknowledgement. */
  function onSafetyChange() {
    const { allowed, s } = safetyAllows();
    const version = s && s.version != null ? s.version : null;
    if (!allowed) {
      local.stopApplied = true;
      local.appliedVersion = version;
      const ack = Object.freeze({
        version,
        effective: s && s.state ? s.state.effective : 'UNVERIFIED',
        appliedAt: clock.now(),
        inflightAtApply: Object.freeze([...inflight.values()].map((v) => Object.freeze({ ...v }))),
      });
      record('apply_stop', { version });
      emitAck(ack);
      return ack;
    }
    local.stopApplied = false;
    local.appliedVersion = version;
    record('apply_release', { version });
    const ack = Object.freeze({ version, effective: 'RELEASED', appliedAt: clock.now(), inflightAtApply: Object.freeze([]) });
    emitAck(ack);
    return ack;
  }

  async function refuseBeforeForward(permitId, code, { provenNotForwarded = false } = {}) {
    record('refuse', { permitId, code });
    if (permitId) {
      try {
        await ledger.markNotSent(permitId, code, { provenNotForwarded });
      } catch (err) {
        console.error(`[aiGateway] could not record not_sent for ${permitId}: ${err.message}`);
      }
    }
    return { forwarded: false, code };
  }

  async function handleSubmission(req = {}) {
    const permitId = req.permitId;
    if (local.stopApplied || !safetyAllows().allowed) return refuseBeforeForward(permitId, 'STOPPED');

    const rec = await ledger.getPermit(permitId);
    if (!rec) return { forwarded: false, code: 'PERMIT_UNKNOWN' };
    if (rec.phase !== 'authorized') return { forwarded: false, code: 'PERMIT_USED' };
    const resolved = resolveOperation(req);
    if (!resolved || resolved.operation.cls !== 'submission') return refuseBeforeForward(permitId, 'NOT_ALLOWLISTED');

    let body;
    try {
      body = await bodyIntake.read(req.body, {
        kind: resolved.operation.bodyKind, contentLength: req.contentLength, expectedBytes: rec.permit.body.bytes,
      });
    } catch (err) {
      console.error(`[aiGateway] body refused for ${permitId}: ${err.code || err.message}`);
      return refuseBeforeForward(permitId, err.code || 'BODY_REFUSED');
    }

    const v = verifyAgainstPermit(rec.permit, { ...req, body: { sha256: body.sha256, bytes: body.bytes, json: body.json } }, { now: clock.now() });
    if (!v.ok) {
      bodyIntake.release(body);
      return refuseBeforeForward(permitId, v.code);
    }

    const before = safetyAllows();
    const d = await ledger.dispatch(permitId, { operation: v.operation.id, controlVersion: before.s ? before.s.version : null });
    if (!d.ok) {
      bodyIntake.release(body);
      record('refuse', { permitId, code: d.code });
      return { forwarded: false, code: d.code };
    }

    // ---- one synchronous section: decide, then forward or refuse ----
    if (local.stopApplied || !safetyAllows().allowed) {
      bodyIntake.release(body);
      return refuseBeforeForward(permitId, 'STOPPED_BEFORE_FORWARD', { provenNotForwarded: true });
    }
    inflight.set(permitId, { permitId, provider: rec.permit.provider, operation: rec.permit.operation, initiatedAt: clock.now() });
    record('forward', { permitId });
    let pending;
    try {
      pending = Promise.resolve(forward({
        permit: rec.permit, operation: v.operation, params: v.params, headers: v.forwardHeaders,
        body: body.spool ? { spool: body.spool } : { raw: body.raw },
      }));
    } catch (err) {
      pending = Promise.reject(err);
    }
    // ---- end of synchronous section ----

    let evidence;
    let response = null;
    try {
      response = await pending;
      evidence = {
        kind: response && response.kind ? response.kind : 'response',
        status: response ? response.status : undefined,
        resultPresent: Boolean(response && response.resultPresent),
        taskId: response ? response.taskId : undefined,
      };
    } catch (err) {
      console.error(`[aiGateway] upstream failed for ${permitId}: ${err.code || err.message}`);
      evidence = { kind: err && err.kind ? err.kind : 'error', code: err && err.code, requestBytesWritten: err && err.requestBytesWritten };
    }
    const outcome = classifyOutcome(evidence);
    try {
      await ledger.recordOutcome(permitId, {
        phase: outcome.phase,
        preSendProof: outcome.phase === 'not_sent',
        taskId: evidence.taskId || null,
        confirmedMicros: response && Number.isInteger(response.confirmedMicros) ? response.confirmedMicros : null,
        billed: response && response.billed,
      });
    } catch (err) {
      // The row stays dispatching; the sweep makes it unknown, never not_sent.
      console.error(`[aiGateway] outcome not recorded for ${permitId}: ${err.message}`);
    }
    if (evidence.taskId) knownTasks.add(`${rec.permit.provider}:${evidence.taskId}`);
    inflight.delete(permitId);
    bodyIntake.release(body);
    record('outcome', { permitId, phase: outcome.phase });
    return { forwarded: true, outcome, response };
  }

  async function handleStatus(req = {}) {
    const resolved = resolveOperation(req);
    if (!resolved || resolved.operation.cls !== 'status') return { forwarded: false, code: 'NOT_A_STATUS_READ' };
    const { operation, params } = resolved;
    const taskRef = params[operation.taskRefGroup];
    const key = `${operation.provider}:${taskRef}`;
    let s = null;
    try {
      s = readSafety();
    } catch (err) {
      console.error(`[aiGateway] safety state unreadable for a status read: ${err.message}`);
    }
    const cachedOnly = !s || !s.state || s.state.statusMode !== 'allowed';
    if (cachedOnly && !knownTasks.has(key)) return { forwarded: false, code: 'STATUS_UNVERIFIED_STATE' };
    if (!cachedOnly) {
      const row = await ledger.findByTaskRef(operation.provider, taskRef);
      if (!row || !STATUS_PHASES.has(row.phase)) return { forwarded: false, code: 'TASK_UNKNOWN' };
    }
    record('status', { key });
    const response = await forward({ status: true, operation, params, headers: {} });
    return { forwarded: true, response };
  }

  return {
    onSafetyChange,
    handleSubmission,
    handleStatus,
    appliedVersion: () => local.appliedVersion,
    stopApplied: () => local.stopApplied,
    inflight: () => [...inflight.values()],
    trace: () => trace.slice(),
  };
}

module.exports = { createDispatcher };
