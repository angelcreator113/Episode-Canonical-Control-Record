'use strict';

/**
 * One behavioural contract for both ledgers (not a test file itself):
 *   - the in-memory reference ledger (tests/unit/aiGateway/memoryLedgerConformance.test.js)
 *   - the Postgres ledger (tests/integration/aigwLedger.integration.test.js)
 *
 * makeEnv() returns a fresh, isolated ledger whose Stop state starts STOPPED
 * with no caps (the migration's seed), and:
 *   { ledger, release(), stop(), setCaps({ dailyMicros, imageDailyMicros }),
 *     expire()         time passes beyond the 1 s permit TTL and 1 s submission timeout
 *     reconcile(id, { to, method, evidence, billed, confirmedMicros, reason, actor }),
 *     close() }
 */

const { anthropicCall, DAY } = require('./_harness');

const OP = { operation: 'anthropic.messages' };
const multipartInput = ({ logicalKey = 'mp-1', strict = false, estimateMicros = 100 } = {}) => ({
  callerClass: 'worker',
  callerInstance: 'host-w:7:boot1',
  provider: 'removebg',
  operation: 'removebg',
  model: 'removebg',
  job: { type: 'test', id: logicalKey, logicalKey, attempt: 1 },
  reservation: { estimateMicros, day: DAY, strict },
  body: { sha256: 'a'.repeat(64), bytes: 1234 },
  billingHeaders: {},
});

function defineLedgerConformance(label, makeEnv, { timeout = 30000 } = {}) {
  describe(`ledger conformance: ${label}`, () => {
    let env;
    beforeEach(async () => { env = await makeEnv(); }, timeout);
    afterEach(async () => { if (env) await env.close(); }, timeout);

    const ready = async (caps = { dailyMicros: 1_000_000, imageDailyMicros: 1_000_000 }) => {
      await env.setCaps(caps);
      await env.release();
    };
    const authorize = (opts) => env.ledger.authorize(anthropicCall(opts).authorizeInput);

    test('fails closed from the seed: STOPPED; once released, missing caps refuse', async () => {
      expect((await authorize()).code).toBe('STOPPED');
      await env.release();
      expect((await authorize()).code).toBe('CAP_UNAVAILABLE');
      await env.setCaps({ dailyMicros: 1000, imageDailyMicros: null });
      expect((await authorize({ estimateMicros: 10 })).ok).toBe(true);
      // an images operation needs the image cap too
      expect((await env.ledger.authorize(multipartInput())).code).toBe('CAP_UNAVAILABLE');
    }, timeout);

    test('strict work is refused (no verified price); strict multipart is refused for its unverified fields', async () => {
      await ready();
      expect((await authorize({ strict: true })).code).toBe('PRICE_NOT_VERIFIED');
      expect((await env.ledger.authorize(multipartInput({ strict: true }))).code).toBe('MULTIPART_FIELDS_UNVERIFIED');
      const m = await env.ledger.authorize(multipartInput());
      expect(m.ok).toBe(true);
      expect(m.permit.billingFields).toBeNull();
    }, timeout);

    test('unpriced non-strict work reserves nothing but is recorded as unpriced', async () => {
      await ready();
      const a = await authorize({ estimateMicros: null });
      expect(a.ok).toBe(true);
      expect(a.permit.reservation.unpriced).toBe(true);
      expect((await env.ledger.exposure({ day: DAY })).exposure).toBe(0);
    }, timeout);

    test('the daily cap counts exposure, not a counter', async () => {
      await ready({ dailyMicros: 1000, imageDailyMicros: 1000 });
      const a = await authorize({ logicalKey: 'k1', estimateMicros: 600 });
      expect(a.ok).toBe(true);
      expect((await authorize({ logicalKey: 'k2', estimateMicros: 600 })).code).toBe('DAILY_CAP');
      expect((await env.ledger.exposure({ day: DAY })).reserved).toBe(600);
      // released when it is provably not sent
      await env.ledger.markNotSent(a.permit.id, 'caller_gave_up');
      expect((await authorize({ logicalKey: 'k2', estimateMicros: 600 })).ok).toBe(true);
    }, timeout);

    test('single use: one dispatch; the same permit is never sent again; operation must match', async () => {
      await ready();
      const a = await authorize();
      expect((await env.ledger.dispatch(a.permit.id, { operation: 'openai.images.generations' })).code).toBe('OPERATION_MISMATCH');
      expect((await env.ledger.dispatch(a.permit.id, OP)).ok).toBe(true);
      expect((await env.ledger.dispatch(a.permit.id, OP)).code).toBe('PERMIT_USED');
      expect((await env.ledger.getPermit(a.permit.id)).phase).toBe('dispatching');
    }, timeout);

    test('a Stop between authorize and dispatch refuses the dispatch and releases the reservation', async () => {
      await ready();
      const a = await authorize({ estimateMicros: 700 });
      await env.stop();
      expect((await env.ledger.dispatch(a.permit.id, OP)).code).toBe('STOPPED');
      expect((await env.ledger.getPermit(a.permit.id)).phase).toBe('not_sent');
      expect((await env.ledger.exposure({ day: DAY })).exposure).toBe(0);
    }, timeout);

    test('an expired permit is refused at dispatch', async () => {
      await ready();
      const a = await authorize();
      await env.expire();
      expect((await env.ledger.dispatch(a.permit.id, OP)).code).toBe('PERMIT_EXPIRED');
      expect((await env.ledger.getPermit(a.permit.id)).phase).toBe('not_sent');
    }, timeout);

    test('a dispatched request becomes not_sent only with proof it never left', async () => {
      await ready();
      const a = await authorize();
      await env.ledger.dispatch(a.permit.id, OP);
      await expect(env.ledger.markNotSent(a.permit.id, 'guess')).rejects.toMatchObject({ code: 'NOT_SENT_REQUIRES_PROOF' });
      await expect(env.ledger.recordOutcome(a.permit.id, { phase: 'not_sent' })).rejects.toMatchObject({ code: 'NOT_SENT_REQUIRES_PROOF' });
      expect((await env.ledger.markNotSent(a.permit.id, 'STOPPED_BEFORE_FORWARD', { provenNotForwarded: true })).ok).toBe(true);
      expect((await env.ledger.getPermit(a.permit.id)).phase).toBe('not_sent');
    }, timeout);

    test('unknown keeps its exposure; it leaves unknown only by reconciliation with evidence', async () => {
      await ready();
      const a = await authorize({ logicalKey: 'u', estimateMicros: 500 });
      await env.ledger.dispatch(a.permit.id, OP);
      await env.ledger.recordOutcome(a.permit.id, { phase: 'unknown' });
      expect((await env.ledger.exposure({ day: DAY })).uncertain).toBe(500);
      await expect(env.ledger.recordOutcome(a.permit.id, { phase: 'failed_confirmed' })).rejects.toMatchObject({ code: 'UNKNOWN_REQUIRES_RECONCILIATION' });
      expect((await authorize({ logicalKey: 'u', attempt: 2 })).code).toBe('PRIOR_ATTEMPT_UNKNOWN');
      const evidence = { provider_status: 'failed', checked_at: '2026-11-08T00:00:00Z' };
      expect((await env.reconcile(a.permit.id, { to: 'failed_confirmed', method: 'provider_status_read', evidence: {}, billed: 'no', reason: 'r', actor: 'evoni' })).code).toBe('EVIDENCE_REQUIRED');
      expect((await env.reconcile(a.permit.id, { to: 'failed_confirmed', method: 'provider_status_read', evidence, billed: 'no', reason: 'provider says failed', actor: 'evoni' })).ok).toBe(true);
      expect((await env.ledger.exposure({ day: DAY })).exposure).toBe(0);
      expect((await authorize({ logicalKey: 'u', attempt: 2 })).ok).toBe(true);
    }, timeout);

    test('a new attempt only after not_sent or failed_confirmed; never a second permit for the same attempt', async () => {
      await ready();
      const a = await authorize({ logicalKey: 'r' });
      expect((await authorize({ logicalKey: 'r', attempt: 1 })).code).toBe('ATTEMPT_EXISTS');
      expect((await authorize({ logicalKey: 'r', attempt: 2 })).code).toBe('PRIOR_ATTEMPT_NOT_RETRYABLE'); // still authorized
      await env.ledger.dispatch(a.permit.id, OP);
      await env.ledger.recordOutcome(a.permit.id, { phase: 'accepted', taskId: 'task-r' });
      expect((await authorize({ logicalKey: 'r', attempt: 2 })).code).toBe('PRIOR_ATTEMPT_NOT_RETRYABLE');
      expect(await env.ledger.findByTaskRef('anthropic', 'task-r')).toMatchObject({ id: a.permit.id, phase: 'accepted' });
      await env.ledger.recordOutcome(a.permit.id, { phase: 'failed_confirmed', billed: 'no' });
      expect((await authorize({ logicalKey: 'r', attempt: 2 })).ok).toBe(true);
    }, timeout);

    test('illegal transitions are refused', async () => {
      await ready();
      const a = await authorize();
      await expect(env.ledger.recordOutcome(a.permit.id, { phase: 'succeeded' })).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION_authorized_TO_succeeded' });
      await env.ledger.dispatch(a.permit.id, OP);
      await env.ledger.recordOutcome(a.permit.id, { phase: 'succeeded', billed: 'yes', confirmedMicros: 900 });
      await expect(env.ledger.recordOutcome(a.permit.id, { phase: 'unknown' })).rejects.toMatchObject({ code: expect.stringMatching(/^ILLEGAL_TRANSITION_succeeded/) });
      expect((await env.ledger.exposure({ day: DAY })).confirmed).toBe(900);
    }, timeout);

    test('sweep: expired unused permits become not_sent; stale dispatched ones become unknown, never not_sent', async () => {
      await ready();
      const unused = await authorize({ logicalKey: 's1' });
      const sent = await authorize({ logicalKey: 's2', estimateMicros: 300 });
      await env.ledger.dispatch(sent.permit.id, OP);
      await env.expire();
      await env.ledger.sweep({ submissionTimeoutMs: 1000 });
      expect((await env.ledger.getPermit(unused.permit.id)).phase).toBe('not_sent');
      expect((await env.ledger.getPermit(sent.permit.id)).phase).toBe('unknown');
      expect((await env.ledger.exposure({ day: DAY })).uncertain).toBe(300);
      // and a stale dispatched request is never safe to retry
      expect((await authorize({ logicalKey: 's2', attempt: 2 })).code).toBe('PRIOR_ATTEMPT_UNKNOWN');
    }, timeout);

    test('getPermit returns the exact bound permit; unknown ids return null', async () => {
      await ready();
      const a = await authorize();
      expect((await env.ledger.getPermit(a.permit.id)).permit).toEqual(a.permit);
      expect(await env.ledger.getPermit('00000000-0000-4000-8000-000000000000')).toBeNull();
    }, timeout);
  });
}

module.exports = { defineLedgerConformance, multipartInput };
