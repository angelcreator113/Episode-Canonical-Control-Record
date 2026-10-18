/**
 * The brand personalities keep to Evoni's rulings of 2026-10-18: the
 * established canon (constants/lalaverseBrands) takes precedence, every
 * brand has one representative, each with separate creative and financial
 * authority as Evoni set them, and Jordan Ellis is First Light's Brand
 * Director, not its founder.
 */
const { LALAVERSE_BRANDS_SEED } = require('../../../src/constants/lalaverseBrands');
const {
  CREATIVE_LEVELS, NEGOTIATE_LEVELS, SPEND_LEVELS, FINALIZE_LEVELS, ACTION_KINDS, BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES,
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
      expect(Object.keys(NEGOTIATE_LEVELS)).toContain(r.authority.negotiate);
      expect(Object.keys(SPEND_LEVELS)).toContain(r.authority.spend);
      expect(Object.keys(FINALIZE_LEVELS)).toContain(r.authority.finalize);
      if (r.authority.finalize === 'founder') expect(r.authority.escalates_to).toBeNull();
      else expect(r.authority.escalates_to).toBe('founder');
    }
  });

  test('the authority levels are Evoni\'s table of 2026-10-18', () => {
    const a = (r) => r.authority;
    const table = Object.fromEntries(REPRESENTATIVES.map((r) => [r.key, [a(r).label, a(r).creative, a(r).negotiate, a(r).spend, a(r).finalize]]));
    expect(table).toEqual({
      vivienne_laurent: ['High creative authority', 'approve', 'within_approved', 'delegated', 'none'],
      nia_bennett: ['Founder authority', 'approve', 'full', 'full', 'founder'],
      adrian_cole: ['Brand Director authority', 'propose', 'within_approved', 'delegated', 'none'],
      celeste_moreau: ['Brand storytelling authority', 'approve', 'propose', 'none', 'none'],
      jordan_ellis: ['Brand Director authority', 'propose', 'within_approved', 'delegated', 'none'],
      zora_vale: ['High creative authority', 'approve', 'within_approved', 'delegated', 'none'],
    });
  });

  test('Celeste can approve a concept without being able to commit money', () => {
    const celeste = REPRESENTATIVES.find((r) => r.key === 'celeste_moreau');
    expect(celeste.authority.creative).toBe('approve');
    expect(celeste.authority.negotiate).toBe('propose');
    expect(celeste.authority.spend).toBe('none');
    expect(celeste.authority.needs_approval).toContain('Financial commitments');
    expect(celeste.authority.can).toContain('Recommend compensation');
  });

  test('Jordan Ellis is First Light\'s Brand Director, negotiating within approved budgets; major partnerships go to the founder', () => {
    const jordan = REPRESENTATIVES.find((r) => r.key === 'jordan_ellis');
    expect(jordan.title).toBe('Brand Director');
    expect(jordan.title).not.toMatch(/founder/i);
    expect(jordan.authority).toEqual(expect.objectContaining({ negotiate: 'within_approved', spend: 'delegated', escalates_to: 'founder' }));
    expect(jordan.authority.needs_approval).toContain('Major partnerships');
  });

  test('Adrian Cole is The Column\'s Brand Director', () => {
    expect(REPRESENTATIVES.find((r) => r.key === 'adrian_cole').title).toBe('Brand Director');
  });

  test('only Nia Bennett, Ori\'s founder, authorizes any spending or finalizes an agreement', () => {
    expect(REPRESENTATIVES.filter((r) => r.authority.spend === 'full').map((r) => r.key)).toEqual(['nia_bennett']);
    expect(REPRESENTATIVES.filter((r) => r.authority.finalize !== 'none').map((r) => r.key)).toEqual(['nia_bennett']);
  });

  test('Zora negotiates within an approved budget and cannot exceed it', () => {
    const zora = REPRESENTATIVES.find((r) => r.key === 'zora_vale');
    expect(zora.authority.negotiate).toBe('within_approved');
    expect(zora.authority.can).toContain('Propose alternative deal structures');
    expect(zora.authority.needs_approval).toEqual(expect.arrayContaining(['Exceeding the approved budget', 'Major financial commitments', 'Finalizing a binding agreement']));
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
