/**
 * EvaluateEpisode — The "Game Results Screen"
 * 
 * Route: /episodes/:id/evaluate
 * 
 * Layout: Two-column
 *   Left:  4-step readiness stepper (Script, Wardrobe, Event Context, Results)
 *   Right: Score breakdown + controls (sliders, override, accept)
 * 
 * Features:
 *   - Script check (beats, EVENT tag, warnings)
 *   - Wardrobe assignment status
 *   - Current Lala stats display
 *   - Evaluate button → compute score
 *   - Score breakdown with contribution bars
 *   - Tier badge (SLAY/PASS/MID/FAIL)
 *   - Narrative result line (short/dramatic/comedic + regenerate)
 *   - Style match sliders (hybrid override)
 *   - Override modal (tier bump + reason + cost + narrative)
 *   - Accept button → apply stat deltas
 *   - Out-of-order warning
 * 
 * Location: frontend/src/pages/EvaluateEpisode.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

// ─── TIER CONFIG ───
const TIER_CONFIG = {
  slay: { emoji: '👑', label: 'SLAY', color: '#FFD700', bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' },
  pass: { emoji: '✨', label: 'PASS', color: '#22c55e', bg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
  mid:  { emoji: '😐', label: 'MID',  color: '#eab308', bg: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' },
  fail: { emoji: '💔', label: 'FAIL', color: '#dc2626', bg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
};

const OVERRIDE_REASONS = [
  { code: 'DREAM_FUND_BOOST', label: '🌟 Dream Fund Boost', category: 'Community' },
  { code: 'SUPPORT_PACK_SURGE', label: '💖 Support Pack Surge', category: 'Community' },
  { code: 'BANK_METER_REWARD', label: '🏦 Bank Meter Reward', category: 'Community' },
  { code: 'EMERGENCY_GLAM_PACK', label: '💅 Emergency Glam Pack', category: 'Lala Action' },
  { code: 'LAST_MINUTE_TAILOR', label: '✂️ Last Minute Tailor', category: 'Lala Action' },
  { code: 'CONFIDENCE_RESET', label: '💎 Confidence Reset', category: 'Lala Action' },
  { code: 'CREATOR_MODE_LOCKIN', label: '🔒 Creator Mode Lock-In', category: 'Lala Action' },
  { code: 'HOUSE_FAVOR', label: '🏛️ House Favor', category: 'Brand' },
  { code: 'BRAND_SPONSOR_SAVE', label: '🤝 Brand Sponsor Save', category: 'Brand' },
  { code: 'CREATOR_STORY_OVERRIDE', label: '📝 Story Override', category: 'Creator' },
];

const OVERRIDE_COSTS = [
  { label: 'Coins -50', value: { coins: -50 } },
  { label: 'Coins -100', value: { coins: -100 } },
  { label: 'Stress +1', value: { stress: 1 } },
  { label: 'Stress +2', value: { stress: 2 } },
  { label: 'Brand Trust -1', value: { brand_trust: -1 } },
  { label: 'Influence -1', value: { influence: -1 } },
];

const STAT_ICONS = {
  coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰',
};


function EvaluateEpisode() {
  const { episodeId } = useParams();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState(null);
  const [charState, setCharState] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [narrativeStyle, setNarrativeStyle] = useState('short');

  // Override form
  const [overrideTier, setOverrideTier] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideCostIdx, setOverrideCostIdx] = useState(0);
  const [overrideNarrative, setOverrideNarrative] = useState('');
  const [overriding, setOverriding] = useState(false);

  // ─── LOAD DATA ───
  useEffect(() => {
    loadData();
  }, [episodeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const epRes = await api.get(`/api/v1/episodes/${episodeId}`);
      const ep = epRes.data?.data || epRes.data;
      setEpisode(ep);

      if (ep.evaluation_json) {
        setEvaluation(ep.evaluation_json);
      }

      if (ep.show_id) {
        try {
          const stateRes = await api.get(`/api/v1/characters/lala/state?show_id=${ep.show_id}`);
          setCharState(stateRes.data);
        } catch (e) { /* state not available yet */ }
      }
    } catch (err) {
      setError('Failed to load episode: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── EVALUATE ───
  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/evaluate`, { character_key: 'lala' });
      if (res.data.success) {
        setEvaluation(res.data.evaluation);
        // Refresh character state
        if (episode?.show_id) {
          const stateRes = await api.get(`/api/v1/characters/lala/state?show_id=${episode.show_id}`);
          setCharState(stateRes.data);
        }
      } else {
        setError(res.data.error || 'Evaluation failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.hint || err.message);
    } finally {
      setEvaluating(false);
    }
  }, [episodeId, episode]);

  // ─── OVERRIDE ───
  const handleOverride = useCallback(async () => {
    if (!overrideTier || !overrideReason) return;
    setOverriding(true);
    setError(null);
    try {
      const costs = OVERRIDE_COSTS[overrideCostIdx]?.value || {};
      const res = await api.post(`/api/v1/episodes/${episodeId}/override`, {
        override_type: 'tier_change',
        tier_to: overrideTier,
        reason_code: overrideReason,
        costs,
        impact: {},
        narrative_line: overrideNarrative || null,
      });
      if (res.data.success) {
        setEvaluation(res.data.evaluation);
        setShowOverrideModal(false);
      } else {
        setError(res.data.error || 'Override failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setOverriding(false);
    }
  }, [episodeId, overrideTier, overrideReason, overrideCostIdx, overrideNarrative]);

  // ─── ACCEPT ───
  const handleAccept = useCallback(async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/accept`, { allow_out_of_order: true });
      if (res.data.success) {
        setEvaluation(prev => ({ ...prev, evaluation_status: 'accepted', accepted_at: new Date().toISOString() }));
        setEpisode(prev => ({ ...prev, evaluation_status: 'accepted' }));
        // Refresh state
        if (episode?.show_id) {
          const stateRes = await api.get(`/api/v1/characters/lala/state?show_id=${episode.show_id}`);
          setCharState(stateRes.data);
        }
        alert(`✅ Accepted! Lala's stats updated.\n\nNew coins: ${res.data.new_state.coins}\nReputation: ${res.data.new_state.reputation}\nBrand Trust: ${res.data.new_state.brand_trust}\nInfluence: ${res.data.new_state.influence}\nStress: ${res.data.new_state.stress}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally {
      setAccepting(false);
    }
  }, [episodeId, episode]);

  // ─── HELPERS ───
  const hasEventTag = episode?.script_content?.includes('[EVENT:');
  const beatCount = (episode?.script_content?.match(/##\s*BEAT:/gi) || []).length;
  const isComputed = episode?.evaluation_status === 'computed' || evaluation?.score != null;
  const isAccepted = episode?.evaluation_status === 'accepted';
  const tierConfig = evaluation ? TIER_CONFIG[evaluation.tier_final] || TIER_CONFIG.mid : null;

  const nextTier = evaluation ? getNextTier(evaluation.tier_final) : null;
  const hasOverrides = (evaluation?.overrides || []).filter(o => o.type === 'tier_change').length > 0;

  if (loading) {
    return <div style={S.page}><div style={S.loadingMsg}>Loading episode...</div></div>;
  }

  if (!episode) {
    return <div style={S.page}><div style={S.errorMsg}>Episode not found</div></div>;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <Link to={`/episodes/${episodeId}`} style={S.backLink}>← Back to Episode</Link>
          <h1 style={S.title}>{episode.title || 'Untitled Episode'}</h1>
          <div style={S.headerMeta}>
            <span style={S.statusPill(isAccepted ? '#22c55e' : isComputed ? '#6366f1' : '#94a3b8')}>
              {isAccepted ? '✅ Accepted' : isComputed ? '🔍 Computed' : '⏳ Not Evaluated'}
            </span>
            {evaluation?.formula_version && <span style={S.versionBadge}>Formula {evaluation.formula_version}</span>}
          </div>
        </div>
        <div style={S.headerActions}>
          {!isComputed && (
            <button onClick={handleEvaluate} disabled={evaluating || !hasEventTag} style={S.primaryBtn}>
              {evaluating ? '⏳ Computing...' : '🎯 Evaluate Episode'}
            </button>
          )}
          {isComputed && !isAccepted && (
            <button onClick={handleAccept} disabled={accepting} style={S.acceptBtn}>
              {accepting ? '⏳...' : '✅ Accept Result'}
            </button>
          )}
          {isComputed && (
            <button onClick={handleEvaluate} disabled={evaluating} style={S.secondaryBtn}>
              🔄 Re-evaluate
            </button>
          )}
        </div>
      </div>

      {error && <div style={S.errorBanner}>⚠️ {error}<button onClick={() => setError(null)} style={S.errorClose}>✕</button></div>}

      {/* Warnings */}
      {evaluation?.warnings?.map((w, i) => (
        <div key={i} style={S.warningBanner}>⚠️ {w.message}</div>
      ))}

      <div style={S.twoCol}>
        {/* ─── LEFT: READINESS STEPPER ─── */}
        <div style={S.leftCol}>

          {/* Step 1: Script Check */}
          <div style={S.stepCard}>
            <div style={S.stepHeader}>
              <span style={S.stepIcon(hasEventTag)}>1</span>
              <h3 style={S.stepTitle}>Script Ready</h3>
              <span style={S.stepStatus(hasEventTag)}>{hasEventTag ? '✓' : '!'}</span>
            </div>
            <div style={S.stepBody}>
              <div style={S.stepRow}><span style={S.label}>Beats detected:</span><span style={S.value}>{beatCount}</span></div>
              <div style={S.stepRow}><span style={S.label}>[EVENT:] tag:</span><span style={S.value}>{hasEventTag ? '✅ Present' : '❌ Missing'}</span></div>
              {!hasEventTag && <div style={S.stepHint}>Add an [EVENT: name="..." prestige=7 cost=150 strictness=6 deadline="high"] tag to your script.</div>}
              <Link to={`/episodes/${episodeId}?tab=scripts`} style={S.stepLink}>→ Go to Script Tab</Link>
            </div>
          </div>

          {/* Step 2: Wardrobe */}
          <div style={S.stepCard}>
            <div style={S.stepHeader}>
              <span style={S.stepIcon(true)}>2</span>
              <h3 style={S.stepTitle}>Wardrobe</h3>
              <span style={S.stepStatus(true)}>~</span>
            </div>
            <div style={S.stepBody}>
              <div style={S.stepHint}>Wardrobe scoring uses neutral defaults if no items are assigned. Assign wardrobe items for accurate style matching.</div>
              <Link to={`/episodes/${episodeId}?tab=wardrobe`} style={S.stepLink}>→ Assign Wardrobe</Link>
            </div>
          </div>

          {/* Step 3: Event + Stats */}
          <div style={S.stepCard}>
            <div style={S.stepHeader}>
              <span style={S.stepIcon(charState != null)}>3</span>
              <h3 style={S.stepTitle}>Event & Stats</h3>
            </div>
            <div style={S.stepBody}>
              {evaluation?.event_parsed && (
                <div style={S.eventBox}>
                  <div style={S.eventName}>{evaluation.event_parsed.name || 'Event'}</div>
                  <div style={S.eventTags}>
                    {evaluation.event_parsed.prestige && <span style={S.eventTag}>⭐ Prestige {evaluation.event_parsed.prestige}</span>}
                    {evaluation.event_parsed.cost && <span style={S.eventTag}>🪙 Cost {evaluation.event_parsed.cost}</span>}
                    {evaluation.event_parsed.strictness && <span style={S.eventTag}>📏 Strictness {evaluation.event_parsed.strictness}</span>}
                    {evaluation.event_parsed.deadline && <span style={S.eventTag}>⏰ {evaluation.event_parsed.deadline}</span>}
                    {evaluation.event_parsed.dress_code && <span style={S.eventTag}>👗 {evaluation.event_parsed.dress_code}</span>}
                  </div>
                </div>
              )}
              {charState && (
                <div style={S.statsBox}>
                  <div style={S.statsTitle}>Lala's Current Stats</div>
                  <div style={S.statsGrid}>
                    {Object.entries(charState.state || {}).map(([key, val]) => (
                      <div key={key} style={S.statItem}>
                        <span style={S.statEmoji}>{STAT_ICONS[key] || '📊'}</span>
                        <span style={S.statName}>{key.replace(/_/g, ' ')}</span>
                        <span style={S.statVal}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Results */}
          {evaluation && evaluation.score != null && (
            <div style={S.stepCard}>
              <div style={S.stepHeader}>
                <span style={S.stepIcon(true)}>4</span>
                <h3 style={S.stepTitle}>Results</h3>
              </div>
              <div style={S.stepBody}>
                {/* Stat Deltas */}
                {evaluation.stat_deltas && (
                  <div style={S.deltasBox}>
                    <div style={S.deltasTitle}>Stat Changes (on Accept)</div>
                    <div style={S.deltasGrid}>
                      {Object.entries(evaluation.stat_deltas).filter(([, v]) => v !== 0).map(([key, val]) => (
                        <div key={key} style={S.deltaItem}>
                          <span>{STAT_ICONS[key] || '📊'} {key.replace(/_/g, ' ')}</span>
                          <span style={{ color: val > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {val > 0 ? '+' : ''}{val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overrides Applied */}
                {(evaluation.overrides || []).length > 0 && (
                  <div style={S.overridesLog}>
                    <div style={S.deltasTitle}>Overrides Applied</div>
                    {evaluation.overrides.map((o, i) => (
                      <div key={i} style={S.overrideEntry}>
                        <span style={S.overrideType}>{o.type === 'tier_change' ? '⬆️' : '🎨'}</span>
                        <span>{o.reason_code?.replace(/_/g, ' ')}</span>
                        {o.tier_from && <span style={S.overrideTier}>{o.tier_from} → {o.tier_to}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: SCORE CARD ─── */}
        <div style={S.rightCol}>
          {evaluation && evaluation.score != null ? (
            <>
              {/* Big Score */}
              <div style={S.scoreCard}>
                <div style={{ ...S.tierBadge, background: tierConfig?.bg }}>
                  <span style={S.tierEmoji}>{tierConfig?.emoji}</span>
                  <span style={S.tierLabel}>{tierConfig?.label}</span>
                </div>
                <div style={S.scoreNumber}>{evaluation.score}</div>
                <div style={S.scoreSubtext}>out of 100</div>

                {/* Narrative */}
                <div style={S.narrativeBox}>
                  <div style={S.narrativeText}>
                    {evaluation.narrative_lines?.[narrativeStyle] || evaluation.narrative_lines?.short || ''}
                  </div>
                  <div style={S.narrativeTabs}>
                    {['short', 'dramatic', 'comedic'].map(style => (
                      <button
                        key={style}
                        onClick={() => setNarrativeStyle(style)}
                        style={narrativeStyle === style ? S.narrativeTabActive : S.narrativeTab}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div style={S.breakdownCard}>
                <h3 style={S.breakdownTitle}>Score Breakdown</h3>
                {evaluation.breakdown && Object.entries(evaluation.breakdown).map(([key, info]) => (
                  <div key={key} style={S.breakdownRow}>
                    <span style={S.breakdownLabel}>{key.replace(/_/g, ' ')}</span>
                    <div style={S.breakdownBarOuter}>
                      <div style={S.breakdownBar(info.value, info.max || 40)} />
                    </div>
                    <span style={{ ...S.breakdownValue, color: info.value >= 0 ? '#16a34a' : '#dc2626' }}>
                      {info.value > 0 ? '+' : ''}{info.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {!isAccepted && (
                <div style={S.actionsCard}>
                  {!hasOverrides && nextTier && (
                    <button onClick={() => {
                      setOverrideTier(nextTier);
                      setOverrideNarrative('');
                      setOverrideReason('');
                      setShowOverrideModal(true);
                    }} style={S.overrideBtn}>
                      ⬆️ Override → {nextTier.toUpperCase()}
                    </button>
                  )}
                  {hasOverrides && <div style={S.overrideNote}>✓ Override applied (max 1 per episode)</div>}
                  <button onClick={handleAccept} disabled={accepting} style={S.acceptBtnLarge}>
                    {accepting ? '⏳ Applying...' : '✅ Accept & Apply Stats'}
                  </button>
                </div>
              )}

              {isAccepted && (
                <div style={S.acceptedBanner}>
                  ✅ Episode accepted. Stats applied to Lala's running state.
                </div>
              )}
            </>
          ) : (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>🎯</div>
              <div style={S.emptyTitle}>Ready to Evaluate</div>
              <div style={S.emptyText}>
                {hasEventTag
                  ? 'Click "Evaluate Episode" to compute the score.'
                  : 'Add an [EVENT:] tag to your script first, then evaluate.'}
              </div>
              <button onClick={handleEvaluate} disabled={evaluating || !hasEventTag} style={S.primaryBtn}>
                {evaluating ? '⏳ Computing...' : '🎯 Evaluate Episode'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── OVERRIDE MODAL ─── */}
      {showOverrideModal && (
        <div style={S.modalOverlay} onClick={() => setShowOverrideModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Override Result</h2>
            <p style={S.modalSub}>
              {evaluation.tier_final?.toUpperCase()} → {overrideTier?.toUpperCase()}
            </p>

            <div style={S.formGroup}>
              <label style={S.formLabel}>Reason</label>
              <select value={overrideReason} onChange={e => setOverrideReason(e.target.value)} style={S.select}>
                <option value="">Select reason...</option>
                {OVERRIDE_REASONS.map(r => (
                  <option key={r.code} value={r.code}>{r.label} ({r.category})</option>
                ))}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel}>Cost</label>
              <select value={overrideCostIdx} onChange={e => setOverrideCostIdx(parseInt(e.target.value))} style={S.select}>
                {OVERRIDE_COSTS.map((c, i) => (
                  <option key={i} value={i}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel}>Narrative Line (optional)</label>
              <textarea
                value={overrideNarrative}
                onChange={e => setOverrideNarrative(e.target.value)}
                placeholder="The Dream Fund hit a milestone — Lala's glow-up landed harder than expected."
                style={S.textarea}
                rows={3}
              />
            </div>

            <div style={S.modalActions}>
              <button onClick={() => setShowOverrideModal(false)} style={S.secondaryBtn}>Cancel</button>
              <button onClick={handleOverride} disabled={!overrideReason || overriding} style={S.primaryBtn}>
                {overriding ? '⏳...' : `Apply Override → ${overrideTier?.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── HELPERS ───

function getNextTier(current) {
  const order = ['fail', 'mid', 'pass', 'slay'];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}


// ─── LIGHT THEME STYLES ───

const S = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  loadingMsg: { textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 16 },
  errorMsg: { textAlign: 'center', padding: 60, color: '#dc2626', fontSize: 16 },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  backLink: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 8px', fontSize: 24, fontWeight: 700, color: '#1a1a2e' },
  headerMeta: { display: 'flex', gap: 8, alignItems: 'center' },
  statusPill: (color) => ({ padding: '4px 12px', borderRadius: 20, background: color + '15', color, fontSize: 12, fontWeight: 600 }),
  versionBadge: { padding: '4px 8px', borderRadius: 4, background: '#f1f5f9', color: '#64748b', fontSize: 11 },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },

  primaryBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 14, cursor: 'pointer' },
  acceptBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  errorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 },
  errorClose: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' },
  warningBanner: { padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 13, marginBottom: 8 },

  twoCol: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  leftCol: { flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: 12 },
  rightCol: { flex: '1 1 45%', position: 'sticky', top: 20 },

  // Step Cards
  stepCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  stepHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f1f5f9' },
  stepIcon: (done) => ({ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', background: done ? '#6366f1' : '#cbd5e1', flexShrink: 0 }),
  stepTitle: { fontSize: 14, fontWeight: 600, color: '#1a1a2e', margin: 0, flex: 1 },
  stepStatus: (ok) => ({ fontSize: 14, fontWeight: 700, color: ok ? '#16a34a' : '#eab308' }),
  stepBody: { padding: '12px 16px' },
  stepRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 },
  label: { color: '#64748b' },
  value: { color: '#1a1a2e', fontWeight: 600 },
  stepHint: { padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, marginTop: 8 },
  stepLink: { display: 'inline-block', marginTop: 8, color: '#6366f1', fontSize: 12, fontWeight: 500, textDecoration: 'none' },

  // Event Box
  eventBox: { padding: 12, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, marginBottom: 12 },
  eventName: { fontSize: 15, fontWeight: 700, color: '#6b21a8', marginBottom: 6 },
  eventTags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  eventTag: { padding: '2px 8px', background: '#f3e8ff', borderRadius: 4, fontSize: 11, color: '#7c3aed' },

  // Stats Box
  statsBox: { padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 },
  statsTitle: { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 },
  statItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderRadius: 6, border: '1px solid #f1f5f9' },
  statEmoji: { fontSize: 14 },
  statName: { flex: 1, fontSize: 11, color: '#64748b', textTransform: 'capitalize' },
  statVal: { fontSize: 16, fontWeight: 700, color: '#1a1a2e' },

  // Deltas
  deltasBox: { padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12 },
  deltasTitle: { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' },
  deltasGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  deltaItem: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 140, fontSize: 13 },

  // Overrides log
  overridesLog: { padding: 12, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8 },
  overrideEntry: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#92400e', padding: '4px 0' },
  overrideType: { fontSize: 14 },
  overrideTier: { fontWeight: 700, marginLeft: 'auto' },

  // Score Card
  scoreCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16 },
  tierBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 40, marginBottom: 12 },
  tierEmoji: { fontSize: 24 },
  tierLabel: { fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 2 },
  scoreNumber: { fontSize: 64, fontWeight: 800, color: '#1a1a2e', lineHeight: 1 },
  scoreSubtext: { color: '#94a3b8', fontSize: 14, marginTop: 4 },

  narrativeBox: { marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 10 },
  narrativeText: { fontSize: 15, color: '#334155', lineHeight: 1.5, fontStyle: 'italic', minHeight: 40 },
  narrativeTabs: { display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 },
  narrativeTab: { padding: '3px 10px', background: '#e2e8f0', border: 'none', borderRadius: 4, color: '#64748b', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' },
  narrativeTabActive: { padding: '3px 10px', background: '#6366f1', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' },

  // Breakdown
  breakdownCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 },
  breakdownTitle: { fontSize: 14, fontWeight: 600, color: '#1a1a2e', margin: '0 0 12px' },
  breakdownRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  breakdownLabel: { flex: '0 0 140px', fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  breakdownBarOuter: { flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  breakdownBar: (val, max) => {
    const absVal = Math.abs(val);
    const absMax = Math.abs(max) || 40;
    const pct = Math.min((absVal / absMax) * 100, 100);
    return { height: '100%', width: `${pct}%`, borderRadius: 4, background: val >= 0 ? '#6366f1' : '#dc2626', transition: 'width 0.3s' };
  },
  breakdownValue: { flex: '0 0 40px', textAlign: 'right', fontSize: 13, fontWeight: 700 },

  // Actions
  actionsCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  overrideBtn: { padding: '10px 20px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, color: '#92400e', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  overrideNote: { padding: 10, background: '#f0fdf4', borderRadius: 6, color: '#16a34a', fontSize: 13, textAlign: 'center' },
  acceptBtnLarge: { padding: '14px 24px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  acceptedBanner: { padding: 20, background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 12, color: '#16a34a', fontSize: 16, fontWeight: 600, textAlign: 'center' },

  // Empty state
  emptyState: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  emptyText: { color: '#64748b', fontSize: 14, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' },

  // Modal
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' },
  modalSub: { fontSize: 14, color: '#6366f1', fontWeight: 600, margin: '0 0 16px' },
  formGroup: { marginBottom: 14 },
  formLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, color: '#1a1a2e', background: '#fff' },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
};

export default EvaluateEpisode;
