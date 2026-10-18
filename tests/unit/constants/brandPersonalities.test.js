/**
 * The brand personalities keep to Evoni's rulings of 2026-10-18: the
 * established canon (constants/lalaverseBrands) takes precedence, every
 * brand has one representative with an authority level, and Jordan Ellis is
 * First Light's Brand Director, not its founder.
 */
const { LALAVERSE_BRANDS_SEED } = require('../../../src/constants/lalaverseBrands');
const {
  AUTHORITY_LEVELS, BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES,
} = require('../../../src/constants/brandPersonalities');

const CANON_FIELDS = ['slug', 'name', 'type', 'category', 'description', 'aesthetic', 'niche', 'founder', 'press_angle'];
const slugs = LALAVERSE_BRANDS_SEED.map((b) => b.slug);

describe('brand personalities', () => {
  test('one personality per established brand, and none repeats a canon field', () => {
    expect(Object.keys(BRAND_PERSONALITIES).sort()).toEqual([...slugs].sort());
    for (const p of Object.values(BRAND_PERSONALITIES)) {
      for (const f of CANON_FIELDS) expect(p).not.toHaveProperty(f);
    }
  });

  test('the established canon is as the app had it', () => {
    const fl = LALAVERSE_BRANDS_SEED.find((b) => b.slug === 'first_light_studio');
    expect(fl.category).toBe('lifestyle');
    expect(fl.founder).toBe('A graphic designer who wanted her workspace to feel like her work.');
    const ori = LALAVERSE_BRANDS_SEED.find((b) => b.slug === 'ori_beauty');
    expect(ori.niche).toBe('Luxury skincare for Black women who have been underserved by luxury beauty.');
    const aura = LALAVERSE_BRANDS_SEED.find((b) => b.slug === 'aura_fragrance');
    expect(aura.description).toMatch(/Black and African diaspora culture/);
  });

  test('each brand has its representative, and each representative an authority level', () => {
    expect(REPRESENTATIVES.map((r) => r.brand).sort()).toEqual([...slugs].sort());
    for (const r of REPRESENTATIVES) {
      expect(BRAND_PERSONALITIES[r.brand].representative).toBe(r.key);
      expect(Object.keys(AUTHORITY_LEVELS)).toContain(r.authority.level);
      if (r.authority.level === 'founder') expect(r.authority.escalates_to).toBeNull();
      else expect(r.authority.escalates_to).toBe('founder');
    }
  });

  test('Jordan Ellis is First Light\'s Brand Director, negotiating within approved budgets and escalating to the founder', () => {
    const jordan = REPRESENTATIVES.find((r) => r.key === 'jordan_ellis');
    expect(jordan.title).toBe('Brand Director');
    expect(jordan.title).not.toMatch(/founder/i);
    expect(jordan.authority).toEqual(expect.objectContaining({ level: 'negotiate', escalates_to: 'founder' }));
    expect(jordan.authority.escalates).toEqual(expect.arrayContaining(['Major partnerships', 'Strategic changes']));
  });

  test('only Nia Bennett, Ori\'s founder, decides as a founder', () => {
    expect(REPRESENTATIVES.filter((r) => r.authority.level === 'founder').map((r) => r.key)).toEqual(['nia_bennett']);
  });

  test('relationships name only the six brands', () => {
    for (const r of BRAND_RELATIONSHIPS) for (const b of r.brands) expect(slugs).toContain(b);
  });
});
