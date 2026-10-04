/**
 * The story clock for screens (docs/FEED_POSTS.md rule 9, 2026-10-04).
 * Mirrors src/services/storyClock.js: order = episode_number * 10 + phase;
 * tests/unit/constants/frontend-story-clock.test.js keeps the phases in
 * step.
 */
export const PHASES = { before_episode: 1, during_episode: 5, after_episode: 7, next_day: 8, week_later: 9 };
const PHASE_LABELS = { 1: 'Before', 5: 'During', 7: 'After', 8: 'The day after', 9: 'A week after' };

/** The post's story order: stamped, else from its episode (post.episode.episode_number), else null. */
export function postOrder(post) {
  if (post && Number.isInteger(post.story_order)) return post.story_order;
  const n = post?.episode?.episode_number;
  if (post?.episode_id && Number.isInteger(n)) return n * 10 + (PHASES[post.timeline_position] || PHASES.during_episode);
  return null;
}

/** "After Ep 2", "During Ep 3", "Backstory"; null when unknown. */
export function storyLabel(order) {
  if (!Number.isInteger(order)) return null;
  const ep = Math.floor(order / 10);
  if (ep === 0) return 'Backstory';
  return `${PHASE_LABELS[order % 10] || 'During'} Ep ${ep}`;
}
