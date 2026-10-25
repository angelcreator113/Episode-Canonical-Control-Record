// ============================================================================
// Goal ladders (Evoni, 2026-10-25: "This is very confusing I don't know what I
// am to do"): utils/goalLadders and what seasonGoalCoverage builds on it, with
// her real 21 goals. No database.
// ============================================================================

const {
  KIND, kindOf, directionOf, buildLadders, pickPrimary, goalReached, completesByReading, offTrack, activatedAfter,
} = require('../../../src/utils/goalLadders');
const { computeCoverage, rankGoalEvents, mainGoalOf, ladderProjection, pickMainGoal } = require('../../../src/services/seasonGoalCoverage');

let t = 0;
const G = (id, title, type, metric, target, extra = {}) => ({
  id, title, type, status: 'active', target_metric: metric, target_value: target, current_value: 0, priority: type === 'primary' ? 1 : 2,
  created_at: new Date(Date.UTC(2026, 9, 1, 0, t++)).toISOString(), episode_range: null, unlocks_on_complete: [], ...extra,
});
// Evoni's Goals tab, 2026-10-25 (coins 294, influence 2).
const HERS = [
  G('legacy', 'Legacy', 'primary', 'reputation', 10),
  G('maison', 'The Maison Belle Contract', 'primary', 'brand_trust', 8),
  G('luxury', 'Luxury Access', 'primary', 'reputation', 7),
  G('brandgirl', 'Brand Girl Era', 'secondary', 'brand_trust', 4),
  G('firstimp', 'First Impressions', 'secondary', 'reputation', 3),
  G('giveback', 'Give Back', 'secondary', 'influence', 10, { current_value: 2 }),
  G('pressure', 'The Pressure of Influence', 'secondary', 'stress', 4, { current_value: 2 }),
  G('trust', 'Trust the Process', 'secondary', 'brand_trust', 6),
  G('money', 'The Money Talk', 'secondary', 'coins', 2000, { current_value: 294 }),
  G('portfolio', 'Build the Portfolio', 'secondary', 'portfolio_strength', 5),
  G('collection', 'The Perfect Collection', 'primary', 'coins', 25000, { current_value: 294 }),
  G('indep', 'Financial Independence', 'secondary', 'coins', 10000, { current_value: 294 }),
  G('k25', '25K Strong', 'primary', 'followers', 25000),
  G('growing', 'Growing Influence', 'secondary', 'influence', 4, { current_value: 2 }),
  G('k5', 'First 5K', 'secondary', 'followers', 5000),
  G('global', 'Global Reach', 'secondary', 'influence', 8, { current_value: 2 }),
  G('closet', 'Closet Upgrade', 'secondary', 'coins', 5000, { current_value: 294 }),
  G('flop', 'Survive the Flop', 'secondary', 'reputation', 3),
  G('starter', 'Starter Fund', 'secondary', 'coins', 500, { current_value: 294 }),
  G('consistent', 'Stay Consistent', 'passive', 'consistency_streak', 7),
  G('stress', 'Manage Stress', 'passive', 'stress', 3, { current_value: 2 }),
  G('lights', 'Keep the Lights On', 'secondary', 'coins', 200, { status: 'completed' }),
];

describe('the metric kinds, in one place', () => {
  test('events move coins, reputation and brand trust; performance moves followers, influence, portfolio; the rest is background', () => {
    expect(['coins', 'reputation', 'brand_trust'].map(kindOf)).toEqual(['event', 'event', 'event']);
    expect(['followers', 'influence', 'portfolio_strength', 'engagement_rate'].map(kindOf)).toEqual(Array(4).fill('performance'));
    expect(['consistency_streak', 'stress', 'custom', undefined].map(kindOf)).toEqual(Array(4).fill('background'));
    expect(Object.keys(KIND)).toHaveLength(9);
    expect(directionOf('stress')).toBe('down');
    expect(directionOf('coins')).toBe('up');
  });
});

describe('buildLadders with her 21 goals', () => {
  const lad = buildLadders(HERS);
  const byId = (id) => lad.ladders.find((l) => l.id === id);

  test('one ladder per stat, lowest target first; only the lowest rung is active', () => {
    expect(lad.ladders.map((l) => [l.id, l.active_goal_id])).toEqual([
      ['reputation', 'firstimp'], ['brand_trust', 'brandgirl'], ['influence', 'growing'], ['stress', 'pressure'],
      ['coins', 'starter'], ['portfolio_strength', 'portfolio'], ['followers', 'k5'],
    ]);
    expect(byId('coins').up_next_ids).toEqual(['money', 'closet', 'indep', 'collection']);
    // Same target: priority then age (First Impressions was made before Survive the Flop).
    expect(byId('reputation').goal_ids).toEqual(['firstimp', 'flop', 'luxury', 'legacy']);
    expect(lad.byGoal.get('closet')).toEqual({ ladder_id: 'coins', rung: 'up_next', position: 2 });
    // The completed goal and the passive ones are not rungs.
    expect(lad.byGoal.has('lights')).toBe(false);
    expect(lad.byGoal.get('stress').rung).toBe('passive');
    expect(lad.byGoal.get('consistent').rung).toBe('passive');
    // 7 active rungs out of 21 active goals.
    expect([...lad.byGoal.values()].filter((p) => p.rung === 'active')).toHaveLength(7);
  });

  test('a stat to keep under ladders from the loosest limit down', () => {
    const l = buildLadders([G('a', 'Under 3', 'secondary', 'stress', 3), G('b', 'Under 5', 'secondary', 'stress', 5)]);
    expect(l.ladders[0].goal_ids).toEqual(['b', 'a']);
    expect(l.ladders[0].direction).toBe('down');
  });

  test('an explicit unlock order wins over the targets', () => {
    const big = G('big', 'Big first', 'secondary', 'coins', 900, { unlocks_on_complete: [{ type: 'goal', goal_id: 'small' }] });
    const small = G('small', 'Small after', 'secondary', 'coins', 100);
    expect(buildLadders([small, big]).ladders[0].goal_ids).toEqual(['big', 'small']);
    const byName = G('n1', 'Named', 'secondary', 'coins', 900, { unlocks_on_complete: JSON.stringify([{ type: 'goal', name: 'small after' }]) });
    expect(buildLadders([small, byName]).ladders[0].goal_ids).toEqual(['n1', 'small']);
    // An opportunity unlock is not an order.
    const opp = G('o', 'Opp', 'secondary', 'coins', 900, { unlocks_on_complete: [{ type: 'opportunity', name: 'Small after' }] });
    expect(buildLadders([small, opp]).ladders[0].goal_ids).toEqual(['small', 'o']);
  });

  test('the one primary: by priority, then the oldest; the ladder holding it says so', () => {
    expect(pickPrimary(HERS).id).toBe('legacy');
    expect(lad.primary_id).toBe('legacy');
    expect(byId('reputation').has_primary).toBe(true);
    expect(byId('coins').has_primary).toBe(false);
    expect(pickPrimary([{ ...HERS[1], priority: 0 }, HERS[0]]).id).toBe('maison');
    expect(pickPrimary([])).toBeNull();
  });
});

describe('completion', () => {
  test('goalReached is direction-aware: stress completes at or below its target, never because it rose', () => {
    expect(goalReached({ target_metric: 'coins', target_value: 500 }, 500)).toBe(true);
    expect(goalReached({ target_metric: 'coins', target_value: 500 }, 499)).toBe(false);
    expect(goalReached({ target_metric: 'stress', target_value: 4 }, 6)).toBe(false);
    expect(goalReached({ target_metric: 'stress', target_value: 4 }, 4)).toBe(true);
    expect(goalReached({ target_metric: 'stress', target_value: 4 }, 1)).toBe(true);
    expect(goalReached({ target_metric: 'stress', target_value: 4 }, null)).toBe(true); // 0
    expect(goalReached({ target_metric: 'coins', target_value: 500 }, 'x')).toBe(false);
    expect(completesByReading({ type: 'passive', target_metric: 'stress' })).toBe(false);
    expect(completesByReading({ type: 'secondary', target_metric: 'custom' })).toBe(false);
    expect(completesByReading({ type: 'secondary', target_metric: 'stress' })).toBe(true);
    expect(offTrack({ target_metric: 'stress', target_value: 4, current_value: 5 })).toBe(true);
    expect(offTrack({ target_metric: 'stress', target_value: 4, current_value: 4 })).toBe(false);
    expect(offTrack({ target_metric: 'coins', target_value: 4, current_value: 0 })).toBe(false);
  });

  test('completing a rung activates the next one; completing again activates nothing new (idempotent)', () => {
    expect(activatedAfter(HERS, ['starter'])).toEqual([{ id: 'money', title: 'The Money Talk', metric: 'coins' }]);
    // Two rungs at once: the next one after both.
    expect(activatedAfter(HERS, ['starter', 'money']).map((g) => g.id)).toEqual(['closet']);
    const after = HERS.map((g) => (g.id === 'starter' ? { ...g, status: 'completed' } : g));
    expect(activatedAfter(after, ['starter'])).toEqual([]);
    expect(buildLadders(after).ladders.find((l) => l.id === 'coins').active_goal_id).toBe('money');
    expect(activatedAfter(HERS, [])).toEqual([]);
  });
});

describe('coverage on ladders', () => {
  const PARTS = [
    { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8 },
    { phase: 2, title: 'Ascension', episode_start: 9, episode_end: 16 },
  ];
  const ev = (id, f = {}) => ({ id, name: id, prestige: 0, is_paid: false, payment_amount: 0, rewards: {}, ...f });
  const slot = (n, event, extra = {}) => ({ id: `s${n}`, slot_number: n, phase: n <= 8 ? 1 : 2, label: `S1 · E${n}`, done: false, event, ...extra });
  const pays = [300, 450, 500, 600, 800, 250, 900, 400, 1200, 750, 650, 950]; // 7,750
  const slots = pays.map((p, i) => slot(i + 2, ev(`pay${i}`, { is_paid: true, payment_amount: p, ...(i === 0 ? { pinned_goal_ids: ['starter'] } : {}) })));
  const active = HERS.filter((g) => g.status === 'active');
  const cov = computeCoverage({ parts: PARTS, slots, goals: active, state: { reputation: 5, coins: 294 } });
  const goal = (id) => cov.goals.find((g) => g.id === id);

  test('each goal carries its kind, ladder, rung and whether the parts are asked to cover it (older fields kept)', () => {
    expect(goal('starter')).toEqual(expect.objectContaining({ kind: 'event', ladder_id: 'coins', rung: 'active', covered: true }));
    expect(goal('money')).toEqual(expect.objectContaining({ rung: 'up_next', covered: false, gap_phases: [] }));
    expect(goal('k5')).toEqual(expect.objectContaining({ kind: 'performance', covered: false, gap_phases: [] }));
    expect(goal('stress')).toEqual(expect.objectContaining({ kind: 'background', rung: 'passive', covered: false }));
    expect(goal('legacy').is_primary).toBe(true);
    expect(goal('starter')).toEqual(expect.objectContaining({ movers: expect.any(Array), projection: expect.any(Object), metric_label: 'Coins' }));
  });

  test('Moved by is the pinned main event; the rest also helps', () => {
    expect(goal('starter').main_events.map((m) => m.code)).toEqual(['E2']);
    expect(goal('starter').also_helps).toHaveLength(11);
    expect(goal('money').main_events).toEqual([]);
  });

  test('part gaps name only active rungs of a stat events move', () => {
    const none = computeCoverage({ parts: PARTS, slots: [], goals: active, state: {} });
    expect(none.parts.map((p) => p.gaps.map((g) => g.goal_id).sort())).toEqual([['brandgirl', 'firstimp', 'starter'], ['brandgirl', 'firstimp', 'starter']]);
  });

  test('one projection per ladder: the stat\'s gain counted once, the rungs it clears and the next one', () => {
    const coins = cov.ladders.find((l) => l.id === 'coins');
    expect(coins.projection).toEqual(expect.objectContaining({ current: 294, gain: 7750, projected: 8044, counted: 12 }));
    expect(coins.projection.clears.map((c) => c.title)).toEqual(['Starter Fund', 'The Money Talk', 'Closet Upgrade']);
    expect(coins.projection.next).toEqual({ goal_id: 'indep', title: 'Financial Independence', target_value: 10000, short: 1956 });
    expect(cov.ladders.find((l) => l.id === 'followers').projection).toBeNull();
    expect(cov.ladders.find((l) => l.id === 'stress').projection).toBeNull();
    expect(cov.primary_goal_id).toBe('legacy');
    // A done slot's reward is in the current value already.
    const byId = new Map(active.map((g) => [String(g.id), g]));
    const done = ladderProjection({ kind: 'event', direction: 'up', metric: 'coins', goal_ids: ['starter'] }, byId,
      new Map([['starter', [{ slot_id: 'a', gain: 100, done: true }, { slot_id: 'b', gain: 50 }, { slot_id: 'b', gain: 50 }]]]));
    expect(done).toEqual(expect.objectContaining({ gain: 50, counted: 1 }));
  });

  test('slot chips leave out the rungs waiting up next, the pinned goal first', () => {
    const s2 = cov.slots.find((s) => s.slot_number === 2);
    expect(s2.goals[0].goal_id).toBe('starter');
    expect(s2.goals.map((g) => g.goal_id)).not.toContain('money');
  });

  test('Pick its event: the best three that move it, placed in its range first, each with the goal it is already for', () => {
    const ranged = { ...active.find((g) => g.id === 'money'), episode_range: [1, 8] };
    const events = [...slots.map((s) => s.event), ev('free', { is_paid: true, payment_amount: 5000 })];
    const res = rankGoalEvents(ranged, events, { slots, state: {}, goals: active });
    expect(res.pick.map((e) => e.slot?.code || e.id)).toEqual(['E8', 'E6', 'E5']);
    expect(res.events[0].id).toBe('free');
    const first = res.events.find((e) => e.id === 'pay0');
    expect(first.main_goal).toEqual({ goal_id: 'starter', title: 'Starter Fund' });
    expect(mainGoalOf(slots[0].event, active)).toEqual({ goal_id: 'starter', title: 'Starter Fund' });
    expect(mainGoalOf(slots[0].event, active, { id: 'starter' })).toBeNull();
    // A pin to a background goal is not a main goal.
    expect(mainGoalOf(ev('x', { pinned_goal_ids: ['stress'] }), active)).toBeNull();
  });
});

describe('pickMainGoal: the episode\'s main career goal (what mainGoalForEvent returns)', () => {
  const active = HERS.filter((g) => g.status === 'active');
  const ev = (f = {}) => ({ id: 'e', name: 'e', prestige: 0, is_paid: false, payment_amount: 0, rewards: {}, ...f });

  test('the pinned goal of a stat events move wins', () => {
    const r = pickMainGoal(ev({ is_paid: true, payment_amount: 900, pinned_goal_ids: ['stress', 'maison'] }), active, {});
    expect([r.goal.id, r.source]).toEqual(['maison', 'pinned']);
  });

  test('else the goal being worked on that the event moves best: biggest gain, never a rung up next', () => {
    const r = pickMainGoal(ev({ is_paid: true, payment_amount: 900, rewards: { brand_trust: 2 } }), active, { reputation: 5 });
    expect([r.goal.id, r.source]).toEqual(['starter', 'suggested']);
    // Prestige alone (no gain): the primary's ladder (reputation) first.
    const rep = pickMainGoal(ev({ prestige: 7, rewards: { brand_trust: 0 } }), active, { reputation: 0 });
    expect(rep.goal.id).toBe('firstimp');
  });

  test('a pin to a background goal is not a main goal, and an event that moves nothing has none', () => {
    expect(pickMainGoal(ev({ pinned_goal_ids: ['stress'] }), active, { reputation: 0 })).toEqual({ goal: null, source: null });
    expect(pickMainGoal(ev(), [], {})).toEqual({ goal: null, source: null });
  });
});
