/**
 * episodeCompletionService.completeEpisode — deliverables untouched
 * (Task #1815, slice 1b; docs/EVENT_EPISODE_FLOW.md §8(t) item 4).
 *
 * "Completing an episode never means deliverables were fulfilled." A
 * deliverable moves only through the status POST in
 * src/routes/eventDeliverables.js. This pins that completion issues no
 * write to event_deliverables — no raw SQL naming the table on either
 * query path, and no call on the EventDeliverable model — for an episode
 * whose event owes deliverables in every status.
 *
 * sequelize.query and the model layer are mocked; no DB. The real
 * careerPipelineService.onEpisodeCompleted runs against the mocked models.
 */

const fs = require('fs');
const path = require('path');

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

const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';
const EVENT_ID = 'event-1';

// Every model method a write could go through.
const WRITE_METHODS = ['update', 'create', 'bulkCreate', 'upsert', 'destroy', 'restore', 'increment', 'decrement', 'findAll', 'findOne', 'findByPk'];

function resetModels() {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  const opp = {
    id: 'opp-1', show_id: SHOW_ID, name: 'Maison Belle campaign', opportunity_type: 'brand_deal',
    prestige: 7, payment_amount: 500, status: 'booked', status_history: [],
  };
  opp.update = jest.fn(async (patch) => { Object.assign(opp, patch); return opp; });
  const eventDeliverable = {};
  for (const m of WRITE_METHODS) eventDeliverable[m] = jest.fn(async () => null);
  Object.assign(mockModels, {
    Episode: { findByPk: jest.fn(async () => ({ id: EPISODE_ID, episode_number: 7, total_income: 500, total_expenses: 0 })) },
    WorldEvent: { findOne: jest.fn(async () => null) },
    Opportunity: {
      findByPk: jest.fn(async () => null),
      findOne: jest.fn(async ({ where }) => (where.episode_id === EPISODE_ID ? opp : null)),
      create: jest.fn(async (data) => ({ ...data, id: 'spawned' })),
    },
    CareerGoal: { findAll: jest.fn(async () => []) },
    EventDeliverable: eventDeliverable,
    sequelize: { query: jest.fn(async () => [[], 0]) },
  });
  return { opp, eventDeliverable };
}

// The event owes one deliverable in each status; completion must leave
// every one as it is.
const DELIVERABLES = [
  { id: 'd-pending', event_id: EVENT_ID, status: 'pending', episode_id: EPISODE_ID },
  { id: 'd-completed', event_id: EVENT_ID, status: 'completed', episode_id: EPISODE_ID },
  { id: 'd-submitted', event_id: EVENT_ID, status: 'submitted', episode_id: EPISODE_ID },
  { id: 'd-approved', event_id: EVENT_ID, status: 'approved', episode_id: EPISODE_ID },
];

function makeSequelize() {
  const queries = [];
  const query = jest.fn(async (sql, opts = {}) => {
    queries.push({ sql, opts });
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{
        id: EPISODE_ID, title: 'Ep', episode_number: 7, show_id: SHOW_ID,
        evaluation_status: 'draft', evaluation_json: null, total_income: 500, total_expenses: 0,
      }];
    }
    if (/FROM world_events WHERE used_in_episode_id = :episodeId/.test(sql)) {
      return [{
        id: EVENT_ID, show_id: SHOW_ID, name: 'Maison Belle Gala', prestige: 7, dress_code: 'black tie',
        used_in_episode_id: EPISODE_ID, is_paid: true, payment_amount: 500,
      }];
    }
    if (/FROM episode_todo_lists/.test(sql)) {
      return [{ social_tasks: [{ slot: 'pre', task: 'Post a teaser', completed: true, required: true }] }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) {
      return [{ id: 'state-lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 }];
    }
    if (/event_deliverables/.test(sql)) {
      // Should never be reached; answer like the table would so a read
      // that slipped in would not crash the run and hide the assertion.
      return /^\s*SELECT/.test(sql) ? DELIVERABLES.map((d) => ({ ...d })) : [[], 0];
    }
    if (/^\s*SELECT/.test(sql)) return [];
    // Task #1933: the character_state write is conditional and returns the new balance.
    if (/UPDATE character_state\b[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: 500 }], 1];
    return [[], 0];
  });
  return { queries, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

const touchesDeliverables = (sql) => /event_deliverables/i.test(sql);

describe('completeEpisode leaves deliverables untouched (Task #1815, §8(t) item 4)', () => {
  let errorSpy;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('completes the episode without any UPDATE or INSERT on event_deliverables', async () => {
    const { eventDeliverable } = resetModels();
    const { sequelize, queries } = makeSequelize();

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    // The run really completed (not an early return).
    expect(result.episode_id).toBe(EPISODE_ID);
    expect(queries.some((q) => /UPDATE episodes/.test(q.sql))).toBe(true);

    // The passed-in sequelize and the model layer's sequelize: no write
    // to event_deliverables on either.
    const allSql = [
      ...queries.map((q) => q.sql),
      ...mockModels.sequelize.query.mock.calls.map(([sql]) => sql),
    ];
    expect(allSql.filter((sql) => /^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql) && touchesDeliverables(sql))).toEqual([]);
    // Nor a read: completion does not consult deliverables at all.
    expect(allSql.filter(touchesDeliverables)).toEqual([]);

    for (const m of WRITE_METHODS) expect(eventDeliverable[m]).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('episodeCompletionService.js names neither the table nor the model', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'services', 'episodeCompletionService.js'), 'utf8');
    expect(src).not.toMatch(/event_deliverables/);
    expect(src).not.toMatch(/EventDeliverable/);
  });
});
