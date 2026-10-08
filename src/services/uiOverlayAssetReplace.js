'use strict';

/**
 * Replacing a phone screen's (or icon's) image without losing its work
 * (Evoni, 2026-10-07: Lala's Phone, step 1, "fix the data-loss bugs").
 *
 * An overlay image is an assets row (asset_type UI_OVERLAY) per overlay
 * type and variant; the work done on it lives in that row's metadata: its
 * tap zones (screen_links), content areas (content_zones), image fit
 * (image_fit) and a category chosen by hand (overlay_category). Upload and
 * generate used to soft-delete the row and insert a bare one, so a new
 * image wiped all of it, and generate removed every variant too.
 *
 * replaceOverlayAsset, in one transaction: reads the live row it replaces
 * (the same type and variant; the main image when there is no variant),
 * soft-deletes only that row, and inserts the new one with the carried
 * metadata. A failure rolls back, so the old image stays.
 *
 * Phone audit (2026-10-07): only the show-wide image is replaced — an
 * episode's own version of the screen (episode_id set) is left alone; it
 * used to be soft-deleted with it. Episodes that placed the old image on
 * their timeline are moved to the new one, so the placement keeps working.
 */

const CARRIED_KEYS = Object.freeze(['screen_links', 'content_zones', 'image_fit', 'overlay_category']);

const parse = (meta) => {
  if (!meta) return {};
  if (typeof meta !== 'string') return meta;
  try { return JSON.parse(meta); } catch (err) {
    console.error('[UIOverlay] metadata parse failed:', err.message);
    return {};
  }
};

/** The work on an image that a new image keeps: the CARRIED_KEYS it has. */
function carriedFrom(metadata) {
  const meta = parse(metadata);
  const out = {};
  for (const key of CARRIED_KEYS) if (meta[key] !== undefined && meta[key] !== null) out[key] = meta[key];
  return out;
}

const variantClause = (variantLabel) => (variantLabel
  ? "metadata->>'variant_label' = :variantLabel"
  : "(metadata->>'variant_label' IS NULL OR metadata->>'variant_label' = '')");

/**
 * Replace the live image of one overlay type (and variant) with a new one.
 * @returns {Promise<{ assetId: string, carried: string[] }>}
 */
async function replaceOverlayAsset(sequelize, { showId, overlayId, variantLabel = null, assetId, name, url, metadata }) {
  return sequelize.transaction(async (transaction) => {
    const replacements = { showId, overlayId, variantLabel };
    const where = `asset_type = 'UI_OVERLAY' AND show_id = :showId AND metadata->>'overlay_type' = :overlayId
                   AND ${variantClause(variantLabel)} AND episode_id IS NULL AND deleted_at IS NULL`;
    const previous = await sequelize.query(
      `SELECT id, metadata FROM assets WHERE ${where} ORDER BY created_at DESC`,
      { replacements, type: sequelize.QueryTypes.SELECT, transaction });
    const carried = previous[0] ? carriedFrom(previous[0].metadata) : {};
    await sequelize.query(`UPDATE assets SET deleted_at = NOW() WHERE ${where}`, { replacements, transaction });
    await sequelize.query(
      `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { replacements: { id: assetId, name, url, showId, metadata: JSON.stringify({ ...metadata, ...carried }) }, transaction });
    const oldIds = previous.map(r => r.id);
    if (oldIds.length) {
      const [[table]] = await sequelize.query(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS ok`, { transaction });
      if (table?.ok) {
        await sequelize.query(
          `UPDATE timeline_placements SET asset_id = :assetId, updated_at = NOW()
            WHERE asset_id IN (:oldIds)`,
          { replacements: { assetId, oldIds }, transaction });
      }
    }
    return { assetId, carried: Object.keys(carried) };
  });
}

module.exports = { CARRIED_KEYS, carriedFrom, replaceOverlayAsset };
