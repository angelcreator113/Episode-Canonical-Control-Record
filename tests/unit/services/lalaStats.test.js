/**
 * services/lalaStats (Task #3164), with a stand-in database: which rows
 * each stat reads, and its fallbacks. The SQL itself runs against the test
 * database in tests/integration/lalaStats.integration.test.js.
 */
jest.mock('../../../src/services/financialTransactionService', () => ({ getCurrentBalance: jest.fn() }));
jest.mock('../../../src/services/pulseFollowers', () => ({ countAt: jest.fn() }));
jest.mock('../../../src/services/lalaFeedProfile', () => ({ lalaProfileId: jest.fn() }));

const { getCurrentBalance } = require('../../../src/services/financialTransactionService');
const { countAt } = require('../../../src/services/pulseFollowers');
const { lalaProfileId } = require('../../../src/services/lalaFeedProfile');
const { statsAt } = require('../../../src/services/lalaStats');

/** A sequelize stand-in: answers by what the SQL reads; records each call. */
function fakeDb({ laterNet = 0, state = { reputation: 7, influence: 6 }, counted = [], uncounted = [] } = {}) {
  const calls = [];
  const query = jest.fn(async (sql, opts) => {
    calls.push({ sql, replacements: opts.replacements });
    if (sql.includes('FROM financial_transactions')) return [{ net: String(laterNet) }];
    if (sql.includes('FROM character_state WHERE')) return state ? [state] : [];
    if (sql.includes('FROM character_state_history')) return sql.includes('NOT (') ? uncounted : counted;
    throw new Error(`unexpected SQL: ${sql}`);
  });
  return { db: { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } }, calls };
}

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentBalance.mockResolvedValue(1550);
  countAt.mockResolvedValue(62500);
  lalaProfileId.mockResolvedValue(42);
});

test('the present: the balance, the state now and the latest follower count; no history read', async () => {
  const { db, calls } = fakeDb();
  const s = await statsAt(db, 'show-1', undefined);
  expect(s).toMatchObject({ at: null, coins: 1550, reputation: 7, influence: 6, scale: 10, followers: { count: 62500 } });
  expect(calls.map((c) => c.sql).some((q) => q.includes('character_state_history') || q.includes('financial_transactions'))).toBe(false);
  expect(countAt).toHaveBeenCalledWith(db, 'show-1', 42, null);
});

test("coins at a beat: the balance less the episodes that don't count yet (an episode counts at n × 10 + 7)", async () => {
  const { db, calls } = fakeDb({ laterNet: 1100 });
  expect((await statsAt(db, 'show-1', 25)).coins).toBe(450);
  const ledger = calls.find((c) => c.sql.includes('financial_transactions'));
  expect(ledger.sql).toMatch(/NOT \(COALESCE\(e\.episode_number, 0\) \* 10 \+ 7 <= :at\)/);
  expect(ledger.sql).toMatch(/JOIN episodes e ON e\.id = ft\.episode_id/);   // rows on no episode always count
  expect(ledger.replacements).toEqual({ showId: 'show-1', at: 25 });
});

test('reputation and influence: the last snapshot that counts, else before the first that does not, else now', async () => {
  const snap = (rep, inf, dRep, dInf) => ({ state_after_json: { reputation: rep, influence: inf }, deltas_json: { reputation: dRep, influence: dInf } });
  let { db } = fakeDb({ counted: [snap(5, 4, 2, 2), snap(3, 2, 1, 1)], uncounted: [snap(7, 6, 2, 2)] });
  expect(await statsAt(db, 's', 35)).toMatchObject({ reputation: 5, influence: 4 });
  ({ db } = fakeDb({ counted: [], uncounted: [snap(3, 2, 1, 1), snap(5, 4, 2, 2)] }));
  expect(await statsAt(db, 's', 15)).toMatchObject({ reputation: 2, influence: 1 });
  // Clamped to the 0–10 scale; a stat missing from a snapshot falls through to the next source.
  ({ db } = fakeDb({ counted: [{ state_after_json: { influence: 9 } }], uncounted: [snap(0, 9, 3, 1)] }));
  expect(await statsAt(db, 's', 15)).toMatchObject({ reputation: 0, influence: 9 });
  ({ db } = fakeDb({ state: { reputation: 4, influence: 9 } }));
  expect(await statsAt(db, 's', 15)).toMatchObject({ reputation: 4, influence: 9 });
  ({ db } = fakeDb({ state: null }));
  expect(await statsAt(db, 's', 15)).toMatchObject({ reputation: null, influence: null });
});

test('followers: null before her numbers exist, with no Lala profile, or when the read fails', async () => {
  const { db } = fakeDb();
  countAt.mockResolvedValueOnce(null);
  expect((await statsAt(db, 's', 15)).followers).toBeNull();
  expect(countAt).toHaveBeenLastCalledWith(db, 's', 42, 15);
  expect((await statsAt(db, 's', 15, { lalaProfileId: null })).followers).toBeNull();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  countAt.mockRejectedValueOnce(new Error('down'));
  expect((await statsAt(db, 's', 15)).followers).toBeNull();
  expect(console.error).toHaveBeenCalledWith('[LalaStats] follower count read failed:', 'down');
});
