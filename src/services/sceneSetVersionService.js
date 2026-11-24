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

// C1 PR 2 (Evoni, 2026-11-24): the two writers below move an event to a set,
// so they take the Place order (services/eventPlaceSync): the event's linked
// episodes FOR SHARE, the event row, then their set rows without waiting.
// A transaction that lost to a lock, or found an episode or event it does
// not hold, is tried again; after the last try it is the retryable 409.
async function episodeFirst(sequelize, work) {
  const { isLockConflict, RetryableConflictError } = require('../utils/episodeLocks');
  try {
    return await require('./eventPlaceSync').inEpisodeFirstTransaction(sequelize, work);
  } catch (err) {
    if (isLockConflict(err) || (err instanceof RetryableConflictError && err.code === 'RETRY')) {
      const retry = new RetryableConflictError();
      throw new SceneSetVersionError(retry.message, 409, retry.code);
    }
    throw err;
  }
}
/** The set rows a version change writes, live only, in id order, never waited for (an event row is held). */
async function takeSetRows(sequelize, ids, transaction) {
  await sequelize.query(
    'SELECT id FROM scene_sets WHERE id IN (:ids) AND deleted_at IS NULL ORDER BY id FOR UPDATE NOWAIT',
    { replacements: { ids: [...new Set(ids.filter(Boolean).map(String))] }, transaction });
}

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
  // has_versions (an everyday set with event versions), used_by (the
  // events held at it; one other than the chosen event refuses it) and
  // is_everyday_look (its base is its location's approved everyday look,
  // seventh audit).
  const [everyday] = await sequelize.query(
    `SELECT s.id, s.name, s.base_still_url,
            EXISTS (SELECT 1 FROM scene_sets v WHERE v.version_of_set_id = s.id AND v.deleted_at IS NULL) AS has_versions,
            EXISTS (SELECT 1 FROM world_locations wl WHERE wl.approved_base_scene_set_id = s.id AND wl.deleted_at IS NULL) AS is_everyday_look,
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
  const place = require('./eventPlaceSync');
  return episodeFirst(sequelize, async (transaction) => {
    // Episode-first: the event's linked episodes, the event row, the proof
    // that no episode was linked meanwhile, then both set rows (live only,
    // in id order, not waited for). The reads below find them already held.
    await place.shareLinkedEpisodes(sequelize, eventId, { transaction });
    try {
      await require('../utils/eventEpisodeLink').lockLiveEvent(sequelize, eventId, { transaction });
    } catch (err) {
      // Not there, or deleted: answered below as it always was (EVENT_NOT_FOUND).
      if (err?.code !== require('../utils/eventEpisodeLink').EVENT_DELETED_CODE) throw err;
    }
    await place.assertLinkedEpisodesHeld(sequelize, eventId, { transaction });
    await takeSetRows(sequelize, [setId, everydaySetId], transaction);
    const set = await liveSet(sequelize, setId, transaction, true);
    if (!set) throw new SceneSetVersionError('Scene set not found', 404, 'SET_NOT_FOUND');
    // Locked too, so a set made a version meanwhile cannot become this
    // one's everyday set (seventh audit: a version of a version).
    const everyday = await liveSet(sequelize, everydaySetId, transaction, true);
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
    // A location's approved everyday look is not one event's photos (seventh audit).
    const [[approvedAt]] = await sequelize.query(
      'SELECT name FROM world_locations WHERE approved_base_scene_set_id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: set.id }, transaction });
    if (approvedAt) {
      throw new SceneSetVersionError(`"${set.name}" is ${approvedAt.name}'s everyday look: un-approve it first`, 409, 'IS_EVERYDAY_LOOK');
    }
    const [[event]] = await sequelize.query(
      'SELECT id, name, show_id, scene_set_id FROM world_events WHERE id = :eventId AND deleted_at IS NULL FOR UPDATE',
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
    if (String(event.scene_set_id || '') !== String(set.id) && await isPlaceLocked(sequelize, event.id, { transaction })) {
      throw new SceneSetVersionError(PLACE_LOCKED_MESSAGE, 409, PLACE_LOCKED_CODE);
    }
    // A shared set other shows use is not claimed for this one (seventh
    // audit; PUT /:id refuses the same move).
    if (!set.show_id && showId) {
      const { otherShowUses } = require('./sceneSetUsesService');
      if (await otherShowUses(sequelize, set.id, showId, { transaction }) > 0) {
        throw new SceneSetVersionError(`Other shows use "${set.name}": it stays shared, so it is not one event's photos`, 409, 'USED_BY_ANOTHER_SHOW');
      }
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
    // Its draft episode follows: the Event location and its beats (eighth audit).
    await require('./eventPlaceSync').syncEpisodeEventLocation(sequelize,
      { eventId: event.id, fromSetId: event.scene_set_id, toSetId: set.id, transaction });
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
  const place = require('./eventPlaceSync');
  const { lockLiveEvent, EVENT_DELETED_CODE } = require('../utils/eventEpisodeLink');
  const { RetryableConflictError } = require('../utils/episodeLocks');
  return episodeFirst(sequelize, async (transaction) => {
    // Returning the events is rooted at the set: the events held at it are
    // read, their linked episodes locked in one ascending statement, then
    // each event (ascending), the proof that no episode was linked
    // meanwhile, and only then the set row, without waiting.
    let heldEvents = null;
    if (returnEvent) {
      const [seen] = await sequelize.query(
        'SELECT id FROM world_events WHERE scene_set_id = :id AND deleted_at IS NULL ORDER BY id', { replacements: { id: setId }, transaction });
      const eventIds = seen.map((e) => String(e.id));
      await place.shareLinkedEpisodes(sequelize, eventIds, { transaction });
      for (const id of eventIds) {
        try {
          await lockLiveEvent(sequelize, id, { transaction });
        } catch (err) {
          // Deleted since it was read: what was discovered is stale.
          if (err?.code === EVENT_DELETED_CODE) throw new RetryableConflictError();
          throw err;
        }
      }
      await place.assertLinkedEpisodesHeld(sequelize, eventIds, { transaction });
      await takeSetRows(sequelize, [setId], transaction);
      heldEvents = new Set(eventIds);
    }
    const set = await liveSet(sequelize, setId, transaction, true);
    if (!set) throw new SceneSetVersionError('Scene set not found', 404, 'SET_NOT_FOUND');
    const everydayId = set.version_of_set_id || null;
    let returned = null;
    // "Stop using these photos" on a set that is no longer a version did
    // nothing and said it had (seventh audit): it is refused, saying why.
    if (returnEvent && !everydayId) {
      throw new SceneSetVersionError(`"${set.name}" is already its own set: choose where its event is held on the event's page`, 409, 'NOT_A_VERSION');
    }
    if (returnEvent && everydayId) {
      // A deleted everyday set cannot take its event back (fifth audit): its
      // version kept pointing at it after a delete, and the event was moved
      // onto a removed set.
      // The everyday set's row is held, live only, before it is read: the
      // events are about to reference it (the set rule).
      const everydayHeld = await place.holdLiveSet(sequelize, everydayId, { transaction, nowait: true });
      const everyday = everydayHeld ? await liveSet(sequelize, everydayId, transaction) : null;
      if (!everyday) {
        throw new SceneSetVersionError('Its everyday set was deleted: choose where the event is held on the event\'s page', 409, 'EVERYDAY_GONE');
      }
      const [events] = await sequelize.query(
        'SELECT id, name, show_id FROM world_events WHERE scene_set_id = :id AND deleted_at IS NULL',
        { replacements: { id: set.id }, transaction });
      // An event that came to the set after the events were locked is not held: start again.
      if (events.some((e) => !heldEvents.has(String(e.id)))) throw new RetryableConflictError();
      // An everyday set moved to another show does not take this show's
      // event (seventh audit).
      const crossing = events.find((e) => !sameShow(e.show_id, everyday.show_id));
      if (crossing) {
        throw new SceneSetVersionError(`"${everyday.name}" now belongs to another show: choose where ${crossing.name} is held on the event's page`, 409, 'OTHER_SHOW');
      }
      for (const e of events) {
        if (await isPlaceLocked(sequelize, e.id, { transaction })) throw new SceneSetVersionError(PLACE_LOCKED_MESSAGE, 409, PLACE_LOCKED_CODE);
      }
      if (events.length) {
        await sequelize.query(
          'UPDATE world_events SET scene_set_id = :everydayId, updated_at = NOW() WHERE scene_set_id = :id AND deleted_at IS NULL',
          { replacements: { id: set.id, everydayId }, transaction });
        for (const e of events) {
          await require('./eventPlaceSync').syncEpisodeEventLocation(sequelize,
            { eventId: e.id, fromSetId: set.id, toSetId: everydayId, transaction });
        }
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
  // A version's event says whether its Place is locked, so "Stop using
  // these photos" is not offered for it (seventh audit).
  const { isPlaceLocked } = require('../utils/placeLock');
  const lockedIds = new Set();
  for (const e of eventRows) {
    if (versionRows.some((v) => String(v.id) === String(e.scene_set_id)) && await isPlaceLocked(sequelize, e.id)) lockedIds.add(String(e.id));
  }
  const eventOf = (setId) => {
    const e = eventRows.find((r) => String(r.scene_set_id) === String(setId));
    return e ? { id: e.id, name: e.name, show_id: e.show_id, locked: lockedIds.has(String(e.id)) } : null;
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
