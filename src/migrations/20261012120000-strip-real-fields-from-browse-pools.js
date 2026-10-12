'use strict';

/**
 * episodes.browse_pool_json: take a piece's real-world source out of the
 * pools already stored (Task #3020).
 *
 * POST /api/v1/world/:showId/browse-pool built its pool from whole wardrobe
 * rows, so each stored item carried the eleven real-world columns (#2873):
 * real brand, prices paid, links. The route now strips them before it
 * saves (utils/wardrobeInWorld); this removes them from the pools saved
 * before that, wherever they sit in the JSON. Nothing else in a pool
 * changes, and a pool without them is not written.
 *
 * Data only: no column, table or ENUM. Guarded: does nothing when the
 * column is absent. down is a no-op: the removed values are still on the
 * wardrobe rows they came from, and putting them back into the game's
 * pools is what this undoes.
 */

const REAL_WORLD_FIELDS = [
  'real_brand', 'real_retailer', 'real_product_name', 'real_color', 'real_size',
  'real_price_paid', 'real_list_price', 'real_product_url', 'affiliate_url',
  'real_order_date', 'real_source',
];

/** The value without those keys at any depth; { changed } says if any went. */
function strip(value, state) {
  if (Array.isArray(value)) return value.map((v) => strip(v, state));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REAL_WORLD_FIELDS.includes(k)) { state.changed = true; continue; }
    out[k] = strip(v, state);
  }
  return out;
}

module.exports = {
  strip,
  REAL_WORLD_FIELDS,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const columns = await queryInterface.describeTable('episodes');
    if (!columns.browse_pool_json) return;
    // jsonb ? only sees top-level keys; the text match finds them at any depth.
    const rows = await sequelize.query(
      `SELECT id, browse_pool_json FROM episodes
        WHERE browse_pool_json IS NOT NULL
          AND browse_pool_json::text ~ '"(real_[a-z_]+|affiliate_url)"'`,
      { type: sequelize.QueryTypes.SELECT },
    );
    await sequelize.transaction(async (transaction) => {
      for (const row of rows) {
        const state = { changed: false };
        const next = strip(row.browse_pool_json, state);
        if (!state.changed) continue;
        await sequelize.query(
          'UPDATE episodes SET browse_pool_json = CAST(:pool AS jsonb) WHERE id = :id',
          { replacements: { id: row.id, pool: JSON.stringify(next) }, transaction },
        );
      }
    });
  },

  async down() {
    // Nothing to restore: see the header.
  },
};
