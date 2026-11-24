'use strict';

/**
 * Where a scene set is used, and moving those uses to another set (Evoni's
 * D1 and D2, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)). Her beats
 * pointed at two sets she had deleted after making new ones:
 *
 *   D1. "Deleting a scene set that episodes, beats or locations use asks for
 *   a replacement set and moves every use (episode locations, plan beats,
 *   event scene_set_id, defaults) to it; deleting without a replacement
 *   shows how many uses will be left pointing at a removed set."
 *   D2. "A scene set created while working in a show gets that show's
 *   show_id ... Also give me a one-click 'Move my beats to…' for an episode
 *   whose beats point at removed sets (choose replacements per removed set)."
 *
 * A set's uses: episode locations (scene_set_episodes), plan beats
 * (scene_plans), events (world_events.scene_set_id), show defaults
 * (shows.metadata.scene_defaults home/closet) and the beats' scene rows
 * (scenes, L12a). Not moved: the set's own angles, looks and an approved
 * base (world_locations.approved_base_scene_set_id); they are images of
 * that set.
 */

const DEFAULT_KEYS = ['home_set_id', 'closet_set_id'];

class SceneSetUsesError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const n = (rows) => Number(rows?.[0]?.n || 0);

/** Live uses of a set, counted; scoped to one episode when episodeId is given. */
async function countUses(sequelize, setId, { episodeId = null, transaction } = {}) {
  const r = { setId, episodeId };
  const ep = episodeId ? ' AND episode_id = :episodeId' : '';
  const q = async (sql) => n((await sequelize.query(sql, { replacements: r, transaction }))[0]);
  const locations = await q(`SELECT COUNT(*) n FROM scene_set_episodes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const beats = await q(`SELECT COUNT(*) n FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const events = await q(`SELECT COUNT(*) n FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL${episodeId ? ' AND used_in_episode_id = :episodeId' : ''}`);
  const scenes = await q(`SELECT COUNT(*) n FROM scenes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`);
  const defaults = episodeId ? 0 : await q(
    `SELECT COUNT(*) n FROM shows s, jsonb_each_text(COALESCE(s.metadata::jsonb->'scene_defaults', '{}'::jsonb)) d
      WHERE d.key IN ('home_set_id', 'closet_set_id') AND d.value = CAST(:setId AS text)`);
  // A character's home, closet or other place (character_places): deleting
  // it silently dropped the place (fourth audit, 2026-10-15).
  const homes = episodeId ? 0 : await q('SELECT COUNT(*) n FROM character_places WHERE scene_set_id = :setId AND deleted_at IS NULL');
  // Its event versions (seventh audit): deleting an everyday set left its
  // versions pointing at a removed set, offered nowhere as everyday.
  const versions = episodeId ? 0 : await q('SELECT COUNT(*) n FROM scene_sets WHERE version_of_set_id = :setId AND deleted_at IS NULL');
  return { locations, beats, events, defaults, scenes, homes, versions, total: locations + beats + events + defaults + scenes + homes + versions };
}

/**
 * Uses of a set by shows other than showId: episode locations, plan beats
 * and scene rows of another show's episodes, another show's events, and
 * another show's home or closet default, and its event versions in another
 * show (seventh audit). A set another show uses is not
 * moved to this one (fourth audit, 2026-10-15: a shared set moved, and the
 * other show's episodes then pointed at a set of a show not theirs).
 */
async function otherShowUses(sequelize, setId, showId, { transaction } = {}) {
  const [[row]] = await sequelize.query(
    `SELECT
       (SELECT COUNT(*) FROM scene_set_episodes x JOIN episodes e ON e.id = x.episode_id
         WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL AND e.deleted_at IS NULL
           AND e.show_id IS NOT NULL AND e.show_id <> :showId)
     + (SELECT COUNT(*) FROM scene_plans x JOIN episodes e ON e.id = x.episode_id
         WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL AND e.deleted_at IS NULL
           AND e.show_id IS NOT NULL AND e.show_id <> :showId)
     + (SELECT COUNT(*) FROM scenes x JOIN episodes e ON e.id = x.episode_id
         WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL AND e.deleted_at IS NULL
           AND e.show_id IS NOT NULL AND e.show_id <> :showId)
     + (SELECT COUNT(*) FROM world_events w
         WHERE w.scene_set_id = :setId AND w.deleted_at IS NULL AND w.show_id IS NOT NULL AND w.show_id <> :showId)
     + (SELECT COUNT(*) FROM shows s, jsonb_each_text(COALESCE(s.metadata::jsonb->'scene_defaults', '{}'::jsonb)) d
         WHERE s.id <> :showId AND s.deleted_at IS NULL AND d.key IN ('home_set_id', 'closet_set_id') AND d.value = CAST(:setId AS text))
     + (SELECT COUNT(*) FROM scene_sets v
         WHERE v.version_of_set_id = :setId AND v.deleted_at IS NULL AND v.show_id IS NOT NULL AND v.show_id <> :showId)
       AS n`,
    { replacements: { setId, showId }, transaction });
  return Number(row?.n || 0);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function liveSet(sequelize, id, transaction) {
  const [rows] = await sequelize.query('SELECT id, name, show_id, version_of_set_id FROM scene_sets WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id }, transaction });
  return rows[0] || null;
}

/**
 * Move a set's uses to another live set; scoped to one episode when
 * episodeId is given (then the show defaults stay). An episode already
 * linked to the replacement keeps that link, with the more specific of the
 * two roles, and the old one is removed. Returns the counts moved.
 */
async function moveUses(sequelize, fromId, toId, { episodeId = null, transaction } = {}) {
  if (!toId || toId === fromId) throw new SceneSetUsesError('Choose a different scene set as the replacement');
  // A malformed id is a 400 with its reason, not a database cast error (500).
  if (!UUID_RE.test(String(toId))) throw new SceneSetUsesError('The replacement must be a scene set id', 400, 'BAD_REPLACEMENT');
  const to = await liveSet(sequelize, toId, transaction);
  if (!to) throw new SceneSetUsesError('The replacement scene set was not found, or it has been removed', 400, 'BAD_REPLACEMENT');
  // One show's beats, episode links, events and defaults are not moved onto
  // another show's set (audit, 2026-10-15). A set of no show is shared.
  const [[from]] = await sequelize.query('SELECT show_id FROM scene_sets WHERE id = :fromId', { replacements: { fromId }, transaction });
  if (from?.show_id && to.show_id && String(from.show_id) !== String(to.show_id)) {
    throw new SceneSetUsesError(`"${to.name}" belongs to another show; choose a set of this show, or one shared by all shows`, 400, 'BAD_REPLACEMENT');
  }
  // A shared set's uses by other shows are not moved onto one show's set
  // (seventh audit: only a show's own set was checked).
  if (!from?.show_id && to.show_id && await otherShowUses(sequelize, fromId, to.show_id, { transaction }) > 0) {
    throw new SceneSetUsesError(`Other shows use this set; "${to.name}" is one show's. Choose a set shared by all shows`, 400, 'BAD_REPLACEMENT');
  }
  // Its events and versions go to an everyday set: an event version is one
  // event's place, not a replacement for a set many use (seventh audit).
  if (!episodeId && to.version_of_set_id) {
    throw new SceneSetUsesError(`"${to.name}" is an event version; choose an everyday set`, 400, 'BAD_REPLACEMENT');
  }
  const r = { fromId, toId, episodeId };
  const ep = episodeId ? ' AND episode_id = :episodeId' : '';
  const exec = async (sql) => {
    const [, meta] = await sequelize.query(sql, { replacements: r, transaction });
    return typeof meta?.rowCount === 'number' ? meta.rowCount : 0;
  };
  // An episode has one live location per set (scene_set_episodes_unique_pair,
  // the only unique index here that holds scene_set_id). Where it already
  // has the replacement, the two links are merged rather than the old one
  // moved onto it, which duplicated the pair (the "Move my beats" 500,
  // Evoni, 2026-10-02): the existing link is kept, with the more specific
  // role (a named role over an extra, an extra over none; between two named
  // roles, its own), an extra's name going with its role; the old link is
  // removed.
  const oldEp = ep.replace('episode_id', 'old.episode_id');
  const rank = (t) => `(CASE WHEN ${t}.role IN ('home', 'closet', 'event') THEN 2 WHEN ${t}.role = 'extra' THEN 1 ELSE 0 END)`;
  await exec(`UPDATE scene_set_episodes keep
                 SET role = CASE WHEN ${rank('old')} > ${rank('keep')} THEN old.role ELSE keep.role END,
                     role_name = CASE WHEN ${rank('old')} > ${rank('keep')} THEN old.role_name
                                      WHEN keep.role IS NOT DISTINCT FROM old.role THEN COALESCE(keep.role_name, old.role_name)
                                      ELSE keep.role_name END,
                     updated_at = NOW()
                FROM scene_set_episodes old
               WHERE keep.scene_set_id = :toId AND keep.deleted_at IS NULL
                 AND old.scene_set_id = :fromId AND old.deleted_at IS NULL
                 AND old.episode_id = keep.episode_id${oldEp}`);
  await exec(`UPDATE scene_set_episodes old SET deleted_at = NOW(), updated_at = NOW()
               WHERE old.scene_set_id = :fromId AND old.deleted_at IS NULL${oldEp}
                 AND EXISTS (SELECT 1 FROM scene_set_episodes keep
                              WHERE keep.scene_set_id = :toId AND keep.episode_id = old.episode_id AND keep.deleted_at IS NULL)`);
  const locations = await exec(`UPDATE scene_set_episodes SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  // Their angle is placed again on the replacement (eighth audit).
  const beats = await exec(`UPDATE scene_plans SET scene_set_id = :toId, angle_label = NULL, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  const eventScope = `scene_set_id = :fromId AND deleted_at IS NULL${episodeId ? ' AND used_in_episode_id = :episodeId' : ''}`;
  // The events' looks go with them, unless the event already has a look on
  // the replacement: left on the old set, the paid look was unreachable
  // (fourth audit, 2026-10-15). A look's dressed angles are its own rows and
  // follow it. The look's brief keeps the venue it was made at, so the
  // stale check still reads the right approved base.
  const looks = await exec(`UPDATE scene_set_looks old SET scene_set_id = :toId, updated_at = NOW()
                              WHERE old.scene_set_id = :fromId AND old.deleted_at IS NULL
                                AND old.event_id IN (SELECT id FROM world_events WHERE ${eventScope})
                                AND NOT EXISTS (SELECT 1 FROM scene_set_looks keep
                                                 WHERE keep.scene_set_id = :toId AND keep.event_id = old.event_id AND keep.deleted_at IS NULL)`);
  const events = await exec(`UPDATE world_events SET scene_set_id = :toId, updated_at = NOW() WHERE ${eventScope}`);
  const scenes = await exec(`UPDATE scenes SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL${ep}`);
  let defaults = 0;
  if (!episodeId) {
    for (const key of DEFAULT_KEYS) {
      // shows.metadata is json, not jsonb.
      defaults += await exec(`UPDATE shows SET metadata = jsonb_set(metadata::jsonb, '{scene_defaults,${key}}', to_jsonb(CAST(:toId AS text)))::json, updated_at = NOW()
                               WHERE metadata::jsonb->'scene_defaults'->>'${key}' = CAST(:fromId AS text)`);
    }
  }
  // Characters' places move too; a character who already has the
  // replacement keeps that row, and the old one is removed (one row per
  // character and set, index character_places_unique).
  let homes = 0;
  if (!episodeId) {
    await exec(`UPDATE character_places old SET deleted_at = NOW(), updated_at = NOW()
                 WHERE old.scene_set_id = :fromId AND old.deleted_at IS NULL
                   AND EXISTS (SELECT 1 FROM character_places keep WHERE keep.scene_set_id = :toId
                                AND keep.registry_character_id = old.registry_character_id AND keep.deleted_at IS NULL)`);
    homes = await exec('UPDATE character_places SET scene_set_id = :toId, updated_at = NOW() WHERE scene_set_id = :fromId AND deleted_at IS NULL');
  }
  // Its event versions become the replacement's (seventh audit).
  const versions = episodeId ? 0 : await exec(
    'UPDATE scene_sets SET version_of_set_id = :toId, updated_at = NOW() WHERE version_of_set_id = :fromId AND deleted_at IS NULL');
  return { locations, beats, events, defaults, scenes, homes, looks, versions };
}

/**
 * D2: the show a new set belongs to: the one given, else a linked
 * episode's, else its universe's when that universe has exactly one show;
 * null otherwise.
 */
async function resolveSetShowId(sequelize, { show_id: showId, episode_ids: episodeIds, universe_id: universeId } = {}, { transaction } = {}) {
  if (showId) return showId;
  const firstEpisode = Array.isArray(episodeIds) ? episodeIds.find(Boolean) : null;
  if (firstEpisode) {
    const [rows] = await sequelize.query('SELECT show_id FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: firstEpisode }, transaction });
    if (rows[0]?.show_id) return rows[0].show_id;
  }
  if (universeId) {
    const [rows] = await sequelize.query('SELECT id FROM shows WHERE universe_id = :universeId AND deleted_at IS NULL LIMIT 2', { replacements: { universeId }, transaction });
    if (rows.length === 1) return rows[0].id;
  }
  return null;
}

/** D2: the removed sets an episode's beats, locations, scenes or event still use, with the beats at each. */
async function removedSetsForEpisode(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT s.id, s.name, s.deleted_at,
            COALESCE((SELECT json_agg(p.beat_number ORDER BY p.beat_number) FROM scene_plans p
                       WHERE p.episode_id = :episodeId AND p.scene_set_id = s.id AND p.deleted_at IS NULL), '[]') AS beats
       FROM scene_sets s
      WHERE s.deleted_at IS NOT NULL
        AND s.id IN (SELECT scene_set_id FROM scene_plans WHERE episode_id = :episodeId AND deleted_at IS NULL
                     UNION SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :episodeId AND deleted_at IS NULL
                     UNION SELECT scene_set_id FROM scenes WHERE episode_id = :episodeId AND deleted_at IS NULL AND scene_set_id IS NOT NULL
                     UNION SELECT scene_set_id FROM world_events WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL AND scene_set_id IS NOT NULL)
      ORDER BY s.name`,
    { replacements: { episodeId } });
  return rows.map((r) => ({ scene_set_id: r.id, name: r.name, deleted_at: r.deleted_at, beats: (typeof r.beats === 'string' ? JSON.parse(r.beats) : r.beats) || [] }));
}

/**
 * Episode links (scene_set_episodes) to a removed set that no beat of that
 * episode uses (Evoni, 2026-10-07: the "scene sets you removed" bar showed
 * on an episode whose 14 beats all had live scenes; what it found were
 * these leftover links). They are soft-deleted: a location needs a live
 * set, and nothing else reads them. A link whose set a beat still uses is
 * kept, so the bar names that beat and Move my beats carries the location
 * with it. setId limits it to one set (its delete), else every removed
 * set. Returns how many links were dropped.
 */
/**
 * Events held at a set whose Place is locked (an episode they are linked to
 * is accepted, utils/placeLock): deleting the set, or moving its uses, would
 * change a locked place (seventh audit). [{ id, name }]. Reads inside the
 * caller's transaction when one is given (Foundation A).
 */
async function lockedEventsAt(sequelize, setId, { transaction } = {}) {
  const [events] = await sequelize.query(
    'SELECT id, name FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL ORDER BY name',
    { replacements: { setId }, transaction });
  const { isPlaceLocked } = require('../utils/placeLock');
  const locked = [];
  for (const e of events) if (await isPlaceLocked(sequelize, e.id, { transaction })) locked.push(e);
  return locked;
}

/**
 * The accepted live episodes that use a set: as an episode location
 * (scene_set_episodes), on a plan beat (scene_plans) or on a scene row
 * (scenes); live rows only (Foundation A). [{ id, episode_number, title }],
 * by episode number. A read: it locks nothing, so it says what was true
 * when it ran; the delete path calls it in a transaction that holds those
 * episodes (assertNoAcceptedOrFilmedUses). linkedEpisodeIds adds episodes
 * that use the set through an event held at it (C1, PR 1).
 */
async function acceptedEpisodeUses(sequelize, setId, { transaction, linkedEpisodeIds = [] } = {}) {
  if (!setId) return [];
  const linked = [...new Set((linkedEpisodeIds || []).filter(Boolean).map(String))];
  const [rows] = await sequelize.query(
    `SELECT e.id, e.episode_number, e.title
       FROM episodes e
      WHERE e.deleted_at IS NULL AND e.evaluation_status = 'accepted'
        AND (e.id IN (SELECT x.episode_id FROM scene_set_episodes x WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL)
             OR e.id IN (SELECT x.episode_id FROM scene_plans x WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL)
             OR e.id IN (SELECT x.episode_id FROM scenes x WHERE x.scene_set_id = :setId AND x.deleted_at IS NULL)${linked.length ? '\n             OR e.id IN (:linked)' : ''})
      ORDER BY e.episode_number NULLS LAST, e.id`,
    { replacements: { setId, linked }, transaction });
  return (rows || []).map((r) => ({ id: r.id, episode_number: r.episode_number ?? null, title: r.title ?? null }));
}

/** A deleted set's event versions read as everyday again (as the FK's SET NULL would on a hard delete). */
async function releaseVersions(sequelize, setId, { transaction } = {}) {
  const [, meta] = await sequelize.query(
    'UPDATE scene_sets SET version_of_set_id = NULL, updated_at = NOW() WHERE version_of_set_id = :setId AND deleted_at IS NULL',
    { replacements: { setId }, transaction });
  return meta?.rowCount ?? 0;
}

async function dropRemovedSetLinks(sequelize, { setId = null, transaction = null } = {}) {
  const [, meta] = await sequelize.query(
    `UPDATE scene_set_episodes l SET deleted_at = NOW(), updated_at = NOW()
      WHERE l.deleted_at IS NULL
        ${setId ? 'AND l.scene_set_id = :setId' : ''}
        AND EXISTS (SELECT 1 FROM scene_sets s WHERE s.id = l.scene_set_id AND s.deleted_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM scene_plans p
                         WHERE p.episode_id = l.episode_id AND p.scene_set_id = l.scene_set_id AND p.deleted_at IS NULL)`,
    { replacements: { setId }, ...(transaction ? { transaction } : {}) });
  return meta?.rowCount ?? 0;
}

// ─── THE DELETE PATH'S LOCK ORDER (C1, PR 1; Evoni, 2026-11-24) ──────────────
//
// Deleting a scene set, with or without a replacement, read the Place lock,
// then wrote in a transaction that had locked nothing: an acceptance, a first
// clip or another writer of the same rows could commit in between, and its
// statements took episode, event and set rows in no fixed order (a deadlock
// surfaced as the database's own "deadlock detected").
//
// One transaction per attempt, in the Place finalizer's order (utils/placeLock:
// episodes, then events, then set rows):
//   1. the complete reference set of the set is read (setReferences);
//   2. EVERY affected episode, direct or through an event, FOR UPDATE, in one
//      ascending id order (one lockEpisodes call: its statement is
//      ORDER BY id FOR UPDATE, so the rows are locked as sorted);
//   3. each affected event (lockLiveEvent), ascending;
//   4. the set rows in one statement, never waited for (NOWAIT): the set
//      FOR UPDATE, a live replacement FOR KEY SHARE, the set's live versions
//      FOR NO KEY UPDATE;
//   5. the reference set is read again. An episode, event or version it names
//      that is not held: everything is rolled back, and after a pause outside
//      any transaction it is tried again, in a new transaction, with the
//      larger set. A held lock is never upgraded or added to in place.
// Then the caller's work runs under those locks.
// A lock conflict (40P01, 55P03) is tried again the same way; after
// PLACE_FINALIZE_MAX_ATTEMPTS tries it is the existing retryable 409
// (RetryableConflictError, code RETRY).
//
// episodeId scopes all of it to one episode's uses (as moveUses' episodeId
// does), for "Move my beats" (C2), which does not call it yet.

const sortedIds = (rows) => [...new Set((rows || []).map((x) => x && x.id).filter(Boolean).map(String))].sort();

/**
 * The complete reference set of a scene set, read (no lock):
 *   direct    episodes with a live location, beat or scene row at the set
 *   events    live events held at the set
 *   viaEvent  live episodes those events are linked to (linkedLiveEpisodes)
 *   versions  live sets that are versions of the set (none with episodeId)
 *   episodes  direct and viaEvent together
 * each a sorted list of ids. With episodeId: that episode's rows, and the
 * events stamped with it.
 */
async function setReferences(sequelize, setId, { episodeId = null, transaction } = {}) {
  const ep = episodeId ? ' AND episode_id = :episodeId' : '';
  const r = { setId, episodeId };
  const [direct] = await sequelize.query(
    `SELECT episode_id AS id FROM scene_set_episodes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}
     UNION SELECT episode_id FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}
     UNION SELECT episode_id FROM scenes WHERE scene_set_id = :setId AND deleted_at IS NULL${ep}`,
    { replacements: r, transaction });
  const [events] = await sequelize.query(
    `SELECT id FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL${episodeId ? ' AND used_in_episode_id = :episodeId' : ''}`,
    { replacements: r, transaction });
  const { linkedLiveEpisodes } = require('../utils/eventEpisodeLink');
  const viaEvent = [];
  for (const id of sortedIds(events)) viaEvent.push(...await linkedLiveEpisodes(sequelize, id, { transaction }));
  const [versions] = episodeId ? [[]] : await sequelize.query(
    'SELECT id FROM scene_sets WHERE version_of_set_id = :setId AND deleted_at IS NULL', { replacements: r, transaction });
  const refs = { direct: sortedIds(direct), events: sortedIds(events), viaEvent: sortedIds(viaEvent), versions: sortedIds(versions), episodeId: episodeId || null };
  refs.episodes = [...new Set([...refs.direct, ...refs.viaEvent])].sort();
  return refs;
}

/**
 * Steps 1 to 5 above, inside the caller's transaction, which must be new
 * (nothing locked yet). Resolves { refs, grown, replacementHeld }: refs is
 * the reference set as read under the locks; grown is true when it names a
 * row this transaction does not hold (the caller rolls back and starts
 * again); replacementHeld says whether a live replacement's row was locked.
 * replacementId is used only when it is a scene set id other than setId:
 * anything else locks no replacement, and is the caller's to refuse.
 */
async function lockSetReferences(sequelize, { setId, replacementId = null, episodeId = null, transaction }) {
  const { lockEpisodes, holdsEpisode, requireTransaction, LOCK_TIMEOUT } = require('../utils/episodeLocks');
  const { lockLiveEvent } = require('../utils/eventEpisodeLink');
  requireTransaction(transaction, 'lockSetReferences');
  const before = await setReferences(sequelize, setId, { episodeId, transaction });
  await sequelize.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`, { transaction });
  await lockEpisodes(sequelize, before.episodes, { transaction });
  for (const id of before.events) await lockLiveEvent(sequelize, id, { transaction });
  const replacement = replacementId && UUID_RE.test(String(replacementId)) && String(replacementId) !== String(setId) ? String(replacementId) : null;
  const [locked] = await sequelize.query(
    `WITH gone AS (SELECT id FROM scene_sets WHERE id = :setId FOR UPDATE NOWAIT),
          repl AS (SELECT id FROM scene_sets WHERE id = CAST(:replacement AS uuid) AND deleted_at IS NULL FOR KEY SHARE NOWAIT),
          vers AS (SELECT id FROM scene_sets WHERE version_of_set_id = :setId AND deleted_at IS NULL ORDER BY id FOR NO KEY UPDATE NOWAIT)
     SELECT 'gone' AS k, id FROM gone UNION ALL SELECT 'repl', id FROM repl UNION ALL SELECT 'vers', id FROM vers`,
    { replacements: { setId, replacement }, transaction });
  const refs = await setReferences(sequelize, setId, { episodeId, transaction });
  const heldEvents = new Set(before.events);
  const heldVersions = new Set(locked.filter((x) => x.k === 'vers').map((x) => String(x.id)));
  const grown = refs.episodes.some((id) => !holdsEpisode(transaction, id))
    || refs.events.some((id) => !heldEvents.has(id))
    || refs.versions.some((id) => !heldVersions.has(id));
  return { refs, grown, replacementHeld: locked.some((x) => x.k === 'repl') };
}

/**
 * work({ transaction, refs, attempt, replacementHeld }) in a transaction
 * that holds the set's references (lockSetReferences), committed when work
 * resolves and rolled back when it throws. A reference set that grew, an
 * event deleted meanwhile, or a lock conflict (anywhere, work included):
 * rolled back, a pause outside any transaction, then again in a new
 * transaction; PLACE_FINALIZE_MAX_ATTEMPTS tries in all, then
 * RetryableConflictError (the existing retryable 409). Any other error is
 * thrown as it is, after the rollback.
 */
async function withSetLocks(sequelize, { setId, replacementId = null, episodeId = null }, work) {
  const { isLockConflict, RetryableConflictError } = require('../utils/episodeLocks');
  const { EVENT_DELETED_CODE } = require('../utils/eventEpisodeLink');
  const { finalizePlaceWrite, PLACE_FINALIZE_MAX_ATTEMPTS } = require('../utils/placeLock');
  const { PLACE_FINALIZE_RETRY_DELAY_MS } = require('./sceneGenerationService');
  for (let attempt = 1; ; attempt += 1) {
    const transaction = await sequelize.transaction();
    try {
      const held = await lockSetReferences(sequelize, { setId, replacementId, episodeId, transaction });
      if (!held.grown) {
        const value = await work({ transaction, refs: held.refs, attempt, replacementHeld: held.replacementHeld });
        await transaction.commit();
        return value;
      }
      await transaction.rollback();
    } catch (err) {
      if (!transaction.finished) await transaction.rollback().catch((rollbackErr) => console.error('[SceneSetUses] rollback failed:', rollbackErr.message));
      const again = isLockConflict(err) || err instanceof RetryableConflictError || err?.code === EVENT_DELETED_CODE;
      if (!again) throw err;
    }
    if (attempt >= PLACE_FINALIZE_MAX_ATTEMPTS) throw new RetryableConflictError();
    await finalizePlaceWrite.retryPause.sleep(PLACE_FINALIZE_RETRY_DELAY_MS);
  }
}

const episodeLabel = (e) => `Episode${e.episode_number != null ? ` ${e.episode_number}` : ''}${e.title ? ` "${e.title}"` : ''}`;

/**
 * Under the locks of withSetLocks: no affected episode is accepted, and none
 * has been filmed. Affected: every episode in refs (those that use the set
 * directly and those linked to an event held at it). Throws
 *   SceneSetUsesError 409 EPISODE_ACCEPTED, with .episodes
 *     ([{ id, episode_number, title }]), or
 *   FrozenEpisodeError 409 EPISODE_SNAPSHOT_FROZEN (utils/frozenEpisode:
 *     any raw clip, removed ones too), with episode_id and frozen_at.
 * Accepted is asked first. Nothing is written.
 */
async function assertNoAcceptedOrFilmedUses(sequelize, setId, { refs, transaction }) {
  const affected = new Set(refs.episodes);
  const accepted = (await acceptedEpisodeUses(sequelize, setId, { transaction, linkedEpisodeIds: refs.viaEvent }))
    .filter((e) => affected.has(String(e.id)));
  if (accepted.length) {
    const names = accepted.map(episodeLabel).join(', ');
    throw Object.assign(
      new SceneSetUsesError(`${names} ${accepted.length === 1 ? 'is accepted and uses' : 'are accepted and use'} this scene set: it stays. Nothing was changed.`, 409, 'EPISODE_ACCEPTED'),
      { episodes: accepted });
  }
  const { filmedAt, FrozenEpisodeError } = require('../utils/frozenEpisode');
  for (const id of refs.episodes) {
    const at = await filmedAt(sequelize, id, { transaction });
    if (at) {
      const [[episode]] = await sequelize.query('SELECT id, episode_number, title FROM episodes WHERE id = :id', { replacements: { id }, transaction });
      throw new FrozenEpisodeError(
        `${episodeLabel(episode || {})} has been filmed (since ${String(at).slice(0, 10)}) and uses this scene set: it stays. Nothing was changed.`,
        'EPISODE_SNAPSHOT_FROZEN', { episode_id: id, frozen_at: at });
    }
  }
}

/** D2: move an episode's uses of removed sets, each to its chosen live replacement, in one transaction. */
async function moveRemovedSetsForEpisode(sequelize, episodeId, moves) {
  if (!Array.isArray(moves) || !moves.length) throw new SceneSetUsesError('moves must be a non-empty list of { from, to }');
  const removed = new Set((await removedSetsForEpisode(sequelize, episodeId)).map((s) => s.scene_set_id));
  for (const m of moves) {
    if (!m || !removed.has(m.from)) throw new SceneSetUsesError('Each "from" must be a removed scene set this episode uses');
  }
  return sequelize.transaction(async (transaction) => {
    const out = [];
    for (const m of moves) out.push({ from: m.from, to: m.to, moved: await moveUses(sequelize, m.from, m.to, { episodeId, transaction }) });
    return out;
  });
}

module.exports = {
  SceneSetUsesError,
  otherShowUses,
  countUses,
  moveUses,
  resolveSetShowId,
  removedSetsForEpisode,
  moveRemovedSetsForEpisode,
  dropRemovedSetLinks,
  lockedEventsAt,
  acceptedEpisodeUses,
  releaseVersions,
  setReferences,
  lockSetReferences,
  withSetLocks,
  assertNoAcceptedOrFilmedUses,
};
