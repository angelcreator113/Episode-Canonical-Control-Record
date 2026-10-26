/**
 * Her self-talk at Beat 13 moves her stress at Complete (Evoni, 2026-10-25:
 * "Yes build the goals and stress script work"): Kind or Honest after a
 * safe or failed result softens it by one; Hard on herself after a pass or
 * a slay adds one; nothing saved changes nothing. The pure rule is
 * evaluationFormula.selfTalkStressDelta; completeEpisode applies it after
 * computeStatDeltas and says why in stress_breakdown.
 *
 * sequelize.query and the model layer are mocked, as in
 * episodeCompletionService.careerHook.test.js; no DB.
 */

let mockTier = 'fail';

jest.mock('../../../src/services/coinLedgerSync', () => ({
  lockLedgerBalance: jest.fn(async () => 1000),
  syncCoinsFromLedger: jest.fn(async () => ({ balance: 1000, rows_updated: 1 })),
}));
jest.mock('../../../src/utils/evaluationFormula', () => {
  const actual = jest.requireActual('../../../src/utils/evaluationFormula');
  return { ...actual, evaluate: jest.fn((...args) => ({ ...actual.evaluate(...args), tier_final: mockTier })) };
});
jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 0, total_expenses: 0 }, balance_before: 1000, balance_after: 1000, milestones_triggered: [], transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));
jest.mock('../../../src/services/episodeStoryRecord', () => ({ draftLater: jest.fn(async () => null) }));
jest.mock('../../../src/routes/wardrobe', () => ({}));
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const { completeEpisode, stressBreakdownOf } = require('../../../src/services/episodeCompletionService');
const { selfTalkStressDelta, selfTalkTone } = jest.requireActual('../../../src/utils/evaluationFormula');

function resetModels() {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  Object.assign(mockModels, {
    Episode: { findByPk: jest.fn(async () => ({ id: 'ep-1', episode_number: 3 })) },
    WorldEvent: { findOne: jest.fn(async () => null) },
    Opportunity: { findByPk: jest.fn(async () => null), findOne: jest.fn(async () => null), create: jest.fn() },
    CareerGoal: { findAll: jest.fn(async () => []) },
    sequelize: { query: jest.fn(async () => [[], 0]) },
  });
}

function makeSequelize({ tone }) {
  const query = jest.fn(async (sql) => {
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{ id: 'ep-1', title: 'Ep', episode_number: 3, show_id: 'show-1', evaluation_status: 'draft', evaluation_json: null, total_income: 0, total_expenses: 0 }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) return [{ id: 'state-lala', coins: 1000, reputation: 3, brand_trust: 2, influence: 2, stress: 4 }];
    if (/FROM episode_briefs/.test(sql)) return tone === undefined ? [] : [{ event_metadata: tone === null ? {} : { self_talk: { tone, at: '2026-10-25T00:00:00Z' } } }];
    if (/^\s*SELECT/.test(sql)) return [];
    if (/UPDATE character_state\b[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: 1000 }], 1];
    return [[], 0];
  });
  return { query, QueryTypes: { SELECT: 'SELECT' }, transaction: async (a, b) => (typeof a === 'function' ? a({ id: 'tx' }) : b({ id: 'tx' })) };
}

describe('selfTalkStressDelta: the rule', () => {
  test.each([
    ['slay', 'hard', 1], ['slay', 'honest', 0], ['slay', 'kind', 0],
    ['pass', 'hard', 1], ['pass', 'honest', 0], ['pass', 'kind', 0],
    ['safe', 'hard', 0], ['safe', 'honest', -1], ['safe', 'kind', -1],
    ['fail', 'hard', 0], ['fail', 'honest', -1], ['fail', 'kind', -1],
  ])('%s with %s self-talk: %i', (tier, tone, delta) => {
    const r = selfTalkStressDelta(tier, tone);
    expect(r.delta).toBe(delta);
    expect(r.tone).toBe(tone);
    expect(r.reason === null).toBe(delta === 0);
  });

  test('the reasons are plain words', () => {
    expect(selfTalkStressDelta('fail', 'kind').reason).toBe('Kind self-talk softened the stress');
    expect(selfTalkStressDelta('safe', 'honest').reason).toBe('Honest self-talk softened the stress');
    expect(selfTalkStressDelta('slay', 'hard').reason).toMatch(/hard on herself added stress/i);
  });

  test('no tone, or an unknown one, changes nothing', () => {
    for (const tone of [null, undefined, '', 'gentle', 42]) {
      expect(selfTalkStressDelta('fail', tone)).toEqual({ tone: null, delta: 0, reason: null });
    }
    expect(selfTalkTone(' Kind ')).toBe('kind');
  });
});

describe('completeEpisode applies her self-talk to stress', () => {
  beforeEach(() => {
    resetModels();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('kind self-talk after a fail: the +2 becomes +1, and the result says why', async () => {
    mockTier = 'fail';
    const r = await completeEpisode('ep-1', 'show-1', makeSequelize({ tone: 'kind' }));
    expect(r.previous_state.stress).toBe(4);
    expect(r.new_state.stress).toBe(5);
    expect(r.stat_deltas.self_talk_delta).toBe(-1);
    expect(r.self_talk).toEqual({ tone: 'kind', label: 'Kind', delta: -1, reason: 'Kind self-talk softened the stress' });
    expect(r.stress_breakdown).toEqual([
      { key: 'tier', delta: 2, reason: 'The FAIL result' },
      { key: 'self_talk', delta: -1, reason: 'Kind self-talk softened the stress' },
    ]);
  });

  test('hard on herself after a slay: −1 becomes 0', async () => {
    mockTier = 'slay';
    const r = await completeEpisode('ep-1', 'show-1', makeSequelize({ tone: 'hard' }));
    expect(r.new_state.stress).toBe(4);
    expect(r.self_talk.delta).toBe(1);
  });

  test('no choice saved (or no brief): stress moves by the tier alone, and no self_talk is reported', async () => {
    mockTier = 'fail';
    for (const tone of [null, undefined]) {
      const r = await completeEpisode('ep-1', 'show-1', makeSequelize({ tone }));
      expect(r.new_state.stress).toBe(6);
      expect(r.stat_deltas.self_talk_delta).toBeUndefined();
      expect(r.self_talk).toBeNull();
      expect(r.stress_breakdown).toEqual([{ key: 'tier', delta: 2, reason: 'The FAIL result' }]);
    }
  });

  test('stress stays within 0–10', async () => {
    mockTier = 'slay';
    const seq = makeSequelize({ tone: 'kind' });
    const r = await completeEpisode('ep-1', 'show-1', seq);
    expect(r.new_state.stress).toBeGreaterThanOrEqual(0);
    expect(r.new_state.stress).toBeLessThanOrEqual(10);
  });
});

test('stressBreakdownOf lists each source that moved stress', () => {
  expect(stressBreakdownOf({ tier: 'safe', base: 1, social: 1, wardrobe: 0, selfTalk: { delta: -1, reason: 'Honest self-talk softened the stress' }, financial: -2 })).toEqual([
    { key: 'tier', delta: 1, reason: 'The SAFE result' },
    { key: 'social', delta: 1, reason: 'Required content not done' },
    { key: 'self_talk', delta: -1, reason: 'Honest self-talk softened the stress' },
    { key: 'money', delta: -2, reason: 'Money relief' },
  ]);
});
