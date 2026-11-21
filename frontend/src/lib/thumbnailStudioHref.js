/**
 * The link to the one place an episode's thumbnail is edited, Templates ›
 * YouTube thumbnails (Evoni, 2026-10-20), opened on an episode when there
 * is one, and on one of the show's named templates when one is given.
 * No imports, so pure modules (productionSteps) can use it.
 *
 * `from` and `fromLabel` (PR-06): where it was opened from, so the editor's
 * way back returns there (utils/returnPath.js reads and checks them). With
 * neither, the address is what it always was.
 */
export function thumbnailStudioHref({ showId, episodeId, templateId, from, fromLabel } = {}) {
  const q = new URLSearchParams();
  if (showId) q.set('show', showId);
  if (episodeId) q.set('episode', episodeId);
  if (templateId) q.set('template', templateId);
  if (from) {
    q.set('from', from);
    if (fromLabel) q.set('fromLabel', fromLabel);
  }
  const qs = q.toString();
  return `/template-studio/youtube${qs ? `?${qs}` : ''}`;
}
