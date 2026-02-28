/**
 * StudioTimelinePage.jsx — Studio › Timeline
 * 
 * Universe-level entry point for the Timeline Editor.
 * If a working episode is set, redirects to the full-screen editor.
 * Otherwise shows an episode picker.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { episodeAPI } from '../services/api';
import './StudioPickerPage.css';

export default function StudioTimelinePage() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId] = useState(() => localStorage.getItem('working-episode-id'));

  /* If a working episode exists, go straight to the editor */
  useEffect(() => {
    if (workingId) {
      navigate(`/episodes/${workingId}/timeline`, { replace: true });
      return;
    }
    episodeAPI.getAll({ limit: 50 })
      .then(data => {
        const list = data?.episodes || data?.data || (Array.isArray(data) ? data : []);
        setEpisodes(list);
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoading(false));
  }, [workingId, navigate]);

  if (workingId) {
    return (
      <div className="sp-loading">
        <div className="sp-loading-dots"><span /><span /><span /></div>
        <p>Opening Timeline Editor…</p>
      </div>
    );
  }

  const pick = (ep) => {
    localStorage.setItem('working-episode-id', ep.id);
    localStorage.setItem('working-episode-title', ep.title || 'Untitled');
    navigate(`/episodes/${ep.id}/timeline`);
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div className="sp-icon">⏱️</div>
        <h1 className="sp-title">Timeline Editor</h1>
        <p className="sp-subtitle">Select an episode to open in the timeline</p>
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
