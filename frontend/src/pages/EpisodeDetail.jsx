import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import episodeService from '../services/episodeService';
import EpisodeWardrobe from '../components/EpisodeWardrobe';
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
    <div className="episode-detail-page" style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '3rem' }}>
      {/* Hero Header - Smaller */}
      <div className="episode-hero" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '0', padding: '1.5rem 2rem', color: 'white', marginBottom: '2rem' }}>
        <div className="hero-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="hero-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button onClick={() => navigate('/episodes')} className="back-button" style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', backdropFilter: 'blur(10px)' }}>
              ← Back
            </button>
            <div className="hero-badge">
              <span className={`status-badge status-${getStatusColor(episode.status)}`} style={{ background: episode.status === 'draft' ? 'rgba(156, 163, 175, 0.9)' : 'rgba(16, 185, 129, 0.9)', color: 'white', padding: '0.4rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {episode.status || 'Draft'}
              </span>
            </div>
          </div>

          <div className="hero-title-section" style={{ marginBottom: '1rem' }}>
            <h1 className="hero-title" style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: '800', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <p className="hero-subtitle" style={{ margin: 0, fontSize: '1rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>Episode {episode.episode_number || episode.episodeNumber || '?'}</p>
          </div>

          <div className="hero-meta" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {(episode.air_date || episode.airDate) && (
              <div className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.95)', fontSize: '0.875rem' }}>
                <span className="meta-icon">📅</span>
                <span>{formatDate(episode.air_date || episode.airDate)}</span>
              </div>
            )}
            {episode.duration && (
              <div className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.95)', fontSize: '0.875rem' }}>
                <span className="meta-icon">⏱️</span>
                <span>{episode.duration} min</span>
              </div>
            )}
            {(episode.created_at || episode.createdAt) && (
              <div className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.95)', fontSize: '0.875rem' }}>
                <span className="meta-icon">📝</span>
                <span>Created {formatDate(episode.created_at || episode.createdAt)}</span>
              </div>
            )}
          </div>

          <div className="hero-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/episodes/${episode.id}/edit`)}
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem', background: 'white', color: '#667eea', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              ✏️ Edit Episode
            </button>
            <button
              onClick={() => navigate(`/composer/${episode.id}`)}
              className="btn-secondary"
              style={{ padding: '0.65rem 1.25rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
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
              style={{ padding: '0.65rem 1.25rem', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container" style={{ maxWidth: '1200px', margin: '0 auto 2rem', padding: '0 2rem' }}>
        <div className="tabs" style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'overview' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'overview' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            📋 Overview
          </button>
          <button
            className={`tab ${activeTab === 'scenes' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenes')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'scenes' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'scenes' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            🎬 Scenes
          </button>
          <button
            className={`tab ${activeTab === 'wardrobe' ? 'active' : ''}`}
            onClick={() => setActiveTab('wardrobe')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'wardrobe' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'wardrobe' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            👗 Wardrobe
          </button>
          <button
            className={`tab ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('assets')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'assets' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'assets' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            📸 Assets
          </button>
          <button
            className={`tab ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'metadata' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'metadata' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            🔧 Metadata
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ flex: 1, padding: '0.875rem 1.5rem', background: activeTab === 'history' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'history' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            📜 History
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="episode-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Description Section */}
            {episode.description && (
              <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h2 className="card-title" style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>📝 Description</h2>
                <p className="description-text" style={{ margin: 0, fontSize: '1rem', lineHeight: '1.7', color: '#4b5563' }}>{episode.description}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 className="card-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>📊 Quick Stats</h2>
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="stat-item" style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <span className="stat-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Status</span>
                  <span className={`stat-value status-${getStatusColor(episode.status)}`} style={{ display: 'block', fontSize: '1.25rem', fontWeight: '700', color: episode.status === 'draft' ? '#9ca3af' : '#10b981', textTransform: 'capitalize' }}>
                    {episode.status || 'Draft'}
                  </span>
                </div>
                <div className="stat-item" style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <span className="stat-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Episode Number</span>
                  <span className="stat-value" style={{ display: 'block', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                    {episode.episode_number || episode.episodeNumber || 'N/A'}
                  </span>
                </div>
                {(episode.air_date || episode.airDate) && (
                  <div className="stat-item" style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span className="stat-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Air Date</span>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                      {formatDate(episode.air_date || episode.airDate)}
                    </span>
                  </div>
                )}
                {episode.duration && (
                  <div className="stat-item" style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span className="stat-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Duration</span>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>{episode.duration} minutes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Categories */}
            {episode.categories && Array.isArray(episode.categories) && episode.categories.length > 0 && (
              <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h2 className="card-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>🏷️ Categories</h2>
                <div className="categories-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {episode.categories.map((cat, idx) => (
                    <span key={idx} className="category-tag" style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '600' }}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System Info */}
            <div className="content-card system-info" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 className="card-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>🔐 System Information</h2>
              <div className="info-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="info-label" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>ID</span>
                  <span className="info-value monospace" style={{ fontSize: '0.875rem', color: '#1f2937', fontFamily: 'monospace', wordBreak: 'break-all' }}>{episode.id}</span>
                </div>
                {(episode.created_at || episode.createdAt) && (
                  <div className="info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="info-label" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Created</span>
                    <span className="info-value" style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </span>
                  </div>
                )}
                {(episode.updated_at || episode.updatedAt) && (
                  <div className="info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="info-label" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Last Updated</span>
                    <span className="info-value" style={{ fontSize: '0.875rem', color: '#1f2937' }}>
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
          <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="card-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>🎬 Episode Scenes</h2>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  ➕ Add Scene
                </button>
              </div>
              
              <div className="scenes-placeholder" style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '2px dashed #e5e7eb' }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎥</span>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>No Scenes Yet</h3>
                <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>Break down your episode into scenes for better organization</p>
                <button 
                  onClick={() => navigate(`/episodes/${episodeId}/scenes`)}
                  style={{ padding: '0.875rem 1.75rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🎬 Create First Scene
                </button>
              </div>

              {/* Scene Features Info */}
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✨ Scene Features
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e3a8a', lineHeight: '1.8' }}>
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
          <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <EpisodeWardrobe
              episodeId={episode.id}
              episodeNumber={episode.episode_number}
            />
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="card-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>📸 Episode Assets</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    ⬆️ Upload Files
                  </button>
                  <button onClick={() => navigate('/assets')} style={{ padding: '0.75rem 1.5rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' }}>
                    🗂️ Asset Manager
                  </button>
                </div>
              </div>
              
              <div className="assets-placeholder" style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '2px dashed #e5e7eb' }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🖼️</span>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>No Assets Yet</h3>
                <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>Upload images, videos, audio, and other media for this episode</p>
                <button style={{ padding: '0.875rem 1.75rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  📤 Upload First Asset
                </button>
              </div>

              {/* Asset Types Grid */}
              <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#78350f' }}>Images</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>Thumbnails, posters, stills</p>
                </div>
                <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)', borderRadius: '8px', border: '1px solid #8b5cf6' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎥</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#5b21b6' }}>Videos</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b21a8' }}>Raw footage, clips, trailers</p>
                </div>
                <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)', borderRadius: '8px', border: '1px solid #3b82f6' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎵</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#1e3a8a' }}>Audio</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af' }}>Music, voiceovers, sound FX</p>
                </div>
                <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderRadius: '8px', border: '1px solid #10b981' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#065f46' }}>Documents</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#047857' }}>Scripts, notes, subtitles</p>
                </div>
              </div>

              {/* Asset Features Info */}
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✨ Asset Management Features
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e3a8a', lineHeight: '1.8' }}>
                  <li><strong>Cloud Storage:</strong> Secure S3 storage with CDN delivery</li>
                  <li><strong>Auto Thumbnails:</strong> Automatic thumbnail generation for videos</li>
                  <li><strong>Version Control:</strong> Track changes and maintain asset history</li>
                  <li><strong>Smart Tags:</strong> Organize with custom tags and metadata</li>
                  <li><strong>Bulk Upload:</strong> Upload multiple files at once with drag & drop</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Episode Metadata Card */}
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="card-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>📊 Episode Metadata</h2>
                <button style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  ✏️ Edit Metadata
                </button>
              </div>

              {/* Metadata Fields Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Episode Number</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{episode.episode_number || 'N/A'}</div>
                </div>
                <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Status</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: episode.status === 'published' ? '#10b981' : '#f59e0b' }}>{episode.status || 'draft'}</div>
                </div>
                <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Air Date</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'Not set'}</div>
                </div>
                <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Duration</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{episode.duration ? `${episode.duration} min` : 'Not set'}</div>
                </div>
              </div>
            </div>

            {/* Raw JSON Metadata Card */}
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 className="card-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>🔧 Raw JSON Metadata</h2>
              {episode.metadata && Object.keys(episode.metadata).length > 0 ? (
                <div style={{ background: '#1f2937', padding: '1.5rem', borderRadius: '8px', overflow: 'auto', maxHeight: '400px' }}>
                  <pre style={{ margin: 0, color: '#a5f3fc', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: '1.6' }}>
                    {JSON.stringify(episode.metadata, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '2px dashed #e5e7eb' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📋</span>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>No Additional Metadata</h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>Custom metadata fields will appear here</p>
                </div>
              )}
            </div>

            {/* Metadata Features Info */}
            <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✨ Metadata Capabilities
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e3a8a', lineHeight: '1.8' }}>
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
