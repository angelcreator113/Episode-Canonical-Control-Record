/**
 * NarrativePressureDashboard.jsx — FULL REBUILD
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration point for the Feed Nervous System. Eight zones answering:
 * "Where is the tension living right now?"
 *
 * Route: /pressure
 * Light theme. Prime Studios palette: #d4789a / #7ab3d4 / #a889c8
 * Phased data loading — each zone renders independently as data arrives.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ENTANGLE_API = '/api/v1/entanglements';

const STATE_COLORS = {
  rising:        { bg: '#f0faf4', text: '#2d7a4f', border: '#b8e8cc' },
  peaking:       { bg: '#fef9e7', text: '#8a6d00', border: '#f5d97a' },
  plateauing:    { bg: '#f5f5f5', text: '#666',    border: '#ddd'    },
  controversial: { bg: '#fff4ec', text: '#c05c00', border: '#ffd0a8' },
  cancelled:     { bg: '#fef0f0', text: '#b91c1c', border: '#fca5a5' },
  reinventing:   { bg: '#f3f0ff', text: '#6d28d9', border: '#c4b5fd' },
  gone_dark:     { bg: '#f0f0f0', text: '#444',    border: '#ccc'    },
  posthumous:    { bg: '#fdf4f9', text: '#9d174d', border: '#fbcfe8' },
};

const MIRROR_LABELS = {
  ambition:         'The part of her that wants to be legendary',
  desire_unnamed:   "The part of her that wants and hasn't named it yet",
  visibility_wound: 'The part of her that wants to be seen that badly',
  grief:            'The part of her that has already lost something',
  class:            'The part of her that knows what money means',
  body:             'The part of her that lives in her body',
  habits:           'The part of her that repeats without noticing',
  belonging:        'The part of her looking for where she fits',
  shadow:           "The part of her she hasn't looked at directly",
  integration:      'Lala — the part of her that finally consolidated',
};

const DIMENSION_COLORS = {
  ambition:         '#d4789a',
  desire_unnamed:   '#c75a8a',
  visibility_wound: '#e06080',
  grief:            '#8a7ab3',
  class:            '#c9a84c',
  body:             '#e8a87c',
  habits:           '#7ab3d4',
  belonging:        '#a889c8',
  shadow:           '#6b7280',
  integration:      '#22c55e',
};

const EVENT_TYPE_COLORS = {
  world_event:          '#7ab3d4',
  story_event:          '#d4789a',
  character_event:      '#a889c8',
  lalaverse_cultural:   '#e8d0f0',
};

// ── Shared sub-components ──────────────────────────────────────────────────

function StateBadge({ state }) {
  if (!state) return null;
  const c = STATE_COLORS[state] || STATE_COLORS.plateauing;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase', background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}

function SectionHeader({ children, count, accent = '#d4789a' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <h2 style={{
        margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: accent, fontFamily: "'DM Mono', monospace",
      }}>
        {children}
      </h2>
      {count !== undefined && (
        <span style={{
          background: accent, color: '#fff', borderRadius: 20,
          fontSize: 10, fontWeight: 700, padding: '1px 7px',
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: '#f0e4ea' }} />
    </div>
  );
}

function ZoneCard({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f0e4ea', borderRadius: 12,
      padding: '18px 20px', ...style,
    }}>
      {children}
    </div>
  );
}

function EmptyZone({ message }) {
  return (
    <div style={{
      textAlign: 'center', padding: '20px', color: '#c09aaa', fontSize: 13,
      fontStyle: 'italic', background: '#fdf8fa', borderRadius: 8,
      border: '1px dashed #f0e4ea',
    }}>
      {message}
    </div>
  );
}

function LoadingZone() {
  return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#c09aaa', fontSize: 12 }}>
      Loading...
    </div>
  );
}

// ── TOP BAR: Story Calendar Timeline ──────────────────────────────────────

function CalendarTimeline({ markers, events }) {
  if (!markers?.length) {
    return <EmptyZone message="No story markers yet. Create markers to anchor the timeline." />;
  }

  const currentIdx = markers.findIndex(m => m.is_present);

  return (
    <div style={{ overflowX: 'auto', padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
        {markers.map((m, i) => {
          const isCurrent = i === currentIdx;
          const markerEvents = events?.filter(e => e.story_position === m.id) || [];
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div style={{
                  width: 40, height: 2,
                  background: i <= currentIdx ? '#d4789a' : '#e8d5e0',
                }} />
              )}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                position: 'relative',
              }}>
                <div style={{
                  width: isCurrent ? 14 : 10,
                  height: isCurrent ? 14 : 10,
                  borderRadius: '50%',
                  background: isCurrent ? '#d4789a' : (i < currentIdx ? '#d4789a88' : '#e8d5e0'),
                  border: isCurrent ? '2px solid #fff' : 'none',
                  boxShadow: isCurrent ? '0 0 0 2px #d4789a' : 'none',
                  cursor: 'pointer',
                }} title={m.name} />
                <span style={{
                  fontSize: 9, fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? '#d4789a' : '#aaa',
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {m.name}
                </span>
                {/* Event dots below marker */}
                {markerEvents.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {markerEvents.slice(0, 5).map(e => (
                      <div key={e.id} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: EVENT_TYPE_COLORS[e.event_type] || '#ccc',
                      }} title={e.title} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ZONE 1: Simultaneous View ─────────────────────────────────────────────

function SimultaneousView() {
  const [datetime, setDatetime] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    if (!datetime) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/calendar/simultaneous?datetime=${encodeURIComponent(datetime)}`);
      setResult(res.data);
    } catch (err) {
      console.warn('[Simultaneous] query error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader accent="#7ab3d4">Simultaneous View</SectionHeader>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="datetime-local"
          value={datetime}
          onChange={e => setDatetime(e.target.value)}
          style={{
            flex: 1, padding: '6px 10px', border: '1px solid #e8d5e0',
            borderRadius: 6, fontSize: 12, fontFamily: "'DM Mono', monospace",
          }}
        />
        <button
          onClick={handleQuery}
          disabled={loading || !datetime}
          style={{
            padding: '6px 16px', background: '#7ab3d4', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', opacity: !datetime ? 0.5 : 1,
          }}
        >
          {loading ? 'Querying...' : 'Show alibi view'}
        </button>
      </div>
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
              Active Events ({result.count || 0})
            </div>
            {(result.events || []).map(ev => (
              <div key={ev.id} style={{
                padding: '8px 12px', background: '#f0f7fd', border: '1px solid #d0e4f0',
                borderRadius: 6, marginBottom: 6, fontSize: 12,
              }}>
                <strong>{ev.title}</strong>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {ev.location_name} · {ev.event_type?.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
            {(result.events || []).length === 0 && (
              <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No events at this moment</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#d4789a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
              Who was doing what
            </div>
            {(result.events || []).flatMap(ev =>
              (ev.attendees || []).map(a => (
                <div key={a.id} style={{
                  padding: '6px 10px', background: '#fdf4f9', border: '1px solid #f0e4ea',
                  borderRadius: 6, marginBottom: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontWeight: 600, color: '#333' }}>
                    {a.character?.selected_name || a.character?.display_name || 'Unknown'}
                  </span>
                  <span style={{
                    fontSize: 10, color: '#a889c8', fontFamily: "'DM Mono', monospace",
                  }}>
                    {a.attendee_type?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ZONE 2: Self-Portrait Panel ────────────────────────────────────────────

function SelfPortraitPanel({ portrait, loading }) {
  if (loading) return <LoadingZone />;
  if (!portrait) return <EmptyZone message="Mirror Field data unavailable" />;

  const dimensions = Object.entries(portrait).filter(([, v]) => v.profiles?.length > 0);

  return (
    <div>
      <SectionHeader accent="#a889c8" count={dimensions.reduce((n, [, v]) => n + v.profiles.length, 0)}>
        Self-Portrait
      </SectionHeader>
      {dimensions.length === 0 ? (
        <EmptyZone message="No confirmed mirror dimensions yet. Propose and confirm to build the portrait." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {dimensions.map(([dim, data]) => (
            <div key={dim} style={{
              background: `${DIMENSION_COLORS[dim] || '#ddd'}0a`,
              border: `1px solid ${DIMENSION_COLORS[dim] || '#ddd'}33`,
              borderLeft: `3px solid ${DIMENSION_COLORS[dim] || '#ddd'}`,
              borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: DIMENSION_COLORS[dim] || '#888',
                fontFamily: "'DM Mono', monospace", marginBottom: 4,
              }}>
                {dim.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                {data.label}
              </div>
              {data.profiles.map(p => (
                <div key={p.id} style={{
                  fontSize: 11, color: '#555', padding: '2px 0',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: DIMENSION_COLORS[dim] || '#ccc', flexShrink: 0 }} />
                  @{p.handle}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ZONE 3: Hot Zones (existing entanglement events) ──────────────────────

function HotZonesPanel({ events, loading }) {
  if (loading) return <LoadingZone />;
  return (
    <div>
      <SectionHeader count={events?.length || 0} accent="#d4789a">Hot Zones</SectionHeader>
      {!events?.length ? (
        <EmptyZone message="No active pressure. The world is quiet." />
      ) : (
        events.slice(0, 8).map(ev => {
          const profile = ev.profile || {};
          return (
            <div key={ev.id} style={{
              background: '#fff', border: '1px solid #f0e4ea', borderRadius: 8,
              padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
                background: STATE_COLORS[ev.new_state]?.border || '#f0e4ea',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#2d1f28', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  {profile.display_name || profile.handle || 'Unknown'}
                  {profile.handle && <span style={{ fontWeight: 400, fontSize: 11, color: '#b08090', marginLeft: 6 }}>@{profile.handle}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {ev.affected_character_ids?.length || 0} characters flagged
                  {(ev.scene_proposals || []).some(p => !p.approved) && (
                    <span style={{ color: '#d4789a', fontWeight: 600 }}> · proposals pending</span>
                  )}
                </div>
              </div>
              {ev.previous_state && ev.new_state && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <StateBadge state={ev.previous_state} />
                  <span style={{ color: '#ccc', fontSize: 10 }}>→</span>
                  <StateBadge state={ev.new_state} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── ZONE 4: Pressure Wave ─────────────────────────────────────────────────

function PressureWavePanel({ feedRelationships, loading }) {
  if (loading) return <LoadingZone />;
  const pressureRels = (feedRelationships || []).filter(r =>
    ['beef', 'former_friends', 'public_shade'].includes(r.relationship_type)
  );
  return (
    <div>
      <SectionHeader count={pressureRels.length} accent="#d4789a">Pressure Wave</SectionHeader>
      {pressureRels.length === 0 ? (
        <EmptyZone message="No active feed conflicts. Tension is dormant." />
      ) : (
        pressureRels.map(r => (
          <div key={r.id} style={{
            background: '#fff', border: '1px solid #f0e4ea', borderRadius: 8,
            padding: '10px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                @{r.influencerA?.handle || '?'}
              </span>
              <span style={{
                fontSize: 10, padding: '1px 8px', borderRadius: 10,
                background: '#fef0f0', color: '#b91c1c', border: '1px solid #fca5a5',
                fontWeight: 600, fontFamily: "'DM Mono', monospace",
              }}>
                {r.relationship_type?.replace(/_/g, ' ')}
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                @{r.influencerB?.handle || '?'}
              </span>
            </div>
            {r.notes && (
              <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                {r.notes}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── ZONE 5: Underground Activity ──────────────────────────────────────────

function UndergroundPanel({ events, loading }) {
  if (loading) return <LoadingZone />;
  const underground = (events || []).filter(e => e.visibility === 'underground');
  return (
    <div>
      <SectionHeader count={underground.length} accent="#6b7280">Underground Activity</SectionHeader>
      {underground.length === 0 ? (
        <EmptyZone message="Nothing stirring underground." />
      ) : (
        underground.map(ev => (
          <div key={ev.id} style={{
            background: '#f8f8f8', border: '1px solid #ddd',
            borderLeft: '3px solid #6b7280', borderRadius: 8,
            padding: '10px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>◎</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{ev.title}</span>
            </div>
            {ev.lalaverse_district && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{ev.lalaverse_district}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── ZONE 6: Crossing Tracker ──────────────────────────────────────────────

function CrossingTracker({ crossings, loading, onConfirmGap }) {
  if (loading) return <LoadingZone />;
  return (
    <div>
      <SectionHeader count={crossings?.length || 0} accent="#a889c8">Crossing Tracker</SectionHeader>
      {!crossings?.length ? (
        <EmptyZone message="No character crossings recorded yet." />
      ) : (
        crossings.map(c => {
          const score = c.performance_gap_score;
          const isHigh = score >= 70;
          return (
            <div key={c.id} style={{
              background: '#fff', border: `1px solid ${isHigh ? '#fca5a5' : '#f0e4ea'}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {score !== null && (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                  background: isHigh ? '#fef0f0' : '#f5f0fd',
                  color: isHigh ? '#b91c1c' : '#6d28d9',
                  border: `2px solid ${isHigh ? '#fca5a5' : '#c4b5fd'}`,
                  flexShrink: 0,
                }}>
                  {score}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#2d1f28' }}>
                  {c.character?.selected_name || c.character?.display_name || 'Unknown'}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {c.initial_feed_state && `Feed state: ${c.initial_feed_state}`}
                  {c.marker && ` · ${c.marker.name}`}
                </div>
                {c.character?.dimensions_performed?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {c.character.dimensions_performed.map(d => (
                      <span key={d} style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 10,
                        background: '#f0faf4', color: '#2d7a4f', border: '1px solid #b8e8cc',
                      }}>{d}</span>
                    ))}
                    {(c.character?.dimensions_hidden || []).map(d => (
                      <span key={d} style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 10,
                        background: '#f5f5f5', color: '#888', border: '1px solid #ddd',
                        textDecoration: 'line-through',
                      }}>{d}</span>
                    ))}
                  </div>
                )}
              </div>
              {!c.gap_confirmed && score !== null && (
                <button
                  onClick={() => onConfirmGap(c.id)}
                  style={{
                    padding: '4px 12px', background: '#a889c8', color: '#fff',
                    border: 'none', borderRadius: 16, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Confirm
                </button>
              )}
              {c.gap_confirmed && (
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Confirmed</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── ZONE 7: Author Flags ──────────────────────────────────────────────────

function AuthorFlagsPanel({ loading }) {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        // Load actionable notes of types: watch, plant, intent
        const types = ['watch', 'plant', 'intent'];
        const allNotes = [];
        for (const t of types) {
          try {
            const res = await api.get(`/api/v1/author-notes?entity_type=character&entity_id=*&note_type=${t}`);
            if (res.data?.notes) allNotes.push(...res.data.notes);
          } catch { /* ignore individual failures */ }
        }
        setNotes(allNotes);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [loading]);

  if (!loaded) return <LoadingZone />;

  return (
    <div>
      <SectionHeader count={notes.length} accent="#c9a84c">Author Flags</SectionHeader>
      {notes.length === 0 ? (
        <EmptyZone message="No author flags to surface. Add notes with types: watch, plant, or intent." />
      ) : (
        notes.slice(0, 10).map(n => {
          const typeColors = {
            watch: { bg: '#f0f7fd', accent: '#7ab3d4' },
            plant: { bg: '#f5f0fd', accent: '#a889c8' },
            intent: { bg: '#fdf4f9', accent: '#d4789a' },
          };
          const c = typeColors[n.note_type] || typeColors.intent;
          return (
            <div key={n.id} style={{
              background: c.bg, border: `1px solid ${c.accent}33`,
              borderLeft: `3px solid ${c.accent}`,
              borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  color: c.accent, fontFamily: "'DM Mono', monospace",
                }}>
                  {n.note_type}
                </span>
                <span style={{ fontSize: 9, color: '#aaa' }}>
                  {n.entity_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ color: '#444', lineHeight: 1.4 }}>{n.note_text}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────

export default function NarrativePressureDashboard() {
  // Phase 1: Calendar
  const [markers, setMarkers] = useState([]);
  const [calEvents, setCalEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(true);

  // Phase 2: Mirror Field
  const [portrait, setPortrait] = useState(null);
  const [mirrorLoading, setMirrorLoading] = useState(true);

  // Phase 3: Hot Zones + Pressure Wave
  const [entangleEvents, setEntangleEvents] = useState([]);
  const [feedRels, setFeedRels] = useState([]);
  const [pressureLoading, setPressureLoading] = useState(true);

  // Phase 4: Crossings + Author Flags
  const [crossings, setCrossings] = useState([]);
  const [crossingLoading, setCrossingLoading] = useState(true);

  // Phase 1: Load calendar
  useEffect(() => {
    (async () => {
      try {
        const [mRes, eRes] = await Promise.all([
          api.get('/api/v1/calendar/markers').catch(() => ({ data: { markers: [] } })),
          api.get('/api/v1/calendar/events').catch(() => ({ data: { events: [] } })),
        ]);
        setMarkers(mRes.data?.markers || []);
        setCalEvents(eRes.data?.events || []);
      } catch { /* ignore */ }
      setCalLoading(false);
    })();
  }, []);

  // Phase 2: Load mirror field
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/v1/social-profiles/mirror/self-portrait');
        setPortrait(res.data?.portrait || null);
      } catch { /* ignore */ }
      setMirrorLoading(false);
    })();
  }, []);

  // Phase 3: Load hot zones + feed relationships
  useEffect(() => {
    (async () => {
      try {
        const [evRes, relRes] = await Promise.all([
          fetch(`${ENTANGLE_API}/events?resolved=false`).then(r => r.json()).catch(() => ({ events: [] })),
          api.get('/api/v1/feed-relationships').catch(() => ({ data: { relationships: [] } })),
        ]);
        setEntangleEvents(evRes.events || []);
        setFeedRels(relRes.data?.relationships || []);
      } catch { /* ignore */ }
      setPressureLoading(false);
    })();
  }, []);

  // Phase 4: Load crossings
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/v1/character-crossings/tracker');
        setCrossings(res.data?.crossings || []);
      } catch { /* ignore */ }
      setCrossingLoading(false);
    })();
  }, []);

  const handleConfirmGap = async (id) => {
    try {
      await api.put(`/api/v1/character-crossings/${id}/confirm-gap`, {});
      setCrossings(prev => prev.map(c => c.id === id ? { ...c, gap_confirmed: true } : c));
    } catch (err) {
      console.warn('[Dashboard] confirm gap error:', err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fdf8fa',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
    }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #f0e4ea',
        padding: '24px 32px 20px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#d4789a',
            fontFamily: "'DM Mono', monospace",
          }}>
            Narrative Pressure
          </span>
          <h1 style={{
            margin: '4px 0 4px', fontSize: 26, fontWeight: 400, color: '#2d1f28', lineHeight: 1.2,
          }}>
            Where is the tension living right now?
          </h1>
          <p style={{
            margin: '0 0 16px', fontSize: 13, color: '#a08090',
            fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic',
          }}>
            Open this when you sit down to write. The system has been watching.
          </p>

          {/* ── TOP BAR: Calendar Timeline ──────────────────────── */}
          <ZoneCard style={{ background: '#fefbfc', padding: '12px 16px' }}>
            {calLoading ? <LoadingZone /> : (
              <CalendarTimeline markers={markers} events={calEvents} />
            )}
          </ZoneCard>
        </div>
      </div>

      {/* ── Dashboard Zones ────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        {/* Row 1: Simultaneous + Self-Portrait */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ZoneCard>
            <SimultaneousView />
          </ZoneCard>
          <ZoneCard>
            <SelfPortraitPanel portrait={portrait} loading={mirrorLoading} />
          </ZoneCard>
        </div>

        {/* Row 2: Hot Zones + Pressure Wave */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ZoneCard>
            <HotZonesPanel events={entangleEvents} loading={pressureLoading} />
          </ZoneCard>
          <ZoneCard>
            <PressureWavePanel feedRelationships={feedRels} loading={pressureLoading} />
          </ZoneCard>
        </div>

        {/* Row 3: Underground + Crossings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ZoneCard>
            <UndergroundPanel events={calEvents} loading={calLoading} />
          </ZoneCard>
          <ZoneCard>
            <CrossingTracker crossings={crossings} loading={crossingLoading} onConfirmGap={handleConfirmGap} />
          </ZoneCard>
        </div>

        {/* Row 4: Author Flags (full width) */}
        <ZoneCard>
          <AuthorFlagsPanel loading={crossingLoading} />
        </ZoneCard>
      </div>
    </div>
  );
}
