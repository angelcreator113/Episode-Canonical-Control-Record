import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import apiClient from '../services/api';

const API = '/api/v1';

// Track 3 module-scope helpers (Pattern D).
export const fetchEpisodeForReview = (episodeId) =>
  apiClient.get(`${API}/episodes/${episodeId}`);

/**
 * An episode's Review & Approve stop (the workflow's In Review and Scheduled
 * steps open it). It listed every post-generation review, which are the
 * book's scenes and no episode's, and its "run a review" sent a scene_id the
 * route never read. The reviews are on the Story Dashboard, which Evaluate
 * now feeds (Evoni's ruling, 2026-10-08).
 */
export default function EpisodeReview() {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const epRes = await fetchEpisodeForReview(episodeId);
      setEpisode(epRes.data);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-wrapper" style={{ padding: 32 }}>Loading...</div>;

  return (
    <div className="page-wrapper" style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to={`/episodes/${episodeId}/export`} style={{ color: '#aaa', textDecoration: 'none' }}>&larr; Export</Link>
        <h1 style={{ margin: 0 }}>Review &amp; Approve</h1>
      </div>

      {episode && (
        <p style={{ color: '#999', marginBottom: 24 }}>
          Episode: <strong>{episode.title || episode.name || `#${episode.episode_number}`}</strong>
        </p>
      )}

      <p style={{ color: '#888' }} data-testid="episode-review-empty">
        Nothing to review here yet. The book's scene reviews are on the{' '}
        <Link to="/universe/story-dashboard" style={{ color: '#aaa' }}>Story Dashboard</Link>.
      </p>
    </div>
  );
}
