/**
 * CultureEvents — Events + Awards & Media + History
 *
 * Three tabs with clear purpose:
 *   Events       — plan & spawn (DREAM city calendar)
 *   Awards/Media — who covers & amplifies (power structures)
 *   History      — what the world remembers (memory system)
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import usePageData from '../hooks/usePageData';
import PushToBrain from '../components/PushToBrain';
import EventsTab from '../components/Culture/EventsTab';
import AwardsMediaTab from '../components/Culture/AwardsMediaTab';
import HistoryTab from '../components/Culture/HistoryTab';
import { CALENDAR_DEFAULTS } from '../data/calendarData';
import { MEMORY_DEFAULTS } from '../data/memoryData';

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

export default function CultureEvents() {
  const [tab, setTab] = useState('events');
  const { data: ccData, saving: ccSaving } = usePageData('cultural_calendar', CALENDAR_DEFAULTS);
  const { data: cmData, saving: cmSaving } = usePageData('cultural_memory', MEMORY_DEFAULTS);

  // Calendar events from API
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shows, setShows] = useState([]);
  const [toast, setToast] = useState(null);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { listShowsApi().then(d => setShows(d.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    listCalendarEventsApi('lalaverse_cultural')
      .then(d => setEvents(d.events || []))
      .catch(e => console.error(e)).finally(() => setLoading(false));
  }, []);

  const handleCreateEvent = useCallback(async (ev) => {
    const showId = shows[0]?.id;
    if (!showId) { alert('No show found — create a show first'); return; }
    try {
      const d = await autoSpawnEventApi(ev.id, { show_id: showId, event_count: 1, max_guests: 6 });
      if (d.success) flash(`Created "${d.data?.events?.[0]?.name || 'event'}" — check Events Library`);
      else flash(d.error || 'Failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
  }, [shows]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteCalendarEventApi(id);
      setEvents(p => p.filter(e => e.id !== id));
      flash('Deleted');
    } catch { flash('Delete failed', 'error'); }
  }, []);

  const saving = ccSaving || cmSaving;

  // Single push that sends both datasets
  const handlePushAll = useCallback(async () => {
    const btn = document.querySelector('[data-push-calendar]');
    const btn2 = document.querySelector('[data-push-memory]');
    if (btn) btn.click();
    setTimeout(() => { if (btn2) btn2.click(); }, 500);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Culture & Events</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>What happens in the LalaVerse, who covers it, and what becomes legend</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 11, color: '#B8962E' }}>Saving...</span>}
          <div style={{ display: 'none' }}>
            <PushToBrain pageName="cultural_calendar" data={ccData} data-push-calendar />
            <PushToBrain pageName="cultural_memory" data={cmData} data-push-memory />
          </div>
          <button onClick={handlePushAll} style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 600,
            background: '#FAF7F0', border: '1px solid #e8e0d0',
            borderRadius: 6, cursor: 'pointer', color: '#B8962E',
          }}>Push to Brain</button>
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
