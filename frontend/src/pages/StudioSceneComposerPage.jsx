/**
 * StudioSceneComposerPage.jsx — Studio › Scene Composer
 * 
 * Universe-level entry point for the Scene Composer.
 * If a working episode is set, redirects to the full-screen composer.
 * Otherwise shows an episode picker.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { episodeAPI } from '../services/api';
import './StudioPickerPage.css';

export default function StudioSceneComposerPage() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId] = useState(() => localStorage.getItem('working-episode-id'));

  /* If a working episode exists, go straight to the composer */
  useEffect(() => {
    if (workingId) {
      navigate(`/episodes/${workingId}/scene-composer`, { replace: true });
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
  }, [workingId, navigate]);

  if (workingId) {
    return (
      <div className="sp-loading">
        <div className="sp-loading-dots"><span /><span /><span /></div>
        <p>Opening Scene Composer…</p>
      </div>
    );
  }

  const pick = (ep) => {
    localStorage.setItem('working-episode-id', ep.id);
    localStorage.setItem('working-episode-title', ep.title || 'Untitled');
    navigate(`/episodes/${ep.id}/scene-composer`);
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div className="sp-icon">🎬</div>
        <h1 className="sp-title">Scene Composer</h1>
        <p className="sp-subtitle">Select an episode to compose scenes for</p>
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
