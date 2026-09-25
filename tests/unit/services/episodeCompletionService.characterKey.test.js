/**
 * episodeCompletionService.completeEpisode — character_state key
 *
 * Task #1816: completeEpisode used to read, auto-seed and write history
 * under character_key 'justawoman' while every screen reads 'lala'. Per the
 * F-Sec-3 decision (canonical character_key for all character_state is
 * 'lala') it now reads and writes 'lala'. sequelize.query is mocked; no DB.
 */

jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 0, total_expenses: 0 },
    balance_before: 500,
    balance_after: 500,
    milestones_triggered: [],
    transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));

// Keep the real wardrobe router (and its model graph) out of this test;
// completeEpisode skips outfit scoring when getOutfitScore is absent.
jest.mock('../../../src/routes/wardrobe', () => ({}));

// Task #1817: completeEpisode now calls careerPipelineService.onEpisodeCompleted
// with require('../models'). Keep the real model graph (and any DB) out of
// this character_key test; the hook has its own suite.
jest.mock('../../../src/models', () => ({}));
jest.mock('../../../src/services/careerPipelineService', () => ({
  onEpisodeCompleted: jest.fn(async () => ({ opportunities_advanced: [] })),
  spawnGoalUnlocks: jest.fn(async () => []),
}));

const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';

function makeSequelize({ existingState = null } = {}) {
  const queries = [];
  const query = jest.fn(async (sql, opts = {}) => {
    queries.push({ sql, opts });
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{ id: EPISODE_ID, title: 'Ep', episode_number: 1, show_id: SHOW_ID, evaluation_status: 'draft' }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) {
      return existingState ? [existingState] : [];
    }
    if (/^\s*SELECT/.test(sql)) return [];
    // Task #1933: the character_state write is conditional and returns the new balance.
    if (/UPDATE character_state\b[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: 500 }], 1];
    return [[], 0];
  });
  return { queries, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

const touchesCharacterState = q => /character_state/.test(q.sql);

describe("completeEpisode uses character_key 'lala' (Task #1816)", () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("reads the 'lala' row, updates that row, and writes 'lala' history", async () => {
    const { sequelize, queries } = makeSequelize({
      existingState: { id: 'state-lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 },
    });

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);
    expect(result.episode_id).toBe(EPISODE_ID);

    const csQueries = queries.filter(touchesCharacterState);
    expect(csQueries.length).toBeGreaterThan(0);
    for (const q of csQueries) {
      expect(q.sql).not.toMatch(/justawoman/);
    }

    const read = csQueries.find(q => /SELECT \* FROM character_state/.test(q.sql));
    expect(read.sql).toMatch(/character_key = 'lala'/);

    // No auto-seed when the 'lala' row exists.
    expect(csQueries.find(q => /INSERT INTO character_state\s*\(/.test(q.sql))).toBeUndefined();

    const update = csQueries.find(q => /UPDATE character_state/.test(q.sql));
    expect(update.opts.replacements.stateId).toBe('state-lala');

    const history = csQueries.find(q => /INSERT INTO character_state_history/.test(q.sql));
    expect(history.sql).toMatch(/VALUES \(:id, :showId, 'lala',/);
  });

  it("auto-seeds a 'lala' row when none exists and updates the seeded row", async () => {
    const { sequelize, queries } = makeSequelize({ existingState: null });

    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    const seed = queries.find(q => /INSERT INTO character_state\s*\(/.test(q.sql));
    expect(seed).toBeDefined();
    expect(seed.sql).toMatch(/VALUES \(:id, :showId, 'lala',/);

    const update = queries.find(q => /UPDATE character_state/.test(q.sql));
    expect(update.opts.replacements.stateId).toBe(seed.opts.replacements.id);

    for (const q of queries.filter(touchesCharacterState)) {
      expect(q.sql).not.toMatch(/justawoman/);
    }
  });
});
