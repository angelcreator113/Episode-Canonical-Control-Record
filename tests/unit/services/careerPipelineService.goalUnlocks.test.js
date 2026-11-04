/**
 * careerPipelineService — spawnGoalUnlocks refactor and onEpisodeCompleted
 * scope (Task #1817). Models are mocked; no DB.
 *
 *  - onOpportunityAdvanced (manual Advance) writes no goal progress: goals
 *    move only from the ledger and character_state (step 17, goal sync).
 *  - onEpisodeCompleted completes the opportunity only.
 */

const {
  onOpportunityAdvanced,
  onEpisodeCompleted,
  spawnGoalUnlocks,
} = require('../../../src/services/careerPipelineService');

const SHOW_ID = 'show-1';

function makeGoal(fields) {
  const goal = { status: 'active', priority: 3, unlocks_on_complete: [], ...fields };
  goal.update = jest.fn(async (patch) => { Object.assign(goal, patch); return goal; });
  goal.toJSON = () => {
    const { update: _u, toJSON: _t, ...plain } = goal;
    return { ...plain };
  };
  return goal;
}

function makeModels({ opp, goals = [] }) {
  let created = 0;
  return {
    Opportunity: {
      findByPk: jest.fn(async (id) => (opp && id === opp.id ? opp : null)),
      findOne: jest.fn(async ({ where }) => (opp && where.episode_id === 'episode-1' ? opp : null)),
      create: jest.fn(async (data) => ({ ...data, id: data.id || `spawned-${++created}` })),
    },
    CareerGoal: { findAll: jest.fn(async () => goals) },
    Episode: { findByPk: jest.fn(async () => ({ id: 'episode-1', episode_number: 7, total_income: 500 })) },
    WorldEvent: { findOne: jest.fn(async () => null) },
    sequelize: { query: jest.fn(async () => [[], 0]) },
  };
}

describe('onOpportunityAdvanced writes no goal progress', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  // Goals move only from the ledger (coins) and character_state (stats), in
  // completeEpisode's step 17 and goal sync. Advance used to add the payment
  // and guessed stat bumps straight into career_goals.current_value.
  it.each(['completed', 'paid'])('a prestige-7 brand_deal paying 500 advanced to %s changes no goal', async (status) => {
    const opp = { id: 'opp-1', show_id: SHOW_ID, opportunity_type: 'brand_deal', prestige: 7, payment_amount: 500 };
    const goals = [
      makeGoal({ id: 'g-coins', title: 'Coins', target_metric: 'coins', current_value: 9800, target_value: 10000, unlocks_on_complete: ['Next deal'] }),
      makeGoal({ id: 'g-rep', title: 'Rep', target_metric: 'reputation', current_value: 9, target_value: 10 }),
      makeGoal({ id: 'g-inf', title: 'Inf', target_metric: 'influence', current_value: 2, target_value: 10 }),
      makeGoal({ id: 'g-bt', title: 'Trust', target_metric: 'brand_trust', current_value: 1, target_value: 10 }),
    ];
    const models = makeModels({ opp, goals });

    const result = await onOpportunityAdvanced('opp-1', status, models);

    expect(result).toEqual({ goals_updated: [], goals_completed: [], unlocks: [], note: expect.stringMatching(/not changed/) });
    for (const g of goals) expect(g.update).not.toHaveBeenCalled();
    expect(goals.map(g => g.current_value)).toEqual([9800, 9, 2, 1]);
    expect(models.sequelize.query).not.toHaveBeenCalled();
    expect(models.Opportunity.create).not.toHaveBeenCalled();
  });

  it('ignores non-completion statuses', async () => {
    const models = makeModels({ opp: { id: 'opp-1', show_id: SHOW_ID } });
    const result = await onOpportunityAdvanced('opp-1', 'booked', models);
    expect(result).toEqual({ goals_updated: [], goals_completed: [], unlocks: [] });
    expect(models.CareerGoal.findAll).not.toHaveBeenCalled();
  });
});

describe('spawnGoalUnlocks', () => {
  it('returns [] and creates nothing when there are no unlocks', async () => {
    const models = makeModels({});
    expect(await spawnGoalUnlocks({ id: 'g', title: 'G', unlocks_on_complete: [] }, SHOW_ID, models)).toEqual([]);
    expect(await spawnGoalUnlocks({ id: 'g', title: 'G', unlocks_on_complete: null }, SHOW_ID, models)).toEqual([]);
    expect(models.Opportunity.create).not.toHaveBeenCalled();
  });

  it('throws on a malformed JSON string, as the inline code did', async () => {
    await expect(spawnGoalUnlocks({ id: 'g', title: 'G', unlocks_on_complete: '{nope' }, SHOW_ID, makeModels({})))
      .rejects.toThrow(SyntaxError);
  });
});

describe('onEpisodeCompleted completes the opportunity only', () => {
  it('moves a booked opportunity to completed and touches no goals', async () => {
    const opp = { id: 'opp-1', name: 'Deal', show_id: SHOW_ID, status: 'booked', status_history: [], prestige: 7, payment_amount: 500 };
    opp.update = jest.fn(async (p) => Object.assign(opp, p));
    const models = makeModels({ opp, goals: [makeGoal({ id: 'g', target_metric: 'coins', current_value: 0, target_value: 10 })] });

    const result = await onEpisodeCompleted('episode-1', SHOW_ID, models);

    expect(result).toEqual({ opportunities_advanced: [{ id: 'opp-1', name: 'Deal', from: 'booked', to: 'completed' }], opportunities_unaccepted: [] });
    expect(opp.update).toHaveBeenCalledTimes(1);
    expect(models.CareerGoal.findAll).not.toHaveBeenCalled();
    // no income credit: the only raw SQL is the world_events fallback lookup
    expect(models.sequelize.query.mock.calls.some(([sql]) => /career_goals/.test(sql))).toBe(false);
  });

  it('leaves an opportunity outside booked/preparing/active alone', async () => {
    const opp = { id: 'opp-1', name: 'Deal', show_id: SHOW_ID, status: 'completed', status_history: [] };
    opp.update = jest.fn();
    const models = makeModels({ opp });

    const result = await onEpisodeCompleted('episode-1', SHOW_ID, models);

    expect(result).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    expect(opp.update).not.toHaveBeenCalled();
  });

  // Scheduling and Start Episode never accept an offer by themselves, so an
  // episode can complete with its offer still open. It is not completed
  // (only accepted ones are) but reported and logged for review.
  it.each(['offered', 'considering', 'negotiating', 'held'])(
    "reports a linked opportunity still '%s' as unaccepted and leaves it as it is",
    async (status) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const opp = { id: 'opp-1', name: 'Deal', show_id: SHOW_ID, status, status_history: [] };
      opp.update = jest.fn();
      const models = makeModels({ opp });

      const result = await onEpisodeCompleted('episode-1', SHOW_ID, models);

      expect(result).toEqual({
        opportunities_advanced: [],
        opportunities_unaccepted: [{ id: 'opp-1', name: 'Deal', status }],
      });
      expect(opp.update).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`is still ${status}, not accepted`));
      warn.mockRestore();
    }
  );

  it('a declined one is a decision, not left open: neither completed nor reported', async () => {
    const opp = { id: 'opp-1', name: 'Deal', show_id: SHOW_ID, status: 'declined', status_history: [] };
    opp.update = jest.fn();
    const result = await onEpisodeCompleted('episode-1', SHOW_ID, makeModels({ opp }));
    expect(result).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    expect(opp.update).not.toHaveBeenCalled();
  });
});
