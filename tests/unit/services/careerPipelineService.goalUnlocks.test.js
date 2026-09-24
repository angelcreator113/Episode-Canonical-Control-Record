/**
 * careerPipelineService — spawnGoalUnlocks refactor and onEpisodeCompleted
 * scope (Task #1817). Models are mocked; no DB.
 *
 *  - onOpportunityAdvanced (manual Advance) is behaviour-identical after the
 *    unlock-spawning logic moved into spawnGoalUnlocks: it still increments
 *    goals by kind and spawns unlocks for goals it completes.
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

describe('onOpportunityAdvanced after the spawnGoalUnlocks refactor', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('still increments goals by kind for a prestige-7 brand_deal paying 500', async () => {
    const opp = { id: 'opp-1', show_id: SHOW_ID, opportunity_type: 'brand_deal', prestige: 7, payment_amount: 500 };
    const goals = [
      makeGoal({ id: 'g-coins', title: 'Coins', target_metric: 'coins', current_value: 100, target_value: 10000 }),
      makeGoal({ id: 'g-rep', title: 'Rep', target_metric: 'reputation', current_value: 3, target_value: 10 }),
      makeGoal({ id: 'g-inf', title: 'Inf', target_metric: 'influence', current_value: 2, target_value: 10 }),
      makeGoal({ id: 'g-bt', title: 'Trust', target_metric: 'brand_trust', current_value: 1, target_value: 10 }),
      makeGoal({ id: 'g-port', title: 'Portfolio', target_metric: 'portfolio_strength', current_value: 1, target_value: 10 }),
    ];
    const models = makeModels({ opp, goals });

    const result = await onOpportunityAdvanced('opp-1', 'completed', models);

    expect(result.goals_updated.map(g => [g.id, g.added, g.new_value])).toEqual([
      ['g-coins', 500, 600],
      ['g-rep', 2, 5],
      ['g-inf', 2, 4],
      ['g-bt', 2, 3],
    ]);
    expect(goals[4].update).not.toHaveBeenCalled(); // brand_deal adds nothing to portfolio
    expect(result.goals_completed).toEqual([]);
    expect(result.unlocks).toEqual([]);
    expect(models.Opportunity.create).not.toHaveBeenCalled();
  });

  it('still completes a goal that reaches target and spawns its unlocks (array or JSON string)', async () => {
    const opp = { id: 'opp-1', show_id: SHOW_ID, opportunity_type: 'podcast', prestige: 8 };
    const goals = [
      makeGoal({ id: 'g-inf', title: 'Influence 10', priority: 1, target_metric: 'influence', current_value: 9, target_value: 10,
        unlocks_on_complete: ['Keynote invite'] }),
      makeGoal({ id: 'g-rep', title: 'Reputation 10', target_metric: 'reputation', current_value: 8, target_value: 10,
        unlocks_on_complete: JSON.stringify([{ type: 'award_show', description: 'Gala nomination', prestige: 9 }]) }),
    ];
    const models = makeModels({ opp, goals });

    const result = await onOpportunityAdvanced('opp-1', 'paid', models);

    expect(goals[0].update).toHaveBeenCalledWith({ status: 'completed', completed_at: expect.any(Date) });
    expect(goals[1].update).toHaveBeenCalledWith({ status: 'completed', completed_at: expect.any(Date) });
    expect(result.goals_completed).toEqual([{ id: 'g-inf', title: 'Influence 10' }, { id: 'g-rep', title: 'Reputation 10' }]);
    const created = models.Opportunity.create.mock.calls.map(c => c[0]);
    expect(created.map(o => [o.name, o.opportunity_type, o.prestige, o.career_goal_id])).toEqual([
      ['Keynote invite', 'brand_deal', 7, 'g-inf'],
      ['Gala nomination', 'award_show', 9, 'g-rep'],
    ]);
    expect(result.unlocks.map(u => u.source_goal)).toEqual(['Influence 10', 'Reputation 10']);
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

    expect(result).toEqual({ opportunities_advanced: [{ id: 'opp-1', name: 'Deal', from: 'booked', to: 'completed' }] });
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

    expect(result).toEqual({ opportunities_advanced: [] });
    expect(opp.update).not.toHaveBeenCalled();
  });
});
