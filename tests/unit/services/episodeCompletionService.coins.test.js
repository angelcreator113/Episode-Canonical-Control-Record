/**
 * episodeCompletionService.completeEpisode — coins never go below zero
 * (Task #1933).
 *
 * On main, completion added the episode's coin delta (financial net + tier
 * reward + paid bonus) to the balance it had read and wrote the total back
 * (`SET coins = :coins`), with only applyDeltas' −9999 floor. An episode
 * whose entry cost, wardrobe and extras exceeded Lala's balance left
 * character_state negative. Now the financials are computed first without
 * writing (finalizeEpisodeFinancials dryRun) and a completion that would go
 * below zero is refused before any write; the coin write itself is
 * conditional (changeCoins), so a spend that lands after the read is
 * refused too.
 *
 * sequelize.query is a small in-memory character_state; no database.
 */

const mockFinance = { total_income: 0, total_expenses: 0 };
jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { ...mockFinance },
    balance_before: 0,
    balance_after: 0,
    milestones_triggered: [],
    transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));
jest.mock('../../../src/routes/wardrobe', () => ({}));
jest.mock('../../../src/models', () => ({}));
jest.mock('../../../src/services/careerPipelineService', () => ({
  onEpisodeCompleted: jest.fn(async () => ({ opportunities_advanced: [] })),
  spawnGoalUnlocks: jest.fn(async () => []),
}));

const { completeEpisode } = require('../../../src/services/episodeCompletionService');
const { finalizeEpisodeFinancials } = require('../../../src/services/financialTransactionService');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';

/**
 * @param {number} coins what the row holds
 * @param {number} [readCoins] what completion's read returns (a stale read
 *   models a spend that landed after it); defaults to `coins`
 */
function makeDb(coins, readCoins = coins) {
  const row = { id: 'state-lala', coins, reputation: 3, brand_trust: 2, influence: 2, stress: 1 };
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    statements.push({ sql, replacements: r });
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{ id: EPISODE_ID, title: 'Ep', episode_number: 1, show_id: SHOW_ID, evaluation_status: 'draft' }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) return [{ ...row, coins: readCoins }];
    if (/UPDATE character_state[\s\S]*RETURNING coins/.test(sql)) {
      const delta = Number(r.delta);
      if (r.stateId === row.id && (delta >= 0 || row.coins + delta >= 0)) {
        row.coins += delta;
        return [[{ coins: row.coins }], 1];
      }
      return [[], 0];
    }
    if (/UPDATE character_state\s+SET coins = :coins/.test(sql)) { // main
      row.coins = Number(r.coins);
      return [[], 1];
    }
    if (/SELECT coins FROM character_state WHERE id = :stateId/.test(sql)) return [[{ coins: row.coins }], 1];
    if (/^\s*SELECT/.test(sql)) return [];
    return [[], 0];
  });
  return { row, statements, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

const writes = (statements, re) => statements.filter((s) => re.test(s.sql));

describe('completeEpisode never takes coins below zero (Task #1933)', () => {
  beforeEach(() => {
    finalizeEpisodeFinancials.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('an episode costing more than the balance is refused before any write', async () => {
    Object.assign(mockFinance, { total_income: 0, total_expenses: 600 });
    const { row, statements, sequelize } = makeDb(350);

    // On main this resolves and writes coins = 350 − 600 + tier reward.
    await expect(completeEpisode(EPISODE_ID, SHOW_ID, sequelize)).rejects.toMatchObject({
      code: 'INSUFFICIENT_COINS', have: 350,
    });
    expect(row.coins).toBe(350);
    // Only the write-free preview ran; no ledger rows, no evaluation saved.
    expect(finalizeEpisodeFinancials).toHaveBeenCalledTimes(1);
    expect(finalizeEpisodeFinancials.mock.calls[0][3]).toEqual({ dryRun: true });
    expect(writes(statements, /INSERT INTO financial_transactions/)).toEqual([]);
    expect(writes(statements, /UPDATE character_state/)).toEqual([]);
    expect(writes(statements, /UPDATE episodes SET evaluation_json/)).toEqual([]);
  });

  test('a spend that landed after the read is refused by the conditional write', async () => {
    Object.assign(mockFinance, { total_income: 0, total_expenses: 600 });
    // Completion reads 1000; the row already holds 100.
    const { row, sequelize } = makeDb(100, 1000);

    // On main: coins = 1000 − 600 + tier reward, erasing the other spend.
    await expect(completeEpisode(EPISODE_ID, SHOW_ID, sequelize)).rejects.toMatchObject({
      code: 'INSUFFICIENT_COINS', have: 100,
    });
    expect(row.coins).toBe(100);
  });

  test('a covered episode moves coins by the delta and reports the balance the database returned', async () => {
    Object.assign(mockFinance, { total_income: 0, total_expenses: 200 });
    const { row, statements, sequelize } = makeDb(350);

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    const update = writes(statements, /UPDATE character_state/)[0];
    expect(update.sql).toMatch(/coins = coins \+ :delta/);
    expect(update.sql).toMatch(/coins \+ :delta >= 0/);
    expect(update.replacements.stateId).toBe('state-lala');
    expect(row.coins).toBe(350 + update.replacements.delta);
    expect(row.coins).toBeGreaterThanOrEqual(0);
    expect(result.new_state.coins).toBe(row.coins);
  });

  test('income is never refused, even on a row that is already negative', async () => {
    Object.assign(mockFinance, { total_income: 1000, total_expenses: 0 });
    const { row, sequelize } = makeDb(-100);

    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);
    expect(row.coins).toBeGreaterThan(0);
  });
});
