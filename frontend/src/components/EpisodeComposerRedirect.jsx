/**
 * /episodes/:episodeId/composer (audit LINK-02, 2026-10-03). The route used
 * to open the Template Library, which never read the episode: an
 * episode-specific link landed on a generic page. The episode's thumbnails
 * live in its Thumbnail Gallery, so the old link goes there, keeping the
 * episode. The per-video thumbnail builder (choose a template, pick this
 * episode's assets, keep the output linked to the episode and video) is the
 * release workflow, audit batch 5; the Template Library stays at
 * /template-studio for templates themselves.
 */
import { Navigate, useParams } from 'react-router-dom';

export const episodeThumbnailsPath = (episodeId) => `/thumbnails/${episodeId}`;

export default function EpisodeComposerRedirect() {
  const { episodeId } = useParams();
  return <Navigate to={episodeThumbnailsPath(episodeId)} replace />;
}
