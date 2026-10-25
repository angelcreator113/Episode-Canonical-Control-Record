/**
 * EpisodeStatusCard — the episode this event started, once it exists
 * (Evoni, 2026-10-25): its stage, what it still needs and its release date,
 * "In the edit · needs thumbnail · releases Sun, Nov 1" (lib/eventFlow
 * episodeStatus over lib/releaseBoard readiness and the release schedule),
 * linking to the episode. Reads GET /episodes/:id, its feed posts and the
 * show's release schedule; never blocks the page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import api from '../../services/api';
import { useReleaseSchedule } from '../../lib/releaseSchedule';
import { episodeStatus } from '../../lib/eventFlow';
import './EventFlow.css';

export default function EpisodeStatusCard({ showId, episodeId, fallback = null }) {
  const [ep, setEp] = useState(null);
  const [posts, setPosts] = useState(null);
  const [failed, setFailed] = useState(false);
  const rs = useReleaseSchedule({ api, showId });
  useEffect(() => {
    let cancelled = false;
    setEp(null); setPosts(null); setFailed(false);
    api.get(`/api/v1/episodes/${episodeId}`)
      .then((r) => { if (!cancelled) setEp(r.data?.data || r.data || null); })
      .catch((err) => { console.error('[EpisodeStatusCard] episode load failed:', err); if (!cancelled) setFailed(true); });
    api.get(`/api/v1/feed-posts/episode/${episodeId}`)
      .then((r) => { if (!cancelled) setPosts(r.data?.data || []); })
      .catch((err) => { console.error('[EpisodeStatusCard] feed posts load failed:', err); if (!cancelled) setPosts([]); });
    return () => { cancelled = true; };
  }, [episodeId]);

  const row = rs.rowsById[episodeId] || null;
  const status = ep ? episodeStatus(ep, posts, row) : null;
  const name = ep ? `Episode ${row?.number ?? ep.episode_number ?? '?'}${ep.title ? `: ${ep.title}` : ''}`
    : fallback ? `Episode ${fallback.episode_number ?? '?'}${fallback.title ? `: ${fallback.title}` : ''}` : 'The episode';
  return (
    <div className="eff-card eff-episode" data-testid="episode-status">
      <span className="eff-card-label"><Clapperboard size={13} aria-hidden="true" /> {name}</span>
      {status ? <p className="eff-card-line" data-testid="episode-status-line">{status.line}</p>
        : <p className="eff-card-sub">{failed ? 'Couldn’t read the episode’s status.' : 'Reading the episode…'}</p>}
      <Link className="eff-card-link" to={`/episodes/${episodeId}?tab=overview`} data-testid="episode-status-open">Open the episode →</Link>
    </div>
  );
}
