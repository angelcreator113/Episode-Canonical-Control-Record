/**
 * services/whichLala (2026-10-24): one rule for which Lala, for the
 * Relationships page and the writers. The registry holding most of the cast
 * first, then her key over her name, then a Pulse profile, then the newest.
 */
const { findLala, lalaId } = require('../../../src/services/whichLala');

const L = (id, registry_id, f = {}) => ({ id, registry_id, by_key: true, has_profile: false, updated_at: '2026-10-01T00:00:00Z', ...f });
const dbWith = (lalas, links = []) => {
  const query = jest.fn(async (sql) => (/FROM social_profiles/.test(sql) ? [links] : [lalas]));
  return { sequelize: { query }, query };
};

describe('which Lala', () => {
  test('none: null', async () => {
    expect(await findLala(dbWith([]))).toBeNull();
    expect(await lalaId(dbWith([]))).toBeNull();
  });

  test('one: her, without reading the cast', async () => {
    const db = dbWith([L('a', 'r1')]);
    expect(await findLala(db)).toEqual({ id: 'a', registry_id: 'r1' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test("the registry holding most of the cast wins over a newer Lala with a profile (the page's rule, now everyone's)", async () => {
    const lalas = [L('small', 'r2', { has_profile: true, updated_at: '2026-10-20T00:00:00Z' }), L('big', 'r1')];
    const links = [{ id: 'm', registry_id: 'r1' }, { id: 'j', registry_id: 'r1' }, { id: 'd', registry_id: 'r2' }];
    expect(await lalaId(dbWith(lalas, links))).toBe('big');
  });

  test('then her key over her name, then a Pulse profile, then the newest', async () => {
    expect(await lalaId(dbWith([L('byName', 'r1', { by_key: false }), L('byKey', 'r2')]))).toBe('byKey');
    expect(await lalaId(dbWith([L('plain', 'r1'), L('withProfile', 'r2', { has_profile: true })]))).toBe('withProfile');
    expect(await lalaId(dbWith([L('old', 'r1'), L('new', 'r2', { updated_at: '2026-10-22T00:00:00Z' })]))).toBe('new');
  });

  test('links handed in save the cast read; a plain sequelize works too', async () => {
    const query = jest.fn(async () => [[L('x', 'r1'), L('y', 'r2')]]);
    expect(await lalaId({ query }, { links: [{ id: 'p', registry_id: 'r2' }] })).toBe('y');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
