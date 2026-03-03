/**
 * Sidebar.jsx — Prime Studios Navigation
 * 4 zones: WRITE · WORLD · PRODUCE · MANAGE
 * Props: isOpen (mobile drawer), onClose (close drawer)
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import showService from '../../services/showService';
import SidebarProgress from '../SidebarProgress';
import './Sidebar.css';

/* ─── Navigation map ────────────────────────────────────────── */
const NAV = [
  {
    zone: 'WORLD',
    items: [
      { icon: '◈',  label: 'Universe',             route: '/universe' },
      { icon: '📋', label: 'Registry',             route: '/character-registry' },
      { icon: '🌍', label: 'World View',           route: '/character-registry?view=world' },
      { icon: '🧬', label: 'Character Generator',  route: '/character-generator' },
      { icon: '✦',  label: 'World Studio',          route: '/world-studio' },
      { icon: '🌳', label: 'Relationships',        route: '/relationships' },
      { icon: '🛋️', label: 'Therapy',              route: '/therapy/default' },
    ],
  },
  {
    zone: 'WRITE',
    items: [
      { icon: '▶',  label: 'Start Session',   route: '/start' },
      { icon: '⚡', label: 'Story Engine',    route: '/story-engine' },
      { icon: '', label: 'Assembler',        route: '/assembler' },
      { icon: '◇',  label: 'Continuity',      route: '/continuity' },
    ],
  },
  {
    zone: 'STUDIO',
    items: [
      {
        icon: '🎬', label: 'Shows', route: '/shows',
        expandable: true,
      },
      { icon: '🎞️', label: 'Scene Library',   route: '/scene-library' },
      { icon: '🖼️', label: 'Template Studio', route: '/template-studio' },
    ],
  },
  {
    zone: 'PRODUCE',
    items: [
      { icon: '🎬', label: 'Scene Composer',  route: '/studio/scene-composer' },
      { icon: '⏱️', label: 'Timeline Editor', route: '/studio/timeline' },
    ],
  },
  {
    zone: 'MANAGE',
    items: [
      { icon: '📊', label: 'Analytics',       route: '/analytics/decisions' },
      { icon: '🔍', label: 'Search',          route: '/search' },
      { icon: '🩺', label: 'Diagnostics',     route: '/diagnostics' },
      { icon: '🗑️', label: 'Recycle Bin',     route: '/recycle-bin' },
      { icon: '⚙️', label: 'Settings',        route: '/settings' },
    ],
  },
];

/* ─── Shows hook (uses showService with auth) ───────────────── */
function useShows() {
  const [shows, setShows] = useState([]);
  useEffect(() => {
    showService.getAllShows()
      .then(data => setShows((data || []).map(s => ({
        id: s.id,
        name: s.name || s.title || 'Untitled Show',
        episodeCount: s.episodeCount || s.episode_count || 0,
      }))))
      .catch(() => setShows([]));
  }, []);
  return shows;
}

/* ─── Sidebar ───────────────────────────────────────────────── */
function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const shows = useShows();
  const [showsOpen, setShowsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-expand Shows sub-nav when on a /shows/* route
  useEffect(() => {
    if (location.pathname.startsWith('/shows/')) setShowsOpen(true);
  }, [location.pathname]);

  // Navigate and close mobile drawer
  const go = (path) => { navigate(path); if (onClose) onClose(); };

  // Active-match helper
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        {/* ── Logo / collapse toggle ── */}
        <div className="sidebar-logo">
          {!collapsed && (
            <span className="logo-text" onClick={() => go('/start')}>
              PRIME<span className="logo-accent">◈</span>
            </span>
          )}
          <div className="logo-actions">
            {/* Desktop collapse toggle */}
            <button
              className="collapse-btn"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '›' : '‹'}
            </button>
            {/* Mobile close button */}
            {onClose && (
              <button
                className="sidebar-close-btn"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close sidebar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive: a }) => `nav-item ${a ? 'active' : ''}`}
            onClick={() => { if (onClose) onClose(); }}
            title={collapsed ? 'Home' : undefined}
          >
            <span className="nav-icon">🏠</span>
            {!collapsed && <span className="nav-label">Home</span>}
          </NavLink>

          {/* Zones */}
          {NAV.map(({ zone, items }) => (
            <div className="nav-section" key={zone}>
              {!collapsed && <div className="nav-section-label">{zone}</div>}

              {items.map(item => {
                // ── Expandable Shows item ──
                if (item.expandable) {
                  const showsActive = isActive('/shows');
                  return (
                    <div key={item.route} className="nav-group">
                      <div
                        className={`nav-item ${showsActive ? 'active' : ''}`}
                        onClick={() => {
                          go(item.route);
                          setShowsOpen(o => !o);
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="nav-label">{item.label}</span>
                            <span className={`chevron ${showsOpen ? 'open' : ''}`}>›</span>
                          </>
                        )}
                      </div>

                      {/* Shows sub-list */}
                      {showsOpen && !collapsed && (
                        <div className="nav-subgroup">
                          {shows.length === 0 ? (
                            <div className="sub-empty">No shows yet</div>
                          ) : (
                            shows.map(show => (
                              <NavLink
                                key={show.id}
                                to={`/shows/${show.id}`}
                                className={({ isActive: a }) => `nav-subitem ${a ? 'active' : ''}`}
                                onClick={() => { if (onClose) onClose(); }}
                              >
                                <span className="sub-dot" />
                                <span className="subitem-label">{show.name}</span>
                                <span className="subitem-count">{show.episodeCount}</span>
                              </NavLink>
                            ))
                          )}
                          <NavLink
                            to="/shows/create"
                            className="sub-create"
                            onClick={() => { if (onClose) onClose(); }}
                          >
                            + New Show
                          </NavLink>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Standard nav item ──
                return (
                  <NavLink
                    key={item.route}
                    to={item.route}
                    end={item.route === '/episodes'}
                    className={({ isActive: a }) => `nav-item ${a ? 'active' : ''}`}
                    onClick={() => { if (onClose) onClose(); }}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!collapsed && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Setup Progress ── */}
        <SidebarProgress showId={shows[0]?.id} collapsed={collapsed} />

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          <div className="user-info" onClick={() => go('/settings')}>
            <div className="user-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            {!collapsed && (
              <div className="user-details">
                <div className="user-name">{user?.name || user?.email?.split('@')[0] || 'Creator'}</div>
                <div className="user-status">Creator</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
