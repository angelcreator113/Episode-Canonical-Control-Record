// frontend/src/components/Episodes/EpisodeOverviewTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SceneSuggestionReview from '../episode/SceneSuggestionReview';
import TimelinePlacementsSection from '../episode/TimelinePlacementsSection';

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

  // Read-through summary: aggregate the linked events' narrative fields so
  // the episode page can display them without copying onto the episode
  // itself. Single source of truth — when the event changes, the episode
  // view reflects it. dress_code and narrative_stakes show as chips; the
  // first non-empty canon_consequences object surfaces beneath.
  const eventNarrative = (() => {
    const dressCodes = Array.from(new Set(linkedEvents.map(e => e.dress_code).filter(Boolean)));
    const stakes = linkedEvents.map(e => e.narrative_stakes).filter(Boolean);
    const consequences = linkedEvents
      .map(e => e.canon_consequences)
      .filter(c => c && (typeof c === 'object' ? Object.keys(c).length : true));
    return { dressCodes, stakes, consequences };
  })();

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

      {/* IDENTITY band — what is this episode? Events that drive it +
          where it sits in the season. */}
      <SectionBand title="Identity">
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

      {/* Narrative read-through — pulls dress_code, narrative_stakes, and
          canon_consequences from the linked events. None of this lives on
          the episode itself; we read it through so updates to the event
          flow into the episode without copies that go stale. Hidden when
          no events are linked or every linked event lacks these fields. */}
      {linkedEvents.length > 0 && (eventNarrative.dressCodes.length > 0 || eventNarrative.stakes.length > 0 || eventNarrative.consequences.length > 0) && (
        <div style={S.card}>
          <span style={S.label}>🎭 Narrative (from event{linkedEvents.length > 1 ? 's' : ''})</span>
          {eventNarrative.dressCodes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: eventNarrative.stakes.length || eventNarrative.consequences.length ? 8 : 0 }}>
              {eventNarrative.dressCodes.map((dc, i) => (
                <span key={i} style={{ padding: '2px 8px', background: '#faf5ea', borderRadius: 4, fontSize: 10, color: '#B8962E', fontWeight: 600 }}>{dc}</span>
              ))}
            </div>
          )}
          {eventNarrative.stakes.length > 0 && (
            <div style={{ marginBottom: eventNarrative.consequences.length ? 8 : 0 }}>
              {eventNarrative.stakes.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: '#1a1a2e', fontStyle: 'italic', marginBottom: i < eventNarrative.stakes.length - 1 ? 4 : 0, lineHeight: 1.4 }}>
                  {s}
                </div>
              ))}
            </div>
          )}
          {eventNarrative.consequences.length > 0 && (
            <details style={{ fontSize: 11, color: '#64748b' }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Canon consequences</summary>
              <pre style={{ background: '#f8fafc', padding: 8, borderRadius: 4, marginTop: 6, fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {eventNarrative.consequences.map(c => typeof c === 'string' ? c : JSON.stringify(c, null, 2)).join('\n\n')}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Video UI overlays — invites, checklists, etc. on the rendered
          video frame. Auto-populated when an invite is approved or the
          wardrobe checklist is locked, manually editable here. */}
      <TimelinePlacementsSection episodeId={episode.id} />
      </SectionBand>

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
