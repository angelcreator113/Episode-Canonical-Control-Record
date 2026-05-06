// StoryDashboard.jsx
// The living story — arc state, character evolution, recent scenes, what's next
// Tab in the Universe page, story-side cluster

import { useState, useEffect } from 'react';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '';

// ─── Track 6 CP10 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites. listFlaggedGrowthApi duplicated locally
// per v2.12 §9.11 (CP8 StoryProposer has it). URL COMPOSITION NOTE:
// API='' empty default + ${API}/... → relative paths without /api/v1/
// prefix. Preserved verbatim per v2.16 §9.11 "bugs surface, don't fix"
// discipline (same shape as WritingRhythm). If pre-existing bug, surfaced
// for Step 3 audit. apiClient.baseURL is also ''.
export const postArcStageApi = (payload) =>
  apiClient.post(`${API}/memories/arc-stage`, payload);
export const listRegistryCharactersApi = (registryId) =>
  apiClient.get(`${API}/character-registry/${registryId}/characters`);
export const listSceneProposalsApi = (bookId, limit) =>
  apiClient.get(`${API}/memories/scene-proposals?book_id=${bookId}&limit=${limit}`);
export const listUnacknowledgedReviewsApi = () =>
  apiClient.get(`${API}/reviews/unacknowledged`);
export const listFlaggedGrowthApi = () =>
  apiClient.get(`${API}/memories/character-growth/flagged`);
export const acknowledgeReviewApi = (id) =>
  apiClient.post(`${API}/reviews/${id}/acknowledge`);

const C = {
  bg: '#f7f4ef',
  surface: '#ffffff',
  surfaceAlt: '#faf8f5',
  bgDeep: '#f0ece4',
  border: '#e0d9ce',
  borderDark: '#c8bfb0',
  text: '#1a1714',
  textDim: '#6b6259',
  textFaint: '#a89f94',
  accent: '#b8863e',
  accentSoft: '#b8863e0f',
  gold: '#c9a96e',
  red: '#b84040',
  redSoft: '#b8404012',
  green: '#3a8a60',
  greenSoft: '#3a8a6012',
  blue: '#3a6a8a',
  blueSoft: '#3a6a8a12',
  purple: '#6a3a8a',
  purpleSoft: '#6a3a8a12',
};

const ARC_STAGES = [
  { key: 'establishment', label: 'Establishment', sub: 'Her routine. The scroll. The hook.', advance_at: 8 },
  { key: 'pressure',      label: 'Pressure',      sub: 'Vision arrives. Production begins.', advance_at: 16 },
  { key: 'crisis',        label: 'Crisis',         sub: 'The creator changes. The fear lands.', advance_at: 22 },
  { key: 'integration',   label: 'Integration',    sub: 'Lala is born. David sees it. She knows.', advance_at: 30 },
];

const SCENE_TYPE_COLORS = {
  production_breakdown: C.red,
  creator_study:        C.blue,
  interior_reckoning:   C.purple,
  david_mirror:         C.green,
  paying_man_pressure:  C.red,
  bestie_moment:        C.accent,
  lala_seed:            C.gold,
  general:              C.textFaint,
};

export default function StoryDashboard({ bookId, registryId }) {
  const [arc, setArc] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [recentScenes, setRecentScenes] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [growthFlags, setGrowthFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadAll(); }, [bookId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadArc(), loadCharacters(), loadRecentScenes(), loadReviews(), loadGrowthFlags()]);
    setLoading(false);
  }

  async function loadArc() {
    if (!bookId) return;
    try {
      const res = await postArcStageApi({ book_id: bookId });
      setArc(res.data);
    } catch {}
  }

  async function loadCharacters() {
    if (!registryId) return;
    try {
      const res = await listRegistryCharactersApi(registryId);
      setCharacters((res.data?.characters || []).filter(c => c.status !== 'declined'));
    } catch {}
  }

  async function loadRecentScenes() {
    if (!bookId) return;
    try {
      const res = await listSceneProposalsApi(bookId, 8);
      setRecentScenes(res.data?.proposals || []);
    } catch {}
  }

  async function loadReviews() {
    try {
      const res = await listUnacknowledgedReviewsApi();
      setPendingReviews((res.data?.reviews || []).filter(r => !r.passed));
    } catch {}
  }

  async function loadGrowthFlags() {
    try {
      const res = await listFlaggedGrowthApi();
      setGrowthFlags(res.data?.flags || []);
    } catch {}
  }

  async function acknowledgeReview(id) {
    try {
      await acknowledgeReviewApi(id);
      setPendingReviews(p => p.filter(r => r.id !== id));
    } catch {}
  }

  async function recalcArc() {
    setRefreshing(true);
    await loadArc();
    setRefreshing(false);
  }

  const currentStage = ARC_STAGES.find(s => s.key === arc?.stage) || ARC_STAGES[0];
  const totalScenes = arc ? Object.values(arc.scores || {}).reduce((a, b) => a + b, 0) : 0;

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: C.textFaint, fontFamily: 'system-ui' }}>
        <Spin color={C.accent} /> <span style={{ marginLeft: '12px', fontSize: '13px' }}>Reading the story…</span>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text, padding: '0' }}>

      {/* ── Attention flags ── */}
      {(pendingReviews.length > 0 || growthFlags.length > 0) && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {pendingReviews.length > 0 && (
            <div style={{ flex: 1, minWidth: '220px', padding: '12px 16px', background: C.redSoft, border: `1px solid ${C.red}33`, borderLeft: `3px solid ${C.red}`, borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: C.red, fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>⚠ Franchise Violations</div>
              <div style={{ fontSize: '13px', color: C.textDim }}>{pendingReviews.length} scene{pendingReviews.length > 1 ? 's' : ''} failed post-generation review</div>
            </div>
          )}
          {growthFlags.length > 0 && (
            <div style={{ flex: 1, minWidth: '220px', padding: '12px 16px', background: `${C.accent}0f`, border: `1px solid ${C.accent}33`, borderLeft: `3px solid ${C.accent}`, borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: C.accent, fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Character Contradictions</div>
              <div style={{ fontSize: '13px', color: C.textDim }}>{growthFlags.length} character update{growthFlags.length > 1 ? 's' : ''} need your review</div>
            </div>
          )}
        </div>
      )}

      {/* ── Arc State ── */}
      <Section label="Book 1 Arc" action={refreshing ? null : { label: 'Recalculate', fn: recalcArc }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {ARC_STAGES.map((stage, i) => {
            const count = arc?.scores?.[stage.key] || 0;
            const isActive = arc?.stage === stage.key;
            const isPast = ARC_STAGES.indexOf(ARC_STAGES.find(s => s.key === arc?.stage)) > i;
            const pct = Math.min(100, (count / stage.advance_at) * 100);

            return (
              <div key={stage.key} style={{
                padding: '14px',
                background: isActive ? C.accentSoft : isPast ? C.bgDeep : C.surface,
                border: `1px solid ${isActive ? C.accent + '55' : C.border}`,
                borderTop: `2px solid ${isActive ? C.accent : isPast ? C.borderDark : C.border}`,
                borderRadius: '2px',
                opacity: !isActive && !isPast ? 0.6 : 1,
              }}>
                <div style={{ fontSize: '9px', color: isActive ? C.accent : C.textFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '4px' }}>
                  {stage.label} {isActive && '← now'}
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'Georgia, serif', color: isActive ? C.text : C.textDim, marginBottom: '4px' }}>{count}</div>
                <div style={{ height: '2px', background: C.bgDeep, borderRadius: '1px', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isActive ? C.accent : C.borderDark, borderRadius: '1px', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: '10px', color: C.textFaint, lineHeight: '1.4' }}>{stage.sub}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: C.bgDeep, borderRadius: '2px' }}>
          <Stat label="Total Scenes" value={totalScenes} />
          <Stat label="Current Stage" value={currentStage.label} />
          <Stat label="Next Milestone" value={`${currentStage.advance_at - (arc?.scores?.[currentStage.key] || 0)} scenes`} sub="to advance" />
        </div>
      </Section>

      {/* ── Characters — living wound state ── */}
      {characters.length > 0 && (
        <Section label="Characters — Living State">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
            {characters.map(char => {
              const name = char.selected_name || char.name;
              const isPnos = char.character_type === 'pnos' || char.character_type === 'interior_monologue';
              return (
                <div key={char.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${isPnos ? C.purple : C.accent}`,
                  borderRadius: '2px', padding: '14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: '600', color: C.text }}>{name}</div>
                    <div style={{ fontSize: '9px', color: isPnos ? C.purple : C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', background: isPnos ? C.purpleSoft : C.accentSoft, border: `1px solid ${isPnos ? C.purple : C.accent}33`, borderRadius: '2px' }}>
                      {char.character_type}
                    </div>
                  </div>
                  {char.wound && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '9px', color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Wound</div>
                      <p style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.5' }}>{char.wound}</p>
                    </div>
                  )}
                  {char.arc_summary && (
                    <div>
                      <div style={{ fontSize: '9px', color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Arc now</div>
                      <p style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.5' }}>{char.arc_summary}</p>
                    </div>
                  )}
                  {char.status === 'finalized' && (
                    <div style={{ marginTop: '8px', fontSize: '9px', color: C.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>● Finalized</div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Recent scenes ── */}
      {recentScenes.length > 0 && (
        <Section label="Recent Scene Proposals">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentScenes.map(scene => {
              const typeColor = SCENE_TYPE_COLORS[scene.scene_type] || C.textFaint;
              const statusColors = { proposed: C.accent, accepted: C.green, generated: C.blue, dismissed: C.textFaint, adjusted: C.accent };
              return (
                <div key={scene.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px' }}>
                  <div style={{ width: '3px', height: '40px', background: typeColor, borderRadius: '1px', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: typeColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{scene.scene_type?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '10px', color: statusColors[scene.status] || C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{scene.status}</span>
                      {scene.lala_seed_potential && <span style={{ fontSize: '10px', color: C.gold }}>✧ lala seed</span>}
                    </div>
                    <p style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {scene.emotional_stakes || scene.scene_brief?.slice(0, 100) || 'No brief'}
                    </p>
                  </div>
                  <div style={{ fontSize: '10px', color: C.textFaint, flexShrink: 0 }}>
                    {new Date(scene.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Violation review ── */}
      {pendingReviews.length > 0 && (
        <Section label="Franchise Violations — Needs Your Attention">
          {pendingReviews.map(review => (
            <div key={review.id} style={{ background: C.surface, border: `1px solid ${C.red}33`, borderTop: `2px solid ${C.red}`, borderRadius: '2px', padding: '16px', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: C.red, fontWeight: '600', marginBottom: '10px' }}>
                {review.violations?.length} violation{review.violations?.length > 1 ? 's' : ''} detected
              </div>
              {(review.violations || []).slice(0, 2).map((v, i) => (
                <div key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: i < review.violations.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ fontSize: '11px', color: C.textFaint, marginBottom: '3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{v.law_violated}</div>
                  <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '4px', fontStyle: 'italic' }}>"{v.offending_line}"</div>
                  <div style={{ fontSize: '12px', color: C.textDim }}>{v.why_it_violates}</div>
                  {v.suggested_rewrite && (
                    <div style={{ marginTop: '6px', padding: '8px 10px', background: C.greenSoft, border: `1px solid ${C.green}33`, borderRadius: '2px', fontSize: '12px', color: C.green }}>
                      Fix: {v.suggested_rewrite}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => acknowledgeReview(review.id)} style={{ marginTop: '8px', padding: '7px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '11px', color: C.textDim, cursor: 'pointer' }}>
                Acknowledge & Move On
              </button>
            </div>
          ))}
        </Section>
      )}

      {/* Empty state */}
      {totalScenes === 0 && characters.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: C.textFaint }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: C.textDim, marginBottom: '6px' }}>The story hasn't started yet.</div>
          <div style={{ fontSize: '13px' }}>Propose your first scene to begin.</div>
        </div>
      )}
    </div>
  );
}

function Section({ label, action, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: '#a89f94', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: '600' }}>{label}</div>
        {action && <button onClick={action.fn} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#a89f94', cursor: 'pointer', padding: 0 }}>{action.label}</button>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#a89f94', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontFamily: 'Georgia, serif', fontWeight: '600', color: '#1a1714' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: '#a89f94' }}>{sub}</div>}
    </div>
  );
}

function Spin({ color = '#b8863e' }) {
  return (
    <>
      <div style={{ display: 'inline-block', width: '16px', height: '16px', border: `2px solid #e0d9ce`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
