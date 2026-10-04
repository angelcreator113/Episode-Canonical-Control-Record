'use strict';

/**
 * The story clock (the Feed project, docs/FEED_POSTS.md rule 9,
 * 2026-10-04). Lala's world has no calendar the feed can share (episodes
 * carry a number and a real air date; an event's date is free text), so
 * story time is the episode order: a point in story time is an episode
 * number and a phase.
 *
 *   order = episode_number * 10 + phase
 *   phase: before_episode 1, during_episode 5, after_episode 7,
 *          next_day 8, week_later 9
 *
 * A post's story time is its episode's number and its timeline_position
 * (during the episode when it has none); a post written on the wall with
 * no episode is stamped feed_posts.story_order when it is written: after
 * the show's latest published episode (7 when none is, the backstory
 * before episode 1). A beat happens during its episode, so a post can be
 * shown at a beat only when its story time is no later than that.
 */

const { Op } = require('sequelize');

const PHASES = { before_episode: 1, during_episode: 5, after_episode: 7, next_day: 8, week_later: 9 };
const PHASE_LABELS = { 1: 'Before', 5: 'During', 7: 'After', 8: 'The day after', 9: 'A week after' };

const orderOf = (episodeNumber, phase = 'during_episode') => {
  if (episodeNumber === null || episodeNumber === undefined || episodeNumber === '') return null;
  const n = Number(episodeNumber);
  if (!Number.isInteger(n)) return null;
  return n * 10 + (PHASES[phase] || PHASES.during_episode);
};

const beatOrder = (episodeNumber) => orderOf(episodeNumber, 'during_episode');

/** The post's story order: stamped, else from its episode, else null (unknown). */
function postOrder(post, episodeNumber) {
  if (post && Number.isInteger(post.story_order)) return post.story_order;
  if (post && post.episode_id && episodeNumber !== undefined && episodeNumber !== null) return orderOf(episodeNumber, post.timeline_position);
  return null;
}

/** "After Ep 2", "During Ep 3", "Backstory"; null when unknown. */
function label(order) {
  if (!Number.isInteger(order)) return null;
  const ep = Math.floor(order / 10);
  const phase = order % 10;
  if (ep === 0) return 'Backstory';
  return `${PHASE_LABELS[phase] || 'During'} Ep ${ep}`;
}

/** The present for a wall post: after the show's latest published episode. */
async function presentOrder(models, showId) {
  const { Episode } = models;
  if (!Episode || !showId) return orderOf(0, 'after_episode');
  const latest = await Episode.findOne({
    where: { show_id: showId, status: 'published', episode_number: { [Op.ne]: null } },
    order: [['episode_number', 'DESC']],
    attributes: ['episode_number'],
  });
  return orderOf(latest?.episode_number ?? 0, 'after_episode');
}

/**
 * May this post appear at a beat of an episode numbered `episodeNumber`?
 * { ok: true, check: 'ok' | 'unknown' } or { ok: false, message }.
 */
function checkAtBeat(order, episodeNumber) {
  const at = beatOrder(episodeNumber);
  if (!Number.isInteger(order) || !Number.isInteger(at)) return { ok: true, check: 'unknown' };
  if (order <= at) return { ok: true, check: 'ok' };
  return { ok: false, message: `This post happens ${label(order)}; a beat of Ep ${episodeNumber} is earlier in story time. Lala cannot see a post that has not been written yet.` };
}

module.exports = { PHASES, orderOf, beatOrder, postOrder, label, presentOrder, checkAtBeat };
