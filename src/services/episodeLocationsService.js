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
    `SELECT s.id, s.name, s.show_id, s.scene_type, s.base_still_url,
            (SELECT a.still_image_url FROM scene_angles a WHERE a.id = s.cover_angle_id AND a.deleted_at IS NULL) AS cover_image_url
       FROM scene_sets s
      WHERE s.id IN (:ids) AND s.deleted_at IS NULL`,
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
  // A default home or closet whose set was deleted: the step says so, not
  // just "no saved default" (fourth audit, 2026-10-15).
  const removed = wanted.filter((l) => l.role !== 'event' && !sets.has(l.scene_set_id)).map((l) => l.role);
  return { locations, missing: ['event', 'home', 'closet'].filter((r) => !have.has(r)), removed, defaults };
}

// cover_image_url: the image of the set's library cover view (chosen in
// Scene Sets), which pages show as the set's thumbnail before its base.
function setSummary(set) {
  return set ? {
    id: set.id, name: set.name, scene_type: set.scene_type,
    base_still_url: set.base_still_url || null, cover_image_url: set.cover_image_url || null,
  } : null;
}

/** The episode's locations as stored, in order. */
async function listLocations(sequelize, episodeId, transaction) {
  const [rows] = await sequelize.query(
    `SELECT l.scene_set_id, l.role, l.role_name, l.sort_order,
            s.name, s.scene_type, s.base_still_url,
            (SELECT a.still_image_url FROM scene_angles a WHERE a.id = s.cover_angle_id AND a.deleted_at IS NULL) AS cover_image_url,
            (SELECT COUNT(*)::int FROM scene_angles a WHERE a.scene_set_id = s.id AND a.deleted_at IS NULL) AS angle_count
       FROM scene_set_episodes l JOIN scene_sets s ON s.id = l.scene_set_id AND s.deleted_at IS NULL
      WHERE l.episode_id = :episodeId AND l.deleted_at IS NULL
      ORDER BY l.sort_order ASC, l.created_at ASC`,
    { replacements: { episodeId }, transaction });
  return rows.map((r) => ({
    role: r.role || 'extra',
    scene_set_id: r.scene_set_id,
    name: r.role_name || null,
    scene_set: setSummary({ id: r.scene_set_id, name: r.name, scene_type: r.scene_type, base_still_url: r.base_still_url, cover_image_url: r.cover_image_url }),
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
async function applyLocations(sequelize, { episodeId, locations, transaction, keepEvent = false }) {
  const [current] = await sequelize.query(
    `SELECT id, scene_set_id, role, role_name FROM scene_set_episodes
      WHERE episode_id = :episodeId AND deleted_at IS NULL`,
    { replacements: { episodeId }, transaction });

  const sameSlot = (old, l) => old.role === l.role && (l.role !== 'extra' || (old.role_name || '') === (l.name || ''));
  for (const l of locations) {
    const old = current.find((c) => sameSlot(c, l));
    if (old && old.scene_set_id !== l.scene_set_id) {
      // The moved beats' angle is placed again on the new set: the old
      // set's label (WIDE, DOORWAY) named an angle the new one may not have
      // (eighth audit: "Wide angle missing" on a set that had its base).
      await sequelize.query(
        `UPDATE scene_plans SET scene_set_id = :next, angle_label = NULL, updated_at = NOW()
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
  // The episode's Event location is its event's place (eighth audit: the two
  // drifted apart, and the event's look and photos never met its beats).
  // keepEvent (Generation B3): a save that is not a write to the event's
  // Place sends no statement to the event's row at all.
  const eventLocation = keepEvent ? null : locations.find((l) => l.role === 'event');
  if (eventLocation) {
    const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
    await sequelize.query(
      `UPDATE world_events SET scene_set_id = :setId, updated_at = NOW()
        WHERE id = ${EPISODE_EVENT_ID_SQL} AND scene_set_id IS DISTINCT FROM :setId`,
      { replacements: { setId: eventLocation.scene_set_id, episodeId }, transaction });
  }
  return listLocations(sequelize, episodeId, transaction);
}

// ─── SAVING THROUGH THE PLACE LOCK (Generation B3; Evoni, 2026-11-23) ────────
//
// A Locations save can move its event to another set (the Event location
// is the event's place), and it writes rows a finalization of that event
// also writes. It read nothing under a lock: an acceptance, an event edit or
// a finalization that committed while it ran was not seen, and it took the
// set, link and event rows in an order of its own.
//
// It now takes the same rows in the same order as the Place finalizer
// (utils/placeLock): the episode FOR SHARE, the event row, then the scene
// sets it names, each FOR KEY SHARE NOWAIT in id order, then its writes.
//   - A save that changes the event's set is a write to the event's Place:
//     it is committed by finalizePlaceWrite, so it is refused on a locked
//     Place and on an event whose set changed since the save read it.
//   - Any other save (home, closet, extras; the event's set left as it is)
//     is one transaction of its own in that order. It does not ask the
//     Place lock: another episode's acceptance does not stop a draft
//     changing its own home. It never rewrites the event's set.

const ACCEPTED_MESSAGE = 'This episode is accepted: its locations are locked';
// The event's set is not the one this save was made for: the finalizer's own code and text.
const STALE_CODE = 'STALE_SOURCE_SET';
const STALE_MESSAGE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";

/** The episode's event as the save reads it first: { id, scene_set_id } or null. */
async function episodeEventSnapshot(sequelize, episodeId, transaction = null) {
  const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
  const [[event]] = await sequelize.query(
    `SELECT id, scene_set_id FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId }, ...(transaction ? { transaction } : {}) });
  return event || null;
}

/**
 * The scene sets a save names, locked in its transaction: every distinct
 * one, in id order, in one statement, FOR KEY SHARE NOWAIT. That is the lock
 * the save's own statements need on a set (each is a foreign-key reference:
 * a beat moved to it, a link to it, the event held at it), taken here once
 * and never waited for. makeEventVersion and makeEveryday hold a set row FOR
 * UPDATE and then wait for the event row, which this transaction holds:
 * waiting for the set would close that circle, so a held row is a lock
 * conflict (55P03) and the save is rolled back and tried again. A plain
 * update of a set (its name, its base) does not conflict with a key-share
 * lock, so it neither blocks this nor is blocked by it.
 */
async function lockSetRows(sequelize, locations, transaction) {
  const ids = [...new Set(locations.map((l) => l.scene_set_id))].sort();
  if (!ids.length) return;
  await sequelize.query(
    'SELECT id FROM scene_sets WHERE id IN (:ids) ORDER BY id FOR KEY SHARE NOWAIT',
    { replacements: { ids }, transaction });
}

/** A refusal of the Place finalizer as this service's error: its own code and text, 409. */
const finalizeRefusal = (outcome) => new EpisodeLocationsError(outcome.message, 409, outcome.code);

/**
 * L6: Evoni changes an episode's locations while it is a draft. Refused
 * (409 EPISODE_ACCEPTED) once the episode is accepted; 409 PLACE_LOCKED when
 * it would move an event whose Place is locked; 409 STALE_SOURCE_SET when
 * the event's set changed since the save read it. Nothing is written then.
 */
async function saveEpisodeLocations(sequelize, { showId, episodeId, locations: body }) {
  const readEpisode = async (transaction = null) => (await sequelize.query(
    'SELECT id, show_id, evaluation_status FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, ...(transaction ? { transaction } : {}) }))[0][0];
  const episode = await readEpisode();
  if (!episode || (showId && String(episode.show_id) !== String(showId))) {
    throw new EpisodeLocationsError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  }
  const accepted = () => new EpisodeLocationsError(ACCEPTED_MESSAGE, 409, 'EPISODE_ACCEPTED');
  if (episode.evaluation_status === 'accepted') throw accepted();
  const locations = normaliseLocations(body);

  // The save's source: the episode's event and the set it is held at now.
  const event = await episodeEventSnapshot(sequelize, episodeId);
  const sourceSetId = event?.scene_set_id ?? null;
  const eventLocation = locations.find((l) => l.role === 'event') || null;
  const movesEvent = Boolean(event && eventLocation && String(eventLocation.scene_set_id) !== String(sourceSetId || ''));

  const { finalizePlaceWrite, PLACE_FINALIZE_MAX_ATTEMPTS, PLACE_FINALIZE_OUTCOMES } = require('../utils/placeLock');
  const { PLACE_FINALIZE_RETRY_DELAY_MS } = require('./sceneGenerationService');
  const write = async (transaction, { keepEvent = false } = {}) => {
    await lockSetRows(sequelize, locations, transaction);
    await assertUsable(sequelize, episode.show_id, locations, transaction);
    return applyLocations(sequelize, { episodeId, locations, transaction, keepEvent });
  };

  if (movesEvent) {
    // A write to the event's Place: the finalizer locks the linked episodes
    // (this one among them) and the event row, asks the strict Place lock,
    // and checks the event is still at the set this save read.
    const saved = await finalizePlaceWrite(sequelize, event.id, {
      sourceSetId,
      retryDelayMs: PLACE_FINALIZE_RETRY_DELAY_MS,
      work: ({ transaction }) => write(transaction),
    });
    if (saved.outcome === PLACE_FINALIZE_OUTCOMES.OK) return saved.value;
    // This episode accepted meanwhile is the reason, said as it always was.
    if (saved.outcome === PLACE_FINALIZE_OUTCOMES.PLACE_LOCKED && (await readEpisode())?.evaluation_status === 'accepted') throw accepted();
    throw finalizeRefusal(saved);
  }

  // Not a write to the event's Place: one transaction, in the finalizer's
  // order. Tried again (three times in all, with the generation paths'
  // pause between tries, outside any transaction) only when it lost to a
  // lock: this is the loop of finalizePlaceWrite, kept here because that
  // helper always asks the Place lock, which this save must not.
  const { lockEpisodes, isLockConflict, RetryableConflictError } = require('../utils/episodeLocks');
  const { lockLiveEvent, EVENT_DELETED_CODE } = require('../utils/eventEpisodeLink');
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sequelize.transaction(async (transaction) => {
        await lockEpisodes(sequelize, [episodeId], { transaction, mode: 'share' });
        if (event) {
          await lockLiveEvent(sequelize, event.id, { transaction });
          const [[held]] = await sequelize.query('SELECT scene_set_id FROM world_events WHERE id = :id', { replacements: { id: event.id }, transaction });
          // The event's set changed since this save read it: refused, not run again against another set.
          if (String(held?.scene_set_id || '') !== String(sourceSetId || '')) throw new EpisodeLocationsError(STALE_MESSAGE, 409, STALE_CODE);
        }
        if ((await readEpisode(transaction))?.evaluation_status === 'accepted') throw accepted();
        // An event's set is left as it is here; an episode with no event has none to write.
        return write(transaction, { keepEvent: true });
      });
    } catch (err) {
      if (err?.code === EVENT_DELETED_CODE && !(err instanceof EpisodeLocationsError)) throw new EpisodeLocationsError(err.message, 409, EVENT_DELETED_CODE);
      if (!isLockConflict(err) && !(err instanceof RetryableConflictError)) throw err;
      if (attempt >= PLACE_FINALIZE_MAX_ATTEMPTS) {
        // The existing answer for a save that kept losing to a lock (utils/episodeLocks).
        const busy = new RetryableConflictError();
        throw new EpisodeLocationsError(busy.message, 409, busy.code);
      }
      await finalizePlaceWrite.retryPause.sleep(PLACE_FINALIZE_RETRY_DELAY_MS);
    }
  }
}

/**
 * Start Episode's locations, written after its commit (Generation B3):
 * through the Place finalizer, with the set the event had under Start's own
 * lock as source. Resolves the setup step: { status: 'complete', count } or
 * { status: 'failed', code, reason, roles }, with a reason that is never the
 * database's own message. Never throws.
 *
 * roles: the locations Start tried to save, as [{ role, name }] (name for an
 * extra, which is how an extra is told from another). Resume setup reads it
 * to know which locations the episode was meant to have (checkLocationsStep).
 *
 * The sets are checked again inside the finalizer's transaction, after
 * their rows are locked (assertUsable, as the Locations save does): Start
 * checked them before it created anything, and a set removed from Scene
 * Sets since then is a soft delete, so its row is still there and every
 * foreign key still passes. A set that is gone, or is another show's, by
 * then: nothing is written (the whole transaction is rolled back) and the
 * step is failed with that check's own code and sentence (which names a
 * role or a set's name, never an id or the database's text). It is not a
 * lock conflict and is not tried again.
 * What this does not do: the key-share lock on a set's row does not stop a
 * removal, which is a plain update of deleted_at. A removal that has not
 * committed when the check reads, or that comes after it, is not seen (the
 * delete route's side of this is held work, C2).
 */
async function applyStartLocations(sequelize, { episodeId, eventId, showId, sourceSetId, locations }) {
  if (!locations.length) return { status: 'complete', count: 0 };
  const roles = locations.map((l) => ({ role: l.role, name: l.role === 'extra' ? (l.name || null) : null }));
  const { finalizePlaceWrite, PLACE_FINALIZE_OUTCOMES } = require('../utils/placeLock');
  const { PLACE_FINALIZE_RETRY_DELAY_MS, errorClassOf } = require('./sceneGenerationService');
  try {
    const saved = await finalizePlaceWrite(sequelize, eventId, {
      sourceSetId,
      retryDelayMs: PLACE_FINALIZE_RETRY_DELAY_MS,
      work: async ({ transaction }) => {
        await lockSetRows(sequelize, locations, transaction);
        await assertUsable(sequelize, showId, locations, transaction);
        await applyLocations(sequelize, { episodeId, locations, transaction });
      },
    });
    if (saved.outcome === PLACE_FINALIZE_OUTCOMES.OK) return { status: 'complete', count: locations.length };
    console.error(`[EpisodeLocations] Start's locations were not saved for episode ${episodeId}: event=${eventId} outcome=${saved.code} attempts=${saved.attempts}`);
    return { status: 'failed', code: saved.code, reason: `${saved.message} The episode's locations were not saved: set them in the episode's Locations.`, roles };
  } catch (err) {
    if (err instanceof EpisodeLocationsError) {
      // A set no longer usable (assertUsable): its own code and sentence.
      console.error(`[EpisodeLocations] Start's locations were not saved for episode ${episodeId}: event=${eventId} outcome=${err.code}`);
      return { status: 'failed', code: err.code, reason: `${err.message}. The episode's locations were not saved: set them in the episode's Locations.`, roles };
    }
    console.error(`[EpisodeLocations] Start's locations were not saved for episode ${episodeId}: event=${eventId} outcome=SAVE_FAILED error=${errorClassOf(err)}`);
    return { status: 'failed', code: 'SAVE_FAILED', reason: "The episode's locations could not be saved. Set them in the episode's Locations.", roles };
  }
}

// ─── RESUME SETUP'S CHECK OF A FAILED LOCATIONS STEP (B3 correction) ─────────
//
// Resume setup does not save locations: the choice Start could not save may
// be the one that was refused. It reads, and calls the step done only when
// the episode's locations, its event and its beats agree. It writes nothing.

const LOCATIONS_INCOMPLETE_CODE = 'LOCATIONS_INCOMPLETE';
const ROLE_LABELS = Object.freeze({ event: 'Event', home: 'Home', closet: 'Closet' });
// The writer's own rule for "the same location" (applyLocations' sameSlot): the role, and for an extra its name.
const holdsRole = (location, wanted) => location.role === wanted.role
  && (wanted.role !== 'extra' || (location.name || '') === (wanted.name || ''));

/**
 * What is missing or inconsistent, from values already read (no database):
 *   roles      the failed step's roles ([{ role, name }]), or not a list for
 *              a step recorded before roles were
 *   locations  the episode's live locations (listLocations: live links to
 *              live sets)
 *   eventSetId the scene set the episode's event has now, or null
 *   beats      the episode's live beats that name a set
 *              ([{ beat_number, scene_set_id, locked, chosen_by_user }])
 * Returns { missing: [{ role, name }], eventElsewhere, staleBeats: [n] }.
 *
 * A. Every role Start tried to save has a live location. A step with no
 *    roles (recorded before they were): home, and the event when the event
 *    has a set. That fallback does not reconstruct what Start was asked
 *    for: a closet or an extra it was asked for is not known and not asked
 *    of the episode.
 * B. When the event has a set, the episode's Event location is that set (no
 *    Event location then counts as a missing one).
 * C. Every beat that names a set names the right one. A beat's location is
 *    its role's, by the planner's own rule (planLocationsService placeBeat
 *    over constants/beatLocations BEAT_LOCATIONS: the role of its beat
 *    number; the closet beat at home when there is no closet), so an extra
 *    that happens to use the set does not make an event beat right. A beat
 *    that is locked or chosen by the user is one the writers never move
 *    (applyLocations, eventPlaceSync): it keeps the set it was given, and
 *    is right at any live location of the episode, wrong at a set that is
 *    not one.
 */
function locationsStepGaps({ roles, locations, eventSetId = null, beats = [] }) {
  const wanted = Array.isArray(roles)
    ? roles.filter((r) => r && ROLES.includes(r.role)).map((r) => ({ role: r.role, name: r.role === 'extra' ? (r.name || null) : null }))
    : [{ role: 'home', name: null }];
  if (eventSetId && !wanted.some((r) => r.role === 'event')) wanted.unshift({ role: 'event', name: null });
  const missing = wanted.filter((r) => !locations.some((l) => holdsRole(l, r)));
  const eventLocation = locations.find((l) => l.role === 'event') || null;
  const eventElsewhere = Boolean(eventSetId && eventLocation && String(eventLocation.scene_set_id) !== String(eventSetId));

  const { setsByRole, placeBeat } = require('./planLocationsService');
  const roleSets = setsByRole(locations);
  const live = new Set(locations.map((l) => String(l.scene_set_id)));
  const noAngles = new Map();
  const staleBeats = beats
    .filter((b) => b.scene_set_id)
    .filter((b) => ((b.locked || b.chosen_by_user)
      ? !live.has(String(b.scene_set_id))
      : String(placeBeat(Number(b.beat_number), roleSets, noAngles).scene_set_id || '') !== String(b.scene_set_id)))
    .map((b) => Number(b.beat_number))
    .sort((x, y) => x - y);
  return { missing, eventElsewhere, staleBeats };
}

/** The fixed sentence for what locationsStepGaps found; an extra is named as the user named it. */
function locationsGapsReason({ missing, eventElsewhere, staleBeats }) {
  const parts = [];
  if (missing.length) parts.push(`Missing: ${missing.map((r) => ROLE_LABELS[r.role] || `"${r.name || 'extra location'}"`).join(', ')}.`);
  if (eventElsewhere) parts.push("The Event location is not the event's current scene set.");
  if (staleBeats.length) {
    const one = staleBeats.length === 1;
    parts.push(`${staleBeats.length} beat${one ? ' names' : 's name'} a scene set that is not ${one ? 'its' : 'their'} location (beat${one ? '' : 's'} ${staleBeats.join(', ')}).`);
  }
  return `The episode's locations are not complete. ${parts.join(' ')} Set them in the episode's Locations and Beat Plan, then choose Resume setup.`;
}

/**
 * A locations step that failed at Start, checked for Resume setup: the step
 * to record. { status: 'complete', count } when A, B and C hold; else the
 * step still failed, with code LOCATIONS_INCOMPLETE, the fixed sentence for
 * what is missing, and its roles kept. Reads only (three SELECTs): it saves
 * no location and moves no beat, on a draft or an accepted episode alike.
 * The event is the episode's by the rule the Locations save uses
 * (EPISODE_EVENT_ID_SQL), not only its brief's.
 */
async function checkLocationsStep(sequelize, { episodeId, step }) {
  const locations = await listLocations(sequelize, episodeId);
  const event = await episodeEventSnapshot(sequelize, episodeId);
  const [beats] = await sequelize.query(
    `SELECT beat_number, scene_set_id, locked, chosen_by_user FROM scene_plans
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_set_id IS NOT NULL`,
    { replacements: { episodeId } });
  const gaps = locationsStepGaps({ roles: step?.roles, locations, eventSetId: event?.scene_set_id ?? null, beats });
  if (!gaps.missing.length && !gaps.eventElsewhere && !gaps.staleBeats.length) return { status: 'complete', count: locations.length };
  return {
    status: 'failed',
    code: LOCATIONS_INCOMPLETE_CODE,
    reason: locationsGapsReason(gaps),
    ...(Array.isArray(step?.roles) ? { roles: step.roles } : {}),
  };
}

/**
 * The set id Start Episode was shown for its event, against the set the
 * event has now (Generation B3). `shown` undefined: the request sent none.
 * A request that sends its own locations must send it (null is a real
 * value: no set was shown): without it nothing says which set the choice
 * was made against. A mismatch is the finalizer's stale-source refusal.
 */
function assertEventSetShown({ shown, current, hasLocations }) {
  if (shown === undefined) {
    if (hasLocations) {
      throw new EpisodeLocationsError('event_scene_set_id is required with locations: the scene set the Locations step showed for the event (null when it showed none)');
    }
    return;
  }
  if (shown !== null && typeof shown !== 'string') throw new EpisodeLocationsError('event_scene_set_id must be a scene set id or null');
  if (String(shown || '') !== String(current || '')) throw new EpisodeLocationsError(STALE_MESSAGE, 409, STALE_CODE);
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
async function saveSceneDefaults(sequelize, { showId, body, leadCharacterId }) {
  const [[show]] = await sequelize.query('SELECT id FROM shows WHERE id = :showId', { replacements: { showId } });
  if (!show) throw new EpisodeLocationsError('Show not found', 404, 'SHOW_NOT_FOUND');
  const changes = {};
  for (const [role, key] of Object.entries(DEFAULT_ROLES)) {
    if (body?.[key] === undefined) continue;
    const id = body[key] || null;
    if (id) {
      const sets = await liveSets(sequelize, [id]);
      const set = sets.get(id);
      if (!set) throw new EpisodeLocationsError(`The ${role} scene set no longer exists`, 404, 'SCENE_SET_NOT_FOUND');
      if (set.show_id && String(set.show_id) !== String(showId)) throw new EpisodeLocationsError(`"${set.name}" belongs to another show`);
    }
    changes[key] = id;
  }
  // One locked read and a merge in the database, as setLead writes: the
  // whole metadata read and written back overwrote a lead change made
  // meanwhile (audit, 2026-10-15). leadCharacterId: the lead the caller
  // saved this for (the lead's home or closet), checked under the lock.
  return sequelize.transaction(async (transaction) => {
    // C2 PR 3 (Evoni, 2026-11-24): the set's row FIRST, before the show's.
    // The sets were read above with no lock, and shows.metadata has no
    // foreign key, so a default could be saved naming a set that had been
    // removed. WAITED: this is the transaction's first lock, so waiting
    // inverts no order — and it MUST come before `shows`, because the
    // delete path writes set rows, then `shows`, then `character_places`
    // (sceneSetUsesService moveUses); taking the show first would be the
    // opposite order.
    const { holdLiveSets } = require('./eventPlaceSync');
    const goneSet = await holdLiveSets(sequelize, Object.values(changes), { transaction });
    if (goneSet) throw new EpisodeLocationsError('That scene set no longer exists', 404, 'SCENE_SET_NOT_FOUND');
    const [[locked]] = await sequelize.query('SELECT metadata FROM shows WHERE id = :showId FOR UPDATE', { replacements: { showId }, transaction });
    const metadata = typeof locked.metadata === 'string' ? JSON.parse(locked.metadata || '{}') : (locked.metadata || {});
    if (leadCharacterId !== undefined && String(metadata.lead_character_id || '') !== String(leadCharacterId || '')) {
      throw new EpisodeLocationsError('The show\'s lead changed meanwhile. Try again.', 409, 'LEAD_CHANGED');
    }
    const next = { ...readSceneDefaults(metadata), ...changes };
    await sequelize.query(
      `UPDATE shows SET metadata = (COALESCE(metadata::jsonb, '{}'::jsonb)
                                     || jsonb_build_object('scene_defaults', CAST(:defaults AS jsonb)))::json,
                        updated_at = NOW()
        WHERE id = :showId`,
      { replacements: { defaults: JSON.stringify(next), showId }, transaction });
    return next;
  });
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
  applyStartLocations,
  checkLocationsStep,
  locationsStepGaps,
  locationsGapsReason,
  LOCATIONS_INCOMPLETE_CODE,
  assertEventSetShown,
  saveEpisodeLocations,
  resolveStartLocations,
  saveSceneDefaults,
  linkBeatSet,
};
