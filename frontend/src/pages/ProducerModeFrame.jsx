/**
 * ProducerModeFrame
 *
 * Moved from ShowSettings (Producer Mode tab) → Universe page → Shows tab
 *
 * Usage inside your Universe Shows tab:
 *   <ProducerModeFrame showId={selectedShowId} show={selectedShow} />
 *
 * Props:
 *   showId  — UUID of the currently selected show
 *   show    — show object { id, title, description, ... }
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ProducerModeFrame({ showId, show }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [characterState, setCharacterState] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!showId) return;
    fetchStats();
    fetchCharacterState();
  }, [showId]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const [epRes, evRes, goalRes, wardRes] = await Promise.allSettled([
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`),
        api.get(`/api/v1/world/${showId}/events`),
        api.get(`/api/v1/world/${showId}/goals`),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`),
      ]);

      const ep   = epRes.status   === 'fulfilled' ? epRes.value.data   : null;
      const ev   = evRes.status   === 'fulfilled' ? evRes.value.data   : null;
      const goal = goalRes.status === 'fulfilled' ? goalRes.value.data : null;
      const ward = wardRes.status === 'fulfilled' ? wardRes.value.data : null;

      const episodes = ep?.episodes || ep?.data || [];
      const events   = ev?.events   || [];
      const goals    = goal?.goals  || [];
      const wardrobe = ward?.data   || ward?.items || ward?.wardrobe || [];

      setStats({
        episodes:      Array.isArray(episodes) ? episodes.length : 0,
        evaluated:     Array.isArray(episodes) ? episodes.filter(e => e.evaluation_status === 'accepted').length : 0,
        events:        Array.isArray(events)   ? events.length   : 0,
        goals:         Array.isArray(goals)    ? goals.length    : 0,
        goalsActive:   Array.isArray(goals)    ? goals.filter(g => g.status === 'active').length : 0,
        wardrobe:      Array.isArray(wardrobe) ? wardrobe.length : 0,
        wardrobeOwned: Array.isArray(wardrobe) ? wardrobe.filter(i => i.is_owned).length : 0,
      });
    } catch (e) {
      console.error('ProducerModeFrame stats error:', e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchCharacterState() {
    try {
      const res = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
      const data = res.data;
      setCharacterState(data?.characterState || data?.character_state || data);
    } catch {
      // character state optional
    }
  }

  const statCards = [
    { emoji: '📋', value: stats?.episodes ?? '—', label: 'EPISODES', sub: stats ? `${stats.evaluated} evaluated` : '' },
    { emoji: '💝', value: stats?.events   ?? '—', label: 'EVENTS',   sub: 'in library' },
    { emoji: '🎯', value: stats?.goals    ?? '—', label: 'GOALS',    sub: stats ? `${stats.goalsActive} active` : '' },
    { emoji: '👗', value: stats?.wardrobe ?? '—', label: 'WARDROBE', sub: stats ? `${stats.wardrobeOwned} owned` : '' },
  ];

  const quickLinks = [
    { emoji: '🌍', title: 'World Admin',      desc: 'World rules, economy, canon',  route: `/shows/${showId}/world?from=universe` },
    { emoji: '📋', title: 'Episode Ledger',    desc: 'All episodes with scores',     route: `/shows/${showId}/world?tab=episodes&from=universe` },
    { emoji: '💝', title: 'Events Library',    desc: 'Create & inject events',       route: `/shows/${showId}/world?tab=events&from=universe` },
    { emoji: '🎯', title: 'Career Goals',      desc: 'Goal management',              route: `/shows/${showId}/world?tab=goals&from=universe` },
    { emoji: '👗', title: 'Wardrobe',           desc: 'Browse & manage items',        route: `/shows/${showId}/world?tab=wardrobe&from=universe` },
    { emoji: '👑', title: 'Characters Admin',   desc: 'Lala stats & state',           route: `/shows/${showId}/world?tab=characters&from=universe` },
    { emoji: '⚡', title: 'Quick Create',       desc: 'New episode in 30 seconds',    route: `/shows/${showId}/quick-episode` },
    { emoji: '⚙️', title: 'Show Settings',     desc: 'Config & advanced tools',      route: `/shows/${showId}/settings` },
  ];

  const lalaStats = characterState ? [
    { label: 'Coins',       value: characterState.coins       ?? 0, max: null, color: '#f59e0b' },
    { label: 'Reputation',  value: characterState.reputation  ?? 0, max: 10,   color: '#8b5cf6' },
    { label: 'Brand Trust', value: characterState.brand_trust ?? 0, max: 10,   color: '#3b82f6' },
    { label: 'Influence',   value: characterState.influence   ?? 0, max: 10,   color: '#10b981' },
    { label: 'Stress',      value: characterState.stress      ?? 0, max: 10,   color: '#ef4444' },
  ] : [];

  return (
    <div style={st.frame}>

      {/* ── Header ── */}
      <div style={st.header}>
        <div>
          <div style={st.headerLabel}>PRODUCER MODE</div>
          <div style={st.headerTitle}>
            🌍 {show?.title || show?.name || 'Show'} — Control Center
          </div>
          <div style={st.headerSub}>World rules, economy, canon &amp; game state</div>
        </div>
        <button
          style={st.primaryBtn}
          onClick={() => navigate(`/shows/${showId}/world?from=universe`)}
        >
          Open World Admin →
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={st.statGrid}>
        {statCards.map((c) => (
          <div key={c.label} style={st.statCard}>
            <div style={st.statEmoji}>{c.emoji}</div>
            <div style={st.statValue}>
              {loadingStats ? <span style={st.skeleton} /> : c.value}
            </div>
            <div style={st.statLabel}>{c.label}</div>
            {c.sub && <div style={st.statSub}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Lala Character State ── */}
      {characterState && (
        <div style={st.section}>
          <div style={st.sectionTitle}>🎭 Lala's Current State</div>
          <div style={st.lalaGrid}>
            {lalaStats.map(ls => (
              <div key={ls.label} style={st.lalaCard}>
                <div style={st.lalaLabel}>{ls.label}</div>
                <div style={{ ...st.lalaValue, color: ls.color }}>
                  {ls.max ? `${ls.value} / ${ls.max}` : ls.value}
                </div>
                {ls.max && (
                  <div style={st.barTrack}>
                    <div
                      style={{
                        ...st.barFill,
                        width: `${Math.min((ls.value / ls.max) * 100, 100)}%`,
                        background: ls.color,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Links ── */}
      <div style={st.section}>
        <div style={st.sectionTitle}>Quick Links</div>
        <div style={st.linkGrid}>
          {quickLinks.map(l => (
            <button
              key={l.title}
              style={st.linkCard}
              onClick={() => navigate(l.route)}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              <div style={st.linkEmoji}>{l.emoji}</div>
              <div style={st.linkTitle}>{l.title}</div>
              <div style={st.linkDesc}>{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Styles (light theme, matches existing app cards) ──────────────────────

const st = {
  frame: {
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: '#6b7280',
  },
  primaryBtn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // stat cards
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #f3f4f6',
    borderRadius: 14,
    padding: '28px 20px',
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 36, fontWeight: 800, color: '#111827', lineHeight: 1 },
  statLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#6b7280', marginTop: 4 },
  statSub:   { fontSize: 12, color: '#9ca3af' },
  skeleton: {
    display: 'inline-block',
    width: 48,
    height: 36,
    background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
    backgroundSize: '200% 100%',
    borderRadius: 6,
  },

  // lala state
  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#111827' },
  lalaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 12,
  },
  lalaCard: {
    background: '#fff',
    border: '1px solid #f3f4f6',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  lalaLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.08em', marginBottom: 6 },
  lalaValue: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  barTrack:  { height: 4, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },

  // quick links
  linkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
  },
  linkCard: {
    background: '#fff',
    border: '1px solid #f3f4f6',
    borderRadius: 14,
    padding: '24px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  linkEmoji: { fontSize: 26, marginBottom: 4 },
  linkTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },
  linkDesc:  { fontSize: 12, color: '#9ca3af' },
};
