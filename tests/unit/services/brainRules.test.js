/**
 * services/brainRules — the deterministic, recorded Brain selection
 * (review item 7, 2026-10-04). "Always inject" with 104 marked and a limit
 * of 50 used to mean whichever 50 Postgres returned first, unrecorded.
 */
const { Op } = require('sequelize');
const { selectInjectedRules, brainRulesRecord, orderRules } = require('../../../src/services/brainRules');

const row = (id, severity, extra = {}) => ({ id, title: `Rule ${id}`, content: 'c', category: 'franchise_law', severity, scope: 'franchise', show_id: null, ...extra });

function makeModel(rows) {
  return { findAll: jest.fn(async () => rows.map((r) => ({ toJSON: () => r }))) };
}

describe('selectInjectedRules', () => {
  test('orders by severity then id, takes the first `limit`, and names the rest', async () => {
    const rows = [row(5, 'context'), row(3, 'critical'), row(9, 'important'), row(1, 'important'), row(7, 'critical')];
    const model = makeModel(rows);
    const s = await selectInjectedRules(model, { limit: 3 });
    expect(s.used.map((r) => r.id)).toEqual([3, 7, 1]);
    expect(s.omitted.map((r) => r.id)).toEqual([9, 5]);
    expect(s.eligible).toBe(5);
    expect(s.limit).toBe(3);
    expect(s.rules.map((r) => r.id)).toEqual([3, 7, 1]);
    expect(s.rules[0].content).toBe('c');
    expect(s.used[0]).toEqual({ id: 3, title: 'Rule 3', severity: 'critical', category: 'franchise_law' });
    expect(s.used[0].content).toBeUndefined();
  });

  test('the same Brain always gives the same set, whatever order the rows arrive in', async () => {
    const rows = [row(2, 'important'), row(1, 'important'), row(4, 'critical'), row(3, 'critical')];
    const a = await selectInjectedRules(makeModel(rows), { limit: 2 });
    const b = await selectInjectedRules(makeModel([...rows].reverse()), { limit: 2 });
    expect(a.used).toEqual(b.used);
    expect(a.used.map((r) => r.id)).toEqual([3, 4]);
  });

  test('queries active always_inject rules; with a show, the franchise tier, the show, and unassigned show entries', async () => {
    const model = makeModel([]);
    await selectInjectedRules(model, { showId: 'show-uuid' });
    const where = model.findAll.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'active', always_inject: true });
    expect(where[Op.or]).toEqual([{ show_id: null }, { show_id: 'show-uuid' }]);
    expect(model.findAll.mock.calls[0][0].limit).toBeUndefined();

    const all = makeModel([]);
    await selectInjectedRules(all);
    expect(all.findAll.mock.calls[0][0].where[Op.or]).toBeUndefined();
  });

  test('defaults to a limit of 50 and answers empty without a model', async () => {
    const rows = Array.from({ length: 104 }, (_, i) => row(i + 1, 'important'));
    const s = await selectInjectedRules(makeModel(rows));
    expect(s.used).toHaveLength(50);
    expect(s.omitted).toHaveLength(54);
    expect(s.used[0].id).toBe(1);
    expect(s.omitted[0].id).toBe(51);
    expect(await selectInjectedRules(null)).toEqual({ rules: [], used: [], omitted: [], eligible: 0, limit: 50 });
  });

  test('brainRulesRecord keeps counts and names, never content', () => {
    const s = { used: [{ id: 1, title: 'A', severity: 'critical', category: 'world' }], omitted: [{ id: 2, title: 'B', severity: 'context', category: 'world' }], eligible: 2, limit: 1 };
    expect(brainRulesRecord(s)).toEqual({ limit: 1, eligible: 2, used_count: 1, omitted_count: 1, used: s.used, omitted: s.omitted });
    expect(orderRules([row(2, 'context'), row(1, 'context')]).map((r) => r.id)).toEqual([1, 2]);
  });
});
