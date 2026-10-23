import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import useScrolledPast from '../hooks/useScrolledPast';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Compass, Sparkles, PenLine, CalendarDays, Crown, ChevronLeft, ChevronRight, ChevronDown, Clapperboard, MapPin, Calendar, Coins, MoreVertical, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { STATUS_LABEL } from '../lib/episodePipeline';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
// EpisodeOverviewTab is the default tab and the most-viewed surface — keep
// it eager so the first paint doesn't flash a Suspense fallback. Same for
// the always-mounted SceneLibraryPicker modal and the lightweight
// NextEventSuggestionsOverlay (mounts only while showNextSuggestions is
// true — the wrap transition or the header button, never on page load).
import EpisodeOverviewTab from '../components/Episodes/EpisodeOverviewTab';
import NextEventSuggestionsOverlay from '../components/Episodes/NextEventSuggestionsOverlay';
import EpisodeTitleChip from '../components/Episodes/EpisodeTitleChip';
import SceneLibraryPicker from '../components/SceneLibraryPicker';
// Lazy-loaded tab bodies — each becomes its own JS chunk that's only
// fetched when the user clicks into the tab. PhonePreviewMode is lazy
// because the player overlay only mounts when "Preview Phone" is clicked.
const EpisodeFilesTab = lazy(() => import('../components/Episodes/EpisodeFilesTab'));
const EpisodeTodoList = lazy(() => import('../components/Episodes/EpisodeTodoList'));
const EpisodeSceneWorkspace = lazy(() => import('../components/Episodes/EpisodeSceneWorkspace'));
const EpisodeProductionHeader = lazy(() => import('../components/Episodes/EpisodeProductionHeader'));
const EpisodeLalasPhoneTab = lazy(() => import('../components/Episodes/EpisodeLalasPhoneTab'));
const EpisodeStylePage = lazy(() => import('../components/Episodes/EpisodeStylePage'));
const EpisodeScriptTab = lazy(() => import('../components/Episodes/EpisodeScriptTab'));
const EpisodeDistributionTab = lazy(() => import('../components/Episodes/EpisodeDistributionTab'));
const EpisodeWardrobeGameplay = lazy(() => import('../components/EpisodeWardrobeGameplay'));
const EpisodeProductionChecklist = lazy(() => import('../components/Episodes/EpisodeProductionChecklist'));
const EpisodeScenesTab = lazy(() => import('../components/Episodes/EpisodeScenesTab'));
const EpisodeMoneyTab = lazy(() => import('../components/Episodes/EpisodeMoneyTab'));
const EpisodeOverlaysTab = lazy(() => import('../components/Episodes/EpisodeOverlaysTab'));
const EpisodeResultsSummary = lazy(() => import('../components/Episodes/EpisodeResultsSummary'));
const EpisodeResultsStory = lazy(() => import('../components/Episodes/EpisodeResultsPages').then((m) => ({ default: m.EpisodeResultsStory })));
const PhonePreviewMode = lazy(() => import('../components/PhonePreviewMode'));
import usePhonePlayback from '../hooks/usePhonePlayback';
import api from '../services/api';
import { fetchAllEpisodes } from '../lib/fetchAllPages';
import { getEpisodeEvents } from '../services/episodeEventsApi';
import { EP_TABS, resolveEpisodeTab, withEpisodeTab, pillGroups, pillFor } from '../utils/episodeTabs';
import { closetBeat } from '../lib/scriptMoments';
import { checklistProgress, coinsLabel } from '../lib/episodeShell';
import { isScreen } from '../lib/overlayUtils';
import { beatOrder } from '../lib/storyClock';
import './EpisodeDetail.css';

// Track 6 CP14 module-scope helpers — page structural shape; partial-
// migration extension per v2.20 §9.11 (file already partial-migrated
// at lines 776+805 with `api.post` calls, untouched by CP14). File-local
// `api.` import style preserved.
//
// Cross-CP duplications per v2.12 §9.11:
// - listWorldEventsApi: CP13 WorldAdmin + CP14 = 2-fold cross-CP existence
//   (and service-module precedence — 7+ component consumers across the
//   wider codebase)
//
// Helper-reuse density: 6 helpers cover 10 sites.
// - listEpisodeLibraryScenesApi reused 4× (mount + 3 reload-after-mutation)
// - reorderEpisodeLibrarySceneApi reused 2× (Promise.all pair on drag-reorder)
// The main tabs' icons (Evoni's Episode mock, 2026-10-05).
const TAB_ICONS = { overview: Sparkles, scripts: PenLine, production: CalendarDays, results: Crown };

export const listEpisodeLibraryScenesApi = (epId) =>
  api.get(`/api/v1/episodes/${epId}/library-scenes`).then((r) => r.data);
// The show's episodes in order, for the header's previous/next switcher.
// Paged, 100 at a time: the server refuses a limit over 100.
export const listShowEpisodesApi = (showId) =>
  fetchAllEpisodes(api, showId, { sort: 'episode_number:ASC' }).then((r) => r.items);
export const listWorldEventsApi = (showId) =>
  api.get(`/api/v1/world/${showId}/events`).then((r) => r.data);
// Lala's ledger balance for the header chip: the same /balance the Dashboard
// reads (Episode Money Phase A, #2278).
export const getShowBalanceApi = async (showId) => {
  const r = await api.get(`/api/v1/world/${showId}/balance`);
  return r?.data?.balance ?? null;
};
export const getCharacterStateApi = (charKey, showId) =>
  api.get(`/api/v1/characters/${charKey}/state?show_id=${showId}`).then((r) => r.data);
export const addEpisodeLibrarySceneApi = (epId, payload) =>
  api.post(`/api/v1/episodes/${epId}/library-scenes`, payload).then((r) => r.data);
export const reorderEpisodeLibrarySceneApi = (epId, sceneId, payload) =>
  api.put(`/api/v1/episodes/${epId}/library-scenes/${sceneId}`, payload);
export const removeEpisodeLibrarySceneApi = (epId, sceneId) =>
  api.delete(`/api/v1/episodes/${epId}/library-scenes/${sceneId}`);

// A script the Script tab saved, merged into the episode the page holds. A
// save, a lock or a Regenerate can land after the page has moved to another
// episode (Script page audit, 2026-10-19: episode A's new script was merged
// into episode B), so a report for another episode is ignored.
export function withSavedScript(prev, fields) {
  if (!prev || !fields) return prev;
  const { id, ...rest } = fields;
  if (id !== undefined && id !== prev.id) return prev;
  return { ...prev, ...rest };
}

// The header's dates read like the mockup's "Nov 12, 2026". A date-only
// value ("2026-11-12") is a calendar day, so it is read in UTC and never
// shifts a day with the viewer's time zone.
export function formatShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(dateOnly ? { timeZone: 'UTC' } : {}) });
}

const EpisodeDetail = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sceneView, setSceneView] = useState('composer');
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [episodeScenes, setEpisodeScenes] = useState([]);

  // Play-on-Phone is its own self-contained feature; the hook owns all
  // state (screens, missions, frame settings, server-backed playthrough)
  // and exposes a single start() that fetches lazily on the first click.
  const phone = usePhonePlayback(episode);

  // The tab is the URL (audit LINK-04, 2026-10-03): ?tab= resolved by one
  // parser (utils/episodeTabs) for clicks, shortcuts, deep links and
  // Back/Forward alike, so no path can leave a main tab with another tab's
  // sub-tab. tabKey is `main` for a tab without sub-tabs, `main.sub`
  // otherwise; each tab body checks one equality.
  const tabParam = searchParams.get('tab');
  const { main: activeTab, sub: epSubTab, key: tabKey } = useMemo(() => resolveEpisodeTab(tabParam), [tabParam]);
  // The one tab transition: any tab or sub-tab by its URL key, keeping the
  // page's other parameters.
  // Leaving the Script tab with unsaved edits asks first: the tab unmounts,
  // and its edits go with it. The Script tab reports whether it has any.
  const scriptDirtyRef = useRef(false);
  const handleScriptDirty = useCallback((dirty) => { scriptDirtyRef.current = dirty; }, []);
  // Leaving the page by a button asks as a tab change does (re-audit 2:
  // "Back to Show" and "Edit Episode" left with no word).
  const leaveTo = useCallback((to) => {
    if (scriptDirtyRef.current && !window.confirm('The script has unsaved changes. Leave without saving?')) return;
    navigate(to);
  }, [navigate]);
  const openTab = useCallback((tab) => {
    if (scriptDirtyRef.current && tab !== 'scripts'
      && !window.confirm('The script has unsaved changes. Leave without saving?')) return;
    setSearchParams((prev) => withEpisodeTab(prev, tab));
  }, [setSearchParams]);
  // A save on the Script tab updates the episode the page holds, so coming
  // back to the tab (or the Wardrobe tab's closet beat) reads the saved script.
  const handleScriptSaved = useCallback((fields) => {
    setEpisode((prev) => withSavedScript(prev, fields));
  }, []);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            openTab('overview');
            break;
          case '2':
            e.preventDefault();
            openTab('wardrobe');
            break;
          case '3':
            e.preventDefault();
            openTab('scripts');
            break;
          case 's':
            // On the Script tab, Ctrl/Cmd+S is the tab's own Save.
            if (tabKey === 'scripts') break;
            e.preventDefault();
            openTab('scenes');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [openTab, tabKey]);

  // The header's balance chip (§8(aa) M1): Lala's ledger balance, from the
  // same /balance the Dashboard reads. It opens Production → Money.
  const [headerBalance, setHeaderBalance] = useState(null);
  // A balance that could not be read says so on the chip (Evoni, 2026-10-07;
  // the chip used to vanish).
  const [balanceFailed, setBalanceFailed] = useState(false);
  // Bumped by the wardrobe game after a purchase or a paid lock, so the chip
  // follows the balance (Evoni, 2026-10-05: it kept the old number).
  const [balanceVersion, setBalanceVersion] = useState(0);
  const bumpBalance = useCallback(() => setBalanceVersion((v) => v + 1), []);
  const chipShowId = episode?.show_id || episode?.showId;
  useEffect(() => {
    if (!chipShowId) return undefined;
    let cancelled = false;
    getShowBalanceApi(chipShowId)
      .then((balance) => { if (!cancelled) { setHeaderBalance(balance); setBalanceFailed(false); } })
      .catch((err) => {
        console.error('[EpisodeDetail] balance load failed:', err);
        if (!cancelled) setBalanceFailed(true);
      });
    return () => { cancelled = true; };
  }, [chipShowId, balanceVersion]);
  const openMoneyTab = () => openTab('money');
  // P15: the banner's title chip opens Production → Overlays; the tab bumps
  // overlaysVersion after an action so the chip reloads.
  const [overlaysVersion, setOverlaysVersion] = useState(0);
  const bumpOverlays = useCallback(() => setOverlaysVersion((v) => v + 1), []);
  const openOverlaysTab = () => openTab('overlays');

  // The Production tab's "N left" badge (Evoni's Episode mock): the open
  // production checks, read the way the checklist reads them. The checklist
  // reports again after each of its re-checks, so the badge follows it.
  // The Overview's Production checklist tile reads the same progress.
  const [checksProgress, setChecksProgress] = useState(null);
  // The checks themselves, for Production's step bar and progress card.
  const [productionChecks, setProductionChecks] = useState({ checks: null, sections: null });
  const checksLeft = checksProgress?.left ?? null;
  const reportChecks = useCallback((checks, sections) => {
    setChecksProgress(checklistProgress(checks, sections));
    setProductionChecks({ checks, sections });
  }, []);
  const checksEpisodeId = episode?.id;
  useEffect(() => {
    if (!checksEpisodeId || !episode) return undefined;
    let cancelled = false;
    import('../components/Episodes/EpisodeProductionChecklist')
      .then((m) => m.loadProductionChecks(episode, episode.show_id || episode.showId)
        .then(({ checks }) => {
          if (cancelled) return;
          setChecksProgress(checklistProgress(checks, m.CHECKLIST_SECTIONS));
          setProductionChecks({ checks, sections: m.CHECKLIST_SECTIONS });
        }))
      .catch((err) => { console.error('[EpisodeDetail] production checks load failed:', err); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checksEpisodeId]);

  const [showMoreActions, setShowMoreActions] = useState(false);
  // The header's ⋮ menu closes on Escape (focus back on the ⋮) and on a
  // click or tap anywhere else (Script page audit 4, 2026-10-19: it stayed
  // open over the page).
  const moreMenuRef = useRef(null);
  useEffect(() => {
    if (!showMoreActions) return undefined;
    const away = (e) => { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setShowMoreActions(false); };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      setShowMoreActions(false);
      moreMenuRef.current?.querySelector('.ed-btn-more')?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [showMoreActions]);
  // A cover whose image would not load falls back to the placeholder.
  const [failedCover, setFailedCover] = useState(null);
  // { episodeId, events, failed? } — the Wardrobe's events and the episode
  // they were read for (Task #3107); null until the first read.
  const [episodeEvents, setEpisodeEvents] = useState(null);
  // The source event, for the header's link back to its Event Package
  // (Task #2356): the brief's event (episode_briefs.event_id, §8(w) P2),
  // which GET /episodes/:id/events returns first, flagged link.anchor.
  const [sourceEvent, setSourceEvent] = useState(null);
  // Evoni, 2026-10-06: the banner flickered between full and compact while
  // scrolling. Compacting made the header shorter (and it animates its
  // height), the content moved up, and the scroll fell back under the one
  // threshold, so it expanded again. Now it compacts past 120px and expands
  // only above 60px, and a spacer under it holds the rest of the full
  // header's height on every frame of the animation, so the header and the
  // spacer always measure the full height and nothing below them moves.
  // The spacer is sized straight on the element, with no re-render while
  // scrolling. EpisodeDetail.css turns scroll anchoring off on the page.
  const headerCompact = useScrolledPast(120, 60);
  const headerRef = useRef(null);
  const spacerRef = useRef(null);
  const headerCompactRef = useRef(headerCompact);
  headerCompactRef.current = headerCompact;
  const headerEpisodeId = episode?.id;
  useEffect(() => {
    const el = headerRef.current;
    const spacer = spacerRef.current;
    if (!el || !spacer || typeof ResizeObserver === 'undefined') return undefined;
    // The full header's height, read while it is full and settled: its
    // padding and title size animate for 0.3s (`transition: all 0.3s`) after
    // each switch, so heights inside that window are not the full one.
    const SETTLE_MS = 400;
    // The page's scroller keeps what it brings into view, and what Tab
    // reaches, below the compact header: its scroll-padding-top is the
    // header's height (Script page audit 4, 2026-10-19: a chosen beat's name
    // and arrows sat under it).
    let scroller = null;
    for (let n = el.parentElement; n && !scroller; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') scroller = n;
    }
    if (!scroller) scroller = document.scrollingElement || document.documentElement;
    let full = 0;
    let wasCompact = headerCompactRef.current;
    let switchedAt = 0;
    const sync = () => {
      const compact = headerCompactRef.current;
      if (compact !== wasCompact) { wasCompact = compact; switchedAt = performance.now(); }
      const h = el.offsetHeight;
      // The tabs stick under the header on a phone (Evoni, 2026-10-22 layout list).
      el.parentElement?.style.setProperty('--ed-head-h', `${h}px`);
      if (!compact && performance.now() - switchedAt > SETTLE_MS) full = h;
      spacer.style.height = `${Math.max(0, full - h)}px`;
      scroller.style.scrollPaddingTop = compact ? `${h + 12}px` : '';
    };
    const onEnd = (e) => { if (e.target === el) sync(); };
    el.addEventListener('transitionend', onEnd);
    const ro = new ResizeObserver(sync);
    ro.observe(el, { box: 'border-box' });
    sync();
    return () => {
      ro.disconnect();
      el.removeEventListener('transitionend', onEnd);
      scroller.style.scrollPaddingTop = '';
    };
  }, [headerEpisodeId]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Only this episode's events, never a list (or a choice) left from the
  // episode shown before; null while this episode's read is in flight.
  const wardrobeEvents = episodeEvents?.episodeId === episodeId ? episodeEvents.events : null;
  const wardrobeEvent = wardrobeEvents?.find((ev) => ev.id === selectedEvent?.id) || null;
  const [characterState, setCharacterState] = useState({});

  // Fetch episode data - extracted for reuse
  // Only the latest load answers (Script page re-audit, 2026-10-19): Back
  // pressed while episode B was loading left B, answering late, on the page
  // under episode A's URL, and the Script tab saved into B.
  const loadSeqRef = useRef(0);
  const fetchEpisode = useCallback(async () => {
    loadSeqRef.current += 1;
    const seq = loadSeqRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await episodeService.getEpisode(episodeId);
      if (seq !== loadSeqRef.current) return;
      setEpisode(data);
    } catch (err) {
      console.error('[EpisodeDetail] episode load failed:', err);
      if (seq !== loadSeqRef.current) return;
      const msg = err.message || '';
      if (msg.includes('Not Found') || msg.includes('404')) {
        toast.showError('Episode not found — it may have been deleted.');
        navigate('/shows', { replace: true });
        return;
      }
      setError(msg || 'Failed to load episode');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [episodeId, navigate, toast]);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Episode loading
  useEffect(() => {
    if (episodeId) {
      fetchEpisode();
    }
  }, [episodeId, fetchEpisode]);

  // Set this as the "working episode" for Studio tools (Timeline, Scene Composer)
  useEffect(() => {
    if (episodeId && episode) {
      localStorage.setItem('working-episode-id', episodeId);
      localStorage.setItem('working-episode-title', episode.title || episode.episodeTitle || 'Untitled');
    }
  }, [episodeId, episode]);

  // ── End-of-show suggestions overlay ──────────────────────────────────────
  // Auto-opens only on the WRAP TRANSITION — evaluation_status going to
  // 'accepted' while this page stays mounted — never on page load or the
  // initial episode fetch, even for an already-accepted episode.
  //
  // There is no "complete"/"wrapped" value in the Episode model's own
  // `status` string (src/models/Episode.js:41 — free string, default
  // 'draft'; the only enumerated values in use are draft/published/
  // archived, per src/services/FilterService.js:47). `evaluation_status`
  // is a separate field with exactly two literal values in use codebase-
  // wide (src/routes/evaluation.js:382, src/services/episodeCompletionService.js:440,
  // src/services/seasonRhythmValidator.js:61/309, src/routes/seasonRhythmRoutes.js:76):
  // 'computed' — POST .../evaluate scores the episode but does NOT wrap it,
  // it's a preview the creator can still send through POST .../override
  // before accepting — and 'accepted', set only once stat deltas are
  // applied and financials are finalized (episodeCompletionService.js's
  // completeEpisode, which POST .../accept itself proxies to and which
  // guards on `evaluation_status === 'accepted'` to refuse re-accepting).
  // seasonRhythmValidator.js:6/57 independently documents the same
  // reading: "evaluation_status = 'accepted' means stat changes have been
  // applied." `evaluation_json` going non-null is NOT the same signal — it
  // is set at the 'computed' stage too, before any accept — so watching it
  // alone would open this modal while the creator is still adjusting
  // overrides, not only once the episode has actually wrapped.
  const [showNextSuggestions, setShowNextSuggestions] = useState(false);
  const prevEvaluationRef = useRef(null); // { episodeId, wasAccepted } | null
  useEffect(() => {
    if (!episode?.id) return;
    const isAccepted = episode?.evaluation_status === 'accepted';
    const prev = prevEvaluationRef.current;
    const sameEpisode = !!prev && prev.episodeId === episode.id;

    if (sameEpisode && !prev.wasAccepted && isAccepted) {
      let alreadyShown = false;
      try {
        alreadyShown = localStorage.getItem(`primeStudios.whatsNext.shown.${episode.id}`) === '1';
      } catch (err) {
        console.error('Failed to read What\'s next shown flag:', err);
      }
      if (!alreadyShown) setShowNextSuggestions(true);
    }

    prevEvaluationRef.current = { episodeId: episode.id, wasAccepted: isAccepted };
  }, [episode?.id, episode?.evaluation_status]);

  // Handle episode updates from Overview tab
  // The header's previous/next switcher: the show's episodes by number.
  const [showEpisodes, setShowEpisodes] = useState([]);
  const switchShowId = episode?.show_id || episode?.showId;
  useEffect(() => {
    if (!switchShowId) return undefined;
    let cancelled = false;
    // Through a promise, so a failure of any kind lands in the catch.
    Promise.resolve().then(() => listShowEpisodesApi(switchShowId))
      .then((list) => {
        if (cancelled) return;
        const num = (e) => Number(e.episode_number ?? e.episodeNumber ?? Infinity);
        setShowEpisodes([...(Array.isArray(list) ? list : [])].sort((a, b) => num(a) - num(b)));
      })
      .catch((err) => { console.error('[EpisodeDetail] show episodes load failed:', err); if (!cancelled) setShowEpisodes([]); });
    return () => { cancelled = true; };
  }, [switchShowId]);
  const episodeIndex = showEpisodes.findIndex((e) => e.id === episode?.id);
  const prevEpisode = episodeIndex > 0 ? showEpisodes[episodeIndex - 1] : null;
  const nextEpisode = episodeIndex >= 0 && episodeIndex < showEpisodes.length - 1 ? showEpisodes[episodeIndex + 1] : null;
  // Same tab on the other episode; unsaved script edits ask first.
  const goToEpisode = (ep) => {
    if (!ep) return;
    leaveTo(`/episodes/${ep.id}${tabParam ? `?tab=${encodeURIComponent(tabParam)}` : ''}`);
  };

  // The header's status dropdown: the pipeline's statuses (lib/episodePipeline),
  // plus the episode's own when it is something else, so nothing is lost.
  const [statusSaving, setStatusSaving] = useState(false);
  const changeStatus = async (next) => {
    const prev = episode.status;
    if (!next || next === prev) return;
    setStatusSaving(true);
    setEpisode((e) => ({ ...e, status: next }));
    try {
      await episodeService.updateEpisode(episode.id, { status: next });
      setShowEpisodes((list) => list.map((e) => (e.id === episode.id ? { ...e, status: next } : e)));
      toast?.showSuccess?.(`Status: ${STATUS_LABEL[next] || next}`);
    } catch (err) {
      console.error('Error updating episode status:', err);
      setEpisode((e) => ({ ...e, status: prev }));
      toast?.showError?.('The status could not be saved.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleUpdateEpisode = async (updates) => {
    try {
      await episodeService.updateEpisode(episode.id, updates);
      // Refresh episode data
      await fetchEpisode();
    } catch (error) {
      console.error('Error updating episode:', error);
      throw error;
    }
  };

  // Load episode scenes — only fires when the user opens the Scenes sub-tab.
  useEffect(() => {
    const fetchEpisodeScenes = async () => {
      if (!episodeId || activeTab !== 'scenes') return;
      try {
        const data = await listEpisodeLibraryScenesApi(episodeId);
        setEpisodeScenes(data.data || []);
      } catch (err) {
        console.error('Failed to load episode scenes:', err);
        toast.showError('Failed to load scenes');
      }
    };

    fetchEpisodeScenes();
  }, [episodeId, activeTab, toast]);

  // Load events + character state for wardrobe gameplay. Gated on the
  // Production → Wardrobe sub-tab: since #534 resolveEpisodeTab maps `wardrobe`
  // to activeTab 'production' / sub 'wardrobe', so the old
  // `activeTab !== 'wardrobe'` gate never let this run (Task #1906).
  useEffect(() => {
    if (!episode || tabKey !== 'production.wardrobe') return;
    const showId = episode.show_id || episode.showId;
    if (!showId) return;

    // The episode's own events — anchor from the brief first, then any
    // additional linked events. No scan of the show's event list.
    // Task #3107: the page stays mounted from one episode to the next, and
    // the old `!selectedEvent` check kept the previous episode's event. The
    // list now belongs to one episode id; the choice survives a reload of the
    // same episode when its event is still linked, else it is the anchor (the
    // banner's "From event"); a late reply for another episode is dropped.
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        const data = await getEpisodeEvents(episodeId);
        if (cancelled) return;
        const linked = data?.events || [];
        setEpisodeEvents({ episodeId, events: linked });
        setSelectedEvent((prev) => linked.find((ev) => ev.id === prev?.id)
          || linked.find((ev) => ev.link?.anchor) || linked[0] || null);
      } catch (err) {
        console.error('Failed to load episode events:', err);
        if (!cancelled) {
          setEpisodeEvents({ episodeId, events: [], failed: true });
          setSelectedEvent(null);
        }
      }
    };

    // Fetch Lala's character state
    const fetchCharState = async () => {
      try {
        const data = await getCharacterStateApi('lala', showId);
        setCharacterState(data.state || {});
      } catch (err) {
        console.error('Failed to load character state:', err);
      }
    };

    fetchEvents();
    fetchCharState();
    return () => { cancelled = true; };
  }, [episode, tabKey, episodeId]);

  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    // A new episode drops the last one's link until its own arrives (Task #3107).
    setSourceEvent(null);
    // Optional header detail: any failure, synchronous or not, leaves the
    // link off and never breaks the page.
    const loadSourceEvent = async () => {
      try {
        const data = await getEpisodeEvents(episodeId);
        if (cancelled) return;
        const events = data?.events || [];
        setSourceEvent(events.find((ev) => ev.link?.anchor) || null);
      } catch (err) {
        console.error('Failed to load the source event:', err);
        if (!cancelled) setSourceEvent(null);
      }
    };
    loadSourceEvent();
    return () => { cancelled = true; };
  }, [episodeId]);

  // Handle scene selection from library
  const handleSceneSelect = async (libraryScene) => {
    try {
      await addEpisodeLibrarySceneApi(episodeId, {
        sceneLibraryId: libraryScene.id,
        trimStart: 0,
        trimEnd: libraryScene.durationSeconds || libraryScene.duration_seconds,
      });
      // Reload scenes
      const scenesData = await listEpisodeLibraryScenesApi(episodeId);
      setEpisodeScenes(scenesData.data || []);
    } catch (err) {
      console.error('Failed to add scene to episode:', err);
      alert('Failed to add scene. Please try again.');
    }
  };

  // Reorder scenes
  const handleReorderScene = async (index, direction) => {
    const newScenes = [...episodeScenes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newScenes.length) return;

    // Swap scenes
    [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]];

    // Update scene_order for both scenes
    try {
      await Promise.all([
        reorderEpisodeLibrarySceneApi(episodeId, newScenes[index].id, { sceneOrder: index + 1 }),
        reorderEpisodeLibrarySceneApi(episodeId, newScenes[targetIndex].id, { sceneOrder: targetIndex + 1 }),
      ]);

      // Reload scenes
      const scenesData = await listEpisodeLibraryScenesApi(episodeId);
      setEpisodeScenes(scenesData.data || []);
    } catch (err) {
      console.error('Failed to reorder scenes:', err);
      alert('Failed to reorder scenes. Please try again.');
    }
  };

  // Remove scene from episode
  const handleRemoveScene = async (sceneId) => {
    if (!confirm('Remove this scene from the episode?')) return;

    try {
      await removeEpisodeLibrarySceneApi(episodeId, sceneId);
      // Reload scenes
      const scenesData = await listEpisodeLibraryScenesApi(episodeId);
      setEpisodeScenes(scenesData.data || []);
    } catch (err) {
      console.error('Failed to remove scene:', err);
      alert('Failed to remove scene. Please try again.');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      published: 'green',
      pending: 'yellow',
      archived: 'red'
    };
    return colors[status?.toLowerCase()] || 'gray';
  };

  // Determine the primary next action
  const getPrimaryNextAction = () => {
    if (episodeScenes.length === 0) {
      return {
        title: 'Add your first scene',
        description: 'Start building your episode by adding scenes from the library',
        action: () => openTab('scenes'),
        buttonText: 'Go to Scenes'
      };
    }
    // Removed: "Create a thumbnail" next action — opened the thumbnail workspace, which does not exist (docs/THUMBNAIL_SYSTEM.md).
    if (episode.wardrobeCount === 0) {
      return {
        title: 'Add wardrobe items',
        description: 'Configure wardrobe items for your characters',
        action: () => openTab('wardrobe'),
        buttonText: 'Go to Wardrobe'
      };
    }
    if (episode.status !== 'published') {
      return {
        title: 'Publish your episode',
        description: 'Everything looks good! Ready to publish?',
        action: () => leaveTo(`/episodes/${episode.id}/edit`),
        buttonText: 'Update Status'
      };
    }
    return null;
  };

  // Get remaining steps (not the primary one)
  const getOtherSteps = () => {
    const steps = [];
    const primaryAction = getPrimaryNextAction();
    
    if (episodeScenes.length === 0 && primaryAction?.title !== 'Add your first scene') {
      steps.push({ title: 'Add Scenes', status: 'pending', action: () => openTab('scenes') });
    } else if (episodeScenes.length > 0) {
      steps.push({ title: 'Add Scenes', status: 'complete', count: episodeScenes.length });
    }
    
    if (!episode.thumbnailUrl && !episode.thumbnail_url) {
      // Removed action: opened the thumbnail workspace, which does not exist (docs/THUMBNAIL_SYSTEM.md).
      steps.push({ title: 'Create Thumbnail', status: 'pending' });
    } else if (episode.thumbnailUrl || episode.thumbnail_url) {
      steps.push({ title: 'Create Thumbnail', status: 'complete' });
    }
    
    if (episode.wardrobeCount === 0 && primaryAction?.title !== 'Add wardrobe items') {
      steps.push({ title: 'Add Wardrobe', status: 'pending', action: () => openTab('wardrobe') });
    } else if (episode.wardrobeCount > 0) {
      steps.push({ title: 'Add Wardrobe', status: 'complete', count: episode.wardrobeCount });
    }
    
    if (episode.status !== 'published' && primaryAction?.title !== 'Publish your episode') {
      steps.push({ title: 'Publish Episode', status: 'pending', action: () => leaveTo(`/episodes/${episode.id}/edit`) });
    } else if (episode.status === 'published') {
      steps.push({ title: 'Publish Episode', status: 'complete' });
    }
    
    return steps;
  };

  // The page's spinner is for the first load only: a refetch (a saved
  // edit) keeps the open tab mounted instead of blanking it.
  if (authLoading || (loading && (!episode || String(episode.id) !== String(episodeId)))) {
    return (
      <div className="ed-page ed-studio">
        <div className="ed-state">
          <div className="ed-spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="ed-page ed-studio">
        <div className="ed-state ed-state-error">
          <span className="ed-error-icon">⚠️</span>
          <h2>Episode Not Found</h2>
          <p>{error || 'The episode you\'re looking for doesn\'t exist.'}</p>
          <button onClick={() => navigate(episode?.show_id ? `/shows/${episode.show_id}` : '/episodes')} className="ed-btn ed-btn-primary">
            ← Back to Show
          </button>
        </div>
      </div>
    );
  }

  // The header's pieces (Evoni's studio mockup, 2026-10-19): only what the
  // page already reads. The cover is the episode's thumbnail, else its source
  // event's scene still; the location and date come from that event when the
  // episode has no air date of its own.
  const episodeTitle = episode.title || episode.episodeTitle || 'Untitled Episode';
  const episodeNumber = episode.episode_number || episode.episodeNumber;
  const showIdForLinks = episode.show_id || episode.showId;
  const coverUrl = episode.thumbnail_url || episode.thumbnailUrl || sourceEvent?.sceneSet?.base_still_url || null;
  const showCover = !!coverUrl && coverUrl !== failedCover;
  const description = episode.description || episode.teaser || '';
  const eventPlace = sourceEvent ? (sourceEvent.venue_name || sourceEvent.host_brand || sourceEvent.host || '') : '';
  const heroDate = episode.air_date
    ? { label: 'Air date', value: formatShortDate(episode.air_date) }
    : sourceEvent?.event_date ? { label: 'Event date', value: formatShortDate(sourceEvent.event_date) } : null;
  // A link that leaves the page asks first while the script has unsaved edits.
  const guardLeave = (e) => {
    if (scriptDirtyRef.current && !window.confirm('The script has unsaved changes. Leave without saving?')) e.preventDefault();
  };

  return (
    <div className="ed-page ed-studio">
      {/* The studio header (Evoni's mockup, 2026-10-19): the breadcrumb, then
          the hero card: cover, show, title, meta, description, and the
          status, previous/next and actions at the top right. */}
      {/* S9 (b): collapses to the title and navigation while scrolling. */}
      <div ref={headerRef} className={`ed-header-new${headerCompact ? ' is-compact' : ''}`} data-testid="ed-header">
        <nav className="eds-crumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/" onClick={guardLeave}>Home</Link></li>
            <li aria-hidden="true" className="eds-crumb-sep"><ChevronRight size={14} /></li>
            {/* The show's page lists its episodes; it was "← Back to Show". */}
            {/* The way back stays in the compact header (Script page audit 4, 2026-10-19). */}
            <li className="eds-crumb-episodes">
              <Link to={showIdForLinks ? `/shows/${showIdForLinks}` : '/episodes'} onClick={guardLeave}
                className="ed-back-btn" title="Back to Show">Episodes</Link>
            </li>
            <li aria-hidden="true" className="eds-crumb-sep"><ChevronRight size={14} /></li>
            <li><span aria-current="page" className="eds-crumb-current">{episodeTitle}</span></li>
          </ol>
        </nav>

        {/* The slimmer header (Evoni, 2026-10-22 layout list): the episode
            number once, in the meta line; the cover only once there is a
            picture, and small. */}
        <div className={`eds-hero${showCover ? ' has-cover' : ''}`}>
          {showCover && (
            <div className="eds-cover" data-testid="ed-cover">
              <img src={coverUrl} alt="" loading="lazy" onError={() => setFailedCover(coverUrl)} />
            </div>
          )}

          <div className="eds-hero-body">
            {episode.show?.name && (
              <Link to={`/shows/${episode.show.id}`} className="eds-show-pill" data-testid="ed-show-pill"
                onClick={(e) => { e.stopPropagation(); guardLeave(e); }}>
                {episode.show.name}
              </Link>
            )}
            <h1 className="ed-header-title eds-title">{episodeTitle}</h1>
            <ul className="eds-meta" aria-label="Episode details">
              {episodeNumber && (
                <li className="eds-meta-item"><Clapperboard size={16} aria-hidden="true" /><span>Episode {episodeNumber}</span></li>
              )}
              {/* Task #2356: the link back to the Event Package the episode
                  was started from, with the event's venue. */}
              {sourceEvent && (sourceEvent.show_id || showIdForLinks) && (
                <li className="eds-meta-item">
                  <Link
                    to={`/shows/${sourceEvent.show_id || showIdForLinks}/events/${sourceEvent.id}`}
                    className="ed-source-event-link"
                    data-testid="ed-source-event"
                    title="Open the Event Package this episode was started from"
                  >
                    <MapPin size={16} aria-hidden="true" />
                    <span className="ed-visually-hidden">From event: </span>
                    <span className="ed-source-event-name">{sourceEvent.name || 'Event'}</span>
                    {eventPlace && eventPlace !== sourceEvent.name && <span className="eds-meta-sub">· {eventPlace}</span>}
                  </Link>
                </li>
              )}
              {heroDate && (
                <li className="eds-meta-item" title={heroDate.label}>
                  <Calendar size={16} aria-hidden="true" />
                  <span className="ed-visually-hidden">{heroDate.label}: </span>
                  <span>{heroDate.value}</span>
                </li>
              )}
            </ul>
            {description && <p className="eds-description">{description}</p>}
            {/* P15: the title's status; opens Production → Overlays. */}
            <EpisodeTitleChip
              episodeId={episode.id}
              title={episode.title}
              version={overlaysVersion}
              onOpen={openOverlaysTab}
            />
          </div>

          <div className="eds-hero-side">
            <div className="eds-nav-row">
              {/* The previous/next switcher around the status (the mockup's "‹ Draft ▾ ›"). */}
              <div className="eds-nav" {...(episodeNumber ? { 'data-testid': 'ed-ep-switch' } : {})}>
                {episodeNumber && (
                  <button type="button" className="ed-ep-step" disabled={!prevEpisode}
                    onClick={() => goToEpisode(prevEpisode)}
                    aria-label={prevEpisode ? `Previous episode: ${prevEpisode.episode_number ?? ''} ${prevEpisode.title || ''}`.trim() : 'No previous episode'}
                    title={prevEpisode ? `Episode ${prevEpisode.episode_number ?? '?'}: ${prevEpisode.title || 'Untitled'}` : undefined}>
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                )}
                <label className={`ed-status-select ed-status-${episode.status?.toLowerCase() || 'draft'}`}>
                  <span className="ed-visually-hidden">Status</span>
                  <select data-testid="ed-status" value={episode.status || 'draft'} disabled={statusSaving}
                    onChange={(e) => changeStatus(e.target.value)} aria-label="Episode status">
                    {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    {episode.status && !STATUS_LABEL[episode.status] && <option value={episode.status}>{episode.status}</option>}
                  </select>
                  <ChevronDown size={16} className="eds-select-caret" aria-hidden="true" />
                </label>
                {episodeNumber && (
                  <button type="button" className="ed-ep-step" disabled={!nextEpisode}
                    onClick={() => goToEpisode(nextEpisode)}
                    aria-label={nextEpisode ? `Next episode: ${nextEpisode.episode_number ?? ''} ${nextEpisode.title || ''}`.trim() : 'No next episode'}
                    title={nextEpisode ? `Episode ${nextEpisode.episode_number ?? '?'}: ${nextEpisode.title || 'Untitled'}` : undefined}>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div className="eds-chip-row">
              <span className="ed-working-badge" title="Studio tools (Timeline, Scene Composer) will open this episode">
                Working Episode
              </span>
              {(headerBalance !== null || balanceFailed) && (
                <button
                  type="button"
                  className="ed-balance-chip"
                  onClick={openMoneyTab}
                  title={balanceFailed ? "Lala's balance couldn't be read. Open this episode's money." : "Lala's balance. Open this episode's money."}
                  data-testid="ed-balance-chip"
                >
                  <Coins size={14} aria-hidden="true" />
                  {balanceFailed && headerBalance === null ? 'Coins unavailable' : coinsLabel(headerBalance)}
                </button>
              )}
              <div className="ed-more-menu" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className="ed-btn-more"
                  aria-label="More actions"
                  aria-expanded={showMoreActions}
                >
                  <MoreVertical size={18} aria-hidden="true" />
                </button>
                {showMoreActions && (
                  <div className="ed-dropdown">
                    <button
                      onClick={() => {
                        leaveTo(`/episodes/${episode.id}/edit`);
                        setShowMoreActions(false);
                      }}
                      className="ed-dropdown-item"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      <span>Edit Episode</span>
                    </button>
                    {/* Create Thumbnail relocated to the Assets area, Scene
                        Planner relocated to the Scenes sub-tab (which already
                        had its own copy — issue #1601). The ⋯ menu now carries
                        only administrative actions. */}
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete this episode? This cannot be undone.')) {
                          try {
                            await episodeService.deleteEpisode(episode.id);
                            toast.showSuccess('Episode deleted');
                            navigate('/episodes');
                          } catch (err) {
                            console.error('[EpisodeDetail] delete failed:', err);
                            toast.showError(err.message || 'Failed to delete episode');
                          }
                        }
                        setShowMoreActions(false);
                      }}
                      className="ed-dropdown-item ed-dropdown-danger"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Delete Episode</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* The header's one primary action (the mockup's gradient button).
                Play on Phone, Todo List, and Evaluate live in the Production
                sub-tabs that own that work (issue #1601). What's next shows
                only once the episode is accepted (evaluation_status ===
                'accepted'; issue #1601 narrows #1584's always-visible button)
                and ignores the per-episode "already shown" flag that gates
                only the automatic wrap-transition open above. It stays a
                visible button at every width rather than going into the
                "More actions" menu — most sessions here are on a phone. */}
            {episode?.evaluation_status === 'accepted' && (
              <button
                type="button"
                onClick={() => setShowNextSuggestions(true)}
                title="What's next: ranked event suggestions from Lala's current state"
                className="ed-btn-whats-next eds-primary"
              >
                <Compass size={16} aria-hidden="true" />
                <span className="ed-btn-whats-next-label">What's next</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Holds the rest of the full header's height while it is compact (headerRef). */}
      <div ref={spacerRef} className="ed-header-spacer" aria-hidden="true" data-testid="ed-header-spacer" />

      {/* Main Content Wrapper */}
      <div className="ed-wrap">

        {/* Main Tabs: a white bar, the chosen tab a magenta pill (the mockup's "Script"). */}
        <div className="ed-tabs-modern" data-testid="ed-tabs">
          {EP_TABS.map(t => {
            const Icon = TAB_ICONS[t.key];
            return (
              <button key={t.key}
                type="button"
                className={`ed-tab ${activeTab === t.key ? 'ed-tab-active' : ''}`}
                onClick={() => openTab(t.key)}
                title={t.label}
                aria-current={activeTab === t.key ? 'page' : undefined}
              >
                {Icon && <Icon size={16} className="ed-tab-icon" aria-hidden="true" />}
                <span className="ed-tab-label">{t.label}</span>
                {t.key === 'production' && checksLeft > 0 && (
                  <span className="ed-tab-badge" data-testid="ed-production-left" aria-label={`${checksLeft} left`}>{checksLeft}<span className="ed-tab-badge-word"> left</span></span>
                )}
              </button>
            );
          })}
        </div>
        {/* Sub-tabs */}
        {(() => {
          const currentTab = EP_TABS.find(t => t.key === activeTab);
          const groups = pillGroups(currentTab);
          // A tab with one sub-tab (Production → Checklist) needs no row.
          if (groups.reduce((n, g) => n + g.pills.length, 0) < 2) return null;
          const lit = pillFor(currentTab, epSubTab);
          return (
            // One line per label; a row wider than the screen scrolls sideways
            // (Evoni, 2026-10-05: "Production Checklist" wrapped onto two
            // lines at phone width and threw the row out of line).
            // Pills (Evoni's Episode mock): raspberry when chosen; in their
            // groups, each with a small label (Evoni, 2026-10-22 layout list).
            <div data-testid="ed-subtabs" className={`ed-subpills${groups.some((g) => g.group) ? ' is-grouped' : ''}`}>
              {groups.map((g) => (
                <div key={g.group || 'all'} className="ed-subgroup" role={g.group ? 'group' : undefined} aria-label={g.group || undefined}>
                  {g.group && <span className="ed-subgroup-label" aria-hidden="true">{g.group}</span>}
                  {g.pills.map(s => (
                    <button
                      key={s.key} type="button" onClick={() => openTab(s.key)}
                      className={`ed-subpill${lit === s.key ? ' is-active' : ''}`}
                      aria-current={lit === s.key ? 'page' : undefined}
                    >
                      {s.label}
                      {s.key === 'checklist' && checksProgress && (
                        <span className="ed-subpill-count" data-testid="ed-checklist-count">{checksProgress.done}/{checksProgress.total}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Production's strip (Evoni's Production mock, 2026-10-17; work
            first, 2026-10-22 layout list): under the pills, one thin row,
            the steps, the checks, Open Editor and Mark Ready. */}
        {activeTab === 'production' && (
          <Suspense fallback={null}>
            <EpisodeProductionHeader
              episode={episode}
              checks={productionChecks.checks}
              sections={productionChecks.sections}
              onOpenTab={openTab}
              onMarkReady={() => changeStatus('in_review')}
              statusSaving={statusSaving}
            />
          </Suspense>
        )}

        {/* Content Area — Suspense catches any lazy-loaded tab body that
            hasn't been fetched yet. Fallback matches the existing tab
            transition spinner so the swap feels intentional, not janky. */}
        <div className="ed-content">
        <Suspense fallback={<div className="ed-loading"><div className="ed-spinner" /></div>}>
        {/* Overview Tab */}
        {/* The Overview (Evoni's Episode mock): the next step, four tiles,
            the story brief and what Start Episode carried from the event
            (which was the Planning card, episode creation step 2). */}
        {tabKey === 'overview' && (
          <EpisodeOverviewTab
            episode={episode}
            show={episode.show}
            onUpdate={handleUpdateEpisode}
            onOpenTab={openTab}
            checks={checksProgress}
            balance={headerBalance}
          />
        )}

        {/* Brief tab merged into Overview as inline section bands. Old
            ?tab=brief URLs fall through to overview via resolveEpisodeTab. */}

        {/* Scripts Tab */}
        {tabKey === 'scripts' && (
          <EpisodeScriptTab
            key={episode.id}
            episode={episode}
            show={episode.show || show}
            onSaved={handleScriptSaved}
            onDirtyChange={handleScriptDirty}
          />
        )}

        {/* Files: one drop zone, then Poses (Lala and JustAWoman, 2026-10-20),
            Style photos (2026-10-22) and Footage (raw clips by who is on
            camera, 2026-10-17) as tabs (Evoni, 2026-10-22) */}
        {tabKey === 'production.files' && <EpisodeFilesTab episode={episode} />}

        {/* Scenes has two views (Evoni, 2026-10-22: Beat Plan "is the same
            as scenes"): the Workspace and the Plan, the full plan editor. */}
        {(tabKey === 'production.scenes' || tabKey === 'production.beatplan') && (
          <div className="ed-viewswitch" role="group" aria-label="Scenes view" data-testid="ed-scenes-view">
            <button type="button" className={`ed-viewswitch-btn${tabKey === 'production.scenes' ? ' is-on' : ''}`}
              aria-pressed={tabKey === 'production.scenes'} onClick={() => openTab('scenes')}>Workspace</button>
            <button type="button" className={`ed-viewswitch-btn${tabKey === 'production.beatplan' ? ' is-on' : ''}`}
              aria-pressed={tabKey === 'production.beatplan'} onClick={() => openTab('beatplan')}>Plan</button>
          </div>
        )}

        {/* Scenes › Workspace: the scene workspace (Evoni's Production mock, 2026-10-17) */}
        {tabKey === 'production.scenes' && (
          <EpisodeSceneWorkspace
            episode={episode}
            onOpenTab={openTab}
            onToast={(msg, type) => (type === 'error' ? toast?.showError?.(msg) : toast?.showSuccess?.(msg))}
          />
        )}

        {/* Scenes › Plan: the full plan editor (the Scenes tab until 2026-10-17, then Beat Plan) */}
        {tabKey === 'production.beatplan' && (
          <EpisodeScenesTab
            episode={episode}
            sourceEvent={sourceEvent}
            // The toast's own names (eighth audit: toast[type] was undefined,
            // so every message, refusals included, went to the console).
            onToast={(msg, type) => (type === 'error' ? toast?.showError?.(msg) : type === 'success' ? toast?.showSuccess?.(msg) : toast?.showInfo?.(msg))}
          />
        )}

        {/* Wardrobe Tab */}
        {tabKey === 'production.wardrobe' && (
          <div>
            {/* Unified wardrobe — event picker + outfit builder, for this
                episode's own events only (Task #3107) */}
            {wardrobeEvents === null ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }} data-testid="wardrobe-events-loading">
                Loading this episode's event…
              </div>
            ) : wardrobeEvents.length > 0 ? (
              <div>
                {wardrobeEvents.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      STYLING FOR EVENT
                    </label>
                    <select
                      value={wardrobeEvent?.id || ''}
                      onChange={(e) => {
                        const ev = wardrobeEvents.find(ev => ev.id === e.target.value);
                        setSelectedEvent(ev || null);
                      }}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid var(--lala-parchment-3)',
                        fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-card)', width: '100%', maxWidth: 400,
                      }}
                    >
                      {wardrobeEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} — {ev.dress_code || 'No dress code'} (Prestige {ev.prestige || '?'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {wardrobeEvent && (
                  <EpisodeWardrobeGameplay
                    // A new episode starts the game fresh, with nothing of the last one's.
                    key={episodeId}
                    episodeId={episodeId}
                    showId={episode?.show_id || episode?.showId}
                    event={wardrobeEvent}
                    // The script's closet beat, the beat the look chip names (Task #2880).
                    closetBeat={closetBeat(episode?.script_content)}
                    // One coin balance (Evoni, 2026-10-07): the game reads Lala's
                    // ledger balance, the number Money and the header show, not
                    // the separately stored character coins.
                    characterState={headerBalance !== null ? { ...characterState, coins: headerBalance } : characterState}
                    onCoinsChange={bumpBalance}
                    onOutfitComplete={(result) => {
                      console.log('Outfit locked:', result.slots, 'Synergy:', result.synergy.total);
                    }}
                  />
                )}
              </div>
            ) : (
              // No default event (Task #3107): without its own event, the
              // episode has no dress code, venue or look to style for.
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }} data-testid="wardrobe-no-event">
                <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
                {episodeEvents.failed ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>Could not load this episode's event</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Reload the page to try again.</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No events linked to this episode</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      The Wardrobe styles for the episode's own event: its dress code, venue and look.
                      Inject an event from the Events Library first, then come back to build your outfit.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Style Page (was Lookbook) — the style sheet as its own editor (Task #2876) */}
        {tabKey === 'production.lookbook' && (
          <EpisodeStylePage episode={episode} onOpenTab={openTab} />
        )}

        {/* Results → Summary (Evoni's Episode mock): the one page, with the
            evaluation under it since 2026-10-22; ?tab=evaluation lands there. */}
        {(tabKey === 'results.summary' || tabKey === 'results.evaluation') && (
          <EpisodeResultsSummary episode={episode} showId={episode?.show_id || episode?.showId} onOpenTab={openTab}
            focus={tabKey === 'results.evaluation' ? 'evaluation' : null} />
        )}

        {/* Results → Story: the episode as prose (EpisodeResultsPages). */}
        {tabKey === 'results.story' && (
          <EpisodeResultsStory episode={episode} />
        )}

        {/* Distribution Tab */}
        {tabKey === 'results.distribution' && (
          <EpisodeDistributionTab episode={episode} onUpdate={handleUpdateEpisode} onOpenTab={openTab} />
        )}

        {/* Phone tab — Lala's Phone for this episode (issue #1908): the
            Preview Phone action (issue #1601 moved it here, #1605 relabelled
            it; same phone.start handler and overlay), what is on the phone,
            the deferred beat-requirements notice, and missions as a section
            (EpisodePhoneMissionsTab, unchanged toggles + MissionEditor). */}
        {tabKey === 'production.phone' && (
          <EpisodeLalasPhoneTab episode={episode} onPreview={phone.start} previewError={phone.error} />
        )}

        {/* Money Tab — Episode Money, Phase A (#2278): read-only, from the ledger */}
        {tabKey === 'production.money' && (
          <EpisodeMoneyTab episode={episode} showId={episode?.show_id || episode?.showId} />
        )}

        {/* Overlays Tab — P15: every on-screen piece of the episode */}
        {tabKey === 'production.overlays' && (
          <>
            <EpisodeOverlaysTab
              episode={episode}
              showId={episode?.show_id || episode?.showId}
              onChanged={bumpOverlays}
            />
            {/* The on-screen to-do lists (moved from the old Files tab, 2026-10-17) */}
            {(episode?.show_id || episode?.showId) && (
              <section className="ed-todo-lists" aria-label="On-screen to-do lists">
                <EpisodeTodoList episodeId={episode.id} showId={episode.show_id || episode.showId} />
              </section>
            )}
          </>
        )}

        {/* Checklist Tab */}
        {tabKey === 'production.checklist' && (
          <EpisodeProductionChecklist
            episode={episode}
            showId={episode?.show_id || episode?.showId}
            onChecks={reportChecks}
            onOpenTab={openTab}
          />
        )}

        </Suspense>
      </div>

      {/* Scene Library Picker Modal */}
      <SceneLibraryPicker
        isOpen={showScenePicker}
        onClose={() => setShowScenePicker(false)}
        onSelect={handleSceneSelect}
        showId={episode?.show_id || episode?.showId}
        episodeId={episodeId}
      />

      {/* ── Preview Phone overlay — state owned by usePhonePlayback. The
            preview component is lazy-loaded; Suspense renders nothing while
            the chunk arrives so the modal just appears (no janky fallback
            since it's already an overlay on top of the page). ─────────── */}
      {phone.isPlaying && phone.overlays.length > 0 && (
        <Suspense fallback={null}>
          <PhonePreviewMode
            screens={phone.overlays}
            // Home, never an icon; the preview resumes on the saved screen
            // once the play-through is read (Evoni, 2026-10-07).
            initialScreen={phone.overlays.find(s => s.is_home && isScreen(s)) || phone.overlays.find(isScreen)}
            globalFit={phone.globalFit}
            phoneSkin={phone.skin}
            customFrameUrl={phone.frameUrl}
            playthrough={phone.playthrough}
            missions={phone.missions}
            showId={episode?.show_id || episode?.showId}
            episodeId={episodeId}
            // The Pulse on the phone shows The Pulse as of this episode's beats (Task 2986).
            storyAt={beatOrder(episode?.episode_number ?? episode?.episodeNumber)}
            onClose={phone.stop}
          />
        </Suspense>
      )}

      {/* End-of-show next-event suggestions overlay. Auto-opens only on the
          wrap transition (see the effect above), at most once per episode
          per the localStorage shown-flag; the header "What's next" button
          reopens it on demand regardless of that flag. */}
      {showNextSuggestions && episode && (
        <NextEventSuggestionsOverlay
          episode={episode}
          showId={episode.show_id || episode.show?.id}
          onClose={() => setShowNextSuggestions(false)}
        />
      )}
    </div>
    </div>
  );
};

export default EpisodeDetail;
