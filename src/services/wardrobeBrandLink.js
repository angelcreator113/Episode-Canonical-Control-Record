'use strict';

/**
 * A wardrobe piece belongs to the LalaVerse brand it names (Evoni,
 * 2026-10-18, the quick wins: "wardrobe pieces keep their LalaVerse
 * brand"). A piece stores its brand as text (wardrobe.brand); when that text
 * is a brand in lalaverse_brands (by name, any case), the piece is tagged
 * with it the way POST /wardrobe-brands/tag-piece tags a piece
 * (wardrobe_brand_tags, one per piece and brand), so the brand knows the
 * piece and its coverage can be written.
 *
 *   linkItemBrand(sequelize, item)  item: { id, name, brand, show_id }.
 *     Tags the piece with its brand when it names one (no second tag for the
 *     same piece and brand). A tag to another brand that nothing was written
 *     for yet (uncovered, no coverage) is removed, so changing the brand moves
 *     the link; a tag with coverage is kept. No email is sent (the tag-piece
 *     route's alert is for a piece tagged in a scene). Never throws: a failed
 *     link is logged and the piece is saved anyway. Returns the brand id
 *     linked, or null.
 */

async function brandNamed(sequelize, name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return null;
  const [[row]] = await sequelize.query(
    "SELECT id FROM lalaverse_brands WHERE LOWER(TRIM(name)) = LOWER(:name) AND kind = 'brand' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
    { replacements: { name: text } });
  return row?.id || null;
}

async function linkItemBrand(sequelize, item) {
  if (!item?.id) return null;
  try {
    const brandId = await brandNamed(sequelize, item.brand);
    // Untouched tags to another brand go (soft-deleted); a covered one stays.
    await sequelize.query(
      `UPDATE wardrobe_brand_tags SET deleted_at = NOW(), updated_at = NOW()
        WHERE wardrobe_item_id = :item AND deleted_at IS NULL
          AND (CAST(:brand AS uuid) IS NULL OR brand_id <> CAST(:brand AS uuid))
          AND COALESCE(coverage_status, 'uncovered') IN ('uncovered', 'not_tagged')
          AND coverage_content IS NULL`,
      { replacements: { item: item.id, brand: brandId } });
    if (!brandId) return null;
    const [[existing]] = await sequelize.query(
      'SELECT id FROM wardrobe_brand_tags WHERE wardrobe_item_id = :item AND brand_id = :brand AND deleted_at IS NULL LIMIT 1',
      { replacements: { item: item.id, brand: brandId } });
    if (existing) {
      await sequelize.query('UPDATE wardrobe_brand_tags SET wardrobe_item_name = :name, updated_at = NOW() WHERE id = :id',
        { replacements: { id: existing.id, name: item.name || 'Unnamed piece' } });
    } else {
      await sequelize.query(
        `INSERT INTO wardrobe_brand_tags (id, wardrobe_item_id, wardrobe_item_name, brand_id, show_id, coverage_status, created_at, updated_at)
         VALUES (gen_random_uuid(), :item, :name, :brand, :show, 'uncovered', NOW(), NOW())`,
        { replacements: { item: item.id, name: item.name || 'Unnamed piece', brand: brandId, show: item.show_id || null } });
    }
    return brandId;
  } catch (err) {
    console.error(`[wardrobeBrandLink] piece ${item.id} could not be linked to its brand:`, err.message);
    return null;
  }
}

module.exports = { linkItemBrand, brandNamed };
