'use strict';

/**
 * The episode's copy of its task list (T5, docs/EVENT_EPISODE_FLOW.md
 * §8(bb); Task #2304).
 *
 * Start Episode copies the event's social tasks into
 * episode_todo_lists.social_tasks, the episode's one task list (T2). From
 * then on, task edits go to that copy, not the event's: completion, money,
 * the script and distribution already read the episode's copy, and an edit
 * made only on the event never reached them (docs/TASK_LISTS_READ.md §6).
 *
 * "After Start Episode" is findTermsLockEpisode: a live episode whose live
 * brief names the event, or else the event's used_in_episode_id pointing at
 * a live episode — the same test the terms lock uses.
 */

const { v4: uuidv4 } = require('uuid');
const { findTermsLockEpisode } = require('../utils/eventTermsLock');

function parseList(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list || '[]');
    } catch (err) {
      console.error('[EpisodeTaskCopy] stored social_tasks is not JSON, reading it as empty:', err.message);
      list = [];
    }
  }
  return Array.isArray(list) ? list : [];
}

/** The episode an event's task edits now go to, or null before Start Episode. */
async function startedEpisodeFor(sequelize, eventId) {
  return findTermsLockEpisode(sequelize, eventId);
}

/** The episode's saved list, or null when the episode has no todo row. */
async function readEpisodeSocialTasks(sequelize, episodeId) {
  const [row] = await sequelize.query(
    'SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  return row ? parseList(row.social_tasks) : null;
}

/**
 * An edited list keeps the completion of every item whose slot it still
 * carries; an item it adds starts not done.
 */
function keepCompletion(previous, next) {
  const done = new Map(parseList(previous).map((t) => [t?.slot, Boolean(t?.completed)]));
  return parseList(next).map((t) => (done.has(t?.slot) ? { ...t, completed: done.get(t.slot) } : { ...t, completed: Boolean(t?.completed) }));
}

/**
 * Writes an edited list to the episode's copy, keeping completion by slot.
 * Creates the episode's todo row when it has none. Returns the saved list.
 */
async function writeEpisodeSocialTasks(sequelize, { episodeId, showId, eventId }, tasks) {
  const previous = await readEpisodeSocialTasks(sequelize, episodeId);
  const saved = keepCompletion(previous || [], tasks);
  await sequelize.query(
    `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
     VALUES (:id, :episodeId, :showId, :eventId, '[]', :tasks, 'generated', NOW(), NOW())
     ON CONFLICT (episode_id) DO UPDATE SET social_tasks = EXCLUDED.social_tasks, updated_at = NOW()`,
    { replacements: { id: uuidv4(), episodeId, showId: showId || null, eventId: eventId || null, tasks: JSON.stringify(saved) } }
  );
  return saved;
}

module.exports = {
  startedEpisodeFor,
  readEpisodeSocialTasks,
  writeEpisodeSocialTasks,
  keepCompletion,
};
