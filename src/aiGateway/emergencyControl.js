'use strict';

/**
 * Local emergency Stop (M0 addendum E, corrections E1-E4, and the E5 review
 * of 2026-11-12: authenticated log, head binding, signed revocation and an
 * external truncation anchor). Authenticated, ordered, target-bound, audited
 * and durable. Not wired into anything.
 *
 * Interfaces (injected; no filesystem and no network here):
 *   store:    checkSecurity() -> { ok, problems }  (ownership, modes, links)
 *             readState() -> { exists: false } | { exists: true, data }
 *             writeState(data), appendLog(entry), readLog() -> entries
 *   verifier: verify(payloadString, signatureBase64)
 *               -> { valid, signer, roles } | { valid: false, revoked: true,
 *                    signer, historicalRoles }
 *             active()  -> [{ fingerprint, roles }]   (non-revoked keys)
 *             revoked() -> [fingerprint]               (revoked keys it holds)
 *   anchor:   read() -> Promise<{ seq, hash }>         (throws when unavailable)
 *             advance({ from: { seq, hash }, to: { seq, hash } })
 *               -> Promise<{ ok: true }> | Promise<{ ok: false }>
 *             The anchor is outside the gateway's files. advance must be
 *             atomic, conditional (only from exactly `from`) and forward-only
 *             (to.seq === from.seq + 1); it has no way to move back.
 *   clock:    now() -> ms
 *   targetId: this gateway's exact target id, assigned at provisioning
 *   random:   (bytes) -> Buffer   (defaults to crypto.randomBytes)
 *
 * Commands are { payload, signature }; payload is JSON
 *   { action: 'stop'|'release'|'recover'|'revoke', reason, target, seq,
 *     commandId, issuedAt, [head], [challenge, floors], [key] }
 *
 * What is trusted. Only the target id and the key set (both provisioning
 * configuration) and the anchor. The log is the record: every entry holds
 * the original signed payload and signature, and load() derives the state by
 * verifying and replaying it under the same rules a live command meets. The
 * state file is a cross-check that can only restrict: if it is missing,
 * unreadable or differs from the replay, the gateway is stopped and untrusted
 * and the file is never rewritten except by a signed RECOVER.
 *
 * Rules (live and replay alike, in evaluate()):
 *   Signature and target: an Ed25519 signature by a key in the set; target
 *     equals targetId exactly.
 *   E1 per-key order: seq exceeds the last seq of the signing key.
 *   Cross-key order: a release is applied only when its issuedAt is strictly
 *     later than the stop floor (the highest issuedAt of any stop, RECOVER
 *     or revoke). Time never blocks a stop.
 *   Head binding: release, recover and revoke are signed over `head`, the
 *     hash of the entry before them. The log's hash chain is unkeyed, so
 *     without this an entry could be cut out and the chain recomputed; with
 *     it, a release signed after a stop cannot survive that stop's removal.
 *     A stop carries no head, so nothing has to be read before stopping.
 *   Roles: 'control' signs stop and release; 'recover' signs recover and
 *     revoke.
 *   Revocation boundary: a key is revoked by a signed, head-bound `revoke`
 *     entry. Its earlier entries stay valid history; any entry by it after
 *     that one fails the replay. A key the configuration marks revoked with
 *     no revoke entry yet leaves the gateway stopped (revocation_pending)
 *     and accepting only stop and revoke; a key the log revoked that the
 *     configuration still lists as active is a mismatch (untrusted).
 *   RECOVER: only when untrusted and recoverable; needs the single-use
 *     in-memory challenge and a floor for every active key, none below what
 *     the log proves. It keeps the counters of keys that are no longer
 *     active. It leaves the gateway STOPPED.
 *   A stop while untrusted: when the log is sound (the recoverable
 *     conditions) the stop is appended to the log, the state file left
 *     alone. It therefore survives a restart; a RECOVER signed before it no
 *     longer matches the head, and its stop floor binds later releases. A
 *     stop may be the first entry of a log, before any RECOVER.
 *
 * What signatures cannot show: removal of the newest entries. A log cut back
 * to an earlier, genuine prefix replays cleanly, and if the removed entry was
 * a STOP the prefix may end RELEASED. Only the anchor shows that, so the
 * gateway reports RELEASED only while the anchor was recently read and
 * equals the local log head. Anchor unavailable or stale: not readable (fail
 * closed) until it verifies again. Anchor ahead of the log, or on another
 * chain: stopped and untrusted, and RECOVER is blocked until the files are
 * archived and the anchor reset by its administrator.
 *
 * Order of persistence (commands are applied one at a time):
 *   stop     in memory at once, before anything is awaited; then log, state
 *            file, anchor. No later failure can undo it.
 *   release  validate; log; state file; anchor confirmed; only then
 *            RELEASED. A release whose anchor write is not confirmed stays
 *            stopped (RELEASE_PENDING_ANCHOR) until refresh() confirms it in
 *            the same process. After a restart it is never confirmed: log
 *            entries a process finds past the anchor are an unconfirmed
 *            tail, the anchor is not moved over them, and the gateway stays
 *            stopped until a fresh release, signed over the current head, is
 *            applied.
 *            A stop that arrives meanwhile holds the gateway stopped and is
 *            logged after the release.
 *   recover, revoke   as release; both end STOPPED.
 * A failed log or state write leaves the gateway stopped and untrusted until
 * load() is run again.
 */

const crypto = require('crypto');
const { canonicalJson, sha256Hex } = require('./canonical');
const { DEFAULT_LIMITS } = require('./constants');

const GENESIS_HASH = '0'.repeat(64);
const STATE_VERSION = 3;
const TARGET_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const COMMAND_ID = /^[A-Za-z0-9_.:-]{16,128}$/;
const FINGERPRINT = /^[0-9a-f]{16}$/;
const HASH = /^[0-9a-f]{64}$/;
const CHALLENGE = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(['stop', 'release', 'recover', 'revoke']);
const HEAD_BOUND = new Set(['release', 'recover', 'revoke']);
const ROLE_FOR = Object.freeze({ stop: 'control', release: 'control', recover: 'recover', revoke: 'recover' });

const isSeq = (n) => Number.isSafeInteger(n) && n >= 0;
const isTime = (t) => Number.isFinite(t) && t >= 0;

function chainHash(prevHash, entryWithoutHash) {
  return sha256Hex(`${prevHash}\n${canonicalJson(entryWithoutHash)}`);
}

/** Verify a hash-chained log's links only. Returns { ok: true } or { ok: false, at }. */
function verifyLogChain(entries) {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i += 1) {
    const { hash, ...rest } = entries[i] || {};
    if (rest.seq !== i + 1 || rest.prevHash !== prev || hash !== chainHash(prev, rest)) return { ok: false, at: i };
    prev = hash;
  }
  return { ok: true };
}

function initialState() {
  return {
    initialized: false, stopped: true, since: null, reason: null, lastSeq: {}, stopFloor: 0, revoked: {},
    head: { seq: 0, hash: GENESIS_HASH },
  };
}

/** Parse and shape-check a signed payload. Returns { ok, p } or { ok: false, code }. */
function parsePayload(payload, targetId) {
  let p;
  try {
    p = JSON.parse(payload);
  } catch (err) {
    return { ok: false, code: 'COMMAND_MALFORMED' };
  }
  if (!p || typeof p !== 'object' || Array.isArray(p) || !ACTIONS.has(p.action)) return { ok: false, code: 'COMMAND_MALFORMED' };
  if (typeof p.reason !== 'string' || p.reason.trim() === '') return { ok: false, code: 'REASON_REQUIRED' };
  if (p.target !== targetId) return { ok: false, code: 'TARGET_MISMATCH' };
  if (!Number.isSafeInteger(p.seq) || p.seq < 1) return { ok: false, code: 'COMMAND_MALFORMED' };
  if (typeof p.commandId !== 'string' || !COMMAND_ID.test(p.commandId)) return { ok: false, code: 'COMMAND_MALFORMED' };
  if (!isTime(p.issuedAt)) return { ok: false, code: 'COMMAND_MALFORMED' };
  return { ok: true, p };
}

/**
 * The ordering rules, applied to one command against a state. Pure: returns
 * { ok: true, next } (a new state, head not yet advanced) or { ok: false, code }.
 * Used for a live command and for every entry of a replay.
 */
function evaluate(state, p, signer, roles) {
  if (state.revoked[signer] !== undefined) return { ok: false, code: 'KEY_REVOKED' };
  if (!roles.includes(ROLE_FOR[p.action])) return { ok: false, code: 'KEY_NOT_AUTHORIZED' };
  // Before the first RECOVER only a stop (which changes nothing but the
  // floor and its key's counter) or the RECOVER itself can be recorded.
  if (!state.initialized && p.action !== 'recover' && p.action !== 'stop') return { ok: false, code: 'RECOVERY_REQUIRED' };
  if (HEAD_BOUND.has(p.action) && p.head !== state.head.hash) return { ok: false, code: 'HEAD_MISMATCH' };
  if (p.seq <= (state.lastSeq[signer] || 0)) return { ok: false, code: 'SEQ_STALE' };

  const next = { ...state, lastSeq: { ...state.lastSeq }, revoked: { ...state.revoked } };
  if (p.action === 'release') {
    if (!(p.issuedAt > state.stopFloor)) return { ok: false, code: 'RELEASE_PREDATES_STOP' };
    Object.assign(next, { stopped: false, since: null, reason: null });
    next.lastSeq[signer] = p.seq;
    return { ok: true, next };
  }
  if (p.action === 'recover') {
    if (!p.floors || typeof p.floors !== 'object' || Array.isArray(p.floors)) return { ok: false, code: 'FLOORS_INCOMPLETE' };
    for (const [fp, n] of Object.entries(p.floors)) {
      if (!FINGERPRINT.test(fp) || state.revoked[fp] !== undefined) return { ok: false, code: 'FLOORS_INVALID' };
      if (!isSeq(n)) return { ok: false, code: 'FLOORS_INCOMPLETE' };
      if (n < (state.lastSeq[fp] || 0)) return { ok: false, code: 'FLOOR_TOO_LOW' };
    }
    // Counters of keys the floors do not name (no longer active) are kept.
    Object.assign(next.lastSeq, p.floors);
    next.lastSeq[signer] = Math.max(next.lastSeq[signer] || 0, p.seq);
    next.initialized = true;
  } else if (p.action === 'revoke') {
    if (typeof p.key !== 'string' || !FINGERPRINT.test(p.key) || state.revoked[p.key] !== undefined) return { ok: false, code: 'REVOKE_INVALID' };
    // A key cannot revoke itself: a compromised recovery key is revoked by
    // another one, and the last recovery key cannot lock recovery out.
    if (p.key === signer) return { ok: false, code: 'REVOKE_INVALID' };
    next.revoked[p.key] = state.head.seq + 1;
    next.lastSeq[signer] = p.seq;
  } else {
    next.lastSeq[signer] = p.seq;
  }
  // stop, recover and revoke all end stopped and raise the stop floor.
  next.stopped = true;
  next.reason = p.reason;
  next.stopFloor = Math.max(state.stopFloor, p.issuedAt);
  return { ok: true, next };
}

/** Who signed a payload, for a live command (active keys) or a replay (revoked keys too). */
function signerOf(verifier, payload, signature, { historical = false } = {}) {
  const v = verifier.verify(payload, signature) || {};
  if (!FINGERPRINT.test(v.signer || '')) return { ok: false, code: 'SIGNATURE_INVALID' };
  if (v.valid === true) return { ok: true, signer: v.signer, roles: Array.isArray(v.roles) ? v.roles : [] };
  if (v.revoked === true) {
    if (!historical) return { ok: false, code: 'KEY_REVOKED' };
    return { ok: true, signer: v.signer, roles: Array.isArray(v.historicalRoles) ? v.historicalRoles : [] };
  }
  return { ok: false, code: 'SIGNATURE_INVALID' };
}

/**
 * Verify and replay a log: chain links, each entry's signature, and the same
 * ordering rules as a live command. Returns { ok: true, state, hashes } or
 * { ok: false, at, code }. Nothing but the verifier and targetId is trusted.
 */
function replayLog(entries, { verifier, targetId }) {
  if (!Array.isArray(entries)) return { ok: false, at: 0, code: 'LOG_NOT_A_LIST' };
  let state = initialState();
  const hashes = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const fail = (code) => ({ ok: false, at: i, code });
    if (!e || typeof e !== 'object' || Array.isArray(e)) return fail('ENTRY_MALFORMED');
    const { hash, ...rest } = e;
    if (rest.seq !== i + 1 || rest.prevHash !== state.head.hash || !HASH.test(hash || '') || hash !== chainHash(state.head.hash, rest)) return fail('CHAIN_BROKEN');
    if (Object.keys(rest).sort().join() !== 'at,payload,prevHash,seq,signature') return fail('ENTRY_MALFORMED');
    if (typeof rest.payload !== 'string' || typeof rest.signature !== 'string' || !isTime(rest.at)) return fail('ENTRY_MALFORMED');
    const sig = signerOf(verifier, rest.payload, rest.signature, { historical: true });
    if (!sig.ok) return fail(sig.code);
    const parsed = parsePayload(rest.payload, targetId);
    if (!parsed.ok) return fail(parsed.code);
    const r = evaluate(state, parsed.p, sig.signer, sig.roles);
    if (!r.ok) return fail(r.code);
    state = { ...r.next, since: r.next.stopped ? rest.at : null, head: { seq: rest.seq, hash } };
    hashes.push(hash);
  }
  return { ok: true, state, hashes };
}

/** The state file's contents for a state: what load() compares the file with. */
function stateDocument(state, targetId) {
  return {
    version: STATE_VERSION, target: targetId, stopped: state.stopped, since: state.since, reason: state.reason,
    lastSeq: { ...state.lastSeq }, stopIssuedAt: state.stopFloor, revoked: { ...state.revoked }, logHead: { ...state.head },
  };
}

function createEmergencyControl({
  store, verifier, anchor, clock, targetId, random = (n) => crypto.randomBytes(n), limits = DEFAULT_LIMITS,
} = {}) {
  if (!store || !verifier || !clock) throw new Error('aiGateway: emergency control needs store, verifier and clock');
  if (typeof store.checkSecurity !== 'function') throw new Error('aiGateway: emergency store must check its own ownership and permissions');
  if (typeof verifier.verify !== 'function' || typeof verifier.active !== 'function' || typeof verifier.revoked !== 'function') {
    throw new Error('aiGateway: emergency verifier must verify signatures and list its active and revoked keys');
  }
  if (!anchor || typeof anchor.read !== 'function' || typeof anchor.advance !== 'function') {
    throw new Error('aiGateway: emergency control needs an external truncation anchor (read, advance)');
  }
  if (typeof targetId !== 'string' || !TARGET_ID.test(targetId)) {
    throw new Error('aiGateway: emergency control needs the explicit target id assigned at provisioning');
  }

  const mem = {
    loaded: false, trusted: false, recoverable: false, condition: 'not_loaded',
    state: initialState(), hashes: [],
    // Stops received but not yet in the log: each holds the gateway stopped.
    urgentStops: 0,
    // The log head this process found at load, and whether it has since
    // applied a command itself. Entries it found past the anchor are an
    // unconfirmed tail: it never pushes the anchor over them on its own.
    inheritedSeq: 0,
    committedLive: false,
    pendingRevocations: new Set(),
    anchor: { status: 'unread', seq: null, hash: null, checkedAt: null },
    challenge: null,
  };

  const anchorFresh = () => mem.anchor.status === 'verified' && mem.anchor.seq === mem.state.head.seq
    && mem.anchor.hash === mem.state.head.hash && isTime(mem.anchor.checkedAt)
    && clock.now() - mem.anchor.checkedAt <= limits.anchorStaleMs && clock.now() >= mem.anchor.checkedAt - limits.anchorStaleMs;

  function snapshot() {
    const anchored = anchorFresh();
    const stopped = !mem.trusted || mem.state.stopped || mem.urgentStops > 0 || mem.pendingRevocations.size > 0 || !anchored;
    return Object.freeze({
      // Readable only while the log is trusted and the anchor confirms its head.
      readable: mem.trusted && anchored,
      stopped,
      condition: mem.condition,
      since: mem.state.since,
      reason: mem.trusted ? mem.state.reason : mem.condition,
      readAt: mem.anchor.checkedAt,
      head: Object.freeze({ ...mem.state.head }),
      anchor: mem.anchor.status,
      revocationPending: Object.freeze([...mem.pendingRevocations].sort()),
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

  function untrusted(condition, { recoverable = true } = {}) {
    Object.assign(mem, { loaded: true, trusted: false, recoverable, condition, challenge: null });
    if (recoverable) issueChallenge();
    console.error(`[aiGateway] emergency state untrusted (${condition}); treating as stopped`);
  }

  /**
   * Bring the anchor to the local head and record the result. Entries past
   * the anchor were verified by the replay (or just applied), so pushing them
   * forward, one linked step at a time, is safe. Returns true when the anchor
   * now equals the local head.
   */
  async function anchorSync({ precheck = false } = {}) {
    const head = mem.state.head;
    let a;
    try {
      a = await anchor.read();
    } catch (err) {
      mem.anchor = { ...mem.anchor, status: 'unavailable' };
      return false;
    }
    if (!a || !isSeq(a.seq) || !HASH.test(a.hash || '')) {
      mem.anchor = { ...mem.anchor, status: 'unavailable' };
      return false;
    }
    let cur = { seq: a.seq, hash: a.hash };
    if (cur.seq > head.seq) {
      mem.anchor = { ...cur, status: 'ahead', checkedAt: clock.now() };
      untrusted('anchor_ahead', { recoverable: false });
      return false;
    }
    if ((cur.seq === 0 ? GENESIS_HASH : mem.hashes[cur.seq - 1]) !== cur.hash) {
      mem.anchor = { ...cur, status: 'fork', checkedAt: clock.now() };
      untrusted('anchor_fork', { recoverable: false });
      return false;
    }
    // Entries this process found in the files past the anchor were never
    // confirmed by it. They may be a release that was logged just before a
    // crash, or one written into the files; either way the anchor is not
    // moved over them until this process has applied a command of its own.
    if (cur.seq < mem.inheritedSeq && !mem.committedLive) {
      mem.anchor = { ...cur, status: 'unconfirmed', checkedAt: clock.now() };
      return precheck;
    }
    while (cur.seq < head.seq) {
      const to = { seq: cur.seq + 1, hash: mem.hashes[cur.seq] };
      let r;
      try {
        r = await anchor.advance({ from: { ...cur }, to: { ...to } });
      } catch (err) {
        r = null;
      }
      if (!r || r.ok !== true) {
        mem.anchor = { ...cur, status: 'behind', checkedAt: mem.anchor.checkedAt };
        return false;
      }
      cur = to;
    }
    // The head may have moved while this was awaited only if a command was
    // applied, and commands and syncs share one queue; checked all the same.
    if (cur.seq !== mem.state.head.seq || cur.hash !== mem.state.head.hash) {
      mem.anchor = { ...cur, status: 'behind', checkedAt: mem.anchor.checkedAt };
      return false;
    }
    mem.anchor = { ...cur, status: 'verified', checkedAt: clock.now() };
    return true;
  }

  // One command (or load, or refresh) at a time.
  let tail = Promise.resolve();
  function serial(fn) {
    const run = tail.then(fn, fn);
    tail = run.then(() => {}, () => {});
    return run;
  }

  async function loadNow() {
    Object.assign(mem, {
      loaded: true, trusted: false, recoverable: false, condition: 'loading', state: initialState(), hashes: [],
      pendingRevocations: new Set(), anchor: { status: 'unread', seq: null, hash: null, checkedAt: null }, challenge: null,
    });
    let sec;
    try {
      sec = store.checkSecurity();
    } catch (err) {
      sec = { ok: false };
    }
    if (!sec || sec.ok !== true) {
      untrusted('store_insecure', { recoverable: false });
      return snapshot();
    }
    let log;
    try {
      log = store.readLog();
      if (!Array.isArray(log)) throw new TypeError('log is not a list');
    } catch (err) {
      untrusted('log_unreadable', { recoverable: false });
      return snapshot();
    }
    const replay = replayLog(log, { verifier, targetId });
    if (!replay.ok) {
      console.error(`[aiGateway] emergency log rejected at entry ${replay.at + 1}: ${replay.code}`);
      untrusted(replay.code === 'CHAIN_BROKEN' || replay.code === 'ENTRY_MALFORMED' ? 'log_corrupt' : 'log_unverifiable', { recoverable: false });
      return snapshot();
    }
    mem.state = replay.state;
    mem.hashes = replay.hashes;
    mem.inheritedSeq = replay.state.head.seq;
    mem.committedLive = false;

    // Revocations: the log is the boundary; the configuration must agree.
    const configRevoked = new Set(verifier.revoked());
    for (const fp of Object.keys(mem.state.revoked)) {
      if (!configRevoked.has(fp)) {
        untrusted('revocation_mismatch', { recoverable: false });
        return snapshot();
      }
    }
    for (const fp of configRevoked) if (mem.state.revoked[fp] === undefined) mem.pendingRevocations.add(fp);

    // The anchor, before the state file: a truncated log blocks recovery too.
    await anchorSync();
    if (mem.condition === 'anchor_ahead' || mem.condition === 'anchor_fork') return snapshot();

    let s;
    try {
      s = store.readState();
    } catch (err) {
      untrusted('state_corrupt');
      return snapshot();
    }
    if (!s || s.exists !== true) {
      untrusted(log.length ? 'state_lost' : 'state_missing');
      return snapshot();
    }
    const d = s.data;
    if (!d || typeof d !== 'object' || d.version !== STATE_VERSION) {
      untrusted('state_unknown_version');
      return snapshot();
    }
    if (d.target !== targetId) {
      untrusted('state_target_mismatch');
      return snapshot();
    }
    let same = false;
    try {
      same = canonicalJson(d) === canonicalJson(stateDocument(mem.state, targetId));
    } catch (err) {
      same = false;
    }
    if (!same || !mem.state.initialized) {
      untrusted('state_inconsistent');
      return snapshot();
    }
    Object.assign(mem, { trusted: true, recoverable: false, condition: mem.pendingRevocations.size ? 'revocation_pending' : 'ok', challenge: null });
    return snapshot();
  }

  /** Read the files and the anchor and decide what is trusted. Always resolves to a snapshot. */
  function load() {
    return serial(loadNow);
  }

  /** Re-read the anchor (the state poll). Confirms a pending anchor write when it can. */
  function refresh() {
    return serial(async () => {
      if (!mem.loaded) return snapshot();
      if (mem.condition === 'anchor_ahead' || mem.condition === 'anchor_fork') return snapshot();
      await anchorSync();
      return snapshot();
    });
  }

  /** The current recovery challenge, issuing a fresh one when it expired; null when not recoverable. */
  function recoveryChallenge() {
    if (!mem.loaded || mem.trusted || !mem.recoverable) return null;
    if (!mem.challenge || clock.now() > mem.challenge.expiresAt) issueChallenge();
    return Object.freeze({
      challenge: mem.challenge.value, challengeId: mem.challenge.id, expiresAt: mem.challenge.expiresAt,
      target: targetId, condition: mem.condition, head: mem.state.head.hash,
      knownFloors: Object.freeze({ ...mem.state.lastSeq }), stopFloor: mem.state.stopFloor,
    });
  }

  function persistenceFailed(err) {
    console.error(`[aiGateway] emergency state not persisted: ${err && err.name ? err.name : 'Error'}`);
    // The disk may now disagree with memory. Stopped until load() reads it again.
    Object.assign(mem, { trusted: false, recoverable: false, condition: 'persist_failed', challenge: null });
  }

  /**
   * Log, then the state file. The log entry is the commitment: once it is
   * appended the in-memory state follows it, whatever happens to the state
   * file. Throws on failure, after marking the gateway untrusted.
   */
  function commit(command, next, now, { writeState = true } = {}) {
    const rest = { seq: mem.state.head.seq + 1, prevHash: mem.state.head.hash, at: now, payload: command.payload, signature: command.signature };
    const hash = chainHash(mem.state.head.hash, rest);
    try {
      store.appendLog({ ...rest, hash });
    } catch (err) {
      persistenceFailed(err);
      throw err;
    }
    mem.state = { ...next, since: next.stopped ? now : null, head: { seq: rest.seq, hash } };
    mem.hashes.push(hash);
    mem.committedLive = true;
    if (!writeState) return;
    try {
      store.writeState(stateDocument(mem.state, targetId));
    } catch (err) {
      persistenceFailed(err);
      throw err;
    }
  }

  async function applyStop(command, p, sig, now) {
    try {
      // Untrusted and not recoverable: the log itself cannot be relied on or
      // written (insecure, unverifiable, truncated, or its last write failed).
      // The gateway is stopped and stays so until the manual procedure.
      if (!mem.trusted && !mem.recoverable) return { ok: false, code: 'RECOVERY_BLOCKED' };
      const r = evaluate(mem.state, p, sig.signer, sig.roles);
      if (!r.ok) return { ok: false, code: r.code };
      // Untrusted but recoverable: the log is sound, only the state file is
      // not. The stop is recorded in the log (the state file is left alone),
      // so it survives a restart: the RECOVER that follows must be signed
      // over it, and the stop floor it raises binds every later release.
      const recoveryRequired = !mem.trusted;
      try {
        commit(command, r.next, now, { writeState: !recoveryRequired });
      } catch (err) {
        return { ok: true, stopped: true, persisted: false, anchored: false };
      }
      const anchored = await anchorSync();
      return recoveryRequired ? { ok: true, stopped: true, persisted: true, anchored, recoveryRequired: true }
        : { ok: true, stopped: true, persisted: true, anchored };
    } finally {
      mem.urgentStops -= 1;
    }
  }

  async function applyRelease(command, p, sig, now) {
    if (!mem.trusted) return { ok: false, code: mem.recoverable ? 'RECOVERY_REQUIRED' : 'RECOVERY_BLOCKED' };
    if (mem.pendingRevocations.size > 0) return { ok: false, code: 'REVOCATION_PENDING' };
    const r = evaluate(mem.state, p, sig.signer, sig.roles);
    if (!r.ok) return { ok: false, code: r.code };
    // The anchor must be reachable and agree with this log, now: equal to the
    // head, or behind it only by an unconfirmed tail this fresh release was
    // signed over.
    if (!(await anchorSync({ precheck: true }))) return { ok: false, code: mem.trusted ? 'ANCHOR_NOT_VERIFIED' : 'RECOVERY_BLOCKED' };
    try {
      commit(command, r.next, now);
    } catch (err) {
      return { ok: false, code: 'RELEASE_NOT_PERSISTED' };
    }
    if (!(await anchorSync())) return { ok: false, code: 'RELEASE_PENDING_ANCHOR', persisted: true, anchored: false };
    const view = snapshot();
    return { ok: true, stopped: view.stopped, persisted: true, anchored: true };
  }

  async function applyRecover(command, p, sig, now) {
    if (!sig.roles.includes('recover')) return { ok: false, code: 'KEY_NOT_AUTHORIZED' };
    if (mem.trusted) return { ok: false, code: 'RECOVERY_NOT_NEEDED' };
    if (!mem.recoverable) return { ok: false, code: 'RECOVERY_BLOCKED' };
    const expected = mem.challenge ? Buffer.from(mem.challenge.value, 'utf8') : null;
    const given = typeof p.challenge === 'string' && CHALLENGE.test(p.challenge) ? Buffer.from(p.challenge, 'utf8') : null;
    if (!expected || !given || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return { ok: false, code: 'CHALLENGE_INVALID' };
    }
    if (now > mem.challenge.expiresAt) return { ok: false, code: 'CHALLENGE_EXPIRED' };
    if (!p.floors || typeof p.floors !== 'object' || Array.isArray(p.floors)) return { ok: false, code: 'FLOORS_INCOMPLETE' };
    const active = verifier.active().filter((k) => mem.state.revoked[k.fingerprint] === undefined);
    const activeFps = new Set(active.map((k) => k.fingerprint));
    for (const fp of Object.keys(p.floors)) if (!activeFps.has(fp)) return { ok: false, code: 'FLOORS_INVALID' };
    for (const { fingerprint } of active) if (!isSeq(p.floors[fingerprint])) return { ok: false, code: 'FLOORS_INCOMPLETE' };
    const r = evaluate(mem.state, p, sig.signer, sig.roles);
    if (!r.ok) return { ok: false, code: r.code };
    if (!(await anchorSync({ precheck: true }))) return { ok: false, code: mem.recoverable ? 'ANCHOR_NOT_VERIFIED' : 'RECOVERY_BLOCKED' };
    const challengeId = mem.challenge.id;
    mem.challenge = null; // single use, whatever happens next
    try {
      commit(command, r.next, now);
    } catch (err) {
      return { ok: false, code: 'RECOVERY_NOT_PERSISTED' };
    }
    mem.pendingRevocations = new Set(verifier.revoked().filter((fp) => mem.state.revoked[fp] === undefined));
    Object.assign(mem, { trusted: true, recoverable: false, condition: mem.pendingRevocations.size ? 'revocation_pending' : 'ok' });
    const anchored = await anchorSync();
    return { ok: true, recovered: true, stopped: true, challengeId, anchored };
  }

  async function applyRevoke(command, p, sig, now) {
    if (!mem.trusted) return { ok: false, code: mem.recoverable ? 'RECOVERY_REQUIRED' : 'RECOVERY_BLOCKED' };
    const r = evaluate(mem.state, p, sig.signer, sig.roles);
    if (!r.ok) return { ok: false, code: r.code };
    const known = new Set([...verifier.active().map((k) => k.fingerprint), ...verifier.revoked()]);
    if (!known.has(p.key)) return { ok: false, code: 'REVOKE_INVALID' };
    if (!(await anchorSync({ precheck: true }))) return { ok: false, code: mem.trusted ? 'ANCHOR_NOT_VERIFIED' : 'RECOVERY_BLOCKED' };
    try {
      commit(command, r.next, now);
    } catch (err) {
      return { ok: false, code: 'REVOKE_NOT_PERSISTED' };
    }
    mem.pendingRevocations.delete(p.key);
    if (mem.trusted) mem.condition = mem.pendingRevocations.size ? 'revocation_pending' : 'ok';
    const anchored = await anchorSync();
    return { ok: true, revoked: p.key, stopped: true, persisted: true, anchored };
  }

  /**
   * Apply one signed command. Resolves to a result; never rejects. A valid
   * stop restricts the gateway before this function returns its promise.
   */
  function apply(command) {
    const refuse = (code) => Promise.resolve({ ok: false, code });
    if (!mem.loaded) return refuse('NOT_LOADED');
    const payload = command && command.payload;
    const signature = command && command.signature;
    if (typeof payload !== 'string' || typeof signature !== 'string') return refuse('COMMAND_MALFORMED');
    const sig = signerOf(verifier, payload, signature);
    if (!sig.ok) return refuse(sig.code);
    const parsed = parsePayload(payload, targetId);
    if (!parsed.ok) return refuse(parsed.code);
    const { p } = parsed;
    const now = clock.now();
    if (Math.abs(now - p.issuedAt) > limits.emergencyClockSkewMs) return refuse('COMMAND_STALE');
    const cmd = { payload, signature };

    if (p.action === 'stop') {
      if (!sig.roles.includes('control')) return refuse('KEY_NOT_AUTHORIZED');
      if (mem.state.revoked[sig.signer] !== undefined) return refuse('KEY_REVOKED');
      // A stale replay must not hold the gateway stopped even briefly.
      if ((mem.trusted || mem.recoverable) && p.seq <= (mem.state.lastSeq[sig.signer] || 0)) return refuse('SEQ_STALE');
      mem.urgentStops += 1; // restrict first, before anything is awaited
      return serial(() => applyStop(cmd, p, sig, clock.now())).catch(() => ({ ok: true, stopped: true, persisted: false, anchored: false }));
    }
    const run = { release: applyRelease, recover: applyRecover, revoke: applyRevoke }[p.action];
    return serial(() => run(cmd, p, sig, clock.now())).catch((err) => {
      persistenceFailed(err);
      return { ok: false, code: 'COMMAND_FAILED' };
    });
  }

  return { load, refresh, apply, recoveryChallenge, status: snapshot };
}

module.exports = {
  createEmergencyControl, verifyLogChain, replayLog, evaluate, chainHash, stateDocument, GENESIS_HASH, STATE_VERSION,
};
