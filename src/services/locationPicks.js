'use strict';

/**
 * Which World locations a writer is shown when it can take only some (the
 * world-level audit, fix 4, 2026-10-18: the event generator took the first
 * 20 by name, the Story Engine the 20 last updated, so the creators' own
 * studios the Feed makes for each new profile pushed the real venues out).
 *
 *   pickLocations(db, { limit, city, characterKey })  plain rows, in order:
 *     1. the character's own places (associated_characters names their key)
 *     2. places in `city` (a DREAM city name or key)
 *     3. real venues before a Feed creator's own place (one some profile's
 *        home_location_id points at)
 *     4. the cities in turn (each city's first by name, then each city's
 *        second, ...), so one city's many places do not fill the list
 *   [] on a failed read (logged).
 */

const COLUMNS = 'id, name, description, location_type, sensory_details, narrative_role, city, associated_characters, venue_type';

async function pickLocations(db, { limit = 20, city = null, characterKey = null } = {}) {
  const sequelize = db?.sequelize;
  if (!sequelize) return [];
  const cityName = city ? String(city).replace(/_/g, ' ').trim() : null;
  try {
    return await sequelize.query(
      `SELECT ${COLUMNS} FROM (
         SELECT wl.*,
           CASE WHEN CAST(:ck AS text) IS NOT NULL AND jsonb_typeof(wl.associated_characters) = 'array' AND (
             wl.associated_characters @> jsonb_build_array(CAST(:ck AS text))
             OR wl.associated_characters @> jsonb_build_array(jsonb_build_object('key', CAST(:ck AS text)))
             OR wl.associated_characters @> jsonb_build_array(jsonb_build_object('character_key', CAST(:ck AS text)))
           ) THEN 0 ELSE 1 END AS not_theirs,
           CASE WHEN CAST(:city AS text) IS NOT NULL AND lower(COALESCE(wl.city, '')) = lower(CAST(:city AS text)) THEN 0 ELSE 1 END AS elsewhere,
           CASE WHEN EXISTS (SELECT 1 FROM social_profiles sp WHERE sp.home_location_id = wl.id AND sp.deleted_at IS NULL) THEN 1 ELSE 0 END AS creator_home
         FROM world_locations wl
         WHERE wl.deleted_at IS NULL
       ) wl
       ORDER BY not_theirs, elsewhere, creator_home,
         ROW_NUMBER() OVER (PARTITION BY not_theirs, elsewhere, creator_home, lower(COALESCE(city, '')) ORDER BY name),
         name
       LIMIT :limit`,
      { replacements: { ck: characterKey || null, city: cityName, limit }, type: sequelize.QueryTypes.SELECT });
  } catch (err) {
    console.error('[locationPicks] the World locations could not be read:', err.message);
    return [];
  }
}

module.exports = { pickLocations };
