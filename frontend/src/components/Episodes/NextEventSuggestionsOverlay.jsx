// frontend/src/components/Episodes/NextEventSuggestionsOverlay.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * NextEventSuggestionsOverlay — "what's next?" modal.
 *
 * Surfaces ranked event suggestions based on Lala's CURRENT character_state
 * (coins, reputation, stress, brand_trust). The deterministic scoring lives
 * server-side at GET /api/v1/world/:showId/events/next-suggestions; this
 * component renders the response.
 *
 * Trigger surface: EpisodeDetail mounts this either automatically, once,
 * on the wrap transition (episode.evaluation_status going to 'accepted'
 * while the page is mounted — never on page load, and never merely on
 * evaluation_json appearing, which happens earlier at the 'computed'/
 * preview stage before the creator accepts), or on demand via the
 * header's "What's next" button at any time. Closing the modal by any
 * path (X, backdrop, or the Close button) sets the per-episode
 * `primeStudios.whatsNext.shown.<episodeId>` localStorage flag, which the
 * page checks before auto-opening again — the on-demand button ignores it.
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

  // Any close — X, backdrop click, or the Close button — marks this episode
  // as shown so the page's wrap-transition effect won't auto-open it again;
  // the header's on-demand button bypasses this flag entirely.
  const closeAndMarkShown = () => {
    if (episode?.id) {
      try {
        localStorage.setItem(`primeStudios.whatsNext.shown.${episode.id}`, '1');
      } catch (err) {
        console.error('Failed to persist What\'s next shown flag:', err);
      }
    }
    onClose?.();
  };

  // ── Styling — keeps this self-contained so it doesn't fight any global CSS.
  // The backdrop is a click-to-dismiss surface; the panel stops propagation. ──
  const S = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, backdropFilter: 'blur(4px)' },
    panel: { background: 'var(--surface-bg)', borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 24, position: 'relative' },
    closeBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, border: 'none', background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
    title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Lora', serif" },
    subtitle: { margin: '0 0 18px', fontSize: 13, color: 'var(--text-secondary)' },
    statsBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, padding: 12, background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--lala-parchment-3)' },
    statPill: { display: 'flex', flexDirection: 'column', minWidth: 60, padding: '4px 10px' },
    statLabel: { fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4 },
    statValue: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
    suggestion: (rank) => ({
      background: 'var(--surface-card)',
      borderRadius: 8,
      border: rank === 0 ? '2px solid var(--lala-gold)' : '1px solid var(--lala-parchment-3)',
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
      background: rank === 0 ? 'var(--lala-gold)' : 'var(--text-secondary)',
      color: rank === 0 ? 'var(--text-primary)' : 'var(--text-inverse)',
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: 0.5,
    }),
    scoreBadge: (score) => ({
      padding: '3px 8px',
      borderRadius: 4,
      background: score > 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
      color: score > 0 ? 'var(--success-text)' : 'var(--danger-text)',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
    }),
    reasonRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11 },
    boostIcon: { color: 'var(--success-text)', fontWeight: 700 },
    blockIcon: { color: 'var(--danger-text)', fontWeight: 700 },
    warnIcon: { color: 'var(--warning-text)', fontWeight: 700 },
    primaryBtn: { padding: '6px 14px', borderRadius: 6, background: 'var(--primary)', border: 'none', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    ghostBtn: { padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--lala-parchment-3)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--lala-parchment-3)' },
  };

  const stress = data?.state?.stress || 0;
  const coins = data?.state?.coins || 0;
  const critical = coins < (data?.thresholds?.coins_critical || 100);
  const pressured = !critical && coins < (data?.thresholds?.coins_pressure || 250);

  // "Wraps" is only true once accepted — evaluation_status === 'accepted',
  // same signal EpisodeDetail's wrap-transition effect watches (see its
  // comment for the 'computed' vs 'accepted' distinction). Opened on demand
  // via the header button, an in-progress or merely-scored-not-accepted
  // episode has evaluation_status 'computed' or null, so the heading must
  // not claim a wrap that hasn't happened.
  const isComplete = episode?.evaluation_status === 'accepted';
  const episodeLabel = episode?.episode_number
    ? `Episode ${episode.episode_number}`
    : (episode?.title || episode?.episodeTitle || 'This episode');

  return (
    <div style={S.backdrop} onClick={closeAndMarkShown}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={closeAndMarkShown} aria-label="Close">×</button>

        <h2 style={S.title}>🧭 What's next?</h2>
        <p style={S.subtitle}>
          {isComplete
            ? `${episodeLabel} wraps. Suggestions ranked by Lala's current state.`
            : `Suggestions ranked by Lala's current state — ${episodeLabel} isn't wrapped yet.`}
          {critical && <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}> Lala is broke — paid events are boosted.</span>}
          {pressured && <span style={{ color: 'var(--lala-gold-text)', fontWeight: 600 }}> Lala is running low — paid events are favored.</span>}
        </p>

        {/* Live state stats */}
        {data?.state && (
          <div style={S.statsBar}>
            <div style={S.statPill}><span style={S.statLabel}>🪙 Coins</span><span style={{ ...S.statValue, color: critical ? 'var(--danger-text)' : pressured ? 'var(--lala-gold-text)' : 'var(--text-primary)' }}>{coins}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>⭐ Rep</span><span style={S.statValue}>{data.state.reputation}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>🤝 Brand</span><span style={S.statValue}>{data.state.brand_trust}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>📣 Influence</span><span style={S.statValue}>{data.state.influence}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>😰 Stress</span><span style={{ ...S.statValue, color: stress >= 6 ? 'var(--danger-text)' : 'var(--text-primary)' }}>{stress}</span></div>
            <div style={S.statPill}><span style={S.statLabel}>💼 Tier</span><span style={S.statValue}>{data.state.career_tier}</span></div>
          </div>
        )}

        {/* The slot these suggestions are for (Season Arc §8(ff) A4) */}
        {data?.season?.next_slot && (
          <div data-testid="suggestions-next-slot" style={{ margin: '0 0 12px', padding: '8px 12px', background: 'var(--lala-gold-soft)', border: '1px solid var(--lala-gold-line)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}>
            <strong style={{ color: 'var(--lala-gold-text)' }}>For {data.season.next_slot.label}</strong>
            {data.season.next_slot.story_purpose ? `: ${data.season.next_slot.story_purpose}` : ' (no intention set yet)'}
            {data.season.next_slot.desired_pressure && <span style={{ color: 'var(--text-secondary)' }}> · planned pressure {data.season.next_slot.desired_pressure}</span>}
          </div>
        )}

        {/* Suggestions */}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>Reading state and ranking events…</div>}
        {error && <div style={{ padding: 20, color: 'var(--danger-text)' }}>Error: {error}</div>}
        {!loading && !error && data && (
          <>
            {data.suggestions.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-card)', borderRadius: 8 }}>
                No unused events available. Create new events in Producer Mode.
              </div>
            ) : (
              data.suggestions.map((s, rank) => (
                <div key={s.event.id} style={S.suggestion(rank)}>
                  {rank === 0 && <div style={S.rankBadge(rank)}>TOP PICK</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{s.event.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                        {s.event.event_type && <span style={{ padding: '1px 6px', background: 'var(--primary-subtle)', color: 'var(--primary-text)', borderRadius: 3, fontWeight: 600 }}>{s.event.event_type}</span>}
                        {s.event.host && <span style={{ padding: '1px 6px', background: 'var(--lala-parchment-2)', color: 'var(--text-secondary)', borderRadius: 3 }}>{s.event.host}</span>}
                        {s.event.is_paid && s.event.payment_amount > 0 && (
                          <span style={{ padding: '1px 6px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 3, fontWeight: 600 }}>+{s.event.payment_amount} 🪙</span>
                        )}
                        {s.event.cost_coins > 0 && (
                          s.event.deal_type ? (
                            // A deal event is never charged cost_coins: it is
                            // difficulty only (Law 0; Task #2365).
                            <span style={{ padding: '1px 6px', background: 'var(--lala-parchment-2)', color: 'var(--text-primary)', borderRadius: 3, fontWeight: 600 }}>difficulty {s.event.cost_coins}</span>
                          ) : (
                            <span style={{ padding: '1px 6px', background: s.affordable ? 'var(--warning-bg)' : 'var(--danger-bg)', color: s.affordable ? 'var(--warning-text)' : 'var(--danger-text)', borderRadius: 3, fontWeight: 600 }}>cost {s.event.cost_coins} 🪙</span>
                          )
                        )}
                        {s.event.prestige != null && <span style={{ padding: '1px 6px', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', borderRadius: 3 }}>★ {s.event.prestige}</span>}
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
                          {/* warn: a repeat (Season Arc Q8) — it warns, never blocks */}
                          <span style={r.kind === 'boost' ? S.boostIcon : r.kind === 'warn' ? S.warnIcon : S.blockIcon}>{r.kind === 'boost' ? '+' : r.kind === 'warn' ? '!' : '−'}</span>
                          <span style={{ color: r.kind === 'boost' ? 'var(--success-text)' : r.kind === 'warn' ? 'var(--warning-text)' : 'var(--danger-text)' }}>{r.text}</span>
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

        {/* A single Close button — every close path marks this episode
            shown (closeAndMarkShown), so a separate "don't show again"
            action would now just duplicate it. */}
        <div style={{ ...S.footer, justifyContent: 'flex-end' }}>
          <button style={S.ghostBtn} onClick={closeAndMarkShown}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default NextEventSuggestionsOverlay;
