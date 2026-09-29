/**
 * episodeCompletionService.completeEpisode — coins come from the ledger and
 * never go below zero (Task #1933; D1, docs/EVENT_EPISODE_FLOW.md §8(x) and
 * §8(y) Q6, Task #2247).
 *
 * Before D1, completion moved character_state.coins by its own delta
 * (financial net + tier reward + paid bonus), so the event reward and
 * milestone payouts reached the ledger but never the coins, and a finalize
 * run alone before Complete left the two apart. Now completion reads the
 * ledger balance under the show lock (lockLedgerBalance), books its rows,
 * recomputes coins from the ledger (syncCoinsFromLedger), and refuses —
 * rolling back every row — a completion that spends Lala below zero.
 *
 * sequelize.query is a small in-memory stand-in and coinLedgerSync is
 * mocked; the ledger itself is covered in
 * tests/integration/coinLedgerSync.integration.test.js and
 * tests/integration/completeFinalizeCoinSync.integration.test.js.
 */

const mockFinance = { total_income: 0, total_expenses: 0 };
const mockLedger = { before: 0, after: 0 };
const mockOrder = [];
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
jest.mock('../../../src/services/coinLedgerSync', () => ({
  lockLedgerBalance: jest.fn(async () => { mockOrder.push('lock'); return mockLedger.before; }),
  syncCoinsFromLedger: jest.fn(async () => { mockOrder.push('sync'); return { balance: mockLedger.after, rows_updated: 1 }; }),
}));
jest.mock('../../../src/routes/wardrobe', () => ({}));
jest.mock('../../../src/models', () => ({}));
jest.mock('../../../src/services/careerPipelineService', () => ({
  onEpisodeCompleted: jest.fn(async () => ({ opportunities_advanced: [] })),
  spawnGoalUnlocks: jest.fn(async () => []),
}));

const { completeEpisode } = require('../../../src/services/episodeCompletionService');
const { finalizeEpisodeFinancials } = require('../../../src/services/financialTransactionService');
const { lockLedgerBalance, syncCoinsFromLedger } = require('../../../src/services/coinLedgerSync');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';

function makeDb(coins = 500) {
  const row = { id: 'state-lala', coins, reputation: 3, brand_trust: 2, influence: 2, stress: 1 };
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    statements.push({ sql, replacements: r });
    if (/INSERT INTO financial_transactions/.test(sql)) mockOrder.push('ledger-row');
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{ id: EPISODE_ID, title: 'Ep', episode_number: 1, show_id: SHOW_ID, evaluation_status: 'draft' }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) return [{ ...row }];
    if (/UPDATE character_state[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: row.coins }], 1];
    if (/^\s*SELECT/.test(sql)) return [];
    return [[], 0];
  });
  return { statements, sequelize: { query, QueryTypes: { SELECT: 'SELECT' }, transaction: async (a, b) => (typeof a === 'function' ? a({ id: 'tx' }) : b({ id: 'tx' })) } };
}

const writes = (statements, re) => statements.filter((s) => re.test(s.sql));

describe('completeEpisode takes coins from the ledger (Task #1933, D1)', () => {
  beforeEach(() => {
    finalizeEpisodeFinancials.mockClear();
    lockLedgerBalance.mockClear();
    syncCoinsFromLedger.mockClear();
    mockOrder.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a completion that spends Lala below zero is refused, and nothing after the check is written', async () => {
    Object.assign(mockFinance, { total_income: 0, total_expenses: 600 });
    Object.assign(mockLedger, { before: 350, after: -250 });
    const { statements, sequelize } = makeDb();

    await expect(completeEpisode(EPISODE_ID, SHOW_ID, sequelize)).rejects.toMatchObject({
      code: 'INSUFFICIENT_COINS', needed: 600, have: 350, action: 'episode_completion',
    });
    // Thrown inside the transaction, so the ledger rows roll back (the
    // integration test shows the rollback); nothing after the check runs.
    expect(writes(statements, /UPDATE character_state/)).toEqual([]);
    expect(writes(statements, /INSERT INTO character_state_history/)).toEqual([]);
    expect(writes(statements, /UPDATE episodes SET evaluation_json/)).toEqual([]);
  });

  test('coins are the synced ledger balance, recomputed after every ledger row, and the delta is the ledger movement', async () => {
    Object.assign(mockFinance, { total_income: 0, total_expenses: 200 });
    Object.assign(mockLedger, { before: 350, after: 225 }); // −200 finalize, +75 tier reward
    const { statements, sequelize } = makeDb();

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(lockLedgerBalance).toHaveBeenCalledWith(sequelize, SHOW_ID, { transaction: { id: 'tx' } });
    expect(syncCoinsFromLedger).toHaveBeenCalledWith(sequelize, SHOW_ID, { transaction: { id: 'tx' } });
    // The lock comes before finalize's rows; the sync after the last row.
    expect(mockOrder[0]).toBe('lock');
    expect(mockOrder[mockOrder.length - 1]).toBe('sync');
    expect(finalizeEpisodeFinancials).toHaveBeenCalledTimes(1);
    expect(finalizeEpisodeFinancials.mock.calls[0][3]).toEqual({ transaction: { id: 'tx' } });

    expect(result.new_state.coins).toBe(225);
    expect(result.stat_deltas.coins).toBe(-125);
    // The other stats are still written; coins are not moved by a delta.
    const update = writes(statements, /UPDATE character_state/)[0];
    expect(update.replacements.delta).toBe(0);
    expect(update.sql).toMatch(/reputation = :reputation/);
  });

  test('income is never refused, even when a legacy balance is still below zero', async () => {
    Object.assign(mockFinance, { total_income: 50, total_expenses: 0 });
    Object.assign(mockLedger, { before: -100, after: -50 });
    const { sequelize } = makeDb();

    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.new_state.coins).toBe(-50);
  });
});
