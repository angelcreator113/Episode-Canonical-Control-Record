/**
 * A1.2c (Evoni's ruling Q-7, 2026-11-06): a filmed episode is never
 * deleted, and the event of a deleted filmed episode never starts again.
 * The server decides and answers 409 with one of these codes; the pages
 * show its words.
 */

export const FROZEN_EPISODE_CODES = Object.freeze(['EPISODE_SNAPSHOT_FROZEN', 'EVENT_EPISODE_FROZEN']);

/** True when an API error is a filmed-episode refusal. */
export function isFrozenEpisodeRefusal(err) {
  return FROZEN_EPISODE_CODES.includes(err?.response?.data?.code);
}

/** What the page says when a delete fails: the server's reason, else a fallback. */
export function deleteFailureText(err) {
  if (isFrozenEpisodeRefusal(err)) return err.response.data.error;
  return err?.response?.data?.error || err?.message || 'The episode was not deleted.';
}
