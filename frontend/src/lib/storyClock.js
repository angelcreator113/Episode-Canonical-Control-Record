/**
 * The story clock for screens (docs/FEED_POSTS.md rule 9, 2026-10-04).
 * Mirrors src/services/storyClock.js: order = episode_number * 10 + phase;
 * tests/unit/constants/frontend-story-clock.test.js keeps the phases in
 * step.
 */
export const PHASES = { before_episode: 1, announced: 2, invitation_sent: 3, lala_arrives: 4, during_episode: 5, after_episode: 7, next_day: 8, week_later: 9 };
const PHASE_LABELS = {
  1: 'Before', 2: 'Announced', 3: 'Invitation sent', 4: 'Lala arrives',
  5: 'During', 7: 'After', 8: 'The day after', 9: 'A week after',
};

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

// The moments Admin › The Pulse › Story clock steps through (Task 2941), in
// story order: an episode's phases, from before it to a week after.
const MOMENT_PHASES = ['before_episode', 'announced', 'invitation_sent', 'lala_arrives', 'during_episode', 'after_episode', 'next_day', 'week_later'];
const BACKSTORY = PHASES.after_episode; // 7: after "episode 0", before episode 1

/** [{ order, label }] for the backstory and every numbered episode's phases, in order. */
export function storyMoments(episodes) {
  const numbers = [...new Set((episodes || []).map((e) => e?.episode_number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const moments = [{ order: BACKSTORY, label: 'Backstory' }];
  for (const n of numbers) {
    for (const phase of MOMENT_PHASES) {
      const order = n * 10 + PHASES[phase];
      moments.push({ order, label: storyLabel(order) });
    }
  }
  return moments;
}

/** The present, as the server reads it: after the latest published episode, else the backstory. */
export function presentOrder(episodes) {
  const published = (episodes || []).filter((e) => e?.status === 'published' && Number.isInteger(e.episode_number)).map((e) => e.episode_number);
  return published.length ? Math.max(...published) * 10 + PHASES.after_episode : BACKSTORY;
}
