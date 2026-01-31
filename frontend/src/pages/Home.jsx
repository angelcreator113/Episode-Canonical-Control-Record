import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import { wardrobeLibraryService } from '../services/wardrobeLibraryService';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0,
    inProgress: 0
  });
  const [wardrobeStats, setWardrobeStats] = useState({
    total: 0,
    items: 0,
    sets: 0,
    recentUploads: 0
  });
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [recentThumbnails, setRecentThumbnails] = useState([]);
  const [recentAssets, setRecentAssets] = useState([]);
  const [recentCompositions, setRecentCompositions] = useState([]);
  const [shows, setShows] = useState([]);
  const [nextActions, setNextActions] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUtilityPanels, setShowUtilityPanels] = useState({
    thumbnails: false,
    assets: false
  });
  const [onboardingProgress, setOnboardingProgress] = useState({
    episodeCreated: false,
    assetsUploaded: false,
    thumbnailDesigned: false,
    wardrobeAdded: false,
  });

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadStats(),
      loadWardrobeStats(),
      loadRecentThumbnails(),
      loadRecentAssets(),
      loadRecentCompositions(),
      loadShows(),
      loadActivityFeed(),
    ]);
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/episodes?limit=100`);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const text = await response.text();
      if (!text) throw new Error('Empty response from server');

      const data = JSON.parse(text);

      const episodes = data.data || [];

      if (episodes.length > 0) {
        const draft = episodes.filter((e) => (e.status || '').toLowerCase() === 'draft').length;
        const published = episodes.filter((e) => (e.status || '').toLowerCase() === 'published').length;
        const inProgress = episodes.filter((e) => {
          const status = (e.status || '').toLowerCase();
          return status === 'in_progress' || status === 'in progress';
        }).length;

        setStats({
          total: episodes.length,
          draft,
          published,
          inProgress
        });

        const sorted = [...episodes].sort(
          (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
        setRecentEpisodes(sorted.slice(0, 5));
      } else {
        setStats({ total: 0, draft: 0, published: 0, inProgress: 0 });
        setRecentEpisodes([]);
      }
      
      // Calculate next actions and onboarding progress
      calculateNextActions(episodes);
      updateOnboardingProgress(episodes);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats({ total: 0, draft: 0, published: 0, inProgress: 0 });
      setRecentEpisodes([]);
    }
  };

  const updateOnboardingProgress = (episodes) => {
    const progress = {
      episodeCreated: episodes.length > 0,
      assetsUploaded: recentAssets.length > 0,
      thumbnailDesigned: recentThumbnails.length > 0,
      wardrobeAdded: wardrobeStats.items > 0,
    };
    setOnboardingProgress(progress);
  };

  const loadRecentThumbnails = async () => {
    try {
      const response = await fetch(`${API_URL}/compositions?limit=3`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentThumbnails(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load thumbnails:', error);
    }
  };

  const loadRecentAssets = async () => {
    try {
      const response = await fetch(`${API_URL}/assets?limit=4&sort=created_at:desc`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentAssets(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };

  const loadRecentCompositions = async () => {
    try {
      const response = await fetch(`${API_URL}/compositions?limit=3`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentCompositions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load compositions:', error);
    }
  };

  const loadShows = async () => {
    try {
      const response = await fetch(`${API_URL}/shows`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setShows(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load shows:', error);
    }
  };

  const loadActivityFeed = async () => {
    try {
      // Combine recent activities from multiple sources
      const activities = [];
      
      // Recent episode updates
      if (recentEpisodes.length > 0) {
        recentEpisodes.slice(0, 3).forEach(ep => {
          activities.push({
            type: 'episode',
            icon: '📺',
            message: `Episode "${ep.title || 'Untitled'}" updated`,
            time: new Date(ep.updatedAt || ep.createdAt),
            link: `/episodes/${ep.id}`
          });
        });
      }
      
      // Recent wardrobe uploads
      if (wardrobeStats.recentUploads > 0) {
        activities.push({
          type: 'wardrobe',
          icon: '👗',
          message: `${wardrobeStats.recentUploads} new wardrobe items added`,
          time: new Date(),
          link: '/wardrobe'
        });
      }
      
      // Sort by time
      activities.sort((a, b) => b.time - a.time);
      setActivityFeed(activities.slice(0, 5));
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    }
  };

  const calculateNextActions = (episodes) => {
    const actions = [];
    
    // Episodes without thumbnails
    const episodesWithoutThumbnails = episodes.filter(ep => 
      !ep.thumbnail_url && ep.status !== 'draft'
    );
    if (episodesWithoutThumbnails.length > 0) {
      actions.push({
        type: 'warning',
        icon: '🎨',
        title: `${episodesWithoutThumbnails.length} episodes need thumbnails`,
        subtitle: 'Generate thumbnails to complete episodes',
        link: '/composer/default',
        cta: 'Compose'
      });
    }
    
    // Incomplete episodes
    const incompleteEpisodes = episodes.filter(ep => 
      !ep.description || !ep.title || ep.status === 'draft'
    );
    if (incompleteEpisodes.length > 0) {
      actions.push({
        type: 'info',
        icon: '📝',
        title: `${incompleteEpisodes.length} episodes incomplete`,
        subtitle: 'Add metadata and details',
        link: '/episodes',
        cta: 'Review'
      });
    }
    
    // Admin: Pending approvals (placeholder)
    if (user?.role === 'admin' || user?.groups?.includes('ADMIN')) {
      // This would need backend support for pending approvals count
      actions.push({
        type: 'urgent',
        icon: '✅',
        title: 'Check pending approvals',
        subtitle: 'Review assets and compositions',
        link: '/admin',
        cta: 'Review'
      });
    }
    
    setNextActions(actions);
  };

  const loadWardrobeStats = async () => {
    try {
      const data = await wardrobeLibraryService.getStats();
      if (data) {
        setWardrobeStats(data);
      }
    } catch (error) {
      console.error('Failed to load wardrobe stats:', error);
      setWardrobeStats({ total: 0, items: 0, sets: 0, recentUploads: 0 });
    }
  };

  const greetingName = user?.username || user?.name || '';

  const statusLabel = (status) => {
    const s = (status || 'draft').toLowerCase();
    if (s === 'published') return 'Published';
    if (s === 'draft') return 'Draft';
    if (s === 'in_progress' || s === 'in progress') return 'In Progress';
    return status || 'Draft';
  };

  const statusClass = (status) => {
    const s = (status || 'draft').toLowerCase();
    if (s === 'published') return 'published';
    if (s === 'draft') return 'draft';
    if (s === 'in_progress' || s === 'in progress') return 'in-progress';
    return 'draft';
  };

  if (loading) {
    return (
      <div className="home-page-modern loading">
        <div className="spinner"></div>
        <div className="loading-text">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="home-page-modern">
      {/* Dashboard Header */}
      <header className="dashboard-hero">
        <div className="dashboard-hero-inner">
          <div className="hero-left">
            <div className="hero-eyebrow">Episode Control</div>
            <h1 className="hero-title">
              Dashboard{greetingName ? <span className="hero-greeting"> · Hi, {greetingName}</span> : null}
            </h1>
            <p className="hero-subtitle">
              A premium overview of your episodes, thumbnails, assets, and wardrobe.
            </p>
          </div>

          <div className="hero-actions">
            <Link to="/episodes/create" className="btn btn-primary">
              <span className="btn-icon" aria-hidden="true">➕</span>
              <span className="btn-label">New Episode</span>
            </Link>
            <Link to="/composer/default" className="btn btn-secondary">
              <span className="btn-icon" aria-hidden="true">🎨</span>
              <span className="btn-label">Composer</span>
            </Link>
            <Link to="/assets" className="btn btn-ghost">
              <span className="btn-icon" aria-hidden="true">📸</span>
              <span className="btn-label">Assets</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid - 2 columns */}
        <div className="hero-stats-wrapper">
          {/* Episode Stats */}
          <section className="stats-strip">
            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">📺</span>
                <span className="stat-name">Total Episodes</span>
              </div>
              <div className="stat-number">{stats.total}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">✅</span>
                <span className="stat-name">Published</span>
              </div>
              <div className="stat-number">{stats.published}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">🎬</span>
                <span className="stat-name">In Progress</span>
              </div>
              <div className="stat-number">{stats.inProgress}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">📝</span>
                <span className="stat-name">Draft</span>
              </div>
              <div className="stat-number">{stats.draft}</div>
            </div>
          </section>

          {/* Wardrobe Stats */}
          <section className="stats-strip wardrobe-stats">
            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">👗</span>
                <span className="stat-name">Wardrobe Items</span>
              </div>
              <div className="stat-number">{wardrobeStats.total}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">👕</span>
                <span className="stat-name">Individual Items</span>
              </div>
              <div className="stat-number">{wardrobeStats.items}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">👔</span>
                <span className="stat-name">Outfit Sets</span>
              </div>
              <div className="stat-number">{wardrobeStats.sets}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-top">
                <span className="stat-emoji">⬆️</span>
                <span className="stat-name">Recent Uploads</span>
              </div>
              <div className="stat-number">{wardrobeStats.recentUploads}</div>
            </div>
          </section>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Main Content Column */}
        <div className="main-column">
          {/* Next Actions Panel */}
          {nextActions.length > 0 && (
            <section className="panel next-actions-panel">
              <div className="panel-header">
                <h2 className="panel-title">⚡ Next Actions</h2>
                <p className="panel-subtitle">What needs your attention</p>
              </div>
              
              <div className="next-actions-list">
                {nextActions.map((action, idx) => (
                  <div key={idx} className={`action-item action-${action.type}`}>
                    <span className="action-icon">{action.icon}</span>
                    <div className="action-text">
                      <strong>{action.title}</strong>
                      <span>{action.subtitle}</span>
                    </div>
                    <Link to={action.link} className="action-btn">
                      {action.cta} →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Episodes */}
          <section className="panel panel-lg">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Recent Episodes</h2>
                <p className="panel-subtitle">Your latest updates and what to work on next.</p>
              </div>
              <Link to="/episodes" className="panel-link">
                View all →
              </Link>
            </div>

            {recentEpisodes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📺</div>
                <h3>No episodes yet</h3>
                <p>Create your first episode to start building your library.</p>
                <Link to="/episodes/create" className="btn btn-primary">
                  ➕ Create Episode
                </Link>
              </div>
            ) : (
              <div className="recent-list">
                {recentEpisodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="recent-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/episodes/${episode.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigate(`/episodes/${episode.id}`);
                    }}
                  >
                    <div className="recent-main">
                      <div className="recent-title">
                        {episode.episodeTitle || episode.title || 'Untitled'}
                      </div>

                      <div className="recent-meta">
                        {episode.episodeNumber ? <span className="meta-pill">Ep {episode.episodeNumber}</span> : null}
                        {episode.season ? <span className="meta-pill">Season {episode.season}</span> : null}
                        <span className={`status-chip ${statusClass(episode.status)}`}>
                          {statusLabel(episode.status)}
                        </span>
                      </div>

                      {episode.description ? (
                        <div className="recent-desc">
                          {episode.description.length > 140
                            ? `${episode.description.substring(0, 140)}…`
                            : episode.description}
                        </div>
                      ) : (
                        <div className="recent-desc muted">No description yet.</div>
                      )}
                    </div>

                    <div className="recent-cta">Open →</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Utility Panel - Compact & Collapsible */}
          {(recentThumbnails.length > 0 || recentAssets.length > 0) && (
            <section className="panel utility-panel">
              <div className="panel-header">
                <div>
                  <h3 className="utility-title">🔧 Recent Utilities</h3>
                  <p className="utility-subtitle">Quick reference for thumbnails and assets</p>
                </div>
              </div>

              <div className="utility-sections">
                {/* Recent Thumbnails */}
                {recentThumbnails.length > 0 && (
                  <div className="utility-section">
                    <button 
                      className="utility-section-header"
                      onClick={() => setShowUtilityPanels(prev => ({ ...prev, thumbnails: !prev.thumbnails }))}
                      aria-expanded={showUtilityPanels.thumbnails}
                    >
                      <span className="utility-section-title">
                        <span className="utility-icon">🎬</span>
                        Recent Thumbnails ({recentThumbnails.length})
                      </span>
                      <span className="utility-toggle">{showUtilityPanels.thumbnails ? '▼' : '▶'}</span>
                    </button>
                    
                    {showUtilityPanels.thumbnails && (
                      <div className="utility-content">
                        <div className="thumbnails-grid-compact">
                          {recentThumbnails.map((thumb) => (
                            <Link 
                              key={thumb.id} 
                              to={`/compositions/${thumb.id}`}
                              className="thumbnail-card-compact"
                            >
                              <div className="thumbnail-preview-compact">
                                {thumb.thumbnail_url ? (
                                  <img src={thumb.thumbnail_url} alt={thumb.composition_name || 'Thumbnail'} />
                                ) : (
                                  <div className="thumbnail-placeholder">🎨</div>
                                )}
                              </div>
                              <div className="thumbnail-info-compact">
                                <div className="thumbnail-name-compact">{thumb.composition_name || 'Untitled'}</div>
                                <span className={`status-dot status-${thumb.approval_status}`}></span>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <Link to="/library" className="utility-view-all">
                          View all thumbnails →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Assets */}
                {recentAssets.length > 0 && (
                  <div className="utility-section">
                    <button 
                      className="utility-section-header"
                      onClick={() => setShowUtilityPanels(prev => ({ ...prev, assets: !prev.assets }))}
                      aria-expanded={showUtilityPanels.assets}
                    >
                      <span className="utility-section-title">
                        <span className="utility-icon">📸</span>
                        Recent Assets ({recentAssets.length})
                      </span>
                      <span className="utility-toggle">{showUtilityPanels.assets ? '▼' : '▶'}</span>
                    </button>
                    
                    {showUtilityPanels.assets && (
                      <div className="utility-content">
                        <div className="assets-grid-compact">
                          {recentAssets.map((asset) => (
                            <Link key={asset.id} to={`/assets/${asset.id}`} className="asset-card-compact">
                              <div className="asset-preview-compact">
                                {asset.s3_url_processed || asset.s3_url_raw ? (
                                  <img 
                                    src={asset.metadata?.thumbnail_url || asset.s3_url_processed || asset.s3_url_raw} 
                                    alt={asset.name || 'Asset'} 
                                  />
                                ) : (
                                  <div className="asset-placeholder">📄</div>
                                )}
                              </div>
                              <div className="asset-info-compact">
                                <div className="asset-name-compact">{asset.name || 'Untitled'}</div>
                                <span className="asset-role-compact">{asset.asset_role || 'General'}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <Link to="/assets" className="utility-view-all">
                          View all assets →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Activity Feed */}
          {activityFeed.length > 0 && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">📋 Recent Activity</h2>
                <p className="panel-subtitle">What's been happening</p>
              </div>
              
              <div className="activity-feed">
                {activityFeed.map((activity, idx) => (
                  <Link key={idx} to={activity.link} className="activity-item">
                    <span className="activity-icon">{activity.icon}</span>
                    <div className="activity-content">
                      <div className="activity-message">{activity.message}</div>
                      <div className="activity-time">
                        {new Date(activity.time).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Rail */}
        <aside className="right-rail">
          {/* Quick Actions - Compact */}
          <section className="panel quick-actions-compact">
            <div className="panel-header">
              <h2 className="panel-title">Quick Actions</h2>
            </div>

            <div className="quick-actions-list">
              <Link to="/episodes/create" className="quick-action-item primary">
                <span className="quick-action-icon">➕</span>
                <span className="quick-action-label">Create Episode</span>
              </Link>

              <Link to="/composer/default" className="quick-action-item">
                <span className="quick-action-icon">🎨</span>
                <span className="quick-action-label">Thumbnail Composer</span>
              </Link>

              <Link to="/assets" className="quick-action-item">
                <span className="quick-action-icon">📸</span>
                <span className="quick-action-label">Asset Manager</span>
              </Link>

              <Link to="/wardrobe" className="quick-action-item">
                <span className="quick-action-icon">👗</span>
                <span className="quick-action-label">Wardrobe</span>
              </Link>
            </div>
          </section>

          {/* Feature Shortcuts */}
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Shortcuts</h2>
              <p className="panel-subtitle">Everything, organized.</p>
            </div>

            <div className="shortcut-list">
              <div className="shortcut-group">
                <div className="shortcut-title">📺 Episodes</div>
                <div className="shortcut-links">
                  <Link to="/episodes">Browse</Link>
                  <Link to="/episodes/create">Create</Link>
                  <Link to="/search">Search</Link>
                </div>
              </div>

              <div className="shortcut-group">
                <div className="shortcut-title">🎬 Shows</div>
                <div className="shortcut-links">
                  <Link to="/shows">Manage</Link>
                  <Link to="/shows/create">Create</Link>
                </div>
              </div>

              <div className="shortcut-group">
                <div className="shortcut-card-title">Thumbnails</div>
                <div className="shortcut-card-links">
                  <Link to="/composer/default">Composer</Link>
                  <Link to="/assets">Assets</Link>
                </div>
              </div>

              <div className="shortcut-card">
                <div className="shortcut-card-icon">👗</div>
                <div className="shortcut-card-title">Wardrobe</div>
                <div className="shortcut-card-links">
                  <Link to="/wardrobe">Gallery</Link>
                  <Link to="/wardrobe/analytics">Analytics</Link>
                </div>
              </div>

              {(user?.role === 'admin' || user?.groups?.includes('ADMIN')) && (
                <div className="shortcut-card">
                  <div className="shortcut-card-icon">⚙️</div>
                  <div className="shortcut-card-title">Admin</div>
                  <div className="shortcut-card-links">
                    <Link to="/admin">Panel</Link>
                    <Link to="/admin/templates">Templates</Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Show Management Panel */}
          {shows.length > 0 && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">🎬 Shows</h2>
                  <p className="panel-subtitle">Active show management</p>
                </div>
                <Link to="/shows" className="panel-link">
                  Manage →
                </Link>
              </div>
              
              <div className="shows-list">
                {shows.slice(0, 3).map((show) => (
                  <Link key={show.id} to={`/episodes?show=${show.id}`} className="show-item">
                    <span className="show-icon">{show.icon || '📺'}</span>
                    <div className="show-info">
                      <div className="show-name">{show.name}</div>
                      <div className="show-meta">
                        {show.episode_count || 0} episodes
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent Compositions */}
          {recentCompositions.length > 0 && (
            <section className="panel template-studio-preview">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">🎨 Template Studio</h2>
                  <p className="panel-subtitle">Recent compositions {recentCompositions.length > 5 && '(last 5)'}</p>
                </div>
                <Link to="/library" className="panel-link">
                  Library →
                </Link>
              </div>
              
              <div className="compositions-list">
                {recentCompositions.slice(0, 5).map((comp) => (
                  <Link key={comp.id} to={`/compositions/${comp.id}`} className="composition-item">
                    <div className="composition-icon">🎬</div>
                    <div className="composition-info">
                      <div className="composition-name">{comp.composition_name || 'Untitled'}</div>
                      <div className="composition-meta">
                        <span className={`status-dot status-${comp.approval_status}`}></span>
                        {comp.version && <span>v{comp.version}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {recentCompositions.length > 5 && (
                <Link to="/library" className="view-all-cta">
                  → View all in Library
                </Link>
              )}
            </section>
          )}

          {/* Admin Section */}
          {(user?.role === 'admin' || user?.groups?.includes('ADMIN')) && (
            <section className="panel admin-panel">
              <div className="panel-header">
                <h2 className="panel-title">⚙️ Admin Dashboard</h2>
                <p className="panel-subtitle">System management</p>
              </div>
              
              <div className="admin-grid">
                <Link to="/admin" className="admin-card">
                  <div className="admin-icon">🔧</div>
                  <div className="admin-label">Admin Panel</div>
                </Link>
                <Link to="/admin/templates" className="admin-card">
                  <div className="admin-icon">📄</div>
                  <div className="admin-label">Templates</div>
                </Link>
                <Link to="/audit-log" className="admin-card">
                  <div className="admin-icon">📊</div>
                  <div className="admin-label">Audit Log</div>
                </Link>
                <Link to="/assets" className="admin-card">
                  <div className="admin-icon">✅</div>
                  <div className="admin-label">Approvals</div>
                </Link>
              </div>
            </section>
          )}

          {/* Getting started with progress tracking */}
          {stats.total === 0 && (
            <section className="panel getting-started-enhanced">
              <div className="panel-header">
                <h2 className="panel-title">🚀 Getting Started</h2>
                <p className="panel-subtitle">A clean path to your first publish.</p>
              </div>

              {/* Progress Indicator */}
              <div className="onboarding-progress">
                <div className="progress-label">
                  Setup Progress: {Object.values(onboardingProgress).filter(Boolean).length} of 4 complete
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(Object.values(onboardingProgress).filter(Boolean).length / 4) * 100}%` }}
                  />
                </div>
              </div>

              <ol className="steps-enhanced">
                <li className={onboardingProgress.episodeCreated ? 'step-complete' : ''}>
                  <span className="step-icon">{onboardingProgress.episodeCreated ? '✓' : '1'}</span>
                  <div className="step-content">
                    <strong>Create your first episode</strong>
                    <span>Add metadata and details</span>
                  </div>
                </li>
                <li className={onboardingProgress.assetsUploaded ? 'step-complete' : ''}>
                  <span className="step-icon">{onboardingProgress.assetsUploaded ? '✓' : '2'}</span>
                  <div className="step-content">
                    <strong>Upload assets</strong>
                    <span>Thumbnails and promo images</span>
                  </div>
                </li>
                <li className={onboardingProgress.thumbnailDesigned ? 'step-complete' : ''}>
                  <span className="step-icon">{onboardingProgress.thumbnailDesigned ? '✓' : '3'}</span>
                  <div className="step-content">
                    <strong>Design thumbnails</strong>
                    <span>Use the Composer</span>
                  </div>
                </li>
                <li className={onboardingProgress.wardrobeAdded ? 'step-complete' : ''}>
                  <span className="step-icon">{onboardingProgress.wardrobeAdded ? '✓' : '4'}</span>
                  <div className="step-content">
                    <strong>Track wardrobe</strong>
                    <span>Outfits and styling history</span>
                  </div>
                </li>
              </ol>

              <Link 
                to={!onboardingProgress.episodeCreated ? '/episodes/create' : !onboardingProgress.thumbnailDesigned ? '/composer' : '/episodes'} 
                className="btn btn-primary full"
              >
                {!onboardingProgress.episodeCreated ? '➕ Create First Episode' : 
                 !onboardingProgress.thumbnailDesigned ? '🎨 Design First Thumbnail' : 
                 '📋 View All Episodes'}
              </Link>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
};

export default Home;
