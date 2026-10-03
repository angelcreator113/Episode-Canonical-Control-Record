import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CompositionLibrary.css';

/**
 * Composition Library (/library): every saved thumbnail composition
 * (GET /compositions), the same records CompositionDetail opens, with
 * search, All / Primary / Recent, Open and Delete.
 *
 * Audit TRUTH-04 (2026-10-03): this page used to load three sample
 * compositions with sample ids and counts, keep favorites in local state,
 * and have Duplicate and Delete alert and reload the samples. It now reads
 * the real index; a failed read says so with Retry; Delete deletes
 * (DELETE /compositions/:id). Favorites, tags and Duplicate are gone: no
 * record or route holds them.
 */

export function compositionTitle(c) {
  return c.name || c.episode?.title || c.episode?.episodeTitle || 'Untitled composition';
}

export function compositionEpisode(c) {
  const ep = c.episode;
  if (!ep) return null;
  const n = ep.episode_number ?? ep.episodeNumber;
  return `${n != null ? `Ep. ${n}` : 'Episode'}${ep.title ? `: ${ep.title}` : ''}${ep.show?.name ? ` · ${ep.show.name}` : ''}`;
}

export default function CompositionLibrary() {
  const navigate = useNavigate();
  const [compositions, setCompositions] = useState([]);
  const [view, setView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadCompositions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/api/v1/compositions');
      setCompositions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error('[CompositionLibrary] load failed:', err.response?.status || err.message);
      setLoadError(`Could not load the compositions. ${err.response?.data?.error || err.response?.data?.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCompositions(); }, [loadCompositions]);

  const handleDelete = async (composition) => {
    if (!window.confirm(`Delete "${compositionTitle(composition)}"? Its outputs go with it. This cannot be undone.`)) return;
    setNotice(null);
    try {
      await api.delete(`/api/v1/compositions/${composition.id}`);
      setCompositions((prev) => prev.filter((c) => c.id !== composition.id));
    } catch (err) {
      console.error('[CompositionLibrary] delete failed:', err.response?.status || err.message);
      setNotice(`Could not delete "${compositionTitle(composition)}". ${err.response?.data?.error || err.response?.data?.message || ''}`.trim());
    }
  };

  const q = searchQuery.trim().toLowerCase();
  let filtered = compositions.filter((c) => !q
    || compositionTitle(c).toLowerCase().includes(q)
    || (c.description || '').toLowerCase().includes(q)
    || (compositionEpisode(c) || '').toLowerCase().includes(q));
  if (view === 'primary') filtered = filtered.filter((c) => c.is_primary);
  if (view === 'recent') filtered = [...filtered].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).slice(0, 10);
  const isFiltering = Boolean(q) || view !== 'all';

  if (loading) {
    return (
      <div className="composition-library">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading compositions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="composition-library">
      <header className="library-header">
        <div className="header-left">
          <h1>Composition Library</h1>
          {!loadError && <span className="count" data-testid="composition-count">{filtered.length} {filtered.length === 1 ? 'composition' : 'compositions'}</span>}
        </div>
        <div className="header-right">
          {/* New compositions are made from an episode's Thumbnail Builder; the per-video builder is the release workflow (audit batch 5). */}
        </div>
      </header>

      {loadError && (
        <div className="empty-state" role="alert" data-testid="composition-load-failed">
          <div className="empty-icon">⚠️</div>
          <h2>Compositions could not be loaded</h2>
          <p>{loadError}</p>
          <button type="button" className="action-btn" onClick={loadCompositions}>Retry</button>
        </div>
      )}

      {!loadError && (
        <>
          <div className="view-tabs">
            <button type="button" className={`view-tab ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>All Compositions</button>
            <button type="button" className={`view-tab ${view === 'primary' ? 'active' : ''}`} onClick={() => setView('primary')}>⭐ Primary</button>
            <button type="button" className={`view-tab ${view === 'recent' ? 'active' : ''}`} onClick={() => setView('recent')}>Recent</button>
          </div>

          <div className="filters-section">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search by name, description or episode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search compositions" />
            </div>
          </div>

          {notice && <div role="alert" data-testid="composition-notice" style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#FBEFF3', border: '1px solid #C06E87', color: '#2C2C2C', fontSize: 13 }}>{notice}</div>}

          <div className="library-content">
            {filtered.length === 0 ? (
              <div className="empty-state" data-testid="composition-empty">
                <div className="empty-icon">📦</div>
                <h2>{isFiltering ? 'No compositions match' : 'No compositions yet'}</h2>
                <p>{isFiltering ? 'Try another search or view.' : 'A composition is a saved thumbnail layout for an episode. None has been saved yet.'}</p>
              </div>
            ) : (
              <div className="compositions-grid">
                {filtered.map((composition) => {
                  const outputs = Array.isArray(composition.outputs) ? composition.outputs : [];
                  const ready = outputs.filter((o) => o.status === 'READY');
                  const preview = ready.find((o) => o.image_url)?.image_url || null;
                  const episodeLine = compositionEpisode(composition);
                  return (
                    <div key={composition.id} className="composition-card" data-testid={`composition-${composition.id}`}>
                      <div className="composition-preview">
                        {preview ? (
                          <img src={preview} alt={compositionTitle(composition)} />
                        ) : (
                          <div className="placeholder-preview">
                            <span className="placeholder-icon">🎨</span>
                            <span className="placeholder-text">{outputs.length ? 'No finished output yet' : 'No outputs yet'}</span>
                          </div>
                        )}
                        {composition.is_primary && <span className="favorite-btn active" title="The episode's primary thumbnail">⭐</span>}
                      </div>

                      <div className="composition-info">
                        <h3 className="composition-name">{compositionTitle(composition)}</h3>
                        {episodeLine && <p className="composition-description">{episodeLine}</p>}
                        {composition.description && <p className="composition-description">{composition.description}</p>}

                        <div className="composition-stats">
                          <span className="stat">🖼 {ready.length} of {outputs.length} {outputs.length === 1 ? 'output' : 'outputs'} ready</span>
                          <span className="stat">{(composition.status || 'draft').toUpperCase()} · v{composition.current_version || 1}</span>
                          {composition.updated_at && <span className="stat">📅 {new Date(composition.updated_at).toLocaleDateString()}</span>}
                        </div>

                        <div className="composition-actions">
                          <button type="button" className="action-btn primary" onClick={() => navigate(`/compositions/${composition.id}`)}>Open</button>
                          <button type="button" className="action-btn delete" onClick={() => handleDelete(composition)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
