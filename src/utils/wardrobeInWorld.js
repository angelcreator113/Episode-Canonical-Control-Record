'use strict';

/**
 * A wardrobe row as the game may see it: without the piece's real-world
 * source (Task #3020; the columns are #2873).
 *
 * The Pulse spec §10: in-world never shows real brands or prices. The
 * eleven columns below are what Evoni actually bought; only the Studio's
 * wardrobe management (where they are edited) and Shop the Look
 * (styleSheetDistributionService, which selects them by name) read them.
 * Game routes that read whole rows pass them through here before
 * responding or storing (docs/reads/2026-10-12-pulse-shop-the-look-read.md
 * §3).
 *
 * tests/unit/utils/wardrobeInWorld.test.js pins this list to the model's
 * real-world attributes and the migration's columns, so a new one cannot
 * be added without being stripped.
 */

const REAL_WORLD_FIELDS = Object.freeze([
  'real_brand', 'real_retailer', 'real_product_name', 'real_color', 'real_size',
  'real_price_paid', 'real_list_price', 'real_product_url', 'affiliate_url',
  'real_order_date', 'real_source',
]);

/** A copy of the row without the real-world fields; anything else is returned as it is. */
function withoutRealFields(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const out = { ...plain };
  for (const key of REAL_WORLD_FIELDS) delete out[key];
  return out;
}

/** withoutRealFields over a list; a non-list is returned as it is. */
function allWithoutRealFields(rows) {
  return Array.isArray(rows) ? rows.map(withoutRealFields) : rows;
}

module.exports = { REAL_WORLD_FIELDS, withoutRealFields, allWithoutRealFields };
