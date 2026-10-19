/**
 * Brands on The Pulse (services/brandPulse): the voice block keeps the
 * Brand Canon Protection Rule's layers apart, never names a real-world app,
 * and the deal gate follows Evoni's authority rulings.
 */
const bp = require('../../../src/services/brandPulse');
const { LALAVERSE_BRANDS_SEED: LALAVERSE_BRANDS } = require('../../../src/constants/lalaverseBrands');
const { REPRESENTATIVES } = require('../../../src/constants/brandPersonalities');

const brand = (slug) => ({ id: `id-${slug}`, ...LALAVERSE_BRANDS.find((b) => b.slug === slug) });
const rep = (key) => REPRESENTATIVES.find((r) => r.key === key);
const booked = { status: 'booked' };

describe('brandPulse voice block', () => {
  const velour = brand('velour_atelier');

  test('canon, what the brand believes and what the rep believes are separate sections', () => {
    const block = bp.brandVoiceBlock(velour, rep('vivienne_laurent'));
    const canon = block.indexOf('ESTABLISHED CANON about Velour Atelier');
    const believes = block.indexOf('WHAT VELOUR ATELIER BELIEVES');
    const hers = block.indexOf('HER OWN VIEWS (hers, not an official Velour Atelier position');
    expect(canon).toBeGreaterThanOrEqual(0);
    expect(believes).toBeGreaterThan(canon);
    expect(hers).toBeGreaterThan(believes);
    expect(block).toContain('never add to it, never contradict it');
    expect(block).toContain('Never state a new fact about Velour Atelier\'s history');
    expect(block).toContain('A campaign discussed is not a campaign that happened.');
  });

  test('without a rep there is no rep section; money and real-world apps are ruled out', () => {
    const block = bp.brandVoiceBlock(velour);
    expect(block).not.toContain('HER OWN VIEWS');
    expect(block).toContain('Never name money, a budget, compensation, contract terms');
    expect(block).toContain('The Pulse is the only app. Never name a real-world app or website.');
    for (const b of LALAVERSE_BRANDS) {
      const text = bp.brandVoiceBlock(brand(b.slug), null).toLowerCase();
      for (const app of ['instagram', 'tiktok', 'youtube', 'twitter']) expect(text).not.toContain(app);
    }
  });

  test('the brand\'s relationships are its own, and the saved personality wins over the constant', () => {
    expect(bp.brandVoiceBlock(velour)).toContain('rivals: Two answers to dressing for a decision');
    const saved = { ...velour, personality: { direction: 'Saved direction', defining_principle: 'Saved principle' } };
    expect(bp.brandVoiceBlock(saved)).toContain('Defining principle: Saved principle');
  });

  test('a rep signs with her first name and title', () => {
    expect(bp.signature(rep('zora_vale'))).toBe('— Zora, Creative Director');
  });
});

describe('brandPulse deal gate (canAnnounce)', () => {
  test('only a booked deal is announced', () => {
    for (const status of ['offered', 'considering', 'negotiating', 'declined', 'cancelled']) {
      const out = bp.canAnnounce({ deal: { status }, brand: brand('ori_beauty') });
      expect(out.ok).toBe(false);
      expect(out.reason).toContain(`The deal is ${status}`);
    }
    for (const status of bp.FINAL_DEAL_STATUSES) expect(bp.canAnnounce({ deal: { status }, brand: brand('ori_beauty') }).ok).toBe(true);
  });

  test('each rep: only founder authority announces; the others leave it to the brand account', () => {
    const allowed = { nia_bennett: true, vivienne_laurent: false, adrian_cole: false, celeste_moreau: false, jordan_ellis: false, zora_vale: false };
    for (const r of REPRESENTATIVES) {
      const out = bp.canAnnounce({ deal: booked, brand: brand(r.brand), rep: r });
      expect([r.key, out.ok]).toEqual([r.key, allowed[r.key]]);
      if (!out.ok) expect(out.reason).toContain('cannot finalize a binding agreement');
    }
  });

  test('a rep never speaks for another house', () => {
    const out = bp.canAnnounce({ deal: booked, brand: brand('velour_atelier'), rep: rep('nia_bennett') });
    expect(out).toEqual({ ok: false, reason: 'Nia Bennett speaks for another house.' });
  });
});

describe('brandPulse handles', () => {
  test('a handle from the brand name', () => {
    expect(bp.baseHandle({ name: 'Velour Atelier' })).toBe('velouratelier');
    expect(bp.baseHandle({ name: 'First Light Studio' })).toBe('firstlightstudio');
  });
});
