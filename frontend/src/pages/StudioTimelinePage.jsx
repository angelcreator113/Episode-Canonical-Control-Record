/**
 * StudioTimelinePage.jsx — Studio › Timeline, and Studio › Editor
 * 
 * Universe-level entry point for the Timeline Editor (/studio/timeline) and,
 * with target="editor", for the episode editor (/studio/editor, Timeline
 * Editor redesign P1).
 * If a working episode is set, redirects to the full-screen editor.
 * Otherwise shows an episode picker.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { episodeAPI } from '../services/api';
import './StudioPickerPage.css';

const TARGETS = {
  timeline: { path: 'timeline', title: 'Timeline Editor', icon: '⏱️', subtitle: 'Select an episode to open in the timeline' },
  editor: { path: 'editor', title: 'Editor', icon: '🎞️', subtitle: 'Select an episode to open in the editor' },
};

export default function StudioTimelinePage({ target = 'timeline' }) {
  const navigate = useNavigate();
  const to = TARGETS[target] || TARGETS.timeline;
  // An episode asked for by the link (e.g. Production → Scenes → Timeline
  // Editor) always wins; the working episode is only used when none is
  // requested (§8(w) P4, Task #2212).
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('episode_id');
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId] = useState(() => localStorage.getItem('working-episode-id'));

  /* If a working episode exists, go straight to the editor */
  useEffect(() => {
    if (requestedId) {
      navigate(`/episodes/${requestedId}/${to.path}`, { replace: true });
      return;
    }
    if (workingId) {
      navigate(`/episodes/${workingId}/${to.path}`, { replace: true });
      return;
    }
    episodeAPI.getAll({ limit: 50 })
      .then(res => {
        const body = res?.data || res;
        const list = body?.episodes || body?.data || (Array.isArray(body) ? body : []);
        setEpisodes(Array.isArray(list) ? list : []);
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoading(false));
  }, [requestedId, workingId, navigate, to.path]);

  if (requestedId || workingId) {
    return (
      <div className="sp-loading">
        <div className="sp-loading-dots"><span /><span /><span /></div>
        <p>Opening {to.title}…</p>
      </div>
    );
  }

  const pick = (ep) => {
    localStorage.setItem('working-episode-id', ep.id);
    localStorage.setItem('working-episode-title', ep.title || 'Untitled');
    navigate(`/episodes/${ep.id}/${to.path}`);
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div className="sp-icon">{to.icon}</div>
        <h1 className="sp-title">{to.title}</h1>
        <p className="sp-subtitle">{to.subtitle}</p>
      </div>

      {loading ? (
        <div className="sp-loading">
          <div className="sp-loading-dots"><span /><span /><span /></div>
        </div>
      ) : episodes.length === 0 ? (
        <div className="sp-empty">
          <div className="sp-empty-icon">📭</div>
          <p>No episodes found. Create one first.</p>
          <button className="sp-btn" onClick={() => navigate('/episodes/create')}>
            + Create Episode
          </button>
        </div>
      ) : (
        <div className="sp-grid">
          {episodes.map(ep => (
            <button key={ep.id} className="sp-card" onClick={() => pick(ep)}>
              <div className="sp-card-number">
                {ep.episode_number || ep.episodeNumber || '—'}
              </div>
              <div className="sp-card-info">
                <div className="sp-card-title">{ep.title || ep.episodeTitle || 'Untitled'}</div>
                <div className="sp-card-meta">
                  <span className={`sp-status sp-status-${(ep.status || 'draft').toLowerCase()}`}>
                    {ep.status || 'Draft'}
                  </span>
                </div>
              </div>
              <div className="sp-card-arrow">→</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
