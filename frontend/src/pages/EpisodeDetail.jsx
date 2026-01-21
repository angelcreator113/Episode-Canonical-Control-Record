import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import episodeService from '../services/episodeService';
import EpisodeWardrobe from '../components/EpisodeWardrobe';
import EpisodeAssetsTab from '../components/EpisodeAssetsTab';
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
      {/* Hero Header - Responsive */}
      <div className="episode-hero">
        <div className="hero-content">
          <div className="hero-header">
            <button onClick={() => navigate('/episodes')} className="hero-back-button">
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
              className="hero-btn hero-btn-primary"
            >
              <span className="btn-icon">✏️</span>
              <span className="btn-text">Edit Episode</span>
            </button>
            <button
              onClick={() => navigate(`/composer/${episode.id}`)}
              className="hero-btn hero-btn-secondary"
            >
              <span className="btn-icon">🎨</span>
              <span className="btn-text">Create Thumbnail</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this episode? This cannot be undone.')) {
                  // TODO: Implement delete
                  console.log('Delete episode:', episode.id);
                }
              }}
              className="hero-btn hero-btn-danger"
            >
              <span className="btn-icon">🗑️</span>
              <span className="btn-text">Delete</span>
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
            <span className="tab-icon">📋</span>
            <span className="tab-text">Overview</span>
          </button>
          <button
            className={`tab ${activeTab === 'scenes' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <span className="tab-icon">🎬</span>
            <span className="tab-text">Scenes</span>
          </button>
          <button
            className={`tab ${activeTab === 'wardrobe' ? 'active' : ''}`}
            onClick={() => setActiveTab('wardrobe')}
          >
            <span className="tab-icon">👗</span>
            <span className="tab-text">Wardrobe</span>
          </button>
          <button
            className={`tab ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('assets')}
          >
            <span className="tab-icon">📸</span>
            <span className="tab-text">Assets</span>
          </button>
          <button
            className={`tab ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            <span className="tab-icon">🔧</span>
            <span className="tab-text">Metadata</span>
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📜</span>
            <span className="tab-text">History</span>
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
                  <span className={`stat-value stat-${episode.status?.toLowerCase() || 'draft'}`}>
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

        {/* Scenes Tab */}
        {activeTab === 'scenes' && (
          <div className="tab-content">
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">🎬 Episode Scenes</h2>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  className="btn-action btn-primary"
                >
                  <span className="btn-icon">➕</span>
                  <span className="btn-text">Add Scene</span>
                </button>
              </div>
              
              <div className="empty-placeholder">
                <span className="placeholder-icon">🎥</span>
                <h3 className="placeholder-title">No Scenes Yet</h3>
                <p className="placeholder-text">Break down your episode into scenes for better organization</p>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  className="btn-action btn-primary btn-large"
                >
                  <span className="btn-icon">🎬</span>
                  <span className="btn-text">Create First Scene</span>
                </button>
              </div>

              {/* Scene Features Info */}
              <div className="info-box info-box-blue">
                <h4 className="info-box-title">
                  ✨ Scene Features
                </h4>
                <ul className="info-box-list">
                  <li><strong>Timestamps:</strong> Mark start and end times for each scene</li>
                  <li><strong>Descriptions:</strong> Add notes and details for each scene</li>
                  <li><strong>Asset Linking:</strong> Connect specific assets to scenes</li>
                  <li><strong>Tags:</strong> Categorize scenes by type (intro, main content, outro, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Wardrobe Tab */}
        {activeTab === 'wardrobe' && (
          <div className="tab-content tab-content-full">
            <EpisodeWardrobe
              episodeId={episode.id}
              episodeNumber={episode.episode_number}
            />
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <EpisodeAssetsTab episodeId={episode.id} />
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="tab-content">
            {/* Episode Metadata Card */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">📊 Episode Metadata</h2>
                <button className="btn-action btn-primary">
                  <span className="btn-icon">✏️</span>
                  <span className="btn-text">Edit Metadata</span>
                </button>
              </div>

              {/* Metadata Fields Grid */}
              <div className="metadata-grid">
                <div className="metadata-item">
                  <div className="metadata-label">Episode Number</div>
                  <div className="metadata-value">{episode.episode_number || 'N/A'}</div>
                </div>
                <div className="metadata-item">
                  <div className="metadata-label">Status</div>
                  <div className="metadata-value" style={{ color: episode.status === 'published' ? '#10b981' : '#f59e0b' }}>{episode.status || 'draft'}</div>
                </div>
                <div className="metadata-item">
                  <div className="metadata-label">Air Date</div>
                  <div className="metadata-value">{episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'Not set'}</div>
                </div>
                <div className="metadata-item">
                  <div className="metadata-label">Duration</div>
                  <div className="metadata-value">{episode.duration ? `${episode.duration} min` : 'Not set'}</div>
                </div>
              </div>
            </div>

            {/* Raw JSON Metadata Card */}
            <div className="content-card">
              <h2 className="card-title">🔧 Raw JSON Metadata</h2>
              {episode.metadata && Object.keys(episode.metadata).length > 0 ? (
                <div className="json-container">
                  <pre className="json-pre">
                    {JSON.stringify(episode.metadata, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="empty-placeholder">
                  <span className="placeholder-icon">📋</span>
                  <h3 className="placeholder-title">No Additional Metadata</h3>
                  <p className="placeholder-text">Custom metadata fields will appear here</p>
                </div>
              )}
            </div>

            {/* Metadata Features Info */}
            <div className="content-card">
              <div className="info-box info-box-blue">
                <h4 className="info-box-title">
                  ✨ Metadata Capabilities
                </h4>
                <ul className="info-box-list">
                  <li><strong>Custom Fields:</strong> Add any custom data fields you need</li>
                  <li><strong>Structured Data:</strong> Store complex nested objects and arrays</li>
                  <li><strong>API Integration:</strong> Import metadata from external sources</li>
                  <li><strong>Search & Filter:</strong> Query episodes using metadata values</li>
                  <li><strong>Export Options:</strong> Download metadata in JSON, CSV, or XML formats</li>
                </ul>
              </div>
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
