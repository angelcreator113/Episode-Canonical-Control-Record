/**
 * Which episode a page puts first, for one show (PR-03 of
 * docs/design/2026-11-studio-home-episode-command-center.md). Two answers,
 * kept apart (Evoni, 2026-11-17):
 *
 *   - the OFFICIAL PRODUCTION episode: the first unfinished episode in story
 *     order. It is what "Now producing" and "In production" mean. It is
 *     worked out from the show's episodes alone, so opening another episode
 *     never changes it;
 *   - the RESUME episode: the episode last opened in this browser, when it
 *     is still an unfinished episode of this show; otherwise the official
 *     production episode. It is what "Continue" and "Resume" mean.
 *
 * Both take the episodes of ONE show (a page passes the list it already
 * loaded). Only episode records count: a season slot with no episode is not
 * in the list, so it is never returned.
 *
 * "Last opened" is the browser's existing `working-episode-id` (the Episode
 * page and the Editor hub have written it for a long time); this file is its
 * one reader and its one writer. Nothing is stored on the server.
 */
const WORKING_KEY = 'working-episode-id';
const WORKING_TITLE_KEY = 'working-episode-title';

/** The working statuses: an episode in one of these, and not completed, is unfinished. */
export const IN_PRODUCTION = ['draft', 'scripted', 'in_build', 'in_review'];

/** The episodes in production, in episode order. */
export function episodesInProduction(episodes) {
  return (episodes || [])
    .filter((e) => IN_PRODUCTION.includes(e.status) && e.evaluation_status !== 'accepted')
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
}

/** The show's official production episode: the first unfinished one in story order, or null. */
export function productionEpisode(episodes) {
  return episodesInProduction(episodes)[0] || null;
}

/**
 * The episode to resume: the remembered one while it is an unfinished
 * episode in this list, else the official production episode (null when
 * nothing is unfinished). A remembered id that is not in the list (another
 * show's, a deleted episode, one that cannot be read) or that is finished
 * is passed over.
 */
export function resumeEpisode(episodes, rememberedId) {
  const producing = episodesInProduction(episodes);
  const wanted = rememberedId == null ? '' : String(rememberedId);
  const remembered = wanted ? producing.find((e) => String(e.id) === wanted) : null;
  return remembered || producing[0] || null;
}

/** The id of the episode last opened in this browser, or null. */
export function rememberedEpisodeId() {
  try {
    return window.localStorage.getItem(WORKING_KEY) || null;
  } catch (err) {
    console.warn('[activeEpisode] storage unavailable:', err?.message);
    return null;
  }
}

/** Remembers the episode as the one last opened (its id, and its title beside it). */
export function rememberEpisode(episode) {
  if (!episode?.id) return;
  try {
    window.localStorage.setItem(WORKING_KEY, String(episode.id));
    window.localStorage.setItem(WORKING_TITLE_KEY, episode.title || episode.episodeTitle || 'Untitled');
  } catch (err) {
    console.warn('[activeEpisode] storage unavailable:', err?.message);
  }
}
