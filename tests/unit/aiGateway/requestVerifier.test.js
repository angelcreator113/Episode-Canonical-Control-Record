'use strict';

const { verifyAgainstPermit } = require('../../../src/aiGateway/requestVerifier');
const { buildPermit, issuePermitSecret } = require('../../../src/aiGateway/permit');
const { sha256Hex } = require('../../../src/aiGateway/canonical');
const { anthropicCall, anthropicJson, deterministicBytes, T0 } = require('./_harness');

function setup(opts = {}) {
  const call = anthropicCall(opts);
  const { secret, secretHash } = issuePermitSecret(deterministicBytes(7));
  const permit = buildPermit({ ...call.authorizeInput, id: 'p1', secretHash, expiresAt: T0 + 30_000 });
  const req = (over = {}) => ({
    ...call.request(permit, secret),
    body: { sha256: sha256Hex(call.raw), bytes: call.raw.length, json: JSON.parse(call.raw.toString()) },
    ...over,
  });
  return { permit, secret, req, call };
}

describe('verifyAgainstPermit', () => {
  test('the exact authorized request passes; auth and gateway headers are not forwarded', () => {
    const { permit, req } = setup();
    const r = verifyAgainstPermit(permit, req({ headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': 'dummy', 'x-aigw-permit': 'p1' } }), { now: T0 });
    expect(r.ok).toBe(true);
    expect(r.operation.id).toBe('anthropic.messages');
    expect(r.forwardHeaders).toEqual({ 'content-type': 'application/json', 'anthropic-version': '2023-06-01' });
  });

  test('expired permit, missing clock, wrong secret, wrong caller socket', () => {
    const { permit, req, secret } = setup();
    expect(verifyAgainstPermit(permit, req(), { now: T0 + 30_000 }).code).toBe('PERMIT_EXPIRED');
    expect(verifyAgainstPermit(permit, req(), {}).code).toBe('CLOCK_UNAVAILABLE');
    const flipped = secret.slice(0, -1) + (secret.endsWith('0') ? '1' : '0');
    expect(verifyAgainstPermit(permit, req({ secret: flipped }), { now: T0 }).code).toBe('PERMIT_SECRET_MISMATCH');
    expect(verifyAgainstPermit(permit, req({ callerClass: 'script' }), { now: T0 }).code).toBe('CALLER_MISMATCH');
    expect(verifyAgainstPermit(null, req(), { now: T0 }).code).toBe('PERMIT_UNKNOWN');
  });

  test('a permit for one operation never authorizes another', () => {
    const { permit, req } = setup();
    expect(verifyAgainstPermit(permit, req({ host: 'api.openai.com', path: '/v1/images/generations' }), { now: T0 }).code).toBe('OPERATION_MISMATCH');
    expect(verifyAgainstPermit(permit, req({ method: 'GET', host: 'api.dev.runwayml.com', path: '/v1/tasks/x' }), { now: T0 }).code).toBe('NOT_A_SUBMISSION');
    expect(verifyAgainstPermit(permit, req({ path: '/v1/messages/count_tokens' }), { now: T0 }).code).toBe('NOT_ALLOWLISTED');
  });

  test('every single-byte change of the body is refused', () => {
    const { permit, req, call } = setup();
    for (let i = 0; i < call.raw.length; i += 1) {
      const changed = Buffer.from(call.raw);
      changed[i] ^= 0x01;
      const r = verifyAgainstPermit(permit, req({ body: { sha256: sha256Hex(changed), bytes: changed.length, json: {} } }), { now: T0 });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('BODY_HASH_MISMATCH');
    }
    expect(verifyAgainstPermit(permit, req({ body: { sha256: sha256Hex(call.raw), bytes: call.raw.length + 1, json: {} } }), { now: T0 }).code).toBe('BODY_LENGTH_MISMATCH');
  });

  test.each([
    ['model', { model: 'claude-sonnet-4-6' }, 'MODEL_MISMATCH'],
    ['max_tokens', { max_tokens: 257 }, 'BILLING_FIELDS_MISMATCH'],
    ['stream', { stream: true }, 'BILLING_FIELDS_MISMATCH'],
    ['service tier', { service_tier: 'priority' }, 'BILLING_FIELDS_MISMATCH'],
    ['a 1h cache TTL', { system: [{ type: 'text', text: 's', cache_control: { type: 'ephemeral', ttl: '1h' } }] }, 'BILLING_FIELDS_MISMATCH'],
  ])('a changed %s is refused even with a matching hash', (_l, change, code) => {
    // The attacker hashes their own body: hash and length match, billing fields do not.
    const { permit, req } = setup();
    const json = anthropicJson(change);
    const raw = Buffer.from(JSON.stringify(json));
    const forged = { ...permit, body: { sha256: sha256Hex(raw), bytes: raw.length } };
    expect(verifyAgainstPermit(forged, req({ body: { sha256: sha256Hex(raw), bytes: raw.length, json } }), { now: T0 }).code).toBe(code);
  });

  test('billing headers must equal the permit: an added beta, a changed version, a missing version', () => {
    const { permit, req } = setup();
    const base = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
    expect(verifyAgainstPermit(permit, req({ headers: { ...base, 'anthropic-beta': 'fast-mode-2026-02-01' } }), { now: T0 }).code).toBe('BILLING_HEADER_MISMATCH');
    expect(verifyAgainstPermit(permit, req({ headers: { ...base, 'anthropic-version': '2099-01-01' } }), { now: T0 }).code).toBe('BILLING_HEADER_MISMATCH');
    expect(verifyAgainstPermit(permit, req({ headers: { 'content-type': 'application/json' } }), { now: T0 }).code).toBe('BILLING_HEADER_MISMATCH');
    expect(verifyAgainstPermit(permit, req({ headers: { ...base, 'x-forwarded-host': 'x' } }), { now: T0 }).code).toBe('HEADER_NOT_ALLOWED');
  });

  test('buildPermit refuses a permit that does not bind every characteristic', () => {
    const { call } = setup();
    const { secretHash } = issuePermitSecret(deterministicBytes(9));
    const good = { ...call.authorizeInput, id: 'p2', secretHash, expiresAt: T0 + 1 };
    expect(() => buildPermit(good)).not.toThrow();
    for (const drop of ['callerClass', 'callerInstance', 'model', 'job', 'reservation', 'body', 'billingFields', 'expiresAt']) {
      const bad = { ...good };
      delete bad[drop];
      expect(() => buildPermit(bad)).toThrow(/permit field/);
    }
    expect(() => buildPermit({ ...good, operation: 'runway.task_status', provider: 'runway' })).toThrow(/operation/);
    expect(() => buildPermit({ ...good, provider: 'openai' })).toThrow(/provider/);
  });
});
