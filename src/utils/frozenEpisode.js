'use strict';

/**
 * A1.2c (A1.2-SPEC-v5 §8; Evoni's ruling Q-7, 2026-11-06): a filmed
 * episode is not deleted, and the event of a deleted filmed episode is not
 * started again.
 *
 * "Filmed" (frozen) is the same definition A1.2a uses for the Start snapshot
 * freeze (src/utils/snapshotFreeze.js): episode_raw_clips holds ANY row for
 * the episode, removed (soft-deleted) clips included; frozen_at is the
 * earliest one's created_at. This module carries only what deletion and
 * restart need, so A1.2c stands, and can be reverted, on its own.
 *
 *   filmedAt                the earliest clip's time, or null
 *   findFrozenDeletedEpisode a deleted, filmed episode the event is linked
 *                           to (used_in_episode_id, or a brief's event_id)
 *   deleteRefusal           409 EPISODE_SNAPSHOT_FROZEN, for every role
 *   restartRefusal          409 EVENT_EPISODE_FROZEN
 * Refusals are never retryable. There is no switch to turn them off.
 */

class FrozenEpisodeError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FrozenEpisodeError';
    this.status = 409;
    this.statusCode = 409;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { success: false, error: this.message, code: this.code, ...this.details };
  }
}

const isFrozenEpisodeError = (err) => err instanceof FrozenEpisodeError;

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}
const day = (value) => (iso(value) || '').slice(0, 10);

/** The earliest raw clip's created_at for the episode (removed clips too), or null. */
async function filmedAt(sequelize, episodeId, { transaction } = {}) {
  if (!episodeId) return null;
  const [[row]] = await sequelize.query(
    'SELECT MIN(created_at) AS frozen_at FROM episode_raw_clips WHERE episode_id = :episodeId',
    { replacements: { episodeId }, transaction });
  return row && row.frozen_at ? iso(row.frozen_at) : null;
}

/**
 * The deleted episode the event is linked to that was filmed: by the event's
 * used_in_episode_id, or by a brief naming the event (removed briefs too,
 * since a deleted episode's brief may be left as it was). The earliest
 * filmed one, or null.
 */
async function findFrozenDeletedEpisode(sequelize, eventId, { transaction } = {}) {
  if (!eventId) return null;
  const [rows] = await sequelize.query(
    `SELECT e.id, e.title, e.episode_number, MIN(c.created_at) AS frozen_at
       FROM episodes e
       JOIN episode_raw_clips c ON c.episode_id = e.id
      WHERE e.deleted_at IS NOT NULL
        AND (e.id = (SELECT used_in_episode_id FROM world_events WHERE id = :eventId)
             OR e.id IN (SELECT episode_id FROM episode_briefs WHERE event_id = :eventId))
      GROUP BY e.id, e.title, e.episode_number
      ORDER BY MIN(c.created_at) ASC
      LIMIT 1`,
    { replacements: { eventId }, transaction });
  const row = rows && rows[0];
  return row ? { id: row.id, title: row.title, episode_number: row.episode_number, frozen_at: iso(row.frozen_at) } : null;
}

/**
 * The episodes an event is linked to (its used_in_episode_id, and every
 * brief naming it, removed ones too), read without a lock.
 */
async function linkedEpisodeIds(sequelize, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT used_in_episode_id AS id FROM world_events WHERE id = :eventId AND used_in_episode_id IS NOT NULL
     UNION SELECT episode_id AS id FROM episode_briefs WHERE event_id = :eventId`,
    { replacements: { eventId }, transaction });
  return (rows || []).map((r) => String(r.id));
}

/**
 * Concurrency-safe check before an event is linked to another episode
 * (A1.2c relink guards). In the caller's transaction, episode-first (A1.1):
 *   1. locks FOR UPDATE, in id order, every episode the event is linked to
 *      plus `episodeIds` (the episode it is being linked to). A clip attach
 *      (FOR SHARE) or a delete (FOR UPDATE) on any of them takes turns with
 *      this check, so "deleted and filmed" cannot change before the commit;
 *   2. locks the event row FOR UPDATE;
 *   3. reads the linked episodes again: one that appeared after step 1 was
 *      not locked, so it stops with a retryable 409 (nothing written);
 *   4. throws EVENT_EPISODE_FROZEN when a deleted, filmed episode is linked.
 * Returns nothing when the link may go ahead.
 */
async function assertEventRelinkAllowed(sequelize, eventId, { transaction, episodeIds = [] } = {}) {
  const { lockEpisodes, holdsEpisode, requireTransaction, RetryableConflictError } = require('./episodeLocks');
  requireTransaction(transaction, 'assertEventRelinkAllowed');
  const before = await linkedEpisodeIds(sequelize, eventId, { transaction });
  await lockEpisodes(sequelize, [...before, ...episodeIds.filter(Boolean).map(String)], { transaction });
  await sequelize.query('SELECT id FROM world_events WHERE id = :eventId FOR UPDATE', { replacements: { eventId }, transaction });
  const after = await linkedEpisodeIds(sequelize, eventId, { transaction });
  const existing = after.filter((id) => !before.includes(id));
  if (existing.length) {
    // A link that appeared between the read and the lock: its row may exist
    // without being held. Locking it now would break the order; retry.
    const [rows] = await sequelize.query('SELECT id FROM episodes WHERE id IN (:ids)', { replacements: { ids: existing }, transaction });
    if ((rows || []).some((r) => !holdsEpisode(transaction, r.id))) {
      throw new RetryableConflictError('This event\'s episode link changed while it was being saved. Nothing was saved: try again.', 'EVENT_LINK_CHANGED_RETRY');
    }
  }
  const frozen = await findFrozenDeletedEpisode(sequelize, eventId, { transaction });
  if (frozen) throw restartRefusal(eventId, frozen);
}

const label = (ep) => `${ep?.episode_number != null ? `Episode ${ep.episode_number} ` : 'An episode '}${ep?.title ? `"${ep.title}" ` : ''}`;

/** Q-7 Layer 1: deleting a filmed episode, for every role. */
function deleteRefusal(episodeId, frozenAt) {
  return new FrozenEpisodeError(
    `This episode has been filmed (since ${day(frozenAt)}), so it cannot be deleted: its Start record and footage are history. Nothing was changed.`,
    'EPISODE_SNAPSHOT_FROZEN',
    { episode_id: episodeId, frozen_at: iso(frozenAt) });
}

/** Q-7 Layer 2: starting (or attaching) the event of a deleted filmed episode. */
function restartRefusal(eventId, episode) {
  return new FrozenEpisodeError(
    `${label(episode)}was filmed (since ${day(episode.frozen_at)}) from this event and later deleted, so the event cannot start or join another episode. Nothing was changed.`,
    'EVENT_EPISODE_FROZEN',
    { event_id: eventId, episode_id: episode.id, frozen_at: episode.frozen_at });
}

module.exports = {
  FrozenEpisodeError,
  isFrozenEpisodeError,
  filmedAt,
  findFrozenDeletedEpisode,
  assertEventRelinkAllowed,
  deleteRefusal,
  restartRefusal,
};
