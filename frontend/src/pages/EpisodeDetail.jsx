import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import episodeService from '../services/episodeService';
import './EpisodeDetail.css';  // ← ADD THIS LINE!


const EpisodeDetail = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Auth check
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Episode loading
  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await episodeService.getEpisode(episodeId);
        setEpisode(data);
      } catch (err) {
        setError(err.message || 'Failed to load episode');
      } finally {
        setLoading(false);
      }
    };

    if (episodeId) {
      fetchEpisode();
    }
  }, [episodeId]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      published: 'green',
      pending: 'yellow',
      archived: 'red'
    };
    return colors[status?.toLowerCase()] || 'gray';
  };

  if (authLoading || loading) {
    return (
      <div className="episode-detail-page">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="episode-detail-page">
        <div className="error-container">
          <span className="error-icon">⚠️</span>
          <h2>Episode Not Found</h2>
          <p>{error || 'The episode you\'re looking for doesn\'t exist.'}</p>
          <button onClick={() => navigate('/episodes')} className="btn-primary">
            ← Back to Episodes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="episode-detail-page">
      {/* Hero Header */}
      <div className="episode-hero">
        <div className="hero-content">
          <div className="hero-header">
            <button onClick={() => navigate('/episodes')} className="back-button">
              ← Back
            </button>
            <div className="hero-badge">
              <span className={`status-badge status-${getStatusColor(episode.status)}`}>
                {episode.status || 'Draft'}
              </span>
            </div>
          </div>

          <div className="hero-title-section">
            <h1 className="hero-title">{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <p className="hero-subtitle">Episode {episode.episode_number || episode.episodeNumber || '?'}</p>
          </div>

          <div className="hero-meta">
            {(episode.air_date || episode.airDate) && (
              <div className="meta-item">
                <span className="meta-icon">📅</span>
                <span>{formatDate(episode.air_date || episode.airDate)}</span>
              </div>
            )}
            {episode.duration && (
              <div className="meta-item">
                <span className="meta-icon">⏱️</span>
                <span>{episode.duration} min</span>
              </div>
            )}
            {(episode.created_at || episode.createdAt) && (
              <div className="meta-item">
                <span className="meta-icon">📝</span>
                <span>Created {formatDate(episode.created_at || episode.createdAt)}</span>
              </div>
            )}
          </div>

          <div className="hero-actions">
            <button
              onClick={() => navigate(`/episodes/${episode.id}/edit`)}
              className="btn-primary"
            >
              ✏️ Edit Episode
            </button>
            <button
              onClick={() => navigate(`/composer/${episode.id}`)}
              className="btn-secondary"
            >
              🎨 Create Thumbnail
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this episode? This cannot be undone.')) {
                  // TODO: Implement delete
                  console.log('Delete episode:', episode.id);
                }
              }}
              className="btn-danger"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📋 Overview
          </button>
          <button
            className={`tab ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('assets')}
          >
            📸 Assets
          </button>
          <button
            className={`tab ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            🔧 Metadata
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 History
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="episode-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* Description Section */}
            {episode.description && (
              <div className="content-card">
                <h2 className="card-title">📝 Description</h2>
                <p className="description-text">{episode.description}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="content-card">
              <h2 className="card-title">📊 Quick Stats</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Status</span>
                  <span className={`stat-value status-${getStatusColor(episode.status)}`}>
                    {episode.status || 'Draft'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Episode Number</span>
                  <span className="stat-value">
                    {episode.episode_number || episode.episodeNumber || 'N/A'}
                  </span>
                </div>
                {(episode.air_date || episode.airDate) && (
                  <div className="stat-item">
                    <span className="stat-label">Air Date</span>
                    <span className="stat-value">
                      {formatDate(episode.air_date || episode.airDate)}
                    </span>
                  </div>
                )}
                {episode.duration && (
                  <div className="stat-item">
                    <span className="stat-label">Duration</span>
                    <span className="stat-value">{episode.duration} minutes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Categories */}
            {episode.categories && Array.isArray(episode.categories) && episode.categories.length > 0 && (
              <div className="content-card">
                <h2 className="card-title">🏷️ Categories</h2>
                <div className="categories-list">
                  {episode.categories.map((cat, idx) => (
                    <span key={idx} className="category-tag">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System Info */}
            <div className="content-card system-info">
              <h2 className="card-title">🔐 System Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">ID</span>
                  <span className="info-value monospace">{episode.id}</span>
                </div>
                {(episode.created_at || episode.createdAt) && (
                  <div className="info-item">
                    <span className="info-label">Created</span>
                    <span className="info-value">
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </span>
                  </div>
                )}
                {(episode.updated_at || episode.updatedAt) && (
                  <div className="info-item">
                    <span className="info-label">Last Updated</span>
                    <span className="info-value">
                      {formatDateTime(episode.updated_at || episode.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div className="tab-content">
            <div className="content-card">
              <h2 className="card-title">📸 Episode Assets</h2>
              <div className="assets-placeholder">
                <span className="placeholder-icon">🖼️</span>
                <h3>No Assets Yet</h3>
                <p>Upload images, videos, and other media for this episode</p>
                <button className="btn-primary" onClick={() => navigate('/assets')}>
                  📤 Go to Asset Manager
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="tab-content">
            <div className="content-card">
              <h2 className="card-title">🔧 Raw Metadata</h2>
              {episode.metadata && Object.keys(episode.metadata).length > 0 ? (
                <pre className="metadata-json">
                  {JSON.stringify(episode.metadata, null, 2)}
                </pre>
              ) : (
                <div className="empty-state-small">
                  <p>No metadata available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="tab-content">
            <div className="content-card">
              <h2 className="card-title">📜 Edit History</h2>
              <div className="history-timeline">
                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <span className="timeline-time">
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </span>
                    <p className="timeline-text">Episode created</p>
                  </div>
                </div>
                {(episode.updated_at || episode.updatedAt) && 
                 (episode.updated_at !== episode.created_at) && (
                  <div className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <span className="timeline-time">
                        {formatDateTime(episode.updated_at || episode.updatedAt)}
                      </span>
                      <p className="timeline-text">Episode updated</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodeDetail;