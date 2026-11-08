'use strict';

const { exposureOf, checkAuthorization } = require('../../../src/aiGateway/budget');
const { createReferenceLedger } = require('../../../src/aiGateway/memoryLedger');
const { makeClock, makeRng, microYield, makeSafety, anthropicCall, deterministicBytes } = require('./_harness');

const CAPS = { dailyMicros: 7_000, imageDailyMicros: 1_000_000 };

describe('three-amount accounting', () => {
  test('reserved, confirmed and uncertain are tracked separately; exposure is their sum', () => {
    const rows = [
      { phase: 'authorized', estimateMicros: 10 },
      { phase: 'dispatching', estimateMicros: 20 },
      { phase: 'accepted', estimateMicros: 30 },
      { phase: 'succeeded', billed: 'yes', estimateMicros: 40, confirmedMicros: 35 },
      { phase: 'failed_confirmed', billed: 'no', estimateMicros: 50 },
      { phase: 'unknown', estimateMicros: 60 },
      { phase: 'abandoned', billed: 'unknown', estimateMicros: 70 },
      { phase: 'not_sent', estimateMicros: 80 },
    ];
    expect(exposureOf(rows)).toEqual({ reserved: 60, confirmed: 35, uncertain: 130, exposure: 225 });
  });

  test('randomized settlements: exposure always equals reserved + confirmed + uncertain; uncertain never drops by age', () => {
    const rng = makeRng(42);
    const phases = ['authorized', 'dispatching', 'accepted', 'provider_succeeded', 'succeeded', 'failed_confirmed', 'unknown', 'not_sent', 'abandoned'];
    for (let i = 0; i < 500; i += 1) {
      const rows = Array.from({ length: 20 }, () => ({
        phase: phases[Math.floor(rng() * phases.length)],
        billed: ['yes', 'no', 'unknown'][Math.floor(rng() * 3)],
        estimateMicros: Math.floor(rng() * 1000),
        confirmedMicros: Math.floor(rng() * 1000),
      }));
      const e = exposureOf(rows);
      expect(e.exposure).toBe(e.reserved + e.confirmed + e.uncertain);
      const unknownSum = rows.filter((r) => r.phase === 'unknown').reduce((a, r) => a + r.estimateMicros, 0);
      expect(e.uncertain).toBeGreaterThanOrEqual(unknownSum);
    }
  });
});

describe('authorization decision', () => {
  test('strict work needs a verified price; time-billed units need a maximum', () => {
    const base = { estimateMicros: 1, strict: true, caps: CAPS, service: 'writing' };
    expect(checkAuthorization({ ...base, price: null }).code).toBe('PRICE_NOT_VERIFIED');
    expect(checkAuthorization({ ...base, price: { status: 'provisional_owner' } }).code).toBe('PRICE_NOT_VERIFIED');
    expect(checkAuthorization({ ...base, price: { status: 'unpriced' } }).code).toBe('PRICE_NOT_VERIFIED');
    expect(checkAuthorization({ ...base, price: { status: 'verified_primary_doc', unit: 'gpu_second' } }).code).toBe('PRICE_NO_MAX_UNITS');
    expect(checkAuthorization({ ...base, price: { status: 'verified_primary_doc', unit: 'gpu_second', maxUnitsPerRequest: 60 } }).ok).toBe(true);
    expect(checkAuthorization({ ...base, estimateMicros: null, price: { status: 'verified_billing_export', unit: 'output_token' } }).code).toBe('ESTIMATE_REQUIRED');
  });
  test('non-strict unpriced work is allowed but flagged; caps use exposure; missing caps fail closed', () => {
    expect(checkAuthorization({ estimateMicros: null, strict: false, caps: CAPS, service: 'writing' })).toEqual({ ok: true, unpriced: true });
    expect(checkAuthorization({ estimateMicros: 2, dayExposureMicros: 6_999, caps: CAPS }).code).toBe('DAILY_CAP');
    expect(checkAuthorization({ estimateMicros: 2, imageDayExposureMicros: 999_999, caps: CAPS, service: 'images' }).code).toBe('IMAGE_DAILY_CAP');
    expect(checkAuthorization({ estimateMicros: 1, caps: {} }).code).toBe('CAP_UNAVAILABLE');
    expect(checkAuthorization({ estimateMicros: -1, caps: CAPS }).code).toBe('ESTIMATE_INVALID');
  });
});

describe('daily cap under concurrency (reference ledger)', () => {
  test.each([1, 2, 3, 4, 5])('20 concurrent authorizations against a cap that fits 7 admit exactly 7 (seed %i)', async (seed) => {
    const clock = makeClock();
    const safety = makeSafety(clock);
    safety.ackVersion = () => safety.db.version;
    const rng = makeRng(seed);
    const ledger = createReferenceLedger({
      clock, caps: CAPS, readSafety: safety.read, randomBytes: deterministicBytes(seed),
      yieldFn: () => microYield(Math.floor(rng() * 5)),
    });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => ledger.authorize(anthropicCall({ logicalKey: `k${i}`, estimateMicros: 1000 }).authorizeInput)));
    expect(results.filter((r) => r.ok)).toHaveLength(7);
    expect(results.filter((r) => !r.ok).every((r) => r.code === 'DAILY_CAP')).toBe(true);
    expect(ledger.exposure({ day: '2026-11-07' }).reserved).toBe(7000);
  });
});
