/**
 * The old Timeline Editor's URLs (deleted, Evoni 2026-11-03) land on the
 * episode editor, so bookmarks and saved links keep working:
 * /episodes/:id/timeline → /episodes/:id/editor; /studio/timeline?episode_id=…
 * → that episode's editor, and /studio/timeline alone → the editor hub.
 */
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

export default function LegacyTimelineRedirect() {
  const { episodeId } = useParams();
  const location = useLocation();
  const asked = episodeId || new URLSearchParams(location.search).get('episode_id');
  return <Navigate to={asked ? `/episodes/${encodeURIComponent(asked)}/editor` : '/studio/editor'} replace />;
}
