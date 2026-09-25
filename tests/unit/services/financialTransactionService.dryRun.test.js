/**
 * finalizeEpisodeFinancials({ dryRun: true }) writes nothing (Task #1933).
 *
 * episodeCompletionService previews an episode's financials with dryRun to
 * refuse, before any write, a completion that would take coins below zero.
 * The preview must compute the same summary as the real run and issue only
 * SELECTs. sequelize.query is mocked; no database.
 */

const { finalizeEpisodeFinancials } = require('../../../src/services/financialTransactionService');

const EVENT = {
  id: 'ev-1', name: 'Gala', prestige: 3, event_type: 'party', dress_code: '',
  cost_coins: 385, is_paid: false, is_free: false, outfit_pieces: null, canon_consequences: null,
};

function makeSequelize() {
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    statements.push(sql);
    if (/SELECT COUNT\(\*\) as cnt FROM financial_transactions/.test(sql)) return [{ cnt: 0 }];
    if (/FROM world_events WHERE used_in_episode_id/.test(sql)) return [EVENT];
    if (opts.type === 'SELECT') return [];
    return [[], 0];
  });
  return { statements, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

describe('finalizeEpisodeFinancials dryRun (Task #1933)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('computes the same summary as the real run and issues no writes', async () => {
    const dry = makeSequelize();
    const preview = await finalizeEpisodeFinancials('ep-1', 'show-1', dry.sequelize, { dryRun: true });

    expect(preview.dry_run).toBe(true);
    expect(preview.summary.total_expenses).toBeGreaterThanOrEqual(385);
    expect(dry.statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql))).toEqual([]);

    const real = makeSequelize();
    const result = await finalizeEpisodeFinancials('ep-1', 'show-1', real.sequelize);
    expect(result.summary.total_income).toBe(preview.summary.total_income);
    expect(result.summary.total_expenses).toBe(preview.summary.total_expenses);
    expect(real.statements.some((sql) => /INSERT INTO financial_transactions/.test(sql))).toBe(true);
  });
});
