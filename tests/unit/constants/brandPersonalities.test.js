/**
 * The brand personalities keep to Evoni's rulings of 2026-10-18: the
 * established canon (constants/lalaverseBrands) takes precedence, every
 * brand has one representative, each with separate creative and financial
 * authority as Evoni set them, and Jordan Ellis is First Light's Brand
 * Director, not its founder.
 */
const { LALAVERSE_BRANDS_SEED } = require('../../../src/constants/lalaverseBrands');
const {
  CREATIVE_LEVELS, FINANCIAL_LEVELS, ACTION_KINDS, BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES,
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

  test('each brand has its representative, with separate creative and financial authority', () => {
    expect(REPRESENTATIVES.map((r) => r.brand).sort()).toEqual([...slugs].sort());
    for (const r of REPRESENTATIVES) {
      expect(BRAND_PERSONALITIES[r.brand].representative).toBe(r.key);
      expect(Object.keys(CREATIVE_LEVELS)).toContain(r.authority.creative);
      expect(Object.keys(FINANCIAL_LEVELS)).toContain(r.authority.financial);
      if (r.authority.financial === 'full') expect(r.authority.escalates_to).toBeNull();
      else expect(r.authority.escalates_to).toBe('founder');
    }
  });

  test('the authority levels are Evoni\'s table of 2026-10-18', () => {
    const table = Object.fromEntries(REPRESENTATIVES.map((r) => [r.key, [r.authority.label, r.authority.creative, r.authority.financial]]));
    expect(table).toEqual({
      vivienne_laurent: ['High creative authority', 'approve', 'negotiate'],
      nia_bennett: ['Founder authority', 'approve', 'full'],
      adrian_cole: ['Brand Director authority', 'propose', 'routine'],
      celeste_moreau: ['Brand storytelling authority', 'approve', 'none'],
      jordan_ellis: ['Brand Director authority', 'propose', 'negotiate'],
      zora_vale: ['High creative authority', 'approve', 'negotiate'],
    });
  });

  test('Celeste can approve a concept without being able to commit money', () => {
    const celeste = REPRESENTATIVES.find((r) => r.key === 'celeste_moreau');
    expect(celeste.authority.creative).toBe('approve');
    expect(celeste.authority.financial).toBe('none');
    expect(celeste.authority.needs_approval).toContain('Financial commitments');
  });

  test('Jordan Ellis is First Light\'s Brand Director, negotiating within approved budgets; major partnerships go to the founder', () => {
    const jordan = REPRESENTATIVES.find((r) => r.key === 'jordan_ellis');
    expect(jordan.title).toBe('Brand Director');
    expect(jordan.title).not.toMatch(/founder/i);
    expect(jordan.authority).toEqual(expect.objectContaining({ financial: 'negotiate', escalates_to: 'founder' }));
    expect(jordan.authority.needs_approval).toContain('Major partnerships');
  });

  test('Adrian Cole is The Column\'s Brand Director', () => {
    expect(REPRESENTATIVES.find((r) => r.key === 'adrian_cole').title).toBe('Brand Director');
  });

  test('only Nia Bennett, Ori\'s founder, has full financial authority', () => {
    expect(REPRESENTATIVES.filter((r) => r.authority.financial === 'full').map((r) => r.key)).toEqual(['nia_bennett']);
  });

  test('no representative may rewrite canon, exceed a budget, invent a contract or publish unauthorized', () => {
    expect(ACTION_KINDS.restricted).toEqual(['Rewrite established brand canon', 'Exceed a budget', 'Invent a finalized contract', 'Publish content without authorization']);
    expect(ACTION_KINDS.autonomous).toContain('Draft proposals');
    expect(ACTION_KINDS.approval_required).toContain('Negotiate proposed terms');
  });

  test('relationships name only the six brands', () => {
    for (const r of BRAND_RELATIONSHIPS) for (const b of r.brands) expect(slugs).toContain(b);
  });
});
