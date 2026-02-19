/**
 * ShowSettings — Tabbed Settings Page (matches Show + Episode layout)
 * 
 * Route: /shows/:id/settings
 * 
 * Horizontal tab bar at the top, content panel below.
 * Tabs:
 *   1. 🏠 Hub — Quick stats & navigation links
 *   2. 🌍 Producer — WorldAdmin deep links
 *   3. 👗 Wardrobe — 3-level wardrobe overview
 *   4. 🎯 Goals — Career goals overview
 *   5. 💌 Events — Events engine overview
 *   6. 👑 Characters — Character management
 *   7. ⚙️ Config — Show-level settings
 *   8. 🔧 Advanced — Data mgmt, resets, exports
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './ShowSettings.css';

const TABS = [
  { key: 'hub',        icon: '🏠', label: 'Control Hub' },
  { key: 'producer',   icon: '🌍', label: 'Producer Mode' },
  { key: 'wardrobe',   icon: '👗', label: 'Wardrobe' },
  { key: 'goals',      icon: '🎯', label: 'Goals' },
  { key: 'events',     icon: '💌', label: 'Events' },
  { key: 'characters', icon: '👑', label: 'Characters' },
  { key: 'config',     icon: '⚙️', label: 'Config' },
  { key: 'advanced',   icon: '🔧', label: 'Advanced' },
];

function ShowSettings() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [show, setShow] = useState(null);
  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'hub');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  // Sync tab from URL on navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTabState(tab);
    }
  }, [searchParams]);

  // Keyboard shortcuts: Ctrl+1..8
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= TABS.length) {
          e.preventDefault();
          setActiveTab(TABS[num - 1].key);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { loadData(); }, [showId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [showRes, epsRes, eventsRes, goalsRes, wardrobeRes] = await Promise.allSettled([
        api.get(`/api/v1/shows/${showId}`),
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`),
        api.get(`/api/v1/world/${showId}/events`),
        api.get(`/api/v1/world/${showId}/goals`),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`),
      ]);
      setShow(showRes.status === 'fulfilled' ? showRes.value.data : { id: showId, title: 'Show' });
      const eps = epsRes.status === 'fulfilled' ? (epsRes.value.data?.episodes || epsRes.value.data?.data || []) : [];
      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events || []) : [];
      const goals = goalsRes.status === 'fulfilled' ? (goalsRes.value.data?.goals || []) : [];
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || wardrobeRes.value.data?.items || wardrobeRes.value.data?.wardrobe || []) : [];
      setStats({
        episodes: Array.isArray(eps) ? eps.length : 0,
        evaluated: Array.isArray(eps) ? eps.filter(e => e.evaluation_status === 'accepted').length : 0,
        events: events.length,
        goals: goals.length,
        goalsActive: goals.filter(g => g.status === 'active').length,
        wardrobe: Array.isArray(wardrobe) ? wardrobe.length : 0,
        wardrobeOwned: Array.isArray(wardrobe) ? wardrobe.filter(w => w.is_owned).length : 0,
      });
    } finally { setLoading(false); }
  };

  const goToWorld = (tab) => navigate(`/shows/${showId}/world?tab=${tab}`);

  if (loading) {
    return (
      <div className="ss-page">
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="ss-page">
      {/* Header */}
      <div className="ss-header">
        <Link to={`/shows/${showId}`} className="ss-back">← Back to Show</Link>
        <h1 className="ss-title">⚙️ Settings</h1>
        <p className="ss-subtitle">{show?.title || 'Show'} — Control Center</p>
      </div>

      {/* Tab Bar */}
      <div className="ss-tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`ss-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={`${tab.label} (Ctrl+${i + 1})`}
          >
            <span className="ss-tab-icon">{tab.icon}</span>
            <span className="ss-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div className="ss-content">

        {/* ═══ CONTROL HUB ═══ */}
        {activeTab === 'hub' && (
          <div>
            <h2 className="ss-section-title">🏠 Control Hub</h2>
            <p className="ss-section-desc">Quick overview and links to everything in your show.</p>

            <div className="ss-stats">
              {[
                { icon: '📋', val: stats.episodes, label: 'Episodes', sub: `${stats.evaluated} evaluated` },
                { icon: '💌', val: stats.events, label: 'Events', sub: 'in library' },
                { icon: '🎯', val: stats.goals, label: 'Goals', sub: `${stats.goalsActive} active` },
                { icon: '👗', val: stats.wardrobe, label: 'Wardrobe', sub: `${stats.wardrobeOwned} owned` },
              ].map((s, i) => (
                <div key={i} className="ss-stat-card">
                  <div className="ss-stat-icon">{s.icon}</div>
                  <div className="ss-stat-val">{s.val}</div>
                  <div className="ss-stat-label">{s.label}</div>
                  <div className="ss-stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <h3 className="ss-sub-title">Quick Links</h3>
            <div className="ss-links">
              {[
                { icon: '🌍', label: 'Producer Mode', desc: 'World rules, economy, canon', action: () => goToWorld('overview') },
                { icon: '📋', label: 'Episode Ledger', desc: 'All episodes with scores', action: () => goToWorld('episodes') },
                { icon: '💌', label: 'Events Library', desc: 'Create & inject events', action: () => goToWorld('events') },
                { icon: '🎯', label: 'Career Goals', desc: 'Goal management', action: () => goToWorld('goals') },
                { icon: '👗', label: 'Wardrobe', desc: 'Fashion inventory', action: () => goToWorld('wardrobe') },
                { icon: '👑', label: 'Characters', desc: 'Lala stats & rules', action: () => goToWorld('characters') },
                { icon: '🧠', label: 'Decision Log', desc: 'Training data', action: () => goToWorld('decisions') },
                { icon: '📺', label: 'Show Page', desc: 'Back to episodes', action: () => navigate(`/shows/${showId}`) },
              ].map((l, i) => (
                <button key={i} onClick={l.action} className="ss-link-card">
                  <span style={{ fontSize: 24 }}>{l.icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PRODUCER MODE ═══ */}
        {activeTab === 'producer' && (
          <div>
            <h2 className="ss-section-title">🌍 Producer Mode</h2>
            <p className="ss-section-desc">The world-building dashboard. Everything that defines how LalaVerse works.</p>

            <div className="ss-card-stack">
              <SettingsCard icon="📊" title="Overview" desc="Lala's current stats, tier distribution, and canon timeline." action={() => goToWorld('overview')} />
              <SettingsCard icon="📋" title="Episode Ledger" desc="Expandable case files for every episode — stat deltas, event links, evaluation breakdowns." action={() => goToWorld('episodes')} />
              <SettingsCard icon="💌" title="Events Library" desc="Create, edit, and inject reusable events into episodes. 40 events in the library across 5 tiers." action={() => goToWorld('events')} />
              <SettingsCard icon="🎯" title="Career Goals" desc="24-goal library with activation schedule. Seed goals, track progress, suggest events." action={() => goToWorld('goals')} />
              <SettingsCard icon="👗" title="Wardrobe" desc="40-item fashion inventory across 4 tiers. Tier badges, lock types, Lala reactions." action={() => goToWorld('wardrobe')} />
              <SettingsCard icon="👑" title="Characters" desc="Edit Lala's stats, view character rules, stat change history." action={() => goToWorld('characters')} />
              <SettingsCard icon="🧠" title="Decision Log" desc="Training data from creative decisions. Powers future AI suggestions." action={() => goToWorld('decisions')} />
            </div>

            <button onClick={() => navigate(`/shows/${showId}/world`)} className="ss-big-btn">
              🌍 Open Producer Mode →
            </button>
          </div>
        )}

        {/* ═══ WARDROBE ═══ */}
        {activeTab === 'wardrobe' && (
          <div>
            <h2 className="ss-section-title">👗 Wardrobe System</h2>
            <p className="ss-section-desc">Three levels of wardrobe control — from world-building to gameplay.</p>

            <div className="ss-tier-grid">
              <div className="ss-tier-card ss-tier-card--producer">
                <div className="ss-tier-badge ss-tier-badge--producer">🏗 PRODUCER MODE</div>
                <h3 className="ss-tier-title">World Building</h3>
                <p className="ss-tier-desc">Define tiers, lock rules, rarity, stat impact, arc alignment, unlock logic. This is the fashion economy infrastructure.</p>
                <div className="ss-tier-stats">
                  <span>📦 {stats.wardrobe} items</span>
                  <span>🔒 {stats.wardrobe - stats.wardrobeOwned} locked</span>
                  <span>4 tiers</span>
                </div>
                <button onClick={() => goToWorld('wardrobe')} className="ss-tier-btn">Open Item Library →</button>
              </div>

              <div className="ss-tier-card ss-tier-card--show">
                <div className="ss-tier-badge ss-tier-badge--show">🎬 SHOW MODE</div>
                <h3 className="ss-tier-title">Canon + Inventory</h3>
                <p className="ss-tier-desc">Lala's owned items, unlock history, wardrobe stats, closet versions. Persistent state across episodes.</p>
                <div className="ss-tier-stats">
                  <span>✅ {stats.wardrobeOwned} owned</span>
                  <span>👀 Visible teases</span>
                  <span>📈 Growth tracking</span>
                </div>
                <button onClick={() => goToWorld('wardrobe')} className="ss-tier-btn">View Inventory →</button>
              </div>

              <div className="ss-tier-card ss-tier-card--episode">
                <div className="ss-tier-badge ss-tier-badge--episode">🎥 EPISODE MODE</div>
                <h3 className="ss-tier-title">Gameplay + Drama</h3>
                <p className="ss-tier-desc">Filtered closet view per event. Browse/react/select loop. Match scoring against dress codes. The actual gameplay.</p>
                <div className="ss-tier-stats">
                  <span>🎲 8 items per browse</span>
                  <span>💬 Lala reactions</span>
                  <span>🏆 Outfit scoring</span>
                </div>
                <button disabled className="ss-tier-btn">Coming Soon</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CAREER GOALS ═══ */}
        {activeTab === 'goals' && (
          <div>
            <h2 className="ss-section-title">🎯 Career Goals</h2>
            <p className="ss-section-desc">24-goal library powering Lala's progression across a 24-episode season.</p>

            <div className="ss-info-grid">
              <div className="ss-info-card">
                <div className="ss-info-icon">📊</div>
                <div className="ss-info-val">{stats.goals}</div>
                <div className="ss-info-label">Total Goals</div>
              </div>
              <div className="ss-info-card">
                <div className="ss-info-icon">🟢</div>
                <div className="ss-info-val">{stats.goalsActive}</div>
                <div className="ss-info-label">Active</div>
              </div>
              <div className="ss-info-card">
                <div className="ss-info-icon">⏸️</div>
                <div className="ss-info-val">{stats.goals - stats.goalsActive}</div>
                <div className="ss-info-label">Paused</div>
              </div>
            </div>

            <div className="ss-card-stack">
              <SettingsCard icon="🌱" title="Seed Goals" desc="Import all 24 goals with tier-aware activation. 3 passive + 5 primary + 16 secondary." action={() => goToWorld('goals')} />
              <SettingsCard icon="💡" title="Suggest Events" desc="AI-powered event suggestions scored against active goals. Tension detection built in." action={() => goToWorld('goals')} />
              <SettingsCard icon="📈" title="Track Progress" desc="Progress bars, completion tracking, unlock chains." action={() => goToWorld('goals')} />
            </div>

            <button onClick={() => goToWorld('goals')} className="ss-big-btn">
              🎯 Open Career Goals →
            </button>
          </div>
        )}

        {/* ═══ EVENTS ENGINE ═══ */}
        {activeTab === 'events' && (
          <div>
            <h2 className="ss-section-title">💌 Events Engine</h2>
            <p className="ss-section-desc">Reusable event catalog. Create once, inject into any episode.</p>

            <div className="ss-info-grid">
              <div className="ss-info-card">
                <div className="ss-info-icon">💌</div>
                <div className="ss-info-val">{stats.events}</div>
                <div className="ss-info-label">Events in Library</div>
              </div>
            </div>

            <div className="ss-card-stack">
              <SettingsCard icon="✨" title="Create Events" desc="Define prestige, cost, strictness, dress code, narrative stakes. Full event builder." action={() => goToWorld('events')} />
              <SettingsCard icon="💉" title="Inject into Episodes" desc="Pick any event → inject into any episode → auto-generates script tags." action={() => goToWorld('events')} />
              <SettingsCard icon="📝" title="Generate Scripts" desc="Event → skeleton script with beats, dialogue starters, and wardrobe tags." action={() => goToWorld('events')} />
            </div>

            <button onClick={() => goToWorld('events')} className="ss-big-btn">
              💌 Open Events Library →
            </button>
          </div>
        )}

        {/* ═══ CHARACTERS ═══ */}
        {activeTab === 'characters' && (
          <div>
            <h2 className="ss-section-title">👑 Characters</h2>
            <p className="ss-section-desc">Manage character stats, rules, and progression history.</p>

            <div className="ss-card-stack">
              <SettingsCard icon="👑" title="Lala" desc="Main character. Edit stats (coins, reputation, brand trust, influence, stress). View progress bars and rules." action={() => goToWorld('characters')} />
              <SettingsCard icon="💎" title="JustAWomanInHerPrime" desc="Creator narrator. Warm, strategic, luxury aspirational voice. Aliases: Prime:, Me:, You:" action={() => goToWorld('characters')} />
              <SettingsCard icon="📜" title="Stat Change Ledger" desc="Full audit trail of every stat change — evaluations, overrides, manual edits." action={() => goToWorld('characters')} />
            </div>

            <button onClick={() => goToWorld('characters')} className="ss-big-btn">
              👑 Open Characters →
            </button>
          </div>
        )}

        {/* ═══ SHOW CONFIG ═══ */}
        {activeTab === 'config' && (
          <div>
            <h2 className="ss-section-title">⚙️ Show Configuration</h2>
            <p className="ss-section-desc">Show-level settings and preferences.</p>

            <div className="ss-config-card">
              <h3 className="ss-config-title">Show Details</h3>
              <div className="ss-config-row"><span className="ss-config-label">Title</span><span className="ss-config-val">{show?.title || '—'}</span></div>
              <div className="ss-config-row"><span className="ss-config-label">Show ID</span><span className="ss-config-val" style={{ fontSize: 11, fontFamily: 'monospace' }}>{showId}</span></div>
              <div className="ss-config-row"><span className="ss-config-label">Episodes</span><span className="ss-config-val">{stats.episodes}</span></div>
              <div className="ss-config-row"><span className="ss-config-label">Status</span><span className="ss-config-val">{show?.status || 'active'}</span></div>
            </div>

            <div className="ss-config-card">
              <h3 className="ss-config-title">Season Settings</h3>
              <div className="ss-config-row"><span className="ss-config-label">Total Episodes</span><span className="ss-config-val">24 (planned)</span></div>
              <div className="ss-config-row"><span className="ss-config-label">Current Era</span><span className="ss-config-val">Foundation</span></div>
              <div className="ss-config-row"><span className="ss-config-label">Economy Model</span><span className="ss-config-val">Prime Coins + Dream Fund</span></div>
            </div>

            <div className="ss-config-card" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
              <h3 className="ss-config-title" style={{ color: '#92400e' }}>🚧 More settings coming</h3>
              <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                Future: notification preferences, default scoring weights, theme/branding, API keys, team access, export schedules.
              </p>
            </div>
          </div>
        )}

        {/* ═══ ADVANCED ═══ */}
        {activeTab === 'advanced' && (
          <div>
            <h2 className="ss-section-title">🔧 Advanced</h2>
            <p className="ss-section-desc">Data management, resets, and exports.</p>

            <div className="ss-card-stack">
              <div className="ss-action-card" style={{ borderLeft: '4px solid #6366f1' }}>
                <div className="ss-action-header">
                  <span style={{ fontSize: 20 }}>🌱</span>
                  <div>
                    <div className="ss-action-title">Seed Data</div>
                    <div className="ss-action-desc">Populate goals (24), wardrobe (40), and events (40) from built-in libraries.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={async () => {
                    try {
                      await api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 });
                      await api.post('/api/v1/wardrobe/seed', { show_id: showId });
                      alert('Seeded goals + wardrobe!');
                      loadData();
                    } catch (e) { alert(e.message); }
                  }} className="ss-action-btn">🌱 Seed All</button>
                </div>
              </div>

              <div className="ss-action-card" style={{ borderLeft: '4px solid #eab308' }}>
                <div className="ss-action-header">
                  <span style={{ fontSize: 20 }}>📤</span>
                  <div>
                    <div className="ss-action-title">Export Data</div>
                    <div className="ss-action-desc">Export episodes, events, goals, wardrobe, and decisions as JSON.</div>
                  </div>
                </div>
                <button onClick={() => alert('Export coming soon')} className="ss-action-btn ss-action-btn--warning">📤 Export JSON</button>
              </div>

              <div className="ss-action-card" style={{ borderLeft: '4px solid #dc2626' }}>
                <div className="ss-action-header">
                  <span style={{ fontSize: 20 }}>🗑️</span>
                  <div>
                    <div className="ss-action-title">Reset Character State</div>
                    <div className="ss-action-desc">Reset Lala's stats to defaults (500 coins, 1 rep, 1 trust, 1 influence, 0 stress). Cannot be undone.</div>
                  </div>
                </div>
                <button onClick={async () => {
                  if (!window.confirm('Reset Lala to default stats? This cannot be undone.')) return;
                  try {
                    await api.post('/api/v1/characters/lala/state/update', {
                      show_id: showId, coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0,
                      source: 'manual', notes: 'Reset from Settings page',
                    });
                    alert('Stats reset!'); loadData();
                  } catch (e) { alert(e.message); }
                }} className="ss-action-btn ss-action-btn--danger">🗑️ Reset Stats</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Reusable Card Component ───
function SettingsCard({ icon, title, desc, action }) {
  return (
    <button onClick={action} className="ss-settings-card">
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <span style={{ fontSize: 16, color: '#cbd5e1' }}>→</span>
    </button>
  );
}

export default ShowSettings;
