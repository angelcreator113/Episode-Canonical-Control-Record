/**
 * The event library: every event of the show, to find, edit and attach
 * (Evoni's Producer Mode restructure, step 2, 2026-10-25: it moved from
 * Producer Mode's ?tab=events onto the Season page's Events tab, behaviour
 * unchanged). The queue's search, state chips, deal type, sort and page
 * live in the URL (utils/eventPagination); Cards | List; New event (the
 * choose-host flow); Ideas (EventIdeasDrawer); the ⋯ menu (Auto-Fill This
 * Month, the draft-script switch, Templates, Enhance, Delete Drafts, Delete
 * All); each card's menu (Edit details, Duplicate, Change status, the
 * invitation, the outfit, Regenerate Episode, Delete); the inline editor
 * (EventLibraryEditor) and the Edit details modal (EventDetailsModal), which
 * ?event=<id> opens.
 *
 * It loads what it draws (the events, episodes, scene sets, closet,
 * opportunities, world locations, overlay types and finance config, as
 * Producer Mode did) and reports every change through onChanged, so the
 * page around it can reload.
 *
 * The Season page narrows it with `scope` ({ ids, ordered }: the events to
 * show, and whether `ids` is slot order, which adds "Sort: Slot") and adds
 * a line to each card with `cardExtra(ev)` (the slot, the goals it moves, a
 * pencil).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MoreHorizontal, ArrowRight, Plus, Lightbulb, AlertTriangle, Search } from 'lucide-react';
import api from '../../services/api';
import { S, isFailureToast } from './producerStyles';
import { InvitationButton } from '../../pages/InvitationGenerator';
import EventOutfitPicker from '../EventOutfitPicker';
import { computeEventPackageReadiness, computeEventState, describeMissing, EVENT_QUEUE_STATES } from '../../utils/eventReadinessSections';
import { changedFields, withoutOrganizerKeys } from '../../utils/eventEditorChanges';
import { putEventVersioned, isStaleSaveError, saveErrorMessage } from '../../utils/eventSaveVersion';
import { EVENT_PAGE_PARAM, parseEventPage, paginateEvents, eventPageNumbers, readEventQuery, nextEventParams, eventRangeText, EVENTS_PER_PAGE, readEventSort, nextEventSortParams } from '../../utils/eventPagination';
import { eventCardDetails, matchesDealTypeFilter, dealTypeFilterOptions } from '../../utils/eventCardSummary';
import { fetchAllEpisodes, fetchAllSceneSets } from '../../lib/fetchAllPages';
import { fetchClosetWithTotal } from '../../lib/closetGrouping';
import { EMPTY_EVENT, calcDifficulty, scopeEvents } from '../../lib/eventLibrary';
import EventLibraryEditor from './EventLibraryEditor';
import EventDetailsModal from './EventDetailsModal';
import EventIdeasDrawer from './EventIdeasDrawer';
import EpisodeBlueprintModal from './EpisodeBlueprintModal';
import './EventLibrary.css';

export default function EventLibrary({ showId, scope = null, cardExtra = null, onChanged = null }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // What the library draws, loaded here (Producer Mode loaded the same).
  const [worldEvents, setWorldEvents] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [sceneSets, setSceneSets] = useState([]);
  // The closet, for the cards' wardrobe-conflict chip (getDressCodeConflicts).
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [worldLocations, setWorldLocations] = useState([]);
  const [overlayTypes, setOverlayTypes] = useState([]);
  const [financeConfig, setFinanceConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailures, setLoadFailures] = useState([]);
  const loadedOnceRef = useRef(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const [episodeBlueprint, setEpisodeBlueprint] = useState(null); // holds generated episode data for modal

  // Event editor state
  const [editingEvent, setEditingEvent] = useState(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT });
  const [savingEvent, setSavingEvent] = useState(false);
  const [injectTarget, setInjectTarget] = useState(null);
  const [injecting, setInjecting] = useState(false);
  const [injectError, setInjectError] = useState(null);
  const [injectSuccess, setInjectSuccess] = useState(null);
  // F2, F3: an event attached whose scene set is not linked to the episode:
  // { eventId, status, reason, options }. needs_reconnecting is shown with a
  // Retry; choose lists the venue's sets for Evoni to pick one.
  const [sceneSetReconnect, setSceneSetReconnect] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [toast, setToast] = useState(null);
  // Ideas' quick "+ New Opportunity" form.
  const [oppQuickForm, setOppQuickForm] = useState(null);
  // The outfit picker the card menu and the modal open (Task #2376).
  const [outfitPickerEvent, setOutfitPickerEvent] = useState(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [generateTarget, setGenerateTarget] = useState(null);
  // The Season page's narrowing (scope): the events this view shows, in
  // slot order when `ordered`. Everything the queue counts and pages is
  // drawn from these; the editor's parent picker and Ideas still see all.
  const scopedEvents = useMemo(() => scopeEvents(worldEvents, scope), [worldEvents, scope]);
  const slotOrdered = Boolean(scope?.ordered);
  const slotIndex = useMemo(() => new Map((scope?.ids || []).map((id, i) => [id, i])), [scope]);
  // Sort: Slot is the in-season view's default; elsewhere Name (eventPagination readEventSort).
  const eventSortChosen = readEventSort(searchParams, { slotOrdered });
  // The Events queue's search, state filter, deal-type filter (Task #2361)
  // and sort live in the URL with its page (utils/eventPagination
  // readEventQuery), so a refresh or Back keeps the queue where it was. Each
  // change is one URL update that also sends the queue to page 1.
  const eventQuery = readEventQuery(searchParams);
  const eventSearch = eventQuery.search;
  const eventStatusFilter = eventQuery.state;
  const eventDealFilter = eventQuery.deal;
  const eventSort = eventSortChosen; // name | prestige | cost | created | status, or slot (scope.ordered)
  const setEventQuery = (patch) => setSearchParams((prev) => nextEventParams(prev, patch), { replace: true });
  const setEventSearch = (search) => setEventQuery({ search });
  const setEventStatusFilter = (state) => setEventQuery({ state });
  const setEventDealFilter = (deal) => setEventQuery({ deal });
  const setEventSort = (sort) => setSearchParams((prev) => nextEventSortParams(prev, sort, { slotOrdered }), { replace: true });
  const [eventDetailModal, setEventDetailModal] = useState(null);
  // The Scene Brief before a venue or base generation from an event (S2, S3,
  // S5): { kind: 'venue', event, onDone } | { kind: 'base', event, set }.
  // The stored row the Edit details modal opened with, plus every change it
  // has saved since (Task #1786). Its hydration is the baseline a save
  // compares against, so only edited fields are sent. Cleared on close so a
  // reopen starts from the row as it is then.
  const eventModalStoredRef = useRef(null);
  // The modal's versioned save queue (Task #1788): saves run in order, each
  // sending the updated_at the one before it returned; base is the stored
  // snapshot above (utils/eventSaveVersion.js).
  const eventModalQueueRef = useRef(null);
  useEffect(() => {
    if (!eventDetailModal) eventModalStoredRef.current = null;
  }, [eventDetailModal]);
  // Live financial forecast for the open event + the show-level finance
  // config (balance, goals, next goal, progress). The forecast fetches
  // whenever the modal's event changes so a newly-picked outfit shows
  // updated numbers; finance config fetches once per show open.
  const [eventFinancials, setEventFinancials] = useState(null);
  const [eventFinancialsLoading, setEventFinancialsLoading] = useState(false);
  const [feedEventResults, setFeedEventResults] = useState({}); // { templateName: { status, event } }
  // Shared "Also draft a script" toggle — applies to single-event AND
  // multi-event generate. Unchecked by default to keep token spend low
  // unless the creator opts in. (Bulk-select state already lives above
  // as bulkMode / selectedEvents — reused here for multi-event generate.)
  const [draftScriptOnGenerate, setDraftScriptOnGenerate] = useState(false);
  // Events as cards or as a list (Evoni, 2026-10-22 layout list).
  const [eventLayout, setEventLayout] = useState('cards');
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [aiFixSuggestions, setAiFixSuggestions] = useState(null);
  // Events-queue overflow menus (Task #1648) — the header's own admin
  // actions, and which single card's per-event "⋯" menu is open (null =
  // none; only one open at a time).
  const [eventsHeaderMenuOpen, setEventsHeaderMenuOpen] = useState(false);
  // Events tab leads with the queue (Task #1763): the sections that used to
  // stack above it now sit below it, collapsed by default. Local state only —
  // every visit starts with them closed.
  // The Events page redesign (Evoni, 2026-09-30) removed the panels that
  // sat below the queue: Story Logic Warnings and its header badge, Draft
  // Events, Ideas, the Episode → Event map and the totals. Only the display
  // went: getSequenceWarnings, getDressCodeConflicts and their handlers stay.
  // Ideas (Feed opportunities and event templates) opens as a drawer from
  // the header; only the bottom panel went (Evoni, 2026-09-30).
  const [eventsIdeasOpen, setEventsIdeasOpen] = useState(false);
  useEffect(() => {
    if (!eventsIdeasOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setEventsIdeasOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eventsIdeasOpen]);
  // Events pagination: 9 cards a page, the page in the URL
  // (?evpage=N) so it survives a refresh. Filters, search and sort run
  // first and send the queue back to page 1.
  const eventPage = parseEventPage(searchParams.get(EVENT_PAGE_PARAM));
  const eventsGridRef = useRef(null);
  const setEventPage = (n) => setEventQuery({ page: n });
  const goToEventPage = (n) => {
    setEventPage(n);
    requestAnimationFrame(() => eventsGridRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };
  // Filtered, sorted, then paged (Task #2360).
  const visibleEvents = useMemo(() => scopedEvents.filter(ev => {
    const q = eventSearch.toLowerCase();
    const matchSearch = !q || ev.name?.toLowerCase().includes(q) || ev.host?.toLowerCase().includes(q) || ev.dress_code?.toLowerCase().includes(q) || ev.location_hint?.toLowerCase().includes(q);
    // Filters by the same computed queue state the chips above
    // count and the cards below display (Task #1648) — not the
    // raw world_events.status.
    const matchStatus = eventStatusFilter === 'all' || computeEventState(ev) === eventStatusFilter;
    return matchSearch && matchStatus && matchesDealTypeFilter(ev, eventDealFilter);
  }).sort((a, b) => {
    if (eventSort === 'slot') return (slotIndex.get(a.id) ?? 0) - (slotIndex.get(b.id) ?? 0);
    if (eventSort === 'prestige') return (b.prestige || 0) - (a.prestige || 0);
    if (eventSort === 'cost') return (b.cost_coins || 0) - (a.cost_coins || 0);
    if (eventSort === 'status') return (a.status || '').localeCompare(b.status || '');
    if (eventSort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    return (a.name || '').localeCompare(b.name || '');
  }), [scopedEvents, slotIndex, eventSearch, eventStatusFilter, eventDealFilter, eventSort]);
  const eventsView = paginateEvents(visibleEvents, eventPage);
  // A page past the end (after a delete or a narrower filter) is put right
  // in the URL once the events have loaded, so Back and refresh land on a
  // page that exists.
  useEffect(() => {
    if (loading || !loadedOnceRef.current) return;
    if (eventsView.page !== eventPage) setEventPage(eventsView.page);
  }, [loading, eventsView.page, eventPage]); // eslint-disable-line react-hooks/exhaustive-deps
  // The inline event editor renders above the queue, but it can be opened
  // from below it (a warning's Edit, a suggestion's + Create, a template).
  // Bring its top into view when it opens off-screen.
  const eventEditorRef = useRef(null);
  useEffect(() => {
    if (!editingEvent) return;
    requestAnimationFrame(() => {
      const el = eventEditorRef.current;
      if (!el?.getBoundingClientRect) return;
      const { top } = el.getBoundingClientRect();
      if (top < 0 || top > window.innerHeight) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }, [editingEvent]);
  const [openEventMenuId, setOpenEventMenuId] = useState(null);
  // Which open card menu is showing the "Change status" sub-list (null =
  // none; the menu's normal item list otherwise).
  const [statusMenuEventId, setStatusMenuEventId] = useState(null);
  const [aiRevising, setAiRevising] = useState(false);
  const [compareEvents, setCompareEvents] = useState(null); // [eventA, eventB]
  const [generating, setGenerating] = useState(false);
  const [seedingEvents, setSeedingEvents] = useState(false);
  const [lastGeneratedEpisodeId, setLastGeneratedEpisodeId] = useState(null);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => { setSuccessMsg(null); setLastGeneratedEpisodeId(null); }, 5000); return () => clearTimeout(t); }
  }, [successMsg]);

  // Everything the library draws. A failed section is named, so an empty
  // list is never mistaken for "there are none"; a failed refresh keeps
  // what loaded before.
  const fetchAll = async () => {
    setLoading(true); setError(null);
    const failed = [];
    const refresh = loadedOnceRef.current;
    const miss = (label, reset) => (err) => {
      console.error(`[EventLibrary] ${label} load failed:`, err?.response?.status, err?.response?.data || err?.message);
      failed.push(label);
      if (reset && !refresh) reset();
    };
    try {
      const requests = [
        api.get(`/api/v1/world/${showId}/events`).then(r => setWorldEvents(r.data?.events || [])).catch(miss('events', () => setWorldEvents([]))),
        fetchAllEpisodes(api, showId).then((list) => setEpisodes(list.items || [])).catch(miss('episodes', () => setEpisodes([]))),
        fetchAllSceneSets(api, showId).then((list) => setSceneSets(list.items || [])).catch(miss('scene sets', () => setSceneSets([]))),
        fetchClosetWithTotal(api, showId).then((list) => setWardrobeItems(list.items || [])).catch(miss('wardrobe', () => setWardrobeItems([]))),
        api.get(`/api/v1/opportunities/${showId}`).then(r => setOpportunities(r.data?.opportunities || [])).catch(miss('opportunities', () => setOpportunities([]))),
        api.get('/api/v1/world/locations').then(r => setWorldLocations(r.data?.locations || [])).catch(miss('world locations', () => setWorldLocations([]))),
      ];
      await Promise.allSettled(requests);
      setLoadFailures(failed);
      if (failed.length < requests.length) loadedOnceRef.current = true;
    } finally { setLoading(false); }
  };
  // After a change: reload, and tell the page around the library.
  const loadData = async () => {
    await fetchAll();
    onChangedRef.current?.();
  };
  useEffect(() => { fetchAll(); }, [showId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the show's overlay types so the event modal can render the
  // Phone-vs-UI picker with real options (vs the prior free-text input).
  // generated:bool comes back from the same endpoint, drives the asset-
  // readiness badge on each toggle chip.
  useEffect(() => {
    if (!showId) { setOverlayTypes([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/v1/ui-overlays/${showId}`);
        if (!cancelled) setOverlayTypes(res.data?.data || []);
      } catch { if (!cancelled) setOverlayTypes([]); }
    })();
    return () => { cancelled = true; };
  }, [showId]);

  // The show's finance config (balance + goal ladder), for the modal's
  // Financial Preview. The seed-balance POST is idempotent: a new show
  // never shows 0 coins.
  useEffect(() => {
    if (!showId) return;
    let cancelled = false;
    (async () => {
      try {
        await api.post(`/api/v1/shows/${showId}/seed-balance`);
        const res = await api.get(`/api/v1/shows/${showId}/financial-config`);
        if (!cancelled) setFinanceConfig(res.data);
      } catch (err) { console.error('[EventLibrary] finance config load failed:', err?.message); }
    })();
    return () => { cancelled = true; };
  }, [showId]);

  // Forecast fetch — refire whenever the open event changes OR its
  // outfit_pieces change (user saved a new outfit in the picker), or
  // when the show's starting balance is edited (Finance editor → save
  // re-seeds the ledger and updates financeConfig.current_balance, which
  // the forecast's balance_before/balance_after read from the server).
  // Forecast refresh nonce — bumped after the outfit picker saves or
  // closes so the preview refetches with the latest server-side state.
  // Without this, opening the picker, swapping pieces, then closing
  // without saving leaves the preview stuck on the old outfit_pieces
  // snapshot baked into eventDetailModal at modal-open time.
  const [forecastNonce, setForecastNonce] = useState(0);
  useEffect(() => {
    if (!eventDetailModal?.id || !showId) { setEventFinancials(null); return; }
    let cancelled = false;
    setEventFinancialsLoading(true);
    (async () => {
      try {
        const res = await api.get(`/api/v1/world/${showId}/events/${eventDetailModal.id}/financial-forecast`);
        if (!cancelled) setEventFinancials(res.data);
      } catch { if (!cancelled) setEventFinancials(null); }
      if (!cancelled) setEventFinancialsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventDetailModal?.id, eventDetailModal?.outfit_pieces, showId, financeConfig?.current_balance, forecastNonce]);

  // Escape key closes modals
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') { setEventDetailModal(null); setShowTemplates(false); } };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Deep-link: open one event's editor when navigated here with
  // ?tab=events&event=<id> (Task #1628 — the New Episode choose-host flow
  // lands here after creating an event). Waits for worldEvents to finish
  // loading, then clears the param so it doesn't reopen on a later
  // close/reopen of this same page.
  useEffect(() => {
    const eventId = searchParams.get('event');
    if (!eventId || loading) return;
    const ev = worldEvents.find((e) => e.id === eventId);
    if (ev) {
      setEventDetailModal(ev);
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, loading, worldEvents]);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => { setSuccessMsg(null); setLastGeneratedEpisodeId(null); }, 5000); return () => clearTimeout(t); }
  }, [successMsg]);

  // S8 (Evoni, 2026-10-02; §8(dd)), answer 3: "'Generate Venue Images' with
  // no set becomes 'Create the scene set' (no images) and lands in Scene
  // Sets." The venue's set is created for this event's venue and show and
  // linked to the event; its images are made in Scene Sets.
  const createVenueSceneSet = async (event) => {
    try {
      const res = await api.post('/api/v1/scene-sets', {
        name: event.venue_name || event.name,
        scene_type: 'EVENT_LOCATION',
        world_location_id: event.venue_location_id || null,
        show_id: showId,
      });
      const set = res.data?.data;
      if (!set?.id) throw new Error('The scene set was not created');
      setSceneSets((prev) => (prev.some((x) => x.id === set.id) ? prev : [set, ...prev]));
      return set;
    } catch (err) {
      console.error('[WorldAdmin] scene set create failed:', err);
      setToast('Could not create the scene set: ' + (err.response?.data?.error || err.message));
      return null;
    }
  };

  // ─── EVENT CRUD ───
  const openNewEvent = () => { setEventForm({ ...EMPTY_EVENT }); setEditingEvent('new'); };
  // What the event form's edit mode opened with (Task #1786), so its save
  // sends only what changed. Only openEditEvent sets it; new events POST
  // the whole form, as before.
  const eventFormOpenedRef = useRef(null);
  const openEditEvent = (ev) => {
    const opened = {
      ...EMPTY_EVENT, ...ev,
      is_paid: ev.is_free ? 'free' : ev.is_paid ? 'yes' : 'no',
      dress_code_keywords: Array.isArray(ev.dress_code_keywords) ? ev.dress_code_keywords : [],
      color_palette: Array.isArray(ev.color_palette) ? ev.color_palette : [],
    };
    eventFormOpenedRef.current = opened;
    setEventForm(opened);
    setEditingEvent(ev.id);
  };

  const toEventSubmitData = (form) => ({
    ...form,
    is_paid: form.is_paid === 'yes',
    is_free: form.is_paid === 'free',
    cost_coins: form.is_paid === 'free' ? 0 : form.cost_coins,
    dress_code_keywords: Array.isArray(form.dress_code_keywords)
      ? form.dress_code_keywords
      : (form.dress_code_keywords || '').split(',').map(k => k.trim()).filter(Boolean),
  });

  const saveEvent = async () => {
    setSavingEvent(true); setError(null);
    try {
      const submitData = toEventSubmitData(eventForm);
      if (editingEvent === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/events`, submitData);
        if (res.data.success) {
          let newEv = res.data.event;
          // If this event was created from an AI gap suggestion, the target
          // episode id was stashed on the form. Link it now via inject so
          // the gap warning actually clears.
          const linkEpId = eventForm.__pendingEpisodeLink;
          if (linkEpId) {
            try {
              await api.post(`/api/v1/world/${showId}/events/${newEv.id}/inject`, { episode_id: linkEpId });
              newEv = { ...newEv, used_in_episode_id: linkEpId, status: 'used' };
            } catch (linkErr) {
              console.warn('[AI gap] linking new event failed:', linkErr.response?.data?.error || linkErr.message);
            }
          }
          setWorldEvents(p => [newEv, ...p]);
          setEditingEvent(null);
          setSuccessMsg(linkEpId ? 'Event created and linked to episode!' : 'Event created!');
        }
      } else {
        // Edit: send only the fields that differ from what the form opened
        // with (Task #1786) — not the whole list row, which carried
        // canon_consequences, source_profile_id, venue_location_id,
        // outfit_pieces and the form's blank invitation-style defaults.
        // is_free is dropped: it is not a column, and the route ignores it.
        const opened = eventFormOpenedRef.current ? toEventSubmitData(eventFormOpenedRef.current) : {};
        const changes = changedFields(opened, submitData, Object.keys(submitData));
        delete changes.is_free;
        if (Object.keys(changes).length === 0) {
          setEditingEvent(null);
          setSuccessMsg('No changes to save');
          return;
        }
        // Versioned (Task #1788): refused if the event changed elsewhere
        // since the form opened, unless none of these fields did.
        const res = await putEventVersioned((u, b) => api.put(u, b), `/api/v1/world/${showId}/events/${editingEvent}`, changes, {
          version: eventFormOpenedRef.current?.updated_at, base: eventFormOpenedRef.current,
        });
        if (res.data.success) { setWorldEvents(p => p.map(e => e.id === editingEvent ? { ...e, ...res.data.event } : e)); setEditingEvent(null); setSuccessMsg('Event updated!'); }
      }
    } catch (err) { setError(saveErrorMessage(err)); if (isStaleSaveError(err)) loadData(); }
    finally { setSavingEvent(false); }
  };

  const seedEvents = async () => {
    if (worldEvents.length >= 20 && !window.confirm(`You already have ${worldEvents.length} events. This will replace them all with 24 AI-generated events. Continue?`)) return;
    setSeedingEvents(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/memories/generate-events', {
        show_id: showId,
        replace_existing: worldEvents.length > 0,
      }, { timeout: 120000 });
      const eventsRes = await api.get(`/api/v1/world/${showId}/events`);
      setWorldEvents(eventsRes.data?.events || []);
      setSuccessMsg(`Seeded ${res.data.generated} events (${Object.entries(res.data.breakdown || {}).map(([k, v]) => `${v} ${k}`).join(', ')})`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      setError(msg.includes('timeout') ? 'Event generation timed out. The AI may be slow — try again.' : msg);
    } finally {
      setSeedingEvents(false);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try { await api.delete(`/api/v1/world/${showId}/events/${eventId}`); setWorldEvents(p => p.filter(e => e.id !== eventId)); setSuccessMsg('Deleted'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const copyEvent = (ev) => {
    setEventForm({ ...EMPTY_EVENT, ...ev, name: `${ev.name} (Copy)`, status: 'draft' });
    setEditingEvent('new');
  };

  // Manual status override (Task #1648 follow-up, before Evoni's go on
  // #1649). advanceEventStatus never let anyone reach 'declined' or set
  // status back to 'draft' — it only cycled forward through
  // EVENT_STATUSES ('draft'→'ready'→'used'→'scripted'→'filmed'); this
  // isn't a capability the card rewrite removed, it's a pre-existing gap.
  //
  // Narrowed to draft/ready only (Evoni's ruling, same task): the other
  // three values each have their own writer with side effects a bare
  // status PUT would skip —
  //   - declined: only via "Decline Invite" (eventDetailModal), which
  //     calls POST .../decline → financialPressureService.recordDeclinedInvite
  //     for the decline bookkeeping. A raw PUT here would set the label
  //     without that bookkeeping ever running.
  //   - used: only by actually starting an episode (generate-episode/
  //     inject), which also sets used_in_episode_id. Setting status:
  //     'used' by itself here would make computeEventState's Used check
  //     (used_in_episode_id || status === 'used'/'filmed') report a
  //     linked episode that doesn't exist.
  //   - filmed: only by completing an episode (episodeCompletionService),
  //     which finalizes financials and stats. A raw PUT would mark an
  //     event filmed without the completion it's supposed to represent.
  // 'archived' was never offered — EVENT_EPISODE_FLOW.md §4's census of
  // every writer in the codebase found nothing that ever writes that
  // value; offering it here would invent a status this app doesn't
  // otherwise use, not restore one.
  const STATUS_OVERRIDE_OPTIONS = ['draft', 'ready'];
  const changeEventStatus = async (ev, status) => {
    try {
      const res = await putEventVersioned((u, b) => api.put(u, b), `/api/v1/world/${showId}/events/${ev.id}`, { status }, { version: ev.updated_at, base: ev });
      if (res.data.success) {
        setWorldEvents(prev => prev.map(e => e.id === ev.id ? { ...e, ...res.data.event, status } : e));
        setToast(`${ev.name} → ${status}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setToast(isStaleSaveError(err) ? saveErrorMessage(err) : 'Failed: ' + (err.response?.data?.error || err.message));
      if (isStaleSaveError(err)) loadData();
    }
  };

  const bulkInject = async (episodeId) => {
    for (const eventId of selectedEvents) {
      try { await injectEvent(eventId, episodeId); } catch {}
    }
    setSelectedEvents(new Set());
    setBulkMode(false);
  };

  const toggleSelectEvent = (eventId) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  // Event templates
  const EVENT_TEMPLATES = [
    { name: 'Fashion Gala', event_type: 'invite', prestige: 8, cost_coins: 150, strictness: 7, deadline_type: 'high', dress_code: 'black tie couture', dress_code_keywords: ['elegant', 'dramatic', 'couture', 'formal'] },
    { name: 'Press Day', event_type: 'brand_deal', prestige: 5, cost_coins: 50, strictness: 4, deadline_type: 'medium', dress_code: 'chic professional', dress_code_keywords: ['clean', 'polished', 'modern'] },
    { name: 'Garden Party', event_type: 'invite', prestige: 6, cost_coins: 100, strictness: 5, deadline_type: 'medium', dress_code: 'garden romantic', dress_code_keywords: ['floral', 'soft', 'romantic', 'feminine'] },
    { name: 'VIP Cocktail', event_type: 'invite', prestige: 7, cost_coins: 120, strictness: 6, deadline_type: 'high', dress_code: 'cocktail elegant', dress_code_keywords: ['elegant', 'sophisticated', 'chic'] },
    { name: 'Fitting Session', event_type: 'upgrade', prestige: 3, cost_coins: 0, strictness: 2, deadline_type: 'low', dress_code: 'casual', dress_code_keywords: ['casual', 'comfortable'] },
    { name: 'Brand Showcase', event_type: 'deliverable', prestige: 6, cost_coins: 80, strictness: 5, deadline_type: 'medium', dress_code: 'brand aligned', dress_code_keywords: ['trendy', 'on-brand'] },
  ];

  // Sequence validation — story logic warnings
  const getSequenceWarnings = (eventsArg) => {
    const eventsForCheck = eventsArg || worldEvents;
    const warnings = [];
    const episodeEvents = episodes.map(ep => ({
      ep,
      event: eventsForCheck.find(ev => ev.used_in_episode_id === ep.id),
    }));
    const linked = episodeEvents.filter(e => e.event);
    const sorted = [...linked].sort((a, b) => (a.ep.episode_number || 0) - (b.ep.episode_number || 0));

    // 1. High prestige too early
    for (const { ep, event } of sorted) {
      if ((ep.episode_number || 99) <= 3 && (event.prestige || 0) >= 8) {
        warnings.push({ type: 'prestige', eventName: event.name, fixType: 'swap',
          msg: `⚠️ "${event.name}" (prestige ${event.prestige}) in early Ep ${ep.episode_number} — high prestige events work better later` });
      }
    }

    // 2. Back-to-back same event type
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], curr = sorted[i];
      if (prev.event.event_type === curr.event.event_type &&
          Math.abs((curr.ep.episode_number || 0) - (prev.ep.episode_number || 0)) <= 1) {
        warnings.push({ type: 'duplicate_type', eventName: curr.event.name, pairName: prev.event.name, fixType: 'swap_episodes',
          epA: prev.ep, epB: curr.ep, evA: prev.event, evB: curr.event,
          msg: `⚠️ Back-to-back ${curr.event.event_type}: "${prev.event.name}" (Ep ${prev.ep.episode_number}) and "${curr.event.name}" (Ep ${curr.ep.episode_number})` });
      }
    }

    // 3. Duplicate event names
    const names = eventsForCheck.map(ev => ev.name?.toLowerCase().trim());
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (names[i] && names[j] && names[i] === names[j]) {
          warnings.push({ type: 'name', eventName: eventsForCheck[i].name, fixType: 'merge',
            dupA: eventsForCheck[i], dupB: eventsForCheck[j],
            msg: `⚠️ Duplicate event name: "${eventsForCheck[i].name}"` });
        }
      }
    }

    // 4. Cost curve — expensive event before Lala can afford it
    for (const { ep, event } of sorted) {
      const tier = event.career_tier || 1;
      const epNum = ep.episode_number || 1;
      if (tier >= 3 && epNum <= 4 && (event.cost_coins || 0) >= 150) {
        warnings.push({ type: 'cost', eventName: event.name, fixType: 'edit',
          msg: `💰 "${event.name}" costs ${event.cost_coins} coins at Tier ${tier} in Ep ${epNum} — Lala may not afford this yet` });
      }
    }

    // 5. Dress code variety — 3+ same dress code in a row
    for (let i = 2; i < sorted.length; i++) {
      const a = sorted[i-2]?.event?.dress_code?.toLowerCase();
      const b = sorted[i-1]?.event?.dress_code?.toLowerCase();
      const c = sorted[i]?.event?.dress_code?.toLowerCase();
      if (a && b && c && a === b && b === c) {
        warnings.push({ type: 'dress', eventName: sorted[i].event.name, fixType: 'edit',
          msg: `👗 Same dress code "${c}" for 3 episodes in a row (Ep ${sorted[i-2].ep.episode_number}-${sorted[i].ep.episode_number}) — add variety` });
      }
    }

    // 6. Missing event types — check season has variety
    const usedTypes = new Set(eventsForCheck.filter(ev => ev.status === 'used').map(ev => ev.event_type));
    const essentialTypes = ['invite', 'deliverable', 'brand_deal'];
    for (const t of essentialTypes) {
      if (eventsForCheck.length >= 6 && !usedTypes.has(t)) {
        warnings.push({ type: 'missing_type', fixType: 'create',
          msg: `📋 No "${t.replace(/_/g, ' ')}" events linked — balanced arcs need variety in event types` });
      }
    }

    // 7. Location repetition — same scene set back-to-back
    for (let i = 1; i < sorted.length; i++) {
      const prevScene = sorted[i-1]?.event?.scene_set_id;
      const currScene = sorted[i]?.event?.scene_set_id;
      if (prevScene && currScene && prevScene === currScene) {
        warnings.push({ type: 'location', eventName: sorted[i].event.name, fixType: 'edit',
          msg: `📍 Same location for "${sorted[i-1].event.name}" and "${sorted[i].event.name}" back-to-back — change one venue` });
      }
    }

    // 8. Difficulty spike — jump from Easy to Extreme
    for (let i = 1; i < sorted.length; i++) {
      const prevDiff = calcDifficulty(sorted[i-1].event);
      const currDiff = calcDifficulty(sorted[i].event);
      if (currDiff - prevDiff >= 4) {
        warnings.push({ type: 'spike', eventName: sorted[i].event.name, fixType: 'edit',
          msg: `🎯 Difficulty spike: "${sorted[i-1].event.name}" (${prevDiff.toFixed(1)}) → "${sorted[i].event.name}" (${currDiff.toFixed(1)}) — add a medium event between` });
      }
    }

    // 9. Unlinked episodes
    const unlinkedEps = episodeEvents.filter(e => !e.event);
    if (unlinkedEps.length > 0 && unlinkedEps.length <= 3) {
      for (const { ep } of unlinkedEps) {
        warnings.push({ type: 'gap', fixType: 'fill', ep,
          msg: `○ Ep ${ep.episode_number}: "${ep.title}" has no event — assign or create one` });
      }
    }

    return warnings;
  };

  // ── One-click fix handlers ──

  // Swap two events' episode assignments
  const handleSwapEpisodes = async (evA, evB, epA, epB) => {
    try {
      await Promise.all([
        api.post(`/api/v1/world/${showId}/events/${evA.id}/inject`, { episode_id: epB.id }),
        api.post(`/api/v1/world/${showId}/events/${evB.id}/inject`, { episode_id: epA.id }),
      ]);
      setWorldEvents(prev => prev.map(ev => {
        if (ev.id === evA.id) return { ...ev, used_in_episode_id: epB.id, status: 'used' };
        if (ev.id === evB.id) return { ...ev, used_in_episode_id: epA.id, status: 'used' };
        return ev;
      }));
      setToast('✅ Swapped episode assignments');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      // e.g. the terms lock (§8(x) D4): an event that started an episode can't be moved.
      console.error('[WorldAdmin] Swap failed:', err.response?.data?.error || err.message);
      setToast(`Could not swap: ${err.response?.data?.error || err.message || 'request failed'}`);
      setTimeout(() => setToast(null), 6000);
      loadData();
    }
  };

  // Merge duplicate events — keep first, delete second
  const handleMergeDuplicates = async (keepEvent, removeEvent) => {
    if (!window.confirm(`Keep "${keepEvent.name}" and delete the duplicate? The duplicate's episode link will transfer.`)) return;
    try {
      // If the duplicate was linked to an episode, relink the keeper
      if (removeEvent.used_in_episode_id && !keepEvent.used_in_episode_id) {
        await api.post(`/api/v1/world/${showId}/events/${keepEvent.id}/inject`, { episode_id: removeEvent.used_in_episode_id });
      }
      await api.delete(`/api/v1/world/${showId}/events/${removeEvent.id}`);
      setWorldEvents(prev => prev.filter(ev => ev.id !== removeEvent.id));
      setToast('✅ Merged — duplicate removed');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('[WorldAdmin] Merge failed:', err.response?.data?.error || err.message);
      setToast(`Merge failed: ${err.response?.data?.error || err.message || 'request failed'}`);
      setTimeout(() => setToast(null), 6000);
    }
  };

  // AI Rebalance — Amber drafts a list of variety-improving suggestions.
  // Nothing is actually changed until the user reviews and clicks Apply on
  // each card; the previous copy claimed it would reassign everything in
  // one shot, which it doesn't.
  const handleAiRebalance = async () => {
    setAiFixLoading(true);
    setToast('Asking Amber for rebalance suggestions…');
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
        warnings: [{ msg: 'REBALANCE: Suggest reassignments and changes across all events for maximum variety in type, prestige, dress code, and difficulty. Build a rising arc.' }],
        events: worldEvents,
        episodes,
      });
      const data = res.data?.data || [];
      setAiFixSuggestions(data);
      setToast(data.length ? `Amber drafted ${data.length} suggestion${data.length === 1 ? '' : 's'} — review below` : 'Amber had nothing to suggest');
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast(err.response?.data?.error || 'Rebalance failed');
      setTimeout(() => setToast(null), 3000);
    } finally { setAiFixLoading(false); }
  };

  // AI Generate events to fill gaps
  const handleAiGenerateForGap = async (ep) => {
    setAiFixLoading(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
        warnings: [{ msg: `CREATE: Suggest a complete new event for Episode ${ep.episode_number} "${ep.title}". Consider what events are already used and create something completely different. Return the suggestion with action "create" and new_value as a JSON object with ALL of these fields filled out (no empty strings):
- name: full event name
- event_type: invite|upgrade|guest|fail_test|deliverable|brand_deal
- host: who is hosting this event (a person, brand, or organization)
- host_brand: the brand or venue name
- prestige: 1-10
- cost_coins: number
- strictness: 1-10
- deadline_type: none|low|medium|high|tonight|urgent
- dress_code: specific dress code description
- dress_code_keywords: array of 4-6 style keywords
- narrative_stakes: 2-3 sentences about what this means for Lala's story
- career_milestone: what career achievement this event represents
- career_tier: 1-5
- description: full paragraph describing the event atmosphere and setting
- fail_consequence: what happens narratively if Lala fails
- success_unlock: what new opportunity opens if she succeeds
- location_hint: physical setting description` }],
        events: worldEvents,
        episodes,
      });
      // Stash the gap episode on every suggestion so the + Create button
      // can link the saved event back to the episode it was generated for.
      // Without this the new event saves unlinked and the gap is still a gap.
      const tagged = (res.data?.data || []).map(s => ({
        ...s,
        __targetEpisodeId: ep.id,
        __targetEpisodeNumber: ep.episode_number,
      }));
      setAiFixSuggestions(tagged);
    } catch (err) {
      setToast(err.response?.data?.error || 'Generation failed');
      setTimeout(() => setToast(null), 3000);
    } finally { setAiFixLoading(false); }
  };

  // AI Fix — send warnings to Claude for diversification suggestions
  const handleAiFix = async (warnings) => {
    setAiFixLoading(true);
    setAiFixSuggestions(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
        warnings,
        events: worldEvents,
        episodes,
      });
      setAiFixSuggestions(res.data?.data || []);
    } catch (err) {
      setAiFixSuggestions([{ warning: 'Error', suggestion: err.response?.data?.error || err.message, action: 'manual', event_name: '', new_value: '' }]);
    } finally {
      setAiFixLoading(false);
    }
  };

  const applyAiFix = async (suggestion) => {
    // Match by id first (stable across renames), then fall back to name.
    // Without id-first matching, applying a "rename" suggestion would
    // break any later suggestions that target the same event by its
    // pre-rename name.
    const ev = (suggestion.event_id && worldEvents.find(e => e.id === suggestion.event_id))
      || worldEvents.find(e => e.name === suggestion.event_name);
    if (!ev) {
      setToast(`Couldn't find event "${suggestion.event_name || suggestion.event_id}"`);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    try {
      // Reassign — set used_in_episode_id via the inject endpoint, which
      // also stamps status='used' and bumps times_used. The AI may put the
      // target in new_value as a UUID, an episode number, or a phrase like
      // "Ep 3" / "Episode 3", so try a couple of shapes before giving up.
      if (suggestion.action === 'reassign') {
        const raw = String(suggestion.new_value || suggestion.suggestion || '');
        let target = null;
        const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) target = episodes.find(e => e.id === uuidMatch[0]);
        if (!target) {
          const numMatch = raw.match(/\d+/);
          if (numMatch) target = episodes.find(e => e.episode_number === parseInt(numMatch[0], 10));
        }
        if (!target) { flash('Could not parse target episode from suggestion'); return; }

        await api.post(`/api/v1/world/${showId}/events/${ev.id}/inject`, { episode_id: target.id });
        const nextEvents = worldEvents.map(e => e.id === ev.id ? { ...e, used_in_episode_id: target.id, status: 'used' } : e);
        setWorldEvents(nextEvents);
        setAiFixSuggestions(prev => prev.filter(s => s !== suggestion));
        flash(checkWarningCleared(suggestion, nextEvents)
          || `Assigned "${ev.name}" to Ep ${target.episode_number}`);
        return;
      }

      const updates = {};
      if (suggestion.action === 'swap_type' && suggestion.new_value) updates.event_type = suggestion.new_value;
      if (suggestion.action === 'rename' && suggestion.new_value) updates.name = suggestion.new_value;
      if (suggestion.action === 'change_prestige' && suggestion.new_value) updates.prestige = parseInt(suggestion.new_value) || ev.prestige;
      // change_dress_code: new_value can be a plain string ("black-tie")
      // or an object { dress_code, dress_code_keywords } when the AI is
      // being thorough.
      if (suggestion.action === 'change_dress_code' && suggestion.new_value) {
        const v = suggestion.new_value;
        if (typeof v === 'string') updates.dress_code = v;
        else if (typeof v === 'object') {
          if (v.dress_code) updates.dress_code = v.dress_code;
          if (Array.isArray(v.dress_code_keywords)) updates.dress_code_keywords = v.dress_code_keywords;
        }
      }
      if (suggestion.action === 'change_cost' && suggestion.new_value) {
        const num = parseInt(String(suggestion.new_value).replace(/[^\d-]/g, ''), 10);
        if (Number.isFinite(num)) updates.cost_coins = num;
      }

      if (Object.keys(updates).length === 0) {
        flash(`No handler for action "${suggestion.action}"`);
        return;
      }

      // Only the suggestion's own fields (Task #1786). Spreading the list
      // row here resent every field it had, canon_consequences and
      // outfit_pieces included.
      const res = await putEventVersioned((u, b) => api.put(u, b), `/api/v1/world/${showId}/events/${ev.id}`, updates, { version: ev.updated_at, base: ev });
      if (res.data.success) {
        const nextEvents = worldEvents.map(e => e.id === ev.id ? { ...e, ...res.data.event } : e);
        setWorldEvents(nextEvents);
        setAiFixSuggestions(prev => prev.filter(s => s !== suggestion));
        flash(checkWarningCleared(suggestion, nextEvents)
          || `Applied: ${suggestion.suggestion.slice(0, 60)}`);
      }
    } catch (err) {
      if (isStaleSaveError(err)) { flash(saveErrorMessage(err)); loadData(); return; }
      flash(`Failed: ${err.response?.data?.error || err.message}`);
    }
  };

  // After Apply, recompute warnings against the post-update event list and
  // tell the user if Amber's "fix" actually addressed the warning it was
  // tagged to. Returns a heads-up string when the warning persists, or
  // null when the warning is gone (the success path).
  const checkWarningCleared = (suggestion, nextEvents) => {
    const targetMsg = suggestion.warning;
    if (!targetMsg) return null;
    const stillThere = getSequenceWarnings(nextEvents).some(w => {
      // Both directions of substring match — the warning text the AI saw
      // may have been truncated/paraphrased, and warning msgs change as
      // event names/numbers change after edits.
      const a = (w.msg || '').toLowerCase();
      const b = (targetMsg || '').toLowerCase();
      return a === b || a.includes(b.slice(0, 40)) || b.includes(a.slice(0, 40));
    });
    return stillThere ? '⚠️ Applied, but the warning is still here — try a different fix' : null;
  };

  // AI Revise — make an event more distinct from similar ones
  const handleAiRevise = async () => {
    const similars = findSimilarEvents(eventForm.name);
    if (similars.length === 0) return;
    setAiRevising(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
        warnings: [{ msg: `REVISE: The event "${eventForm.name}" is too similar to these existing events: ${similars.map(e => `"${e.name}" (type: ${e.event_type}, prestige: ${e.prestige}, dress: ${e.dress_code})`).join(', ')}.

Revise this event to make it COMPLETELY DIFFERENT while keeping the same general purpose. Change the name, adjust the type if needed, give it a distinct dress code, different prestige level, unique narrative stakes, and a fresh host/venue.

Return a single suggestion with action "revise" and new_value as a JSON object with ALL fields:
name, event_type, host, host_brand, prestige, cost_coins, strictness, deadline_type, dress_code, dress_code_keywords (array), narrative_stakes, career_milestone, career_tier, description, fail_consequence, success_unlock, location_hint.

The revised event should feel like a completely different experience from the similar events listed above.` }],
        events: worldEvents,
        episodes,
      });
      const suggestions = res.data?.data || [];
      if (suggestions.length > 0 && suggestions[0].new_value) {
        let data = suggestions[0].new_value;
        if (typeof data === 'string') try { data = JSON.parse(data); } catch { data = {}; }
        if (typeof data === 'object' && data.name) {
          // Keep the original ID but update all fields
          setEventForm(prev => ({
            ...prev,
            ...data,
            dress_code_keywords: Array.isArray(data.dress_code_keywords) ? data.dress_code_keywords : prev.dress_code_keywords,
          }));
          setToast('✨ Event revised — review and save');
          setTimeout(() => setToast(null), 3000);
        }
      }
    } catch (err) {
      setToast(err.response?.data?.error || 'Revision failed');
      setTimeout(() => setToast(null), 3000);
    } finally { setAiRevising(false); }
  };

  // Duplicate detection
  const findSimilarEvents = (name) => {
    if (!name || name.length < 4) return [];
    const norm = name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return worldEvents.filter(ev => {
      if (editingEvent && ev.id === editingEvent) return false;
      const evNorm = (ev.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return evNorm.includes(norm) || norm.includes(evNorm) ||
        norm.split(' ').filter(w => w.length > 3).some(w => evNorm.includes(w));
    });
  };

  // advanceEventStatus removed (Task #1648) — its only call site was the
  // Events card's old status-cycling pill, replaced by the computed-state
  // badge; EVENT_STATUSES/EVENT_STATUS_CONFIG stay, still used elsewhere
  // (e.g. the Episode Ledger's status display).

  // ── Bulk AI Enhance ──
  const handleBulkEnhance = async () => {
    const drafts = worldEvents.filter(ev => !ev.description || !ev.narrative_stakes || !ev.host);
    if (drafts.length === 0) { setToast('All events already enhanced'); setTimeout(() => setToast(null), 3000); return; }
    if (!window.confirm(`Enhance ${drafts.length} incomplete events with AI? This may take a minute.`)) return;
    setAiFixLoading(true);
    let enhanced = 0;
    let changedElsewhere = 0;
    for (const ev of drafts.slice(0, 10)) {
      try {
        const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
          warnings: [{ msg: `ENHANCE: Fill empty fields for "${ev.name}" (${ev.event_type}, prestige ${ev.prestige}). Return action "enhance" with new_value JSON including host, description, narrative_stakes, career_milestone, fail_consequence, success_unlock, location_hint, dress_code_keywords.` }],
          events: [ev], episodes,
        });
        const data = res.data?.data?.[0]?.new_value;
        if (data) {
          const parsed = typeof data === 'object' ? data : JSON.parse(data);
          // Never an organizer field (Task #1786): host, host_brand and
          // source_profile_id are chosen in the Event Package, not filled
          // from AI output.
          const toSave = {};
          for (const [k, v] of Object.entries(withoutOrganizerKeys(parsed))) {
            if (v && !ev[k]) toSave[k] = v;
          }
          if (Object.keys(toSave).length > 0) {
            await putEventVersioned((u, b) => api.put(u, b), `/api/v1/world/${showId}/events/${ev.id}`, toSave, { version: ev.updated_at, base: ev });
            enhanced++;
          }
        }
      } catch (err) {
        // Counted and reported, not swallowed (Task #1788): an event that
        // changed elsewhere since the list loaded is skipped.
        if (isStaleSaveError(err)) changedElsewhere++;
      }
    }
    setAiFixLoading(false);
    setToast(`✨ Enhanced ${enhanced} events${changedElsewhere ? ` — ${changedElsewhere} skipped because they changed elsewhere; run Enhance again after the list reloads` : ''}`);
    setTimeout(() => setToast(null), 3000);
    loadData();
  };

  // ── Event export CSV ──
  const handleExportCSV = () => {
    const headers = ['Name', 'Type', 'Host', 'Brand', 'Prestige', 'Cost', 'Strictness', 'Deadline', 'Dress Code', 'Status', 'Episode', 'Narrative Stakes'];
    const rows = worldEvents.map(ev => {
      const ep = episodes.find(e => e.id === ev.used_in_episode_id);
      return [ev.name, ev.event_type, ev.host || '', ev.host_brand || '', ev.prestige, ev.cost_coins, ev.strictness, ev.deadline_type, ev.dress_code || '', ev.status, ep ? `${ep.episode_number}. ${ep.title}` : '', (ev.narrative_stakes || '').replace(/"/g, '""')].map(v => `"${v}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Wardrobe vs Dress Code conflict detection ──
  const getDressCodeConflicts = () => {
    const conflicts = [];
    for (const ev of worldEvents.filter(e => e.used_in_episode_id && e.dress_code_keywords?.length > 0)) {
      const ep = episodes.find(e => e.id === ev.used_in_episode_id);
      if (!ep) continue;
      const epWardrobe = wardrobeItems.filter(w => w.episode_id === ep.id || w.show_id === showId);
      if (epWardrobe.length === 0) continue;
      const wardrobeKeywords = epWardrobe.flatMap(w => [w.style, w.category, w.color, ...(w.tags || [])].filter(Boolean).map(s => s.toLowerCase()));
      const eventKeywords = ev.dress_code_keywords.map(k => k.toLowerCase());
      const matches = eventKeywords.filter(k => wardrobeKeywords.some(wk => wk.includes(k) || k.includes(wk)));
      if (matches.length === 0 && eventKeywords.length >= 3) {
        conflicts.push({ event: ev, episode: ep, eventKeywords, wardrobeKeywords: wardrobeKeywords.slice(0, 5) });
      }
    }
    return conflicts;
  };

  // F2: Retry linking an attached event's scene set to its episode; F3: or
  // link the venue's set Evoni chose.
  const retrySceneSetLink = async (eventId, sceneSetId = null) => {
    setReconnecting(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/scene-set-link`, sceneSetId ? { scene_set_id: sceneSetId } : {});
      const sceneSet = res.data?.scene_set;
      if (sceneSet?.status === 'linked') {
        setSceneSetReconnect(null);
        setToast(`Scene set linked${sceneSet.scene_set_name ? `: “${sceneSet.scene_set_name}”` : ''}.`);
        loadData();
      } else {
        setSceneSetReconnect({ eventId, status: sceneSet?.status || 'needs_reconnecting', reason: sceneSet?.reason || 'The scene set is still not linked.', options: sceneSet?.options || [] });
      }
    } catch (err) {
      console.error('[WorldAdmin] scene set retry failed:', err);
      setSceneSetReconnect((cur) => ({ ...(cur || {}), eventId, reason: err.response?.data?.error || err.message }));
    } finally { setReconnecting(false); }
  };

  const injectEvent = async (eventId, episodeId) => {
    setInjecting(true); setInjectError(null); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/inject`, { episode_id: episodeId });
      if (res.data.success) {
        const ep = episodes.find(e => e.id === episodeId);
        const epLabel = ep ? `${ep.episode_number || '?'}. ${ep.title || 'Untitled'}` : 'episode';
        const sceneSet = res.data.scene_set;
        const pending = sceneSet?.status === 'needs_reconnecting' || sceneSet?.status === 'choose';
        const msg = !pending ? `✅ Injected into ${epLabel}`
          : sceneSet.status === 'choose' ? 'Event attached · Choose its scene set' : 'Event attached · Scene set needs reconnecting';
        setSceneSetReconnect(pending ? { eventId, status: sceneSet.status, reason: sceneSet.reason || null, options: sceneSet.options || [] } : null);
        // Show inline success in the inject panel briefly; a scene set still
        // to reconnect or choose is shown in its own banner, never as success.
        if (!pending) {
          setSuccessMsg(msg);
          setInjectSuccess({ eventId, message: msg });
        }
        // Show floating toast (visible regardless of scroll)
        setToast(msg);
        setTimeout(() => { setToast(null); }, 3000);
        // Close inject panel after a brief delay so user sees the confirmation
        setTimeout(() => { setInjectTarget(null); setInjectSuccess(null); }, 2000);
        // Update local event status to 'used'
        const updatedEvent = { ...worldEvents.find(ev => ev.id === eventId), status: 'used', times_used: ((worldEvents.find(ev => ev.id === eventId)?.times_used) || 0) + 1, used_in_episode_id: episodeId };
        setWorldEvents(prev => prev.map(ev => ev.id === eventId ? updatedEvent : ev));
        // Also update the detail modal if it's showing this event
        setEventDetailModal(prev => prev && prev.id === eventId ? { ...prev, status: 'used', used_in_episode_id: episodeId } : prev);
      } else {
        const msg = res.data?.error || res.data?.message || 'Inject returned unexpected response';
        setInjectError(msg); setError(msg);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setInjectError(msg); setError(msg);
      console.error('Inject failed:', err.response?.status, msg);
    } finally { setInjecting(false); }
  };

  const generateScript = async (eventId, episodeId) => {
    setGenerating(true); setError(null);
    const post = (confirmOverwrite) => api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, {
      episode_id: episodeId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      let res;
      try {
        res = await post(false);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          res = await post(true);
        } else {
          throw err;
        }
      }
      if (res.data.success) {
        setLastGeneratedEpisodeId(episodeId);
        setSuccessMsg(`Script generated! ${res.data.beat_count} beats, ${res.data.line_count} lines.`);
        setGenerateTarget(null);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setGenerating(false); }
  };

  // Everything the editor, the modal, the Ideas drawer and the blueprint draw with.
  const lib = {
    aiRevising, createVenueSceneSet, deleteEvent, editingEvent, episodeBlueprint, episodes, eventDetailModal, eventEditorRef, eventFinancials, eventFinancialsLoading, eventForm, eventModalQueueRef, eventModalStoredRef, feedEventResults, financeConfig, findSimilarEvents, handleAiRevise, injectEvent, injecting, injectSuccess, loadData, opportunities, oppQuickForm, overlayTypes, reconnecting, retrySceneSetLink, saveEvent, savingEvent, sceneSetReconnect, sceneSets, setAiRevising, setEditingEvent, setEpisodeBlueprint, setError, setEventDetailModal, setEventForm, setEventsIdeasOpen, setFeedEventResults, setOppQuickForm, setOutfitPickerEvent, setToast, setWorldEvents, showId, worldEvents, worldLocations,
  };

  return (
    <div className="evl" data-testid="event-library">
      {error && <div style={S.errorBanner}>{error}<button onClick={() => setError(null)} style={S.xBtn}>✕</button></div>}
      {loadFailures.length > 0 && (
        <div className="evl-load-failed" role="alert" data-testid="evl-load-failed">
          {`Couldn't load ${loadFailures.join(', ')}. Those parts may look empty until they load.`}
          <button type="button" onClick={loadData}>Retry</button>
        </div>
      )}
      {successMsg && (
        <div style={S.successBanner}>
          {successMsg}
          {lastGeneratedEpisodeId && (
            <Link to={`/episodes/${lastGeneratedEpisodeId}`} style={{ marginLeft: 12, color: '#16a34a', fontWeight: 700, textDecoration: 'underline' }}>
              → Go to Episode
            </Link>
          )}
        </div>
      )}
      {loading && !loadedOnceRef.current ? (
        <p className="evl-loading" role="status">Loading the events…</p>
      ) : (
        <>
          {/* Header — a queue, not an editor (docs/EVENT_EPISODE_FLOW.md §8(m),
              Evoni's ruling, Task #1648). Counts below come from the same
              five computed states the filter bar and cards use
              (computeEventState, ../utils/eventReadinessSections.js) — not the raw,
              inconsistently-written world_events.status column §4 of that
              doc already documents. */}
          <div className="wa-ev-head">
            <div className="wa-ev-head-title">
              <h2>Events</h2>
              <span>Invitations and opportunities that can become episodes · {scopedEvents.length} events</span>
            </div>
            {/* One toolbar (Evoni, 2026-10-22 layout list): search, deal type,
                sort, the layout, Ideas, ⋯ and New event. Auto-Fill This Month
                and the draft-script switch are in ⋯. */}
            <div className="wa-ev-head-actions">
              <label className="wa-ev-search">
                <Search size={15} aria-hidden="true" />
                <input type="text" value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search events" aria-label="Search events" />
              </label>
                <select data-testid="events-deal-filter" aria-label="Filter by deal type" value={eventDealFilter}
                  onChange={e => setEventDealFilter(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 11, background: eventDealFilter === 'all' ? 'var(--surface-card)' : 'var(--primary-subtle)', cursor: 'pointer', maxWidth: '100%' }}>
                  {dealTypeFilterOptions(scopedEvents).map(o => (
                    <option key={o.key} value={o.key}>{o.label} ({o.count})</option>
                  ))}
                </select>
                <select value={eventSort} onChange={e => setEventSort(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 11, background: 'var(--surface-card)', cursor: 'pointer' }}>
                  {slotOrdered && <option value="slot">Sort: Slot</option>}
                  <option value="name">Sort: Name</option>
                  <option value="prestige">Sort: Prestige ↓</option>
                  <option value="cost">Sort: Cost ↓</option>
                  <option value="status">Sort: Status</option>
                  <option value="created">Sort: Newest</option>
                </select>
              <div className="wa-ev-layout" role="group" aria-label="Layout">
                {[['cards', 'Cards'], ['list', 'List']].map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={eventLayout === key} className={eventLayout === key ? 'active' : ''} onClick={() => setEventLayout(key)}>{label}</button>
                ))}
              </div>
              {/* + New event opens the choose-host flow (Task #1628), same
                  entry point as New Episode — an event created here always
                  starts with a host, unlike the system-created paths (Needs
                  Host below). Manual/no-host creation is still reachable
                  from the empty state's "+ Create Manually". Creation tools
                  (Feed opportunities and event templates) open in a drawer
                  (Evoni, 2026-09-30). */}
              <button type="button" data-testid="events-ideas-button" aria-haspopup="dialog" aria-expanded={eventsIdeasOpen}
                onClick={() => setEventsIdeasOpen(true)}
                style={S.smBtn} title="Pulse opportunities and event ideas">
                <Lightbulb size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />Ideas
              </button>
              <div className="wa-ev-more">
                <button onClick={() => setEventsHeaderMenuOpen(o => !o)} style={S.smBtn} title="More actions" aria-label="More actions" aria-expanded={eventsHeaderMenuOpen}>
                  <MoreHorizontal size={16} />
                </button>
                {eventsHeaderMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setEventsHeaderMenuOpen(false)} />
                    <div className="wa-ev-more-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 41, minWidth: 240, overflow: 'hidden' }}>
                          <button type="button" onClick={async () => {
                            setEventsHeaderMenuOpen(false);
                            setAutoFilling(true);
                            setToast('🗓️ Generating events for this month...');
                            try {
                              // Step 1: Generate seasonal calendar events
                              const month = new Date().getMonth();
                              console.log('[AutoFill] Starting for month', month, 'show', showId);
                              const calRes = await api.post('/api/v1/calendar/events/generate-seasonal', { month, count: 3, show_id: showId });
                              console.log('[AutoFill] Calendar response:', calRes.data);
                              if (!calRes.data.success) throw new Error(calRes.data.error || 'Calendar generation failed');
                              const seasonalCount = calRes.data.data?.count || 0;
                              setToast(`📅 ${seasonalCount} seasonal events created. Spawning world events...`);

                              // Step 2: Auto-spawn world events from each seasonal event
                              const calEvents = calRes.data.data?.created || [];
                              let spawned = 0;
                              for (const ce of calEvents) {
                                try {
                                  console.log('[AutoFill] Spawning from calendar event:', ce.id, ce.title);
                                  const spawnRes = await api.post(`/api/v1/calendar/events/${ce.id}/auto-spawn`, {
                                    show_id: showId, event_count: 1, max_guests: 6,
                                  });
                                  console.log('[AutoFill] Spawn result:', spawnRes.data);
                                  if (spawnRes.data.success) spawned += spawnRes.data.data?.events_created || 0;
                                } catch (spawnErr) {
                                  console.error('[AutoFill] Spawn failed:', spawnErr.response?.data || spawnErr.message);
                                }
                              }
                              setToast(`✅ Created ${seasonalCount} seasonal + ${spawned} world events with hosts & venues!`);
                              loadData();
                            } catch (err) {
                              console.error('[AutoFill] Error:', err.response?.data || err.message);
                              setToast('❌ Auto-fill failed: ' + (err.response?.data?.error || err.message));
                            }
                            setAutoFilling(false);
                            setTimeout(() => setToast(null), 6000);
                          }} disabled={autoFilling} style={S.menuItem}>
                            {autoFilling ? '⏳ Generating...' : '🗓️ Auto-Fill This Month'}
                          </button>
                      {/* Generate options: the draft-script opt-in, picked up by both
                          the per-event Generate and the bulk "Generate from N
                          events" (it was its own bar above the cards). */}
                      <label data-testid="events-draft-script" style={{ ...S.menuItem, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={draftScriptOnGenerate} onChange={(e) => setDraftScriptOnGenerate(e.target.checked)} />
                        <span>Also draft a script when generating an episode</span>
                      </label>
                        <button onClick={() => { setShowTemplates(!showTemplates); setEventsHeaderMenuOpen(false); }} style={S.menuItem}>📋 Templates</button>
                        <button onClick={() => { handleBulkEnhance(); setEventsHeaderMenuOpen(false); }} disabled={aiFixLoading} style={S.menuItem}>{aiFixLoading ? '⏳ Enhancing...' : '✨ Enhance'}</button>
                        <button onClick={async () => {
                          setEventsHeaderMenuOpen(false);
                          if (!window.confirm('Delete ALL draft events? Ready/used events will be kept.')) return;
                          try {
                            const res = await api.post(`/api/v1/world/${showId}/events/bulk-delete`, { delete_all_drafts: true });
                            setToast(`Deleted ${res.data.deleted} draft events`);
                            loadData();
                          } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                        }} style={{ ...S.menuItem, color: 'var(--danger)' }}>Delete Drafts</button>
                        <button onClick={async () => {
                          setEventsHeaderMenuOpen(false);
                          if (!window.confirm('DELETE ALL EVENTS? This cannot be undone. Are you sure?')) return;
                          if (!window.confirm('Really delete everything? Type yes to confirm.')) return;
                          try {
                            const res = await api.post(`/api/v1/world/${showId}/events/bulk-delete`, { delete_all: true });
                            setToast(`Deleted ${res.data.deleted} events`);
                            loadData();
                          } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                        }} style={{ ...S.menuItem, color: 'var(--danger)' }}>Delete All</button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => navigate(`/shows/${showId}/new-episode`)} style={S.primaryBtn}>
                <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New event
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {bulkMode && selectedEvents.size > 0 && (
            <div style={{ background: 'var(--lala-lavender-soft)', border: '1px solid var(--lala-lavender-line)', borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lala-lavender-text)' }}>{selectedEvents.size} selected</span>
              {selectedEvents.size === 2 && (
                <button onClick={() => { const ids = [...selectedEvents]; setCompareEvents(worldEvents.filter(ev => ids.includes(ev.id))); }} style={{ padding: '3px 10px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--accent-dark)', fontWeight: 600 }}>🔍 Compare</button>
              )}
              {/* Multi-event generate — anchored on the first selected
                  event, the rest auto-link via used_in_episode_id so
                  locations / wardrobe / narrative all read through. */}
              {selectedEvents.size >= 1 && (
                <button onClick={async () => {
                  if (selectedEvents.size === 0) return;
                  const ids = Array.from(selectedEvents);
                  try {
                    setToast(`🎬 Generating episode from ${ids.length} event${ids.length === 1 ? '' : 's'}...`);
                    const res = await api.post(`/api/v1/world/${showId}/events/generate-episode-from-many`, {
                      event_ids: ids,
                      draft_script: draftScriptOnGenerate,
                    });
                    if (res.data.success) {
                      setEpisodeBlueprint(res.data.data);
                      const ep = res.data.data.episode;
                      const skipped = res.data.skipped_extras?.length || 0;
                      setToast(`✅ Episode "${ep?.title}" created from ${1 + (res.data.linked_extras?.length || 0)} event${(res.data.linked_extras?.length || 0) === 0 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}${res.data.script_drafted ? ' + script' : ''} — opening…`);
                      setSelectedEvents(new Set());
                      setBulkMode(false);
                      loadData();
                      // Auto-navigate to the new episode so the creator lands
                      // on its Overview tab and sees the brief, readiness,
                      // and end-of-show suggestions overlay if applicable.
                      if (ep?.id) setTimeout(() => navigate(`/episodes/${ep.id}`), 800);
                    } else {
                      setToast(res.data.error || 'Failed');
                    }
                  } catch (err) {
                    setToast('Multi-event generate failed: ' + (err.response?.data?.error || err.message));
                  }
                  setTimeout(() => setToast(null), 6000);
                }} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--lala-lavender)', color: 'var(--text-inverse)', cursor: 'pointer' }}>
                  🎬 Generate from {selectedEvents.size} event{selectedEvents.size === 1 ? '' : 's'}
                </button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Link to:</span>
              {episodes.slice(0, 6).map(ep => (
                <button key={ep.id} onClick={() => bulkInject(ep.id)} style={{ padding: '3px 10px', background: 'var(--surface-card)', border: '1px solid var(--lala-lavender-line)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {ep.episode_number}. {ep.title?.slice(0, 12) || 'Untitled'}
                </button>
              ))}
            </div>
          )}

          {/* The queue's five computed states as count chips (Task #1648,
              docs/EVENT_EPISODE_FLOW.md §8(m); Evoni's redesign, 2026-10-05):
              computeEventState is the same function the cards below use, so a
              count here always matches what's shown. A card filters; clicking
              the chosen card again shows all. */}
          <div className="wa-ev-states" role="group" aria-label="Filter by state">
            {Object.entries(EVENT_QUEUE_STATES).map(([key, cfg]) => {
              const n = scopedEvents.filter(e => computeEventState(e) === key).length;
              const on = eventStatusFilter === key;
              return (
                <button key={key} type="button" data-testid={`events-filter-${key}`} aria-pressed={on} data-zero={n === 0 || undefined}
                  className={`wa-ev-state${on ? ' active' : ''}`}
                  onClick={() => setEventStatusFilter(on ? 'all' : key)}>
                  <span className="wa-ev-state-label" style={n ? { color: cfg.color } : undefined}>{cfg.label}</span>
                  <span className="wa-ev-state-count">{n}</span>
                </button>
              );
            })}
          </div>
          {eventStatusFilter !== 'all' && (
            <div className="wa-ev-refine">
              <button type="button" className="wa-ev-show-all" data-testid="events-filter-all" onClick={() => setEventStatusFilter('all')}>
                Show all {scopedEvents.length}
              </button>
            </div>
          )}

          {/* Templates panel */}
          {showTemplates && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--success-text)' }}>📋 Event Templates — click to start from a template</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {EVENT_TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => { setEventForm({ ...EMPTY_EVENT, ...tpl }); setEditingEvent('new'); setShowTemplates(false); }}
                    style={{ textAlign: 'left', padding: '8px 12px', background: 'var(--surface-card)', border: '1px solid var(--success-border)', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{tpl.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>⭐{tpl.prestige} 🪙{tpl.cost_coins} 👗{tpl.dress_code}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event editor */}
          {editingEvent && <EventLibraryEditor lib={lib} />}

          {/* Generate-options toolbar: the draft-script opt-in is in the
              header's ⋯ menu now (Evoni, 2026-10-22 layout list). */}

          {/* Events grid — filtered + sorted, then paged (Task #2360) */}
          {(() => {
            const { page, totalPages, pageItems } = eventsView;
            // Wardrobe vs dress code conflicts show on the affected card.
            const conflictsByEvent = new Map(getDressCodeConflicts().map(c => [c.event.id, c]));
            return (
          <>
          <div ref={eventsGridRef} data-testid="events-grid" className={`wa-ev-grid${eventLayout === 'list' ? ' is-list' : ''}`}>
            {pageItems.map(ev => {
              const linkedEpisode = ev.used_in_episode_id ? episodes.find(ep => ep.id === ev.used_in_episode_id) : null;
              const isSelected = selectedEvents.has(ev.id);
              // Readiness by Event Package item (Task #1775, Evoni's gates
              // of 2026-09-24): "Missing" lists only gate items (what keeps
              // it in Needs Setup); "Still to finish" lists warning items,
              // shown but never blocking.
              const readiness = computeEventPackageReadiness(ev);
              const state = computeEventState(ev, readiness);
              const stateCfg = EVENT_QUEUE_STATES[state];
              const details = eventCardDetails(ev);
              // What is still needed, without what the card's button already asks for (Evoni, 2026-10-22 layout list).
              const missing = describeMissing(readiness.blocking).filter((m) => !(state === 'needs_organizer' && m === 'Organizer'));
              const menuOpen = openEventMenuId === ev.id;
              const openPackage = () => navigate(`/shows/${showId}/events/${ev.id}`);
              const primaryAction = () => {
                // Open Episode (a Used event) lands on Overview: it orients
                // (Evoni's ruling, 2026-09-25, Task #1905; scoped reversal
                // of #1531's Checklist landing for this caller only).
                if (state === 'used') { if (linkedEpisode) navigate(`/episodes/${linkedEpisode.id}?tab=overview`); return; }
                openPackage();
              };
              return (
              <div key={ev.id} data-testid={`event-card-${ev.id}`} className={`wa-ev-card${isSelected ? ' selected' : ''}${state === 'ready' ? ' ready' : ''}`} onClick={() => bulkMode ? toggleSelectEvent(ev.id) : openPackage()}>
                <div className="wa-ev-card-top">
                  {bulkMode && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelectEvent(ev.id)} onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, accentColor: 'var(--lala-lavender)', cursor: 'pointer' }} />
                  )}
                  <span data-testid={`event-card-status-${ev.id}`} className="wa-ev-status" style={{ color: stateCfg.color, background: stateCfg.bg }}>
                    {stateCfg.label}
                  </span>
                  {details.category && <span className="wa-ev-category">{details.category}</span>}
                  <div className="wa-ev-card-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setOpenEventMenuId(menuOpen ? null : ev.id); setStatusMenuEventId(null); }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 4 }} title="More actions" aria-label="More actions">
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen && (
                      <>
                        <div data-testid="event-menu-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => { setOpenEventMenuId(null); setStatusMenuEventId(null); }} />
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 41, minWidth: 200, overflow: 'hidden' }}>
                          <button onClick={() => { setEventDetailModal(ev); setOpenEventMenuId(null); }} style={S.menuItem}>Edit details</button>
                          <button onClick={() => { copyEvent(ev); setOpenEventMenuId(null); }} style={S.menuItem}>Duplicate as New Event</button>
                          {statusMenuEventId === ev.id ? (
                            <div style={{ borderBottom: '1px solid var(--lala-parchment-2)' }}>
                              <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Change status to…</div>
                              {STATUS_OVERRIDE_OPTIONS.map(s => (
                                <button key={s} disabled={s === ev.status} onClick={() => { changeEventStatus(ev, s); setStatusMenuEventId(null); setOpenEventMenuId(null); }}
                                  style={{ ...S.menuItem, borderBottom: 'none', paddingLeft: 24, opacity: s === ev.status ? 0.4 : 1, cursor: s === ev.status ? 'default' : 'pointer' }}>
                                  {s}{s === ev.status ? ' (current)' : ''}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button onClick={() => setStatusMenuEventId(ev.id)} style={S.menuItem}>Change status…</button>
                          )}
                          <div style={S.menuItem}><InvitationButton event={ev} showId={showId} onGenerated={() => loadData()} /></div>
                          <button onClick={() => { setOpenEventMenuId(null); setOutfitPickerEvent(ev); }} style={S.menuItem}>👗 Outfit</button>
                          {linkedEpisode && (
                            <button onClick={async () => {
                              setOpenEventMenuId(null);
                              if (!window.confirm(`Regenerate this episode? "${linkedEpisode.title || 'Untitled'}" will be soft-deleted and a fresh episode created from this event.`)) return;
                              try {
                                setToast(`🎬 Regenerating episode${draftScriptOnGenerate ? ' + script' : ''}...`);
                                const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/regenerate-episode`);
                                if (res.data.success) {
                                  if (draftScriptOnGenerate && res.data.data?.episode?.id) {
                                    try { await api.post(`/api/v1/world/${showId}/events/${ev.id}/generate-script`, { episode_id: res.data.data.episode.id }); } catch { /* non-fatal */ }
                                  }
                                  const ep = res.data.data.episode;
                                  setToast(`✅ Episode "${ep?.title}" regenerated`);
                                  loadData();
                                } else {
                                  setToast(res.data.error || 'Failed');
                                }
                              } catch (err) { setToast('Regenerate failed: ' + (err.response?.data?.error || err.message)); }
                              setTimeout(() => setToast(null), 5000);
                            }} style={S.menuItem}>♻️ Regenerate Episode</button>
                          )}
                          <button onClick={() => { setOpenEventMenuId(null); deleteEvent(ev.id); }} style={{ ...S.menuItem, color: 'var(--danger)', borderBottom: 'none' }}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="wa-ev-card-name">{ev.name}</h3>
                {/* Card to Evoni's redesign (2026-10-05; it replaces the
                    2026-09-30 card's one meta line and readiness bar): the
                    place, the deal and the organizer, what is still needed,
                    one primary button. */}
                <div className="wa-ev-card-place" data-testid={`event-card-place-${ev.id}`}>
                  {details.place.length ? details.place.join(' · ') : 'Venue and date not set'}
                </div>
                {/* The deal and the organizer as one line (they were two boxes). */}
                <p className="wa-ev-facts">
                  <span data-testid={`event-card-deal-${ev.id}`}>{details.deal.label || 'No deal type'}{details.deal.pays ? ` · ${details.deal.pays}` : ''}</span>
                  <span className="wa-ev-facts-dot" aria-hidden="true"> · </span>
                  <span data-testid={`event-card-organizer-${ev.id}`} className={details.organizer ? undefined : 'missing'}>{details.organizer ? `Organizer: ${details.organizer}` : 'No organizer'}</span>
                </p>
                {/* A used or archived event is done: nothing is still needed. */}
                {missing.length > 0 && state !== 'used' && state !== 'archived' && (
                  <p className="wa-ev-needed" data-testid={`event-card-needed-${ev.id}`}>
                    <strong>Still needed:</strong> {missing.join(', ')}
                  </p>
                )}
                {conflictsByEvent.has(ev.id) && (() => {
                  const c = conflictsByEvent.get(ev.id);
                  const detail = `Ep ${c.episode.episode_number} "${ev.name}" wants [${c.eventKeywords.join(', ')}] but the wardrobe has [${c.wardrobeKeywords.join(', ')}]`;
                  return (
                    <div className="wa-ev-card-chips">
                      <span className="wa-ev-conflict-chip" data-testid={`event-card-conflict-${ev.id}`} title={detail} aria-label={`Wardrobe conflict: ${detail}`}>
                        <AlertTriangle size={11} aria-hidden="true" /> Wardrobe conflict
                      </span>
                    </div>
                  );
                })()}
                {/* The Season page's line for this view: the slot, the goals it moves, a pencil. */}
                {cardExtra && (
                  <div className="evl-card-extra" onClick={e => e.stopPropagation()}>{cardExtra(ev)}</div>
                )}
                <div className="wa-ev-card-actions">
                  {/* A used event links both ways (Task #2356): its Event
                      Package, now read-only, beside Open Episode. */}
                  {state === 'used' && (
                    <button type="button" data-testid={`event-card-view-package-${ev.id}`}
                      onClick={e => { e.stopPropagation(); openPackage(); }}
                      className="wa-ev-btn">
                      View Event Package
                    </button>
                  )}
                  <button type="button" data-testid={`event-card-primary-${ev.id}`}
                    title={state === 'used' && linkedEpisode ? `Episode ${linkedEpisode.episode_number}: ${linkedEpisode.title || 'Untitled'}` : undefined}
                    onClick={e => { e.stopPropagation(); primaryAction(); }} className={`wa-ev-btn${state === 'ready' ? ' filled' : ''}`}>
                    {stateCfg.primaryAction} <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
              );
            })}
            {worldEvents.length > 0 && scopedEvents.length === 0 && (
              <p className="evl-scope-empty" data-testid="evl-scope-empty">{scope?.empty || 'No events here.'}</p>
            )}
            {worldEvents.length === 0 && !editingEvent && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>No events yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.5 }}>
                  Events are the story moments — parties, brand deals, collabs, drama.
                  Auto-fill generates events from your Cultural Calendar with hosts from The Pulse's people.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={async () => {
                    setAutoFilling(true);
                    setToast('🗓️ Generating events for this month...');
                    try {
                      const month = new Date().getMonth();
                      const calRes = await api.post('/api/v1/calendar/events/generate-seasonal', { month, count: 3, show_id: showId });
                      if (!calRes.data.success) throw new Error(calRes.data.error);
                      const calEvents = calRes.data.data.created || [];
                      let spawned = 0;
                      for (const ce of calEvents) {
                        try {
                          const spawnRes = await api.post(`/api/v1/calendar/events/${ce.id}/auto-spawn`, { show_id: showId, event_count: 1, max_guests: 6 });
                          if (spawnRes.data.success) spawned += spawnRes.data.data.events_created;
                        } catch { /* continue */ }
                      }
                      setToast(`✅ Created ${calRes.data.data.count} seasonal + ${spawned} world events!`);
                      loadData();
                    } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                    setAutoFilling(false);
                    setTimeout(() => setToast(null), 5000);
                  }} disabled={autoFilling} style={{ ...S.primaryBtn, padding: '10px 24px', fontSize: 14 }}>
                    {autoFilling ? '⏳ Generating...' : '🗓️ Auto-Fill This Month'}
                  </button>
                  <button onClick={openNewEvent} style={{ ...S.smBtn, padding: '10px 20px', fontSize: 13 }}>+ Create Manually</button>
                </div>
              </div>
            )}
          </div>
          {scopedEvents.length > 0 && (
            <p className="wa-ev-range" data-testid="events-range" aria-live="polite">
              {eventRangeText({ page, perPage: EVENTS_PER_PAGE, matching: visibleEvents.length, total: scopedEvents.length })}
            </p>
          )}
          {totalPages > 1 && (
            <nav className="wa-ev-pager" aria-label="Event pages" data-testid="events-pager">
              <button type="button" className="wa-ev-pager-btn" data-testid="events-page-prev"
                disabled={page <= 1} onClick={() => goToEventPage(page - 1)}>
                Previous
              </button>
              {eventPageNumbers(page, totalPages).map((n, i) => (n === 'gap' ? (
                <span key={`gap-${i}`} className="wa-ev-pager-gap" aria-hidden="true">…</span>
              ) : (
                <button key={n} type="button" data-testid={`events-page-${n}`}
                  className={`wa-ev-pager-btn wa-ev-pager-num${n === page ? ' is-current' : ''}`}
                  aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}
                  onClick={() => goToEventPage(n)}>
                  {n}
                </button>
              )))}
              <button type="button" className="wa-ev-pager-btn" data-testid="events-page-next"
                disabled={page >= totalPages} onClick={() => goToEventPage(page + 1)}>
                Next
              </button>
              <span className="wa-ev-pager-status" data-testid="events-page-status">Page {page} of {totalPages}</span>
            </nav>
          )}
          </>
            );
          })()}

          {/* Nothing sits below the queue now. The redesign (Evoni,
              2026-09-30) removed Story Logic Warnings, Wardrobe Conflicts
              (now a chip on the card), Draft Events, the Episode → Event
              map, the coverage / difficulty / budget totals and the Season
              Arc. Ideas opens as a drawer from the header (EventIdeasDrawer). */}
          {eventsIdeasOpen && <EventIdeasDrawer lib={lib} />}
        </>
      )}

      {eventDetailModal && <EventDetailsModal lib={lib} />}

      {/* ── Event Comparison Modal ── */}
      {compareEvents && compareEvents.length === 2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCompareEvents(null)}>
          <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--lala-parchment-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Compare Events</h3>
              <button onClick={() => setCompareEvents(null)} style={{ background: 'var(--lala-parchment-2)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {compareEvents.map((ev, idx) => (
                <div key={ev.id} style={{ padding: 16, borderRight: idx === 0 ? '1px solid var(--lala-parchment-2)' : 'none' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{ev.name}</h4>
                  {[
                    ['Type', ev.event_type], ['Host', ev.host || '—'], ['Prestige', ev.prestige],
                    ['Cost', ev.cost_coins], ['Strictness', ev.strictness], ['Deadline', ev.deadline_type],
                    ['Dress Code', ev.dress_code || '—'], ['Tier', ev.career_tier], ['Status', ev.status],
                    ['Difficulty', calcDifficulty(ev).toFixed(1)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid var(--surface-bg)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                    </div>
                  ))}
                  {ev.narrative_stakes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 8, lineHeight: 1.4 }}>{ev.narrative_stakes}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ OUTFIT PICKER MODAL ════════════════════════ */}
      {/* EventOutfitPicker (Task #2376): the same picker the Event Package's
          Style area opens. */}
      {outfitPickerEvent && (
        <EventOutfitPicker
          showId={showId}
          event={outfitPickerEvent}
          onClose={() => { setOutfitPickerEvent(null); setForecastNonce(n => n + 1); }}
          onSaved={() => {
            loadData();
            // Force the Financial Preview useEffect to refetch — the
            // server now has the new outfit_pieces but eventDetailModal
            // is still pointing at its open-time snapshot.
            setForecastNonce(n => n + 1);
          }}
          onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 5000); }}
        />
      )}

      {episodeBlueprint && <EpisodeBlueprintModal lib={lib} />}

      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toast && (
        // One toast for every message here (F1, Evoni, 2026-10-01): the
        // message alone, a failure in red.
        <div style={S.toastOverlay}>
          <div role="status" data-testid="wa-toast" data-tone={isFailureToast(toast) ? 'failed' : 'info'}
            style={{ ...S.toastBox, ...(isFailureToast(toast) ? S.toastBoxFailed : null) }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.3px' }}>{toast}</div>
          </div>
        </div>
      )}
    </div>
  );
}
