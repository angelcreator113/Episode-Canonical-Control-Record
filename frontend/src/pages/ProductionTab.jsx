/**
 * ProductionTab.jsx
 * frontend/src/pages/ProductionTab.jsx
 *
 * Franchise OS / Game Director Dashboard
 *
 * Sections:
 *   1. HERO — Living World State header
 *   2. CHARACTER STATE — Visual meters (Reputation, Wealth, etc.)
 *   3. STORY ENGINE — Segmented episode browser with story cards
 *   4. STUDIO CONTROLS — Compact tool strip at bottom
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './ProductionTab.css';

/* ── Status group definitions ───────────────────────────────────── */
const SEGMENTS = [
  { key: 'all',       label: 'All',        icon: '📚', statuses: null },
  { key: 'active',    label: 'Active',     icon: '🔥', statuses: ['in_progress', 'in_build', 'editing'] },
  { key: 'draft',     label: 'Draft Queue', icon: '📝', statuses: ['draft'] },
  { key: 'review',    label: 'In Review',  icon: '👀', statuses: ['review', 'pending_review'] },
  { key: 'published', label: 'Published',  icon: '🚀', statuses: ['published', 'completed', 'aired'] },
  { key: 'archived',  label: 'Archived',   icon: '📦', statuses: ['archived', 'cancelled'] },
];

function statusGroup(status) {
  for (const seg of SEGMENTS) {
    if (seg.statuses && seg.statuses.includes(status)) return seg.key;
  }
  return 'draft';
}

function statusLabel(st) {
  return (st || 'draft').replace(/_/g, ' ');
}

function relTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── Mood / phase derivation from character state ───────────────── */
function deriveMood(cs) {
  if (!cs) return { mood: 'Unknown', moodIcon: '🌀', phase: 'Calibrating…' };
  const rep = cs.reputation ?? 5;
  const stress = cs.stress ?? 0;
  const inf = cs.influence ?? 5;
  const trust = cs.brand_trust ?? 5;

  let mood = 'Neutral', moodIcon = '🌿';
  if (rep >= 8 && stress <= 3) { mood = 'Rising Confidence'; moodIcon = '✨'; }
  else if (rep >= 6 && inf >= 6) { mood = 'In Momentum'; moodIcon = '🔥'; }
  else if (stress >= 7) { mood = 'Under Pressure'; moodIcon = '🌊'; }
  else if (rep <= 3) { mood = 'Rebuilding'; moodIcon = '🌱'; }
  else if (trust >= 8) { mood = 'Trusted Authority'; moodIcon = '👑'; }

  let phase = 'Early Arc';
  if (rep >= 8 && inf >= 7) phase = 'Peak Fame Arc';
  else if (rep >= 5) phase = 'Rising Arc';
  else if (rep <= 3 && stress >= 5) phase = 'Crisis Arc';

  return { mood, moodIcon, phase };
}

function deriveEconomy(cs) {
  if (!cs) return 'Unknown';
  const coins = cs.coins ?? 0;
  if (coins >= 200) return 'Thriving';
  if (coins >= 100) return 'Stable';
  if (coins >= 30) return 'Modest';
  return 'Strained';
}

function deriveCanon(episodeCount, evaluatedCount) {
  if (!episodeCount) return 'Initializing';
  const ratio = evaluatedCount / episodeCount;
  if (ratio >= 0.7) return 'Strong';
  if (ratio >= 0.4) return 'Developing';
  return 'Fragile';
}

/* ── Impact forecast (simple heuristic) ─────────────────────────── */
function impactForecast(ep) {
  const cats = ep.categories || [];
  const forecast = [];
  if (cats.includes('romance') || cats.includes('relationship')) forecast.push('+Romance');
  if (cats.includes('career') || cats.includes('business'))      forecast.push('+Career');
  if (cats.includes('drama') || cats.includes('conflict'))       forecast.push('+Drama');
  if (cats.includes('fashion') || cats.includes('wardrobe'))     forecast.push('+Brand');
  if (ep.evaluation_json?.score > 70) forecast.push('+Reputation');
  if (forecast.length === 0) return null;
  return forecast.slice(0, 3).join(' / ');
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function ProductionTab({ shows, universeId, onChanged, showToast, isMobile, isTablet }) {
  const navigate = useNavigate();

  const [stats, setStats]               = useState(null);
  const [characterState, setCharState]   = useState(null);
  const [loadingStats, setLoadingStats]  = useState(true);

  const [episodes, setEpisodes]          = useState([]);
  const [loadingEps, setLoadingEps]      = useState(false);
  const [segment, setSegment]            = useState('all');
  const [epSearch, setEpSearch]          = useState('');

  const safeShows = Array.isArray(shows) ? shows : [];
  const linkedShows = safeShows.filter(sh =>
    sh.universe_id === universeId || safeShows.length <= 3
  );
  const show = linkedShows[0] || null; // primary show
  const showId = show?.id;
  const showName = show?.title || show?.name || 'Show';

  /* ── Fetch stats + character state ──────────────────────────── */
  useEffect(() => {
    if (!showId) return;
    (async () => {
      setLoadingStats(true);
      try {
        const [epRes, evRes, goalRes] = await Promise.allSettled([
          api.get(`/api/v1/episodes?show_id=${showId}&limit=100`),
          api.get(`/api/v1/world/${showId}/events`),
          api.get(`/api/v1/world/${showId}/goals`),
        ]);
        const ep   = epRes.status   === 'fulfilled' ? epRes.value.data   : null;
        const ev   = evRes.status   === 'fulfilled' ? evRes.value.data   : null;
        const goal = goalRes.status === 'fulfilled' ? goalRes.value.data : null;

        const eps    = ep?.episodes || ep?.data || [];
        const events = ev?.events   || [];
        const goals  = goal?.goals  || [];

        setStats({
          episodes:  Array.isArray(eps)    ? eps.length  : 0,
          evaluated: Array.isArray(eps)    ? eps.filter(e => e.evaluation_status === 'accepted').length : 0,
          events:    Array.isArray(events) ? events.length : 0,
          goals:     Array.isArray(goals)  ? goals.length  : 0,
          goalsActive: Array.isArray(goals) ? goals.filter(g => g.status === 'active').length : 0,
        });
      } catch { /* ignore */ } finally { setLoadingStats(false); }
    })();
    // character state
    (async () => {
      try {
        const res = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
        const d = res.data;
        setCharState(d?.characterState || d?.character_state || d);
      } catch { /* optional */ }
    })();
  }, [showId]);

  /* ── Fetch episodes ─────────────────────────────────────────── */
  useEffect(() => {
    if (!showId) { setEpisodes([]); return; }
    setLoadingEps(true);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`/api/v1/episodes?show_id=${showId}&limit=100`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        const list = data?.data || data?.episodes || [];
        setEpisodes(Array.isArray(list) ? list : []);
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEps(false));
  }, [showId]);

  /* ── Filtered / sorted episodes ─────────────────────────────── */
  const filteredEps = episodes.filter(ep => {
    if (segment !== 'all') {
      const seg = SEGMENTS.find(s => s.key === segment);
      if (seg?.statuses && !seg.statuses.includes(ep.status)) return false;
    }
    if (epSearch.trim()) {
      const q = epSearch.toLowerCase();
      if (!(ep.title || '').toLowerCase().includes(q) && !String(ep.episode_number).includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  /* ── Segment counts ─────────────────────────────────────────── */
  const segCounts = {};
  for (const seg of SEGMENTS) {
    if (seg.key === 'all') { segCounts.all = episodes.length; continue; }
    segCounts[seg.key] = episodes.filter(ep => seg.statuses.includes(ep.status)).length;
  }

  /* ── Derived world signals ──────────────────────────────────── */
  const { mood, moodIcon, phase } = deriveMood(characterState);
  const economy = deriveEconomy(characterState);
  const canon = deriveCanon(stats?.episodes, stats?.evaluated);

  /* ── Character meters ───────────────────────────────────────── */
  const meters = characterState ? [
    { key: 'reputation', label: 'Reputation',       value: characterState.reputation  ?? 0, max: 10, icon: '👑' },
    { key: 'wealth',     label: 'Wealth',            value: characterState.coins       ?? 0, max: null, icon: '💰' },
    { key: 'career',     label: 'Brand Trust',       value: characterState.brand_trust ?? 0, max: 10, icon: '📊' },
    { key: 'heat',       label: 'Relationship Heat', value: characterState.stress      ?? 0, max: 10, icon: '❤️‍🔥' },
    { key: 'influence',  label: 'Influence',         value: characterState.influence   ?? 0, max: 10, icon: '🌟' },
    { key: 'stress',     label: 'Stress',            value: characterState.stress      ?? 0, max: 10, icon: '⚡' },
  ] : [];

  /* ── Studio tools ───────────────────────────────────────────── */
  const studioTools = showId ? [
    { icon: '🌍', label: 'World Admin',      route: `/shows/${showId}/world?from=universe` },
    { icon: '📋', label: 'Episode Ledger',    route: `/shows/${showId}/world?tab=episodes&from=universe` },
    { icon: '💝', label: 'Events Library',    route: `/shows/${showId}/world?tab=events&from=universe` },
    { icon: '👑', label: 'Characters Admin',  route: `/shows/${showId}/world?tab=characters&from=universe` },
    { icon: '⚙️', label: 'Show Settings',    route: `/shows/${showId}/settings` },
    { icon: '👗', label: 'Wardrobe',          route: `/shows/${showId}/world?tab=wardrobe&from=universe` },
  ] : [];

  /* ── No shows fallback ──────────────────────────────────────── */
  if (!show) {
    return (
      <div className="prod-tab">
        <div className="prod-empty">
          <div className="prod-empty-title">No shows linked to this universe yet.</div>
          <div className="prod-empty-hint">Shows are created in the main Prime Studios dashboard and linked here.</div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════ */
  return (
    <div className="prod-tab">

      {/* ═══ HERO — Living World State ═══ */}
      <div className="prod-hero">
        <div className="prod-hero-left">
          <div className="prod-hero-universe">
            <span className="world-icon">🌍</span>
            LalaVerse
            <span className="prod-hero-season-badge">
              Season 1 • {phase}
            </span>
          </div>

          <div className="prod-hero-state-grid">
            <div className="prod-hero-state-item">
              <span className="state-icon">{moodIcon}</span>
              <span className="state-label">Mood:</span>
              <span className="state-value">{mood}</span>
            </div>
            <div className="prod-hero-state-item">
              <span className="state-icon">💎</span>
              <span className="state-label">Economy:</span>
              <span className="state-value">{economy}</span>
            </div>
            <div className="prod-hero-state-item">
              <span className="state-icon">🔒</span>
              <span className="state-label">Canon:</span>
              <span className="state-value">{canon}</span>
            </div>
            <div className="prod-hero-state-item">
              <span className="state-icon">📋</span>
              <span className="state-label">Episodes:</span>
              <span className="state-value">{loadingStats ? '…' : stats?.episodes ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="prod-hero-right">
          <button
            className="prod-hero-btn primary-action"
            onClick={() => navigate(`/shows/${showId}/world?from=universe`)}
          >
            🌍 Enter World Admin
          </button>
          <button
            className="prod-hero-btn"
            onClick={() => navigate(`/shows/${showId}/world?tab=episodes&from=universe`)}
          >
            📊 View Timeline
          </button>
          <button
            className="prod-hero-btn"
            onClick={() => navigate(`/shows/${showId}/world?tab=events&from=universe`)}
          >
            ⚡ Inject Event
          </button>
        </div>
      </div>

      {/* ═══ CHARACTER STATE PANEL ═══ */}
      {characterState && (
        <div className="prod-character-panel">
          <div className="prod-character-title">🎭 Lala's Current State</div>
          <div className="prod-character-meters">
            {meters.map(m => (
              <div key={m.key} className="prod-meter" data-stat={m.key}>
                <div className="prod-meter-header">
                  <span className="prod-meter-label">{m.icon} {m.label}</span>
                  <span className="prod-meter-value">
                    {m.max ? `${m.value}/${m.max}` : m.value}
                  </span>
                </div>
                {m.max && (
                  <div className="prod-meter-track">
                    <div
                      className="prod-meter-fill"
                      style={{ width: `${Math.min((m.value / m.max) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STORY ENGINE ═══ */}
      <div className="prod-story-engine">
        {/* Header */}
        <div className="prod-story-header">
          <div className="prod-story-title">
            📖 Story Engine
          </div>
          <button
            className="prod-new-ep-btn"
            onClick={() => navigate(`/shows/${showId}/quick-episode`)}
          >
            + New Episode
          </button>
        </div>

        {/* Segmented Controls */}
        <div className="prod-segment-bar">
          {SEGMENTS.map(seg => {
            const count = segCounts[seg.key] || 0;
            if (seg.key !== 'all' && count === 0) return null;
            return (
              <button
                key={seg.key}
                className={`prod-segment ${segment === seg.key ? 'active' : ''}`}
                onClick={() => setSegment(seg.key)}
              >
                {seg.icon} {seg.label}
                <span className="seg-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="prod-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="prod-ep-search"
            placeholder="Search episodes…"
            value={epSearch}
            onChange={e => setEpSearch(e.target.value)}
          />
        </div>

        {/* Episode Cards */}
        {loadingEps ? (
          <div className="prod-loading">Loading episodes…</div>
        ) : filteredEps.length === 0 ? (
          <div className="prod-empty">
            <div className="prod-empty-title">
              {episodes.length === 0 ? 'No episodes yet' : 'No matching episodes'}
            </div>
            <div className="prod-empty-hint">
              {episodes.length === 0 ? 'Create your first episode to start building the story.' : 'Try a different filter or search.'}
            </div>
          </div>
        ) : (
          <div className="prod-ep-cards">
            {filteredEps.map(ep => {
              const group = statusGroup(ep.status);
              const forecast = impactForecast(ep);
              return (
                <div
                  key={ep.id}
                  className="prod-ep-card"
                  onClick={() => navigate(`/episodes/${ep.id}`)}
                >
                  <div className={`prod-ep-accent status-${group}`} />
                  <div className="prod-ep-body">
                    <span className="prod-ep-number">
                      Ep {ep.episode_number || '?'}
                    </span>
                    <div className="prod-ep-info">
                      <div className="prod-ep-name">
                        {ep.title || 'Untitled'}
                      </div>
                      <div className="prod-ep-meta">
                        <span className={`meta-status ${group}`}>
                          {statusLabel(ep.status)}
                        </span>
                        {relTime(ep.updated_at) && (
                          <>
                            <span className="meta-dot" />
                            <span>{relTime(ep.updated_at)}</span>
                          </>
                        )}
                        {forecast && (
                          <>
                            <span className="meta-dot" />
                            <span className="prod-ep-impact">{forecast}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="prod-ep-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="prod-ep-action-btn"
                        onClick={() => navigate(`/episodes/${ep.id}/scene-composer`)}
                        title="Scene Composer"
                      >🎬</button>
                      <button
                        className="prod-ep-action-btn"
                        onClick={() => navigate(`/episodes/${ep.id}/timeline`)}
                        title="Timeline"
                      >⏱️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ STUDIO CONTROLS ═══ */}
      <div className="prod-studio-strip">
        <div className="prod-studio-label">⚙ Studio Controls</div>
        <div className="prod-studio-grid">
          {studioTools.map(t => (
            <button
              key={t.label}
              className="prod-studio-btn"
              onClick={() => navigate(t.route)}
            >
              <span className="studio-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
