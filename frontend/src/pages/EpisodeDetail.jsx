import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEpisodeDetail } from '../hooks/useEpisodeDetail';
import ThumbnailGallery from '../components/Thumbnails/ThumbnailGallery';
import './EpisodeDetail.css';

export const EpisodeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { episode, loading, error, refresh } = useEpisodeDetail(id);

  if (loading) {
    return (
      <div className="episode-detail-container">
        <div className="loading">Loading episode details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="episode-detail-container">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="error-message">
          Error loading episode: {error}
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="episode-detail-container">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="not-found">Episode not found</div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
        return '#4caf50';
      case 'processing':
        return '#ff9800';
      case 'pending':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="episode-detail-container">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back to Episodes
        </button>
        <h1>{episode.title}</h1>
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(episode.status) }}
        >
          {episode.status}
        </span>
      </div>

      {/* Main Content */}
      <div className="detail-content">
        {/* Left Column - Info */}
        <div className="detail-left">
          <section className="info-section">
            <h2>Episode Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Season</label>
                <span>{episode.season_number}</span>
              </div>
              <div className="info-item">
                <label>Episode</label>
                <span>{episode.episode_number}</span>
              </div>
              <div className="info-item">
                <label>Air Date</label>
                <span>{formatDate(episode.air_date)}</span>
              </div>
              <div className="info-item">
                <label>Status</label>
                <span className="status-text">{episode.status}</span>
              </div>
            </div>
          </section>

          <section className="description-section">
            <h2>Description</h2>
            <p className="description-text">
              {episode.description || 'No description available'}
            </p>
          </section>

          <section className="dates-section">
            <h2>Metadata</h2>
            <div className="dates-grid">
              <div className="date-item">
                <label>Created</label>
                <span>{formatDate(episode.created_at)}</span>
              </div>
              <div className="date-item">
                <label>Last Updated</label>
                <span>{formatDate(episode.updated_at)}</span>
              </div>
            </div>
          </section>

          {episode.tags && episode.tags.length > 0 && (
            <section className="tags-section">
              <h2>Tags</h2>
              <div className="tags-list">
                {episode.tags.map((tag, index) => (
                  <span key={index} className="tag-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="thumbnails-section">
            <ThumbnailGallery episodeId={episode.episode_id} />
          </section>
        </div>

        {/* Right Column - Actions & Related */}
        <div className="detail-right">
          <section className="actions-section">
            <h2>Actions</h2>
            <button className="action-btn refresh" onClick={refresh}>
              🔄 Refresh
            </button>
            <button className="action-btn edit" disabled>
              ✏️ Edit (Coming Soon)
            </button>
            <button className="action-btn download" disabled>
              ⬇️ Download (Coming Soon)
            </button>
          </section>

          <section className="stats-section">
            <h2>Statistics</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Episode ID</span>
                <span className="stat-value">{episode.episode_id?.slice(0, 8)}...</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Show ID</span>
                <span className="stat-value">{episode.show_id?.slice(0, 8)}...</span>
              </div>
            </div>
          </section>

          <section className="related-section">
            <h2>Related</h2>
            <button className="related-btn" disabled>
              📸 View Thumbnails (Scroll below)
            </button>
            <button className="related-btn" disabled>
              📝 View Metadata (Coming Soon)
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetail;
