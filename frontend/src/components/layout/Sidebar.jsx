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
      { icon: '◈',  label: 'Universe',             route: '/universe',
        children: [
          { icon: '✦', label: 'Story Dashboard', route: '/universe?tab=story-dashboard' },
          { icon: '⬡', label: 'Franchise Brain',  route: '/universe?tab=knowledge' },
          { icon: '◇', label: 'Writing Rhythm',  route: '/universe?tab=writing-rhythm' },
        ],
      },
      { icon: '✦',  label: 'Create World',         route: '/world-studio',
        children: [
          { icon: '🌍', label: 'Character Registry', route: '/character-registry?view=world' },
          { icon: '📅', label: 'Cultural Calendar',  route: '/cultural-calendar' },
          { icon: '🎭', label: 'Influencer Systems', route: '/influencer-systems' },
          { icon: '🏙️', label: 'World Infrastructure', route: '/world-infrastructure' },
          { icon: '📱', label: 'Social Timeline',      route: '/social-timeline' },
          { icon: '🧠', label: 'Social Personality',    route: '/social-personality' },
          { icon: '🎬', label: 'Life Simulation',        route: '/character-life-simulation' },
          { icon: '📜', label: 'Cultural Memory',        route: '/cultural-memory' },
        ],
      },
      { icon: '💭', label: 'Therapy',              route: '/therapy/default' },
    ],
  },
  {
    zone: 'WRITE',
    items: [
      { icon: '⚡', label: 'Short Stories',    route: '/story-engine',
        children: [
          { icon: '📖', label: 'Story Engine',        route: '/story-engine' },
          { icon: '◈', label: 'Scene Intelligence', route: '/scene-proposer' },
          { icon: '⬡', label: 'Assembler',           route: '/assembler' },
          { icon: '◇', label: 'Continuity',           route: '/continuity' },
          { icon: '🧠', label: 'Narrative Control',   route: '/narrative-control' },
        ],
      },
      { icon: '🔥', label: 'Pressure',        route: '/pressure' },
      { icon: '▶',  label: 'Novel Session',   route: '/start' },
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
      { icon: '✦', label: 'Amber',           route: '/amber' },
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
  const [universeOpen, setUniverseOpen] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-expand Shows sub-nav when on a /shows/* route
  useEffect(() => {
    if (location.pathname.startsWith('/shows/')) setShowsOpen(true);
  }, [location.pathname]);

  // Auto-expand Universe sub-nav when on a story-side tab
  useEffect(() => {
    if (location.pathname === '/universe' && ['story-dashboard','knowledge','writing-rhythm'].includes(new URLSearchParams(location.search).get('tab'))) {
      setUniverseOpen(true);
    }
  }, [location.pathname, location.search]);

  // Auto-expand Create World sub-nav when on character-registry or relationships
  useEffect(() => {
    if (['/world-studio', '/character-registry', '/cultural-calendar', '/influencer-systems', '/world-infrastructure', '/social-timeline', '/social-personality', '/character-life-simulation', '/cultural-memory'].some(p => location.pathname.startsWith(p))) {
      setWorldOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand Short Stories sub-nav
  useEffect(() => {
    if (['/story-engine', '/scene-proposer', '/assembler', '/continuity', '/narrative-control'].some(p => location.pathname.startsWith(p))) {
      setStoriesOpen(true);
    }
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
                // ── Expandable item with static children (Universe) ──
                if (item.children) {
                  const isUniverse = item.route === '/universe';
                  const isWorld = item.route === '/world-studio';
                  const isStories = item.route === '/story-engine';
                  const groupOpen = isUniverse ? universeOpen : isWorld ? worldOpen : isStories ? storiesOpen : false;
                  const setGroupOpen = isUniverse ? setUniverseOpen : isWorld ? setWorldOpen : isStories ? setStoriesOpen : () => {};
                  const childRoutes = item.children.map(c => c.route);
                  const groupActive = isActive(item.route) || childRoutes.some(r => isActive(r));
                  const toggleOnly = isStories; // Short Stories: toggle only, no navigate
                  return (
                    <div key={item.route} className="nav-group">
                      <div
                        className={`nav-item ${groupActive ? 'active' : ''}`}
                        onClick={() => {
                          if (!toggleOnly) go(item.route);
                          setGroupOpen(o => !o);
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="nav-label">{item.label}</span>
                            <span className={`chevron ${groupOpen ? 'open' : ''}`}>›</span>
                          </>
                        )}
                      </div>

                      {groupOpen && !collapsed && (
                        <div className="nav-subgroup">
                          {item.children.map(child => (
                            <NavLink
                              key={child.route}
                              to={child.route}
                              className={({ isActive: a }) => `nav-subitem ${location.pathname + location.search === child.route ? 'active' : ''}`}
                              onClick={() => { if (onClose) onClose(); }}
                            >
                              <span className="sub-dot" />
                              <span className="subitem-label">{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

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
