// frontend/src/components/Episodes/EpisodeOverviewTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import SceneSuggestionReview from '../episode/SceneSuggestionReview';
import TimelinePlacementsSection from '../episode/TimelinePlacementsSection';

// EpisodeBrief enums — kept module-level so the chip rows don't re-create
// the array on every render. Order = display order.
const ARCHETYPES = ['Trial', 'Temptation', 'Breakdown', 'Redemption', 'Showcase', 'Rising', 'Pressure', 'Cliffhanger'];
const INTENTS = ['slay', 'pass', 'safe', 'fail'];

/**
 * EpisodeOverviewTab — Episode Dashboard
 *
 * Shows everything about this episode at a glance:
 * - Tier/score banner (if evaluated)
 * - Key stats row (status, prestige, cost, financial net)
 * - Event details
 * - Outfit summary
 * - Season position
 * - Quick actions
 */

const TIER_CONFIG = {
  slay: { emoji: '👑', label: 'SLAY', color: '#FFD700', bg: '#FFFBEB' },
  pass: { emoji: '✨', label: 'PASS', color: '#22c55e', bg: '#f0fdf4' },
  safe: { emoji: '😐', label: 'SAFE', color: '#eab308', bg: '#fefce8' },
  fail: { emoji: '💔', label: 'FAIL', color: '#dc2626', bg: '#fef2f2' },
};

/**
 * SectionBand — visual grouping for the Overview page.
 *
 * Renders a small monospace gold header above a hairline rule, then the
 * children. Used to separate IDENTITY / PRODUCTION / SOURCE / STAKES /
 * REFERENCE without competing with the cards below — the band is a quiet
 * organizational cue, not a heading element.
 */
function SectionBand({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid #e8d8b8',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#B8962E',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          fontFamily: "'DM Mono', monospace",
        }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EpisodeOverviewTab({ episode, show, onUpdate }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [allEvents, setAllEvents] = useState([]);  // every event in the show — drives the linker dropdown
  const [linkedEvents, setLinkedEvents] = useState([]);  // events whose used_in_episode_id is this episode
  const [sceneSets, setSceneSets] = useState([]);
  const [scriptInfo, setScriptInfo] = useState(null);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [linkBusy, setLinkBusy] = useState(false);
  // World locations for the show — needed to resolve venue_location_id on
  // each linked event into a name + thumbnail. Locations don't propagate
  // to the episode directly; the Locations card reads them through the
  // linked events. One source of truth.
  const [worldLocations, setWorldLocations] = useState([]);
  // EpisodeBrief snapshot + editable creative fields. Loaded alongside the
  // rest of the context. The `draft` mirror lets us debounce edits to
  // textareas without firing a PUT on every keystroke (saved on blur).
  const [brief, setBrief] = useState(null);
  const [draft, setDraft] = useState({});
  const [savingBrief, setSavingBrief] = useState(false);
  const [parentEvent, setParentEvent] = useState(null);
  // AI scene-set suggester state — fetch is one-shot, the modal is the
  // creator's review surface, and apply links the chosen sets via the
  // existing /scene-sets endpoint.
  const [sceneSuggestion, setSceneSuggestion] = useState(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [formData, setFormData] = useState({
    title: episode.title || '',
    logline: episode.logline || episode.description || '',
    publish_date: episode.air_date || '',
    episode_intent: episode.episode_intent || '',
    creative_notes: episode.creative_notes || '',
  });

  const showId = show?.id || episode?.show_id;

  useEffect(() => {
    if (!episode?.id) return;
    loadContext();
  }, [episode?.id]);

  const loadContext = async () => {
    if (showId) {
      api.get(`/api/v1/world/${showId}/events`).then(({ data }) => {
        const events = data?.events || [];
        setAllEvents(events);
        setLinkedEvents(events.filter(e => e.used_in_episode_id === episode.id));
      }).catch(() => {});
      api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(({ data }) => {
        setTotalEpisodes((data?.data || data || []).length);
      }).catch(() => {});
    }
    api.get(`/api/v1/episodes/${episode.id}/scene-sets`).then(({ data }) => setSceneSets(data?.data || [])).catch(() => {});
    api.get(`/api/v1/world/locations`).then(({ data }) => setWorldLocations(data?.locations || [])).catch(() => {});
    api.get(`/api/v1/episodes/${episode.id}/scripts?includeAllVersions=false`).then(({ data }) => {
      const scripts = data?.data || data?.scripts || [];
      if (scripts.length > 0) setScriptInfo({ exists: true, wordCount: scripts[0].content?.split(/\s+/).length || 0 });
    }).catch(() => {});
    // EpisodeBrief — drives the merged Identity/Source/Stakes/Reference
    // sections. Auto-creates if missing (the GET handler does that).
    api.get(`/api/v1/episode-brief/${episode.id}`).then(({ data }) => {
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
      // Resolve narrative_chain.parent_event_id → event name for the Source band.
      const parentId = b?.narrative_chain?.parent_event_id;
      if (parentId && showId) {
        api.get(`/api/v1/world/${showId}/events`).then(({ data: ev }) => {
          const events = ev?.events || [];
          setParentEvent(events.find(e => e.id === parentId) || null);
        }).catch(() => {});
      }
    }).catch(() => {});
  };

  // ── Brief edit helpers ─────────────────────────────────────────────────
  // Save a single field via PUT. The brief route's whitelist limits which
  // keys are accepted; passing a snapshot field would be a no-op on the
  // server, so we only call this from editable controls.
  const isLocked = brief?.status === 'locked';
  const saveBriefField = async (field, value) => {
    if (!brief || isLocked) return;
    setSavingBrief(true);
    try {
      const { data } = await api.put(`/api/v1/episode-brief/${episode.id}`, { [field]: value });
      setBrief(data?.data || brief);
    } catch (err) {
      alert('Save failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setSavingBrief(false);
    }
  };
  const toggleOutcome = (outcome) => {
    if (isLocked) return;
    const next = draft.allowed_outcomes.includes(outcome)
      ? draft.allowed_outcomes.filter(o => o !== outcome)
      : [...draft.allowed_outcomes, outcome];
    setDraft(d => ({ ...d, allowed_outcomes: next }));
    saveBriefField('allowed_outcomes', next);
  };

  // Parse evaluation
  let evalData = null;
  if (episode.evaluation_json) {
    evalData = typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json;
  }
  const tier = evalData?.tier_final ? TIER_CONFIG[evalData.tier_final] : null;

  // First linked event drives the legacy single-event display fields
  // (prestige, outfit). When multiple events are linked, the rest still
  // render as chips below.
  const primaryEvent = linkedEvents[0] || null;

  // Aggregate outfit pieces across all linked events so multi-event
  // episodes show the combined wardrobe count. Each event's
  // outfit_pieces is parsed leniently (string OR array OR null) so
  // legacy data with stringified JSON keeps working.
  const outfitPieces = (() => {
    const all = [];
    linkedEvents.forEach(ev => {
      let pieces = ev.outfit_pieces;
      if (typeof pieces === 'string') try { pieces = JSON.parse(pieces); } catch { pieces = []; }
      if (Array.isArray(pieces)) all.push(...pieces);
    });
    return all;
  })();

  // Link / unlink handlers — call the world-events PUT to set or clear
  // used_in_episode_id, then refresh the local list. Events the show
  // already has but aren't linked anywhere are eligible for linking;
  // events linked to a different episode are filtered out.
  const linkEvent = async (eventId) => {
    if (!eventId || !showId) return;
    setLinkBusy(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { used_in_episode_id: episode.id });
      const ev = allEvents.find(e => e.id === eventId);
      if (ev) {
        setLinkedEvents(prev => [...prev, { ...ev, used_in_episode_id: episode.id }]);
        setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, used_in_episode_id: episode.id } : e));
      }
    } catch (err) {
      console.error('[Episode] Failed to link event:', err);
    } finally {
      setLinkBusy(false);
    }
  };
  const unlinkEvent = async (eventId) => {
    if (!eventId || !showId) return;
    setLinkBusy(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { used_in_episode_id: null });
      setLinkedEvents(prev => prev.filter(e => e.id !== eventId));
      setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, used_in_episode_id: null } : e));
    } catch (err) {
      console.error('[Episode] Failed to unlink event:', err);
    } finally {
      setLinkBusy(false);
    }
  };
  const linkableEvents = allEvents.filter(e => !e.used_in_episode_id);

  // Regenerate this episode from one of its linked events. The backend
  // soft-deletes the current episode and re-runs the generator on the
  // event — useful after editing the event (new outfit, stakes, etc.).
  // After success we navigate to the new episode since the old id is
  // no longer the active one.
  const regenerateFromEvent = async (ev) => {
    if (!showId) return;
    if (!window.confirm(`Regenerate episode from "${ev.name}"? The current episode will be soft-deleted and a fresh one created.`)) return;
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/regenerate-episode`);
      const newId = res.data?.data?.episode?.id;
      if (newId && newId !== episode.id) {
        navigate(`/episodes/${newId}`, { replace: true });
      } else {
        // Same id (rare) — just refresh
        if (typeof onUpdate === 'function') onUpdate({});
      }
    } catch (err) {
      alert('Regenerate failed: ' + (err?.response?.data?.error || err.message));
    }
  };

  // Locations derived from the linked events. Each event can point at a
  // WorldLocation via venue_location_id; we resolve those to full
  // location objects (name, district, image) for display. Deduped by id
  // so two events at the same venue don't show twice. Falls back to the
  // event's free-text venue_name when no FK is set.
  const eventLocations = (() => {
    const seen = new Map();
    linkedEvents.forEach(ev => {
      if (ev.venue_location_id) {
        const loc = worldLocations.find(l => l.id === ev.venue_location_id);
        if (loc && !seen.has(loc.id)) seen.set(loc.id, { kind: 'location', loc, eventName: ev.name });
      } else if (ev.venue_name) {
        const key = `name:${ev.venue_name.toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, { kind: 'venue_name', name: ev.venue_name, eventName: ev.name });
      }
    });
    return Array.from(seen.values());
  })();

  // Financials
  const income = parseFloat(episode.total_income) || 0;
  const expenses = parseFloat(episode.total_expenses) || 0;
  const net = income - expenses;

  // ── Brief snapshot derivations ────────────────────────────────────────
  // Read-only objects come from the source event at generation time.
  // Sections render only when their underlying object has data, so most
  // episodes will only show the bands that apply.
  const careerCtx = brief?.career_context || {};
  const eventDiff = brief?.event_difficulty || {};
  const canonCons = brief?.canon_consequences || {};
  const narChain = brief?.narrative_chain || {};
  const eventMeta = brief?.event_metadata || {};
  const beatOutline = Array.isArray(brief?.beat_outline) ? brief.beat_outline : [];
  const seeds = Array.isArray(narChain.seeds_future_events) ? narChain.seeds_future_events : [];
  // Feed origin lives nested in canon_consequences.automation when an event
  // was created from a SocialProfile. Strip it from the canon JSON view to
  // avoid duplicating the Source section.
  const automation = canonCons.automation || {};
  const hasFeedOrigin = !!(automation.host_profile_id || automation.host_handle || automation.host_display_name);
  const canonConsCleaned = (() => { const { automation: _a, ...rest } = canonCons; return rest; })();
  const hasCanonCons = Object.keys(canonConsCleaned).length > 0;
  const hasCareerCtx = Object.keys(careerCtx).length > 0;
  const hasEventDiff = Object.keys(eventDiff).length > 0;
  const hasEventMeta = Object.keys(eventMeta).length > 0;
  // Rewards: prefer the live event (creator may have edited after generation)
  // and fall back to the brief's snapshot. Either source has the same shape:
  // { coins, reputation, brand_trust, influence, outcomes }.
  const liveRewards = (linkedEvents[0] && linkedEvents[0].rewards) || null;
  const rewardsRaw = liveRewards || eventMeta.rewards || {};
  const rewards = (typeof rewardsRaw === 'string'
    ? (() => { try { return JSON.parse(rewardsRaw); } catch { return {}; } })()
    : rewardsRaw) || {};
  const rewardOutcomes = Array.isArray(rewards.outcomes) ? rewards.outcomes : [];
  const rewardStats = ['coins', 'reputation', 'brand_trust', 'influence']
    .filter(k => (parseInt(rewards[k], 10) || 0) > 0);
  const hasRewards = rewardStats.length > 0 || rewardOutcomes.length > 0;
  const hasNarChain = Object.keys(narChain).length > 0;
  const hasSourceBand = hasFeedOrigin || hasNarChain;
  const hasStakesBand = hasCareerCtx || hasEventDiff || hasRewards;
  const hasReferenceBand = hasCanonCons || beatOutline.length > 0 || hasEventMeta;

  const handleSave = async () => {
    try { await onUpdate(formData); setIsEditing(false); } catch { alert('Failed to save'); }
  };

  const S = {
    card: { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 12 },
    label: { fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, display: 'block' },
  };

  if (isEditing) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Edit Episode</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsEditing(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
        {[
          { key: 'title', label: 'Title', type: 'input', placeholder: 'Episode title...' },
          { key: 'logline', label: 'Description', type: 'textarea', placeholder: 'Short description...', rows: 3 },
          { key: 'publish_date', label: 'Air Date', type: 'date' },
          { key: 'episode_intent', label: 'Intent', type: 'input', placeholder: 'Internal goal for this episode...' },
          { key: 'creative_notes', label: 'Creative Notes', type: 'textarea', placeholder: 'Tone, direction, things to remember...', rows: 4 },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={S.label}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                placeholder={f.placeholder} rows={f.rows} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            ) : (
              <input type={f.type || 'text'} value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Tier Banner (if evaluated) */}
      {tier && (
        <div style={{ background: tier.bg, border: `2px solid ${tier.color}`, borderRadius: 10, padding: '12px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{tier.emoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: tier.color }}>{tier.label} — {evalData.score}/100</div>
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{evalData.narrative_lines?.short || ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { icon: '🪙', val: evalData.stat_deltas?.coins, label: 'Coins' },
              { icon: '⭐', val: evalData.stat_deltas?.reputation, label: 'Rep' },
            ].map(s => s.val ? (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.val > 0 ? '#16a34a' : '#dc2626' }}>{s.val > 0 ? '+' : ''}{s.val}</div>
                <div style={{ fontSize: 8, color: '#94a3b8' }}>{s.icon} {s.label}</div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Header + Edit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>{episode.title}</h1>
          {formData.logline && <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{formData.logline}</p>}
        </div>
        <button onClick={() => setIsEditing(true)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>✏️ Edit</button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={S.card}><div style={{ fontSize: 10, color: '#94a3b8' }}>Status</div><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{episode.status || 'draft'}</div></div>
        <div style={S.card}><div style={{ fontSize: 10, color: '#94a3b8' }}>Episode</div><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>#{episode.episode_number || '?'}</div></div>
        <div style={S.card}><div style={{ fontSize: 10, color: '#94a3b8' }}>Prestige</div><div style={{ fontSize: 14, fontWeight: 700, color: '#B8962E' }}>{primaryEvent?.prestige || '—'}/10</div></div>
        <div style={S.card}><div style={{ fontSize: 10, color: '#94a3b8' }}>Outfit</div><div style={{ fontSize: 14, fontWeight: 700, color: '#ec4899' }}>{outfitPieces.length || '—'} pcs</div></div>
        <div style={S.card}><div style={{ fontSize: 10, color: '#94a3b8' }}>Net P&L</div><div style={{ fontSize: 14, fontWeight: 700, color: net > 0 ? '#16a34a' : net < 0 ? '#dc2626' : '#94a3b8' }}>{net !== 0 ? `${net > 0 ? '+' : ''}${net.toLocaleString()}` : '—'}</div></div>
      </div>

      {/* IDENTITY band — what is this episode? Creative intent + allowed
          outcomes (editable on the brief), then the events driving it +
          where it sits in the season. */}
      <SectionBand title="Identity">
      {/* CREATIVE INTENT — editable creative fields on the brief. Hidden
          while the brief loads (or fails to load) so the page doesn't show
          empty inputs. */}
      {brief && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={S.label}>🎯 Creative Intent</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {savingBrief && <span style={{ fontSize: 10, color: '#94a3b8' }}>Saving…</span>}
              {isLocked && <span style={{ padding: '1px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>🔒 LOCKED</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ ...S.label, marginBottom: 4 }}>Archetype</label>
              <select
                value={draft.episode_archetype || ''}
                disabled={isLocked}
                onChange={(e) => { setDraft(d => ({ ...d, episode_archetype: e.target.value })); saveBriefField('episode_archetype', e.target.value || null); }}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, background: isLocked ? '#f8fafc' : '#fff' }}
              >
                <option value="">— none —</option>
                {ARCHETYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ ...S.label, marginBottom: 4 }}>Designed Intent</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {INTENTS.map(i => {
                  const cfg = TIER_CONFIG[i];
                  const active = draft.designed_intent === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        const next = active ? '' : i;
                        setDraft(d => ({ ...d, designed_intent: next }));
                        saveBriefField('designed_intent', next || null);
                      }}
                      style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', border: `1px solid ${active ? cfg.color : '#e2e8f0'}`, background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#64748b', opacity: isLocked ? 0.6 : 1 }}
                    >{cfg.emoji} {i}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...S.label, marginBottom: 4 }}>Narrative Purpose</label>
            <textarea
              value={draft.narrative_purpose}
              disabled={isLocked}
              onChange={(e) => setDraft(d => ({ ...d, narrative_purpose: e.target.value }))}
              onBlur={() => brief.narrative_purpose !== draft.narrative_purpose && saveBriefField('narrative_purpose', draft.narrative_purpose)}
              placeholder="Why does this episode exist? What story job is it doing?"
              rows={2}
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: isLocked ? '#f8fafc' : '#fff' }}
            />
          </div>
          <div>
            <label style={{ ...S.label, marginBottom: 4 }}>Forward Hook</label>
            <textarea
              value={draft.forward_hook}
              disabled={isLocked}
              onChange={(e) => setDraft(d => ({ ...d, forward_hook: e.target.value }))}
              onBlur={() => brief.forward_hook !== draft.forward_hook && saveBriefField('forward_hook', draft.forward_hook)}
              placeholder="What pulls the viewer into the next episode?"
              rows={2}
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: isLocked ? '#f8fafc' : '#fff' }}
            />
          </div>
        </div>
      )}

      {/* ALLOWED OUTCOMES — toggleable. Disabling tiers narrows what the
          script generator and evaluator are allowed to produce. */}
      {brief && (
        <div style={S.card}>
          <span style={S.label}>🎲 Allowed Outcomes</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {INTENTS.map(o => {
              const cfg = TIER_CONFIG[o];
              const active = draft.allowed_outcomes.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  disabled={isLocked}
                  onClick={() => toggleOutcome(o)}
                  style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', border: `1px solid ${active ? cfg.color : '#e2e8f0'}`, background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#94a3b8', opacity: isLocked ? 0.6 : 1 }}
                >{active ? '✓' : '✗'} {cfg.emoji} {o}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
        {/* Events — multi-link. Each linked event is a chip with × to
            unlink. The dropdown below lists every show event not yet
            linked anywhere; picking one stamps it with this episode's
            used_in_episode_id. */}
        <div style={S.card}>
          <span style={S.label}>💌 Events ({linkedEvents.length})</span>
          {linkedEvents.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>No events linked</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {linkedEvents.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', background: '#faf5ea', border: '1px solid #f3e2b3', borderRadius: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      {ev.host && <span style={{ padding: '1px 5px', background: '#fff', borderRadius: 3, fontSize: 9, color: '#64748b' }}>{ev.host}</span>}
                      {ev.dress_code && <span style={{ padding: '1px 5px', background: '#fff', borderRadius: 3, fontSize: 9, color: '#B8962E' }}>{ev.dress_code}</span>}
                      {ev.event_type && <span style={{ padding: '1px 5px', background: '#fff', borderRadius: 3, fontSize: 9, color: '#6366f1' }}>{ev.event_type}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => regenerateFromEvent(ev)}
                      disabled={linkBusy}
                      title="Regenerate this episode from the event (soft-deletes the current episode)"
                      style={{ background: '#fdf8ee', border: '1px solid #e8d8b8', color: '#B8962E', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}
                    >♻️</button>
                    <button
                      type="button"
                      onClick={() => unlinkEvent(ev.id)}
                      disabled={linkBusy}
                      title="Unlink event from this episode"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <select
            value=""
            disabled={linkBusy || linkableEvents.length === 0}
            onChange={(e) => { if (e.target.value) linkEvent(e.target.value); e.target.value = ''; }}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#64748b', cursor: linkableEvents.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <option value="">{linkableEvents.length === 0 ? 'No unlinked events available' : '+ Link an event…'}</option>
            {linkableEvents.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}{ev.event_type ? ` (${ev.event_type})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Season Position */}
        <div style={S.card}>
          <span style={S.label}>📺 Season Position</span>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {Array.from({ length: totalEpisodes || 6 }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: (i + 1) === (episode.episode_number || 1) ? '#B8962E' : (i + 1) < (episode.episode_number || 1) ? '#d1fae5' : '#f1f5f9' }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#B8962E', fontWeight: 600, marginTop: 4 }}>Episode {episode.episode_number || '?'} of {totalEpisodes || '?'}</div>
        </div>
      </div>
      </SectionBand>

      {/* PRODUCTION band — what's been built? Locations, script status,
          narrative read-through from the linked events, and the timeline
          overlay placements. */}
      <SectionBand title="Production">
      {/* Locations + Script */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Locations — derived from the linked events' venue_location_id
            (or venue_name when no FK is set). No standalone state on the
            episode; locations are always read through the events so
            there's no risk of drift. Hint creators that empty = link an
            event with a venue. */}
        <div style={S.card}>
          <span style={S.label}>📍 Locations ({eventLocations.length})</span>
          {eventLocations.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {eventLocations.map((entry, i) => {
                const name = entry.kind === 'location' ? entry.loc.name : entry.name;
                const district = entry.kind === 'location' ? entry.loc.district : null;
                return (
                  <div key={i} style={{ flexShrink: 0, minWidth: 80 }}>
                    <div style={{ width: 80, height: 50, background: '#f1f5f9', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18 }}>📍</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#1a1a2e', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {district && <div style={{ fontSize: 8, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{district}</div>}
                    <div style={{ fontSize: 8, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>via {entry.eventName}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {linkedEvents.length === 0 ? 'Link an event to see its location here' : 'Linked events have no venue set'}
            </div>
          )}
        </div>

        {/* Script */}
        <div style={S.card}>
          <span style={S.label}>📝 Script</span>
          {scriptInfo?.exists ? (
            <div>
              <span style={{ padding: '3px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>✓ Script written</span>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{scriptInfo.wordCount?.toLocaleString()} words</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No script yet</div>
          )}
        </div>
      </div>



      {/* Video UI overlays — invites, checklists, etc. on the rendered
          video frame. Auto-populated when an invite is approved or the
          wardrobe checklist is locked, manually editable here. */}
      <TimelinePlacementsSection episodeId={episode.id} />
      </SectionBand>

      {/* SOURCE band — where this episode came from. Feed Origin (when the
          source event was created from a SocialProfile) + Narrative Chain
          (parent event, seeds for future events). Both render only when
          their data exists, and the band itself only renders when at
          least one is present. */}
      {hasSourceBand && (
        <SectionBand title="Source">
          {hasFeedOrigin && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>🌐 {automation.host_display_name || automation.host_handle || 'Unknown profile'}</div>
                  {automation.host_handle && <div style={{ fontSize: 10, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>@{String(automation.host_handle).replace(/^@/, '')}</div>}
                  {automation.content_category && <div style={{ marginTop: 3, display: 'inline-block', padding: '1px 6px', background: '#eef2ff', color: '#6366f1', borderRadius: 3, fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>{automation.content_category}</div>}
                </div>
                <Link to="/feed" style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>Feed →</Link>
              </div>
              {(automation.follow_motivation || automation.follow_emotion || automation.follow_trigger || automation.event_excitement != null) && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...S.label, marginBottom: 4 }}>Why this hooked Lala</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11 }}>
                    {automation.follow_motivation && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Motivation</span><div style={{ color: '#1a1a2e' }}>{automation.follow_motivation}</div></div>}
                    {automation.follow_emotion && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Emotion</span><div style={{ color: '#1a1a2e' }}>{automation.follow_emotion}</div></div>}
                    {automation.follow_trigger && <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Trigger</span><div style={{ color: '#1a1a2e' }}>{automation.follow_trigger}</div></div>}
                    {automation.event_excitement != null && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Excitement</span><div style={{ color: '#B8962E', fontWeight: 700 }}>{automation.event_excitement}/10</div></div>}
                  </div>
                </div>
              )}
              {(automation.lifestyle_claim || automation.lifestyle_reality || automation.lifestyle_gap) && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...S.label, marginBottom: 4 }}>Lifestyle gap</label>
                  {automation.lifestyle_claim && <div style={{ fontSize: 11, color: '#475569', marginBottom: 3 }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginRight: 6 }}>Claim</span>{automation.lifestyle_claim}</div>}
                  {automation.lifestyle_reality && <div style={{ fontSize: 11, color: '#475569', marginBottom: 3 }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginRight: 6 }}>Reality</span>{automation.lifestyle_reality}</div>}
                  {automation.lifestyle_gap && <div style={{ fontSize: 11, color: '#dc2626', fontStyle: 'italic' }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginRight: 6, fontStyle: 'normal' }}>Gap</span>{automation.lifestyle_gap}</div>}
                </div>
              )}
              {(automation.host_brand || automation.beauty_factor) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                  {automation.host_brand && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Brand</span><div style={{ color: '#1a1a2e', fontWeight: 600 }}>{automation.host_brand}</div></div>}
                  {automation.beauty_factor && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Beauty hook</span><div style={{ color: '#1a1a2e' }}>{automation.beauty_factor}{automation.beauty_description ? ` — ${automation.beauty_description}` : ''}</div></div>}
                </div>
              )}
            </div>
          )}
          {hasNarChain && (
            <div style={S.card}>
              <span style={S.label}>🔗 Narrative Chain</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: seeds.length || narChain.chain_reason ? 10 : 0, marginTop: 4 }}>
                {narChain.chain_position != null && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Chain position</span><div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600 }}>{narChain.chain_position}</div></div>}
                {narChain.parent_event_id && (
                  <div>
                    <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Parent event</span>
                    {parentEvent ? (
                      parentEvent.used_in_episode_id
                        ? <Link to={`/episodes/${parentEvent.used_in_episode_id}`} style={{ display: 'block', fontSize: 12, color: '#B8962E', fontWeight: 600 }}>{parentEvent.name} →</Link>
                        : <div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600 }}>{parentEvent.name} <span style={{ fontSize: 9, color: '#94a3b8' }}>(no episode yet)</span></div>
                    ) : <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>{String(narChain.parent_event_id).slice(0, 8)}…</div>}
                  </div>
                )}
              </div>
              {narChain.chain_reason && <div style={{ marginBottom: seeds.length ? 10 : 0 }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Chain reason</span><div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, fontStyle: 'italic' }}>{narChain.chain_reason}</div></div>}
              {seeds.length > 0 && (
                <div>
                  <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Seeds for future events</span>
                  <ul style={{ margin: '4px 0 0', padding: '0 0 0 18px', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
                    {seeds.map((seed, i) => <li key={i}>{typeof seed === 'string' ? seed : JSON.stringify(seed)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionBand>
      )}

      {/* STAKES band — what's at risk this episode? Career context (tier,
          milestone, success unlock, fail consequence) + difficulty knobs
          (strictness, deadline). Snapshot from the source event — not
          editable here; change them on the event itself. */}
      {hasStakesBand && (() => {
        // Layout: span the available columns evenly. 3 cards → three columns,
        // 2 → two, 1 → full width. Keeps the band tidy regardless of which
        // pieces of brief data exist on this episode.
        const cardCount = (hasCareerCtx ? 1 : 0) + (hasEventDiff ? 1 : 0) + (hasRewards ? 1 : 0);
        const gridCols = cardCount >= 3 ? 'repeat(3, 1fr)' : cardCount === 2 ? '1fr 1fr' : '1fr';
        // Pending vs earned: read evaluation_json.tier_final to badge each
        // reward. slay/pass = earned (matches episodeCompletionService gate),
        // safe/fail = missed (rewards don't fire), undefined = pending.
        const tier = evalData?.tier_final || null;
        const rewardStatus = !tier ? 'pending' : (['slay', 'pass'].includes(tier) ? 'earned' : 'missed');
        const statusCfg = {
          pending: { label: 'PENDING', bg: '#fefce8', color: '#a16207', border: '#fde68a' },
          earned: { label: 'EARNED', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
          missed: { label: 'MISSED', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        }[rewardStatus];
        const statIcons = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣' };
        return (
          <SectionBand title="Stakes">
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12 }}>
              {hasCareerCtx && (
                <div style={S.card}>
                  <span style={S.label}>💼 Career Context</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                    {careerCtx.career_tier && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Tier</span><div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600 }}>{careerCtx.career_tier}</div></div>}
                    {careerCtx.career_milestone && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Milestone</span><div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600 }}>{careerCtx.career_milestone}</div></div>}
                    {careerCtx.success_unlock && <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Success unlock</span><div style={{ fontSize: 11, color: '#16a34a', lineHeight: 1.5 }}>{careerCtx.success_unlock}</div></div>}
                    {careerCtx.fail_consequence && <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Fail consequence</span><div style={{ fontSize: 11, color: '#dc2626', lineHeight: 1.5 }}>{careerCtx.fail_consequence}</div></div>}
                  </div>
                </div>
              )}
              {hasEventDiff && (
                <div style={S.card}>
                  <span style={S.label}>⚡ Event Difficulty</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                    {eventDiff.strictness != null && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Strictness</span><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{eventDiff.strictness}/10</div></div>}
                    {eventDiff.deadline_type && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Deadline</span><div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{eventDiff.deadline_type}</div></div>}
                    {eventDiff.deadline_minutes != null && <div><span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Minutes</span><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{eventDiff.deadline_minutes}</div></div>}
                  </div>
                </div>
              )}
              {hasRewards && (
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={S.label}>🏆 Rewards</span>
                    <span
                      title={
                        rewardStatus === 'pending' ? 'Episode not evaluated yet — rewards will fire on slay/pass.' :
                        rewardStatus === 'earned' ? 'Episode landed slay or pass — rewards applied.' :
                        'Episode landed safe or fail — rewards did not fire.'
                      }
                      style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}
                    >{statusCfg.label}</span>
                  </div>
                  {rewardStats.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rewardStats.length, 4)}, 1fr)`, gap: 8, marginTop: 4 }}>
                      {rewardStats.map(k => (
                        <div key={k}>
                          <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{statIcons[k]} {k.replace('_', ' ')}</span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: rewardStatus === 'earned' ? '#16a34a' : rewardStatus === 'missed' ? '#94a3b8' : '#1a1a2e' }}>+{rewards[k]}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rewardOutcomes.length > 0 && (
                    <div style={{ marginTop: rewardStats.length ? 8 : 4 }}>
                      <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Outcomes</span>
                      <ul style={{ margin: '2px 0 0', padding: '0 0 0 16px', fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                        {rewardOutcomes.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionBand>
        );
      })()}

      {/* REFERENCE band — heavy snapshot data that creators rarely need
          but should be able to inspect. All collapsed by default; clicking
          a summary expands the JSON / list. */}
      {hasReferenceBand && (
        <SectionBand title="Reference">
          {hasCanonCons && (
            <div style={S.card}>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>🌐 Canon consequences</summary>
                <pre style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 10, fontSize: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 240, color: '#475569', fontFamily: "'DM Mono', monospace", border: '1px solid #e2e8f0' }}>
                  {JSON.stringify(canonConsCleaned, null, 2)}
                </pre>
              </details>
            </div>
          )}
          {beatOutline.length > 0 && (
            <div style={S.card}>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 AI beat outline ({beatOutline.length})</summary>
                <ol style={{ margin: '10px 0 0', padding: '0 0 0 22px' }}>
                  {beatOutline.map((beat, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600 }}>{beat.summary || beat.name || `Beat ${beat.beat_number || i + 1}`}</div>
                      {beat.dramatic_function && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>{beat.dramatic_function}</div>}
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          )}
          {hasEventMeta && (
            <div style={S.card}>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>📦 Event metadata</summary>
                <pre style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 10, fontSize: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 240, color: '#475569', fontFamily: "'DM Mono', monospace", border: '1px solid #e2e8f0' }}>
                  {JSON.stringify(eventMeta, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </SectionBand>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/episodes/${episode.id}/script-writer`)} style={{ padding: '6px 14px', borderRadius: 6, background: '#B8962E', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✦ Script Writer</button>
        {showId && <button onClick={() => navigate(`/shows/${showId}/world?tab=events`)} style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🎭 Producer Mode</button>}
        <button onClick={() => navigate(`/episodes/${episode.id}/plan`)} style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🎬 Scene Plan</button>
        {/* AI scene-set suggester — disabled until the episode has a script
            since there's nothing to analyze otherwise. Fires the suggest
            endpoint then opens SceneSuggestionReview for the creator to
            approve / discard. */}
        <button
          onClick={async () => {
            setSuggestBusy(true);
            try {
              const { data } = await api.post(`/api/v1/episodes/${episode.id}/suggest-scenes`);
              if (data?.success && data?.proposal) {
                setSceneSuggestion({ proposal: data.proposal, contextSummary: data.context_summary });
              } else {
                alert(data?.error || 'No suggestions returned');
              }
            } catch (err) {
              alert(err?.response?.data?.error || err.message || 'Failed to fetch suggestions');
            } finally {
              setSuggestBusy(false);
            }
          }}
          disabled={!scriptInfo?.exists || suggestBusy}
          title={!scriptInfo?.exists ? 'Add a script first' : 'AI suggests scene sets per beat'}
          style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e8d8b8', color: '#B8962E', fontSize: 11, fontWeight: 600, cursor: !scriptInfo?.exists || suggestBusy ? 'not-allowed' : 'pointer', opacity: !scriptInfo?.exists ? 0.55 : 1 }}
        >
          {suggestBusy ? '✦ Thinking…' : '✦ Suggest Scenes'}
        </button>
        <button onClick={() => setIsEditing(true)} style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit Details</button>
      </div>
      {sceneSuggestion && (
        <SceneSuggestionReview
          proposal={sceneSuggestion.proposal}
          contextSummary={sceneSuggestion.contextSummary}
          busy={applyBusy}
          onReject={() => setSceneSuggestion(null)}
          onApprove={async ({ sceneSetIds }) => {
            if (!sceneSetIds.length) { setSceneSuggestion(null); return; }
            setApplyBusy(true);
            try {
              await api.post(`/api/v1/episodes/${episode.id}/scene-sets`, { sceneSetIds });
              // Refresh the episode's linked sets so the Locations / Scene
              // Plan UI reflects the new links without a full page reload.
              const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
              setSceneSets(data?.data || []);
              setSceneSuggestion(null);
            } catch (err) {
              alert(err?.response?.data?.error || err.message || 'Failed to apply');
            } finally {
              setApplyBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

export default EpisodeOverviewTab;
