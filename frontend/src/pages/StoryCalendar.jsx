/**
 * StoryCalendar.jsx
 *
 * Story Timeline / Calendar view — visualises story clock markers
 * and calendar events on a timeline. Create and browse events by
 * type (world, story, character, cultural).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
const API = '/api/v1/storyteller';

export const listStoryCalendarEventsApi = (eventType) => {
  const qs = eventType && eventType !== 'all' ? `?event_type=${eventType}` : '';
  return apiClient.get(`${API}/calendar/events${qs}`).then((r) => r.data);
};
export const listStoryCalendarMarkersApi = () =>
  apiClient.get(`${API}/calendar/markers`).then((r) => r.data);
export const createStoryCalendarEventApi = (payload) =>
  apiClient.post(`${API}/calendar/events`, payload).then((r) => r.data);

// The studio tokens (docs/VISUAL_SYSTEM.md §7). Each family is a text twin
// that reads 4.5:1 on white and on its own wash, a wash, a line and a fill.
export const TONES = {
  gold:     { text: 'var(--lala-gold-text)',     soft: 'var(--lala-gold-soft)',     line: 'var(--lala-gold-line)',     fill: 'var(--lala-gold)' },
  warning:  { text: 'var(--warning-text)',       soft: 'var(--warning-bg)',         line: 'var(--warning-border)',     fill: 'var(--warning)' },
  danger:   { text: 'var(--danger-text)',        soft: 'var(--danger-bg)',          line: 'var(--danger-border)',      fill: 'var(--danger)' },
  success:  { text: 'var(--success-text)',       soft: 'var(--success-bg)',         line: 'var(--success-border)',     fill: 'var(--success-text)' },
  info:     { text: 'var(--info-text)',          soft: 'var(--info-bg)',            line: 'var(--info-border)',        fill: 'var(--info)' },
  lavender: { text: 'var(--lala-lavender-text)', soft: 'var(--lala-lavender-soft)', line: 'var(--lala-lavender-line)', fill: 'var(--lala-lavender)' },
};

const C = {
  bg: 'var(--surface-bg)', surface: 'var(--surface-card)', surfaceAlt: 'var(--lala-parchment-2)', border: 'var(--lala-parchment-3)',
  text: 'var(--text-primary)', textDim: 'var(--text-secondary)', textFaint: 'var(--text-secondary)',
  onFill: 'var(--text-inverse)',
  accent: TONES.gold.text, green: TONES.success.text, red: TONES.danger.text, blue: TONES.info.text,
  purple: TONES.lavender.text, orange: TONES.warning.text,
};

export const EVENT_TONES = {
  world_event: TONES.info,
  story_event: TONES.gold,
  character_event: TONES.lavender,
  lalaverse_cultural: TONES.warning,
};

const EVENT_ICONS = {
  world_event: '🌍',
  story_event: '📖',
  character_event: '👤',
  lalaverse_cultural: '✦',
};

const EVENT_TYPES = ['world_event', 'story_event', 'character_event', 'lalaverse_cultural'];
const VISIBILITY_OPTIONS = ['public', 'private', 'underground'];

export default function StoryCalendar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('timeline'); // timeline | list

  // Create event form
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', event_type: 'story_event', start_datetime: '',
    end_datetime: '', location_name: '', lalaverse_district: '',
    visibility: 'public', what_world_knows: '', what_only_we_know: '', logged_by: 'system',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eData, mData] = await Promise.all([
        listStoryCalendarEventsApi(typeFilter).catch(() => null),
        listStoryCalendarMarkersApi().catch(() => null),
      ]);
      if (eData) setEvents(eData.events || []);
      if (mData) setMarkers(mData.markers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.start_datetime) return;
    try {
      await createStoryCalendarEventApi(newEvent);
      setNewEvent({
        title: '', event_type: 'story_event', start_datetime: '',
        end_datetime: '', location_name: '', lalaverse_district: '',
        visibility: 'public', what_world_knows: '', what_only_we_know: '', logged_by: 'system',
      });
      setShowCreate(false);
      fetchData();
    } catch { /* ignore */ }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: C.surfaceAlt,
    border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  // Group events by month for timeline view
  const groupedByMonth = {};
  events.forEach(e => {
    const d = new Date(e.start_datetime);
    const key = isNaN(d) ? 'Unknown' : d.toLocaleString('default', { month: 'long', year: 'numeric' });
    (groupedByMonth[key] = groupedByMonth[key] || []).push(e);
  });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>Story Calendar</h1>
            <p style={{ fontSize: 12, color: C.textDim, margin: '4px 0 0' }}>
              Timeline of story events, character moments, and LalaVerse cultural milestones
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setViewMode(v => v === 'timeline' ? 'list' : 'timeline')}
              style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: C.textDim }}
            >
              {viewMode === 'timeline' ? '☰ List' : '⧖ Timeline'}
            </button>
            <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: C.textDim }}>
              ← Home
            </button>
          </div>
        </div>

        {/* Filters + Create */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setTypeFilter('all')}
              style={{
                padding: '5px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 12, whiteSpace: 'nowrap',
                border: `1px solid ${typeFilter === 'all' ? TONES.gold.line : C.border}`,
                background: typeFilter === 'all' ? TONES.gold.soft : 'transparent',
                color: typeFilter === 'all' ? C.accent : C.textDim, fontWeight: typeFilter === 'all' ? 600 : 400,
              }}
            >
              All
            </button>
            {EVENT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '5px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 12, whiteSpace: 'nowrap',
                  border: `1px solid ${typeFilter === t ? EVENT_TONES[t].line : C.border}`,
                  background: typeFilter === t ? EVENT_TONES[t].soft : 'transparent',
                  color: typeFilter === t ? EVENT_TONES[t].text : C.textDim, fontWeight: typeFilter === t ? 600 : 400,
                }}
              >
                {EVENT_ICONS[t]} {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{ padding: '8px 16px', background: C.accent, color: C.onFill, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + New Event
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Event title..."
                style={{ ...inputStyle, fontWeight: 600, gridColumn: '1 / -1' }}
              />
              <select
                value={newEvent.event_type}
                onChange={e => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))}
                style={inputStyle}
              >
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select
                value={newEvent.visibility}
                onChange={e => setNewEvent(prev => ({ ...prev, visibility: e.target.value }))}
                style={inputStyle}
              >
                {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input
                type="datetime-local"
                value={newEvent.start_datetime}
                onChange={e => setNewEvent(prev => ({ ...prev, start_datetime: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="datetime-local"
                value={newEvent.end_datetime}
                onChange={e => setNewEvent(prev => ({ ...prev, end_datetime: e.target.value }))}
                placeholder="End (optional)"
                style={inputStyle}
              />
              <input
                value={newEvent.location_name}
                onChange={e => setNewEvent(prev => ({ ...prev, location_name: e.target.value }))}
                placeholder="Location name..."
                style={inputStyle}
              />
              <input
                value={newEvent.lalaverse_district}
                onChange={e => setNewEvent(prev => ({ ...prev, lalaverse_district: e.target.value }))}
                placeholder="LalaVerse district..."
                style={inputStyle}
              />
            </div>
            <textarea
              value={newEvent.what_world_knows}
              onChange={e => setNewEvent(prev => ({ ...prev, what_world_knows: e.target.value }))}
              placeholder="What the world knows about this event..."
              rows={2} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }}
            />
            <textarea
              value={newEvent.what_only_we_know}
              onChange={e => setNewEvent(prev => ({ ...prev, what_only_we_know: e.target.value }))}
              placeholder="What only we know (hidden context)..."
              rows={2} style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreateEvent} style={{ padding: '8px 18px', background: TONES.success.fill, color: C.onFill, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Create Event
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: C.textDim }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Clock Markers (if any) */}
        {markers.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: C.textDim }}>Story Clock Positions</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {markers.map(m => (
                <div key={m.id} style={{
                  padding: '8px 14px', background: C.surface, border: `1px solid ${m.is_present ? TONES.gold.line : C.border}`,
                  borderRadius: 8, fontSize: 11,
                }}>
                  <div style={{ fontWeight: 600, color: m.is_present ? C.accent : C.text }}>{m.name}</div>
                  {m.description && <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>{m.description}</div>}
                  <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>
                    Order: {m.sequence_order} {m.is_present && '· PRESENT'}
                    {m.StoryCalendarEvents?.length > 0 && ` · ${m.StoryCalendarEvents.length} events`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Loading events...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>◉</div>
            No calendar events yet. Create one to start building your story timeline.
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline view */
          <div>
            {Object.entries(groupedByMonth).map(([month, monthEvents]) => (
              <div key={month} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.accent, textTransform: 'uppercase',
                  letterSpacing: 1, marginBottom: 10, paddingBottom: 4, borderBottom: `1px solid ${C.border}`,
                }}>
                  {month}
                </div>
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  {/* Timeline line */}
                  <div style={{
                    position: 'absolute', left: 7, top: 0, bottom: 0, width: 2,
                    background: C.border, borderRadius: 1,
                  }} />
                  {monthEvents.map(ev => {
                    const tone = EVENT_TONES[ev.event_type] || TONES.gold;
                    const d = new Date(ev.start_datetime);
                    return (
                      <div key={ev.id} style={{ position: 'relative', marginBottom: 14 }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute', left: -20, top: 14, width: 12, height: 12,
                          borderRadius: '50%', background: tone.fill, border: `2px solid ${C.bg}`,
                        }} />
                        <div style={{
                          background: C.surface, border: `1px solid ${C.border}`,
                          borderRadius: 10, padding: 14, borderLeft: `3px solid ${tone.fill}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 14 }}>{EVENT_ICONS[ev.event_type] || '•'}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ev.title}</span>
                                <span style={{
                                  fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                  background: tone.soft, color: tone.text,
                                }}>
                                  {ev.event_type?.replace(/_/g, ' ')}
                                </span>
                                {ev.visibility !== 'public' && (
                                  <span style={{
                                    fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                    background: ev.visibility === 'underground' ? TONES.danger.soft : TONES.lavender.soft,
                                    color: ev.visibility === 'underground' ? C.red : C.purple,
                                  }}>
                                    {ev.visibility}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: C.textFaint }}>
                                {!isNaN(d) ? d.toLocaleString() : ev.start_datetime}
                                {ev.location_name && ` · ${ev.location_name}`}
                                {ev.lalaverse_district && ` · ${ev.lalaverse_district}`}
                              </div>
                              {ev.what_world_knows && (
                                <div style={{ fontSize: 12, color: C.textDim, marginTop: 6, lineHeight: 1.5 }}>
                                  <strong style={{ color: C.text }}>World knows:</strong> {ev.what_world_knows}
                                </div>
                              )}
                              {ev.what_only_we_know && (
                                <div style={{ fontSize: 12, color: C.purple, marginTop: 4, lineHeight: 1.5, fontStyle: 'italic' }}>
                                  <strong>Only we know:</strong> {ev.what_only_we_know}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(ev => {
              const tone = EVENT_TONES[ev.event_type] || TONES.gold;
              const d = new Date(ev.start_datetime);
              return (
                <div key={ev.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 18 }}>{EVENT_ICONS[ev.event_type] || '•'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: C.textFaint }}>
                      {!isNaN(d) ? d.toLocaleDateString() : ''} · {ev.event_type?.replace(/_/g, ' ')}
                      {ev.location_name && ` · ${ev.location_name}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 8, background: tone.soft, color: tone.text }}>{ev.visibility}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
