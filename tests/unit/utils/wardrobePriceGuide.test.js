/**
 * The analyze-image price guide and the removal of the $150 floor
 * (Task #2347). The guide module is pure; the prompts and the WorldAdmin
 * auto-fill are checked in their source, since the route calls the AI.
 */
const fs = require('fs');
const path = require('path');
const { PRICE_TIERS, PRICE_RANGES, priceGuideText } = require('../../../src/utils/wardrobePriceGuide');

const root = path.join(__dirname, '../../..');
const routeSrc = fs.readFileSync(path.join(root, 'src/routes/wardrobeLibrary.js'), 'utf8');
const adminSrc = fs.readFileSync(path.join(root, 'frontend/src/pages/WorldAdmin.jsx'), 'utf8');

// The prompt's item_type enum, read from the route so the two cannot drift.
const promptItemTypes = routeSrc.match(/"item_type": "([a-z|]+)"/)[1].split('|');

describe('wardrobe price guide (Task #2347)', () => {
  it('has a row for every item_type the prompt offers, and every tier', () => {
    expect(Object.keys(PRICE_RANGES).sort()).toEqual([...promptItemTypes].sort());
    expect(PRICE_TIERS).toEqual(['basic', 'mid', 'luxury', 'elite']);
    for (const byTier of Object.values(PRICE_RANGES)) {
      expect(Object.keys(byTier)).toEqual(PRICE_TIERS);
    }
  });

  it('each range is low < high, and the tiers climb without gaps', () => {
    for (const [type, byTier] of Object.entries(PRICE_RANGES)) {
      PRICE_TIERS.forEach((tier, i) => {
        const [lo, hi] = byTier[tier];
        expect({ type, tier, ok: lo > 0 && lo < hi }).toEqual({ type, tier, ok: true });
        if (i > 0) expect({ type, tier, lo }).toEqual({ type, tier, lo: byTier[PRICE_TIERS[i - 1]][1] });
      });
    }
  });

  it('the guide text lists every row and states there is no minimum', () => {
    const text = priceGuideText();
    for (const type of Object.keys(PRICE_RANGES)) expect(text).toContain(`- ${type}: basic $`);
    expect(text).toContain('dress: basic $40–$120, mid $120–$400, luxury $400–$2,500, elite $2,500–$15,000');
    expect(text).toMatch(/no minimum/i);
  });
});

describe('the $150 floor is gone (Task #2347)', () => {
  it('neither analyze-image prompt carries a minimum price', () => {
    expect(/minimum \$150/.test(routeSrc)).toBe(false);
    expect(/Luxury-boutique pricing/.test(routeSrc)).toBe(false);
  });

  it('both prompts carry the price guide', () => {
    expect((routeSrc.match(/\$\{priceGuide\}\n\nReturn ONLY the JSON\./g) || []).length).toBe(2);
  });

  it('WorldAdmin no longer clamps the AI price to 150.00', () => {
    expect(/>= 150 \?/.test(adminSrc)).toBe(false);
    expect(adminSrc.includes("'150.00'")).toBe(false);
  });

  it('WorldAdmin suggests the coin cost from the price she set (suggestCoinCost)', () => {
    expect(adminSrc.includes('coinCost: prev.coinCost || suggestCoinCost(prev.price, ai.coin_cost, aiPrice)')).toBe(true);
  });

  it('WorldAdmin fills the AI price only into an empty price', () => {
    expect(adminSrc.includes('price: aiPrice || prev.price')).toBe(false);
    expect(adminSrc.includes('price: fillPrice(prev.price, aiPrice)')).toBe(true);
  });
});
