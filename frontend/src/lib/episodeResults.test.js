import { describe, test, expect } from 'vitest';
import { howItWent, moneyRows, statRows, shareState, evaluationOf, signedCoins } from './episodeResults';

describe('episodeResults', () => {
  test('how it went: designed, then the actual tier once evaluated', () => {
    expect(howItWent({ brief: { designed_intent: 'pass' } })).toMatchObject({ designed: 'Pass', actual: null, done: false });
    expect(howItWent({ brief: { designed_intent: 'pass' }, evaluation: { tier_final: 'slay', score: 91 } })).toMatchObject({ actual: 'Slay', score: 91, done: true });
    expect(evaluationOf({ evaluation_json: '{"tier_final":"fail"}' }).tier_final).toBe('fail');
  });

  test('money rows say what each line is, and the net is an estimate until posted', () => {
    const m = moneyRows({ lines: [{ key: 'fee', label: 'Reel fee', signed: 439, state: 'pending' }, { key: 'entry', label: 'Entry', signed: -50, covered: true, state: 'covered' }], projection: { projected_net: 439, posted_net: 0, conditional: [{ tier: 'slay', amount: 100 }] } });
    expect(m.rows).toEqual([{ key: 'fee', label: 'Reel fee', amount: 439, note: 'pending' }, { key: 'entry', label: 'Entry', amount: 0, note: 'covered' }]);
    expect(m.net).toEqual({ value: 439, estimate: true });
    expect(m.bonus).toEqual([{ tier: 'Slay', amount: 100 }]);
    expect(moneyRows(null)).toBeNull();
  });

  test('stats: the current value and, once evaluated, the change', () => {
    const rows = statRows({ coins: 1900, stress: 2 }, { stat_deltas: { coins: 439 } });
    expect(rows[0]).toMatchObject({ label: 'Prime Coins', value: 1900, delta: 439 });
    expect(rows[1]).toMatchObject({ value: null, delta: null });
  });

  test('share: teaser, platform copy, feed posts', () => {
    expect(shareState({ teaser: ' One coat. ', distribution_metadata: { youtube: { title: 'x' }, tiktok: {} } }, [{ status: 'live' }, { status: 'draft' }]))
      .toEqual({ teaser: 'One coat.', platforms: ['youtube'], posts: 2, live: 1 });
    expect(signedCoins(-40)).toBe('−40');
  });
});
