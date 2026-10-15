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

const ROLES = Object.freeze(['home', 'closet', 'other']);
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
  const [[show]] = await sequelize.query('SELECT id, metadata FROM shows WHERE id = :showId AND deleted_at IS NULL', { replacements: { showId } });
  if (!show) throw new CharacterPlacesError('Show not found', 404, 'SHOW_NOT_FOUND');
  return { ...show, metadata: parseMetadata(show.metadata) };
}

/** The show's characters: those in its registries, by name. */
async function showCharacters(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT c.id, COALESCE(NULLIF(c.selected_name, ''), c.display_name) AS name, c.role_type
       FROM registry_characters c
       JOIN character_registries r ON r.id = c.registry_id AND r.deleted_at IS NULL
      WHERE r.show_id = :showId AND c.deleted_at IS NULL
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
 * defaults (empty when she has none). One transaction; the metadata keys
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
    const nextDefaults = { home_set_id: null, closet_set_id: null };
    if (oldLead) {
      for (const [role, key] of Object.entries(LEAD_DEFAULT_KEY)) {
        if (!defaults[key]) continue;
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
    await saveSceneDefaults(sequelize, { showId, body: { [LEAD_DEFAULT_KEY[role]]: set.id } });
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
      await saveSceneDefaults(sequelize, { showId, body: { [key]: null } });
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
};
