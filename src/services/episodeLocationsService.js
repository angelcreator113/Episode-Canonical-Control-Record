/**
 * Episode Locations (Evoni's rulings L3 and L6, 2026-10-02, with her answers
 * Q12–Q16; docs/EVENT_EPISODE_FLOW.md §8(hh),
 * docs/VENUE_LOOKS_EPISODE_LOCATIONS_NOTE.md).
 *
 *   L3. "The show keeps Lala's home set and closet set as saved defaults. At
 *   Start Episode, an Episode Locations step shows Home, Closet and Event
 *   (the event's set with its look) plus any additional locations, each
 *   changeable; creating a new set there returns to the step with it
 *   selected."
 *   L6. "An episode can have any number of scene sets, each with a role
 *   (home, closet, event, or an extra location such as a car or café).
 *   They're chosen together in the Episode Locations step and can be added
 *   or changed while the episode is a draft."
 *
 * A location is { role, scene_set_id, name }: role home, closet or event
 * (one each) or extra (any number, each with a free name, Q15). They are
 * stored on scene_set_episodes (role, role_name), ordered event, home,
 * closet, then extras. A set holds one role in an episode.
 *
 * The show's defaults live in shows.metadata.scene_defaults
 * ({ home_set_id, closet_set_id }, Q12). With no default the step asks: the
 * proposal leaves that role empty.
 */

const ROLES = Object.freeze(['event', 'home', 'closet', 'extra']);
const SINGLE_ROLES = new Set(['event', 'home', 'closet']);
const DEFAULT_ROLES = Object.freeze({ home: 'home_set_id', closet: 'closet_set_id' });
const NAME_MAX = 80;

class EpisodeLocationsError extends Error {
  constructor(message, status = 400, code = 'EPISODE_LOCATIONS_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const roleOrder = (role) => ROLES.indexOf(role);

/**
 * Validated locations, ordered event, home, closet, extras. Any number of
 * extras (Q15); a set holds one role, so the show's sets bound the list.
 */
function normaliseLocations(list) {
  if (!Array.isArray(list)) throw new EpisodeLocationsError('locations must be a list');
  const seenRoles = new Set();
  const seenSets = new Set();
  const out = list.map((raw, i) => {
    const role = typeof raw?.role === 'string' ? raw.role.trim().toLowerCase() : '';
    if (!ROLES.includes(role)) throw new EpisodeLocationsError(`location ${i + 1}: role must be one of ${ROLES.join(', ')}`);
    const setId = typeof raw?.scene_set_id === 'string' ? raw.scene_set_id.trim() : '';
    if (!setId) throw new EpisodeLocationsError(`location ${i + 1}: scene_set_id is required`);
    if (SINGLE_ROLES.has(role)) {
      if (seenRoles.has(role)) throw new EpisodeLocationsError(`An episode has one ${role} location`);
      seenRoles.add(role);
    }
    if (seenSets.has(setId)) throw new EpisodeLocationsError('A scene set holds one role in an episode');
    seenSets.add(setId);
    let name = null;
    if (role === 'extra') {
      name = typeof raw?.name === 'string' ? raw.name.trim() : '';
      if (!name) throw new EpisodeLocationsError(`location ${i + 1}: an extra location needs a name`);
      if (name.length > NAME_MAX) throw new EpisodeLocationsError(`location ${i + 1}: name must be at most ${NAME_MAX} characters`);
    }
    return { role, scene_set_id: setId, name, index: i };
  });
  return out
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.index - b.index)
    .map(({ index: _i, ...l }) => l);
}

function readSceneDefaults(metadata) {
  const d = (metadata && typeof metadata === 'object' && metadata.scene_defaults) || {};
  return { home_set_id: d.home_set_id || null, closet_set_id: d.closet_set_id || null };
}

async function liveSets(sequelize, ids, transaction) {
  if (!ids.length) return new Map();
  const [rows] = await sequelize.query(
    `SELECT id, name, show_id, scene_type, base_still_url FROM scene_sets
      WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids }, transaction });
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Every set must exist. Home, closet and extras must be this show's (or
 * shared, with no show); the event's set may be any live set, as S7's
 * picker offers sets at the venue whatever their show.
 */
async function assertUsable(sequelize, showId, locations, transaction) {
  const sets = await liveSets(sequelize, locations.map((l) => l.scene_set_id), transaction);
  for (const l of locations) {
    const set = sets.get(l.scene_set_id);
    if (!set) throw new EpisodeLocationsError(`The ${l.role} scene set no longer exists`, 404, 'SCENE_SET_NOT_FOUND');
    if (l.role !== 'event' && set.show_id && String(set.show_id) !== String(showId)) {
      throw new EpisodeLocationsError(`"${set.name}" belongs to another show`);
    }
  }
  return sets;
}

/**
 * The step's starting point (L3, Q12): home and closet from the show's
 * defaults (a default that no longer exists is left empty), the event's
 * set, no extras. missing lists the roles left to choose.
 */
async function proposeLocations(sequelize, { showId, event, transaction }) {
  const [[show]] = await sequelize.query('SELECT metadata FROM shows WHERE id = :showId', { replacements: { showId }, transaction });
  const defaults = readSceneDefaults(show?.metadata);
  const wanted = [
    event?.scene_set_id ? { role: 'event', scene_set_id: event.scene_set_id } : null,
    defaults.home_set_id ? { role: 'home', scene_set_id: defaults.home_set_id } : null,
    defaults.closet_set_id ? { role: 'closet', scene_set_id: defaults.closet_set_id } : null,
  ].filter(Boolean);
  const sets = await liveSets(sequelize, wanted.map((l) => l.scene_set_id), transaction);
  const locations = wanted
    .filter((l) => sets.has(l.scene_set_id))
    .filter((l) => l.role === 'event' || !sets.get(l.scene_set_id).show_id || String(sets.get(l.scene_set_id).show_id) === String(showId))
    .filter((l, i, all) => all.findIndex((x) => x.scene_set_id === l.scene_set_id) === i)
    .map((l) => ({ ...l, name: null, scene_set: setSummary(sets.get(l.scene_set_id)) }));
  const have = new Set(locations.map((l) => l.role));
  return { locations, missing: ['event', 'home', 'closet'].filter((r) => !have.has(r)), defaults };
}

function setSummary(set) {
  return set ? { id: set.id, name: set.name, scene_type: set.scene_type, base_still_url: set.base_still_url || null } : null;
}

/** The episode's locations as stored, in order. */
async function listLocations(sequelize, episodeId, transaction) {
  const [rows] = await sequelize.query(
    `SELECT l.scene_set_id, l.role, l.role_name, l.sort_order,
            s.name, s.scene_type, s.base_still_url,
            (SELECT COUNT(*)::int FROM scene_angles a WHERE a.scene_set_id = s.id AND a.deleted_at IS NULL) AS angle_count
       FROM scene_set_episodes l JOIN scene_sets s ON s.id = l.scene_set_id AND s.deleted_at IS NULL
      WHERE l.episode_id = :episodeId AND l.deleted_at IS NULL
      ORDER BY l.sort_order ASC, l.created_at ASC`,
    { replacements: { episodeId }, transaction });
  return rows.map((r) => ({
    role: r.role || 'extra',
    scene_set_id: r.scene_set_id,
    name: r.role_name || null,
    scene_set: setSummary({ id: r.scene_set_id, name: r.name, scene_type: r.scene_type, base_still_url: r.base_still_url }),
    // L12 (§8(hh)): the Scenes tab's Locations show each set's angle count.
    angle_count: r.angle_count ?? 0,
  }));
}

/**
 * Store the locations on scene_set_episodes, inside `transaction`: sets no
 * longer chosen are unlinked (soft-deleted); the rest are linked with their
 * role, name and order. A home, closet or event changed to another set
 * takes its unlocked plan beats with it (Q16); locked beats stay. An extra
 * moves its beats when it keeps its name.
 */
async function applyLocations(sequelize, { episodeId, locations, transaction }) {
  const [current] = await sequelize.query(
    `SELECT id, scene_set_id, role, role_name FROM scene_set_episodes
      WHERE episode_id = :episodeId AND deleted_at IS NULL`,
    { replacements: { episodeId }, transaction });

  const sameSlot = (old, l) => old.role === l.role && (l.role !== 'extra' || (old.role_name || '') === (l.name || ''));
  for (const l of locations) {
    const old = current.find((c) => sameSlot(c, l));
    if (old && old.scene_set_id !== l.scene_set_id) {
      await sequelize.query(
        `UPDATE scene_plans SET scene_set_id = :next, updated_at = NOW()
          WHERE episode_id = :episodeId AND scene_set_id = :prev AND locked = false
            AND chosen_by_user = false AND deleted_at IS NULL`,
        { replacements: { next: l.scene_set_id, prev: old.scene_set_id, episodeId }, transaction });
    }
  }

  const keep = locations.map((l) => l.scene_set_id);
  await sequelize.query(
    `UPDATE scene_set_episodes SET deleted_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND deleted_at IS NULL ${keep.length ? 'AND scene_set_id NOT IN (:keep)' : ''}`,
    { replacements: { episodeId, keep }, transaction });

  for (let i = 0; i < locations.length; i += 1) {
    const l = locations[i];
    await sequelize.query(
      `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, role_name, created_at, updated_at)
       VALUES (gen_random_uuid(), :setId, :episodeId, :order, :role, :name, NOW(), NOW())
       ON CONFLICT (scene_set_id, episode_id) WHERE deleted_at IS NULL
       DO UPDATE SET sort_order = EXCLUDED.sort_order, role = EXCLUDED.role, role_name = EXCLUDED.role_name, updated_at = NOW()`,
      { replacements: { setId: l.scene_set_id, episodeId, order: i, role: l.role, name: l.name }, transaction });
  }
  return listLocations(sequelize, episodeId, transaction);
}

/**
 * L6: Evoni changes an episode's locations while it is a draft. Refused
 * (409 EPISODE_ACCEPTED) once the episode is accepted.
 */
async function saveEpisodeLocations(sequelize, { showId, episodeId, locations: body }) {
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id, evaluation_status FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId } });
  if (!episode || (showId && String(episode.show_id) !== String(showId))) {
    throw new EpisodeLocationsError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  }
  if (episode.evaluation_status === 'accepted') {
    throw new EpisodeLocationsError('This episode is accepted: its locations are locked', 409, 'EPISODE_ACCEPTED');
  }
  const locations = normaliseLocations(body);
  return sequelize.transaction(async (transaction) => {
    await assertUsable(sequelize, episode.show_id, locations, transaction);
    return applyLocations(sequelize, { episodeId, locations, transaction });
  });
}

/**
 * Start Episode's locations: those Evoni confirmed in the step, validated;
 * or, with none given (an older caller, or Regenerate), the proposal, with
 * this show's oldest HOME_BASE set as home when there is no default (B1).
 */
async function resolveStartLocations(sequelize, { showId, event, locations }) {
  if (locations !== undefined && locations !== null) {
    const list = normaliseLocations(locations);
    await assertUsable(sequelize, showId, list);
    return list;
  }
  const { locations: proposed } = await proposeLocations(sequelize, { showId, event });
  const list = proposed.map(({ scene_set: _s, ...l }) => l);
  if (!list.some((l) => l.role === 'home')) {
    const [[home]] = await sequelize.query(
      `SELECT id FROM scene_sets
        WHERE scene_type = 'HOME_BASE' AND show_id = :showId AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC LIMIT 1`,
      { replacements: { showId } });
    if (home && !list.some((l) => l.scene_set_id === home.id)) list.push({ role: 'home', scene_set_id: home.id, name: null });
  }
  return list.sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
}

/** Q12: the show's saved home and closet sets ("Make default" in Scene Sets). */
async function saveSceneDefaults(sequelize, { showId, body }) {
  const [[show]] = await sequelize.query('SELECT id, metadata FROM shows WHERE id = :showId', { replacements: { showId } });
  if (!show) throw new EpisodeLocationsError('Show not found', 404, 'SHOW_NOT_FOUND');
  const next = { ...readSceneDefaults(show.metadata) };
  for (const [role, key] of Object.entries(DEFAULT_ROLES)) {
    if (body?.[key] === undefined) continue;
    const id = body[key] || null;
    if (id) {
      const sets = await liveSets(sequelize, [id]);
      const set = sets.get(id);
      if (!set) throw new EpisodeLocationsError(`The ${role} scene set no longer exists`, 404, 'SCENE_SET_NOT_FOUND');
      if (set.show_id && String(set.show_id) !== String(showId)) throw new EpisodeLocationsError(`"${set.name}" belongs to another show`);
    }
    next[key] = id;
  }
  const metadata = { ...(show.metadata || {}), scene_defaults: next };
  await sequelize.query('UPDATE shows SET metadata = CAST(:metadata AS json), updated_at = NOW() WHERE id = :showId',
    { replacements: { metadata: JSON.stringify(metadata), showId } });
  return next;
}

/**
 * L11 (Evoni, 2026-10-02, §8(hh)): "choosing a set not yet linked to the
 * episode adds it to the episode's locations as an extra (or the matching
 * role if that role is empty)." The matching role is the set's type's
 * (Home Base: home, Closet: closet, Event location: event). The set must be
 * the show's or have no show. An accepted episode's locations are locked
 * (409). Returns { added, role, name }; a set already linked adds nothing.
 */
const ROLE_OF_TYPE = Object.freeze({ HOME_BASE: 'home', CLOSET: 'closet', EVENT_LOCATION: 'event' });
async function linkBeatSet(sequelize, { episodeId, sceneSetId, transaction }) {
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id, evaluation_status FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, transaction });
  if (!episode) throw new EpisodeLocationsError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  const [links] = await sequelize.query(
    `SELECT scene_set_id, role, sort_order FROM scene_set_episodes
      WHERE episode_id = :episodeId AND deleted_at IS NULL`,
    { replacements: { episodeId }, transaction });
  const existing = links.find((l) => String(l.scene_set_id) === String(sceneSetId));
  if (existing) return { added: false, role: existing.role || 'extra', name: null };

  const set = (await liveSets(sequelize, [sceneSetId], transaction)).get(sceneSetId);
  if (!set) throw new EpisodeLocationsError('That scene set no longer exists', 404, 'SCENE_SET_NOT_FOUND');
  if (set.show_id && String(set.show_id) !== String(episode.show_id)) {
    throw new EpisodeLocationsError(`"${set.name}" belongs to another show`);
  }
  if (episode.evaluation_status === 'accepted') {
    throw new EpisodeLocationsError('This episode is accepted: its locations are locked', 409, 'EPISODE_ACCEPTED');
  }
  const typeRole = ROLE_OF_TYPE[set.scene_type];
  const role = typeRole && !links.some((l) => l.role === typeRole) ? typeRole : 'extra';
  const name = role === 'extra' ? String(set.name || 'Location').slice(0, NAME_MAX) : null;
  const sortOrder = links.reduce((max, l) => Math.max(max, Number(l.sort_order) || 0), -1) + 1;
  await sequelize.query(
    `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
     VALUES (gen_random_uuid(), :sceneSetId, :episodeId, :role, :name, :sortOrder, NOW(), NOW())
     ON CONFLICT (scene_set_id, episode_id) WHERE deleted_at IS NULL DO NOTHING`,
    { replacements: { sceneSetId, episodeId, role, name, sortOrder }, transaction });
  return { added: true, role, name };
}

module.exports = {
  ROLES,
  EpisodeLocationsError,
  normaliseLocations,
  readSceneDefaults,
  proposeLocations,
  listLocations,
  applyLocations,
  saveEpisodeLocations,
  resolveStartLocations,
  saveSceneDefaults,
  linkBeatSet,
};
