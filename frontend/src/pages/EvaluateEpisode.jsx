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
 *   - Tier badge (SLAY/PASS/SAFE/FAIL)
 *   - Narrative result line (short/dramatic/comedic + regenerate)
 *   - Style match sliders (hybrid override)
 *   - Override modal (tier bump + reason + cost + narrative)
 *   - Accept button → apply stat deltas
 *   - Out-of-order warning
 * 
 * Location: frontend/src/pages/EvaluateEpisode.jsx
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import { completeEpisode } from '../lib/episodeCompletion';

// ─── TIER CONFIG ───
const TIER_CONFIG = {
  slay: { emoji: '👑', label: 'SLAY', color: '#FFD700', bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' },
  pass: { emoji: '✨', label: 'PASS', color: '#22c55e', bg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
  safe: { emoji: '😐', label: 'SAFE', color: '#eab308', bg: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' },
  fail: { emoji: '💔', label: 'FAIL', color: '#dc2626', bg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
};

const STAT_ICONS = {
  coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰',
};


function EvaluateEpisode() {
  const { id: episodeId } = useParams();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState(null);
  const [charState, setCharState] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [narrativeStyle, setNarrativeStyle] = useState('short');

  // A completion the server refused: kept on screen until dismissed (lib/episodeCompletion).
  const [refusal, setRefusal] = useState(null);
  const admin = isAdmin(useContext(AuthContext)?.user);

  // Outfit data
  const [outfitData, setOutfitData] = useState(null);
  const [outfitLoading, setOutfitLoading] = useState(false);

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

  // ─── FETCH OUTFIT SCORE ───
  useEffect(() => {
    if (!episodeId) return;
    const fetchOutfit = async () => {
      setOutfitLoading(true);
      try {
        const res = await api.get(`/api/v1/wardrobe/outfit-score/${episodeId}`);
        if (res.data?.success) {
          setOutfitData(res.data);
        }
      } catch (err) {
        console.warn('Could not fetch outfit score:', err.message);
      } finally {
        setOutfitLoading(false);
      }
    };
    fetchOutfit();
  }, [episodeId]);

  // ─── EVALUATE ───
  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/evaluate`, { character_key: 'lala' });
      if (res.data.success) {
        setEvaluation(res.data.evaluation);
        // Reset episode status so Override/Accept buttons reappear
        setEpisode(prev => ({ ...prev, evaluation_status: 'computed', evaluation_json: res.data.evaluation }));
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

  // ─── COMPLETE ───
  // The one completion operation (lib/episodeCompletion), the same the
  // episode's Results tab runs. What is shown afterwards is the result the
  // server stored, on Results: this page's estimate is not it.
  const handleComplete = useCallback(async () => {
    setAccepting(true);
    setError(null);
    setRefusal(null);
    const out = await completeEpisode({ showId: episode?.show_id, episodeId, title: episode?.title });
    setAccepting(false);
    if (out.status === 'cancelled') return;
    if (out.status === 'refused') { setRefusal(out.refusal); return; }
    navigate(`/episodes/${episodeId}?tab=results`);
  }, [episodeId, episode, navigate]);

  // ─── HELPERS ───
  // Optional: a tag in the script overrides the linked event's values for the estimate. The server needs no tag.
  const hasEventTag = episode?.script_content?.includes('[EVENT:');
  const beatCount = (episode?.script_content?.match(/##\s*BEAT:/gi) || []).length;
  const isComputed = episode?.evaluation_status === 'computed' || evaluation?.score != null;
  const isAccepted = episode?.evaluation_status === 'accepted';
  const tierConfig = evaluation ? TIER_CONFIG[evaluation.tier_final] || TIER_CONFIG.safe : null;
  // A tier override recorded on this estimate: the tier shown is the overridden one, not what completion will calculate.
  const tierOverride = (evaluation?.overrides || []).find((o) => o.type === 'tier_change' && o.tier_from) || null;


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
              {isAccepted ? '✅ Completed' : isComputed ? '🔍 Estimate' : '⏳ No estimate yet'}
            </span>
            {evaluation?.formula_version && <span style={S.versionBadge}>Formula {evaluation.formula_version}</span>}
          </div>
        </div>
        <div style={S.headerActions}>
          {!isComputed && !isAccepted && (
            <button onClick={handleEvaluate} disabled={evaluating} style={S.primaryBtn} data-testid="evaluate-estimate">
              {evaluating ? '⏳ Computing...' : '🎯 Estimate the result'}
            </button>
          )}
          {isComputed && !isAccepted && (
            <button onClick={handleEvaluate} disabled={evaluating} style={S.secondaryBtn} data-testid="evaluate-recompute">
              🔄 Recompute the estimate
            </button>
          )}
          {!isAccepted && admin && (
            <button onClick={handleComplete} disabled={accepting} style={S.acceptBtn} data-testid="evaluate-complete">
              {accepting ? '⏳ Completing...' : 'Complete episode'}
            </button>
          )}
          {isAccepted && (
            <Link to={`/episodes/${episodeId}?tab=results`} style={{ ...S.secondaryBtn, textDecoration: 'none' }} data-testid="evaluate-view-result">View the stored result</Link>
          )}
        </div>
      </div>

      {error && <div style={S.errorBanner}>⚠️ {error}<button onClick={() => setError(null)} style={S.errorClose}>✕</button></div>}
      {/* A refused completion stays until dismissed: the server's words, and where to resolve it. */}
      {refusal && (
        <div style={S.errorBanner} role="alert" data-testid="evaluate-refusal">
          <span>
            <strong>{refusal.title}.</strong> {refusal.message} Nothing was booked.{' '}
            {refusal.action?.to && <Link to={refusal.action.to}>{refusal.action.label}</Link>}
            {refusal.action?.tab && <Link to={`/episodes/${episodeId}?tab=${refusal.action.tab}`}>{refusal.action.label}</Link>}
            {refusal.action?.retry && <button type="button" onClick={handleComplete} disabled={accepting} style={S.secondaryBtn}>{refusal.action.label}</button>}
          </span>
          <button onClick={() => setRefusal(null)} style={S.errorClose} aria-label="Dismiss this message">✕</button>
        </div>
      )}
      {!isAccepted && (
        <div style={S.warningBanner} data-testid="evaluate-estimate-note">
          This page shows an estimate. The final score, tier and money are worked out when the episode is completed, from its event and approved look at that moment, and can differ from what is shown here. Nothing on this page is a guaranteed reward.
          {!admin && ' Completing an episode needs an admin account.'}
        </div>
      )}

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
              <span style={S.stepIcon(true)}>1</span>
              <h3 style={S.stepTitle}>Script</h3>
              <span style={S.stepStatus(true)}>✓</span>
            </div>
            <div style={S.stepBody}>
              <div style={S.stepRow}><span style={S.label}>Beats detected:</span><span style={S.value}>{beatCount}</span></div>
              <div style={S.stepRow}><span style={S.label}>[EVENT:] tag:</span><span style={S.value}>{hasEventTag ? 'Present (overrides the linked event for this estimate)' : 'None (the linked event is used)'}</span></div>
              <Link to={`/episodes/${episodeId}?tab=scripts`} style={S.stepLink}>→ Go to Script Tab</Link>
            </div>
          </div>

          {/* Step 2: Wardrobe */}
          <div style={S.stepCard}>
            <div style={S.stepHeader}>
              <span style={S.stepIcon(outfitData?.hasOutfit)}>2</span>
              <h3 style={S.stepTitle}>Wardrobe</h3>
              {outfitData?.hasOutfit && (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: outfitData.confidence?.color || '#6366f1' }}>
                  {outfitData.confidence?.emoji} {outfitData.score}/100
                </span>
              )}
            </div>
            <div style={S.stepBody}>
              {outfitLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading outfit data...</div>
              ) : outfitData?.hasOutfit ? (
                <div>
                  {/* Synergy Score Bar */}
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Outfit Synergy</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: outfitData.confidence?.color || '#6366f1' }}>
                        {outfitData.confidence?.emoji} {outfitData.score}
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${outfitData.score}%`,
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${outfitData.confidence?.color || '#6366f1'}80, ${outfitData.confidence?.color || '#6366f1'})`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: outfitData.confidence?.color || '#6366f1', fontWeight: 600, marginTop: 4 }}>
                      {outfitData.confidence?.label}
                    </div>

                    {/* Breakdown badges */}
                    {outfitData.breakdown && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {Object.entries(outfitData.breakdown).filter(([, v]) => v > 0).map(([key, val]) => (
                          <span key={key} style={{
                            padding: '2px 8px', background: '#eef2ff', borderRadius: 4,
                            fontSize: 10, color: '#4338ca', fontWeight: 600,
                          }}>
                            +{val} {key.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outfit Items */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, marginBottom: 8 }}>
                    LOCKED OUTFIT ({outfitData.item_count} items)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(outfitData.items || []).map((item, idx) => {
                      const catIcons = { dress: '👗', top: '👚', bottom: '👖', shoes: '👠', accessories: '👜', jewelry: '💍', perfume: '🌸' };
                      const tierColors = {
                        basic: { bg: '#f1f5f9', color: '#64748b' },
                        safe: { bg: '#eef2ff', color: '#6366f1' },
                        luxury: { bg: '#fef3c7', color: '#92400e' },
                        elite: { bg: '#fef3c7', color: '#78350f' },
                      };
                      const tc = tierColors[item.tier] || tierColors.basic;

                      return (
                        <div key={item.id || idx} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                          borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 18 }}>{catIcons[item.category] || '👕'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              <span style={{
                                padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                                background: tc.bg, color: tc.color,
                              }}>
                                {item.tier}
                              </span>
                              {(item.aesthetic_tags || []).slice(0, 3).map((tag, ti) => (
                                <span key={ti} style={{
                                  padding: '1px 5px', background: '#f1f5f9', borderRadius: 3,
                                  fontSize: 9, color: '#64748b',
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                            {item.individual_score}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={S.stepHint}>Wardrobe scoring uses neutral defaults if no items are assigned. Assign wardrobe items for accurate style matching.</div>
                  <Link to={`/episodes/${episodeId}?tab=wardrobe`} style={S.stepLink}>→ Assign Wardrobe</Link>
                </div>
              )}
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
                      {Object.entries(evaluation.stat_deltas).filter(([, v]) => typeof v === 'number' && v !== 0).map(([key, val]) => (
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
                    <div style={S.deltasTitle}>Overrides recorded on this estimate (not applied at completion)</div>
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
                {tierOverride && !isAccepted && (
                  <div style={S.overriddenTierNote} data-testid="evaluate-overridden-tier">
                    Overridden estimate tier. The estimate calculated {(TIER_CONFIG[tierOverride.tier_from]?.label) || tierOverride.tier_from}; a recorded override shows {tierConfig?.label}. Completion ignores overrides: the final tier is calculated by the server when the episode is completed.
                  </div>
                )}
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

              {/* Actions: completing is the one operation, for an admin. */}
              {!isAccepted && admin && (
                <div style={S.actionsCard}>
                  <button onClick={handleComplete} disabled={accepting} style={S.acceptBtnLarge}>
                    {accepting ? '⏳ Completing...' : 'Complete episode'}
                  </button>
                </div>
              )}

              {isAccepted && (
                <div style={S.acceptedBanner}>
                  ✅ Episode completed. <Link to={`/episodes/${episodeId}?tab=results`}>View the stored result</Link>
                </div>
              )}
            </>
          ) : (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>🎯</div>
              <div style={S.emptyTitle}>No estimate yet</div>
              <div style={S.emptyText}>
                Estimate the result from this episode&apos;s event and look. The final result is worked out at completion.
              </div>
              <button onClick={handleEvaluate} disabled={evaluating} style={S.primaryBtn}>
                {evaluating ? '⏳ Computing...' : '🎯 Estimate the result'}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
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
  overriddenTierNote: { margin: '0 auto 12px', maxWidth: 420, padding: 10, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 13, lineHeight: 1.4 },
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
