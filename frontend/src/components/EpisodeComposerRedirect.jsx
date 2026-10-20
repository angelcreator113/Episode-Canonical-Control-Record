/**
 * Old episode thumbnail links (audit LINK-02, 2026-10-03; Evoni, 2026-10-20).
 * /episodes/:episodeId/composer and /thumbnails/:episodeId (the retired
 * Thumbnail Gallery) both open the one thumbnail editor, Templates ›
 * YouTube thumbnails, on that episode, replacing themselves in history so
 * Back skips them. The editor lists the episode's saved thumbnails, so the
 * gallery's list and Delete live there now.
 */
import { Navigate, useParams } from 'react-router-dom';
import { thumbnailStudioHref } from '../lib/thumbnailStudioHref';

export const episodeThumbnailsPath = (episodeId) => thumbnailStudioHref({ episodeId });

export default function EpisodeComposerRedirect() {
  const { episodeId } = useParams();
  return <Navigate to={episodeThumbnailsPath(episodeId)} replace />;
}
