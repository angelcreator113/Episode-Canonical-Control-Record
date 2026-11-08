'use strict';

/**
 * Local emergency Stop (M0 addendum E). Authenticated, audited and durable.
 *
 * Interfaces (injected; no filesystem or crypto here):
 *   store:    readState() -> { exists: false } | { exists: true, data }
 *             (throws when unreadable or corrupt), writeState(data),
 *             appendLog(entry), readLog() -> entries
 *   verifier: verify(payloadString, signatureBase64) -> { valid, signer }
 *   clock:    now() -> ms
 *
 * Rules:
 *   - A command is { payload, signature }; payload is JSON
 *     { action: 'stop'|'release', reason, issuedAt, nonce }.
 *   - Refused: bad signature, missing reason, issuedAt outside the allowed
 *     skew, or a nonce already used.
 *   - stop: applied in memory first (restricting is always safe), then
 *     persisted. release: persisted first, then applied; if it cannot be
 *     persisted the gateway stays stopped.
 *   - Boot: no state file = not stopped; an unreadable or corrupt file =
 *     stopped and unreadable (fail closed).
 *   - Every applied command is appended to a hash-chained log.
 */

const { canonicalJson, sha256Hex } = require('./canonical');
const { DEFAULT_LIMITS } = require('./constants');

const GENESIS_HASH = '0'.repeat(64);

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

function createEmergencyControl({ store, verifier, clock, limits = DEFAULT_LIMITS } = {}) {
  if (!store || !verifier || !clock) throw new Error('aiGateway: emergency control needs store, verifier and clock');
  const mem = { stopped: true, readable: false, usedNonces: new Set(), since: null, reason: null, loadedAt: null };

  function snapshot() {
    return Object.freeze({ readable: mem.readable, stopped: mem.stopped, since: mem.since, reason: mem.reason, readAt: mem.loadedAt });
  }

  function load() {
    try {
      const s = store.readState();
      mem.loadedAt = clock.now();
      if (!s || s.exists !== true) {
        Object.assign(mem, { stopped: false, readable: true, since: null, reason: null });
        mem.usedNonces = new Set();
        return snapshot();
      }
      const d = s.data;
      if (!d || typeof d.stopped !== 'boolean' || !Array.isArray(d.usedNonces)) throw new Error('emergency state malformed');
      Object.assign(mem, { stopped: d.stopped, readable: true, since: d.since || null, reason: d.reason || null });
      mem.usedNonces = new Set(d.usedNonces);
    } catch (err) {
      // Fail closed: an unreadable or corrupt state file means stopped.
      console.error(`[aiGateway] emergency state unreadable, treating as stopped: ${err.message}`);
      Object.assign(mem, { stopped: true, readable: false, since: null, reason: 'state_unreadable' });
      mem.loadedAt = clock.now();
    }
    return snapshot();
  }

  /** Refresh the read timestamp of an already-loaded state (the state poll). */
  function touch() {
    mem.loadedAt = clock.now();
    return snapshot();
  }

  function appendAudit(entryFields) {
    const log = store.readLog();
    const prev = log.length ? log[log.length - 1].hash : GENESIS_HASH;
    const rest = { seq: log.length + 1, prevHash: prev, ...entryFields };
    store.appendLog({ ...rest, hash: chainHash(prev, rest) });
  }

  function apply(command) {
    const payload = command && command.payload;
    const signature = command && command.signature;
    if (typeof payload !== 'string' || typeof signature !== 'string') return { ok: false, code: 'COMMAND_MALFORMED' };
    const sig = verifier.verify(payload, signature);
    if (!sig || sig.valid !== true) return { ok: false, code: 'SIGNATURE_INVALID' };
    let p;
    try {
      p = JSON.parse(payload);
    } catch (err) {
      console.error(`[aiGateway] emergency command payload is not JSON: ${err.message}`);
      return { ok: false, code: 'COMMAND_MALFORMED' };
    }
    if (!p || !['stop', 'release'].includes(p.action)) return { ok: false, code: 'COMMAND_MALFORMED' };
    if (typeof p.reason !== 'string' || p.reason.trim() === '') return { ok: false, code: 'REASON_REQUIRED' };
    if (typeof p.nonce !== 'string' || p.nonce.length < 16) return { ok: false, code: 'COMMAND_MALFORMED' };
    const now = clock.now();
    if (!Number.isFinite(p.issuedAt) || Math.abs(now - p.issuedAt) > limits.emergencyClockSkewMs) return { ok: false, code: 'COMMAND_STALE' };
    if (mem.usedNonces.has(p.nonce)) return { ok: false, code: 'NONCE_REPLAYED' };

    const nonces = [...mem.usedNonces, p.nonce];
    const audit = { at: now, action: p.action, reason: p.reason, nonce: p.nonce, signer: sig.signer || null };
    if (p.action === 'stop') {
      Object.assign(mem, { stopped: true, since: now, reason: p.reason }); // restrict first
      mem.usedNonces.add(p.nonce);
      try {
        store.writeState({ stopped: true, since: now, reason: p.reason, usedNonces: nonces });
        appendAudit(audit);
        mem.readable = true;
        return { ok: true, stopped: true, persisted: true };
      } catch (err) {
        console.error(`[aiGateway] emergency stop applied but not persisted: ${err.message}`);
        return { ok: true, stopped: true, persisted: false };
      }
    }
    try {
      store.writeState({ stopped: false, since: null, reason: null, usedNonces: nonces }); // persist first
      appendAudit(audit);
    } catch (err) {
      console.error(`[aiGateway] emergency release not persisted; staying stopped: ${err.message}`);
      return { ok: false, code: 'RELEASE_NOT_PERSISTED' };
    }
    mem.usedNonces.add(p.nonce);
    Object.assign(mem, { stopped: false, readable: true, since: null, reason: null, loadedAt: now });
    return { ok: true, stopped: false, persisted: true };
  }

  return { load, touch, apply, status: snapshot };
}

module.exports = { createEmergencyControl, verifyLogChain, chainHash, GENESIS_HASH };
