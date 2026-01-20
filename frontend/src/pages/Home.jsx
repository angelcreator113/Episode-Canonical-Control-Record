import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
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
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/episodes?limit=100`);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const text = await response.text();
      if (!text) throw new Error('Empty response from server');

      const data = JSON.parse(text);

      if (data.data) {
        const episodes = data.data;

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
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats({ total: 0, draft: 0, published: 0, inProgress: 0 });
      setRecentEpisodes([]);
    } finally {
      setLoading(false);
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
              ➕ New Episode
            </Link>
            <Link to="/composer/default" className="btn btn-secondary">
              🎨 Composer
            </Link>
            <Link to="/assets" className="btn btn-ghost">
              📸 Assets
            </Link>
          </div>
        </div>

        {/* Stats */}
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
      </header>

      {/* Main Grid */}
      <main className="dashboard-grid">
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

        {/* Right Rail */}
        <aside className="right-rail">
          {/* Quick Actions */}
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Quick Actions</h2>
              <p className="panel-subtitle">Jump in fast.</p>
            </div>

            <div className="quick-grid">
              <Link to="/episodes/create" className="quick-card primary">
                <div className="quick-icon">➕</div>
                <div className="quick-text">
                  <div className="quick-title">Create Episode</div>
                  <div className="quick-sub">Start a new episode</div>
                </div>
              </Link>

              <Link to="/composer/default" className="quick-card">
                <div className="quick-icon">🎨</div>
                <div className="quick-text">
                  <div className="quick-title">Thumbnail Composer</div>
                  <div className="quick-sub">Design visuals</div>
                </div>
              </Link>

              <Link to="/assets" className="quick-card">
                <div className="quick-icon">📸</div>
                <div className="quick-text">
                  <div className="quick-title">Asset Manager</div>
                  <div className="quick-sub">Upload & organize</div>
                </div>
              </Link>

              <Link to="/wardrobe" className="quick-card">
                <div className="quick-icon">👗</div>
                <div className="quick-text">
                  <div className="quick-title">Wardrobe</div>
                  <div className="quick-sub">Browse outfits</div>
                </div>
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
                <div className="shortcut-title">🖼️ Thumbnails</div>
                <div className="shortcut-links">
                  <Link to="/composer/default">Composer</Link>
                  <Link to="/assets">Asset Library</Link>
                </div>
              </div>

              <div className="shortcut-group">
                <div className="shortcut-title">👗 Wardrobe</div>
                <div className="shortcut-links">
                  <Link to="/wardrobe">Gallery</Link>
                  <Link to="/wardrobe/analytics">Analytics</Link>
                  <Link to="/wardrobe/outfits">Outfit Sets</Link>
                </div>
              </div>

              {(user?.role === 'admin' || user?.groups?.includes('ADMIN')) && (
                <div className="shortcut-group">
                  <div className="shortcut-title">⚙️ Admin</div>
                  <div className="shortcut-links">
                    <Link to="/admin">Admin Panel</Link>
                    <Link to="/admin/templates">Templates</Link>
                    <Link to="/audit-log">Audit Log</Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Getting started (only if empty library) */}
          {stats.total === 0 && (
            <section className="panel getting-started">
              <div className="panel-header">
                <h2 className="panel-title">🚀 Getting Started</h2>
                <p className="panel-subtitle">A clean path to your first publish.</p>
              </div>

              <ol className="steps">
                <li>
                  <strong>Create your first episode</strong>
                  <span>Add metadata and details</span>
                </li>
                <li>
                  <strong>Upload assets</strong>
                  <span>Thumbnails and promo images</span>
                </li>
                <li>
                  <strong>Design thumbnails</strong>
                  <span>Use the Composer</span>
                </li>
                <li>
                  <strong>Track wardrobe</strong>
                  <span>Outfits and styling history</span>
                </li>
              </ol>

              <Link to="/episodes/create" className="btn btn-primary full">
                ➕ Create First Episode
              </Link>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
};

export default Home;
