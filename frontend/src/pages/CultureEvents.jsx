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
 *
 * 2026-10-06, to the LalaVerse mock: in the hub the tabs sit under the
 * year (components/Culture/CultureYear: twelve months, the chosen month's
 * events and awards, the cultural memory), and the page and its three tabs
 * are in the hub's design (CultureEvents.css, tokens only).
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
import CultureYear from '../components/Culture/CultureYear';
import './CultureEvents.css';

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
      .catch((e) => console.error('[Culture] the cultural calendar could not be read:', e?.message)).finally(() => setLoading(false));
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
    } catch (err) { console.error('[Culture] delete failed:', err?.message); flash('Delete failed', 'error'); }
  }, []);

  const saving = ccSaving || cmSaving;

  return (
    <div className={`ce${embedded ? ' is-embedded' : ''}`}>
      {embedded && (
        <CultureYear calendar={events} loading={loading} awards={ccData.AWARD_SHOWS} showId={showId}
          onCreateEvent={(ev) => ev && handleCreateEvent(ev)} onOpen={setTab} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`ce-toast is-${toast.type}`} role="status">
          <span>{toast.message || toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <section className="ce-shell" aria-label="Culture and events">
        {/* Header; inside the LalaVerse hub the tab's banner is the heading */}
        <div className="ce-head">
          <div>
            {!embedded && <h1 className="ce-h1">Culture &amp; Events</h1>}
            <h2 className="ce-title">{embedded ? 'The calendar, the coverage, the memory' : 'What happens in the LalaVerse, who covers it, and what becomes legend'}</h2>
          </div>
          <div className="ce-head-actions">
            {saving && <span className="ce-saving">Saving…</span>}
            {/* The action that belongs to the open sub-tab: the show for a new event, or that sub-tab's Brain Update */}
            {tab === 'events' && shows.length > 1 && (
              <label className="ce-show-pick">
                New events go to
                <ShowSelect shows={shows} value={showId} onChange={choose} label="Show for new events" prompt="Choose a show…" />
              </label>
            )}
            {tab === 'awards' && <BrainUpdate source="cultural_calendar" name="Calendar" data={ccData} ready={ccLoaded} />}
            {tab === 'history' && <BrainUpdate source="cultural_memory" name="Memory" data={cmData} ready={cmLoaded} />}
          </div>
        </div>

        <div className="ce-tabs" role="tablist" aria-label="Culture">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ce-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>
              <span>{t.label}</span>
              <span className="ce-tab-desc">{t.desc}</span>
            </button>
          ))}
        </div>

        {tab === 'events' && <EventsTab events={events} loading={loading} onCreateEvent={handleCreateEvent} onDelete={handleDelete} />}
        {tab === 'awards' && <AwardsMediaTab data={ccData} />}
        {tab === 'history' && <HistoryTab data={cmData} />}
      </section>
    </div>
  );
}
