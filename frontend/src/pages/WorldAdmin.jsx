/**
 * WorldAdmin — Game Master Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * Shows the state of the universe for a show:
 *   - Character stats (live snapshot)
 *   - Episode ledger (all episodes with tier/score/deltas)
 *   - Override history
 *   - Economy summary
 *   - Decision log (training data viewer)
 *   - Stat history (changes over episodes)
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const STAT_ICONS = {
  coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰',
};

const TIER_COLORS = {
  slay: '#FFD700', pass: '#22c55e', mid: '#eab308', fail: '#dc2626',
};

const TIER_EMOJIS = {
  slay: '👑', pass: '✨', mid: '😐', fail: '💔',
};


function WorldAdmin() {
  const { id: showId } = useParams();
  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, [showId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load show
      try {
        const showRes = await api.get(`/api/v1/shows/${showId}`);
        setShow(showRes.data);
      } catch (e) { setShow({ id: showId, title: 'Show' }); }

      // Load character state
      try {
        const stateRes = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
        setCharState(stateRes.data);
      } catch (e) { /* no state yet */ }

      // Load episodes
      try {
        const epRes = await api.get(`/api/v1/episodes?show_id=${showId}&limit=100`);
        const epList = epRes.data?.episodes || epRes.data?.data || epRes.data || [];
        setEpisodes(Array.isArray(epList) ? epList : []);
      } catch (e) { setEpisodes([]); }

      // Load state history
      try {
        const histRes = await api.get(`/api/v1/world/${showId}/history`);
        setStateHistory(histRes.data?.history || []);
      } catch (e) { setStateHistory([]); }

      // Load decisions
      try {
        const decRes = await api.get(`/api/v1/world/${showId}/decisions`);
        setDecisions(decRes.data?.decisions || []);
      } catch (e) { setDecisions([]); }
    } catch (err) {
      console.error('Failed to load world data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute derived data
  const evaluatedEpisodes = episodes.filter(ep => ep.evaluation_status === 'accepted' || ep.evaluation_status === 'computed');
  const acceptedEpisodes = episodes.filter(ep => ep.evaluation_status === 'accepted');
  const totalCoinsSpent = acceptedEpisodes.reduce((sum, ep) => {
    const deltas = ep.evaluation_json?.stat_deltas || {};
    return sum + Math.abs(Math.min(deltas.coins || 0, 0));
  }, 0);
  const totalCoinsEarned = acceptedEpisodes.reduce((sum, ep) => {
    const deltas = ep.evaluation_json?.stat_deltas || {};
    return sum + Math.max(deltas.coins || 0, 0);
  }, 0);
  const tierCounts = acceptedEpisodes.reduce((acc, ep) => {
    const tier = ep.evaluation_json?.tier_final;
    if (tier) acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  const overrideCount = acceptedEpisodes.filter(ep =>
    (ep.evaluation_json?.overrides || []).length > 0
  ).length;

  if (loading) {
    return <div style={S.page}><div style={S.center}>Loading world data...</div></div>;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <Link to={`/shows/${showId}`} style={S.backLink}>← Back to Show</Link>
          <h1 style={S.title}>🌍 World Admin</h1>
          <p style={S.subtitle}>{show?.title || 'Show'} — Game Master Dashboard</p>
        </div>
        <button onClick={loadData} style={S.refreshBtn}>🔄 Refresh</button>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {['overview', 'episodes', 'decisions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? S.tabActive : S.tab}
          >
            {tab === 'overview' ? '📊 Overview' : tab === 'episodes' ? '📋 Episode Ledger' : '🧠 Decision Log'}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          {/* Character Stats */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>👑 Lala's Current Stats</h2>
            {charState ? (
              <div style={S.statsRow}>
                {Object.entries(charState.state || {}).map(([key, val]) => (
                  <div key={key} style={S.statBox}>
                    <div style={S.statEmoji}>{STAT_ICONS[key] || '📊'}</div>
                    <div style={S.statValue(key, val)}>{val}</div>
                    <div style={S.statName}>{key.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={S.muted}>No character state yet. Evaluate an episode to initialize.</p>
            )}
          </div>

          {/* Quick Stats */}
          <div style={S.quickStatsGrid}>
            <div style={S.quickStat}>
              <div style={S.quickStatValue}>{episodes.length}</div>
              <div style={S.quickStatLabel}>Total Episodes</div>
            </div>
            <div style={S.quickStat}>
              <div style={S.quickStatValue}>{acceptedEpisodes.length}</div>
              <div style={S.quickStatLabel}>Evaluated</div>
            </div>
            <div style={S.quickStat}>
              <div style={S.quickStatValue}>{overrideCount}</div>
              <div style={S.quickStatLabel}>Overrides Used</div>
            </div>
            <div style={S.quickStat}>
              <div style={S.quickStatValue}>{totalCoinsSpent}</div>
              <div style={S.quickStatLabel}>Coins Spent</div>
            </div>
          </div>

          {/* Tier Distribution */}
          {Object.keys(tierCounts).length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏆 Tier Distribution</h2>
              <div style={S.tierGrid}>
                {['slay', 'pass', 'mid', 'fail'].map(tier => (
                  <div key={tier} style={S.tierBox(tier)}>
                    <span style={S.tierEmoji}>{TIER_EMOJIS[tier]}</span>
                    <span style={S.tierCount}>{tierCounts[tier] || 0}</span>
                    <span style={S.tierLabel}>{tier.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stat History */}
          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📈 Stat History</h2>
              <div style={S.historyTable}>
                <div style={S.historyHeader}>
                  <span style={S.historyCol}>Episode</span>
                  <span style={S.historyCol}>Source</span>
                  <span style={S.historyCol}>Deltas</span>
                  <span style={S.historyCol}>Date</span>
                </div>
                {stateHistory.slice(0, 20).map((h, i) => {
                  const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                  return (
                    <div key={i} style={S.historyRow}>
                      <span style={S.historyCol}>{h.episode_id?.substring(0, 8)}...</span>
                      <span style={S.historyCol}>
                        <span style={S.sourceBadge(h.source)}>{h.source}</span>
                      </span>
                      <span style={S.historyCol}>
                        {Object.entries(deltas || {}).filter(([,v]) => v !== 0).map(([k, v]) => (
                          <span key={k} style={S.deltaBadge(v)}>
                            {STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}
                          </span>
                        ))}
                      </span>
                      <span style={{ ...S.historyCol, color: '#94a3b8', fontSize: 11 }}>
                        {new Date(h.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ EPISODES TAB ═══ */}
      {activeTab === 'episodes' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>📋 Episode Ledger</h2>
            <div style={S.ledgerTable}>
              <div style={S.ledgerHeader}>
                <span style={{ ...S.ledgerCol, flex: '0 0 40px' }}>#</span>
                <span style={{ ...S.ledgerCol, flex: 2 }}>Title</span>
                <span style={S.ledgerCol}>Tier</span>
                <span style={S.ledgerCol}>Score</span>
                <span style={S.ledgerCol}>Overrides</span>
                <span style={S.ledgerCol}>Status</span>
                <span style={S.ledgerCol}>Actions</span>
              </div>
              {episodes.map((ep, i) => {
                const evalJson = ep.evaluation_json;
                const tier = evalJson?.tier_final;
                const score = evalJson?.score;
                const overrides = (evalJson?.overrides || []).length;
                return (
                  <div key={ep.id} style={S.ledgerRow}>
                    <span style={{ ...S.ledgerCol, flex: '0 0 40px', fontWeight: 700 }}>{ep.episode_number || i + 1}</span>
                    <span style={{ ...S.ledgerCol, flex: 2, fontWeight: 600 }}>{ep.title || 'Untitled'}</span>
                    <span style={S.ledgerCol}>
                      {tier ? (
                        <span style={S.tierPill(tier)}>{TIER_EMOJIS[tier]} {tier.toUpperCase()}</span>
                      ) : '—'}
                    </span>
                    <span style={{ ...S.ledgerCol, fontWeight: 700 }}>{score ?? '—'}</span>
                    <span style={S.ledgerCol}>{overrides > 0 ? `${overrides} ⬆️` : '—'}</span>
                    <span style={S.ledgerCol}>
                      <span style={S.statusPill(ep.evaluation_status)}>
                        {ep.evaluation_status || 'draft'}
                      </span>
                    </span>
                    <span style={S.ledgerCol}>
                      <Link to={`/episodes/${ep.id}/evaluate`} style={S.ledgerLink}>Evaluate</Link>
                    </span>
                  </div>
                );
              })}
              {episodes.length === 0 && <div style={S.emptyRow}>No episodes yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DECISIONS TAB ═══ */}
      {activeTab === 'decisions' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧠 Decision Log</h2>
            <p style={S.muted}>Training data from your creative decisions. This powers future AI suggestions.</p>
            {decisions.length > 0 ? (
              <div style={S.decisionList}>
                {decisions.map((d, i) => {
                  const context = typeof d.context_json === 'string' ? JSON.parse(d.context_json) : d.context_json;
                  const decision = typeof d.decision_json === 'string' ? JSON.parse(d.decision_json) : d.decision_json;
                  return (
                    <div key={i} style={S.decisionRow}>
                      <div style={S.decisionHeader}>
                        <span style={S.decisionType}>{d.type?.replace(/_/g, ' ')}</span>
                        <span style={S.decisionSource}>{d.source}</span>
                        <span style={S.decisionTime}>{new Date(d.created_at).toLocaleString()}</span>
                      </div>
                      <div style={S.decisionBody}>
                        {context && <span style={S.decisionContext}>Context: {JSON.stringify(context)}</span>}
                        {decision && <span style={S.decisionChoice}>Decision: {JSON.stringify(decision)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={S.muted}>No decisions logged yet. Use the Script Editor and Evaluate page — decisions are recorded automatically.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── STYLES ───

const S = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  center: { textAlign: 'center', padding: 60, color: '#94a3b8' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  backLink: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 4px', fontSize: 28, fontWeight: 800, color: '#1a1a2e' },
  subtitle: { margin: 0, color: '#64748b', fontSize: 14 },
  refreshBtn: { padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },

  tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 },
  tab: { padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' },
  tabActive: { padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: '2px solid #6366f1', color: '#6366f1', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  content: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 16px' },
  muted: { color: '#94a3b8', fontSize: 13 },

  // Stats
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statBox: { flex: '1 1 100px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, textAlign: 'center', minWidth: 100 },
  statEmoji: { fontSize: 24, marginBottom: 4 },
  statValue: (key, val) => ({
    fontSize: 28, fontWeight: 800,
    color: key === 'stress' ? (val >= 5 ? '#dc2626' : val >= 3 ? '#eab308' : '#1a1a2e')
      : key === 'coins' ? (val < 0 ? '#dc2626' : '#1a1a2e')
      : '#1a1a2e',
  }),
  statName: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 },

  // Quick stats
  quickStatsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  quickStat: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, textAlign: 'center' },
  quickStatValue: { fontSize: 24, fontWeight: 800, color: '#1a1a2e' },
  quickStatLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginTop: 4 },

  // Tier
  tierGrid: { display: 'flex', gap: 12 },
  tierBox: (tier) => ({
    flex: 1, padding: 16, borderRadius: 10, textAlign: 'center',
    background: (TIER_COLORS[tier] || '#ccc') + '15',
    border: `2px solid ${TIER_COLORS[tier] || '#ccc'}40`,
  }),
  tierEmoji: { fontSize: 24, display: 'block' },
  tierCount: { fontSize: 28, fontWeight: 800, display: 'block', color: '#1a1a2e' },
  tierLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 1 },

  // History
  historyTable: { fontSize: 13 },
  historyHeader: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' },
  historyRow: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' },
  historyCol: { flex: 1, minWidth: 0 },
  sourceBadge: (source) => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: source === 'override' ? '#fef3c7' : source === 'computed' ? '#eef2ff' : '#f1f5f9',
    color: source === 'override' ? '#92400e' : source === 'computed' ? '#4338ca' : '#64748b',
  }),
  deltaBadge: (val) => ({
    display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600, marginRight: 4,
    background: val > 0 ? '#f0fdf4' : '#fef2f2',
    color: val > 0 ? '#16a34a' : '#dc2626',
  }),

  // Ledger
  ledgerTable: { fontSize: 13 },
  ledgerHeader: { display: 'flex', gap: 8, padding: '10px 0', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' },
  ledgerRow: { display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' },
  ledgerCol: { flex: 1, minWidth: 0 },
  emptyRow: { padding: 20, textAlign: 'center', color: '#94a3b8' },
  tierPill: (tier) => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: (TIER_COLORS[tier] || '#ccc') + '20',
    color: TIER_COLORS[tier] || '#666',
  }),
  statusPill: (status) => ({
    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: status === 'accepted' ? '#f0fdf4' : status === 'computed' ? '#eef2ff' : '#f1f5f9',
    color: status === 'accepted' ? '#16a34a' : status === 'computed' ? '#6366f1' : '#94a3b8',
  }),
  ledgerLink: { color: '#6366f1', fontSize: 12, textDecoration: 'none', fontWeight: 500 },

  // Decisions
  decisionList: { display: 'flex', flexDirection: 'column', gap: 8 },
  decisionRow: { padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 },
  decisionHeader: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
  decisionType: { padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4338ca', textTransform: 'capitalize' },
  decisionSource: { padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, color: '#64748b' },
  decisionTime: { marginLeft: 'auto', fontSize: 11, color: '#94a3b8' },
  decisionBody: { display: 'flex', flexDirection: 'column', gap: 2 },
  decisionContext: { fontSize: 11, color: '#64748b', wordBreak: 'break-all' },
  decisionChoice: { fontSize: 11, color: '#1a1a2e', fontWeight: 500, wordBreak: 'break-all' },
};

export default WorldAdmin;
