/**
 * utils/wardrobeInWorld (Task #3020): the real-world fields a game response
 * drops. The list is pinned to the Wardrobe model's real-world attributes,
 * the migration that added them (#2873) and the browse-pool clean-up
 * migration, so a new real-world column cannot be added without being
 * stripped from the game.
 */
const fs = require('fs');
const path = require('path');
const { REAL_WORLD_FIELDS, withoutRealFields, allWithoutRealFields } = require('../../../src/utils/wardrobeInWorld');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sorted = (a) => [...a].sort();
const isRealWorld = (k) => /^real_|^affiliate_/.test(k);

describe('wardrobeInWorld', () => {
  test('the list is every real-world attribute of the Wardrobe model', () => {
    // Defined on a Sequelize that never connects: only the attributes are read.
    const { Sequelize } = require('sequelize');
    const offline = new Sequelize('postgres://nobody@localhost:1/none', { logging: false });
    const Wardrobe = require('../../../src/models/Wardrobe')(offline);
    expect(sorted(Object.keys(Wardrobe.rawAttributes).filter(isRealWorld))).toEqual(sorted(REAL_WORLD_FIELDS));
  });

  test("the list is the #2873 migration's columns", () => {
    const text = read('src/migrations/20261010200000-add-real-fields-to-wardrobe.js');
    const block = text.slice(text.indexOf('const COLUMNS'), text.indexOf('});', text.indexOf('const COLUMNS')));
    const keys = [...block.matchAll(/^\s+([a-z_]+):\s*\{/gm)].map((m) => m[1]);
    expect(sorted(keys)).toEqual(sorted(REAL_WORLD_FIELDS));
  });

  test("the browse-pool migration strips the same list", () => {
    const migration = require('../../../src/migrations/20261012120000-strip-real-fields-from-browse-pools');
    expect(sorted(migration.REAL_WORLD_FIELDS)).toEqual(sorted(REAL_WORLD_FIELDS));
  });

  test('withoutRealFields drops the eleven and keeps the in-world fields', () => {
    const row = { id: 'w1', name: 'Dress', brand: 'Maison Belle', price: 420, real_brand: 'Reformation', real_price_paid: 128, affiliate_url: 'x', real_source: 'manual' };
    expect(withoutRealFields(row)).toEqual({ id: 'w1', name: 'Dress', brand: 'Maison Belle', price: 420 });
    expect(row.real_brand).toBe('Reformation');   // the caller's row is not changed
  });

  test('a model instance is read through toJSON', () => {
    const instance = { toJSON: () => ({ id: 'w1', real_brand: 'Reformation' }) };
    expect(withoutRealFields(instance)).toEqual({ id: 'w1' });
  });

  test('anything that is not a row comes back as it is', () => {
    expect(withoutRealFields(null)).toBeNull();
    expect(withoutRealFields('x')).toBe('x');
    expect(allWithoutRealFields(undefined)).toBeUndefined();
    expect(allWithoutRealFields([{ real_size: 'S', size: 'S' }])).toEqual([{ size: 'S' }]);
  });

  test('the clean-up migration strips at any depth and says whether it did', () => {
    const { strip } = require('../../../src/migrations/20261012120000-strip-real-fields-from-browse-pools');
    const state = { changed: false };
    expect(strip({ pool: [{ id: 1, real_brand: 'R', nested: { affiliate_url: 'x', keep: 1 } }], n: 2 }, state))
      .toEqual({ pool: [{ id: 1, nested: { keep: 1 } }], n: 2 });
    expect(state.changed).toBe(true);
    const untouched = { changed: false };
    strip({ pool: [{ id: 1, brand: 'B' }] }, untouched);
    expect(untouched.changed).toBe(false);
  });
});
