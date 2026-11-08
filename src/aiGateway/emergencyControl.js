'use strict';

/**
 * Local emergency Stop (M0 addendum E, with the G3 corrections E1-E4).
 * Authenticated, ordered, target-bound, audited and durable.
 *
 * Interfaces (injected; no filesystem here):
 *   store:    readState() -> { exists: false } | { exists: true, data }
 *             (throws when unreadable or corrupt), writeState(data),
 *             appendLog(entry), readLog() -> entries
 *   verifier: verify(payloadString, signatureBase64)
 *               -> { valid, signer, roles, revoked? }
 *             active() -> [{ fingerprint, roles }]   (non-revoked keys)
 *   clock:    now() -> ms
 *   targetId: this gateway's exact target id, assigned at provisioning
 *   random:   (bytes) -> Buffer   (defaults to crypto.randomBytes)
 *
 * Commands are { payload, signature }; payload is JSON
 *   { action: 'stop'|'release'|'recover', reason, target, seq, commandId,
 *     issuedAt, [challenge, floors] }
 *
 * Rules:
 *   E1 ordering: seq must exceed the last seq applied for the signing key
 *      (per key, persisted). commandId is recorded for audit only.
 *   E2 target: target must equal targetId exactly.
 *   E3 state: missing, corrupt, unknown-version, wrong-target or
 *      inconsistent state (or an unreadable log) means STOPPED and
 *      untrusted. stop/release are then refused; a normal release never
 *      initializes state. Only RECOVER can, and only:
 *        - signed by a key with the 'recover' role,
 *        - carrying the current single-use challenge (fresh random value,
 *          held in memory only, so it dies with the process, and expiring
 *          after limits.recoveryChallengeTtlMs),
 *        - carrying a floor for every active key that is not below any
 *          sequence this gateway still knows from its log or state.
 *      RECOVER leaves the gateway STOPPED; a newly signed release with a
 *      seq above the floor is required afterwards. A log whose hash chain
 *      is broken blocks recovery: the files must be archived out of band
 *      first (manual procedure). A gateway-writable state file and log
 *      cannot prove that no history was deleted; the floors come from the
 *      signing authority's own records for that reason.
 *   E4 keys: several active keys; revoked keys are refused; each key keeps
 *      its own sequence counter; roles separate 'control' (stop/release)
 *      from 'recover'.
 *   Durability: stop is applied in memory first, then logged and
 *   persisted; release is logged and persisted first, then applied. A
 *   persistence failure leaves the gateway stopped and untrusted.
 *   Every applied command is appended to a hash-chained log with target,
 *   command seq, signer fingerprint and command id (recover also records
 *   the challenge id and floors).
 */

const crypto = require('crypto');
const { canonicalJson, sha256Hex } = require('./canonical');
const { DEFAULT_LIMITS } = require('./constants');

const GENESIS_HASH = '0'.repeat(64);
const STATE_VERSION = 2;
const TARGET_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const COMMAND_ID = /^[A-Za-z0-9_.:-]{16,128}$/;
const FINGERPRINT = /^[0-9a-f]{16}$/;
const HASH = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(['stop', 'release', 'recover']);

function chainHash(prevHash, entryWithoutHash) {
  return sha256Hex(`${prevHash}\n${canonicalJson(entryWithoutHash)}`);
}

/** Verify a hash-chained log. Returns { ok: true } or { ok: false, at }. */
function verifyLogChain(entries) {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i += 1) {
    const { hash, ...rest } = entries[i] || {};
    if (rest.seq !== i + 1 || rest.prevHash !== prev || hash !== chainHash(prev, rest)) return { ok: false, at: i };
    prev = hash;
  }
  return { ok: true };
}

const isSeq = (n) => Number.isSafeInteger(n) && n >= 0;

/** Highest command sequence (or recovery floor) the log records for each key. */
function knownSequences(entries) {
  const known = {};
  const raise = (fp, n) => { if (FINGERPRINT.test(fp) && isSeq(n) && !(known[fp] >= n)) known[fp] = n; };
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    raise(e.signer, e.commandSeq);
    if (e.floors && typeof e.floors === 'object') for (const [fp, n] of Object.entries(e.floors)) raise(fp, n);
  }
  return known;
}

function validState(d) {
  return Boolean(d && typeof d === 'object' && d.version === STATE_VERSION && typeof d.stopped === 'boolean'
    && typeof d.target === 'string' && d.lastSeq && typeof d.lastSeq === 'object'
    && Object.entries(d.lastSeq).every(([fp, n]) => FINGERPRINT.test(fp) && isSeq(n))
    && d.logHead && Number.isSafeInteger(d.logHead.seq) && d.logHead.seq >= 0 && HASH.test(d.logHead.hash));
}

function createEmergencyControl({
  store, verifier, clock, targetId, random = (n) => crypto.randomBytes(n), limits = DEFAULT_LIMITS,
} = {}) {
  if (!store || !verifier || !clock) throw new Error('aiGateway: emergency control needs store, verifier and clock');
  if (typeof verifier.verify !== 'function' || typeof verifier.active !== 'function') {
    throw new Error('aiGateway: emergency verifier must verify signatures and list its active keys');
  }
  if (typeof targetId !== 'string' || !TARGET_ID.test(targetId)) {
    throw new Error('aiGateway: emergency control needs the explicit target id assigned at provisioning');
  }

  const mem = {
    loaded: false, trusted: false, recoverable: false, condition: 'not_loaded', stopped: true,
    since: null, reason: null, lastSeq: {}, known: {}, logHead: { seq: 0, hash: GENESIS_HASH },
    challenge: null, loadedAt: null,
  };

  function snapshot() {
    return Object.freeze({
      readable: mem.trusted,
      stopped: mem.stopped,
      condition: mem.condition,
      since: mem.since,
      reason: mem.reason,
      readAt: mem.loadedAt,
      recovery: mem.trusted ? null : Object.freeze({
        possible: mem.recoverable,
        challengeId: mem.challenge ? mem.challenge.id : null,
        expiresAt: mem.challenge ? mem.challenge.expiresAt : null,
      }),
    });
  }

  function issueChallenge() {
    const bytes = Buffer.from(random(32));
    if (bytes.length < 32) throw new Error('aiGateway: recovery challenge needs 32 random bytes');
    const value = bytes.toString('hex');
    mem.challenge = { value, id: sha256Hex(value).slice(0, 16), expiresAt: clock.now() + limits.recoveryChallengeTtlMs };
  }

  function untrusted(condition, { head, known = {}, recoverable = true } = {}) {
    Object.assign(mem, {
      loaded: true, trusted: false, recoverable, condition, stopped: true, since: null, reason: condition,
      lastSeq: {}, known, logHead: head || mem.logHead, challenge: null, loadedAt: clock.now(),
    });
    if (recoverable) issueChallenge();
    console.error(`[aiGateway] emergency state untrusted (${condition}); treating as stopped`);
    return snapshot();
  }

  function load() {
    let log;
    try {
      log = store.readLog();
      if (!Array.isArray(log)) throw new TypeError('log is not a list');
    } catch (err) {
      return untrusted('log_unreadable', { recoverable: false });
    }
    if (!verifyLogChain(log).ok) return untrusted('log_corrupt', { recoverable: false });
    const last = log[log.length - 1];
    const head = last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: GENESIS_HASH };
    const known = knownSequences(log);

    let s;
    try {
      s = store.readState();
    } catch (err) {
      return untrusted('state_corrupt', { head, known });
    }
    if (!s || s.exists !== true) return untrusted(log.length ? 'state_lost' : 'state_missing', { head, known });
    const d = s.data;
    if (!d || d.version !== STATE_VERSION) return untrusted('state_unknown_version', { head, known });
    if (!validState(d)) return untrusted('state_corrupt', { head, known });
    // Floors must also respect whatever the (untrusted) state still claims.
    const knownWithState = { ...known };
    for (const [fp, n] of Object.entries(d.lastSeq)) if (!(knownWithState[fp] >= n)) knownWithState[fp] = n;
    if (d.target !== targetId) return untrusted('state_target_mismatch', { head, known: knownWithState });
    if (d.logHead.seq !== head.seq || d.logHead.hash !== head.hash) return untrusted('state_inconsistent', { head, known: knownWithState });
    for (const [fp, n] of Object.entries(known)) {
      if (!(d.lastSeq[fp] >= n)) return untrusted('state_inconsistent', { head, known: knownWithState });
    }
    Object.assign(mem, {
      loaded: true, trusted: true, recoverable: false, condition: 'ok', stopped: d.stopped,
      since: d.since || null, reason: d.reason || null, lastSeq: { ...d.lastSeq }, known: knownWithState,
      logHead: head, challenge: null, loadedAt: clock.now(),
    });
    return snapshot();
  }

  /** Refresh the read timestamp of an already-loaded state (the state poll). */
  function touch() {
    mem.loadedAt = clock.now();
    return snapshot();
  }

  /** The current recovery challenge, issuing a fresh one when it expired; null when not recoverable. */
  function recoveryChallenge() {
    if (!mem.loaded || mem.trusted || !mem.recoverable) return null;
    if (!mem.challenge || clock.now() > mem.challenge.expiresAt) issueChallenge();
    return Object.freeze({
      challenge: mem.challenge.value, challengeId: mem.challenge.id, expiresAt: mem.challenge.expiresAt,
      target: targetId, condition: mem.condition, knownFloors: Object.freeze({ ...mem.known }),
    });
  }

  function appendAudit(fields) {
    const rest = { seq: mem.logHead.seq + 1, prevHash: mem.logHead.hash, ...fields };
    const hash = chainHash(mem.logHead.hash, rest);
    store.appendLog({ ...rest, hash });
    mem.logHead = { seq: rest.seq, hash };
  }

  function persist() {
    store.writeState({
      version: STATE_VERSION, target: targetId, stopped: mem.stopped, since: mem.since, reason: mem.reason,
      lastSeq: { ...mem.lastSeq }, logHead: { ...mem.logHead },
    });
  }

  function persistenceFailed(err) {
    console.error(`[aiGateway] emergency state not persisted: ${err && err.name ? err.name : 'Error'}`);
    // The disk may now disagree with memory: stay stopped and require recovery.
    mem.trusted = false;
    mem.recoverable = true;
    mem.condition = 'persist_failed';
    mem.stopped = true;
    issueChallenge();
  }

  function recover(p, sig, now) {
    if (!sig.roles.includes('recover')) return { ok: false, code: 'KEY_NOT_AUTHORIZED' };
    if (mem.trusted) return { ok: false, code: 'RECOVERY_NOT_NEEDED' };
    if (!mem.recoverable) return { ok: false, code: 'RECOVERY_BLOCKED' };
    if (!mem.challenge || typeof p.challenge !== 'string' || p.challenge.length !== mem.challenge.value.length
      || !crypto.timingSafeEqual(Buffer.from(p.challenge), Buffer.from(mem.challenge.value))) {
      return { ok: false, code: 'CHALLENGE_INVALID' };
    }
    if (now > mem.challenge.expiresAt) return { ok: false, code: 'CHALLENGE_EXPIRED' };
    if (!p.floors || typeof p.floors !== 'object' || Array.isArray(p.floors)) return { ok: false, code: 'FLOORS_INCOMPLETE' };
    const active = verifier.active();
    const activeFps = new Set(active.map((k) => k.fingerprint));
    for (const fp of Object.keys(p.floors)) if (!activeFps.has(fp)) return { ok: false, code: 'FLOORS_INVALID' };
    for (const { fingerprint } of active) {
      const f = p.floors[fingerprint];
      if (!isSeq(f)) return { ok: false, code: 'FLOORS_INCOMPLETE' };
      if (f < (mem.known[fingerprint] || 0)) return { ok: false, code: 'FLOOR_TOO_LOW' };
    }
    if (p.seq <= (mem.known[sig.signer] || 0)) return { ok: false, code: 'SEQ_STALE' };

    const prior = mem.condition;
    const lastSeq = { ...p.floors };
    lastSeq[sig.signer] = Math.max(lastSeq[sig.signer] || 0, p.seq);
    const challengeId = mem.challenge.id;
    try {
      appendAudit({
        at: now, action: 'recover', target: targetId, commandSeq: p.seq, commandId: p.commandId, signer: sig.signer,
        reason: p.reason, challengeId, floors: { ...p.floors }, priorCondition: prior,
      });
      Object.assign(mem, { lastSeq, stopped: true, since: now, reason: p.reason });
      persist();
    } catch (err) {
      persistenceFailed(err);
      return { ok: false, code: 'RECOVERY_NOT_PERSISTED' };
    }
    Object.assign(mem, { trusted: true, recoverable: false, condition: 'ok', challenge: null, known: { ...lastSeq } });
    return { ok: true, recovered: true, stopped: true, challengeId };
  }

  function apply(command) {
    if (!mem.loaded) return { ok: false, code: 'NOT_LOADED' };
    const payload = command && command.payload;
    const signature = command && command.signature;
    if (typeof payload !== 'string' || typeof signature !== 'string') return { ok: false, code: 'COMMAND_MALFORMED' };
    const sig = verifier.verify(payload, signature) || {};
    if (sig.revoked === true) return { ok: false, code: 'KEY_REVOKED' };
    if (sig.valid !== true || !FINGERPRINT.test(sig.signer || '')) return { ok: false, code: 'SIGNATURE_INVALID' };
    sig.roles = Array.isArray(sig.roles) ? sig.roles : [];
    let p;
    try {
      p = JSON.parse(payload);
    } catch (err) {
      return { ok: false, code: 'COMMAND_MALFORMED' };
    }
    if (!p || typeof p !== 'object' || !ACTIONS.has(p.action)) return { ok: false, code: 'COMMAND_MALFORMED' };
    if (typeof p.reason !== 'string' || p.reason.trim() === '') return { ok: false, code: 'REASON_REQUIRED' };
    if (p.target !== targetId) return { ok: false, code: 'TARGET_MISMATCH' };
    if (!Number.isSafeInteger(p.seq) || p.seq < 1) return { ok: false, code: 'COMMAND_MALFORMED' };
    if (typeof p.commandId !== 'string' || !COMMAND_ID.test(p.commandId)) return { ok: false, code: 'COMMAND_MALFORMED' };
    const now = clock.now();
    if (!Number.isFinite(p.issuedAt) || Math.abs(now - p.issuedAt) > limits.emergencyClockSkewMs) return { ok: false, code: 'COMMAND_STALE' };

    if (p.action === 'recover') return recover(p, sig, now);

    if (!sig.roles.includes('control')) return { ok: false, code: 'KEY_NOT_AUTHORIZED' };
    if (!mem.trusted) return { ok: false, code: 'RECOVERY_REQUIRED' };
    if (p.seq <= (mem.lastSeq[sig.signer] || 0)) return { ok: false, code: 'SEQ_STALE' };

    const audit = {
      at: now, action: p.action, target: targetId, commandSeq: p.seq, commandId: p.commandId, signer: sig.signer, reason: p.reason,
    };
    if (p.action === 'stop') {
      Object.assign(mem, { stopped: true, since: now, reason: p.reason }); // restrict first
      mem.lastSeq[sig.signer] = p.seq;
      try {
        appendAudit(audit);
        persist();
      } catch (err) {
        persistenceFailed(err);
        return { ok: true, stopped: true, persisted: false };
      }
      mem.known[sig.signer] = p.seq;
      return { ok: true, stopped: true, persisted: true };
    }
    // release: log and persist first, then apply.
    const before = { stopped: mem.stopped, since: mem.since, reason: mem.reason, lastSeq: { ...mem.lastSeq } };
    try {
      Object.assign(mem, { stopped: false, since: null, reason: null });
      mem.lastSeq[sig.signer] = p.seq;
      appendAudit(audit);
      persist();
    } catch (err) {
      Object.assign(mem, before);
      persistenceFailed(err);
      return { ok: false, code: 'RELEASE_NOT_PERSISTED' };
    }
    mem.known[sig.signer] = p.seq;
    return { ok: true, stopped: false, persisted: true };
  }

  return { load, touch, apply, recoveryChallenge, status: snapshot };
}

module.exports = { createEmergencyControl, verifyLogChain, chainHash, knownSequences, GENESIS_HASH, STATE_VERSION };
