/**
 * WorldAdmin — Producer Mode, the one show workspace
 * 
 * Route: /shows/:id/world
 * 
 * Tabs (TABS below; audit IA-01/IA-02, 2026-10-03):
 *   Overview · Episodes (Production, Season Plan with Career Goals, Results)
 *   · Events · Assets (Scene Sets, Wardrobe, Lala's Phone, Audience
 *   Overlays) · Cast & Continuity (Lala's State & Continuity, Lala's
 *   Finances, Activity & Decisions) · Release (Distribution, Insights)
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getEpisodeAnchorEvent } from '../services/episodeEventsApi';
import showService from '../services/showService';
import { rememberShow } from '../utils/activeShow';
import ShowEpisodesBoard from '../components/Show/ShowEpisodesBoard';
import ShowOverview, { episodesInProduction, eventsNeedingAttention } from '../components/Show/ShowOverview';
import ShowDistributionTab from '../components/Show/ShowDistributionTab';
import ShowInsightsTab from '../components/Show/ShowInsightsTab';
import { SLOT_KEYS, SLOT_DEFS, SLOT_SUBCATEGORIES, getSlotForCategory, groupItemsBySlot } from '../lib/wardrobeSlots';
import { InvitationButton, InvitationStyleFields } from './InvitationGenerator';
import OverlayApprovalPanel from '../components/OverlayApprovalPanel';
import EpisodeTasksPanel from '../components/EpisodeTasksPanel';
import EventOutfitPicker from '../components/EventOutfitPicker';
import OpenInSceneSets from '../components/OpenInSceneSets';
import SocialTaskBadge from '../components/SocialTaskBadge';
import { EventInvitePreview } from './feed/FeedEnhancements';
import { calcEventDifficulty, eventDifficultyLabel } from '../utils/eventReadiness';
import { computeEventPackageReadiness, computeEventState, describeMissing, EVENT_QUEUE_STATES } from '../utils/eventReadinessSections';
import {
  hydrateEventForModal, sameEditorValue, changedFields, withoutOrganizerKeys, missingForMarkReady,
} from '../utils/eventEditorChanges';
import {
  createEventSaveQueue, putEventVersioned, isStaleSaveError, saveErrorMessage,
} from '../utils/eventSaveVersion';
import { MoreHorizontal, ArrowRight, ArrowLeft, Plus, Calendar, CalendarDays, Sparkles, Lightbulb, AlertTriangle, Loader2, RotateCw, X, Mail, Gem, Crown, Heart, ChevronDown, Search } from 'lucide-react';
import useWardrobeProcessing from '../hooks/useWardrobeProcessing';
import { backgroundRemovalStarted, PROCESSING_STATES } from '../utils/wardrobeProcessingState';
import { parseAiPrice, fillPrice, suggestCoinCost } from '../utils/wardrobeAutoFill';
import { EVENT_PAGE_PARAM, parseEventPage, paginateEvents, eventPageNumbers } from '../utils/eventPagination';
import { eventCardDetails, matchesDealTypeFilter, dealTypeFilterOptions } from '../utils/eventCardSummary';
import { completeMoneyWarning } from '../utils/moneyWarnings';
import './WorldAdmin.css';

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
export const listEpisodeTodoSocialApi = (epId) =>
  api.get(`/api/v1/episodes/${epId}/todo/social`).then((r) => r.data);
export const listWorldEventsApi = (showId) =>
  api.get(`/api/v1/world/${showId}/events`).then((r) => r.data);
// The Episodes ledger's "Tasks & Details" panel: the linked event's host,
// guests and venue, and the episode's social tasks (EpisodeTasksPanel).
// The episode's event for its tasks panel: the anchor from GET
// /episodes/:id/events (audit LINK-01, 2026-10-03), the same one the
// episode page, its checklist and its phone read; never a scan of the
// show's event list by used_in_episode_id, which named a different event
// for a repaired or multi-event episode.
export const loadEpisodeTaskDetails = async (epId) => {
  const [todoRes, event] = await Promise.all([
    listEpisodeTodoSocialApi(epId).catch((err) => { console.error('[WorldAdmin] social tasks load failed:', err); return {}; }),
    getEpisodeAnchorEvent(epId).catch((err) => { console.error('[WorldAdmin] episode event load failed:', err); return null; }),
  ]);
  return { event, automation: event?.canon_consequences?.automation, socialTasks: todoRes.social_tasks || [] };
};
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

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
// Maps the Feed event templates grid's own label-word `category` values to
// the ten settled world_events.category values (Evoni's taxonomy ruling,
// 2026-09-22, docs/EVENT_EPISODE_FLOW.md §8(k)/(l)). Mapped by what each
// template actually is, not by generic label-matching — 'lifestyle' maps
// to 'travel_destination' because the only template using it (Virtual
// Travel Festival) is a travel concept, not a catch-all.
const TEMPLATE_CATEGORY_MAP = {
  creator_economy: 'creator_brand',
  fashion: 'fashion',
  beauty: 'beauty_wellness',
  creative: 'arts_entertainment',
  music: 'arts_entertainment',
  lifestyle: 'travel_destination',
};
const TIER_COLORS = { slay: 'var(--lala-gold)', pass: 'var(--success)', safe: 'var(--warning)', fail: 'var(--danger)' };
const TIER_BG = { slay: 'var(--lala-gold-soft)', pass: 'var(--success-bg)', safe: 'var(--warning-bg)', fail: 'var(--danger-bg)' };
const TIER_BORDER = { slay: 'var(--lala-gold-line)', pass: 'var(--success-border)', safe: 'var(--warning-border)', fail: 'var(--danger-border)' };
const TIER_TEXT = { slay: 'var(--lala-gold-text)', pass: 'var(--success-text)', safe: 'var(--warning-text)', fail: 'var(--danger-text)' };
const TIER_EMOJIS = { slay: '👑', pass: '✨', safe: '😐', fail: '💔' };
const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };
const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];
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
const CAT_ICONS = { all: '🏷️', dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessory: '🎀', jewelry: '💍', bag: '👜', outerwear: '🧥', perfume: '🌸' };

const EMPTY_EVENT = {
  name: '', event_type: 'invite', host: '', host_brand: '', description: '',
  prestige: 5, cost_coins: 100, strictness: 5,
  deadline_type: 'medium', deadline_minutes: null,
  dress_code: '', dress_code_keywords: [], location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
  is_paid: 'no', payment_amount: 0, career_tier: 1,
  career_milestone: '', fail_consequence: '', success_unlock: '',
  // Rewards: what Lala wins for completing this event. Stat deltas
  // (coins/reputation/brand_trust/influence) feed the future
  // episode-completion delta logic; outcomes is a free-text list
  // surfaced to the writer for narrative beats.
  rewards: { coins: 0, reputation: 0, brand_trust: 0, influence: 0, outcomes: [] },
  // Requirements (access requirements): soft gates the next-event
  // suggester reads — the GET /world/:showId/suggest-events route in
  // src/routes/careerGoals.js, its "Check requirements met" block (around
  // line 621-628). Any unmet reputation_min, brand_trust_min or coins_min
  // docks the event's suggestion score by 5 and flags it "requirements
  // not met"; the event is still suggested.
  requirements: { reputation_min: 0, brand_trust_min: 0, coins_min: 0 },
  scene_set_id: null,
  venue_name: '', venue_address: '', event_date: '', event_time: '',
  theme: '', color_palette: [], mood: '', floral_style: '', border_style: '',
  // Narrative chain — links this event to the one before it and what
  // future events it plants. Used by the next-event suggester (chain
  // continuation +30, seed-match +18) and the brief snapshot.
  parent_event_id: null, chain_position: null, chain_reason: '',
  seeds_future_events: [],
  // Production overlays — array of overlay names (or type_keys) that the
  // episode generator auto-places on the timeline. Defaults to the four
  // canonical screens; per-event customization is what this form enables.
  required_ui_overlays: ['MailPanel', 'InviteLetterOverlay', 'WardrobeList', 'CareerList'],
};

// Fields the Edit details modal's 💾 Save and Mark Ready may send — only
// when their value differs from what the modal opened with (Task #1786).
const MODAL_SAVEABLE_FIELDS = [
  'name', 'event_type', 'host', 'host_brand', 'description', 'prestige', 'cost_coins', 'strictness',
  'deadline_type', 'dress_code', 'dress_code_keywords', 'location_hint', 'narrative_stakes',
  'career_milestone', 'career_tier', 'fail_consequence', 'success_unlock', 'is_paid', 'is_free',
  'payment_amount', 'browse_pool_bias', 'scene_set_id', 'venue_name', 'venue_address', 'event_date',
  'event_time', 'theme', 'mood', 'color_palette', 'floral_style', 'border_style',
];

// ─── DIFFICULTY SCORING ───
// calcDifficulty/difficultyLabel extracted to ../utils/eventReadiness.js
// as calcEventDifficulty/eventDifficultyLabel (shared with EventPackagePage).
const calcDifficulty = calcEventDifficulty;
const difficultyLabel = eventDifficultyLabel;

// ─── EVENT STATUS PIPELINE ───
const EVENT_STATUSES = ['draft', 'ready', 'used', 'scripted', 'filmed'];
const EVENT_STATUS_CONFIG = {
  draft:    { label: 'Draft', color: '#94a3b8', bg: '#f1f5f9', icon: '○' },
  ready:    { label: 'Ready', color: '#b45309', bg: '#fef3c7', icon: '◎' },
  declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2', icon: '✗' },
  used:     { label: 'Injected', color: '#6366f1', bg: '#eef2ff', icon: '◉' },
  scripted: { label: 'Scripted', color: '#16a34a', bg: '#f0fdf4', icon: '✓' },
  filmed:   { label: 'Filmed', color: '#0284c7', bg: '#f0f9ff', icon: '★' },
};

// One show workspace (Evoni, 2026-10-03: the consolidation as proposed):
// Overview · Episodes · Events · Assets · Cast & Continuity · Release. The
// show page's tabs moved here (its Episodes became Production, Distribution
// and Insights became Release); Career Goals moved into the Season Plan and
// the Decision Log into Activity & Decisions. Keys stay as they were so
// existing ?tab= links keep working.
const TABS = [
  { key: 'overview', Icon: Sparkles, label: 'Overview' },
  { key: 'episodes', Icon: CalendarDays, label: 'Episodes', subs: [
    { key: 'episodes-production', label: 'Production' },
    { key: 'season', label: 'Season Plan' },
    { key: 'episodes-ledger', label: 'Results' },
  ]},
  // Lala's Feed moved out of Producer Mode into its own Sidebar destination
  // (Task #1631) — this tab is Events only now, no sub-tabs.
  { key: 'events', Icon: Mail, label: 'Events' },
  { key: 'wardrobe', Icon: Gem, label: 'Assets', subs: [
    { key: 'scene-sets', label: 'Scene Sets' },
    { key: 'wardrobe-items', label: 'Wardrobe' },
    { key: 'overlays-tab', label: "Lala's Phone" },
    { key: 'production-overlays', label: 'Audience Overlays' },
  ]},
  { key: 'characters', Icon: Crown, label: 'Cast & Continuity', subs: [
    { key: 'characters-list', label: "Lala's State & Continuity" },
    { key: 'finances', label: "Lala's Finances" },
    { key: 'decisions', label: 'Activity & Decisions' },
  ]},
  { key: 'release', Icon: Heart, label: 'Release', subs: [
    { key: 'distribution', label: 'Distribution' },
    { key: 'insights', label: 'Insights' },
  ]},
];

function WorldAdmin() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  // Each live episode's posted money, from the ledger (§8(aa) M4, Episode
  // Money Phase A #2278): /financial-summary's by_episode, keyed by episode
  // id. The Episode Ledger reads this, not episodes.total_income/expenses.
  const [episodeMoney, setEpisodeMoney] = useState({});
  const [decisions, setDecisions] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [sceneSets, setSceneSets] = useState([]);
  // True totals from the lists' pagination (the lists stop at 100 / 200).
  const [episodesTotal, setEpisodesTotal] = useState(null);
  const [wardrobeTotal, setWardrobeTotal] = useState(null);
  // The sections whose load failed this time, for the "Couldn't load" banner.
  const [loadFailures, setLoadFailures] = useState([]);
  // How the last load failed (audit TRUTH-01, 2026-10-03): 'initial' (nothing
  // to show for those sections), 'refresh' (what loaded before stays), 'all'
  // (nothing answered: a connection failure, not an empty show).
  const [loadFailureKind, setLoadFailureKind] = useState('initial');
  const loadedOnceRef = useRef(false);
  const [goals, setGoals] = useState([]);
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
  const [opportunities, setOpportunities] = useState([]);
  const [oppQuickForm, setOppQuickForm] = useState(null);
  const [worldLocations, setWorldLocations] = useState([]);
  const [wardrobeFilter, setWardrobeFilter] = useState('all');       // all | owned | locked
  const [wardrobeTierFilter, setWardrobeTierFilter] = useState('all'); // all | basic | mid | luxury | elite
  const [wardrobeCatFilter, setWardrobeCatFilter] = useState('all');   // all | dress | top | ...
  const [seedingWardrobe, setSeedingWardrobe] = useState(false);
  const [editingWardrobeItem, setEditingWardrobeItem] = useState(null);   // item object or null
  const [wardrobeForm, setWardrobeForm] = useState({});
  const [savingWardrobe, setSavingWardrobe] = useState(false);
  const [showWardrobeUpload, setShowWardrobeUpload] = useState(false);
  const [outfitPickerEvent, setOutfitPickerEvent] = useState(null);
  // Overlay types for the show — fetched once on showId set, refetched
  // when the modal-side picker triggers a regenerate so creators see
  // newly-generated assets reflect in the readiness badges. Each entry
  // is { id, type_key, name, category, generated, ... }; the picker
  // splits them into Phone vs UI buckets via category.
  const [overlayTypes, setOverlayTypes] = useState([]);
  const [wardrobeUploading, setWardrobeUploading] = useState(false);
  const [wardrobeAnalyzing, setWardrobeAnalyzing] = useState(false);
  // Inline error banner for the auto-fill button. Replaces the old alert()
  // which users were dismissing without reading, making failures look silent.
  const [wardrobeAutoFillError, setWardrobeAutoFillError] = useState(null);
  const [wardrobeUploadBrandIsFictional, setWardrobeUploadBrandIsFictional] = useState(false);
  const [wardrobeEditBrandIsFictional, setWardrobeEditBrandIsFictional] = useState(false);
  const [wardrobeUploadFile, setWardrobeUploadFile] = useState(null);
  const [wardrobeUploadPreview, setWardrobeUploadPreview] = useState(null);
  const [wardrobeUploadForm, setWardrobeUploadForm] = useState({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: true, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' });
  // Reset the auto-fill error whenever the modal is closed or the file is
  // swapped out — stale error text against a different image would be confusing.
  useEffect(() => {
    if (!showWardrobeUpload || !wardrobeUploadFile) {
      setWardrobeAutoFillError(null);
      setWardrobeUploadBrandIsFictional(false);
    }
  }, [showWardrobeUpload, wardrobeUploadFile]);
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
      'season': ['episodes', 'season'],
      'episodes': ['episodes', 'episodes-production'],
      'episodes-production': ['episodes', 'episodes-production'],
      'episodes-ledger': ['episodes', 'episodes-ledger'],
      // Feed Events and Events Library merged into one 'events' top-level tab —
      // both old ?tab= values resolve to the same destination. 'feed' and
      // 'feed-timeline' are NOT mapped here — Lala's Feed no longer lives in
      // Producer Mode (Task #1631), so those two are redirected to the
      // standalone Feed route by the mount effect below, before this
      // function is even called.
      'feed-events': ['events', null],
      'scene-sets': ['wardrobe', 'scene-sets'],
      'overlays': ['wardrobe', 'overlays-tab'],
      'overlays-tab': ['wardrobe', 'overlays-tab'],
      'production-overlays': ['wardrobe', 'production-overlays'],
      // Career Goals live in the Season Plan.
      'goals': ['episodes', 'season'],
      'wardrobe': ['wardrobe', 'scene-sets'],
      'characters': ['characters', 'characters-list'],
      'decisions': ['characters', 'decisions'],
      'finances': ['characters', 'finances'],
      'release': ['release', 'distribution'],
      'distribution': ['release', 'distribution'],
      'insights': ['release', 'insights'],
    };
    return oldToNew[tab] || [tab, null];
  };

  // On mount, resolve initial tab. ?tab=feed and ?tab=feed-timeline are old
  // deep-links into Lala's Feed, which no longer lives in Producer Mode
  // (Task #1631) — redirect to its standalone Sidebar destination instead of
  // resolving a local tab.
  useEffect(() => {
    if (initialTab === 'feed' || initialTab === 'feed-timeline') {
      navigate('/feed?layer=lalaverse', { replace: true });
      return;
    }
    const [main, sub] = resolveTab(initialTab);
    if (main !== initialTab) setActiveTab(main);
    // A main tab with sub-tabs always opens one (Task #2289): ?tab=episodes
    // resolves to ['episodes', 'episodes-ledger'], whose main is the tab
    // itself, so the sub-tab was never set and the page body stayed empty.
    // Otherwise its first sub-tab, as switchTab does.
    const landing = sub || TABS.find((t) => t.key === main)?.subs?.[0]?.key || null;
    if (landing) setSubTab(landing);
  }, []);

  // Open a section by its tab or sub-tab key (the Overview's links).
  const goTo = (key) => {
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
  const [expandedEpisode, setExpandedEpisode] = useState(null);
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

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [generateTarget, setGenerateTarget] = useState(null);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');
  // Deal-type filter, next to the status filters (Task #2361).
  const [eventDealFilter, setEventDealFilter] = useState('all');
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

  const [feedEventResults, setFeedEventResults] = useState({}); // { templateName: { status, event } }
  const [eventSort, setEventSort] = useState('name'); // name | prestige | cost | created | status
  // Shared "Also draft a script" toggle — applies to single-event AND
  // multi-event generate. Unchecked by default to keep token spend low
  // unless the creator opts in. (Bulk-select state already lives above
  // as bulkMode / selectedEvents — reused here for multi-event generate.)
  const [draftScriptOnGenerate, setDraftScriptOnGenerate] = useState(false);
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
  const setEventPage = (n) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (n > 1) next.set(EVENT_PAGE_PARAM, String(n));
      else next.delete(EVENT_PAGE_PARAM);
      return next;
    }, { replace: true });
  };
  const goToEventPage = (n) => {
    setEventPage(n);
    requestAnimationFrame(() => eventsGridRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };
  // The inline event editor renders above the queue, but it can be opened
  // from below it (a warning's Edit, a suggestion's + Create, a template).
  // Bring its top into view when it opens off-screen.
  const eventEditorRef = useRef(null);
  useEffect(() => {
    if (!editingEvent || activeTab !== 'events') return;
    requestAnimationFrame(() => {
      const el = eventEditorRef.current;
      if (!el?.getBoundingClientRect) return;
      const { top } = el.getBoundingClientRect();
      if (top < 0 || top > window.innerHeight) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }, [editingEvent, activeTab]);
  const [openEventMenuId, setOpenEventMenuId] = useState(null);
  // Which open card menu is showing the "Change status" sub-list (null =
  // none; the menu's normal item list otherwise).
  const [statusMenuEventId, setStatusMenuEventId] = useState(null);
  const [aiRevising, setAiRevising] = useState(false);
  const [compareEvents, setCompareEvents] = useState(null); // [eventA, eventB]
  const [generating, setGenerating] = useState(false);
  const [seedingEvents, setSeedingEvents] = useState(false);
  const [lastGeneratedEpisodeId, setLastGeneratedEpisodeId] = useState(null);

  // Character editor state
  const [editingStats, setEditingStats] = useState(false);
  const [statForm, setStatForm] = useState({});
  const [savingStats, setSavingStats] = useState(false);

  // Goal editor state
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '#6366f1', description: '' });
  const [savingGoal, setSavingGoal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

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

  const loadData = async () => {
    setLoading(true); setError(null);
    // A section whose request fails is named in the "Couldn't load" banner,
    // so an empty list there is never mistaken for "there are none".
    const failed = [];
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
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(r => {
          const list = r.data?.episodes || r.data?.data || r.data || [];
          const rows = Array.isArray(list) ? list : [];
          setEpisodes(rows);
          // The true count; the list itself stops at 100.
          setEpisodesTotal(Number.isFinite(r.data?.pagination?.total) ? r.data.pagination.total : rows.length);
        }).catch(miss('episodes', () => { setEpisodes([]); setEpisodesTotal(null); })),
        api.get(`/api/v1/world/${showId}/history`).then(r => setStateHistory(r.data?.history || [])).catch(miss('state history', () => setStateHistory([]))),
        api.get(`/api/v1/shows/${showId}/financial-summary`).then(r => {
          const byId = {};
          for (const e of r.data?.by_episode || []) byId[e.episode_id] = e;
          setEpisodeMoney(byId);
        }).catch(miss('episode money', () => setEpisodeMoney({}))),
        api.get(`/api/v1/world/${showId}/decisions`).then(r => setDecisions(r.data?.decisions || [])).catch(miss('decisions', () => setDecisions([]))),
        api.get(`/api/v1/world/${showId}/events`).then(r => setWorldEvents(r.data?.events || [])).catch(miss('events', () => setWorldEvents([]))),
        // This show's sets plus the shared ones (audit CTX-03: the list is
        // scoped on the server); the pickers offer those, the Overview counts
        // this show's.
        api.get(`/api/v1/scene-sets?show_id=${showId}&limit=200`).then(r => setSceneSets(r.data?.data || [])).catch(miss('scene sets', () => setSceneSets([]))),
        api.get(`/api/v1/ui-overlays/${showId}`).then(r => setOverlayData(r.data?.data || [])).catch(miss('overlays', () => setOverlayData([]))),
        api.get(`/api/v1/world/${showId}/goals`).then(r => setGoals(r.data?.goals || [])).catch(miss('career goals', () => setGoals([]))),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`).then(r => {
          const rows = r.data?.data || [];
          setWardrobeItems(rows);
          // The true count; the list itself stops at 200.
          setWardrobeTotal(Number.isFinite(r.data?.pagination?.total) ? r.data.pagination.total : rows.length);
        }).catch(miss('wardrobe', () => { setWardrobeItems([]); setWardrobeTotal(null); })),
        api.get(`/api/v1/opportunities/${showId}`).then(r => setOpportunities(r.data?.opportunities || [])).catch(miss('opportunities', () => setOpportunities([]))),
        api.get('/api/v1/world/locations').then(r => setWorldLocations(r.data?.locations || [])).catch(miss('world locations', () => setWorldLocations([]))),
      ];
      await Promise.allSettled(requests);
      setLoadFailures(failed);
      setLoadFailureKind(failed.length === requests.length ? 'all' : (refresh ? 'refresh' : 'initial'));
      if (failed.length < requests.length) loadedOnceRef.current = true;
    } finally { setLoading(false); }
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

  // ── Event → Script generation ──
  const handleGenerateScriptFromEvent = async (eventId, episodeId) => {
    setGenerating(true);
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
        setToast('✅ Script generated! Check the episode.');
        setTimeout(() => setToast(null), 4000);
        // Advance event status
        setWorldEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: 'scripted' } : ev));
      }
    } catch (err) {
      setToast(err.response?.data?.error || 'Script generation failed');
      setTimeout(() => setToast(null), 4000);
    } finally { setGenerating(false); }
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

  // ─── GOAL CRUD ───
  const saveGoal = async () => {
    setSavingGoal(true); setError(null);
    try {
      if (editingGoal === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/goals`, goalForm);
        if (res.data.success) { setGoals(p => [res.data.goal, ...p]); setEditingGoal(null); setSuccessMsg('Goal created!'); }
        else setError(res.data.error);
      } else {
        const res = await api.put(`/api/v1/world/${showId}/goals/${editingGoal}`, goalForm);
        if (res.data.success) { setGoals(p => p.map(g => g.id === editingGoal ? res.data.goal : g)); setEditingGoal(null); setSuccessMsg('Goal updated!'); }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingGoal(false); }
  };

  const deleteGoal = async (goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    try { await api.delete(`/api/v1/world/${showId}/goals/${goalId}`); setGoals(p => p.filter(g => g.id !== goalId)); setSuccessMsg('Deleted'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const syncGoals = async () => {
    try {
      const res = await api.post(`/api/v1/world/${showId}/goals/sync`);
      if (res.data.success) {
        setSuccessMsg(`Synced ${res.data.synced} goals.${res.data.completed?.length ? ` 🎉 Completed: ${res.data.completed.map(c => c.title).join(', ')}` : ''}`);
        loadData();
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/suggest-events?limit=3`);
      if (res.data.success) setSuggestions(res.data.suggestions || []);
    } catch (e) { setSuggestions([]); }
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

  // ─── DERIVED ───
  const acceptedEpisodes = episodes.filter(ep => ep.evaluation_status === 'accepted');
  const tierCounts = acceptedEpisodes.reduce((acc, ep) => {
    const tier = ep.evaluation_json?.tier_final; if (tier) acc[tier] = (acc[tier] || 0) + 1; return acc;
  }, {});
  const overrideCount = acceptedEpisodes.filter(ep => (ep.evaluation_json?.overrides || []).length > 0).length;

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
              {season ? <span className="wa-chip wa-chip-season">Season {season}</span> : null}
              {producing ? (
                <Link className="wa-chip wa-chip-producing" to={`/episodes/${producing.id}`}>
                  Producing Episode {producing.episode_number ?? ''}
                </Link>
              ) : null}
            </div>
            <div className="wa-hero-links">
              {/* The show menu: the show's own settings live here, not on a separate show page. */}
              <Link className="wa-hero-link" to={`/shows/${showId}/edit`}>Edit show</Link>
              <Link className="wa-hero-link" to={`/shows/${showId}/settings`}>Settings</Link>
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

      {/* ─── TABS ─── */}
      {(() => {
        // The count on a tab is what is waiting there: episodes in
        // production, events whose setup is incomplete.
        const counts = { episodes: episodesInProduction(episodes).length, events: eventsNeedingAttention(worldEvents).length };
        return (
          <nav className="wa-tab-bar" aria-label="Producer Mode">
            {TABS.map(t => {
              const n = counts[t.key] || 0;
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
          Continuity; tiers are in Episodes → Results. */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          <ShowOverview
            showId={showId}
            episodes={episodes}
            events={worldEvents}
            stateHistory={stateHistory}
            decisions={decisions}
            charState={charState}
            wardrobeCount={wardrobeTotal ?? wardrobeItems.length}
            goTo={goTo}
          />
        </div>
      )}

      {activeTab === 'episodes' && subTab === 'episodes-production' && (
        <div style={S.content}>
          <ShowEpisodesBoard showId={showId} episodes={episodes} total={episodesTotal} onChanged={loadData} />
        </div>
      )}

      {activeTab === 'episodes' && subTab === 'season' && (
        <SeasonTab showId={showId} api={api} S={S} episodes={episodes} setToast={setToast} />
      )}

      {/* ════════════════════════ EPISODE LEDGER ════════════════════════ */}
      {activeTab === 'episodes' && subTab === 'episodes-ledger' && (
        <div style={S.content}>
          {/* Tiers across the season's evaluated episodes (moved from the Overview). */}
          {Object.keys(tierCounts).length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏆 Tier Distribution</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                {['slay', 'pass', 'safe', 'fail'].map(tier => (
                  <div key={tier} style={{ flex: 1, padding: 14, borderRadius: 10, textAlign: 'center', background: TIER_BG[tier], border: `2px solid ${TIER_BORDER[tier]}` }}>
                    <div style={{ fontSize: 22 }}>{TIER_EMOJIS[tier]}</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>{tierCounts[tier] || 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{tier.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>Episode Ledger</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{episodes.length} episodes · {acceptedEpisodes.length} evaluated</div>
          </div>

          {/* Financial Summary */}
          {(() => {
            // From the ledger (M4): each listed episode's posted rows.
            const moneyOf = (e) => episodeMoney[e.id] || { income: 0, expenses: 0 };
            const totalIncome = episodes.reduce((s, e) => s + (Number(moneyOf(e).income) || 0), 0);
            const totalExpenses = episodes.reduce((s, e) => s + (Number(moneyOf(e).expenses) || 0), 0);
            const net = totalIncome - totalExpenses;
            const epsWithFinancials = episodes.filter(e => moneyOf(e).income > 0 || moneyOf(e).expenses > 0).length;
            if (epsWithFinancials === 0) return null;
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--success-text)', marginBottom: 4 }}>Total Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-text)' }}>{totalIncome.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--danger-text)', marginBottom: 4 }}>Total Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-text)' }}>{totalExpenses.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: net >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${net >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)', marginBottom: 4 }}>Net P&L</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Episodes with P&L</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{epsWithFinancials} / {episodes.length}</div>
                </div>
              </div>
            );
          })()}

          {episodes.map((ep, i) => {
            const ej = ep.evaluation_json;
            const tier = ej?.tier_final;
            const score = ej?.score;
            const isExpanded = expandedEpisode === ep.id;
            // This episode's posted money, from the ledger (M4; #2278).
            const epIncome = Number(episodeMoney[ep.id]?.income) || 0;
            const epExpenses = Number(episodeMoney[ep.id]?.expenses) || 0;
            const epHistory = stateHistory.filter(h => h.episode_id === ep.id);
            const deltas = epHistory.length > 0 ? (typeof epHistory[0].deltas_json === 'string' ? JSON.parse(epHistory[0].deltas_json) : epHistory[0].deltas_json) : null;
            const stateAfter = epHistory.length > 0 ? (typeof epHistory[0].state_after_json === 'string' ? JSON.parse(epHistory[0].state_after_json) : epHistory[0].state_after_json) : null;
            // The saved event–episode link (the event's used_in_episode_id), not
            // the event's name appearing in the script.
            const linkedEvent = worldEvents.find(ev => ev.used_in_episode_id && String(ev.used_in_episode_id) === String(ep.id));

            return (
              <div key={ep.id} style={{ background: 'var(--surface-card)', border: isExpanded ? '2px solid var(--primary)' : '1px solid var(--lala-parchment-3)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', transition: 'border 0.2s' }}>
                {/* Row header — always visible */}
                <div onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-text)', flex: '0 0 36px' }}>
                    {ep.episode_number || i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{ep.title || 'Untitled'}</div>
                    {linkedEvent && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{EVENT_TYPE_ICONS[linkedEvent.event_type]} {linkedEvent.name}</div>}
                  </div>
                  {tier && <span style={S.tierPill(tier)}>{TIER_EMOJIS[tier]} {tier.toUpperCase()}</span>}
                  {score && <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 8px' }}>{score}</span>}
                  <span style={S.statusPill(ep.evaluation_status)}>{ep.evaluation_status || 'draft'}</span>
                  {deltas && (
                    <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                      {Object.entries(deltas).filter(([, v]) => typeof v === 'number' && v !== 0).slice(0, 3).map(([k, v]) => (
                        <span key={k} style={{ ...S.deltaBadge(v), fontSize: 10 }}>{STAT_ICONS[k]}{v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded case file */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--lala-parchment-3)' }}>

                    {/* ── Stat Impact ── */}
                    {deltas && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Stat Impact</div>
                        <div className="wa-grid wa-grid-5col" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                          {Object.entries(deltas).map(([k, v]) => {
                            if (typeof v !== 'number') return null;
                            const afterVal = stateAfter ? stateAfter[k] : null;
                            const beforeVal = afterVal !== null ? afterVal - v : null;
                            return (
                              <div key={k} style={{ padding: 10, background: v > 0 ? 'var(--success-bg)' : v < 0 ? 'var(--danger-bg)' : 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 14 }}>{STAT_ICONS[k]}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                                {beforeVal !== null ? (
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{beforeVal}</span>
                                    <span style={{ color: 'var(--text-secondary)', margin: '0 3px' }}>→</span>
                                    <span style={{ color: v > 0 ? 'var(--success-text)' : v < 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>{afterVal}</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 14, fontWeight: 700, color: v > 0 ? 'var(--success-text)' : v < 0 ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                                    {v > 0 ? '+' : ''}{v}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Event Reference ── */}
                    {linkedEvent && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💌 Event</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{linkedEvent.name}</span>
                          <span style={S.eTag}>⭐ {linkedEvent.prestige}</span>
                          {/* No 🪙 cost_coins tag (§8(ff) Q14): the Episode Ledger's money is the ledger's. A deal's difficulty is not money. */}
                          {linkedEvent.deal_type && <span style={S.eTag}>Difficulty {linkedEvent.cost_coins}</span>}
                          <span style={S.eTag}>📏 {linkedEvent.strictness}</span>
                          {linkedEvent.is_paid && <span style={{ padding: '2px 8px', background: 'var(--success-bg)', borderRadius: 4, fontSize: 10, fontWeight: 600, color: 'var(--success-text)' }}>💰 Paid</span>}
                          {linkedEvent.career_milestone && <span style={{ padding: '2px 8px', background: 'var(--primary-subtle)', borderRadius: 4, fontSize: 10, color: 'var(--primary-text)' }}>🎯 {linkedEvent.career_milestone}</span>}
                        </div>
                        {linkedEvent.narrative_stakes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4 }}>{linkedEvent.narrative_stakes}</div>}
                      </div>
                    )}

                    {/* ── Scene Set ── */}
                    {linkedEvent?.scene_set_id && (() => {
                      const ss = sceneSets.find(s => s.id === linkedEvent.scene_set_id);
                      return ss ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Location</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6 }} />}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{ss.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ss.scene_type?.replace(/_/g, ' ')} · {ss.angles?.length || 0} angles</div>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* ── Wardrobe for this episode ── */}
                    {(() => {
                      const epWardrobe = wardrobeItems.filter(w => w.episode_id === ep.id);
                      return epWardrobe.length > 0 ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>👗 Wardrobe ({epWardrobe.length})</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {epWardrobe.slice(0, 6).map(w => (
                              <span key={w.id} style={{ padding: '3px 8px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-light)', borderRadius: 6, fontSize: 10, color: 'var(--accent-dark)', fontWeight: 600 }}>
                                {w.name || w.category || 'Item'}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* ── Generate Script button ── */}
                    {linkedEvent && (
                      <div style={{ marginTop: 14 }}>
                        <button onClick={() => handleGenerateScriptFromEvent(linkedEvent.id, ep.id)} disabled={generating}
                          style={{ padding: '6px 16px', background: generating ? 'var(--lala-parchment-2)' : 'var(--primary)', color: generating ? 'var(--text-secondary)' : 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}>
                          {generating ? '⏳ Generating...' : '📝 Generate Script from Event'}
                        </button>
                      </div>
                    )}

                    {/* ── Episode Financials ── */}
                    {(epIncome > 0 || epExpenses > 0) && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Episode P&L</div>
                        {/* Lala's money across the season has one home: Cast & Continuity → Lala's Finances. */}
                        <button type="button" onClick={() => goTo('finances')} data-testid={`ledger-finances-link-${ep.id}`}
                          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: 'var(--lala-gold-text)', fontSize: 12, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                          Lala's Finances →
                        </button>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ padding: '8px 14px', background: 'var(--success-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--success-text)' }}>Income</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-text)' }}>{epIncome}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: 'var(--danger-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--danger-text)' }}>Expenses</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger-text)' }}>{epExpenses}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: epIncome >= epExpenses ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Net</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: epIncome >= epExpenses ? 'var(--success-text)' : 'var(--danger-text)' }}>
                              {(epIncome - epExpenses).toFixed(0)}
                            </div>
                          </div>
                          {ep.financial_score && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: 'var(--lala-gold-text)' }}>Financial IQ</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--lala-gold-text)' }}>{ep.financial_score}/10</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Social Tasks + Beats (load on demand; opens and closes) ── */}
                    <EpisodeTasksPanel
                      episodeId={ep.id}
                      load={loadEpisodeTaskDetails}
                      buttonStyle={{ ...S.smBtn, background: 'var(--surface-bg)', borderColor: 'var(--lala-parchment-3)', color: 'var(--lala-gold-text)' }}
                    />

                    {/* ── Evaluation Details ── */}
                    {ej && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Evaluation</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {ej.outfit_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Outfit Match</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.outfit_match}/25</div>
                            </div>
                          )}
                          {ej.accessory_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Accessory</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.accessory_match}/25</div>
                            </div>
                          )}
                          {ej.event_prestige_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Prestige</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.event_prestige_score}/30</div>
                            </div>
                          )}
                          {ej.timing_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Timing</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.timing_score}/20</div>
                            </div>
                          )}
                          {(ej.overrides || []).length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--warning-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--warning-text)' }}>Overrides</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.overrides.length} ⬆️</div>
                            </div>
                          )}
                        </div>
                        {ej.narrative_line && (
                          <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: `3px solid ${TIER_COLORS[tier] || 'var(--primary)'}` }}>
                            "{ej.narrative_line}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Unlocks ── */}
                    {linkedEvent?.success_unlock && tier && (tier === 'slay' || tier === 'pass') && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✨ Unlocked</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {linkedEvent.success_unlock.split(',').map((u, ui) => (
                            <span key={ui} style={{ padding: '4px 10px', background: 'var(--warning-bg)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--warning-text)' }}>
                              ✨ {u.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--lala-parchment-3)' }}>
                      <Link to={`/episodes/${ep.id}`} style={{ ...S.smBtn, textDecoration: 'none' }}>Edit Episode</Link>
                      <Link to={`/episodes/${ep.id}/todo`} style={{ ...S.smBtn, textDecoration: 'none', background: 'var(--surface-bg)', borderColor: 'var(--lala-parchment-3)', color: 'var(--lala-gold-text)' }}>Todo List</Link>
                      <Link to={`/episodes/${ep.id}/evaluate`} style={{ ...S.smBtn, textDecoration: 'none', background: 'var(--primary-subtle)', borderColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>Evaluate</Link>
                      {ep.script_content && <span style={{ ...S.smBtn, color: 'var(--success-text)' }}>✅ Has Script ({(ep.script_content || '').split('\n').length} lines)</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {episodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No episodes yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Create an episode from the Show page, then come back here.</div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ EVENTS LIBRARY ════════════════════════ */}
      {activeTab === 'events' && (
        <div style={S.content}>
          {/* Header — a queue, not an editor (docs/EVENT_EPISODE_FLOW.md §8(m),
              Evoni's ruling, Task #1648). Counts below come from the same
              five computed states the filter bar and cards use
              (computeEventState, ../utils/eventReadinessSections.js) — not the raw,
              inconsistently-written world_events.status column §4 of that
              doc already documents. */}
          <div className="wa-ev-head">
            <div className="wa-ev-head-title">
              <h2>Events</h2>
              <span>Invitations and opportunities that can become episodes · {worldEvents.length} events</span>
            </div>
            <div className="wa-ev-head-actions">
              <label className="wa-ev-search">
                <Search size={15} aria-hidden="true" />
                <input type="text" value={eventSearch} onChange={e => { setEventSearch(e.target.value); setEventPage(1); }} placeholder="Search events" aria-label="Search events" />
              </label>
              <button onClick={() => navigate(`/shows/${showId}/new-episode`)} style={S.primaryBtn}>
                <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New event
              </button>
            </div>
            <div className="wa-ev-head-tools">
              <button onClick={async () => {
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
              }} disabled={autoFilling} style={S.smBtn}>
                {autoFilling ? '⏳ Generating...' : '🗓️ Auto-Fill This Month'}
              </button>
              {/* + New event (beside the search, above) opens the choose-host
                  flow (Task #1628), same entry point as New Episode — an
                  event created here always starts with a host, unlike the
                  system-created paths (Needs Host below). Manual/no-host
                  creation is still reachable from the empty state's
                  "+ Create Manually". */}
              {/* Creation tools (Feed opportunities and event templates) open
                  in a drawer (Evoni, 2026-09-30). */}
              <button type="button" data-testid="events-ideas-button" aria-haspopup="dialog" aria-expanded={eventsIdeasOpen}
                onClick={() => setEventsIdeasOpen(true)}
                style={S.smBtn} title="Feed opportunities and event ideas">
                <Lightbulb size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />Ideas
              </button>
              <button onClick={() => setEventsHeaderMenuOpen(o => !o)} style={S.smBtn} title="More actions" aria-label="More actions">
                <MoreHorizontal size={16} />
              </button>
              {eventsHeaderMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setEventsHeaderMenuOpen(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 41, minWidth: 180, overflow: 'hidden' }}>
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

          {/* The queue's five computed states as count cards (Task #1648,
              docs/EVENT_EPISODE_FLOW.md §8(m); Evoni's redesign, 2026-10-05):
              computeEventState is the same function the cards below use, so a
              count here always matches what's shown. A card filters; clicking
              the chosen card again shows all. */}
          <div className="wa-ev-states" role="group" aria-label="Filter by state">
            {Object.entries(EVENT_QUEUE_STATES).map(([key, cfg]) => {
              const n = worldEvents.filter(e => computeEventState(e) === key).length;
              const on = eventStatusFilter === key;
              return (
                <button key={key} type="button" data-testid={`events-filter-${key}`} aria-pressed={on}
                  className={`wa-ev-state${on ? ' active' : ''}`}
                  onClick={() => { setEventStatusFilter(on ? 'all' : key); setEventPage(1); }}>
                  <span className="wa-ev-state-label" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="wa-ev-state-count">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="wa-ev-refine">
            {eventStatusFilter !== 'all' && (
              <button type="button" className="wa-ev-show-all" data-testid="events-filter-all" onClick={() => { setEventStatusFilter('all'); setEventPage(1); }}>
                Show all {worldEvents.length}
              </button>
            )}
            <select data-testid="events-deal-filter" aria-label="Filter by deal type" value={eventDealFilter}
              onChange={e => { setEventDealFilter(e.target.value); setEventPage(1); }}
              style={{ padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 11, background: eventDealFilter === 'all' ? 'var(--surface-card)' : 'var(--primary-subtle)', cursor: 'pointer', maxWidth: '100%' }}>
              {dealTypeFilterOptions(worldEvents).map(o => (
                <option key={o.key} value={o.key}>{o.label} ({o.count})</option>
              ))}
            </select>
            <select value={eventSort} onChange={e => { setEventSort(e.target.value); setEventPage(1); }} style={{ padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 11, background: 'var(--surface-card)', cursor: 'pointer' }}>
              <option value="name">Sort: Name</option>
              <option value="prestige">Sort: Prestige ↓</option>
              <option value="cost">Sort: Cost ↓</option>
              <option value="status">Sort: Status</option>
              <option value="created">Sort: Newest</option>
            </select>
          </div>

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
          {editingEvent && (
            <div ref={eventEditorRef} data-testid="event-editor" style={{ background: 'var(--surface-card)', border: '2px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 16, scrollMarginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingEvent === 'new' ? '✨ New Event' : '✏️ Edit Event'}</h3>
                {/* Read-only badge when this event was spawned from a feed
                    profile (worldEvents.js POST /from-profile sets the FK).
                    Lets creators see the lineage without diving into the
                    canon_consequences JSON, and hints to edit the source
                    profile rather than this event for new traits. */}
                {eventForm.source_profile_id && (
                  <span
                    title="Created from a feed profile — edit the profile to change brand, lifestyle, or persona traits."
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--accent-subtle)', color: 'var(--accent-dark)', border: '1px solid var(--accent-light)', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4 }}
                  >
                    🌐 FROM FEED · profile #{eventForm.source_profile_id}
                  </span>
                )}
              </div>
              {/* Duplicate detection warning + AI Revise */}
              {eventForm.name && findSimilarEvents(eventForm.name).length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--warning-text)' }}>
                    ⚠️ Similar events: {findSimilarEvents(eventForm.name).map(e => e.name).join(', ')}
                  </div>
                  <button onClick={handleAiRevise} disabled={aiRevising} style={{
                    padding: '5px 14px', background: aiRevising ? 'var(--lala-parchment-2)' : 'var(--primary)',
                    color: aiRevising ? 'var(--text-faint)' : 'var(--text-inverse)', border: 'none', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: aiRevising ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {aiRevising ? '⏳ Revising...' : '✨ AI Revise'}
                  </button>
                </div>
              )}

              {/* Venue & Location — WorldLocation picker + scene set */}
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--surface-bg)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)' }}>
                <label style={{ ...S.fLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>📍 Venue & Location</label>

                {/* WorldLocation venue picker — auto-fills name + address */}
                <div style={{ marginBottom: 8 }}>
                  <select
                    value={eventForm.venue_location_id || ''}
                    onChange={e => {
                      const locId = e.target.value || null;
                      const loc = worldLocations.find(l => l.id === locId);
                      const addr = loc ? [loc.street_address, loc.district, loc.city].filter(Boolean).join(', ') : '';
                      setEventForm(p => ({
                        ...p,
                        venue_location_id: locId,
                        venue_name: loc?.name || p.venue_name || '',
                        venue_address: addr || p.venue_address || '',
                        location_hint: addr || loc?.name || p.location_hint || '',
                      }));
                    }}
                    style={{ ...S.sel, width: '100%', marginBottom: 6 }}
                  >
                    <option value="">— Choose a venue from World Locations —</option>
                    {worldLocations.filter(l => l.location_type === 'venue' || l.location_type === 'interior' || l.venue_type).map(l => (
                      <option key={l.id} value={l.id}>🏪 {l.name}{l.venue_type ? ` (${l.venue_type.replace(/_/g, ' ')})` : ''}{l.district ? ` — ${l.district}` : ''}</option>
                    ))}
                    <option disabled>──── Other locations ────</option>
                    {worldLocations.filter(l => l.location_type !== 'venue' && !l.venue_type).map(l => (
                      <option key={l.id} value={l.id}>📍 {l.name} ({l.location_type})</option>
                    ))}
                  </select>
                </div>

                {/* Venue name + address (editable, auto-filled from location) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    value={eventForm.venue_name || ''}
                    onChange={e => setEventForm(p => ({ ...p, venue_name: e.target.value }))}
                    placeholder="Venue Name (e.g. Club Noir)"
                    style={S.sel}
                  />
                  <input
                    value={eventForm.venue_address || ''}
                    onChange={e => setEventForm(p => ({ ...p, venue_address: e.target.value }))}
                    placeholder="Address (e.g. 742 Ocean Drive, South Beach, Miami)"
                    style={S.sel}
                  />
                </div>

                {/* Event date + time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    value={eventForm.event_date || ''}
                    onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))}
                    placeholder="Event Date (e.g. Friday, March 15th)"
                    style={S.sel}
                  />
                  <input
                    value={eventForm.event_time || ''}
                    onChange={e => setEventForm(p => ({ ...p, event_time: e.target.value }))}
                    placeholder="Time (e.g. 9:00 PM - 2:00 AM)"
                    style={S.sel}
                  />
                </div>

                {/* Scene set picker for visual representation */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={eventForm.scene_set_id || ''} onChange={e => setEventForm(p => ({ ...p, scene_set_id: e.target.value || null }))} style={{ ...S.sel, flex: 1, minWidth: 200 }}>
                    <option value="">— Scene Set (visual) —</option>
                    {sceneSets.filter(ss => ss.scene_type === 'EVENT_LOCATION').map(ss => (
                      <option key={ss.id} value={ss.id}>🎬 {ss.name} (EVENT)</option>
                    ))}
                    {sceneSets.filter(ss => ss.scene_type !== 'EVENT_LOCATION' && ss.base_still_url).map(ss => (
                      <option key={ss.id} value={ss.id}>📍 {ss.name} ({ss.scene_type?.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                  {eventForm.scene_set_id && (() => {
                    const ss = sceneSets.find(s => s.id === eventForm.scene_set_id);
                    return ss ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--lala-parchment-3)' }} />}
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success-text)' }}>✓ {ss.name}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }} className="wa-grid wa-grid-3col">
                <FG label="Event Name *" value={eventForm.name} onChange={v => setEventForm(p => ({ ...p, name: v }))} placeholder="Velour Society Garden Soirée" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))} style={S.sel}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <FG label="Host (who's hosting)" value={eventForm.host || ''} onChange={v => setEventForm(p => ({ ...p, host: v }))} placeholder="Velour Society, Fashion Week Committee" />
                <FG label="Brand Sponsor (optional)" value={eventForm.host_brand} onChange={v => setEventForm(p => ({ ...p, host_brand: v }))} placeholder="Velour, Chanel (leave empty if none)" />
                <FG label="Prestige (1-10)" value={eventForm.prestige} onChange={v => setEventForm(p => ({ ...p, prestige: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <FG label={eventForm.deal_type ? 'Difficulty' : 'Cost (coins)'} value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} disabled={eventForm.is_paid === 'free'} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {/* Optional minute count — overrides whatever the type implies
                    when set. Used by the brief snapshot's event_difficulty
                    block. Leave blank for "use the default for this type". */}
                <FG
                  label="Deadline minutes (optional)"
                  value={eventForm.deadline_minutes ?? ''}
                  onChange={v => setEventForm(p => ({ ...p, deadline_minutes: v === '' ? null : parseInt(v, 10) || null }))}
                  type="number"
                  min={1}
                  placeholder="e.g. 90"
                />
                <FG label="Dress Code" value={eventForm.dress_code} onChange={v => setEventForm(p => ({ ...p, dress_code: v }))} placeholder="romantic couture" />
                <div>
                  <label style={S.fLabel}>Dress Code Keywords</label>
                  <input
                    type="text"
                    value={(eventForm.dress_code_keywords || []).join(', ')}
                    onChange={e => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                      setEventForm(p => ({ ...p, dress_code_keywords: keywords }));
                    }}
                    placeholder="romantic, garden, floral, soft"
                    style={S.sel}
                  />
                  {(eventForm.dress_code_keywords || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {eventForm.dress_code_keywords.map((kw, i) => (
                        <span key={i} style={{ padding: '2px 8px', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 6, fontSize: 11, color: 'var(--primary-text)', fontWeight: 600 }}>
                          {kw}
                          <button onClick={() => setEventForm(p => ({ ...p, dress_code_keywords: p.dress_code_keywords.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: 4, fontSize: 12 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={S.fLabel}>Browse Pool Bias</label>
                  <select value={eventForm.browse_pool_bias} onChange={e => setEventForm(p => ({ ...p, browse_pool_bias: e.target.value }))} style={S.sel}>
                    {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {/* Pool size pairs with bias — bias is the lean (luxury / mid /
                    balanced), size is how many candidates to surface. Default
                    is 8; bump for big browse moments, drop for tight choices. */}
                <FG
                  label="Browse Pool Size"
                  value={eventForm.browse_pool_size ?? 8}
                  onChange={v => setEventForm(p => ({ ...p, browse_pool_size: parseInt(v, 10) || 8 }))}
                  type="number"
                  min={1}
                  max={50}
                />
              </div>

              {/* Invitation Style */}
              <InvitationStyleFields formData={eventForm} setFormData={setEventForm} />

              {/* Career & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, padding: 12, background: 'var(--surface-bg)', borderRadius: 8 }}>
                <div>
                  <label style={S.fLabel}>Career Tier</label>
                  <select value={eventForm.career_tier} onChange={e => setEventForm(p => ({ ...p, career_tier: parseInt(e.target.value) }))} style={S.sel}>
                    <option value={1}>1 — Emerging (Rep 0-2)</option>
                    <option value={2}>2 — Rising (Rep 3-4)</option>
                    <option value={3}>3 — Established (Rep 5-6)</option>
                    <option value={4}>4 — Influential (Rep 7-8)</option>
                    <option value={5}>5 — Elite (Rep 9-10)</option>
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Event Cost Type</label>
                  <select value={eventForm.is_paid || 'no'} onChange={e => { const val = e.target.value; setEventForm(p => ({ ...p, is_paid: val, cost_coins: val === 'free' ? 0 : p.cost_coins })); }} style={S.sel}>
                    <option value="no">No — Lala pays to attend</option>
                    <option value="yes">Yes — Lala gets paid</option>
                    <option value="free">Free — No cost to attend</option>
                  </select>
                  {eventForm.is_paid === 'free' && <div style={{ fontSize: 10, color: 'var(--success-text)', marginTop: 2 }}>Free event — no cost.</div>}
                  {eventForm.is_paid === 'yes' && <div style={{ fontSize: 10, color: 'var(--primary-text)', marginTop: 2 }}>Lala earns coins for attending.</div>}
                </div>
                <FG label="Payment (if paid)" value={eventForm.payment_amount} onChange={v => setEventForm(p => ({ ...p, payment_amount: parseInt(v) || 0 }))} type="number" min={0} />
              </div>

              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
              <FG label="Career Milestone" value={eventForm.career_milestone} onChange={v => setEventForm(p => ({ ...p, career_milestone: v }))} placeholder="First brand collaboration, first paid gig, etc." full />
              <FG label="On Fail" value={eventForm.fail_consequence} onChange={v => setEventForm(p => ({ ...p, fail_consequence: v }))} placeholder="What happens narratively if she fails..." full />
              <FG label="On Success → Unlocks" value={eventForm.success_unlock} onChange={v => setEventForm(p => ({ ...p, success_unlock: v }))} placeholder="What this opens up (future events, brand deals, etc.)" full />

              {/* ── Narrative Chain ───────────────────────────────────────────
                  Sequences this event after another and lists threads it
                  plants for future episodes. The next-event suggester reads
                  these (chain continuation +30, seed match +18) and the
                  brief snapshot captures them. Optional — leave parent
                  empty for standalone events. */}
              <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                <label style={{ ...S.fLabel, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>🔗 Narrative Chain (optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={S.fLabel}>Parent event (the one this follows)</label>
                    <select
                      value={eventForm.parent_event_id || ''}
                      onChange={e => setEventForm(p => ({ ...p, parent_event_id: e.target.value || null }))}
                      style={S.sel}
                    >
                      <option value="">— none (standalone) —</option>
                      {worldEvents
                        .filter(e => e.id !== editingEvent)
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.name}{e.event_type ? ` (${e.event_type})` : ''}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Chain position</label>
                    <input
                      type="number"
                      min={1}
                      value={eventForm.chain_position ?? ''}
                      onChange={e => setEventForm(p => ({ ...p, chain_position: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                      placeholder="2"
                      style={{ ...S.sel, width: '100%' }}
                    />
                  </div>
                </div>
                <FG
                  label="Chain reason (why this follows the parent)"
                  value={eventForm.chain_reason || ''}
                  onChange={v => setEventForm(p => ({ ...p, chain_reason: v }))}
                  placeholder="The brand from the gala invited her back, this time for press."
                  textarea
                  full
                />
                <label style={S.fLabel}>Seeds for future events</label>
                <textarea
                  value={Array.isArray(eventForm.seeds_future_events) ? eventForm.seeds_future_events.join('\n') : ''}
                  onChange={e => setEventForm(p => ({
                    ...p,
                    seeds_future_events: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder={'One per line — threads this event plants for later.\nExample:\nMaison Belle press meeting\nLala\'s number with Ari\nUnpaid invoice from Static Frequency'}
                  rows={3}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* ── Required UI Overlays — split by category ──────────────────
                  Lala-phone overlays (phone, phone_icon) and on-screen
                  production overlays (production, frame) read from the same
                  required_ui_overlays array but render in two named buckets
                  driven by ui_overlay_types.category. Toggle-chip picker shows
                  every type the show has defined with a generated/pending
                  badge so creators can see asset readiness at a glance.
                  Custom names still work via the inline input — generator
                  matches by type_key OR name so a typed name is fine when
                  the asset gets generated later. */}
              {(() => {
                const selected = new Set(eventForm.required_ui_overlays || []);
                const isSelected = (t) => selected.has(t.type_key) || selected.has(t.name);
                const toggle = (t) => {
                  setEventForm(p => {
                    const cur = p.required_ui_overlays || [];
                    // Remove either form (type_key or name) so toggling off
                    // works regardless of which one was saved.
                    if (isSelected(t)) {
                      return { ...p, required_ui_overlays: cur.filter(n => n !== t.type_key && n !== t.name) };
                    }
                    // Prefer type_key when adding (stable across name renames).
                    return { ...p, required_ui_overlays: [...cur, t.type_key || t.name] };
                  });
                };
                const PHONE_CATS = new Set(['phone', 'phone_icon', 'icon']);
                const phoneTypes = overlayTypes.filter(t => PHONE_CATS.has(t.category || 'phone'));
                const uiTypes = overlayTypes.filter(t => !PHONE_CATS.has(t.category || 'phone'));
                // Custom entries — names in required_ui_overlays that don't
                // match any type the show has defined. Surfaced as plain
                // chips below the toggle grids so creators can still see
                // and remove them.
                const knownNames = new Set([
                  ...overlayTypes.map(t => t.type_key).filter(Boolean),
                  ...overlayTypes.map(t => t.name).filter(Boolean),
                ]);
                const customs = (eventForm.required_ui_overlays || []).filter(n => !knownNames.has(n));

                // Auto-suggest defaults based on event_type / prestige —
                // mirrors the generator's expectations so creators aren't
                // staring at a blank picker. Replaces (doesn't merge) since
                // creators usually want a clean slate when they click it.
                const autoSuggest = () => {
                  const suggestions = ['MailPanel', 'InviteLetterOverlay'];
                  if ((eventForm.prestige || 0) >= 4) suggestions.push('WardrobeList');
                  if (eventForm.career_milestone) suggestions.push('CareerList');
                  if (eventForm.event_type === 'brand_deal') suggestions.push('StatsPanel');
                  // Filter to types the show actually has defined; fall back to
                  // raw names for ones the show might still define later.
                  setEventForm(p => ({ ...p, required_ui_overlays: suggestions }));
                };

                const ToggleChip = ({ t }) => {
                  const sel = isSelected(t);
                  const ready = !!t.generated;
                  return (
                    <button
                      type="button"
                      onClick={() => toggle(t)}
                      title={ready ? `${t.name} — asset generated` : `${t.name} — type defined, no asset yet`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 6, fontSize: 11,
                        fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                        border: `1px solid ${sel ? 'var(--lala-gold)' : 'var(--lala-parchment-3)'}`,
                        background: sel ? 'var(--lala-gold-soft)' : 'var(--surface-card)',
                        color: sel ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: sel ? 700 : 500,
                      }}
                    >
                      <span style={{ fontSize: 9, color: ready ? 'var(--success-text)' : 'var(--warning-text)' }}>{ready ? '●' : '○'}</span>
                      {t.name || t.type_key}
                    </button>
                  );
                };

                const sectionStyle = { gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 };
                const renderSection = (label, types, helperText, customInputId) => (
                  <div style={sectionStyle}>
                    <label style={{ ...S.fLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>{label}</label>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{helperText}</div>
                    {types.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                        No types defined for this category yet — generate them in the UI Overlays tab, or add a custom name below.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {types.map(t => <ToggleChip key={t.id || t.type_key || t.name} t={t} />)}
                      </div>
                    )}
                    <input
                      type="text"
                      id={customInputId}
                      placeholder="Add custom name (Enter or comma) — e.g. CountdownTimer, SponsorBug"
                      onKeyDown={e => {
                        if (e.key !== 'Enter' && e.key !== ',') return;
                        e.preventDefault();
                        const v = e.currentTarget.value.trim().replace(/,$/, '');
                        if (!v) return;
                        setEventForm(p => {
                          const existing = p.required_ui_overlays || [];
                          if (existing.includes(v)) return p;
                          return { ...p, required_ui_overlays: [...existing, v] };
                        });
                        e.currentTarget.value = '';
                      }}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>
                );

                return (
                  <>
                    <div style={{ gridColumn: '1 / -1', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📺 Required UI Overlays</div>
                      <button
                        type="button"
                        onClick={autoSuggest}
                        title="Replace selection with sensible defaults based on this event's type + prestige"
                        style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
                      >
                        ✦ Auto-suggest
                      </button>
                    </div>
                    {renderSection(
                      '📱 Lala Phone Overlays',
                      phoneTypes,
                      'What Lala sees on her phone in-show. Auto-placed on the episode timeline at generation; ● = asset generated, ○ = type defined, no asset yet.',
                      'phone-overlay-custom'
                    )}
                    {renderSection(
                      '🎬 On-Screen UI Overlays',
                      uiTypes,
                      'On-screen production graphics — invitation cards, wardrobe checklists, stat panels. Same generator path; ● / ○ same as above.',
                      'ui-overlay-custom'
                    )}
                    {customs.length > 0 && (
                      <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: '8px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace", marginBottom: 4, fontWeight: 700, letterSpacing: 0.4 }}>CUSTOM NAMES (no type defined yet)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {customs.map((name, i) => (
                            <span key={`custom-${name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--surface-card)', border: '1px solid var(--warning-border)', borderRadius: 4, fontSize: 11, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                              {name}
                              <button
                                type="button"
                                onClick={() => setEventForm(p => ({ ...p, required_ui_overlays: (p.required_ui_overlays || []).filter(n => n !== name) }))}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                                title="Remove"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── Rewards & Requirements ────────────────────────────────────
                  Stat-delta rewards (coins/reputation/brand_trust/influence)
                  fund Lala's progression after success; the outcomes list
                  feeds the writer's narrative beats. Requirements are pre-
                  flight gates the next-event suggester reads (careerGoals.js
                  applies a -5 score penalty when reputation_min or
                  brand_trust_min isn't met). All numeric — leave at 0 to
                  skip that gate or reward. */}
              <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                <label style={{ ...S.fLabel, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>🏆 Rewards & Requirements</label>

                {/* Rewards row */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.fLabel, fontSize: 10, color: 'var(--success-text)', marginBottom: 6 }}>REWARDS — granted on success</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                    {[
                      { key: 'coins', label: '🪙 Coins', placeholder: '500' },
                      { key: 'reputation', label: '⭐ Reputation', placeholder: '1' },
                      { key: 'brand_trust', label: '🤝 Brand Trust', placeholder: '1' },
                      { key: 'influence', label: '📣 Influence', placeholder: '1' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ ...S.fLabel, fontSize: 10 }}>{f.label}</label>
                        <input
                          type="number"
                          min={0}
                          value={eventForm.rewards?.[f.key] ?? 0}
                          onChange={e => setEventForm(p => ({
                            ...p,
                            rewards: { ...(p.rewards || {}), [f.key]: parseInt(e.target.value, 10) || 0 },
                          }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                  <label style={{ ...S.fLabel, fontSize: 10 }}>Narrative outcomes (one per line)</label>
                  <textarea
                    value={Array.isArray(eventForm.rewards?.outcomes) ? eventForm.rewards.outcomes.join('\n') : ''}
                    onChange={e => setEventForm(p => ({
                      ...p,
                      rewards: {
                        ...(p.rewards || {}),
                        outcomes: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                      },
                    }))}
                    placeholder={'One per line — what unlocks narratively.\nExample:\nLala lands on the Maison Belle radar\nFirst paid styling gig confirmed'}
                    rows={2}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Requirements row */}
                <div>
                  <div style={{ ...S.fLabel, fontSize: 10, color: 'var(--danger)', marginBottom: 6 }}>REQUIREMENTS — gates that dock score when unmet</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { key: 'reputation_min', label: '⭐ Reputation min', placeholder: '3' },
                      { key: 'brand_trust_min', label: '🤝 Brand Trust min', placeholder: '2' },
                      { key: 'coins_min', label: '🪙 Coins min', placeholder: '100' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ ...S.fLabel, fontSize: 10 }}>{f.label}</label>
                        <input
                          type="number"
                          min={0}
                          value={eventForm.requirements?.[f.key] ?? 0}
                          onChange={e => setEventForm(p => ({
                            ...p,
                            requirements: { ...(p.requirements || {}), [f.key]: parseInt(e.target.value, 10) || 0 },
                          }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <FG label="Description" value={eventForm.description} onChange={v => setEventForm(p => ({ ...p, description: v }))} placeholder="Full event description..." textarea full />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingEvent(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveEvent} disabled={savingEvent || !eventForm.name} style={S.primaryBtn}>
                  {savingEvent ? '⏳...' : editingEvent === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
          )}

          {/* Generate-options toolbar — draft-script opt-in lives here so
              both the per-event "Generate" button and the bulk-action
              "Generate from N events" pick it up. Bulk-select toggle
              isn't here because it already exists above the page in
              the toolbar that drives Compare / Bulk Inject. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '6px 10px', background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={draftScriptOnGenerate} onChange={(e) => setDraftScriptOnGenerate(e.target.checked)} />
              <strong>Also draft script when generating an episode</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>(applies to single + bulk Generate)</span>
            </label>
          </div>

          {/* Events grid — filtered + sorted, then paged (Task #2360) */}
          {(() => {
            const visibleEvents = worldEvents.filter(ev => {
              const q = eventSearch.toLowerCase();
              const matchSearch = !q || ev.name?.toLowerCase().includes(q) || ev.host?.toLowerCase().includes(q) || ev.dress_code?.toLowerCase().includes(q) || ev.location_hint?.toLowerCase().includes(q);
              // Filters by the same computed queue state the chips above
              // count and the cards below display (Task #1648) — not the
              // raw world_events.status.
              const matchStatus = eventStatusFilter === 'all' || computeEventState(ev) === eventStatusFilter;
              return matchSearch && matchStatus && matchesDealTypeFilter(ev, eventDealFilter);
            }).sort((a, b) => {
              if (eventSort === 'prestige') return (b.prestige || 0) - (a.prestige || 0);
              if (eventSort === 'cost') return (b.cost_coins || 0) - (a.cost_coins || 0);
              if (eventSort === 'status') return (a.status || '').localeCompare(b.status || '');
              if (eventSort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
              return (a.name || '').localeCompare(b.name || '');
            });
            const { page, totalPages, pageItems } = paginateEvents(visibleEvents, eventPage);
            // Wardrobe vs dress code conflicts show on the affected card.
            const conflictsByEvent = new Map(getDressCodeConflicts().map(c => [c.event.id, c]));
            return (
          <>
          <div ref={eventsGridRef} data-testid="events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 12, scrollMarginTop: 16 }}>
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
              const missing = describeMissing(readiness.blocking);
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
                  <span className="wa-ev-category">{details.category || 'No category'}</span>
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
                <div className="wa-ev-tiles">
                  <div className="wa-ev-tile" data-testid={`event-card-deal-${ev.id}`}>
                    <span className="wa-ev-tile-label">Deal</span>
                    <strong>{details.deal.label || 'No deal type'}</strong>
                    <span className="wa-ev-tile-sub">{details.deal.pays}</span>
                  </div>
                  <div className="wa-ev-tile" data-testid={`event-card-organizer-${ev.id}`}>
                    <span className="wa-ev-tile-label">Organizer</span>
                    <strong className={details.organizer ? undefined : 'missing'}>{details.organizer || 'Not chosen'}</strong>
                  </div>
                </div>
                {/* A used or archived event is done: nothing is still needed. */}
                {missing.length > 0 && state !== 'used' && state !== 'archived' && (
                  <div className="wa-ev-needed" data-testid={`event-card-needed-${ev.id}`}>
                    <span className="wa-ev-tile-label">Still needed</span>
                    <div className="wa-ev-needed-chips">
                      {missing.map(m => <span key={m} className="wa-ev-needed-chip">{m}</span>)}
                    </div>
                  </div>
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
            {worldEvents.length === 0 && !editingEvent && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>No events yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.5 }}>
                  Events are the story moments — parties, brand deals, collabs, drama.
                  Auto-fill generates events from your Cultural Calendar with hosts from Lala's Feed.
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
              Arc. Ideas opens as a drawer from the header. */}
          {eventsIdeasOpen && (
            <>
              <div className="wa-ev-drawer-backdrop" data-testid="events-ideas-backdrop" onClick={() => setEventsIdeasOpen(false)} />
              <aside className="wa-ev-drawer" role="dialog" aria-modal="true" aria-labelledby="events-ideas-title" data-testid="events-ideas">
                <div className="wa-ev-drawer-head">
                  <h3 id="events-ideas-title" className="wa-ev-drawer-title">Ideas — Feed opportunities &amp; event templates</h3>
                  <button type="button" className="wa-ev-drawer-close" data-testid="events-ideas-close" aria-label="Close Ideas" onClick={() => setEventsIdeasOpen(false)}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="wa-ev-drawer-body">
                {/* ── Pipeline: Opportunities → Events ── */}
                <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)' }}>
                      Pipeline — Feed → Opportunities → Events
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={async () => {
                        setToast('Scanning feed for opportunities...');
                        try {
                          const res = await api.post(`/api/v1/feed-pipeline/${showId}/generate-opportunities`);
                          if (res.data.success) {
                            setToast(`${res.data.count} opportunities generated from feed profiles`);
                            loadData();
                          }
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                        setTimeout(() => setToast(null), 3000);
                      }} style={{ ...S.smBtn, background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', fontSize: 10 }}>
                        🔍 Scan Feed
                      </button>
                      <button onClick={() => setOppQuickForm({ name: '', opportunity_type: 'modeling', prestige: 5, narrative_stakes: '' })} style={{ ...S.smBtn, fontSize: 10 }}>
                        + New Opportunity
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Scan Lala's feed for opportunities, or pick a template below.
                  </div>
                </div>

                {/* Pipeline stats */}
                {opportunities.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {['offered','considering','booked','active','completed'].map(s => {
                      const count = opportunities.filter(o => o.status === s).length;
                      if (!count) return null;
                      const colors = { offered: ['var(--warning-text)', 'var(--warning-bg)'], considering: ['var(--primary-text)', 'var(--primary-subtle)'], booked: ['var(--success-text)', 'var(--success-bg)'], active: ['var(--success-text)', 'var(--success-bg)'], completed: ['var(--success-text)', 'var(--success-bg)'] };
                      const [fg, bg] = colors[s] || ['var(--text-secondary)', 'var(--lala-parchment-2)'];
                      return <span key={s} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: bg, color: fg }}>{s}: {count}</span>;
                    })}
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', padding: '2px 4px' }}>
                      ${opportunities.filter(o => ['booked','active','completed','paid'].includes(o.status)).reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0).toLocaleString()} booked
                    </span>
                  </div>
                )}

                {/* Quick create opportunity form */}
                {oppQuickForm && (
                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>name</label><input value={oppQuickForm.name} onChange={e => setOppQuickForm(p => ({ ...p, name: e.target.value }))} placeholder="Velour Magazine Cover" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>type</label><select value={oppQuickForm.opportunity_type} onChange={e => setOppQuickForm(p => ({ ...p, opportunity_type: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }}>
                        {['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'casting_call', 'podcast', 'interview', 'award_show', 'social_event'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </select></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>prestige</label><input type="number" value={oppQuickForm.prestige} onChange={e => setOppQuickForm(p => ({ ...p, prestige: parseInt(e.target.value) || 5 }))} min="1" max="10" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                    </div>
                    <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>stakes</label><input value={oppQuickForm.narrative_stakes} onChange={e => setOppQuickForm(p => ({ ...p, narrative_stakes: e.target.value }))} placeholder="Why this matters for Lala..." style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setOppQuickForm(null)} style={{ padding: '5px 14px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                      <button disabled={!oppQuickForm.name} onClick={async () => {
                        try {
                          await api.post(`/api/v1/opportunities/${showId}`, { ...oppQuickForm, category: 'fashion' });
                          setOppQuickForm(null);
                          setToast('Opportunity created');
                          loadData();
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !oppQuickForm.name ? 0.4 : 1 }}>Create</button>
                    </div>
                  </div>
                )}

                {/* Active Opportunities ready to schedule */}
                {(() => {
                  const schedulable = (opportunities || []).filter(o => !o.event_id && ['offered','considering','negotiating','booked'].includes(o.status));
                  if (schedulable.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>
                        Active Opportunities — ready to schedule ({schedulable.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {schedulable.map(opp => (
                          <div key={opp.id} style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderLeft: '4px solid var(--lala-gold)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{opp.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', gap: 6 }}>
                              <span>{opp.opportunity_type?.replace(/_/g, ' ')}</span>
                              {opp.connector_handle && <span>via @{opp.connector_handle}</span>}
                              {opp.prestige && <span>⭐ {opp.prestige}</span>}
                            </div>
                            {opp.narrative_stakes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.3 }}>{typeof opp.narrative_stakes === 'string' ? opp.narrative_stakes.slice(0, 100) : ''}</div>}
                            <button onClick={async () => {
                              setToast(`Scheduling "${opp.name}"...`);
                              try {
                                const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
                                if (res.data.success) { setToast(`"${opp.name}" → Event created!`); loadData(); }
                              } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                            }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 11, cursor: 'pointer', width: '100%' }}>
                              📅 Schedule as Event
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Feed event templates grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {[
                    { name: 'Creator Roast Night', category: 'creator_economy', icon: '🔥', desc: 'Public roasting of creators by other creators. Everything is jokes until someone goes too far.', energy: 'chaotic', venue_theme: 'Dark underground comedy club with exposed brick, dramatic red spotlights, leather booths, vintage microphone on stage' },
                    { name: 'Fashion Mystery Box', category: 'fashion', icon: '📦', desc: 'Style looks from a mystery selection. Constraint reveals true taste — or lack of it.', energy: 'creative', venue_theme: 'Sleek futuristic showroom with glass display cases, neon accents, mirrored walls, mystery boxes on pedestals' },
                    { name: 'Creator Speed Dating', category: 'creator_economy', icon: '⚡', desc: 'Rapid-fire collab pitches. Alliances form fast. Some are regretted faster.', energy: 'networking', venue_theme: 'Modern co-working lounge with round tables, warm lighting, exposed ceiling beams, cocktail bar in corner' },
                    { name: 'Street Style Marathon', category: 'fashion', icon: '👟', desc: 'Extended street style documentation — the week\'s best looks ranked publicly.', energy: 'competitive', venue_theme: 'Luxury outdoor fashion district — cobblestone streets, designer storefronts, fairy lights strung between buildings, photography wall' },
                    { name: 'Beauty Battles', category: 'beauty', icon: '💄', desc: 'Head-to-head beauty challenges. The audience votes. The loser loses followers publicly.', energy: 'dramatic', venue_theme: 'Glamorous beauty arena with vanity mirror stations, ring lights everywhere, judges panel, pink neon runway' },
                    { name: 'Design Lab Week', category: 'creative', icon: '🎨', desc: 'Experimental design projects and innovation challenges. Where new ideas are tested publicly.', energy: 'creative', venue_theme: 'Industrial creative studio with paint-splattered floors, large canvases, skylights, modern art installations' },
                    { name: 'Community Build Week', category: 'creator_economy', icon: '🤝', desc: 'Collaborative content between otherwise competing creators. Forced proximity events.', energy: 'wholesome', venue_theme: 'Warm communal space with long wooden tables, greenery, soft natural lighting, open kitchen, cozy seating nooks' },
                    { name: 'The Great Glow-Up Challenge', category: 'beauty', icon: '✨', desc: 'Dramatic transformation challenge. Before and after content that goes viral.', energy: 'aspirational', venue_theme: 'Luxury spa and transformation center with marble floors, gold mirrors, professional styling stations, crystal chandeliers' },
                    { name: 'Creator Charity Week', category: 'creator_economy', icon: '💝', desc: 'Creators raise money for causes. Reputation washing meets genuine impact.', energy: 'feel-good', venue_theme: 'Elegant charity gala ballroom with auction stage, flower arrangements, candlelit tables, donation display board' },
                    { name: 'Midnight Music Festival', category: 'music', icon: '🎵', desc: 'Late-night music and performance event. Unexpected collabs happen after midnight.', energy: 'electric', venue_theme: 'Rooftop music venue at night with city skyline, string lights, DJ booth, velvet lounge areas, starlit sky' },
                    { name: 'Virtual Travel Festival', category: 'lifestyle', icon: '✈️', desc: 'Digital travel content — who can make home feel like elsewhere.', energy: 'escapist', venue_theme: 'Tropical resort-style venue with palm trees, infinity pool edge, sunset views, bamboo furniture, exotic flowers' },
                    { name: 'Artist Residency Month', category: 'creative', icon: '🖼️', desc: 'Creators slow down and make something intentional. The antidote to the content grind.', energy: 'reflective', venue_theme: 'Serene gallery loft with white walls, natural wood floors, large windows with garden views, minimal sculptures' },
                    { name: 'Creator Talent Show', category: 'creator_economy', icon: '🎤', desc: 'Hidden talents revealed. Singers, dancers, comedians — the audience discovers new sides.', energy: 'surprising', venue_theme: 'Intimate theater with velvet curtains, spotlit stage, orchestra seating, gold balcony railings, dramatic drapes' },
                  ].map(template => {
                    const catColors = {
                      fashion: { bg: 'var(--lala-gold-soft)', border: 'var(--lala-gold)', text: 'var(--lala-gold-text)' },
                      beauty: { bg: 'var(--accent-subtle)', border: 'var(--accent)', text: 'var(--accent-dark)' },
                      creator_economy: { bg: 'var(--info-bg)', border: 'var(--info)', text: 'var(--info-text)' },
                      creative: { bg: 'var(--primary-subtle)', border: 'var(--primary)', text: 'var(--primary-text)' },
                      music: { bg: 'var(--warning-bg)', border: 'var(--warning)', text: 'var(--warning-text)' },
                      lifestyle: { bg: 'var(--success-bg)', border: 'var(--success)', text: 'var(--success-text)' },
                    };
                    const cc = catColors[template.category] || catColors.creator_economy;
                    // Check if an event already exists from this template
                    const existingEvent = worldEvents.find(ev =>
                      ev.name?.includes(template.name) ||
                      ev.canon_consequences?.automation?.source_calendar_title === template.name
                    );

                    return (
                      <div key={template.name} style={{ background: existingEvent ? 'var(--success-bg)' : 'var(--surface-card)', border: `1px solid ${existingEvent ? 'var(--success-border)' : 'var(--lala-parchment-3)'}`, borderLeft: `4px solid ${existingEvent ? 'var(--success)' : cc.border}`, borderRadius: 10, padding: 16, transition: 'border-color 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{template.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{template.name}</div>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cc.bg, color: cc.text, fontWeight: 600 }}>{template.category.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>{template.desc}</p>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--lala-parchment-2)', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>Energy: {template.energy}</span>
                        </div>
                        {(feedEventResults[template.name]?.status === 'created' || existingEvent) ? (() => {
                          const created = feedEventResults[template.name]?.event || existingEvent;
                          const host = created?.host || created?.canon_consequences?.automation?.host_display_name || '';
                          return (
                            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: 10, fontSize: 12, marginTop: 6 }}>
                              <div style={{ fontWeight: 700, color: 'var(--success-text)', marginBottom: 4 }}>Event Created</div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{created?.name || template.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0' }}>
                                {host ? `Host: ${host} · ` : ''}Prestige: {created?.prestige || 5}{created?.status ? ` · ${created.status}` : ''}
                              </div>
                              <button
                                onClick={() => { setEventDetailModal(created); }}
                                style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, border: '1px solid var(--lala-gold)', background: 'var(--surface-card)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                              >
                                Edit Event Details
                              </button>
                            </div>
                          );
                        })() : (
                          <button
                            disabled={feedEventResults[template.name]?.status === 'creating'}
                            onClick={async () => {
                              setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'creating' } }));
                              try {
                                // Create world event directly from template — no calendar middleware
                                const res = await api.post(`/api/v1/world/${showId}/events`, {
                                  name: template.name,
                                  event_type: 'invite',
                                  category: TEMPLATE_CATEGORY_MAP[template.category] || null,
                                  description: template.desc,
                                  prestige: 5,
                                  cost_coins: 150,
                                  dress_code: null,
                                  narrative_stakes: template.desc,
                                  location_hint: template.venue_theme || null,
                                  canon_consequences: {
                                    automation: {
                                      venue_theme: template.venue_theme,
                                      energy: template.energy,
                                      category: template.category,
                                    },
                                  },
                                  status: 'draft',
                                });
                                if (res.data.success || res.data.data) {
                                  const created = res.data.data || res.data;
                                  setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'created', event: created } }));
                                  loadData();
                                  setToast(`"${template.name}" created as draft — add host, venue, and details below`);
                                } else {
                                  setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                                  setToast(res.data.error || 'Failed to create event');
                                }
                              } catch (err) {
                                setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                                setToast('Failed: ' + (err.response?.data?.error || err.message));
                              }
                            }}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${cc.border}40`, background: `${cc.bg}80`, color: cc.text, fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                          >
                            {feedEventResults[template.name]?.status === 'creating' ? 'Creating...' : 'Create This Event'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              </aside>
            </>
          )}

        </div>
      )}
          {eventDetailModal && (() => {
            // Hydrate missing fields from automation data + derive from
            // context (hydrateEventForModal, utils/eventEditorChanges.js —
            // the same values as before, now with where each came from).
            // What the modal shows is unchanged; what it saves is not
            // (Task #1786): every save sends only the fields whose value
            // differs from what the modal opened with.
            //
            // eventModalStoredRef holds the stored row as the modal opened
            // it, plus every change this modal has since saved. Its
            // hydration is the "opened with" baseline, so a field left as
            // shown — including a value invented at render — is never sent.
            if (eventModalStoredRef.current?.id !== eventDetailModal.id) {
              eventModalStoredRef.current = { ...eventDetailModal };
              eventModalQueueRef.current = createEventSaveQueue((url, body) => api.put(url, body), {
                getBase: () => eventModalStoredRef.current,
              });
              eventModalQueueRef.current.setVersion(eventDetailModal.updated_at);
            }
            const stored = eventModalStoredRef.current;
            const baseline = hydrateEventForModal(stored).values;
            const md = hydrateEventForModal(eventDetailModal).values;
            const auto = eventDetailModal.canon_consequences?.automation || {};
            const recordSaved = (fields) => {
              eventModalStoredRef.current = { ...eventModalStoredRef.current, ...fields };
            };
            // Every save from this modal: versioned and in order. A save
            // refused because the event changed elsewhere refreshes the
            // Events list, so closing and reopening shows the latest.
            const modalSave = async (body) => {
              try {
                return await eventModalQueueRef.current.save(`/api/v1/world/${showId}/events/${md.id}`, body);
              } catch (err) {
                if (isStaleSaveError(err)) loadData();
                throw err;
              }
            };
            const updateField = async (field, value) => {
              // A blur or change that leaves the value as opened sends
              // nothing, so focusing a field showing an invented value and
              // leaving it cannot save that value.
              if (sameEditorValue(value, baseline[field])) {
                setEventDetailModal(prev => prev ? { ...prev, [field]: value } : prev);
                return;
              }
              try {
                const res = await modalSave({ [field]: value });
                if (res.data.success && res.data.event) {
                  recordSaved({ [field]: value });
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event } : ev));
                  // Update modal but preserve any local edits by merging
                  setEventDetailModal(prev => prev ? { ...prev, [field]: value } : prev);
                }
              } catch (err) {
                console.warn(`[Event] Failed to save ${field}:`, err.response?.data?.error || err.message);
                setError(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : (err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field'));
              }
            };
            const updateMultipleFields = async (fields) => {
              const changed = changedFields(baseline, fields, Object.keys(fields));
              if (Object.keys(changed).length === 0) return;
              try {
                const res = await modalSave(changed);
                if (res.data.success) {
                  recordSaved(changed);
                  const updated = res.data.event;
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? updated : ev));
                  setEventDetailModal(updated);
                }
              } catch (err) {
                console.warn('[Event] Batch save failed:', err.response?.data?.error || err.message);
                setError(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : (err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field'));
              }
            };
            const linkedScene = md.scene_set_id ? sceneSets.find(s => s.id === md.scene_set_id) : null;
            const hasInvalidSceneLink = Boolean(md.scene_set_id) && !linkedScene;
            const diff = calcDifficulty(md);
            const dl = difficultyLabel(diff);
            return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEventDetailModal(null)}>
              <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '90vw', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                {/* Location banner */}
                {linkedScene?.base_still_url && (
                  <div style={{ height: 140, overflow: 'hidden', position: 'relative', borderRadius: '16px 16px 0 0' }}>
                    {linkedScene.video_clip_url ? (
                      <video src={linkedScene.video_clip_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />
                    ) : (
                      <img src={linkedScene.base_still_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-inverse)', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6 }}>
                      📍 {linkedScene.name} {linkedScene.video_clip_url && '🎬'}
                    </div>
                    <button onClick={() => updateField('scene_set_id', null)} style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 9, color: 'var(--text-inverse)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Change</button>
                  </div>
                )}

                {/* Header — editable name */}
                <div style={{ padding: '16px 24px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select value={md.event_type} onChange={e => updateField('event_type', e.target.value)} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}>
                    {Object.entries(EVENT_TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input value={md.name} onChange={e => setEventDetailModal({ ...md, name: e.target.value })} onBlur={e => updateField('name', e.target.value)}
                    style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', border: 'none', borderBottom: '1px dashed var(--lala-parchment-3)', outline: 'none', padding: '2px 0' }} />
                  <span style={S.statusPill(md.status)}>{md.status}</span>
                  <button onClick={() => setEventDetailModal(null)} style={{ background: 'var(--lala-parchment-2)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>

                {/* Editable fields grid */}
                <div style={{ padding: '8px 24px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Host</label><input value={md.host || ''} onChange={e => setEventDetailModal({ ...md, host: e.target.value })} onBlur={e => updateField('host', e.target.value)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Brand</label><input value={md.host_brand || ''} onChange={e => setEventDetailModal({ ...md, host_brand: e.target.value })} onBlur={e => updateField('host_brand', e.target.value)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Dress Code</label><input value={md.dress_code || ''} onChange={e => setEventDetailModal({ ...md, dress_code: e.target.value })} onBlur={e => updateField('dress_code', e.target.value)} style={S.sel} /></div>
                  </div>

                  {/* Venue & Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Venue Name</label><input value={md.venue_name || ''} onChange={e => setEventDetailModal({ ...md, venue_name: e.target.value })} onBlur={e => updateField('venue_name', e.target.value)} placeholder="The Velvet Room, SoHo Loft..." style={S.sel} /></div>
                    <div><label style={S.fLabel}>Venue Address</label><input value={md.venue_address || ''} onChange={e => setEventDetailModal({ ...md, venue_address: e.target.value })} onBlur={e => updateField('venue_address', e.target.value)} placeholder="123 Fashion Ave, Lower East Side" style={S.sel} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Event Date</label><input type="date" value={md.event_date || ''} onChange={e => { setEventDetailModal({ ...md, event_date: e.target.value }); updateField('event_date', e.target.value); }} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Event Time</label><input type="time" value={md.event_time || ''} onChange={e => { setEventDetailModal({ ...md, event_time: e.target.value }); updateField('event_time', e.target.value); }} style={S.sel} /></div>
                  </div>

                  {/* Guest List */}
                  {(() => {
                    const automation = md.canon_consequences?.automation;
                    const guests = automation?.guest_profiles || [];
                    return guests.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        <label style={S.fLabel}>Guest List ({guests.length})</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {guests.map((g, i) => (
                            <span key={i} style={{ padding: '3px 8px', background: 'var(--lala-parchment-2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {g.display_name || g.handle}
                              <span style={{ fontSize: 9, color: 'var(--text-secondary)', marginLeft: 4 }}>{g.relationship || ''}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Prestige</label><input type="number" min={1} max={10} value={md.prestige} onChange={e => { setEventDetailModal({ ...md, prestige: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('prestige', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>{md.deal_type ? 'Difficulty' : 'Cost 🪙'}</label><input type="number" min={0} value={md.cost_coins} onChange={e => { setEventDetailModal({ ...md, cost_coins: parseInt(e.target.value) || 0 }); }} onBlur={e => updateField('cost_coins', parseInt(e.target.value) || 0)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Strictness</label><input type="number" min={1} max={10} value={md.strictness} onChange={e => { setEventDetailModal({ ...md, strictness: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('strictness', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Deadline</label><select value={md.deadline_type} onChange={e => updateField('deadline_type', e.target.value)} style={S.sel}>{['none','low','medium','high','tonight','urgent'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Career Tier</label><input type="number" min={1} max={5} value={md.career_tier || 1} onChange={e => { setEventDetailModal({ ...md, career_tier: parseInt(e.target.value) || 1 }); }} onBlur={e => updateField('career_tier', parseInt(e.target.value) || 1)} style={S.sel} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={S.fLabel}>Location (Scene Set)</label>
                      {linkedScene && (
                          <div style={{ background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)', marginBottom: 6, overflow: 'hidden' }}>
                            {linkedScene.base_still_url && (
                              <div style={{ position: 'relative' }}>
                                {linkedScene.video_clip_url ? (
                                  <video src={linkedScene.video_clip_url} style={{ width: '100%', height: 80, objectFit: 'cover' }} autoPlay loop muted playsInline />
                                ) : (
                                  <img src={linkedScene.base_still_url} alt={linkedScene.name} style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                                )}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-text)' }}>✓ {linkedScene.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{linkedScene.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                              {linkedScene.video_clip_url && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--info-bg)', color: 'var(--info-text)' }}>🎬 Video</span>
                              )}
                              <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>✕ Remove</button>
                            </div>
                            {/* S8: its images are made in Scene Sets. */}
                            <div style={{ padding: '0 10px 8px' }}>
                              {!linkedScene.base_still_url && (
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>No image yet: make its base in Scene Sets.</div>
                              )}
                              <OpenInSceneSets showId={showId} setId={linkedScene.id} fromLabel="the event"
                                from={`/shows/${showId}/world?tab=events&event=${md.id}`}
                                testId="event-editor-open-scene-sets" className="wa-open-scene-sets" />
                            </div>
                          </div>
                      )}
                      {hasInvalidSceneLink && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid var(--warning-border)', marginBottom: 6 }}>
                          <div style={{ flex: 1, fontSize: 11, color: 'var(--warning-text)' }}>
                            This event is linked to a scene set that no longer exists. Pick a new scene set below.
                          </div>
                          <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>Clear</button>
                        </div>
                      )}
                      {(!md.scene_set_id || hasInvalidSceneLink) && sceneSets.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                          {sceneSets.map(ss => (
                            <button key={ss.id} onClick={() => updateField('scene_set_id', ss.id)} style={{
                              padding: 0, border: '2px solid var(--lala-parchment-3)', borderRadius: 8, background: 'var(--surface-card)',
                              cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'border-color 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lala-parchment-3)'}>
                              {ss.base_still_url ? (
                                <img src={ss.base_still_url} alt={ss.name} style={{ width: '100%', height: 60, objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: 60, background: 'var(--surface-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>📍</div>
                              )}
                              <div style={{ padding: '4px 6px' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss.name}</div>
                                <div style={{ fontSize: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{ss.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!md.scene_set_id && sceneSets.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No scene sets yet. Create one for this venue below, or in Scene Sets.</div>
                      )}
                      {/* S8, answer 3: the venue's scene set, created and linked; its images are made in Scene Sets. */}
                      {!linkedScene && (
                        <button
                          onClick={async () => {
                            const set = await createVenueSceneSet(md);
                            if (set) {
                              await updateField('scene_set_id', set.id);
                              setToast(`“${set.name}” created and linked: make its images in Scene Sets`);
                            }
                          }}
                          style={{ marginTop: 6, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--primary)', background: 'var(--primary-subtle)', color: 'var(--primary-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          Create the scene set
                        </button>
                      )}
                    </div>
                    <div>
                      <label style={S.fLabel}>Payment</label>
                      <select value={md.is_free ? 'free' : md.is_paid ? 'paid' : 'costs'} onChange={e => {
                        const v = e.target.value;
                        const updates = { is_paid: v === 'paid', is_free: v === 'free' };
                        if (v === 'free') updates.cost_coins = 0;
                        setEventDetailModal({ ...md, ...updates });
                        updateField('is_paid', updates.is_paid);
                        updateField('is_free', updates.is_free);
                        if (v === 'free') updateField('cost_coins', 0);
                      }} style={S.sel}>
                        <option value="costs">Costs coins</option>
                        <option value="paid">💰 Lala gets paid</option>
                        <option value="free">🎟️ Free entry</option>
                      </select>
                    </div>
                  </div>
                  {md.is_paid && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={S.fLabel}>Payment Amount (coins)</label>
                      <input type="number" min={0} value={md.payment_amount || 0} onChange={e => setEventDetailModal({ ...md, payment_amount: parseInt(e.target.value) || 0 })} onBlur={e => updateField('payment_amount', parseInt(e.target.value) || 0)} style={{ ...S.sel, width: 120 }} />
                    </div>
                  )}

                  {/* Difficulty badge + AI Enhance */}
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ padding: '3px 10px', background: dl.bg, color: dl.color, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>🎯 Difficulty: {diff} {dl.text}</span>
                    <button onClick={async () => {
                      setAiRevising(true);
                      try {
                        const emptyFields = [];
                        if (!md.host) emptyFields.push('host');
                        if (!md.host_brand) emptyFields.push('host_brand');
                        if (!md.description) emptyFields.push('description');
                        if (!md.narrative_stakes) emptyFields.push('narrative_stakes');
                        if (!md.career_milestone) emptyFields.push('career_milestone');
                        if (!md.fail_consequence) emptyFields.push('fail_consequence');
                        if (!md.success_unlock) emptyFields.push('success_unlock');
                        if (!md.location_hint) emptyFields.push('location_hint');
                        if (!md.venue_name) emptyFields.push('venue_name');
                        if (!md.venue_address) emptyFields.push('venue_address');
                        if (!md.dress_code) emptyFields.push('dress_code');
                        if (!(md.dress_code_keywords?.length > 0)) emptyFields.push('dress_code_keywords');

                        const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
                          warnings: [{ msg: `ENHANCE: Fill in ALL missing fields for this event.

Event: "${md.name}" (${md.event_type}, prestige ${md.prestige})
Brand: "${md.host_brand || 'not set'}"
Host: "${md.host || 'EMPTY — MUST FILL THIS'}"
Venue: "${md.venue_name || 'not set'}"

IMPORTANT: The "host" field is the person or organization hosting this event. It MUST be filled.
IMPORTANT: "venue_address" should be a specific fictional street address like "47 Rue de Rivoli, Le Marais" or "221 West 4th Street, SoHo". Not generic.
IMPORTANT: "dress_code" should be specific like "cocktail chic", "black tie optional", "streetwear elevated". Not generic.

Current values:
- host="${md.host || ''}" ${!md.host ? '← EMPTY, MUST FILL' : ''}
- host_brand="${md.host_brand || ''}"
- venue_name="${md.venue_name || ''}"
- venue_address="${md.venue_address || ''}" ${!md.venue_address ? '← EMPTY, MUST FILL with specific street address' : ''}
- dress_code="${md.dress_code || ''}" ${!md.dress_code ? '← EMPTY, MUST FILL' : ''}
- narrative_stakes="${md.narrative_stakes || ''}"
- career_milestone="${md.career_milestone || ''}"
- description="${md.description || ''}"
- fail_consequence="${md.fail_consequence || ''}"
- success_unlock="${md.success_unlock || ''}"
- location_hint="${md.location_hint || ''}"

Empty fields to fill: ${emptyFields.join(', ') || 'none'}.

${md.narrative_stakes ? `Keep and expand: "${md.narrative_stakes}"` : 'Write compelling narrative stakes.'}

Return action "enhance" with new_value as a JSON object containing ALL fields listed above. MUST include "host", "venue_address", and "dress_code".` }],
                          events: worldEvents.slice(0, 10),
                          episodes,
                        });

                        const suggestions = res.data?.data || [];
                        if (suggestions.length > 0 && suggestions[0].new_value) {
                          let data = suggestions[0].new_value;
                          if (typeof data === 'string') try { data = JSON.parse(data); } catch { data = {}; }
                          if (typeof data === 'object') {
                            const merged = { ...md };
                            // The organizer is never filled from AI output
                            // (Task #1786): host, host_brand and
                            // source_profile_id are skipped here, and the
                            // old host fallback (`${host_brand} Events`, or
                            // the name before "—") is gone. The organizer is
                            // chosen in the Event Package.
                            for (const [key, val] of Object.entries(withoutOrganizerKeys(data))) {
                              // Fill any empty/null/undefined field
                              const current = md[key];
                              const isEmpty = current === null || current === undefined || current === '' || (Array.isArray(current) && current.length === 0);
                              if (val && isEmpty) {
                                merged[key] = val;
                              }
                            }
                            // Always update these if AI provided richer versions
                            if (data.description && (!md.description || data.description.length > md.description.length)) merged.description = data.description;
                            if (data.narrative_stakes && (!md.narrative_stakes || data.narrative_stakes.length > md.narrative_stakes.length)) merged.narrative_stakes = data.narrative_stakes;
                            setEventDetailModal(merged);
                            // Batch save, in one PUT, only the fields the AI
                            // changed from what the modal opened with —
                            // never an organizer field, never a value the
                            // modal invented and the AI left alone.
                            const saveable = ['name','event_type','description','prestige','cost_coins','strictness','deadline_type','dress_code','dress_code_keywords','location_hint','narrative_stakes','career_milestone','career_tier','fail_consequence','success_unlock','is_paid','is_free','payment_amount','browse_pool_bias','venue_name','venue_address','event_date','event_time'];
                            const toSave = withoutOrganizerKeys(changedFields(baseline, merged, saveable));
                            let lockedMsg = null;
                            if (Object.keys(toSave).length > 0) {
                              try {
                                const res = await modalSave(toSave);
                                if (res.data.success) {
                                  recordSaved(toSave);
                                  // The list keeps the server's row only — not
                                  // the modal's hydrated copy, whose invented
                                  // values would otherwise look stored.
                                  const serverData = res.data.event || {};
                                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...serverData } : ev));
                                }
                              } catch (err) {
                                // A refusal is not retried field by field: the
                                // event changed elsewhere (Task #1788).
                                if (isStaleSaveError(err)) {
                                  setToast(`${saveErrorMessage(err)} Close this editor and reopen the event.`);
                                  setTimeout(() => setToast(null), 6000);
                                  return;
                                }
                                // If batch fails (e.g. missing column), try saving fields one by one
                                console.warn('[Event] Batch save failed, trying individual:', err.response?.data?.error);
                                for (const [key, val] of Object.entries(toSave)) {
                                  try {
                                    await modalSave({ [key]: val });
                                    recordSaved({ [key]: val });
                                  } catch (e2) {
                                    console.warn(`[Event] Skip ${key}:`, e2.response?.data?.error || e2.message);
                                    // The terms lock (§8(x) D4) is said, not skipped silently.
                                    if (e2.response?.data?.code === 'EVENT_TERMS_LOCKED') lockedMsg = e2.response.data.error;
                                  }
                                }
                              }
                            }
                            setToast(lockedMsg ? `✨ Enhanced — but not saved: ${lockedMsg}` : '✨ Enhanced — review the filled fields');
                            setTimeout(() => setToast(null), lockedMsg ? 6000 : 3000);
                          }
                        }
                      } catch (err) {
                        setToast(err.response?.data?.error || 'Enhance failed');
                        setTimeout(() => setToast(null), 3000);
                      } finally { setAiRevising(false); }
                    }} disabled={aiRevising} style={{
                      padding: '4px 14px', background: aiRevising ? 'var(--lala-parchment-2)' : 'var(--primary)',
                      color: aiRevising ? 'var(--text-faint)' : 'var(--text-inverse)', border: 'none', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: aiRevising ? 'wait' : 'pointer',
                    }}>
                      {aiRevising ? '⏳ Enhancing...' : '✨ AI Enhance'}
                    </button>
                  </div>

                  {/* Keywords */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.fLabel}>Dress Code Keywords</label>
                    <input value={(md.dress_code_keywords || []).join(', ')} onChange={e => setEventDetailModal({ ...md, dress_code_keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                      onBlur={e => updateField('dress_code_keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))} placeholder="romantic, garden, floral" style={S.sel} />
                    {(md.dress_code_keywords || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {md.dress_code_keywords.map((kw, i) => <span key={i} style={{ padding: '2px 8px', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 6, fontSize: 10, color: 'var(--primary-text)', fontWeight: 600 }}>{kw}</span>)}
                      </div>
                    )}
                  </div>

                  {/* Invite Preview — phone notification mockup */}
                  <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Invite Preview</div>
                    <EventInvitePreview event={md} />
                  </div>

                  {/* Invitation Style */}
                  <InvitationStyleFields
                    formData={md}
                    setFormData={fn => {
                      const updated = typeof fn === 'function' ? fn(md) : fn;
                      setEventDetailModal(updated);
                      const invFields = {};
                      for (const k of ['theme', 'mood', 'color_palette', 'floral_style', 'border_style']) {
                        if (updated[k] !== md[k]) invFields[k] = updated[k];
                      }
                      if (Object.keys(invFields).length > 0) updateMultipleFields(invFields);
                    }}
                  />

                  {/* Generate invitation button in detail modal */}
                  <div style={{ marginTop: 8, marginBottom: 12 }}>
                    <InvitationButton event={md} showId={showId} onGenerated={(url, assetId) => {
                      setEventDetailModal(prev => prev ? { ...prev, invitation_url: url, invitation_asset_id: assetId } : prev);
                      loadData();
                    }} />
                  </div>

                  {/* Narrative fields */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Narrative Stakes</label>
                    <textarea value={md.narrative_stakes || ''} onChange={e => setEventDetailModal({ ...md, narrative_stakes: e.target.value })} onBlur={e => updateField('narrative_stakes', e.target.value)} rows={2} placeholder="What this event means for Lala's arc..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Career Milestone</label>
                    <input value={md.career_milestone || ''} onChange={e => setEventDetailModal({ ...md, career_milestone: e.target.value })} onBlur={e => updateField('career_milestone', e.target.value)} placeholder="First brand collaboration..." style={S.sel} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Location Hint</label>
                    <input value={md.location_hint || ''} onChange={e => setEventDetailModal({ ...md, location_hint: e.target.value })} onBlur={e => updateField('location_hint', e.target.value)} placeholder="Parisian rooftop, golden hour..." style={S.sel} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Description</label>
                    <textarea value={md.description || ''} onChange={e => setEventDetailModal({ ...md, description: e.target.value })} onBlur={e => updateField('description', e.target.value)} rows={2} placeholder="Full event description..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><label style={S.fLabel}>Fail Consequence</label><input value={md.fail_consequence || ''} onChange={e => setEventDetailModal({ ...md, fail_consequence: e.target.value })} onBlur={e => updateField('fail_consequence', e.target.value)} placeholder="Reputation drops..." style={S.sel} /></div>
                    <div><label style={S.fLabel}>Success Unlock</label><input value={md.success_unlock || ''} onChange={e => setEventDetailModal({ ...md, success_unlock: e.target.value })} onBlur={e => updateField('success_unlock', e.target.value)} placeholder="Unlocks VIP access..." style={S.sel} /></div>
                  </div>

                  {/* Financial Preview — fetched from /financial-forecast.
                      Shows real outfit cost from the picked pieces, event
                      extras (drinks/valet/photo booth) scaled by prestige,
                      social-task rewards, and a "next goal" progress bar.
                      Falls back to a loading row while the fetch is in
                      flight, and a graceful "—" when the endpoint errored
                      (older env, missing columns). */}
                  {(() => {
                    const fc = eventFinancials;
                    const loading = eventFinancialsLoading && !fc;
                    const income = fc?.income?.total ?? 0;
                    const expenses = fc?.expenses?.total ?? 0;
                    const net = fc?.net ?? 0;
                    const aff = fc?.affordability || {};
                    const nextGoal = fc?.next_goal || financeConfig?.next_goal;
                    const currentBalance = financeConfig?.current_balance ?? 0;
                    const balanceAfter = aff.balance_after ?? currentBalance;
                    return (
                      <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Financial Preview</div>
                          {loading && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>calculating…</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--success-text)' }}>Income (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success-text)' }}>{income.toLocaleString()}</div>
                            {fc?.income?.event_payment > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Payment: {fc.income.event_payment}</div>}
                            {fc?.income?.content_revenue_est > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Content est: +{fc.income.content_revenue_est}</div>}
                            {/* A deal's payouts (deal build PR 5): components at Complete, content fees on approval. */}
                            {fc?.income?.deal_components > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Deal fees: {fc.income.deal_components}</div>}
                            {fc?.income?.content_fees > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Content fees: +{fc.income.content_fees}</div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: 'var(--danger-bg)', borderRadius: 8, border: '1px solid var(--danger-border)' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--danger-text)' }}>Expenses (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger-text)' }}>{expenses.toLocaleString()}</div>
                            {fc?.expenses?.event_cost > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Event: {fc.expenses.event_cost}</div>}
                            {fc?.expenses?.outfit_retail > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Outfit ({fc.outfit_source === 'actual' ? `${fc.outfit_piece_count} pieces` : 'est'}): {fc.expenses.outfit_retail}</div>}
                            {fc?.expenses?.outfit_rentals > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Rentals: +{fc.expenses.outfit_rentals}</div>}
                            {(fc?.expenses?.drinks_est || fc?.expenses?.valet_est || fc?.expenses?.photo_booth_est) ? (
                              <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>
                                Extras: {[
                                  fc.expenses.drinks_est && `drinks ${fc.expenses.drinks_est}`,
                                  fc.expenses.valet_est && `valet ${fc.expenses.valet_est}`,
                                  fc.expenses.photo_booth_est && `photo ${fc.expenses.photo_booth_est}`,
                                ].filter(Boolean).join(', ')}
                              </div>
                            ) : null}
                            {/* A deal event's itemised costs (Task #2365): Lala's
                                rows count, comped rows are listed but never. */}
                            {fc?.expenses?.itemised?.costs?.length > 0 && (
                              <div style={{ fontSize: 9, color: 'var(--danger-text)' }} data-testid="forecast-itemised">
                                Costs: {fc.expenses.itemised.lala_total}
                                {fc.expenses.itemised.comped_total > 0 ? ` (comped ${fc.expenses.itemised.comped_total})` : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: net >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, border: `1px solid ${net >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>Net P&L (baseline)</span>
                              {/* EST pill — shown when outfit cost is a
                                  prestige-tier fallback (no outfit picked) so
                                  the bottom-line balance reads as projection,
                                  not fact. Hides once an outfit is saved. */}
                              {fc?.outfit_source === 'estimate' && (
                                <span title="Outfit cost is a prestige-based estimate. Pick an outfit to lock the real number." style={{ padding: '0 4px', borderRadius: 3, fontSize: 7, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>EST</span>
                              )}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                              {aff.balance_before != null
                                ? `${aff.balance_before.toLocaleString()} → ${balanceAfter.toLocaleString()}`
                                : (net >= 0 ? 'Profitable' : 'Costs more than earns')}
                            </div>
                          </div>
                        </div>
                        {/* Tier-dependent income — only a deal's contractual
                            bonus (bonus_terms), paid at Complete for the tier
                            it names. The generic tier reward, paid bonus and
                            event reward are retired (Q12; deal build PR 5), so
                            this row shows only when the deal contains a bonus. */}
                        {fc?.tier_bonuses && (fc.tier_bonuses.slay.total !== 0 || fc.tier_bonuses.pass.total !== 0) && (
                          <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--warning-text)', marginBottom: 4 }}>
                              On Complete (tier-dependent)
                            </div>
                            {[
                              { tier: 'slay', label: '👑 If SLAY', bonus: fc.tier_bonuses.slay, projected: fc.projected_balance?.if_slay },
                              { tier: 'pass', label: '✨ If PASS', bonus: fc.tier_bonuses.pass, projected: fc.projected_balance?.if_pass },
                            ].map(row => {
                              const parts = [];
                              if (row.bonus.deal_bonus > 0) parts.push(`deal bonus +${row.bonus.deal_bonus}`);
                              return (
                                <div key={row.tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: 'var(--warning-text)', marginBottom: 2 }}>
                                  <span>{row.label} <span style={{ fontSize: 9, color: 'var(--warning-text)' }}>· {parts.join(', ')}</span></span>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                                    +{row.bonus.total} → balance {row.projected != null ? row.projected.toLocaleString() : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Milestones progress — "next goal" bar + reward preview. */}
                        {nextGoal && (
                          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning-text)' }}>
                                Next: {nextGoal.label}
                                {nextGoal.episode_id && (
                                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 500, color: 'var(--warning-text)' }}>
                                    · ep-scoped
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace" }}>
                                {balanceAfter.toLocaleString()} / {Number(nextGoal.threshold).toLocaleString()} coins
                              </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.max(0, Math.min(100, (balanceAfter / Number(nextGoal.threshold)) * 100))}%`,
                                height: '100%',
                                background: balanceAfter >= Number(nextGoal.threshold) ? 'var(--success)' : 'var(--lala-gold)',
                                transition: 'width 0.3s',
                              }} />
                            </div>
                            {nextGoal.reward_coins > 0 && (() => {
                              // Goal descriptions sometimes have a baked-in
                              // "Current balance is N coins" sentence from
                              // when the goal was created. That number is
                              // a snapshot, not live, and reads as wrong
                              // the moment the actual balance moves. Strip
                              // it so the description doesn't argue with
                              // the balance shown two lines above.
                              const cleanDesc = String(nextGoal.description || '')
                                .replace(/\s*Current balance is [-\d,]+\s*coins?\.?/gi, '')
                                .trim();
                              return (
                                <div style={{ fontSize: 10, color: 'var(--warning-text)', marginTop: 3 }}>
                                  🎁 Reward on reach: +{Number(nextGoal.reward_coins).toLocaleString()} coins{cleanDesc ? ` — ${cleanDesc}` : ''}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 6 }}>
                          {fc ? `From ${fc.outfit_source === 'actual' ? 'picked outfit' : 'prestige estimate'} + event extras. Refreshes when outfit changes.` : 'Loading forecast…'}
                        </div>
                        {/* Finalize Financials button — executes real transactions */}
                        {md.used_in_episode_id && (
                          <button
                            onClick={async (e) => {
                              const btn = e.target;
                              btn.disabled = true;
                              btn.textContent = 'Finalizing...';
                              try {
                                const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/finalize-financials`);
                                if (res.data.success) {
                                  const d = res.data.data;
                                  if (d.already_finalized) {
                                    setToast(`Already finalized — balance: ${d.balance}`);
                                  } else {
                                    setToast(`${d.transactions.length} transactions executed — balance: ${d.balance_after} coins (${d.summary.net_profit >= 0 ? '+' : ''}${d.summary.net_profit} net)`);
                                  }
                                }
                              } catch (err) {
                                setToast('Failed: ' + (err.response?.data?.error || err.message));
                              }
                              btn.disabled = false;
                              btn.textContent = 'Finalize Financials';
                            }}
                            style={{ marginTop: 8, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                          >
                            Finalize Financials
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* ═══ Overlay Command Center ═══ */}
                  {/* ═══ Overlay Command Center ═══ */}
                  <div style={{ borderTop: '2px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 12, marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Episode Overlays</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setOutfitPickerEvent(md); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                          👗 Pick Outfit
                        </button>
                      </div>
                    </div>

                    {/* Show-level overlays (always present) */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Show Overlays (always on)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['show_title', 'login_screen', 'phone_screen', 'icon_holder', 'cursor', 'exit_icon', 'minimize_icon'].map(id => (
                          <span key={id} style={{ padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 6, fontSize: 9, fontWeight: 600 }}>
                            ✓ {id.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Episode-level overlays (selectable) */}
                    {(() => {
                      const episodeOverlays = [
                        { id: 'episode_title', name: 'Episode Title', icon: '🎬' },
                        { id: 'mail_panel', name: 'Mail Panel', icon: '💌' },
                        { id: 'wardrobe_list', name: 'Wardrobe List', icon: '👗' },
                        { id: 'closet_ui', name: 'Closet UI', icon: '🚪' },
                        { id: 'career_list', name: 'Career List', icon: '📋' },
                        { id: 'social_tasks', name: 'Social Tasks', icon: '📱' },
                        { id: 'stats_panel', name: 'Stats Panel', icon: '🪙' },
                      ];
                      // Parse current selections or auto-suggest
                      let selections = auto.required_ui_overlays || md.required_ui_overlays;
                      if (typeof selections === 'string') try { selections = JSON.parse(selections); } catch { selections = null; }
                      if (!Array.isArray(selections)) {
                        // Auto-suggest based on event type
                        selections = [];
                        const type = md.event_type || 'invite';
                        if (md.used_in_episode_id) selections.push('episode_title');
                        if (['invite', 'upgrade', 'brand_deal'].includes(type)) selections.push('mail_panel');
                        if ((md.prestige || 5) >= 4) selections.push('wardrobe_list', 'closet_ui');
                        if (['brand_deal', 'deliverable'].includes(type) || (md.prestige || 5) >= 6) selections.push('career_list');
                        if (auto.social_tasks?.length > 0) selections.push('social_tasks');
                        if (md.is_paid || (md.prestige || 5) >= 7) selections.push('stats_panel');
                      }

                      return (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Episode Overlays (select for this episode)</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {episodeOverlays.map(o => {
                              const selected = selections.includes(o.id);
                              return (
                                <button key={o.id} onClick={async () => {
                                  const newSelections = selected ? selections.filter(s => s !== o.id) : [...selections, o.id];
                                  try {
                                    await api.put(`/api/v1/world/${showId}/events/${md.id}/overlay-selections`, { selected_overlays: newSelections });
                                    setEventDetailModal(prev => prev ? { ...prev, required_ui_overlays: newSelections } : prev);
                                    setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, required_ui_overlays: newSelections } : ev));
                                  } catch { /* non-blocking */ }
                                }} style={{
                                  padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                  background: selected ? 'var(--primary-subtle)' : 'var(--lala-parchment-2)',
                                  color: selected ? 'var(--primary-text)' : 'var(--text-secondary)',
                                  border: `1px solid ${selected ? 'var(--primary-light)' : 'var(--lala-parchment-3)'}`,
                                }}>
                                  {o.icon} {o.name} {selected ? '✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Episode Title + Custom Overlay Actions */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {md.used_in_episode_id && (
                        <button onClick={async (e) => {
                          const btn = e.currentTarget;
                          btn.disabled = true; btn.textContent = '⏳ Generating...';
                          try {
                            const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/generate-title-overlay`);
                            if (res.data.success) setToast(`Title overlay: "${res.data.data.title}"`);
                          } catch (err) {
                            const status = err.response?.status;
                            const data = err.response?.data || {};
                            setToast('Failed: ' + (data.error || err.message));
                            // Stale link recovery — backend cleared the
                            // orphan used_in_episode_id; reload events so
                            // the now-detached row no longer shows this
                            // button on next render.
                            if (status === 404 && data.stale_link_cleared) loadData();
                          }
                          btn.disabled = false; btn.textContent = '🎬 Generate Episode Title';
                        }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                          🎬 Generate Episode Title
                        </button>
                      )}
                      <button onClick={async () => {
                        const name = window.prompt('Custom overlay name (e.g., "Sponsor Logo", "Transition Card"):');
                        if (!name) return;
                        const prompt = window.prompt('Describe the overlay for AI generation:');
                        if (!prompt) return;
                        const scope = window.confirm('Is this a SHOW-level overlay (appears in every episode)?\n\nOK = Show level\nCancel = Episode level only') ? 'show' : 'episode';
                        const category = window.confirm('Is this a frame (large panel)?\n\nOK = Frame\nCancel = Icon') ? 'frame' : 'icon';
                        try {
                          const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
                            name, prompt, category,
                            description: `Custom ${scope}-level ${category}: ${name}`,
                            beat: scope === 'show' ? 'Various' : 'Custom',
                          });
                          if (res.data.success) setToast(`Custom overlay "${name}" created — generate it in Assets → Lala's Phone`);
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px dashed var(--lala-ink-faint)', background: 'var(--surface-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                        + Add Custom Overlay
                      </button>
                    </div>
                  </div>

                  {/* Wardrobe Shopping List Overlay */}
                  <OverlayApprovalPanel
                    event={md}
                    showId={showId}
                    overlayType="wardrobe"
                    existingUrl={auto.wardrobe_overlay_url || null}
                    existingAssetId={auto.wardrobe_overlay_asset_id || null}
                    existingTasks={auto.wardrobe_tasks || []}
                    onGenerated={(url, assetId, tasks) => {
                      const newAuto = { ...auto, wardrobe_overlay_url: url, wardrobe_overlay_asset_id: assetId, wardrobe_tasks: tasks };
                      const updated = { ...eventDetailModal, canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto } };
                      setEventDetailModal(updated);
                      setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                    }}
                  />

                  {/* Social Tasks Overlay */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <button
                      onClick={async () => {
                        try {
                          setToast('Regenerating social tasks...');
                          const regen = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-social-checklist`, { force: true });
                          if (regen.data?.success) {
                            const tasks = regen.data?.data?.tasks || [];
                            const assetUrl = regen.data?.data?.assetUrl || auto.social_checklist_url || null;
                            const assetId = regen.data?.data?.assetId || auto.social_checklist_asset_id || null;
                            const newAuto = {
                              ...auto,
                              social_tasks: tasks,
                              social_checklist_url: assetUrl,
                              social_checklist_asset_id: assetId,
                            };
                            const updated = {
                              ...eventDetailModal,
                              canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto },
                            };
                            setEventDetailModal(updated);
                            setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                            // T5 (Task #2304): after Start Episode the tasks are saved to the episode's copy.
                            setToast(regen.data?.data?.savedTo === 'episode'
                              ? `Regenerated ${tasks.length} social tasks on the episode's task list`
                              : `Regenerated ${tasks.length} social tasks for this invite`);
                          }
                        } catch (err) {
                          setToast('Failed: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
                    >
                      Regenerate Social Tasks
                    </button>
                  </div>
                  <OverlayApprovalPanel
                    event={md}
                    showId={showId}
                    overlayType="social"
                    existingUrl={auto.social_checklist_url || null}
                    existingAssetId={auto.social_checklist_asset_id || null}
                    existingTasks={auto.social_tasks || []}
                    onGenerated={(url, assetId, tasks) => {
                      const newAuto = { ...auto, social_checklist_url: url, social_checklist_asset_id: assetId, social_tasks: tasks };
                      const updated = { ...eventDetailModal, canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto } };
                      setEventDetailModal(updated);
                      setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                    }}
                  />

                  {/* Episode linking */}
                  <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Link to Episode</div>
                    {sceneSetReconnect?.eventId === md.id && (
                      <div data-testid="scene-set-reconnect" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', marginBottom: 6, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                        <div style={{ flex: '1 1 180px', fontSize: 11, color: 'var(--warning-text)' }}>
                          <div style={{ fontWeight: 700 }}>
                            {sceneSetReconnect.status === 'choose' ? 'Event attached · Choose its scene set' : 'Event attached · Scene set needs reconnecting'}
                          </div>
                          {sceneSetReconnect.reason && <div style={{ marginTop: 2 }}>{sceneSetReconnect.reason}</div>}
                        </div>
                        {sceneSetReconnect.status === 'choose' ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                            {(sceneSetReconnect.options || []).map((o) => (
                              <button key={o.id} data-testid={`scene-set-choice-${o.id}`} onClick={() => retrySceneSetLink(md.id, o.id)} disabled={reconnecting} style={{ ...S.smBtn, fontSize: 11, padding: '4px 10px' }}>
                                {o.name}{o.base_still_url ? '' : ' (no image yet)'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button onClick={() => retrySceneSetLink(md.id)} disabled={reconnecting} style={{ ...S.smBtn, fontSize: 11, padding: '4px 10px' }}>
                            {reconnecting ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </div>
                    )}
                    {injectSuccess?.eventId === md.id ? (
                      <div style={{ padding: 10, background: 'var(--success-bg)', borderRadius: 8, border: '2px solid var(--success)', textAlign: 'center', fontSize: 13, color: 'var(--success-text)', fontWeight: 700 }}>{injectSuccess.message}</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {episodes.map(ep => {
                          const isLinked = ep.id === md.used_in_episode_id;
                          return (
                            <button key={ep.id} onClick={() => injectEvent(md.id, ep.id)} disabled={injecting} style={{
                              textAlign: 'left', padding: '5px 8px',
                              background: isLinked ? 'var(--success-bg)' : 'var(--surface-card)',
                              border: isLinked ? '2px solid var(--success)' : '1px solid var(--lala-parchment-3)',
                              borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)',
                            }}>
                              <div style={{ fontWeight: 600 }}>{ep.episode_number || '?'}. {(ep.title || '').slice(0, 14)}</div>
                              {isLinked && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>✓ Linked</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 24px', borderTop: '1px solid var(--lala-parchment-2)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => deleteEvent(md.id).then(() => setEventDetailModal(null))} style={S.smBtnDanger}>Delete</button>
                  {md.status === 'ready' && (
                    <button onClick={async () => {
                      const reason = window.prompt('Why is Lala declining? (e.g. "can\'t afford it", "schedule conflict", "not worth the drama")');
                      if (!reason) return;
                      try {
                        await api.post(`/api/v1/world/${showId}/events/${md.id}/decline`, { reason });
                        setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'declined' } : ev));
                        setEventDetailModal({ ...md, status: 'declined' });
                        setToast(`"${md.name}" declined — tracked for future callbacks`);
                      } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                    }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--warning)', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      Decline Invite
                    </button>
                  )}
                  {md.status === 'draft' && (
                    <button onClick={async () => {
                      // Validate required fields against what is stored
                      // (Task #1786): the row's own field or its saved
                      // automation copy, plus any edit made in this modal
                      // not yet saved. A value shown only because the modal
                      // invented it at render (the two-weeks-out date, the
                      // 'chic' dress code) counts as missing.
                      const pending = changedFields(baseline, md, MODAL_SAVEABLE_FIELDS);
                      const missing = missingForMarkReady({ ...stored, ...pending });
                      if (missing.length > 0) {
                        setToast(`Missing fields: ${missing.join(', ')}. Fill them or use AI Enhance first.`);
                        return;
                      }
                      // Confirmation summary. The venue-image bullet is conditional:
                      // if a scene set is already attached we'll skip regeneration
                      // (the backend also guards this, but skipping the call
                      // entirely saves a round-trip and makes the UX honest).
                      const hasVenue = !!(md.scene_set_id || md.venue_location_id);
                      const summary = `Mark "${md.name}" as ready?\n\nHost: ${md.host}\nVenue: ${md.venue_name}\nDate: ${md.event_date}\nPrestige: ${md.prestige}\n\nThis will:\n• Mark the event ready${Object.keys(pending).length ? ' and save your unsaved edits' : ''}\n• Generate social checklist\n${hasVenue ? '• Keep the attached venue (no regeneration)' : '• Show the venue\'s brief, to generate its images'}\n• Move out of Drafts`;
                      if (!window.confirm(summary)) return;
                      try {
                        // Mark ready, plus only the edits this modal has not
                        // saved yet — never a resave of the hydrated copy
                        // (Task #1786).
                        const fieldsToSave = { ...pending, status: 'ready' };
                        const res = await modalSave(fieldsToSave);
                        if (res.data.success) {
                          recordSaved(fieldsToSave);
                          const updated = { ...md, ...fieldsToSave };
                          setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...fieldsToSave } : ev));
                          setEventDetailModal(updated);
                          setToast('Event marked ready — generating checklist...');
                          // Auto-generate social checklist
                          try {
                            const clRes = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-social-checklist`);
                            if (clRes.data.success) {
                              const newAuto = { ...auto, social_tasks: clRes.data.data.tasks, social_checklist_url: clRes.data.data.assetUrl };
                              const withChecklist = { ...updated, canon_consequences: { ...updated.canon_consequences, automation: newAuto } };
                              setEventDetailModal(withChecklist);
                              setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: withChecklist.canon_consequences } : ev));
                              // Only regenerate the venue if there isn't one
                              // already on the event. Prevents Mark-Ready from
                              // clobbering a scene set the creator deliberately
                              // picked. The backend also guards this, but
                              // skipping the call here is cheaper + cleaner.
                              if (hasVenue) {
                                setToast(`Ready! Checklist done. Kept attached venue.`);
                                loadData();
                              } else {
                                // S8: no image work here; the venue's set and
                                // its images are made in Scene Sets.
                                setToast('Ready! Checklist done. Create the venue\'s scene set, then make its images in Scene Sets.');
                                loadData();
                              }
                            }
                          } catch { /* non-blocking — checklist can be generated later */ }
                        }
                      } catch (err) {
                        // Refused because the event changed elsewhere: say
                        // so, and do not retry (Task #1788).
                        if (isStaleSaveError(err)) {
                          setToast(`${saveErrorMessage(err)} Close this editor and reopen the event.`);
                          return;
                        }
                        // If full save fails (columns missing), at least save status
                        try {
                          await modalSave({ status: 'ready' });
                          setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'ready' } : ev));
                          setEventDetailModal({ ...md, status: 'ready' });
                          setToast('Marked ready (some fields saved to automation only)');
                        } catch (e2) {
                          setToast('Failed: ' + (e2.response?.data?.error || err.message));
                        }
                      }
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid var(--success)', background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Mark Ready
                    </button>
                  )}
                  {md.used_in_episode_id && md.status !== 'draft' && (
                    <button onClick={async () => {
                      if (!window.confirm(`Complete "${md.name}"?\n\nThis will:\n• Evaluate the episode (outfit + event + character state)\n• Apply social task bonuses (reputation, influence)\n• Finalize all financial transactions\n• Update Lala's character stats\n• Mark event as filmed`)) return;
                      // MB4 (§8(gg)): warn early on money; never blocks.
                      const moneyWarning = await completeMoneyWarning(showId, md.used_in_episode_id);
                      if (moneyWarning && !window.confirm(moneyWarning)) return;
                      try {
                        const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/complete`);
                        if (res.data.success) {
                          const d = res.data.data;
                          if (d.already_completed) {
                            setToast(`Already completed — ${d.evaluation?.tier?.toUpperCase()} (${d.evaluation?.score}/100)`);
                          } else {
                            setToast(`${d.evaluation.tier.toUpperCase()} (${d.evaluation.score}/100) — ${d.evaluation.narrative}`);
                            setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'filmed' } : ev));
                            setEventDetailModal(prev => prev ? { ...prev, status: 'filmed' } : prev);
                          }
                        }
                      } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      👑 Complete Episode
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button onClick={async () => {
                    // Send only the fields whose value differs from what the
                    // modal opened with (Task #1786). Most fields already
                    // saved on blur, so this is usually nothing. It never
                    // sends canon_consequences: nothing in this modal edits
                    // it, and sending the opened copy whole overwrote the
                    // Event Package's guests and a freshly generated
                    // invitation (docs/EVENT_EDITOR_REMOVAL_READ.md §5.2).
                    const toSave = changedFields(baseline, md, MODAL_SAVEABLE_FIELDS);
                    if (Object.keys(toSave).length === 0) {
                      setToast('No unsaved changes');
                      return;
                    }
                    try {
                      const res = await modalSave(toSave);
                      if (res.data.success) {
                        recordSaved(toSave);
                        setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event } : ev));
                        setToast('Event saved');
                      }
                    } catch (err) {
                      setToast(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : 'Save failed: ' + (err.response?.data?.error || err.message));
                    }
                  }} style={{ ...S.primaryBtn, padding: '6px 20px', fontSize: 13 }}>
                    💾 Save
                  </button>
                  <button onClick={() => setEventDetailModal(null)} style={{ ...S.smBtn, background: 'var(--lala-parchment-2)' }}>Close</button>
                </div>
              </div>
            </div>
            );
          })()}

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

      {/* ════════════════════════ OPPORTUNITIES ════════════════════════ */}
      {activeTab === 'opportunities' && (
        <OpportunitiesTab showId={showId} api={api} S={S} setToast={setToast} loadData={loadData} />
      )}


      {/* ════════════════════════ CAREER GOALS ════════════════════════ */}
      {/* Career Goals: part of the Season Plan, below the arc. */}
      {activeTab === 'episodes' && subTab === 'season' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>🎯 Career Goals</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={syncGoals} style={S.secBtn}>🔄 Sync from Stats</button>
              <button onClick={loadSuggestions} style={S.secBtn}>💡 Suggest Events</button>
              <button onClick={async () => {
                try {
                  const res = await api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 });
                  if (res.data.success) { setSuccessMsg(`Seeded ${res.data.created} goals! (${res.data.skipped} already existed)`); loadData(); }
                } catch (err) { setError(err.response?.data?.error || err.message); }
              }} style={S.secBtn}>🌱 Seed 24 Goals</button>
              <button onClick={() => { setGoalForm({ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '', description: '' }); setEditingGoal('new'); }} style={S.primaryBtn}>+ New Goal</button>
            </div>
          </div>

          {/* Goal editor */}
          {editingGoal && (
            <div style={{ background: 'var(--surface-card)', border: '2px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{editingGoal === 'new' ? '✨ New Goal' : '✏️ Edit Goal'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }} className="wa-grid wa-grid-3col">
                <FG label="Goal Title *" value={goalForm.title} onChange={v => setGoalForm(p => ({ ...p, title: v }))} placeholder="Break Into Luxury Fashion" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={goalForm.type} onChange={e => setGoalForm(p => ({ ...p, type: e.target.value }))} style={S.sel}>
                    <option value="primary">🌟 Primary (1 max)</option>
                    <option value="secondary">🎯 Secondary (2 max)</option>
                    <option value="passive">🌿 Passive (unlimited)</option>
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Metric</label>
                  <select value={goalForm.target_metric} onChange={e => setGoalForm(p => ({ ...p, target_metric: e.target.value }))} style={S.sel}>
                    <option value="coins">🪙 Coins</option>
                    <option value="reputation">⭐ Reputation</option>
                    <option value="brand_trust">🤝 Brand Trust</option>
                    <option value="influence">📣 Influence</option>
                    <option value="stress">😰 Stress (reduce to)</option>
                    <option value="followers">👥 Followers</option>
                    <option value="engagement_rate">📈 Engagement Rate</option>
                    <option value="portfolio_strength">📁 Portfolio Strength</option>
                  </select>
                </div>
                <FG label="Target Value" value={goalForm.target_value} onChange={v => setGoalForm(p => ({ ...p, target_value: parseFloat(v) || 0 }))} type="number" />
                <FG label="Icon" value={goalForm.icon} onChange={v => setGoalForm(p => ({ ...p, icon: v }))} placeholder="🎯" />
                <FG label="Color" value={goalForm.color} onChange={v => setGoalForm(p => ({ ...p, color: v }))} placeholder="#RRGGBB" />
              </div>
              <FG label="Description" value={goalForm.description} onChange={v => setGoalForm(p => ({ ...p, description: v }))} textarea full placeholder="What does achieving this goal mean for Lala's journey?" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingGoal(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveGoal} disabled={savingGoal || !goalForm.title} style={S.primaryBtn}>
                  {savingGoal ? '⏳' : editingGoal === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
          )}

          {/* Active goals by type */}
          {['primary', 'secondary', 'passive'].map(goalType => {
            const typeGoals = goals.filter(g => g.type === goalType && g.status === 'active');
            if (typeGoals.length === 0 && goalType === 'passive') return null;
            const typeLabel = goalType === 'primary' ? '🌟 Primary Goal' : goalType === 'secondary' ? '🎯 Secondary Goals' : '🌿 Passive Goals';
            const typeLimit = goalType === 'primary' ? '(1 max)' : goalType === 'secondary' ? '(2 max)' : '';
            return (
              <div key={goalType}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{typeLabel} {typeLimit}</div>
                <div style={{ display: 'grid', gridTemplateColumns: goalType === 'primary' ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {typeGoals.map(g => {
                    const pct = g.progress || Math.min(100, Math.round(((g.current_value - (g.starting_value || 0)) / Math.max(1, (g.target_value - (g.starting_value || 0)))) * 100));
                    return (
                      <div key={g.id} style={{ background: 'var(--surface-card)', border: goalType === 'primary' ? `2px solid ${g.color || 'var(--primary)'}` : '1px solid var(--lala-parchment-3)', borderRadius: 12, padding: goalType === 'primary' ? 20 : 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: goalType === 'primary' ? 28 : 20 }}>{g.icon || '🎯'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: goalType === 'primary' ? 16 : 14, fontWeight: 700, color: 'var(--text-primary)' }}>{g.title}</div>
                            {g.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{g.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setGoalForm({ ...g }); setEditingGoal(g.id); }} style={S.smBtn}>✏️</button>
                            <button onClick={() => deleteGoal(g.id)} style={S.smBtnDanger}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          {STAT_ICONS[g.target_metric] || '📊'} {g.target_metric?.replace(/_/g, ' ')}: <strong>{g.current_value}</strong> / {g.target_value}
                        </div>
                        <div style={{ height: 8, background: 'var(--lala-parchment-2)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : (g.color || 'var(--primary)'), borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: pct >= 100 ? 'var(--success-text)' : 'var(--text-secondary)', fontWeight: pct >= 100 ? 700 : 400 }}>
                          {pct >= 100 ? '✅ COMPLETE' : `${pct}% — ${Math.max(0, g.target_value - g.current_value)} remaining`}
                        </div>
                      </div>
                    );
                  })}
                  {typeGoals.length === 0 && (
                    <div style={{ padding: 20, background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, border: '1px dashed var(--lala-parchment-3)' }}>
                      No active {goalType} goal. Click "+ New Goal" to create one.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Completed goals */}
          {goals.filter(g => g.status === 'completed').length > 0 && (
            <div style={S.card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: 'var(--success-text)' }}>✅ Completed Goals</h3>
              {goals.filter(g => g.status === 'completed').map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--lala-parchment-3)' }}>
                  <span>{g.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success-text)' }}>{g.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{g.completed_at ? new Date(g.completed_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Event suggestions */}
          {suggestions.length > 0 && (
            <div style={S.card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>💡 Suggested Events (Based on Active Goals)</h3>
              {suggestions.map((s, i) => (
                <div key={i} style={{ padding: 14, background: 'var(--surface-bg)', borderRadius: 10, marginBottom: 10, border: s.requirements_met === false ? '1px solid var(--danger-border)' : '1px solid var(--success-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[s.event_type] || '📌'}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                    <span style={S.eTag}>⭐ {s.prestige}</span>
                    <span style={S.eTag}>🪙 {s.cost_coins}</span>
                    {s.is_paid && <span style={{ padding: '2px 8px', background: 'var(--success-bg)', borderRadius: 4, fontSize: 10, fontWeight: 600, color: 'var(--success-text)' }}>💰 Paid</span>}
                    {!s.requirements_met && <span style={{ padding: '2px 8px', background: 'var(--danger-bg)', borderRadius: 4, fontSize: 10, fontWeight: 600, color: 'var(--danger-text)' }}>⚠️ Reqs not met</span>}
                  </div>
                  {s.narrative_stakes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 6 }}>{s.narrative_stakes}</div>}
                  <div style={{ fontSize: 11, color: 'var(--primary-text)', marginBottom: 8, lineHeight: 1.5 }}>
                    {(s.suggestion_reasons || []).slice(0, 4).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setActiveTab('events'); }} style={S.smBtn}>📋 View in Events</button>
                    <button onClick={() => {
                      setActiveTab('events');
                      setInjectTarget(s.id);
                    }} style={S.smBtn}>💉 Inject into Episode</button>
                    <button onClick={() => {
                      setActiveTab('events');
                      setGenerateTarget(s.id);
                    }} style={{ ...S.smBtn, background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>📝 Generate Script</button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* ════════════════════════ EPISODE BLUEPRINT MODAL ════════════════════════ */}
      {episodeBlueprint && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEpisodeBlueprint(null)}>
          <div style={{ background: 'var(--surface-card)', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎬 Episode Blueprint</h2>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            {/* Episode info */}
            <div style={{ background: 'var(--surface-bg)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--lala-parchment-3)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{episodeBlueprint.episode?.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Episode {episodeBlueprint.episode?.episode_number} · {episodeBlueprint.brief?.episode_archetype} · Intent: {episodeBlueprint.brief?.designed_intent}</div>
            </div>

            {/* Financials */}
            {episodeBlueprint.financials && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: 'var(--success-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--success-text)' }}>Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-text)' }}>{episodeBlueprint.financials.total_income}</div>
                </div>
                <div style={{ padding: '8px 14px', background: 'var(--danger-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--danger-text)' }}>Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-text)' }}>{episodeBlueprint.financials.total_expenses}</div>
                </div>
                <div style={{ padding: '8px 14px', background: episodeBlueprint.financials.net_profit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Net</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: episodeBlueprint.financials.net_profit >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{episodeBlueprint.financials.net_profit}</div>
                </div>
              </div>
            )}

            {/* 14 Beats Timeline */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>14 Beats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(episodeBlueprint.beats || []).map((beat, i) => {
                  // A beat's phase: a surface, and a dot the beat number reads white on (the text twins; the old fills were 2.2:1 to 3.0:1 under white).
                  const phaseColors = { before: 'var(--warning-bg)', during: 'var(--info-bg)', after: 'var(--accent-subtle)' };
                  const phaseDots = { before: 'var(--warning-text)', during: 'var(--info-text)', after: 'var(--accent-dark)' };
                  // Find feed moment for this beat from scene plan
                  const sp = episodeBlueprint.scenePlan?.find(s => s.beat_number === beat.beat);
                  const fm = sp?.feed_moment || episodeBlueprint.feedMoments?.[beat.beat];
                  return (
                    <div key={i} style={{ padding: '6px 10px', background: phaseColors[beat.phase] || 'var(--surface-bg)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: phaseDots[beat.phase] || 'var(--text-secondary)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{beat.beat}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{beat.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{beat.description}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{beat.phase} · {beat.emotional_intent}</div>
                        </div>
                        {fm && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'var(--gray-900)', color: 'var(--text-inverse)', fontWeight: 700, flexShrink: 0 }}>📱</span>}
                      </div>
                      {/* Feed Moment — On-Screen Visual + Script Lines */}
                      {fm && (
                        <div style={{ marginTop: 6, marginLeft: 34, display: 'flex', gap: 6 }}>
                          {/* On-Screen Overlay (bright — what viewer sees) */}
                          <div style={{ flex: 1, padding: '6px 10px', background: 'var(--lala-gold-soft)', borderRadius: 8, border: '1px solid var(--lala-gold-line)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--lala-gold-text)', textTransform: 'uppercase' }}>On Screen · {(fm.on_screen || fm.phone_screen)?.type || 'notification'}</span>
                              <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{fm.trigger_profile}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>{(fm.on_screen || fm.phone_screen)?.content}</div>
                          </div>
                          {/* Script Lines — Both Voices */}
                          {(fm.script_lines || fm.lala_dialogue) && (
                            <div style={{ flex: 1, padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--lala-parchment-3)' }}>
                              {/* JustAWoman — player voice */}
                              {fm.script_lines?.justawoman_line && (
                                <div style={{ marginBottom: 4 }}>
                                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--lala-gold-text)', textTransform: 'uppercase' }}>JustAWoman</span>
                                  <div style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 1 }}>"{fm.script_lines.justawoman_line}"</div>
                                </div>
                              )}
                              {/* Lala — character voice */}
                              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--primary-text)', textTransform: 'uppercase' }}>Lala</span>
                              <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 1, fontFamily: "'Lora', serif" }}>
                                "{fm.script_lines?.lala_line || fm.lala_dialogue}"
                              </div>
                              {(fm.script_lines?.lala_internal || fm.lala_internal) && (
                                <div style={{ fontSize: 10, color: 'var(--primary-text)', fontStyle: 'italic', marginTop: 2 }}>
                                  [{fm.script_lines?.lala_internal || fm.lala_internal}]
                                </div>
                              )}
                              {/* Financial indicator */}
                              {fm.financial && (
                                <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginTop: 3, display: 'inline-block', background: fm.financial.affordable ? 'var(--success-bg)' : 'var(--danger-bg)', color: fm.financial.affordable ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                                  Bank: {fm.financial.balance} → {fm.financial.affordable ? `-${fm.financial.outfit_cost} = ${fm.financial.remaining}` : `Need ${fm.financial.outfit_cost} (short ${fm.financial.outfit_cost - fm.financial.balance})`}
                                </div>
                              )}
                              {(fm.script_lines?.direction || fm.behavior_shift) && (
                                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>→ {fm.script_lines?.direction || fm.behavior_shift}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Social Tasks */}
            {episodeBlueprint.socialTasks?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>📱 Social Media Tasks ({episodeBlueprint.socialTasks.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {episodeBlueprint.socialTasks.map((task, i) => (
                    <div key={i} style={{ padding: '6px 10px', background: task.source ? 'var(--lala-gold-soft)' : 'var(--surface-bg)', borderRadius: 6, fontSize: 11, borderLeft: task.source ? '3px solid var(--lala-gold)' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>☐</span>
                        <span style={{ fontWeight: 600 }}>{task.label}</span>
                        <SocialTaskBadge task={task} />
                        {task.source === 'platform' && <span style={{ fontSize: 8, padding: '1px 4px', background: 'var(--info-bg)', color: 'var(--info-text)', borderRadius: 3 }}>{task.platform}</span>}
                        {task.source === 'category' && <span style={{ fontSize: 8, padding: '1px 4px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 3 }}>niche</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{task.description}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{task.platform} · {task.timing}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed Activity */}
            {episodeBlueprint.feedPosts?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>📢 Feed Activity ({episodeBlueprint.feedPosts.length} posts)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {episodeBlueprint.feedPosts.map((post, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-bg)', borderRadius: 8, borderLeft: '3px solid var(--lala-gold)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{post.handle} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({post.role})</span></div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{post.content}"</div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{post.platform}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                // Open Episode lands on Overview (Task #1905), as the queue's does.
                if (epId) window.location.href = `/episodes/${epId}?tab=overview`;
                else { setActiveTab('episodes'); setEpisodeBlueprint(null); }
              }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Open Episode →
              </button>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                if (epId) window.location.href = `/episodes/${epId}/script-writer`;
                else setEpisodeBlueprint(null);
              }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--lala-gold)', background: 'transparent', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Write Script
              </button>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--lala-parchment-3)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
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
        const setCount = wardrobeItems.filter(i => i.outfit_set_id).length;

        const filteredItems = wardrobeItems.filter(item => {
          // Top-tab: staging means never used. Applied before everything else
          // so the count in the tab matches what the grid shows.
          if (wardrobeTopTab === 'staging' && isItemUsed(item)) return false;
          if (wardrobeTopTab === 'owned' && !isOwnedPiece(item)) return false;
          if (wardrobeTopTab === 'to_buy' && isOwnedPiece(item)) return false;
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

        const openEditItem = (item) => {
          setEditingWardrobeItem(item);
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

        // Promote a colored-backdrop variant to a phone screen (Asset with
        // overlay_type='wardrobe_detail'). After creation, switch the user
        // into the UI Overlays tab so they can draw tap zones and content
        // zones on the freshly-created screen — we delegate that authoring
        // entirely to the existing overlay editor rather than reinvent it
        // on the wardrobe side.
        const handleSendToPhone = async (item, variant) => {
          if (sendingToPhone) return;
          if (!['pink', 'blue', 'teal'].includes(variant)) {
            alert('Pick one of the colored backdrop variants (pink, blue, or teal) before sending to phone.');
            return;
          }
          if (!confirm(
            `Send "${item.name}" (${variant} backdrop) to Lala's phone?\n\n` +
            `Creates a new phone screen using this variant. You'll be taken to the overlay editor to draw tap zones and content areas on it.`
          )) return;

          setSendingToPhone(true);
          try {
            const result = await sendWardrobeToPhoneApi(item.id, { variant, showId });
            // Close lightbox + navigate to the overlay editor tab. The new
            // Asset will appear in UIOverlaysTab's list automatically via
            // its existing GET /api/v1/ui-overlays/:showId fetch.
            setLightboxVariant(null);
            setLightboxItem(null);
            setSubTab('overlays-tab');
            setSearchParams({ tab: 'overlays-tab' });
            alert(`Sent to phone as "${result.data.name}". Opening overlay editor…`);
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
            };
            const res = await api.put(`/api/v1/wardrobe/${editingWardrobeItem.id}`, payload);
            if (res.data.success) {
              setWardrobeItems(prev => prev.map(i => i.id === editingWardrobeItem.id ? { ...i, ...res.data.data } : i));
              setEditingWardrobeItem(null);
              setSuccessMsg('Wardrobe item updated!');
              setToast('Item saved!'); setTimeout(() => setToast(null), 2500);
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
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
              <button type="button" className="wa-wd-add" onClick={() => { setWardrobeUploadForm({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: true, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' }); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); setShowWardrobeUpload(true); }}>
                <Plus size={14} aria-hidden="true" /> Add piece
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
                  const allFive = ['outfit', 'shoes', 'jewelry', 'accessories', 'fragrance'];
                  const current = Array.isArray(show?.metadata?.required_slots) ? show.metadata.required_slots : null;
                  const requireAll = current && allFive.every(s => current.includes(s));
                  const label = requireAll ? '✓ All slots required' : 'Require all slots';
                  return (
                    <button
                      onClick={async () => {
                        const next = requireAll ? ['outfit', 'shoes'] : allFive;
                        try {
                          await api.put(`/api/v1/shows/${showId}/wardrobe-config`, { required_slots: next });
                          setShow(prev => prev ? { ...prev, metadata: { ...(prev.metadata || {}), required_slots: next } } : prev);
                          setToast(requireAll ? 'Outfit + shoes required' : 'All 5 slots required');
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
                        const catMap = { dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes', accessory: 'accessory', jewelry: 'jewelry', bag: 'bag', outerwear: 'outerwear', perfume: 'perfume', skirt: 'bottom', pants: 'bottom', shirt: 'top', blouse: 'top', fragrance: 'perfume' };
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

            {/* Item Grid — visual cards with thumbnails. List mode swaps the grid
                template for a vertical stack of wide rows. Both modes share the
                same card internals below so there's a single source of truth. */}
            <div className={wardrobeViewMode === 'list' ? undefined : 'wa-wd-grid'} style={{
              display: wardrobeViewMode === 'list' ? 'flex' : 'grid',
              flexDirection: wardrobeViewMode === 'list' ? 'column' : undefined,
              gridTemplateColumns: wardrobeViewMode === 'list' ? undefined : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: wardrobeViewMode === 'list' ? 8 : 14,
            }}>
              {visibleItems.map(item => {
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
                    className={`wa-wd-card${isListMode ? ' list' : ''}${isBulkSelected ? ' selected' : ''}${isEditing ? ' editing' : ''}`}
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
                      style={{
                        width: isListMode ? 80 : '100%',
                        flexShrink: isListMode ? 0 : undefined,
                        aspectRatio: isListMode ? '1/1' : '3/4',
                        background: 'var(--lala-parchment-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
                      }}
                      onClick={(e) => { if (imgUrl) { e.stopPropagation(); setLightboxVariant(null); setLightboxItem(item); } }}
                    >
                      {!isListMode && (
                        <span className={`wa-wd-own${owned ? '' : ' to-buy'}`} data-testid={`wardrobe-own-${item.id}`}>{owned ? 'Owned' : 'To buy'}</span>
                      )}
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--lala-parchment-2)' }}
                          onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      ) : null}
                      <div style={{ display: imgUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 48, color: 'var(--text-secondary)' }}>
                        {CAT_ICONS[itemType] || '👗'}
                      </div>
                      {/* Expand icon on hover */}
                      {imgUrl && processingState !== PROCESSING_STATES.PROCESSING && processingState !== PROCESSING_STATES.STALLED && (
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
            {totalPages > 1 && (
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
                  <button onClick={() => { setWardrobeUploadForm({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: true, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' }); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); setShowWardrobeUpload(true); }} style={S.primaryBtn}>
                    + Upload First Item
                  </button>
                )}
              </div>
            )}

            {/* ── Upload Modal ── */}
            {showWardrobeUpload && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !wardrobeUploading && setShowWardrobeUpload(false)}>
                <div style={{ background: 'var(--surface-card)', borderRadius: 14, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Add Wardrobe Item</h3>
                    <button onClick={() => setShowWardrobeUpload(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                  </div>

                  {/* Image drop zone */}
                  <div
                    style={{ border: '1.5px dashed var(--lala-parchment-3)', borderRadius: 10, background: wardrobeUploadPreview ? 'var(--surface-card)' : 'var(--surface-bg)', marginBottom: 12, cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => document.getElementById('wardrobe-upload-input')?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) { setWardrobeUploadFile(f); setWardrobeUploadPreview(URL.createObjectURL(f)); } }}
                  >
                    {wardrobeUploadPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={wardrobeUploadPreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block', padding: 8 }} />
                        <button type="button" onClick={e => { e.stopPropagation(); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: 'var(--text-inverse)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>📸</div>
                        <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Drop image or click to browse</div>
                      </div>
                    )}
                    <input id="wardrobe-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setWardrobeUploadFile(f); setWardrobeUploadPreview(URL.createObjectURL(f)); } }} />
                  </div>

                  {/* AI auto-fill — inline error banner sits right above the button
                      so failures are visible without a modal. Common cause on dev:
                      ANTHROPIC_API_KEY unset → server returns 503; we annotate that
                      case so users don't have to dig through network tab. */}
                  {wardrobeAutoFillError && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 6, fontSize: 12, color: 'var(--danger-text)', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Auto-fill failed</div>
                      <div>{wardrobeAutoFillError}</div>
                      {/ANTHROPIC_API_KEY/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger-text)' }}>
                          The dev server is missing an Anthropic API key. Ask an admin to set <code>ANTHROPIC_API_KEY</code> in EC2 .env and restart PM2.
                        </div>
                      )}
                      {/Failed to fetch|NetworkError|ERR_/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger-text)' }}>
                          The request didn't reach the server. Usually one of:
                          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            <li>Backend not yet running the latest build (ask an admin to check <code>pm2 status</code>)</li>
                            <li>A stale Service Worker is intercepting — try a hard refresh (<code>Cmd/Ctrl+Shift+R</code>) or DevTools → Application → Service Workers → Unregister</li>
                            <li>Browser extension blocking the request (disable ad/privacy blockers on this tab)</li>
                          </ul>
                        </div>
                      )}
                      {/^(413|payload too large)/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger-text)' }}>
                          Image exceeds the server's upload limit. Try a smaller photo (&lt; 5 MB) or crop it down.
                        </div>
                      )}
                    </div>
                  )}
                  {wardrobeUploadFile && (
                    <button type="button" disabled={wardrobeAnalyzing} onClick={async () => {
                      setWardrobeAnalyzing(true);
                      setWardrobeAutoFillError(null);
                      try {
                        const fd = new FormData(); fd.append('image', wardrobeUploadFile);
                        // Pass show context so the server can enrich the prompt with
                        // recent tier mix + episode event and get gameplay suggestions.
                        // Without showId it falls back to the basic image-only flow.
                        if (showId) fd.append('showId', showId);
                        // Abort after 120s — Claude vision on a large image can take
                        // 30-60s under load, but anything beyond 2 min means the
                        // upstream is hung and we should surface that to the user.
                        // axios's timeout option enforces this; signal kept as belt-and-suspenders.
                        const ac = new AbortController();
                        const timeout = setTimeout(() => ac.abort(), 120000);
                        let res;
                        try {
                          res = await api.post('/api/v1/wardrobe-library/analyze-image', fd, {
                            signal: ac.signal,
                            timeout: 120000,
                          });
                        } finally {
                          clearTimeout(timeout);
                        }
                        // apiClient threw on non-2xx before reaching here, so res.data is the parsed body.
                        const data = res.data || {};
                        if (!data.success || !data.data) {
                          const msg = data.error || 'request failed';
                          console.error('[Auto-fill] backend rejected:', msg, data);
                          setWardrobeAutoFillError(msg);
                          return;
                        }
                        const ai = data.data;
                        setWardrobeUploadBrandIsFictional(!!ai.brand_is_fictional);
                        const catMap = { dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes', accessory: 'accessory', jewelry: 'jewelry', bag: 'bag', outerwear: 'outerwear', perfume: 'perfume', skirt: 'bottom', pants: 'bottom', shirt: 'top', blouse: 'top', fragrance: 'perfume' };
                        // A suggestion with no floor; it fills only an empty price (Task #2347).
                        const aiPrice = parseAiPrice(ai.price_estimate);
                        setWardrobeUploadForm(prev => ({
                          ...prev,
                          name: ai.name || prev.name,
                          clothingCategory: catMap[ai.item_type?.toLowerCase()] || prev.clothingCategory,
                          color: ai.color || prev.color,
                          brand: ai.brand_guess || prev.brand,
                          price: fillPrice(prev.price, aiPrice),
                          description: ai.description || prev.description || '',
                          season: ai.season || prev.season || '',
                          occasion: ai.occasion || prev.occasion || '',
                          tags: (ai.aesthetic_tags || []).join(', ') || prev.tags || '',
                          tier: ai.tier || prev.tier || '',
                          character: 'Lala',
                          // Gameplay — only filled when the server ran gameplay mode
                          // (i.e. we sent a showId). prev.X preserved so a second
                          // pass doesn't clobber values the user has tweaked.
                          ...(data.gameplay ? {
                            // Coin cost follows the price Evoni set, else the AI's
                            // coin_cost or price; filled only when empty (Task #2347).
                            coinCost: prev.coinCost || suggestCoinCost(prev.price, ai.coin_cost, aiPrice),
                            acquisitionType: prev.acquisitionType === 'purchased' && ai.acquisition_type ? ai.acquisition_type : (prev.acquisitionType || 'purchased'),
                            lockType: prev.lockType === 'none' && ai.lock_type ? ai.lock_type : (prev.lockType || 'none'),
                            // A lock the AI suggests is a piece Lala does not own yet.
                            ...(prev.lockType === 'none' && ai.lock_type && ai.lock_type !== 'none' ? { isOwned: false } : {}),
                            eraAlignment: prev.eraAlignment || ai.era_alignment || '',
                            aestheticTags: prev.aestheticTags || (ai.aesthetic_tags || []).join(', '),
                            eventTypes: prev.eventTypes || (ai.event_types || []).join(', '),
                            outfitMatchWeight: prev.outfitMatchWeight || (ai.outfit_match_weight != null ? String(ai.outfit_match_weight) : ''),
                            lalaReactionOwn: prev.lalaReactionOwn || ai.lala_reaction_own || '',
                            lalaReactionLocked: prev.lalaReactionLocked || ai.lala_reaction_locked || '',
                            lalaReactionReject: prev.lalaReactionReject || ai.lala_reaction_reject || '',
                          } : {}),
                        }));
                      } catch (err) {
                        console.error('[Auto-fill] threw:', err);
                        // AbortError means our 2-min timeout fired; give that a clear label
                        // so users don't think "Failed to fetch" means permanent breakage.
                        if (err.name === 'AbortError') {
                          setWardrobeAutoFillError('Timed out after 2 minutes — the AI server is slow or overloaded. Try again.');
                        } else {
                          setWardrobeAutoFillError(err.message || String(err));
                        }
                      } finally {
                        setWardrobeAnalyzing(false);
                      }
                    }} style={{ width: '100%', padding: '8px 0', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', cursor: wardrobeAnalyzing ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 11, opacity: wardrobeAnalyzing ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                      {wardrobeAnalyzing ? '⏳ Analyzing...' : '✨ Auto-fill from image'}
                    </button>
                  )}

                  {/* Form fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>name *</label><input value={wardrobeUploadForm.name} onChange={e => setWardrobeUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Floral Mini Dress" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>brand</label>
                        <input value={wardrobeUploadForm.brand} onChange={e => { setWardrobeUploadBrandIsFictional(false); setWardrobeUploadForm(p => ({ ...p, brand: e.target.value })); }} placeholder="e.g., Velvet House" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} />
                        {wardrobeUploadBrandIsFictional && (
                          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace" }}>
                            Fictional brand (auto-filled)
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>category *</label>
                        {/* Grouped by the five UI slots (Outfit / Shoes / Jewelry /
                            Accessories / Fragrance) — DB still stores the granular
                            clothing_category so scoring + filters keep working. */}
                        <select value={wardrobeUploadForm.clothingCategory} onChange={e => setWardrobeUploadForm(p => ({ ...p, clothingCategory: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}>
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
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>color</label><input value={wardrobeUploadForm.color} onChange={e => setWardrobeUploadForm(p => ({ ...p, color: e.target.value }))} placeholder="e.g., blush pink" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>tier</label>
                        {/* Tier descriptors mirror the old WardrobeBrowser edit form so the
                            gameplay context is obvious — e.g. "Luxury" isn't just a label,
                            it signals Designer-tier in-story. */}
                        <select value={wardrobeUploadForm.tier || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, tier: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}>
                          <option value="">Auto</option>
                          <option value="basic">👟 Basic — Fast Fashion</option>
                          <option value="mid">👠 Mid — Contemporary</option>
                          <option value="luxury">💎 Luxury — Designer</option>
                          <option value="elite">👑 Elite — Haute Couture</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>price</label><input type="number" value={wardrobeUploadForm.price} onChange={e => setWardrobeUploadForm(p => ({ ...p, price: e.target.value }))} placeholder="650.00" step="0.01" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>season</label><select value={wardrobeUploadForm.season || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, season: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}><option value="">Any</option>{['spring', 'summer', 'fall', 'winter', 'all-season'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>occasion</label><input value={wardrobeUploadForm.occasion || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, occasion: e.target.value }))} placeholder="gala, casual..." style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>
                    </div>
                    <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>description</label><textarea value={wardrobeUploadForm.description || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, description: e.target.value }))} placeholder="Material, style, fit, notable details..." rows={2} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', resize: 'vertical', boxSizing: 'border-box' }} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>tags (comma-separated)</label><input value={wardrobeUploadForm.tags || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, tags: e.target.value }))} placeholder="elegant, evening, silk" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>
                    {/* Purchase link so creators can source the real-world item later. Backend maps website → purchase_link. */}
                    <div><label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>website / purchase link</label><input type="url" value={wardrobeUploadForm.website || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)' }} /></div>

                    {/* ── Gameplay section ─────────────────────────────────
                        Fields that drive the in-story unlock/purchase flow. Kept
                        visually separate from the "what is this thing?" fields
                        above so creators can scan past if they're just logging
                        a piece without gameplay intent. */}
                    <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 8 }}>🎮 GAMEPLAY (OPTIONAL)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>story price (LalaVerse coins)</label>
                          <input type="number" min="0" step="1" value={wardrobeUploadForm.coinCost || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, coinCost: e.target.value }))} placeholder="e.g., 2400" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>how Lala got it</label>
                          <select value={wardrobeUploadForm.acquisitionType || 'purchased'} onChange={e => setWardrobeUploadForm(p => ({ ...p, acquisitionType: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}>
                            {['purchased', 'gifted', 'borrowed', 'rented', 'custom', 'vintage'].map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>lock type</label>
                          <select value={wardrobeUploadForm.lockType || 'none'} onChange={e => setWardrobeUploadForm(p => ({ ...p, lockType: e.target.value, isOwned: e.target.value === 'none' }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}>
                            <option value="none">None (always available)</option>
                            <option value="coin">🪙 Coin (pay to unlock)</option>
                            <option value="reputation">⭐ Reputation gate</option>
                            <option value="brand_exclusive">🔒 Brand exclusive</option>
                            <option value="season_drop">📅 Season drop</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>era alignment</label>
                          <select value={wardrobeUploadForm.eraAlignment || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, eraAlignment: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)' }}>
                            <option value="">Any era</option>
                            <option value="foundation">Foundation</option>
                            <option value="glow_up">Glow Up</option>
                            <option value="luxury">Luxury</option>
                            <option value="prime">Prime</option>
                            <option value="legacy">Legacy</option>
                          </select>
                        </div>
                      </div>
                      {/* Rep requirement only shows when the lock gate asks for it. Keeps the
                          form compact when it's irrelevant. */}
                      {wardrobeUploadForm.lockType === 'reputation' && (
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>reputation required</label>
                          <input type="number" min="0" step="1" value={wardrobeUploadForm.reputationRequired || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, reputationRequired: e.target.value }))} placeholder="e.g., 5" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                        </div>
                      )}

                      {/* ── Advanced gameplay (expandable) ─────────────────────
                          Collapsed by default so creators logging a piece don't see
                          12 extra inputs. Expand only when the item needs Lala
                          reaction blurbs, aesthetic/event tag buckets, or the rarer
                          scoring/gate knobs. */}
                      <details style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--lala-gold-line)' }}>
                        <summary style={{ fontSize: 11, fontWeight: 600, color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
                          ⋯ advanced gameplay
                        </summary>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Lala reaction blurbs — what she says about this item in three states. */}
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when she owns it)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionOwn || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionOwn: e.target.value }))} placeholder="e.g., 'My ride-or-die for red carpets'" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when locked)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionLocked || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionLocked: e.target.value }))} placeholder="e.g., 'One day...'" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when rejected)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionReject || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionReject: e.target.value }))} placeholder="e.g., 'Not the vibe for tonight'" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          {/* Tag buckets — distinct from the basic `tags` field above. */}
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>aesthetic tags (CSV)</label>
                            <input value={wardrobeUploadForm.aestheticTags || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, aestheticTags: e.target.value }))} placeholder="romantic, bold, editorial" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>event types (CSV)</label>
                            <input value={wardrobeUploadForm.eventTypes || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, eventTypes: e.target.value }))} placeholder="gala, brunch, meetup" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                          </div>
                          {/* Numeric knobs — match-weight is 1-10, the rest are natural units. */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>match weight (1-10)</label>
                              <input type="number" min="1" max="10" step="1" value={wardrobeUploadForm.outfitMatchWeight || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, outfitMatchWeight: e.target.value }))} placeholder="5" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>influence required</label>
                              <input type="number" min="0" step="1" value={wardrobeUploadForm.influenceRequired || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, influenceRequired: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>unlock ep #</label>
                              <input type="number" min="1" step="1" value={wardrobeUploadForm.seasonUnlockEpisode || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, seasonUnlockEpisode: e.target.value }))} placeholder="1" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          {/* Visibility flags — is_visible defaults true so this only
                              surfaces for authors who want to hide an item or mark it owned up front. */}
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                              <input type="checkbox" checked={!!wardrobeUploadForm.isOwned} onChange={e => setWardrobeUploadForm(p => ({ ...p, isOwned: e.target.checked }))} />
                              Lala already owns it
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                              <input type="checkbox" checked={wardrobeUploadForm.isVisible !== false} onChange={e => setWardrobeUploadForm(p => ({ ...p, isVisible: e.target.checked }))} />
                              Visible in closet
                            </label>
                          </div>
                        </div>
                      </details>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      <input type="checkbox" checked={!!wardrobeUploadForm.isFavorite} onChange={e => setWardrobeUploadForm(p => ({ ...p, isFavorite: e.target.checked }))} />
                      ♥ Mark as favorite
                    </label>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--lala-parchment-3)' }}>
                    <button onClick={() => setShowWardrobeUpload(false)} style={{ padding: '7px 18px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button disabled={wardrobeUploading || !wardrobeUploadFile || !wardrobeUploadForm.name || !wardrobeUploadForm.clothingCategory} onClick={async () => {
                      setWardrobeUploading(true);
                      const fd = new FormData();
                      fd.append('image', wardrobeUploadFile);
                        fd.append('name', wardrobeUploadForm.name);
                        fd.append('character', wardrobeUploadForm.character || 'Lala');
                        fd.append('clothingCategory', wardrobeUploadForm.clothingCategory);
                        if (wardrobeUploadForm.brand) fd.append('brand', wardrobeUploadForm.brand);
                        if (wardrobeUploadForm.price) fd.append('price', wardrobeUploadForm.price);
                        if (wardrobeUploadForm.color) fd.append('color', wardrobeUploadForm.color);
                        if (wardrobeUploadForm.size) fd.append('size', wardrobeUploadForm.size);
                        if (wardrobeUploadForm.description) fd.append('description', wardrobeUploadForm.description);
                        if (wardrobeUploadForm.season) fd.append('season', wardrobeUploadForm.season);
                        if (wardrobeUploadForm.occasion) fd.append('occasion', wardrobeUploadForm.occasion);
                        if (wardrobeUploadForm.tags) fd.append('tags', wardrobeUploadForm.tags);
                        if (wardrobeUploadForm.tier) fd.append('tier', wardrobeUploadForm.tier);
                        if (wardrobeUploadForm.website) fd.append('purchaseLink', wardrobeUploadForm.website);
                        if (wardrobeUploadForm.isFavorite) fd.append('isFavorite', 'true');
                        // Gameplay fields — only send when set so the backend keeps model
                        // defaults (acquisition_type='purchased', lock_type='none', etc.)
                        // for anything the creator didn't touch.
                        if (wardrobeUploadForm.coinCost) fd.append('coinCost', wardrobeUploadForm.coinCost);
                        if (wardrobeUploadForm.acquisitionType && wardrobeUploadForm.acquisitionType !== 'purchased') fd.append('acquisitionType', wardrobeUploadForm.acquisitionType);
                        if (wardrobeUploadForm.lockType && wardrobeUploadForm.lockType !== 'none') fd.append('lockType', wardrobeUploadForm.lockType);
                        if (wardrobeUploadForm.eraAlignment) fd.append('eraAlignment', wardrobeUploadForm.eraAlignment);
                        if (wardrobeUploadForm.reputationRequired) fd.append('reputationRequired', wardrobeUploadForm.reputationRequired);
                        // Advanced gameplay — CSV tag buckets are sent raw; the
                        // backend splits them. Numeric knobs only sent when set so
                        // the model defaults stay intact. `is_visible` defaults
                        // true server-side, so we only ship it when false.
                        if (wardrobeUploadForm.aestheticTags) fd.append('aestheticTags', wardrobeUploadForm.aestheticTags);
                        if (wardrobeUploadForm.eventTypes) fd.append('eventTypes', wardrobeUploadForm.eventTypes);
                        if (wardrobeUploadForm.outfitMatchWeight) fd.append('outfitMatchWeight', wardrobeUploadForm.outfitMatchWeight);
                        if (wardrobeUploadForm.influenceRequired) fd.append('influenceRequired', wardrobeUploadForm.influenceRequired);
                        if (wardrobeUploadForm.seasonUnlockEpisode) fd.append('seasonUnlockEpisode', wardrobeUploadForm.seasonUnlockEpisode);
                        fd.append('isOwned', wardrobeUploadForm.isOwned ? 'true' : 'false');
                        if (wardrobeUploadForm.isVisible === false) fd.append('isVisible', 'false');
                        if (wardrobeUploadForm.lalaReactionOwn) fd.append('lalaReactionOwn', wardrobeUploadForm.lalaReactionOwn);
                        if (wardrobeUploadForm.lalaReactionLocked) fd.append('lalaReactionLocked', wardrobeUploadForm.lalaReactionLocked);
                        if (wardrobeUploadForm.lalaReactionReject) fd.append('lalaReactionReject', wardrobeUploadForm.lalaReactionReject);
                        fd.append('showId', showId);
                        try {
                          // Multipart upload pattern v2.14 — pass FormData directly to
                          // api.post; services/api.js interceptor (lines 21-26) auto-
                          // strips JSON Content-Type so browser sets multipart boundary.
                          const data = await uploadWardrobeApi(fd);
                          setWardrobeItems(prev => [data.data, ...prev]);
                          // Only track items the server said it started processing —
                          // an item it never processes must not show a spinner.
                          if (backgroundRemovalStarted(data) && data.data?.id && !data.data.s3_url_processed) {
                            wardrobeProcessing.track(data.data.id);
                          }
                          setShowWardrobeUpload(false);
                          setToast('Item uploaded!'); setTimeout(() => setToast(null), 2500);
                        } catch (httpErr) {
                          const msg = httpErr.response?.data?.error || httpErr.message || 'Upload failed';
                          setToast('Upload failed: ' + msg);
                        }
                      setWardrobeUploading(false);
                    }} style={{ padding: '7px 22px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (wardrobeUploading || !wardrobeUploadFile || !wardrobeUploadForm.name || !wardrobeUploadForm.clothingCategory) ? 0.35 : 1 }}>
                      {wardrobeUploading ? 'Uploading...' : 'Upload Item'}
                    </button>
                  </div>
                </div>
              </div>
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
          {/* Lala */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👑</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Lala</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Main Character · AI Avatar</p>
              </div>
              {!editingStats ? (
                <button onClick={openStatEditor} disabled={!charState} style={S.secBtn}>✏️ Edit Stats</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingStats(false)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveStats} disabled={savingStats} style={S.primaryBtn}>{savingStats ? '⏳' : '💾 Save'}</button>
                </div>
              )}
            </div>

            {charState ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {Object.entries(charState.state || {}).map(([key, val]) => {
                  // Coin bar used to scale to a hardcoded 500 (the default
                  // starting balance), so it pegged at 100% for any later
                  // balance and was useless as a progress signal. Now it
                  // tracks progress toward the next financial goal when one
                  // exists; without a goal we render the value as text only
                  // (no fake bar) so it doesn't lie about being "full".
                  const isCoin = key === 'coins';
                  const goalThreshold = financeConfig?.next_goal?.threshold;
                  const barMax = isCoin ? (goalThreshold || null) : 10;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{STAT_ICONS[key]}</span>
                      <span style={{ flex: '0 0 100px', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      {editingStats ? (
                        // Coins: no min/max — the backend stores any
                        // integer and downstream logic handles negative
                        // balances. The arbitrary -9999/99999 caps used
                        // to block legitimate late-show balances. Other
                        // stats stay 0–10 to match the backend clamp.
                        <input type="number" value={statForm[key] ?? val} onChange={e => setStatForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                          style={{ width: 80, padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 14, fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}
                          {...(isCoin ? {} : { min: 0, max: 10 })} />
                      ) : (
                        <>
                          {barMax != null ? (
                            <div style={{ flex: 1, height: 10, background: 'var(--lala-parchment-2)', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (val / barMax) * 100))}%`, borderRadius: 5, background: key === 'stress' ? (val >= 5 ? 'var(--danger)' : 'var(--warning)') : isCoin ? (val < 0 ? 'var(--danger)' : 'var(--primary)') : 'var(--primary)', transition: 'width 0.3s' }} />
                            </div>
                          ) : (
                            <div style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', paddingRight: 8 }}>
                              {isCoin ? 'no active goal' : ''}
                            </div>
                          )}
                          <span style={{ flex: '0 0 60px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: (key === 'stress' && val >= 5) || (isCoin && val < 0) ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                            {isCoin ? Number(val).toLocaleString() : val}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <p style={S.muted}>No stats initialized. Evaluate an episode to auto-seed defaults.</p>}

            <div style={{ padding: 14, background: 'var(--surface-bg)', borderRadius: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Character Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(() => {
                  // Default Stats line is sourced from charState.defaults
                  // (server returns DEFAULT_STATS from evaluationFormula.js)
                  // so it stays accurate if the constants ever change. Falls
                  // back to the historical literal if the API's older.
                  const d = charState?.defaults;
                  const defaultStatsLine = d
                    ? `${(d.coins ?? 0).toLocaleString()} coins, ${d.reputation ?? 0} rep, ${d.brand_trust ?? 0} trust, ${d.influence ?? 0} inf, ${d.stress ?? 0} stress`
                    : '500 coins, 1 rep, 1 trust, 1 inf, 0 stress';
                  return [
                    ['Voice Activation', 'Required ✅'],
                    ['Idle Behaviors', 'Wave, mirror glance, inspect'],
                    ['Default Stats', defaultStatsLine],
                    ['Fail Behavior', 'Forced smile, softer voice, stress anim'],
                  ].map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</div></div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Prime */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💎</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>JustAWomanInHerPrime</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Creator Narrator</p>
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--surface-bg)', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Role', 'Narrator + Gameplay driver'],
                  ['Voice', 'Warm, strategic, luxury aspirational'],
                  ['Aliases', 'Prime:, Me:, You:'],
                  ['CTA Style', 'Confident, community-focused'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat ledger */}
          {stateHistory.length > 0 && (
            <div style={S.card}>
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
      {activeTab === 'release' && show && (
        <div style={S.content}>
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

// A toast reporting a failure: shown in red (F1).
const FAILURE_TOAST = /\b(fail(ed|ure)?|error|could not|couldn't|can't|refused|not configured)\b/i;
function isFailureToast(text) {
  return FAILURE_TOAST.test(String(text || ''));
}

// ─── Form Group helper ───
function FG({ label, value, onChange, placeholder, type = 'text', textarea, full, min, max, disabled }) {
  const style = { marginBottom: full ? 10 : 0 };
  return (
    <div style={style}>
      <label style={S.fLabel}>{label}</label>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.tArea, opacity: disabled ? 0.5 : 1 }} rows={2} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.inp, opacity: disabled ? 0.5 : 1 }} placeholder={placeholder} min={min} max={max} disabled={disabled} />
      )}
    </div>
  );
}

// ─── STYLES ───
// ─── SEASON TAB COMPONENT ───────────────────────────────────────────────────
// Planning Insights (§8(ff) A8, Q13, Q15): per slot the plan beside the
// result and its money; phase totals; the balance trend over every ledger
// row; the season-health line. Money is from the ledger, never cost_coins.
const coins = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n || 0)).toLocaleString()}`;
const signedCoins = (n) => `${n > 0 ? '+' : ''}${coins(n)}`;

function pressureNote(delta) {
  if (delta == null) return null;
  if (delta === 0) return { text: 'pressure on plan', color: '#15803d' };
  const steps = Math.abs(delta);
  return { text: `${steps} step${steps > 1 ? 's' : ''} ${delta > 0 ? 'above' : 'below'} plan`, color: '#b45309' };
}

function BalanceTrend({ trend }) {
  if (!trend || trend.length < 2) return null;
  const W = 300; const H = 60; const pad = 4;
  const values = trend.map((t) => t.balance_after);
  const min = Math.min(...values); const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / (trend.length - 1);
  const y = (v) => H - pad - ((v - min) * (H - pad * 2)) / span;
  const path = trend.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t.balance_after).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
      aria-label={`Balance trend from ${coins(values[0])} to ${coins(values[values.length - 1])}`} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="var(--lala-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {trend.map((t, i) => t.between_episodes && (
        <circle key={i} cx={x(i)} cy={y(t.balance_after)} r="2.5" fill="var(--primary)" />
      ))}
    </svg>
  );
}

function PlanningInsights({ insights, S }) {
  if (!insights) return null;
  const { health, money, phases } = insights;
  const trend = money.trend || [];
  const between = trend.filter((t) => t.between_episodes).length;
  const healthLine = health.accepted === 0
    ? 'No accepted episodes yet.'
    : `${health.in_range} of ${health.with_range} accepted episode${health.with_range === 1 ? ' landed in its' : 's landed in their'} planned outcome range`
      + (health.without_range ? ` · ${health.without_range} had no range planned` : '');
  const stat = (label, value, color) => (
    <div style={{ flex: '1 1 70px', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    </div>
  );
  return (
    <div style={S.card} data-testid="planning-insights">
      <h3 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Planning Insights</h3>
      <p style={{ ...S.muted, margin: '0 0 10px', fontSize: 12 }}>
        Each slot's plan beside what happened. Money comes from the ledger only.
      </p>
      <div data-testid="season-health" style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>
        <strong>Season health:</strong> {healthLine}
      </div>

      <div data-testid="season-money" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {stat('Income', coins(money.season.income), 'var(--success-text)')}
        {stat('Spend', coins(money.season.spend), 'var(--danger-text)')}
        {stat('Net', signedCoins(money.season.net))}
        {money.balance != null && stat('Balance', coins(money.balance), 'var(--lala-gold-text)')}
      </div>
      {trend.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <BalanceTrend trend={trend} />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Balance after each of {trend.length} ledger row{trend.length === 1 ? '' : 's'}
            {between > 0 && <> · <span style={{ color: 'var(--primary-text)' }}>●</span> {between} between episodes</>}
          </div>
        </div>
      )}

      {phases.map((p) => (
        <div key={p.phase} data-testid={`insights-phase-${p.phase}`} style={{ borderTop: '1px solid var(--lala-parchment-3)', paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Phase {p.phase}{p.title ? ` · ${p.title}` : ''}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Income {coins(p.totals.income)} · spend {coins(p.totals.spend)} · net {signedCoins(p.totals.net)}
          </div>
          {p.slots.map((sl) => {
            const pn = pressureNote(sl.pressure_delta);
            const range = sl.planned.outcome_range;
            return (
              <div key={sl.slot_number} data-testid={`insights-slot-${sl.slot_number}`} style={{ padding: '6px 0', fontSize: 12, borderTop: '1px dashed var(--lala-parchment-3)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                  {sl.label}{sl.episode ? ` · ${sl.episode.title || 'Untitled'}` : ''}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Planned: {sl.planned.desired_pressure || 'no pressure set'}{range ? ` · ${range.min === range.max ? range.min : `${range.min} to ${range.max}`}` : ''}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Actual: {sl.actual.outcome ? `${sl.actual.outcome} · ${sl.actual.pressure || '—'}` : 'not accepted yet'}
                  {pn && <span style={{ color: pn.color, fontWeight: 600 }}> · {pn.text}</span>}
                  {sl.outcome_in_range != null && (
                    <span style={{ color: sl.outcome_in_range ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}> · {sl.outcome_in_range ? 'in range' : 'outside range'}</span>
                  )}
                </div>
                {sl.money && (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Income {coins(sl.money.income)} · spend {coins(sl.money.spend)} · net {signedCoins(sl.money.net)}
                  </div>
                )}
              </div>
            );
          })}
          {p.unplanned_count > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {p.unplanned_count} slot{p.unplanned_count === 1 ? '' : 's'} with nothing planned yet
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Story threads (§8(ff) A3, A6, Q9): "you create and name them; drafts
// are offered from seeds_future_events. Acceptance can mark one
// "advanced", and only you close one."
const THREAD_STATUS = {
  open: { label: 'Open', color: 'var(--primary-text)' },
  advanced: { label: 'Advanced', color: 'var(--success-text)' },
  closed: { label: 'Closed', color: 'var(--text-secondary)' },
};

function StoryThreadsCard({ threads, drafts, S, api, showId, onChanged, setToast }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const field = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6 };

  const create = async (body, done) => {
    setBusy(true);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads`, body);
      if (setToast) setToast(done);
      if (onChanged) await onChanged();
      return true;
    } catch (err) {
      alert(err.response?.data?.error || err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (!title.trim()) return;
    if (await create({ title, description }, 'Story thread added')) { setTitle(''); setDescription(''); }
  };
  const fromDraft = async (draft) => {
    const name = window.prompt('Name this story thread', draft.seed_text.slice(0, 120));
    if (!name || !name.trim()) return;
    await create({ title: name, seed_text: draft.seed_text, episode_id: draft.episode_id }, 'Story thread added');
  };
  const close = async (thread) => {
    if (!window.confirm(`Close "${thread.title}"? A closed thread can no longer be chosen for a slot.`)) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads/${thread.id}/close`);
      if (setToast) setToast('Story thread closed');
      if (onChanged) await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  // PR 7 choice 1 (Evoni, 2026-10-01): she can reopen a closed thread, with
  // a confirm; it keeps its history.
  const reopen = async (thread) => {
    if (!window.confirm(`Reopen "${thread.title}"? It keeps its history and can be chosen for a slot again.`)) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads/${thread.id}/reopen`);
      if (setToast) setToast('Story thread reopened');
      if (onChanged) await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <div style={S.card} data-testid="story-threads">
      <h3 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Story threads</h3>
      <p style={{ ...S.muted, margin: '0 0 12px', fontSize: 12 }}>
        You create and name them; a slot's intention says which one it continues, and accepting its episode marks the thread advanced. Only you close one, and you can reopen it.
      </p>
      {threads.length === 0 && <p style={{ ...S.muted, fontSize: 12 }}>No story threads yet.</p>}
      {threads.map((t) => {
        const st = THREAD_STATUS[t.status] || THREAD_STATUS.open;
        return (
          <div key={t.id} data-testid={`story-thread-${t.id}`} style={{ padding: '8px 0', borderTop: '1px solid var(--lala-parchment-3)', display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.status === 'closed' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{t.title}</div>
              {t.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>}
              <div style={{ fontSize: 11, marginTop: 2 }}>
                <span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>
                {Array.isArray(t.slot_numbers) && t.slot_numbers.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> · in {t.slot_numbers.map((n) => `E${n}`).join(', ')}</span>}
                {t.source === 'seed' && <span style={{ color: 'var(--text-secondary)' }}> · from a seed</span>}
                {t.reopened_at && t.status !== 'closed' && <span style={{ color: 'var(--text-secondary)' }}> · reopened</span>}
              </div>
            </div>
            {t.status !== 'closed' ? (
              <button onClick={() => close(t)} disabled={busy} style={{ ...S.secBtn, padding: '4px 10px', fontSize: 12 }}>Close</button>
            ) : (
              <button onClick={() => reopen(t)} disabled={busy} style={{ ...S.secBtn, padding: '4px 10px', fontSize: 12 }}>Reopen</button>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lala-parchment-3)' }}>
        <input aria-label="New thread title" placeholder="New thread title" value={title} onChange={(e) => setTitle(e.target.value)} style={field} />
        <textarea aria-label="New thread description" placeholder="What it is about (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...field, marginTop: 6 }} />
        <button onClick={add} disabled={busy || !title.trim()} style={{ ...S.primaryBtn, marginTop: 6 }}>Add thread</button>
      </div>

      {drafts.length > 0 && (
        <div data-testid="story-thread-drafts" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lala-parchment-3)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Drafts from your episodes' seeds</div>
          {drafts.map((d) => (
            <div key={d.seed_text} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: '1 1 200px', minWidth: 0 }}>
                {d.seed_text}{d.episode_title && <span style={{ color: 'var(--text-secondary)' }}> · {d.episode_title}</span>}
              </span>
              <button onClick={() => fromDraft(d)} disabled={busy} style={{ ...S.secBtn, padding: '4px 10px', fontSize: 12 }}>Make a thread</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Season Arc roadmap (§8(ff) A2): the season's 24 slots in three phases,
// each slot showing its state, numbered "S1 · E7" (Q3). A future slot can
// have an event pencilled in, moved freely (Q5); an episode in no slot can
// be placed in an open one (Q4). A started slot is locked (A7). When every
// slot of the current phase is done, a summary asks before advancing (Q6).
const SLOT_STATE_CONFIG = {
  done:          { label: 'Done',            color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
  in_production: { label: 'In production',   color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)', border: 'var(--lala-gold-line)' },
  event_ready:   { label: 'Event ready',     color: 'var(--primary-text)', bg: 'var(--primary-subtle)', border: 'var(--primary-light)' },
  needs_event:   { label: 'Needs an event',  color: 'var(--text-secondary)', bg: 'var(--surface-bg)', border: 'var(--lala-parchment-3)' },
};

const PRESSURE_OPTIONS = ['Low', 'Medium', 'High', 'Peak'];
const OUTCOME_OPTIONS = ['fail', 'safe', 'pass', 'slay'];

// A slot's intention (§8(ff) A3): story purposes, career focus, desired
// pressure (Q7) and the outcome range hoped for (Q10). Labelled
// Auto-drafted or Edited; Draft asks before replacing an edit.
// A9: a started slot stays editable while its episode is a draft; saving
// updates the episode's season position. A10: up to three purposes, one
// primary, each optionally tied to a story thread.
const MAX_PURPOSES = 3;

function initialPurposes(init) {
  const list = Array.isArray(init.story_purposes) && init.story_purposes.length
    ? init.story_purposes.map((p) => ({ text: p.text || '', primary: Boolean(p.primary), story_thread_id: p.story_thread?.id || '' }))
    : [{ text: init.story_purpose || '', primary: true, story_thread_id: init.story_thread?.id || '' }];
  if (!list.some((p) => p.primary)) list[0].primary = true;
  return list;
}

function SlotIntentionEditor({ slot, S, api, showId, onSaved, onClose, setToast, threads = [] }) {
  const init = slot.intention || {};
  const started = Boolean(slot.episode);
  const [form, setForm] = useState({
    career_focus: init.career_focus || '',
    desired_pressure: init.desired_pressure || '',
    min: init.outcome_range?.min || '',
    max: init.outcome_range?.max || '',
  });
  const [purposes, setPurposes] = useState(() => initialPurposes(init));
  const setPurpose = (i, patch) => setPurposes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const makePrimary = (i) => setPurposes((ps) => ps.map((p, j) => ({ ...p, primary: j === i })));
  const addPurpose = () => setPurposes((ps) => (ps.length >= MAX_PURPOSES ? ps : [...ps, { text: '', primary: false, story_thread_id: '' }]));
  const removePurpose = (i) => setPurposes((ps) => {
    const next = ps.filter((_, j) => j !== i);
    if (next.length && !next.some((p) => p.primary)) next[0] = { ...next[0], primary: true };
    return next.length ? next : [{ text: '', primary: true, story_thread_id: '' }];
  });
  const [busy, setBusy] = useState(null);
  const field = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, marginTop: 4 };
  const label = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 10, display: 'block' };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy('save');
    try {
      await api.put(`/api/v1/world/${showId}/season/slots/${slot.id}/intention`, {
        story_purposes: purposes.map((p) => ({ text: p.text, primary: p.primary, story_thread_id: p.story_thread_id || null })),
        career_focus: form.career_focus,
        desired_pressure: form.desired_pressure || null,
        outcome_range: form.min || form.max ? { min: form.min || form.max, max: form.max || form.min } : null,
      });
      if (setToast) setToast(started ? `${slot.label} intention saved; the episode's season position is updated` : `${slot.label} intention saved`);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setBusy(null);
  };
  // A started slot (A9, as changed 2026-10-01) is drafted from its episode's
  // event and script, and the purposes Evoni edited are kept: no confirm.
  const draft = async () => {
    const edited = init.source === 'edited';
    if (!started && edited && !window.confirm(`${slot.label}'s intention was edited. Replace it with an AI draft?`)) return;
    setBusy('draft');
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/slots/${slot.id}/intention/draft`, !started && edited ? { force: true } : {});
      const d = res?.data?.data || res?.data || {};
      const kept = d.kept_edited || 0;
      if (setToast) {
        setToast(started
          ? `${slot.label} intention drafted from its episode${kept ? `; ${kept} edited purpose${kept === 1 ? '' : 's'} kept` : ''}${d.placed === null && kept ? ' (no room for the drafted purpose)' : ''}`
          : `${slot.label} intention drafted`);
      }
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setBusy(null);
  };

  return (
    <div data-testid="season-intention-editor" style={{ marginTop: 4, marginBottom: 16, padding: '12px 14px', border: '1px solid var(--lala-gold-line)', borderRadius: 10, background: 'var(--lala-gold-soft)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{slot.label} intention</div>
        {init.source && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{init.source === 'edited' ? 'Edited' : 'Auto-drafted'}</span>}
      </div>
      {started && (
        <div data-testid="season-intention-started" style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 6 }}>
          Started: editable while its episode is a draft. Saving updates the episode's season position; it locks once the episode is accepted. Draft with AI reads its event and script and keeps the purposes you edited.
        </div>
      )}
      <span style={label}>Story purposes (up to {MAX_PURPOSES}, one primary)</span>
      {purposes.map((p, i) => (
        <div key={i} data-testid={`season-purpose-${i}`} style={{ marginTop: 6, padding: 8, border: '1px solid var(--lala-parchment-3)', borderRadius: 8, background: 'var(--surface-card)' }}>
          <textarea aria-label={`Story purpose ${i + 1}`} value={p.text} onChange={(e) => setPurpose(i, { text: e.target.value })} rows={2} style={{ ...field, marginTop: 0 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name={`primary-${slot.id}`} aria-label={`Primary purpose ${i + 1}`} checked={p.primary} onChange={() => makePrimary(i)} /> Primary
            </label>
            <select aria-label={`Story thread ${i + 1}`} value={p.story_thread_id} onChange={(e) => setPurpose(i, { story_thread_id: e.target.value })} style={{ ...field, marginTop: 0, flex: '1 1 140px', width: 'auto' }}>
              <option value="">No story thread</option>
              {threads.filter((t) => t.status !== 'closed' || t.id === p.story_thread_id).map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.status === 'closed' ? ' (closed)' : ''}</option>
              ))}
            </select>
            {purposes.length > 1 && (
              <button type="button" onClick={() => removePurpose(i)} style={{ fontSize: 11, border: 'none', background: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}>Remove</button>
            )}
          </div>
        </div>
      ))}
      {purposes.length < MAX_PURPOSES && (
        <button type="button" data-testid="season-purpose-add" onClick={addPurpose} style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--lala-gold-text)', cursor: 'pointer' }}>
          + Add a purpose
        </button>
      )}
      <label style={label}>Career focus
        <input aria-label="Career focus" value={form.career_focus} onChange={set('career_focus')} style={field} />
      </label>
      <label style={label}>Desired pressure
        <select aria-label="Desired pressure" value={form.desired_pressure} onChange={set('desired_pressure')} style={field}>
          <option value="">Not set</option>
          {PRESSURE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <span style={label}>Outcome range hoped for</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select aria-label="Lowest outcome" value={form.min} onChange={set('min')} style={{ ...field, marginTop: 0 }}>
          <option value="">From…</option>
          {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>to</span>
        <select aria-label="Highest outcome" value={form.max} onChange={set('max')} style={{ ...field, marginTop: 0 }}>
          <option value="">To…</option>
          {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={save} disabled={!!busy} style={S.primaryBtn}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
        <button onClick={draft} disabled={!!busy} style={S.secBtn}>{busy === 'draft' ? 'Drafting...' : 'Draft with AI'}</button>
        <button onClick={onClose} disabled={!!busy} style={S.secBtn}>Close</button>
      </div>
    </div>
  );
}

const slotSelectStyle = { width: '100%', marginTop: 6, fontSize: 11, padding: '4px 6px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-primary)', minWidth: 0 };

function SeasonRoadmap({ roadmap, S, api, showId, onChanged, setToast, onAdvance, advancing, advanceWarning, onConfirmAdvance, onCancelAdvance, threads = [] }) {
  const [busySlot, setBusySlot] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  if (!roadmap) return null;
  const { phases = [], counts = {}, unslotted_episodes: unslotted = [], available_events: available = [] } = roadmap;
  const openSlots = phases.flatMap((p) => p.slots).filter((sl) => !sl.locked);

  const save = async (slotId, path, body, done) => {
    setBusySlot(slotId);
    try {
      await api.put(`/api/v1/world/${showId}/season/slots/${slotId}/${path}`, body);
      if (setToast) setToast(done);
      if (onChanged) await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setBusySlot(null);
  };
  const pencil = (slot, value) => {
    if (value === '') return;
    const eventId = value === '__clear__' ? null : value;
    save(slot.id, 'event', { event_id: eventId }, eventId ? `Pencilled into ${slot.label}` : `${slot.label} cleared`);
  };
  const place = (episode, slotId) => {
    if (!slotId) return;
    const slot = openSlots.find((sl) => sl.id === slotId);
    if (!window.confirm(`Place "${episode.title || 'this episode'}" in ${slot?.label}? The slot then locks to it.`)) return;
    save(slotId, 'episode', { episode_id: episode.id }, `Placed in ${slot?.label}`);
  };

  return (
    <div style={S.card} data-testid="season-roadmap">
      <h3 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Roadmap · Season {roadmap.season_number}</h3>
      <p style={{ ...S.muted, margin: '0 0 12px', fontSize: 12 }}>
        {roadmap.slot_count} episode slots · {Object.keys(SLOT_STATE_CONFIG).map((key) => `${counts[key] || 0} ${SLOT_STATE_CONFIG[key].label.toLowerCase()}`).join(' · ')}
      </p>

      {roadmap.phase_boundary && (() => {
        const pb = roadmap.phase_boundary;
        const outcomeText = Object.entries(pb.outcomes || {}).map(([tier, n]) => `${n} ${tier}`).join(' · ');
        return (
          <div data-testid="season-phase-boundary" style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--lala-gold-soft)', border: '1px solid var(--lala-gold-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Phase {pb.phase}: {pb.title} is complete</div>
            {outcomeText && <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>Results: {outcomeText}</div>}
            {pb.goals && (
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>
                Goals: {pb.goals.completed} of {pb.goals.total} complete{pb.goals.unmet > 0 ? `; ${pb.goals.unmet} unmet will be carried as narrative debt` : ''}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>
              {pb.next_phase
                ? `Advancing opens Phase ${pb.next_phase.phase}: ${pb.next_phase.title}${pb.next_phase.tagline ? ` (“${pb.next_phase.tagline}”)` : ''} and activates its goals.`
                : 'Advancing completes the season.'}
            </div>
            {advanceWarning ? (
              <div data-testid="season-phase-confirm" style={{ marginTop: 10, padding: '8px 10px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.5 }}>{advanceWarning.warning}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button onClick={onConfirmAdvance} disabled={advancing} style={{ ...S.primaryBtn, background: 'var(--warning-text)' }}>
                    {advancing ? 'Advancing...' : 'Confirm: advance and carry the debt'}
                  </button>
                  <button onClick={onCancelAdvance} style={S.secBtn}>Cancel</button>
                </div>
              </div>
            ) : onAdvance && (
              <button onClick={onAdvance} disabled={advancing} style={{ ...S.primaryBtn, marginTop: 10 }}>
                {advancing ? 'Advancing...' : pb.next_phase ? `Advance to Phase ${pb.next_phase.phase}` : 'Complete the season'}
              </button>
            )}
          </div>
        );
      })()}

      {phases.map((phase) => (
        <div key={phase.phase} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Phase {phase.phase} · {phase.title}
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · E{phase.episode_start}–E{phase.episode_end}</span>
          </div>
          {/* auto-fit, not auto-fill: responsive.css §12 forces auto-fill grids to one
              column under 400px, but two 130px slots fit a phone without overflow. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {phase.slots.map((slot) => {
              const cfg = SLOT_STATE_CONFIG[slot.state] || SLOT_STATE_CONFIG.needs_event;
              const what = slot.episode?.title || slot.event?.name || null;
              return (
                <div
                  key={slot.id}
                  data-testid={`season-slot-${slot.slot_number}`}
                  style={{ border: `1px solid ${cfg.border}`, background: cfg.bg, borderRadius: 10, padding: '8px 10px', minWidth: 0 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>{slot.label}</span>
                    {slot.locked && <span title="Started: locked to its episode" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Locked</span>}
                    {!slot.locked && slot.slot_number === roadmap.next_slot_number && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lala-gold-text)' }}>Next</span>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color, marginTop: 4 }}>{cfg.label}</div>
                  {what && (
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }} title={what}>
                      {what}
                    </div>
                  )}
                  {!slot.locked && (
                    <select
                      aria-label={`Pencil an event into ${slot.label}`}
                      data-testid={`season-pencil-${slot.slot_number}`}
                      value=""
                      disabled={busySlot === slot.id}
                      onChange={(e) => pencil(slot, e.target.value)}
                      style={slotSelectStyle}
                    >
                      <option value="">{slot.event ? 'Change event…' : 'Pencil an event…'}</option>
                      {available.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      {slot.event && <option value="__clear__">Clear this slot</option>}
                    </select>
                  )}
                  {slot.intention?.story_purpose && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }} data-testid={`season-slot-purpose-${slot.slot_number}`}>
                      {slot.intention.story_purpose}
                      {(slot.intention.story_purposes?.length || 0) > 1 && (
                        <span style={{ fontStyle: 'normal', color: 'var(--lala-gold-text)', fontWeight: 600 }}> +{slot.intention.story_purposes.length - 1} more</span>
                      )}
                      {slot.intention.source === 'auto-drafted' && <span style={{ fontStyle: 'normal', color: 'var(--text-secondary)' }}> · Auto-drafted</span>}
                    </div>
                  )}
                  {slot.intention?.story_thread && (
                    <div style={{ fontSize: 10, color: 'var(--primary-text)', marginTop: 4 }}>Thread: {slot.intention.story_thread.title}</div>
                  )}
                  {(slot.intention_editable ?? !slot.locked) && (
                    <button
                      data-testid={`season-intention-${slot.slot_number}`}
                      onClick={() => setEditingSlotId(editingSlotId === slot.id ? null : slot.id)}
                      style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--lala-gold-text)', cursor: 'pointer' }}
                    >
                      {slot.intention?.story_purpose ? 'Intention' : 'Add intention'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {(() => {
            const editing = phase.slots.find((sl) => sl.id === editingSlotId);
            return editing ? (
              <SlotIntentionEditor key={editing.id} slot={editing} S={S} api={api} showId={showId}
                onSaved={onChanged} onClose={() => setEditingSlotId(null)} setToast={setToast} threads={threads} />
            ) : null;
          })()}
        </div>
      ))}

      {unslotted.length > 0 && (
        <div data-testid="season-unslotted" style={{ marginTop: 4, padding: '10px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning-text)', marginBottom: 6 }}>
            Not in a slot ({unslotted.length})
          </div>
          <p style={{ fontSize: 11, color: 'var(--warning-text)', margin: '0 0 6px' }}>
            These episodes are not placed on the roadmap yet. Place one, or leave it unslotted.
          </p>
          {unslotted.map((ep) => (
            <div key={ep.id} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '4px 0' }}>
              {ep.title || 'Untitled episode'}
              <span style={{ color: 'var(--text-secondary)' }}> · {ep.evaluation_status === 'accepted' ? 'done' : (ep.status || 'draft')}</span>
              <select
                aria-label={`Place ${ep.title || 'episode'} in a slot`}
                data-testid={`season-place-${ep.id}`}
                value=""
                onChange={(e) => place(ep, e.target.value)}
                style={{ ...slotSelectStyle, maxWidth: 220, display: 'block' }}
              >
                <option value="">Place in…</option>
                {openSlots.map((sl) => <option key={sl.id} value={sl.id}>{sl.label}{sl.event ? ` (${sl.event.name})` : ''}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonTab({ showId, api, S, episodes, setToast }) {
  const [arc, setArc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [warning, setWarning] = useState(null);
  const [goals, setGoals] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [insights, setInsights] = useState(null);
  const [threadData, setThreadData] = useState({ threads: [], drafts: [] });

  // The season's 24 slots (Season Arc §8(ff) A2); reloaded alone after a
  // pencil or placement so the tab does not blank.
  const loadRoadmap = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/roadmap`);
      setRoadmap(r.data.roadmap || null);
    } catch (err) {
      console.error('Season roadmap load failed:', err);
      setRoadmap(null);
    }
    // Story threads (§8(ff) Q9)
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/threads`);
      setThreadData({ threads: r.data.threads || [], drafts: r.data.drafts || [] });
    } catch (err) {
      console.error('Story threads load failed:', err);
    }
    // Planning Insights (§8(ff) A8). The season-health score is one line in
    // it, from the slot outcome ranges (Q15); the old 1/4/2/1 grade is not read.
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/insights`);
      setInsights(r.data.insights || null);
    } catch (err) {
      console.error('Planning Insights load failed:', err);
      setInsights(null);
    }
  }, [showId]);

  const loadArc = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/v1/world/${showId}/arc`);
      setArc(r.data.arc);
    } catch { setArc(null); }

    try {
      const r = await api.get(`/api/v1/world/${showId}/goals?status=active`);
      setGoals(r.data.goals || []);
    } catch { /* skip */ }

    await loadRoadmap();

    setLoading(false);
  }, [showId, loadRoadmap]);

  useEffect(() => { loadArc(); }, [loadArc]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.post(`/api/v1/world/${showId}/arc/seed`);
      await loadArc();
      if (setToast) setToast('Season seeded');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setSeeding(false);
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const r = await api.post(`/api/v1/world/${showId}/arc/advance`);
      if (r.data.data?.needs_confirmation) {
        setWarning(r.data.data);
        setAdvancing(false);
        return;
      }
      setWarning(null);
      await loadArc();
      if (setToast) setToast('Phase advanced');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setAdvancing(false);
  };

  const handleConfirmAdvance = async () => {
    setAdvancing(true);
    try {
      await api.post(`/api/v1/world/${showId}/arc/advance/confirm`);
      setWarning(null);
      await loadArc();
      if (setToast) setToast('Phase advanced (with narrative debt)');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setAdvancing(false);
  };

  if (loading) return <div style={S.center}>Loading season data...</div>;

  // No arc seeded yet
  if (!arc) return (
    <div style={S.content}>
      <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
        <h2 style={{ ...S.cardTitle, margin: '0 0 8px' }}>No Season Set Up Yet</h2>
        <p style={S.muted}>Seed Season 1 to set up the arc structure, phases, and career goal activation.</p>
        <p style={{ ...S.muted, marginBottom: 20 }}>
          Season 1: <strong>Soft Luxury Ascension</strong> — 24 episodes, 3 phases
        </p>
        <button onClick={handleSeed} disabled={seeding} style={S.primaryBtn}>
          {seeding ? 'Seeding...' : 'Seed Season 1'}
        </button>
      </div>
    </div>
  );

  const phases = arc.phases || [];
  const currentPhase = phases.find(p => p.phase === arc.current_phase) || phases[0];
  const debt = arc.narrative_debt || [];
  const log = arc.progression_log || [];

  const TEMP_CONFIG = {
    unstoppable: { color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)', label: 'Unstoppable' },
    confident:   { color: 'var(--success-text)', bg: 'var(--success-bg)', label: 'Confident' },
    rising:      { color: 'var(--primary-text)', bg: 'var(--primary-subtle)', label: 'Rising' },
    anxious:     { color: 'var(--warning-text)', bg: 'var(--warning-bg)', label: 'Anxious' },
    desperate:   { color: 'var(--danger-text)', bg: 'var(--danger-bg)', label: 'Desperate' },
    broken:      { color: 'var(--danger-text)', bg: 'var(--danger-bg)', label: 'Broken' },
  };
  const tempCfg = TEMP_CONFIG[arc.emotional_temperature] || TEMP_CONFIG.rising;

  const PHASE_STATUS_COLORS = {
    active: { bg: 'var(--success-bg)', color: 'var(--success-text)', border: 'var(--success-border)' },
    completed: { bg: 'var(--surface-bg)', color: 'var(--text-secondary)', border: 'var(--lala-parchment-3)' },
    upcoming: { bg: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', border: 'var(--lala-gold-line)' },
  };

  // Goals grouped by phase
  const phaseGoals = (phase) => goals.filter(g => {
    const range = typeof g.episode_range === 'string' ? JSON.parse(g.episode_range) : g.episode_range;
    if (!range) return false;
    return range[0] >= phase.episode_start && range[0] <= phase.episode_end;
  });

  const completedEpisodes = episodes.filter(e => e.status === 'accepted' || e.status === 'published').length;

  return (
    <div style={S.content}>
      {/* Season Header */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ ...S.cardTitle, margin: '0 0 4px', fontSize: 18 }}>
              📖 Season 1: {arc.title}
            </h2>
            <p style={{ ...S.muted, margin: 0 }}>{arc.tagline}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: tempCfg.bg, color: tempCfg.color }}>
              {tempCfg.label}
            </span>
            <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, background: 'var(--surface-bg)', color: 'var(--text-secondary)', border: '1px solid var(--lala-parchment-3)' }}>
              Ep {arc.current_episode || 0} / {arc.episode_end}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{completedEpisodes}</div>
            <div style={S.statLbl}>Episodes Done</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{goals.filter(g => g.status === 'completed').length}</div>
            <div style={S.statLbl}>Goals Hit</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: debt.length > 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>{debt.length}</div>
            <div style={S.statLbl}>Narrative Debt</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--lala-gold-text)' }}>{arc.current_phase}</div>
            <div style={S.statLbl}>Current Phase</div>
          </div>
        </div>
      </div>

      {/* Roadmap — the season's 24 slots */}
      <SeasonRoadmap roadmap={roadmap} S={S} api={api} showId={showId} onChanged={loadRoadmap} setToast={setToast} onAdvance={handleAdvance} advancing={advancing}
        advanceWarning={warning} onConfirmAdvance={handleConfirmAdvance} onCancelAdvance={() => setWarning(null)}
        threads={threadData.threads} />

      {roadmap && (
        <StoryThreadsCard threads={threadData.threads} drafts={threadData.drafts} S={S} api={api} showId={showId}
          onChanged={loadRoadmap} setToast={setToast} />
      )}

      <PlanningInsights insights={insights} S={S} />

      {/* Phase Cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {phases.map(phase => {
          const statusCfg = PHASE_STATUS_COLORS[phase.status] || PHASE_STATUS_COLORS.upcoming;
          const pGoals = phaseGoals(phase);
          const isCurrent = phase.phase === arc.current_phase;

          return (
            <div key={phase.phase} style={{
              ...S.card,
              borderColor: isCurrent ? 'var(--lala-gold)' : statusCfg.border,
              borderWidth: isCurrent ? 2 : 1,
              borderStyle: 'solid',
              background: isCurrent ? 'var(--lala-gold-soft)' : 'var(--surface-card)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Phase {phase.phase}: {phase.title}
                    {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    &ldquo;{phase.tagline}&rdquo; &middot; Episodes {phase.episode_start}-{phase.episode_end}
                  </p>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: statusCfg.bg, color: statusCfg.color,
                }}>{phase.status}</span>
              </div>

              {/* Emotional arc */}
              {phase.emotional_arc && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <strong>Emotional arc:</strong> {phase.emotional_arc}
                </div>
              )}

              {/* Feed behavior */}
              {phase.feed_behavior && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, padding: '6px 10px', background: 'var(--surface-bg)', borderRadius: 6 }}>
                  <strong>Feed:</strong> {phase.feed_behavior.feed_tone || `Follow bias: ${phase.feed_behavior.follow_bias}`}
                  {phase.feed_behavior.event_prestige_max && <span> &middot; Max prestige: {phase.feed_behavior.event_prestige_max}</span>}
                </div>
              )}

              {/* Phase goals */}
              {pGoals.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>
                    Goals ({pGoals.filter(g => g.status === 'completed').length}/{pGoals.length} complete)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pGoals.map(g => (
                      <span key={g.id} style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: g.status === 'completed' ? 'var(--success-bg)' : g.status === 'failed' ? 'var(--danger-bg)' : g.status === 'paused' ? 'var(--surface-bg)' : 'var(--primary-subtle)',
                        color: g.status === 'completed' ? 'var(--success-text)' : g.status === 'failed' ? 'var(--danger-text)' : g.status === 'paused' ? 'var(--text-secondary)' : 'var(--primary-text)',
                        textDecoration: g.status === 'failed' ? 'line-through' : 'none',
                      }}>
                        {g.icon || '🎯'} {g.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal summary for completed phases */}
              {phase.goal_summary && phase.status === 'completed' && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  Results: {phase.goal_summary.completed} completed, {phase.goal_summary.failed} failed
                  {phase.goal_summary.carried > 0 && <span style={{ color: 'var(--danger-text)' }}>, {phase.goal_summary.carried} carried as debt</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase Controls */}
      <div style={S.card}>
        <h3 style={{ ...S.cardTitle, margin: '0 0 12px' }}>Phase Controls</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleAdvance} disabled={advancing} style={S.primaryBtn}>
            {advancing ? 'Advancing...' : `Advance to Phase ${arc.current_phase + 1}`}
          </button>
        </div>
        <p style={{ ...S.muted, marginTop: 8, fontSize: 11 }}>
          Advancing will finalize current phase goals and activate the next phase. You&apos;ll get a warning if goals are incomplete.
        </p>
      </div>

      {/* Warning Modal */}
      {warning && (
        <div style={{ ...S.card, borderColor: 'var(--warning)', borderWidth: 2, borderStyle: 'solid', background: 'var(--warning-bg)' }}>
          <h3 style={{ ...S.cardTitle, margin: '0 0 8px', color: 'var(--warning-text)' }}>⚠️ Advance Warning</h3>
          <p style={{ fontSize: 13, color: 'var(--warning-text)', margin: '0 0 12px', lineHeight: 1.5 }}>
            {warning.warning}
          </p>
          {warning.goal_status?.goals?.filter(g => g.status === 'active' || g.type === 'primary').length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {warning.goal_status.goals.filter(g => g.status !== 'completed').map((g, i) => (
                <div key={i} style={{ padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 6, marginBottom: 4, fontSize: 12, color: 'var(--warning-text)' }}>
                  {g.icon} <strong>{g.title}</strong> — {g.current_value}/{g.target_value} {g.target_metric}
                  {g.type === 'primary' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--danger-text)' }}>PRIMARY</span>}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--warning-text)', margin: '0 0 12px' }}>
            Advancing will mark incomplete goals as <strong>narrative debt</strong> — emotional weight that affects scripts, feed, and events.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConfirmAdvance} disabled={advancing} style={{ ...S.primaryBtn, background: 'var(--warning-text)' }}>
              {advancing ? 'Advancing...' : 'Advance Anyway'}
            </button>
            <button onClick={() => setWarning(null)} style={S.secBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Narrative Debt */}
      {debt.length > 0 && (
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, margin: '0 0 12px', color: 'var(--danger-text)' }}>
            Narrative Debt ({debt.length})
          </h3>
          <p style={{ ...S.muted, marginBottom: 12 }}>
            Failed goals that carry emotional weight. These feed into AI-generated scripts, feed posts, and event stakes.
          </p>
          {debt.map((d, i) => (
            <div key={i} style={{
              padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger-text)', marginBottom: 4 }}>
                {d.goal_title} <span style={{ fontWeight: 400, fontSize: 11 }}>({d.achieved}/{d.target} {d.target_metric})</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--danger-text)', fontStyle: 'italic' }}>
                {d.narrative_weight}
              </div>
              <div style={{ fontSize: 10, color: 'var(--danger-text)', marginTop: 4 }}>
                From Phase: {d.phase} &middot; Affects: {(d.affects || []).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progression Log */}
      {log.length > 0 && (
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, margin: '0 0 12px' }}>Progression Log</h3>
          {log.slice().reverse().map((entry, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 0', borderBottom: i < log.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
            }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: entry.triggered_by === 'manual' ? 'var(--warning-bg)' : 'var(--primary-subtle)',
                color: entry.triggered_by === 'manual' ? 'var(--warning-text)' : 'var(--primary-text)',
                flexShrink: 0,
              }}>{entry.triggered_by}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{entry.trigger_reason}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                  {entry.goals_carried > 0 && <span style={{ color: 'var(--danger-text)' }}> &middot; {entry.goals_carried} goals carried</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const S = {
  // Producer Mode's chrome, in the studio theme's tokens (audit VISUAL-01,
  // batch 4): one token edit recolors every tab, card and button here.
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: 'var(--font-sans)' },
  center: { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  backLink: { color: 'var(--primary-text)', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 },
  // Soft pink accents, as on the episode page (Evoni, 2026-10-05): the tab
  // row's rule, the cards' top edge and border, the header's teal-to-pink
  // line and the context bar (WorldAdmin.css). Actions and the active tab
  // stay teal; pink is never under text here.
  content: { display: 'flex', flexDirection: 'column', gap: 16, animation: 'waFadeIn 0.2s ease' },
  card: { background: 'var(--surface-card)', border: '1px solid var(--accent-subtle)', borderTop: '2px solid var(--accent-light)', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' },
  muted: { color: 'var(--text-muted)', fontSize: 13 },
  primaryBtn: { padding: '8px 18px', background: 'var(--lala-lavender)', border: 'none', borderRadius: 8, color: 'var(--text-inverse)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.15s' },
  secBtn: { padding: '8px 18px', background: 'var(--surface-bg)', border: '1px solid var(--primary-subtle)', borderRadius: 8, color: 'var(--primary-text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  smBtn: { padding: '5px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.12s' },
  smBtnDanger: { padding: '5px 12px', background: 'rgba(220,53,53,0.05)', border: '1px solid rgba(220,53,53,0.12)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--danger)', fontWeight: 500, transition: 'all 0.12s' },
  // Overflow-menu item (Task #1648's per-card and header "⋯" menus —
  // WorldAdmin.jsx's own style, not shared with any other page).
  menuItem: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--lala-parchment-2)', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' },
  // Marks a card's venue/date value resolved from the saved automation
  // copy rather than the event's own column (Task #1656) — same meaning
  // as EventPackagePage.css's .epp-saved-copy, kept inline here since this
  // file has no shared stylesheet of its own.
  savedCopyTag: { display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', background: 'var(--lala-gold-soft)', border: '1px solid var(--lala-gold-line)', color: 'var(--lala-gold-text)', verticalAlign: 'middle' },
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statBox: { flex: '1 1 90px', background: 'var(--surface-card)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', minWidth: 90, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  statVal: (k, v) => ({ fontSize: 24, fontWeight: 700, color: (k === 'stress' && v >= 5) || (k === 'coins' && v < 0) ? 'var(--danger)' : 'var(--text-primary)' }),
  statLbl: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 4, fontWeight: 500 },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  qBox: { background: 'var(--surface-card)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  qVal: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  qLbl: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4, fontWeight: 500, letterSpacing: '0.3px' },
  tHead: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px' },
  tRow: { display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', fontSize: 13, transition: 'background 0.1s' },
  tCol: { flex: 1, minWidth: 0 },
  empty: { padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 },
  tierPill: (t) => ({ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: TIER_BG[t], color: TIER_TEXT[t] }),
  statusPill: (s) => {
    const cfg = EVENT_STATUS_CONFIG[s] || EVENT_STATUS_CONFIG.draft;
    return { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color };
  },
  sourceBadge: (s) => ({ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: s === 'override' ? 'var(--warning-bg)' : s === 'manual' ? 'var(--danger-bg)' : 'var(--primary-subtle)', color: s === 'override' ? 'var(--warning-text)' : s === 'manual' ? 'var(--danger)' : 'var(--primary-text)' }),
  deltaBadge: (v) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: v > 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: v > 0 ? 'var(--success)' : 'var(--danger)' }),
  toastOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' },
  toastBox: { padding: '20px 40px', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', background: 'var(--text-primary)', color: 'var(--surface-bg)', borderRadius: 14, fontSize: 14, fontWeight: 700, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', textAlign: 'center', animation: 'waFadeIn 0.3s ease', pointerEvents: 'auto' },
  toastBoxFailed: { background: 'var(--danger)', boxShadow: '0 12px 40px rgba(180,35,24,0.35)' },
  eTag: { padding: '2px 8px', background: 'var(--primary-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--primary-text)', fontWeight: 500 },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', boxSizing: 'border-box', transition: 'border-color 0.15s', outline: 'none' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-card)', transition: 'border-color 0.15s' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
};

// ─── OPPORTUNITIES TAB COMPONENT ─────────────────────────────────────────────
function OpportunitiesTab({ showId, api, S, setToast, loadData }) {
  const [opps, setOpps] = useState([]);
  const [oppLoading, setOppLoading] = useState(true);
  const [oppForm, setOppForm] = useState(null);
  const OPP_TYPES = ['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'podcast', 'interview', 'award_show'];
  const OPP_STATUS_COLORS = { offered: '#f59e0b', considering: '#6366f1', negotiating: '#8b5cf6', booked: '#22c55e', preparing: '#3b82f6', active: '#16a34a', completed: '#059669', paid: '#0d9488', declined: '#94a3b8', cancelled: '#dc2626', archived: '#666' };

  useEffect(() => {
    api.get(`/api/v1/opportunities/${showId}`).then(r => { setOpps(r.data.opportunities || []); setOppLoading(false); }).catch(() => setOppLoading(false));
  }, [showId]);

  const createOpp = async () => {
    if (!oppForm?.name) return;
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}`, oppForm);
      if (res.data.success) { setOpps(prev => [res.data.opportunity, ...prev]); setOppForm(null); setToast('Opportunity created'); }
    } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
  };

  const advanceOpp = async (opp, toStatus) => {
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}/${opp.id}/advance`, { to_status: toStatus });
      if (res.data.success) { setOpps(prev => prev.map(o => o.id === opp.id ? res.data.opportunity : o)); setToast(`${opp.name} → ${toStatus}`); }
    } catch (err) { setToast(err.response?.data?.error || 'Failed'); }
  };

  const toEvent = async (opp) => {
    try {
      setToast(`Scheduling "${opp.name}" as event...`);
      const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
      if (res.data.success) {
        setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, event_id: res.data.data.event_id, status: 'booked' } : o));
        loadData();
        setToast(`"${opp.name}" scheduled — event created with ${res.data.data.guests || 0} guests`);
      }
    } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
  };

  const pipeline = {};
  opps.forEach(o => { const s = o.status || 'offered'; if (!pipeline[s]) pipeline[s] = []; pipeline[s].push(o); });
  const totalValue = opps.reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);
  const bookedValue = opps.filter(o => ['booked','preparing','active','completed','paid'].includes(o.status)).reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Opportunities</h2>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{opps.length} total · ${bookedValue.toLocaleString()} booked · ${totalValue.toLocaleString()} pipeline</div>
        </div>
        <button onClick={() => setOppForm({ name: '', opportunity_type: 'modeling', category: 'fashion', prestige: 5, payment_amount: 0 })} style={S.primaryBtn}>+ New Opportunity</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['offered','considering','negotiating','booked','preparing','active','completed','paid'].map(s => {
          const count = pipeline[s]?.length || 0;
          if (!count) return null;
          return <span key={s} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: OPP_STATUS_COLORS[s] + '20', color: OPP_STATUS_COLORS[s] }}>{s}: {count}</span>;
        })}
      </div>
      {oppForm && (
        <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>New Opportunity</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={S.fLabel}>Name</label><input value={oppForm.name} onChange={e => setOppForm({ ...oppForm, name: e.target.value })} placeholder="Velour Magazine Cover" style={S.sel} /></div>
            <div><label style={S.fLabel}>Type</label><select value={oppForm.opportunity_type} onChange={e => setOppForm({ ...oppForm, opportunity_type: e.target.value })} style={S.sel}>{OPP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label style={S.fLabel}>Category</label><select value={oppForm.category} onChange={e => setOppForm({ ...oppForm, category: e.target.value })} style={S.sel}>{['fashion','beauty','lifestyle','luxury','entertainment','media'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={S.fLabel}>Brand</label><input value={oppForm.brand_or_company || ''} onChange={e => setOppForm({ ...oppForm, brand_or_company: e.target.value })} style={S.sel} /></div>
            <div><label style={S.fLabel}>Payment</label><input type="number" value={oppForm.payment_amount || 0} onChange={e => setOppForm({ ...oppForm, payment_amount: parseInt(e.target.value) || 0 })} style={S.sel} /></div>
            <div><label style={S.fLabel}>Prestige</label><input type="number" min={1} max={10} value={oppForm.prestige || 5} onChange={e => setOppForm({ ...oppForm, prestige: parseInt(e.target.value) || 5 })} style={S.sel} /></div>
            <div><label style={S.fLabel}>Season</label><input value={oppForm.season || ''} onChange={e => setOppForm({ ...oppForm, season: e.target.value })} placeholder="FW26" style={S.sel} /></div>
          </div>
          <div style={{ marginBottom: 8 }}><label style={S.fLabel}>Narrative Stakes</label><textarea value={oppForm.narrative_stakes || ''} onChange={e => setOppForm({ ...oppForm, narrative_stakes: e.target.value })} rows={2} placeholder="Why this matters..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} /></div>
          <div style={{ display: 'flex', gap: 6 }}><button onClick={createOpp} style={S.primaryBtn}>Create</button><button onClick={() => setOppForm(null)} style={S.smBtn}>Cancel</button></div>
        </div>
      )}
      {oppLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opps.map(opp => {
            const sc = OPP_STATUS_COLORS[opp.status] || '#999';
            const NEXT = { offered: 'considering', considering: 'negotiating', negotiating: 'booked', booked: 'preparing', preparing: 'active', active: 'completed', completed: 'paid' };
            return (
              <div key={opp.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${sc}`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{opp.name}</div>
                    <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: sc + '20', color: sc, fontWeight: 600, fontSize: 10 }}>{opp.status}</span>
                      <span>{opp.opportunity_type?.replace(/_/g, ' ')}</span>
                      {opp.brand_or_company && <span>{opp.brand_or_company}</span>}
                    </div>
                  </div>
                  {parseFloat(opp.payment_amount) > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>${parseFloat(opp.payment_amount).toLocaleString()}</div>}
                </div>
                {opp.narrative_stakes && <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{opp.narrative_stakes}</div>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {NEXT[opp.status] && <button onClick={() => advanceOpp(opp, NEXT[opp.status])} style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${sc}`, background: 'transparent', color: sc, fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>Advance to {NEXT[opp.status]}</button>}
                  {opp.status === 'offered' && <button onClick={() => advanceOpp(opp, 'declined')} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>Decline</button>}
                  {!opp.event_id && ['offered','considering','negotiating','booked','preparing','active'].includes(opp.status) && (
                    <button onClick={() => toEvent(opp)} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>📅 Schedule as Event</button>
                  )}
                  {opp.event_id && <span style={{ fontSize: 9, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', borderRadius: 4, fontWeight: 600 }}>✓ Event scheduled</span>}
                </div>
              </div>
            );
          })}
          {opps.length === 0 && !oppForm && (
            <div style={{ textAlign: 'center', padding: 30, background: '#FAF7F0', borderRadius: 12, border: '1px solid #e8e0d0' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>💼</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No opportunities yet</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Modeling gigs, runway shows, magazine covers — they start here.</div>
              <button onClick={() => setOppForm({ name: '', opportunity_type: 'modeling', category: 'fashion', prestige: 5, payment_amount: 0 })} style={S.primaryBtn}>+ Create First Opportunity</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorldAdmin;
