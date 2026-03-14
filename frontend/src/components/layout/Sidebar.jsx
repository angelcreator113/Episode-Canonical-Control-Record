/**
 * Sidebar.jsx — Prime Studios Navigation
 *
 * Gating rules:
 *   WORLD   → always visible
 *   WRITE   → requiresZone: 'world'  → unlocks when /world/characters returns ≥1 character
 *   STUDIO  → requiresZone: 'write'  → unlocks when /storyteller/books returns ≥1 book
 *   MANAGE  → always visible
 *
 * When locked: opacity 0.45, pointerEvents none, LOCKED badge, sub-navs suppressed
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/* ── Nav structure ─────────────────────────────────────────────────────── */
const NAV = [
  {
    zone: 'HOME',
    requiresZone: null,
    items: [
      { path: '/',      label: 'Home',     icon: '⌂' },
    ],
  },
  {
    zone: 'WORLD',
    requiresZone: null,
    items: [
      {
        path: '/universe',
        label: 'Universe',
        icon: '◉',
        children: [
          { path: '/universe',                      label: 'Overview'          },
          { path: '/cultural-calendar',             label: 'Cultural Calendar' },
          { path: '/influencer-systems',            label: 'Influencer Systems'},
          { path: '/world-infrastructure',          label: 'Infrastructure'    },
          { path: '/social-timeline',               label: 'Social Timeline'   },
          { path: '/social-personality',            label: 'Social Personality'},
          { path: '/character-life-simulation',     label: 'Life Simulation'   },
          { path: '/cultural-memory',               label: 'Cultural Memory'   },
          { path: '/character-depth-engine',        label: 'Depth Engine'      },
          { path: '/amber',                         label: 'Amber'             },
        ],
      },
      {
        path: '/world-studio',
        label: 'Create World',
        icon: '✦',
        children: [
          { path: '/world-studio',                  label: 'Characters'        },
          { path: '/world-studio?tab=feed',         label: 'The Feed'          },
          { path: '/world-studio?tab=relationships', label: 'Relationships'    },
          { path: '/world-studio?tab=locations',    label: 'Locations'         },
          { path: '/world-studio?tab=tensions',     label: 'Tensions'          },
        ],
      },
      { path: '/therapy/default', label: 'Therapy',    icon: '♡' },
    ],
  },
  {
    zone: 'WRITE',
    requiresZone: 'world',
    items: [
      {
        path: '/story-engine',
        label: 'Short Stories',
        icon: '✐',
        toggleOnly: true,
        children: [
          { path: '/story-engine',      label: 'Story Engine'       },
          { path: '/scene-proposer',    label: 'Scene Intelligence' },
          { path: '/assembler',         label: 'Assembler'          },
          { path: '/continuity',        label: 'Continuity'         },
          { path: '/narrative-control', label: 'Narrative Control'  },
        ],
      },
      { path: '/storyteller',        label: 'Storyteller',    icon: '◈' },
      { path: '/pressure',           label: 'Pressure',      icon: '⚡' },
      { path: '/feed-relationships', label: 'Feed Map',      icon: '⊞' },
      { path: '/start',              label: 'Novel Session', icon: '▶' },
      { path: '/press',              label: 'Press',         icon: '▣' },
    ],
  },
  {
    zone: 'STUDIO',
    requiresZone: 'write',
    items: [
      {
        path: '/shows',
        label: 'Shows',
        icon: '▷',
        children: [
          { path: '/shows',        label: 'All Shows' },
          { path: '/shows/create', label: 'New Show'  },
        ],
      },
      { path: '/show-brain',    label: 'Show Brain',    icon: '◐' },
      { path: '/scene-library', label: 'Scene Library', icon: '◫' },
    ],
  },
  {
    zone: 'MANAGE',
    requiresZone: null,
    items: [
      {
        path: '/cfo',
        label: 'CFO Agent',
        icon: '◇',
        children: [
          { path: '/cfo',                label: 'Overview'  },
          { path: '/analytics/decisions', label: 'Analytics' },
          { path: '/ai-costs',           label: 'AI Costs'  },
        ],
      },
      { path: '/site-organizer', label: 'Site Organizer', icon: '⊡' },
      { path: '/design-agent',  label: 'Design Agent',   icon: '◆' },
      { path: '/admin',         label: 'Admin',          icon: '⊙' },
      { path: '/settings',      label: 'Settings',       icon: '⚙' },
    ],
  },
];

/* ── Progress bar config ────────────────────────────────────────────────── */
const PROGRESS_STEPS = [
  { label: 'Universe',    path: '/universe'       },
  { label: 'World Built', path: '/world-studio'   },
  { label: 'Writing',     path: '/storyteller'    },
  { label: 'Show',        path: '/shows'          },
  { label: 'Press',       path: '/press'          },
];

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Sidebar({ collapsed, onToggle }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  /* ── Gate state ─────────────────────────────────────────────────────── */
  const [worldUnlocked, setWorldUnlocked] = useState(false);
  const [writeUnlocked, setWriteUnlocked] = useState(false);
  const [checking,      setChecking]      = useState(true);

  /* ── Expanded sub-navs ──────────────────────────────────────────────── */
  const [expanded, setExpanded] = useState({});

  /* ── Setup progress (0–100) ─────────────────────────────────────────── */
  const [progress, setProgress] = useState(0);

  /* ── Check unlock conditions ────────────────────────────────────────── */
  const checkGates = useCallback(async () => {
    try {
      const [charRes, bookRes] = await Promise.all([
        fetch(`${API}/world/characters?limit=1`).catch(() => null),
        fetch(`${API}/storyteller/books?limit=1`).catch(() => null),
      ]);

      const charData = charRes?.ok ? await charRes.json() : {};
      const bookData = bookRes?.ok ? await bookRes.json() : {};

      const hasChars = (charData.characters?.length ?? charData.total ?? 0) > 0;
      const hasBooks = (bookData.books?.length ?? bookData.total ?? 0) > 0;

      setWorldUnlocked(hasChars);
      setWriteUnlocked(hasBooks);

      // Compute setup progress
      let steps = 0;
      if (hasChars) steps += 40;
      if (hasBooks) steps += 40;
      if (localStorage.getItem('ps_universe_visited')) steps += 20;
      setProgress(Math.min(steps, 100));
    } catch (e) {
      console.error('Sidebar gate check failed', e);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkGates();
  }, [location.pathname, checkGates]);

  /* ── Auto-expand active section ─────────────────────────────────────── */
  useEffect(() => {
    NAV.forEach(zone => {
      zone.items.forEach(item => {
        if (item.children) {
          const isChildActive = item.children.some(c => location.pathname === c.path.split('?')[0]);
          if (isChildActive) {
            setExpanded(prev => ({ ...prev, [item.path]: true }));
          }
        }
      });
    });
  }, [location.pathname]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const isActive = (path) => {
    const base = path.split('?')[0];
    return location.pathname === base || location.pathname.startsWith(base + '/');
  };

  const isZoneLocked = (zone) => {
    if (!zone.requiresZone) return false;
    if (zone.requiresZone === 'world') return !worldUnlocked;
    if (zone.requiresZone === 'write') return !writeUnlocked;
    return false;
  };

  const toggleExpand = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <aside className={`ps-sidebar ${collapsed ? 'ps-sidebar-collapsed' : ''}`}>
      {/* ── Logo / brand ─────────────────────────────────────────────── */}
      <div className="ps-sidebar-brand" onClick={() => navigate('/')}>
        <div className="ps-brand-mark">PRIME</div>
        <div className="ps-brand-diamond">◆</div>
        {!collapsed && (
          <button className="ps-collapse-btn" onClick={(e) => { e.stopPropagation(); onToggle?.(); }}>
            ‹
          </button>
        )}
      </div>
      {collapsed && (
        <button className="ps-collapse-btn ps-collapse-btn-out" onClick={onToggle}>›</button>
      )}

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="ps-nav">
        {NAV.map((zone) => {
          const locked = isZoneLocked(zone);

          return (
            <div key={zone.zone} className={`ps-zone ${locked ? 'ps-zone-locked' : ''}`}>
              {/* Zone label */}
              {zone.zone !== 'HOME' && !collapsed && (
                <div className="ps-zone-label">
                  {zone.zone}
                  {locked && <span className="ps-locked-badge">LOCKED</span>}
                </div>
              )}

              {/* Items */}
              {zone.items.map(item => {
                const active      = isActive(item.path);
                const hasChildren = item.children?.length > 0;
                const open        = expanded[item.path];

                return (
                  <div key={item.path} className="ps-item-group">
                    <button
                      className={`ps-nav-item ${active ? 'ps-nav-item-active' : ''}`}
                      style={locked ? { opacity: 0.45, pointerEvents: 'none' } : {}}
                      onClick={() => {
                        if (locked) return;
                        if (hasChildren) {
                          toggleExpand(item.path);
                          if (!item.toggleOnly) navigate(item.path);
                        } else {
                          navigate(item.path);
                        }
                      }}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="ps-nav-icon">{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span className="ps-nav-label">{item.label}</span>
                          {hasChildren && (
                            <span className={`ps-nav-chevron ${open ? 'ps-nav-chevron-open' : ''}`}>›</span>
                          )}
                        </>
                      )}
                    </button>

                    {/* Sub-nav — suppressed when locked or collapsed */}
                    {hasChildren && open && !locked && !collapsed && (
                      <div className="ps-subnav">
                        {item.children.map(child => (
                          <button
                            key={child.path}
                            className={`ps-subnav-item ${isActive(child.path) ? 'ps-subnav-item-active' : ''}`}
                            onClick={() => navigate(child.path)}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Setup progress ───────────────────────────────────────────── */}
      {!collapsed && (
        <div className="ps-progress-block">
          <div className="ps-progress-row">
            <span className="ps-progress-label">SETUP PROGRESS</span>
            <span className="ps-progress-pct">• {progress}%</span>
          </div>
          <div className="ps-progress-track">
            <div className="ps-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── User footer ──────────────────────────────────────────────── */}
      <div className="ps-user-footer">
        <div className="ps-user-avatar">
          {(user?.name || user?.email || 'U')[0].toUpperCase()}
        </div>
        {!collapsed && (
          <div className="ps-user-info">
            <div className="ps-user-name">{user?.name || user?.email?.split('@')[0] || 'Creator'}</div>
            <div className="ps-user-role">Creator</div>
          </div>
        )}
      </div>
    </aside>
  );
}
