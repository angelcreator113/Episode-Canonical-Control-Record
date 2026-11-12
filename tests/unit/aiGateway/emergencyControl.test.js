'use strict';

/**
 * Local emergency Stop: E1-E4, challenge-bound RECOVER, and the E5 review
 * (2026-11-12): the three findings, filesystem checks, signed-log replay,
 * head binding, signed revocation, the external anchor and command
 * serialization. Keys, stores and the anchor are synthetic and per test.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createEmergencyControl, verifyLogChain, replayLog, chainHash, stateDocument, GENESIS_HASH, STATE_VERSION,
} = require('../../../src/aiGateway/emergencyControl');
const { createEd25519KeySet, fingerprintPem } = require('../../../src/aiGateway/signature');
const { createFsEmergencyStore, securityProblems } = require('../../../src/aiGateway/fsStores');
const { effectiveState } = require('../../../src/aiGateway/stopState');
const { DEFAULT_LIMITS } = require('../../../src/aiGateway/constants');
const { makeClock } = require('./_harness');

const TARGET = 'aigw-test-1';
const gen = () => {
  const k = crypto.generateKeyPairSync('ed25519');
  return { privateKey: k.privateKey, pem: k.publicKey.export({ type: 'spki', format: 'pem' }) };
};
const A = gen(); // control
const B = gen(); // control (backup)
const R = gen(); // recovery only
const X = gen(); // unknown to the gateway
const fp = (k) => fingerprintPem(k.pem);

let idN = 0;
function sign(key, fields) {
  const payload = JSON.stringify({ reason: 'test reason', target: TARGET, commandId: `cmd-${(idN += 1)}-abcdef0123456789`, ...fields });
  return { payload, signature: crypto.sign(null, Buffer.from(payload), key.privateKey).toString('base64') };
}

/**
 * An in-memory anchor with the contract the real one must meet: advance is
 * atomic, conditional on `from` and forward by exactly one; nothing rewinds.
 * `down`, `failAdvance` and `gate` simulate an unavailable or slow anchor.
 */
function makeAnchor() {
  let cur = { seq: 0, hash: GENESIS_HASH };
  const a = {
    down: false,
    failAdvance: false,
    gate: null,
    advances: 0,
    async read() {
      if (a.down) throw new Error('anchor unavailable');
      return { ...cur };
    },
    async advance({ from, to }) {
      if (a.gate) await a.gate;
      if (a.down || a.failAdvance) throw new Error('anchor unavailable');
      if (cur.seq === to.seq && cur.hash === to.hash) return { ok: true };
      if (from.seq !== cur.seq || from.hash !== cur.hash || to.seq !== cur.seq + 1) return { ok: false };
      cur = { ...to };
      a.advances += 1;
      return { ok: true };
    },
    peek: () => ({ ...cur }),
    adminSet: (v) => { cur = { ...v }; },
  };
  return a;
}

describe('local emergency control', () => {
  let dir;
  let clock;
  let store;
  let anchor;
  let errSpy;
  const stateFile = () => path.join(dir, 'emergency.json');
  const logFile = () => path.join(dir, 'emergency.log');
  const keySet = (revoked = []) => createEd25519KeySet([
    { publicKeyPem: A.pem, roles: ['control'] },
    { publicKeyPem: B.pem, roles: ['control'] },
    { publicKeyPem: R.pem, roles: ['recover'] },
  ], { revoked });
  const make = (opts = {}) => createEmergencyControl({
    store: opts.store || store, verifier: opts.verifier || keySet(opts.revoked), anchor: opts.anchor || anchor, clock, targetId: TARGET, ...opts.extra,
  });
  /** A new process: a new control over the same files and anchor. */
  const restart = async (opts) => { const ec = make(opts); await ec.load(); return ec; };
  /** Each signed command is issued one tick after the previous one, as in real use. */
  const tick = () => { clock.advance(1); return clock.now(); };
  const floors = (a = 0, b = 0, r = 0) => ({ [fp(A)]: a, [fp(B)]: b, [fp(R)]: r });
  const HEAD_BOUND = ['release', 'recover', 'revoke'];
  /** A signed command. release, recover and revoke are signed over the gateway's current head unless told otherwise. */
  const cmd = (ec, key, action, seq, extra = {}) => sign(key, {
    action, seq, issuedAt: tick(), ...(HEAD_BOUND.includes(action) ? { head: ec.status().head.hash } : {}), ...extra,
  });
  const recover = (ec, { seq = 1, fl = floors(), key = R, challenge, ...extra } = {}) => {
    const ch = challenge !== undefined ? challenge : (ec.recoveryChallenge() || {}).challenge;
    return ec.apply(cmd(ec, key, 'recover', seq, { challenge: ch, floors: fl, ...extra }));
  };
  /** A trusted, released gateway: recovered from an empty store, then released. */
  const established = async () => {
    const ec = make();
    await ec.load();
    expect(await recover(ec)).toMatchObject({ ok: true, recovered: true, stopped: true });
    expect(await ec.apply(cmd(ec, A, 'release', 1))).toMatchObject({ ok: true, stopped: false, anchored: true });
    return ec;
  };
  const readLog = () => fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  /** Rebuild a hash chain over the given signed commands (what someone with write access to the file can do). */
  const rechain = (items) => {
    let prev = GENESIS_HASH;
    return items.map((it, i) => {
      const rest = { seq: i + 1, prevHash: prev, at: it.at, payload: it.payload, signature: it.signature };
      prev = chainHash(prev, rest);
      return { ...rest, hash: prev };
    });
  };
  const writeLog = (entries) => fs.writeFileSync(logFile(), entries.map((e) => `${JSON.stringify(e)}\n`).join(''), { mode: 0o600 });
  /** Put a forged log in place, with the state file and the anchor made to agree wherever the log replays at all. */
  const plant = (entries, { syncAnchor = true } = {}) => {
    writeLog(entries);
    const r = replayLog(entries, { verifier: keySet(), targetId: TARGET });
    if (r.ok) fs.writeFileSync(stateFile(), JSON.stringify(stateDocument(r.state, TARGET)), { mode: 0o600 });
    if (syncAnchor && entries.length) anchor.adminSet({ seq: entries.length, hash: entries[entries.length - 1].hash });
    return r;
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigw-emerg-'));
    clock = makeClock();
    store = createFsEmergencyStore(dir);
    anchor = makeAnchor();
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('E1-E4 and challenge-bound recovery', () => {
    test('construction requires an explicit target id, a key set that lists its keys, a store that checks itself and an anchor', () => {
      const ok = { store, verifier: keySet(), anchor, clock, targetId: TARGET };
      expect(() => createEmergencyControl({ ...ok, targetId: undefined })).toThrow(/target id/);
      expect(() => createEmergencyControl({ ...ok, verifier: { verify() {} } })).toThrow(/active and revoked keys/);
      expect(() => createEmergencyControl({ ...ok, verifier: { verify() {}, active() {} } })).toThrow(/active and revoked keys/);
      expect(() => createEmergencyControl({ ...ok, store: { ...store, checkSecurity: undefined } })).toThrow(/ownership and permissions/);
      expect(() => createEmergencyControl({ ...ok, anchor: undefined })).toThrow(/truncation anchor/);
      expect(() => createEmergencyControl({ ...ok, anchor: { read() {} } })).toThrow(/truncation anchor/);
      expect(() => createEmergencyControl(ok)).not.toThrow();
    });

    test('missing state: STOPPED and untrusted; a signed release or stop cannot initialize it', async () => {
      const ec = make();
      expect(await ec.apply(cmd(ec, A, 'stop', 1))).toEqual({ ok: false, code: 'NOT_LOADED' });
      expect(await ec.load()).toMatchObject({ readable: false, stopped: true, condition: 'state_missing', recovery: { possible: true } });
      expect(await ec.apply(cmd(ec, A, 'release', 1))).toEqual({ ok: false, code: 'RECOVERY_REQUIRED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2))).toEqual({ ok: false, code: 'RECOVERY_REQUIRED' });
      expect(fs.existsSync(stateFile())).toBe(false);
      expect(fs.existsSync(logFile())).toBe(false);
    });

    test('RECOVER initializes a new gateway but leaves it STOPPED; a new, head-bound release is required', async () => {
      const ec = make();
      await ec.load();
      expect(await recover(ec)).toMatchObject({ ok: true, recovered: true, stopped: true, anchored: true });
      expect(ec.status()).toMatchObject({ readable: true, stopped: true, condition: 'ok', recovery: null, anchor: 'verified' });
      expect(await ec.apply(cmd(ec, A, 'release', 1))).toEqual({ ok: true, stopped: false, persisted: true, anchored: true });
      expect(ec.status()).toMatchObject({ readable: true, stopped: false });
      expect((await restart()).status()).toMatchObject({ readable: true, stopped: false, condition: 'ok' });
    });

    test('replaying an old RECOVER fails: while trusted, after the same process reloads, and after a restart', async () => {
      const ec = make();
      await ec.load();
      const ch = ec.recoveryChallenge().challenge;
      const old = cmd(ec, R, 'recover', 1, { challenge: ch, floors: floors() });
      expect((await ec.apply(old)).ok).toBe(true);
      expect(await ec.apply(old)).toEqual({ ok: false, code: 'RECOVERY_NOT_NEEDED' });
      fs.rmSync(stateFile());
      await ec.load();
      expect(ec.status().condition).toBe('state_lost');
      expect(await ec.apply(old)).toEqual({ ok: false, code: 'CHALLENGE_INVALID' });
      const ec2 = await restart();
      expect(await ec2.apply(old)).toEqual({ ok: false, code: 'CHALLENGE_INVALID' });
    });

    test('challenge rules: unpredictable, wrong target, expired, restarted process', async () => {
      const ec = make();
      await ec.load();
      const c1 = ec.recoveryChallenge();
      expect(c1.challenge).toMatch(/^[0-9a-f]{64}$/);
      expect((await restart()).recoveryChallenge().challenge).not.toBe(c1.challenge);
      expect(await recover(ec, { target: 'aigw-other' })).toEqual({ ok: false, code: 'TARGET_MISMATCH' });
      expect(await recover(ec, { challenge: 'f'.repeat(64) })).toEqual({ ok: false, code: 'CHALLENGE_INVALID' });
      const stale = cmd(ec, R, 'recover', 1, { challenge: c1.challenge, floors: floors() });
      clock.advance(DEFAULT_LIMITS.recoveryChallengeTtlMs + 1);
      expect(await ec.apply({ ...sign(R, { ...JSON.parse(stale.payload), issuedAt: clock.now() }) })).toEqual({ ok: false, code: 'CHALLENGE_EXPIRED' });
      expect(ec.recoveryChallenge().challenge).not.toBe(c1.challenge);
      expect((await recover(ec)).ok).toBe(true);
    });

    test('RECOVER needs the recovery role; control keys cannot recover or revoke and the recovery key cannot stop or release', async () => {
      const ec = make();
      await ec.load();
      expect(await recover(ec, { key: A })).toEqual({ ok: false, code: 'KEY_NOT_AUTHORIZED' });
      expect((await recover(ec)).ok).toBe(true);
      expect(await ec.apply(cmd(ec, R, 'stop', 2))).toEqual({ ok: false, code: 'KEY_NOT_AUTHORIZED' });
      expect(await ec.apply(cmd(ec, R, 'release', 2))).toEqual({ ok: false, code: 'KEY_NOT_AUTHORIZED' });
      expect(await ec.apply(cmd(ec, A, 'revoke', 1, { key: fp(B) }))).toEqual({ ok: false, code: 'KEY_NOT_AUTHORIZED' });
    });

    test('RECOVER floors: every active key, never below known history; the recovery key sequence also advances', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, B, 'stop', 7))).ok).toBe(true);
      fs.rmSync(stateFile());
      const ec2 = await restart();
      expect(ec2.status().condition).toBe('state_lost');
      expect(ec2.recoveryChallenge().knownFloors).toEqual({ [fp(A)]: 1, [fp(B)]: 7, [fp(R)]: 1 });
      expect(await recover(ec2, { seq: 2, fl: { [fp(A)]: 1, [fp(R)]: 1 } })).toEqual({ ok: false, code: 'FLOORS_INCOMPLETE' });
      expect(await recover(ec2, { seq: 2, fl: { ...floors(1, 7, 1), [fp(X)]: 0 } })).toEqual({ ok: false, code: 'FLOORS_INVALID' });
      expect(await recover(ec2, { seq: 2, fl: floors(1, 6, 1) })).toEqual({ ok: false, code: 'FLOOR_TOO_LOW' });
      expect(await recover(ec2, { seq: 1, fl: floors(1, 7, 1) })).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect((await recover(ec2, { seq: 2, fl: floors(4, 7, 1) })).ok).toBe(true);
      expect(await ec2.apply(cmd(ec2, A, 'release', 4))).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect((await ec2.apply(cmd(ec2, A, 'release', 5))).ok).toBe(true);
    });

    test('E1: counters are per key and survive restarts; a replayed command is refused', async () => {
      const ec = await established();
      const stop = cmd(ec, A, 'stop', 2);
      expect((await ec.apply(stop)).ok).toBe(true);
      expect(await ec.apply(stop)).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      const ec2 = await restart();
      expect(await ec2.apply(stop)).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect(await ec2.apply(cmd(ec2, A, 'release', 2))).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect((await ec2.apply(cmd(ec2, A, 'release', 3))).ok).toBe(true);
    });

    test('E2 and E4: another target, an unknown key and a bad signature are refused', async () => {
      const ec = await established();
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { target: 'aigw-other' }))).toEqual({ ok: false, code: 'TARGET_MISMATCH' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { target: undefined }))).toEqual({ ok: false, code: 'TARGET_MISMATCH' });
      expect(await ec.apply(cmd(ec, X, 'stop', 1))).toEqual({ ok: false, code: 'SIGNATURE_INVALID' });
      const good = cmd(ec, A, 'stop', 2);
      expect(await ec.apply({ payload: good.payload.replace('test reason', 'other reason'), signature: good.signature })).toEqual({ ok: false, code: 'SIGNATURE_INVALID' });
      expect(ec.status().stopped).toBe(false);
    });

    test('malformed, stale and reasonless commands are refused', async () => {
      const ec = await established();
      expect(await ec.apply(null)).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(await ec.apply({ payload: 1, signature: 'x' })).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(await ec.apply(cmd(ec, A, 'pause', 2))).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 0))).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { commandId: 'short' }))).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { reason: '  ' }))).toEqual({ ok: false, code: 'REASON_REQUIRED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { issuedAt: clock.now() - DEFAULT_LIMITS.emergencyClockSkewMs - 1 }))).toEqual({ ok: false, code: 'COMMAND_STALE' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2, { issuedAt: 'now' }))).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
      expect(ec.status().stopped).toBe(false);
    });
  });

  describe('cross-key ordering', () => {
    test('a release issued before a newer Stop from another key is refused, equal issuedAt included, and stays refused after restart', async () => {
      const ec = await established();
      const early = tick();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      const stopAt = JSON.parse(readLog().pop().payload).issuedAt;
      expect(await ec.apply(cmd(ec, B, 'release', 1, { issuedAt: early }))).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
      expect(await ec.apply(cmd(ec, B, 'release', 1, { issuedAt: stopAt }))).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
      const ec2 = await restart();
      expect(await ec2.apply(cmd(ec2, B, 'release', 1, { issuedAt: early }))).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
      expect((await ec2.apply(cmd(ec2, B, 'release', 1))).ok).toBe(true);
    });

    test('a delayed Stop older than the current release still stops and never lowers the stop floor', async () => {
      const ec = await established();
      const old = tick();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      expect((await ec.apply(cmd(ec, A, 'release', 3))).ok).toBe(true);
      const floorBefore = replayLog(readLog(), { verifier: keySet(), targetId: TARGET }).state.stopFloor;
      expect(await ec.apply(cmd(ec, B, 'stop', 1, { issuedAt: old }))).toMatchObject({ ok: true, stopped: true });
      expect(ec.status().stopped).toBe(true);
      expect(replayLog(readLog(), { verifier: keySet(), targetId: TARGET }).state.stopFloor).toBe(floorBefore);
    });

    test('a Stop refused while untrusted means the RECOVER must be issued after it', async () => {
      const ec = make();
      await ec.load();
      const before = tick();
      clock.advance(10);
      expect(await ec.apply(cmd(ec, A, 'stop', 1))).toEqual({ ok: false, code: 'RECOVERY_REQUIRED' });
      expect(await recover(ec, { issuedAt: before })).toEqual({ ok: false, code: 'RECOVERY_PREDATES_STOP' });
      expect((await recover(ec)).ok).toBe(true);
      expect(await ec.apply(cmd(ec, B, 'release', 1, { issuedAt: before }))).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
    });

    test('after RECOVER, a release issued before the RECOVER is refused even with a fresh sequence', async () => {
      const ec = await established();
      const early = tick();
      fs.rmSync(stateFile());
      const ec2 = await restart();
      expect((await recover(ec2, { seq: 2, fl: floors(1, 0, 1) })).ok).toBe(true);
      expect(await ec2.apply(cmd(ec2, B, 'release', 9, { issuedAt: early }))).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
    });
  });

  describe('finding 1: a command that reached the log is never forgotten', () => {
    test.each(['release', 'stop'])('a %s that was logged but whose state write failed cannot be replayed after recovery, even with RECOVER signed on a slow clock', async (action) => {
      const ec = await established();
      if (action === 'release') expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      const failing = { ...store, writeState: () => { throw new Error('disk full'); } };
      const ecF = await restart({ store: failing });
      const lost = cmd(ecF, A, action, 5);
      const res = await ecF.apply(lost);
      if (action === 'release') expect(res).toEqual({ ok: false, code: 'RELEASE_NOT_PERSISTED' });
      else expect(res).toMatchObject({ ok: true, stopped: true, persisted: false });
      // Stopped and untrusted; nothing is accepted until the files are read again.
      expect(ecF.status()).toMatchObject({ readable: false, stopped: true, condition: 'persist_failed', recovery: { possible: false } });
      expect(await recover(ecF, { seq: 2 })).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      expect(JSON.parse(readLog().pop().payload)).toMatchObject({ action, seq: 5 });

      const ec2 = await restart();
      expect(ec2.status()).toMatchObject({ readable: false, stopped: true, condition: 'state_inconsistent' });
      expect(ec2.recoveryChallenge().knownFloors[fp(A)]).toBe(5);
      expect(await recover(ec2, { seq: 2, fl: floors(4, 1, 1) })).toEqual({ ok: false, code: 'FLOOR_TOO_LOW' });
      // The recovery signer's clock runs a minute behind the lost command's.
      const behind = JSON.parse(lost.payload).issuedAt - 60_000;
      expect((await recover(ec2, { seq: 2, fl: floors(5, 1, 1), issuedAt: behind })).ok).toBe(true);
      expect(await ec2.apply(lost)).toEqual({ ok: false, code: action === 'release' ? 'HEAD_MISMATCH' : 'SEQ_STALE' });
      const rebound = sign(A, { ...JSON.parse(lost.payload), head: ec2.status().head.hash });
      expect(await ec2.apply(rebound)).toEqual({ ok: false, code: 'SEQ_STALE' });
      expect(ec2.status().stopped).toBe(true);
    });
  });

  describe('finding 2: history from a key that is no longer active', () => {
    test('after a revocation and a RECOVER, every later restart is trusted and the revoked key stays refused', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).toMatchObject({ ok: true, revoked: fp(B), stopped: true });
      fs.rmSync(stateFile());
      const ec2 = await restart({ revoked: [fp(B)] });
      expect(ec2.status().condition).toBe('state_lost');
      expect(await recover(ec2, { seq: 3, fl: floors(1, 1, 2) })).toEqual({ ok: false, code: 'FLOORS_INVALID' });
      expect((await recover(ec2, { seq: 3, fl: { [fp(A)]: 1, [fp(R)]: 2 } })).ok).toBe(true);
      expect((await ec2.apply(cmd(ec2, A, 'release', 2))).ok).toBe(true);
      for (let i = 0; i < 2; i += 1) {
        const again = await restart({ revoked: [fp(B)] });
        expect(again.status()).toMatchObject({ readable: true, stopped: false, condition: 'ok' });
        expect(await again.apply(cmd(again, B, 'stop', 9))).toEqual({ ok: false, code: 'KEY_REVOKED' });
      }
      // B's counter was kept through the RECOVER although no floor named it.
      expect(replayLog(readLog(), { verifier: keySet([fp(B)]), targetId: TARGET }).state.lastSeq[fp(B)]).toBe(1);
    });
  });

  describe('finding 3: a malformed challenge is refused, never thrown', () => {
    test.each([
      ['multi-byte characters of the right length', 'é'.repeat(64)],
      ['too short', 'ab'],
      ['too long', 'a'.repeat(65)],
      ['upper-case hex', 'A'.repeat(64)],
      ['a number', 12345],
      ['an object', { length: 64 }],
      ['null', null],
    ])('%s', async (_label, challenge) => {
      const ec = make();
      await ec.load();
      await expect(recover(ec, { challenge })).resolves.toEqual({ ok: false, code: 'CHALLENGE_INVALID' });
      expect((await recover(ec)).ok).toBe(true);
    });
  });

  describe('layer 1: ownership, modes and links', () => {
    const insecure = async () => {
      const ec = await restart();
      expect(ec.status()).toMatchObject({ readable: false, stopped: true, condition: 'store_insecure', recovery: { possible: false } });
      expect(ec.recoveryChallenge()).toBeNull();
      expect(await recover(ec, { seq: 2, challenge: 'a'.repeat(64) })).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      expect(await ec.apply(cmd(ec, A, 'release', 2))).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      expect(await ec.apply(cmd(ec, A, 'stop', 2))).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      return ec;
    };

    test('a private directory and files pass', async () => {
      await established();
      expect(store.checkSecurity()).toEqual({ ok: true, problems: [] });
      expect(fs.statSync(stateFile()).mode & 0o777).toBe(0o600);
      expect(fs.statSync(logFile()).mode & 0o777).toBe(0o600);
    });

    test.each([
      ['a group-readable state file', () => fs.chmodSync(stateFile(), 0o640), /emergency\.json is open to group or others/],
      ['a world-readable log', () => fs.chmodSync(logFile(), 0o604), /emergency\.log is open to group or others/],
      ['a group-writable directory', () => fs.chmodSync(dir, 0o770), /state directory is open to group or others/],
      ['a hard-linked log', () => fs.linkSync(logFile(), path.join(dir, 'copy.log')), /emergency\.log has more than one name/],
      ['a symlinked state file', () => { const real = path.join(dir, 'real.json'); fs.renameSync(stateFile(), real); fs.symlinkSync(real, stateFile()); }, /emergency\.json is a symbolic link/],
      ['a symlinked log', () => { const real = path.join(dir, 'real.log'); fs.renameSync(logFile(), real); fs.symlinkSync(real, logFile()); }, /emergency\.log is a symbolic link/],
      ['a directory in place of the log', () => { fs.rmSync(logFile()); fs.mkdirSync(logFile()); }, /emergency\.log is not a regular file/],
    ])('%s: stopped, and RECOVER cannot clear it', async (_label, breakIt, problem) => {
      await established();
      breakIt();
      expect(store.checkSecurity().problems.join('; ')).toMatch(problem);
      await insecure();
    });

    test('another owner is refused, and a symlinked directory is not followed', async () => {
      await established();
      const other = process.getuid() + 1;
      expect(securityProblems(dir, [stateFile(), logFile()], other)).toEqual([
        'the state directory has another owner', 'emergency.json has another owner', 'emergency.log has another owner',
      ]);
      const link = `${dir}-link`;
      fs.symlinkSync(dir, link);
      try {
        expect(securityProblems(link, [])).toEqual(['the state directory is a link or not a directory']);
        expect(createFsEmergencyStore(link).checkSecurity().ok).toBe(false);
      } finally {
        fs.rmSync(link);
      }
      expect(securityProblems(path.join(dir, 'missing'), [])).toEqual(['the state directory cannot be read']);
      expect(securityProblems(dir, [], null)).toEqual(['this platform reports no file ownership']);
    });

    test('a file swapped for a link after the check is still not read', async () => {
      await established();
      const real = path.join(dir, 'real.json');
      fs.renameSync(stateFile(), real);
      fs.symlinkSync(real, stateFile());
      expect(() => store.readState()).toThrow();
      fs.rmSync(stateFile());
      fs.renameSync(real, stateFile());
      fs.chmodSync(stateFile(), 0o644);
      expect(() => store.readState()).toThrow(/not a private regular file/);
    });
  });

  describe('layer 2: the log is authenticated and replayed; the state file can only restrict', () => {
    test('log entries hold the signed payload and signature, hash-chained; the state file equals the replay', async () => {
      await established();
      const log = readLog();
      expect(verifyLogChain(log)).toEqual({ ok: true });
      expect(log.map((e) => Object.keys(e).sort())).toEqual([
        ['at', 'hash', 'payload', 'prevHash', 'seq', 'signature'], ['at', 'hash', 'payload', 'prevHash', 'seq', 'signature'],
      ]);
      expect(log.map((e) => JSON.parse(e.payload).action)).toEqual(['recover', 'release']);
      const r = replayLog(log, { verifier: keySet(), targetId: TARGET });
      expect(r).toMatchObject({ ok: true, state: { initialized: true, stopped: false, head: { seq: 2, hash: log[1].hash } } });
      expect(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))).toEqual(stateDocument(r.state, TARGET));
      expect(JSON.parse(fs.readFileSync(stateFile(), 'utf8')).version).toBe(STATE_VERSION);
    });

    test('a forged released state with no log is untrusted and is not rewritten', async () => {
      const forged = JSON.stringify({ version: STATE_VERSION, target: TARGET, stopped: false, since: null, reason: null, lastSeq: {}, stopIssuedAt: 0, revoked: {}, logHead: { seq: 0, hash: GENESIS_HASH } });
      fs.writeFileSync(stateFile(), forged, { mode: 0o600 });
      const ec = await restart();
      expect(ec.status()).toMatchObject({ readable: false, stopped: true, condition: 'state_inconsistent' });
      expect(await ec.apply(cmd(ec, A, 'release', 1))).toEqual({ ok: false, code: 'RECOVERY_REQUIRED' });
      expect(fs.readFileSync(stateFile(), 'utf8')).toBe(forged);
    });

    test.each([
      ['says released while the log says stopped', (d) => ({ ...d, stopped: false, since: null, reason: null })],
      ['lowers a sequence counter', (d) => ({ ...d, lastSeq: { ...d.lastSeq, [fp(A)]: 0 } })],
      ['lowers the stop floor', (d) => ({ ...d, stopIssuedAt: 0 })],
      ['drops a revocation', (d) => ({ ...d, revoked: {} })],
      ['names another log head', (d) => ({ ...d, logHead: { seq: d.logHead.seq, hash: 'a'.repeat(64) } })],
      ['carries an extra field', (d) => ({ ...d, note: 'x' })],
    ])('a state file that %s: fail closed, file left as it is, RECOVER required', async (_label, change) => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      expect((await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).ok).toBe(true);
      const tampered = JSON.stringify(change(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))));
      fs.writeFileSync(stateFile(), tampered, { mode: 0o600 });
      const ec2 = await restart({ revoked: [fp(B)] });
      expect(ec2.status()).toMatchObject({ readable: false, stopped: true, condition: 'state_inconsistent', recovery: { possible: true } });
      expect(fs.readFileSync(stateFile(), 'utf8')).toBe(tampered);
      expect(await ec2.apply(cmd(ec2, A, 'release', 3))).toEqual({ ok: false, code: 'RECOVERY_REQUIRED' });
      expect((await recover(ec2, { seq: 3, fl: { [fp(A)]: 2, [fp(R)]: 2 } })).ok).toBe(true);
      expect(ec2.status()).toMatchObject({ readable: true, stopped: true, condition: 'ok' });
    });

    test.each([
      ['corrupt', 'not json', 'state_corrupt'],
      ['of an unknown version', JSON.stringify({ version: 2, target: TARGET, stopped: false }), 'state_unknown_version'],
      ['for another target', null, 'state_target_mismatch'],
    ])('a state file that is %s is untrusted', async (_label, contents, condition) => {
      await established();
      const text = contents || JSON.stringify({ ...JSON.parse(fs.readFileSync(stateFile(), 'utf8')), target: 'aigw-other' });
      fs.writeFileSync(stateFile(), text, { mode: 0o600 });
      expect((await restart()).status()).toMatchObject({ readable: false, stopped: true, condition });
    });

    describe('a log rebuilt by someone who can write the file (chain recomputed, state file and anchor made to agree)', () => {
      /** recover(R1) -> release(A1) -> stop(B1) -> release(A2), each genuinely signed in order. */
      const history = async () => {
        const ec = await established();
        expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
        expect((await ec.apply(cmd(ec, A, 'release', 2))).ok).toBe(true);
        return readLog();
      };
      const expectRejected = async (entries, code, condition = 'log_unverifiable') => {
        const r = plant(entries);
        expect(r).toMatchObject({ ok: false, code });
        const ec = await restart();
        expect(ec.status()).toMatchObject({ readable: false, stopped: true, condition, recovery: { possible: false } });
        expect(await recover(ec, { seq: 9, challenge: 'a'.repeat(64) })).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      };

      test('the genuine history replays; so does any honest prefix of it', async () => {
        const log = await history();
        expect(replayLog(log, { verifier: keySet(), targetId: TARGET })).toMatchObject({ ok: true, state: { stopped: false } });
        expect(replayLog(log.slice(0, 3), { verifier: keySet(), targetId: TARGET })).toMatchObject({ ok: true, state: { stopped: true } });
      });

      test('a Stop cut out from before a later release: the release was signed over the Stop, so the head no longer matches', async () => {
        const log = await history();
        await expectRejected(rechain([log[0], log[1], log[3]]), 'HEAD_MISMATCH');
      });

      test('entries reordered', async () => {
        const log = await history();
        await expectRejected(rechain([log[0], log[2], log[1], log[3]]), 'HEAD_MISMATCH');
      });

      test('a RECOVER duplicated, or a command repeated', async () => {
        const log = await history();
        await expectRejected(rechain([log[0], log[0]]), 'HEAD_MISMATCH');
        await expectRejected(rechain([log[0], log[1], log[2], log[2]]), 'SEQ_STALE');
      });

      test('an altered payload, a signature from an unknown key, and a role the key does not hold', async () => {
        const log = await history();
        const altered = { ...log[2], payload: log[2].payload.replace('"stop"', '"release"') };
        await expectRejected(rechain([log[0], log[1], altered]), 'SIGNATURE_INVALID');
        const byX = sign(X, { action: 'stop', seq: 1, issuedAt: tick() });
        await expectRejected(rechain([log[0], log[1], { ...byX, at: clock.now() }]), 'SIGNATURE_INVALID');
        const head2 = rechain([log[0], log[1]])[1].hash;
        const wrongRole = sign(R, { action: 'release', seq: 2, issuedAt: tick(), head: head2 });
        await expectRejected(rechain([log[0], log[1], { ...wrongRole, at: clock.now() }]), 'KEY_NOT_AUTHORIZED');
      });

      test('a log that does not start with RECOVER, a command for another target, and a RECOVER whose floors go below the log', async () => {
        const log = await history();
        await expectRejected(rechain([log[2]]), 'RECOVERY_REQUIRED');
        const other = sign(A, { action: 'stop', seq: 3, issuedAt: tick(), target: 'aigw-other' });
        await expectRejected(rechain([...log, { ...other, at: clock.now() }]), 'TARGET_MISMATCH');
        const low = sign(R, { action: 'recover', seq: 2, issuedAt: tick(), head: log[3].hash, challenge: 'a'.repeat(64), floors: floors(1, 1, 1) });
        await expectRejected(rechain([...log, { ...low, at: clock.now() }]), 'FLOOR_TOO_LOW');
      });

      test('a release older than the stop floor, an extra field on an entry, and a broken chain', async () => {
        const log = await history();
        const head3 = log[2].hash;
        const stale = sign(A, { action: 'release', seq: 2, issuedAt: JSON.parse(log[2].payload).issuedAt, head: head3 });
        await expectRejected(rechain([log[0], log[1], log[2], { ...stale, at: clock.now() }]), 'RELEASE_PREDATES_STOP');
        const withExtra = log.map((e) => ({ ...e }));
        const { hash, ...rest } = { ...withExtra[3], action: 'release' };
        withExtra[3] = { ...rest, hash: chainHash(rest.prevHash, rest) };
        expect(hash).toBeDefined();
        await expectRejected(withExtra, 'ENTRY_MALFORMED', 'log_corrupt');
        const broken = log.map((e) => ({ ...e }));
        broken[1].at += 1;
        await expectRejected(broken, 'CHAIN_BROKEN', 'log_corrupt');
      });

      test('an unreadable log', async () => {
        await history();
        fs.writeFileSync(logFile(), 'not json\n', { mode: 0o600 });
        expect((await restart()).status()).toMatchObject({ readable: false, stopped: true, condition: 'log_unreadable', recovery: { possible: false } });
      });
    });

    test('head binding, live: a release without a head, or signed over an earlier head, is refused', async () => {
      const ec = await established();
      const oldHead = ec.status().head.hash;
      expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      expect(await ec.apply(cmd(ec, A, 'release', 2, { head: oldHead }))).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect(await ec.apply(cmd(ec, A, 'release', 2, { head: undefined }))).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect(ec.status().stopped).toBe(true);
      expect((await ec.apply(cmd(ec, A, 'release', 2))).ok).toBe(true);
      // A stop needs no head.
      expect(JSON.parse(cmd(ec, A, 'stop', 3).payload).head).toBeUndefined();
      expect((await ec.apply(cmd(ec, A, 'stop', 3))).ok).toBe(true);
    });
  });

  describe('signed revocation: the rotation boundary is an entry in the log', () => {
    test('revoke is recover-role, head-bound and for a known key; it leaves the gateway STOPPED and the key refused', async () => {
      const ec = await established();
      const stale = ec.status().head.hash;
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(X) }))).toEqual({ ok: false, code: 'REVOKE_INVALID' });
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: 'nope' }))).toEqual({ ok: false, code: 'REVOKE_INVALID' });
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B), head: 'b'.repeat(64) }))).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect(ec.status().stopped).toBe(false);
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).toEqual({ ok: true, revoked: fp(B), stopped: true, persisted: true, anchored: true });
      expect(ec.status()).toMatchObject({ readable: true, stopped: true });
      expect(await ec.apply(cmd(ec, B, 'stop', 1))).toEqual({ ok: false, code: 'KEY_REVOKED' });
      expect(await ec.apply(cmd(ec, B, 'release', 1))).toEqual({ ok: false, code: 'KEY_REVOKED' });
      expect(await ec.apply(cmd(ec, R, 'revoke', 3, { key: fp(B) }))).toEqual({ ok: false, code: 'REVOKE_INVALID' });
      // A release issued before the revocation cannot undo its stop.
      expect(await ec.apply(cmd(ec, A, 'release', 2, { head: stale }))).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect((await ec.apply(cmd(ec, A, 'release', 2))).ok).toBe(true);
    });

    test('restart after rotation: history from the revoked key is accepted, the key is not, and no RECOVER is needed', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      expect((await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).ok).toBe(true);
      expect((await ec.apply(cmd(ec, A, 'release', 2))).ok).toBe(true);
      const ec2 = await restart({ revoked: [fp(B)] });
      expect(ec2.status()).toMatchObject({ readable: true, stopped: false, condition: 'ok', revocationPending: [] });
      expect(await ec2.apply(cmd(ec2, B, 'stop', 2))).toEqual({ ok: false, code: 'KEY_REVOKED' });
    });

    test('an entry signed by the revoked key after its revocation fails the replay, wherever a writer puts it', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).ok).toBe(true);
      const log = readLog();
      const late = sign(B, { action: 'stop', seq: 1, issuedAt: tick() });
      const entries = rechain([...log, { ...late, at: clock.now() }]);
      expect(replayLog(entries, { verifier: keySet([fp(B)]), targetId: TARGET })).toMatchObject({ ok: false, at: 3, code: 'KEY_REVOKED' });
      writeLog(entries);
      anchor.adminSet({ seq: 4, hash: entries[3].hash });
      expect((await restart({ revoked: [fp(B)] })).status()).toMatchObject({ readable: false, stopped: true, condition: 'log_unverifiable', recovery: { possible: false } });
      // Slipped in before the revoke entry instead: the revoke was signed over the head it saw.
      const before = rechain([log[0], log[1], { ...late, at: clock.now() }, log[2]]);
      expect(replayLog(before, { verifier: keySet([fp(B)]), targetId: TARGET })).toMatchObject({ ok: false, at: 3, code: 'HEAD_MISMATCH' });
    });

    test('the configuration marks a key revoked before any revoke entry: STOPPED, only stop and revoke are accepted', async () => {
      const ec = await established();
      const ec2 = await restart({ revoked: [fp(B)] });
      expect(ec2.status()).toMatchObject({ readable: true, stopped: true, condition: 'revocation_pending', revocationPending: [fp(B)] });
      expect(await ec2.apply(cmd(ec2, A, 'release', 2))).toEqual({ ok: false, code: 'REVOCATION_PENDING' });
      expect(await ec2.apply(cmd(ec2, B, 'stop', 1))).toEqual({ ok: false, code: 'KEY_REVOKED' });
      expect((await ec2.apply(cmd(ec2, A, 'stop', 2))).ok).toBe(true);
      expect((await ec2.apply(cmd(ec2, R, 'revoke', 2, { key: fp(B) }))).ok).toBe(true);
      expect(ec2.status()).toMatchObject({ stopped: true, condition: 'ok', revocationPending: [] });
      expect((await ec2.apply(cmd(ec2, A, 'release', 3))).ok).toBe(true);
      expect((await restart({ revoked: [fp(B)] })).status()).toMatchObject({ readable: true, stopped: false, condition: 'ok' });
      expect(ec.status().stopped).toBe(false); // the earlier process object is unaffected by design; only its files moved on
    });

    test('the log revoked a key the configuration still lists as active: untrusted until the configuration is corrected', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).ok).toBe(true);
      const wrong = await restart();
      expect(wrong.status()).toMatchObject({ readable: false, stopped: true, condition: 'revocation_mismatch', recovery: { possible: false } });
      expect(await wrong.apply(cmd(wrong, A, 'release', 2))).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      expect((await restart({ revoked: [fp(B)] })).status()).toMatchObject({ readable: true, stopped: true, condition: 'ok' });
    });

    test('a key removed from the set altogether: its history cannot be verified, so the log is rejected', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, B, 'stop', 1))).ok).toBe(true);
      const withoutB = createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['control'] }, { publicKeyPem: R.pem, roles: ['recover'] }]);
      expect((await restart({ verifier: withoutB })).status()).toMatchObject({ readable: false, stopped: true, condition: 'log_unverifiable' });
    });
  });

  describe('the external anchor: no RELEASED without a confirmed, current head', () => {
    test('the anchor contract used here: conditional, forward by one, idempotent, never back', async () => {
      const a = makeAnchor();
      const h1 = { seq: 1, hash: '1'.repeat(64) };
      const h2 = { seq: 2, hash: '2'.repeat(64) };
      expect(await a.advance({ from: { seq: 0, hash: GENESIS_HASH }, to: h2 })).toEqual({ ok: false });
      expect(await a.advance({ from: { seq: 0, hash: 'f'.repeat(64) }, to: h1 })).toEqual({ ok: false });
      expect(await a.advance({ from: { seq: 0, hash: GENESIS_HASH }, to: h1 })).toEqual({ ok: true });
      expect(await a.advance({ from: { seq: 0, hash: GENESIS_HASH }, to: h1 })).toEqual({ ok: true });
      expect(await a.advance({ from: h1, to: h2 })).toEqual({ ok: true });
      expect(await a.advance({ from: h2, to: h1 })).toEqual({ ok: false });
      expect(await a.advance({ from: h1, to: { seq: 2, hash: '3'.repeat(64) } })).toEqual({ ok: false });
      expect(a.peek()).toEqual(h2);
    });

    test('every applied command advances the anchor by exactly one', async () => {
      const ec = await established();
      expect(anchor.peek()).toEqual(ec.status().head);
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).anchored).toBe(true);
      expect(anchor.peek()).toEqual({ seq: 3, hash: readLog()[2].hash });
      expect(anchor.advances).toBe(3);
    });

    test('the newest Stop removed from the log and the state file: signatures cannot see it, the anchor does', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      const prefix = readLog().slice(0, 2);
      const r = replayLog(prefix, { verifier: keySet(), targetId: TARGET });
      expect(r).toMatchObject({ ok: true, state: { stopped: false } }); // a valid, released prefix
      writeLog(prefix);
      fs.writeFileSync(stateFile(), JSON.stringify(stateDocument(r.state, TARGET)), { mode: 0o600 });
      const ec2 = await restart();
      expect(ec2.status()).toMatchObject({ readable: false, stopped: true, condition: 'anchor_ahead', anchor: 'ahead', recovery: { possible: false } });
      expect(await ec2.apply(cmd(ec2, A, 'release', 3))).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
      expect(ec2.recoveryChallenge()).toBeNull();
      expect((await ec2.refresh()).condition).toBe('anchor_ahead');
    });

    test('an anchor on another chain is a fork: untrusted, recovery blocked', async () => {
      const ec = await established();
      anchor.adminSet({ seq: 2, hash: 'c'.repeat(64) });
      expect((await restart()).status()).toMatchObject({ readable: false, stopped: true, condition: 'anchor_fork', recovery: { possible: false } });
      anchor.adminSet({ seq: 1, hash: 'c'.repeat(64) });
      expect((await restart()).status()).toMatchObject({ condition: 'anchor_fork' });
      expect(ec.status().head.seq).toBe(2);
    });

    test('unavailable at startup: not readable and stopped although the log says released; refresh restores it', async () => {
      await established();
      anchor.down = true;
      const ec = await restart();
      expect(ec.status()).toMatchObject({ readable: false, stopped: true, condition: 'ok', anchor: 'unavailable' });
      expect((await ec.refresh()).readable).toBe(false);
      anchor.down = false;
      expect(await ec.refresh()).toMatchObject({ readable: true, stopped: false, anchor: 'verified' });
    });

    test('unavailable or stale after startup: RELEASED does not outlive the anchor', async () => {
      const ec = await established();
      expect(ec.status()).toMatchObject({ readable: true, stopped: false });
      clock.advance(DEFAULT_LIMITS.anchorStaleMs + 1);
      expect(ec.status()).toMatchObject({ readable: false, stopped: true, anchor: 'verified' });
      anchor.down = true;
      expect(await ec.refresh()).toMatchObject({ readable: false, stopped: true, anchor: 'unavailable' });
      anchor.down = false;
      expect(await ec.refresh()).toMatchObject({ readable: true, stopped: false });
      // An anchor that moved past this process (another writer, or these files were rolled back under it).
      anchor.adminSet({ seq: 3, hash: 'd'.repeat(64) });
      expect(await ec.refresh()).toMatchObject({ readable: false, stopped: true, condition: 'anchor_ahead' });
      anchor.adminSet({ seq: 2, hash: ec.status().head.hash });
      expect((await ec.refresh()).condition).toBe('anchor_ahead'); // not cleared without a restart
    });

    test('a release is refused, and nothing is logged, while the anchor cannot confirm the head', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      anchor.down = true;
      const before = fs.readFileSync(logFile(), 'utf8');
      expect(await ec.apply(cmd(ec, A, 'release', 3))).toEqual({ ok: false, code: 'ANCHOR_NOT_VERIFIED' });
      expect(await ec.apply(cmd(ec, R, 'revoke', 2, { key: fp(B) }))).toEqual({ ok: false, code: 'ANCHOR_NOT_VERIFIED' });
      expect(fs.readFileSync(logFile(), 'utf8')).toBe(before);
      expect(ec.status().stopped).toBe(true);
    });

    test('a release that reached the log but not the anchor is not RELEASED until the anchor confirms it', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      anchor.failAdvance = true;
      expect(await ec.apply(cmd(ec, A, 'release', 3))).toEqual({ ok: false, code: 'RELEASE_PENDING_ANCHOR', persisted: true, anchored: false });
      expect(JSON.parse(readLog().pop().payload).action).toBe('release');
      expect(ec.status()).toMatchObject({ readable: false, stopped: true, anchor: 'behind' });
      expect(await ec.refresh()).toMatchObject({ readable: false, stopped: true });
      anchor.failAdvance = false;
      expect(await ec.refresh()).toMatchObject({ readable: true, stopped: false, anchor: 'verified' });
    });

    test('restart with an anchor write pending: stopped while the anchor is unreachable, released only once it has caught up', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      anchor.failAdvance = true;
      expect((await ec.apply(cmd(ec, A, 'release', 3))).code).toBe('RELEASE_PENDING_ANCHOR');
      const ec2 = await restart();
      expect(ec2.status()).toMatchObject({ readable: false, stopped: true, condition: 'ok', anchor: 'behind' });
      expect(anchor.peek().seq).toBe(3);
      anchor.failAdvance = false;
      const ec3 = await restart();
      expect(ec3.status()).toMatchObject({ readable: true, stopped: false, anchor: 'verified' });
      expect(anchor.peek()).toEqual(ec3.status().head);
    });

    test('a Stop never waits for the anchor, and a failed anchor write cannot make it RELEASED', async () => {
      const ec = await established();
      anchor.down = true;
      expect(await ec.apply(cmd(ec, A, 'stop', 2))).toEqual({ ok: true, stopped: true, persisted: true, anchored: false });
      expect(ec.status()).toMatchObject({ readable: false, stopped: true });
      anchor.down = false;
      expect(await ec.refresh()).toMatchObject({ readable: true, stopped: true, anchor: 'verified' });
      expect((await restart()).status()).toMatchObject({ readable: true, stopped: true });
    });

    test('a Stop whose log or state write fails still stops, and nothing releases until the files are read again', async () => {
      const ec = await established();
      for (const broken of ['appendLog', 'writeState']) {
        const failing = { ...store, [broken]: () => { throw new Error('disk full'); } };
        const ecF = await restart({ store: failing });
        expect(ecF.status().stopped).toBe(false);
        expect(await ecF.apply(cmd(ecF, B, 'stop', broken === 'appendLog' ? 1 : 2))).toEqual({ ok: true, stopped: true, persisted: false, anchored: false });
        expect(ecF.status()).toMatchObject({ readable: false, stopped: true, condition: 'persist_failed' });
        expect(await ecF.apply(cmd(ecF, A, 'release', 9))).toEqual({ ok: false, code: 'RECOVERY_BLOCKED' });
        expect((await ecF.refresh()).stopped).toBe(true);
      }
      // The second stop reached the log; after a restart it is still there and the state file disagrees.
      const ec2 = await restart();
      expect(ec2.status()).toMatchObject({ readable: false, stopped: true, condition: 'state_inconsistent' });
      expect(ec.status().head.seq).toBe(2);
    });

    test('RECOVER needs the anchor too, and after files are archived the anchor must be reset by its administrator first', async () => {
      await established();
      fs.rmSync(stateFile());
      anchor.down = true;
      const ec = await restart();
      expect(await recover(ec, { seq: 2, fl: floors(1, 0, 1) })).toEqual({ ok: false, code: 'ANCHOR_NOT_VERIFIED' });
      anchor.down = false;
      expect((await recover(ec, { seq: 2, fl: floors(1, 0, 1) })).ok).toBe(true);
      // Archive both files out of band: the anchor is now ahead of an empty log.
      fs.rmSync(stateFile());
      fs.rmSync(logFile());
      const ec2 = await restart();
      expect(ec2.status()).toMatchObject({ condition: 'anchor_ahead', recovery: { possible: false } });
      anchor.adminSet({ seq: 0, hash: GENESIS_HASH });
      const ec3 = await restart();
      expect(ec3.status()).toMatchObject({ condition: 'state_missing', recovery: { possible: true } });
      expect((await recover(ec3, { seq: 3, fl: floors(1, 0, 2) })).ok).toBe(true);
    });
  });

  describe('command serialization', () => {
    const deferred = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open }; };

    test('a Stop restricts the gateway before apply returns its promise', async () => {
      const ec = await established();
      expect(ec.status().stopped).toBe(false);
      const pending = ec.apply(cmd(ec, A, 'stop', 2));
      expect(ec.status().stopped).toBe(true);
      expect(await pending).toMatchObject({ ok: true, stopped: true, persisted: true });
    });

    test('a replayed or unauthorized Stop does not stop the gateway even for a moment', async () => {
      const ec = await established();
      const used = cmd(ec, A, 'stop', 1);
      const p1 = ec.apply(used);
      expect(ec.status().stopped).toBe(false);
      expect(await p1).toEqual({ ok: false, code: 'SEQ_STALE' });
      const p2 = ec.apply(cmd(ec, X, 'stop', 5));
      expect(ec.status().stopped).toBe(false);
      expect(await p2).toEqual({ ok: false, code: 'SIGNATURE_INVALID' });
    });

    test('a Stop racing a Release that is waiting for the anchor: stopped at once, stopped at the end, and after a restart', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      const gate = deferred();
      const release = cmd(ec, A, 'release', 3);
      const stop = cmd(ec, B, 'stop', 1);
      anchor.gate = gate.p;
      const pRelease = ec.apply(release);
      await new Promise((r) => setImmediate(r)); // the release is logged and now waits for the anchor
      expect(JSON.parse(readLog().pop().payload).action).toBe('release');
      expect(ec.status().stopped).toBe(true); // not released: the anchor has not confirmed it
      const pStop = ec.apply(stop);
      expect(ec.status().stopped).toBe(true);
      anchor.gate = null;
      gate.open();
      const [rRelease, rStop] = await Promise.all([pRelease, pStop]);
      // The release was applied to the log, but the gateway was never RELEASED.
      expect(rRelease).toEqual({ ok: true, stopped: true, persisted: true, anchored: true });
      expect(rStop).toMatchObject({ ok: true, stopped: true, persisted: true });
      expect(readLog().slice(-2).map((e) => JSON.parse(e.payload).action)).toEqual(['release', 'stop']);
      expect(ec.status()).toMatchObject({ readable: true, stopped: true });
      expect((await restart()).status()).toMatchObject({ readable: true, stopped: true });
    });

    test('a Stop that arrives first is applied first; the Release behind it was signed over the old head and is refused', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      const release = cmd(ec, A, 'release', 3);
      const [rStop, rRelease] = await Promise.all([ec.apply(cmd(ec, B, 'stop', 1)), ec.apply(release)]);
      expect(rStop).toMatchObject({ ok: true, stopped: true });
      expect(rRelease).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect(ec.status().stopped).toBe(true);
    });

    test('two releases sent together: one is applied, the other no longer matches the head', async () => {
      const ec = await established();
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      const [r1, r2] = await Promise.all([ec.apply(cmd(ec, A, 'release', 3)), ec.apply(cmd(ec, B, 'release', 1))]);
      expect(r1.ok).toBe(true);
      expect(r2).toEqual({ ok: false, code: 'HEAD_MISMATCH' });
      expect(verifyLogChain(readLog())).toEqual({ ok: true });
    });

    test('many stops and releases interleaved leave a log that replays to the state in memory', async () => {
      const ec = await established();
      const results = await Promise.all([
        ec.apply(cmd(ec, A, 'stop', 2)), ec.apply(cmd(ec, B, 'stop', 1)), ec.apply(cmd(ec, A, 'release', 3)),
        ec.apply(cmd(ec, B, 'stop', 2)), ec.apply(cmd(ec, A, 'stop', 4)),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(4);
      const r = replayLog(readLog(), { verifier: keySet(), targetId: TARGET });
      expect(r.ok).toBe(true);
      expect(r.state.stopped).toBe(true);
      expect(ec.status()).toMatchObject({ readable: true, stopped: true, head: r.state.head });
      expect((await restart()).status()).toMatchObject({ readable: true, stopped: true, condition: 'ok' });
    });
  });

  describe('with the database Stop state (effectiveState)', () => {
    const dbReleased = () => ({ readable: true, state: 'RELEASED', version: 1, readAt: clock.now(), pauses: {} });
    const eff = (ec, db = dbReleased()) => effectiveState({ db, local: ec.status(), ack: { version: 1 }, now: clock.now() });

    test('a database Resume never clears a local Stop; a local release never clears a database Stop', async () => {
      const ec = await established();
      expect(eff(ec).allowSubmissions).toBe(true);
      expect((await ec.apply(cmd(ec, A, 'stop', 2))).ok).toBe(true);
      expect(eff(ec).allowSubmissions).toBe(false);
      expect((await ec.apply(cmd(ec, A, 'release', 3))).ok).toBe(true);
      expect(eff(ec, { ...dbReleased(), state: 'STOPPED' }).allowSubmissions).toBe(false);
      expect(eff(ec).allowSubmissions).toBe(true);
    });

    test('submissions are refused while the anchor is stale, unavailable or behind, and whenever the local state is untrusted', async () => {
      const ec = await established();
      clock.advance(DEFAULT_LIMITS.anchorStaleMs + 1);
      expect(eff(ec).allowSubmissions).toBe(false);
      await ec.refresh();
      expect(eff(ec).allowSubmissions).toBe(true);
      anchor.down = true;
      await ec.refresh();
      expect(eff(ec).allowSubmissions).toBe(false);
      anchor.down = false;
      fs.rmSync(stateFile());
      const ec2 = await restart();
      expect(eff(ec2).allowSubmissions).toBe(false);
    });
  });
});
