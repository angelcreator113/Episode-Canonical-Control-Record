// ============================================================================
// Goals line up with the events that move them (Evoni, 2026-10-25: "a, b and
// c, with pinning, show me first"): seasonGoalCoverage's pure parts and the
// uncovered-goal bonus in seasonSuggestionService.scoreForSeason. No database.
// ============================================================================

const {
  computeCoverage, projectionFor, goalInPart, rangeOf, uncoveredByPhase, eventGoals,
} = require('../../../src/services/seasonGoalCoverage');
const {
  goalMove, goalFit, expectedGain, pinnedGoalIds, scoreForSeason, goalGapFit, GOAL_GAP_BONUS,
} = require('../../../src/services/seasonSuggestionService');

const STATE = { reputation: 3, coins: 1000 };
const PARTS = [
  { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8 },
  { phase: 2, title: 'Rise', episode_start: 9, episode_end: 16 },
  { phase: 3, title: 'Crown', episode_start: 17, episode_end: 24 },
];
const COINS = { id: 'g-coins', title: 'Save 3,000 coins', target_metric: 'coins', current_value: 600, target_value: 3000 };
const REP = { id: 'g-rep', title: 'Reach reputation 8', target_metric: 'reputation', current_value: 3, target_value: 8 };
const TRUST = { id: 'g-trust', title: 'Earn brand trust', target_metric: 'brand_trust', current_value: 2, target_value: 6 };
const STRESS = { id: 'g-stress', title: 'Keep stress low', target_metric: 'stress', current_value: 4, target_value: 2 };

const ev = (fields) => ({ id: fields.id, name: fields.name || fields.id, prestige: 3, is_paid: false, payment_amount: 0, rewards: {}, ...fields });
const slot = (n, phase, event, extra = {}) => ({ id: `s${n}`, slot_number: n, phase, label: `S1 · E${n}`, done: false, event, ...extra });

describe('goalMove and expectedGain (what goalFit reads)', () => {
  test('coins by pay or deal fees; reputation by prestige above hers or a reward; other stats by a reward', () => {
    expect(goalMove(ev({ id: 'a', is_paid: true, payment_amount: 400 }), COINS, STATE)).toBe('fit');
    expect(goalMove(ev({ id: 'b', appearance_fee: 300, performance_fee: 200 }), COINS, STATE)).toBe('fit');
    expect(expectedGain(ev({ id: 'b', appearance_fee: 300, performance_fee: 200 }), 'coins')).toBe(500);
    expect(goalMove(ev({ id: 'c' }), COINS, STATE)).toBeNull();
    expect(goalMove(ev({ id: 'd', prestige: 6 }), REP, STATE)).toBe('fit');
    expect(goalMove(ev({ id: 'e', prestige: 2, rewards: { reputation: 2 } }), REP, STATE)).toBe('fit');
    expect(goalMove(ev({ id: 'f', rewards: JSON.stringify({ brand_trust: 3 }) }), TRUST, STATE)).toBe('fit');
    expect(goalMove(ev({ id: 'g', rewards: { brand_trust: 0 } }), TRUST, STATE)).toBeNull();
  });

  test('a pin always counts, even for a stat nothing else moves; a stress goal moves only by a pin', () => {
    expect(goalMove(ev({ id: 'h' }), STRESS, STATE)).toBeNull();
    expect(goalMove(ev({ id: 'h', canon_consequences: { pinned_goal_ids: ['g-stress'] } }), STRESS, STATE)).toBe('pinned');
    // A pin beats a fit, so the reason names it.
    expect(goalMove(ev({ id: 'i', is_paid: true, payment_amount: 50, pinned_goal_ids: ['g-coins'] }), COINS, STATE)).toBe('pinned');
    expect(pinnedGoalIds({ canon_consequences: '{"pinned_goal_ids":["x",null,""]}' })).toEqual(['x']);
    expect(pinnedGoalIds({ pinned_goal_ids: null })).toEqual([]);
    expect(goalFit(ev({ id: 'j', is_paid: true, payment_amount: 50, pinned_goal_ids: ['g-trust'] }), [COINS, TRUST], STATE).reason.text)
      .toBe('Moves a goal: Earn brand trust');
  });
});

describe('computeCoverage', () => {
  const paid = ev({ id: 'paid', name: 'Paid runway', is_paid: true, payment_amount: 1500 });
  const deal = ev({ id: 'deal', name: 'Beauty deal', partnership_base_fee: 900, rewards: { brand_trust: 2 } });
  const gala = ev({ id: 'gala', name: 'Gala', prestige: 7, rewards: { reputation: 2 } });
  const quiet = ev({ id: 'quiet', name: 'Quiet brunch', pinned_goal_ids: ['g-stress'] });
  const slots = [slot(3, 1, paid), slot(5, 1, quiet), slot(11, 2, deal), slot(12, 2, null), slot(18, 3, gala)];
  const cov = computeCoverage({ parts: PARTS, slots, goals: [COINS, REP, TRUST, STRESS], state: STATE });
  const goal = (id) => cov.goals.find((g) => g.id === id);

  test('movers by metric, with the episode code, and pinned ones', () => {
    expect(goal('g-coins').movers.map((m) => [m.code, m.name, m.via])).toEqual([['E3', 'Paid runway', 'fit'], ['E11', 'Beauty deal', 'fit']]);
    expect(goal('g-rep').movers.map((m) => m.code)).toEqual(['E18']);
    expect(goal('g-trust').movers.map((m) => m.code)).toEqual(['E11']);
    expect(goal('g-stress').movers).toEqual([expect.objectContaining({ code: 'E5', via: 'pinned', pinned: true })]);
  });

  test('the projection: current plus the movers\' expected rewards, against the target', () => {
    expect(goal('g-coins').projection).toEqual(expect.objectContaining({
      label: 'Coins', current: 600, gain: 2400, projected: 3000, target: 3000, counted: 2, on_track: true, short: 0,
    }));
    expect(goal('g-rep').projection).toEqual(expect.objectContaining({ gain: 2, projected: 5, on_track: false, short: 3 }));
    expect(goal('g-stress').projection).toBeNull();
  });

  test('a done slot\'s reward is already in the current value and is not counted again', () => {
    const done = computeCoverage({ parts: PARTS, slots: [slot(3, 1, paid, { done: true }), slot(11, 2, deal)], goals: [COINS], state: STATE });
    expect(done.goals[0].movers).toHaveLength(2);
    expect(done.goals[0].projection).toEqual(expect.objectContaining({ gain: 900, counted: 1, projected: 1500 }));
  });

  test('per-part gaps: each part names the goals no event in it moves (a stat to keep under is never a gap)', () => {
    expect(cov.parts.map((p) => [p.phase, p.gaps.map((g) => g.goal_id)])).toEqual([
      [1, ['g-rep', 'g-trust']],
      [2, ['g-rep']],
      [3, ['g-coins', 'g-trust']],
    ]);
    expect(goal('g-stress').gap_phases).toEqual([]);
    expect(goal('g-coins').gap_phases).toEqual([3]);
  });

  test('a goal whose episode range misses a part is not asked of that part', () => {
    expect(rangeOf({ episode_range: '[9, 16]' })).toEqual([9, 16]);
    expect(rangeOf({ episode_range: null })).toBeNull();
    expect(goalInPart({ episode_range: [9, 16] }, PARTS[0])).toBe(false);
    expect(goalInPart({ episode_range: [9, 16] }, PARTS[1])).toBe(true);
    const ranged = computeCoverage({ parts: PARTS, slots: [], goals: [{ ...TRUST, episode_range: [1, 8] }], state: STATE });
    expect(ranged.parts.map((p) => p.gaps.length)).toEqual([1, 0, 0]);
  });

  test('the slots\' chips and one event\'s goals (pinned or moved)', () => {
    expect(cov.slots.find((s) => s.slot_number === 11).goals.map((g) => [g.goal_id, g.via])).toEqual([['g-coins', 'fit'], ['g-trust', 'fit']]);
    expect(cov.slots.some((s) => s.slot_number === 12)).toBe(false);
    const one = eventGoals(quiet, { slots, goals: [COINS, STRESS], state: STATE });
    expect(one.slot).toEqual(expect.objectContaining({ code: 'E5' }));
    expect(one.pinned_goal_ids).toEqual(['g-stress']);
    expect(one.moves.map((g) => g.goal_id)).toEqual(['g-stress']);
    expect(one.goals.map((g) => [g.goal_id, g.pinned])).toEqual([['g-coins', false], ['g-stress', true]]);
  });

  test('projectionFor with no mover: the current value, nothing projected', () => {
    expect(projectionFor(COINS, [])).toEqual(expect.objectContaining({ gain: 0, projected: 600, counted: 0, on_track: false, short: 2400 }));
  });

  test('uncoveredByPhase gives the goals themselves, for scoreForSeason', () => {
    const gaps = uncoveredByPhase(cov, [COINS, REP, TRUST, STRESS]);
    expect(gaps[3].map((g) => g.title)).toEqual(['Save 3,000 coins', 'Earn brand trust']);
  });
});

describe('scoreForSeason prefers an event that covers an uncovered goal', () => {
  const inputs = { slot: { desired_pressure: null, career_focus: null }, goals: [COINS, TRUST], recent: [] };
  const paid = ev({ id: 'paid', name: 'Paid runway', is_paid: true, payment_amount: 400 });
  const trusty = ev({ id: 'trusty', name: 'Brand dinner', rewards: { brand_trust: 2 } });

  test('without gaps the two tie; with brand trust uncovered the brand dinner wins and says why', () => {
    expect(scoreForSeason(paid, STATE, inputs).score).toBe(scoreForSeason(trusty, STATE, inputs).score);
    const withGap = { ...inputs, uncovered: [TRUST] };
    const a = scoreForSeason(paid, STATE, withGap);
    const b = scoreForSeason(trusty, STATE, withGap);
    expect(b.score - a.score).toBe(GOAL_GAP_BONUS);
    expect(b.reasons[0]).toEqual({ kind: 'boost', text: 'Covers a goal nothing in this part moves yet: Earn brand trust' });
    const ranked = [paid, trusty].map((e) => ({ e, s: scoreForSeason(e, STATE, withGap).score })).sort((x, y) => y.s - x.s);
    expect(ranked[0].e.id).toBe('trusty');
  });

  test('a pin covers a gap too; no gap, no bonus', () => {
    const pinned = ev({ id: 'p', pinned_goal_ids: ['g-trust'] });
    expect(goalGapFit(pinned, [TRUST], STATE).score).toBe(GOAL_GAP_BONUS);
    expect(goalGapFit(pinned, [], STATE)).toBeNull();
    expect(goalGapFit(pinned, undefined, STATE)).toBeNull();
  });
});
