/**
 * The link to the one place an episode's thumbnail is edited, Templates ›
 * YouTube thumbnails (Evoni, 2026-10-20), opened on an episode when there
 * is one. No imports, so pure modules (productionSteps) can use it.
 */
export function thumbnailStudioHref({ showId, episodeId } = {}) {
  const q = new URLSearchParams();
  if (showId) q.set('show', showId);
  if (episodeId) q.set('episode', episodeId);
  const qs = q.toString();
  return `/template-studio/youtube${qs ? `?${qs}` : ''}`;
}
