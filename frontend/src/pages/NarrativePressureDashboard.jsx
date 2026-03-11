/**
 * NarrativePressureDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The page you open when you sit down to write and need to know where to go.
 * Shows: unresolved entanglement events, flagged characters, high-intensity
 * entanglements, recent unfollows, and Amber scene proposals.
 *
 * Route: /pressure  (add to sidebar under WRITE zone)
 * Light theme. Prime Studios palette: #d4789a / #7ab3d4 / #a889c8
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react';

const API = '/api/v1/entanglements';

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

const INTENSITY_RANK = { identity_anchor: 4, significant: 3, moderate: 2, peripheral: 1 };

const DIMENSION_LABELS = {
  ambition_identity:    'Ambition & Identity',
  the_body:             'The Body',
  class_money:          'Class & Money',
  religion_meaning:     'Religion & Meaning',
  race_culture:         'Race & Culture',
  sexuality_desire:     'Sexuality & Desire',
  family_architecture:  'Family Architecture',
  friendship_loyalty:   'Friendship & Loyalty',
  habits_rituals:       'Habits & Rituals',
  speech_silence:       'Speech & Silence',
  grief_loss:           'Grief & Loss',
  politics_justice:     'Politics & Justice',
  the_unseen:           'The Unseen',
  life_stage:           'Life Stage',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StateBadge({ state }) {
  if (!state) return null;
  const c = STATE_COLORS[state] || STATE_COLORS.plateauing;
  return (
    <span style={{
      display:       'inline-block',
      padding:       '2px 8px',
      borderRadius:  '20px',
      fontSize:      '10px',
      fontWeight:    600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      background:    c.bg,
      color:         c.text,
      border:        `1px solid ${c.border}`,
    }}>
      {state.replace('_', ' ')}
    </span>
  );
}

function IntensityDot({ intensity }) {
  const colors = {
    identity_anchor: '#d4789a',
    significant:     '#a889c8',
    moderate:        '#7ab3d4',
    peripheral:      '#ccc',
  };
  return (
    <span style={{
      display:      'inline-block',
      width:        8,
      height:       8,
      borderRadius: '50%',
      background:   colors[intensity] || '#ccc',
      marginRight:  5,
      flexShrink:   0,
    }} title={intensity} />
  );
}

function SectionHeader({ children, count, accent = '#d4789a' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <h2 style={{
        margin:        0,
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color:         accent,
        fontFamily:    'system-ui, sans-serif',
      }}>
        {children}
      </h2>
      {count !== undefined && (
        <span style={{
          background:   accent,
          color:        '#fff',
          borderRadius: '20px',
          fontSize:     10,
          fontWeight:   700,
          padding:      '1px 7px',
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: '#f0e4ea' }} />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{
      textAlign:  'center',
      padding:    '28px 20px',
      color:      '#c09aaa',
      fontSize:   13,
      fontStyle:  'italic',
      background: '#fdf8fa',
      borderRadius: 10,
      border:     '1px dashed #f0e4ea',
    }}>
      {message}
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({ event, onResolve, onApproveProposal }) {
  const [expanded, setExpanded] = useState(false);
  const profile  = event.profile || {};
  const proposals = event.scene_proposals || [];

  return (
    <div style={{
      background:   '#fff',
      border:       '1px solid #f0e4ea',
      borderRadius: 12,
      overflow:     'hidden',
      marginBottom: 10,
    }}>
      {/* Header */}
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* State indicator bar */}
        <div style={{
          width:        3,
          alignSelf:    'stretch',
          borderRadius: 2,
          background:   STATE_COLORS[event.new_state]?.border || '#f0e4ea',
          flexShrink:   0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#2d1f28', fontFamily: 'Georgia, serif' }}>
              {profile.display_name || profile.handle || 'Unknown'}
            </span>
            {profile.handle && (
              <span style={{ fontSize: 11, color: '#b08090', fontFamily: 'system-ui, sans-serif' }}>
                @{profile.handle}
              </span>
            )}
            {event.previous_state && event.new_state && (
              <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui, sans-serif' }}>
                <StateBadge state={event.previous_state} />
                <span style={{ margin: '0 4px', color: '#ccc' }}>→</span>
                <StateBadge state={event.new_state} />
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#7a5060', fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }}>
            {event.affected_character_ids?.length || 0} character{event.affected_character_ids?.length !== 1 ? 's' : ''} flagged
            {event.affected_dimensions?.length > 0 && (
              <span style={{ color: '#c09aaa' }}>
                {' · '}
                {event.affected_dimensions.slice(0, 3).map(d => DIMENSION_LABELS[d] || d).join(', ')}
                {event.affected_dimensions.length > 3 && ` +${event.affected_dimensions.length - 3} more`}
              </span>
            )}
            {proposals.length > 0 && (
              <span style={{ color: '#d4789a', fontWeight: 600 }}>
                {' · '}{proposals.length} scene proposal{proposals.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#c09aaa', fontFamily: 'system-ui, sans-serif' }}>
            {timeAgo(event.created_at)}
          </span>
          <span style={{ color: '#d4c0ca', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded: scene proposals */}
      {expanded && proposals.length > 0 && (
        <div style={{ borderTop: '1px solid #fdf0f5', padding: '14px 16px', background: '#fdf8fa' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#c09aaa',
            letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>
            Scene Proposals
          </p>
          {proposals.map((p, i) => (
            <div key={i} style={{
              background:   p.approved ? '#fef0f5' : '#fff',
              border:       `1px solid ${p.approved ? '#fca5c8' : '#f0e4ea'}`,
              borderRadius: 8,
              padding:      '12px 14px',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#5a3a4a',
                    fontFamily: 'system-ui, sans-serif' }}>
                    {p.character_name || 'Character'}
                    {p.dimension && (
                      <span style={{ fontWeight: 400, color: '#a889c8', marginLeft: 6 }}>
                        · {DIMENSION_LABELS[p.dimension] || p.dimension}
                      </span>
                    )}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#3d2030', lineHeight: 1.55,
                    fontFamily: 'Georgia, serif' }}>
                    {p.brief}
                  </p>
                </div>
                {!p.approved && (
                  <button
                    onClick={() => onApproveProposal(event.id, p.character_id)}
                    style={{
                      flexShrink:   0,
                      padding:      '6px 14px',
                      background:   '#d4789a',
                      color:        '#fff',
                      border:       'none',
                      borderRadius: 20,
                      fontSize:     11,
                      fontWeight:   600,
                      cursor:       'pointer',
                      fontFamily:   'system-ui, sans-serif',
                    }}>
                    Send to StoryTeller
                  </button>
                )}
                {p.approved && (
                  <span style={{ fontSize: 11, color: '#d4789a', fontWeight: 600,
                    fontFamily: 'system-ui, sans-serif' }}>✓ Sent</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve button */}
      <div style={{ borderTop: '1px solid #fdf0f5', padding: '10px 16px',
        display: 'flex', justifyContent: 'flex-end', background: '#fefbfc' }}>
        <button
          onClick={() => onResolve(event.id)}
          style={{
            padding:      '5px 14px',
            background:   'transparent',
            color:        '#b08090',
            border:       '1px solid #e8d5dd',
            borderRadius: 20,
            fontSize:     11,
            cursor:       'pointer',
            fontFamily:   'system-ui, sans-serif',
          }}>
          Mark resolved
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function NarrativePressureDashboard() {
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('events'); // events | characters | unfollows

  // Derived: flagged characters from unresolved events
  const flaggedCharacters = (() => {
    const map = {};
    events.forEach(ev => {
      (ev.affected_character_ids || []).forEach((cid, idx) => {
        if (!map[cid]) {
          map[cid] = {
            id:         cid,
            name:       (ev.scene_proposals || []).find(p => p.character_id === cid)?.character_name || 'Character',
            events:     [],
            dimensions: new Set(),
          };
        }
        map[cid].events.push(ev);
        (ev.affected_dimensions || []).forEach(d => map[cid].dimensions.add(d));
      });
    });
    return Object.values(map).sort((a, b) => b.events.length - a.events.length);
  })();

  const totalProposals = events.reduce((n, ev) =>
    n + ((ev.scene_proposals || []).filter(p => !p.approved).length), 0);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/events?resolved=false`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setError('Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleResolve = async (eventId) => {
    try {
      await fetch(`${API}/events/${eventId}/resolve`, { method: 'POST' });
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch {}
  };

  const handleApproveProposal = async (eventId, characterId) => {
    try {
      await fetch(`${API}/events/${eventId}/proposals/${characterId}/approve`, { method: 'POST' });
      setEvents(prev => prev.map(ev => {
        if (ev.id !== eventId) return ev;
        return {
          ...ev,
          scene_proposals: (ev.scene_proposals || []).map(p =>
            p.character_id === characterId ? { ...p, approved: true } : p
          ),
        };
      }));
    } catch {}
  };

  const tabs = [
    { id: 'events',     label: 'Hot Zones',         count: events.length         },
    { id: 'characters', label: 'Flagged Characters', count: flaggedCharacters.length },
    { id: 'proposals',  label: 'Scene Proposals',    count: totalProposals        },
  ];

  return (
    <div style={{
      minHeight:   '100vh',
      background:  '#fdf8fa',
      fontFamily:  'Georgia, serif',
    }}>
      {/* Page header */}
      <div style={{
        background:   '#fff',
        borderBottom: '1px solid #f0e4ea',
        padding:      '24px 32px 0',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#d4789a', fontFamily: 'system-ui, sans-serif' }}>
              Narrative Pressure
            </span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 400, color: '#2d1f28', lineHeight: 1.2 }}>
            Where the story wants to go.
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#a08090',
            fontFamily: 'system-ui, sans-serif', fontStyle: 'italic' }}>
            Open this when you sit down to write. The system has been watching.
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding:       '10px 18px',
                  background:    'transparent',
                  border:        'none',
                  borderBottom:  activeTab === tab.id ? '2px solid #d4789a' : '2px solid transparent',
                  color:         activeTab === tab.id ? '#d4789a' : '#a08090',
                  fontWeight:    activeTab === tab.id ? 600 : 400,
                  fontSize:      13,
                  cursor:        'pointer',
                  fontFamily:    'system-ui, sans-serif',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           7,
                  transition:    'color 0.15s',
                }}>
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    background:   activeTab === tab.id ? '#d4789a' : '#e8d5dd',
                    color:        activeTab === tab.id ? '#fff' : '#a08090',
                    borderRadius: 20,
                    fontSize:     10,
                    fontWeight:   700,
                    padding:      '1px 6px',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#c09aaa',
            fontSize: 13, fontStyle: 'italic' }}>
            Reading the world…
          </div>
        )}

        {error && (
          <div style={{ background: '#fef0f0', border: '1px solid #fca5a5',
            borderRadius: 10, padding: '14px 18px', color: '#b91c1c',
            fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Hot Zones tab ─────────────────────────────────────── */}
            {activeTab === 'events' && (
              <div>
                <SectionHeader count={events.length} accent="#d4789a">
                  Unresolved Events
                </SectionHeader>
                {events.length === 0
                  ? <EmptyState message="No active pressure. The world is quiet." />
                  : events.map(ev => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        onResolve={handleResolve}
                        onApproveProposal={handleApproveProposal}
                      />
                    ))
                }
              </div>
            )}

            {/* ── Flagged Characters tab ────────────────────────────── */}
            {activeTab === 'characters' && (
              <div>
                <SectionHeader count={flaggedCharacters.length} accent="#a889c8">
                  Flagged Characters
                </SectionHeader>
                {flaggedCharacters.length === 0
                  ? <EmptyState message="No characters under pressure right now." />
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                      {flaggedCharacters.map(char => (
                        <div key={char.id} style={{
                          background:   '#fff',
                          border:       '1px solid #f0e4ea',
                          borderLeft:   '3px solid #a889c8',
                          borderRadius: 10,
                          padding:      '14px 16px',
                        }}>
                          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600,
                            color: '#2d1f28' }}>
                            {char.name}
                          </p>
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#888',
                            fontFamily: 'system-ui, sans-serif' }}>
                            {char.events.length} active event{char.events.length !== 1 ? 's' : ''}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[...char.dimensions].map(d => (
                              <span key={d} style={{
                                fontSize:     10,
                                padding:      '2px 8px',
                                borderRadius: 20,
                                background:   '#f3f0ff',
                                color:        '#6d28d9',
                                border:       '1px solid #c4b5fd',
                                fontFamily:   'system-ui, sans-serif',
                              }}>
                                {DIMENSION_LABELS[d] || d}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ── Scene Proposals tab ───────────────────────────────── */}
            {activeTab === 'proposals' && (
              <div>
                <SectionHeader count={totalProposals} accent="#d4789a">
                  Scene Proposals — Ready to Write
                </SectionHeader>
                {totalProposals === 0
                  ? <EmptyState message="No pending scene proposals. Change an influencer's state to generate pressure." />
                  : events
                      .filter(ev => (ev.scene_proposals || []).some(p => !p.approved))
                      .map(ev => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          onResolve={handleResolve}
                          onApproveProposal={handleApproveProposal}
                        />
                      ))
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
