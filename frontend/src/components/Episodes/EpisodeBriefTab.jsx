// frontend/src/components/Episodes/EpisodeBriefTab.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

/**
 * EpisodeBriefTab — Surfaces the EpisodeBrief snapshot.
 *
 * The brief captures everything from the source event at generation time:
 * creative intent (editable) plus a frozen snapshot of event difficulty,
 * career context, canon consequences, narrative chain, and AI beat outline.
 *
 * Editable fields (per episodeBriefRoutes.js PUT whitelist):
 *   narrative_purpose, forward_hook, episode_archetype, designed_intent,
 *   allowed_outcomes, arc_number, position_in_arc, event_difficulty,
 *   lala_state_snapshot
 *
 * Read-only snapshot fields:
 *   career_context, canon_consequences, narrative_chain, event_metadata,
 *   beat_outline (these came from the source event and shouldn't drift)
 */

const ARCHETYPES = ['Trial', 'Temptation', 'Breakdown', 'Redemption', 'Showcase', 'Rising', 'Pressure', 'Cliffhanger'];
const INTENTS = ['slay', 'pass', 'safe', 'fail'];
const INTENT_CONFIG = {
  slay: { emoji: '👑', color: '#FFD700', bg: '#FFFBEB' },
  pass: { emoji: '✨', color: '#22c55e', bg: '#f0fdf4' },
  safe: { emoji: '😐', color: '#eab308', bg: '#fefce8' },
  fail: { emoji: '💔', color: '#dc2626', bg: '#fef2f2' },
};

function EpisodeBriefTab({ episode }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [parentEvent, setParentEvent] = useState(null);
  // Local edits — flushed to the server on blur / button click. Source fields
  // come from the brief; we only PUT diffs.
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!episode?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/v1/episode-brief/${episode.id}`);
        if (cancelled) return;
        const b = data?.data || null;
        setBrief(b);
        setDraft({
          narrative_purpose: b?.narrative_purpose || '',
          forward_hook: b?.forward_hook || '',
          episode_archetype: b?.episode_archetype || '',
          designed_intent: b?.designed_intent || '',
          allowed_outcomes: Array.isArray(b?.allowed_outcomes) ? b.allowed_outcomes : [],
          arc_number: b?.arc_number ?? '',
          position_in_arc: b?.position_in_arc ?? '',
        });

        // Resolve the parent event (if narrative_chain references one) so we
        // can render a clickable link instead of a bare UUID.
        const parentId = b?.narrative_chain?.parent_event_id;
        const showId = episode.show_id || episode.show?.id;
        if (parentId && showId) {
          api.get(`/api/v1/world/${showId}/events`).then(({ data: ev }) => {
            if (cancelled) return;
            const events = ev?.events || [];
            setParentEvent(events.find(e => e.id === parentId) || null);
          }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [episode?.id, episode?.show_id]);

  const isLocked = brief?.status === 'locked';

  const saveField = async (field, value) => {
    if (!brief || isLocked) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/api/v1/episode-brief/${episode.id}`, { [field]: value });
      setBrief(data?.data || brief);
    } catch (err) {
      alert('Save failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleOutcome = (outcome) => {
    if (isLocked) return;
    const next = draft.allowed_outcomes.includes(outcome)
      ? draft.allowed_outcomes.filter(o => o !== outcome)
      : [...draft.allowed_outcomes, outcome];
    setDraft(d => ({ ...d, allowed_outcomes: next }));
    saveField('allowed_outcomes', next);
  };

  const lockBrief = async () => {
    if (!window.confirm('Lock this brief? Once locked, creative fields cannot be edited (only an admin can unlock via the database).')) return;
    try {
      const { data } = await api.post(`/api/v1/episode-brief/${episode.id}/lock`);
      setBrief(data?.data || brief);
    } catch (err) {
      alert('Lock failed: ' + (err?.response?.data?.error || err.message));
    }
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading brief…</div>;
  if (error) return <div style={{ padding: 20, color: '#dc2626' }}>Error: {error}</div>;
  if (!brief) return <div style={{ padding: 20, color: '#94a3b8' }}>No brief yet.</div>;

  const S = {
    card: { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 12 },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, fontFamily: "'DM Mono', monospace" },
    label: { fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, display: 'block' },
    snapshotBadge: { padding: '1px 6px', background: '#f1f5f9', color: '#64748b', borderRadius: 3, fontSize: 8, fontWeight: 600, marginLeft: 6, fontFamily: "'DM Mono', monospace" },
    input: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: isLocked ? '#f8fafc' : '#fff' },
    chip: (active, color) => ({ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', border: `1px solid ${active ? color : '#e2e8f0'}`, background: active ? color + '22' : '#fff', color: active ? color : '#64748b', opacity: isLocked ? 0.6 : 1 }),
    pre: { background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 240, color: '#475569', fontFamily: "'DM Mono', monospace", border: '1px solid #e2e8f0' },
  };

  // Snapshot helpers — read-only objects come from the source event at generate
  // time; we render whatever's there without trying to interpret unknown keys.
  const careerCtx = brief.career_context || {};
  const eventDiff = brief.event_difficulty || {};
  const canonCons = brief.canon_consequences || {};
  const narChain = brief.narrative_chain || {};
  const eventMeta = brief.event_metadata || {};
  const beatOutline = Array.isArray(brief.beat_outline) ? brief.beat_outline : [];
  const seeds = Array.isArray(narChain.seeds_future_events) ? narChain.seeds_future_events : [];
  const hasCanonCons = Object.keys(canonCons).length > 0;
  const hasCareerCtx = Object.keys(careerCtx).length > 0;
  const hasEventDiff = Object.keys(eventDiff).length > 0;
  const hasEventMeta = Object.keys(eventMeta).length > 0;
  const hasNarChain = Object.keys(narChain).length > 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Status header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>✨ Episode Brief</h2>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Creative intent + snapshot from the source event
            {brief.ai_generated_at && <span style={{ marginLeft: 8, color: '#94a3b8' }}>· generated {new Date(brief.ai_generated_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 11, color: '#94a3b8' }}>Saving…</span>}
          {isLocked ? (
            <span style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>🔒 LOCKED</span>
          ) : (
            <button onClick={lockBrief} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Lock brief</button>
          )}
        </div>
      </div>

      {/* CREATIVE INTENT — editable */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🎯 Creative Intent</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>Archetype</label>
            <select
              value={draft.episode_archetype || ''}
              disabled={isLocked}
              onChange={(e) => { setDraft(d => ({ ...d, episode_archetype: e.target.value })); saveField('episode_archetype', e.target.value || null); }}
              style={S.input}
            >
              <option value="">— none —</option>
              {ARCHETYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Designed Intent</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {INTENTS.map(i => {
                const cfg = INTENT_CONFIG[i];
                const active = draft.designed_intent === i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      const next = active ? '' : i;
                      setDraft(d => ({ ...d, designed_intent: next }));
                      saveField('designed_intent', next || null);
                    }}
                    style={S.chip(active, cfg.color)}
                  >
                    {cfg.emoji} {i}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Narrative Purpose</label>
          <textarea
            value={draft.narrative_purpose}
            disabled={isLocked}
            onChange={(e) => setDraft(d => ({ ...d, narrative_purpose: e.target.value }))}
            onBlur={() => brief.narrative_purpose !== draft.narrative_purpose && saveField('narrative_purpose', draft.narrative_purpose)}
            placeholder="Why does this episode exist? What story job is it doing?"
            rows={3}
            style={{ ...S.input, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={S.label}>Forward Hook</label>
          <textarea
            value={draft.forward_hook}
            disabled={isLocked}
            onChange={(e) => setDraft(d => ({ ...d, forward_hook: e.target.value }))}
            onBlur={() => brief.forward_hook !== draft.forward_hook && saveField('forward_hook', draft.forward_hook)}
            placeholder="What pulls the viewer into the next episode?"
            rows={2}
            style={{ ...S.input, resize: 'vertical' }}
          />
        </div>
      </div>

      {/* ALLOWED OUTCOMES */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🎲 Allowed Outcomes</div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Which tiers can this episode end on? Disabling tiers narrows the script generator.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {INTENTS.map(o => {
            const cfg = INTENT_CONFIG[o];
            const active = draft.allowed_outcomes.includes(o);
            return (
              <button
                key={o}
                type="button"
                disabled={isLocked}
                onClick={() => toggleOutcome(o)}
                style={S.chip(active, cfg.color)}
              >
                {active ? '✓' : '✗'} {cfg.emoji} {o}
              </button>
            );
          })}
        </div>
      </div>

      {/* ARC POSITION — editable numbers */}
      <div style={S.card}>
        <div style={S.sectionTitle}>📍 Arc Position</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={S.label}>Arc number</label>
            <input
              type="number"
              value={draft.arc_number}
              disabled={isLocked}
              onChange={(e) => setDraft(d => ({ ...d, arc_number: e.target.value }))}
              onBlur={() => {
                const v = draft.arc_number === '' ? null : parseInt(draft.arc_number, 10);
                if (v !== brief.arc_number) saveField('arc_number', v);
              }}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Position in arc</label>
            <input
              type="number"
              value={draft.position_in_arc}
              disabled={isLocked}
              onChange={(e) => setDraft(d => ({ ...d, position_in_arc: e.target.value }))}
              onBlur={() => {
                const v = draft.position_in_arc === '' ? null : parseInt(draft.position_in_arc, 10);
                if (v !== brief.position_in_arc) saveField('position_in_arc', v);
              }}
              style={S.input}
            />
          </div>
        </div>
      </div>

      {/* DIFFICULTY — snapshot */}
      {hasEventDiff && (
        <div style={S.card}>
          <div style={S.sectionTitle}>⚡ Event Difficulty<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {eventDiff.strictness != null && (
              <div><label style={S.label}>Strictness</label><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{eventDiff.strictness}/10</div></div>
            )}
            {eventDiff.deadline_type && (
              <div><label style={S.label}>Deadline type</label><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{eventDiff.deadline_type}</div></div>
            )}
            {eventDiff.deadline_minutes != null && (
              <div><label style={S.label}>Deadline (min)</label><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{eventDiff.deadline_minutes}</div></div>
            )}
          </div>
        </div>
      )}

      {/* CAREER CONTEXT — snapshot */}
      {hasCareerCtx && (
        <div style={S.card}>
          <div style={S.sectionTitle}>💼 Career Context<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {careerCtx.career_tier && (
              <div><label style={S.label}>Tier</label><div style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600 }}>{careerCtx.career_tier}</div></div>
            )}
            {careerCtx.career_milestone && (
              <div><label style={S.label}>Milestone</label><div style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600 }}>{careerCtx.career_milestone}</div></div>
            )}
            {careerCtx.success_unlock && (
              <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Success unlock</label><div style={{ fontSize: 12, color: '#16a34a', lineHeight: 1.5 }}>{careerCtx.success_unlock}</div></div>
            )}
            {careerCtx.fail_consequence && (
              <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Fail consequence</label><div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>{careerCtx.fail_consequence}</div></div>
            )}
          </div>
        </div>
      )}

      {/* CANON CONSEQUENCES — snapshot */}
      {hasCanonCons && (
        <div style={S.card}>
          <div style={S.sectionTitle}>🌐 Canon Consequences<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <pre style={S.pre}>{JSON.stringify(canonCons, null, 2)}</pre>
        </div>
      )}

      {/* NARRATIVE CHAIN — snapshot */}
      {hasNarChain && (
        <div style={S.card}>
          <div style={S.sectionTitle}>🔗 Narrative Chain<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: seeds.length || narChain.chain_reason ? 12 : 0 }}>
            {narChain.chain_position != null && (
              <div><label style={S.label}>Chain position</label><div style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600 }}>{narChain.chain_position}</div></div>
            )}
            {narChain.parent_event_id && (
              <div>
                <label style={S.label}>Parent event</label>
                {parentEvent ? (
                  parentEvent.used_in_episode_id ? (
                    <Link to={`/episodes/${parentEvent.used_in_episode_id}`} style={{ fontSize: 13, color: '#B8962E', fontWeight: 600 }}>{parentEvent.name} →</Link>
                  ) : (
                    <div style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600 }}>{parentEvent.name} <span style={{ fontSize: 10, color: '#94a3b8' }}>(no episode yet)</span></div>
                  )
                ) : (
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>{narChain.parent_event_id.slice(0, 8)}…</div>
                )}
              </div>
            )}
          </div>
          {narChain.chain_reason && (
            <div style={{ marginBottom: seeds.length ? 12 : 0 }}>
              <label style={S.label}>Chain reason</label>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, fontStyle: 'italic' }}>{narChain.chain_reason}</div>
            </div>
          )}
          {seeds.length > 0 && (
            <div>
              <label style={S.label}>Seeds for future events</label>
              <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                {seeds.map((seed, i) => (
                  <li key={i}>{typeof seed === 'string' ? seed : JSON.stringify(seed)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI BEAT OUTLINE — snapshot */}
      {beatOutline.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>📋 AI Beat Outline<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Drafted by AI at generation time. Used by Suggest Scenes; refined in the Scene Planner.</div>
          <ol style={{ margin: 0, padding: '0 0 0 22px' }}>
            {beatOutline.map((beat, i) => (
              <li key={i} style={{ marginBottom: 8, fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600 }}>{beat.summary || beat.name || `Beat ${beat.beat_number || i + 1}`}</div>
                {beat.dramatic_function && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>{beat.dramatic_function}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* EVENT METADATA (catch-all) — snapshot */}
      {hasEventMeta && (
        <div style={S.card}>
          <div style={S.sectionTitle}>📦 Event Metadata<span style={S.snapshotBadge}>SNAPSHOT</span></div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Show raw metadata (rewards, requirements, browse pools, overlay template…)</summary>
            <pre style={{ ...S.pre, marginTop: 10 }}>{JSON.stringify(eventMeta, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Link to={`/episodes/${episode.id}/plan`} style={{ padding: '6px 14px', borderRadius: 6, background: '#B8962E', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>🎬 Open Scene Planner</Link>
        {brief.event_id && (episode.show_id || episode.show?.id) && (
          <Link to={`/shows/${episode.show_id || episode.show.id}/world?tab=events`} style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>🎭 Edit Source Event</Link>
        )}
      </div>
    </div>
  );
}

export default EpisodeBriefTab;
