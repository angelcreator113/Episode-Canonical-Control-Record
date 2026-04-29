// frontend/src/components/Episodes/NextEventSuggestionsOverlay.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * NextEventSuggestionsOverlay — end-of-show "what's next?" modal.
 *
 * Surfaces ranked event suggestions based on Lala's CURRENT character_state
 * (coins, reputation, stress, brand_trust). The deterministic scoring lives
 * server-side at GET /api/v1/world/:showId/events/next-suggestions; this
 * component renders the response.
 *
 * Trigger surface: EpisodeDetail mounts this when the episode has finished
 * (evaluation_json present) and the per-episode "seen" flag isn't set in
 * localStorage. Creator can dismiss with X or "Don't show again", or click
 * a suggestion to spin up the next episode.
 */

function NextEventSuggestionsOverlay({ episode, showId, onClose, onPickEvent }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(null); // event id while spawning episode

  useEffect(() => {
    if (!episode?.id || !showId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: res } = await api.get(
          `/api/v1/world/${showId}/events/next-suggestions?from_episode_id=${episode.id}`
        );
        if (!cancelled) setData(res?.data || null);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [episode?.id, showId]);

  // Reuse the existing generate-episode-from-many endpoint that the Producer
  // Mode "Generate Episode" button calls. Single event = list of one.
  const pickEvent = async (eventId) => {
    if (!showId || !eventId) return;
    setGenerating(eventId);
    try {
      const { data: res } = await api.post(
        `/api/v1/world/${showId}/events/generate-episode-from-many`,
        { event_ids: [eventId] }
      );
      const newId = res?.data?.episode?.id || res?.data?.id;
      if (newId) {
        if (typeof onPickEvent === 'function') onPickEvent(newId);
        navigate(`/episodes/${newId}`);
      } else {
        alert('Episode generated but no ID returned. Refresh to find it.');
      }
    } catch (err) {
      alert('Failed to generate episode: ' + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(null);
    }
  };

  const dismissForEpisode = (permanent) => {
    if (permanent && episode?.id) {
      try { localStorage.setItem(`nextSuggestions:dismissed:${episode.id}`, '1'); } catch {}
    }
    onClose?.();
  };

  // ── Styling — keeps this self-contained so it doesn't fight any global CSS.
  // The backdrop is a click-to-dismiss surface; the panel stops propagation. ──
  const S = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, backdropFilter: 'blur(4px)' },
    panel: { background: '#FAF7F0', borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 24, position: 'relative' },
    closeBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, border: 'none', background: '#fff', color: '#64748b', fontSize: 16, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
    title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1a1a2e', fontFamily: "'Lora', serif" },
    subtitle: { margin: '0 0 18px', fontSize: 13, color: '#64748b' },
    statsBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' },
    statPill: { display: 'flex', flexDirection: 'column', minWidth: 60, padding: '4px 10px' },
    statLabel: { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4 },
    statValue: { fontSize: 16, fontWeight: 700, color: '#1a1a2e' },
    suggestion: (rank) => ({
      background: '#fff',
      borderRadius: 8,
      border: rank === 0 ? '2px solid #B8962E' : '1px solid #e2e8f0',
      padding: 14,
      marginBottom: 10,
      position: 'relative',
    }),
    rankBadge: (rank) => ({
      position: 'absolute',
      top: -8,
      left: 14,
      padding: '2px 8px',
      borderRadius: 4,
      background: rank === 0 ? '#B8962E' : '#64748b',
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: 0.5,
    }),
    scoreBadge: (score) => ({
      padding: '3px 8px',
      borderRadius: 4,
      background: score > 0 ? '#f0fdf4' : '#fef2f2',
      color: score > 0 ? '#16a34a' : '#dc2626',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
    }),
    reasonRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11 },
    boostIcon: { color: '#16a34a', fontWeight: 700 },
    blockIcon: { color: '#dc2626', fontWeight: 700 },
    primaryBtn: { padding: '6px 14px', borderRadius: 6, background: '#B8962E', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    ghostBtn: { padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' },
  };

  const stress = data?.state?.stress || 0;
  const coins = data?.state?.coins || 0;
  const critical = coins < (data?.thresholds?.coins_critical || 100);
  const pressured = !critical && coins < (data?.thresholds?.coins_pressure || 250);

  return (
    <div style={S.backdrop} onClick={() => dismissForEpisode(false)}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={() => dismissForEpisode(false)} aria-label="Close">×</button>

        <h2 style={S.title}>🧭 What's next?</h2>
        <p style={S.subtitle}>
          Episode {episode?.episode_number || '?'} wraps. Suggestions ranked by Lala's current state.
          {critical && <span style={{ color: '#dc2626', fontWeight: 600 }}> Lala is broke — paid events are boosted.</span>}
          {pressured && <span style={{ color: '#B8962E', fontWeight: 600 }}> Lala is running low — paid events are favored.</span>}
        </p>

        {/* Live state stats */}
        {data?.state && (
          <div style={S.statsBar}>
            <div style={S.statPill}><span style={S.statLabel}>🪙 Coins</span><span style={{ ...S.statValue, color: critical ? '#dc2626' : pressured ? '#B8962E' : '#1a1a2e' }}>{coins}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>⭐ Rep</span><span style={S.statValue}>{data.state.reputation}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>🤝 Brand</span><span style={S.statValue}>{data.state.brand_trust}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>📣 Influence</span><span style={S.statValue}>{data.state.influence}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>😰 Stress</span><span style={{ ...S.statValue, color: stress >= 6 ? '#dc2626' : '#1a1a2e' }}>{stress}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>💼 Tier</span><span style={S.statValue}>{data.state.career_tier}</span></div>
          </div>
        )}

        {/* Suggestions */}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Reading state and ranking events…</div>}
        {error && <div style={{ padding: 20, color: '#dc2626' }}>Error: {error}</div>}
        {!loading && !error && data && (
          <>
            {data.suggestions.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 8 }}>
                No unused events available. Create new events in Producer Mode.
              </div>
            ) : (
              data.suggestions.map((s, rank) => (
                <div key={s.event.id} style={S.suggestion(rank)}>
                  {rank === 0 && <div style={S.rankBadge(rank)}>TOP PICK</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{s.event.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                        {s.event.event_type && <span style={{ padding: '1px 6px', background: '#eef2ff', color: '#6366f1', borderRadius: 3, fontWeight: 600 }}>{s.event.event_type}</span>}
                        {s.event.host && <span style={{ padding: '1px 6px', background: '#f1f5f9', color: '#64748b', borderRadius: 3 }}>{s.event.host}</span>}
                        {s.event.is_paid && s.event.payment_amount > 0 && (
                          <span style={{ padding: '1px 6px', background: '#f0fdf4', color: '#16a34a', borderRadius: 3, fontWeight: 600 }}>+{s.event.payment_amount} 🪙</span>
                        )}
                        {s.event.cost_coins > 0 && (
                          <span style={{ padding: '1px 6px', background: s.affordable ? '#fefce8' : '#fef2f2', color: s.affordable ? '#854d0e' : '#dc2626', borderRadius: 3, fontWeight: 600 }}>cost {s.event.cost_coins} 🪙</span>
                        )}
                        {s.event.prestige != null && <span style={{ padding: '1px 6px', background: '#faf5ea', color: '#B8962E', borderRadius: 3 }}>★ {s.event.prestige}</span>}
                      </div>
                    </div>
                    <div style={S.scoreBadge(s.score)}>{s.score >= 0 ? '+' : ''}{s.score}</div>
                  </div>

                  {/* Reasons — every score has bullet justifications. boosts in
                      green, blocks in red; this is the entire transparency story. */}
                  {s.reasons.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {s.reasons.map((r, i) => (
                        <div key={i} style={S.reasonRow}>
                          <span style={r.kind === 'boost' ? S.boostIcon : S.blockIcon}>{r.kind === 'boost' ? '+' : '−'}</span>
                          <span style={{ color: r.kind === 'boost' ? '#16a34a' : '#dc2626' }}>{r.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      style={{ ...S.primaryBtn, opacity: generating ? 0.5 : 1, cursor: generating ? 'wait' : 'pointer' }}
                      onClick={() => pickEvent(s.event.id)}
                      disabled={!!generating}
                    >
                      {generating === s.event.id ? 'Generating…' : '✦ Create Episode'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <div style={S.footer}>
          <button style={S.ghostBtn} onClick={() => dismissForEpisode(true)}>Don't show again for this episode</button>
          <button style={S.ghostBtn} onClick={() => dismissForEpisode(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default NextEventSuggestionsOverlay;
