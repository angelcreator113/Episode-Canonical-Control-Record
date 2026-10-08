/**
 * services/brainRules selectRules — the shared scope and order for every
 * other reader of the Show Bible (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 25). The
 * guard, the script writer's guard, story evaluation, line rewrites,
 * WriteMode and Amber read franchise_knowledge with their own findAll: no
 * show scope, and in whatever order Postgres returned. Each keeps which
 * entries it takes (its `where`).
 */
const { Op } = require('sequelize');
const {
  selectRules, scopedWhere, RULE_ATTRIBUTES, CRITICAL_OR_ALWAYS_INJECT,
} = require('../../../src/services/brainRules');

const row = (id, severity) => ({ id, title: `Rule ${id}`, content: 'c', category: 'franchise_law', severity, scope: 'franchise', show_id: null });

function makeModel(rows) {
  return { findAll: jest.fn(async () => rows.map((r) => ({ toJSON: () => r }))) };
}

describe('selectRules', () => {
  test('takes active entries by the reader\'s own filter, every show\'s when no show is given', async () => {
    const model = makeModel([]);
    await selectRules(model, { where: { severity: 'critical' } });
    const { where } = model.findAll.mock.calls[0][0];
    expect(where).toEqual({ severity: 'critical', status: 'active' });
    expect(where[Op.or]).toBeUndefined();
    expect(where[Op.and]).toBeUndefined();
  });

  test('with a show: the franchise tier, that show, and show entries not yet assigned', async () => {
    const model = makeModel([]);
    await selectRules(model, { showId: 'show-a', where: { category: 'franchise_law' } });
    const { where } = model.findAll.mock.calls[0][0];
    expect(where).toMatchObject({ category: 'franchise_law', status: 'active' });
    expect(where[Op.or]).toEqual([{ show_id: null }, { show_id: 'show-a' }]);
  });

  test('a reader filter that is itself an OR keeps it, and the scope is ANDed on', async () => {
    const model = makeModel([]);
    await selectRules(model, { showId: 'show-a', where: CRITICAL_OR_ALWAYS_INJECT });
    const { where } = model.findAll.mock.calls[0][0];
    expect(where.status).toBe('active');
    expect(where[Op.or]).toEqual([{ severity: 'critical' }, { always_inject: true }]);
    expect(where[Op.and]).toEqual([{ [Op.or]: [{ show_id: null }, { show_id: 'show-a' }] }]);
    // The shared filter is never changed by a reader's scope.
    expect(Object.getOwnPropertySymbols(CRITICAL_OR_ALWAYS_INJECT)).toEqual([Op.or]);
    expect(Object.isFrozen(CRITICAL_OR_ALWAYS_INJECT)).toBe(true);
    expect(scopedWhere(CRITICAL_OR_ALWAYS_INJECT, null)).toEqual({ status: 'active', [Op.or]: CRITICAL_OR_ALWAYS_INJECT[Op.or] });
  });

  // The book's readers (Evoni's ruling, 2026-10-08): the franchise tier
  // alone, never a show's own canon, even if a show were given.
  test('franchiseOnly takes the franchise tier alone, and keeps the reader\'s own filter', async () => {
    const model = makeModel([]);
    await selectRules(model, { franchiseOnly: true, showId: 'show-a', where: CRITICAL_OR_ALWAYS_INJECT });
    const { where } = model.findAll.mock.calls[0][0];
    expect(where).toMatchObject({ scope: 'franchise', status: 'active' });
    expect(where[Op.or]).toEqual([{ severity: 'critical' }, { always_inject: true }]);
    expect(where[Op.and]).toBeUndefined();
    expect(Object.keys(CRITICAL_OR_ALWAYS_INJECT)).toEqual([]);
  });

  test('orders severity then id whatever order the rows arrive in, and the database is asked for the same order', async () => {
    const rows = [row(5, 'context'), row(3, 'critical'), row(9, 'important'), row(1, 'important'), row(7, 'critical')];
    const a = await selectRules(makeModel(rows));
    const b = await selectRules(makeModel([...rows].reverse()));
    expect(a.map((r) => r.id)).toEqual([3, 7, 1, 9, 5]);
    expect(b).toEqual(a);
    const model = makeModel(rows);
    await selectRules(model);
    expect(model.findAll.mock.calls[0][0].order).toEqual([['severity', 'ASC'], ['id', 'ASC']]);
  });

  test('a limit is the first `limit` in that order, asked of the database too; without one, every entry', async () => {
    const rows = [row(5, 'context'), row(3, 'critical'), row(9, 'important'), row(1, 'important')];
    const model = makeModel(rows);
    const first = await selectRules(model, { limit: 2 });
    expect(first.map((r) => r.id)).toEqual([3, 1]);
    expect(model.findAll.mock.calls[0][0].limit).toBe(2);

    const all = makeModel(rows);
    expect(await selectRules(all)).toHaveLength(4);
    expect(all.findAll.mock.calls[0][0]).not.toHaveProperty('limit');
  });

  test('rows are plain, with the shared attributes unless the reader names its own; no model, no rules', async () => {
    const model = makeModel([row(1, 'critical')]);
    const [rule] = await selectRules(model);
    expect(typeof rule.toJSON).toBe('undefined');
    expect(rule).toEqual(row(1, 'critical'));
    expect(model.findAll.mock.calls[0][0].attributes).toEqual(RULE_ATTRIBUTES);

    const own = makeModel([]);
    await selectRules(own, { attributes: [...RULE_ATTRIBUTES, 'applies_to'] });
    expect(own.findAll.mock.calls[0][0].attributes).toEqual([...RULE_ATTRIBUTES, 'applies_to']);

    expect(await selectRules(null)).toEqual([]);
    expect(await selectRules(undefined, { showId: 'show-a', limit: 3 })).toEqual([]);
  });
});
