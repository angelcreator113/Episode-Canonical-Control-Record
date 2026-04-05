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
function buildNav(shows) {
  const showId = shows[0]?.id;
  const showName = shows[0]?.name || 'Show';

  return [
    {
      zone: 'FRANCHISE',
      items: [
        { icon: '◈', label: 'LalaVerse', route: '/universe' },
        { icon: '🧠', label: 'Show Brain', route: '/intelligence/show-brain' },
        { icon: '⬡', label: 'Franchise Brain', route: '/intelligence/franchise-brain' },
      ],
    },
    {
      zone: 'CREATE SHOW',
      items: [
        { icon: '🎞️', label: 'Scene Sets', route: '/scene-library' },
        ...(showId ? [
          { icon: '📅', label: 'Producer Mode', route: `/shows/${showId}/world?tab=events` },
        ] : []),
        { icon: '🎬', label: 'Shows', route: '/shows', expandable: true },
      ],
    },
    {
      zone: 'WORLD BUILDING',
      items: [
        { icon: '📜', label: 'World State', route: '/universe/world-state' },
        { icon: '📍', label: 'World Locations', route: '/world-locations' },
        { icon: '📅', label: 'Cultural Calendar', route: '/cultural-calendar' },
        { icon: '📜', label: 'Cultural Memory', route: '/cultural-memory' },
        { icon: '🏗️', label: 'Infrastructure', route: '/world-infrastructure' },
        { icon: '⭐', label: 'Influencer Systems', route: '/influencer-systems' },
      ],
    },
    {
      zone: 'WRITE',
      items: [
        { icon: '✦', label: 'Storyteller', route: '/storyteller' },
        { icon: '⚡', label: 'Short Stories', route: '/story-engine' },
        { icon: '🌍', label: 'Characters', route: '/character-registry?view=world' },
        { icon: '🔗', label: 'Relationships', route: '/world-studio?tab=relationships' },
        { icon: '◇', label: 'Continuity', route: '/continuity' },
        { icon: '🧠', label: 'Narrative Control', route: '/narrative-control' },
        { icon: '▶', label: 'Novel Session', route: '/start' },
        { icon: '📰', label: 'Press', route: '/press' },
      ],
    },
    {
      zone: 'STUDIO',
      items: [
        { icon: '🎨', label: 'Scene Studio', route: '/scene-library' },
        { icon: '⏱️', label: 'Timeline Editor', route: '/studio/timeline' },
        { icon: '📂', label: 'Assets', route: '/assets' },
        { icon: '📦', label: 'Compositions', route: '/library' },
      ],
    },
    {
      zone: 'MANAGE',
      items: [
        { icon: '💵', label: 'CFO Agent', route: '/cfo',
          children: [
            { icon: '📊', label: 'Analytics', route: '/analytics/decisions' },
            { icon: '💰', label: 'AI Costs', route: '/ai-costs' },
          ],
        },
        { icon: '🗺️', label: 'Site Organizer', route: '/site-organizer' },
        { icon: '🎨', label: 'Design Agent', route: '/design-agent' },
        { icon: '🔍', label: 'Search', route: '/search' },
        { icon: '🛡️', label: 'Admin', route: '/admin',
          children: [
            { icon: '📋', label: 'Audit Log', route: '/audit-log' },
            { icon: '🩺', label: 'Diagnostics', route: '/diagnostics' },
          ],
        },
        { icon: '🗑️', label: 'Recycle Bin', route: '/recycle-bin' },
        { icon: '⚙️', label: 'Settings', route: '/settings' },
      ],
    },
  ];
}


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
  const [cfoOpen, setCfoOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedZones, setCollapsedZones] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Auto-expand Shows sub-nav when on a /shows/* route
  useEffect(() => {
    if (location.pathname.startsWith('/shows/')) setShowsOpen(true);
  }, [location.pathname]);

  // Auto-expand Universe sub-nav when on a /universe/* sub-page or world-building route
  useEffect(() => {
    if (location.pathname.startsWith('/universe') || location.pathname.startsWith('/intelligence') || ['/cultural-calendar', '/influencer-systems', '/world-infrastructure', '/social-timeline', '/social-personality', '/character-life-simulation', '/cultural-memory', '/character-depth-engine', '/world-locations', '/amber', '/scene-studio'].some(p => location.pathname.startsWith(p))) {
      setUniverseOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand World Studio sub-nav
  useEffect(() => {
    if (['/world-studio', '/character-registry'].some(p => location.pathname.startsWith(p))) {
      setWorldOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand Short Stories sub-nav
  useEffect(() => {
    if (['/story-engine', '/scene-proposer', '/assembler', '/continuity', '/narrative-control'].some(p => location.pathname.startsWith(p))) {
      setStoriesOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand CFO sub-nav
  useEffect(() => {
    if (['/cfo', '/analytics/decisions', '/ai-costs'].some(p => location.pathname.startsWith(p))) {
      setCfoOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand Admin sub-nav
  useEffect(() => {
    if (['/admin', '/audit-log', '/diagnostics'].some(p => location.pathname.startsWith(p))) {
      setAdminOpen(true);
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
      {isOpen && <div className="ps-sidebar-backdrop" onClick={onClose} />}

      <aside className={`ps-sidebar ${isOpen ? 'ps-sidebar-open' : ''} ${collapsed ? 'ps-sidebar-collapsed' : ''}`}>
        {/* ── Logo / collapse toggle ── */}
        <div className="ps-sidebar-brand">
          {!collapsed && (
            <span className="ps-brand-mark" onClick={() => go('/start')}>
              PRIME<span className="ps-brand-diamond">◈</span>
            </span>
          )}
          <div className="ps-brand-actions">
            {/* Desktop collapse toggle */}
            <button
              className="ps-collapse-btn"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '›' : '‹'}
            </button>
            {/* Mobile close button */}
            {onClose && (
              <button
                className="ps-sidebar-close"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close sidebar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="ps-nav">
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive: a }) => `ps-nav-item ${a ? 'ps-nav-item-active' : ''}`}
            onClick={() => { if (onClose) onClose(); }}
            title={collapsed ? 'Home' : undefined}
          >
            <span className="ps-nav-icon">🏠</span>
            {!collapsed && <span className="ps-nav-label">Home</span>}
          </NavLink>

          {/* Zones */}
          {buildNav(shows).map(({ zone, items }) => {
            const zoneCollapsed = collapsedZones[zone];
            return (
            <div className="ps-zone" key={zone}>
              {!collapsed && (
                <div
                  className="ps-zone-label ps-zone-label-toggle"
                  onClick={() => setCollapsedZones(prev => ({ ...prev, [zone]: !prev[zone] }))}
                >
                  <span>{zone}</span>
                  <span className={`ps-zone-chevron ${zoneCollapsed ? '' : 'ps-zone-chevron-open'}`}>›</span>
                </div>
              )}

              {!zoneCollapsed && items.map(item => {
                // ── Expandable item with grouped children (Universe) ──
                if (item.groups) {
                  const allChildren = item.groups.flatMap(g => g.children);
                  const allRoutes = allChildren.map(c => c.route);
                  const groupActive = isActive(item.route) || allRoutes.some(r => isActive(r));
                  const groupOpen = universeOpen;
                  const setGroupOpen = setUniverseOpen;
                  return (
                    <div key={item.route} className="ps-item-group">
                      <div
                        className={`ps-nav-item ${groupActive ? 'ps-nav-item-active' : ''}`}
                        onClick={() => { go(item.route); setGroupOpen(o => !o); }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="ps-nav-icon">{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="ps-nav-label">{item.label}</span>
                            <span className={`ps-nav-chevron ${groupOpen ? 'ps-nav-chevron-open' : ''}`}>›</span>
                          </>
                        )}
                      </div>

                      {groupOpen && !collapsed && (
                        <div className="ps-subnav">
                          {item.groups.map(group => {
                            const gKey = group.heading;
                            const gCollapsed = collapsedGroups[gKey];
                            return (
                              <div key={gKey} className="ps-subnav-group">
                                <div
                                  className="ps-subnav-heading ps-subnav-heading-toggle"
                                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [gKey]: !prev[gKey] }))}
                                >
                                  <span>{gKey}</span>
                                  <span className={`ps-subnav-heading-chevron ${gCollapsed ? '' : 'ps-subnav-heading-chevron-open'}`}>›</span>
                                </div>
                                {!gCollapsed && group.children.map(child => (
                                  <NavLink
                                    key={child.route}
                                    to={child.route}
                                    className={({ isActive: a }) => `ps-subnav-item ${location.pathname + location.search === child.route ? 'ps-subnav-item-active' : ''}`}
                                    onClick={() => { if (onClose) onClose(); }}
                                  >
                                    <span className="ps-sub-dot" />
                                    <span className="ps-subnav-label">{child.label}</span>
                                  </NavLink>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Expandable item with flat children ──
                if (item.children) {
                  const isWorld = item.route === '/world-studio';
                  const isStories = item.route === '/story-engine';
                  const isCfo = item.route === '/cfo';
                  const isAdmin = item.route === '/admin';
                  const groupOpen = isWorld ? worldOpen : isStories ? storiesOpen : isCfo ? cfoOpen : isAdmin ? adminOpen : false;
                  const setGroupOpen = isWorld ? setWorldOpen : isStories ? setStoriesOpen : isCfo ? setCfoOpen : isAdmin ? setAdminOpen : () => {};
                  const childRoutes = item.children.map(c => c.route);
                  const groupActive = isActive(item.route) || childRoutes.some(r => isActive(r));
                  const toggleOnly = isStories; // Short Stories: toggle only, no navigate
                  return (
                    <div key={item.route} className="ps-item-group">
                      <div
                        className={`ps-nav-item ${groupActive ? 'ps-nav-item-active' : ''}`}
                        onClick={() => {
                          if (!toggleOnly) go(item.route);
                          setGroupOpen(o => !o);
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="ps-nav-icon">{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="ps-nav-label">{item.label}</span>
                            <span className={`ps-nav-chevron ${groupOpen ? 'ps-nav-chevron-open' : ''}`}>›</span>
                          </>
                        )}
                      </div>

                      {groupOpen && !collapsed && (
                        <div className="ps-subnav">
                          {item.children.map(child => (
                            <NavLink
                              key={child.route}
                              to={child.route}
                              className={({ isActive: a }) => `ps-subnav-item ${location.pathname + location.search === child.route ? 'ps-subnav-item-active' : ''}`}
                              onClick={() => { if (onClose) onClose(); }}
                            >
                              <span className="ps-sub-dot" />
                              <span className="ps-subnav-label">{child.label}</span>
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
                    <div key={item.route} className="ps-item-group">
                      <div
                        className={`ps-nav-item ${showsActive ? 'ps-nav-item-active' : ''}`}
                        onClick={() => {
                          go(item.route);
                          setShowsOpen(o => !o);
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="ps-nav-icon">{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="ps-nav-label">{item.label}</span>
                            <span className={`ps-nav-chevron ${showsOpen ? 'ps-nav-chevron-open' : ''}`}>›</span>
                          </>
                        )}
                      </div>

                      {/* Shows sub-list */}
                      {showsOpen && !collapsed && (
                        <div className="ps-subnav">
                          {shows.length === 0 ? (
                            <div className="ps-subnav-empty">No shows yet</div>
                          ) : (
                            shows.map(show => (
                              <NavLink
                                key={show.id}
                                to={`/shows/${show.id}`}
                                className={({ isActive: a }) => `ps-subnav-item ${a ? 'ps-subnav-item-active' : ''}`}
                                onClick={() => { if (onClose) onClose(); }}
                              >
                                <span className="ps-sub-dot" />
                                <span className="ps-subnav-label">{show.name}</span>
                                <span className="ps-subnav-count">{show.episodeCount}</span>
                              </NavLink>
                            ))
                          )}
                          <NavLink
                            to="/shows/create"
                            className="ps-subnav-create"
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
                    className={({ isActive: a }) => `ps-nav-item ${a ? 'ps-nav-item-active' : ''}`}
                    onClick={() => { if (onClose) onClose(); }}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="ps-nav-icon">{item.icon}</span>
                    {!collapsed && <span className="ps-nav-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
          })}
        </nav>

        {/* ── Setup Progress ── */}
        <SidebarProgress showId={shows[0]?.id} collapsed={collapsed} />

        {/* ── Footer ── */}
        <div className="ps-user-footer">
          <div className="ps-user-click" onClick={() => go('/settings')}>
            <div className="ps-user-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            {!collapsed && (
              <div className="ps-user-info">
                <div className="ps-user-name">{user?.name || user?.email?.split('@')[0] || 'Creator'}</div>
                <div className="ps-user-role">Creator</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
