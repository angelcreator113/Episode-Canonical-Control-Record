'use strict';

const { createReferenceLedger } = require('../../../src/aiGateway/memoryLedger');
const { makeClock, makeRng, microYield, makeSafety, anthropicCall, deterministicBytes } = require('./_harness');

function setup({ yieldFn } = {}) {
  const clock = makeClock();
  const safety = makeSafety(clock);
  safety.ackVersion = () => safety.db.version;
  const ledger = createReferenceLedger({
    clock, caps: { dailyMicros: 1e12, imageDailyMicros: 1e12 }, readSafety: safety.read,
    randomBytes: deterministicBytes(3), yieldFn,
  });
  return { clock, safety, ledger };
}

describe('reference ledger (non-production)', () => {
  test('authorize refuses under Stop and when a prior attempt of the same logical request is unknown', async () => {
    const { ledger, safety } = setup();
    safety.stopDb();
    expect((await ledger.authorize(anthropicCall().authorizeInput)).code).toBe('STOPPED');
    safety.releaseDb();
    const a = await ledger.authorize(anthropicCall({ logicalKey: 'L' }).authorizeInput);
    await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' });
    await ledger.recordOutcome(a.permit.id, { phase: 'unknown' });
    expect((await ledger.authorize(anthropicCall({ logicalKey: 'L', attempt: 2 }).authorizeInput)).code).toBe('PRIOR_ATTEMPT_UNKNOWN');
  });

  test('a permit is single use even under concurrent dispatch', async () => {
    const rng = makeRng(9);
    const { ledger } = setup({ yieldFn: () => microYield(Math.floor(rng() * 4)) });
    const a = await ledger.authorize(anthropicCall().authorizeInput);
    const results = await Promise.all(Array.from({ length: 10 }, () => ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => r.code === 'PERMIT_USED')).toBe(true);
  });

  test('an expired permit cannot dispatch and becomes not_sent; a mismatched operation is refused', async () => {
    const { ledger, clock } = setup();
    const a = await ledger.authorize(anthropicCall().authorizeInput);
    expect((await ledger.dispatch(a.permit.id, { operation: 'openai.images.generations' })).code).toBe('OPERATION_MISMATCH');
    clock.advance(30_000);
    expect((await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })).code).toBe('PERMIT_EXPIRED');
    expect(ledger.rows()[0].phase).toBe('not_sent');
  });

  test('Stop between authorize and dispatch: dispatch refused, row not_sent (never sent)', async () => {
    const { ledger, safety } = setup();
    const a = await ledger.authorize(anthropicCall().authorizeInput);
    safety.stopDb();
    expect((await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })).code).toBe('STOPPED');
    expect(ledger.rows()[0].phase).toBe('not_sent');
  });

  test('a dispatched request can never become not_sent by age, Stop or an unproven claim', async () => {
    const { ledger, clock, safety } = setup();
    const a = await ledger.authorize(anthropicCall().authorizeInput);
    await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' });
    await expect(ledger.markNotSent(a.permit.id, 'nope')).rejects.toMatchObject({ code: 'NOT_SENT_REQUIRES_PROOF' });
    await expect(ledger.recordOutcome(a.permit.id, { phase: 'not_sent' })).rejects.toMatchObject({ code: 'NOT_SENT_REQUIRES_PROOF' });
    safety.stopDb();
    clock.advance(10 * 60_000);
    await ledger.sweep({ submissionTimeoutMs: 60_000 });
    expect(ledger.rows()[0].phase).toBe('unknown');
  });

  test('sweep: an expired, never-dispatched permit becomes not_sent', async () => {
    const { ledger, clock } = setup();
    await ledger.authorize(anthropicCall().authorizeInput);
    clock.advance(31_000);
    await ledger.sweep({ submissionTimeoutMs: 60_000 });
    expect(ledger.rows()[0].phase).toBe('not_sent');
  });

  test('unknown keeps its exposure until reconciled with evidence; terminal phases are final', async () => {
    const { ledger } = setup();
    const a = await ledger.authorize(anthropicCall({ estimateMicros: 500 }).authorizeInput);
    await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' });
    await ledger.recordOutcome(a.permit.id, { phase: 'unknown' });
    expect(ledger.exposure().uncertain).toBe(500);
    expect((await ledger.reconcile(a.permit.id, { to: 'succeeded', evidence: {} })).code).toBe('EVIDENCE_REQUIRED');
    await ledger.reconcile(a.permit.id, { to: 'succeeded', evidence: { invoice: 'line 7' }, billed: 'yes', confirmedMicros: 420 });
    expect(ledger.exposure()).toMatchObject({ uncertain: 0, confirmed: 420 });
    await expect(ledger.recordOutcome(a.permit.id, { phase: 'unknown' })).rejects.toMatchObject({ code: expect.stringMatching(/^ILLEGAL_TRANSITION/) });
  });

  test('events are append-only copies', async () => {
    const { ledger } = setup();
    await ledger.authorize(anthropicCall().authorizeInput);
    const ev = ledger.events();
    ev.push({ fake: true });
    expect(ledger.events()).toHaveLength(1);
    expect(Object.isFrozen(ledger.events()[0])).toBe(true);
  });
});
