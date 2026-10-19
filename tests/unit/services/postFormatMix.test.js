/**
 * Each person's post formats, read from their profile with no AI call
 * (services/postFormatMix; Evoni, 2026-10-19).
 */
const mix = require('../../../src/services/postFormatMix');

const sum = (w) => Object.values(w).reduce((s, v) => s + v, 0);

describe('postFormatMix', () => {
  afterEach(() => mix.setRandom(null));

  test('who they are decides the mix', () => {
    expect(mix.kindOf({ content_category: 'fashion & beauty' })).toBe('visual');
    expect(mix.kindOf({ content_persona: 'travel vlogger, hotel reviews' })).toBe('visual');
    expect(mix.kindOf({ content_persona: 'culture critic and columnist' })).toBe('words');
    expect(mix.kindOf({ public_persona: 'gossip writer at the Velour Post' })).toBe('words');
    expect(mix.kindOf({ platform: 'substack' })).toBe('words');
    expect(mix.kindOf({ platform: 'instagram' })).toBe('visual');
    expect(mix.kindOf({ vibe_sentence: 'just a person' })).toBe('everyday');
    expect(mix.kindOf({ full_profile: { lalaverse_brand_id: 'b1' } })).toBe('brand');
    expect(mix.kindOf({}, { brand: true })).toBe('brand');
    expect(mix.kindOf({ content_category: 'commentary' }, { lala: true })).toBe('lala');
    // Words and pictures both named: the platform decides.
    expect(mix.kindOf({ content_persona: 'fashion writer', platform: 'twitter' })).toBe('words');
    expect(mix.kindOf({ content_persona: 'fashion writer', platform: 'instagram' })).toBe('visual');
  });

  test('weights sum to one; photo people mostly photos, word people mostly text', () => {
    const visual = mix.weightsFor({ content_category: 'fashion' });
    const words = mix.weightsFor({ content_persona: 'critic' });
    expect(sum(visual)).toBeCloseTo(1);
    expect(sum(words)).toBeCloseTo(1);
    expect(visual.post + visual.carousel).toBeGreaterThan(0.8);
    expect(words.text + words.quote).toBeGreaterThan(0.8);
    expect(words.carousel).toBe(0);
  });

  test('a brand never posts a quote; Lala mostly photos and carousels with some text', () => {
    const brand = mix.weightsFor({}, { brand: true });
    expect(brand.quote).toBe(0);
    for (let r = 0; r < 1; r += 0.01) expect(mix.pick(brand, () => r)).not.toBe('quote');
    const lala = mix.weightsFor({}, { lala: true });
    expect(lala.post + lala.carousel).toBeGreaterThan(0.8);
    expect(lala.text).toBeGreaterThan(0);
    expect(lala.quote).toBe(0);
  });

  test('picks are deterministic for a given random source, and only the four formats', () => {
    const w = mix.weightsFor({ content_category: 'fashion' });
    expect(mix.pick(w, () => 0)).toBe('text');
    expect(mix.pick(w, () => 0.5)).toBe('post');
    expect(mix.pick(w, () => 0.99)).toBe('carousel');
    expect(mix.pick(w, () => 1)).toBe('carousel');   // rounding: the last with weight
    mix.setRandom(() => 0.12);
    expect(mix.formatFor({ content_category: 'fashion' })).toBe('quote');
    mix.setRandom(null);
    for (let i = 0; i < 50; i += 1) expect(mix.FORMATS).toContain(mix.formatFor({ vibe_sentence: 'x' }));
  });

  test('each format has its prompt line; story, video and live have none', () => {
    for (const f of mix.FORMATS) expect(mix.promptLine(f)).toMatch(/\w/);
    expect(mix.promptLine('text')).toMatch(/words only/);
    expect(mix.promptLine('story')).toBe('');
  });
});
