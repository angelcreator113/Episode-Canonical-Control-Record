'use strict';

/**
 * Story threads for Lala's show (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 7 of
 * docs/SEASON_ARC_DESIGN_NOTE.md; table show_story_threads, migration
 * 20261001250000).
 *
 *   Q9 (accepted). "you create and name them; drafts are offered from
 *   seeds_future_events. Acceptance can mark one "advanced", and only you
 *   close one."
 *   PR 7 choice 1 (Evoni, 2026-10-01). "a closed thread can be reopened by
 *   Evoni (with confirm), keeping its history".
 *   A3. A slot's intention includes "the story thread it continues".
 *   A6. Accepting an episode "updates [...] story threads".
 */

const STATUSES = Object.freeze({ OPEN: 'open', ADVANCED: 'advanced', CLOSED: 'closed' });

class StoryThreadError extends Error {
  constructor(message, status = 409, code = 'STORY_THREAD_CONFLICT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function text(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[storyThread] JSON parse failed:', err.message);
    return fallback;
  }
}

/** A seed's text: a string, or an object's reason, description or name. */
function seedText(seed) {
  if (seed == null) return null;
  if (typeof seed === 'string') return text(seed, 500);
  return text(seed.reason || seed.description || seed.name || seed.title, 500);
}

/** The show's threads, newest first, each with the slots that continue it. */
async function listThreads(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT t.id, t.title, t.description, t.status, t.source, t.seed_text, t.opened_episode_id,
            t.last_advanced_episode_id, t.last_advanced_at, t.closed_at, t.reopened_at, t.created_at,
            COALESCE((SELECT array_agg(s.slot_number ORDER BY s.slot_number) FROM season_slots s
                       WHERE s.story_thread_id = t.id AND s.deleted_at IS NULL), '{}') AS slot_numbers
       FROM show_story_threads t
      WHERE t.show_id = :showId AND t.deleted_at IS NULL
      ORDER BY (t.status = 'closed') ASC, t.created_at DESC`,
    { replacements: { showId } });
  return rows;
}

/**
 * Drafts offered from the seeds of the show's live episodes' briefs
 * (narrative_chain.seeds_future_events), leaving out seeds a thread was
 * already made from. Nothing is saved: Evoni creates and names (Q9).
 */
async function seedDrafts(sequelize, showId) {
  const [briefs] = await sequelize.query(
    `SELECT b.episode_id, b.narrative_chain, ep.title AS episode_title
       FROM episode_briefs b
       JOIN episodes ep ON ep.id = b.episode_id AND ep.deleted_at IS NULL
      WHERE ep.show_id = :showId AND b.deleted_at IS NULL
      ORDER BY ep.created_at DESC`,
    { replacements: { showId } });
  const [taken] = await sequelize.query(
    'SELECT seed_text FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND seed_text IS NOT NULL',
    { replacements: { showId } });
  const used = new Set(taken.map((t) => t.seed_text.toLowerCase()));
  const drafts = [];
  for (const b of briefs) {
    const chain = parseJson(b.narrative_chain, {}) || {};
    const seeds = Array.isArray(chain.seeds_future_events) ? chain.seeds_future_events : [];
    for (const seed of seeds) {
      const t = seedText(seed);
      if (!t || used.has(t.toLowerCase())) continue;
      used.add(t.toLowerCase());
      drafts.push({ seed_text: t, episode_id: b.episode_id, episode_title: b.episode_title });
    }
  }
  return drafts;
}

/** Evoni creates and names a thread (Q9); from a seed draft when seed_text is given. */
async function createThread(sequelize, showId, body = {}) {
  const title = text(body.title, 200);
  if (!title) throw new StoryThreadError('A thread needs a title', 400, 'STORY_THREAD_INVALID');
  const seed = text(body.seed_text, 500);
  const [[row]] = await sequelize.query(
    `INSERT INTO show_story_threads (id, show_id, title, description, status, source, seed_text, opened_episode_id, created_at, updated_at)
     VALUES (gen_random_uuid(), :showId, :title, :description, 'open', :source, :seed, :openedEpisode, NOW(), NOW())
     RETURNING id, title, description, status, source, seed_text, opened_episode_id`,
    { replacements: {
      showId, title, description: text(body.description, 2000),
      source: seed ? 'seed' : 'evoni', seed, openedEpisode: seed ? (body.episode_id || null) : null,
    } });
  return row;
}

async function loadThread(sequelize, showId, threadId) {
  const [[thread]] = await sequelize.query(
    'SELECT id, status FROM show_story_threads WHERE id = :threadId AND show_id = :showId AND deleted_at IS NULL',
    { replacements: { threadId, showId } });
  if (!thread) throw new StoryThreadError('Story thread not found', 404, 'STORY_THREAD_NOT_FOUND');
  return thread;
}

/** Renames or re-describes a thread. */
async function updateThread(sequelize, showId, threadId, body = {}) {
  await loadThread(sequelize, showId, threadId);
  const title = body.title !== undefined ? text(body.title, 200) : undefined;
  if (title === null) throw new StoryThreadError('A thread needs a title', 400, 'STORY_THREAD_INVALID');
  await sequelize.query(
    `UPDATE show_story_threads
        SET title = COALESCE(:title, title),
            description = CASE WHEN :setDescription THEN :description ELSE description END,
            updated_at = NOW()
      WHERE id = :threadId`,
    { replacements: {
      threadId, title: title || null,
      setDescription: body.description !== undefined, description: text(body.description, 2000),
    } });
}

/** Only Evoni closes a thread (Q9). A closed thread can no longer be chosen for a slot. */
async function closeThread(sequelize, showId, threadId) {
  const thread = await loadThread(sequelize, showId, threadId);
  if (thread.status === STATUSES.CLOSED) return;
  await sequelize.query(
    "UPDATE show_story_threads SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = :threadId",
    { replacements: { threadId } });
}

/**
 * Evoni reopens a closed thread (PR 7 choice 1). Its history stays: it
 * returns to "advanced" if an accepted episode had advanced it, else to
 * "open"; closed_at and the last advance are kept, and reopened_at is set.
 */
async function reopenThread(sequelize, showId, threadId) {
  const thread = await loadThread(sequelize, showId, threadId);
  if (thread.status !== STATUSES.CLOSED) return;
  await sequelize.query(
    `UPDATE show_story_threads
        SET status = CASE WHEN last_advanced_episode_id IS NULL THEN 'open' ELSE 'advanced' END,
            reopened_at = NOW(), updated_at = NOW()
      WHERE id = :threadId`,
    { replacements: { threadId } });
}

/** A slot may continue a thread of its show that is not closed (A3). */
async function assertThreadChoosable(sequelize, showId, threadId) {
  const thread = await loadThread(sequelize, showId, threadId);
  if (thread.status === STATUSES.CLOSED) {
    throw new StoryThreadError('That story thread is closed', 409, 'STORY_THREAD_CLOSED');
  }
}

/**
 * Acceptance (A6, Q9): the thread the episode's slot continues is marked
 * advanced. A closed thread is left closed. Returns the thread id, or null.
 */
async function advanceSlotThread(sequelize, { showId, episodeId }) {
  const [rows] = await sequelize.query(
    `UPDATE show_story_threads t
        SET status = 'advanced', last_advanced_episode_id = :episodeId, last_advanced_at = NOW(), updated_at = NOW()
       FROM season_slots s
      WHERE s.episode_id = :episodeId AND s.show_id = :showId AND s.deleted_at IS NULL
        AND t.id = s.story_thread_id AND t.deleted_at IS NULL AND t.status <> 'closed'
      RETURNING t.id`,
    { replacements: { showId, episodeId } });
  return rows.length ? rows[0].id : null;
}

module.exports = {
  STATUSES,
  StoryThreadError,
  seedText,
  listThreads,
  seedDrafts,
  createThread,
  updateThread,
  closeThread,
  reopenThread,
  assertThreadChoosable,
  advanceSlotThread,
};
