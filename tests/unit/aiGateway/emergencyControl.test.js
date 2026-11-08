'use strict';

/**
 * Local emergency Stop with the G3 corrections E1-E4 and challenge-bound
 * RECOVER (Option A). Keys and stores are synthetic and per test.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEmergencyControl, verifyLogChain, STATE_VERSION } = require('../../../src/aiGateway/emergencyControl');
const { createEd25519KeySet, fingerprintPem } = require('../../../src/aiGateway/signature');
const { createFsEmergencyStore } = require('../../../src/aiGateway/fsStores');
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

describe('local emergency control (E1-E4, challenge-bound recovery)', () => {
  let dir;
  let clock;
  let store;
  const keySet = (revoked = []) => createEd25519KeySet([
    { publicKeyPem: A.pem, roles: ['control'] },
    { publicKeyPem: B.pem, roles: ['control'] },
    { publicKeyPem: R.pem, roles: ['recover'] },
  ], { revoked });
  const make = (opts = {}) => createEmergencyControl({ store, verifier: keySet(opts.revoked), clock, targetId: TARGET, ...opts.extra });
  const at = () => clock.now();
  /** Each signed command is issued one tick after the previous one, as in real use. */
  const tick = () => { clock.advance(1); return clock.now(); };
  const floors = (a = 0, b = 0, r = 0) => ({ [fp(A)]: a, [fp(B)]: b, [fp(R)]: r });
  const recover = (ec, { seq = 1, fl = floors(), key = R, target = TARGET, challenge, issuedAt } = {}) => {
    const ch = challenge !== undefined ? challenge : (ec.recoveryChallenge() || {}).challenge;
    const t = issuedAt !== undefined ? issuedAt : tick();
    return ec.apply(sign(key, { action: 'recover', seq, issuedAt: t, challenge: ch, floors: fl, target }));
  };
  const cmd = (key, action, seq, extra = {}) => sign(key, { action, seq, issuedAt: tick(), ...extra });
  /** A trusted gateway: recovered from an empty store, then released. */
  const established = () => {
    const ec = make();
    ec.load();
    expect(recover(ec).ok).toBe(true);
    expect(ec.apply(cmd(A, 'release', 1)).ok).toBe(true);
    return ec;
  };
  let errSpy;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigw-emerg-'));
    clock = makeClock();
    store = createFsEmergencyStore(dir);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('construction requires an explicit target id and a key set that lists its keys', () => {
    expect(() => createEmergencyControl({ store, verifier: keySet(), clock })).toThrow(/target id/);
    expect(() => createEmergencyControl({ store, verifier: { verify: () => ({}) }, clock, targetId: TARGET })).toThrow(/active keys/);
  });

  test('missing state: STOPPED and untrusted; an old signed release cannot initialize it', () => {
    const ec = make();
    expect(ec.load()).toMatchObject({ readable: false, stopped: true, condition: 'state_missing' });
    expect(ec.apply(cmd(A, 'release', 1)).code).toBe('RECOVERY_REQUIRED');
    expect(ec.apply(cmd(A, 'stop', 2)).code).toBe('RECOVERY_REQUIRED');
    expect(ec.status()).toMatchObject({ stopped: true, readable: false });
    expect(fs.existsSync(path.join(dir, 'emergency.json'))).toBe(false); // nothing initialized
    const db = { readable: true, state: 'RELEASED', version: 1, readAt: at(), pauses: {} };
    expect(effectiveState({ db, local: ec.status(), ack: { version: 1 }, now: at() }).effective).toBe('STOPPED');
  });

  test('RECOVER initializes a new gateway but leaves it STOPPED; a new, correctly sequenced release is required', () => {
    const ec = make();
    ec.load();
    const r = recover(ec, { seq: 1, fl: floors(4, 0, 0) });
    expect(r).toMatchObject({ ok: true, recovered: true, stopped: true });
    expect(ec.status()).toMatchObject({ readable: true, stopped: true, condition: 'ok' });
    const db = { readable: true, state: 'RELEASED', version: 1, readAt: at(), pauses: {} };
    expect(effectiveState({ db, local: ec.status(), ack: { version: 1 }, now: at() }).effective).toBe('STOPPED');
    expect(ec.apply(cmd(A, 'release', 4)).code).toBe('SEQ_STALE'); // at the floor: refused
    expect(ec.apply(cmd(A, 'release', 5))).toMatchObject({ ok: true, stopped: false });
    expect(make().load()).toMatchObject({ readable: true, stopped: false, condition: 'ok' }); // survives restart
  });

  test('replaying an old RECOVER fails: while trusted, after the same process reloads, and after a restart', () => {
    const ec = make();
    ec.load();
    const ch = ec.recoveryChallenge().challenge;
    const original = sign(R, { action: 'recover', seq: 1, issuedAt: at(), challenge: ch, floors: floors() });
    expect(ec.apply(original).ok).toBe(true);
    expect(ec.apply(original).code).toBe('RECOVERY_NOT_NEEDED');
    fs.rmSync(path.join(dir, 'emergency.json'));
    expect(ec.load()).toMatchObject({ condition: 'state_lost' }); // same process: a new challenge
    expect(ec.apply(original).code).toBe('CHALLENGE_INVALID');   // a reused challenge
    const restarted = make();
    restarted.load();
    expect(restarted.apply(original).code).toBe('CHALLENGE_INVALID'); // a restarted process
  });

  test('challenge rules: unpredictable, wrong target, expired, restarted process', () => {
    const one = make(); one.load();
    const two = make(); two.load();
    const c1 = one.recoveryChallenge();
    expect(c1.challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(two.recoveryChallenge().challenge).not.toBe(c1.challenge);
    expect(recover(one, { target: 'aigw-other' }).code).toBe('TARGET_MISMATCH');
    expect(recover(one, { challenge: c1.challenge.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }).code).toBe('CHALLENGE_INVALID');
    clock.advance(DEFAULT_LIMITS.recoveryChallengeTtlMs + 1);
    expect(recover(one, { challenge: c1.challenge }).code).toBe('CHALLENGE_EXPIRED');
    const fresh = one.recoveryChallenge(); // a fresh challenge after expiry
    expect(fresh.challenge).not.toBe(c1.challenge);
    expect(recover(one, { challenge: fresh.challenge }).ok).toBe(true);
  });

  test('RECOVER needs the recovery role; control keys cannot recover and the recovery key cannot stop or release', () => {
    const ec = make();
    ec.load();
    expect(recover(ec, { key: A }).code).toBe('KEY_NOT_AUTHORIZED');
    expect(recover(ec, { key: X }).code).toBe('SIGNATURE_INVALID');
    expect(recover(ec).ok).toBe(true);
    expect(ec.apply(cmd(R, 'release', 5)).code).toBe('KEY_NOT_AUTHORIZED');
    expect(ec.apply(cmd(R, 'stop', 6)).code).toBe('KEY_NOT_AUTHORIZED');
  });

  test('RECOVER floors: every active key, never below known history; the recovery key sequence also advances', () => {
    const ec = established();
    expect(ec.apply(cmd(A, 'stop', 6)).ok).toBe(true);
    expect(ec.apply(cmd(B, 'release', 3)).ok).toBe(true);
    fs.rmSync(path.join(dir, 'emergency.json'));
    const lost = make();
    expect(lost.load()).toMatchObject({ condition: 'state_lost', stopped: true }); // history not silently reset
    expect(lost.recoveryChallenge().knownFloors).toMatchObject({ [fp(A)]: 6, [fp(B)]: 3, [fp(R)]: 1 });
    expect(recover(lost, { seq: 2, fl: floors(5, 3, 1) }).code).toBe('FLOOR_TOO_LOW');
    expect(recover(lost, { seq: 2, fl: { [fp(A)]: 6, [fp(B)]: 3 } }).code).toBe('FLOORS_INCOMPLETE');
    expect(recover(lost, { seq: 2, fl: { ...floors(6, 3, 1), [fp(X)]: 0 } }).code).toBe('FLOORS_INVALID');
    expect(recover(lost, { seq: 1, fl: floors(6, 3, 1) }).code).toBe('SEQ_STALE');
    expect(recover(lost, { seq: 2, fl: floors(6, 3, 1) }).ok).toBe(true);
    expect(lost.status()).toMatchObject({ stopped: true, readable: true });
    expect(lost.apply(cmd(A, 'release', 6)).code).toBe('SEQ_STALE'); // old release still refused
    expect(lost.apply(cmd(A, 'release', 7)).ok).toBe(true);
  });

  test('E1: a delayed release cannot override a newer Stop; counters are per key and survive restarts', () => {
    const ec = established();
    const delayedRelease = cmd(A, 'release', 10);
    expect(ec.apply(cmd(A, 'stop', 11)).ok).toBe(true);
    expect(ec.apply(delayedRelease).code).toBe('SEQ_STALE');
    expect(ec.status().stopped).toBe(true);
    expect(ec.apply(cmd(B, 'release', 1)).ok).toBe(true); // B's counter is independent
    const once = cmd(A, 'stop', 12);
    expect(ec.apply(once).ok).toBe(true);
    expect(ec.apply(once).code).toBe('SEQ_STALE');
    const restarted = make();
    expect(restarted.load()).toMatchObject({ condition: 'ok', stopped: true });
    expect(restarted.apply(once).code).toBe('SEQ_STALE'); // replay refused after restart
    expect(restarted.apply(cmd(B, 'release', 1)).code).toBe('SEQ_STALE');
  });

  test('E2: a command for another target, or with no target, is refused', () => {
    const ec = established();
    expect(ec.apply(cmd(A, 'stop', 5, { target: 'aigw-other' })).code).toBe('TARGET_MISMATCH');
    const noTarget = (() => {
      const payload = JSON.stringify({ action: 'stop', reason: 'r', seq: 6, commandId: 'cmd-no-target-0123456789', issuedAt: at() });
      return { payload, signature: crypto.sign(null, Buffer.from(payload), A.privateKey).toString('base64') };
    })();
    expect(ec.apply(noTarget).code).toBe('TARGET_MISMATCH');
    expect(ec.status().stopped).toBe(false);
  });

  test('E4: several active keys; revoked and unknown keys are refused; signer fingerprints are recorded', () => {
    established();
    const ec = make({ revoked: [fp(B)] });
    ec.load();
    expect(ec.apply(cmd(B, 'stop', 5)).code).toBe('KEY_REVOKED');
    expect(ec.apply(cmd(X, 'stop', 5)).code).toBe('SIGNATURE_INVALID');
    const c = cmd(A, 'stop', 5);
    expect(ec.apply({ payload: c.payload.replace('stop', 'release'), signature: c.signature }).code).toBe('SIGNATURE_INVALID');
    expect(ec.apply(c).ok).toBe(true);
    expect(store.readLog().map((e) => e.signer)).toEqual([fp(R), fp(A), fp(A)]);
  });

  test('malformed, stale and reasonless commands are refused without echoing input; apply needs load', () => {
    expect(make().apply(cmd(A, 'stop', 1)).code).toBe('NOT_LOADED');
    const ec = established();
    const raw = { payload: '{"action": FAKE_SECRET_VALUE}', signature: crypto.sign(null, Buffer.from('{"action": FAKE_SECRET_VALUE}'), A.privateKey).toString('base64') };
    expect(ec.apply(raw)).toEqual({ ok: false, code: 'COMMAND_MALFORMED' });
    expect(ec.apply(cmd(A, 'stop', 0)).code).toBe('COMMAND_MALFORMED');
    expect(ec.apply(cmd(A, 'stop', 5, { commandId: 'short' })).code).toBe('COMMAND_MALFORMED');
    expect(ec.apply(cmd(A, 'stop', 5, { reason: '  ' })).code).toBe('REASON_REQUIRED');
    expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: at() - 6 * 60_000 })).code).toBe('COMMAND_STALE');
    expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: at() + 6 * 60_000 })).code).toBe('COMMAND_STALE');
    expect(ec.apply(cmd(A, 'fly', 5)).code).toBe('COMMAND_MALFORMED');
  });

  test('fail closed: corrupt, unknown-version, wrong-target and inconsistent state; history cannot be reset by normal commands', () => {
    established();
    const stateFile = path.join(dir, 'emergency.json');
    const good = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const cases = [
      ['{corrupt', 'state_corrupt'],
      [JSON.stringify({ ...good, version: 1 }), 'state_unknown_version'],
      [JSON.stringify({ ...good, version: STATE_VERSION + 1 }), 'state_unknown_version'],
      [JSON.stringify({ ...good, stopped: 'no' }), 'state_corrupt'],
      [JSON.stringify({ ...good, target: 'aigw-other' }), 'state_target_mismatch'],
      [JSON.stringify({ ...good, logHead: { ...good.logHead, seq: good.logHead.seq - 1 } }), 'state_inconsistent'],
      [JSON.stringify({ ...good, lastSeq: { ...good.lastSeq, [fp(A)]: 0 } }), 'state_inconsistent'],
    ];
    for (const [text, condition] of cases) {
      fs.writeFileSync(stateFile, text);
      const ec = make();
      expect(ec.load()).toMatchObject({ readable: false, stopped: true, condition });
      expect(ec.apply(cmd(A, 'release', 99)).code).toBe('RECOVERY_REQUIRED');
      expect(ec.status().stopped).toBe(true);
    }
  });

  test('a broken log chain blocks recovery until the files are archived out of band', () => {
    established();
    const logFile = path.join(dir, 'emergency.log');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    const first = JSON.parse(lines[0]);
    first.reason = 'edited';
    fs.writeFileSync(logFile, `${[JSON.stringify(first), ...lines.slice(1)].join('\n')}\n`);
    const ec = make();
    expect(ec.load()).toMatchObject({ condition: 'log_corrupt', stopped: true, recovery: { possible: false } });
    expect(ec.recoveryChallenge()).toBeNull();
    expect(recover(ec, { challenge: 'a'.repeat(64) }).code).toBe('RECOVERY_BLOCKED');
    expect(ec.apply(cmd(A, 'release', 99)).code).toBe('RECOVERY_REQUIRED');
  });

  test('audit entries record target, command sequence, key fingerprint and command id; RECOVER also records challenge id and floors', () => {
    const ec = make();
    ec.load();
    const chId = ec.recoveryChallenge().challengeId;
    recover(ec, { seq: 1, fl: floors(2, 0, 0) });
    ec.apply(cmd(A, 'release', 3));
    ec.apply(cmd(B, 'stop', 1));
    const log = store.readLog();
    expect(verifyLogChain(log)).toEqual({ ok: true });
    expect(log[0]).toMatchObject({ action: 'recover', target: TARGET, commandSeq: 1, signer: fp(R), challengeId: chId, floors: floors(2, 0, 0), priorCondition: 'state_missing' });
    for (const e of log) {
      expect(e.target).toBe(TARGET);
      expect(Number.isSafeInteger(e.commandSeq)).toBe(true);
      expect(e.signer).toMatch(/^[0-9a-f]{16}$/);
      expect(e.commandId).toMatch(/^cmd-\d+-abcdef0123456789$/);
    }
    const tampered = log.map((e) => ({ ...e }));
    tampered[1].commandSeq = 99;
    expect(verifyLogChain(tampered)).toEqual({ ok: false, at: 1 });
    expect(verifyLogChain([log[0], log[2]])).toEqual({ ok: false, at: 1 });
  });

  test('durability: stop applies before it is persisted; a failed release persists nothing and stays stopped', () => {
    established();
    let failWrites = false;
    const flaky = {
      readState: () => store.readState(),
      readLog: () => store.readLog(),
      appendLog: (e) => store.appendLog(e),
      writeState: (d) => { if (failWrites) throw new Error('disk full'); store.writeState(d); },
    };
    const ec = createEmergencyControl({ store: flaky, verifier: keySet(), clock, targetId: TARGET });
    ec.load();
    failWrites = true;
    expect(ec.apply(cmd(A, 'stop', 5))).toMatchObject({ ok: true, stopped: true, persisted: false });
    expect(ec.status()).toMatchObject({ stopped: true, readable: false, condition: 'persist_failed' });
    expect(ec.apply(cmd(A, 'release', 6)).code).toBe('RECOVERY_REQUIRED');
    failWrites = false;
    expect(make().load()).toMatchObject({ stopped: true, readable: false, condition: 'state_inconsistent' });

    const ec2 = createEmergencyControl({ store: flaky, verifier: keySet(), clock, targetId: TARGET });
    ec2.load();
    expect(recover(ec2, { seq: 2, fl: floors(5, 0, 1) }).ok).toBe(true);
    failWrites = true;
    expect(ec2.apply(cmd(A, 'release', 6))).toMatchObject({ ok: false, code: 'RELEASE_NOT_PERSISTED' });
    expect(ec2.status().stopped).toBe(true);
  });

  test('a database Resume never clears a local Stop; a local release never clears a database Stop', () => {
    const ec = established();
    ec.apply(cmd(A, 'stop', 5));
    const dbReleased = { readable: true, state: 'RELEASED', version: 9, readAt: at(), pauses: {} };
    expect(effectiveState({ db: dbReleased, local: ec.status(), ack: { version: 9 }, now: at() })).toMatchObject({ effective: 'STOPPED', allowSubmissions: false });
    ec.apply(cmd(A, 'release', 6));
    expect(ec.status().stopped).toBe(false);
    const dbStopped = { readable: true, state: 'STOPPED', version: 10, readAt: at(), pauses: {} };
    expect(effectiveState({ db: dbStopped, local: ec.status(), ack: { version: 10 }, now: at() })).toMatchObject({ effective: 'STOPPED', allowSubmissions: false });
  });

  describe('cross-key ordering (a Release never undoes a newer Stop from another control key)', () => {
    const MIN = 60_000;
    const stateFile = () => path.join(dir, 'emergency.json');

    test('a delayed release from B after a newer Stop from A is refused, equal issuedAt included, and stays refused after restart', () => {
      const ec = established();
      const t0 = at();
      const delayedB = cmd(B, 'release', 1, { issuedAt: t0 + 1 * MIN });
      clock.set(t0 + 2 * MIN);
      expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 2 * MIN })).ok).toBe(true);
      clock.set(t0 + 3 * MIN); // B's release arrives late, still inside the skew window
      expect(ec.apply(delayedB)).toEqual({ ok: false, code: 'RELEASE_PREDATES_STOP' });
      expect(ec.status().stopped).toBe(true);
      expect(ec.apply(cmd(B, 'release', 2, { issuedAt: t0 + 2 * MIN })).code).toBe('RELEASE_PREDATES_STOP'); // a tie goes to Stop
      expect(JSON.parse(fs.readFileSync(stateFile(), 'utf8')).stopIssuedAt).toBe(t0 + 2 * MIN);

      const restarted = make();
      expect(restarted.load()).toMatchObject({ condition: 'ok', stopped: true });
      expect(restarted.apply(delayedB).code).toBe('RELEASE_PREDATES_STOP');
      expect(restarted.status().stopped).toBe(true);
      expect(restarted.apply(cmd(B, 'release', 3, { issuedAt: t0 + 2 * MIN + 1 })).ok).toBe(true); // a newer B release works
      expect(restarted.status().stopped).toBe(false);
      const log = store.readLog();
      expect(log[log.length - 1]).toMatchObject({ action: 'release', signer: fp(B), commandSeq: 3, issuedAt: t0 + 2 * MIN + 1 });
    });

    test('a delayed Stop older than the current release still stops and never lowers the stop floor', () => {
      const ec = established();
      const t0 = at();
      clock.set(t0 + 2 * MIN);
      expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 2 * MIN })).ok).toBe(true);
      expect(ec.apply(cmd(B, 'release', 1, { issuedAt: t0 + 3 * MIN })).ok).toBe(true);
      expect(ec.apply(cmd(B, 'stop', 2, { issuedAt: t0 + 1 * MIN })).ok).toBe(true); // older, delayed: fail safe
      expect(ec.status().stopped).toBe(true);
      expect(ec.apply(cmd(A, 'release', 6, { issuedAt: t0 + 2 * MIN - 1 })).code).toBe('RELEASE_PREDATES_STOP');
      expect(ec.apply(cmd(A, 'release', 7, { issuedAt: t0 + 2 * MIN + 1 })).ok).toBe(true);
    });

    test('RECOVER cannot weaken ordering: the stop floor is computed from the log and its own issuedAt, never from the floors it carries', () => {
      const ec = established();
      const t0 = at();
      const delayedB = cmd(B, 'release', 50, { issuedAt: t0 + 1 * MIN }); // seq far above any floor
      clock.set(t0 + 2 * MIN);
      expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 2 * MIN })).ok).toBe(true);
      fs.rmSync(stateFile());

      const lost = make();
      expect(lost.load()).toMatchObject({ condition: 'state_lost', stopped: true });
      expect(lost.recoveryChallenge().stopFloor).toBe(t0 + 2 * MIN);
      // A RECOVER signed before the stop, with B's sequence floor left at 0.
      expect(recover(lost, { seq: 2, fl: floors(5, 0, 1), issuedAt: t0 + 90_000 }).ok).toBe(true);
      expect(lost.apply(delayedB).code).toBe('RELEASE_PREDATES_STOP');
      expect(lost.apply(cmd(B, 'release', 51, { issuedAt: t0 + 100_000 })).code).toBe('RELEASE_PREDATES_STOP');
      const restarted = make();
      expect(restarted.load()).toMatchObject({ condition: 'ok', stopped: true });
      expect(restarted.apply(delayedB).code).toBe('RELEASE_PREDATES_STOP');
      expect(restarted.apply(cmd(B, 'release', 52, { issuedAt: t0 + 2 * MIN + 1 })).ok).toBe(true);
    });

    test('after RECOVER, any release issued before the RECOVER is refused even with a sequence above the floor', () => {
      const ec = make();
      ec.load();
      const t0 = at();
      const early = cmd(A, 'release', 9, { issuedAt: t0 });
      expect(recover(ec, { issuedAt: t0 + 1 }).ok).toBe(true);
      expect(ec.apply(early).code).toBe('RELEASE_PREDATES_STOP');
      expect(ec.apply(cmd(A, 'release', 10, { issuedAt: t0 + 1 })).code).toBe('RELEASE_PREDATES_STOP');
      expect(ec.apply(cmd(A, 'release', 11, { issuedAt: t0 + 2 })).ok).toBe(true);
    });

    test('a Stop refused while untrusted still raises the baseline the next RECOVER starts from', () => {
      established();
      fs.rmSync(stateFile());
      const lost = make();
      lost.load();
      const t0 = at();
      clock.set(t0 + 2 * MIN);
      expect(lost.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 2 * MIN })).code).toBe('RECOVERY_REQUIRED');
      expect(lost.recoveryChallenge().stopFloor).toBe(t0 + 2 * MIN);
      expect(recover(lost, { seq: 2, fl: floors(1, 0, 1), issuedAt: t0 + 1 * MIN }).ok).toBe(true);
      expect(lost.apply(cmd(B, 'release', 1, { issuedAt: t0 + 90_000 })).code).toBe('RELEASE_PREDATES_STOP');
      expect(lost.apply(cmd(B, 'release', 2, { issuedAt: t0 + 2 * MIN + 1 })).ok).toBe(true);
    });

    test('state whose stop floor is missing or below the log is untrusted, and recovery keeps the higher floor', () => {
      const ec = established();
      const t0 = at();
      expect(ec.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 1 * MIN })).ok).toBe(true);
      const good = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
      const { stopIssuedAt, ...noFloor } = good;
      expect(stopIssuedAt).toBe(t0 + 1 * MIN);
      fs.writeFileSync(stateFile(), JSON.stringify(noFloor));
      expect(make().load()).toMatchObject({ readable: false, stopped: true, condition: 'state_corrupt' });
      fs.writeFileSync(stateFile(), JSON.stringify({ ...good, stopIssuedAt: t0 }));
      const lowered = make();
      expect(lowered.load()).toMatchObject({ readable: false, stopped: true, condition: 'state_inconsistent' });
      expect(lowered.recoveryChallenge().stopFloor).toBe(t0 + 1 * MIN);
      fs.writeFileSync(stateFile(), JSON.stringify({ ...good, stopIssuedAt: t0 + 4 * MIN })); // a higher floor only restricts further
      const raised = make();
      expect(raised.load()).toMatchObject({ condition: 'ok', stopped: true });
      expect(raised.apply(cmd(B, 'release', 1, { issuedAt: t0 + 3 * MIN })).code).toBe('RELEASE_PREDATES_STOP');
    });

    test('rotation and revocation: a revoked B is refused, a new key C is ordered by the same stop floor', () => {
      const C = gen();
      established();
      const t0 = at();
      clock.set(t0 + 2 * MIN);
      const before = createEmergencyControl({ store, verifier: keySet(), clock, targetId: TARGET });
      before.load();
      expect(before.apply(cmd(A, 'stop', 5, { issuedAt: t0 + 2 * MIN })).ok).toBe(true);
      const rotated = createEmergencyControl({
        store,
        verifier: createEd25519KeySet([
          { publicKeyPem: A.pem, roles: ['control'] },
          { publicKeyPem: B.pem, roles: ['control'] },
          { publicKeyPem: C.pem, roles: ['control'] },
          { publicKeyPem: R.pem, roles: ['recover'] },
        ], { revoked: [fp(B)] }),
        clock,
        targetId: TARGET,
      });
      expect(rotated.load()).toMatchObject({ condition: 'ok', stopped: true });
      expect(rotated.apply(cmd(B, 'release', 9, { issuedAt: t0 + 3 * MIN })).code).toBe('KEY_REVOKED');
      expect(rotated.apply(cmd(C, 'release', 1, { issuedAt: t0 + 1 * MIN })).code).toBe('RELEASE_PREDATES_STOP');
      expect(rotated.apply(cmd(C, 'release', 2, { issuedAt: t0 + 2 * MIN + 1 })).ok).toBe(true);
      expect(rotated.status().stopped).toBe(false);
      expect(rotated.apply(cmd(A, 'stop', 6)).ok).toBe(true); // emergency Stop by the other key still works
      expect(rotated.status().stopped).toBe(true);
    });
  });
});
