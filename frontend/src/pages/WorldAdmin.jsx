/**
 * WorldAdmin — Producer Mode, the one show workspace
 * 
 * Route: /shows/:id/world
 * 
 * Tabs (TABS below; audit IA-01/IA-02, 2026-10-03; six since 2026-10-25):
 *   Overview · Season (a link: the Season page, /shows/:id/season, with the
 *   episodes, roadmap, events, opportunities, story, goals and results) ·
 *   Assets (Scene Sets, Wardrobe, Lala's Phone, Overlays) · Cast &
 *   Continuity (Lala's State & Continuity, Lala's Finances, Activity &
 *   Decisions) · World (Lala's posts, World moments, Rate card) · Release
 *   (Next release, Distribution, Insights). The event library is the
 *   Season page's Events tab (components/Show/EventLibrary); ?tab=events
 *   and ?tab=events&event=<id> open it there (SEASON_PAGE_KEYS).
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { seasonPageHref } from '../lib/seasonPage';
import api from '../services/api';
import showService from '../services/showService';
import { rememberShow } from '../utils/activeShow';
import WorldMomentsTab from '../components/WorldMoments/WorldMomentsTab';
import RateCardTab from '../components/RateCard/RateCardTab';
import { S, STAT_ICONS, isFailureToast } from '../components/Show/producerStyles';
import ShowOverview, { episodesInProduction } from '../components/Show/ShowOverview';
import { useLookDraft, LookBuilderPanel, RecentlyWorn } from '../components/Show/LookBuilder';
import { LalaStatsCard, DecisionLogCard, StoryThreadsStrip, CastRow } from '../components/Show/CastContinuity';
import { matchesDressCode, dressCodeKeywords, setPiecesOf, setSlotClashes } from '../lib/lookBuilder';
import { backdropFor, matchingSetsFrom, fetchClosetWithTotal } from '../lib/closetGrouping';
import ShowDistributionTab from '../components/Show/ShowDistributionTab';
import ReleaseBoard from '../components/Show/ReleaseBoard';
import LalaFeedTab from '../components/Show/LalaFeedTab';
import ShowInsightsTab from '../components/Show/ShowInsightsTab';
import { SLOT_KEYS, SLOT_DEFS, SLOT_SUBCATEGORIES, getSlotForCategory, groupItemsBySlot } from '../lib/wardrobeSlots';
import { ArrowRight, ArrowLeft, Plus, Calendar, Sparkles, AlertTriangle, Loader2, RotateCw, X, Gem, Crown, Heart, ChevronDown, Search, FileUp, Globe2, CalendarRange } from 'lucide-react';
import useWardrobeProcessing from '../hooks/useWardrobeProcessing';
import { backgroundRemovalStarted, PROCESSING_STATES } from '../utils/wardrobeProcessingState';
import AddPieceDialog from '../components/Wardrobe/AddPieceDialog';
import OrderImportDialog from '../components/Wardrobe/OrderImportDialog';
import RealWorldFields from '../components/Wardrobe/RealWorldFields';
import { realDraftFrom, realChanges, realWorldErrorText } from '../lib/wardrobeRealWorld';
import { fetchAllEpisodes, partialNote } from '../lib/fetchAllPages';
import './WorldAdmin.css';
import '../styles/wardrobe-backdrop.css';

// Track 6 CP13 module-scope helpers — page structural shape, file-local
// `api` import style preserved (file already partial-migrated at line 6306).
//
// Cross-CP duplications per v2.12 §9.11 file-local convention:
// - listEpisodeTodoSocialApi: CP9 EpisodeTodoPage + CP13 = 2-fold cross-CP
// - listWorldEventsApi: service-module precedence (7+ component consumers)
// - listShowWardrobeApi: wardrobeService.js + 7-component precedence inversion
// - updateWardrobeItemApi: wardrobeService.js precedence inversion
//
// NEW v2.20 §9.11 candidate at bulkWardrobeOpApi: Data-driven URL pass-
// through (config array dispatch). All 4 structural conditions verified —
// method uniform (POST), payload+headers uniform (JSON), variants enumerated
// as data (config array literal at lines 5539-5542), URLs file-internal.
// Distinct from v2.17 URL-branching split. Helper-name verb-noun-Op preserves
// Pattern F domain context.
//
// Multipart helper uploadWardrobeApi per v2.14 §9.11 — services/api.js
// interceptor (lines 21-26) auto-strips Content-Type for FormData payloads.
export const listWorldEventsApi = (showId) =>
  api.get(`/api/v1/world/${showId}/events`).then((r) => r.data);
export const listShowWardrobeApi = (showId) =>
  api.get(`/api/v1/shows/${showId}/wardrobe`).then((r) => r.data);
export const updateWardrobeItemApi = (itemId, payload) =>
  api.put(`/api/v1/wardrobe/${itemId}`, payload);
export const promoteWardrobePrimaryVariantApi = (itemId, variant) =>
  api.patch(`/api/v1/wardrobe/${itemId}/primary-variant`, { variant }).then((r) => r.data);
export const sendWardrobeToPhoneApi = (itemId, payload) =>
  api.post(`/api/v1/wardrobe/${itemId}/send-to-phone`, payload).then((r) => r.data);
export const regenerateWardrobeProductShotApi = (itemId) =>
  api.post(`/api/v1/wardrobe/${itemId}/regenerate-product-shot`).then((r) => r.data);
export const getWardrobeUsageApi = (itemId) =>
  api.get(`/api/v1/wardrobe/${itemId}/usage`).then((r) => r.data);
export const bulkWardrobeOpApi = (endpoint, payload) =>
  api.post(endpoint, payload).then((r) => r.data);
export const uploadWardrobeApi = (formData) =>
  api.post('/api/v1/wardrobe', formData).then((r) => r.data);
// W1 (Evoni, 2026-10-01): link the selected pieces as a matching set. The
// styling game reads the link (outfit_set_id) from the pieces themselves.
export const createMatchingSetApi = (payload) =>
  api.post('/api/v1/wardrobe/matching-sets', payload).then((r) => r.data);
export const createOutfitSetApi = (payload) =>
  api.post('/api/v1/outfit-sets', payload).then((r) => r.data);

const SceneSetsTab = lazy(() => import('./SceneSetsTab'));
const UIOverlaysTab = lazy(() => import('./UIOverlaysTab'));
const ProductionOverlaysTab = lazy(() => import('./ProductionOverlaysTab'));

const WARDROBE_TIER_COLORS = { basic: '#94a3b8', mid: '#6366f1', luxury: '#eab308', elite: '#ec4899' };
const WARDROBE_TIER_ICONS = { basic: '👟', mid: '👠', luxury: '💎', elite: '👑' };
// Legacy atomic list — kept only for any pre-existing lookup that still expects
// the old 9-category shape. New UIs should import SLOT_KEYS / SLOT_DEFS from
// lib/wardrobeSlots and group by slot.
const WARDROBE_CATEGORIES = ['all', 'dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear', 'perfume'];

// Color name to hex mapping for swatches
const COLOR_TO_HEX = {
  black: '#1a1a1a', white: '#f8f8f8', red: '#dc2626', blue: '#2563eb', green: '#16a34a', yellow: '#eab308',
  pink: '#ec4899', purple: '#a855f7', orange: '#f97316', brown: '#92400e', beige: '#d4a574', cream: '#fffdd0',
  navy: '#1e3a5f', gold: '#d4af37', silver: '#c0c0c0', grey: '#6b7280', gray: '#6b7280', 'blush': '#de5d83',
  nude: '#e3bc9a', burgundy: '#800020', emerald: '#50c878', coral: '#ff7f50', teal: '#008080', ivory: '#fffff0',
  tan: '#d2b48c', olive: '#808000', maroon: '#800000', rose: '#ff007f', lavender: '#e6e6fa', mint: '#98ff98',
};
const getColorHex = (colorName) => {
  if (!colorName) return null;
  const lower = colorName.toLowerCase().trim();
  if (COLOR_TO_HEX[lower]) return COLOR_TO_HEX[lower];
  // Check for partial matches
  for (const [name, hex] of Object.entries(COLOR_TO_HEX)) {
    if (lower.includes(name) || name.includes(lower)) return hex;
  }
  return null;
};
const CAT_ICONS = { all: '🏷️', dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessory: '🎀', jewelry: '💍', bag: '👜', outerwear: '🧥', perfume: '🌸', hair: '💇' };


// One show workspace (Evoni, 2026-10-03), regrouped to six tabs (Evoni,
// 2026-10-25: "Producer Mode is confusing"): Overview · Season · Assets ·
// Cast & Continuity · World · Release. Season is a link, not a tab: it opens
// the Season page, which now holds the season's episodes (the production
// board), events, opportunities, story, goals and results. World gathers
// Lala's posts, the world's moments and her rate card. Keys stay as they
// were so existing ?tab= links keep working.
const TABS = [
  { key: 'overview', Icon: Sparkles, label: 'Overview' },
  { key: 'season-page', Icon: CalendarRange, label: 'Season', page: 'season' },
  { key: 'wardrobe', Icon: Gem, label: 'Assets', subs: [
    { key: 'scene-sets', label: 'Scene Sets' },
    { key: 'wardrobe-items', label: 'Wardrobe' },
    { key: 'overlays-tab', label: "Lala's Phone" },
    { key: 'production-overlays', label: 'Overlays' },
  ]},
  { key: 'characters', Icon: Crown, label: 'Cast & Continuity', subs: [
    { key: 'characters-list', label: "Lala's State & Continuity" },
    { key: 'finances', label: "Lala's Finances" },
    { key: 'decisions', label: 'Activity & Decisions' },
  ]},
  { key: 'world', Icon: Globe2, label: 'World', subs: [
    // Lala's Feed (Evoni's redesign, 2026-10-05: "bring the feed back"); the Sidebar's Social Media page stays.
    { key: 'feed', label: "Lala's posts" },
    // The world moves on its own calendar (Evoni, 2026-10-18; services/worldMoments).
    { key: 'moments', label: 'World moments' },
    // What Lala charges (Evoni, 2026-10-19; services/rateCard).
    { key: 'rate-card', label: 'Rate card' },
  ]},
  { key: 'release', Icon: Heart, label: 'Release', subs: [
    // The next episode out the door (Evoni's redesign, 2026-10-05); the release tab opens on it.
    { key: 'release-next', label: 'Next release' },
    { key: 'distribution', label: 'Distribution' },
    { key: 'insights', label: 'Insights' },
  ]},
];

// What moved to the Season page: the old ?tab= key, and goTo with it, opens
// the Season page on that tab (lib/seasonPage SEASON_TABS). The Season Plan
// and Career Goals moved first (2026-10-25); then the production board
// (Episodes), the Episode Ledger (Results) and Opportunities, the same day;
// then the event library (Events, step 2 of the restructure): ?tab=events
// and the older ?tab=feed-events open the Season page's Events tab, and
// &event=<id> rides along to open that event's editor there.
export const SEASON_PAGE_KEYS = {
  season: null,
  'season-page': null,
  goals: 'goals',
  episodes: 'episodes',
  'episodes-production': 'episodes',
  'episodes-ledger': 'results',
  opportunities: 'opportunities',
  events: 'events',
  'feed-events': 'events',
};

function WorldAdmin() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  // Lala's Feed drafts waiting on approval: the count on its tab.
  const [feedWaiting, setFeedWaiting] = useState(null);
  const [worldEvents, setWorldEvents] = useState([]);
  // True totals from the lists' pagination (the lists stop at 100 / 200).
  const [episodesTotal, setEpisodesTotal] = useState(null);
  const [wardrobeTotal, setWardrobeTotal] = useState(null);
  // The sections whose load failed this time, for the "Couldn't load" banner.
  const [loadFailures, setLoadFailures] = useState([]);
  // Lists that loaded short of their total ("wardrobe: Showing 1,980 of 2,100").
  const [partialLists, setPartialLists] = useState([]);
  // How the last load failed (audit TRUTH-01, 2026-10-03): 'initial' (nothing
  // to show for those sections), 'refresh' (what loaded before stays), 'all'
  // (nothing answered: a connection failure, not an empty show).
  const [loadFailureKind, setLoadFailureKind] = useState('initial');
  const loadedOnceRef = useRef(false);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  // Upload processing state (Task #1769): cards for items this session
  // uploaded show "Extracting item…" until the background-removed image
  // lands, then swap to it without a reload.
  const mergeWardrobeItem = useCallback((patch) => {
    setWardrobeItems(prev => prev.map(i => (i.id === patch.id ? { ...i, ...patch } : i)));
  }, []);
  const wardrobeProcessing = useWardrobeProcessing(mergeWardrobeItem);
  const [lightboxItem, setLightboxItem] = useState(null);  // For fullscreen image view
  const [regeneratingItemId, setRegeneratingItemId] = useState(null);  // AI product-shot regeneration in flight
  const [lightboxVariant, setLightboxVariant] = useState(null);  // 'original' | 'processed' | 'regenerated' (overrides resolver in lightbox only)
  const [promotingVariant, setPromotingVariant] = useState(false);  // PATCH in flight
  const [sendingToPhone, setSendingToPhone] = useState(false);  // Send-to-phone POST in flight
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState(new Set());  // For bulk selection
  const [overlayData, setOverlayData] = useState(null);
  const [wardrobeFilter, setWardrobeFilter] = useState('all');       // all | owned | locked
  const [wardrobeTierFilter, setWardrobeTierFilter] = useState('all'); // all | basic | mid | luxury | elite
  const [wardrobeCatFilter, setWardrobeCatFilter] = useState('all');   // all | dress | top | ...
  const [seedingWardrobe, setSeedingWardrobe] = useState(false);
  const [editingWardrobeItem, setEditingWardrobeItem] = useState(null);   // item object or null
  const [wardrobeForm, setWardrobeForm] = useState({});
  const [realDraft, setRealDraft] = useState({});   // the piece's real-world fields (Task #3019)
  const [savingWardrobe, setSavingWardrobe] = useState(false);
  // Add piece; the dialog keeps its own form (components/Wardrobe/AddPieceDialog).
  const [showWardrobeUpload, setShowWardrobeUpload] = useState(false);
  // Import orders (Task #3102): Amazon's order history onto pieces' Real world details.
  const [showOrderImport, setShowOrderImport] = useState(false);
  const [wardrobeEditBrandIsFictional, setWardrobeEditBrandIsFictional] = useState(false);
  // Sort order for the wardrobe grid. Mirrors the options previously in
  // WardrobeBrowser so consolidating the upload path doesn't drop UX.
  const [wardrobeSort, setWardrobeSort] = useState('recent'); // recent | name | price_asc | price_desc | most_used | last_used
  // Secondary filters previously lived in WardrobeBrowser's sidebar. 'all' =
  // unfiltered; season accepts spring|summer|fall|winter|all-season; occasion
  // is a free-text substring match; color matches the lowercased name.
  const [wardrobeSeasonFilter, setWardrobeSeasonFilter] = useState('all');
  const [wardrobeOccasionFilter, setWardrobeOccasionFilter] = useState('all');
  const [wardrobeColorFilter, setWardrobeColorFilter] = useState('all');
  const [wardrobeStatusFilter, setWardrobeStatusFilter] = useState('all'); // all | used | unused | favorites
  const [wardrobeFiltersOpen, setWardrobeFiltersOpen] = useState(false);
  // Top-level view mode: 'all' is the full library, 'staging' shows only items
  // never used in an episode (ported from WardrobeBrowser's two-tab split). It
  // layers on top of the existing filters — a creator can still narrow staging
  // by category, season, etc. Implementing client-side so we don't need to
  // fetch from a second endpoint; the semantic matches usage_count === 0.
  const [wardrobeTopTab, setWardrobeTopTab] = useState('all'); // the Show row: all | owned | to_buy | staging (never used)
  // Grid vs. list rendering. List view shows more metadata per row and is better
  // for scanning long libraries; grid is the default thumbnail wall.
  const [wardrobeViewMode, setWardrobeViewMode] = useState('grid'); // grid | list
  // Pagination avoids rendering 500+ cards at once once creators start seeding
  // real libraries. 48 per page lines up with the 4-wide grid.
  const [wardrobePage, setWardrobePage] = useState(1);
  const WARDROBE_PAGE_SIZE = 48;
  // Per-item usage modal — lists the episodes that reference a wardrobe item.
  // Populated on demand via GET /api/v1/wardrobe/:id/usage; also auto-opened
  // when a delete is blocked because the item is still in use.
  const [usageModalItem, setUsageModalItem] = useState(null);
  const [itemUsage, setItemUsage] = useState(null);
  // Outfit-set creation from the current bulk selection. `setName` lives here
  // instead of inside the modal so it survives re-renders while the user types.
  const [showCreateOutfitSet, setShowCreateOutfitSet] = useState(false);
  const [outfitSetName, setOutfitSetName] = useState('');
  const [creatingOutfitSet, setCreatingOutfitSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [subTab, setSubTab] = useState(null);

  // Map old tab keys to new structure for URL backwards compat
  const resolveTab = (tab) => {
    // Auto-resolve any sub-tab key to its parent main tab, so deep-links like
    // ?tab=wardrobe-items (or any other sub-tab) land on the right view
    // without having to register each one manually.
    for (const t of TABS) {
      if (t.subs && t.subs.some((s) => s.key === tab)) {
        return [t.key, tab];
      }
    }
    // Legacy aliases for renamed tabs or top-level keys that should default
    // to a specific sub-tab when deep-linked.
    const oldToNew = {
      // 'feed' is a tab of its own again; 'feed-timeline' is redirected to
      // the standalone Feed route by the mount effect below ('events' and
      // 'feed-events' go to the Season page: SEASON_PAGE_KEYS).
      'scene-sets': ['wardrobe', 'scene-sets'],
      'overlays': ['wardrobe', 'overlays-tab'],
      'overlays-tab': ['wardrobe', 'overlays-tab'],
      'production-overlays': ['wardrobe', 'production-overlays'],
      'wardrobe': ['wardrobe', 'scene-sets'],
      'characters': ['characters', 'characters-list'],
      'decisions': ['characters', 'decisions'],
      'finances': ['characters', 'finances'],
      'release': ['release', 'release-next'],
      'distribution': ['release', 'distribution'],
      'insights': ['release', 'insights'],
    };
    return oldToNew[tab] || [tab, null];
  };

  // On mount, resolve initial tab. ?tab=feed opens Lala's Feed here again
  // (2026-10-05); ?tab=feed-timeline, an old deep-link, still goes to the
  // standalone feed page.
  useEffect(() => {
    if (initialTab === 'feed-timeline') {
      navigate('/pulse?layer=lalaverse', { replace: true });
      return;
    }
    if (initialTab in SEASON_PAGE_KEYS) {
      // ?deal_with= (a need's "Add a deal") rides along to the Opportunities
      // tab; ?event=<id> to the Events tab, where it opens that event's editor.
      const extra = { deal_with: searchParams.get('deal_with'), event: searchParams.get('event') };
      navigate(seasonPageHref(showId, SEASON_PAGE_KEYS[initialTab], extra), { replace: true });
      return;
    }
    const [main, sub] = resolveTab(initialTab);
    if (main !== initialTab) setActiveTab(main);
    // A main tab with sub-tabs always opens one (Task #2289): ?tab=wardrobe
    // once resolved to a main tab that was the tab itself, so the sub-tab
    // was never set and the page body stayed empty.
    // Otherwise its first sub-tab, as switchTab does.
    const landing = sub || TABS.find((t) => t.key === main)?.subs?.[0]?.key || null;
    if (landing) setSubTab(landing);
  }, []);

  // Open a section by its tab or sub-tab key (the Overview's links).
  const goTo = (key) => {
    if (key in SEASON_PAGE_KEYS) { navigate(seasonPageHref(showId, SEASON_PAGE_KEYS[key])); return; }
    const [main, sub] = resolveTab(key);
    setActiveTab(main);
    const landing = sub || TABS.find((t) => t.key === main)?.subs?.[0]?.key || null;
    setSubTab(landing);
    setSearchParams({ tab: landing || main });
  };
  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    const tab = TABS.find(t => t.key === tabKey);
    const firstSub = tab?.subs?.[0]?.key || null;
    setSubTab(firstSub);
    setSearchParams({ tab: firstSub || tabKey });
  };
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [financeConfig, setFinanceConfig] = useState(null);
  // Modal state for the finance editor (starting balance + goals ladder).
  // Kept separate from financeConfig so unsaved edits don't clobber the
  // fetched state until the user clicks Save.
  const [financeEditorDraft, setFinanceEditorDraft] = useState(null);
  const [financeEditorSaving, setFinanceEditorSaving] = useState(false);
  // Finance page tabs — Overview, Per-Episode, Goals (later: Breakdowns).
  const [financeTab, setFinanceTab] = useState('overview');
  // Aggregated dashboard data (totals, by_episode, trend, burn_rate, runway).
  // Fetched when the editor opens so the tabs render real numbers instead of
  // refetching on every click.
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(false);
  // Auto-generated goal suggestions for the Goals tab. One fetch per modal
  // open — the algorithm is deterministic so refetching is wasteful.
  const [financeSuggestions, setFinanceSuggestions] = useState(null);
  // Breakdowns tab data — income/expense rollups by category + closet value.
  const [financeBreakdowns, setFinanceBreakdowns] = useState(null);
  // Lala's Finances: the editable draft follows the saved config; the
  // summary, suggestions and breakdowns load when the section opens.
  const draftFromConfig = (cfg) => ({
    starting_balance: cfg?.starting_balance ?? 1900,
    goals: (cfg?.goals || []).map((g) => ({ ...g })),
  });
  useEffect(() => {
    if (activeTab !== 'characters' || subTab !== 'finances') return undefined;
    let cancelled = false;
    setFinanceEditorDraft(draftFromConfig(financeConfig));
    setFinanceSummaryLoading(true);
    (async () => {
      try {
        const [sumRes, sugRes, brkRes] = await Promise.all([
          api.get(`/api/v1/shows/${showId}/financial-summary`),
          api.get(`/api/v1/shows/${showId}/financial-suggestions`).catch((err) => { console.error('[Finances] suggestions failed:', err); return null; }),
          api.get(`/api/v1/shows/${showId}/financial-breakdowns`).catch((err) => { console.error('[Finances] breakdowns failed:', err); return null; }),
        ]);
        if (cancelled) return;
        setFinanceSummary(sumRes.data);
        setFinanceSuggestions(sugRes?.data?.suggestions || []);
        setFinanceBreakdowns(brkRes?.data || null);
      } catch (err) {
        console.error('[Finances] summary failed:', err);
        if (!cancelled) setFinanceSummary(null);
      } finally {
        if (!cancelled) setFinanceSummaryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, subTab, showId, financeConfig]);


  // Character editor state
  const [editingStats, setEditingStats] = useState(false);
  const [statForm, setStatForm] = useState({});
  const [savingStats, setSavingStats] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { loadData(); }, [showId]);
  // Producer Mode's show is the active show the Sidebar and other pages open.
  useEffect(() => { rememberShow(showId); }, [showId]);
  // The context bar's show switcher.
  const [allShows, setAllShows] = useState([]);
  useEffect(() => {
    showService.getAllShows()
      .then((list) => setAllShows((list || []).map((s) => ({ id: s.id, name: s.name || s.title || 'Untitled show' }))))
      .catch((err) => { console.error('[WorldAdmin] shows load failed:', err); setAllShows([]); });
  }, []);

  // Load the show's finance config (balance + goal ladder) whenever the show
  // changes. Kick off a seed-balance POST first — it's idempotent, so if the
  // ledger already has a seed row it returns the existing one. This ensures
  // the finance widget never shows 0 coins for a brand-new show.
  useEffect(() => {
    if (!showId) return;
    let cancelled = false;
    (async () => {
      try {
        await api.post(`/api/v1/shows/${showId}/seed-balance`);
        const res = await api.get(`/api/v1/shows/${showId}/financial-config`);
        if (!cancelled) setFinanceConfig(res.data);
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [showId]);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 5000); return () => clearTimeout(t); }
  }, [successMsg]);

  const loadData = async () => {
    setLoading(true); setError(null);
    // A section whose request fails is named in the "Couldn't load" banner,
    // so an empty list there is never mistaken for "there are none".
    const failed = [];
    const partials = [];
    const partial = (label, list) => { const note = partialNote(list); if (note) partials.push(`${label}: ${note}`); };
    const refresh = loadedOnceRef.current;
    const miss = (label, reset) => (err) => {
      console.error(`[LoadData] ${label} load failed:`, err?.response?.status, err?.response?.data || err?.message);
      failed.push(label);
      // A failed refresh keeps what loaded before (audit TRUTH-01).
      if (reset && !refresh) reset();
    };
    try {
      const requests = [
        // GET /shows/:id answers { success, data: show }; the show's name is `name`.
        api.get(`/api/v1/shows/${showId}`).then(r => setShow(r.data?.data || null)).catch(miss('the show', () => setShow(null))),
        api.get(`/api/v1/characters/lala/state?show_id=${showId}`).then(r => setCharState(r.data)).catch(miss("Lala's state")),
        // Every page, not the first 100 (the audit's "Pagination and totals
        // are inconsistent"); a list short of its total is named below.
        fetchAllEpisodes(api, showId).then((list) => {
          setEpisodes(list.items);
          setEpisodesTotal(list.total ?? list.items.length);
          partial('episodes', list);
        }).catch(miss('episodes', () => { setEpisodes([]); setEpisodesTotal(null); })),
        api.get(`/api/v1/world/${showId}/history`).then(r => setStateHistory(r.data?.history || [])).catch(miss('state history', () => setStateHistory([]))),
        api.get(`/api/v1/world/${showId}/decisions`).then(r => setDecisions(r.data?.decisions || [])).catch(miss('decisions', () => setDecisions([]))),
        api.get(`/api/v1/feed-posts?show_id=${encodeURIComponent(showId)}&status=draft&limit=100`)
          .then(r => setFeedWaiting(Array.isArray(r.data?.data) ? r.data.data.filter((p) => !p.episode_id).length : null))
          .catch(miss('post drafts', () => setFeedWaiting(null))),
        api.get(`/api/v1/world/${showId}/events`).then(r => setWorldEvents(r.data?.events || [])).catch(miss('events', () => setWorldEvents([]))),
        api.get(`/api/v1/ui-overlays/${showId}`).then(r => setOverlayData(r.data?.data || [])).catch(miss('overlays', () => setOverlayData([]))),
        fetchClosetWithTotal(api, showId).then((list) => {
          setWardrobeItems(list.items);
          setWardrobeTotal(list.total ?? list.items.length);
          partial('wardrobe', list);
        }).catch(miss('wardrobe', () => { setWardrobeItems([]); setWardrobeTotal(null); })),
      ];
      await Promise.allSettled(requests);
      setLoadFailures(failed);
      setPartialLists(partials);
      setLoadFailureKind(failed.length === requests.length ? 'all' : (refresh ? 'refresh' : 'initial'));
      if (failed.length < requests.length) loadedOnceRef.current = true;
    } finally { setLoading(false); }
  };

  const openStatEditor = () => { setStatForm({ ...charState?.state }); setEditingStats(true); };
  const saveStats = async () => {
    setSavingStats(true); setError(null);
    try {
      const res = await api.post(`/api/v1/characters/lala/state/update`, { show_id: showId, ...statForm, source: 'manual', notes: 'Manual edit from World Admin' });
      if (res.data.success) {
        setCharState(p => ({ ...p, state: res.data.state }));
        setEditingStats(false);
        setSuccessMsg('Stats updated!');
        // Refresh the on-page Stat Change Ledger so the entry the backend
        // just wrote (manual delta + history row) shows up immediately
        // instead of waiting for a full page reload.
        try {
          const h = await api.get(`/api/v1/world/${showId}/history`);
          setStateHistory(h.data?.history || []);
        } catch { /* non-blocking */ }
        // The state/update route mirrors coin changes into the financial
        // ledger. Refresh financeConfig so the event-modal Financial
        // Preview (which keys off financeConfig.current_balance) refetches
        // and shows the new balance instead of the stale one.
        if (res.data.deltas?.coins !== undefined) {
          try {
            const fc = await api.get(`/api/v1/shows/${showId}/financial-config`);
            setFinanceConfig(fc.data);
          } catch { /* non-blocking */ }
        }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingStats(false); }
  };

  // The look builder beside the closet (Evoni's redesign, 2026-10-05): the
  // look for the episode in production, against Lala's coins and reputation.
  const lalaState = charState?.state || null;
  const lookCharacter = React.useMemo(() => lalaState || {}, [lalaState]);
  // The Style Page's "Use this look" (Task #3007) names the episode and the
  // audience's pick: ?look_episode=<id>&look_pieces=<id,id>.
  const lookEpisodeParam = searchParams.get('look_episode');
  const lookPiecesParam = searchParams.get('look_pieces');
  const lookStartIds = React.useMemo(() => (lookPiecesParam ? lookPiecesParam.split(',').filter(Boolean) : null), [lookPiecesParam]);
  const lookEpisode = (lookEpisodeParam && episodes.find((ep) => ep.id === lookEpisodeParam)) || episodesInProduction(episodes)[0] || null;
  // Loaded only on the closet, so the other tabs do not fetch the outfit, the event and its forecast.
  const onCloset = activeTab === 'wardrobe' && subTab === 'wardrobe-items';
  const look = useLookDraft({
    episode: onCloset ? lookEpisode : null, showId, characterState: lookCharacter, items: wardrobeItems, onSaved: () => loadData(),
    startIds: lookEpisode && lookEpisode.id === lookEpisodeParam ? lookStartIds : null,
  });
  const lookKeywords = dressCodeKeywords(look.event);

  if (loading) return (
    <div style={S.page}>
      <style>{`
        @keyframes waFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes waShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .wa-skel { background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%); background-size: 800px 100%; animation: waShimmer 1.5s ease infinite; border-radius: 8px; }
      `}</style>
      <div style={{ marginBottom: 20 }}>
        <div className="wa-skel" style={{ width: 200, height: 28, marginBottom: 8 }} />
        <div className="wa-skel" style={{ width: 300, height: 14 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="wa-skel" style={{ width: 90, height: 36 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="wa-skel" style={{ height: 100, borderRadius: 14 }} />)}
      </div>
    </div>
  );

  return (
    <div className="wa-page" style={S.page}>
      <style>{`
        @keyframes waFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .wa-page .wa-grid { gap: 12px; }
        @media (max-width: 768px) {
          .wa-page .wa-grid-3col { grid-template-columns: 1fr !important; }
          .wa-page .wa-grid-5col { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .wa-page { padding: 12px 14px !important; }
        }
      `}</style>
      {/* Inject keyframes for toast animation */}
      <style>{`
        @keyframes toastPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes toastFade {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @media (max-width: 640px) {
          .wa-tab-bar::-webkit-scrollbar { display: none; }
        }
      `}</style>
      {/* ─── HEADER: the show card (Evoni's redesign, 2026-10-05) ─── */}
      {(() => {
        const producing = episodesInProduction(episodes)[0] || null;
        const season = producing?.season_number
          ?? (episodes.length ? Math.max(...episodes.map((e) => e.season_number || 0)) || null : null);
        return (
          <header className="wa-hero" data-testid="wa-hero">
            <button type="button" className="wa-hero-refresh" onClick={loadData} aria-label="Refresh" title="Refresh">
              <RotateCw size={16} aria-hidden="true" />
            </button>
            <Link className="wa-hero-back" to="/shows"><ArrowLeft size={14} aria-hidden="true" /> Back to Shows</Link>
            <h1 className="wa-hero-title">Producer Mode</h1>
            <div className="wa-hero-chips">
              {/* With several shows the chip is the switcher: an invisible select over it. */}
              <span className={`wa-chip wa-chip-show${allShows.length > 1 ? ' switchable' : ''}`}>
                <span data-testid="wa-show-name">{show?.name || 'Loading show…'}</span>
                {allShows.length > 1 && (
                  <>
                    <ChevronDown size={14} aria-hidden="true" />
                    <select
                      className="wa-chip-select"
                      aria-label="Show"
                      value={showId}
                      onChange={(e) => navigate(`/shows/${e.target.value}/world?tab=${encodeURIComponent(searchParams.get('tab') || 'overview')}`)}
                    >
                      {allShows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </>
                )}
              </span>
              {/* Both pills are links (Evoni, 2026-10-25): the season to its page, the episode in production to its own. */}
              {season ? (
                <Link className="wa-chip wa-chip-season" to={seasonPageHref(showId)} data-testid="wa-chip-season">
                  Season {season} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : null}
              {producing ? (
                <Link className="wa-chip wa-chip-producing" to={`/episodes/${producing.id}`} data-testid="wa-chip-producing">
                  Producing Episode {producing.episode_number ?? ''} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="wa-hero-links">
              {/* The show menu: the show's own settings live here, not on a separate show page. */}
              <Link className="wa-hero-link" to={`/shows/${showId}/edit`}>Edit show</Link>
              <Link className="wa-hero-link" to={`/admin?tab=show-settings&show=${encodeURIComponent(showId)}`}>Settings</Link>
            </div>
          </header>
        );
      })()}

      {error && <div style={S.errorBanner}>{error}<button onClick={() => setError(null)} style={S.xBtn}>✕</button></div>}
      {loadFailures.length > 0 && (
        <div className="wa-load-failed" role="alert" data-testid="wa-load-failed">
          {loadFailureKind === 'all'
            ? "Couldn't reach the server: nothing loaded. Check the connection, then retry."
            : loadFailureKind === 'refresh'
              ? `Couldn't refresh ${loadFailures.join(', ')}; showing what loaded before.`
              : `Couldn't load ${loadFailures.join(', ')}. Those sections may look empty until they load.`}
          <button type="button" onClick={loadData}>Retry</button>
        </div>
      )}
      {partialLists.length > 0 && (
        <div className="wa-load-failed wa-load-partial" role="status" data-testid="wa-load-partial">
          Some lists did not load in full ({partialLists.join('; ')}). Counts and lists may be short; retry to load the rest.
          <button type="button" onClick={loadData}>Retry</button>
        </div>
      )}
      {successMsg && (
        <div style={S.successBanner}>
          {successMsg}
        </div>
      )}

      {/* ─── TABS ─── */}
      {(() => {
        // The count on a tab is what is waiting there: Lala's post drafts
        // waiting on approval, under World.
        const counts = { world: feedWaiting || 0 };
        return (
          <nav className="wa-tab-bar" aria-label="Producer Mode">
            {TABS.map(t => {
              const n = counts[t.key] || 0;
              // Season is a page of its own, so its entry is a link.
              if (t.page === 'season') {
                return (
                  <Link key={t.key} to={seasonPageHref(showId)} className="wa-tab" data-testid="wa-tab-season">
                    <t.Icon size={15} aria-hidden="true" />
                    <span className="wa-tab-label">{t.label}</span>
                  </Link>
                );
              }
              return (
                <button key={t.key} type="button" onClick={() => switchTab(t.key)} className={`wa-tab${activeTab === t.key ? ' active' : ''}`} aria-current={activeTab === t.key ? 'page' : undefined}>
                  <t.Icon size={15} aria-hidden="true" />
                  <span className="wa-tab-label">{t.label}</span>
                  {n > 0 && <span className="wa-tab-count" aria-label={`${n} waiting`}>{n}</span>}
                </button>
              );
            })}
          </nav>
        );
      })()}
      {/* ─── SUB-TABS ─── */}
      {(() => {
        const currentTab = TABS.find(t => t.key === activeTab);
        if (!currentTab?.subs) return null;
        return (
          <div className="wa-subtabs">
            {currentTab.subs.map(s => (
              <button key={s.key} type="button" onClick={() => { setSubTab(s.key); setSearchParams({ tab: s.key }); }} aria-current={subTab === s.key ? 'page' : undefined} className={`wa-subtab${subTab === s.key ? ' active' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ════════════════════════ OVERVIEW ════════════════════════ */}
      {/* What you're producing, what needs attention, what comes next, what
          changed (ShowOverview). The full state history is in Cast &
          Continuity; tiers are in the Season page's Results. */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          <ShowOverview
            showId={showId}
            episodes={episodes}
            events={worldEvents}
            charState={charState}
            wardrobeCount={wardrobeTotal ?? wardrobeItems.length}
            goTo={goTo}
          />
        </div>
      )}

      {/* ════════════════════════ RATE CARD ════════════════════════ */}
      {activeTab === 'world' && subTab === 'rate-card' && (
        <div style={S.content}><RateCardTab /></div>
      )}

      {/* ════════════════════════ WORLD MOMENTS ════════════════════════ */}
      {activeTab === 'world' && subTab === 'moments' && (
        <div style={S.content}><WorldMomentsTab showId={showId} /></div>
      )}


      {/* ════════════════════════ SCENE SETS ════════════════════════ */}
      {activeTab === 'wardrobe' && subTab === 'scene-sets' && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading scene sets...</div>}>
          <SceneSetsTab showId={showId} />
        </Suspense>
      )}

      {/* ════════════════════════ LALA'S PHONE ════════════════════════ */}
      {activeTab === 'wardrobe' && subTab === 'overlays-tab' && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading phone screens...</div>}>
          <UIOverlaysTab showId={showId} />
        </Suspense>
      )}

      {/* ════════════════════════ UI OVERLAYS (PRODUCTION) ════════════════════════ */}
      {activeTab === 'wardrobe' && subTab === 'production-overlays' && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading overlays...</div>}>
          <ProductionOverlaysTab showId={showId} />
        </Suspense>
      )}

      {/* ════════════════════════ WARDROBE ════════════════════════ */}
      {activeTab === 'wardrobe' && subTab === 'wardrobe-items' && (() => {
        // Group items by SLOT for the summary cards. Uses the shared slot helper
        // so dress/top/bottom/outerwear all roll up under "Outfit", bag+accessory
        // under "Accessories", etc. Items with an unknown category land in
        // __unassigned so we can surface them (rare — usually legacy data).
        const typeGroups = groupItemsBySlot(wardrobeItems);

        // Quick helper — kept outside the filter so both the tab-count badge
        // and the per-item filter share the exact same definition of "used".
        const isItemUsed = (item) => Number(item.times_worn || item.totalUsageCount || item.total_usage_count || 0) > 0;
        const stagingCount = wardrobeItems.filter(i => !isItemUsed(i)).length;
        // Owned or to buy, as the closet's Show row splits it (Evoni's redesign, 2026-10-05).
        const isOwnedPiece = (item) => item.is_owned === true || item.is_owned === 'true';
        const ownedCount = wardrobeItems.filter(isOwnedPiece).length;
        // The Sets pill counts sets, not their pieces: a set shows as one card (Evoni, 2026-10-05).
        const setCount = matchingSetsFrom(wardrobeItems).length;

        const filteredItems = wardrobeItems.filter(item => {
          // Top-tab: staging means never used. Applied before everything else
          // so the count in the tab matches what the grid shows.
          if (wardrobeTopTab === 'staging' && isItemUsed(item)) return false;
          if (wardrobeTopTab === 'owned' && !isOwnedPiece(item)) return false;
          if (wardrobeTopTab === 'to_buy' && isOwnedPiece(item)) return false;
          if (wardrobeTopTab === 'dress_code' && !matchesDressCode(item, lookKeywords)) return false;
          const itemType = item.clothing_category || item.itemType || item.item_type || 'other';
          // Category pill filters by SLOT now — e.g. clicking "Outfit" matches
          // dress, top, bottom, outerwear. Falls back to raw category match if
          // the filter value isn't a known slot key (for legacy call sites).
          if (wardrobeCatFilter === 'sets') {
            if (!item.outfit_set_id) return false;
          } else if (wardrobeCatFilter !== 'all') {
            const itemSlot = getSlotForCategory(itemType);
            const filterIsSlot = SLOT_KEYS.includes(wardrobeCatFilter);
            if (filterIsSlot ? itemSlot !== wardrobeCatFilter : itemType !== wardrobeCatFilter) return false;
          }
          if (wardrobeFilter !== 'all') {
            const searchTerm = wardrobeFilter.toLowerCase();
            const nameMatch = (item.name || '').toLowerCase().includes(searchTerm);
            const descMatch = (item.description || '').toLowerCase().includes(searchTerm);
            const colorMatch = (item.color || '').toLowerCase().includes(searchTerm);
            const vendorMatch = (item.vendor || '').toLowerCase().includes(searchTerm);
            const brandMatch = (item.brand || '').toLowerCase().includes(searchTerm);
            const tagMatch = Array.isArray(item.tags) && item.tags.some(t => (t || '').toLowerCase().includes(searchTerm));
            if (!nameMatch && !descMatch && !colorMatch && !vendorMatch && !brandMatch && !tagMatch) return false;
          }
          // Secondary filter panel — ported from WardrobeBrowser's sidebar.
          if (wardrobeSeasonFilter !== 'all' && (item.season || '').toLowerCase() !== wardrobeSeasonFilter) return false;
          if (wardrobeOccasionFilter !== 'all' && !(item.occasion || '').toLowerCase().includes(wardrobeOccasionFilter)) return false;
          if (wardrobeColorFilter !== 'all' && (item.color || '').toLowerCase() !== wardrobeColorFilter) return false;
          if (wardrobeStatusFilter !== 'all') {
            const used = Number(item.times_worn || item.totalUsageCount || item.total_usage_count || 0) > 0;
            if (wardrobeStatusFilter === 'used' && !used) return false;
            if (wardrobeStatusFilter === 'unused' && used) return false;
            if (wardrobeStatusFilter === 'favorites' && !item.is_favorite) return false;
          }
          return true;
        });

        // Sort — matches the options WardrobeBrowser exposed. Comparator pulled
        // inline to keep all the wardrobe-tab logic co-located inside this IIFE.
        const usageCount = (i) => Number(i.times_worn || i.totalUsageCount || i.total_usage_count || 0);
        const priceOf = (i) => Number(i.price || 0);
        const timeOf = (i, key) => (i[key] ? new Date(i[key]).getTime() : 0);
        filteredItems.sort((a, b) => {
          switch (wardrobeSort) {
            case 'name':       return (a.name || '').localeCompare(b.name || '');
            case 'price_asc':  return priceOf(a) - priceOf(b);
            case 'price_desc': return priceOf(b) - priceOf(a);
            case 'most_used':  return usageCount(b) - usageCount(a);
            case 'last_used':  return timeOf(b, 'last_worn_date') - timeOf(a, 'last_worn_date');
            case 'favorites':  return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
            case 'recent':
            default:           return timeOf(b, 'created_at') - timeOf(a, 'created_at');
          }
        });

        // Pagination — slice after sort. `visibleItems` is what the grid
        // renders; bulk ops still operate on all `filteredItems` so a selection
        // across pages survives navigation.
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / WARDROBE_PAGE_SIZE));
        const currentPage = Math.min(wardrobePage, totalPages);
        const pageStart = (currentPage - 1) * WARDROBE_PAGE_SIZE;
        const visibleItems = filteredItems.slice(pageStart, pageStart + WARDROBE_PAGE_SIZE);
        // Sets: one card per matching set among the filtered pieces, showing
        // every piece of the set side by side (not paged; sets are few).
        const setView = wardrobeCatFilter === 'sets';
        const setCards = setView
          ? matchingSetsFrom(filteredItems).map((set) => ({ ...set, pieces: setPiecesOf(set.pieces[0], wardrobeItems) }))
          : [];

        const openEditItem = (item) => {
          setEditingWardrobeItem(item);
          setRealDraft(realDraftFrom(item));
          setWardrobeEditBrandIsFictional(false);
          setWardrobeForm({
            name: item.name || '',
            description: item.description || '',
            itemType: item.clothing_category || item.itemType || item.item_type || '',
            color: item.color || '',
            defaultSeason: item.season || item.defaultSeason || item.default_season || '',
            defaultOccasion: item.occasion || item.defaultOccasion || item.default_occasion || '',
            defaultCharacter: item.character || item.defaultCharacter || item.default_character || 'Lala',
            vendor: item.brand || item.vendor || '',
            price: item.price || '',
            website: item.website || item.purchase_link || '',
            tags: Array.isArray(item.tags) ? item.tags.join(', ') : (typeof item.tags === 'string' ? item.tags : ''),
            // Game-layer fields — hydrate from the row so the edit form shows what
            // the backend has today. Empty string (not null) so controlled inputs
            // stay controlled.
            tier: item.tier || '',
            coin_cost: item.coin_cost ?? '',
            acquisition_type: item.acquisition_type || 'purchased',
            lock_type: item.lock_type || 'none',
            era_alignment: item.era_alignment || '',
            reputation_required: item.reputation_required ?? '',
            // Advanced gameplay — JSONB arrays show as CSV in the UI; numbers
            // and booleans hydrate from the row. is_visible defaults true so
            // items predating the flag still render as visible.
            aesthetic_tags: Array.isArray(item.aesthetic_tags) ? item.aesthetic_tags.join(', ') : (item.aesthetic_tags || ''),
            event_types: Array.isArray(item.event_types) ? item.event_types.join(', ') : (item.event_types || ''),
            outfit_match_weight: item.outfit_match_weight ?? '',
            influence_required: item.influence_required ?? '',
            season_unlock_episode: item.season_unlock_episode ?? '',
            is_owned: !!item.is_owned,
            is_visible: item.is_visible !== false,
            lala_reaction_own: item.lala_reaction_own || '',
            lala_reaction_locked: item.lala_reaction_locked || '',
            lala_reaction_reject: item.lala_reaction_reject || '',
          });
        };

        // Return { variant, url } picking the right S3 variant for grid/card
        // display. Honors user's primary_image_variant choice first; otherwise
        // falls back to the default preference chain (regenerated wins).
        const resolveItemImageUrl = (item) => {
          if (!item) return { variant: null, url: null };
          const byVariant = {
            regenerated: item.s3_url_regenerated,
            processed: item.s3_url_processed,
            original: item.s3_url || item.image_url,
          };
          const pick = item.primary_image_variant;
          if (pick && byVariant[pick]) return { variant: pick, url: byVariant[pick] };
          if (byVariant.regenerated) return { variant: 'regenerated', url: byVariant.regenerated };
          if (byVariant.processed) return { variant: 'processed', url: byVariant.processed };
          if (byVariant.original) return { variant: 'original', url: byVariant.original };
          return { variant: null, url: null };
        };

        // PATCH primary_image_variant — the value shown in the grid card.
        // null = "auto", same as no preference.
        const promoteToPrimary = async (item, variant) => {
          if (promotingVariant) return;
          setPromotingVariant(true);
          try {
            await promoteWardrobePrimaryVariantApi(item.id, variant);
            setWardrobeItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, primary_image_variant: variant } : i
            ));
            setLightboxItem(prev => (prev && prev.id === item.id)
              ? { ...prev, primary_image_variant: variant } : prev);
          } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message;
            alert(`Couldn't set default: ${msg}`);
          } finally {
            setPromotingVariant(false);
          }
        };

        // Promote a colored-backdrop variant to a phone screen (its own
        // ui_overlay_types row, so Lala's Phone lists it; Evoni 2026-10-07).
        // After creation, switch into Lala's Phone so tap zones and content
        // areas can be drawn on the new screen.
        const handleSendToPhone = async (item, variant) => {
          if (sendingToPhone) return;
          if (!['pink', 'blue', 'teal'].includes(variant)) {
            alert('Pick one of the colored backdrop variants (pink, blue, or teal) before sending to phone.');
            return;
          }
          if (!confirm(
            `Send "${item.name}" (${variant} backdrop) to Lala's phone?\n\n` +
            `Makes a phone screen from this backdrop (or replaces the one you sent before). You'll be taken to Lala's Phone to draw tap zones and content areas on it.`
          )) return;

          setSendingToPhone(true);
          try {
            const result = await sendWardrobeToPhoneApi(item.id, { variant, showId });
            // Close the lightbox and open Lala's Phone, which lists the new
            // screen through GET /api/v1/ui-overlays/:showId.
            setLightboxVariant(null);
            setLightboxItem(null);
            setSubTab('overlays-tab');
            setSearchParams({ tab: 'overlays-tab' });
            alert(`Sent to phone as "${result.data.name}". Opening Lala's Phone…`);
          } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            alert(`Send to phone failed: ${msg}`);
          } finally {
            setSendingToPhone(false);
          }
        };

        // Kick off an AI regeneration of the item as a clean studio product
        // shot (Flux Kontext img2img). Preserves the original image; the
        // regenerated variant lands on s3_url_regenerated and the grid/
        // lightbox prefer it automatically once present.
        const handleRegenerateProductShot = async (item, e) => {
          if (e) e.stopPropagation();
          if (regeneratingItemId) return;
          if (!confirm(
            `Regenerate "${item.name}" as a studio product shot?\n\n` +
            `Uses AI image-to-image (~$0.04). The original photo is preserved; ` +
            `the polished version replaces the visible card image when ready.`
          )) return;

          setRegeneratingItemId(item.id);
          try {
            let result;
            try {
              result = await regenerateWardrobeProductShotApi(item.id);
            } catch (httpErr) {
              const msg = httpErr.response?.data?.error || httpErr.response?.data?.message || httpErr.message;
              throw new Error(msg);
            }
            const newUrl = result.data?.s3_url_regenerated;
            if (!newUrl) throw new Error('No regenerated URL returned');

            // Reflect in the grid immediately.
            setWardrobeItems(prev => prev.map(i =>
              i.id === item.id
                ? { ...i, s3_url_regenerated: newUrl, regeneration_status: 'success' }
                : i
            ));
            // And in the open lightbox if it's still this item.
            setLightboxItem(prev => (prev && prev.id === item.id)
              ? { ...prev, s3_url_regenerated: newUrl, regeneration_status: 'success' }
              : prev);

            alert('Product shot regenerated!');
          } catch (err) {
            alert(`Regeneration failed: ${err.message}`);
          } finally {
            setRegeneratingItemId(null);
          }
        };

        const saveWardrobeItem = async () => {
          if (!editingWardrobeItem) return;
          setSavingWardrobe(true); setError(null);
          try {
            // CSV → array for tag buckets. The PUT handler JSON.parses these,
            // so we send actual arrays instead of CSV strings. Empty string
            // becomes undefined so we don't wipe existing values on save.
            const csvToArray = (v) => typeof v === 'string' && v.trim()
              ? v.split(',').map(s => s.trim()).filter(Boolean)
              : undefined;
            const payload = {
              ...wardrobeForm,
              tags: wardrobeForm.tags ? wardrobeForm.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
              aesthetic_tags: csvToArray(wardrobeForm.aesthetic_tags),
              event_types: csvToArray(wardrobeForm.event_types),
              price: wardrobeForm.price ? parseFloat(wardrobeForm.price) : null,
              // Only the real-world fields she changed; the rest stay as stored.
              ...realChanges(editingWardrobeItem, realDraft),
            };
            const res = await api.put(`/api/v1/wardrobe/${editingWardrobeItem.id}`, payload);
            if (res.data.success) {
              setWardrobeItems(prev => prev.map(i => i.id === editingWardrobeItem.id ? { ...i, ...res.data.data } : i));
              setEditingWardrobeItem(null);
              setSuccessMsg('Wardrobe item updated!');
              setToast('Item saved!'); setTimeout(() => setToast(null), 2500);
            }
          } catch (err) { setError(realWorldErrorText(err) || err.response?.data?.error || err.message); }
          finally { setSavingWardrobe(false); }
        };

        const deleteWardrobeItem = async (item) => {
          if (!window.confirm(`Delete "${item.name}"?`)) return;
          try {
            const res = await api.delete(`/api/v1/wardrobe/${item.id}`);
            if (res.data.success) {
              setWardrobeItems(prev => prev.filter(i => i.id !== item.id));
              setEditingWardrobeItem(null);
              setSuccessMsg('Item deleted');
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
        };

        const wf = wardrobeForm;
        const setWf = (key, val) => setWardrobeForm(prev => ({ ...prev, [key]: val }));

        // Helper: check if item was used in last 3 episodes (continuity warning)
        const recentlyUsedItems = new Set(
          wardrobeItems
            .filter(item => (item.lastUsedAt || item.last_used_at) && 
              (Date.now() - new Date(item.lastUsedAt || item.last_used_at).getTime()) < 14 * 24 * 60 * 60 * 1000)
            .map(i => i.id)
        );

        // Bulk delete handler
        const bulkDeleteSelected = async () => {
          if (selectedWardrobeIds.size === 0) return;
          if (!window.confirm(`Delete ${selectedWardrobeIds.size} selected items?`)) return;
          const toDelete = [...selectedWardrobeIds];
          for (const id of toDelete) {
            try {
              await api.delete(`/api/v1/wardrobe/${id}`);
              setWardrobeItems(prev => prev.filter(i => i.id !== id));
            } catch (err) { console.error('Failed to delete', id, err); }
          }
          setSelectedWardrobeIds(new Set());
          setToast(`Deleted ${toDelete.length} items`);
          setTimeout(() => setToast(null), 2500);
        };

        // Toggle selection
        const toggleSelectItem = (e, itemId) => {
          e.stopPropagation();
          setSelectedWardrobeIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
          });
        };

        return (
          <div style={S.content}>
            {/* Header */}
            {/* Header to Evoni's redesign (2026-10-05): Full Closet, the
                search and Add piece; the closet's tools stay, under them. */}
            <div className="wa-wd-head">
              <div className="wa-wd-head-title">
                <h2>Full Closet</h2>
                <span data-testid="wardrobe-count">{wardrobeItems.length} pieces</span>
              </div>
              <label className="wa-wd-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Search the closet"
                  placeholder="Search by name, brand, color"
                  value={wardrobeFilter === 'all' ? '' : wardrobeFilter}
                  onChange={e => setWardrobeFilter(e.target.value || 'all')}
                />
              </label>
              <button type="button" className="wa-wd-add" onClick={() => setShowWardrobeUpload(true)}>
                <Plus size={14} aria-hidden="true" /> Add piece
              </button>
              <button type="button" className="wa-wd-add" onClick={() => setShowOrderImport(true)} data-testid="wardrobe-import-orders">
                <FileUp size={14} aria-hidden="true" /> Import orders
              </button>
              <div className="wa-wd-tools">
                {/* Bulk selection indicator */}
                {selectedWardrobeIds.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--warning-bg)', borderRadius: 6, border: '1px solid var(--warning-border)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning-text)' }}>{selectedWardrobeIds.size} selected</span>
                    <button onClick={() => setSelectedWardrobeIds(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: 'var(--warning-text)' }}>✕</button>
                    <button onClick={() => { setOutfitSetName(''); setShowCreateOutfitSet(true); }} style={{ padding: '2px 8px', background: 'var(--lala-lavender)', color: 'var(--text-inverse)', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>👗 Create set</button>
                    <button onClick={bulkDeleteSelected} style={{ padding: '2px 8px', background: 'var(--danger)', color: 'var(--text-inverse)', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>🗑️ Delete</button>
                  </div>
                )}
                {/* Grid / list toggle — list mode trades thumbnail size for more
                    metadata per row, which is useful once libraries get large. */}
                <div style={{ display: 'inline-flex', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, overflow: 'hidden' }}>
                  {['grid', 'list'].map(mode => (
                    <button key={mode} onClick={() => setWardrobeViewMode(mode)} title={`${mode} view`}
                      style={{
                        padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: 'none',
                        background: wardrobeViewMode === mode ? 'var(--lala-lavender)' : 'var(--surface-card)',
                        color: wardrobeViewMode === mode ? 'var(--text-inverse)' : 'var(--text-secondary)',
                      }}>{mode === 'grid' ? '▦' : '≣'}</button>
                  ))}
                </div>
                {/* Finance pill — shows live balance + opens editor for
                    starting balance and goal ladder. Stays compact: when
                    there's no next goal (Legacy reached), just the balance. */}
                <button
                  type="button"
                  onClick={() => goTo('finances')}
                  data-testid="wardrobe-finance-pill"
                  title="Open Lala's Finances (Cast & Continuity): balance, trend, per-episode P&L and goal ladder"
                  style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  💰 {(financeConfig?.current_balance ?? 0).toLocaleString()}
                  {financeConfig?.next_goal && (
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>→ {financeConfig.next_goal.label.replace(/[🌟👑💎🏆✨]\s*/, '')}</span>
                  )}
                </button>
                <button onClick={() => window.open('/wardrobe/calendar', '_blank')} style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px' }}>📅 Calendar</button>
                {/* "Require all slots" toggle — when on, the outfit scorer marks
                    every slot (jewelry, accessories, fragrance included) as
                    required for this show. Persists to Show.metadata.required_slots. */}
                {(() => {
                  // Every slot, Hair included (Task #3167).
                  const allSlots = SLOT_KEYS;
                  const current = Array.isArray(show?.metadata?.required_slots) ? show.metadata.required_slots : null;
                  const requireAll = current && allSlots.every(s => current.includes(s));
                  const label = requireAll ? '✓ All slots required' : 'Require all slots';
                  return (
                    <button
                      onClick={async () => {
                        const next = requireAll ? ['outfit', 'shoes'] : allSlots;
                        try {
                          await api.put(`/api/v1/shows/${showId}/wardrobe-config`, { required_slots: next });
                          setShow(prev => prev ? { ...prev, metadata: { ...(prev.metadata || {}), required_slots: next } } : prev);
                          setToast(requireAll ? 'Outfit + shoes required' : `All ${allSlots.length} slots required`);
                        } catch (err) {
                          setToast('Could not save: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                      title="Toggle whether every slot (including jewelry, accessories, fragrance) is required when scoring outfits against events"
                      style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px', background: requireAll ? 'var(--warning-bg)' : undefined, borderColor: requireAll ? 'var(--warning-border)' : undefined, color: requireAll ? 'var(--warning-text)' : undefined }}
                    >{label}</button>
                  );
                })()}
                {/* Bulk ops — kept behind a ⚡ menu-on-button so the toolbar doesn't get
                    cluttered. Each action confirms before calling an expensive endpoint
                    (AI analyze costs tokens). `window.confirm` is used for parity with
                    the alert-based UX users already know from WardrobeBrowser. */}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <details style={{ position: 'relative' }}>
                    <summary style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px', listStyle: 'none', cursor: 'pointer', userSelect: 'none' }}>
                      ⚡ Bulk ops
                    </summary>
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 50, padding: 6 }}>
                      {[
                        { label: '✨ AI-enhance first 20', endpoint: '/api/v1/wardrobe/bulk/enhance', bodyFactory: () => ({ itemIds: filteredItems.slice(0, 20).map(i => i.id) }), confirmText: (n) => `Enhance ${n} items? This may take a while.`, emptyText: 'No items to enhance' },
                        { label: '🔍 AI-analyze first 20', endpoint: '/api/v1/wardrobe/bulk/analyze', bodyFactory: () => ({ itemIds: filteredItems.slice(0, 20).map(i => i.id), autoApply: true }), confirmText: (n) => `Analyze ${n} items with AI? This uses API credits.`, emptyText: 'No items to analyze' },
                        { label: '🖼 Regenerate missing thumbnails', endpoint: '/api/v1/wardrobe/bulk/regenerate-thumbnails', bodyFactory: () => ({ limit: 50 }), confirmText: () => 'Regenerate thumbnails for up to 50 items that are missing them?', emptyText: null },
                        { label: '💰 Sync coin costs from prices', endpoint: `/api/v1/wardrobe/bulk/sync-coin-costs?show_id=${showId}`, bodyFactory: () => ({}), confirmText: () => 'Set coin_cost = price (1:1) for items that don\'t have one yet? Items with a manual coin_cost are left alone.', emptyText: null },
                      ].map(op => (
                        <button key={op.endpoint} onClick={async () => {
                          const body = op.bodyFactory();
                          const count = body.itemIds?.length;
                          if (op.emptyText && count === 0) { setToast(op.emptyText); return; }
                          if (!window.confirm(op.confirmText(count))) return;
                          try {
                            // Data-driven URL pass-through (v2.20 §9.11). Config array
                            // at lines 5539-5542 enumerates 4 variants; method+payload+
                            // headers are uniform; URLs file-internal — Option B applies.
                            let data;
                            try {
                              data = await bulkWardrobeOpApi(op.endpoint, body);
                            } catch (httpErr) {
                              throw new Error(httpErr.response?.data?.error || 'Operation failed');
                            }
                            // Endpoints report either { succeeded, failed } or { processed, failed } — show both shapes.
                            const succ = data.data?.succeeded?.length ?? data.data?.processed ?? 0;
                            const fail = data.data?.failed?.length ?? data.data?.failed ?? 0;
                            setToast(`Done: ${succ} ok, ${fail} failed`);
                            // Reload via the existing effect that fetches wardrobeItems when showId changes.
                            // Trigger that path by re-fetching manually:
                            try { const j = await listShowWardrobeApi(showId); if (j?.data) setWardrobeItems(j.data); } catch {}
                          } catch (err) {
                            setToast(`Bulk op failed: ${err.message}`);
                          }
                        }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, borderRadius: 6, color: 'var(--text-primary)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--lala-parchment-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >{op.label}</button>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* Category pills, with the counts the slot summary cards carried
                (they filter by SLOT: dress, top, bottom and outerwear roll up
                under Outfit, bag and accessory under Accessories); Sets is the
                pieces in a matching set. Choosing the active pill again clears it. */}
            <div className="wa-wd-pills" role="group" aria-label="Filter by category">
              {[
                { key: 'all', label: 'All', count: wardrobeItems.length },
                { key: 'sets', label: 'Sets', count: setCount },
                ...SLOT_KEYS.map(k => ({ key: k, label: SLOT_DEFS[k].label, count: (typeGroups[k] || []).length, title: SLOT_DEFS[k].desc })),
              ].map(opt => {
                const on = wardrobeCatFilter === opt.key;
                return (
                  <button key={opt.key} type="button" data-testid={`wardrobe-cat-${opt.key}`} aria-pressed={on} title={opt.title}
                    className={`wa-wd-pill${on ? ' active' : ''}`}
                    onClick={() => { setWardrobeCatFilter(on && opt.key !== 'all' ? 'all' : opt.key); setWardrobePage(1); }}>
                    {opt.label} <span className="wa-wd-pill-count">{opt.count}</span>
                  </button>
                );
              })}
              {(typeGroups.__unassigned?.length > 0) && (
                <span className="wa-wd-unassigned" title="These items have a clothing_category that doesn't map to any slot — edit to fix">
                  ⚠️ {typeGroups.__unassigned.length} unassigned
                </span>
              )}
            </div>

            {/* The Show row: everything, what Lala owns, what she would have to
                buy, and staging (never used). Sort and the advanced filters sit
                at its end. */}
            <div className="wa-wd-show">
              <span className="wa-wd-show-label">Show:</span>
              {[
                { key: 'all', label: 'Everything', count: wardrobeItems.length },
                { key: 'owned', label: 'Lala owns', count: ownedCount },
                { key: 'to_buy', label: 'To buy', count: wardrobeItems.length - ownedCount },
                { key: 'staging', label: 'Never used', count: stagingCount },
                // Matches the dress code of the episode's event, when it has one.
                ...(lookKeywords.length ? [{ key: 'dress_code', label: 'Matches dress code', count: wardrobeItems.filter(i => matchesDressCode(i, lookKeywords)).length }] : []),
              ].map(opt => {
                const on = wardrobeTopTab === opt.key;
                return (
                  <button key={opt.key} type="button" data-testid={`wardrobe-show-${opt.key}`} aria-pressed={on}
                    className={`wa-wd-show-btn${on ? ' active' : ''}`}
                    onClick={() => { setWardrobeTopTab(opt.key); setWardrobePage(1); }}>
                    {opt.label} <span className="wa-wd-pill-count">{opt.count}</span>
                  </button>
                );
              })}
              <span className="wa-wd-show-end">
                <select
                  value={wardrobeSort}
                  onChange={e => setWardrobeSort(e.target.value)}
                  title="Sort wardrobe items"
                  aria-label="Sort the closet"
                  className="wa-wd-sort"
                >
                  <option value="recent">Recently added</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="price_asc">Price (low → high)</option>
                  <option value="price_desc">Price (high → low)</option>
                  <option value="most_used">Most used</option>
                  <option value="last_used">Last used</option>
                  <option value="favorites">Favorites first</option>
                </select>
                {/* Filters toggle — keeps the advanced panel out of the way by default.
                    Badge counts the non-default filters. */}
                {(() => {
                  const extraCount = [wardrobeSeasonFilter, wardrobeOccasionFilter, wardrobeColorFilter, wardrobeStatusFilter].filter(v => v !== 'all').length;
                  return (
                    <button type="button" onClick={() => setWardrobeFiltersOpen(o => !o)} aria-expanded={wardrobeFiltersOpen}
                      className={`wa-wd-show-btn${wardrobeFiltersOpen || extraCount > 0 ? ' active' : ''}`}>
                      ⚙ Filters{extraCount > 0 ? ` (${extraCount})` : ''}
                    </button>
                  );
                })()}
              </span>
            </div>

            {/* Advanced filter panel — status, season, occasion, color swatches */}
            {wardrobeFiltersOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16, padding: '12px 14px', background: 'var(--surface-bg)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)' }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={wardrobeStatusFilter} onChange={e => setWardrobeStatusFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">All items</option>
                    <option value="used">Used at least once</option>
                    <option value="unused">Never used</option>
                    <option value="favorites">♥ Favorites only</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Season</label>
                  <select value={wardrobeSeasonFilter} onChange={e => setWardrobeSeasonFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">Any season</option>
                    {['spring', 'summer', 'fall', 'winter', 'all-season'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Occasion</label>
                  <select value={wardrobeOccasionFilter} onChange={e => setWardrobeOccasionFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">Any occasion</option>
                    {['gala', 'casual', 'formal', 'business', 'party', 'brunch', 'date_night', 'resort', 'editorial'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Color</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button onClick={() => setWardrobeColorFilter('all')} style={{
                      padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: wardrobeColorFilter === 'all' ? 'var(--primary)' : 'var(--surface-card)',
                      color: wardrobeColorFilter === 'all' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                      border: `1px solid ${wardrobeColorFilter === 'all' ? 'var(--primary)' : 'var(--lala-parchment-3)'}`,
                    }}>Any</button>
                    {Object.entries(COLOR_TO_HEX).map(([name, hex]) => {
                      const active = wardrobeColorFilter === name;
                      return (
                        <button key={name} onClick={() => setWardrobeColorFilter(active ? 'all' : name)} title={name} style={{
                          padding: '2px 6px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: active ? 'var(--primary)' : 'var(--surface-card)',
                          color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                          border: `1px solid ${active ? 'var(--primary)' : 'var(--lala-parchment-3)'}`,
                        }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: hex, border: '1px solid rgba(0,0,0,0.2)' }} />
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Clear-all: bulk reset so users don't have to touch each dropdown. Hidden when nothing is set. */}
                {(wardrobeSeasonFilter !== 'all' || wardrobeOccasionFilter !== 'all' || wardrobeColorFilter !== 'all' || wardrobeStatusFilter !== 'all') && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setWardrobeSeasonFilter('all'); setWardrobeOccasionFilter('all'); setWardrobeColorFilter('all'); setWardrobeStatusFilter('all'); }}
                      style={{ padding: '5px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear filters</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Edit Panel ─── */}
            {editingWardrobeItem && (
              <div style={{
                background: 'var(--surface-card)', border: '2px solid var(--primary)', borderRadius: 14, padding: 24, marginBottom: 16,
                boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(editingWardrobeItem.s3_url_processed || editingWardrobeItem.s3_url || editingWardrobeItem.thumbnail_url || editingWardrobeItem.image_url) && (
                      <img src={editingWardrobeItem.s3_url_processed || editingWardrobeItem.s3_url || editingWardrobeItem.thumbnail_url || editingWardrobeItem.image_url}
                        alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    )}
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Editing: {editingWardrobeItem.name}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => deleteWardrobeItem(editingWardrobeItem)} style={S.smBtnDanger}>Delete</button>
                    <button onClick={() => setEditingWardrobeItem(null)} style={S.smBtn}>Close</button>
                  </div>
                </div>

                {/* Row 1: Name, Type, Color, Character */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }} className="wa-grid wa-grid-4col">
                  <div>
                    <label style={S.fLabel}>Name</label>
                    <input value={wf.name} onChange={e => setWf('name', e.target.value)} style={S.inp} />
                  </div>
                  <div>
                    <label style={S.fLabel}>Type</label>
                    {/* Same slot-grouped structure as the upload modal so authors see
                        a consistent category picker whether they're creating or editing. */}
                    <select value={wf.itemType} onChange={e => setWf('itemType', e.target.value)} style={S.sel}>
                      <option value="">Select...</option>
                      {SLOT_KEYS.map(slot => (
                        <optgroup key={slot} label={`${SLOT_DEFS[slot].icon} ${SLOT_DEFS[slot].label}`}>
                          {SLOT_SUBCATEGORIES[slot].map(sub => (
                            <option key={sub.value} value={sub.value}>{sub.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Color</label>
                    <input value={wf.color} onChange={e => setWf('color', e.target.value)} style={S.inp} />
                  </div>
                  <div>
                    <label style={S.fLabel}>Character</label>
                    <input value={wf.defaultCharacter} onChange={e => setWf('defaultCharacter', e.target.value)} style={S.inp} placeholder="Lala, JustAWoman..." />
                  </div>
                </div>

                {/* Row 2: Season, Occasion, Vendor, Price */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }} className="wa-grid wa-grid-4col">
                  <div>
                    <label style={S.fLabel}>Season</label>
                    <select value={wf.defaultSeason} onChange={e => setWf('defaultSeason', e.target.value)} style={S.sel}>
                      <option value="">Any</option>
                      {['spring', 'summer', 'fall', 'winter'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Occasion</label>
                    <input value={wf.defaultOccasion} onChange={e => setWf('defaultOccasion', e.target.value)} style={S.inp} placeholder="gala, casual, editorial..." />
                  </div>
                  <div>
                    <label style={S.fLabel}>Vendor</label>
                    <input value={wf.vendor} onChange={e => { setWardrobeEditBrandIsFictional(false); setWf('vendor', e.target.value); }} style={S.inp} placeholder="Brand name..." />
                    {wardrobeEditBrandIsFictional && (
                      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace" }}>
                        Fictional brand (auto-filled)
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.fLabel}>Price</label>
                    <input type="number" value={wf.price} onChange={e => setWf('price', e.target.value)} style={S.inp} min="0" step="0.01" placeholder="0.00" />
                  </div>
                </div>

                {/* Row 3: Description */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.fLabel}>Description</label>
                  <textarea value={wf.description} onChange={e => setWf('description', e.target.value)} style={{ ...S.tArea, minHeight: 60 }} placeholder="Describe the piece..." />
                </div>

                {/* Row 4: Tags, Website */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={S.fLabel}>Tags <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(comma-separated)</span></label>
                    <input value={wf.tags} onChange={e => setWf('tags', e.target.value)} style={S.inp} placeholder="elegant, evening, silk" />
                  </div>
                  <div>
                    <label style={S.fLabel}>Website URL</label>
                    <input value={wf.website} onChange={e => setWf('website', e.target.value)} style={S.inp} placeholder="https://..." />
                  </div>
                </div>

                {/* ── Gameplay section ─────────────────────────────────
                    Same grid the upload modal uses so creators see consistent
                    fields whether they're authoring or editing. Backend PUT
                    already accepts all of these via updates.*. */}
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 10 }}>🎮 GAMEPLAY</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 10 }}>
                    <div>
                      <label style={S.fLabel}>Tier</label>
                      <select value={wf.tier || ''} onChange={e => setWf('tier', e.target.value)} style={S.sel}>
                        <option value="">Auto</option>
                        <option value="basic">👟 Basic — Fast Fashion</option>
                        <option value="mid">👠 Mid — Contemporary</option>
                        <option value="luxury">💎 Luxury — Designer</option>
                        <option value="elite">👑 Elite — Haute Couture</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.fLabel}>Story Price (coins)</label>
                      <input type="number" min="0" step="1" value={wf.coin_cost ?? ''} onChange={e => setWf('coin_cost', e.target.value)} style={S.inp} placeholder="e.g., 2400" />
                    </div>
                    <div>
                      <label style={S.fLabel}>How Lala Got It</label>
                      <select value={wf.acquisition_type || 'purchased'} onChange={e => setWf('acquisition_type', e.target.value)} style={S.sel}>
                        {['purchased', 'gifted', 'borrowed', 'rented', 'custom', 'vintage'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <label style={S.fLabel}>Lock Type</label>
                      <select value={wf.lock_type || 'none'} onChange={e => setWf('lock_type', e.target.value)} style={S.sel}>
                        <option value="none">None (always available)</option>
                        <option value="coin">🪙 Coin</option>
                        <option value="reputation">⭐ Reputation</option>
                        <option value="brand_exclusive">🔒 Brand exclusive</option>
                        <option value="season_drop">📅 Season drop</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.fLabel}>Era Alignment</label>
                      <select value={wf.era_alignment || ''} onChange={e => setWf('era_alignment', e.target.value)} style={S.sel}>
                        <option value="">Any era</option>
                        {['foundation', 'glow_up', 'luxury', 'prime', 'legacy'].map(e2 => <option key={e2} value={e2}>{e2}</option>)}
                      </select>
                    </div>
                    {/* Rep-required only visible when the lock type asks for it. */}
                    {wf.lock_type === 'reputation' && (
                      <div>
                        <label style={S.fLabel}>Reputation Required</label>
                        <input type="number" min="0" step="1" value={wf.reputation_required ?? ''} onChange={e => setWf('reputation_required', e.target.value)} style={S.inp} placeholder="e.g., 5" />
                      </div>
                    )}
                  </div>

                  {/* Advanced gameplay — same collapsible shape as the upload modal. */}
                  <details style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--lala-gold-line)' }}>
                    <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
                      ⋯ advanced gameplay
                    </summary>
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={S.fLabel}>Lala reaction (when owned)</label>
                        <textarea rows={2} value={wf.lala_reaction_own || ''} onChange={e => setWf('lala_reaction_own', e.target.value)} style={{ ...S.tArea, minHeight: 44 }} placeholder="e.g., 'My ride-or-die for red carpets'" />
                      </div>
                      <div>
                        <label style={S.fLabel}>Lala reaction (when locked)</label>
                        <textarea rows={2} value={wf.lala_reaction_locked || ''} onChange={e => setWf('lala_reaction_locked', e.target.value)} style={{ ...S.tArea, minHeight: 44 }} placeholder="e.g., 'One day...'" />
                      </div>
                      <div>
                        <label style={S.fLabel}>Lala reaction (when rejected)</label>
                        <textarea rows={2} value={wf.lala_reaction_reject || ''} onChange={e => setWf('lala_reaction_reject', e.target.value)} style={{ ...S.tArea, minHeight: 44 }} placeholder="e.g., 'Not the vibe for tonight'" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={S.fLabel}>Aesthetic Tags <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(CSV)</span></label>
                          <input value={wf.aesthetic_tags || ''} onChange={e => setWf('aesthetic_tags', e.target.value)} style={S.inp} placeholder="romantic, bold, editorial" />
                        </div>
                        <div>
                          <label style={S.fLabel}>Event Types <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(CSV)</span></label>
                          <input value={wf.event_types || ''} onChange={e => setWf('event_types', e.target.value)} style={S.inp} placeholder="gala, brunch, meetup" />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div>
                          <label style={S.fLabel}>Match Weight (1-10)</label>
                          <input type="number" min="1" max="10" step="1" value={wf.outfit_match_weight ?? ''} onChange={e => setWf('outfit_match_weight', e.target.value)} style={S.inp} placeholder="5" />
                        </div>
                        <div>
                          <label style={S.fLabel}>Influence Required</label>
                          <input type="number" min="0" step="1" value={wf.influence_required ?? ''} onChange={e => setWf('influence_required', e.target.value)} style={S.inp} placeholder="0" />
                        </div>
                        <div>
                          <label style={S.fLabel}>Unlock Episode #</label>
                          <input type="number" min="1" step="1" value={wf.season_unlock_episode ?? ''} onChange={e => setWf('season_unlock_episode', e.target.value)} style={S.inp} placeholder="1" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          <input type="checkbox" checked={!!wf.is_owned} onChange={e => setWf('is_owned', e.target.checked)} />
                          Lala already owns it
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          <input type="checkbox" checked={wf.is_visible !== false} onChange={e => setWf('is_visible', e.target.checked)} />
                          Visible in closet
                        </label>
                      </div>
                    </div>
                  </details>

                  {/* Real world (Task #3019): what she bought; Shop the Look only. */}
                  <RealWorldFields value={realDraft} onChange={setRealDraft} disabled={savingWardrobe}
                    source={editingWardrobeItem.real_source || null} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.textContent = '⏳ Enhancing...';
                    try {
                      // Server-fetch path: pass wardrobe_id so the backend pulls
                      // the image from S3 itself. Avoids the browser CORS block
                      // that was producing "Failed to fetch" when the client
                      // tried to hit the S3 URL directly from dev.primepisodes.com.
                      // apiClient interceptor handles auth.
                      const apiRes = await api.post('/api/v1/wardrobe-library/analyze-image',
                        { wardrobe_id: editingWardrobeItem.id, showId });
                      const data = apiRes.data;
                      if (data.success && data.data) {
                        const ai = data.data;
                        setWardrobeEditBrandIsFictional(!!ai.brand_is_fictional && !wf.vendor);
                        const catMap = { dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes', accessory: 'accessory', jewelry: 'jewelry', bag: 'bag', outerwear: 'outerwear', perfume: 'perfume', skirt: 'bottom', pants: 'bottom', shirt: 'top', blouse: 'top', fragrance: 'perfume', hair: 'hair', wig: 'hair' };
                        // Only fill empty fields
                        setWardrobeForm(prev => ({
                          ...prev,
                          name: prev.name || ai.name || '',
                          itemType: prev.itemType || catMap[ai.item_type?.toLowerCase()] || '',
                          color: prev.color || ai.color || '',
                          vendor: prev.vendor || ai.brand_guess || '',
                          price: prev.price || (ai.price_estimate ? parseFloat(String(ai.price_estimate).replace(/[^0-9.]/g, '')) || '' : ''),
                          description: prev.description || ai.description || '',
                          defaultSeason: prev.defaultSeason || ai.season || '',
                          defaultOccasion: prev.defaultOccasion || ai.occasion || '',
                          tags: prev.tags || (ai.aesthetic_tags || []).join(', '),
                          defaultCharacter: prev.defaultCharacter || 'Lala',
                        }));
                        const filled = [!wf.description && ai.description ? 'description' : null, !wf.defaultSeason && ai.season ? 'season' : null, !wf.defaultOccasion && ai.occasion ? 'occasion' : null, !wf.tags && ai.aesthetic_tags?.length ? 'tags' : null].filter(Boolean);
                        setToast(filled.length > 0 ? `AI filled: ${filled.join(', ')}` : 'All fields already filled');
                      }
                    } catch (err) { setToast('AI enhance failed: ' + err.message); }
                    btn.disabled = false;
                    btn.textContent = '✨ AI Enhance';
                  }} style={{ ...S.secBtn, background: 'var(--surface-bg)', borderColor: 'var(--lala-gold)', color: 'var(--lala-gold-text)' }}>
                    ✨ AI Enhance
                  </button>
                  <button onClick={async () => {
                    // Open the usage modal and lazy-fetch the episode list. The modal
                    // opens immediately with a loading placeholder so users aren't
                    // staring at a frozen button while the request is in flight.
                    setUsageModalItem(editingWardrobeItem);
                    setItemUsage(null);
                    try {
                      const data = await getWardrobeUsageApi(editingWardrobeItem.id);
                      setItemUsage(data.data || data);
                    } catch (err) {
                      const msg = err.response?.data?.error || 'Could not load usage';
                      setToast(msg);
                    }
                  }} style={{ ...S.secBtn }}>🔍 View usage</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setEditingWardrobeItem(null)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveWardrobeItem} disabled={savingWardrobe} style={S.primaryBtn}>
                    {savingWardrobe ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* The closet beside the look builder when an episode is in production. */}
            <div className={look.episode ? 'wa-wd-body with-look' : 'wa-wd-body'}>
            <div className="wa-wd-main">
            {/* Item Grid — visual cards with thumbnails. List mode swaps the grid
                template for a vertical stack of wide rows. Both modes share the
                same card internals below so there's a single source of truth. */}
            <div className={wardrobeViewMode === 'list' ? undefined : 'wa-wd-grid'} style={{
              display: wardrobeViewMode === 'list' ? 'flex' : 'grid',
              flexDirection: wardrobeViewMode === 'list' ? 'column' : undefined,
              gridTemplateColumns: wardrobeViewMode === 'list' ? undefined : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: wardrobeViewMode === 'list' ? 8 : 14,
            }}>
              {setCards.map((set) => {
                const owned = set.pieces.filter(isOwnedPiece);
                const toBuy = set.pieces.length - owned.length;
                const coins = set.pieces.filter((p) => !isOwnedPiece(p)).reduce((sum, p) => sum + Number(p.coin_cost ?? p.price ?? 0), 0);
                const clashes = setSlotClashes(set.pieces);
                const lead = set.pieces[0];
                const inLook = set.pieces.some((p) => look.ids.has(p.id));
                const reach = look.reach(lead);
                return (
                  <div key={set.id} data-testid={`wardrobe-setcard-${set.id}`} className={`wa-wd-card wa-wd-set-card${inLook ? ' in-look' : ''}`}>
                    <div className={`wa-wd-set-media n-${Math.min(set.pieces.length, 4)}`}>
                      <span className={`wa-wd-own${toBuy ? ' to-buy' : ''}`}>{toBuy ? `${toBuy} to buy` : 'Owned'}</span>
                      {set.pieces.slice(0, 4).map((piece) => {
                        const url = resolveItemImageUrl(piece).url || piece.thumbnail_url;
                        const pieceType = piece.clothing_category || piece.itemType || '';
                        return (
                          <button key={piece.id} type="button" data-testid={`wardrobe-setpiece-${piece.id}`}
                            className={`wa-wd-set-piece wa-wd-backdrop bd-${backdropFor(piece)}`}
                            title={`${piece.name}: open it`} onClick={() => openEditItem(piece)}>
                            {url ? <img src={url} alt={piece.name} className="wa-wd-img" /> : <span className="wa-wd-set-icon" aria-hidden="true">{CAT_ICONS[pieceType] || '👗'}</span>}
                          </button>
                        );
                      })}
                      {look.episode && (
                        <button type="button" data-testid={`wardrobe-setlook-${set.id}`}
                          className={`wa-wd-look${inLook ? ' in' : ''}`} aria-pressed={inLook}
                          disabled={!inLook && !reach.ok} title={!inLook && !reach.ok ? reach.why : inLook ? 'Take the set out of the look' : 'Add the whole set to the look'}
                          onClick={() => look.toggle(lead)}>
                          {inLook ? 'In look' : '+ Look'}
                        </button>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px', minWidth: 0 }}>
                      <div className="wa-wd-card-name">🔗 {set.name}</div>
                      <div className="wa-wd-card-sub">{set.pieces.length} pieces · {set.pieces.map((p) => p.name).join(' + ')}</div>
                      {set.pieces.length > 4 && <div className="wa-wd-card-sub">+{set.pieces.length - 4} more not shown</div>}
                      {clashes.length > 0 && (
                        <div className="wa-wd-set-clash" data-testid={`wardrobe-setclash-${set.id}`}>
                          {clashes.map((p) => p.name).join(' and ')} take the same place on Lala, so only one is worn. Check their categories.
                        </div>
                      )}
                      <span className="wa-wd-card-cost">{toBuy ? `${coins.toLocaleString()} coins for ${toBuy}` : 'Owned'}</span>
                    </div>
                  </div>
                );
              })}
              {(setView ? [] : visibleItems).map(item => {
                const imgUrl = resolveItemImageUrl(item).url || item.thumbnail_url;
                const itemType = item.clothing_category || item.itemType || item.item_type || '';
                const tags = Array.isArray(item.tags) ? item.tags : [];
                const isEditing = editingWardrobeItem?.id === item.id;
                const isBulkSelected = selectedWardrobeIds.has(item.id);
                const colorHex = getColorHex(item.color);
                const hasRecentUsage = recentlyUsedItems.has(item.id);
                const processingState = wardrobeProcessing.stateFor(item);

                const isListMode = wardrobeViewMode === 'list';
                const owned = isOwnedPiece(item);
                const coinCost = Number(item.coin_cost ?? item.price ?? 0);
                const brand = item.brand || item.vendor;
                return (
                  <div key={item.id} onClick={() => openEditItem(item)} data-testid={`wardrobe-card-${item.id}`}
                    className={`wa-wd-card${isListMode ? ' list' : ''}${isBulkSelected ? ' selected' : ''}${isEditing ? ' editing' : ''}${look.ids.has(item.id) ? ' in-look' : ''}`}
                  >
                    {/* Selection checkbox */}
                    <div 
                      onClick={(e) => toggleSelectItem(e, item.id)}
                      style={{ 
                        position: 'absolute', top: 8, left: 8, zIndex: 10, 
                        width: 20, height: 20, borderRadius: 4,
                        background: isBulkSelected ? 'var(--lala-gold)' : 'rgba(255,255,255,0.9)',
                        border: isBulkSelected ? '2px solid var(--lala-gold)' : '2px solid var(--lala-parchment-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {isBulkSelected && <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>

                    {/* Favorite heart — click to toggle. Stops propagation so card's
                        edit-open handler doesn't fire. PATCHes the single `is_favorite`
                        field so the DB row updates even in environments where full
                        row-update validation is stricter. */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const next = !item.is_favorite;
                        // Optimistic update
                        setWardrobeItems(prev => prev.map(w => w.id === item.id ? { ...w, is_favorite: next } : w));
                        try {
                          await updateWardrobeItemApi(item.id, { is_favorite: next });
                        } catch (err) {
                          // Roll back + surface a toast so the UI doesn't drift from the DB.
                          setWardrobeItems(prev => prev.map(w => w.id === item.id ? { ...w, is_favorite: !next } : w));
                          setToast('Could not save favorite');
                        }
                      }}
                      title={item.is_favorite ? 'Remove from favorites' : 'Mark as favorite'}
                      style={{
                        position: 'absolute', top: 6, right: hasRecentUsage ? 68 : 6, zIndex: 10,
                        width: 26, height: 26, borderRadius: '50%',
                        background: item.is_favorite ? 'rgba(220,38,38,0.92)' : 'rgba(255,255,255,0.9)',
                        border: item.is_favorite ? '1px solid var(--danger)' : '1px solid var(--lala-parchment-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1,
                        color: item.is_favorite ? 'var(--text-inverse)' : 'var(--text-secondary)',
                      }}
                    >♥</button>

                    {/* Continuity warning badge */}
                    {hasRecentUsage && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 10,
                        padding: '2px 6px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
                        borderRadius: 4, fontSize: 9, fontWeight: 600, color: 'var(--warning-text)',
                      }} title="Used recently - check continuity">
                        ⚠️ Recent
                      </div>
                    )}

                    {/* Image - click for lightbox. List mode shrinks it to a fixed
                        square on the left so rows stay compact. */}
                    <div
                      className={`wa-wd-backdrop bd-${backdropFor(item)}`}
                      style={{
                        width: isListMode ? 80 : '100%',
                        flexShrink: isListMode ? 0 : undefined,
                        aspectRatio: isListMode ? '1/1' : '3/4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
                      }}
                      onClick={(e) => { if (imgUrl) { e.stopPropagation(); setLightboxVariant(null); setLightboxItem(item); } }}
                    >
                      {!isListMode && (
                        <span className={`wa-wd-own${owned ? '' : ' to-buy'}`} data-testid={`wardrobe-own-${item.id}`}>{owned ? 'Owned' : 'To buy'}</span>
                      )}
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.name} className="wa-wd-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      ) : null}
                      <div style={{ display: imgUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 48, color: 'var(--text-secondary)' }}>
                        {CAT_ICONS[itemType] || '👗'}
                      </div>
                      {/* In the look being built, or a way to add it (the image
                          itself opens the lightbox). Without an episode in
                          production, the expand hint. */}
                      {look.episode && !isListMode ? (() => {
                        const inLook = look.ids.has(item.id);
                        const reach = look.reach(item);
                        return (
                          <button type="button" data-testid={`wardrobe-look-${item.id}`}
                            className={`wa-wd-look${inLook ? ' in' : ''}`} aria-pressed={inLook}
                            disabled={!inLook && !reach.ok} title={!inLook && !reach.ok ? reach.why : inLook ? 'Take it out of the look' : 'Add it to the look'}
                            onClick={e => { e.stopPropagation(); look.toggle(item); }}>
                            {inLook ? 'In look' : '+ Look'}
                          </button>
                        );
                      })() : imgUrl && processingState !== PROCESSING_STATES.PROCESSING && processingState !== PROCESSING_STATES.STALLED && (
                        <div style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 10, color: 'var(--text-inverse)', opacity: 0.7 }}>
                          🔍
                        </div>
                      )}
                      {/* Upload processing state (Task #1769) — only for items this
                          session uploaded and the server started processing. */}
                      {processingState === PROCESSING_STATES.PROCESSING && !isListMode && (
                        <div className="wa-wd-processing wa-wd-processing--running" role="status" data-testid="wardrobe-processing"
                          onClick={e => e.stopPropagation()}>
                          <span className="wa-wd-processing-label">
                            <Loader2 size={13} className="wa-wd-processing-spin" aria-hidden="true" />
                            Extracting item…
                          </span>
                        </div>
                      )}
                      {processingState === PROCESSING_STATES.STALLED && !isListMode && (
                        <div className="wa-wd-processing wa-wd-processing--stalled" role="status" data-testid="wardrobe-processing-stalled"
                          onClick={e => e.stopPropagation()}>
                          <span className="wa-wd-processing-label">
                            <AlertTriangle size={13} aria-hidden="true" />
                            Extraction didn’t finish — showing the original
                          </span>
                          <span className="wa-wd-processing-actions">
                            <button type="button" className="wa-wd-processing-btn"
                              onClick={e => { e.stopPropagation(); wardrobeProcessing.retry(item.id); }}>
                              <RotateCw size={12} aria-hidden="true" /> Retry
                            </button>
                            <button type="button" className="wa-wd-processing-btn"
                              onClick={e => { e.stopPropagation(); wardrobeProcessing.dismiss(item.id); }}>
                              <X size={12} aria-hidden="true" /> Keep original
                            </button>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info — flex:1 so list mode pushes the info column to fill the row. */}
                    <div style={{ padding: '10px 12px', flex: isListMode ? 1 : undefined, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {/* Color swatch */}
                        {colorHex && (
                          <div style={{ 
                            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                            background: colorHex, border: '1px solid rgba(0,0,0,0.15)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }} title={item.color} />
                        )}
                        <div className="wa-wd-card-name">
                          {item.name}
                        </div>
                      </div>
                      <div className="wa-wd-card-sub">
                        {[brand, itemType || 'item', item.color].filter(Boolean).join(' · ')}
                      </div>
                      {/* W1: a piece linked into a matching set says which. */}
                      {item.outfit_set_id && (
                        <div data-testid={`wardrobe-set-${item.id}`} style={{ fontSize: 10, color: 'var(--accent-dark)', marginBottom: 4 }}>🔗 {item.outfit_set_name || 'Matching set'}</div>
                      )}
                      {/* List mode: the 80px image is too small for the overlay,
                          so the processing state sits under the category line. */}
                      {isListMode && processingState === PROCESSING_STATES.PROCESSING && (
                        <div className="wa-wd-processing-label" role="status" style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                          <Loader2 size={12} className="wa-wd-processing-spin" aria-hidden="true" /> Extracting item…
                        </div>
                      )}
                      {isListMode && processingState === PROCESSING_STATES.STALLED && (
                        <div role="status" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace", marginBottom: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={12} aria-hidden="true" /> Extraction didn’t finish
                          <button type="button" className="wa-wd-processing-btn" onClick={e => { e.stopPropagation(); wardrobeProcessing.retry(item.id); }}>
                            <RotateCw size={12} aria-hidden="true" /> Retry
                          </button>
                          <button type="button" className="wa-wd-processing-btn" onClick={e => { e.stopPropagation(); wardrobeProcessing.dismiss(item.id); }}>
                            <X size={12} aria-hidden="true" /> Keep original
                          </button>
                        </div>
                      )}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                          {tags.slice(0, 3).map((tag, i) => (
                            <span key={i} style={{ padding: '1px 6px', background: 'var(--accent-subtle)', borderRadius: 4, fontSize: 9, color: 'var(--accent-dark)' }}>{tag}</span>
                          ))}
                          {tags.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>+{tags.length - 3}</span>}
                        </div>
                      )}

                      {/* Bottom row: price + usage */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        {/* Owned, or what buying it costs Lala in coins (coin_cost, else the price). */}
                        <span className="wa-wd-card-cost" data-testid={`wardrobe-cost-${item.id}`}>
                          {owned ? 'Owned' : coinCost > 0 ? `${coinCost.toLocaleString()} coins` : 'Free'}
                        </span>
                        {(item.totalUsageCount || item.total_usage_count) > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>Used {item.totalUsageCount || item.total_usage_count}x</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination — shown only when more than one page of results. Buttons
                clamp to 1..totalPages so clicking past the ends is a no-op. */}
            {totalPages > 1 && !setView && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20, padding: '12px 0' }}>
                <button onClick={() => setWardrobePage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: '6px 14px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>← Prev</button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                  Page {currentPage} of {totalPages} · {filteredItems.length} items
                </span>
                <button onClick={() => setWardrobePage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '6px 14px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>Next →</button>
              </div>
            )}

            {/* Empty state */}
            {filteredItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👗</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {wardrobeItems.length === 0 ? 'No wardrobe items yet' : 'No items match your search'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {wardrobeItems.length === 0
                    ? 'Upload your first wardrobe piece to start building the closet.'
                    : 'Try a different search term or category filter.'}
                </div>
                {wardrobeItems.length === 0 && (
                  <button onClick={() => setShowWardrobeUpload(true)} style={S.primaryBtn}>
                    + Upload First Item
                  </button>
                )}
              </div>
            )}

            </div>
            {look.episode && (
              <aside className="wa-wd-side">
                <LookBuilderPanel look={look} coinsNow={financeConfig?.current_balance ?? lookCharacter.coins} />
                <RecentlyWorn showId={showId} />
              </aside>
            )}
            </div>

            {/* ── Add piece (Evoni, 2026-10-07: "fix and redesign wardrobe add piece") ── */}
            {showWardrobeUpload && (
              <AddPieceDialog
                showId={showId}
                onClose={() => setShowWardrobeUpload(false)}
                onAdded={(item, { photoDropped, response }) => {
                  if (item) setWardrobeItems(prev => [item, ...prev]);
                  // Only track items the server said it started processing —
                  // an item it never processes must not show a spinner.
                  if (backgroundRemovalStarted(response) && item?.id && !item.s3_url_processed) {
                    wardrobeProcessing.track(item.id);
                  }
                  setShowWardrobeUpload(false);
                  setToast(photoDropped ? "Added, but the photo didn't upload. Add it from the piece." : 'Added to the closet');
                  setTimeout(() => setToast(null), photoDropped ? 5000 : 2500);
                }}
              />
            )}

            {/* ── Import orders (Task #3102): fills empty Real world details; never coins ── */}
            {showOrderImport && (
              <OrderImportDialog
                showId={showId}
                pieces={wardrobeItems}
                onClose={() => setShowOrderImport(false)}
                onImported={(result) => {
                  if (!result?.pieces?.length) return;
                  // The pieces' Real world details changed: the closet reads them again.
                  fetchClosetWithTotal(api, showId)
                    .then((list) => { setWardrobeItems(list.items); setWardrobeTotal(list.total ?? list.items.length); })
                    .catch((err) => console.error('[WorldAdmin] the closet could not be read again:', err.response?.status || err.message));
                }}
              />
            )}

            {/* ── Create Outfit Set Modal ── */}
            {showCreateOutfitSet && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !creatingOutfitSet && setShowCreateOutfitSet(false)}>
                <div style={{ background: 'var(--surface-card)', borderRadius: 14, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Create Matching Set</h3>
                    <button onClick={() => setShowCreateOutfitSet(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>
                    {selectedWardrobeIds.size} pieces selected
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    In the styling game, choosing the set equips every piece in its own slot at once; each piece can still be chosen on its own. A piece already in another set moves to this one.
                  </div>
                  {/* Piece chips — visual confirmation of what goes into the set. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {Array.from(selectedWardrobeIds).map(id => {
                      const item = wardrobeItems.find(w => w.id === id);
                      if (!item) return null;
                      const img = item.s3_url_processed || item.s3_url || item.thumbnail_url;
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, padding: '4px 8px' }}>
                          {img && <img src={img} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                          <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>set name</label>
                  <input
                    type="text"
                    value={outfitSetName}
                    onChange={e => setOutfitSetName(e.target.value)}
                    placeholder="e.g., Floral Corset Set"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 14, fontFamily: "'Lora', serif", marginTop: 4, marginBottom: 16, boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setShowCreateOutfitSet(false)} style={{ padding: '7px 16px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                    <button
                      disabled={!outfitSetName.trim() || creatingOutfitSet}
                      onClick={async () => {
                        setCreatingOutfitSet(true);
                        try {
                          const selectedArr = Array.from(selectedWardrobeIds);
                          const payloadItems = selectedArr.map(id => {
                            const item = wardrobeItems.find(w => w.id === id);
                            return item ? { id: item.id, name: item.name, category: item.clothing_category || item.itemType, image: item.s3_url_processed || item.s3_url } : null;
                          }).filter(Boolean);
                          // W1: the pieces are linked as a matching set first; the
                          // styling game equips them together from that link.
                          let linked;
                          try {
                            linked = await createMatchingSetApi({ name: outfitSetName.trim(), wardrobe_ids: selectedArr, show_id: showId });
                          } catch (httpErr) {
                            throw new Error(httpErr.response?.data?.error || 'Create failed');
                          }
                          const setId = linked?.data?.id;
                          const setName = linked?.data?.name || outfitSetName.trim();
                          setWardrobeItems(prev => prev.map(w => (selectedArr.includes(w.id) ? { ...w, outfit_set_id: setId, outfit_set_name: setName } : w)));
                          // The outfit calendar still reads outfit sets; its copy is
                          // kept as before, and a failure there does not undo the link.
                          try {
                            await createOutfitSetApi({ name: setName, character: 'Lala', items: payloadItems, show_id: showId });
                          } catch (httpErr) {
                            console.error('[WorldAdmin] the outfit calendar copy of the set was not saved:', httpErr);
                          }
                          setToast(`Matching set "${setName}" linked`);
                          setShowCreateOutfitSet(false);
                          setSelectedWardrobeIds(new Set());
                        } catch (err) { setToast('Failed to create set: ' + err.message); }
                        setCreatingOutfitSet(false);
                      }}
                      style={{ padding: '7px 22px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!outfitSetName.trim() || creatingOutfitSet) ? 0.4 : 1 }}
                    >{creatingOutfitSet ? 'Creating...' : 'Create set'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Usage Modal — which episodes reference this item ── */}
            {usageModalItem && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setUsageModalItem(null); setItemUsage(null); }}>
                <div style={{ background: 'var(--surface-card)', borderRadius: 14, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Item Usage: {usageModalItem.name}</h3>
                    <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                  </div>
                  {/* Three states: loading, empty, populated — matches the existing WardrobeBrowser modal. */}
                  {itemUsage == null ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading usage data...</div>
                  ) : !itemUsage.totalEpisodes ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                      <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--text-primary)' }}>This item isn't used in any episodes yet.</p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>It can be safely deleted.</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ padding: '10px 14px', background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                        <div><strong>Total episodes:</strong> {itemUsage.totalEpisodes}</div>
                        <div><strong>Total shows:</strong> {itemUsage.totalShows}</div>
                      </div>
                      {(itemUsage.shows || []).map(show => (
                        <div key={show.showId} style={{ marginBottom: 14 }}>
                          <h4 style={{ margin: '4px 0 6px', fontSize: 13, color: 'var(--text-primary)' }}>{show.showName || 'Unknown Show'}</h4>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {(show.episodes || []).map(ep => (
                              <li key={ep.episodeId}>Episode {ep.episodeNumber}: {ep.title}{ep.isFavorite && <span style={{ marginLeft: 4, color: 'var(--lala-gold-text)' }}>★</span>}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} style={{ padding: '7px 20px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Lightbox Modal ── */}
            {lightboxItem && (() => {
              // Build the list of variants that actually have a URL on this
              // row. The lightbox lets the user preview any of them via a
              // toggle without mutating DB state; only the "Set as default"
              // button writes back via primary_image_variant.
              const variants = [
                { key: 'regenerated', label: '🎨 Product Shot', url: lightboxItem.s3_url_regenerated },
                { key: 'processed',   label: '✂️ No BG',        url: lightboxItem.s3_url_processed },
                { key: 'original',    label: '📷 Original',     url: lightboxItem.s3_url || lightboxItem.image_url },
              ].filter(v => v.url);

              // Selection: local toggle wins (if it points at a variant that
              // exists on this item); else the row's primary pick; else the
              // default preference chain.
              const resolved = resolveItemImageUrl(lightboxItem);
              const active = variants.find(v => v.key === lightboxVariant)
                          || variants.find(v => v.key === resolved.variant)
                          || variants[0];
              const imgUrl = active?.url;
              const currentPrimary = lightboxItem.primary_image_variant || resolved.variant;

              const itemType = lightboxItem.clothing_category || lightboxItem.itemType || lightboxItem.item_type || '';
              const colorHex = getColorHex(lightboxItem.color);
              return (
                <div 
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} 
                  onClick={() => { setLightboxVariant(null); setLightboxItem(null); }}
                >
                  <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {/* Close button */}
                    <button
                      onClick={() => { setLightboxVariant(null); setLightboxItem(null); }}
                      style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'var(--text-inverse)', fontSize: 28, cursor: 'pointer', padding: 8 }}
                    >✕</button>

                    {/* Variant toggle — only renders when the row has more than one
                        variant worth switching between. A star next to the label
                        marks which one the grid card will use. */}
                    {variants.length > 1 && (
                      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {variants.map(v => {
                          const isActive = v.key === active.key;
                          const isPrimary = v.key === currentPrimary;
                          return (
                            <button
                              key={v.key}
                              onClick={() => setLightboxVariant(v.key)}
                              style={{
                                padding: '6px 12px',
                                background: isActive ? 'var(--surface-card)' : 'rgba(255,255,255,0.15)',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-inverse)',
                                border: isActive ? '2px solid var(--surface-card)' : '2px solid rgba(255,255,255,0.25)',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isPrimary ? '★ ' : ''}{v.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Main image */}
                    <img
                      src={imgUrl}
                      alt={lightboxItem.name}
                      style={{ maxWidth: '100%', maxHeight: 'calc(90vh - 160px)', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    />
                    
                    {/* Item info bar */}
                    <div style={{ marginTop: 16, padding: '12px 20px', background: 'rgba(255,255,255,0.95)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16, maxWidth: '100%' }}>
                      {colorHex && (
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: colorHex, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} title={lightboxItem.color} />
                      )}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{lightboxItem.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {CAT_ICONS[itemType] || '🏷️'} {itemType || 'item'}
                          {lightboxItem.color && <span> · {lightboxItem.color}</span>}
                          {lightboxItem.vendor && <span> · {lightboxItem.vendor}</span>}
                          {lightboxItem.price && <span style={{ color: 'var(--success-text)', fontWeight: 600 }}> · ${parseFloat(lightboxItem.price).toFixed(0)}</span>}
                        </div>
                      </div>
                      {/* Only offer "Set as default for grid" when the user is
                          actively previewing a NON-primary variant — otherwise
                          the action would be a no-op. */}
                      {active && active.key !== currentPrimary && (
                        <button
                          onClick={() => promoteToPrimary(lightboxItem, active.key)}
                          disabled={promotingVariant}
                          title={`Make the ${active.label} the image shown in the grid for this item`}
                          style={{ marginLeft: 'auto', padding: '6px 14px', background: promotingVariant ? 'var(--text-secondary)' : 'var(--primary-dark)', color: 'var(--text-inverse)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: promotingVariant ? 'wait' : 'pointer' }}
                        >{promotingVariant ? 'Saving…' : '★ Set as default'}</button>
                      )}
                      {/* "Send to phone" only makes sense for a colored-backdrop
                          variant — the phone uses it as a screen background. */}
                      {active && ['pink', 'blue', 'teal'].includes(active.key) && (
                        <button
                          onClick={() => handleSendToPhone(lightboxItem, active.key)}
                          disabled={sendingToPhone}
                          title={`Create a Lala's-phone screen from the ${active.label} variant — opens the overlay editor so you can draw tap zones`}
                          style={{ marginLeft: (active && active.key !== currentPrimary) ? 0 : 'auto', padding: '6px 14px', background: sendingToPhone ? 'var(--text-secondary)' : 'var(--accent-dark)', color: 'var(--text-inverse)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: sendingToPhone ? 'wait' : 'pointer' }}
                        >{sendingToPhone ? 'Sending…' : '📱 Send to phone'}</button>
                      )}
                      <button
                        onClick={() => handleRegenerateProductShot(lightboxItem)}
                        disabled={regeneratingItemId === lightboxItem.id}
                        title="AI image-to-image — swaps backdrop, removes hangers/dress-form residue, simulates invisible mannequin (~$0.04)"
                        style={{ padding: '6px 14px', background: regeneratingItemId === lightboxItem.id ? 'var(--text-secondary)' : 'var(--accent-dark)', color: 'var(--text-inverse)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: regeneratingItemId === lightboxItem.id ? 'wait' : 'pointer' }}
                      >{regeneratingItemId === lightboxItem.id ? 'Regenerating…' : '🎨 Regenerate'}</button>
                      <button
                        onClick={() => { setLightboxVariant(null); setLightboxItem(null); openEditItem(lightboxItem); }}
                        style={{ padding: '6px 14px', background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >Edit Item</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ════════════════════════ CHARACTERS ════════════════════════ */}
      {activeTab === 'characters' && subTab === 'characters-list' && (
        <div style={S.content}>
          {/* Lala's stats and the decision log side by side, then the threads and the cast (Evoni's redesign, 2026-10-05). */}
          <div className="wa-cc-top">
            <LalaStatsCard
              charState={charState} history={stateHistory} episodes={episodes}
              coinGoal={financeConfig?.next_goal?.threshold || null}
              edit={{ editing: editingStats, form: statForm, setForm: setStatForm, open: openStatEditor, cancel: () => setEditingStats(false), save: saveStats, saving: savingStats }}
            />
            <DecisionLogCard history={stateHistory} episodes={episodes} />
          </div>
          <StoryThreadsStrip showId={showId} episodes={episodes} />
          <CastRow />

          {/* Stat ledger */}
          {stateHistory.length > 0 && (
            <div style={S.card} id="cc-ledger">
              <h2 style={S.cardTitle}>📜 Stat Change Ledger</h2>
              <div style={S.tHead}>
                <span style={S.tCol}>Episode</span>
                <span style={S.tCol}>Source</span>
                <span style={{ ...S.tCol, flex: 2 }}>Changes</span>
                <span style={S.tCol}>Date</span>
              </div>
              {stateHistory.map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={S.tRow}>
                    <span style={S.tCol}>{h.episode_title || h.episode_id?.substring(0, 8) || 'manual'}</span>
                    <span style={S.tCol}><span style={S.sourceBadge(h.source)}>{h.source}</span></span>
                    <span style={{ ...S.tCol, flex: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(deltas || {}).filter(([, v]) => typeof v === 'number' && v !== 0).map(([k, v]) => (
                        <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </span>
                    <span style={{ ...S.tCol, fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ DECISIONS ════════════════════════ */}
      {/* ════════════════════════ RELEASE ════════════════════════ */}
      {activeTab === 'world' && subTab === 'feed' && (
        <div style={S.content}>
          <LalaFeedTab showId={showId} episodes={episodes} onCountChanged={setFeedWaiting} />
        </div>
      )}

      {activeTab === 'release' && show && (
        <div style={S.content}>
          {subTab === 'release-next' && <ReleaseBoard showId={showId} episodes={episodes} history={stateHistory} />}
          {subTab === 'distribution' && (
            <ShowDistributionTab
              show={show}
              onUpdate={async (updates) => {
                await showService.updateShow(showId, updates);
                const fresh = await showService.getShowById(showId);
                if (fresh) setShow(fresh);
              }}
            />
          )}
          {subTab === 'insights' && <ShowInsightsTab show={show} />}
        </div>
      )}

      {/* ════════════════════ LALA'S FINANCES (one home) ════════════════════ */}
      {/* Her in-world money: balance, trend, per-episode P&L, breakdowns,
          closet value and the goal ladder. Item prices stay in Wardrobe and
          event terms in the Event Package. */}
      {activeTab === 'characters' && subTab === 'finances' && (
        <div style={S.content}>
          {financeSummaryLoading && !financeSummary && <p style={S.muted}>Loading Lala's finances…</p>}
            {/* Lala's finances: balance, trend, per-episode P&L, breakdowns, closet, goals. */}
            {financeEditorDraft && (() => {
              const d = financeEditorDraft;
              const setDraft = (patch) => setFinanceEditorDraft(p => ({ ...p, ...patch }));
              const updateGoal = (idx, patch) => setFinanceEditorDraft(p => ({ ...p, goals: p.goals.map((g, i) => i === idx ? { ...g, ...patch } : g) }));
              const removeGoal = (idx) => setFinanceEditorDraft(p => ({ ...p, goals: p.goals.filter((_, i) => i !== idx) }));
              const addGoal = () => setFinanceEditorDraft(p => ({ ...p, goals: [...p.goals, {
                id: `goal-${Date.now().toString(36)}`,
                threshold: 0,
                reward_coins: 0,
                label: '🎯 New milestone',
                description: '',
                triggered_at: null,
              }] }));
              const save = async () => {
                setFinanceEditorSaving(true);
                try {
                  // Normalise + sort: make sure threshold/reward are numbers
                  // and the ladder is ordered so the "next goal" logic works.
                  const cleanGoals = (d.goals || [])
                    .map(g => ({ ...g, threshold: Number(g.threshold) || 0, reward_coins: Number(g.reward_coins) || 0 }))
                    .sort((a, b) => a.threshold - b.threshold);
                  await api.put(`/api/v1/shows/${showId}/financial-config`, {
                    starting_balance: Number(d.starting_balance) || 0,
                    financial_goals: cleanGoals,
                  });
                  // Re-seed so the ledger reflects the new starting balance.
                  // Force=true soft-deletes the old seed and writes a fresh one.
                  await api.post(`/api/v1/shows/${showId}/seed-balance`, { force: true });
                  // Refresh local state.
                  const res = await api.get(`/api/v1/shows/${showId}/financial-config`);
                  setFinanceConfig(res.data);
                  setFinanceEditorDraft(draftFromConfig(res.data));
                  setToast('Finance config saved');
                } catch (err) {
                  setToast('Save failed: ' + (err.response?.data?.error || err.message));
                } finally {
                  setFinanceEditorSaving(false);
                }
              };
              return (
                <div data-testid="lala-finances">
                  <div style={{ ...S.card, maxWidth: 900 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💰 Lala's Finances</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Seed finance apps — idempotent. Creates the 5 finance
                            app screens + icons using AI-generated pink/teal
                            frames, and appends the icons to the home screen in
                            a 5-across grid at the bottom. Rerun any time to
                            fill in missing apps. */}
                        <button
                          onClick={async () => {
                            if (!window.confirm('Create the 4 finance apps on Lala\'s phone?\n\n• Wallet / Insights / Breakdowns / Goals\n• Pink + teal AI-generated icons + screens\n• Icons auto-placed on the home screen\n\nCloset Value is skipped — add the closet_net_worth and closet_wishlist_grid content zones to your existing Closet screen instead.\n\nSafe to re-run — only fills in missing apps.')) return;
                            try {
                              const res = await api.post(`/api/v1/shows/${showId}/seed-finance-apps`, { auto_place: true });
                              const created = (res.data.results || []).filter(r => r.created).length;
                              const placed = res.data.placement?.placed;
                              setToast(`Finance apps: ${created} created${placed ? ', icons placed on home screen' : ' (place them in Lala’s Phone)'}`);
                            } catch (err) {
                              setToast('Seed failed: ' + (err.response?.data?.error || err.message));
                            }
                          }}
                          title="Create 4 finance apps (Wallet, Insights, Breakdowns, Goals) on Lala's phone. Closet Value content zones go on your existing Closet screen."
                          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >📱 Seed Finance Apps</button>
                      </div>
                    </div>

                    {/* Tab bar — switches between Overview (dashboard), Per-Episode
                        (the P&L table), and Goals (starting balance + ladder editor). */}
                    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--lala-parchment-3)', marginBottom: 16 }}>
                      {[
                        { key: 'overview',    label: 'Overview' },
                        { key: 'per_episode', label: 'Per Episode' },
                        { key: 'breakdowns',  label: 'Breakdowns' },
                        { key: 'closet',      label: 'Closet' },
                        { key: 'goals',       label: 'Goals' },
                      ].map(t => {
                        const active = financeTab === t.key;
                        return (
                          <button key={t.key} onClick={() => setFinanceTab(t.key)}
                            style={{
                              padding: '8px 16px', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                              background: 'transparent', border: 'none',
                              borderBottom: active ? '2px solid var(--lala-gold)' : '2px solid transparent',
                              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                              marginBottom: -1,
                            }}>{t.label}</button>
                        );
                      })}
                    </div>

                    {/* ── OVERVIEW TAB ────────────────────────────────────
                        Balance, next-goal bar, lifetime totals, burn rate, runway,
                        and a simple 12-episode trend sparkline. All derived from
                        /financial-summary so the numbers match the ledger. */}
                    {financeTab === 'overview' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {financeSummaryLoading && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Loading summary…</div>}
                        {financeSummary && (() => {
                          const t = financeSummary.totals || {};
                          const balance = t.current_balance ?? 0;
                          const trend = financeSummary.trend || [];
                          const recentTrend = trend.slice(-12);
                          const maxBal = Math.max(1, ...recentTrend.map(p => p.balance_after));
                          const minBal = Math.min(0, ...recentTrend.map(p => p.balance_after));
                          const range = maxBal - minBal || 1;
                          const nextGoal = financeConfig?.next_goal;
                          const progress = nextGoal ? Math.max(0, Math.min(1, balance / Number(nextGoal.threshold))) : 1;
                          return (
                            <>
                              {/* Hero: balance + next goal */}
                              <div style={{ padding: '14px 16px', background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 10 }}>
                                <div style={{ fontSize: 11, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 4 }}>CURRENT BALANCE</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                                  💰 {balance.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 8 }}>coins</span>
                                </div>
                                {nextGoal && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                      <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>Next: {nextGoal.label}{nextGoal.episode_id && <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--warning-text)', marginLeft: 4 }}>· ep-scoped</span>}</span>
                                      <span style={{ color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace" }}>{balance.toLocaleString()} / {Number(nextGoal.threshold).toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${progress * 100}%`, height: '100%', background: balance >= Number(nextGoal.threshold) ? 'var(--success)' : 'var(--lala-gold)', transition: 'width 0.3s' }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* KPI strip */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                                {[
                                  { label: 'Lifetime income', value: `+${(t.lifetime_income || 0).toLocaleString()}`, color: 'var(--success-text)' },
                                  { label: 'Lifetime expenses', value: `-${(t.lifetime_expenses || 0).toLocaleString()}`, color: 'var(--danger-text)' },
                                  { label: 'Lifetime net', value: `${(t.net || 0) >= 0 ? '+' : ''}${(t.net || 0).toLocaleString()}`, color: (t.net || 0) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' },
                                  { label: 'Burn rate', value: `${(financeSummary.burn_rate_per_episode || 0).toLocaleString()}/ep`, color: 'var(--text-primary)' },
                                  { label: 'Avg income', value: `${(financeSummary.avg_income_per_episode || 0).toLocaleString()}/ep`, color: 'var(--text-primary)' },
                                  { label: 'Runway', value: financeSummary.runway_episodes != null ? `${financeSummary.runway_episodes} eps` : '∞', color: 'var(--text-primary)' },
                                ].map(kpi => (
                                  <div key={kpi.label} style={{ padding: '10px 12px', background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>{kpi.label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{kpi.value}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Sparkline — last 12 episodes' ending balance. Rendered with
                                  inline SVG (no chart library) so it survives any CSP + is
                                  fast to paint. Each point is scaled into the 0-100 range */}
                              {recentTrend.length > 1 && (
                                <div style={{ padding: '12px 14px', background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10 }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Balance — last {recentTrend.length} episodes</div>
                                  <svg viewBox={`0 0 100 40`} preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
                                    {/* Zero line */}
                                    {minBal < 0 && (
                                      <line x1="0" y1={40 - ((0 - minBal) / range) * 40} x2="100" y2={40 - ((0 - minBal) / range) * 40} stroke="var(--lala-parchment-3)" strokeWidth="0.3" strokeDasharray="1,1" />
                                    )}
                                    <polyline
                                      points={recentTrend.map((p, i) => {
                                        const x = (i / Math.max(1, recentTrend.length - 1)) * 100;
                                        const y = 40 - ((p.balance_after - minBal) / range) * 40;
                                        return `${x},${y}`;
                                      }).join(' ')}
                                      fill="none"
                                      stroke="var(--lala-gold)"
                                      strokeWidth="0.8"
                                      vectorEffect="non-scaling-stroke"
                                    />
                                    {recentTrend.map((p, i) => {
                                      const x = (i / Math.max(1, recentTrend.length - 1)) * 100;
                                      const y = 40 - ((p.balance_after - minBal) / range) * 40;
                                      return <circle key={i} cx={x} cy={y} r="0.8" fill={p.net >= 0 ? 'var(--success)' : 'var(--danger)'} vectorEffect="non-scaling-stroke" />;
                                    })}
                                  </svg>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                                    <span>Ep {recentTrend[0]?.episode_number || '?'}</span>
                                    <span>Ep {recentTrend[recentTrend.length - 1]?.episode_number || '?'}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {!financeSummaryLoading && !financeSummary && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>
                            No summary yet. Finalize an episode to populate.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── PER-EPISODE TAB ────────────────────────────────────
                        Full-history P&L table, newest first. Colour-codes the net
                        column red/green. Click a row to jump to that episode (TODO). */}
                    {financeTab === 'per_episode' && (
                      <div>
                        {financeSummary && financeSummary.by_episode.length > 0 ? (
                          <div style={{ overflow: 'auto', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'var(--surface-bg)', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.4 }}>
                                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ep</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Title</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Outfit</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Event</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tasks</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {financeSummary.by_episode.filter(e => e.tx_count > 0).map(e => (
                                  <tr key={e.episode_id} style={{ borderTop: '1px solid var(--lala-parchment-3)' }}>
                                    <td style={{ padding: '7px 10px', fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>{e.episode_number ?? '—'}</td>
                                    <td style={{ padding: '7px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title || '(untitled)'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--danger-text)' }}>{e.outfit_cost ? `-${e.outfit_cost.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--danger-text)' }}>{e.event_cost ? `-${e.event_cost.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--success-text)' }}>{e.task_rewards ? `+${e.task_rewards.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700, color: e.net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{e.net >= 0 ? '+' : ''}{e.net.toLocaleString()}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)' }}>{e.balance_after.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 30 }}>
                            No episode-level transactions yet. Finalize episodes to populate.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── BREAKDOWNS TAB ───────────────────────────────────
                        Income and expense categories rendered as labelled bars
                        (simpler + more scannable than a pie at this data size).
                        Bars are scaled against the single largest category so
                        the visual ratio reflects actual spend shape. */}
                    {financeTab === 'breakdowns' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {!financeBreakdowns && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No breakdown data yet.</div>}
                        {financeBreakdowns && (() => {
                          const incomeMax = Math.max(1, ...(financeBreakdowns.income?.breakdown || []).map(r => r.total));
                          const expenseMax = Math.max(1, ...(financeBreakdowns.expenses?.breakdown || []).map(r => r.total));
                          const renderBars = (items, max, color) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {items.map(r => (
                                <div key={r.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 140, fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</div>
                                  <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                                  </div>
                                  <div style={{ width: 80, fontSize: 11, textAlign: 'right', fontFamily: "'DM Mono', monospace", color, fontWeight: 700 }}>
                                    {r.total.toLocaleString()}
                                  </div>
                                  <div style={{ width: 30, fontSize: 9, textAlign: 'right', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>×{r.tx_count}</div>
                                </div>
                              ))}
                            </div>
                          );
                          return (
                            <>
                              <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>INCOME BY SOURCE</span>
                                  <span style={{ fontSize: 11, color: 'var(--success-text)', fontFamily: "'DM Mono', monospace" }}>total +{(financeBreakdowns.income?.total || 0).toLocaleString()}</span>
                                </div>
                                {(financeBreakdowns.income?.breakdown || []).length > 0
                                  ? renderBars(financeBreakdowns.income.breakdown, incomeMax, 'var(--success-text)')
                                  : <div style={{ fontSize: 11, color: 'var(--success-text)', textAlign: 'center', padding: 10 }}>No income recorded yet.</div>}
                              </div>
                              <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>EXPENSES BY CATEGORY</span>
                                  <span style={{ fontSize: 11, color: 'var(--danger-text)', fontFamily: "'DM Mono', monospace" }}>total -{(financeBreakdowns.expenses?.total || 0).toLocaleString()}</span>
                                </div>
                                {(financeBreakdowns.expenses?.breakdown || []).length > 0
                                  ? renderBars(financeBreakdowns.expenses.breakdown, expenseMax, 'var(--danger-text)')
                                  : <div style={{ fontSize: 11, color: 'var(--danger-text)', textAlign: 'center', padding: 10 }}>No expenses recorded yet.</div>}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Bar length = share of its side's total. "×N" = how many transactions rolled into that row.
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── CLOSET TAB ───────────────────────────────────────
                        Net-worth snapshot from the wardrobe. Owned value is the
                        real money Lala has tied up in her closet; unowned is her
                        aspirational inventory. Top 5 unowned-by-value shown so
                        creators see the concrete upgrade path. */}
                    {financeTab === 'closet' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {!financeBreakdowns?.closet && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No closet data yet.</div>}
                        {financeBreakdowns?.closet && (() => {
                          const c = financeBreakdowns.closet;
                          return (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                                <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: 'var(--success-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Owned closet value</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success-text)', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{c.owned_value.toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: 'var(--success-text)', marginTop: 2 }}>{c.owned_count} pieces</div>
                                </div>
                                <div style={{ padding: 12, background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: 'var(--primary-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Wishlist potential</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-text)', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{c.unowned_value.toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: 'var(--primary-text)', marginTop: 2 }}>{c.unowned_count} pieces unowned</div>
                                </div>
                                <div style={{ padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Total catalog</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{(c.owned_value + c.unowned_value).toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: 'var(--lala-gold-text)', marginTop: 2 }}>{c.owned_count + c.unowned_count} pieces total</div>
                                </div>
                              </div>
                              {c.wishlist && c.wishlist.length > 0 && (
                                <div style={{ padding: '12px 14px', background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 8 }}>💎 TOP 5 DREAM PIECES</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {c.wishlist.map(w => (
                                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, background: 'var(--surface-bg)', borderRadius: 6 }}>
                                        {w.image_url && <img src={w.image_url} alt={w.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{w.brand || '—'} · {w.tier || 'basic'}</div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace" }}>
                                          💰 {w.coin_cost.toLocaleString()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── GOALS TAB ──────────────────────────────────────── */}
                    {financeTab === 'goals' && (
                    <>
                    {/* Auto-suggestions — generated from balance + upcoming events +
                        wardrobe wishlist + best-ever episode. Each card shows the
                        proposed label / threshold / reward plus a one-line rationale
                        and a "+ Add" button that appends it to the draft goals list.
                        Already-added suggestions are dimmed with an "Added" badge. */}
                    {Array.isArray(financeSuggestions) && financeSuggestions.length > 0 && (
                      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>🤖 SUGGESTED GOALS</span>
                          <span style={{ fontSize: 10, color: 'var(--primary-text)' }}>— derived from your balance + calendar + closet</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {financeSuggestions.map(sug => {
                            const already = sug.already_exists || d.goals.some(g => g.id === sug.id || Number(g.threshold) === Number(sug.threshold));
                            return (
                              <div key={sug.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--surface-card)', borderRadius: 6, border: '1px solid var(--primary-light)', opacity: already ? 0.55 : 1 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {sug.label}
                                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--primary-text)', fontFamily: "'DM Mono', monospace" }}>
                                      {Number(sug.threshold).toLocaleString()} coins · +{Number(sug.reward_coins).toLocaleString()} reward
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sug.description}</div>
                                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", fontStyle: 'italic', marginTop: 2 }}>{sug.rationale}</div>
                                </div>
                                {already ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--success-text)', padding: '4px 10px', background: 'var(--success-bg)', borderRadius: 5 }}>✓ Added</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setFinanceEditorDraft(p => ({ ...p, goals: [...p.goals, {
                                        id: sug.id,
                                        label: sug.label,
                                        threshold: Number(sug.threshold),
                                        reward_coins: Number(sug.reward_coins),
                                        description: sug.description,
                                        triggered_at: null,
                                        episode_id: null,
                                      }] }));
                                    }}
                                    style={{ padding: '5px 14px', fontSize: 11, fontWeight: 700, border: '1px solid var(--primary)', borderRadius: 5, background: 'var(--primary)', color: 'var(--text-inverse)', cursor: 'pointer' }}
                                  >+ Add</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Starting balance */}
                    <div style={{ padding: '12px 14px', background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 10, marginBottom: 14 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>Starting balance (coins)</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={d.starting_balance}
                          onChange={e => setDraft({ starting_balance: e.target.value })}
                          style={{ ...S.inp, flex: 1, margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--lala-gold-text)' }}>coins</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>
                        Current balance: {(financeConfig?.current_balance ?? 0).toLocaleString()} coins. Saving will re-seed the starting balance — non-seed transactions stay intact.
                      </div>
                    </div>

                    {/* Goals ladder */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Milestone ladder ({d.goals.length})</label>
                        <button onClick={addGoal} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid var(--lala-parchment-3)', borderRadius: 5, background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-primary)' }}>+ Add goal</button>
                      </div>
                      {d.goals.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 12, textAlign: 'center', border: '1px dashed var(--lala-parchment-3)', borderRadius: 8 }}>
                          No milestones yet. Add one above.
                        </div>
                      )}
                      {d.goals.map((g, i) => (
                        <div key={g.id || i} style={{ padding: 10, marginBottom: 8, border: '1px solid var(--lala-parchment-3)', borderRadius: 8, background: g.triggered_at ? 'var(--success-bg)' : 'var(--surface-card)' }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <input
                              value={g.label}
                              onChange={e => updateGoal(i, { label: e.target.value })}
                              placeholder="🌟 Rising Star"
                              style={{ ...S.inp, flex: 2, margin: 0 }}
                            />
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={g.threshold}
                              onChange={e => updateGoal(i, { threshold: e.target.value })}
                              placeholder="threshold"
                              title="Balance Lala must reach to trigger this goal"
                              style={{ ...S.inp, flex: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}
                            />
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={g.reward_coins}
                              onChange={e => updateGoal(i, { reward_coins: e.target.value })}
                              placeholder="reward"
                              title="Coins paid out when goal is reached"
                              style={{ ...S.inp, flex: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}
                            />
                            <button
                              onClick={() => removeGoal(i)}
                              title="Delete this goal"
                              style={{ background: 'none', border: '1px solid var(--danger-border)', borderRadius: 6, color: 'var(--danger-text)', cursor: 'pointer', padding: '0 10px', fontSize: 14 }}
                            >×</button>
                          </div>
                          <input
                            value={g.description || ''}
                            onChange={e => updateGoal(i, { description: e.target.value })}
                            placeholder="Short description shown on the progress bar"
                            style={{ ...S.inp, width: '100%', margin: 0, fontSize: 12 }}
                          />
                          {/* Episode scope — leave as "any episode" for ladder-style
                              show-wide goals, or pin to a specific episode for per-
                              episode targets ("hit 10k by end of Ep 3"). Episode-
                              scoped goals only fire when that specific episode
                              finalizes and the threshold gets crossed. */}
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>EPISODE:</label>
                            <select
                              value={g.episode_id || ''}
                              onChange={e => updateGoal(i, { episode_id: e.target.value || null })}
                              style={{ ...S.sel, width: '100%', margin: 0, fontSize: 12 }}
                            >
                              <option value="">Any episode (show-wide ladder)</option>
                              {episodes.map(ep => (
                                <option key={ep.id} value={ep.id}>
                                  Ep {ep.episode_number || '?'}: {ep.title || 'Untitled'}
                                </option>
                              ))}
                            </select>
                          </div>
                          {g.triggered_at && (
                            <div style={{ fontSize: 10, color: 'var(--success-text)', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                              ✓ Triggered {new Date(g.triggered_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: '1px solid var(--lala-parchment-3)' }}>
                      <button onClick={() => setFinanceEditorDraft(draftFromConfig(financeConfig))} disabled={financeEditorSaving} style={{ ...S.secBtn, padding: '7px 16px' }}>Discard changes</button>
                      <button onClick={save} disabled={financeEditorSaving} style={{ ...S.primaryBtn, padding: '7px 22px' }}>
                        {financeEditorSaving ? 'Saving…' : 'Save & re-seed'}
                      </button>
                    </div>
                    </>
                    )}
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {activeTab === 'characters' && subTab === 'decisions' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧠 Decision Log</h2>
            <p style={S.muted}>Training data from your creative decisions. Powers future AI suggestions.</p>
            {decisions.length > 0 ? decisions.map((d, i) => {
              const ctx = typeof d.context_json === 'string' ? JSON.parse(d.context_json) : d.context_json;
              const dec = typeof d.decision_json === 'string' ? JSON.parse(d.decision_json) : d.decision_json;
              return (
                <div key={i} style={{ padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', background: 'var(--primary-subtle)', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--primary-text)', textTransform: 'capitalize' }}>{d.type?.replace(/_/g, ' ')}</span>
                    {d.source && <span style={{ padding: '2px 8px', background: 'var(--lala-parchment-2)', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)' }}>{d.source}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {ctx && <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>Context: {JSON.stringify(ctx)}</div>}
                  {dec && <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-all' }}>Decision: {JSON.stringify(dec)}</div>}
                </div>
              );
            }) : <p style={S.muted}>No decisions logged yet.</p>}
          </div>
        </div>
      )}


      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toast && (
        // One toast for every message on this page (F1, Evoni, 2026-10-01:
        // outcomes are reported honestly). It once always read "💉✅ Event
        // tag injected into script" on green, a failure included; now it
        // shows the message alone, a failure in red.
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


// Moved to their own modules (2026-10-25); re-exported for the existing imports.
export { S };
export { listEpisodeTodoSocialApi, loadEpisodeTaskDetails } from '../components/Show/EpisodeLedger';
export { default as OpportunitiesTab } from '../components/Show/OpportunitiesTab';

export default WorldAdmin;
