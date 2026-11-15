/**
 * careerPipelineService — spawnGoalUnlocks refactor (Task #1817) and
 * completeOwnerOffer (A2). Models are mocked; no DB.
 *
 *  - onOpportunityAdvanced (manual Advance) writes no goal progress: goals
 *    move only from the ledger and character_state (step 17, goal sync).
 *  - completeOwnerOffer completes the event's own offer only, and writes no
 *    goals either.
 */

// The transition's audit entry (middleware/auditLog reads models.ActivityLog).
const mockLogActivity = jest.fn(async () => ({}));
jest.mock('../../../src/models', () => ({ models: { ActivityLog: { logActivity: (...args) => mockLogActivity(...args) } } }));

const {
  onOpportunityAdvanced,
  completeOwnerOffer,
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

// onEpisodeCompleted was removed on 2026-11-15 (Evoni's ruling): it picked an
// offer by the event's pointer, else by episode, else by event, outside any
// transaction. completeOwnerOffer moves only the owner the eligibility answer
// established. Its database behaviour, and the admin route's, are in
// tests/integration/compensationEligibility.integration.test.js.
describe('completeOwnerOffer completes the owner only', () => {
  const TX = { id: 'tx' };
  const row = (status, id = 'opp-1') => ({ id, name: 'Deal', show_id: SHOW_ID, status, status_history: [{ status }], event_id: 'event-1', episode_id: null });
  const resolutionFor = (owner, rows) => Object.defineProperty({ owner: owner ? { id: owner.id, name: owner.name, status: owner.status } : null }, 'rows', { value: rows });
  const makeSequelize = (moved = true) => ({ query: jest.fn(async () => [moved ? [{ id: 'opp-1' }] : [], moved ? 1 : 0]) });
  const call = (sequelize, resolution) => completeOwnerOffer(sequelize, {
    resolution, episodeId: 'episode-1', episodeNumber: 7, showId: SHOW_ID, eventId: 'event-1', actor: { id: 'admin-1' }, transaction: TX,
  });
  const logActivity = mockLogActivity;
  beforeEach(() => logActivity.mockClear());

  it('is removed with nothing left exporting it', () => {
    expect(require('../../../src/services/careerPipelineService').onEpisodeCompleted).toBeUndefined();
  });

  it.each(['booked', 'preparing', 'active'])('moves an owner that is %s to completed: one statement, one audit entry, no goals', async (status) => {
    const owner = row(status);
    const sequelize = makeSequelize();
    const result = await call(sequelize, resolutionFor(owner, [owner]));
    expect(result).toEqual({ opportunities_advanced: [{ id: 'opp-1', name: 'Deal', from: status, to: 'completed' }], opportunities_unaccepted: [] });
    expect(sequelize.query).toHaveBeenCalledTimes(1);
    const [sql, opts] = sequelize.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE opportunities SET status = 'completed'[\s\S]*WHERE id = :id AND status = :from/);
    expect(sql).not.toMatch(/career_goals/);
    expect(opts.transaction).toBe(TX);
    expect(opts.replacements).toMatchObject({ id: 'opp-1', from: status, episodeId: 'episode-1' });
    expect(JSON.parse(opts.replacements.history)).toEqual([{ status }, expect.objectContaining({
      status: 'completed', from: status, note: 'Episode 7 completed', by: { id: 'admin-1' }, route: 'episode_completed',
    })]);
    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(logActivity.mock.calls[0][1]).toEqual({ transaction: TX });
  });

  it.each(['completed', 'paid', 'declined', 'cancelled', 'expired', 'archived'])('leaves an owner that is %s alone: nothing written, nothing listed', async (status) => {
    const owner = row(status);
    const sequelize = makeSequelize();
    expect(await call(sequelize, resolutionFor(owner, [owner]))).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    expect(sequelize.query).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  // Scheduling and Start Episode never accept an offer by themselves, so an
  // episode can complete with its offer still open. It is not completed
  // (only accepted ones are) but listed for review.
  it.each(['offered', 'considering', 'negotiating', 'held'])("lists an owner still '%s' as unaccepted and leaves it as it is", async (status) => {
    const owner = row(status);
    const sequelize = makeSequelize();
    expect(await call(sequelize, resolutionFor(owner, [owner]))).toEqual({
      opportunities_advanced: [], opportunities_unaccepted: [{ id: 'opp-1', name: 'Deal', status }],
    });
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('with no owner established it picks nothing, whatever else is linked', async () => {
    const other = row('booked', 'opp-2');
    const sequelize = makeSequelize();
    expect(await call(sequelize, resolutionFor(null, [other]))).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    // An owner named that is not among the locked rows is not one either.
    expect(await call(sequelize, resolutionFor(row('booked'), [other]))).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('a row that moved since it was read is not written over, and no entry is made for it', async () => {
    const owner = row('booked');
    const sequelize = makeSequelize(false);
    expect(await call(sequelize, resolutionFor(owner, [owner]))).toEqual({ opportunities_advanced: [], opportunities_unaccepted: [] });
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('refuses to run outside a transaction', async () => {
    const owner = row('booked');
    await expect(completeOwnerOffer(makeSequelize(), { resolution: resolutionFor(owner, [owner]), episodeId: 'episode-1', showId: SHOW_ID, eventId: 'event-1' }))
      .rejects.toThrow('needs the completion\'s transaction');
  });
});
