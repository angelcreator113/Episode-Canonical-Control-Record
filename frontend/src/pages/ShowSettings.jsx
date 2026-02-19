/**
 * ShowSettings — Navigation Hub for Producer Mode
 * 
 * Route: /shows/:id/settings
 * 
 * This is the control center. Left sidebar navigation, right content panel.
 * Sections:
 *   1. 🏠 Show Overview — Show info, quick stats, quick links
 *   2. 🌍 Producer Mode — Links to WorldAdmin (7 tabs)
 *   3. 👗 Wardrobe System — 3 levels (Producer / Show / Episode)
 *   4. 🎯 Career Goals — Goal library & activation
 *   5. 💌 Events Engine — Event library & injection
 *   6. 👑 Characters — Stat management & rules
 *   7. ⚙️ Show Config — Show-level settings (future)
 *   8. 🔧 Advanced — Data management, resets, exports
 * 
 * Location: frontend/src/pages/ShowSettings.jsx
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const SECTIONS = [
  { key: 'hub', icon: '🏠', label: 'Control Hub', desc: 'Overview & quick links' },
  { key: 'producer', icon: '🌍', label: 'Producer Mode', desc: 'World rules, canon, economy' },
  { key: 'wardrobe', icon: '👗', label: 'Wardrobe System', desc: '3-level fashion engine' },
  { key: 'goals', icon: '🎯', label: 'Career Goals', desc: 'Goal library & progression' },
  { key: 'events', icon: '💌', label: 'Events Engine', desc: 'Event library & injection' },
  { key: 'characters', icon: '👑', label: 'Characters', desc: 'Stats, rules, history' },
  { key: 'config', icon: '⚙️', label: 'Show Config', desc: 'Settings & preferences' },
  { key: 'advanced', icon: '🔧', label: 'Advanced', desc: 'Data, resets, exports' },
];

function ShowSettings() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [activeSection, setActiveSection] = useState('hub');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

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

  if (loading) return <div style={P.page}><div style={P.loading}>Loading settings...</div></div>;

  return (
    <div style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <Link to={`/shows/${showId}`} style={P.back}>← Back to Show</Link>
          <h1 style={P.title}>⚙️ Settings</h1>
          <p style={P.sub}>{show?.title || 'Show'} — Control Center</p>
        </div>
      </div>

      <div style={P.layout}>
        {/* Sidebar */}
        <nav style={P.sidebar}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={activeSection === s.key ? P.navActive : P.navItem}>
              <span style={P.navIcon}>{s.icon}</span>
              <div style={P.navText}>
                <div style={P.navLabel}>{s.label}</div>
                <div style={P.navDesc}>{s.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={P.content}>

          {/* ═══ CONTROL HUB ═══ */}
          {activeSection === 'hub' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>🏠 Control Hub</h2>
              <p style={P.sectionDesc}>Quick overview and links to everything in your show.</p>

              {/* Stats grid */}
              <div style={P.statsGrid}>
                {[
                  { icon: '📋', val: stats.episodes, label: 'Episodes', sub: `${stats.evaluated} evaluated` },
                  { icon: '💌', val: stats.events, label: 'Events', sub: 'in library' },
                  { icon: '🎯', val: stats.goals, label: 'Goals', sub: `${stats.goalsActive} active` },
                  { icon: '👗', val: stats.wardrobe, label: 'Wardrobe', sub: `${stats.wardrobeOwned} owned` },
                ].map((s, i) => (
                  <div key={i} style={P.statCard}>
                    <div style={P.statIcon}>{s.icon}</div>
                    <div style={P.statVal}>{s.val}</div>
                    <div style={P.statLabel}>{s.label}</div>
                    <div style={P.statSub}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <h3 style={P.subTitle}>Quick Links</h3>
              <div style={P.linkGrid}>
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
                  <button key={i} onClick={l.action} style={P.linkCard}>
                    <span style={{ fontSize: 24 }}>{l.icon}</span>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ PRODUCER MODE ═══ */}
          {activeSection === 'producer' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>🌍 Producer Mode</h2>
              <p style={P.sectionDesc}>The world-building dashboard. Everything that defines how LalaVerse works.</p>

              <div style={P.cardStack}>
                <SettingsCard icon="📊" title="Overview" desc="Lala's current stats, tier distribution, and canon timeline." action={() => goToWorld('overview')} />
                <SettingsCard icon="📋" title="Episode Ledger" desc="Expandable case files for every episode — stat deltas, event links, evaluation breakdowns." action={() => goToWorld('episodes')} />
                <SettingsCard icon="💌" title="Events Library" desc="Create, edit, and inject reusable events into episodes. 40 events in the library across 5 tiers." action={() => goToWorld('events')} />
                <SettingsCard icon="🎯" title="Career Goals" desc="24-goal library with activation schedule. Seed goals, track progress, suggest events." action={() => goToWorld('goals')} />
                <SettingsCard icon="👗" title="Wardrobe" desc="40-item fashion inventory across 4 tiers. Tier badges, lock types, Lala reactions." action={() => goToWorld('wardrobe')} />
                <SettingsCard icon="👑" title="Characters" desc="Edit Lala's stats, view character rules, stat change history." action={() => goToWorld('characters')} />
                <SettingsCard icon="🧠" title="Decision Log" desc="Training data from creative decisions. Powers future AI suggestions." action={() => goToWorld('decisions')} />
              </div>

              <button onClick={() => navigate(`/shows/${showId}/world`)} style={P.bigBtn}>
                🌍 Open Producer Mode →
              </button>
            </div>
          )}

          {/* ═══ WARDROBE SYSTEM ═══ */}
          {activeSection === 'wardrobe' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>👗 Wardrobe System</h2>
              <p style={P.sectionDesc}>Three levels of wardrobe control — from world-building to gameplay.</p>

              <div style={P.tierCards}>
                <div style={P.tierCard('producer')}>
                  <div style={P.tierBadge('producer')}>🏗 PRODUCER MODE</div>
                  <h3 style={P.tierTitle}>World Building</h3>
                  <p style={P.tierDesc}>Define tiers, lock rules, rarity, stat impact, arc alignment, unlock logic. This is the fashion economy infrastructure.</p>
                  <div style={P.tierStats}>
                    <span>📦 {stats.wardrobe} items</span>
                    <span>🔒 {stats.wardrobe - stats.wardrobeOwned} locked</span>
                    <span>4 tiers</span>
                  </div>
                  <button onClick={() => goToWorld('wardrobe')} style={P.tierBtn}>Open Item Library →</button>
                </div>

                <div style={P.tierCard('show')}>
                  <div style={P.tierBadge('show')}>🎬 SHOW MODE</div>
                  <h3 style={P.tierTitle}>Canon + Inventory</h3>
                  <p style={P.tierDesc}>Lala's owned items, unlock history, wardrobe stats, closet versions. Persistent state across episodes.</p>
                  <div style={P.tierStats}>
                    <span>✅ {stats.wardrobeOwned} owned</span>
                    <span>👀 Visible teases</span>
                    <span>📈 Growth tracking</span>
                  </div>
                  <button onClick={() => goToWorld('wardrobe')} style={P.tierBtn}>View Inventory →</button>
                </div>

                <div style={P.tierCard('episode')}>
                  <div style={P.tierBadge('episode')}>🎥 EPISODE MODE</div>
                  <h3 style={P.tierTitle}>Gameplay + Drama</h3>
                  <p style={P.tierDesc}>Filtered closet view per event. Browse/react/select loop. Match scoring against dress codes. The actual gameplay.</p>
                  <div style={P.tierStats}>
                    <span>🎲 8 items per browse</span>
                    <span>💬 Lala reactions</span>
                    <span>🏆 Outfit scoring</span>
                  </div>
                  <button disabled style={{ ...P.tierBtn, opacity: 0.5 }}>Coming Soon</button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ CAREER GOALS ═══ */}
          {activeSection === 'goals' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>🎯 Career Goals</h2>
              <p style={P.sectionDesc}>24-goal library powering Lala's progression across a 24-episode season.</p>

              <div style={P.infoGrid}>
                <div style={P.infoCard}>
                  <div style={P.infoIcon}>📊</div>
                  <div style={P.infoVal}>{stats.goals}</div>
                  <div style={P.infoLabel}>Total Goals</div>
                </div>
                <div style={P.infoCard}>
                  <div style={P.infoIcon}>🟢</div>
                  <div style={P.infoVal}>{stats.goalsActive}</div>
                  <div style={P.infoLabel}>Active</div>
                </div>
                <div style={P.infoCard}>
                  <div style={P.infoIcon}>⏸️</div>
                  <div style={P.infoVal}>{stats.goals - stats.goalsActive}</div>
                  <div style={P.infoLabel}>Paused</div>
                </div>
              </div>

              <div style={P.cardStack}>
                <SettingsCard icon="🌱" title="Seed Goals" desc="Import all 24 goals with tier-aware activation. 3 passive + 5 primary + 16 secondary." action={() => goToWorld('goals')} />
                <SettingsCard icon="💡" title="Suggest Events" desc="AI-powered event suggestions scored against active goals. Tension detection built in." action={() => goToWorld('goals')} />
                <SettingsCard icon="📈" title="Track Progress" desc="Progress bars, completion tracking, unlock chains." action={() => goToWorld('goals')} />
              </div>

              <button onClick={() => goToWorld('goals')} style={P.bigBtn}>
                🎯 Open Career Goals →
              </button>
            </div>
          )}

          {/* ═══ EVENTS ENGINE ═══ */}
          {activeSection === 'events' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>💌 Events Engine</h2>
              <p style={P.sectionDesc}>Reusable event catalog. Create once, inject into any episode.</p>

              <div style={P.infoGrid}>
                <div style={P.infoCard}>
                  <div style={P.infoIcon}>💌</div>
                  <div style={P.infoVal}>{stats.events}</div>
                  <div style={P.infoLabel}>Events in Library</div>
                </div>
              </div>

              <div style={P.cardStack}>
                <SettingsCard icon="✨" title="Create Events" desc="Define prestige, cost, strictness, dress code, narrative stakes. Full event builder." action={() => goToWorld('events')} />
                <SettingsCard icon="💉" title="Inject into Episodes" desc="Pick any event → inject into any episode → auto-generates script tags." action={() => goToWorld('events')} />
                <SettingsCard icon="📝" title="Generate Scripts" desc="Event → skeleton script with beats, dialogue starters, and wardrobe tags." action={() => goToWorld('events')} />
              </div>

              <button onClick={() => goToWorld('events')} style={P.bigBtn}>
                💌 Open Events Library →
              </button>
            </div>
          )}

          {/* ═══ CHARACTERS ═══ */}
          {activeSection === 'characters' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>👑 Characters</h2>
              <p style={P.sectionDesc}>Manage character stats, rules, and progression history.</p>

              <div style={P.cardStack}>
                <SettingsCard icon="👑" title="Lala" desc="Main character. Edit stats (coins, reputation, brand trust, influence, stress). View progress bars and rules." action={() => goToWorld('characters')} />
                <SettingsCard icon="💎" title="JustAWomanInHerPrime" desc="Creator narrator. Warm, strategic, luxury aspirational voice. Aliases: Prime:, Me:, You:" action={() => goToWorld('characters')} />
                <SettingsCard icon="📜" title="Stat Change Ledger" desc="Full audit trail of every stat change — evaluations, overrides, manual edits." action={() => goToWorld('characters')} />
              </div>

              <button onClick={() => goToWorld('characters')} style={P.bigBtn}>
                👑 Open Characters →
              </button>
            </div>
          )}

          {/* ═══ SHOW CONFIG ═══ */}
          {activeSection === 'config' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>⚙️ Show Configuration</h2>
              <p style={P.sectionDesc}>Show-level settings and preferences.</p>

              <div style={P.configCard}>
                <h3 style={P.configTitle}>Show Details</h3>
                <div style={P.configRow}><span style={P.configLabel}>Title</span><span style={P.configVal}>{show?.title || '—'}</span></div>
                <div style={P.configRow}><span style={P.configLabel}>Show ID</span><span style={{ ...P.configVal, fontSize: 11, fontFamily: 'monospace' }}>{showId}</span></div>
                <div style={P.configRow}><span style={P.configLabel}>Episodes</span><span style={P.configVal}>{stats.episodes}</span></div>
                <div style={P.configRow}><span style={P.configLabel}>Status</span><span style={P.configVal}>{show?.status || 'active'}</span></div>
              </div>

              <div style={P.configCard}>
                <h3 style={P.configTitle}>Season Settings</h3>
                <div style={P.configRow}><span style={P.configLabel}>Total Episodes</span><span style={P.configVal}>24 (planned)</span></div>
                <div style={P.configRow}><span style={P.configLabel}>Current Era</span><span style={P.configVal}>Foundation</span></div>
                <div style={P.configRow}><span style={P.configLabel}>Economy Model</span><span style={P.configVal}>Prime Coins + Dream Fund</span></div>
              </div>

              <div style={{ ...P.configCard, background: '#fef3c7', border: '1px solid #fde68a' }}>
                <h3 style={{ ...P.configTitle, color: '#92400e' }}>🚧 More settings coming</h3>
                <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                  Future: notification preferences, default scoring weights, theme/branding, API keys, team access, export schedules.
                </p>
              </div>
            </div>
          )}

          {/* ═══ ADVANCED ═══ */}
          {activeSection === 'advanced' && (
            <div style={P.section}>
              <h2 style={P.sectionTitle}>🔧 Advanced</h2>
              <p style={P.sectionDesc}>Data management, resets, and exports.</p>

              <div style={P.cardStack}>
                <div style={{ ...P.actionCard, borderLeft: '4px solid #6366f1' }}>
                  <div style={P.actionHeader}>
                    <span style={{ fontSize: 20 }}>🌱</span>
                    <div>
                      <div style={P.actionTitle}>Seed Data</div>
                      <div style={P.actionDesc}>Populate goals (24), wardrobe (40), and events (40) from built-in libraries.</div>
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
                    }} style={P.actionBtn}>🌱 Seed All</button>
                  </div>
                </div>

                <div style={{ ...P.actionCard, borderLeft: '4px solid #eab308' }}>
                  <div style={P.actionHeader}>
                    <span style={{ fontSize: 20 }}>📤</span>
                    <div>
                      <div style={P.actionTitle}>Export Data</div>
                      <div style={P.actionDesc}>Export episodes, events, goals, wardrobe, and decisions as JSON.</div>
                    </div>
                  </div>
                  <button onClick={() => alert('Export coming soon')} style={{ ...P.actionBtn, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>📤 Export JSON</button>
                </div>

                <div style={{ ...P.actionCard, borderLeft: '4px solid #dc2626' }}>
                  <div style={P.actionHeader}>
                    <span style={{ fontSize: 20 }}>🗑️</span>
                    <div>
                      <div style={P.actionTitle}>Reset Character State</div>
                      <div style={P.actionDesc}>Reset Lala's stats to defaults (500 coins, 1 rep, 1 trust, 1 influence, 0 stress). Cannot be undone.</div>
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
                  }} style={{ ...P.actionBtn, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>🗑️ Reset Stats</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Reusable Card Component ───
function SettingsCard({ icon, title, desc, action }) {
  return (
    <button onClick={action} style={P.settingsCard}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <span style={{ fontSize: 16, color: '#cbd5e1' }}>→</span>
    </button>
  );
}

// ─── STYLES ───
const P = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  loading: { textAlign: 'center', padding: 60, color: '#94a3b8' },
  header: { marginBottom: 20 },
  back: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 4px', fontSize: 26, fontWeight: 800, color: '#1a1a2e' },
  sub: { margin: 0, color: '#64748b', fontSize: 14 },

  layout: { display: 'flex', gap: 20, minHeight: '70vh' },

  // Sidebar
  sidebar: { flex: '0 0 240px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    background: 'transparent', border: '1px solid transparent', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
  },
  navActive: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left',
  },
  navIcon: { fontSize: 18, flexShrink: 0 },
  navText: { flex: 1, minWidth: 0 },
  navLabel: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
  navDesc: { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  // Content
  content: { flex: 1, minWidth: 0 },
  section: {},
  sectionTitle: { fontSize: 20, fontWeight: 800, color: '#1a1a2e', margin: '0 0 6px' },
  sectionDesc: { fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 },
  subTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: '24px 0 12px' },

  // Stats grid
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'center' },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statVal: { fontSize: 28, fontWeight: 800, color: '#1a1a2e' },
  statLabel: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  statSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

  // Link grid
  linkGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  linkCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
  },

  // Card stack
  cardStack: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  settingsCard: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
  },

  // Big button
  bigBtn: {
    display: 'block', width: '100%', padding: '14px 24px', marginTop: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
    borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', textAlign: 'center',
  },

  // Tier cards (wardrobe section)
  tierCards: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 },
  tierCard: (level) => ({
    background: level === 'producer' ? '#f8fafc' : level === 'show' ? '#eef2ff' : '#fef3c7',
    border: `1px solid ${level === 'producer' ? '#e2e8f0' : level === 'show' ? '#c7d2fe' : '#fde68a'}`,
    borderRadius: 14, padding: 20,
  }),
  tierBadge: (level) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800,
    letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
    background: level === 'producer' ? '#e2e8f0' : level === 'show' ? '#c7d2fe' : '#fde68a',
    color: level === 'producer' ? '#475569' : level === 'show' ? '#4338ca' : '#92400e',
  }),
  tierTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' },
  tierDesc: { fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10 },
  tierStats: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 11, color: '#64748b' },
  tierBtn: {
    padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6366f1',
  },

  // Info grid
  infoGrid: { display: 'flex', gap: 12, marginBottom: 16 },
  infoCard: { flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'center' },
  infoIcon: { fontSize: 20, marginBottom: 4 },
  infoVal: { fontSize: 28, fontWeight: 800, color: '#1a1a2e' },
  infoLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' },

  // Config section
  configCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 12 },
  configTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px' },
  configRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  configLabel: { fontSize: 13, color: '#64748b' },
  configVal: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },

  // Advanced action cards
  actionCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 },
  actionHeader: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  actionTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e' },
  actionDesc: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 },
  actionBtn: {
    padding: '8px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#4338ca', marginTop: 10,
  },
};

export default ShowSettings;
