'use strict';

/**
 * Retry protection for Start Episode (POST /world/:showId/events/:eventId/
 * generate-episode, optional `Idempotency-Key` header).
 *
 * Where the key lives, and why: on the new episode's brief, as
 * episode_briefs.event_metadata.start_idempotency_key (an existing JSONB
 * column, EpisodeBrief.js), so no migration is needed. The brief is created
 * in the same transaction as the episode and the event link
 * (generateEpisodeFromEvent), so the key exists exactly when the episode it
 * names does: a Start that failed before commit leaves no key, and its
 * retry starts afresh. The brief is the canonical Episode → Source Event
 * link (episode_briefs.event_id), so the lookup is "the live brief of a
 * live episode for this event carrying this key". The event's
 * canon_consequences was not used: the event PUT merges editor copies of
 * it, so a server-owned key there needs protecting from every save, and it
 * outlives the episode it names.
 *
 * A key is the client's: a string of 1–200 printable ASCII characters.
 * Without one, Start Episode is unchanged.
 */

const KEY_MAX = 200;
const KEY_RE = /^[\x21-\x7e]{1,200}$/;
const META_KEY = 'start_idempotency_key';
const INVALID_KEY_CODE = 'INVALID_IDEMPOTENCY_KEY';

/**
 * Reads the header value. { key: null } when absent; { key } when valid;
 * { error } when sent but unusable.
 */
function readIdempotencyKey(value) {
  if (value === undefined || value === null) return { key: null };
  const raw = Array.isArray(value) ? value[0] : value;
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) return { key: null };
  if (key.length > KEY_MAX || !KEY_RE.test(key)) {
    return { error: `Idempotency-Key must be 1 to ${KEY_MAX} printable characters, no spaces` };
  }
  return { key };
}

/** The id of the live episode this event started under this key, or null. */
async function findIdempotentStart(sequelize, eventId, key, { transaction } = {}) {
  if (!key) return null;
  const [rows] = await sequelize.query(
    `SELECT b.episode_id
       FROM episode_briefs b
       JOIN episodes e ON e.id = b.episode_id
      WHERE b.event_id = :eventId
        AND b.deleted_at IS NULL AND e.deleted_at IS NULL
        AND b.event_metadata ->> '${META_KEY}' = :key
      ORDER BY b.created_at DESC
      LIMIT 1`,
    { replacements: { eventId, key }, ...(transaction ? { transaction } : {}) }
  );
  return rows?.[0]?.episode_id || null;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[StartEpisodeIdempotency] unreadable JSON:', err.message);
    return fallback;
  }
}

/**
 * The same shape generateEpisodeFromEvent returns, read back for an episode
 * already started: { episode, brief, scenePlan, todoList, financials,
 * socialTasks, beats, feedPosts, feedMoments, feedMomentSave, replayed:
 * true }. Nothing is written. feedPosts and feedMoments are what the first
 * Start made at the time and are not stored as such: [] and {}.
 */
async function loadStartReplay(models, episodeId, { beats = [] } = {}) {
  const { sequelize } = models;
  const episode = models.Episode ? await models.Episode.findByPk(episodeId) : null;
  const [briefRows] = await sequelize.query(
    `SELECT * FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    { replacements: { episodeId } }
  );
  const [planRows] = await sequelize.query(
    'SELECT * FROM scene_plans WHERE episode_id = :episodeId AND deleted_at IS NULL ORDER BY beat_number ASC',
    { replacements: { episodeId } }
  );
  const [todoRows] = await sequelize.query(
    'SELECT * FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } }
  );
  const brief = briefRows?.[0] || null;
  const todoList = todoRows?.[0] || null;
  const meta = parseJson(brief?.event_metadata, {}) || {};
  return {
    episode: episode ? (typeof episode.toJSON === 'function' ? episode.toJSON() : episode) : { id: episodeId },
    brief,
    scenePlan: planRows || [],
    todoList,
    financials: parseJson(todoList?.financial_summary, null),
    socialTasks: parseJson(todoList?.social_tasks, []) || [],
    beats,
    feedPosts: [],
    feedMoments: {},
    feedMomentSave: meta.feed_moment_save || { attempted: 0, saved: 0, failed: [] },
    replayed: true,
  };
}

module.exports = {
  META_KEY,
  INVALID_KEY_CODE,
  readIdempotencyKey,
  findIdempotentStart,
  loadStartReplay,
};
