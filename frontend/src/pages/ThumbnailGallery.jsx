import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { episodeAPI } from '../services/api';
import './ThumbnailGallery.css';

/**
 * Thumbnail Gallery (/thumbnails/:episodeId): the episode's saved
 * thumbnails (GET /thumbnails/episode/:episodeId), with Delete.
 *
 * Audit TRUTH-03 (2026-10-03): this page used to insert three sample
 * records, ignore the route's episode, and have Duplicate and Delete alert
 * and reload the samples. It now reads the episode's own records; a failed
 * read says so with Retry; an episode with none says so. Duplicate is gone
 * (no route makes a copy). Previews and the per-video thumbnail builder are
 * the release workflow (audit batch 5), not this page.
 */

const TYPE_LABEL = { primary: 'Primary', cover: 'Cover', poster: 'Poster', frame: 'Frame' };
const STATUS_LABEL = { DRAFT: 'Draft', PUBLISHED: 'Published', UNPUBLISHED: 'Unpublished', ARCHIVED: 'Archived' };

export const thumbnailStatus = (t) => STATUS_LABEL[t.publishStatus || t.publish_status] ? (t.publishStatus || t.publish_status) : 'DRAFT';

function ThumbnailGallery() {
  const { episodeId } = useParams();
  const [thumbnails, setThumbnails] = useState([]);
  const [episode, setEpisode] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadThumbnails = useCallback(async () => {
    if (!episodeId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [thumbs, ep] = await Promise.all([
        api.get(`/api/v1/thumbnails/episode/${episodeId}`),
        episodeAPI.getById(episodeId).catch((err) => {
          console.error('[ThumbnailGallery] episode load failed:', err.response?.status || err.message);
          return null;
        }),
      ]);
      setThumbnails(Array.isArray(thumbs.data?.data) ? thumbs.data.data : []);
      setEpisode(ep?.data?.episode || ep?.data || null);
    } catch (err) {
      console.error('[ThumbnailGallery] thumbnails load failed:', err.response?.status || err.message);
      setLoadError(err.response?.status === 404
        ? `Episode ${episodeId} was not found, so it has no thumbnails to show.`
        : `Could not load this episode's thumbnails. ${err.response?.data?.error || err.response?.data?.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { loadThumbnails(); }, [loadThumbnails]);

  const handleDelete = async (thumbnail) => {
    if (!window.confirm(`Delete this ${TYPE_LABEL[thumbnail.thumbnailType] || 'thumbnail'}? This cannot be undone.`)) return;
    setNotice(null);
    try {
      await api.delete(`/api/v1/thumbnails/${thumbnail.id}`);
      setThumbnails((prev) => prev.filter((t) => t.id !== thumbnail.id));
    } catch (err) {
      console.error('[ThumbnailGallery] delete failed:', err.response?.status || err.message);
      setNotice(err.response?.status === 403
        ? 'You do not have permission to delete thumbnails.'
        : `Could not delete the thumbnail. ${err.response?.data?.error || err.response?.data?.message || ''}`.trim());
    }
  };

  const filtered = thumbnails.filter((t) =>
    (typeFilter === 'all' || t.thumbnailType === typeFilter)
    && (statusFilter === 'all' || thumbnailStatus(t) === statusFilter));
  const isFiltering = typeFilter !== 'all' || statusFilter !== 'all';
  const episodeLabel = episode
    ? `Ep. ${episode.episode_number ?? episode.episodeNumber ?? '?'}: ${episode.title || 'Untitled'}`
    : `Episode ${episodeId}`;

  if (loading) {
    return (
      <div className="thumbnail-gallery">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading thumbnails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="thumbnail-gallery">
      <header className="gallery-header">
        <div className="header-left">
          <h1>Thumbnail Gallery</h1>
          <span className="count" data-testid="thumbnail-count">{loadError ? episodeLabel : `${episodeLabel} · ${filtered.length} ${filtered.length === 1 ? 'thumbnail' : 'thumbnails'}`}</span>
        </div>
        <div className="header-right">
          {/* The per-video thumbnail builder (uploaded images, wardrobe, phone art, text) is the release workflow, audit batch 5. */}
        </div>
      </header>

      {loadError && (
        <div className="empty-state" role="alert" data-testid="thumbnail-load-failed">
          <div className="empty-icon">⚠️</div>
          <h2>Thumbnails could not be loaded</h2>
          <p>{loadError}</p>
          <button type="button" className="action-btn" onClick={loadThumbnails}>Retry</button>
        </div>
      )}

      {!loadError && (
        <>
          <div className="filters-bar">
            <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type">
              <option value="all">All types</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {notice && <div role="alert" data-testid="thumbnail-notice" style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#FBEFF3', border: '1px solid #C06E87', color: '#2C2C2C', fontSize: 13 }}>{notice}</div>}

          <div className="gallery-content">
            {filtered.length === 0 ? (
              <div className="empty-state" data-testid="thumbnail-empty">
                <div className="empty-icon">🎨</div>
                <h2>{isFiltering ? 'No thumbnails match these filters' : 'No thumbnails yet for this episode'}</h2>
                <p>{isFiltering ? 'Try adjusting your filters.' : 'Thumbnails appear here once they are generated or uploaded for this episode.'}</p>
              </div>
            ) : (
              <div className="thumbnails-grid">
                {filtered.map((thumbnail) => {
                  const status = thumbnailStatus(thumbnail);
                  const url = thumbnail.url || thumbnail.publicUrl || thumbnail.public_url || null;
                  const size = thumbnail.widthPixels && thumbnail.heightPixels ? `${thumbnail.widthPixels}×${thumbnail.heightPixels}` : null;
                  const when = thumbnail.generatedAt || thumbnail.generated_at || thumbnail.created_at;
                  return (
                    <div key={thumbnail.id} className="thumbnail-card" data-testid={`thumbnail-${thumbnail.id}`}>
                      <div className="thumbnail-preview">
                        {url ? (
                          <img src={url} alt={`${TYPE_LABEL[thumbnail.thumbnailType] || 'Thumbnail'} for ${episodeLabel}`} />
                        ) : (
                          <div className="placeholder-thumbnail">
                            <span className="placeholder-icon">🎨</span>
                            <span className="placeholder-text">No preview</span>
                          </div>
                        )}
                        <div className="quick-actions">
                          <button type="button" className="action-btn delete" onClick={() => handleDelete(thumbnail)} title="Delete" aria-label={`Delete ${TYPE_LABEL[thumbnail.thumbnailType] || 'thumbnail'}`}>
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="thumbnail-info">
                        <div className="info-header">
                          <h3 className="episode-title">
                            {TYPE_LABEL[thumbnail.thumbnailType] || 'Thumbnail'}{thumbnail.isPrimary ? ' · ⭐ primary' : ''}
                          </h3>
                          <span className={`status-badge ${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
                        </div>
                        <div className="info-meta">
                          <span className="meta-item">🖼 {(thumbnail.format || 'image').toUpperCase()}{size ? ` · ${size}` : ''}</span>
                          {when && <span className="meta-item">📅 {new Date(when).toLocaleDateString()}</span>}
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

export default ThumbnailGallery;
