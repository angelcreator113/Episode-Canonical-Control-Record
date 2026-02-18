/**
 * WorldAdmin v2 — Producer Mode Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * 5 Tabs:
 *   1. Overview — Stats, tier distribution, canon timeline
 *   2. Episode Ledger — All episodes with tier/score/deltas
 *   3. Events Library — Reusable event catalog (create, edit, inject)
 *   4. Characters — View/edit Lala stats, character rules, stat ledger
 *   5. Decision Log — Training data from creative decisions
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
const TIER_COLORS = { slay: '#FFD700', pass: '#22c55e', mid: '#eab308', fail: '#dc2626' };
const TIER_EMOJIS = { slay: '👑', pass: '✨', mid: '😐', fail: '💔' };
const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };
const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];

const EMPTY_EVENT = {
  name: '', event_type: 'invite', host_brand: '', description: '',
  prestige: 5, cost_coins: 100, strictness: 5,
  deadline_type: 'medium', dress_code: '', location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
};

const TABS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'episodes', icon: '📋', label: 'Episode Ledger' },
  { key: 'events', icon: '💌', label: 'Events Library' },
  { key: 'characters', icon: '👑', label: 'Characters' },
  { key: 'decisions', icon: '🧠', label: 'Decision Log' },
];

function WorldAdmin() {
  const { id: showId } = useParams();

  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Event editor state
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT });
  const [savingEvent, setSavingEvent] = useState(false);
  const [injectTarget, setInjectTarget] = useState(null);

  // Character editor state
  const [editingStats, setEditingStats] = useState(false);
  const [statForm, setStatForm] = useState({});
  const [savingStats, setSavingStats] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { loadData(); }, [showId]);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 3000); return () => clearTimeout(t); }
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
      ]);
    } finally { setLoading(false); }
  };

  // ─── EVENT CRUD ───
  const openNewEvent = () => { setEventForm({ ...EMPTY_EVENT }); setEditingEvent('new'); };
  const openEditEvent = (ev) => { setEventForm({ ...EMPTY_EVENT, ...ev }); setEditingEvent(ev.id); };

  const saveEvent = async () => {
    setSavingEvent(true); setError(null);
    try {
      if (editingEvent === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/events`, eventForm);
        if (res.data.success) { setWorldEvents(p => [res.data.event, ...p]); setEditingEvent(null); setSuccessMsg('Event created!'); }
      } else {
        const res = await api.put(`/api/v1/world/${showId}/events/${editingEvent}`, eventForm);
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
    try {
      setSuccessMsg(null);
      setError(null);
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/inject`, { episode_id: episodeId });
      const d = res.data;
      if (d.success) {
        setWorldEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: 'used', used_in_episode_id: episodeId, times_used: (ev.times_used || 0) + 1 } : ev));
        setSuccessMsg(`✅ Injected! ${d.event_tag}`);
        setInjectTarget(null);
      } else {
        setError(d.error || d.message || 'Inject returned unexpected response');
      }
    } catch (err) {
      console.error('Inject error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    }
  };

  // ─── CHARACTER STAT EDIT ───
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
      {successMsg && <div style={S.successBanner}>{successMsg}</div>}

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
          <div style={S.card}>
            <h2 style={S.cardTitle}>📋 Episode Ledger</h2>
            <div style={S.tHead}>
              <span style={{ ...S.tCol, flex: '0 0 40px' }}>#</span>
              <span style={{ ...S.tCol, flex: 2 }}>Title</span>
              <span style={S.tCol}>Tier</span>
              <span style={S.tCol}>Score</span>
              <span style={S.tCol}>Overrides</span>
              <span style={S.tCol}>Status</span>
              <span style={S.tCol}>Actions</span>
            </div>
            {episodes.map((ep, i) => {
              const ej = ep.evaluation_json;
              return (
                <div key={ep.id} style={S.tRow}>
                  <span style={{ ...S.tCol, flex: '0 0 40px', fontWeight: 700 }}>{ep.episode_number || i + 1}</span>
                  <span style={{ ...S.tCol, flex: 2, fontWeight: 600 }}>{ep.title || 'Untitled'}</span>
                  <span style={S.tCol}>{ej?.tier_final ? <span style={S.tierPill(ej.tier_final)}>{TIER_EMOJIS[ej.tier_final]} {ej.tier_final.toUpperCase()}</span> : '—'}</span>
                  <span style={{ ...S.tCol, fontWeight: 700 }}>{ej?.score ?? '—'}</span>
                  <span style={S.tCol}>{(ej?.overrides || []).length > 0 ? `${(ej.overrides).length} ⬆️` : '—'}</span>
                  <span style={S.tCol}><span style={S.statusPill(ep.evaluation_status)}>{ep.evaluation_status || 'draft'}</span></span>
                  <span style={S.tCol}><Link to={`/episodes/${ep.id}/evaluate`} style={{ color: '#6366f1', fontSize: 12, textDecoration: 'none' }}>Evaluate</Link></span>
                </div>
              );
            })}
            {episodes.length === 0 && <div style={S.empty}>No episodes yet.</div>}
          </div>
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
                <FG label="Host / Brand" value={eventForm.host_brand} onChange={v => setEventForm(p => ({ ...p, host_brand: v }))} placeholder="Velour Society" />
                <FG label="Prestige (1-10)" value={eventForm.prestige} onChange={v => setEventForm(p => ({ ...p, prestige: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <FG label="Cost (coins)" value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <FG label="Dress Code" value={eventForm.dress_code} onChange={v => setEventForm(p => ({ ...p, dress_code: v }))} placeholder="romantic couture" />
                <div>
                  <label style={S.fLabel}>Browse Pool Bias</label>
                  <select value={eventForm.browse_pool_bias} onChange={e => setEventForm(p => ({ ...p, browse_pool_bias: e.target.value }))} style={S.sel}>
                    {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
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
                {ev.host_brand && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🏛️ {ev.host_brand}</div>}
                {ev.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.4 }}>{ev.narrative_stakes}</div>}
                {ev.location_hint && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>📍 {ev.location_hint}</div>}
                {ev.status === 'used' && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>✅ Injected (used {ev.times_used || 1}x)</div>}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  <button onClick={() => openEditEvent(ev)} style={S.smBtn}>✏️ Edit</button>
                  <button onClick={() => setInjectTarget(injectTarget === ev.id ? null : ev.id)} style={S.smBtn}>{ev.status === 'used' ? '💉 Re-inject' : '💉 Inject'}</button>
                  <button onClick={() => deleteEvent(ev.id)} style={S.smBtnDanger}>🗑️</button>
                </div>
                {injectTarget === ev.id && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Inject into which episode?</div>
                    {episodes.map(ep => (
                      <button key={ep.id} onClick={() => injectEvent(ev.id, ep.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#1a1a2e' }}>
                        {ep.episode_number || '?'}. {ep.title || 'Untitled'}
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
    </div>
  );
}

// ─── Form Group helper ───
function FG({ label, value, onChange, placeholder, type = 'text', textarea, full, min, max }) {
  const style = { marginBottom: full ? 10 : 0 };
  return (
    <div style={style}>
      <label style={S.fLabel}>{label}</label>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={S.tArea} rows={2} placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={S.inp} placeholder={placeholder} min={min} max={max} />
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
  evCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  eTag: { padding: '2px 8px', background: '#f3e8ff', borderRadius: 4, fontSize: 11, color: '#7c3aed' },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', boxSizing: 'border-box' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', background: '#fff' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
};

export default WorldAdmin;
