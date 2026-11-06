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
  deleteRefusal,
  restartRefusal,
};
