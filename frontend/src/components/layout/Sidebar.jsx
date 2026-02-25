// frontend/src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import showService from '../../services/showService';
import { episodeService } from '../../services/episodeService';
import './Sidebar.css';

/**
 * Sidebar — 4-zone navigation
 *
 *   WRITE   — Start Session, Write (Book Editor), Timeline
 *   WORLD   — Universe, Characters, Therapy Room, The Press, Relationships
 *   PRODUCE — Shows (dynamic), Wardrobe, Scene Library, Template Studio
 *   MANAGE  — Asset Library, Analytics, Search, Admin, Settings
 */

/* ─── Navigation map ────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: 'WRITE',
    items: [
      { icon: '\u25B6',  label: 'Start Session', path: '/start' },
      { icon: '\u270E',  label: 'Write',         path: '/storyteller' },
      { icon: '\u25C7',  label: 'Timeline',      path: '/continuity' },
    ],
  },
  {
    label: 'WORLD',
    items: [
      { icon: '\u25C8',  label: 'Universe',       path: '/universe' },
      { icon: '\uD83D\uDC64', label: 'Characters',     path: '/character-registry' },
      { icon: '\uD83D\uDECB\uFE0F', label: 'Therapy Room',   path: '/therapy/default' },
      { icon: '\uD83D\uDCF0', label: 'The Press',      path: '/press' },
      { icon: '\uD83D\uDD17', label: 'Relationships',  path: '/relationships' },
    ],
  },
];

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [shows, setShows] = useState([]);
  const [showsExpanded, setShowsExpanded] = useState(true);
  const [currentShowId, setCurrentShowId] = useState(null);

  useEffect(() => { loadShows(); }, []);

  // Detect parent show from episode routes
  useEffect(() => {
    const checkEpisodeRoute = async () => {
      const match = location.pathname.match(/\/episodes\/([^/]+)/);
      if (match && match[1] !== 'create') {
        try {
          const episode = await episodeService.getEpisode(match[1]);
          if (episode?.show_id || episode?.showId) {
            setCurrentShowId(episode.show_id || episode.showId);
            setShowsExpanded(true);
          }
        } catch (err) {
          console.error('Failed to get episode for sidebar:', err);
        }
      } else {
        const showMatch = location.pathname.match(/\/shows\/([^/]+)/);
        setCurrentShowId(showMatch ? showMatch[1] : null);
      }
    };
    checkEpisodeRoute();
  }, [location.pathname]);

  const loadShows = async () => {
    try {
      const data = await showService.getAllShows();
      setShows(data.map(s => ({
        id: s.id,
        name: s.name || s.title || 'Untitled Show',
        episodeCount: s.episodeCount || s.episode_count || s.episodes?.length || 0,
      })));
    } catch (e) {
      console.error('Error loading shows:', e);
      setShows([]);
    }
  };

  /* helpers */
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path);
  const go = (path) => { navigate(path); if (onClose) onClose(); };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* ── Logo ── */}
        <div className="sidebar-logo" onClick={() => go('/')}>
          <span className="logo-icon">🎬</span>
          <div className="logo-text">
            <div className="logo-title">Creative Engine</div>
            <div className="logo-subtitle">by LaLa</div>
          </div>
          {onClose && (
            <button className="sidebar-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close sidebar">
              ✕
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {/* Home */}
          <button className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => go('/')}>
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </button>

          {/* Static sections — WRITE / WORLD */}
          {NAV_SECTIONS.map(section => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => go(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}

          {/* ── PRODUCE — Shows (dynamic) ── */}
          <div className="nav-section">
            <div className="nav-section-label">PRODUCE</div>

            <div className="nav-group">
              <button
                className={`nav-item ${isActive('/shows') ? 'active' : ''}`}
                onClick={() => {
                  setShowsExpanded(prev => !prev);
                  if (!showsExpanded) go('/shows');
                }}
              >
                <span className="nav-icon">🎬</span>
                <span className="nav-label">Shows</span>
                <span className={`expand-icon ${showsExpanded ? 'expanded' : ''}`}>▼</span>
              </button>

              {showsExpanded && (
                <div className="nav-subgroup">
                  <button
                    className={`nav-subitem ${location.pathname === '/shows' ? 'active' : ''}`}
                    onClick={() => go('/shows')}
                  >
                    <span className="subitem-indicator">└─</span>
                    <span className="subitem-label">All Shows</span>
                  </button>
                  {shows.map(show => (
                    <button
                      key={show.id}
                      className={`nav-subitem ${isActive(`/shows/${show.id}`) || currentShowId === show.id ? 'active' : ''}`}
                      onClick={() => go(`/shows/${show.id}`)}
                    >
                      <span className="subitem-indicator">└─</span>
                      <span className="subitem-label">{show.name}</span>
                      <span className="subitem-count">{show.episodeCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode Workspace */}
            <button className={`nav-item ${isActive('/episodes') && !location.pathname.match(/\/episodes\/[^/]/) ? 'active' : ''}`} onClick={() => go('/episodes')}>
              <span className="nav-icon">📂</span>
              <span className="nav-label">Episodes</span>
            </button>

            {/* Wardrobe */}
            <button className={`nav-item ${isActive('/wardrobe') ? 'active' : ''}`} onClick={() => go('/wardrobe')}>
              <span className="nav-icon">{'\uD83D\uDC57'}</span>
              <span className="nav-label">Wardrobe</span>
            </button>

            {/* Scene Library */}
            <button className={`nav-item ${isActive('/scene-library') ? 'active' : ''}`} onClick={() => go('/scene-library')}>
              <span className="nav-icon">{'\uD83C\uDFAC'}</span>
              <span className="nav-label">Scene Library</span>
            </button>

            {/* Template Studio */}
            <button className={`nav-item ${isActive('/template-studio') ? 'active' : ''}`} onClick={() => go('/template-studio')}>
              <span className="nav-icon">{'\uD83D\uDDBC\uFE0F'}</span>
              <span className="nav-label">Template Studio</span>
            </button>
          </div>

          {/* ── MANAGE ── */}
          <div className="nav-section">
            <div className="nav-section-label">MANAGE</div>
            <button className={`nav-item ${isActive('/assets') ? 'active' : ''}`} onClick={() => go('/assets')}>
              <span className="nav-icon">{'\uD83D\uDCC1'}</span>
              <span className="nav-label">Asset Library</span>
            </button>
            <button className={`nav-item ${isActive('/analytics') ? 'active' : ''}`} onClick={() => go('/analytics/decisions')}>
              <span className="nav-icon">{'\uD83D\uDCCA'}</span>
              <span className="nav-label">Analytics</span>
            </button>
            <button className={`nav-item ${isActive('/search') ? 'active' : ''}`} onClick={() => go('/search')}>
              <span className="nav-icon">{'\uD83D\uDD0D'}</span>
              <span className="nav-label">Search</span>
            </button>
            <button className={`nav-item ${isActive('/diagnostics') ? 'active' : ''}`} onClick={() => go('/diagnostics')}>
              <span className="nav-icon">{'\uD83E\uDE7A'}</span>
              <span className="nav-label">Diagnostics</span>
            </button>
            <button
              className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => go('/settings')}
            >
              <span className="nav-icon">{'\u2699\uFE0F'}</span>
              <span className="nav-label">Settings</span>
            </button>
          </div>
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{user?.name || user?.email?.split('@')[0] || 'Creator'}</div>
              <div className="user-status">Creator</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
