import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import useScrolledPast from '../hooks/useScrolledPast';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Compass, Sparkles, PenLine, CalendarDays, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
// EpisodeOverviewTab is the default tab and the most-viewed surface — keep
// it eager so the first paint doesn't flash a Suspense fallback. Same for
// the always-mounted SceneLibraryPicker modal and the lightweight
// NextEventSuggestionsOverlay (mounts only while showNextSuggestions is
// true — the wrap transition or the header button, never on page load).
import EpisodeOverviewTab from '../components/Episodes/EpisodeOverviewTab';
import EpisodePlanningCard from '../components/Episodes/EpisodePlanningCard';
import NextEventSuggestionsOverlay from '../components/Episodes/NextEventSuggestionsOverlay';
import EpisodeTitleChip from '../components/Episodes/EpisodeTitleChip';
import SceneLibraryPicker from '../components/SceneLibraryPicker';
// Lazy-loaded tab bodies — each becomes its own JS chunk that's only
// fetched when the user clicks into the tab. PhonePreviewMode is lazy
// because the player overlay only mounts when "Preview Phone" is clicked.
const EpisodeAssetsTab = lazy(() => import('../components/Episodes/EpisodeAssetsTab'));
const EpisodeLalasPhoneTab = lazy(() => import('../components/Episodes/EpisodeLalasPhoneTab'));
const EpisodeScriptTab = lazy(() => import('../components/Episodes/EpisodeScriptTab'));
const EpisodeDistributionTab = lazy(() => import('../components/Episodes/EpisodeDistributionTab'));
const EpisodeWardrobeGameplay = lazy(() => import('../components/EpisodeWardrobeGameplay'));
const EpisodeProductionChecklist = lazy(() => import('../components/Episodes/EpisodeProductionChecklist'));
const EpisodeScenesTab = lazy(() => import('../components/Episodes/EpisodeScenesTab'));
const EpisodeMoneyTab = lazy(() => import('../components/Episodes/EpisodeMoneyTab'));
const EpisodeOverlaysTab = lazy(() => import('../components/Episodes/EpisodeOverlaysTab'));
const PhonePreviewMode = lazy(() => import('../components/PhonePreviewMode'));
import usePhonePlayback from '../hooks/usePhonePlayback';
import api from '../services/api';
import { getEpisodeEvents } from '../services/episodeEventsApi';
import { EP_TABS, resolveEpisodeTab, withEpisodeTab } from '../utils/episodeTabs';
import { checklistLeft, coinsLabel } from '../lib/episodeShell';
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
  const openTab = useCallback((tab) => setSearchParams((prev) => withEpisodeTab(prev, tab)), [setSearchParams]);

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
  }, [openTab]);

  // The header's balance chip (§8(aa) M1): Lala's ledger balance, from the
  // same /balance the Dashboard reads. It opens Production → Money.
  const [headerBalance, setHeaderBalance] = useState(null);
  // Bumped by the wardrobe game after a purchase or a paid lock, so the chip
  // follows the balance (Evoni, 2026-10-05: it kept the old number).
  const [balanceVersion, setBalanceVersion] = useState(0);
  const bumpBalance = useCallback(() => setBalanceVersion((v) => v + 1), []);
  const chipShowId = episode?.show_id || episode?.showId;
  useEffect(() => {
    if (!chipShowId) return undefined;
    let cancelled = false;
    getShowBalanceApi(chipShowId)
      .then((balance) => { if (!cancelled) setHeaderBalance(balance); })
      .catch((err) => { console.error('[EpisodeDetail] balance load failed:', err); });
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
  const [checksLeft, setChecksLeft] = useState(null);
  const reportChecks = useCallback((checks, sections) => setChecksLeft(checklistLeft(checks, sections)), []);
  const checksEpisodeId = episode?.id;
  useEffect(() => {
    if (!checksEpisodeId || !episode) return undefined;
    let cancelled = false;
    import('../components/Episodes/EpisodeProductionChecklist')
      .then((m) => m.loadProductionChecks(episode, episode.show_id || episode.showId)
        .then(({ checks }) => { if (!cancelled) setChecksLeft(checklistLeft(checks, m.CHECKLIST_SECTIONS)); }))
      .catch((err) => { console.error('[EpisodeDetail] production checks load failed:', err); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checksEpisodeId]);

  const [showMoreActions, setShowMoreActions] = useState(false);
  const [episodeEvents, setEpisodeEvents] = useState([]);
  // The source event, for the header's link back to its Event Package
  // (Task #2356): the brief's event (episode_briefs.event_id, §8(w) P2),
  // which GET /episodes/:id/events returns first, flagged link.anchor.
  const [sourceEvent, setSourceEvent] = useState(null);
  const headerCompact = useScrolledPast(120);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [characterState, setCharacterState] = useState({});

  // Fetch episode data - extracted for reuse
  const fetchEpisode = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await episodeService.getEpisode(episodeId);
      setEpisode(data);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Not Found') || msg.includes('404')) {
        toast.showError('Episode not found — it may have been deleted.');
        navigate('/shows', { replace: true });
        return;
      }
      setError(msg || 'Failed to load episode');
    } finally {
      setLoading(false);
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
    const fetchEvents = async () => {
      try {
        const data = await getEpisodeEvents(episodeId);
        const linked = data?.events || [];
        setEpisodeEvents(linked);
        if (linked.length > 0 && !selectedEvent) setSelectedEvent(linked[0]);
      } catch (err) {
        console.error('Failed to load episode events:', err);
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
  }, [episode, tabKey, episodeId]);

  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
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
        action: () => navigate(`/episodes/${episode.id}/edit`),
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
      steps.push({ title: 'Publish Episode', status: 'pending', action: () => navigate(`/episodes/${episode.id}/edit`) });
    } else if (episode.status === 'published') {
      steps.push({ title: 'Publish Episode', status: 'complete' });
    }
    
    return steps;
  };

  if (authLoading || loading) {
    return (
      <div className="ed-page">
        <div className="ed-state">
          <div className="ed-spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="ed-page">
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

  return (
    <div className="ed-page">
      {/* Simplified Header: Identity + Action */}
      {/* S9 (b): collapses to the title and navigation while scrolling. */}
      <div className={`ed-header-new${headerCompact ? ' is-compact' : ''}`} data-testid="ed-header">
        <div className="ed-header-left">
          <button onClick={() => navigate(episode?.show_id || episode?.showId ? `/shows/${episode.show_id || episode.showId}` : '/episodes')} className="ed-back-btn">
            ← Back to Show
          </button>
          <div className="ed-header-info">
            <h1 className="ed-header-title">{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <div className="ed-header-meta">
              {(episode.episode_number || episode.episodeNumber) && (
                <span className="ed-meta-item">
                  <span className="ed-meta-label">Episode</span>
                  <span className="ed-meta-value">{episode.episode_number || episode.episodeNumber}</span>
                </span>
              )}
              {episode.show && (
                <Link 
                  to={`/shows/${episode.show.id}`} 
                  className="ed-show-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="ed-show-name">{episode.show.name}</span>
                </Link>
              )}
              <span className={`ed-status-badge ed-status-${episode.status?.toLowerCase() || 'draft'}`}>
                {episode.status || 'Draft'}
              </span>
              <span className="ed-working-badge" title="Studio tools (Timeline, Scene Composer) will open this episode">
                Working Episode
              </span>
              {headerBalance !== null && (
                <button
                  type="button"
                  className="ed-balance-chip"
                  onClick={openMoneyTab}
                  title="Lala's balance. Open this episode's money."
                  data-testid="ed-balance-chip"
                >
                  {coinsLabel(headerBalance)}
                </button>
              )}
            </div>
            {/* Its own line, outside .ed-header-meta, which phones hide
                (Task #2356: the link back must work at 375px). */}
            {sourceEvent && (sourceEvent.show_id || episode.show_id || episode.showId) && (
              <Link
                to={`/shows/${sourceEvent.show_id || episode.show_id || episode.showId}/events/${sourceEvent.id}`}
                className="ed-source-event-link"
                data-testid="ed-source-event"
                title="Open the Event Package this episode was started from"
              >
                <span className="ed-source-event-label">From event</span>
                <span className="ed-source-event-name">{sourceEvent.name || 'Event'}</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {/* P15: the title's status; opens Production → Overlays. Its own
                line too, so it shows at 375px. */}
            <EpisodeTitleChip
              episodeId={episode.id}
              title={episode.title}
              version={overlaysVersion}
              onOpen={openOverlaysTab}
            />
          </div>
        </div>
        <div className="ed-header-actions">
          {/* Play on Phone, Todo List, and Evaluate relocated to the
              Production sub-tabs that own that work (issue #1601) — the
              header now carries only whole-episode actions: What's next
              (once accepted) and the administrative ⋯ menu. */}
          {/* On-demand open of the next-event suggestions overlay — shown
              only once the episode is accepted (evaluation_status ===
              'accepted'; issue #1601 narrows this from #1584's
              always-visible button). When shown, ignores the per-episode
              "already shown" flag that only gates the automatic
              wrap-transition open above. Stays a persistent, visible
              button at every width (icon-only below tablet width) rather
              than being buried in the "More actions" menu — most sessions
              on this page are on a phone. */}
          {episode?.evaluation_status === 'accepted' && (
            <button
              onClick={() => setShowNextSuggestions(true)}
              title="What's next: ranked event suggestions from Lala's current state"
              className="ed-btn-whats-next"
            >
              <Compass size={14} aria-hidden="true" />
              <span className="ed-btn-whats-next-label">What's next</span>
            </button>
          )}
          <div className="ed-more-menu">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="ed-btn-more"
              aria-label="More actions"
            >
              ⋯
            </button>
            {showMoreActions && (
              <div className="ed-dropdown">
                <button
                  onClick={() => {
                    navigate(`/episodes/${episode.id}/edit`);
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item"
                >
                  <span>✏️</span>
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
                        toast.showError(err.message || 'Failed to delete episode');
                      }
                    }
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item ed-dropdown-danger"
                >
                  <span>🗑️</span>
                  <span>Delete Episode</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="ed-wrap">

        {/* Main Tabs */}
        <div className="ed-tabs-modern">
          {EP_TABS.map(t => {
            const Icon = TAB_ICONS[t.key];
            return (
              <button key={t.key}
                className={`ed-tab ${activeTab === t.key ? 'ed-tab-active' : ''}`}
                onClick={() => openTab(t.key)}
                title={t.label}
                aria-current={activeTab === t.key ? 'page' : undefined}
              >
                {Icon && <Icon size={15} className="ed-tab-icon" aria-hidden="true" />}
                <span className="ed-tab-label">{t.label}</span>
                {t.key === 'production' && checksLeft > 0 && (
                  <span className="ed-tab-badge" data-testid="ed-production-left">{checksLeft} left</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Sub-tabs */}
        {(() => {
          const currentTab = EP_TABS.find(t => t.key === activeTab);
          if (!currentTab?.subs) return null;
          return (
            // One line per label; a row wider than the screen scrolls sideways
            // (Evoni, 2026-10-05: "Production Checklist" wrapped onto two
            // lines at phone width and threw the row out of line).
            // Pills (Evoni's Episode mock): raspberry when chosen.
            <div data-testid="ed-subtabs" className="ed-subpills">
              {currentTab.subs.map(s => (
                <button
                  key={s.key} type="button" onClick={() => openTab(s.key)}
                  className={`ed-subpill${epSubTab === s.key ? ' is-active' : ''}`}
                  aria-current={epSubTab === s.key ? 'page' : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Content Area — Suspense catches any lazy-loaded tab body that
            hasn't been fetched yet. Fallback matches the existing tab
            transition spinner so the swap feels intentional, not janky. */}
        <div className="ed-content">
        <Suspense fallback={<div className="ed-loading"><div className="ed-spinner" /></div>}>
        {/* Overview Tab */}
        {/* Planning (episode creation step 2): what Start Episode carried
            from the event, and the next decision. */}
        {tabKey === 'overview' && <EpisodePlanningCard episode={episode} onOpenTab={openTab} />}
        {tabKey === 'overview' && (
          <EpisodeOverviewTab
            episode={episode} 
            show={episode.show}
            onUpdate={handleUpdateEpisode}
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
          />
        )}

        {/* Assets Tab */}
        {tabKey === 'production.assets' && (
          episode.show ? (
            <EpisodeAssetsTab episode={episode} show={episode.show} />
          ) : (
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🎨 Episode Assets</h2>
              </div>
              <div className="ed-cardbody">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    This episode needs to be linked to a show to use the asset system.
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1rem' }}>
                    Please edit the episode and select a show.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {/* Scenes Tab */}
        {tabKey === 'production.scenes' && (
          <EpisodeScenesTab
            episode={episode}
            sourceEvent={sourceEvent}
            onToast={(msg, type) => toast && toast[type] ? toast[type](msg) : console.log(msg)}
          />
        )}

        {/* Wardrobe Tab */}
        {tabKey === 'production.wardrobe' && (
          <div>
            {/* Unified wardrobe — event picker + outfit builder */}
            {episodeEvents.length > 0 ? (
              <div>
                {episodeEvents.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      STYLING FOR EVENT
                    </label>
                    <select
                      value={selectedEvent?.id || ''}
                      onChange={(e) => {
                        const ev = episodeEvents.find(ev => ev.id === e.target.value);
                        setSelectedEvent(ev || null);
                      }}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid var(--lala-parchment-3)',
                        fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-card)', width: '100%', maxWidth: 400,
                      }}
                    >
                      {episodeEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} — {ev.dress_code || 'No dress code'} (Prestige {ev.prestige || '?'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedEvent && (
                  <EpisodeWardrobeGameplay
                    episodeId={episodeId}
                    showId={episode?.show_id || episode?.showId}
                    event={selectedEvent}
                    characterState={characterState}
                    onCoinsChange={bumpBalance}
                    onOutfitComplete={(result) => {
                      console.log('Outfit locked:', result.slots, 'Synergy:', result.synergy.total);
                    }}
                  />
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No events linked to this episode</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Inject an event from the Events Library first, then come back to build your outfit.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Story Tab — links to Stories page */}
        {tabKey === 'results.story' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Episode Stories</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={async (e) => {
                  const btn = e.currentTarget; btn.disabled = true; btn.textContent = '⏳ Generating...';
                  try {
                    const sid = episode?.show_id || episode?.showId;
                    await api.post(`/api/v1/world/${sid}/episodes/${episode.id}/generate-story`, { format: 'short_story' });
                    btn.textContent = '✓ Generated — open Stories'; setTimeout(() => { btn.textContent = '✦ Generate Short Story'; btn.disabled = false; }, 2000);
                  } catch { btn.textContent = 'Failed'; btn.disabled = false; }
                }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✦ Generate Short Story
                </button>
                <button onClick={() => window.location.href = '/stories'} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--lala-parchment-3)', background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✍️ Open Stories Library
                </button>
              </div>
            </div>
            <div style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--text-primary)' }}>Generate Stories</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 400, margin: '0 auto 16px' }}>
                Transform this episode into prose — short story, social fiction, snippet, or recap.
                Each format tells the same story differently.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { format: 'short_story', icon: '📖', label: 'Short Story', desc: '2-3K words' },
                  { format: 'social_fiction', icon: '📱', label: 'Social Fiction', desc: 'Posts & DMs' },
                  { format: 'snippet', icon: '✂️', label: 'Snippet', desc: '400-600 words' },
                  { format: 'recap', icon: '🔄', label: 'Recap', desc: 'Casual retelling' },
                ].map(f => (
                  <button key={f.format} onClick={async (e) => {
                    const btn = e.currentTarget; btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳...';
                    try {
                      const sid = episode?.show_id || episode?.showId;
                      await api.post(`/api/v1/world/${sid}/episodes/${episode.id}/generate-story`, { format: f.format });
                      btn.textContent = '✓'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
                    } catch { btn.textContent = '✗'; btn.disabled = false; }
                  }} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--lala-parchment-3)', background: 'var(--surface-bg)', cursor: 'pointer', textAlign: 'center', minWidth: 120 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Distribution Tab */}
        {tabKey === 'results.distribution' && (
          <EpisodeDistributionTab episode={episode} onUpdate={handleUpdateEpisode} />
        )}

        {/* Phone tab — Lala's Phone for this episode (issue #1908): the
            Preview Phone action (issue #1601 moved it here, #1605 relabelled
            it; same phone.start handler and overlay), what is on the phone,
            the deferred beat-requirements notice, and missions as a section
            (EpisodePhoneMissionsTab, unchanged toggles + MissionEditor). */}
        {tabKey === 'production.phone' && (
          <EpisodeLalasPhoneTab episode={episode} onPreview={phone.start} />
        )}

        {/* Money Tab — Episode Money, Phase A (#2278): read-only, from the ledger */}
        {tabKey === 'production.money' && (
          <EpisodeMoneyTab episode={episode} showId={episode?.show_id || episode?.showId} />
        )}

        {/* Overlays Tab — P15: every on-screen piece of the episode */}
        {tabKey === 'production.overlays' && (
          <EpisodeOverlaysTab
            episode={episode}
            showId={episode?.show_id || episode?.showId}
            onChanged={bumpOverlays}
          />
        )}

        {/* Checklist Tab */}
        {tabKey === 'production.checklist' && (
          <EpisodeProductionChecklist
            episode={episode}
            showId={episode?.show_id || episode?.showId}
            onChecks={reportChecks}
          />
        )}

        {/* Evaluation Tab */}
        {tabKey === 'results.evaluation' && (() => {
          const evalJson = episode.evaluation_json
            ? (typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json)
            : null;

          const TIER_STYLES = {
            slay: { color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)', emoji: '👑', label: 'SLAY' },
            pass: { color: 'var(--success-text)', bg: 'var(--success-bg)', emoji: '✨', label: 'PASS' },
            safe: { color: 'var(--warning-text)', bg: 'var(--warning-bg)', emoji: '😐', label: 'SAFE' },
            fail: { color: 'var(--danger-text)', bg: 'var(--danger-bg)', emoji: '💔', label: 'FAIL' },
          };

          if (!evalJson) {
            return (
              <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👑</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>Not Evaluated Yet</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Complete this episode from the event panel to evaluate it.
                  Evaluation scores outfit match, event performance, social tasks, and financials.
                </p>
              </div>
            );
          }

          const tier = TIER_STYLES[evalJson.tier_final] || TIER_STYLES.safe;
          const breakdown = evalJson.breakdown || {};
          const deltas = evalJson.stat_deltas || {};
          const narrative = evalJson.narrative_lines || {};
          const socialBonuses = evalJson.social_task_bonuses?.detail || {};
          const wardrobeBonuses = evalJson.wardrobe_bonuses?.detail || {};
          const financials = evalJson.financial_summary || {};

          return (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              {/* Tier Banner */}
              <div style={{ background: tier.bg, border: `2px solid ${tier.color}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>{tier.emoji}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: tier.color }}>{tier.label}</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>{evalJson.score}/100</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0 0', fontStyle: 'italic' }}>
                  {narrative.short || narrative.dramatic || ''}
                </p>
              </div>

              {/* Score Breakdown */}
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Score Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(breakdown).map(([key, entry]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{entry.detail}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: entry.value >= 0 ? 'var(--success-text)' : 'var(--danger-text)', minWidth: 40, textAlign: 'right' }}>
                          {entry.value >= 0 ? '+' : ''}{entry.value}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: tier.color }}>{evalJson.score}</span>
                  </div>
                </div>
              </div>

              {/* Stat Deltas */}
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Character Stat Changes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {[
                    { key: 'coins', label: 'Coins', icon: '🪙' },
                    { key: 'reputation', label: 'Reputation', icon: '⭐' },
                    { key: 'brand_trust', label: 'Brand Trust', icon: '🤝' },
                    { key: 'influence', label: 'Influence', icon: '📣' },
                    { key: 'stress', label: 'Stress', icon: '😰' },
                  ].map(stat => {
                    const val = deltas[stat.key] || 0;
                    const isGood = stat.key === 'stress' ? val < 0 : val > 0;
                    const isBad = stat.key === 'stress' ? val > 0 : val < 0;
                    return (
                      <div key={stat.key} style={{ textAlign: 'center', padding: '8px 0', borderRadius: 8, background: isGood ? 'var(--success-bg)' : isBad ? 'var(--danger-bg)' : 'var(--lala-parchment-2)' }}>
                        <div style={{ fontSize: 16 }}>{stat.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: isGood ? 'var(--success-text)' : isBad ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                          {val > 0 ? '+' : ''}{val}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{stat.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Social + Wardrobe + Financial Context */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {socialBonuses.total > 0 && (
                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>📱 Social Tasks</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-text)' }}>{socialBonuses.completed}/{socialBonuses.total}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {socialBonuses.completion_rate}% complete
                      {socialBonuses.all_required_done && <span style={{ color: 'var(--success-text)' }}> · All required done</span>}
                    </div>
                  </div>
                )}
                {wardrobeBonuses.brands?.length > 0 && (
                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>👗 Outfit</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Brands: {wardrobeBonuses.brands.join(', ')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Tier gap: {wardrobeBonuses.tier_gap > 0 ? 'overdressed' : wardrobeBonuses.tier_gap < 0 ? 'underdressed' : 'perfect match'}
                    </div>
                  </div>
                )}
                {financials.total_income > 0 || financials.total_expenses > 0 ? (
                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>💰 Financials</div>
                    <div style={{ fontSize: 11, color: 'var(--success-text)' }}>+{financials.total_income || 0} income</div>
                    <div style={{ fontSize: 11, color: 'var(--danger-text)' }}>-{financials.total_expenses || 0} expenses</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: (financials.total_income || 0) - (financials.total_expenses || 0) >= 0 ? 'var(--success-text)' : 'var(--danger-text)', marginTop: 2 }}>
                      Net: {(financials.total_income || 0) - (financials.total_expenses || 0) >= 0 ? '+' : ''}{(financials.total_income || 0) - (financials.total_expenses || 0)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}
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
            initialScreen={
              phone.playthrough.state?.last_screen_id
                ? phone.overlays.find(s => s.id === phone.playthrough.state.last_screen_id)
                : phone.overlays.find(s => s.is_home) || phone.overlays[0]
            }
            globalFit={phone.globalFit}
            phoneSkin={phone.skin}
            customFrameUrl={phone.frameUrl}
            playthrough={phone.playthrough}
            missions={phone.missions}
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
