'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEmergencyControl, verifyLogChain } = require('../../../src/aiGateway/emergencyControl');
const { createEd25519Verifier } = require('../../../src/aiGateway/signature');
const { createFsEmergencyStore } = require('../../../src/aiGateway/fsStores');
const { effectiveState } = require('../../../src/aiGateway/stopState');
const { makeClock } = require('./_harness');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
const other = crypto.generateKeyPairSync('ed25519');

let nonceN = 0;
function command(action, { at, key = privateKey, reason = 'test reason', nonce } = {}) {
  const payload = JSON.stringify({ action, reason, issuedAt: at, nonce: nonce || `nonce-${(nonceN += 1)}-${'x'.repeat(16)}` });
  return { payload, signature: crypto.sign(null, Buffer.from(payload), key).toString('base64') };
}

describe('local emergency control', () => {
  let dir;
  let clock;
  let store;
  const make = () => createEmergencyControl({ store, verifier: createEd25519Verifier(pubPem), clock });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigw-emerg-'));
    clock = makeClock();
    store = createFsEmergencyStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('boot: no state file means not stopped; a signed stop stops and survives a restart', () => {
    const ec = make();
    expect(ec.load()).toMatchObject({ readable: true, stopped: false });
    expect(ec.apply(command('stop', { at: clock.now() }))).toMatchObject({ ok: true, stopped: true, persisted: true });
    const again = make();
    expect(again.load()).toMatchObject({ readable: true, stopped: true, reason: 'test reason' });
  });

  test('release: signed, persisted, survives a restart', () => {
    const ec = make();
    ec.load();
    ec.apply(command('stop', { at: clock.now() }));
    expect(ec.apply(command('release', { at: clock.now() }))).toMatchObject({ ok: true, stopped: false });
    expect(make().load()).toMatchObject({ stopped: false });
  });

  test('refused: wrong key, tampered payload, stale or future command, replayed nonce, no reason', () => {
    const ec = make();
    ec.load();
    expect(ec.apply(command('stop', { at: clock.now(), key: other.privateKey })).code).toBe('SIGNATURE_INVALID');
    const c = command('stop', { at: clock.now() });
    expect(ec.apply({ payload: c.payload.replace('stop', 'release'), signature: c.signature }).code).toBe('SIGNATURE_INVALID');
    expect(ec.apply(command('stop', { at: clock.now() - 6 * 60_000 })).code).toBe('COMMAND_STALE');
    expect(ec.apply(command('stop', { at: clock.now() + 6 * 60_000 })).code).toBe('COMMAND_STALE');
    expect(ec.apply(command('stop', { at: clock.now(), reason: '  ' })).code).toBe('REASON_REQUIRED');
    const once = command('stop', { at: clock.now() });
    expect(ec.apply(once).ok).toBe(true);
    expect(ec.apply(once).code).toBe('NONCE_REPLAYED');
    // a replay is refused after a restart too
    const restarted = make();
    restarted.load();
    expect(restarted.apply(once).code).toBe('NONCE_REPLAYED');
  });

  test('a corrupt or unreadable state file means stopped (fail closed)', () => {
    fs.writeFileSync(path.join(dir, 'emergency.json'), '{corrupt');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(make().load()).toMatchObject({ readable: false, stopped: true });
    fs.writeFileSync(path.join(dir, 'emergency.json'), JSON.stringify({ stopped: 'no' }));
    expect(make().load()).toMatchObject({ readable: false, stopped: true });
    errSpy.mockRestore();
  });

  test('stop takes effect before it is persisted; release only after', () => {
    const failing = { readState: () => ({ exists: false }), writeState: () => { throw new Error('disk full'); }, appendLog: () => {}, readLog: () => [] };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ec = createEmergencyControl({ store: failing, verifier: createEd25519Verifier(pubPem), clock });
    ec.load();
    expect(ec.apply(command('stop', { at: clock.now() }))).toMatchObject({ ok: true, stopped: true, persisted: false });
    expect(ec.status().stopped).toBe(true);
    expect(ec.apply(command('release', { at: clock.now() }))).toMatchObject({ ok: false, code: 'RELEASE_NOT_PERSISTED' });
    expect(ec.status().stopped).toBe(true); // still stopped
    errSpy.mockRestore();
  });

  test('the audit log is hash-chained; any edit is detected', () => {
    const ec = make();
    ec.load();
    ec.apply(command('stop', { at: clock.now() }));
    ec.apply(command('release', { at: clock.now() }));
    ec.apply(command('stop', { at: clock.now() }));
    const log = store.readLog();
    expect(log).toHaveLength(3);
    expect(verifyLogChain(log)).toEqual({ ok: true });
    const tampered = log.map((e) => ({ ...e }));
    tampered[1].reason = 'edited';
    expect(verifyLogChain(tampered)).toEqual({ ok: false, at: 1 });
    expect(verifyLogChain([log[0], log[2]])).toEqual({ ok: false, at: 1 }); // a deleted entry
    expect(log.every((e) => typeof e.signer === 'string' && e.signer.length === 16)).toBe(true);
  });

  test('a database Resume cannot clear an active local stop', () => {
    const ec = make();
    ec.load();
    ec.apply(command('stop', { at: clock.now() }));
    const db = { readable: true, state: 'RELEASED', version: 9, readAt: clock.now(), pauses: {} };
    const r = effectiveState({ db, local: ec.status(), ack: { version: 9 }, now: clock.now() });
    expect(r.effective).toBe('STOPPED');
    expect(r.allowSubmissions).toBe(false);
  });
});
