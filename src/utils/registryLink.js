'use strict';

/**
 * The one link between a Feed profile and its registry character, stored on
 * the registry entry: registry_characters.feed_profile_id (Evoni's ruling
 * C3, docs/navigation-architecture.md; 2026-10-08, "One link, per C3").
 *
 * social_profiles.registry_character_id is not the link. The migrations
 * and canon made it INTEGER while every writer wrote a registry id (a UUID),
 * so no write ever saved, and every join through it compared an integer to
 * a UUID and failed. The column stays in the table, unused; the model no
 * longer declares it.
 *
 *   linkedCharacter(db, profileId, attributes)  the profile's registry character, or null
 *   withRegistryLinks(db, profiles)             plain profile objects carrying
 *                                               registry_character_id, read from the
 *                                               registry entry, as the Feed's pages read it
 *   LINKED_CHARACTER_JOIN                       raw SQL: joins social_profiles sp to
 *                                               its registry character as rc
 */

const NEWEST = [['updated_at', 'DESC']];

// For raw SQL over `social_profiles sp`: the live registry entry linked to
// the profile, as rc (the newest should two claim it), or nulls.
const LINKED_CHARACTER_JOIN = `LEFT JOIN LATERAL (
           SELECT * FROM registry_characters r
            WHERE r.feed_profile_id = sp.id AND r.deleted_at IS NULL
            ORDER BY r.updated_at DESC LIMIT 1
         ) rc ON true`;

/** The registry character linked to a profile (the newest, should two claim it), or null. */
async function linkedCharacter(db, profileId, attributes) {
  if (!db?.RegistryCharacter || profileId == null) return null;
  return db.RegistryCharacter.findOne({
    where: { feed_profile_id: profileId },
    ...(attributes ? { attributes } : {}),
    order: NEWEST,
  });
}

const plain = (p) => (p && typeof p.toJSON === 'function' ? p.toJSON() : p);

/** Profiles as plain objects, each with registry_character_id from its registry entry, else null. */
async function withRegistryLinks(db, profiles) {
  const list = (profiles || []).map(plain);
  const ids = list.map((p) => p && p.id).filter((id) => id != null);
  const byProfile = new Map();
  if (ids.length && db?.RegistryCharacter) {
    const rows = await db.RegistryCharacter.findAll({
      where: { feed_profile_id: ids },
      attributes: ['id', 'feed_profile_id'],
      order: NEWEST,
      raw: true,
    });
    // Newest first: the first row for a profile is its link.
    for (const r of rows) if (!byProfile.has(r.feed_profile_id)) byProfile.set(r.feed_profile_id, r.id);
  }
  return list.map((p) => (p ? { ...p, registry_character_id: byProfile.get(p.id) || null } : p));
}

module.exports = { linkedCharacter, withRegistryLinks, LINKED_CHARACTER_JOIN };
