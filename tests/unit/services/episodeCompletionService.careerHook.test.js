/**
 * episodeCompletionService.completeEpisode — career hook (Task #1817)
 *
 * Evoni's ruling (option 1):
 *   - completing an episode completes its linked opportunity (once), via
 *     careerPipelineService.onEpisodeCompleted, which no longer cascades into
 *     onOpportunityAdvanced and no longer credits episode income to coins goals;
 *   - step 17's +1 per active, non-deleted goal is the only goal advance;
 *   - goals step 17 completes spawn their unlocks_on_complete opportunities.
 *
 * sequelize.query and the model layer are mocked; no DB. The real
 * careerPipelineService runs against the mocked models.
 */

let mockTier = 'slay';

jest.mock('../../../src/utils/evaluationFormula', () => {
  const actual = jest.requireActual('../../../src/utils/evaluationFormula');
  return {
    ...actual,
    evaluate: jest.fn((...args) => ({ ...actual.evaluate(...args), tier_final: mockTier })),
  };
});

jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 500, total_expenses: 0 },
    balance_before: 500,
    balance_after: 1000,
    milestones_triggered: [],
    transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));

jest.mock('../../../src/routes/wardrobe', () => ({}));

// The model layer completeEpisode loads with require('../models').
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';

function makeOpportunity(overrides = {}) {
  const opp = {
    id: 'opp-1',
    show_id: SHOW_ID,
    name: 'Maison Belle campaign',
    opportunity_type: 'brand_deal',
    prestige: 7,
    payment_amount: 500,
    status: 'booked',
    status_history: [],
    ...overrides,
  };
  opp.update = jest.fn(async (patch) => { Object.assign(opp, patch); return opp; });
  return opp;
}

function resetModels({ opp = makeOpportunity() } = {}) {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  let created = 0;
  Object.assign(mockModels, {
    Episode: {
      findByPk: jest.fn(async (id) => (id === EPISODE_ID
        ? { id: EPISODE_ID, episode_number: 7, total_income: 500, total_expenses: 0 }
        : null)),
    },
    WorldEvent: { findOne: jest.fn(async () => null) },
    Opportunity: {
      findByPk: jest.fn(async () => null),
      findOne: jest.fn(async ({ where }) => (where.episode_id === EPISODE_ID ? opp : null)),
      create: jest.fn(async (data) => ({ ...data, id: data.id || `spawned-${++created}` })),
    },
    // onOpportunityAdvanced loads goals through CareerGoal.findAll when the
    // model exists — the completion path must never reach it.
    CareerGoal: { findAll: jest.fn(async () => []) },
    sequelize: { query: jest.fn(async () => [[], 0]) },
  });
  return opp;
}

// The prestige-7 brand_deal paying 500 example. Under the old cascade,
// onOpportunityAdvanced would add influence +2, reputation +2, coins +500,
// and the income credit another +500 to coins.
function defaultGoals() {
  return [
    { id: 'g-influence', title: 'Grow influence', priority: 3, target_metric: 'influence', current_value: 2, target_value: 10, unlocks_on_complete: [], deleted_at: null },
    { id: 'g-reputation', title: 'Build reputation', priority: 3, target_metric: 'reputation', current_value: 3, target_value: 10, unlocks_on_complete: [], deleted_at: null },
    { id: 'g-coins', title: 'Save 10k', priority: 3, target_metric: 'coins', current_value: 100, target_value: 10000, unlocks_on_complete: [], deleted_at: null },
  ];
}

function makeSequelize({ evaluationStatus = 'draft', goals = defaultGoals(), successUnlock = 'Maison Belle contract' } = {}) {
  const queries = [];
  const query = jest.fn(async (sql, opts = {}) => {
    queries.push({ sql, opts });
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{
        id: EPISODE_ID, title: 'Ep', episode_number: 7, show_id: SHOW_ID,
        evaluation_status: evaluationStatus, evaluation_json: evaluationStatus === 'accepted' ? { score: 90 } : null,
        total_income: 500, total_expenses: 0,
      }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) {
      return [{ id: 'state-lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 }];
    }
    if (/FROM episode_briefs/.test(sql)) {
      return successUnlock ? [{ career_context: { success_unlock: successUnlock } }] : [];
    }
    if (/FROM career_goals/.test(sql)) {
      let rows = goals.filter(g => g.status === undefined || g.status === 'active');
      if (/deleted_at IS NULL/.test(sql)) rows = rows.filter(g => !g.deleted_at);
      return rows.map(g => ({ ...g }));
    }
    if (/^\s*SELECT/.test(sql)) return [];
    return [[], 0];
  });
  return { queries, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

const goalUpdates = queries => queries.filter(q => /UPDATE career_goals/.test(q.sql));

describe('completeEpisode career hook (Task #1817)', () => {
  let errorSpy;
  beforeEach(() => {
    mockTier = 'slay';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('completes the linked opportunity exactly once and never runs the onOpportunityAdvanced cascade', async () => {
    const opp = resetModels();
    const { sequelize } = makeSequelize();

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(opp.update).toHaveBeenCalledTimes(1);
    const patch = opp.update.mock.calls[0][0];
    expect(patch.status).toBe('completed');
    expect(patch.episode_id).toBe(EPISODE_ID);
    expect(patch.status_history).toEqual([
      expect.objectContaining({ status: 'completed', from: 'booked', note: 'Episode 7 completed' }),
    ]);
    expect(result.career.opportunities_advanced).toEqual([
      { id: 'opp-1', name: 'Maison Belle campaign', from: 'booked', to: 'completed' },
    ]);

    // onOpportunityAdvanced reloads the opp by PK and the goals via
    // CareerGoal.findAll; neither happens on the completion path.
    expect(mockModels.Opportunity.findByPk).not.toHaveBeenCalled();
    expect(mockModels.CareerGoal.findAll).not.toHaveBeenCalled();
    // The hook itself issues no career_goals SQL (no income credit).
    expect(mockModels.sequelize.query.mock.calls.some(([sql]) => /career_goals/.test(sql))).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('advances every goal by exactly +1 — no metric-based increments, no income credit', async () => {
    resetModels();
    const { sequelize, queries } = makeSequelize();

    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    const updates = goalUpdates(queries);
    expect(updates.map(q => q.opts.replacements)).toEqual([
      { val: 3, status: 'active', id: 'g-influence' },
      { val: 4, status: 'active', id: 'g-reputation' },
      { val: 101, status: 'active', id: 'g-coins' },
    ]);
    expect(mockModels.Opportunity.create).not.toHaveBeenCalled();
  });

  it('spawns unlocks_on_complete for a goal step 17 completes, and nothing for a goal it does not', async () => {
    resetModels();
    const goals = [
      {
        id: 'g-finishing', title: 'Land a couture deal', priority: 1, target_metric: 'custom',
        current_value: 9, target_value: 10, deleted_at: null,
        unlocks_on_complete: ['Maison Belle contract', { type: 'editorial', description: 'Vogue feature', prestige: 9 }],
      },
      {
        id: 'g-midway', title: 'Grow influence', priority: 3, target_metric: 'influence',
        current_value: 1, target_value: 10, deleted_at: null,
        unlocks_on_complete: ['Should not spawn'],
      },
    ];
    const { sequelize, queries } = makeSequelize({ goals });

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(goalUpdates(queries).map(q => q.opts.replacements)).toEqual([
      { val: 10, status: 'completed', id: 'g-finishing' },
      { val: 2, status: 'active', id: 'g-midway' },
    ]);

    const created = mockModels.Opportunity.create.mock.calls.map(c => c[0]);
    expect(created).toHaveLength(2);
    expect(created.every(o => o.career_goal_id === 'g-finishing' && o.show_id === SHOW_ID && o.status === 'offered')).toBe(true);
    expect(created.map(o => [o.name, o.opportunity_type, o.prestige])).toEqual([
      ['Maison Belle contract', 'brand_deal', 7], // priority 1 → default prestige 7
      ['Vogue feature', 'editorial', 9],
    ]);
    expect(created.some(o => o.name === 'Should not spawn')).toBe(false);

    expect(result.career.goals_completed).toEqual([{ id: 'g-finishing', title: 'Land a couture deal' }]);
    expect(result.career.unlocks.map(u => u.name)).toEqual(['Maison Belle contract', 'Vogue feature']);
  });

  it('a failed unlock spawn is logged and does not fail completion', async () => {
    resetModels();
    const goals = [{
      id: 'g-bad', title: 'Bad unlocks', priority: 3, target_metric: 'custom',
      current_value: 9, target_value: 10, deleted_at: null, unlocks_on_complete: '{not json',
    }];
    const { sequelize } = makeSequelize({ goals });

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.episode_id).toBe(EPISODE_ID);
    expect(result.career.goals_completed).toEqual([{ id: 'g-bad', title: 'Bad unlocks' }]);
    expect(errorSpy).toHaveBeenCalledWith(
      '[EpisodeCompletion] Goal unlock spawn failed (non-blocking):', 'g-bad', expect.any(String)
    );
  });

  it('skips soft-deleted goals', async () => {
    resetModels();
    const goals = [
      ...defaultGoals(),
      { id: 'g-deleted', title: 'Deleted goal', priority: 1, target_metric: 'custom', current_value: 9, target_value: 10, unlocks_on_complete: ['Ghost deal'], deleted_at: new Date('2026-09-01') },
    ];
    const { sequelize, queries } = makeSequelize({ goals });

    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    const goalSelect = queries.find(q => /SELECT .* FROM career_goals/s.test(q.sql));
    expect(goalSelect.sql).toMatch(/deleted_at IS NULL/);
    const ids = goalUpdates(queries).map(q => q.opts.replacements.id);
    expect(ids).not.toContain('g-deleted');
    expect(ids).toHaveLength(3);
    expect(mockModels.Opportunity.create).not.toHaveBeenCalled();
  });

  it('on safe/fail the goals are untouched but the opportunity is still completed', async () => {
    mockTier = 'fail';
    const opp = resetModels();
    const { sequelize, queries } = makeSequelize();

    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(goalUpdates(queries)).toHaveLength(0);
    expect(opp.update).toHaveBeenCalledTimes(1);
  });

  it('a second call on an already-accepted episode changes nothing and does not call the hook', async () => {
    const opp = resetModels();
    const { sequelize, queries } = makeSequelize({ evaluationStatus: 'accepted' });

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.already_completed).toBe(true);
    expect(queries).toHaveLength(1); // only the episode load
    expect(mockModels.Episode.findByPk).not.toHaveBeenCalled();
    expect(mockModels.Opportunity.findOne).not.toHaveBeenCalled();
    expect(opp.update).not.toHaveBeenCalled();
  });

  it('a hook failure is logged with [EpisodeCompletion] and completion still succeeds', async () => {
    resetModels();
    mockModels.Episode.findByPk = jest.fn(async () => { throw new Error('db down'); });
    const { sequelize } = makeSequelize();

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.episode_id).toBe(EPISODE_ID);
    expect(result.career.opportunities_advanced).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      '[EpisodeCompletion] Opportunity completion failed (non-blocking):', 'db down'
    );
  });
});
