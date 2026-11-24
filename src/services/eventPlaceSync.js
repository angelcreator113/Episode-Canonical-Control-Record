'use strict';

/**
 * An event's place and its episode's Event location kept as one (eighth
 * audit, 2026-10-19). The event's set (world_events.scene_set_id) changed
 * from Scene Sets (an event version made, "Stop using these photos"), the
 * Event Package ("Change scene set", "Generate this look") or an attach,
 * while its episode kept its Event location and beats on the old set: the
 * episode showed and dressed the everyday room, and the event's photos
 * never reached it.
 *
 *   syncEpisodeEventLocation(sequelize, { eventId, fromSetId, toSetId, transaction })
 *     For each draft episode whose event this is (episodeEventIdSql): its
 *     Event location becomes toSetId (a link the episode already has to that
 *     set takes the event role), and its unlocked, unchosen beats at the old
 *     set move with it, their angle cleared so it is placed again on the new
 *     set. An accepted episode keeps its place (the Place lock). Returns the
 *     episodes changed.
 *
 * The other way, an episode's Event location chosen in its Locations step
 * is written to its event (episodeLocationsService applyLocations).
 */

const { episodeEventIdSql } = require('../utils/episodeEventSql');

async function syncEpisodeEventLocation(sequelize, { eventId, fromSetId = null, toSetId, transaction = null }) {
  if (!eventId || !toSetId || String(fromSetId || '') === String(toSetId)) return [];
  const opts = (replacements) => ({ replacements, ...(transaction ? { transaction } : {}) });
  const [episodes] = await sequelize.query(
    `SELECT e.id FROM episodes e
      WHERE e.deleted_at IS NULL AND COALESCE(e.evaluation_status, '') <> 'accepted'
        AND ${episodeEventIdSql('e.id')} = :eventId`,
    opts({ eventId }));
  const changed = [];
  for (const { id: episodeId } of episodes) {
    const [links] = await sequelize.query(
      `SELECT id, scene_set_id, role FROM scene_set_episodes
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND (role = 'event' OR scene_set_id = :toSetId)`,
      opts({ episodeId, toSetId }));
    const eventLink = links.find((l) => l.role === 'event') || null;
    const prev = eventLink?.scene_set_id || fromSetId || null;
    if (eventLink && String(eventLink.scene_set_id) === String(toSetId)) continue;
    const existing = links.find((l) => String(l.scene_set_id) === String(toSetId)) || null;
    if (existing) {
      // One live link per episode and set: the one it has takes the role.
      if (eventLink) {
        await sequelize.query('UPDATE scene_set_episodes SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', opts({ id: eventLink.id }));
      }
      await sequelize.query(
        "UPDATE scene_set_episodes SET role = 'event', role_name = NULL, updated_at = NOW() WHERE id = :id", opts({ id: existing.id }));
    } else if (eventLink) {
      await sequelize.query(
        'UPDATE scene_set_episodes SET scene_set_id = :toSetId, updated_at = NOW() WHERE id = :id', opts({ id: eventLink.id, toSetId }));
    } else {
      await sequelize.query(
        `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
         VALUES (gen_random_uuid(), :toSetId, :episodeId, 99, 'event', NOW(), NOW())`,
        opts({ toSetId, episodeId }));
    }
    if (prev) {
      await sequelize.query(
        `UPDATE scene_plans SET scene_set_id = :toSetId, angle_label = NULL, updated_at = NOW()
          WHERE episode_id = :episodeId AND scene_set_id = :prev AND locked = false
            AND chosen_by_user = false AND deleted_at IS NULL`,
        opts({ toSetId, episodeId, prev }));
    }
    changed.push(episodeId);
  }
  return changed;
}

/**
 * Why a set cannot be this event's place, or null: not found, another
 * show's, or another event's version (eighth audit: an event was given
 * another event's dressed photos through its venue's set list).
 */
async function refuseEventSet(sequelize, { event, setId, showId = null, transaction = null }) {
  const [[set]] = await sequelize.query(
    `SELECT id, name, show_id, version_of_set_id,
            (SELECT name FROM world_events w WHERE w.scene_set_id = s.id AND w.id <> :eventId AND w.deleted_at IS NULL LIMIT 1) AS other_event
       FROM scene_sets s WHERE id = :setId AND deleted_at IS NULL`,
    { replacements: { setId, eventId: event.id }, ...(transaction ? { transaction } : {}) });
  if (!set) return { status: 400, code: 'INVALID_SCENE_SET_ID', error: 'That scene set does not exist.' };
  const show = showId || event.show_id;
  if (set.show_id && show && String(set.show_id) !== String(show)) {
    return { status: 400, code: 'SCENE_SET_SHOW_MISMATCH', error: `"${set.name}" belongs to another show.` };
  }
  if (set.version_of_set_id && String(set.id) !== String(event.scene_set_id || '')) {
    return {
      status: 409, code: 'OTHER_EVENT_VERSION',
      error: `"${set.name}" is ${set.other_event ? `${set.other_event}'s` : 'another event\'s'} photos: choose the everyday set, or make this event's own photos in Scene Sets.`,
    };
  }
  return null;
}

// ─── EPISODE-FIRST FOR THE WRITERS OF AN EVENT'S PLACE (C1 PR 2; Evoni, 2026-11-24) ──
//
// The writers that move an event to a set (the event edit, scene-set-link,
// inject, makeEventVersion, makeEveryday) locked the event row first and
// reached an episode row afterwards: the location row the sync above inserts
// for an episode takes a key-share lock on that episode through its foreign
// key. Every other writer of the Place (utils/placeLock finalizePlaceWrite,
// an acceptance, a clip's attachment) takes the episode first. Two orders
// are a deadlock. These helpers give those writers the same order: the
// event's linked live episodes FOR SHARE, in one ascending statement, before
// the event row; then the proof, under the event's lock, that none was
// added meanwhile; then a set's row, live only, never waited for while an
// event row is held.

/**
 * The live episodes the events are linked to, and any `extra` ids, locked
 * FOR SHARE in one ascending statement (utils/episodeLocks lockEpisodes; a
 * row this transaction already holds, in either mode, is not locked again).
 * Before any event row is locked.
 */
async function shareLinkedEpisodes(sequelize, eventIds, { transaction, extra = [], mode = 'share' } = {}) {
  const { lockEpisodes } = require('../utils/episodeLocks');
  const { linkedLiveEpisodes } = require('../utils/eventEpisodeLink');
  const ids = extra.filter(Boolean).map(String);
  for (const eventId of [].concat(eventIds || []).filter(Boolean)) {
    for (const row of await linkedLiveEpisodes(sequelize, eventId, { transaction })) ids.push(String(row.id));
  }
  // mode 'update': a caller that goes on to lock one of them FOR UPDATE
  // itself (inject: the episode whose script it saves) takes them all so in
  // this one statement, as the relink guard does, so that no lock is ever
  // strengthened in place.
  return lockEpisodes(sequelize, ids, { transaction, mode });
}

/**
 * After the event rows are locked: every live episode they are linked to
 * must be one this transaction holds. One that is not was linked after the
 * episodes were locked; locking it now would break the order, so the
 * transaction stops with a retryable conflict (nothing written).
 */
async function assertLinkedEpisodesHeld(sequelize, eventIds, { transaction } = {}) {
  const { holdsEpisode, RetryableConflictError } = require('../utils/episodeLocks');
  const { linkedLiveEpisodes } = require('../utils/eventEpisodeLink');
  for (const eventId of [].concat(eventIds || []).filter(Boolean)) {
    for (const row of await linkedLiveEpisodes(sequelize, eventId, { transaction })) {
      if (!holdsEpisode(transaction, row.id, { mode: 'any' })) throw new RetryableConflictError();
    }
  }
}

/**
 * The set rule for a set a write is about to reference: its row, live only,
 * FOR KEY SHARE in the writing transaction (NOWAIT when an event row is
 * held: a held row is a lock conflict, never a wait). False when the set is
 * not there or was removed: the caller refuses with its own answer.
 */
async function holdLiveSet(sequelize, setId, { transaction, nowait = false } = {}) {
  if (!setId) return true;
  const [rows] = await sequelize.query(
    `SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR KEY SHARE${nowait ? ' NOWAIT' : ''}`,
    { replacements: { id: setId }, transaction });
  return rows.length > 0;
}

/**
 * work(transaction) in a transaction, tried again when it lost to a lock
 * (40P01, 55P03) or stopped with the plain retryable conflict above: rolled
 * back, a pause outside any transaction, a new transaction; the Place
 * finalizer's bounds (PLACE_FINALIZE_MAX_ATTEMPTS tries, its pause). After
 * the last try: RetryableConflictError (409 RETRY). Any other error, and a
 * retryable conflict with a code of its own, is thrown as it is.
 */
async function inEpisodeFirstTransaction(sequelize, work) {
  const { isLockConflict, RetryableConflictError } = require('../utils/episodeLocks');
  const { finalizePlaceWrite, PLACE_FINALIZE_MAX_ATTEMPTS } = require('../utils/placeLock');
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sequelize.transaction(work);
    } catch (err) {
      const again = isLockConflict(err) || (err instanceof RetryableConflictError && err.code === 'RETRY');
      if (!again) throw err;
      if (attempt >= PLACE_FINALIZE_MAX_ATTEMPTS) throw new RetryableConflictError();
      await finalizePlaceWrite.retryPause.sleep(require('./sceneGenerationService').PLACE_FINALIZE_RETRY_DELAY_MS);
    }
  }
}

module.exports = {
  syncEpisodeEventLocation, refuseEventSet,
  shareLinkedEpisodes, assertLinkedEpisodesHeld, holdLiveSet, inEpisodeFirstTransaction,
};
