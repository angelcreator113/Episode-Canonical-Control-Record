'use strict';

/**
 * A new wardrobe piece's brand is one of the LalaVerse brands (Evoni,
 * 2026-10-18: "when i upload a wardrobe item and ai fills in the form one of
 * these brands should be choosen"). The photo analyzer (POST
 * /wardrobe-library/analyze-image) invented a fictional name for every piece;
 * now it chooses from the brands in lalaverse_brands (Velour Atelier, Ori
 * Beauty, The Column, Aura Fragrance, First Light Studio, Carte Blanche, and
 * any added since), so a piece belongs to a brand the world knows.
 *
 *   loadBrandChoices(models)  the brands, fashion first: { id, name,
 *     category, aesthetic, niche }. [] when there are none or the read
 *     fails (logged); the analyzer then names a fictional brand as before.
 *   brandChoiceBlock(brands)  the prompt section listing them ('' for none)
 *   pickBrand(guess, brands)  the brand the answer names (its exact name,
 *     any case, or a name inside the answer), else null
 */

const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

async function loadBrandChoices(models) {
  const sequelize = models?.sequelize;
  if (!sequelize?.query) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT id, name, category, aesthetic, niche FROM lalaverse_brands
        WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) <> ''
        ORDER BY (category = 'fashion') DESC, name`);
    return (rows || []).map((b) => ({
      id: b.id, name: text(b.name), category: text(b.category) || null, aesthetic: text(b.aesthetic) || null, niche: text(b.niche) || null,
    }));
  } catch (err) {
    console.error('[wardrobeBrandChoice] the LalaVerse brands could not be read; the analyzer names a fictional brand:', err.message);
    return [];
  }
}

function brandChoiceBlock(brands) {
  if (!brands?.length) return '';
  return `THE LALAVERSE BRANDS (brand_guess is exactly one of these names, the one whose category and aesthetic fit this piece best; clothing, shoes and bags are a fashion brand's, makeup and skincare a beauty brand's; never another name):
${brands.map((b) => `- ${b.name}${b.category ? ` (${b.category})` : ''}${b.aesthetic ? `: ${b.aesthetic}` : ''}${b.niche ? ` For: ${b.niche}` : ''}`).join('\n')}
`;
}

function pickBrand(guess, brands) {
  const g = text(guess).toLowerCase();
  if (!g || !brands?.length) return null;
  return brands.find((b) => b.name.toLowerCase() === g)
    || brands.find((b) => g.includes(b.name.toLowerCase()))
    || null;
}

module.exports = { loadBrandChoices, brandChoiceBlock, pickBrand };
