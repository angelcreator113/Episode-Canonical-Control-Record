'use strict';

/**
 * Which Lala (2026-10-24). Each character registry can hold its own Lala, so
 * the Relationships page (routes/relationships loadCastIds) and the writers
 * (services/relationshipTruth, the script writer's lalaRomances) ask here and
 * name the same one. Before this the page took the Lala of the registry
 * holding most of the cast, while the writers took the newest one with a
 * Pulse profile (and lalaRomances matched any Lala).
 *
 * The rule: a live registry character whose character_key is 'lala' (any
 * case), else one whose display_name is 'Lala'. When there are several:
 *   1. the one in the registry holding most of the cast (the registry
 *      characters a live LalaVerse Pulse profile names, ruling C3);
 *   2. then one found by her key over one found only by her name;
 *   3. then one with a Pulse profile of her own;
 *   4. then the most recently updated.
 */

const sq = (db) => db?.sequelize || db;
const rowsOf = async (db, sql, replacements = {}, transaction) => (await sq(db).query(sql, { replacements, transaction }))[0];

/**
 * The cast's links: each live LalaVerse Pulse profile and the registry
 * character naming it (the newest when two do), as [{ id, registry_id }].
 */
function castLinks(db, { transaction } = {}) {
  return rowsOf(db,
    `SELECT DISTINCT ON (sp.id) rc.id, rc.registry_id
       FROM social_profiles sp
       JOIN registry_characters rc ON rc.feed_profile_id = sp.id AND rc.deleted_at IS NULL
      WHERE sp.feed_layer::text = 'lalaverse' AND sp.deleted_at IS NULL AND COALESCE(sp.status::text, '') <> 'archived'
      ORDER BY sp.id, rc.updated_at DESC`, {}, transaction);
}

/** How many of the cast each registry holds: { registry_id: n }. */
const heldBy = (links) => {
  const held = {};
  for (const r of links || []) held[r.registry_id] = (held[r.registry_id] || 0) + 1;
  return held;
};

/**
 * Lala, by the rule above: { id, registry_id } or null. `links` (castLinks'
 * rows) saves a read when the caller already has them.
 */
async function findLala(db, { transaction, links } = {}) {
  const lalas = await rowsOf(db,
    `SELECT id, registry_id, updated_at,
            (LOWER(COALESCE(character_key, '')) = 'lala') AS by_key,
            (feed_profile_id IS NOT NULL) AS has_profile
       FROM registry_characters
      WHERE deleted_at IS NULL
        AND (LOWER(COALESCE(character_key, '')) = 'lala' OR LOWER(COALESCE(display_name, '')) = 'lala')`, {}, transaction);
  if (!lalas.length) return null;
  const held = lalas.length > 1 ? heldBy(links || await castLinks(db, { transaction })) : {};
  const time = (r) => new Date(r.updated_at || 0).getTime() || 0;
  lalas.sort((a, b) => ((held[b.registry_id] || 0) - (held[a.registry_id] || 0))
    || (Number(b.by_key) - Number(a.by_key))
    || (Number(b.has_profile) - Number(a.has_profile))
    || (time(b) - time(a)));
  return { id: lalas[0].id, registry_id: lalas[0].registry_id };
}

/** Lala's registry character id, or null. */
async function lalaId(db, opts = {}) {
  return (await findLala(db, opts))?.id || null;
}

module.exports = { findLala, lalaId, castLinks };
