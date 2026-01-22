import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import episodeService from '../services/episodeService';
import EpisodeWardrobe from '../components/EpisodeWardrobe';
import EpisodeAssetsTab from '../components/EpisodeAssetsTab';
import EpisodeScripts from '../components/EpisodeScripts';
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
      <div className="ed-page">
        <div className="ed-state">
          <div className="ed-spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="ed-page">
        <div className="ed-state ed-state-error">
          <span className="ed-error-icon">⚠️</span>
          <h2>Episode Not Found</h2>
          <p>{error || 'The episode you\'re looking for doesn\'t exist.'}</p>
          <button onClick={() => navigate('/episodes')} className="ed-btn ed-btn-primary">
            ← Back to Episodes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ed-page">
      {/* Sticky Topbar */}
      <div className="ed-topbar">
        <div className="ed-topbar-left">
          <button onClick={() => navigate('/episodes')} className="ed-iconbtn">
            ←
          </button>
          <div className="ed-titlewrap">
            <h1 className="ed-title">{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <div className="ed-subrow">
              <span className="ed-subtext">Episode {episode.episode_number || episode.episodeNumber || '?'}</span>
              {(episode.air_date || episode.airDate) && (
                <>
                  <span>•</span>
                  <span className="ed-subtext">📅 {formatDate(episode.air_date || episode.airDate)}</span>
                </>
              )}
              {(episode.created_at || episode.createdAt) && (
                <>
                  <span>•</span>
                  <span className="ed-subtext">📝 Created {formatDate(episode.created_at || episode.createdAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="ed-topbar-actions">
          <button
            onClick={() => navigate(`/episodes/${episode.id}/edit`)}
            className="ed-btn ed-btn-primary"
          >
            <span>✏️</span>
            <span>Edit Episode</span>
          </button>
          <button
            onClick={() => navigate(`/composer/${episode.id}`)}
            className="ed-btn ed-btn-ghost"
          >
            <span>🎨</span>
            <span className="ed-only-desktop">Create Thumbnail</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete this episode? This cannot be undone.')) {
                // TODO: Implement delete
                console.log('Delete episode:', episode.id);
              }
            }}
            className="ed-btn ed-btn-danger"
          >
            <span>🗑️</span>
            <span className="ed-only-desktop">Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="ed-wrap">
        {/* Summary Card */}
        <div className="ed-summary">
          <div className="ed-summary-grid">
            <div className="ed-chip">
              <div className="k">Status</div>
              <div className="v">
                <span className={`ed-badge ed-badge-${episode.status?.toLowerCase() === 'published' ? 'success' : episode.status?.toLowerCase() === 'pending' ? 'warning' : 'neutral'}`}>
                  {episode.status || 'Draft'}
                </span>
              </div>
            </div>
            <div className="ed-chip">
              <div className="k">Episode Number</div>
              <div className="v">{episode.episode_number || episode.episodeNumber || 'N/A'}</div>
            </div>
            <div className="ed-chip">
              <div className="k">Air Date</div>
              <div className="v">{formatDate(episode.air_date || episode.airDate)}</div>
            </div>
          </div>

          <div className="ed-quickactions">
            <button
              onClick={() => navigate(`/episodes/${episode.id}/edit`)}
              className="ed-btn ed-btn-primary ed-btn-full"
            >
              ✏️ Edit Episode
            </button>
            <button
              onClick={() => navigate(`/composer/${episode.id}`)}
              className="ed-btn ed-btn-ghost ed-btn-full"
            >
              🎨 Create Thumbnail
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="ed-tabs">
          <button
            className={`ed-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="ed-tab-ic">📋</span>
            <span className="ed-tab-tx">Overview</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scenes' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <span className="ed-tab-ic">🎬</span>
            <span className="ed-tab-tx">Scenes</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'wardrobe' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('wardrobe')}
          >
            <span className="ed-tab-ic">👗</span>
            <span className="ed-tab-tx">Wardrobe</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scripts' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('scripts')}
          >
            <span className="ed-tab-ic">📝</span>
            <span className="ed-tab-tx">Scripts</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'assets' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('assets')}
          >
            <span className="ed-tab-ic">📸</span>
            <span className="ed-tab-tx">Assets</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'metadata' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            <span className="ed-tab-ic">🔧</span>
            <span className="ed-tab-tx">Metadata</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'history' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="ed-tab-ic">📜</span>
            <span className="ed-tab-tx">History</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="ed-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="ed-stack">
            {/* Description Section */}
            {episode.description && (
              <div className="ed-card">
                <div className="ed-cardhead">
                  <h2 className="ed-cardtitle">📝 Description</h2>
                </div>
                <p className="ed-bodytext">{episode.description}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">📊 Quick Stats</h2>
              </div>
              <div className="ed-statgrid">
                <div className="ed-stat">
                  <div className="k">Status</div>
                  <div className="v">
                    <span className={`ed-badge ed-badge-${episode.status?.toLowerCase() === 'published' ? 'success' : episode.status?.toLowerCase() === 'pending' ? 'warning' : 'neutral'}`}>
                      {episode.status || 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="ed-stat">
                  <div className="k">Episode Number</div>
                  <div className="v">
                    {episode.episode_number || episode.episodeNumber || 'N/A'}
                  </div>
                </div>
                {(episode.air_date || episode.airDate) && (
                  <div className="ed-stat">
                    <div className="k">Air Date</div>
                    <div className="v">
                      {formatDate(episode.air_date || episode.airDate)}
                    </div>
                  </div>
                )}
                {episode.duration && (
                  <div className="ed-stat">
                    <div className="k">Duration</div>
                    <div className="v">{episode.duration} minutes</div>
                  </div>
                )}
              </div>
            </div>

            {/* Categories */}
            {episode.categories && Array.isArray(episode.categories) && episode.categories.length > 0 && (
              <div className="ed-card">
                <div className="ed-cardhead">
                  <h2 className="ed-cardtitle">🏷️ Categories</h2>
                </div>
                <div className="ed-tags">
                  {episode.categories.map((cat, idx) => (
                    <span key={idx} className="ed-tag">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System Info */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🔐 System Information</h2>
              </div>
              <div className="ed-infogrid">
                <div className="ed-info">
                  <div className="k">ID</div>
                  <div className="v ed-mono">{episode.id}</div>
                </div>
                {(episode.created_at || episode.createdAt) && (
                  <div className="ed-info">
                    <div className="k">Created</div>
                    <div className="v">
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </div>
                  </div>
                )}
                {(episode.updated_at || episode.updatedAt) && (
                  <div className="ed-info">
                    <div className="k">Last Updated</div>
                    <div className="v">
                      {formatDateTime(episode.updated_at || episode.updatedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scenes Tab */}
        {activeTab === 'scenes' && (
          <div className="ed-stack">
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🎬 Episode Scenes</h2>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  className="ed-btn ed-btn-primary"
                >
                  <span>➕</span>
                  <span>Add Scene</span>
                </button>
              </div>
              
              <div className="ed-empty">
                <div className="ed-empty-ic">🎥</div>
                <h3>No Scenes Yet</h3>
                <p>Break down your episode into scenes for better organization</p>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  className="ed-btn ed-btn-primary ed-btn-lg"
                >
                  <span>🎬</span>
                  <span>Create First Scene</span>
                </button>
              </div>

              {/* Scene Features Info */}
              <div className="ed-callout">
                <h4>✨ Scene Features</h4>
                <ul>
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
          <div className="ed-fullbleed">
            <EpisodeWardrobe
              episodeId={episode.id}
              episodeNumber={episode.episode_number}
            />
          </div>
        )}

        {/* Scripts Tab */}
        {activeTab === 'scripts' && (
          <EpisodeScripts episodeId={episode.id} />
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <EpisodeAssetsTab episodeId={episode.id} />
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="ed-stack">
            {/* Episode Metadata Card */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">📊 Episode Metadata</h2>
                <button className="ed-btn ed-btn-primary">
                  <span>✏️</span>
                  <span>Edit Metadata</span>
                </button>
              </div>

              {/* Metadata Fields Grid */}
              <div className="ed-metagrid">
                <div className="ed-meta">
                  <div className="k">Episode Number</div>
                  <div className="v">{episode.episode_number || 'N/A'}</div>
                </div>
                <div className="ed-meta">
                  <div className="k">Status</div>
                  <div className="v">
                    <span className={`ed-badge ed-badge-${episode.status?.toLowerCase() === 'published' ? 'success' : 'warning'}`}>
                      {episode.status || 'draft'}
                    </span>
                  </div>
                </div>
                <div className="ed-meta">
                  <div className="k">Air Date</div>
                  <div className="v">{episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'Not set'}</div>
                </div>
                <div className="ed-meta">
                  <div className="k">Duration</div>
                  <div className="v">{episode.duration ? `${episode.duration} min` : 'Not set'}</div>
                </div>
              </div>
            </div>

            {/* Raw JSON Metadata Card */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🔧 Raw JSON Metadata</h2>
              </div>
              {episode.metadata && Object.keys(episode.metadata).length > 0 ? (
                <div className="ed-codebox">
                  <pre>
                    {JSON.stringify(episode.metadata, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="ed-empty ed-empty-tight">
                  <div className="ed-empty-ic">📋</div>
                  <h3>No Additional Metadata</h3>
                  <p>Custom metadata fields will appear here</p>
                </div>
              )}
            </div>

            {/* Metadata Features Info */}
            <div className="ed-card">
              <div className="ed-callout">
                <h4>✨ Metadata Capabilities</h4>
                <ul>
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
          <div className="ed-stack">
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">📜 Edit History</h2>
              </div>
              <div className="ed-timeline">
                <div className="ed-timeitem">
                  <div className="dot"></div>
                  <div className="body">
                    <div className="t">
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </div>
                    <div className="d">Episode created</div>
                  </div>
                </div>
                {(episode.updated_at || episode.updatedAt) && 
                 (episode.updated_at !== episode.created_at) && (
                  <div className="ed-timeitem">
                    <div className="dot"></div>
                    <div className="body">
                      <div className="t">
                        {formatDateTime(episode.updated_at || episode.updatedAt)}
                      </div>
                      <div className="d">Episode updated</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default EpisodeDetail;
