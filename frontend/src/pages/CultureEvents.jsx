/**
 * CultureEvents — Events + Awards & Media + History (the LalaVerse hub's
 * Culture tab)
 *
 * Three tabs with clear purpose:
 *   Events       — plan & spawn (DREAM city calendar); the show the new
 *                  event goes to is chosen here when there are several
 *   Awards/Media — who covers & amplifies (power structures); its own
 *                  Brain Update button (source cultural_calendar)
 *   History      — what the world remembers (memory system); its own
 *                  Brain Update button (source cultural_memory)
 *
 * 2026-10-04: the page-level "Push to Brain" button is gone. It clicked
 * two hidden buttons that no longer existed, so it did nothing, and the
 * show picker sat in the same hidden block.
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import usePageData from '../hooks/usePageData';
import BrainUpdate from '../components/BrainUpdate';
import { ShowSelect } from '../components/ShowChooser';
import useActiveShow from '../hooks/useActiveShow';
import EventsTab from '../components/Culture/EventsTab';
import AwardsMediaTab from '../components/Culture/AwardsMediaTab';
import HistoryTab from '../components/Culture/HistoryTab';
import { CALENDAR_DEFAULTS } from '../data/calendarData';
import { MEMORY_DEFAULTS } from '../data/memoryData';
import { tabFromSearch } from '../utils/worldRedirects';

// File-local cross-CP duplicates of CP10 CulturalCalendar helpers per
// v2.12 §9.11 file-local convention. listShowsApi reaches 5-fold
// cross-CP existence (CP2 + CP5 + CP7 + CP9 showService + CP10 + CP11).
export const listShowsApi = () =>
  apiClient.get('/api/v1/shows').then((r) => r.data);
export const listCalendarEventsApi = (eventType) =>
  apiClient
    .get(`/api/v1/calendar/events?event_type=${encodeURIComponent(eventType)}`)
    .then((r) => r.data);
export const autoSpawnEventApi = (eventId, payload) =>
  apiClient
    .post(`/api/v1/calendar/events/${eventId}/auto-spawn`, payload)
    .then((r) => r.data);
export const deleteCalendarEventApi = (eventId) =>
  apiClient.delete(`/api/v1/calendar/events/${eventId}`).then((r) => r.data);

const TABS = [
  { key: 'events', label: 'Events', desc: 'Plan & create' },
  { key: 'awards', label: 'Awards & Media', desc: 'Who covers it' },
  { key: 'history', label: 'History', desc: 'What\'s remembered' },
];

export default function CultureEvents({ embedded = false }) {
  // ?tab= opens a tab (audit IA-04): the retired duplicate editors land here.
  const [tab, setTab] = useState(() => tabFromSearch(TABS, 'events', undefined, 'sub'));
  const { data: ccData, saving: ccSaving, loaded: ccLoaded } = usePageData('cultural_calendar', CALENDAR_DEFAULTS);
  const { data: cmData, saving: cmSaving, loaded: cmLoaded } = usePageData('cultural_memory', MEMORY_DEFAULTS);

  // Calendar events from API
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Audit CTX-01 (2026-10-03): a created event goes to the active show,
  // never the first one returned; with several and none active, choose.
  const { shows, showId, needsChoice, choose } = useActiveShow();
  const [toast, setToast] = useState(null);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    listCalendarEventsApi('lalaverse_cultural')
      .then(d => setEvents(d.events || []))
      .catch(e => console.error(e)).finally(() => setLoading(false));
  }, []);

  const handleCreateEvent = useCallback(async (ev) => {
    if (!showId) { flash(needsChoice ? 'Choose a show first (top right)' : 'No show found — create a show first', 'error'); return; }
    try {
      const d = await autoSpawnEventApi(ev.id, { show_id: showId, event_count: 1, max_guests: 6 });
      if (d.success) flash(`Created "${d.data?.events?.[0]?.name || 'event'}" — check the Events tab`);
      else flash(d.error || 'Failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
  }, [showId, needsChoice]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteCalendarEventApi(id);
      setEvents(p => p.filter(e => e.id !== id));
      flash('Deleted');
    } catch { flash('Delete failed', 'error'); }
  }, []);

  const saving = ccSaving || cmSaving;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: embedded ? 0 : '24px 20px' }}>
      {/* Header; inside the LalaVerse hub the tab is the heading */}
      <div style={{ display: 'flex', justifyContent: embedded ? 'flex-end' : 'space-between', alignItems: 'flex-start', marginBottom: embedded ? 8 : 20 }}>
        {!embedded && <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Culture & Events</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>What happens in the LalaVerse, who covers it, and what becomes legend</p>
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {saving && <span style={{ fontSize: 11, color: 'var(--lala-gold-text)' }}>Saving...</span>}
          {/* The action that belongs to the open sub-tab: the show for a new event, or that sub-tab's Brain Update */}
          {tab === 'events' && shows.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
              New events go to
              <ShowSelect shows={shows} value={showId} onChange={choose} label="Show for new events" prompt="Choose a show…" />
            </label>
          )}
          {tab === 'awards' && <BrainUpdate source="cultural_calendar" name="Calendar" data={ccData} ready={ccLoaded} />}
          {tab === 'history' && <BrainUpdate source="cultural_memory" name="Memory" data={cmData} ready={cmLoaded} />}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e0d0' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', fontSize: 12, fontWeight: 600,
            fontFamily: "'DM Mono', monospace",
            background: tab === t.key ? '#2C2C2C' : 'transparent',
            color: tab === t.key ? '#fff' : '#888',
            border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span>{t.label}</span>
            <span style={{ fontSize: 8, opacity: 0.6, fontWeight: 400 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ padding: '10px 16px', marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, background: toast.type === 'success' ? '#e8f5e9' : '#ffebee', color: toast.type === 'success' ? '#2e7d32' : '#c62828', display: 'flex', justifyContent: 'space-between' }}>
          <span>{toast.message || toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
      )}

      {/* Tab content */}
      {tab === 'events' && (
        <EventsTab events={events} loading={loading} onCreateEvent={handleCreateEvent} onDelete={handleDelete} />
      )}
      {tab === 'awards' && (
        <AwardsMediaTab data={ccData} />
      )}
      {tab === 'history' && (
        <HistoryTab data={cmData} />
      )}
    </div>
  );
}
