/**
 * Reading the legacy Timeline Editor's load responses (Timeline Editor
 * redesign P0, 2026-11-02). Each reader returns null for a shape it does not
 * recognise, and the editor treats null as a failed load: an unrecognised
 * response is never read as "no scenes" or "no beats", because a save made
 * from that would replace the episode's real data.
 *
 * The shapes, as the API sends them:
 * - GET /api/v1/episodes/:id               { data: episode, script_revision }
 * - GET /api/v1/episodes/:id/scenes        { success, data: [scene], count, ... }
 * - GET /api/v1/episodes/:id/timeline-data { id, episode_id, beats, markers, ..., basis }
 */

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** The episode from GET /episodes/:id, or null. */
export function unwrapEpisode(body) {
  if (!isObject(body)) return null;
  const ep = isObject(body.data) ? body.data : isObject(body.episode) ? body.episode : null;
  return ep && ep.id != null ? ep : null;
}

/** The scene list from GET /episodes/:id/scenes, or null. */
export function unwrapScenes(body) {
  if (Array.isArray(body)) return body;
  if (isObject(body) && Array.isArray(body.data)) return body.data;
  return null;
}

/** The timeline row from GET /episodes/:id/timeline-data, or null. */
export function unwrapTimeline(body) {
  if (!isObject(body) || body.episode_id == null) return null;
  const lists = ['beats', 'markers', 'audio_clips', 'audioClips', 'character_clips', 'characterClips', 'keyframes'];
  // Every list the row carries must be a list (or absent/null).
  if (lists.some((k) => body[k] != null && !Array.isArray(body[k]))) return null;
  return body;
}
