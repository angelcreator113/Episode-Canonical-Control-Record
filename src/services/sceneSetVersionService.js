'use strict';

/**
 * Everyday sets and their event versions (Evoni, 2026-10-16: "i also need to
 * be able to choose which photo is the everyday set and which ones belong to
 * an event set"; she chose whole sets: "Lala's bedroom [Everyday]",
 * "Lala's bedroom – Gala [Event: Spring Gala] → version of Lala's bedroom").
 *
 *   - An everyday set is a place as it usually is (version_of_set_id NULL,
 *     every set until one is marked).
 *   - An event version is that place dressed for one event: its
 *     version_of_set_id names the everyday set, and the event uses it
 *     (world_events.scene_set_id), so the event's scenes and look are made
 *     on it. It takes the everyday set's World Location and show when it has
 *     none, so the event's venue finds it.
 *   - An everyday set is not itself a version; a set with versions is not
 *     made a version of another; a version is for one event, so a set other
 *     events use is not made one; a locked event's place does not change.
 *   - Marking a version everyday again leaves its event using it: the
 *     event's look and scenes were made on it.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class SceneSetVersionError extends Error {
  constructor(message, status = 400, code = 'SET_VERSION_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assertId(name, value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new SceneSetVersionError(`${name} must be an id`, 400, 'BAD_ID');
}

async function liveSet(sequelize, id, transaction = null, lock = false) {
  const [[set]] = await sequelize.query(
    `SELECT id, name, show_id, world_location_id, version_of_set_id FROM scene_sets
      WHERE id = :id AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    { replacements: { id }, transaction });
  return set || null;
}

const sameShow = (a, b) => !a || !b || String(a) === String(b);

/**
 * What a set's version chooser offers: the everyday sets it can be a
 * version of (same show or no show, not itself, not a version) and the
 * show's events (locked ones marked).
 */
async function versionOptions(sequelize, setId) {
  assertId('id', setId);
  const set = await liveSet(sequelize, setId);
  if (!set) throw new SceneSetVersionError('Scene set not found', 404, 'SET_NOT_FOUND');
  // Each set offered says what would refuse it as an event's photos (fifth
  // audit: the list offered them all, and the refusal came after a try):
  // has_versions (an everyday set with event versions) and used_by (the
  // events held at it; one other than the chosen event refuses it).
  const [everyday] = await sequelize.query(
    `SELECT s.id, s.name, s.base_still_url,
            EXISTS (SELECT 1 FROM scene_sets v WHERE v.version_of_set_id = s.id AND v.deleted_at IS NULL) AS has_versions,
            COALESCE((SELECT json_agg(json_build_object('id', e.id, 'name', e.name) ORDER BY e.name)
                        FROM world_events e WHERE e.scene_set_id = s.id AND e.deleted_at IS NULL), '[]'::json) AS used_by
       FROM scene_sets s
      WHERE s.deleted_at IS NULL AND s.version_of_set_id IS NULL AND s.id <> :id
        AND (CAST(:showId AS uuid) IS NULL OR s.show_id IS NULL OR s.show_id = CAST(:showId AS uuid))
      ORDER BY s.name ASC`,
    { replacements: { id: set.id, showId: set.show_id || null } });
  const [events] = set.show_id ? await sequelize.query(
    `SELECT id, name, scene_set_id FROM world_events
      WHERE show_id = :showId AND deleted_at IS NULL ORDER BY name ASC`,
    { replacements: { showId: set.show_id } }) : [[]];
  const { isPlaceLocked } = require('../utils/placeLock');
  const withLocks = [];
  for (const e of events) withLocks.push({ ...e, locked: await isPlaceLocked(sequelize, e.id) });
  return { everyday_sets: everyday, events: withLocks };
}

/** Makes a set an event version of an everyday set, for one event. */
async function makeEventVersion(sequelize, { setId, everydaySetId, eventId }) {
  assertId('id', setId);
  assertId('everyday_set_id', everydaySetId);
  assertId('event_id', eventId);
  if (String(setId) === String(everydaySetId)) throw new SceneSetVersionError('A set cannot be a version of itself');
  const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../utils/placeLock');
  return sequelize.transaction(async (transaction) => {
    const set = await liveSet(sequelize, setId, transaction, true);
    if (!set) throw new SceneSetVersionError('Scene set not found', 404, 'SET_NOT_FOUND');
    const everyday = await liveSet(sequelize, everydaySetId, transaction);
    if (!everyday) throw new SceneSetVersionError('The everyday set was not found', 404, 'EVERYDAY_NOT_FOUND');
    if (everyday.version_of_set_id) {
      throw new SceneSetVersionError(`"${everyday.name}" is itself an event version: choose an everyday set`, 400, 'NOT_EVERYDAY');
    }
    if (!sameShow(set.show_id, everyday.show_id)) {
      throw new SceneSetVersionError(`"${everyday.name}" belongs to another show`, 400, 'OTHER_SHOW');
    }
    const [[versions]] = await sequelize.query(
      'SELECT COUNT(*)::int AS n FROM scene_sets WHERE version_of_set_id = :id AND deleted_at IS NULL',
      { replacements: { id: set.id }, transaction });
    if (versions.n > 0) {
      throw new SceneSetVersionError(`"${set.name}" has event versions of its own: it stays an everyday set`, 409, 'HAS_VERSIONS');
    }
    const [[event]] = await sequelize.query(
      'SELECT id, name, show_id, scene_set_id FROM world_events WHERE id = :eventId AND deleted_at IS NULL',
      { replacements: { eventId }, transaction });
    const showId = set.show_id || everyday.show_id || null;
    if (!event || (showId && String(event.show_id) !== String(showId))) {
      throw new SceneSetVersionError('That event is not one of this set\'s show', 404, 'EVENT_NOT_FOUND');
    }
    const [others] = await sequelize.query(
      'SELECT name FROM world_events WHERE scene_set_id = :id AND id <> :eventId AND deleted_at IS NULL ORDER BY name',
      { replacements: { id: set.id, eventId: event.id }, transaction });
    if (others.length) {
      throw new SceneSetVersionError(
        `"${set.name}" is used by ${others.map((o) => o.name).join(', ')}: an event version is for one event`, 409, 'USED_BY_OTHER_EVENTS');
    }
    if (String(event.scene_set_id || '') !== String(set.id) && await isPlaceLocked(sequelize, event.id)) {
      throw new SceneSetVersionError(PLACE_LOCKED_MESSAGE, 409, PLACE_LOCKED_CODE);
    }
    await sequelize.query(
      `UPDATE scene_sets
          SET version_of_set_id = :everydayId,
              world_location_id = COALESCE(world_location_id, CAST(:locationId AS uuid)),
              show_id = COALESCE(show_id, CAST(:showId AS uuid)),
              updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: set.id, everydayId: everyday.id, locationId: everyday.world_location_id || null, showId: showId || event.show_id || null }, transaction });
    await sequelize.query(
      'UPDATE world_events SET scene_set_id = :id, updated_at = NOW() WHERE id = :eventId',
      { replacements: { id: set.id, eventId: event.id }, transaction });
    return {
      scene_set_id: set.id,
      version_of: { id: everyday.id, name: everyday.name },
      event: { id: event.id, name: event.name },
    };
  });
}

/**
 * Makes a set everyday again; its event keeps using it. With returnEvent,
 * "Stop using these photos" on the everyday place's event card (Evoni,
 * 2026-10-17): the event is held at the everyday set again, unless its
 * episode is accepted (the Place is locked).
 */
async function makeEveryday(sequelize, setId, { returnEvent = false } = {}) {
  assertId('id', setId);
  const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../utils/placeLock');
  return sequelize.transaction(async (transaction) => {
    const set = await liveSet(sequelize, setId, transaction, true);
    if (!set) throw new SceneSetVersionError('Scene set not found', 404, 'SET_NOT_FOUND');
    const everydayId = set.version_of_set_id || null;
    let returned = null;
    if (returnEvent && everydayId) {
      // A deleted everyday set cannot take its event back (fifth audit): its
      // version kept pointing at it after a delete, and the event was moved
      // onto a removed set.
      if (!(await liveSet(sequelize, everydayId, transaction))) {
        throw new SceneSetVersionError('Its everyday set was deleted: choose where the event is held on the event\'s page', 409, 'EVERYDAY_GONE');
      }
      const [events] = await sequelize.query(
        'SELECT id, name FROM world_events WHERE scene_set_id = :id AND deleted_at IS NULL',
        { replacements: { id: set.id }, transaction });
      for (const e of events) {
        if (await isPlaceLocked(sequelize, e.id)) throw new SceneSetVersionError(PLACE_LOCKED_MESSAGE, 409, PLACE_LOCKED_CODE);
      }
      if (events.length) {
        await sequelize.query(
          'UPDATE world_events SET scene_set_id = :everydayId, updated_at = NOW() WHERE scene_set_id = :id AND deleted_at IS NULL',
          { replacements: { id: set.id, everydayId }, transaction });
        returned = { scene_set_id: everydayId, events: events.map((e) => ({ id: e.id, name: e.name })) };
      }
    }
    await sequelize.query('UPDATE scene_sets SET version_of_set_id = NULL, updated_at = NOW() WHERE id = :id',
      { replacements: { id: set.id }, transaction });
    return { scene_set_id: set.id, version_of: null, returned };
  });
}

/**
 * For the Scene Sets list: each set's everyday set (version_of, with the
 * event it is for) and, for an everyday set, its event versions.
 * Map setId -> { version_of, version_event, event_versions }.
 */
async function versionsForSets(sequelize, sets) {
  const out = new Map();
  const list = (sets || []).filter((s) => s && s.id);
  if (!list.length) return out;
  const ids = list.map((s) => s.id);
  const parents = [...new Set(list.map((s) => s.version_of_set_id).filter(Boolean))];
  const [parentRows] = parents.length ? await sequelize.query(
    'SELECT id, name FROM scene_sets WHERE id IN (:parents) AND deleted_at IS NULL', { replacements: { parents } }) : [[]];
  const [versionRows] = await sequelize.query(
    `SELECT id, name, version_of_set_id FROM scene_sets
      WHERE version_of_set_id IN (:ids) AND deleted_at IS NULL ORDER BY name ASC`, { replacements: { ids } });
  const eventSetIds = [...new Set([...ids, ...versionRows.map((v) => v.id)])];
  const [eventRows] = await sequelize.query(
    `SELECT id, name, show_id, scene_set_id FROM world_events
      WHERE scene_set_id IN (:eventSetIds) AND deleted_at IS NULL ORDER BY name ASC`, { replacements: { eventSetIds } });
  const parentById = new Map(parentRows.map((p) => [String(p.id), p]));
  const eventOf = (setId) => {
    const e = eventRows.find((r) => String(r.scene_set_id) === String(setId));
    return e ? { id: e.id, name: e.name, show_id: e.show_id } : null;
  };
  for (const s of list) {
    const parent = s.version_of_set_id ? parentById.get(String(s.version_of_set_id)) : null;
    out.set(s.id, {
      // A version whose everyday set was deleted reads as everyday.
      version_of: parent ? { id: parent.id, name: parent.name } : null,
      version_event: parent ? eventOf(s.id) : null,
      event_versions: versionRows.filter((v) => String(v.version_of_set_id) === String(s.id))
        .map((v) => ({ id: v.id, name: v.name, event: eventOf(v.id) })),
    });
  }
  return out;
}

module.exports = {
  SceneSetVersionError,
  versionOptions,
  makeEventVersion,
  makeEveryday,
  versionsForSets,
};
