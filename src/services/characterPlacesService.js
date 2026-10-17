'use strict';

/**
 * Character homes (Evoni, 2026-10-15: "upload the everyday scene set to the
 * character" means linking a venue to a character as their home; "Lead
 * character is Lala but other characters have home sets";
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 3).
 *
 *   - The show names its lead character (shows.metadata.lead_character_id).
 *     The lead's home and closet ARE the show's scene defaults (L3: "The
 *     show keeps Lala's home set and closet set as saved defaults"), so
 *     linking the lead's home or closet sets those defaults: one place holds
 *     them, and the Episode Locations step already starts from them.
 *   - Any other character links to their own scene sets in character_places:
 *     one home, one closet, and any number of other places with a label.
 *   - The Episode Locations step offers the other characters' homes as
 *     extra locations (characterHomes).
 *
 * Characters are the show's: those in its character registries.
 */

const { readSceneDefaults, saveSceneDefaults } = require('./episodeLocationsService');

const { validateUUID } = require('../middleware/requestValidation');

// 'work', their place of work (Evoni, 2026-10-17), may be a venue's set
// that events are held at too; a character may have more than one.
const ROLES = Object.freeze(['home', 'closet', 'work', 'other']);
const SINGLE = new Set(['home', 'closet']);
const LEAD_DEFAULT_KEY = Object.freeze({ home: 'home_set_id', closet: 'closet_set_id' });
const LABEL_MAX = 80;

class CharacterPlacesError extends Error {
  constructor(message, status = 400, code = 'CHARACTER_PLACES_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const parseMetadata = (m) => (typeof m === 'string' ? JSON.parse(m) : (m || {}));

/** Ids from the request must be ids: a bad one is a 400, not a database error. */
function assertIds(ids) {
  for (const [name, value] of Object.entries(ids)) {
    if (value != null && value !== '' && !validateUUID(String(value))) throw new CharacterPlacesError(`${name} must be an id`, 400, 'BAD_ID');
  }
}

async function loadShow(sequelize, showId) {
  assertIds({ show: showId });
  const [[show]] = await sequelize.query('SELECT id, metadata, universe_id FROM shows WHERE id = :showId AND deleted_at IS NULL', { replacements: { showId } });
  if (!show) throw new CharacterPlacesError('Show not found', 404, 'SHOW_NOT_FOUND');
  return { ...show, metadata: parseMetadata(show.metadata) };
}

/**
 * The show's characters, by name: those in its registries. A show none of
 * whose registries names it uses the registries that name no show, as The
 * Cast does (chooseRegistry). Nothing sets a registry's show after it is
 * made, so a show's cast is often in one of those, and the Link a character
 * list was empty (Evoni, 2026-10-16: "im not able to link characters").
 */
async function showCharacters(sequelize, showId) {
  const [rows] = await sequelize.query(
    `WITH own AS (
       SELECT id FROM character_registries WHERE show_id = :showId AND deleted_at IS NULL
     ), regs AS (
       SELECT id FROM own
       UNION ALL
       SELECT id FROM character_registries
        WHERE show_id IS NULL AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM own)
     )
     SELECT c.id, COALESCE(NULLIF(c.selected_name, ''), c.display_name) AS name, c.role_type, c.character_key
       FROM registry_characters c
      WHERE c.registry_id IN (SELECT id FROM regs) AND c.deleted_at IS NULL
      ORDER BY name ASC`,
    { replacements: { showId } });
  return rows;
}

async function liveSet(sequelize, id) {
  const [[set]] = await sequelize.query(
    'SELECT id, name, show_id, scene_type, base_still_url FROM scene_sets WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id } });
  return set || null;
}

/**
 * Every character of the show with their places, and the lead. The lead's
 * home and closet are read from the show's scene defaults.
 */
async function listPlaces(sequelize, showId) {
  const show = await loadShow(sequelize, showId);
  const leadId = show.metadata.lead_character_id || null;
  const characters = await showCharacters(sequelize, showId);
  const ids = characters.map((c) => c.id);
  const [rows] = ids.length ? await sequelize.query(
    `SELECT p.id, p.registry_character_id, p.scene_set_id, p.role, p.label, s.name AS scene_set_name
       FROM character_places p JOIN scene_sets s ON s.id = p.scene_set_id AND s.deleted_at IS NULL
      WHERE p.registry_character_id IN (:ids) AND p.deleted_at IS NULL
      ORDER BY p.created_at ASC`,
    { replacements: { ids } }) : [[]];
  const defaults = readSceneDefaults(show.metadata);
  const leadPlaces = [];
  for (const [role, key] of Object.entries(LEAD_DEFAULT_KEY)) {
    const set = defaults[key] ? await liveSet(sequelize, defaults[key]) : null;
    if (set) leadPlaces.push({ id: null, role, label: null, scene_set_id: set.id, scene_set_name: set.name, source: 'show_default' });
  }
  return {
    lead_character_id: leadId,
    fill_pending: await lalaHomeFillPending(sequelize, show, characters),
    characters: characters.map((c) => {
      const isLead = String(c.id) === String(leadId);
      const own = rows.filter((r) => String(r.registry_character_id) === String(c.id))
        .filter((r) => !(isLead && SINGLE.has(r.role)))
        .map((r) => ({ id: r.id, role: r.role, label: r.label, scene_set_id: r.scene_set_id, scene_set_name: r.scene_set_name, source: 'character' }));
      return { id: c.id, name: c.name, role_type: c.role_type, is_lead: isLead, places: isLead ? [...leadPlaces, ...own] : own };
    }),
  };
}

async function assertCharacter(sequelize, showId, characterId) {
  const characters = await showCharacters(sequelize, showId);
  const character = characters.find((c) => String(c.id) === String(characterId));
  if (!character) throw new CharacterPlacesError('That character is not in this show', 404, 'CHARACTER_NOT_FOUND');
  return character;
}

/**
 * Names the show's lead character (null clears it). The lead's home and
 * closet live in the show's scene defaults, so a change of lead moves
 * them with the people: the old lead's become her own places
 * (character_places), the new lead's own home and closet become the
 * defaults (empty when she has none). A show with no lead before keeps its
 * defaults for the first lead, except where she has her own. One transaction; the metadata keys
 * are merged in the database, so another key written meanwhile is kept.
 */
async function setLead(sequelize, { showId, characterId }) {
  assertIds({ character_id: characterId });
  const show = await loadShow(sequelize, showId);
  if (characterId) await assertCharacter(sequelize, showId, characterId);
  const oldLead = show.metadata.lead_character_id || null;
  const next = characterId || null;
  if (String(oldLead || '') === String(next || '')) return { lead_character_id: next };
  await sequelize.transaction(async (transaction) => {
    const [[locked]] = await sequelize.query('SELECT metadata FROM shows WHERE id = :showId FOR UPDATE', { replacements: { showId }, transaction });
    const defaults = readSceneDefaults(parseMetadata(locked.metadata));
    // With no lead before, the show's home and closet were nobody's: the
    // first lead takes them, and only her own home or closet replaces one.
    // Clearing the lead (None) keeps them as the show's, for the next lead:
    // they were wiped, and new episodes had no Home or Closet (fourth audit).
    const handOver = Boolean(oldLead && next);
    const nextDefaults = handOver ? { home_set_id: null, closet_set_id: null } : { ...defaults };
    if (handOver) {
      for (const [role, key] of Object.entries(LEAD_DEFAULT_KEY)) {
        if (!defaults[key]) continue;
        // A character has one row per set: a home that is also the closet
        // stays her home (the closet's row replaced its role, audit
        // 2026-10-15).
        if (role === 'closet' && String(defaults.closet_set_id) === String(defaults.home_set_id)) continue;
        await sequelize.query(
          `INSERT INTO character_places (id, registry_character_id, scene_set_id, role, created_at, updated_at)
           VALUES (gen_random_uuid(), :characterId, :setId, :role, NOW(), NOW())
           ON CONFLICT (registry_character_id, scene_set_id) WHERE deleted_at IS NULL
           DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
          { replacements: { characterId: oldLead, setId: defaults[key], role }, transaction });
      }
    }
    if (next) {
      const [own] = await sequelize.query(
        `SELECT id, scene_set_id, role FROM character_places
          WHERE registry_character_id = :characterId AND role IN ('home', 'closet') AND deleted_at IS NULL`,
        { replacements: { characterId: next }, transaction });
      for (const p of own) {
        nextDefaults[LEAD_DEFAULT_KEY[p.role]] = p.scene_set_id;
        await sequelize.query('UPDATE character_places SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: p.id }, transaction });
      }
    }
    await sequelize.query(
      `UPDATE shows SET metadata = (COALESCE(metadata::jsonb, '{}'::jsonb)
                                     || jsonb_build_object('lead_character_id', CAST(:lead AS text), 'scene_defaults', CAST(:defaults AS jsonb)))::json,
                        updated_at = NOW()
        WHERE id = :showId`,
      { replacements: { lead: next, defaults: JSON.stringify(nextDefaults), showId }, transaction });
  });
  return { lead_character_id: next };
}

/**
 * Links a scene set to a character as their home, closet or another place.
 * The lead's home or closet sets the show's scene default. Another
 * character's home or closet replaces their previous one.
 */
async function linkPlace(sequelize, { showId, characterId, sceneSetId, role, label }) {
  assertIds({ character_id: characterId, scene_set_id: sceneSetId });
  if (!ROLES.includes(role)) throw new CharacterPlacesError(`role must be one of ${ROLES.join(', ')}`);
  const cleanLabel = typeof label === 'string' ? label.trim() : '';
  if (cleanLabel.length > LABEL_MAX) throw new CharacterPlacesError(`label must be at most ${LABEL_MAX} characters`);
  const show = await loadShow(sequelize, showId);
  await assertCharacter(sequelize, showId, characterId);
  const set = sceneSetId ? await liveSet(sequelize, sceneSetId) : null;
  if (!set) throw new CharacterPlacesError('Scene set not found', 404, 'SCENE_SET_NOT_FOUND');
  if (set.show_id && String(set.show_id) !== String(showId)) throw new CharacterPlacesError(`"${set.name}" belongs to another show`);

  if (String(show.metadata.lead_character_id || '') === String(characterId) && SINGLE.has(role)) {
    await saveSceneDefaults(sequelize, { showId, body: { [LEAD_DEFAULT_KEY[role]]: set.id }, leadCharacterId: characterId });
    return listPlaces(sequelize, showId);
  }
  await sequelize.transaction(async (transaction) => {
    if (SINGLE.has(role)) {
      await sequelize.query(
        `UPDATE character_places SET deleted_at = NOW(), updated_at = NOW()
          WHERE registry_character_id = :characterId AND role = :role AND scene_set_id <> :setId AND deleted_at IS NULL`,
        { replacements: { characterId, role, setId: set.id }, transaction });
    }
    await sequelize.query(
      `INSERT INTO character_places (id, registry_character_id, scene_set_id, role, label, created_at, updated_at)
       VALUES (gen_random_uuid(), :characterId, :setId, :role, :label, NOW(), NOW())
       ON CONFLICT (registry_character_id, scene_set_id) WHERE deleted_at IS NULL
       DO UPDATE SET role = EXCLUDED.role, label = EXCLUDED.label, updated_at = NOW()`,
      { replacements: { characterId, setId: set.id, role, label: cleanLabel || null }, transaction });
  });
  return listPlaces(sequelize, showId);
}

/** Unlinks a character's place; for the lead's home or closet, clears the show default. */
async function unlinkPlace(sequelize, { showId, characterId, sceneSetId, role }) {
  assertIds({ character_id: characterId, scene_set_id: sceneSetId });
  const show = await loadShow(sequelize, showId);
  await assertCharacter(sequelize, showId, characterId);
  if (String(show.metadata.lead_character_id || '') === String(characterId) && SINGLE.has(role)) {
    const key = LEAD_DEFAULT_KEY[role];
    if (String(readSceneDefaults(show.metadata)[key] || '') === String(sceneSetId)) {
      await saveSceneDefaults(sequelize, { showId, body: { [key]: null }, leadCharacterId: characterId });
    }
    return listPlaces(sequelize, showId);
  }
  await sequelize.query(
    `UPDATE character_places SET deleted_at = NOW(), updated_at = NOW()
      WHERE registry_character_id = :characterId AND scene_set_id = :sceneSetId AND deleted_at IS NULL`,
    { replacements: { characterId, sceneSetId } });
  return listPlaces(sequelize, showId);
}

/**
 * Lala's home, filled in from what the show already knows (Evoni,
 * 2026-10-16: "if this is lalas home then we know the world location...
 * fill those in automatically").
 *   - A show that never chose a lead (no lead_character_id key; a lead set
 *     to None stays None) takes Lala, the registry's 'lala' character, as
 *     its lead. setLead keeps the show's home and closet as hers.
 *   - With Lala the lead and her home stored (shows.metadata.lala_home),
 *     her home and closet sets that have no World Location get one: a
 *     location of their own (one approved base each, S6) inside "Lala's
 *     home", the location at her street address, inside her DREAM city.
 *     "Lala's home" is made once, when no location has the address.
 * Only empty fields are filled; a location already chosen is kept.
 */
const isLala = (c) => String(c?.character_key || '').trim().toLowerCase() === 'lala'
  || String(c?.name || '').trim().toLowerCase() === 'lala';
const findLala = (characters) => characters.find((c) => String(c.character_key || '').trim().toLowerCase() === 'lala')
  || characters.find(isLala) || null;
const leadNeverChosen = (metadata) => !Object.prototype.hasOwnProperty.call(metadata || {}, 'lead_character_id');

/** The lead's home and closet sets with no World Location, when Lala's home can place them. */
async function unplacedLalaSets(sequelize, show, characters, transaction = null) {
  const { readLalaHome } = require('../utils/lalaHome');
  const lead = characters.find((c) => String(c.id) === String(show.metadata.lead_character_id || ''));
  if (!lead || !isLala(lead) || !readLalaHome(show.metadata)) return [];
  const ids = [...new Set(Object.values(readSceneDefaults(show.metadata)).filter(Boolean))];
  if (!ids.length) return [];
  const [sets] = await sequelize.query(
    `SELECT id, name, scene_type FROM scene_sets
      WHERE id IN (:ids) AND deleted_at IS NULL AND world_location_id IS NULL`,
    { replacements: { ids }, transaction });
  return sets;
}

async function lalaHomeFillPending(sequelize, show, characters) {
  if (leadNeverChosen(show.metadata) && findLala(characters)) return true;
  return (await unplacedLalaSets(sequelize, show, characters)).length > 0;
}

/** Returns { lead_set, placed: [{ scene_set_id, scene_set_name, world_location_id }], data }. */
async function fillLalaHome(sequelize, showId) {
  const { readLalaHome, dreamCityName } = require('../utils/lalaHome');
  let show = await loadShow(sequelize, showId);
  const characters = await showCharacters(sequelize, showId);
  let leadSet = false;
  const lala = findLala(characters);
  if (leadNeverChosen(show.metadata) && lala) {
    await setLead(sequelize, { showId, characterId: lala.id });
    leadSet = true;
    show = await loadShow(sequelize, showId);
  }
  const placed = [];
  await sequelize.transaction(async (transaction) => {
    // One fill per show at a time, so "Lala's home" is made once.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `lala-home:${showId}` }, transaction });
    const sets = await unplacedLalaSets(sequelize, show, characters, transaction);
    if (!sets.length) return;
    const home = readLalaHome(show.metadata);
    const city = dreamCityName(home.city) || home.city;
    const universeId = show.universe_id || null;
    const [[cityRow]] = await sequelize.query(
      `SELECT id FROM world_locations WHERE location_type = 'city' AND LOWER(name) = LOWER(:city) AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 1`, { replacements: { city }, transaction });
    let houseId = null;
    if (home.address) {
      const [[house]] = await sequelize.query(
        `SELECT id FROM world_locations WHERE LOWER(TRIM(street_address)) = LOWER(TRIM(:address)) AND deleted_at IS NULL
          ORDER BY (parent_location_id IS NULL), created_at ASC LIMIT 1`, { replacements: { address: home.address }, transaction });
      houseId = house?.id || null;
    }
    if (!houseId) {
      const [[house]] = await sequelize.query(
        `INSERT INTO world_locations (id, universe_id, name, description, location_type, narrative_role, parent_location_id,
                                      street_address, city, district, sensory_details, associated_characters, metadata, created_at, updated_at)
         VALUES (gen_random_uuid(), :universeId, 'Lala''s home', :description, 'interior', 'sanctuary', :parentId,
                 :address, :city, :district, '{}', CAST(:characters AS jsonb), CAST(:metadata AS jsonb), NOW(), NOW())
         RETURNING id`,
        { replacements: {
          universeId, parentId: cityRow?.id || null, address: home.address || null, city, district: home.neighbourhood || null,
          description: `Lala's home${home.address ? `, ${home.address}` : ''}, ${city}.`,
          characters: JSON.stringify(['lala']), metadata: JSON.stringify({ source: 'lala_home' }),
        }, transaction });
      houseId = house.id;
    }
    for (const set of sets) {
      const [[room]] = await sequelize.query(
        `INSERT INTO world_locations (id, universe_id, name, location_type, narrative_role, parent_location_id,
                                      street_address, city, district, sensory_details, associated_characters, metadata, created_at, updated_at)
         VALUES (gen_random_uuid(), :universeId, :name, 'interior', 'sanctuary', :houseId,
                 :address, :city, :district, '{}', CAST(:characters AS jsonb), CAST(:metadata AS jsonb), NOW(), NOW())
         RETURNING id`,
        { replacements: {
          universeId, name: set.name, houseId, address: home.address || null, city, district: home.neighbourhood || null,
          characters: JSON.stringify(['lala']), metadata: JSON.stringify({ source: 'lala_home', scene_set_id: set.id }),
        }, transaction });
      const [, meta] = await sequelize.query(
        `UPDATE scene_sets SET world_location_id = :roomId, updated_at = NOW()
          WHERE id = :setId AND world_location_id IS NULL AND deleted_at IS NULL`,
        { replacements: { roomId: room.id, setId: set.id }, transaction });
      if (meta?.rowCount === 0) {
        // Placed meanwhile: the room just made is not needed.
        await sequelize.query('DELETE FROM world_locations WHERE id = :id', { replacements: { id: room.id }, transaction });
        continue;
      }
      placed.push({ scene_set_id: set.id, scene_set_name: set.name, world_location_id: room.id });
    }
  });
  return { lead_set: leadSet, placed, data: await listPlaces(sequelize, showId) };
}

/**
 * The other characters' homes, for the Episode Locations step's quick add:
 * [{ character_id, character_name, scene_set_id, name, scene_set }].
 * The lead's home is the step's Home row already.
 */
async function characterHomes(sequelize, showId) {
  const { characters } = await listPlaces(sequelize, showId);
  const homes = [];
  for (const c of characters) {
    if (c.is_lead) continue;
    const home = c.places.find((p) => p.role === 'home');
    if (home) homes.push({ character_id: c.id, character_name: c.name, scene_set_id: home.scene_set_id, name: `${c.name}'s home`, scene_set_name: home.scene_set_name });
  }
  return homes;
}

module.exports = {
  ROLES,
  CharacterPlacesError,
  showCharacters,
  listPlaces,
  setLead,
  linkPlace,
  unlinkPlace,
  characterHomes,
  fillLalaHome,
};
