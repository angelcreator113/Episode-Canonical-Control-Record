/**
 * WorldAdmin v2 — Producer Mode Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * 7 Tabs:
 *   1. Overview — Stats, tier distribution, canon timeline
 *   2. Episode Ledger — All episodes with tier/score/deltas
 *   3. Events Library — Reusable event catalog (create, edit, inject)
 *   4. Career Goals — Track progression goals
 *   5. Wardrobe — Tier cards, filters, item grid with Lala reactions
 *   6. Characters — View/edit Lala stats, character rules, stat ledger
 *   7. Decision Log — Training data from creative decisions
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
const TIER_COLORS = { slay: '#FFD700', pass: '#22c55e', mid: '#eab308', fail: '#dc2626' };
const TIER_EMOJIS = { slay: '👑', pass: '✨', mid: '😐', fail: '💔' };
const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };
const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];
const WARDROBE_TIER_COLORS = { basic: '#94a3b8', mid: '#6366f1', luxury: '#eab308', elite: '#ec4899' };
const WARDROBE_TIER_ICONS = { basic: '👟', mid: '👠', luxury: '💎', elite: '👑' };
const WARDROBE_CATEGORIES = ['all', 'dress', 'top', 'bottom', 'shoes', 'accessories', 'jewelry', 'perfume'];
const CAT_ICONS = { all: '🏷️', dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessories: '🎀', jewelry: '💍', perfume: '🌸' };

const EMPTY_EVENT = {
  name: '', event_type: 'invite', host: '', host_brand: '', description: '',
  prestige: 5, cost_coins: 100, strictness: 5,
  deadline_type: 'medium', dress_code: '', dress_code_keywords: [], location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
  is_paid: 'no', payment_amount: 0, career_tier: 1,
  career_milestone: '', fail_consequence: '', success_unlock: '',
  requirements: {},
};

const TABS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'episodes', icon: '📋', label: 'Episode Ledger' },
  { key: 'events', icon: '💌', label: 'Events Library' },
  { key: 'goals', icon: '🎯', label: 'Career Goals' },
  { key: 'wardrobe', icon: '👗', label: 'Wardrobe' },
  { key: 'characters', icon: '👑', label: 'Characters' },
  { key: 'decisions', icon: '🧠', label: 'Decision Log' },
];

function WorldAdmin() {
  const { id: showId } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [goals, setGoals] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [wardrobeFilter, setWardrobeFilter] = useState('all');       // all | owned | locked
  const [wardrobeTierFilter, setWardrobeTierFilter] = useState('all'); // all | basic | mid | luxury | elite
  const [wardrobeCatFilter, setWardrobeCatFilter] = useState('all');   // all | dress | top | ...
  const [seedingWardrobe, setSeedingWardrobe] = useState(false);
  const [editingWardrobeItem, setEditingWardrobeItem] = useState(null);   // item object or null
  const [wardrobeForm, setWardrobeForm] = useState({});
  const [savingWardrobe, setSavingWardrobe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [expandedEpisode, setExpandedEpisode] = useState(null);

  // Event editor state
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT });
  const [savingEvent, setSavingEvent] = useState(false);
  const [injectTarget, setInjectTarget] = useState(null);
  const [injecting, setInjecting] = useState(false);
  const [injectError, setInjectError] = useState(null);
  const [injectSuccess, setInjectSuccess] = useState(null); // { eventId, message }
  const [toast, setToast] = useState(null);
  const [generateTarget, setGenerateTarget] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedEpisodeId, setLastGeneratedEpisodeId] = useState(null);

  // Character editor state
  const [editingStats, setEditingStats] = useState(false);
  const [statForm, setStatForm] = useState({});
  const [savingStats, setSavingStats] = useState(false);

  // Goal editor state
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '#6366f1', description: '' });
  const [savingGoal, setSavingGoal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { loadData(); }, [showId]);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => { setSuccessMsg(null); setLastGeneratedEpisodeId(null); }, 5000); return () => clearTimeout(t); }
  }, [successMsg]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        api.get(`/api/v1/shows/${showId}`).then(r => setShow(r.data)).catch(() => setShow({ id: showId, title: 'Show' })),
        api.get(`/api/v1/characters/lala/state?show_id=${showId}`).then(r => setCharState(r.data)).catch(() => {}),
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(r => {
          const list = r.data?.episodes || r.data?.data || r.data || [];
          setEpisodes(Array.isArray(list) ? list : []);
        }).catch(() => setEpisodes([])),
        api.get(`/api/v1/world/${showId}/history`).then(r => setStateHistory(r.data?.history || [])).catch(() => setStateHistory([])),
        api.get(`/api/v1/world/${showId}/decisions`).then(r => setDecisions(r.data?.decisions || [])).catch(() => setDecisions([])),
        api.get(`/api/v1/world/${showId}/events`).then(r => setWorldEvents(r.data?.events || [])).catch(() => setWorldEvents([])),
        api.get(`/api/v1/world/${showId}/goals`).then(r => setGoals(r.data?.goals || [])).catch(() => setGoals([])),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`).then(r => setWardrobeItems(r.data?.data || [])).catch(() => setWardrobeItems([])),
      ]);
    } finally { setLoading(false); }
  };

  // ─── EVENT CRUD ───
  const openNewEvent = () => { setEventForm({ ...EMPTY_EVENT }); setEditingEvent('new'); };
  const openEditEvent = (ev) => {
    setEventForm({
      ...EMPTY_EVENT, ...ev,
      is_paid: ev.is_free ? 'free' : ev.is_paid ? 'yes' : 'no',
      dress_code_keywords: Array.isArray(ev.dress_code_keywords) ? ev.dress_code_keywords : [],
    });
    setEditingEvent(ev.id);
  };

  const saveEvent = async () => {
    setSavingEvent(true); setError(null);
    try {
      const submitData = {
        ...eventForm,
        is_paid: eventForm.is_paid === 'yes',
        is_free: eventForm.is_paid === 'free',
        cost_coins: eventForm.is_paid === 'free' ? 0 : eventForm.cost_coins,
        dress_code_keywords: Array.isArray(eventForm.dress_code_keywords)
          ? eventForm.dress_code_keywords
          : (eventForm.dress_code_keywords || '').split(',').map(k => k.trim()).filter(Boolean),
      };
      if (editingEvent === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/events`, submitData);
        if (res.data.success) { setWorldEvents(p => [res.data.event, ...p]); setEditingEvent(null); setSuccessMsg('Event created!'); }
      } else {
        const res = await api.put(`/api/v1/world/${showId}/events/${editingEvent}`, submitData);
        if (res.data.success) { setWorldEvents(p => p.map(e => e.id === editingEvent ? res.data.event : e)); setEditingEvent(null); setSuccessMsg('Event updated!'); }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingEvent(false); }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try { await api.delete(`/api/v1/world/${showId}/events/${eventId}`); setWorldEvents(p => p.filter(e => e.id !== eventId)); setSuccessMsg('Deleted'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const injectEvent = async (eventId, episodeId) => {
    setInjecting(true); setInjectError(null); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/inject`, { episode_id: episodeId });
      if (res.data.success) {
        const ep = episodes.find(e => e.id === episodeId);
        const epLabel = ep ? `${ep.episode_number || '?'}. ${ep.title || 'Untitled'}` : 'episode';
        const msg = `✅ Injected into ${epLabel}`;
        setSuccessMsg(msg);
        // Show inline success in the inject panel briefly
        setInjectSuccess({ eventId, message: msg });
        // Show floating toast (visible regardless of scroll)
        setToast(msg);
        setTimeout(() => { setToast(null); }, 3000);
        // Close inject panel after a brief delay so user sees the confirmation
        setTimeout(() => { setInjectTarget(null); setInjectSuccess(null); }, 2000);
        // Update local event status to 'used'
        setWorldEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: 'used', times_used: (ev.times_used || 0) + 1, used_in_episode_id: episodeId } : ev));
      } else {
        const msg = res.data?.error || res.data?.message || 'Inject returned unexpected response';
        setInjectError(msg); setError(msg);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setInjectError(msg); setError(msg);
      console.error('Inject failed:', err.response?.status, msg);
    } finally { setInjecting(false); }
  };

  const generateScript = async (eventId, episodeId) => {
    setGenerating(true); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, { episode_id: episodeId });
      if (res.data.success) {
        setLastGeneratedEpisodeId(episodeId);
        setSuccessMsg(`Script generated! ${res.data.beat_count} beats, ${res.data.line_count} lines.`);
        setGenerateTarget(null);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setGenerating(false); }
  };

  // ─── GOAL CRUD ───
  const saveGoal = async () => {
    setSavingGoal(true); setError(null);
    try {
      if (editingGoal === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/goals`, goalForm);
        if (res.data.success) { setGoals(p => [res.data.goal, ...p]); setEditingGoal(null); setSuccessMsg('Goal created!'); }
        else setError(res.data.error);
      } else {
        const res = await api.put(`/api/v1/world/${showId}/goals/${editingGoal}`, goalForm);
        if (res.data.success) { setGoals(p => p.map(g => g.id === editingGoal ? res.data.goal : g)); setEditingGoal(null); setSuccessMsg('Goal updated!'); }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingGoal(false); }
  };

  const deleteGoal = async (goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    try { await api.delete(`/api/v1/world/${showId}/goals/${goalId}`); setGoals(p => p.filter(g => g.id !== goalId)); setSuccessMsg('Deleted'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const syncGoals = async () => {
    try {
      const res = await api.post(`/api/v1/world/${showId}/goals/sync`);
      if (res.data.success) {
        setSuccessMsg(`Synced ${res.data.synced} goals.${res.data.completed?.length ? ` 🎉 Completed: ${res.data.completed.map(c => c.title).join(', ')}` : ''}`);
        loadData();
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/suggest-events?limit=3`);
      if (res.data.success) setSuggestions(res.data.suggestions || []);
    } catch (e) { setSuggestions([]); }
  };
  const openStatEditor = () => { setStatForm({ ...charState?.state }); setEditingStats(true); };
  const saveStats = async () => {
    setSavingStats(true); setError(null);
    try {
      const res = await api.post(`/api/v1/characters/lala/state/update`, { show_id: showId, ...statForm, source: 'manual', notes: 'Manual edit from World Admin' });
      if (res.data.success) { setCharState(p => ({ ...p, state: res.data.state })); setEditingStats(false); setSuccessMsg('Stats updated!'); }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingStats(false); }
  };

  // ─── DERIVED ───
  const acceptedEpisodes = episodes.filter(ep => ep.evaluation_status === 'accepted');
  const tierCounts = acceptedEpisodes.reduce((acc, ep) => {
    const tier = ep.evaluation_json?.tier_final; if (tier) acc[tier] = (acc[tier] || 0) + 1; return acc;
  }, {});
  const overrideCount = acceptedEpisodes.filter(ep => (ep.evaluation_json?.overrides || []).length > 0).length;

  if (loading) return <div style={S.page}><div style={S.center}>Loading world data...</div></div>;

  return (
    <div style={S.page}>
      {/* Inject keyframes for toast animation */}
      <style>{`
        @keyframes toastPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes toastFade {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
      `}</style>
      {/* ─── HEADER ─── */}
      <div style={S.header}>
        <div>
          <Link to={`/shows/${showId}`} style={S.backLink}>← Back to Show</Link>
          <h1 style={S.title}>🌍 Producer Mode</h1>
          <p style={S.subtitle}>{show?.title || 'Show'} — World Rules &amp; Canon</p>
        </div>
        <button onClick={loadData} style={S.refreshBtn}>🔄 Refresh</button>
      </div>

      {error && <div style={S.errorBanner}>{error}<button onClick={() => setError(null)} style={S.xBtn}>✕</button></div>}
      {successMsg && (
        <div style={S.successBanner}>
          {successMsg}
          {lastGeneratedEpisodeId && (
            <Link to={`/episodes/${lastGeneratedEpisodeId}`} style={{ marginLeft: 12, color: '#16a34a', fontWeight: 700, textDecoration: 'underline' }}>
              → Go to Episode
            </Link>
          )}
        </div>
      )}

      {/* ─── TABS ─── */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={activeTab === t.key ? S.tabActive : S.tab}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════ OVERVIEW ════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>👑 Lala's Current State</h2>
            {charState ? (
              <div style={S.statsRow}>
                {Object.entries(charState.state || {}).map(([k, v]) => (
                  <div key={k} style={S.statBox}>
                    <div style={{ fontSize: 22 }}>{STAT_ICONS[k]}</div>
                    <div style={S.statVal(k, v)}>{v}</div>
                    <div style={S.statLbl}>{k.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            ) : <p style={S.muted}>No state yet. Evaluate an episode to initialize.</p>}
          </div>

          <div style={S.qGrid}>
            {[{ v: episodes.length, l: 'Episodes' }, { v: acceptedEpisodes.length, l: 'Evaluated' }, { v: overrideCount, l: 'Overrides' }, { v: worldEvents.length, l: 'Events' }].map((s, i) => (
              <div key={i} style={S.qBox}><div style={S.qVal}>{s.v}</div><div style={S.qLbl}>{s.l}</div></div>
            ))}
          </div>

          {Object.keys(tierCounts).length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏆 Tier Distribution</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                {['slay', 'pass', 'mid', 'fail'].map(tier => (
                  <div key={tier} style={{ flex: 1, padding: 14, borderRadius: 10, textAlign: 'center', background: TIER_COLORS[tier] + '12', border: `2px solid ${TIER_COLORS[tier]}30` }}>
                    <div style={{ fontSize: 22 }}>{TIER_EMOJIS[tier]}</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>{tierCounts[tier] || 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{tier.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📈 Canon Timeline</h2>
              {stateHistory.slice(0, 20).map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: h.source === 'override' ? '#eab308' : h.source === 'manual' ? '#dc2626' : '#6366f1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{h.episode_title || h.episode_id?.substring(0, 8)}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                          <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{new Date(h.created_at).toLocaleDateString()} · {h.source}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ EPISODE LEDGER ════════════════════════ */}
      {activeTab === 'episodes' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>📋 Episode Ledger</h2>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{episodes.length} episodes · {acceptedEpisodes.length} evaluated</div>
          </div>

          {episodes.map((ep, i) => {
            const ej = ep.evaluation_json;
            const tier = ej?.tier_final;
            const score = ej?.score;
            const isExpanded = expandedEpisode === ep.id;
            const epHistory = stateHistory.filter(h => h.episode_id === ep.id);
            const deltas = epHistory.length > 0 ? (typeof epHistory[0].deltas_json === 'string' ? JSON.parse(epHistory[0].deltas_json) : epHistory[0].deltas_json) : null;
            const stateAfter = epHistory.length > 0 ? (typeof epHistory[0].state_after_json === 'string' ? JSON.parse(epHistory[0].state_after_json) : epHistory[0].state_after_json) : null;
            const linkedEvent = worldEvents.find(ev => ep.script_content?.includes(ev.name));

            return (
              <div key={ep.id} style={{ background: '#fff', border: isExpanded ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: 12, marginBottom: 10, overflow: 'hidden', transition: 'border 0.2s' }}>
                {/* Row header — always visible */}
                <div onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#6366f1', flex: '0 0 36px' }}>
                    {ep.episode_number || i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{ep.title || 'Untitled'}</div>
                    {linkedEvent && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{EVENT_TYPE_ICONS[linkedEvent.event_type]} {linkedEvent.name}</div>}
                  </div>
                  {tier && <span style={S.tierPill(tier)}>{TIER_EMOJIS[tier]} {tier.toUpperCase()}</span>}
                  {score && <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '0 8px' }}>{score}</span>}
                  <span style={S.statusPill(ep.evaluation_status)}>{ep.evaluation_status || 'draft'}</span>
                  {deltas && (
                    <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                      {Object.entries(deltas).filter(([, v]) => v !== 0).slice(0, 3).map(([k, v]) => (
                        <span key={k} style={{ ...S.deltaBadge(v), fontSize: 10 }}>{STAT_ICONS[k]}{v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded case file */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>

                    {/* ── Stat Impact ── */}
                    {deltas && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Stat Impact</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                          {Object.entries(deltas).map(([k, v]) => {
                            const afterVal = stateAfter ? stateAfter[k] : null;
                            const beforeVal = afterVal !== null ? afterVal - v : null;
                            return (
                              <div key={k} style={{ padding: 10, background: v > 0 ? '#f0fdf4' : v < 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 14 }}>{STAT_ICONS[k]}</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                                {beforeVal !== null ? (
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    <span style={{ color: '#94a3b8' }}>{beforeVal}</span>
                                    <span style={{ color: '#64748b', margin: '0 3px' }}>→</span>
                                    <span style={{ color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#1a1a2e' }}>{afterVal}</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 14, fontWeight: 700, color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#94a3b8' }}>
                                    {v > 0 ? '+' : ''}{v}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Event Reference ── */}
                    {linkedEvent && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💌 Event</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{linkedEvent.name}</span>
                          <span style={S.eTag}>⭐ {linkedEvent.prestige}</span>
                          <span style={S.eTag}>🪙 {linkedEvent.cost_coins}</span>
                          <span style={S.eTag}>📏 {linkedEvent.strictness}</span>
                          {linkedEvent.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid</span>}
                          {linkedEvent.career_milestone && <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, color: '#4338ca' }}>🎯 {linkedEvent.career_milestone}</span>}
                        </div>
                        {linkedEvent.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 }}>{linkedEvent.narrative_stakes}</div>}
                      </div>
                    )}

                    {/* ── Evaluation Details ── */}
                    {ej && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Evaluation</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {ej.outfit_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Outfit Match</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.outfit_match}/25</div>
                            </div>
                          )}
                          {ej.accessory_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Accessory</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.accessory_match}/25</div>
                            </div>
                          )}
                          {ej.event_prestige_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Prestige</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.event_prestige_score}/30</div>
                            </div>
                          )}
                          {ej.timing_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Timing</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.timing_score}/20</div>
                            </div>
                          )}
                          {(ej.overrides || []).length > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fef3c7', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#92400e' }}>Overrides</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.overrides.length} ⬆️</div>
                            </div>
                          )}
                        </div>
                        {ej.narrative_line && (
                          <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569', fontStyle: 'italic', borderLeft: `3px solid ${TIER_COLORS[tier] || '#6366f1'}` }}>
                            "{ej.narrative_line}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Unlocks ── */}
                    {linkedEvent?.success_unlock && tier && (tier === 'slay' || tier === 'pass') && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✨ Unlocked</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {linkedEvent.success_unlock.split(',').map((u, ui) => (
                            <span key={ui} style={{ padding: '4px 10px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#92400e' }}>
                              ✨ {u.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                      <Link to={`/episodes/${ep.id}`} style={{ ...S.smBtn, textDecoration: 'none' }}>📝 Edit Episode</Link>
                      <Link to={`/episodes/${ep.id}/evaluate`} style={{ ...S.smBtn, textDecoration: 'none', background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' }}>🏆 Evaluate</Link>
                      {ep.script_content && <span style={{ ...S.smBtn, color: '#16a34a' }}>✅ Has Script ({(ep.script_content || '').split('\n').length} lines)</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {episodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No episodes yet</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Create an episode from the Show page, then come back here.</div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ EVENTS LIBRARY ════════════════════════ */}
      {activeTab === 'events' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>💌 Events Library</h2>
            <button onClick={openNewEvent} style={S.primaryBtn}>+ Create Event</button>
          </div>

          {/* Event editor */}
          {editingEvent && (
            <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{editingEvent === 'new' ? '✨ New Event' : '✏️ Edit Event'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <FG label="Event Name *" value={eventForm.name} onChange={v => setEventForm(p => ({ ...p, name: v }))} placeholder="Velour Society Garden Soirée" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))} style={S.sel}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <FG label="Host (who's hosting)" value={eventForm.host || ''} onChange={v => setEventForm(p => ({ ...p, host: v }))} placeholder="Velour Society, Fashion Week Committee" />
                <FG label="Brand Sponsor (optional)" value={eventForm.host_brand} onChange={v => setEventForm(p => ({ ...p, host_brand: v }))} placeholder="Velour, Chanel (leave empty if none)" />
                <FG label="Prestige (1-10)" value={eventForm.prestige} onChange={v => setEventForm(p => ({ ...p, prestige: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <FG label="Cost (coins)" value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} disabled={eventForm.is_paid === 'free'} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <FG label="Dress Code" value={eventForm.dress_code} onChange={v => setEventForm(p => ({ ...p, dress_code: v }))} placeholder="romantic couture" />
                <div>
                  <label style={S.fLabel}>Dress Code Keywords</label>
                  <input
                    type="text"
                    value={(eventForm.dress_code_keywords || []).join(', ')}
                    onChange={e => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                      setEventForm(p => ({ ...p, dress_code_keywords: keywords }));
                    }}
                    placeholder="romantic, garden, floral, soft"
                    style={S.sel}
                  />
                  {(eventForm.dress_code_keywords || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {eventForm.dress_code_keywords.map((kw, i) => (
                        <span key={i} style={{ padding: '2px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 11, color: '#4338ca', fontWeight: 600 }}>
                          {kw}
                          <button onClick={() => setEventForm(p => ({ ...p, dress_code_keywords: p.dress_code_keywords.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', marginLeft: 4, fontSize: 12 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={S.fLabel}>Browse Pool Bias</label>
                  <select value={eventForm.browse_pool_bias} onChange={e => setEventForm(p => ({ ...p, browse_pool_bias: e.target.value }))} style={S.sel}>
                    {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Career & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div>
                  <label style={S.fLabel}>Career Tier</label>
                  <select value={eventForm.career_tier} onChange={e => setEventForm(p => ({ ...p, career_tier: parseInt(e.target.value) }))} style={S.sel}>
                    <option value={1}>1 — Emerging (Rep 0-2)</option>
                    <option value={2}>2 — Rising (Rep 3-4)</option>
                    <option value={3}>3 — Established (Rep 5-6)</option>
                    <option value={4}>4 — Influential (Rep 7-8)</option>
                    <option value={5}>5 — Elite (Rep 9-10)</option>
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Event Cost Type</label>
                  <select value={eventForm.is_paid || 'no'} onChange={e => { const val = e.target.value; setEventForm(p => ({ ...p, is_paid: val, cost_coins: val === 'free' ? 0 : p.cost_coins })); }} style={S.sel}>
                    <option value="no">No — Lala pays to attend</option>
                    <option value="yes">Yes — Lala gets paid</option>
                    <option value="free">Free — No cost to attend</option>
                  </select>
                  {eventForm.is_paid === 'free' && <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>Free event — no cost.</div>}
                  {eventForm.is_paid === 'yes' && <div style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>Lala earns coins for attending.</div>}
                </div>
                <FG label="Payment (if paid)" value={eventForm.payment_amount} onChange={v => setEventForm(p => ({ ...p, payment_amount: parseInt(v) || 0 }))} type="number" min={0} />
              </div>

              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
              <FG label="Career Milestone" value={eventForm.career_milestone} onChange={v => setEventForm(p => ({ ...p, career_milestone: v }))} placeholder="First brand collaboration, first paid gig, etc." full />
              <FG label="On Fail" value={eventForm.fail_consequence} onChange={v => setEventForm(p => ({ ...p, fail_consequence: v }))} placeholder="What happens narratively if she fails..." full />
              <FG label="On Success → Unlocks" value={eventForm.success_unlock} onChange={v => setEventForm(p => ({ ...p, success_unlock: v }))} placeholder="What this opens up (future events, brand deals, etc.)" full />
              <FG label="Description" value={eventForm.description} onChange={v => setEventForm(p => ({ ...p, description: v }))} placeholder="Full event description..." textarea full />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingEvent(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveEvent} disabled={savingEvent || !eventForm.name} style={S.primaryBtn}>
                  {savingEvent ? '⏳...' : editingEvent === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
          )}

          {/* Events grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {worldEvents.map(ev => (
              <div key={ev.id} style={S.evCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[ev.event_type] || '📌'}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0, flex: 1 }}>{ev.name}</h3>
                  <span style={S.statusPill(ev.status)}>{ev.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  <span style={S.eTag}>⭐ {ev.prestige}</span>
                  <span style={S.eTag}>🪙 {ev.cost_coins}</span>
                  <span style={S.eTag}>📏 {ev.strictness}</span>
                  <span style={S.eTag}>⏰ {ev.deadline_type}</span>
                  {ev.dress_code && <span style={S.eTag}>👗 {ev.dress_code}</span>}
                </div>
                {(ev.host || ev.host_brand) && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🏛️ {ev.host}{ev.host_brand ? ` — ${ev.host_brand}` : ''}</div>}
                {(ev.career_tier || ev.is_paid || ev.is_free) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {ev.career_tier && <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#4338ca' }}>Tier {ev.career_tier}</span>}
                    {ev.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid {ev.payment_amount ? `(${ev.payment_amount} coins)` : ''}</span>}
                    {ev.is_free && <span style={{ padding: '2px 8px', background: '#f0f9ff', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#0284c7' }}>🎟️ Free</span>}
                    {!ev.is_paid && !ev.is_free && ev.cost_coins > 0 && <span style={{ padding: '2px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626' }}>Costs {ev.cost_coins} coins</span>}
                  </div>
                )}
                {Array.isArray(ev.dress_code_keywords) && ev.dress_code_keywords.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                    {ev.dress_code_keywords.map((kw, i) => (
                      <span key={i} style={{ padding: '1px 6px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, fontSize: 10, color: '#4338ca', fontWeight: 600 }}>{kw}</span>
                    ))}
                  </div>
                )}
                {ev.career_milestone && <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 4 }}>🎯 {ev.career_milestone}</div>}
                {ev.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.4 }}>{ev.narrative_stakes}</div>}
                {ev.location_hint && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>📍 {ev.location_hint}</div>}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  <button onClick={() => openEditEvent(ev)} style={S.smBtn}>✏️ Edit</button>
                  <button onClick={() => setInjectTarget(injectTarget === ev.id ? null : ev.id)} style={S.smBtn}>💉 Inject</button>
                  <button onClick={() => setGenerateTarget(generateTarget === ev.id ? null : ev.id)} style={S.smBtn}>📝 Generate</button>
                  <button onClick={() => deleteEvent(ev.id)} style={S.smBtnDanger}>🗑️</button>
                </div>
                {injectTarget === ev.id && (
                  <div style={{ marginTop: 8, padding: 10, background: injectSuccess?.eventId === ev.id ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: injectSuccess?.eventId === ev.id ? '2px solid #22c55e' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
                    {injectSuccess?.eventId === ev.id ? (
                      <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 700, padding: '8px 0', textAlign: 'center' }}>{injectSuccess.message}</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Inject into which episode?</div>
                        {injecting && <div style={{ fontSize: 12, color: '#6366f1', padding: '6px 0', fontWeight: 600 }}>⏳ Injecting...</div>}
                        {injectError && <div style={{ fontSize: 12, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 6, border: '1px solid #fecaca' }}>❌ {injectError}</div>}
                        {!injecting && episodes.map(ep => (
                          <button key={ep.id} onClick={() => injectEvent(ev.id, ep.id)} disabled={injecting} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#1a1a2e' }}>
                            {ep.episode_number || '?'}. {ep.title || 'Untitled'}
                          </button>
                        ))}
                        {!injecting && episodes.length === 0 && <span style={S.muted}>No episodes yet — create an episode first</span>}
                      </>
                    )}
                  </div>
                )}
                {generateTarget === ev.id && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>📝 Generate script for which episode?</div>
                    {episodes.map(ep => (
                      <button key={ep.id} onClick={() => generateScript(ev.id, ep.id)} disabled={generating}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#1a1a2e' }}>
                        {generating ? '⏳...' : `${ep.episode_number || '?'}. ${ep.title || 'Untitled'}`}
                      </button>
                    ))}
                    {episodes.length === 0 && <span style={S.muted}>No episodes</span>}
                  </div>
                )}
              </div>
            ))}
            {worldEvents.length === 0 && !editingEvent && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No events yet</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Create reusable events that inject directly into episode scripts.</div>
                <button onClick={openNewEvent} style={S.primaryBtn}>+ Create First Event</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════ CAREER GOALS ════════════════════════ */}
      {activeTab === 'goals' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>🎯 Career Goals</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={syncGoals} style={S.secBtn}>🔄 Sync from Stats</button>
              <button onClick={loadSuggestions} style={S.secBtn}>💡 Suggest Events</button>
              <button onClick={async () => {
                try {
                  const res = await api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 });
                  if (res.data.success) { setSuccessMsg(`Seeded ${res.data.created} goals! (${res.data.skipped} already existed)`); loadData(); }
                } catch (err) { setError(err.response?.data?.error || err.message); }
              }} style={S.secBtn}>🌱 Seed 24 Goals</button>
              <button onClick={() => { setGoalForm({ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '#6366f1', description: '' }); setEditingGoal('new'); }} style={S.primaryBtn}>+ New Goal</button>
            </div>
          </div>

          {/* Goal editor */}
          {editingGoal && (
            <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{editingGoal === 'new' ? '✨ New Goal' : '✏️ Edit Goal'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <FG label="Goal Title *" value={goalForm.title} onChange={v => setGoalForm(p => ({ ...p, title: v }))} placeholder="Break Into Luxury Fashion" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={goalForm.type} onChange={e => setGoalForm(p => ({ ...p, type: e.target.value }))} style={S.sel}>
                    <option value="primary">🌟 Primary (1 max)</option>
                    <option value="secondary">🎯 Secondary (2 max)</option>
                    <option value="passive">🌿 Passive (unlimited)</option>
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Metric</label>
                  <select value={goalForm.target_metric} onChange={e => setGoalForm(p => ({ ...p, target_metric: e.target.value }))} style={S.sel}>
                    <option value="coins">🪙 Coins</option>
                    <option value="reputation">⭐ Reputation</option>
                    <option value="brand_trust">🤝 Brand Trust</option>
                    <option value="influence">📣 Influence</option>
                    <option value="stress">😰 Stress (reduce to)</option>
                    <option value="followers">👥 Followers</option>
                    <option value="engagement_rate">📈 Engagement Rate</option>
                    <option value="portfolio_strength">📁 Portfolio Strength</option>
                  </select>
                </div>
                <FG label="Target Value" value={goalForm.target_value} onChange={v => setGoalForm(p => ({ ...p, target_value: parseFloat(v) || 0 }))} type="number" />
                <FG label="Icon" value={goalForm.icon} onChange={v => setGoalForm(p => ({ ...p, icon: v }))} placeholder="🎯" />
                <FG label="Color" value={goalForm.color} onChange={v => setGoalForm(p => ({ ...p, color: v }))} placeholder="#6366f1" />
              </div>
              <FG label="Description" value={goalForm.description} onChange={v => setGoalForm(p => ({ ...p, description: v }))} textarea full placeholder="What does achieving this goal mean for Lala's journey?" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingGoal(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveGoal} disabled={savingGoal || !goalForm.title} style={S.primaryBtn}>
                  {savingGoal ? '⏳' : editingGoal === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
          )}

          {/* Active goals by type */}
          {['primary', 'secondary', 'passive'].map(goalType => {
            const typeGoals = goals.filter(g => g.type === goalType && g.status === 'active');
            if (typeGoals.length === 0 && goalType === 'passive') return null;
            const typeLabel = goalType === 'primary' ? '🌟 Primary Goal' : goalType === 'secondary' ? '🎯 Secondary Goals' : '🌿 Passive Goals';
            const typeLimit = goalType === 'primary' ? '(1 max)' : goalType === 'secondary' ? '(2 max)' : '';
            return (
              <div key={goalType}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{typeLabel} {typeLimit}</div>
                <div style={{ display: 'grid', gridTemplateColumns: goalType === 'primary' ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {typeGoals.map(g => {
                    const pct = g.progress || Math.min(100, Math.round(((g.current_value - (g.starting_value || 0)) / Math.max(1, (g.target_value - (g.starting_value || 0)))) * 100));
                    return (
                      <div key={g.id} style={{ background: '#fff', border: goalType === 'primary' ? `2px solid ${g.color || '#6366f1'}` : '1px solid #e2e8f0', borderRadius: 12, padding: goalType === 'primary' ? 20 : 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: goalType === 'primary' ? 28 : 20 }}>{g.icon || '🎯'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: goalType === 'primary' ? 16 : 14, fontWeight: 700, color: '#1a1a2e' }}>{g.title}</div>
                            {g.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{g.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setGoalForm({ ...g }); setEditingGoal(g.id); }} style={S.smBtn}>✏️</button>
                            <button onClick={() => deleteGoal(g.id)} style={S.smBtnDanger}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                          {STAT_ICONS[g.target_metric] || '📊'} {g.target_metric?.replace(/_/g, ' ')}: <strong>{g.current_value}</strong> / {g.target_value}
                        </div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : (g.color || '#6366f1'), borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: pct >= 100 ? '#16a34a' : '#94a3b8', fontWeight: pct >= 100 ? 700 : 400 }}>
                          {pct >= 100 ? '✅ COMPLETE' : `${pct}% — ${Math.max(0, g.target_value - g.current_value)} remaining`}
                        </div>
                      </div>
                    );
                  })}
                  {typeGoals.length === 0 && (
                    <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0' }}>
                      No active {goalType} goal. Click "+ New Goal" to create one.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Completed goals */}
          {goals.filter(g => g.status === 'completed').length > 0 && (
            <div style={S.card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#16a34a' }}>✅ Completed Goals</h3>
              {goals.filter(g => g.status === 'completed').map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>{g.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{g.title}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{g.completed_at ? new Date(g.completed_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Event suggestions */}
          {suggestions.length > 0 && (
            <div style={S.card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>💡 Suggested Events (Based on Active Goals)</h3>
              {suggestions.map((s, i) => (
                <div key={i} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, marginBottom: 10, border: s.requirements_met === false ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[s.event_type] || '📌'}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{s.name}</span>
                    <span style={S.eTag}>⭐ {s.prestige}</span>
                    <span style={S.eTag}>🪙 {s.cost_coins}</span>
                    {s.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid</span>}
                    {!s.requirements_met && <span style={{ padding: '2px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626' }}>⚠️ Reqs not met</span>}
                  </div>
                  {s.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 6 }}>{s.narrative_stakes}</div>}
                  <div style={{ fontSize: 11, color: '#6366f1', marginBottom: 8, lineHeight: 1.5 }}>
                    {(s.suggestion_reasons || []).slice(0, 4).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setActiveTab('events'); }} style={S.smBtn}>📋 View in Events</button>
                    <button onClick={() => {
                      setActiveTab('events');
                      setInjectTarget(s.id);
                    }} style={S.smBtn}>💉 Inject into Episode</button>
                    <button onClick={() => {
                      setActiveTab('events');
                      setGenerateTarget(s.id);
                    }} style={{ ...S.smBtn, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>📝 Generate Script</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ WARDROBE ════════════════════════ */}
      {activeTab === 'wardrobe' && (() => {
        // Derived wardrobe data
        const tierGroups = { basic: [], mid: [], luxury: [], elite: [] };
        wardrobeItems.forEach(item => { if (tierGroups[item.tier]) tierGroups[item.tier].push(item); });

        const filteredItems = wardrobeItems.filter(item => {
          if (wardrobeFilter === 'owned' && !item.is_owned) return false;
          if (wardrobeFilter === 'locked' && item.is_owned) return false;
          if (wardrobeTierFilter !== 'all' && item.tier !== wardrobeTierFilter) return false;
          if (wardrobeCatFilter !== 'all' && item.clothing_category !== wardrobeCatFilter) return false;
          return true;
        });

        const seedWardrobe = async () => {
          setSeedingWardrobe(true); setError(null);
          try {
            const res = await api.post(`/api/v1/wardrobe/seed`, { show_id: showId });
            if (res.data.success) {
              setSuccessMsg(`🌱 Seeded ${res.data.created} items! (${res.data.skipped} already existed) — ${res.data.owned} owned, ${res.data.total - res.data.owned} locked`);
              setToast(`🌱 ${res.data.created} wardrobe items seeded!`);
              setTimeout(() => setToast(null), 3000);
              loadData();
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
          finally { setSeedingWardrobe(false); }
        };

        const openEditItem = (item) => {
          setEditingWardrobeItem(item);
          setWardrobeForm({
            name: item.name || '',
            clothing_category: item.clothing_category || '',
            color: item.color || '',
            season: item.season || 'all-season',
            brand: item.brand || '',
            tier: item.tier || 'basic',
            lock_type: item.lock_type || 'none',
            is_owned: !!item.is_owned,
            is_visible: item.is_visible !== false,
            era_alignment: item.era_alignment || '',
            coin_cost: item.coin_cost || 0,
            reputation_required: item.reputation_required || 0,
            influence_required: item.influence_required || 0,
            outfit_match_weight: item.outfit_match_weight || 5,
            season_unlock_episode: item.season_unlock_episode || '',
            aesthetic_tags: Array.isArray(item.aesthetic_tags) ? item.aesthetic_tags.join(', ') : '',
            event_types: Array.isArray(item.event_types) ? item.event_types.join(', ') : '',
            lala_reaction_own: item.lala_reaction_own || '',
            lala_reaction_locked: item.lala_reaction_locked || '',
            lala_reaction_reject: item.lala_reaction_reject || '',
          });
        };

        const saveWardrobeItem = async () => {
          if (!editingWardrobeItem) return;
          setSavingWardrobe(true); setError(null);
          try {
            const payload = {
              ...wardrobeForm,
              aesthetic_tags: wardrobeForm.aesthetic_tags ? wardrobeForm.aesthetic_tags.split(',').map(s => s.trim()).filter(Boolean) : [],
              event_types: wardrobeForm.event_types ? wardrobeForm.event_types.split(',').map(s => s.trim()).filter(Boolean) : [],
              coin_cost: parseInt(wardrobeForm.coin_cost) || 0,
              reputation_required: parseInt(wardrobeForm.reputation_required) || 0,
              influence_required: parseInt(wardrobeForm.influence_required) || 0,
              outfit_match_weight: parseInt(wardrobeForm.outfit_match_weight) || 5,
              season_unlock_episode: wardrobeForm.season_unlock_episode ? parseInt(wardrobeForm.season_unlock_episode) : null,
            };
            const res = await api.put(`/api/v1/wardrobe/${editingWardrobeItem.id}`, payload);
            if (res.data.success) {
              setWardrobeItems(prev => prev.map(i => i.id === editingWardrobeItem.id ? { ...i, ...res.data.data } : i));
              setEditingWardrobeItem(null);
              setSuccessMsg('✅ Wardrobe item updated!');
              setToast('✅ Item saved!'); setTimeout(() => setToast(null), 2500);
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
          finally { setSavingWardrobe(false); }
        };

        const toggleOwnership = async (item) => {
          try {
            const res = await api.put(`/api/v1/wardrobe/${item.id}`, { is_owned: !item.is_owned });
            if (res.data.success) {
              setWardrobeItems(prev => prev.map(i => i.id === item.id ? { ...i, is_owned: !item.is_owned } : i));
              setToast(item.is_owned ? '🔒 Item locked' : '✅ Item unlocked!'); setTimeout(() => setToast(null), 2500);
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
        };

        const deleteWardrobeItem = async (item) => {
          if (!window.confirm(`Delete "${item.name}"? This will soft-delete it.`)) return;
          try {
            const res = await api.delete(`/api/v1/wardrobe/${item.id}`);
            if (res.data.success) {
              setWardrobeItems(prev => prev.filter(i => i.id !== item.id));
              setEditingWardrobeItem(null);
              setSuccessMsg('🗑️ Item deleted');
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
        };

        const wf = wardrobeForm;
        const setWf = (key, val) => setWardrobeForm(prev => ({ ...prev, [key]: val }));

        return (
          <div style={S.content}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ ...S.cardTitle, margin: 0 }}>👗 Wardrobe</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>{wardrobeItems.length} items</span>
                <button onClick={seedWardrobe} disabled={seedingWardrobe} style={S.secBtn}>
                  {seedingWardrobe ? '⏳ Seeding...' : '🌱 Seed 40 Items'}
                </button>
              </div>
            </div>

            {/* Tier Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {['basic', 'mid', 'luxury', 'elite'].map(tier => {
                const items = tierGroups[tier] || [];
                const owned = items.filter(i => i.is_owned).length;
                const isActive = wardrobeTierFilter === tier;
                return (
                  <div key={tier} onClick={() => setWardrobeTierFilter(isActive ? 'all' : tier)}
                    style={{
                      padding: 16, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                      background: isActive ? WARDROBE_TIER_COLORS[tier] + '18' : '#fff',
                      border: isActive ? `2px solid ${WARDROBE_TIER_COLORS[tier]}` : '1px solid #e2e8f0',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: 24 }}>{WARDROBE_TIER_ICONS[tier]}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: WARDROBE_TIER_COLORS[tier] }}>{items.length}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: WARDROBE_TIER_COLORS[tier] }}>{tier}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{owned} owned · {items.length - owned} locked</div>
                  </div>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              {['all', 'owned', 'locked'].map(f => (
                <button key={f} onClick={() => setWardrobeFilter(f)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: wardrobeFilter === f ? '#6366f1' : '#fff',
                    color: wardrobeFilter === f ? '#fff' : '#64748b',
                    border: wardrobeFilter === f ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  }}>
                  {f === 'all' ? '🏷️ All' : f === 'owned' ? '✅ Owned' : '🔒 Locked'}
                </button>
              ))}
              <div style={{ width: 1, height: 24, background: '#e2e8f0', alignSelf: 'center' }} />
              {WARDROBE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setWardrobeCatFilter(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: wardrobeCatFilter === cat ? '#6366f1' : '#fff',
                    color: wardrobeCatFilter === cat ? '#fff' : '#64748b',
                    border: wardrobeCatFilter === cat ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  }}>
                  {CAT_ICONS[cat]} {cat}
                </button>
              ))}
            </div>

            {/* ─── Edit Panel (slide-in) ─── */}
            {editingWardrobeItem && (
              <div style={{
                background: '#fff', border: '2px solid #6366f1', borderRadius: 14, padding: 24, marginBottom: 16,
                boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
                    ✏️ Editing: {editingWardrobeItem.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => deleteWardrobeItem(editingWardrobeItem)} style={S.smBtnDanger}>🗑️ Delete</button>
                    <button onClick={() => setEditingWardrobeItem(null)} style={S.smBtn}>✕ Close</button>
                  </div>
                </div>

                {/* Row 1: Name, Category, Color, Season */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={S.fLabel}>Name</label>
                    <input value={wf.name} onChange={e => setWf('name', e.target.value)} style={S.inp} />
                  </div>
                  <div>
                    <label style={S.fLabel}>Category</label>
                    <select value={wf.clothing_category} onChange={e => setWf('clothing_category', e.target.value)} style={S.sel}>
                      {['dress', 'top', 'bottom', 'shoes', 'accessories', 'jewelry', 'perfume'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Color</label>
                    <input value={wf.color} onChange={e => setWf('color', e.target.value)} style={S.inp} />
                  </div>
                  <div>
                    <label style={S.fLabel}>Season</label>
                    <select value={wf.season} onChange={e => setWf('season', e.target.value)} style={S.sel}>
                      {['all-season', 'spring', 'summer', 'fall', 'winter'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Tier, Lock Type, Era, Brand */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={S.fLabel}>Tier</label>
                    <select value={wf.tier} onChange={e => setWf('tier', e.target.value)} style={S.sel}>
                      {['basic', 'mid', 'luxury', 'elite'].map(t => (
                        <option key={t} value={t}>{WARDROBE_TIER_ICONS[t]} {t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Lock Type</label>
                    <select value={wf.lock_type} onChange={e => setWf('lock_type', e.target.value)} style={S.sel}>
                      {['none', 'coin', 'reputation', 'influence', 'season_drop', 'brand_exclusive', 'story_unlock', 'achievement'].map(l => (
                        <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Era</label>
                    <select value={wf.era_alignment} onChange={e => setWf('era_alignment', e.target.value)} style={S.sel}>
                      {['foundation', 'glow_up', 'luxury', 'prime', 'legacy'].map(e => (
                        <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Brand</label>
                    <input value={wf.brand} onChange={e => setWf('brand', e.target.value)} style={S.inp} placeholder="Maison Belle..." />
                  </div>
                </div>

                {/* Row 3: Ownership toggles + numeric costs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={S.fLabel}>Owned</label>
                    <button onClick={() => setWf('is_owned', !wf.is_owned)}
                      style={{ ...S.smBtn, background: wf.is_owned ? '#f0fdf4' : '#fef2f2', borderColor: wf.is_owned ? '#bbf7d0' : '#fecaca', color: wf.is_owned ? '#16a34a' : '#dc2626', fontWeight: 700,  padding: '6px 10px' }}>
                      {wf.is_owned ? '✅ Yes' : '🔒 No'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={S.fLabel}>Visible</label>
                    <button onClick={() => setWf('is_visible', !wf.is_visible)}
                      style={{ ...S.smBtn, background: wf.is_visible ? '#eef2ff' : '#f1f5f9', borderColor: wf.is_visible ? '#c7d2fe' : '#e2e8f0', color: wf.is_visible ? '#4338ca' : '#94a3b8', fontWeight: 700, padding: '6px 10px' }}>
                      {wf.is_visible ? '👁️ Yes' : '🚫 No'}
                    </button>
                  </div>
                  <div>
                    <label style={S.fLabel}>🪙 Coin Cost</label>
                    <input type="number" value={wf.coin_cost} onChange={e => setWf('coin_cost', e.target.value)} style={S.inp} min="0" />
                  </div>
                  <div>
                    <label style={S.fLabel}>⭐ Rep Req</label>
                    <input type="number" value={wf.reputation_required} onChange={e => setWf('reputation_required', e.target.value)} style={S.inp} min="0" max="10" />
                  </div>
                  <div>
                    <label style={S.fLabel}>📣 Inf Req</label>
                    <input type="number" value={wf.influence_required} onChange={e => setWf('influence_required', e.target.value)} style={S.inp} min="0" max="10" />
                  </div>
                  <div>
                    <label style={S.fLabel}>🎯 Match Wt</label>
                    <input type="number" value={wf.outfit_match_weight} onChange={e => setWf('outfit_match_weight', e.target.value)} style={S.inp} min="1" max="10" />
                  </div>
                </div>

                {/* Row 4: Tags & Events */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={S.fLabel}>Aesthetic Tags <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma-separated)</span></label>
                    <input value={wf.aesthetic_tags} onChange={e => setWf('aesthetic_tags', e.target.value)} style={S.inp} placeholder="bold, elegant, modern" />
                  </div>
                  <div>
                    <label style={S.fLabel}>Event Types <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma-separated)</span></label>
                    <input value={wf.event_types} onChange={e => setWf('event_types', e.target.value)} style={S.inp} placeholder="gala, awards, brunch" />
                  </div>
                </div>

                {/* Row 5: Lala Reactions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={S.fLabel}>💬 Lala Reaction (Owned)</label>
                    <textarea value={wf.lala_reaction_own} onChange={e => setWf('lala_reaction_own', e.target.value)} style={{ ...S.tArea, minHeight: 50 }} placeholder="Love this piece!" />
                  </div>
                  <div>
                    <label style={S.fLabel}>🔒 Lala Reaction (Locked)</label>
                    <textarea value={wf.lala_reaction_locked} onChange={e => setWf('lala_reaction_locked', e.target.value)} style={{ ...S.tArea, minHeight: 50 }} placeholder="One day..." />
                  </div>
                  <div>
                    <label style={S.fLabel}>❌ Lala Reaction (Reject)</label>
                    <textarea value={wf.lala_reaction_reject} onChange={e => setWf('lala_reaction_reject', e.target.value)} style={{ ...S.tArea, minHeight: 50 }} placeholder="Not today." />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingWardrobeItem(null)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveWardrobeItem} disabled={savingWardrobe} style={S.primaryBtn}>
                    {savingWardrobe ? '⏳ Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Item Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredItems.map(item => {
                const tierColor = WARDROBE_TIER_COLORS[item.tier] || '#94a3b8';
                const tags = Array.isArray(item.aesthetic_tags) ? item.aesthetic_tags : [];
                const events = Array.isArray(item.event_types) ? item.event_types : [];
                const matchPct = Math.min(100, (item.outfit_match_weight || 5) * 10);
                const isSelected = editingWardrobeItem?.id === item.id;

                return (
                  <div key={item.id} onClick={() => openEditItem(item)}
                    style={{
                      background: '#fff', border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: 12,
                      padding: 16, position: 'relative', overflow: 'hidden', cursor: 'pointer',
                      borderTop: `3px solid ${tierColor}`,
                      opacity: item.is_owned ? 1 : 0.75,
                      transition: 'all 0.2s', boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.2)' : 'none',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Tier badge */}
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '2px 10px', borderRadius: 20,
                      background: tierColor + '18', color: tierColor,
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {WARDROBE_TIER_ICONS[item.tier]} {item.tier}
                    </div>

                    {/* Name & Category */}
                    <div style={{ marginBottom: 8, paddingRight: 70 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {CAT_ICONS[item.clothing_category] || '🏷️'} {item.clothing_category}
                        {item.color && <span style={{ marginLeft: 6 }}>· {item.color}</span>}
                        {item.era_alignment && <span style={{ marginLeft: 6 }}>· {item.era_alignment}</span>}
                      </div>
                    </div>

                    {/* Aesthetic Tags */}
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {tags.map((tag, i) => (
                          <span key={i} style={{ padding: '2px 8px', background: '#f3e8ff', borderRadius: 4, fontSize: 10, color: '#7c3aed' }}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Event Compatibility */}
                    {events.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {events.slice(0, 4).map((ev, i) => (
                          <span key={i} style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, color: '#4338ca' }}>{ev}</span>
                        ))}
                        {events.length > 4 && <span style={{ fontSize: 10, color: '#94a3b8' }}>+{events.length - 4}</span>}
                      </div>
                    )}

                    {/* Match Weight Bar */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                        <span>Match Weight</span>
                        <span>{item.outfit_match_weight || 5}/10</span>
                      </div>
                      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${matchPct}%`, background: tierColor, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    {/* Cost & Requirements */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {item.coin_cost > 0 && <span style={{ padding: '2px 8px', background: '#fef3c7', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#92400e' }}>🪙 {item.coin_cost}</span>}
                      {item.reputation_required > 0 && <span style={{ padding: '2px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626' }}>⭐ Rep {item.reputation_required}+</span>}
                      {item.influence_required > 0 && <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#4338ca' }}>📣 Inf {item.influence_required}+</span>}
                    </div>

                    {/* Lock Status + Quick Toggle + Lala Reaction */}
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: item.is_owned ? '#f0fdf4' : '#fef2f2',
                      border: item.is_owned ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      color: item.is_owned ? '#16a34a' : '#dc2626',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 700 }}>
                          {item.is_owned ? '✅ Owned' : `🔒 ${(item.lock_type || 'locked').replace(/_/g, ' ')}`}
                        </span>
                        <button onClick={e => { e.stopPropagation(); toggleOwnership(item); }}
                          style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            background: item.is_owned ? '#fef2f2' : '#f0fdf4',
                            border: item.is_owned ? '1px solid #fecaca' : '1px solid #bbf7d0',
                            color: item.is_owned ? '#dc2626' : '#16a34a',
                          }}>
                          {item.is_owned ? '🔒 Lock' : '🔓 Unlock'}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, fontStyle: 'italic', color: item.is_owned ? '#15803d' : '#b91c1c' }}>
                        "{item.is_owned ? (item.lala_reaction_own || 'Love this piece!') : (item.lala_reaction_locked || 'One day this will be mine...')}"
                      </div>
                    </div>

                    {/* Edit hint */}
                    <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
                      Click to edit
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {filteredItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {wardrobeItems.length === 0 ? 'No wardrobe items yet' : 'No items match your filters'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  {wardrobeItems.length === 0
                    ? 'Seed the wardrobe to populate Lala\'s closet with 40 starter items.'
                    : 'Try changing your tier, category, or ownership filters.'}
                </div>
                {wardrobeItems.length === 0 && (
                  <button onClick={seedWardrobe} disabled={seedingWardrobe} style={S.primaryBtn}>
                    {seedingWardrobe ? '⏳ Seeding...' : '🌱 Seed 40 Items'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════════════════════ CHARACTERS ════════════════════════ */}
      {activeTab === 'characters' && (
        <div style={S.content}>
          {/* Lala */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👑</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Lala</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Main Character · AI Avatar</p>
              </div>
              {!editingStats ? (
                <button onClick={openStatEditor} disabled={!charState} style={S.secBtn}>✏️ Edit Stats</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingStats(false)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveStats} disabled={savingStats} style={S.primaryBtn}>{savingStats ? '⏳' : '💾 Save'}</button>
                </div>
              )}
            </div>

            {charState ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {Object.entries(charState.state || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{STAT_ICONS[key]}</span>
                    <span style={{ flex: '0 0 100px', fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                    {editingStats ? (
                      <input type="number" value={statForm[key] ?? val} onChange={e => setStatForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                        style={{ width: 80, padding: '4px 8px', border: '1px solid #6366f1', borderRadius: 4, fontSize: 14, fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}
                        min={key === 'coins' ? -9999 : 0} max={key === 'coins' ? 99999 : 10} />
                    ) : (
                      <>
                        <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (val / (key === 'coins' ? 500 : 10)) * 100))}%`, borderRadius: 5, background: key === 'stress' ? (val >= 5 ? '#dc2626' : '#eab308') : key === 'coins' ? (val < 0 ? '#dc2626' : '#6366f1') : '#6366f1', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: (key === 'stress' && val >= 5) || (key === 'coins' && val < 0) ? '#dc2626' : '#1a1a2e' }}>{val}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : <p style={S.muted}>No stats initialized. Evaluate an episode to auto-seed defaults.</p>}

            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Character Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Voice Activation', 'Required ✅'],
                  ['Idle Behaviors', 'Wave, mirror glance, inspect'],
                  ['Default Stats', '500 coins, 1 rep, 1 trust, 1 inf, 0 stress'],
                  ['Fail Behavior', 'Forced smile, softer voice, stress anim'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Prime */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💎</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>JustAWomanInHerPrime</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Creator Narrator</p>
              </div>
            </div>
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Role', 'Narrator + Gameplay driver'],
                  ['Voice', 'Warm, strategic, luxury aspirational'],
                  ['Aliases', 'Prime:, Me:, You:'],
                  ['CTA Style', 'Confident, community-focused'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat ledger */}
          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📜 Stat Change Ledger</h2>
              <div style={S.tHead}>
                <span style={S.tCol}>Episode</span>
                <span style={S.tCol}>Source</span>
                <span style={{ ...S.tCol, flex: 2 }}>Changes</span>
                <span style={S.tCol}>Date</span>
              </div>
              {stateHistory.map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={S.tRow}>
                    <span style={S.tCol}>{h.episode_title || h.episode_id?.substring(0, 8) || 'manual'}</span>
                    <span style={S.tCol}><span style={S.sourceBadge(h.source)}>{h.source}</span></span>
                    <span style={{ ...S.tCol, flex: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                        <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </span>
                    <span style={{ ...S.tCol, fontSize: 11, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ DECISIONS ════════════════════════ */}
      {activeTab === 'decisions' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧠 Decision Log</h2>
            <p style={S.muted}>Training data from your creative decisions. Powers future AI suggestions.</p>
            {decisions.length > 0 ? decisions.map((d, i) => {
              const ctx = typeof d.context_json === 'string' ? JSON.parse(d.context_json) : d.context_json;
              const dec = typeof d.decision_json === 'string' ? JSON.parse(d.decision_json) : d.decision_json;
              return (
                <div key={i} style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4338ca', textTransform: 'capitalize' }}>{d.type?.replace(/_/g, ' ')}</span>
                    {d.source && <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, color: '#64748b' }}>{d.source}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {ctx && <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>Context: {JSON.stringify(ctx)}</div>}
                  {dec && <div style={{ fontSize: 11, color: '#1a1a2e', fontWeight: 500, wordBreak: 'break-all' }}>Decision: {JSON.stringify(dec)}</div>}
                </div>
              );
            }) : <p style={S.muted}>No decisions logged yet.</p>}
          </div>
        </div>
      )}

      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toast && (
        <div style={S.toastOverlay}>
          <div style={S.toastBox}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>💉✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.3px' }}>{toast}</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Event tag injected into script</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Group helper ───
function FG({ label, value, onChange, placeholder, type = 'text', textarea, full, min, max, disabled }) {
  const style = { marginBottom: full ? 10 : 0 };
  return (
    <div style={style}>
      <label style={S.fLabel}>{label}</label>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.tArea, opacity: disabled ? 0.5 : 1 }} rows={2} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.inp, opacity: disabled ? 0.5 : 1 }} placeholder={placeholder} min={min} max={max} disabled={disabled} />
      )}
    </div>
  );
}

// ─── STYLES ───
const S = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  center: { textAlign: 'center', padding: 60, color: '#94a3b8' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  backLink: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 4px', fontSize: 26, fontWeight: 800, color: '#1a1a2e' },
  subtitle: { margin: 0, color: '#64748b', fontSize: 14 },
  refreshBtn: { padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },
  tabBar: { display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  tab: { padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#64748b', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '2px solid #6366f1', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  content: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 16px' },
  muted: { color: '#94a3b8', fontSize: 13 },
  primaryBtn: { padding: '8px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  secBtn: { padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },
  smBtn: { padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#475569' },
  smBtnDanger: { padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#dc2626' },
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statBox: { flex: '1 1 90px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'center', minWidth: 90 },
  statVal: (k, v) => ({ fontSize: 26, fontWeight: 800, color: (k === 'stress' && v >= 5) || (k === 'coins' && v < 0) ? '#dc2626' : '#1a1a2e' }),
  statLbl: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  qBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'center' },
  qVal: { fontSize: 22, fontWeight: 800, color: '#1a1a2e' },
  qLbl: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  tHead: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' },
  tRow: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 13 },
  tCol: { flex: 1, minWidth: 0 },
  empty: { padding: 20, textAlign: 'center', color: '#94a3b8' },
  tierPill: (t) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: TIER_COLORS[t] + '20', color: TIER_COLORS[t] }),
  statusPill: (s) => ({ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s === 'accepted' ? '#f0fdf4' : s === 'computed' ? '#eef2ff' : s === 'ready' ? '#f0fdf4' : s === 'used' ? '#eef2ff' : '#f1f5f9', color: s === 'accepted' || s === 'ready' ? '#16a34a' : s === 'computed' || s === 'used' ? '#6366f1' : '#94a3b8' }),
  sourceBadge: (s) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s === 'override' ? '#fef3c7' : s === 'manual' ? '#fef2f2' : '#eef2ff', color: s === 'override' ? '#92400e' : s === 'manual' ? '#dc2626' : '#4338ca' }),
  deltaBadge: (v) => ({ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: v > 0 ? '#f0fdf4' : '#fef2f2', color: v > 0 ? '#16a34a' : '#dc2626' }),
  toastOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' },
  toastBox: { padding: '24px 48px', background: 'linear-gradient(135deg, #16a34a, #059669)', color: '#fff', borderRadius: 16, fontSize: 16, fontWeight: 700, boxShadow: '0 12px 40px rgba(22,163,74,0.45), 0 0 0 4px rgba(22,163,74,0.15)', textAlign: 'center', animation: 'toastPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', pointerEvents: 'auto' },
  evCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  eTag: { padding: '2px 8px', background: '#f3e8ff', borderRadius: 4, fontSize: 11, color: '#7c3aed' },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', boxSizing: 'border-box' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', background: '#fff' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
};

export default WorldAdmin;
