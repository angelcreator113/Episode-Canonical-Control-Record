/**
 * WorldAdmin v2 — Producer Mode Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * 7 Tabs:
 *   1. Overview — Stats, tier distribution, canon timeline
 *   2. Episode Ledger — All episodes with tier/score/deltas
 *   3. Events Library — Reusable event catalog (create, edit, inject)
 *   4. Career Goals — Track progression goals
 *   5. Wardrobe — Tier cards, filters, item grid with Lala reactions
 *   6. Characters — View/edit Lala stats, character rules, stat ledger
 *   7. Decision Log — Training data from creative decisions
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SLOT_KEYS, SLOT_DEFS, SLOT_SUBCATEGORIES, getSlotForCategory, groupItemsBySlot } from '../lib/wardrobeSlots';
import { InvitationButton, InvitationStyleFields } from '../components/InvitationGenerator';
import OverlayApprovalPanel from '../components/OverlayApprovalPanel';
import { EventInvitePreview } from './feed/FeedEnhancements';
import './WorldAdmin.css';

const SocialProfileGenerator = lazy(() => import('./SocialProfileGenerator'));
const SceneSetsTab = lazy(() => import('./SceneSetsTab'));
const UIOverlaysTab = lazy(() => import('./UIOverlaysTab'));
const ProductionOverlaysTab = lazy(() => import('./ProductionOverlaysTab'));

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
const TIER_COLORS = { slay: '#FFD700', pass: '#22c55e', safe: '#eab308', fail: '#dc2626' };
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
  deadline_type: 'medium', dress_code: '', dress_code_keywords: [], location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
  is_paid: 'no', payment_amount: 0, career_tier: 1,
  career_milestone: '', fail_consequence: '', success_unlock: '',
  requirements: {}, scene_set_id: null,
  venue_name: '', venue_address: '', event_date: '', event_time: '',
  theme: '', color_palette: [], mood: '', floral_style: '', border_style: '',
};

// ─── DIFFICULTY SCORING ───
function calcDifficulty(ev) {
  const p = ev.prestige || 5;
  const s = ev.strictness || 5;
  const dressComplexity = (ev.dress_code_keywords?.length || 0) * 0.5;
  const deadlineWeight = { none: 0, low: 1, medium: 2, high: 3, tonight: 4, urgent: 5 }[ev.deadline_type] || 2;
  const raw = (p * 0.35) + (s * 0.3) + (deadlineWeight * 0.2) + (dressComplexity * 0.15);
  return Math.min(10, Math.max(1, Math.round(raw * 10) / 10));
}

function difficultyLabel(score) {
  if (score <= 3) return { text: 'Easy', color: '#16a34a', bg: '#f0fdf4' };
  if (score <= 5) return { text: 'Medium', color: '#b45309', bg: '#fef3c7' };
  if (score <= 7) return { text: 'Hard', color: '#dc2626', bg: '#fef2f2' };
  return { text: 'Extreme', color: '#7c3aed', bg: '#faf5ff' };
}

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

const TABS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'episodes', icon: '📺', label: 'Episodes', subs: [
    { key: 'season', label: 'Season Arc' },
    { key: 'episodes-ledger', label: 'Episode Ledger' },
  ]},
  { key: 'feed', icon: '🎭', label: 'Feed & Events', subs: [
    { key: 'feed-timeline', label: "Lala's Feed" },
    { key: 'feed-events', label: 'Feed Events' },
    { key: 'events', label: 'Events Library' },
  ]},
  { key: 'wardrobe', icon: '🎬', label: 'Assets', subs: [
    { key: 'scene-sets', label: 'Scene Sets' },
    { key: 'overlays-tab', label: "Lala's Phone" },
    { key: 'production-overlays', label: 'UI Overlays' },
    { key: 'wardrobe-items', label: 'Wardrobe' },
    { key: 'goals', label: 'Career Goals' },
  ]},
  { key: 'characters', icon: '👑', label: 'Characters', subs: [
    { key: 'characters-list', label: 'Character Stats' },
    { key: 'decisions', label: 'Decision Log' },
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
  const [decisions, setDecisions] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [sceneSets, setSceneSets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
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
  const [outfitOptions, setOutfitOptions] = useState([]);
  const [outfitSelected, setOutfitSelected] = useState(new Set());
  const [outfitSaving, setOutfitSaving] = useState(false);
  const [outfitScore, setOutfitScore] = useState(null);
  const [wardrobeUploading, setWardrobeUploading] = useState(false);
  const [wardrobeAnalyzing, setWardrobeAnalyzing] = useState(false);
  // Inline error banner for the auto-fill button. Replaces the old alert()
  // which users were dismissing without reading, making failures look silent.
  const [wardrobeAutoFillError, setWardrobeAutoFillError] = useState(null);
  const [wardrobeUploadFile, setWardrobeUploadFile] = useState(null);
  const [wardrobeUploadPreview, setWardrobeUploadPreview] = useState(null);
  const [wardrobeUploadForm, setWardrobeUploadForm] = useState({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: false, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' });
  // Reset the auto-fill error whenever the modal is closed or the file is
  // swapped out — stale error text against a different image would be confusing.
  useEffect(() => {
    if (!showWardrobeUpload || !wardrobeUploadFile) setWardrobeAutoFillError(null);
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
  const [wardrobeTopTab, setWardrobeTopTab] = useState('all'); // all | staging
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
      'episodes': ['episodes', 'episodes-ledger'],
      'feed': ['feed', 'feed-timeline'],
      'feed-events': ['feed', 'feed-events'],
      'events': ['feed', 'events'],
      'scene-sets': ['wardrobe', 'scene-sets'],
      'overlays': ['wardrobe', 'overlays-tab'],
      'overlays-tab': ['wardrobe', 'overlays-tab'],
      'production-overlays': ['wardrobe', 'production-overlays'],
      'goals': ['wardrobe', 'goals'],
      'wardrobe': ['wardrobe', 'scene-sets'],
      'characters': ['characters', 'characters-list'],
      'decisions': ['characters', 'decisions'],
    };
    return oldToNew[tab] || [tab, null];
  };

  // On mount, resolve initial tab
  useEffect(() => {
    const [main, sub] = resolveTab(initialTab);
    if (main !== initialTab) {
      setActiveTab(main);
      if (sub) setSubTab(sub);
    }
  }, []);

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
  const [eventDetailModal, setEventDetailModal] = useState(null);
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
  const [financeEditorOpen, setFinanceEditorOpen] = useState(false);
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
  // Auto-Reorder previews its plan before touching the DB. null = no
  // preview open; otherwise an array of { ep, current, proposed, changed }.
  const [reorderPlan, setReorderPlan] = useState(null);
  const [reorderApplying, setReorderApplying] = useState(false);
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
  }, [eventDetailModal?.id, eventDetailModal?.outfit_pieces, showId, financeConfig?.current_balance]);

  // Escape key closes modals
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') { setEventDetailModal(null); setShowTemplates(false); } };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => { setSuccessMsg(null); setLastGeneratedEpisodeId(null); }, 5000); return () => clearTimeout(t); }
  }, [successMsg]);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const results = await Promise.allSettled([
        api.get(`/api/v1/shows/${showId}`).then(r => setShow(r.data)).catch(() => setShow({ id: showId, title: 'Show' })),
        api.get(`/api/v1/characters/lala/state?show_id=${showId}`).then(r => setCharState(r.data)).catch(() => {}),
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(r => {
          const list = r.data?.episodes || r.data?.data || r.data || [];
          setEpisodes(Array.isArray(list) ? list : []);
        }).catch(() => setEpisodes([])),
        api.get(`/api/v1/world/${showId}/history`).then(r => setStateHistory(r.data?.history || [])).catch(() => setStateHistory([])),
        api.get(`/api/v1/world/${showId}/decisions`).then(r => setDecisions(r.data?.decisions || [])).catch(() => setDecisions([])),
        api.get(`/api/v1/world/${showId}/events`).then(r => { console.log('[LoadData] Events loaded:', r.data?.events?.length || 0); setWorldEvents(r.data?.events || []); }).catch(err => { console.error('[LoadData] Events load FAILED:', err.response?.status, err.response?.data || err.message); setWorldEvents([]); }),
        api.get(`/api/v1/scene-sets?show_id=${showId}&limit=50`).then(r => setSceneSets(r.data?.data || [])).catch(() => setSceneSets([])),
        api.get(`/api/v1/ui-overlays/${showId}`).then(r => setOverlayData(r.data?.data || [])).catch(() => setOverlayData([])),
        api.get(`/api/v1/world/${showId}/goals`).then(r => setGoals(r.data?.goals || [])).catch(() => setGoals([])),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`).then(r => setWardrobeItems(r.data?.data || [])).catch(() => setWardrobeItems([])),
        api.get(`/api/v1/opportunities/${showId}`).then(r => setOpportunities(r.data?.opportunities || [])).catch(() => setOpportunities([])),
        api.get('/api/v1/world/locations').then(r => setWorldLocations(r.data?.locations || [])).catch(() => setWorldLocations([])),
      ]);
      // Show error only if ALL calls failed (not just some timeouts)
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length === results.length) {
        setError('Unable to connect to server. Please try refreshing.');
      }
    } finally { setLoading(false); }
  };

  // ─── EVENT CRUD ───
  const openNewEvent = () => { setEventForm({ ...EMPTY_EVENT }); setEditingEvent('new'); };
  const openEditEvent = (ev) => {
    setEventForm({
      ...EMPTY_EVENT, ...ev,
      is_paid: ev.is_free ? 'free' : ev.is_paid ? 'yes' : 'no',
      dress_code_keywords: Array.isArray(ev.dress_code_keywords) ? ev.dress_code_keywords : [],
      color_palette: Array.isArray(ev.color_palette) ? ev.color_palette : [],
    });
    setEditingEvent(ev.id);
  };

  const saveEvent = async () => {
    setSavingEvent(true); setError(null);
    try {
      const submitData = {
        ...eventForm,
        is_paid: eventForm.is_paid === 'yes',
        is_free: eventForm.is_paid === 'free',
        cost_coins: eventForm.is_paid === 'free' ? 0 : eventForm.cost_coins,
        dress_code_keywords: Array.isArray(eventForm.dress_code_keywords)
          ? eventForm.dress_code_keywords
          : (eventForm.dress_code_keywords || '').split(',').map(k => k.trim()).filter(Boolean),
      };
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
        const res = await api.put(`/api/v1/world/${showId}/events/${editingEvent}`, submitData);
        if (res.data.success) { setWorldEvents(p => p.map(e => e.id === editingEvent ? res.data.event : e)); setEditingEvent(null); setSuccessMsg('Event updated!'); }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
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
    } catch { setToast('Failed to swap'); setTimeout(() => setToast(null), 3000); }
  };

  // Auto-reorder all events by prestige ascending
  // Build a preview of the prestige-low-to-high reassignment without
  // touching anything. The previous version went straight to a confirm()
  // and silently overwrote curated assignments — this surfaces every
  // change so the user can back out before committing.
  const handleAutoReorder = () => {
    const linked = worldEvents.filter(ev => ev.used_in_episode_id);
    if (linked.length === 0) {
      setToast('No linked events to reorder'); setTimeout(() => setToast(null), 3000); return;
    }
    const sortedByPrestige = [...linked].sort((a, b) => (a.prestige || 0) - (b.prestige || 0));
    const sortedEps = [...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

    const plan = sortedEps.map((ep, i) => {
      const current = worldEvents.find(ev => ev.used_in_episode_id === ep.id) || null;
      const proposed = sortedByPrestige[i] || null;
      return {
        ep,
        current,
        proposed,
        changed: (current?.id || null) !== (proposed?.id || null),
      };
    });
    setReorderPlan(plan);
  };

  const applyReorderPlan = async () => {
    if (!reorderPlan) return;
    const changes = reorderPlan.filter(p => p.changed && p.proposed);
    if (changes.length === 0) { setReorderPlan(null); return; }
    setReorderApplying(true);
    try {
      for (const p of changes) {
        await api.post(`/api/v1/world/${showId}/events/${p.proposed.id}/inject`, { episode_id: p.ep.id });
      }
      setToast(`✅ Reordered ${changes.length} event${changes.length === 1 ? '' : 's'} by prestige`);
      setTimeout(() => setToast(null), 3000);
      setReorderPlan(null);
      loadData();
    } catch (err) {
      setToast(`Reorder failed: ${err.response?.data?.error || err.message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setReorderApplying(false);
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
    } catch { setToast('Merge failed'); setTimeout(() => setToast(null), 3000); }
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

      const res = await api.put(`/api/v1/world/${showId}/events/${ev.id}`, { ...ev, ...updates });
      if (res.data.success) {
        const nextEvents = worldEvents.map(e => e.id === ev.id ? res.data.event : e);
        setWorldEvents(nextEvents);
        setAiFixSuggestions(prev => prev.filter(s => s !== suggestion));
        flash(checkWarningCleared(suggestion, nextEvents)
          || `Applied: ${suggestion.suggestion.slice(0, 60)}`);
      }
    } catch (err) {
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

  // ── Event status pipeline ──
  const advanceEventStatus = async (ev) => {
    const currentIdx = EVENT_STATUSES.indexOf(ev.status || 'draft');
    const nextStatus = EVENT_STATUSES[Math.min(currentIdx + 1, EVENT_STATUSES.length - 1)];
    try {
      const res = await api.put(`/api/v1/world/${showId}/events/${ev.id}`, { status: nextStatus });
      if (res.data.success) {
        setWorldEvents(prev => prev.map(e => e.id === ev.id ? { ...e, ...res.data.event, status: nextStatus } : e));
        setToast(`${ev.name} → ${EVENT_STATUS_CONFIG[nextStatus]?.label}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {}
  };

  // ── Bulk AI Enhance ──
  const handleBulkEnhance = async () => {
    const drafts = worldEvents.filter(ev => !ev.description || !ev.narrative_stakes || !ev.host);
    if (drafts.length === 0) { setToast('All events already enhanced'); setTimeout(() => setToast(null), 3000); return; }
    if (!window.confirm(`Enhance ${drafts.length} incomplete events with AI? This may take a minute.`)) return;
    setAiFixLoading(true);
    let enhanced = 0;
    for (const ev of drafts.slice(0, 10)) {
      try {
        const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
          warnings: [{ msg: `ENHANCE: Fill empty fields for "${ev.name}" (${ev.event_type}, prestige ${ev.prestige}). Return action "enhance" with new_value JSON including host, description, narrative_stakes, career_milestone, fail_consequence, success_unlock, location_hint, dress_code_keywords.` }],
          events: [ev], episodes,
        });
        const data = res.data?.data?.[0]?.new_value;
        if (data) {
          const parsed = typeof data === 'object' ? data : JSON.parse(data);
          const toSave = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (v && !ev[k]) toSave[k] = v;
          }
          if (Object.keys(toSave).length > 0) {
            await api.put(`/api/v1/world/${showId}/events/${ev.id}`, toSave);
            enhanced++;
          }
        }
      } catch {}
    }
    setAiFixLoading(false);
    setToast(`✨ Enhanced ${enhanced} events`);
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
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, { episode_id: episodeId });
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

  const injectEvent = async (eventId, episodeId) => {
    setInjecting(true); setInjectError(null); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/inject`, { episode_id: episodeId });
      if (res.data.success) {
        const ep = episodes.find(e => e.id === episodeId);
        const epLabel = ep ? `${ep.episode_number || '?'}. ${ep.title || 'Untitled'}` : 'episode';
        const msg = `✅ Injected into ${epLabel}`;
        setSuccessMsg(msg);
        // Show inline success in the inject panel briefly
        setInjectSuccess({ eventId, message: msg });
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
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, { episode_id: episodeId });
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
      {/* ─── HEADER ─── */}
      <div className="wa-header" style={S.header}>
        <div>
          <h1 style={S.title}>🌍 Producer Mode</h1>
          <p style={S.subtitle}>{show?.title || 'Show'} — World Rules &amp; Canon</p>
        </div>
        <button onClick={loadData} style={S.refreshBtn}>🔄 Refresh</button>
      </div>

      {error && <div style={S.errorBanner}>{error}<button onClick={() => setError(null)} style={S.xBtn}>✕</button></div>}
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
      <div className="wa-tab-bar" style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)} style={activeTab === t.key ? S.tabActive : S.tab}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {/* ─── SUB-TABS ─── */}
      {(() => {
        const currentTab = TABS.find(t => t.key === activeTab);
        if (!currentTab?.subs) return null;
        return (
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            {currentTab.subs.map(s => (
              <button key={s.key} onClick={() => { setSubTab(s.key); setSearchParams({ tab: s.key }); }} style={{
                padding: '6px 14px', background: 'transparent', border: 'none',
                borderBottom: subTab === s.key ? '2px solid #6366f1' : '2px solid transparent',
                color: subTab === s.key ? '#6366f1' : '#94a3b8',
                fontSize: 12, fontWeight: subTab === s.key ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ════════════════════════ OVERVIEW ════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          <div style={{ ...S.card, background: 'linear-gradient(135deg, #fff 0%, #FAF7F0 100%)', borderColor: 'rgba(184,150,46,0.12)' }}>
            <h2 style={{ ...S.cardTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>👑</span> Lala's Current State
            </h2>
            {charState ? (
              <div style={S.statsRow}>
                {Object.entries(charState.state || {}).map(([k, v]) => (
                  <div key={k} style={{ ...S.statBox, background: 'linear-gradient(135deg, #fff 0%, #FDFCF9 100%)' }}>
                    <div style={{ fontSize: 26, marginBottom: 4 }}>{STAT_ICONS[k]}</div>
                    <div style={S.statVal(k, v)}>{v}</div>
                    <div style={S.statLbl}>{k.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            ) : <p style={S.muted}>No state yet. Evaluate an episode to initialize.</p>}
          </div>

          {/* Production Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { v: episodes.length, l: 'Episodes', icon: '📺', color: '#6366f1' },
              { v: worldEvents.filter(e => e.status === 'ready').length, l: 'Events Ready', icon: '📅', color: '#22c55e' },
              { v: worldEvents.filter(e => e.status === 'used').length, l: 'Events Used', icon: '✓', color: '#059669' },
              { v: opportunities.filter(o => !['archived','declined','expired'].includes(o.status)).length, l: 'Active Opps', icon: '💼', color: '#B8962E' },
              { v: wardrobeItems.length, l: 'Wardrobe', icon: '👗', color: '#ec4899' },
              { v: sceneSets.length, l: 'Locations', icon: '📍', color: '#8b5cf6' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.v}</div>
                <div style={{ fontSize: 10, color: '#888', fontFamily: "'DM Mono', monospace" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          {(() => {
            const noEvents = worldEvents.filter(e => e.status === 'ready').length === 0;
            const noWardrobe = wardrobeItems.length === 0;
            const noEpisodes = episodes.length === 0;
            const steps = [];
            if (noWardrobe) steps.push({ text: 'Upload wardrobe pieces', action: () => setActiveTab('wardrobe'), icon: '👗' });
            if (noEvents) steps.push({ text: 'Create events from feed', action: () => setActiveTab('feed-events'), icon: '📅' });
            if (!noEvents && noEpisodes) steps.push({ text: 'Generate first episode from an event', action: () => setActiveTab('events'), icon: '🎬' });
            if (steps.length === 0) return null;
            return (
              <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>Next Steps</div>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }} onClick={s.action}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, color: '#2C2C2C', fontWeight: 500 }}>{s.text}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#B8962E', fontWeight: 600 }}>→</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {Object.keys(tierCounts).length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏆 Tier Distribution</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                {['slay', 'pass', 'safe', 'fail'].map(tier => (
                  <div key={tier} style={{ flex: 1, padding: 14, borderRadius: 10, textAlign: 'center', background: TIER_COLORS[tier] + '12', border: `2px solid ${TIER_COLORS[tier]}30` }}>
                    <div style={{ fontSize: 22 }}>{TIER_EMOJIS[tier]}</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>{tierCounts[tier] || 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{tier.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📈 Canon Timeline</h2>
              {stateHistory.slice(0, 20).map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: h.source === 'override' ? '#eab308' : h.source === 'manual' ? '#dc2626' : '#6366f1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{h.episode_title || h.episode_id?.substring(0, 8)}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                          <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{new Date(h.created_at).toLocaleDateString()} · {h.source}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ SEASON ════════════════════════ */}
      {activeTab === 'episodes' && subTab === 'season' && (
        <SeasonTab showId={showId} api={api} S={S} episodes={episodes} setToast={setToast} />
      )}

      {/* ════════════════════════ EPISODE LEDGER ════════════════════════ */}
      {activeTab === 'episodes' && subTab === 'episodes-ledger' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>Episode Ledger</h2>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{episodes.length} episodes · {acceptedEpisodes.length} evaluated</div>
          </div>

          {/* Financial Summary */}
          {(() => {
            const totalIncome = episodes.reduce((s, e) => s + (parseFloat(e.total_income) || 0), 0);
            const totalExpenses = episodes.reduce((s, e) => s + (parseFloat(e.total_expenses) || 0), 0);
            const net = totalIncome - totalExpenses;
            const epsWithFinancials = episodes.filter(e => e.total_income > 0 || e.total_expenses > 0).length;
            if (epsWithFinancials === 0) return null;
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#16a34a', marginBottom: 4 }}>Total Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{totalIncome.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#dc2626', marginBottom: 4 }}>Total Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{totalExpenses.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: net >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? '#16a34a' : '#dc2626', marginBottom: 4 }}>Net P&L</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? '#16a34a' : '#dc2626' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Episodes with P&L</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{epsWithFinancials} / {episodes.length}</div>
                </div>
              </div>
            );
          })()}

          {episodes.map((ep, i) => {
            const ej = ep.evaluation_json;
            const tier = ej?.tier_final;
            const score = ej?.score;
            const isExpanded = expandedEpisode === ep.id;
            const epHistory = stateHistory.filter(h => h.episode_id === ep.id);
            const deltas = epHistory.length > 0 ? (typeof epHistory[0].deltas_json === 'string' ? JSON.parse(epHistory[0].deltas_json) : epHistory[0].deltas_json) : null;
            const stateAfter = epHistory.length > 0 ? (typeof epHistory[0].state_after_json === 'string' ? JSON.parse(epHistory[0].state_after_json) : epHistory[0].state_after_json) : null;
            const linkedEvent = worldEvents.find(ev => ep.script_content?.includes(ev.name));

            return (
              <div key={ep.id} style={{ background: '#fff', border: isExpanded ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: 12, marginBottom: 10, overflow: 'hidden', transition: 'border 0.2s' }}>
                {/* Row header — always visible */}
                <div onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#6366f1', flex: '0 0 36px' }}>
                    {ep.episode_number || i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{ep.title || 'Untitled'}</div>
                    {linkedEvent && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{EVENT_TYPE_ICONS[linkedEvent.event_type]} {linkedEvent.name}</div>}
                  </div>
                  {tier && <span style={S.tierPill(tier)}>{TIER_EMOJIS[tier]} {tier.toUpperCase()}</span>}
                  {score && <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '0 8px' }}>{score}</span>}
                  <span style={S.statusPill(ep.evaluation_status)}>{ep.evaluation_status || 'draft'}</span>
                  {deltas && (
                    <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                      {Object.entries(deltas).filter(([, v]) => v !== 0).slice(0, 3).map(([k, v]) => (
                        <span key={k} style={{ ...S.deltaBadge(v), fontSize: 10 }}>{STAT_ICONS[k]}{v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded case file */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>

                    {/* ── Stat Impact ── */}
                    {deltas && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Stat Impact</div>
                        <div className="wa-grid wa-grid-5col" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                          {Object.entries(deltas).map(([k, v]) => {
                            const afterVal = stateAfter ? stateAfter[k] : null;
                            const beforeVal = afterVal !== null ? afterVal - v : null;
                            return (
                              <div key={k} style={{ padding: 10, background: v > 0 ? '#f0fdf4' : v < 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 14 }}>{STAT_ICONS[k]}</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                                {beforeVal !== null ? (
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    <span style={{ color: '#94a3b8' }}>{beforeVal}</span>
                                    <span style={{ color: '#64748b', margin: '0 3px' }}>→</span>
                                    <span style={{ color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#1a1a2e' }}>{afterVal}</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 14, fontWeight: 700, color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#94a3b8' }}>
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
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💌 Event</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{linkedEvent.name}</span>
                          <span style={S.eTag}>⭐ {linkedEvent.prestige}</span>
                          <span style={S.eTag}>🪙 {linkedEvent.cost_coins}</span>
                          <span style={S.eTag}>📏 {linkedEvent.strictness}</span>
                          {linkedEvent.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid</span>}
                          {linkedEvent.career_milestone && <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, color: '#4338ca' }}>🎯 {linkedEvent.career_milestone}</span>}
                        </div>
                        {linkedEvent.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 }}>{linkedEvent.narrative_stakes}</div>}
                      </div>
                    )}

                    {/* ── Scene Set ── */}
                    {linkedEvent?.scene_set_id && (() => {
                      const ss = sceneSets.find(s => s.id === linkedEvent.scene_set_id);
                      return ss ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Location</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6 }} />}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{ss.name}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{ss.scene_type?.replace(/_/g, ' ')} · {ss.angles?.length || 0} angles</div>
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
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>👗 Wardrobe ({epWardrobe.length})</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {epWardrobe.slice(0, 6).map(w => (
                              <span key={w.id} style={{ padding: '3px 8px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
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
                          style={{ padding: '6px 16px', background: generating ? '#e5e7eb' : 'linear-gradient(135deg, #16a34a, #22c55e)', color: generating ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}>
                          {generating ? '⏳ Generating...' : '📝 Generate Script from Event'}
                        </button>
                      </div>
                    )}

                    {/* ── Episode Financials ── */}
                    {(ep.total_income > 0 || ep.total_expenses > 0) && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Episode P&L</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ padding: '8px 14px', background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#16a34a' }}>Income</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{ep.total_income || 0}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#dc2626' }}>Expenses</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{ep.total_expenses || 0}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: (ep.total_income || 0) >= (ep.total_expenses || 0) ? '#f0fdf4' : '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#666' }}>Net</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: (ep.total_income || 0) >= (ep.total_expenses || 0) ? '#16a34a' : '#dc2626' }}>
                              {((ep.total_income || 0) - (ep.total_expenses || 0)).toFixed(0)}
                            </div>
                          </div>
                          {ep.financial_score && (
                            <div style={{ padding: '8px 14px', background: '#FAF7F0', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: '#B8962E' }}>Financial IQ</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#B8962E' }}>{ep.financial_score}/10</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Social Tasks + Beats (load on demand) ── */}
                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={async (e) => {
                          const btn = e.target;
                          if (btn.dataset.loaded) return;
                          btn.textContent = '⏳ Loading...';
                          try {
                            // Fetch event details + real social tasks from todo list
                            const [todoRes, eventsRes] = await Promise.all([
                              fetch(`/api/v1/episodes/${ep.id}/todo/social`).then(r => r.json()).catch(() => ({})),
                              fetch(`/api/v1/world/${showId}/events`).then(r => r.json()).catch(() => ({ events: [] })),
                            ]);
                            const linkedEv = (eventsRes.events || []).find(ev => ev.used_in_episode_id === ep.id);
                            const automation = linkedEv?.canon_consequences?.automation;
                            const guests = automation?.guest_profiles || [];
                            const host = automation?.host_display_name;

                            let html = '';
                            if (host) html += `<div style="margin-bottom:8px"><strong>Host:</strong> ${host} (${automation?.host_handle || ''})</div>`;
                            if (guests.length > 0) html += `<div style="margin-bottom:8px"><strong>Guest List:</strong> ${guests.map(g => g.display_name || g.handle).join(', ')}</div>`;
                            if (linkedEv?.venue_name) html += `<div style="margin-bottom:8px"><strong>Venue:</strong> ${linkedEv.venue_name}${linkedEv.venue_address ? ' — ' + linkedEv.venue_address : ''}</div>`;

                            const socialTasks = todoRes.social_tasks || [];
                            html += '<div style="margin-top:12px;font-weight:600;color:#B8962E">📱 Social Media Tasks</div>';
                            if (socialTasks.length > 0) {
                              html += '<div style="margin-top:4px;display:grid;gap:4px">';
                              socialTasks.forEach(t => {
                                const check = t.completed ? '☑' : '☐';
                                const bg = t.source === 'platform' ? '#f0f7ff' : t.source === 'category' ? '#f0fdf4' : '#f8f8f8';
                                const badge = t.source === 'platform' ? `<span style="font-size:8px;padding:1px 4px;background:#dbeafe;color:#1e40af;border-radius:3px;margin-left:4px">${t.platform}</span>` : t.source === 'category' ? '<span style="font-size:8px;padding:1px 4px;background:#d1fae5;color:#065f46;border-radius:3px;margin-left:4px">niche</span>' : '';
                                const req = t.required ? '<span style="font-size:8px;padding:1px 4px;background:#fef2f2;color:#dc2626;border-radius:3px;margin-left:4px">required</span>' : '';
                                html += `<div style="font-size:12px;padding:4px 8px;background:${bg};border-radius:4px">${check} <strong>${t.label}</strong>${req}${badge} <span style="color:#999;font-size:10px">· ${t.platform} · ${t.timing}</span></div>`;
                              });
                              html += '</div>';
                            } else {
                              html += '<div style="margin-top:4px;font-size:11px;color:#999">No social tasks generated yet</div>';
                            }

                            const container = btn.parentNode.querySelector('.ep-tasks-content');
                            if (container) { container.innerHTML = html; container.style.display = 'block'; }
                            btn.textContent = '📱 Tasks & Details ▲';
                            btn.dataset.loaded = 'true';
                          } catch { btn.textContent = '📱 View Tasks & Details'; }
                        }}
                        style={{ ...S.smBtn, background: '#FAF7F0', borderColor: '#e8e0d0', color: '#B8962E' }}
                      >
                        📱 View Tasks & Details
                      </button>
                      <div className="ep-tasks-content" style={{ display: 'none', marginTop: 10, padding: 12, background: '#fafafa', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }} />
                    </div>

                    {/* ── Evaluation Details ── */}
                    {ej && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Evaluation</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {ej.outfit_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Outfit Match</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.outfit_match}/25</div>
                            </div>
                          )}
                          {ej.accessory_match !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Accessory</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.accessory_match}/25</div>
                            </div>
                          )}
                          {ej.event_prestige_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Prestige</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.event_prestige_score}/30</div>
                            </div>
                          )}
                          {ej.timing_score !== undefined && (
                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Timing</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.timing_score}/20</div>
                            </div>
                          )}
                          {(ej.overrides || []).length > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fef3c7', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: '#92400e' }}>Overrides</div>
                              <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.overrides.length} ⬆️</div>
                            </div>
                          )}
                        </div>
                        {ej.narrative_line && (
                          <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569', fontStyle: 'italic', borderLeft: `3px solid ${TIER_COLORS[tier] || '#6366f1'}` }}>
                            "{ej.narrative_line}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Unlocks ── */}
                    {linkedEvent?.success_unlock && tier && (tier === 'slay' || tier === 'pass') && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✨ Unlocked</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {linkedEvent.success_unlock.split(',').map((u, ui) => (
                            <span key={ui} style={{ padding: '4px 10px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#92400e' }}>
                              ✨ {u.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                      <Link to={`/episodes/${ep.id}`} style={{ ...S.smBtn, textDecoration: 'none' }}>Edit Episode</Link>
                      <Link to={`/episodes/${ep.id}/todo`} style={{ ...S.smBtn, textDecoration: 'none', background: '#FAF7F0', borderColor: '#e8e0d0', color: '#B8962E' }}>Todo List</Link>
                      <Link to={`/episodes/${ep.id}/evaluate`} style={{ ...S.smBtn, textDecoration: 'none', background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' }}>Evaluate</Link>
                      {ep.script_content && <span style={{ ...S.smBtn, color: '#16a34a' }}>✅ Has Script ({(ep.script_content || '').split('\n').length} lines)</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {episodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No episodes yet</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Create an episode from the Show page, then come back here.</div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ LALA'S FEED ════════════════════════ */}
      {activeTab === 'feed' && subTab === 'feed-timeline' && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading Feed...</div>}>
          <SocialProfileGenerator embedded showId={showId} defaultFeedLayer="lalaverse" onNavigateToTab={(tab, ev) => { setActiveTab(tab); if (ev) setEventDetailModal(ev); }} />
        </Suspense>
      )}

      {/* ════════════════════════ FEED EVENTS ════════════════════════ */}
      {activeTab === 'feed' && subTab === 'feed-events' && (
        <div style={S.content}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Feed Events</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Create events from templates or profiles. Complete the details here, then mark ready to move to the Events Library.
            </p>
          </div>

          {/* ── Draft Events Being Worked On ── */}
          {(() => {
            const draftEvents = worldEvents.filter(ev => ev.status === 'draft');
            if (draftEvents.length === 0) return null;
            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Draft Events ({draftEvents.length})</span>
                  <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'none', fontFamily: 'inherit' }}>Complete details and mark ready to move to Events Library</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {draftEvents.map(ev => {
                    const auto = ev.canon_consequences?.automation;
                    const host = ev.host || auto?.host_display_name || '';
                    const venue = ev.venue_name || auto?.venue_name || '';
                    const guestCount = auto?.guest_profiles?.length || 0;
                    // Check completeness — check both top-level and automation fields
                    const filled = [
                      ev.host || auto?.host_display_name,
                      ev.venue_name || auto?.venue_name,
                      ev.event_date || auto?.event_date,
                      ev.dress_code || auto?.dress_code,
                      ev.description,
                      ev.narrative_stakes,
                    ].filter(Boolean).length;
                    const total = 6;
                    const pct = Math.round((filled / total) * 100);
                    return (
                      <div key={ev.id} onClick={() => setEventDetailModal(ev)} style={{ background: '#fff', border: '1px solid #e8e0d0', borderLeft: `4px solid ${pct === 100 ? '#22c55e' : '#f59e0b'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{ev.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {host && <span>👤 {host}</span>}
                              {venue && <span>📍 {venue}</span>}
                              {guestCount > 0 && <span>👥 {guestCount}</span>}
                              {ev.event_date && <span>📅 {ev.event_date}</span>}
                              <span>⭐ {ev.prestige || 5}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#16a34a' : '#f59e0b', marginBottom: 4 }}>{pct}% complete</div>
                            <div style={{ width: 80, height: 4, background: '#e8e0d0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#f59e0b', borderRadius: 2 }} />
                            </div>
                          </div>
                        </div>
                        {pct === 100 && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                            Ready to publish — open to mark as ready
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Pipeline: Opportunities → Events ── */}
          <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E' }}>
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
                }} style={{ ...S.smBtn, background: '#B8962E', color: '#fff', border: 'none', fontSize: 10 }}>
                  🔍 Scan Feed
                </button>
                <button onClick={() => setOppQuickForm({ name: '', opportunity_type: 'modeling', prestige: 5, narrative_stakes: '' })} style={{ ...S.smBtn, fontSize: 10 }}>
                  + New Opportunity
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              Scan Lala's feed for opportunities, or pick a template below.
            </div>
          </div>

          {/* Pipeline stats */}
          {opportunities.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['offered','considering','booked','active','completed'].map(s => {
                const count = opportunities.filter(o => o.status === s).length;
                if (!count) return null;
                const colors = { offered: '#f59e0b', considering: '#6366f1', booked: '#22c55e', active: '#16a34a', completed: '#059669' };
                return <span key={s} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: (colors[s] || '#999') + '18', color: colors[s] || '#999' }}>{s}: {count}</span>;
              })}
              <span style={{ fontSize: 9, color: '#888', padding: '2px 4px' }}>
                ${opportunities.filter(o => ['booked','active','completed','paid'].includes(o.status)).reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0).toLocaleString()} booked
              </span>
            </div>
          )}

          {/* Quick create opportunity form */}
          {oppQuickForm && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><label style={{ fontSize: 10, color: '#aaa' }}>name</label><input value={oppQuickForm.name} onChange={e => setOppQuickForm(p => ({ ...p, name: e.target.value }))} placeholder="Velour Magazine Cover" style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }} /></div>
                <div><label style={{ fontSize: 10, color: '#aaa' }}>type</label><select value={oppQuickForm.opportunity_type} onChange={e => setOppQuickForm(p => ({ ...p, opportunity_type: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }}>
                  {['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'casting_call', 'podcast', 'interview', 'award_show', 'social_event'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select></div>
                <div><label style={{ fontSize: 10, color: '#aaa' }}>prestige</label><input type="number" value={oppQuickForm.prestige} onChange={e => setOppQuickForm(p => ({ ...p, prestige: parseInt(e.target.value) || 5 }))} min="1" max="10" style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }} /></div>
              </div>
              <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: '#aaa' }}>stakes</label><input value={oppQuickForm.narrative_stakes} onChange={e => setOppQuickForm(p => ({ ...p, narrative_stakes: e.target.value }))} placeholder="Why this matters for Lala..." style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }} /></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setOppQuickForm(null)} style={{ padding: '5px 14px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                <button disabled={!oppQuickForm.name} onClick={async () => {
                  try {
                    await api.post(`/api/v1/opportunities/${showId}`, { ...oppQuickForm, category: 'fashion' });
                    setOppQuickForm(null);
                    setToast('Opportunity created');
                    loadData();
                  } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: '#2C2C2C', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !oppQuickForm.name ? 0.4 : 1 }}>Create</button>
              </div>
            </div>
          )}

          {/* Active Opportunities ready to schedule */}
          {(() => {
            const schedulable = (opportunities || []).filter(o => !o.event_id && ['offered','considering','negotiating','booked'].includes(o.status));
            if (schedulable.length === 0) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>
                  Active Opportunities — ready to schedule ({schedulable.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {schedulable.map(opp => (
                    <div key={opp.id} style={{ background: '#fff', border: '1px solid #e8e0d0', borderLeft: '4px solid #B8962E', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', marginBottom: 2 }}>{opp.name}</div>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span>{opp.opportunity_type?.replace(/_/g, ' ')}</span>
                        {opp.connector_handle && <span>via @{opp.connector_handle}</span>}
                        {opp.prestige && <span>⭐ {opp.prestige}</span>}
                      </div>
                      {opp.narrative_stakes && <div style={{ fontSize: 11, color: '#666', marginBottom: 6, lineHeight: 1.3 }}>{typeof opp.narrative_stakes === 'string' ? opp.narrative_stakes.slice(0, 100) : ''}</div>}
                      <button onClick={async () => {
                        setToast(`Scheduling "${opp.name}"...`);
                        try {
                          const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
                          if (res.data.success) { setToast(`"${opp.name}" → Event created!`); loadData(); }
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer', width: '100%' }}>
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
                fashion: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
                beauty: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
                creator_economy: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
                creative: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
                music: { bg: '#fae8ff', border: '#a855f7', text: '#6b21a8' },
                lifestyle: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
              };
              const cc = catColors[template.category] || catColors.creator_economy;
              // Check if an event already exists from this template
              const existingEvent = worldEvents.find(ev =>
                ev.name?.includes(template.name) ||
                ev.canon_consequences?.automation?.source_calendar_title === template.name
              );

              return (
                <div key={template.name} style={{ background: existingEvent ? '#fafffe' : '#fff', border: `1px solid ${existingEvent ? '#a3cfbb' : cc.border + '30'}`, borderLeft: `4px solid ${existingEvent ? '#22c55e' : cc.border}`, borderRadius: 10, padding: 16, transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{template.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#2C2C2C' }}>{template.name}</div>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cc.bg, color: cc.text, fontWeight: 600 }}>{template.category.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px', lineHeight: 1.5 }}>{template.desc}</p>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#f0f0f0', color: '#666', fontFamily: "'DM Mono', monospace" }}>Energy: {template.energy}</span>
                  </div>
                  {(feedEventResults[template.name]?.status === 'created' || existingEvent) ? (() => {
                    const created = feedEventResults[template.name]?.event || existingEvent;
                    const host = created?.host || created?.canon_consequences?.automation?.host_display_name || '';
                    return (
                      <div style={{ background: '#d4edda', border: '1px solid #a3cfbb', borderRadius: 8, padding: 10, fontSize: 12, marginTop: 6 }}>
                        <div style={{ fontWeight: 700, color: '#155724', marginBottom: 4 }}>Event Created</div>
                        <div style={{ fontWeight: 600, color: '#2C2C2C' }}>{created?.name || template.name}</div>
                        <div style={{ fontSize: 11, color: '#666', margin: '2px 0' }}>
                          {host ? `Host: ${host} · ` : ''}Prestige: {created?.prestige || 5}{created?.status ? ` · ${created.status}` : ''}
                        </div>
                        <button
                          onClick={() => { setEventDetailModal(created); }}
                          style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, border: '1px solid #B8962E', background: '#fff', color: '#B8962E', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
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
                            setToast(`"${template.name}" created as draft — add host, venue, and details in Events Library`);
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
      )}

      {/* ════════════════════════ EVENTS LIBRARY ════════════════════════ */}
      {activeTab === 'feed' && subTab === 'events' && (
        <div style={S.content}>
          {/* Header — simplified with primary auto-fill action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Events Library</h2>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {worldEvents.filter(e => e.status !== 'draft').length} events · {worldEvents.filter(e => e.status === 'used').length} used · {worldEvents.filter(e => e.status === 'ready').length} available
                {worldEvents.filter(e => e.status === 'draft').length > 0 && (
                  <span> · <button onClick={() => setActiveTab('feed-events')} style={{ background: 'none', border: 'none', color: '#B8962E', fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 0 }}>{worldEvents.filter(e => e.status === 'draft').length} drafts in Feed Events</button></span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              }} disabled={autoFilling} style={{ ...S.primaryBtn, background: '#B8962E' }}>
                {autoFilling ? '⏳ Generating...' : '🗓️ Auto-Fill This Month'}
              </button>
              <button onClick={openNewEvent} style={S.primaryBtn}>+ Create Event</button>
              <button onClick={() => setShowTemplates(!showTemplates)} style={S.smBtn}>📋 Templates</button>
              <button onClick={handleBulkEnhance} disabled={aiFixLoading} style={S.smBtn}>{aiFixLoading ? '⏳...' : '✨ Enhance'}</button>
              <button onClick={async () => {
                if (!window.confirm('Delete ALL draft events? Ready/used events will be kept.')) return;
                try {
                  const res = await api.post(`/api/v1/world/${showId}/events/bulk-delete`, { delete_all_drafts: true });
                  setToast(`Deleted ${res.data.deleted} draft events`);
                  loadData();
                } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
              }} style={{ ...S.smBtn, color: '#dc2626', borderColor: '#fecaca' }}>Delete Drafts</button>
              <button onClick={async () => {
                if (!window.confirm('DELETE ALL EVENTS? This cannot be undone. Are you sure?')) return;
                if (!window.confirm('Really delete everything? Type yes to confirm.')) return;
                try {
                  const res = await api.post(`/api/v1/world/${showId}/events/bulk-delete`, { delete_all: true });
                  setToast(`Deleted ${res.data.deleted} events`);
                  loadData();
                } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
              }} style={{ ...S.smBtn, color: '#dc2626', borderColor: '#fecaca' }}>Delete All</button>
            </div>
          </div>

          {/* Templates panel */}
          {showTemplates && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#16a34a' }}>📋 Event Templates — click to start from a template</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {EVENT_TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => { setEventForm({ ...EMPTY_EVENT, ...tpl }); setEditingEvent('new'); setShowTemplates(false); }}
                    style={{ textAlign: 'left', padding: '8px 12px', background: '#fff', border: '1px solid #d1fae5', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{tpl.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>⭐{tpl.prestige} 🪙{tpl.cost_coins} 👗{tpl.dress_code}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Episode ↔ Event coverage map */}
          {episodes.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Episode → Event Map</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {episodes.map(ep => {
                  const linkedEvent = worldEvents.find(ev => ev.used_in_episode_id === ep.id);
                  const scriptEvent = !linkedEvent ? worldEvents.find(ev => ev.status === 'used' && ep.script_content?.includes(ev.name)) : null;
                  const event = linkedEvent || scriptEvent;
                  return (
                    <div key={ep.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 8,
                      background: event ? '#f8fdf8' : '#fffbeb',
                      border: `1px solid ${event ? '#d1fae5' : '#fde68a'}`,
                    }}>
                      <div onClick={() => navigate(`/episodes/${ep.id}`)} style={{
                        minWidth: 140, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1a1a2e',
                      }} title={`Go to ${ep.title}`}>
                        <span style={{ color: '#94a3b8', marginRight: 4 }}>{ep.episode_number || '?'}.</span>
                        {ep.title?.slice(0, 20) || 'Untitled'}{ep.title?.length > 20 ? '…' : ''}
                      </div>
                      <span style={{ color: '#cbd5e1', fontSize: 12 }}>→</span>
                      {event ? (
                        <div onClick={() => setEventDetailModal(event)} style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                          cursor: 'pointer', minWidth: 0,
                        }} title="Click to see event details">
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{EVENT_TYPE_ICONS[event.event_type] || '📌'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {event.name}
                          </span>
                          <span style={{ fontSize: 9, padding: '1px 6px', background: '#e0f2fe', color: '#0284c7', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>⭐{event.prestige}</span>
                          {event.dress_code && <span style={{ fontSize: 9, padding: '1px 6px', background: '#faf5ff', color: '#7c3aed', borderRadius: 4, flexShrink: 0 }}>👗 {event.dress_code}</span>}
                        </div>
                      ) : (
                        <span style={{ flex: 1, fontSize: 11, color: '#b45309', fontStyle: 'italic' }}>No event assigned</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Budget tracker */}
          {episodes.length > 0 && worldEvents.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Total Event Budget</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
                  🪙 {worldEvents.filter(ev => ev.status === 'used').reduce((sum, ev) => sum + (ev.cost_coins || 0), 0).toLocaleString()}
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}> / {worldEvents.reduce((sum, ev) => sum + (ev.cost_coins || 0), 0).toLocaleString()} total</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Avg Difficulty</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
                  {worldEvents.length > 0 ? (worldEvents.reduce((sum, ev) => sum + calcDifficulty(ev), 0) / worldEvents.length).toFixed(1) : '—'}
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}> / 10</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Coverage</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
                  {episodes.filter(ep => worldEvents.some(ev => ev.used_in_episode_id === ep.id)).length}/{episodes.length}
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}> episodes linked</span>
                </div>
              </div>
            </div>
          )}

          {/* Season arc visualization */}
          {episodes.length > 3 && worldEvents.some(ev => ev.used_in_episode_id) && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Season Arc — Difficulty Curve</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                {[...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0)).map(ep => {
                  const ev = worldEvents.find(e => e.used_in_episode_id === ep.id);
                  const diff = ev ? calcDifficulty(ev) : 0;
                  const dl = ev ? difficultyLabel(diff) : { bg: '#f1f5f9', color: '#cbd5e1' };
                  const height = ev ? Math.max(8, (diff / 10) * 55) : 4;
                  return (
                    <div key={ep.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', height, background: ev ? dl.color : '#e2e8f0', borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease', opacity: ev ? 0.7 : 0.3 }}
                        title={ev ? `Ep ${ep.episode_number}: ${ev.name} (${diff})` : `Ep ${ep.episode_number}: no event`} />
                      <span style={{ fontSize: 7, color: '#94a3b8' }}>{ep.episode_number}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 8, color: '#cbd5e1' }}>Easy</span>
                <span style={{ fontSize: 8, color: '#cbd5e1' }}>Hard</span>
              </div>
            </div>
          )}

          {/* Wardrobe vs Dress Code conflicts */}
          {(() => {
            const conflicts = getDressCodeConflicts();
            return conflicts.length > 0 ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: 6 }}>👗 Wardrobe Conflicts</div>
                {conflicts.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#991b1b', marginBottom: 3 }}>
                    Ep {c.episode.episode_number} "{c.event.name}" wants [{c.eventKeywords.join(', ')}] but wardrobe has [{c.wardrobeKeywords.join(', ')}]
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* Sequence validation warnings + AI Fix */}
          {(() => {
            const warnings = getSequenceWarnings();
            return warnings.length > 0 ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Story Logic Warnings ({warnings.length})</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleAutoReorder} style={{ padding: '5px 12px', background: '#fff', border: '1px solid #fde68a', borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#b45309', cursor: 'pointer' }}>
                      📊 Auto-Reorder
                    </button>
                    <button onClick={() => handleAiRebalance()} disabled={aiFixLoading} style={{ padding: '5px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
                      🔄 Rebalance
                    </button>
                    <button onClick={() => handleAiFix(warnings)} disabled={aiFixLoading} style={{
                      padding: '5px 14px', background: aiFixLoading ? '#e5e7eb' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      color: aiFixLoading ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: aiFixLoading ? 'wait' : 'pointer',
                    }}>
                      {aiFixLoading ? '⏳ Thinking...' : '✨ Amber Fix'}
                    </button>
                  </div>
                </div>
                {warnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#92400e', marginBottom: 5, lineHeight: 1.4 }}>
                    <span style={{ flex: 1 }}>{w.msg}</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {w.fixType === 'swap_episodes' && w.evA && w.evB && (
                        <button onClick={() => handleSwapEpisodes(w.evA, w.evB, w.epA, w.epB)}
                          style={{ padding: '2px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#4338ca', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🔄 Swap
                        </button>
                      )}
                      {w.fixType === 'merge' && w.dupA && w.dupB && (
                        <button onClick={() => handleMergeDuplicates(w.dupA, w.dupB)}
                          style={{ padding: '2px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🔗 Merge
                        </button>
                      )}
                      {w.fixType === 'fill' && w.ep && (
                        <button onClick={() => handleAiGenerateForGap(w.ep)} disabled={aiFixLoading}
                          style={{ padding: '2px 8px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ✨ AI Create
                        </button>
                      )}
                      {w.eventName && (
                        <button onClick={() => { const ev = worldEvents.find(e => e.name === w.eventName); if (ev) openEditEvent(ev); }}
                          style={{ padding: '2px 8px', background: '#fff', border: '1px solid #fde68a', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#b45309', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Fix suggestions */}
                {aiFixSuggestions && aiFixSuggestions.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #fde68a', paddingTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 8 }}>✨ Amber's Suggestions</div>
                    {aiFixSuggestions.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: '#fff', border: '1px solid #e0e7ff', borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', marginBottom: 2 }}>
                            {s.event_name && <span style={{ color: '#6366f1' }}>"{s.event_name}"</span>}
                            {s.action && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', background: '#eef2ff', color: '#4338ca', borderRadius: 4, fontWeight: 700 }}>{s.action.replace(/_/g, ' ')}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{s.suggestion}</div>
                          {s.new_value && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2, wordBreak: 'break-word' }}>→ {typeof s.new_value === 'object' ? s.new_value.name || JSON.stringify(s.new_value) : s.new_value}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          {s.action === 'create' && (s.new_value || s.suggestion) && (
                            <button onClick={() => {
                              let data = {};
                              // Try new_value first (object or JSON string)
                              if (s.new_value) {
                                if (typeof s.new_value === 'object') data = s.new_value;
                                else try { data = JSON.parse(s.new_value); } catch { data = { description: s.new_value }; }
                              }
                              // If new_value didn't have a name, try parsing from suggestion
                              if (!data.name && s.suggestion) {
                                try {
                                  const match = s.suggestion.match(/\{[\s\S]*"name"[\s\S]*\}/);
                                  if (match) data = { ...data, ...JSON.parse(match[0]) };
                                } catch {}
                              }
                              // Map any non-standard field names
                              if (data.dress_code_style && !data.dress_code) data.dress_code = data.dress_code_style;
                              if (data.type && !data.event_type) data.event_type = data.type;
                              // Stash the gap episode so saveEvent links the new
                              // event after create. Field is non-API and ignored
                              // by the backend's whitelist destructure.
                              setEventForm({ ...EMPTY_EVENT, ...data, __pendingEpisodeLink: s.__targetEpisodeId || null });
                              setEditingEvent('new');
                              setAiFixSuggestions(prev => prev.filter(x => x !== s));
                            }} style={{
                              padding: '4px 12px', background: '#16a34a', color: '#fff',
                              border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>+ Create</button>
                          )}
                          {s.action !== 'manual' && s.action !== 'create' && s.event_name && s.new_value && (
                            <button onClick={() => applyAiFix(s)} style={{
                              padding: '4px 12px', background: '#6366f1', color: '#fff',
                              border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>Apply</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setAiFixSuggestions(null)} style={{ ...S.smBtn, marginTop: 4, fontSize: 10 }}>Dismiss</button>
                  </div>
                )}
              </div>
            ) : null;
          })()}

          {/* Bulk action bar */}
          {bulkMode && selectedEvents.size > 0 && (
            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca' }}>{selectedEvents.size} selected</span>
              {selectedEvents.size === 2 && (
                <button onClick={() => { const ids = [...selectedEvents]; setCompareEvents(worldEvents.filter(ev => ids.includes(ev.id))); }} style={{ padding: '3px 10px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>🔍 Compare</button>
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
                      setToast(`✅ Episode "${ep?.title}" created from ${1 + (res.data.linked_extras?.length || 0)} event${(res.data.linked_extras?.length || 0) === 0 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}${res.data.script_drafted ? ' + script' : ''}`);
                      setSelectedEvents(new Set());
                      setBulkMode(false);
                      loadData();
                    } else {
                      setToast(res.data.error || 'Failed');
                    }
                  } catch (err) {
                    setToast('Multi-event generate failed: ' + (err.response?.data?.error || err.message));
                  }
                  setTimeout(() => setToast(null), 6000);
                }} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                  🎬 Generate from {selectedEvents.size} event{selectedEvents.size === 1 ? '' : 's'}
                </button>
              )}
              <span style={{ fontSize: 11, color: '#64748b' }}>Link to:</span>
              {episodes.slice(0, 6).map(ep => (
                <button key={ep.id} onClick={() => bulkInject(ep.id)} style={{ padding: '3px 10px', background: '#fff', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#1a1a2e', fontWeight: 600 }}>
                  {ep.episode_number}. {ep.title?.slice(0, 12) || 'Untitled'}
                </button>
              ))}
            </div>
          )}

          {/* Search + filter + sort bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search events..."
              style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
              {[
                { key: 'all', label: 'All', count: worldEvents.filter(e => e.status !== 'draft').length },
                { key: 'ready', label: 'Ready', count: worldEvents.filter(e => e.status === 'ready').length },
                { key: 'used', label: 'Linked', count: worldEvents.filter(e => e.status === 'used' || e.status === 'scripted' || e.status === 'filmed').length },
                { key: 'unlinked', label: 'Available', count: worldEvents.filter(e => e.status === 'ready' && !e.used_in_episode_id).length },
                { key: 'declined', label: 'Declined', count: worldEvents.filter(e => e.status === 'declined').length },
              ].map(f => (
                <button key={f.key} onClick={() => setEventStatusFilter(f.key)} style={{
                  padding: '4px 10px', border: 'none', borderRadius: 6,
                  background: eventStatusFilter === f.key ? '#6366f1' : 'transparent',
                  color: eventStatusFilter === f.key ? '#fff' : '#64748b',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{f.label} ({f.count})</button>
              ))}
            </div>
            <select value={eventSort} onChange={e => setEventSort(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, background: '#fff', cursor: 'pointer' }}>
              <option value="name">Sort: Name</option>
              <option value="prestige">Sort: Prestige ↓</option>
              <option value="cost">Sort: Cost ↓</option>
              <option value="status">Sort: Status</option>
              <option value="created">Sort: Newest</option>
            </select>
          </div>

          {/* Event editor */}
          {editingEvent && (
            <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{editingEvent === 'new' ? '✨ New Event' : '✏️ Edit Event'}</h3>
              {/* Duplicate detection warning + AI Revise */}
              {eventForm.name && findSimilarEvents(eventForm.name).length > 0 && (
                <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 12, color: '#b45309' }}>
                    ⚠️ Similar events: {findSimilarEvents(eventForm.name).map(e => e.name).join(', ')}
                  </div>
                  <button onClick={handleAiRevise} disabled={aiRevising} style={{
                    padding: '5px 14px', background: aiRevising ? '#e5e7eb' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: aiRevising ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: aiRevising ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {aiRevising ? '⏳ Revising...' : '✨ AI Revise'}
                  </button>
                </div>
              )}

              {/* Venue & Location — WorldLocation picker + scene set */}
              <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
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
                        {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />}
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>✓ {ss.name}</span>
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
                <FG label="Cost (coins)" value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} disabled={eventForm.is_paid === 'free'} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
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
                        <span key={i} style={{ padding: '2px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 11, color: '#4338ca', fontWeight: 600 }}>
                          {kw}
                          <button onClick={() => setEventForm(p => ({ ...p, dress_code_keywords: p.dress_code_keywords.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', marginLeft: 4, fontSize: 12 }}>×</button>
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
              </div>

              {/* Invitation Style */}
              <InvitationStyleFields formData={eventForm} setFormData={setEventForm} />

              {/* Career & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
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
                  {eventForm.is_paid === 'free' && <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>Free event — no cost.</div>}
                  {eventForm.is_paid === 'yes' && <div style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>Lala earns coins for attending.</div>}
                </div>
                <FG label="Payment (if paid)" value={eventForm.payment_amount} onChange={v => setEventForm(p => ({ ...p, payment_amount: parseInt(v) || 0 }))} type="number" min={0} />
              </div>

              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
              <FG label="Career Milestone" value={eventForm.career_milestone} onChange={v => setEventForm(p => ({ ...p, career_milestone: v }))} placeholder="First brand collaboration, first paid gig, etc." full />
              <FG label="On Fail" value={eventForm.fail_consequence} onChange={v => setEventForm(p => ({ ...p, fail_consequence: v }))} placeholder="What happens narratively if she fails..." full />
              <FG label="On Success → Unlocks" value={eventForm.success_unlock} onChange={v => setEventForm(p => ({ ...p, success_unlock: v }))} placeholder="What this opens up (future events, brand deals, etc.)" full />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '6px 10px', background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2C2C2C', cursor: 'pointer' }}>
              <input type="checkbox" checked={draftScriptOnGenerate} onChange={(e) => setDraftScriptOnGenerate(e.target.checked)} />
              <strong>Also draft script when generating an episode</strong>
              <span style={{ color: '#666', fontSize: 11 }}>(applies to single + bulk Generate)</span>
            </label>
          </div>

          {/* Events grid — filtered + sorted */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {worldEvents.filter(ev => {
              const q = eventSearch.toLowerCase();
              const matchSearch = !q || ev.name?.toLowerCase().includes(q) || ev.host?.toLowerCase().includes(q) || ev.dress_code?.toLowerCase().includes(q) || ev.location_hint?.toLowerCase().includes(q);
              if (ev.status === 'draft') return false; // Drafts shown in Feed Events tab
              const matchStatus = eventStatusFilter === 'all' || (eventStatusFilter === 'ready' && ev.status === 'ready') || (eventStatusFilter === 'used' && (ev.status === 'used' || ev.status === 'scripted' || ev.status === 'filmed')) || (eventStatusFilter === 'unlinked' && ev.status === 'ready' && !ev.used_in_episode_id) || (eventStatusFilter === 'declined' && ev.status === 'declined');
              return matchSearch && matchStatus;
            }).sort((a, b) => {
              if (eventSort === 'prestige') return (b.prestige || 0) - (a.prestige || 0);
              if (eventSort === 'cost') return (b.cost_coins || 0) - (a.cost_coins || 0);
              if (eventSort === 'status') return (a.status || '').localeCompare(b.status || '');
              if (eventSort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
              return (a.name || '').localeCompare(b.name || '');
            }).map(ev => {
              const linkedEpisode = ev.used_in_episode_id ? episodes.find(ep => ep.id === ev.used_in_episode_id) : null;
              const linkedScene = ev.scene_set_id ? sceneSets.find(ss => ss.id === ev.scene_set_id) : null;
              const isSelected = selectedEvents.has(ev.id);
              const difficulty = calcDifficulty(ev);
              const diff = difficultyLabel(difficulty);
              return (
              <div key={ev.id} style={{ ...S.evCard, cursor: 'pointer', border: isSelected ? '2px solid #6366f1' : undefined, overflow: 'hidden' }} onClick={() => bulkMode ? toggleSelectEvent(ev.id) : setEventDetailModal(ev)}>
                {/* Scene set thumbnail banner */}
                {linkedScene?.base_still_url && (
                  <div style={{ height: 60, marginTop: -12, marginLeft: -12, marginRight: -12, marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
                    <img src={linkedScene.base_still_url} alt={linkedScene.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 4 }}>
                      📍 {linkedScene.name}
                    </div>
                  </div>
                )}
                {/* Mini mood board — scene set angles */}
                {linkedScene?.angles && linkedScene.angles.length > 1 && (
                  <div style={{ display: 'flex', gap: 2, marginBottom: 6, marginTop: linkedScene?.base_still_url ? 0 : -4 }}>
                    {linkedScene.angles.filter(a => a.still_image_url).slice(0, 5).map(a => (
                      <img key={a.id} src={a.still_image_url} alt={a.angle_label} style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 3, opacity: 0.8 }} title={a.angle_label} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {bulkMode && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelectEvent(ev.id)} onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }} />
                  )}
                  <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[ev.event_type] || '📌'}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0, flex: 1 }}>{ev.name}</h3>
                  <span onClick={e2 => { e2.stopPropagation(); advanceEventStatus(ev); }} style={{ ...S.statusPill(ev.status), cursor: 'pointer' }} title={`Click to advance → ${EVENT_STATUS_CONFIG[EVENT_STATUSES[Math.min(EVENT_STATUSES.indexOf(ev.status || 'draft') + 1, EVENT_STATUSES.length - 1)]]?.label || ''}`}>{EVENT_STATUS_CONFIG[ev.status]?.icon || '○'} {ev.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  <span style={S.eTag}>⭐ {ev.prestige}</span>
                  <span style={S.eTag}>🪙 {ev.cost_coins}</span>
                  <span style={S.eTag}>⏰ {ev.deadline_type}</span>
                  {ev.dress_code && <span style={S.eTag}>👗 {ev.dress_code}</span>}
                  <span style={{ padding: '2px 8px', background: diff.bg, color: diff.color, borderRadius: 6, fontSize: 10, fontWeight: 700 }}>🎯 {difficulty} {diff.text}</span>
                </div>
                {/* Host, venue, guests from automation */}
                {(() => {
                  const auto = ev.canon_consequences?.automation;
                  return (
                    <div style={{ marginBottom: 6 }}>
                      {(ev.host || auto?.host_handle) && (
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                          👤 {ev.host || auto?.host_display_name}{auto?.host_handle ? ` (${auto.host_handle})` : ''}{ev.host_brand ? ` — ${ev.host_brand}` : ''}
                        </div>
                      )}
                      {(ev.venue_name || auto?.venue_name) && (
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                          📍 {ev.venue_name || auto?.venue_name}{ev.venue_address || auto?.venue_address ? ` — ${ev.venue_address || auto.venue_address}` : ''}
                        </div>
                      )}
                      {auto?.guest_profiles?.length > 0 && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                          👥 {auto.guest_profiles.length} guests: {auto.guest_profiles.slice(0, 3).map(g => g.handle || g.display_name).join(', ')}{auto.guest_profiles.length > 3 ? '...' : ''}
                        </div>
                      )}
                      {(ev.event_date || ev.event_time) && (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          📅 {ev.event_date}{ev.event_time ? ` · ${ev.event_time}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(ev.is_paid || ev.is_free || ev.cost_coins > 0) && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                    {ev.is_paid && <span style={{ padding: '1px 6px', background: '#f0fdf4', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#16a34a' }}>💰 Paid{ev.payment_amount ? ` (${ev.payment_amount})` : ''}</span>}
                    {ev.is_free && <span style={{ padding: '1px 6px', background: '#f0f9ff', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#0284c7' }}>🎟️ Free</span>}
                    {!ev.is_paid && !ev.is_free && ev.cost_coins > 0 && <span style={{ padding: '1px 6px', background: '#fef2f2', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#dc2626' }}>Costs {ev.cost_coins} coins</span>}
                  </div>
                )}
                {/* Description preview */}
                {ev.description && (
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.description}</div>
                )}
                {/* Outfit preview */}
                {(() => {
                  const pieces = typeof ev.outfit_pieces === 'string' ? JSON.parse(ev.outfit_pieces || '[]') : (ev.outfit_pieces || []);
                  const score = typeof ev.outfit_score === 'string' ? JSON.parse(ev.outfit_score || 'null') : (ev.outfit_score || null);
                  if (pieces.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, padding: '4px 8px', background: '#faf5ea', borderRadius: 6, border: '1px solid #e8d9b8' }}>
                      <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>👗</span>
                      {pieces.slice(0, 4).map((p, i) => (
                        <img key={i} src={p.image_url} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4, border: '1px solid #e8d9b8' }} title={p.name} />
                      ))}
                      {pieces.length > 4 && <span style={{ fontSize: 9, color: '#B8962E' }}>+{pieces.length - 4}</span>}
                      {score && <span style={{ fontSize: 9, color: score.narrative_mood === 'confidence' ? '#16a34a' : score.narrative_mood === 'anxiety' ? '#dc2626' : '#B8962E', fontWeight: 600, marginLeft: 'auto' }}>{score.match_score}/100</span>}
                    </div>
                  );
                })()}
                {linkedEpisode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f0fdf4', borderRadius: 6, marginBottom: 6, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                    ✓ Ep {linkedEpisode.episode_number}: {linkedEpisode.title}
                  </div>
                ) : ev.status === 'used' ? (
                  <div style={{ padding: '4px 8px', background: '#eef2ff', borderRadius: 6, marginBottom: 6, fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                    ✓ Used {ev.times_used ? `(${ev.times_used}×)` : ''}
                  </div>
                ) : (
                  <div style={{ padding: '4px 8px', background: '#fef3c7', borderRadius: 6, marginBottom: 6, fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                    ○ Not linked to an episode
                  </div>
                )}
                {ev.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.narrative_stakes}</div>}
                {/* Feed activity preview */}
                {ev.canon_consequences?.feed_activity?.length > 0 && (
                  <div style={{ marginBottom: 6, padding: '6px 8px', background: '#fafafa', borderRadius: 6, borderLeft: '2px solid #B8962E' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#B8962E', marginBottom: 3, fontFamily: "'DM Mono', monospace" }}>📢 FEED ACTIVITY</div>
                    {ev.canon_consequences.feed_activity.slice(0, 2).map((post, pi) => (
                      <div key={pi} style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{post.handle}</span>: "{post.content?.slice(0, 60)}{post.content?.length > 60 ? '...' : ''}"
                      </div>
                    ))}
                    {ev.canon_consequences.feed_activity.length > 2 && (
                      <div style={{ fontSize: 9, color: '#999' }}>+{ev.canon_consequences.feed_activity.length - 2} more posts</div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEventDetailModal(ev)} style={S.smBtn}>Edit</button>
                  <button onClick={() => copyEvent(ev)} style={S.smBtn}>Copy</button>
                  <InvitationButton event={ev} showId={showId} onGenerated={() => loadData()} />
                  <button onClick={async () => {
                    setOutfitPickerEvent(ev);
                    setOutfitSelected(new Set());
                    setOutfitScore(null);
                    try {
                      const res = await api.get(`/api/v1/world/${showId}/events/${ev.id}/wardrobe-options`);
                      setOutfitOptions(res.data.items || []);
                      // Load existing outfit
                      const existing = await api.get(`/api/v1/world/${showId}/events/${ev.id}/outfit`);
                      if (existing.data.pieces?.length > 0) {
                        setOutfitSelected(new Set(existing.data.pieces.map(p => p.id)));
                        setOutfitScore(existing.data.score);
                      }
                    } catch { setOutfitOptions([]); }
                  }} style={{ ...S.smBtn, background: '#faf5ea', borderColor: '#e8d9b8', color: '#B8962E' }}>👗 Outfit</button>
                  {!linkedEpisode && (
                    <button onClick={async () => {
                      try {
                        setToast(`🎬 Generating episode${draftScriptOnGenerate ? ' + script' : ''}...`);
                        const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/generate-episode`, {
                          draft_script: draftScriptOnGenerate,
                        });
                        if (res.data.success) {
                          setEpisodeBlueprint(res.data.data);
                          const ep = res.data.data.episode;
                          setToast(`✅ Episode ${ep?.episode_number || ''} "${ep?.title}" created — ${res.data.data.scenePlan?.length || 14} beats, ${res.data.data.socialTasks?.length || 0} social tasks${res.data.script_drafted ? ' + draft script' : ''}`);
                          loadData();
                        } else {
                          setToast(res.data.error || 'Failed');
                        }
                      } catch (err) { setToast('Episode generation failed: ' + (err.response?.data?.error || err.message)); }
                      setTimeout(() => setToast(null), 5000);
                    }} style={{ ...S.smBtn, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>🎬 Generate Episode</button>
                  )}
                  {linkedEpisode && (
                    <button onClick={async () => {
                      if (!window.confirm(`Regenerate this episode? "${linkedEpisode.title || 'Untitled'}" will be soft-deleted and a fresh episode created from this event.`)) return;
                      try {
                        setToast(`🎬 Regenerating episode${draftScriptOnGenerate ? ' + script' : ''}...`);
                        const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/regenerate-episode`);
                        if (res.data.success) {
                          // The regenerate endpoint doesn't currently
                          // support draft_script — fire it as a follow-up
                          // generate-script call when the toggle is on.
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
                    }} style={{ ...S.smBtn, background: '#fdf8ee', borderColor: '#e8d8b8', color: '#B8962E' }}>♻️ Regenerate Episode</button>
                  )}
                  <button onClick={() => deleteEvent(ev.id)} style={S.smBtnDanger}>Delete</button>
                </div>
              </div>
              );
            })}
            {worldEvents.filter(e => e.status !== 'draft').length === 0 && !editingEvent && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#2C2C2C' }}>No events yet</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.5 }}>
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
                  }} disabled={autoFilling} style={{ ...S.primaryBtn, background: '#B8962E', padding: '10px 24px', fontSize: 14 }}>
                    {autoFilling ? '⏳ Generating...' : '🗓️ Auto-Fill This Month'}
                  </button>
                  <button onClick={openNewEvent} style={{ ...S.smBtn, padding: '10px 20px', fontSize: 13 }}>+ Create Manually</button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
          {reorderPlan && (() => {
            const changes = reorderPlan.filter(p => p.changed);
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !reorderApplying && setReorderPlan(null)}>
                <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 720, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📊 Auto-Reorder Preview</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Sort linked events by prestige (low → high) across episodes.
                      {' '}<b style={{ color: changes.length > 0 ? '#7c3aed' : '#64748b' }}>{changes.length}</b> of {reorderPlan.length} episodes would change.
                    </div>
                  </div>
                  <div style={{ padding: '12px 24px' }}>
                    {reorderPlan.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#64748b', padding: 12 }}>No episodes to reorder.</div>
                    ) : (
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#94a3b8', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px', fontWeight: 700 }}>Episode</th>
                            <th style={{ padding: '6px 8px', fontWeight: 700 }}>Currently</th>
                            <th style={{ padding: '6px 8px', fontWeight: 700, width: 24 }}></th>
                            <th style={{ padding: '6px 8px', fontWeight: 700 }}>Proposed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reorderPlan.map((p, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: p.changed ? '#faf5ff' : 'transparent' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap' }}>Ep {p.ep.episode_number}</td>
                              <td style={{ padding: '8px', color: p.current ? '#475569' : '#cbd5e1' }}>
                                {p.current ? `${p.current.name} (P${p.current.prestige ?? '?'})` : '— empty —'}
                              </td>
                              <td style={{ padding: '8px', color: p.changed ? '#7c3aed' : '#cbd5e1', textAlign: 'center' }}>
                                {p.changed ? '→' : '·'}
                              </td>
                              <td style={{ padding: '8px', color: p.proposed ? (p.changed ? '#7c3aed' : '#475569') : '#cbd5e1', fontWeight: p.changed ? 600 : 400 }}>
                                {p.proposed ? `${p.proposed.name} (P${p.proposed.prestige ?? '?'})` : '— empty —'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                    <button onClick={() => setReorderPlan(null)} disabled={reorderApplying}
                      style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: reorderApplying ? 'wait' : 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={applyReorderPlan} disabled={reorderApplying || changes.length === 0}
                      style={{ padding: '8px 16px', background: changes.length === 0 ? '#e5e7eb' : '#7c3aed', color: changes.length === 0 ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: reorderApplying ? 'wait' : (changes.length === 0 ? 'not-allowed' : 'pointer') }}>
                      {reorderApplying ? '⏳ Applying...' : changes.length === 0 ? 'No changes' : `Apply ${changes.length} reassignment${changes.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          {eventDetailModal && (() => {
            // Hydrate missing fields from automation data + derive from context
            const auto = eventDetailModal.canon_consequences?.automation || {};
            const prestige = eventDetailModal.prestige || 5;

            const categoryDressCodes = {
              fashion: 'runway-ready', beauty: 'glam chic', lifestyle: 'smart casual',
              fitness: 'athleisure luxe', food: 'cocktail', music: 'streetwear elevated',
              creator_economy: 'influencer chic', drama: 'camera-ready',
            };
            const hostCategory = auto.content_category || '';
            const derivedDressCode = categoryDressCodes[hostCategory.toLowerCase()] || 'chic';

            const derivedDate = (() => {
              const d = new Date(); d.setDate(d.getDate() + 14);
              return d.toISOString().split('T')[0];
            })();

            const md = {
              ...eventDetailModal,
              host: eventDetailModal.host || auto.host_display_name || auto.host_handle || '',
              host_brand: eventDetailModal.host_brand || auto.host_brand || '',
              venue_name: eventDetailModal.venue_name || auto.venue_name || '',
              venue_address: eventDetailModal.venue_address || auto.venue_address || '',
              event_date: eventDetailModal.event_date || auto.event_date || derivedDate,
              event_time: eventDetailModal.event_time || auto.event_time || (prestige >= 7 ? '20:00' : prestige >= 4 ? '19:00' : '18:00'),
              dress_code: eventDetailModal.dress_code || auto.dress_code || derivedDressCode,
              description: eventDetailModal.description || auto.description || '',
              narrative_stakes: eventDetailModal.narrative_stakes || auto.narrative_stakes || '',
              cost_coins: eventDetailModal.cost_coins ?? auto.cost_coins ?? (prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50),
              strictness: eventDetailModal.strictness ?? auto.strictness ?? Math.min(10, prestige + 1),
              deadline_type: eventDetailModal.deadline_type || auto.deadline_type || (prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low'),
              theme: eventDetailModal.theme || auto.theme || '',
              mood: eventDetailModal.mood || auto.mood || '',
              color_palette: eventDetailModal.color_palette?.length > 0 ? eventDetailModal.color_palette : (auto.color_palette || []),
              floral_style: eventDetailModal.floral_style || auto.floral_style || '',
              border_style: eventDetailModal.border_style || auto.border_style || '',
              dress_code_keywords: eventDetailModal.dress_code_keywords?.length > 0 ? eventDetailModal.dress_code_keywords : (auto.dress_code_keywords || []),
            };
            const updateField = async (field, value) => {
              try {
                const res = await api.put(`/api/v1/world/${showId}/events/${md.id}`, { [field]: value });
                if (res.data.success && res.data.event) {
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event } : ev));
                  // Update modal but preserve any local edits by merging
                  setEventDetailModal(prev => prev ? { ...prev, [field]: value } : prev);
                }
              } catch (err) {
                console.warn(`[Event] Failed to save ${field}:`, err.response?.data?.error || err.message);
                setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field');
              }
            };
            const updateMultipleFields = async (fields) => {
              const changed = {};
              for (const [k, v] of Object.entries(fields)) {
                if (v !== md[k]) changed[k] = v;
              }
              if (Object.keys(changed).length === 0) return;
              try {
                const res = await api.put(`/api/v1/world/${showId}/events/${md.id}`, changed);
                if (res.data.success) {
                  const updated = res.data.event;
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? updated : ev));
                  setEventDetailModal(updated);
                }
              } catch (err) {
                console.warn('[Event] Batch save failed:', err.response?.data?.error || err.message);
                setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field');
              }
            };
            const linkedScene = md.scene_set_id ? sceneSets.find(s => s.id === md.scene_set_id) : null;
            const hasInvalidSceneLink = Boolean(md.scene_set_id) && !linkedScene;
            const diff = calcDifficulty(md);
            const dl = difficultyLabel(diff);
            return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEventDetailModal(null)}>
              <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                {/* Location banner */}
                {linkedScene?.base_still_url && (
                  <div style={{ height: 140, overflow: 'hidden', position: 'relative', borderRadius: '16px 16px 0 0' }}>
                    {linkedScene.video_clip_url ? (
                      <video src={linkedScene.video_clip_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />
                    ) : (
                      <img src={linkedScene.base_still_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6 }}>
                      📍 {linkedScene.name} {linkedScene.video_clip_url && '🎬'}
                    </div>
                    <button onClick={() => updateField('scene_set_id', null)} style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Change</button>
                  </div>
                )}

                {/* Header — editable name */}
                <div style={{ padding: '16px 24px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select value={md.event_type} onChange={e => updateField('event_type', e.target.value)} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}>
                    {Object.entries(EVENT_TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input value={md.name} onChange={e => setEventDetailModal({ ...md, name: e.target.value })} onBlur={e => updateField('name', e.target.value)}
                    style={{ flex: 1, fontSize: 18, fontWeight: 700, color: '#1a1a2e', border: 'none', borderBottom: '1px dashed #e2e8f0', outline: 'none', padding: '2px 0' }} />
                  <span style={S.statusPill(md.status)}>{md.status}</span>
                  <button onClick={() => setEventDetailModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
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
                            <span key={i} style={{ padding: '3px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#333' }}>
                              {g.display_name || g.handle}
                              <span style={{ fontSize: 9, color: '#999', marginLeft: 4 }}>{g.relationship || ''}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Prestige</label><input type="number" min={1} max={10} value={md.prestige} onChange={e => { setEventDetailModal({ ...md, prestige: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('prestige', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Cost 🪙</label><input type="number" min={0} value={md.cost_coins} onChange={e => { setEventDetailModal({ ...md, cost_coins: parseInt(e.target.value) || 0 }); }} onBlur={e => updateField('cost_coins', parseInt(e.target.value) || 0)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Strictness</label><input type="number" min={1} max={10} value={md.strictness} onChange={e => { setEventDetailModal({ ...md, strictness: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('strictness', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Deadline</label><select value={md.deadline_type} onChange={e => updateField('deadline_type', e.target.value)} style={S.sel}>{['none','low','medium','high','tonight','urgent'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Career Tier</label><input type="number" min={1} max={5} value={md.career_tier || 1} onChange={e => { setEventDetailModal({ ...md, career_tier: parseInt(e.target.value) || 1 }); }} onBlur={e => updateField('career_tier', parseInt(e.target.value) || 1)} style={S.sel} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={S.fLabel}>Location (Scene Set)</label>
                      {linkedScene && (
                          <div style={{ background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 6, overflow: 'hidden' }}>
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
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {linkedScene.name}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>{linkedScene.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                              {linkedScene.base_still_url && !linkedScene.video_clip_url && (
                                <button onClick={async (e) => {
                                  const btn = e.currentTarget;
                                  btn.disabled = true; btn.textContent = '⏳ Finding exterior...';
                                  try {
                                    // Find the ESTABLISHING (exterior) angle for this scene set
                                    const anglesRes = await api.get(`/api/v1/scene-sets/${linkedScene.id}`);
                                    const angles = anglesRes.data?.data?.angles || anglesRes.data?.angles || [];
                                    const exterior = angles.find(a => a.angle_label === 'ESTABLISHING') || angles[0];
                                    if (!exterior) { setToast('No exterior angle found — generate venue images first'); btn.disabled = false; btn.textContent = '🎬 Video'; return; }
                                    btn.textContent = '⏳ Generating video...';
                                    const res = await api.post(`/api/v1/scene-sets/${linkedScene.id}/angles/${exterior.id}/generate-video`);
                                    if (res.data.success) setToast('Exterior video generation started (~1 min)');
                                    else setToast(res.data.error || 'Failed');
                                  } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                                  btn.disabled = false; btn.textContent = '🎬 Video';
                                }} style={{ ...S.smBtn, fontSize: 9, padding: '2px 8px', background: '#faf5ea', borderColor: '#e8d9b8', color: '#B8962E' }}>
                                  🎬 Video
                                </button>
                              )}
                              {linkedScene.video_clip_url && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>🎬 Video</span>
                              )}
                              <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>✕ Remove</button>
                            </div>
                            {!linkedScene.base_still_url && (
                              <div style={{ padding: '0 10px 8px' }}>
                                <button
                                  onClick={async (e) => {
                                    const btn = e.target;
                                    btn.disabled = true;
                                    btn.textContent = 'Generating... (~2 min)';
                                    try {
                                      const res = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-venue`);
                                      if (res.data.success) { setToast('Venue images generated!'); loadData(); }
                                    } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                                    btn.disabled = false;
                                    btn.textContent = 'Generate Venue Images';
                                  }}
                                  style={{ width: '100%', padding: '5px 10px', borderRadius: 6, border: '1px dashed #22c55e', background: 'transparent', color: '#16a34a', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
                                >
                                  Generate Venue Images
                                </button>
                              </div>
                            )}
                          </div>
                      )}
                      {hasInvalidSceneLink && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', marginBottom: 6 }}>
                          <div style={{ flex: 1, fontSize: 11, color: '#9a3412' }}>
                            This event is linked to a scene set that no longer exists. Pick a new scene set below.
                          </div>
                          <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>Clear</button>
                        </div>
                      )}
                      {(!md.scene_set_id || hasInvalidSceneLink) && sceneSets.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                          {sceneSets.map(ss => (
                            <button key={ss.id} onClick={() => updateField('scene_set_id', ss.id)} style={{
                              padding: 0, border: '2px solid #e2e8f0', borderRadius: 8, background: '#fff',
                              cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'border-color 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                              {ss.base_still_url ? (
                                <img src={ss.base_still_url} alt={ss.name} style={{ width: '100%', height: 60, objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: 60, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>📍</div>
                              )}
                              <div style={{ padding: '4px 6px' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss.name}</div>
                                <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>{ss.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!md.scene_set_id && sceneSets.length === 0 && (
                        <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No scene sets yet. Generate venue images or create one in Scene Library.</div>
                      )}
                      {/* Generate Venue button — creates exterior + interior + scene set */}
                      {!linkedScene && (
                        <button
                          onClick={async (e) => {
                            const btn = e.target;
                            btn.disabled = true;
                            btn.textContent = 'Generating exterior... (this takes ~2 min)';
                            try {
                              const res = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-venue`);
                              if (res.data.success) {
                                setToast('Venue images created! Scene set linked.');
                                if (res.data.data?.scene_set_id) {
                                  setEventDetailModal({ ...md, scene_set_id: res.data.data.scene_set_id });
                                }
                                loadData();
                              }
                            } catch (err) {
                              setToast('Venue generation failed: ' + (err.response?.data?.error || err.message || 'Request timed out — try again'));
                            }
                            btn.disabled = false;
                            btn.textContent = 'Generate Venue Images';
                          }}
                          style={{ marginTop: 6, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px dashed #6366f1', background: '#eef2ff', color: '#6366f1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          Generate Venue Images
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
                            for (const [key, val] of Object.entries(data)) {
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
                            // Fallback chain for host
                            if (!merged.host) {
                              if (data.hosted_by) merged.host = data.hosted_by;
                              else if (data.host_name) merged.host = data.host_name;
                              else if (merged.host_brand) merged.host = `${merged.host_brand} Events`;
                              else if (merged.name) merged.host = merged.name.split('—')[0].trim();
                            }

                            setEventDetailModal(merged);
                            // Batch save all changed fields in one PUT
                            const saveable = ['name','event_type','host','host_brand','description','prestige','cost_coins','strictness','deadline_type','dress_code','dress_code_keywords','location_hint','narrative_stakes','career_milestone','career_tier','fail_consequence','success_unlock','is_paid','is_free','payment_amount','browse_pool_bias','venue_name','venue_address','event_date','event_time'];
                            const toSave = {};
                            for (const key of saveable) {
                              if (merged[key] !== undefined && merged[key] !== md[key]) {
                                toSave[key] = merged[key];
                              }
                            }
                            if (Object.keys(toSave).length > 0) {
                              try {
                                const res = await api.put(`/api/v1/world/${showId}/events/${md.id}`, toSave);
                                if (res.data.success) {
                                  // Merge server response WITH our local enhanced data (server might not have all columns yet)
                                  const serverData = res.data.event || {};
                                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...serverData, ...merged } : ev));
                                }
                              } catch (err) {
                                // If batch fails (e.g. missing column), try saving fields one by one
                                console.warn('[Event] Batch save failed, trying individual:', err.response?.data?.error);
                                for (const [key, val] of Object.entries(toSave)) {
                                  try {
                                    await api.put(`/api/v1/world/${showId}/events/${md.id}`, { [key]: val });
                                  } catch (e2) {
                                    console.warn(`[Event] Skip ${key}:`, e2.response?.data?.error || e2.message);
                                  }
                                }
                              }
                            }
                            setToast('✨ Enhanced — review the filled fields');
                            setTimeout(() => setToast(null), 3000);
                          }
                        }
                      } catch (err) {
                        setToast(err.response?.data?.error || 'Enhance failed');
                        setTimeout(() => setToast(null), 3000);
                      } finally { setAiRevising(false); }
                    }} disabled={aiRevising} style={{
                      padding: '4px 14px', background: aiRevising ? '#e5e7eb' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      color: aiRevising ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8,
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
                        {md.dress_code_keywords.map((kw, i) => <span key={i} style={{ padding: '2px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 10, color: '#4338ca', fontWeight: 600 }}>{kw}</span>)}
                      </div>
                    )}
                  </div>

                  {/* Invite Preview — phone notification mockup */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Invite Preview</div>
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
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>Financial Preview</div>
                          {loading && <div style={{ fontSize: 10, color: '#94a3b8' }}>calculating…</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#16a34a' }}>Income (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{income.toLocaleString()}</div>
                            {fc?.income?.event_payment > 0 && <div style={{ fontSize: 9, color: '#16a34a80' }}>Payment: {fc.income.event_payment}</div>}
                            {fc?.income?.social_task_rewards > 0 && <div style={{ fontSize: 9, color: '#16a34a80' }}>Tasks: +{fc.income.social_task_rewards}</div>}
                            {fc?.income?.content_revenue_est > 0 && <div style={{ fontSize: 9, color: '#16a34a80' }}>Content est: +{fc.income.content_revenue_est}</div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#dc2626' }}>Expenses (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{expenses.toLocaleString()}</div>
                            {fc?.expenses?.event_cost > 0 && <div style={{ fontSize: 9, color: '#dc262680' }}>Event: {fc.expenses.event_cost}</div>}
                            {fc?.expenses?.outfit_retail > 0 && <div style={{ fontSize: 9, color: '#dc262680' }}>Outfit ({fc.outfit_source === 'actual' ? `${fc.outfit_piece_count} pieces` : 'est'}): {fc.expenses.outfit_retail}</div>}
                            {fc?.expenses?.outfit_rentals > 0 && <div style={{ fontSize: 9, color: '#dc262680' }}>Rentals: +{fc.expenses.outfit_rentals}</div>}
                            {(fc?.expenses?.drinks_est || fc?.expenses?.valet_est || fc?.expenses?.photo_booth_est) ? (
                              <div style={{ fontSize: 9, color: '#dc262680' }}>
                                Extras: {[
                                  fc.expenses.drinks_est && `drinks ${fc.expenses.drinks_est}`,
                                  fc.expenses.valet_est && `valet ${fc.expenses.valet_est}`,
                                  fc.expenses.photo_booth_est && `photo ${fc.expenses.photo_booth_est}`,
                                ].filter(Boolean).join(', ')}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? '#16a34a' : '#dc2626' }}>Net P&L</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: net >= 0 ? '#16a34a' : '#dc2626' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8' }}>
                              {aff.balance_before != null
                                ? `${aff.balance_before.toLocaleString()} → ${balanceAfter.toLocaleString()}`
                                : (net >= 0 ? 'Profitable' : 'Costs more than earns')}
                            </div>
                          </div>
                        </div>
                        {/* Milestones progress — "next goal" bar + reward preview. */}
                        {nextGoal && (
                          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#854d0e' }}>
                                Next: {nextGoal.label}
                                {nextGoal.episode_id && (
                                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 500, color: '#a16207' }}>
                                    · ep-scoped
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: 10, color: '#854d0e', fontFamily: "'DM Mono', monospace" }}>
                                {balanceAfter.toLocaleString()} / {Number(nextGoal.threshold).toLocaleString()} coins
                              </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.max(0, Math.min(100, (balanceAfter / Number(nextGoal.threshold)) * 100))}%`,
                                height: '100%',
                                background: balanceAfter >= Number(nextGoal.threshold) ? '#16a34a' : '#d4a017',
                                transition: 'width 0.3s',
                              }} />
                            </div>
                            {nextGoal.reward_coins > 0 && (
                              <div style={{ fontSize: 10, color: '#854d0e', marginTop: 3 }}>🎁 Reward on reach: +{Number(nextGoal.reward_coins).toLocaleString()} coins — {nextGoal.description}</div>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 6 }}>
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
                            style={{ marginTop: 8, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px solid #B8962E', background: '#FAF7F0', color: '#B8962E', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                          >
                            Finalize Financials
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* ═══ Overlay Command Center ═══ */}
                  {/* ═══ Overlay Command Center ═══ */}
                  <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: 14, marginTop: 12, marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e' }}>Episode Overlays</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={async () => {
                          setOutfitPickerEvent(md);
                          setOutfitSelected(new Set());
                          setOutfitScore(null);
                          try {
                            const res = await api.get(`/api/v1/world/${showId}/events/${md.id}/wardrobe-options`);
                            setOutfitOptions(res.data.items || []);
                            const existing = await api.get(`/api/v1/world/${showId}/events/${md.id}/outfit`);
                            if (existing.data.pieces?.length > 0) {
                              setOutfitSelected(new Set(existing.data.pieces.map(p => p.id)));
                              setOutfitScore(existing.data.score);
                            }
                          } catch { setOutfitOptions([]); }
                        }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e8d9b8', background: '#faf5ea', color: '#B8962E', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                          👗 Pick Outfit
                        </button>
                      </div>
                    </div>

                    {/* Show-level overlays (always present) */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Show Overlays (always on)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['show_title', 'login_screen', 'phone_screen', 'icon_holder', 'cursor', 'exit_icon', 'minimize_icon'].map(id => (
                          <span key={id} style={{ padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 6, fontSize: 9, fontWeight: 600 }}>
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
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Episode Overlays (select for this episode)</div>
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
                                  background: selected ? '#eef2ff' : '#f8f8f8',
                                  color: selected ? '#6366f1' : '#94a3b8',
                                  border: `1px solid ${selected ? '#c7d2fe' : '#e2e8f0'}`,
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
                          } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                          btn.disabled = false; btn.textContent = '🎬 Generate Episode Title';
                        }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #B8962E', background: '#FAF7F0', color: '#B8962E', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
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
                          if (res.data.success) setToast(`Custom overlay "${name}" created — go to Scene Library → Overlays to generate it`);
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px dashed #94a3b8', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
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
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Link to Episode</div>
                    {injectSuccess?.eventId === md.id ? (
                      <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, border: '2px solid #22c55e', textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 700 }}>{injectSuccess.message}</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {episodes.map(ep => {
                          const isLinked = ep.id === md.used_in_episode_id;
                          return (
                            <button key={ep.id} onClick={() => injectEvent(md.id, ep.id)} disabled={injecting} style={{
                              textAlign: 'left', padding: '5px 8px',
                              background: isLinked ? '#f0fdf4' : '#fff',
                              border: isLinked ? '2px solid #22c55e' : '1px solid #e2e8f0',
                              borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#1a1a2e',
                            }}>
                              <div style={{ fontWeight: 600 }}>{ep.episode_number || '?'}. {(ep.title || '').slice(0, 14)}</div>
                              {isLinked && <div style={{ fontSize: 9, color: '#16a34a' }}>✓ Linked</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                    }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #f59e0b', background: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      Decline Invite
                    </button>
                  )}
                  {md.status === 'draft' && (
                    <button onClick={async () => {
                      // Validate required fields
                      const missing = [];
                      if (!md.host) missing.push('Host');
                      if (!md.venue_name) missing.push('Venue Name');
                      if (!md.event_date) missing.push('Event Date');
                      if (!md.dress_code) missing.push('Dress Code');
                      if (!md.description) missing.push('Description');
                      if (missing.length > 0) {
                        setToast(`Missing fields: ${missing.join(', ')}. Fill them or use AI Enhance first.`);
                        return;
                      }
                      // Confirmation summary. The venue-image bullet is conditional:
                      // if a scene set is already attached we'll skip regeneration
                      // (the backend also guards this, but skipping the call
                      // entirely saves a round-trip and makes the UX honest).
                      const hasVenue = !!(md.scene_set_id || md.venue_location_id);
                      const summary = `Mark "${md.name}" as ready?\n\nHost: ${md.host}\nVenue: ${md.venue_name}\nDate: ${md.event_date}\nPrestige: ${md.prestige}\n\nThis will:\n• Save all fields\n• Generate social checklist\n${hasVenue ? '• Keep the attached venue (no regeneration)' : '• Generate venue images'}\n• Move to Events Library`;
                      if (!window.confirm(summary)) return;
                      try {
                        // Save all hydrated fields + status in one PUT
                        const fieldsToSave = {
                          status: 'ready',
                          host: md.host, host_brand: md.host_brand, dress_code: md.dress_code,
                          venue_name: md.venue_name, venue_address: md.venue_address,
                          event_date: md.event_date, event_time: md.event_time,
                          description: md.description, narrative_stakes: md.narrative_stakes,
                          cost_coins: md.cost_coins, strictness: md.strictness,
                          deadline_type: md.deadline_type,
                        };
                        const res = await api.put(`/api/v1/world/${showId}/events/${md.id}`, fieldsToSave);
                        if (res.data.success) {
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
                                setToast(`Ready! Checklist done. Generating venue images...`);
                                try {
                                  const venueRes = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-venue`);
                                  if (venueRes.data.success) {
                                    setToast(venueRes.data.skipped ? `Ready! Kept attached venue.` : `Venue images + scene set created!`);
                                    loadData();
                                  }
                                } catch { setToast('Ready! (venue generation skipped — no OPENAI_API_KEY or error)'); }
                              }
                            }
                          } catch { /* non-blocking — checklist can be generated later */ }
                        }
                      } catch (err) {
                        // If full save fails (columns missing), at least save status
                        try {
                          await api.put(`/api/v1/world/${showId}/events/${md.id}`, { status: 'ready' });
                          setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'ready' } : ev));
                          setEventDetailModal({ ...md, status: 'ready' });
                          setToast('Marked ready (some fields saved to automation only)');
                        } catch (e2) {
                          setToast('Failed: ' + (e2.response?.data?.error || err.message));
                        }
                      }
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid #22c55e', background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Mark Ready
                    </button>
                  )}
                  {md.used_in_episode_id && md.status !== 'draft' && (
                    <button onClick={async () => {
                      if (!window.confirm(`Complete "${md.name}"?\n\nThis will:\n• Evaluate the episode (outfit + event + character state)\n• Apply social task bonuses (reputation, influence)\n• Finalize all financial transactions\n• Update Lala's character stats\n• Mark event as filmed`)) return;
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
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid #B8962E', background: '#FAF7F0', color: '#B8962E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      👑 Complete Episode
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button onClick={async () => {
                    const saveable = ['name','event_type','host','host_brand','description','prestige','cost_coins','strictness','deadline_type','dress_code','dress_code_keywords','location_hint','narrative_stakes','career_milestone','career_tier','fail_consequence','success_unlock','is_paid','is_free','payment_amount','browse_pool_bias','scene_set_id','venue_name','venue_address','event_date','event_time'];
                    const toSave = {};
                    for (const key of saveable) {
                      if (md[key] !== undefined && md[key] !== null) toSave[key] = md[key];
                    }

                    // Always save hydrated fields into canon_consequences.automation
                    // This persists data even when DB columns don't exist yet
                    const updatedAuto = { ...(md.canon_consequences?.automation || {}) };
                    const hydratedFields = ['host', 'host_brand', 'venue_name', 'venue_address', 'event_date', 'event_time', 'dress_code', 'cost_coins', 'strictness', 'deadline_type', 'description', 'narrative_stakes', 'theme', 'mood', 'color_palette', 'floral_style', 'border_style', 'dress_code_keywords'];
                    for (const key of hydratedFields) {
                      if (md[key] !== undefined && md[key] !== null && md[key] !== '') updatedAuto[key] = md[key];
                    }
                    toSave.canon_consequences = { ...(md.canon_consequences || {}), automation: updatedAuto };

                    // Try batch save first
                    try {
                      const res = await api.put(`/api/v1/world/${showId}/events/${md.id}`, toSave);
                      if (res.data.success) {
                        setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event, ...md } : ev));
                        setToast('Event saved');
                        return;
                      }
                    } catch (batchErr) {
                      console.warn('[Event] Batch save failed, trying safe fields:', batchErr.response?.data?.error);
                    }
                    // Fallback: save only canon_consequences (always works) + safe DB fields
                    try {
                      await api.put(`/api/v1/world/${showId}/events/${md.id}`, {
                        canon_consequences: toSave.canon_consequences,
                        name: md.name, host: md.host, description: md.description,
                        prestige: md.prestige, status: md.status,
                      });
                      setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...md } : ev));
                      setToast('Event saved (some fields in automation data)');
                    } catch (err) {
                      setToast('Save failed: ' + (err.response?.data?.error || err.message));
                    }
                  }} style={{ ...S.primaryBtn, padding: '6px 20px', fontSize: 13 }}>
                    💾 Save
                  </button>
                  <button onClick={() => setEventDetailModal(null)} style={{ ...S.smBtn, background: '#f1f5f9' }}>Close</button>
                </div>
              </div>
            </div>
            );
          })()}

      {/* ── Event Comparison Modal ── */}
      {compareEvents && compareEvents.length === 2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCompareEvents(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Compare Events</h3>
              <button onClick={() => setCompareEvents(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {compareEvents.map((ev, idx) => (
                <div key={ev.id} style={{ padding: 16, borderRight: idx === 0 ? '1px solid #f1f5f9' : 'none' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{ev.name}</h4>
                  {[
                    ['Type', ev.event_type], ['Host', ev.host || '—'], ['Prestige', ev.prestige],
                    ['Cost', ev.cost_coins], ['Strictness', ev.strictness], ['Deadline', ev.deadline_type],
                    ['Dress Code', ev.dress_code || '—'], ['Tier', ev.career_tier], ['Status', ev.status],
                    ['Difficulty', calcDifficulty(ev).toFixed(1)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f8fafc' }}>
                      <span style={{ color: '#64748b' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{val}</span>
                    </div>
                  ))}
                  {ev.narrative_stakes && <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 8, lineHeight: 1.4 }}>{ev.narrative_stakes}</div>}
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
      {activeTab === 'wardrobe' && subTab === 'goals' && (
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
              <button onClick={() => { setGoalForm({ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '#6366f1', description: '' }); setEditingGoal('new'); }} style={S.primaryBtn}>+ New Goal</button>
            </div>
          </div>

          {/* Goal editor */}
          {editingGoal && (
            <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 20, marginBottom: 16 }}>
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
                <FG label="Color" value={goalForm.color} onChange={v => setGoalForm(p => ({ ...p, color: v }))} placeholder="#6366f1" />
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{typeLabel} {typeLimit}</div>
                <div style={{ display: 'grid', gridTemplateColumns: goalType === 'primary' ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {typeGoals.map(g => {
                    const pct = g.progress || Math.min(100, Math.round(((g.current_value - (g.starting_value || 0)) / Math.max(1, (g.target_value - (g.starting_value || 0)))) * 100));
                    return (
                      <div key={g.id} style={{ background: '#fff', border: goalType === 'primary' ? `2px solid ${g.color || '#6366f1'}` : '1px solid #e2e8f0', borderRadius: 12, padding: goalType === 'primary' ? 20 : 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: goalType === 'primary' ? 28 : 20 }}>{g.icon || '🎯'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: goalType === 'primary' ? 16 : 14, fontWeight: 700, color: '#1a1a2e' }}>{g.title}</div>
                            {g.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{g.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setGoalForm({ ...g }); setEditingGoal(g.id); }} style={S.smBtn}>✏️</button>
                            <button onClick={() => deleteGoal(g.id)} style={S.smBtnDanger}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                          {STAT_ICONS[g.target_metric] || '📊'} {g.target_metric?.replace(/_/g, ' ')}: <strong>{g.current_value}</strong> / {g.target_value}
                        </div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : (g.color || '#6366f1'), borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: pct >= 100 ? '#16a34a' : '#94a3b8', fontWeight: pct >= 100 ? 700 : 400 }}>
                          {pct >= 100 ? '✅ COMPLETE' : `${pct}% — ${Math.max(0, g.target_value - g.current_value)} remaining`}
                        </div>
                      </div>
                    );
                  })}
                  {typeGoals.length === 0 && (
                    <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0' }}>
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
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#16a34a' }}>✅ Completed Goals</h3>
              {goals.filter(g => g.status === 'completed').map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>{g.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{g.title}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{g.completed_at ? new Date(g.completed_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Event suggestions */}
          {suggestions.length > 0 && (
            <div style={S.card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>💡 Suggested Events (Based on Active Goals)</h3>
              {suggestions.map((s, i) => (
                <div key={i} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, marginBottom: 10, border: s.requirements_met === false ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[s.event_type] || '📌'}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{s.name}</span>
                    <span style={S.eTag}>⭐ {s.prestige}</span>
                    <span style={S.eTag}>🪙 {s.cost_coins}</span>
                    {s.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid</span>}
                    {!s.requirements_met && <span style={{ padding: '2px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626' }}>⚠️ Reqs not met</span>}
                  </div>
                  {s.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 6 }}>{s.narrative_stakes}</div>}
                  <div style={{ fontSize: 11, color: '#6366f1', marginBottom: 8, lineHeight: 1.5 }}>
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
                    }} style={{ ...S.smBtn, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>📝 Generate Script</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ OUTFIT PICKER MODAL ════════════════════════ */}
      {outfitPickerEvent && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setOutfitPickerEvent(null)}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👗 Pick Outfit</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{outfitPickerEvent.name} · Prestige {outfitPickerEvent.prestige}/10</p>
              </div>
              <button onClick={() => setOutfitPickerEvent(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            {/* Score banner */}
            {outfitScore && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: outfitScore.narrative_mood === 'confidence' ? '#f0fdf4' : outfitScore.narrative_mood === 'anxiety' ? '#fef2f2' : '#FAF7F0', border: '1px solid #e8e0d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>Match: {outfitScore.match_score}/100</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: outfitScore.narrative_mood === 'confidence' ? '#16a34a' : outfitScore.narrative_mood === 'anxiety' ? '#dc2626' : '#B8962E' }}>
                    {outfitScore.narrative_mood}
                  </span>
                </div>
                {outfitScore.signals?.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{s.text}</div>
                ))}
                {outfitScore.repeats?.length > 0 && outfitScore.repeats.map((r, i) => (
                  <div key={`r${i}`} style={{ fontSize: 11, color: '#8b5cf6', marginTop: 3 }}>{r.narrative?.text}</div>
                ))}

                {/* ── Per-slot breakdown ────────────────────────────────
                    One row per UI slot (outfit/shoes/jewelry/accessories/
                    fragrance). Each row shows a progress bar + reason so the
                    player can see exactly which slot is hurting the overall
                    score. Status color: empty=gray, low=red, ok=amber,
                    good=green. Required slots with empty status get the red
                    "missing" treatment. */}
                {Array.isArray(outfitScore.slots) && outfitScore.slots.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {outfitScore.slots.map(slot => {
                      const emptyRequired = slot.status === 'empty' && slot.required;
                      const color = emptyRequired ? '#dc2626'
                        : slot.status === 'good' ? '#16a34a'
                        : slot.status === 'ok' ? '#B8962E'
                        : slot.status === 'low' ? '#dc2626'
                        : '#94a3b8';
                      const barWidth = slot.status === 'empty' ? 0 : slot.match;
                      return (
                        <div key={slot.slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 110, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#444', fontWeight: 600, flexShrink: 0 }}>
                            <span>{slot.icon}</span>
                            <span>{slot.label}</span>
                          </div>
                          <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${barWidth}%`, height: '100%', background: color, transition: 'width 0.25s' }} />
                          </div>
                          <div style={{ width: 36, fontSize: 11, fontWeight: 700, color, textAlign: 'right', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                            {slot.status === 'empty' ? (slot.required ? '!' : '—') : slot.match}
                          </div>
                        </div>
                      );
                    })}
                    {/* Reason line per-row would crowd the grid; show only
                        the first non-empty reason whose slot is dragging the
                        score so players get one concrete thing to fix. */}
                    {(() => {
                      const weakest = outfitScore.slots
                        .filter(s => s.reason && (s.status === 'low' || (s.status === 'empty' && s.required)))
                        .sort((a, b) => a.match - b.match)[0];
                      if (!weakest) return null;
                      return (
                        <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 4, fontStyle: 'italic' }}>
                          💡 {weakest.reason}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* Surface items whose category isn't one of the 5 slots so
                    the author can fix the category on the row. */}
                {Array.isArray(outfitScore.unassigned) && outfitScore.unassigned.length > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, fontSize: 11, color: '#c2410c' }}>
                    ⚠️ Couldn't slot {outfitScore.unassigned.length} piece{outfitScore.unassigned.length > 1 ? 's' : ''} — check {outfitScore.unassigned.map(u => u.name).slice(0, 3).join(', ')}{outfitScore.unassigned.length > 3 ? '…' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Selected pieces */}
            {outfitSelected.size > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FAF7F0', borderRadius: 8, border: '1px solid #e8e0d0' }}>
                <div style={{ fontSize: 10, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>SELECTED ({outfitSelected.size} pieces)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from(outfitSelected).map(id => {
                    const item = outfitOptions.find(i => i.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e8e0d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                           onClick={() => { const s = new Set(outfitSelected); s.delete(id); setOutfitSelected(s); setOutfitScore(null); }}>
                        {item.image_url && <img src={item.image_url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                        <span style={{ fontSize: 11 }}>{item.name}</span>
                        <span style={{ fontSize: 10, color: '#ccc' }}>✕</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save + Score button */}
            {outfitSelected.size > 0 && (
              <button disabled={outfitSaving} onClick={async () => {
                setOutfitSaving(true);
                try {
                  const res = await api.put(`/api/v1/world/${showId}/events/${outfitPickerEvent.id}/outfit`, {
                    wardrobe_ids: Array.from(outfitSelected),
                  });
                  setOutfitScore(res.data.score);
                  setToast(`Outfit saved — match ${res.data.score?.match_score}/100 (${res.data.score?.narrative_mood})`);
                  loadData();
                } catch (err) { setToast('Save failed: ' + err.message); }
                setOutfitSaving(false);
              }} style={{ width: '100%', padding: '10px', marginBottom: 16, border: 'none', borderRadius: 8, background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: outfitSaving ? 0.5 : 1 }}>
                {outfitSaving ? 'Saving...' : outfitScore ? 'Update Outfit' : `Save Outfit (${outfitSelected.size} pieces)`}
              </button>
            )}

            {/* Closet grid */}
            <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
              {outfitOptions.length} pieces in closet — tap to select
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {outfitOptions.map(item => {
                const selected = outfitSelected.has(item.id);
                return (
                  <div key={item.id} onClick={() => {
                    const s = new Set(outfitSelected);
                    if (selected) s.delete(item.id); else s.add(item.id);
                    setOutfitSelected(s);
                    setOutfitScore(null);
                  }} style={{
                    border: selected ? '2px solid #B8962E' : '1px solid #e8e0d0', borderRadius: 10,
                    overflow: 'hidden', cursor: 'pointer', background: selected ? '#faf5ea' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ aspectRatio: '1', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 32, color: '#ddd' }}>👗</span>
                      )}
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{item.clothing_category} · {item.tier || 'basic'}</div>
                      {item.brand && <div style={{ fontSize: 9, color: '#aaa' }}>{item.brand}</div>}
                      {item.price > 0 && <div style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>${item.price}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {outfitOptions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👗</div>
                <p style={{ fontSize: 13 }}>No wardrobe pieces yet. Upload items in the Wardrobe tab first.</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════ EPISODE BLUEPRINT MODAL ════════════════════════ */}
      {episodeBlueprint && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEpisodeBlueprint(null)}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎬 Episode Blueprint</h2>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            {/* Episode info */}
            <div style={{ background: '#FAF7F0', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e8e0d0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#2C2C2C', marginBottom: 4 }}>{episodeBlueprint.episode?.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>Episode {episodeBlueprint.episode?.episode_number} · {episodeBlueprint.brief?.episode_archetype} · Intent: {episodeBlueprint.brief?.designed_intent}</div>
            </div>

            {/* Financials */}
            {episodeBlueprint.financials && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: '#f0fdf4', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#16a34a' }}>Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{episodeBlueprint.financials.total_income}</div>
                </div>
                <div style={{ padding: '8px 14px', background: '#fef2f2', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#dc2626' }}>Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{episodeBlueprint.financials.total_expenses}</div>
                </div>
                <div style={{ padding: '8px 14px', background: episodeBlueprint.financials.net_profit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#666' }}>Net</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: episodeBlueprint.financials.net_profit >= 0 ? '#16a34a' : '#dc2626' }}>{episodeBlueprint.financials.net_profit}</div>
                </div>
              </div>
            )}

            {/* 14 Beats Timeline */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>14 Beats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(episodeBlueprint.beats || []).map((beat, i) => {
                  const phaseColors = { before: '#fef3c7', during: '#dbeafe', after: '#f3e8ff' };
                  const phaseDots = { before: '#f59e0b', during: '#3b82f6', after: '#8b5cf6' };
                  // Find feed moment for this beat from scene plan
                  const sp = episodeBlueprint.scenePlan?.find(s => s.beat_number === beat.beat);
                  const fm = sp?.feed_moment || episodeBlueprint.feedMoments?.[beat.beat];
                  return (
                    <div key={i} style={{ padding: '6px 10px', background: phaseColors[beat.phase] || '#f8f8f8', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: phaseDots[beat.phase] || '#999', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{beat.beat}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#2C2C2C' }}>{beat.label}</div>
                          <div style={{ fontSize: 11, color: '#666' }}>{beat.description}</div>
                          <div style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{beat.phase} · {beat.emotional_intent}</div>
                        </div>
                        {fm && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: '#1a1a1a', color: '#B8962E', fontWeight: 700, flexShrink: 0 }}>📱</span>}
                      </div>
                      {/* Feed Moment — On-Screen Visual + Script Lines */}
                      {fm && (
                        <div style={{ marginTop: 6, marginLeft: 34, display: 'flex', gap: 6 }}>
                          {/* On-Screen Overlay (bright — what viewer sees) */}
                          <div style={{ flex: 1, padding: '6px 10px', background: 'linear-gradient(135deg, #FAF7F0, #fff8e7)', borderRadius: 8, border: '1px solid #B8962E30' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 8, fontWeight: 700, color: '#B8962E', textTransform: 'uppercase' }}>On Screen · {(fm.on_screen || fm.phone_screen)?.type || 'notification'}</span>
                              <span style={{ fontSize: 8, color: '#94a3b8' }}>{fm.trigger_profile}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#1a1a2e', lineHeight: 1.4 }}>{(fm.on_screen || fm.phone_screen)?.content}</div>
                          </div>
                          {/* Script Lines — Both Voices */}
                          {(fm.script_lines || fm.lala_dialogue) && (
                            <div style={{ flex: 1, padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              {/* JustAWoman — player voice */}
                              {fm.script_lines?.justawoman_line && (
                                <div style={{ marginBottom: 4 }}>
                                  <span style={{ fontSize: 8, fontWeight: 700, color: '#B8962E', textTransform: 'uppercase' }}>JustAWoman</span>
                                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 1 }}>"{fm.script_lines.justawoman_line}"</div>
                                </div>
                              )}
                              {/* Lala — character voice */}
                              <span style={{ fontSize: 8, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>Lala</span>
                              <div style={{ fontSize: 11, color: '#1a1a2e', marginTop: 1, fontFamily: "'Lora', serif" }}>
                                "{fm.script_lines?.lala_line || fm.lala_dialogue}"
                              </div>
                              {(fm.script_lines?.lala_internal || fm.lala_internal) && (
                                <div style={{ fontSize: 10, color: '#6366f1', fontStyle: 'italic', marginTop: 2 }}>
                                  [{fm.script_lines?.lala_internal || fm.lala_internal}]
                                </div>
                              )}
                              {/* Financial indicator */}
                              {fm.financial && (
                                <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginTop: 3, display: 'inline-block', background: fm.financial.affordable ? '#f0fdf4' : '#fef2f2', color: fm.financial.affordable ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                  Bank: {fm.financial.balance} → {fm.financial.affordable ? `-${fm.financial.outfit_cost} = ${fm.financial.remaining}` : `Need ${fm.financial.outfit_cost} (short ${fm.financial.outfit_cost - fm.financial.balance})`}
                                </div>
                              )}
                              {(fm.script_lines?.direction || fm.behavior_shift) && (
                                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>→ {fm.script_lines?.direction || fm.behavior_shift}</div>
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
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>📱 Social Media Tasks ({episodeBlueprint.socialTasks.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {episodeBlueprint.socialTasks.map((task, i) => (
                    <div key={i} style={{ padding: '6px 10px', background: task.source ? '#faf7f0' : '#f8f8f8', borderRadius: 6, fontSize: 11, borderLeft: task.source ? '3px solid #B8962E' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ color: '#999' }}>☐</span>
                        <span style={{ fontWeight: 600 }}>{task.label}</span>
                        {task.required && <span style={{ fontSize: 8, padding: '1px 4px', background: '#fef2f2', color: '#dc2626', borderRadius: 3 }}>required</span>}
                        {task.source === 'platform' && <span style={{ fontSize: 8, padding: '1px 4px', background: '#dbeafe', color: '#1e40af', borderRadius: 3 }}>{task.platform}</span>}
                        {task.source === 'category' && <span style={{ fontSize: 8, padding: '1px 4px', background: '#d1fae5', color: '#065f46', borderRadius: 3 }}>niche</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{task.description}</div>
                      <div style={{ fontSize: 9, color: '#aaa', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{task.platform} · {task.timing}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed Activity */}
            {episodeBlueprint.feedPosts?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>📢 Feed Activity ({episodeBlueprint.feedPosts.length} posts)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {episodeBlueprint.feedPosts.map((post, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 8, borderLeft: '3px solid #B8962E' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{post.handle} <span style={{ fontWeight: 400, color: '#999' }}>({post.role})</span></div>
                      <div style={{ fontSize: 12, color: '#333', fontStyle: 'italic' }}>"{post.content}"</div>
                      <div style={{ fontSize: 9, color: '#aaa', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{post.platform}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                if (epId) window.location.href = `/episodes/${epId}`;
                else { setActiveTab('episodes'); setEpisodeBlueprint(null); }
              }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Open Episode →
              </button>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                if (epId) window.location.href = `/episodes/${epId}/script-writer`;
                else setEpisodeBlueprint(null);
              }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #B8962E', background: 'transparent', color: '#B8962E', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Write Script
              </button>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#666', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
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

        const filteredItems = wardrobeItems.filter(item => {
          // Top-tab: staging means never used. Applied before everything else
          // so the count in the tab matches what the grid shows.
          if (wardrobeTopTab === 'staging' && isItemUsed(item)) return false;
          const itemType = item.clothing_category || item.itemType || item.item_type || 'other';
          // Category pill filters by SLOT now — e.g. clicking "Outfit" matches
          // dress, top, bottom, outerwear. Falls back to raw category match if
          // the filter value isn't a known slot key (for legacy call sites).
          if (wardrobeCatFilter !== 'all') {
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
            const res = await fetch(`/api/v1/wardrobe/${item.id}/primary-variant`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variant }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || err.message || `HTTP ${res.status}`);
            }
            setWardrobeItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, primary_image_variant: variant } : i
            ));
            setLightboxItem(prev => (prev && prev.id === item.id)
              ? { ...prev, primary_image_variant: variant } : prev);
          } catch (err) {
            alert(`Couldn't set default: ${err.message}`);
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
            const res = await fetch(`/api/v1/wardrobe/${item.id}/send-to-phone`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variant, showId }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.message || err.error || `HTTP ${res.status}`);
            }
            const result = await res.json();
            // Close lightbox + navigate to the overlay editor tab. The new
            // Asset will appear in UIOverlaysTab's list automatically via
            // its existing GET /api/v1/ui-overlays/:showId fetch.
            setLightboxVariant(null);
            setLightboxItem(null);
            setSubTab('overlays-tab');
            setSearchParams({ tab: 'overlays-tab' });
            alert(`Sent to phone as "${result.data.name}". Opening overlay editor…`);
          } catch (err) {
            alert(`Send to phone failed: ${err.message}`);
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
            const res = await fetch(`/api/v1/wardrobe/${item.id}/regenerate-product-shot`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || err.message || `HTTP ${res.status}`);
            }
            const result = await res.json();
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ ...S.cardTitle, margin: 0 }}>👗 Wardrobe Library</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Bulk selection indicator */}
                {selectedWardrobeIds.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>{selectedWardrobeIds.size} selected</span>
                    <button onClick={() => setSelectedWardrobeIds(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#92400e' }}>✕</button>
                    <button onClick={() => { setOutfitSetName(''); setShowCreateOutfitSet(true); }} style={{ padding: '2px 8px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>👗 Create set</button>
                    <button onClick={bulkDeleteSelected} style={{ padding: '2px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>🗑️ Delete</button>
                  </div>
                )}
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{wardrobeItems.length} items</span>
                {/* Grid / list toggle — list mode trades thumbnail size for more
                    metadata per row, which is useful once libraries get large. */}
                <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  {['grid', 'list'].map(mode => (
                    <button key={mode} onClick={() => setWardrobeViewMode(mode)} title={`${mode} view`}
                      style={{
                        padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: 'none',
                        background: wardrobeViewMode === mode ? '#1e293b' : '#fff',
                        color: wardrobeViewMode === mode ? '#fff' : '#64748b',
                      }}>{mode === 'grid' ? '▦' : '≣'}</button>
                  ))}
                </div>
                {/* Finance pill — shows live balance + opens editor for
                    starting balance and goal ladder. Stays compact: when
                    there's no next goal (Legacy reached), just the balance. */}
                <button
                  onClick={async () => {
                    setFinanceEditorDraft({
                      starting_balance: financeConfig?.starting_balance ?? 1900,
                      goals: (financeConfig?.goals || []).map(g => ({ ...g })),
                    });
                    setFinanceTab('overview');
                    setFinanceEditorOpen(true);
                    // Kick off the summary fetch so Overview renders real data.
                    // Non-blocking: modal pops immediately with a loading state.
                    setFinanceSummaryLoading(true);
                    try {
                      const [sumRes, sugRes, brkRes] = await Promise.all([
                        api.get(`/api/v1/shows/${showId}/financial-summary`),
                        api.get(`/api/v1/shows/${showId}/financial-suggestions`).catch(() => null),
                        api.get(`/api/v1/shows/${showId}/financial-breakdowns`).catch(() => null),
                      ]);
                      setFinanceSummary(sumRes.data);
                      setFinanceSuggestions(sugRes?.data?.suggestions || []);
                      setFinanceBreakdowns(brkRes?.data || null);
                    } catch { setFinanceSummary(null); }
                    finally { setFinanceSummaryLoading(false); }
                  }}
                  title="Lala's finances — balance, trend, per-episode P&L, and goal ladder"
                  style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  💰 {(financeConfig?.current_balance ?? 0).toLocaleString()}
                  {financeConfig?.next_goal && (
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>→ {financeConfig.next_goal.label.replace(/[🌟👑💎🏆✨]\s*/, '')}</span>
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
                      style={{ ...S.secBtn, fontSize: 11, padding: '6px 10px', background: requireAll ? '#fef3c7' : undefined, borderColor: requireAll ? '#d4a017' : undefined, color: requireAll ? '#854d0e' : undefined }}
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
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 50, padding: 6 }}>
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
                            const res = await fetch(op.endpoint, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(body),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Operation failed');
                            // Endpoints report either { succeeded, failed } or { processed, failed } — show both shapes.
                            const succ = data.data?.succeeded?.length ?? data.data?.processed ?? 0;
                            const fail = data.data?.failed?.length ?? data.data?.failed ?? 0;
                            setToast(`Done: ${succ} ok, ${fail} failed`);
                            // Reload via the existing effect that fetches wardrobeItems when showId changes.
                            // Trigger that path by re-fetching manually:
                            try { const r = await fetch(`/api/v1/shows/${showId}/wardrobe`); const j = await r.json(); if (j?.data) setWardrobeItems(j.data); } catch {}
                          } catch (err) {
                            setToast(`Bulk op failed: ${err.message}`);
                          }
                        }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, borderRadius: 6, color: '#334155' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >{op.label}</button>
                      ))}
                    </div>
                  </details>
                </div>
                <button onClick={() => { setWardrobeUploadForm({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: false, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' }); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); setShowWardrobeUpload(true); }} style={S.primaryBtn}>+ Upload Item</button>
              </div>
            </div>

            {/* Top tabs: All vs. Staging (never-used). The staging count lives
                in the tab itself so creators can see at a glance how much of the
                library is unassigned — catches the "forgot to assign" case fast. */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 14 }}>
              {[
                { key: 'all', label: 'All items', count: wardrobeItems.length },
                { key: 'staging', label: 'Staging (never used)', count: stagingCount },
              ].map(tab => {
                const active = wardrobeTopTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => { setWardrobeTopTab(tab.key); setWardrobePage(1); }}
                    style={{
                      padding: '10px 18px', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
                      background: 'transparent', border: 'none',
                      borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                      color: active ? '#1e293b' : '#64748b',
                      marginBottom: -1,
                    }}>
                    {tab.label} <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>({tab.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Slot summary cards — one per slot, in fixed order so the row
                doesn't reshuffle as counts change. Each card is a shortcut to
                filter the grid by that slot (clicking the active card clears
                the filter). Unassigned items get a warning card only when
                non-empty so creators can spot mis-categorised rows. */}
            <div className="wa-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
              {SLOT_KEYS.map(slotKey => {
                const items = typeGroups[slotKey] || [];
                const def = SLOT_DEFS[slotKey];
                const isActive = wardrobeCatFilter === slotKey;
                return (
                  <div key={slotKey} onClick={() => setWardrobeCatFilter(isActive ? 'all' : slotKey)}
                    title={def.desc}
                    style={{
                      padding: '12px 10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                      background: isActive ? '#6366f118' : '#fff',
                      border: isActive ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: 20 }}>{def.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isActive ? '#6366f1' : '#1a1a2e' }}>{items.length}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>{def.label}</div>
                  </div>
                );
              })}
              {(typeGroups.__unassigned?.length > 0) && (
                <div title="These items have a clothing_category that doesn't map to any slot — edit to fix"
                  style={{ padding: '12px 10px', borderRadius: 10, textAlign: 'center', cursor: 'default', background: '#fff7ed', border: '1px solid #fdba74' }}>
                  <div style={{ fontSize: 20 }}>⚠️</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#c2410c' }}>{typeGroups.__unassigned.length}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#c2410c' }}>Unassigned</div>
                </div>
              )}
            </div>

            {/* Search + Category Filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <input
                type="text"
                placeholder="Search name, brand, color, tags..."
                value={wardrobeFilter === 'all' ? '' : wardrobeFilter}
                onChange={e => setWardrobeFilter(e.target.value || 'all')}
                style={{ ...S.inp, flex: '1 1 200px', minWidth: 150, margin: 0 }}
              />
              <select
                value={wardrobeSort}
                onChange={e => setWardrobeSort(e.target.value)}
                title="Sort wardrobe items"
                style={{ ...S.sel, width: 'auto', minWidth: 140, margin: 0 }}
              >
                <option value="recent">Recently added</option>
                <option value="name">Name (A–Z)</option>
                <option value="price_asc">Price (low → high)</option>
                <option value="price_desc">Price (high → low)</option>
                <option value="most_used">Most used</option>
                <option value="last_used">Last used</option>
                <option value="favorites">Favorites first</option>
              </select>
              <div style={{ width: 1, height: 24, background: '#e2e8f0', alignSelf: 'center' }} />
              {/* Category pills now filter by SLOT, not raw clothing_category.
                  "all" clears the filter; each slot button routes dress/top/bottom
                  under "Outfit", bag/accessory under "Accessories", etc. */}
              {[{ key: 'all', label: 'all', icon: '🏷️' }, ...SLOT_KEYS.map(k => ({ key: k, label: SLOT_DEFS[k].label.toLowerCase(), icon: SLOT_DEFS[k].icon }))].map(opt => (
                <button key={opt.key} onClick={() => setWardrobeCatFilter(opt.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: wardrobeCatFilter === opt.key ? '#6366f1' : '#fff',
                    color: wardrobeCatFilter === opt.key ? '#fff' : '#64748b',
                    border: wardrobeCatFilter === opt.key ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
              {/* Filters toggle — keeps the advanced panel out of the way by default
                  so the search row stays compact. Badge counts the non-default filters so
                  users can see at a glance whether anything is narrowing the list. */}
              {(() => {
                const extraCount = [wardrobeSeasonFilter, wardrobeOccasionFilter, wardrobeColorFilter, wardrobeStatusFilter].filter(v => v !== 'all').length;
                return (
                  <button onClick={() => setWardrobeFiltersOpen(o => !o)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: wardrobeFiltersOpen || extraCount > 0 ? '#1e293b' : '#fff',
                    color: wardrobeFiltersOpen || extraCount > 0 ? '#fff' : '#64748b',
                    border: `1px solid ${wardrobeFiltersOpen || extraCount > 0 ? '#1e293b' : '#e2e8f0'}`,
                  }}>⚙ Filters{extraCount > 0 ? ` (${extraCount})` : ''}</button>
                );
              })()}
            </div>

            {/* Advanced filter panel — status, season, occasion, color swatches */}
            {wardrobeFiltersOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={wardrobeStatusFilter} onChange={e => setWardrobeStatusFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">All items</option>
                    <option value="used">Used at least once</option>
                    <option value="unused">Never used</option>
                    <option value="favorites">♥ Favorites only</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Season</label>
                  <select value={wardrobeSeasonFilter} onChange={e => setWardrobeSeasonFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">Any season</option>
                    {['spring', 'summer', 'fall', 'winter', 'all-season'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Occasion</label>
                  <select value={wardrobeOccasionFilter} onChange={e => setWardrobeOccasionFilter(e.target.value)} style={{ ...S.sel, width: '100%', margin: 0 }}>
                    <option value="all">Any occasion</option>
                    {['gala', 'casual', 'formal', 'business', 'party', 'brunch', 'date_night', 'resort', 'editorial'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Color</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button onClick={() => setWardrobeColorFilter('all')} style={{
                      padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: wardrobeColorFilter === 'all' ? '#1e293b' : '#fff',
                      color: wardrobeColorFilter === 'all' ? '#fff' : '#64748b',
                      border: `1px solid ${wardrobeColorFilter === 'all' ? '#1e293b' : '#e2e8f0'}`,
                    }}>Any</button>
                    {Object.entries(COLOR_TO_HEX).map(([name, hex]) => {
                      const active = wardrobeColorFilter === name;
                      return (
                        <button key={name} onClick={() => setWardrobeColorFilter(active ? 'all' : name)} title={name} style={{
                          padding: '2px 6px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: active ? '#1e293b' : '#fff',
                          color: active ? '#fff' : '#334155',
                          border: `1px solid ${active ? '#1e293b' : '#e2e8f0'}`,
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
                      style={{ padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear filters</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Edit Panel ─── */}
            {editingWardrobeItem && (
              <div style={{
                background: '#fff', border: '2px solid #6366f1', borderRadius: 14, padding: 24, marginBottom: 16,
                boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(editingWardrobeItem.s3_url_processed || editingWardrobeItem.s3_url || editingWardrobeItem.thumbnail_url || editingWardrobeItem.image_url) && (
                      <img src={editingWardrobeItem.s3_url_processed || editingWardrobeItem.s3_url || editingWardrobeItem.thumbnail_url || editingWardrobeItem.image_url}
                        alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    )}
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Editing: {editingWardrobeItem.name}</h3>
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
                    <input value={wf.vendor} onChange={e => setWf('vendor', e.target.value)} style={S.inp} placeholder="Brand name..." />
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
                    <label style={S.fLabel}>Tags <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma-separated)</span></label>
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
                <div style={{ marginBottom: 16, padding: '12px 14px', background: '#faf7f0', border: '1px solid #e6d9b8', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 10 }}>🎮 GAMEPLAY</div>
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
                  <details style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed #e6d9b8' }}>
                    <summary style={{ fontSize: 12, fontWeight: 600, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
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
                          <label style={S.fLabel}>Aesthetic Tags <span style={{ fontWeight: 400, color: '#94a3b8' }}>(CSV)</span></label>
                          <input value={wf.aesthetic_tags || ''} onChange={e => setWf('aesthetic_tags', e.target.value)} style={S.inp} placeholder="romantic, bold, editorial" />
                        </div>
                        <div>
                          <label style={S.fLabel}>Event Types <span style={{ fontWeight: 400, color: '#94a3b8' }}>(CSV)</span></label>
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
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          <input type="checkbox" checked={!!wf.is_owned} onChange={e => setWf('is_owned', e.target.checked)} />
                          Lala already owns it
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
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
                      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                      const res = await fetch('/api/v1/wardrobe-library/analyze-image', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ wardrobe_id: editingWardrobeItem.id, showId }),
                      });
                      const data = await res.json();
                      if (data.success && data.data) {
                        const ai = data.data;
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
                  }} style={{ ...S.secBtn, background: '#FAF7F0', borderColor: '#D4AF37', color: '#B8962E' }}>
                    ✨ AI Enhance
                  </button>
                  <button onClick={async () => {
                    // Open the usage modal and lazy-fetch the episode list. The modal
                    // opens immediately with a loading placeholder so users aren't
                    // staring at a frozen button while the request is in flight.
                    setUsageModalItem(editingWardrobeItem);
                    setItemUsage(null);
                    try {
                      const res = await fetch(`/api/v1/wardrobe/${editingWardrobeItem.id}/usage`);
                      const data = await res.json();
                      if (res.ok) setItemUsage(data.data || data);
                      else setToast(data.error || 'Could not load usage');
                    } catch (err) { setToast('Could not load usage'); }
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
            <div style={{
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

                const isListMode = wardrobeViewMode === 'list';
                return (
                  <div key={item.id} onClick={() => openEditItem(item)}
                    style={{
                      background: '#fff',
                      border: isBulkSelected ? '2px solid #eab308' : isEditing ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      borderRadius: 12,
                      overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: isBulkSelected ? '0 4px 16px rgba(234,179,8,0.25)' : isEditing ? '0 4px 16px rgba(99,102,241,0.2)' : 'none',
                      position: 'relative',
                      display: isListMode ? 'flex' : undefined,
                      alignItems: isListMode ? 'stretch' : undefined,
                    }}
                    onMouseEnter={e => { if (!isEditing && !isBulkSelected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { if (!isEditing && !isBulkSelected) e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  >
                    {/* Selection checkbox */}
                    <div 
                      onClick={(e) => toggleSelectItem(e, item.id)}
                      style={{ 
                        position: 'absolute', top: 8, left: 8, zIndex: 10, 
                        width: 20, height: 20, borderRadius: 4,
                        background: isBulkSelected ? '#eab308' : 'rgba(255,255,255,0.9)',
                        border: isBulkSelected ? '2px solid #eab308' : '2px solid #d1d5db',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {isBulkSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
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
                          await fetch(`/api/v1/wardrobe/${item.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_favorite: next }),
                          });
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
                        border: item.is_favorite ? '1px solid #dc2626' : '1px solid #d1d5db',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1,
                        color: item.is_favorite ? '#fff' : '#9ca3af',
                      }}
                    >♥</button>

                    {/* Continuity warning badge */}
                    {hasRecentUsage && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 10,
                        padding: '2px 6px', background: '#fef3c7', border: '1px solid #fcd34d',
                        borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#92400e',
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
                        background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
                      }}
                      onClick={(e) => { if (imgUrl) { e.stopPropagation(); setLightboxVariant(null); setLightboxItem(item); } }}
                    >
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc' }}
                          onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      ) : null}
                      <div style={{ display: imgUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 48, color: '#cbd5e1' }}>
                        {CAT_ICONS[itemType] || '👗'}
                      </div>
                      {/* Expand icon on hover */}
                      {imgUrl && (
                        <div style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 10, color: '#fff', opacity: 0.7 }}>
                          🔍
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                        {CAT_ICONS[itemType] || '🏷️'} {itemType || 'item'}
                        {item.color && <span> · {item.color}</span>}
                        {item.vendor && <span> · {item.vendor}</span>}
                      </div>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                          {tags.slice(0, 3).map((tag, i) => (
                            <span key={i} style={{ padding: '1px 6px', background: '#f3e8ff', borderRadius: 4, fontSize: 9, color: '#7c3aed' }}>{tag}</span>
                          ))}
                          {tags.length > 3 && <span style={{ fontSize: 9, color: '#94a3b8' }}>+{tags.length - 3}</span>}
                        </div>
                      )}

                      {/* Bottom row: price + usage */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        {item.price ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>${parseFloat(item.price).toFixed(0)}</span>
                        ) : <span />}
                        {(item.totalUsageCount || item.total_usage_count) > 0 && (
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>Used {item.totalUsageCount || item.total_usage_count}x</span>
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
                  style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#334155', fontSize: 12, fontWeight: 600 }}>← Prev</button>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
                  Page {currentPage} of {totalPages} · {filteredItems.length} items
                </span>
                <button onClick={() => setWardrobePage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#cbd5e1' : '#334155', fontSize: 12, fontWeight: 600 }}>Next →</button>
              </div>
            )}

            {/* Empty state */}
            {filteredItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👗</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {wardrobeItems.length === 0 ? 'No wardrobe items yet' : 'No items match your search'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  {wardrobeItems.length === 0
                    ? 'Upload your first wardrobe piece to start building the closet.'
                    : 'Try a different search term or category filter.'}
                </div>
                {wardrobeItems.length === 0 && (
                  <button onClick={() => { setWardrobeUploadForm({ name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '', isFavorite: false, coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '', aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '', isOwned: false, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '' }); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); setShowWardrobeUpload(true); }} style={S.primaryBtn}>
                    + Upload First Item
                  </button>
                )}
              </div>
            )}

            {/* ── Upload Modal ── */}
            {showWardrobeUpload && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !wardrobeUploading && setShowWardrobeUpload(false)}>
                <div style={{ background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2C2C2C' }}>Add Wardrobe Item</h3>
                    <button onClick={() => setShowWardrobeUpload(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
                  </div>

                  {/* Image drop zone */}
                  <div
                    style={{ border: '1.5px dashed #d1ccc0', borderRadius: 10, background: wardrobeUploadPreview ? '#fff' : '#faf9f6', marginBottom: 12, cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => document.getElementById('wardrobe-upload-input')?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) { setWardrobeUploadFile(f); setWardrobeUploadPreview(URL.createObjectURL(f)); } }}
                  >
                    {wardrobeUploadPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={wardrobeUploadPreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block', padding: 8 }} />
                        <button type="button" onClick={e => { e.stopPropagation(); setWardrobeUploadFile(null); setWardrobeUploadPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#bbb' }}>
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
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Auto-fill failed</div>
                      <div>{wardrobeAutoFillError}</div>
                      {/ANTHROPIC_API_KEY/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#7f1d1d' }}>
                          The dev server is missing an Anthropic API key. Ask an admin to set <code>ANTHROPIC_API_KEY</code> in EC2 .env and restart PM2.
                        </div>
                      )}
                      {/Failed to fetch|NetworkError|ERR_/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#7f1d1d' }}>
                          The request didn't reach the server. Usually one of:
                          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            <li>Backend not yet running the latest build (ask an admin to check <code>pm2 status</code>)</li>
                            <li>A stale Service Worker is intercepting — try a hard refresh (<code>Cmd/Ctrl+Shift+R</code>) or DevTools → Application → Service Workers → Unregister</li>
                            <li>Browser extension blocking the request (disable ad/privacy blockers on this tab)</li>
                          </ul>
                        </div>
                      )}
                      {/^(413|payload too large)/i.test(wardrobeAutoFillError) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#7f1d1d' }}>
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
                        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                        // Abort after 120s — Claude vision on a large image can take
                        // 30-60s under load, but anything beyond 2 min means the
                        // upstream is hung and we should surface that to the user.
                        const ac = new AbortController();
                        const timeout = setTimeout(() => ac.abort(), 120000);
                        let res;
                        try {
                          res = await fetch(`/api/v1/wardrobe-library/analyze-image`, { method: 'POST', body: fd, headers: token ? { 'Authorization': `Bearer ${token}` } : {}, signal: ac.signal });
                        } finally {
                          clearTimeout(timeout);
                        }
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data.success || !data.data) {
                          const msg = data.error || `${res.status} ${res.statusText || 'request failed'}`;
                          console.error('[Auto-fill] backend rejected:', msg, data);
                          setWardrobeAutoFillError(msg);
                          return;
                        }
                        const ai = data.data;
                        const catMap = { dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes', accessory: 'accessory', jewelry: 'jewelry', bag: 'bag', outerwear: 'outerwear', perfume: 'perfume', skirt: 'bottom', pants: 'bottom', shirt: 'top', blouse: 'top', fragrance: 'perfume' };
                        let aiPrice = '';
                        if (ai.price_estimate) { const n = parseFloat(String(ai.price_estimate).replace(/[^0-9.]/g, '')); aiPrice = n && n >= 150 ? n.toFixed(2) : '150.00'; }
                        // Coin cost — per user: "how much the outfit is", so default
                        // to the AI's coin_cost if provided, else 1:1 with the dollar
                        // price. Integer only since the Wardrobe model stores it as INT.
                        const aiCoinCost = ai.coin_cost != null
                          ? parseInt(String(ai.coin_cost).replace(/[^0-9]/g, ''), 10) || ''
                          : (aiPrice ? parseInt(aiPrice, 10) : '');
                        setWardrobeUploadForm(prev => ({
                          ...prev,
                          name: ai.name || prev.name,
                          clothingCategory: catMap[ai.item_type?.toLowerCase()] || prev.clothingCategory,
                          color: ai.color || prev.color,
                          brand: ai.brand_guess || prev.brand,
                          price: aiPrice || prev.price,
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
                            coinCost: prev.coinCost || aiCoinCost,
                            acquisitionType: prev.acquisitionType === 'purchased' && ai.acquisition_type ? ai.acquisition_type : (prev.acquisitionType || 'purchased'),
                            lockType: prev.lockType === 'none' && ai.lock_type ? ai.lock_type : (prev.lockType || 'none'),
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
                    }} style={{ width: '100%', padding: '8px 0', border: 'none', borderRadius: 6, background: '#B8962E', color: '#fff', cursor: wardrobeAnalyzing ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 11, opacity: wardrobeAnalyzing ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                      {wardrobeAnalyzing ? '⏳ Analyzing...' : '✨ Auto-fill from image'}
                    </button>
                  )}

                  {/* Form fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>name *</label><input value={wardrobeUploadForm.name} onChange={e => setWardrobeUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Floral Mini Dress" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>brand</label><input value={wardrobeUploadForm.brand} onChange={e => setWardrobeUploadForm(p => ({ ...p, brand: e.target.value }))} placeholder="e.g., Zara" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>category *</label>
                        {/* Grouped by the five UI slots (Outfit / Shoes / Jewelry /
                            Accessories / Fragrance) — DB still stores the granular
                            clothing_category so scoring + filters keep working. */}
                        <select value={wardrobeUploadForm.clothingCategory} onChange={e => setWardrobeUploadForm(p => ({ ...p, clothingCategory: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fdfcfa' }}>
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
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>color</label><input value={wardrobeUploadForm.color} onChange={e => setWardrobeUploadForm(p => ({ ...p, color: e.target.value }))} placeholder="e.g., blush pink" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                      <div>
                        <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>tier</label>
                        {/* Tier descriptors mirror the old WardrobeBrowser edit form so the
                            gameplay context is obvious — e.g. "Luxury" isn't just a label,
                            it signals Designer-tier in-story. */}
                        <select value={wardrobeUploadForm.tier || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, tier: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fdfcfa' }}>
                          <option value="">Auto</option>
                          <option value="basic">👟 Basic — Fast Fashion</option>
                          <option value="mid">👠 Mid — Contemporary</option>
                          <option value="luxury">💎 Luxury — Designer</option>
                          <option value="elite">👑 Elite — Haute Couture</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>price</label><input type="number" value={wardrobeUploadForm.price} onChange={e => setWardrobeUploadForm(p => ({ ...p, price: e.target.value }))} placeholder="650.00" step="0.01" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>season</label><select value={wardrobeUploadForm.season || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, season: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fdfcfa' }}><option value="">Any</option>{['spring', 'summer', 'fall', 'winter', 'all-season'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>occasion</label><input value={wardrobeUploadForm.occasion || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, occasion: e.target.value }))} placeholder="gala, casual..." style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                    </div>
                    <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>description</label><textarea value={wardrobeUploadForm.description || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, description: e.target.value }))} placeholder="Material, style, fit, notable details..." rows={2} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa', resize: 'vertical', boxSizing: 'border-box' }} /></div>
                    <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>tags (comma-separated)</label><input value={wardrobeUploadForm.tags || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, tags: e.target.value }))} placeholder="elegant, evening, silk" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>
                    {/* Purchase link so creators can source the real-world item later. Backend maps website → purchase_link. */}
                    <div><label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>website / purchase link</label><input type="url" value={wardrobeUploadForm.website || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fdfcfa' }} /></div>

                    {/* ── Gameplay section ─────────────────────────────────
                        Fields that drive the in-story unlock/purchase flow. Kept
                        visually separate from the "what is this thing?" fields
                        above so creators can scan past if they're just logging
                        a piece without gameplay intent. */}
                    <div style={{ marginTop: 4, padding: '10px 12px', background: '#faf7f0', border: '1px solid #e6d9b8', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 8 }}>🎮 GAMEPLAY (OPTIONAL)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>story price (LalaVerse coins)</label>
                          <input type="number" min="0" step="1" value={wardrobeUploadForm.coinCost || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, coinCost: e.target.value }))} placeholder="e.g., 2400" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>how Lala got it</label>
                          <select value={wardrobeUploadForm.acquisitionType || 'purchased'} onChange={e => setWardrobeUploadForm(p => ({ ...p, acquisitionType: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                            {['purchased', 'gifted', 'borrowed', 'rented', 'custom', 'vintage'].map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>lock type</label>
                          <select value={wardrobeUploadForm.lockType || 'none'} onChange={e => setWardrobeUploadForm(p => ({ ...p, lockType: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                            <option value="none">None (always available)</option>
                            <option value="coin">🪙 Coin (pay to unlock)</option>
                            <option value="reputation">⭐ Reputation gate</option>
                            <option value="brand_exclusive">🔒 Brand exclusive</option>
                            <option value="season_drop">📅 Season drop</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>era alignment</label>
                          <select value={wardrobeUploadForm.eraAlignment || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, eraAlignment: e.target.value }))} style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff' }}>
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
                          <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>reputation required</label>
                          <input type="number" min="0" step="1" value={wardrobeUploadForm.reputationRequired || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, reputationRequired: e.target.value }))} placeholder="e.g., 5" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
                        </div>
                      )}

                      {/* ── Advanced gameplay (expandable) ─────────────────────
                          Collapsed by default so creators logging a piece don't see
                          12 extra inputs. Expand only when the item needs Lala
                          reaction blurbs, aesthetic/event tag buckets, or the rarer
                          scoring/gate knobs. */}
                      <details style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e6d9b8' }}>
                        <summary style={{ fontSize: 11, fontWeight: 600, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
                          ⋯ advanced gameplay
                        </summary>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Lala reaction blurbs — what she says about this item in three states. */}
                          <div>
                            <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when she owns it)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionOwn || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionOwn: e.target.value }))} placeholder="e.g., 'My ride-or-die for red carpets'" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when locked)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionLocked || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionLocked: e.target.value }))} placeholder="e.g., 'One day...'" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>Lala reaction (when rejected)</label>
                            <textarea rows={2} value={wardrobeUploadForm.lalaReactionReject || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, lalaReactionReject: e.target.value }))} placeholder="e.g., 'Not the vibe for tonight'" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          {/* Tag buckets — distinct from the basic `tags` field above. */}
                          <div>
                            <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>aesthetic tags (CSV)</label>
                            <input value={wardrobeUploadForm.aestheticTags || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, aestheticTags: e.target.value }))} placeholder="romantic, bold, editorial" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>event types (CSV)</label>
                            <input value={wardrobeUploadForm.eventTypes || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, eventTypes: e.target.value }))} placeholder="gala, brunch, meetup" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, fontFamily: "'Lora', serif", background: '#fff', boxSizing: 'border-box' }} />
                          </div>
                          {/* Numeric knobs — match-weight is 1-10, the rest are natural units. */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>match weight (1-10)</label>
                              <input type="number" min="1" max="10" step="1" value={wardrobeUploadForm.outfitMatchWeight || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, outfitMatchWeight: e.target.value }))} placeholder="5" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>influence required</label>
                              <input type="number" min="0" step="1" value={wardrobeUploadForm.influenceRequired || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, influenceRequired: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>unlock ep #</label>
                              <input type="number" min="1" step="1" value={wardrobeUploadForm.seasonUnlockEpisode || ''} onChange={e => setWardrobeUploadForm(p => ({ ...p, seasonUnlockEpisode: e.target.value }))} placeholder="1" style={{ width: '100%', padding: '7px 9px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          {/* Visibility flags — is_visible defaults true so this only
                              surfaces for authors who want to hide an item or mark it owned up front. */}
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                              <input type="checkbox" checked={!!wardrobeUploadForm.isOwned} onChange={e => setWardrobeUploadForm(p => ({ ...p, isOwned: e.target.checked }))} />
                              Lala already owns it
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                              <input type="checkbox" checked={wardrobeUploadForm.isVisible !== false} onChange={e => setWardrobeUploadForm(p => ({ ...p, isVisible: e.target.checked }))} />
                              Visible in closet
                            </label>
                          </div>
                        </div>
                      </details>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      <input type="checkbox" checked={!!wardrobeUploadForm.isFavorite} onChange={e => setWardrobeUploadForm(p => ({ ...p, isFavorite: e.target.checked }))} />
                      ♥ Mark as favorite
                    </label>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #ece5d5' }}>
                    <button onClick={() => setShowWardrobeUpload(false)} style={{ padding: '7px 18px', border: '1px solid #e0d9cc', borderRadius: 6, background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button disabled={wardrobeUploading || !wardrobeUploadFile || !wardrobeUploadForm.name || !wardrobeUploadForm.clothingCategory} onClick={async () => {
                      setWardrobeUploading(true);
                      try {
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
                        if (wardrobeUploadForm.isOwned) fd.append('isOwned', 'true');
                        if (wardrobeUploadForm.isVisible === false) fd.append('isVisible', 'false');
                        if (wardrobeUploadForm.lalaReactionOwn) fd.append('lalaReactionOwn', wardrobeUploadForm.lalaReactionOwn);
                        if (wardrobeUploadForm.lalaReactionLocked) fd.append('lalaReactionLocked', wardrobeUploadForm.lalaReactionLocked);
                        if (wardrobeUploadForm.lalaReactionReject) fd.append('lalaReactionReject', wardrobeUploadForm.lalaReactionReject);
                        fd.append('showId', showId);
                        const res = await fetch('/api/v1/wardrobe', { method: 'POST', body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          setWardrobeItems(prev => [data.data, ...prev]);
                          setShowWardrobeUpload(false);
                          setToast('Item uploaded!'); setTimeout(() => setToast(null), 2500);
                        } else { const err = await res.json(); setToast(err.error || 'Upload failed'); }
                      } catch (err) { setToast('Upload failed: ' + err.message); }
                      setWardrobeUploading(false);
                    }} style={{ padding: '7px 22px', border: 'none', borderRadius: 6, background: '#2C2C2C', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (wardrobeUploading || !wardrobeUploadFile || !wardrobeUploadForm.name || !wardrobeUploadForm.clothingCategory) ? 0.35 : 1 }}>
                      {wardrobeUploading ? 'Uploading...' : 'Upload Item'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Finance Editor Modal ── */}
            {financeEditorOpen && financeEditorDraft && (() => {
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
                  setFinanceEditorOpen(false);
                  setToast('Finance config saved');
                } catch (err) {
                  setToast('Save failed: ' + (err.response?.data?.error || err.message));
                } finally {
                  setFinanceEditorSaving(false);
                }
              };
              return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !financeEditorSaving && setFinanceEditorOpen(false)}>
                  <div style={{ background: '#fff', borderRadius: 14, maxWidth: 760, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💰 Finance</h3>
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
                              setToast(`Finance apps: ${created} created${placed ? ', icons placed on home screen' : ' (place manually in UI Overlays)'}`);
                            } catch (err) {
                              setToast('Seed failed: ' + (err.response?.data?.error || err.message));
                            }
                          }}
                          title="Create 4 finance apps (Wallet, Insights, Breakdowns, Goals) on Lala's phone. Closet Value content zones go on your existing Closet screen."
                          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #fbcfe8', borderRadius: 6, background: 'linear-gradient(135deg, #FBCFE8 0%, #14B8A6 100%)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >📱 Seed Finance Apps</button>
                        <button onClick={() => setFinanceEditorOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
                      </div>
                    </div>

                    {/* Tab bar — switches between Overview (dashboard), Per-Episode
                        (the P&L table), and Goals (starting balance + ladder editor). */}
                    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
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
                              borderBottom: active ? '2px solid #B8962E' : '2px solid transparent',
                              color: active ? '#1a1a2e' : '#64748b',
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
                        {financeSummaryLoading && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading summary…</div>}
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
                              <div style={{ padding: '14px 16px', background: '#faf7f0', border: '1px solid #e6d9b8', borderRadius: 10 }}>
                                <div style={{ fontSize: 11, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 4 }}>CURRENT BALANCE</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: '#1a1a2e', fontFamily: "'DM Mono', monospace" }}>
                                  💰 {balance.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginLeft: 8 }}>coins</span>
                                </div>
                                {nextGoal && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                      <span style={{ color: '#854d0e', fontWeight: 600 }}>Next: {nextGoal.label}{nextGoal.episode_id && <span style={{ fontSize: 9, fontWeight: 500, color: '#a16207', marginLeft: 4 }}>· ep-scoped</span>}</span>
                                      <span style={{ color: '#854d0e', fontFamily: "'DM Mono', monospace" }}>{balance.toLocaleString()} / {Number(nextGoal.threshold).toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${progress * 100}%`, height: '100%', background: balance >= Number(nextGoal.threshold) ? '#16a34a' : '#d4a017', transition: 'width 0.3s' }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* KPI strip */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                                {[
                                  { label: 'Lifetime income', value: `+${(t.lifetime_income || 0).toLocaleString()}`, color: '#16a34a' },
                                  { label: 'Lifetime expenses', value: `-${(t.lifetime_expenses || 0).toLocaleString()}`, color: '#dc2626' },
                                  { label: 'Lifetime net', value: `${(t.net || 0) >= 0 ? '+' : ''}${(t.net || 0).toLocaleString()}`, color: (t.net || 0) >= 0 ? '#16a34a' : '#dc2626' },
                                  { label: 'Burn rate', value: `${financeSummary.burn_rate_per_episode.toLocaleString()}/ep`, color: '#1a1a2e' },
                                  { label: 'Avg income', value: `${(financeSummary.avg_income_per_episode || 0).toLocaleString()}/ep`, color: '#1a1a2e' },
                                  { label: 'Runway', value: financeSummary.runway_episodes != null ? `${financeSummary.runway_episodes} eps` : '∞', color: '#1a1a2e' },
                                ].map(kpi => (
                                  <div key={kpi.label} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    <div style={{ fontSize: 9, color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>{kpi.label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{kpi.value}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Sparkline — last 12 episodes' ending balance. Rendered with
                                  inline SVG (no chart library) so it survives any CSP + is
                                  fast to paint. Each point is scaled into the 0-100 range */}
                              {recentTrend.length > 1 && (
                                <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                  <div style={{ fontSize: 10, color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Balance — last {recentTrend.length} episodes</div>
                                  <svg viewBox={`0 0 100 40`} preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
                                    {/* Zero line */}
                                    {minBal < 0 && (
                                      <line x1="0" y1={40 - ((0 - minBal) / range) * 40} x2="100" y2={40 - ((0 - minBal) / range) * 40} stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="1,1" />
                                    )}
                                    <polyline
                                      points={recentTrend.map((p, i) => {
                                        const x = (i / Math.max(1, recentTrend.length - 1)) * 100;
                                        const y = 40 - ((p.balance_after - minBal) / range) * 40;
                                        return `${x},${y}`;
                                      }).join(' ')}
                                      fill="none"
                                      stroke="#B8962E"
                                      strokeWidth="0.8"
                                      vectorEffect="non-scaling-stroke"
                                    />
                                    {recentTrend.map((p, i) => {
                                      const x = (i / Math.max(1, recentTrend.length - 1)) * 100;
                                      const y = 40 - ((p.balance_after - minBal) / range) * 40;
                                      return <circle key={i} cx={x} cy={y} r="0.8" fill={p.net >= 0 ? '#16a34a' : '#dc2626'} vectorEffect="non-scaling-stroke" />;
                                    })}
                                  </svg>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                                    <span>Ep {recentTrend[0]?.episode_number || '?'}</span>
                                    <span>Ep {recentTrend[recentTrend.length - 1]?.episode_number || '?'}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {!financeSummaryLoading && !financeSummary && (
                          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
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
                          <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', color: '#64748b', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.4 }}>
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
                                  <tr key={e.episode_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '7px 10px', fontFamily: "'DM Mono', monospace", color: '#64748b' }}>{e.episode_number ?? '—'}</td>
                                    <td style={{ padding: '7px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title || '(untitled)'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#dc2626' }}>{e.outfit_cost ? `-${e.outfit_cost.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#dc2626' }}>{e.event_cost ? `-${e.event_cost.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#16a34a' }}>{e.task_rewards ? `+${e.task_rewards.toLocaleString()}` : '—'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700, color: e.net >= 0 ? '#16a34a' : '#dc2626' }}>{e.net >= 0 ? '+' : ''}{e.net.toLocaleString()}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#1a1a2e' }}>{e.balance_after.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 30 }}>
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
                        {!financeBreakdowns && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>No breakdown data yet.</div>}
                        {financeBreakdowns && (() => {
                          const incomeMax = Math.max(1, ...(financeBreakdowns.income?.breakdown || []).map(r => r.total));
                          const expenseMax = Math.max(1, ...(financeBreakdowns.expenses?.breakdown || []).map(r => r.total));
                          const renderBars = (items, max, color) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {items.map(r => (
                                <div key={r.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 140, fontSize: 11, color: '#475569', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</div>
                                  <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                                  </div>
                                  <div style={{ width: 80, fontSize: 11, textAlign: 'right', fontFamily: "'DM Mono', monospace", color, fontWeight: 700 }}>
                                    {r.total.toLocaleString()}
                                  </div>
                                  <div style={{ width: 30, fontSize: 9, textAlign: 'right', color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>×{r.tx_count}</div>
                                </div>
                              ))}
                            </div>
                          );
                          return (
                            <>
                              <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>INCOME BY SOURCE</span>
                                  <span style={{ fontSize: 11, color: '#16a34a', fontFamily: "'DM Mono', monospace" }}>total +{(financeBreakdowns.income?.total || 0).toLocaleString()}</span>
                                </div>
                                {(financeBreakdowns.income?.breakdown || []).length > 0
                                  ? renderBars(financeBreakdowns.income.breakdown, incomeMax, '#16a34a')
                                  : <div style={{ fontSize: 11, color: '#16a34a80', textAlign: 'center', padding: 10 }}>No income recorded yet.</div>}
                              </div>
                              <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>EXPENSES BY CATEGORY</span>
                                  <span style={{ fontSize: 11, color: '#dc2626', fontFamily: "'DM Mono', monospace" }}>total -{(financeBreakdowns.expenses?.total || 0).toLocaleString()}</span>
                                </div>
                                {(financeBreakdowns.expenses?.breakdown || []).length > 0
                                  ? renderBars(financeBreakdowns.expenses.breakdown, expenseMax, '#dc2626')
                                  : <div style={{ fontSize: 11, color: '#dc262680', textAlign: 'center', padding: 10 }}>No expenses recorded yet.</div>}
                              </div>
                              <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
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
                        {!financeBreakdowns?.closet && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>No closet data yet.</div>}
                        {financeBreakdowns?.closet && (() => {
                          const c = financeBreakdowns.closet;
                          return (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                                <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: '#16a34a', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Owned closet value</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{c.owned_value.toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: '#16a34a80', marginTop: 2 }}>{c.owned_count} pieces</div>
                                </div>
                                <div style={{ padding: 12, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: '#4338ca', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Wishlist potential</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: '#4338ca', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{c.unowned_value.toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: '#4338ca80', marginTop: 2 }}>{c.unowned_count} pieces unowned</div>
                                </div>
                                <div style={{ padding: 12, background: '#faf7f0', border: '1px solid #e6d9b8', borderRadius: 10 }}>
                                  <div style={{ fontSize: 9, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>Total catalog</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{(c.owned_value + c.unowned_value).toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: '#8a6d1f80', marginTop: 2 }}>{c.owned_count + c.unowned_count} pieces total</div>
                                </div>
                              </div>
                              {c.wishlist && c.wishlist.length > 0 && (
                                <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 8 }}>💎 TOP 5 DREAM PIECES</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {c.wishlist.map(w => (
                                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, background: '#faf7f0', borderRadius: 6 }}>
                                        {w.image_url && <img src={w.image_url} alt={w.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                                          <div style={{ fontSize: 10, color: '#64748b' }}>{w.brand || '—'} · {w.tier || 'basic'}</div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
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
                      <div style={{ marginBottom: 16, padding: '12px 14px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>🤖 SUGGESTED GOALS</span>
                          <span style={{ fontSize: 10, color: '#6366f1' }}>— derived from your balance + calendar + closet</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {financeSuggestions.map(sug => {
                            const already = sug.already_exists || d.goals.some(g => g.id === sug.id || Number(g.threshold) === Number(sug.threshold));
                            return (
                              <div key={sug.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #e0e7ff', opacity: already ? 0.55 : 1 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                                    {sug.label}
                                    <span style={{ marginLeft: 8, fontSize: 10, color: '#6366f1', fontFamily: "'DM Mono', monospace" }}>
                                      {Number(sug.threshold).toLocaleString()} coins · +{Number(sug.reward_coins).toLocaleString()} reward
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sug.description}</div>
                                  <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: "'DM Mono', monospace", fontStyle: 'italic', marginTop: 2 }}>{sug.rationale}</div>
                                </div>
                                {already ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', padding: '4px 10px', background: '#f0fdf4', borderRadius: 5 }}>✓ Added</span>
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
                                    style={{ padding: '5px 14px', fontSize: 11, fontWeight: 700, border: '1px solid #6366f1', borderRadius: 5, background: '#6366f1', color: '#fff', cursor: 'pointer' }}
                                  >+ Add</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Starting balance */}
                    <div style={{ padding: '12px 14px', background: '#faf7f0', border: '1px solid #e6d9b8', borderRadius: 10, marginBottom: 14 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: '#8a6d1f', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>Starting balance (coins)</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={d.starting_balance}
                          onChange={e => setDraft({ starting_balance: e.target.value })}
                          style={{ ...S.inp, flex: 1, margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700 }}
                        />
                        <span style={{ fontSize: 11, color: '#8a6d1f' }}>coins</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                        Current balance: {(financeConfig?.current_balance ?? 0).toLocaleString()} coins. Saving will re-seed the starting balance — non-seed transactions stay intact.
                      </div>
                    </div>

                    {/* Goals ladder */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>Milestone ladder ({d.goals.length})</label>
                        <button onClick={addGoal} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9cc', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#334155' }}>+ Add goal</button>
                      </div>
                      {d.goals.length === 0 && (
                        <div style={{ fontSize: 12, color: '#94a3b8', padding: 12, textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
                          No milestones yet. Add one above.
                        </div>
                      )}
                      {d.goals.map((g, i) => (
                        <div key={g.id || i} style={{ padding: 10, marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, background: g.triggered_at ? '#f0fdf4' : '#fff' }}>
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
                              style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', cursor: 'pointer', padding: '0 10px', fontSize: 14 }}
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
                            <label style={{ fontSize: 10, color: '#8a7e65', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>EPISODE:</label>
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
                            <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                              ✓ Triggered {new Date(g.triggered_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: '1px solid #f0ece4' }}>
                      <button onClick={() => setFinanceEditorOpen(false)} disabled={financeEditorSaving} style={{ ...S.secBtn, padding: '7px 16px' }}>Cancel</button>
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

            {/* ── Create Outfit Set Modal ── */}
            {showCreateOutfitSet && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !creatingOutfitSet && setShowCreateOutfitSet(false)}>
                <div style={{ background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Create Outfit Set</h3>
                    <button onClick={() => setShowCreateOutfitSet(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>
                    {selectedWardrobeIds.size} pieces selected
                  </div>
                  {/* Piece chips — visual confirmation of what goes into the set. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {Array.from(selectedWardrobeIds).map(id => {
                      const item = wardrobeItems.find(w => w.id === id);
                      if (!item) return null;
                      const img = item.s3_url_processed || item.s3_url || item.thumbnail_url;
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px' }}>
                          {img && <img src={img} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                          <span style={{ fontSize: 11, color: '#334155' }}>{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <label style={{ fontSize: 11, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>set name</label>
                  <input
                    type="text"
                    value={outfitSetName}
                    onChange={e => setOutfitSetName(e.target.value)}
                    placeholder="e.g., Floral Corset Set"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 14, fontFamily: "'Lora', serif", marginTop: 4, marginBottom: 16, boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setShowCreateOutfitSet(false)} style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
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
                          const res = await fetch('/api/v1/outfit-sets', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: outfitSetName.trim(), character: 'Lala', items: payloadItems, show_id: showId }),
                          });
                          if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Create failed'); }
                          setToast(`Outfit set "${outfitSetName.trim()}" created`);
                          setShowCreateOutfitSet(false);
                          setSelectedWardrobeIds(new Set());
                        } catch (err) { setToast('Failed to create set: ' + err.message); }
                        setCreatingOutfitSet(false);
                      }}
                      style={{ padding: '7px 22px', border: 'none', borderRadius: 6, background: '#2C2C2C', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!outfitSetName.trim() || creatingOutfitSet) ? 0.4 : 1 }}
                    >{creatingOutfitSet ? 'Creating...' : 'Create set'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Usage Modal — which episodes reference this item ── */}
            {usageModalItem && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setUsageModalItem(null); setItemUsage(null); }}>
                <div style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Item Usage: {usageModalItem.name}</h3>
                    <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
                  </div>
                  {/* Three states: loading, empty, populated — matches the existing WardrobeBrowser modal. */}
                  {itemUsage == null ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading usage data...</div>
                  ) : !itemUsage.totalEpisodes ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                      <p style={{ margin: '4px 0', fontSize: 13, color: '#334155' }}>This item isn't used in any episodes yet.</p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: '#94a3b8' }}>It can be safely deleted.</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                        <div><strong>Total episodes:</strong> {itemUsage.totalEpisodes}</div>
                        <div><strong>Total shows:</strong> {itemUsage.totalShows}</div>
                      </div>
                      {(itemUsage.shows || []).map(show => (
                        <div key={show.showId} style={{ marginBottom: 14 }}>
                          <h4 style={{ margin: '4px 0 6px', fontSize: 13, color: '#1e293b' }}>{show.showName || 'Unknown Show'}</h4>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                            {(show.episodes || []).map(ep => (
                              <li key={ep.episodeId}>Episode {ep.episodeNumber}: {ep.title}{ep.isFavorite && <span style={{ marginLeft: 4, color: '#eab308' }}>★</span>}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} style={{ padding: '7px 20px', border: 'none', borderRadius: 6, background: '#2C2C2C', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Close</button>
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
                      style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', padding: 8 }}
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
                                background: isActive ? '#fff' : 'rgba(255,255,255,0.15)',
                                color: isActive ? '#1a1a2e' : '#fff',
                                border: isActive ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)',
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
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{lightboxItem.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {CAT_ICONS[itemType] || '🏷️'} {itemType || 'item'}
                          {lightboxItem.color && <span> · {lightboxItem.color}</span>}
                          {lightboxItem.vendor && <span> · {lightboxItem.vendor}</span>}
                          {lightboxItem.price && <span style={{ color: '#16a34a', fontWeight: 600 }}> · ${parseFloat(lightboxItem.price).toFixed(0)}</span>}
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
                          style={{ marginLeft: 'auto', padding: '6px 14px', background: promotingVariant ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: promotingVariant ? 'wait' : 'pointer' }}
                        >{promotingVariant ? 'Saving…' : '★ Set as default'}</button>
                      )}
                      {/* "Send to phone" only makes sense for a colored-backdrop
                          variant — the phone uses it as a screen background. */}
                      {active && ['pink', 'blue', 'teal'].includes(active.key) && (
                        <button
                          onClick={() => handleSendToPhone(lightboxItem, active.key)}
                          disabled={sendingToPhone}
                          title={`Create a Lala's-phone screen from the ${active.label} variant — opens the overlay editor so you can draw tap zones`}
                          style={{ marginLeft: (active && active.key !== currentPrimary) ? 0 : 'auto', padding: '6px 14px', background: sendingToPhone ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: sendingToPhone ? 'wait' : 'pointer' }}
                        >{sendingToPhone ? 'Sending…' : '📱 Send to phone'}</button>
                      )}
                      <button
                        onClick={() => handleRegenerateProductShot(lightboxItem)}
                        disabled={regeneratingItemId === lightboxItem.id}
                        title="AI image-to-image — swaps backdrop, removes hangers/dress-form residue, simulates invisible mannequin (~$0.04)"
                        style={{ padding: '6px 14px', background: regeneratingItemId === lightboxItem.id ? '#94a3b8' : '#db2777', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: regeneratingItemId === lightboxItem.id ? 'wait' : 'pointer' }}
                      >{regeneratingItemId === lightboxItem.id ? 'Regenerating…' : '🎨 Regenerate'}</button>
                      <button
                        onClick={() => { setLightboxVariant(null); setLightboxItem(null); openEditItem(lightboxItem); }}
                        style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
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
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👑</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Lala</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Main Character · AI Avatar</p>
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
                      <span style={{ flex: '0 0 100px', fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      {editingStats ? (
                        <input type="number" value={statForm[key] ?? val} onChange={e => setStatForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                          style={{ width: 80, padding: '4px 8px', border: '1px solid #6366f1', borderRadius: 4, fontSize: 14, fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}
                          min={key === 'coins' ? -9999 : 0} max={key === 'coins' ? 99999 : 10} />
                      ) : (
                        <>
                          {barMax != null ? (
                            <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (val / barMax) * 100))}%`, borderRadius: 5, background: key === 'stress' ? (val >= 5 ? '#dc2626' : '#eab308') : isCoin ? (val < 0 ? '#dc2626' : '#6366f1') : '#6366f1', transition: 'width 0.3s' }} />
                            </div>
                          ) : (
                            <div style={{ flex: 1, fontSize: 11, color: '#94a3b8', textAlign: 'right', paddingRight: 8 }}>
                              {isCoin ? 'no active goal' : ''}
                            </div>
                          )}
                          <span style={{ flex: '0 0 60px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: (key === 'stress' && val >= 5) || (isCoin && val < 0) ? '#dc2626' : '#1a1a2e' }}>
                            {isCoin ? Number(val).toLocaleString() : val}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <p style={S.muted}>No stats initialized. Evaluate an episode to auto-seed defaults.</p>}

            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Character Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Voice Activation', 'Required ✅'],
                  ['Idle Behaviors', 'Wave, mirror glance, inspect'],
                  ['Default Stats', '500 coins, 1 rep, 1 trust, 1 inf, 0 stress'],
                  ['Fail Behavior', 'Forced smile, softer voice, stress anim'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Prime */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💎</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>JustAWomanInHerPrime</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Creator Narrator</p>
              </div>
            </div>
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Role', 'Narrator + Gameplay driver'],
                  ['Voice', 'Warm, strategic, luxury aspirational'],
                  ['Aliases', 'Prime:, Me:, You:'],
                  ['CTA Style', 'Confident, community-focused'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
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
                      {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                        <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </span>
                    <span style={{ ...S.tCol, fontSize: 11, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ DECISIONS ════════════════════════ */}
      {activeTab === 'characters' && subTab === 'decisions' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧠 Decision Log</h2>
            <p style={S.muted}>Training data from your creative decisions. Powers future AI suggestions.</p>
            {decisions.length > 0 ? decisions.map((d, i) => {
              const ctx = typeof d.context_json === 'string' ? JSON.parse(d.context_json) : d.context_json;
              const dec = typeof d.decision_json === 'string' ? JSON.parse(d.decision_json) : d.decision_json;
              return (
                <div key={i} style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4338ca', textTransform: 'capitalize' }}>{d.type?.replace(/_/g, ' ')}</span>
                    {d.source && <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, color: '#64748b' }}>{d.source}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {ctx && <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>Context: {JSON.stringify(ctx)}</div>}
                  {dec && <div style={{ fontSize: 11, color: '#1a1a2e', fontWeight: 500, wordBreak: 'break-all' }}>Decision: {JSON.stringify(dec)}</div>}
                </div>
              );
            }) : <p style={S.muted}>No decisions logged yet.</p>}
          </div>
        </div>
      )}

      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toast && (
        <div style={S.toastOverlay}>
          <div style={S.toastBox}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>💉✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.3px' }}>{toast}</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Event tag injected into script</div>
          </div>
        </div>
      )}
    </div>
  );
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
function SeasonTab({ showId, api, S, episodes, setToast }) {
  const [arc, setArc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [extending, setExtending] = useState(false);
  const [warning, setWarning] = useState(null);
  const [goals, setGoals] = useState([]);
  const [rhythm, setRhythm] = useState(null);

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

    try {
      const r = await api.get(`/api/v1/season-rhythm/season-health/${showId}`);
      setRhythm(r.data);
    } catch { /* skip */ }

    setLoading(false);
  }, [showId]);

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

  const handleExtend = async () => {
    setExtending(true);
    try {
      await api.post(`/api/v1/world/${showId}/arc/extend`, { extend_by: 2, reason: 'Showrunner extension' });
      await loadArc();
      if (setToast) setToast('Phase extended by 2 episodes');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setExtending(false);
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
    unstoppable: { color: '#B8962E', bg: '#faf5ea', label: 'Unstoppable' },
    confident:   { color: '#22c55e', bg: '#f0fdf4', label: 'Confident' },
    rising:      { color: '#6366f1', bg: '#eef2ff', label: 'Rising' },
    anxious:     { color: '#f59e0b', bg: '#fffbeb', label: 'Anxious' },
    desperate:   { color: '#ef4444', bg: '#fef2f2', label: 'Desperate' },
    broken:      { color: '#dc2626', bg: '#fef2f2', label: 'Broken' },
  };
  const tempCfg = TEMP_CONFIG[arc.emotional_temperature] || TEMP_CONFIG.rising;

  const PHASE_STATUS_COLORS = {
    active: { bg: '#f0fdf4', color: '#22c55e', border: '#bbf7d0' },
    completed: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' },
    upcoming: { bg: '#faf5ea', color: '#B8962E', border: 'rgba(184,150,46,0.2)' },
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
            <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
              Ep {arc.current_episode || 0} / {arc.episode_end}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>{completedEpisodes}</div>
            <div style={S.statLbl}>Episodes Done</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>{goals.filter(g => g.status === 'completed').length}</div>
            <div style={S.statLbl}>Goals Hit</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: debt.length > 0 ? '#dc2626' : '#1a1a2e' }}>{debt.length}</div>
            <div style={S.statLbl}>Narrative Debt</div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#B8962E' }}>{arc.current_phase}</div>
            <div style={S.statLbl}>Current Phase</div>
          </div>
        </div>
      </div>

      {/* Phase Cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {phases.map(phase => {
          const statusCfg = PHASE_STATUS_COLORS[phase.status] || PHASE_STATUS_COLORS.upcoming;
          const pGoals = phaseGoals(phase);
          const isCurrent = phase.phase === arc.current_phase;

          return (
            <div key={phase.phase} style={{
              ...S.card,
              borderColor: isCurrent ? '#B8962E' : statusCfg.border,
              borderWidth: isCurrent ? 2 : 1,
              borderStyle: 'solid',
              background: isCurrent ? '#fffef9' : '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>
                    Phase {phase.phase}: {phase.title}
                    {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: '#f0fdf4', color: '#22c55e', borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
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
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  <strong>Emotional arc:</strong> {phase.emotional_arc}
                </div>
              )}

              {/* Feed behavior */}
              {phase.feed_behavior && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, padding: '6px 10px', background: '#f8fafc', borderRadius: 6 }}>
                  <strong>Feed:</strong> {phase.feed_behavior.feed_tone || `Follow bias: ${phase.feed_behavior.follow_bias}`}
                  {phase.feed_behavior.event_prestige_max && <span> &middot; Max prestige: {phase.feed_behavior.event_prestige_max}</span>}
                </div>
              )}

              {/* Phase goals */}
              {pGoals.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>
                    Goals ({pGoals.filter(g => g.status === 'completed').length}/{pGoals.length} complete)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pGoals.map(g => (
                      <span key={g.id} style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: g.status === 'completed' ? '#f0fdf4' : g.status === 'failed' ? '#fef2f2' : g.status === 'paused' ? '#f8fafc' : '#eef2ff',
                        color: g.status === 'completed' ? '#16a34a' : g.status === 'failed' ? '#dc2626' : g.status === 'paused' ? '#94a3b8' : '#4338ca',
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
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                  Results: {phase.goal_summary.completed} completed, {phase.goal_summary.failed} failed
                  {phase.goal_summary.carried > 0 && <span style={{ color: '#dc2626' }}>, {phase.goal_summary.carried} carried as debt</span>}
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
          <button onClick={handleExtend} disabled={extending} style={S.secBtn}>
            {extending ? 'Extending...' : 'Extend Current Phase (+2 episodes)'}
          </button>
        </div>
        <p style={{ ...S.muted, marginTop: 8, fontSize: 11 }}>
          Advancing will finalize current phase goals and activate the next phase. You&apos;ll get a warning if goals are incomplete.
        </p>
      </div>

      {/* Warning Modal */}
      {warning && (
        <div style={{ ...S.card, borderColor: '#f59e0b', borderWidth: 2, borderStyle: 'solid', background: '#fffbeb' }}>
          <h3 style={{ ...S.cardTitle, margin: '0 0 8px', color: '#92400e' }}>⚠️ Advance Warning</h3>
          <p style={{ fontSize: 13, color: '#92400e', margin: '0 0 12px', lineHeight: 1.5 }}>
            {warning.warning}
          </p>
          {warning.goal_status?.goals?.filter(g => g.status === 'active' || g.type === 'primary').length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {warning.goal_status.goals.filter(g => g.status !== 'completed').map((g, i) => (
                <div key={i} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#92400e' }}>
                  {g.icon} <strong>{g.title}</strong> — {g.current_value}/{g.target_value} {g.target_metric}
                  {g.type === 'primary' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#dc2626' }}>PRIMARY</span>}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: '#92400e', margin: '0 0 12px' }}>
            Advancing will mark incomplete goals as <strong>narrative debt</strong> — emotional weight that affects scripts, feed, and events.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConfirmAdvance} disabled={advancing} style={{ ...S.primaryBtn, background: '#f59e0b' }}>
              {advancing ? 'Advancing...' : 'Advance Anyway'}
            </button>
            <button onClick={() => setWarning(null)} style={S.secBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Narrative Debt */}
      {debt.length > 0 && (
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, margin: '0 0 12px', color: '#dc2626' }}>
            Narrative Debt ({debt.length})
          </h3>
          <p style={{ ...S.muted, marginBottom: 12 }}>
            Failed goals that carry emotional weight. These feed into AI-generated scripts, feed posts, and event stakes.
          </p>
          {debt.map((d, i) => (
            <div key={i} style={{
              padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                {d.goal_title} <span style={{ fontWeight: 400, fontSize: 11 }}>({d.achieved}/{d.target} {d.target_metric})</span>
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d', fontStyle: 'italic' }}>
                {d.narrative_weight}
              </div>
              <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 4 }}>
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
                background: entry.triggered_by === 'manual' ? '#fef3c7' : '#eef2ff',
                color: entry.triggered_by === 'manual' ? '#92400e' : '#4338ca',
                flexShrink: 0,
              }}>{entry.triggered_by}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#1a1a2e' }}>{entry.trigger_reason}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                  {entry.goals_carried > 0 && <span style={{ color: '#dc2626' }}> &middot; {entry.goals_carried} goals carried</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  center: { textAlign: 'center', padding: 60, color: '#94a3b8' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  backLink: { color: '#B8962E', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 4px', fontSize: 24, fontWeight: 700, color: '#1a1a2e', fontFamily: "'Lora', serif" },
  subtitle: { margin: 0, color: '#94a3b8', fontSize: 13, fontWeight: 400 },
  refreshBtn: { padding: '8px 16px', background: '#FAF7F0', border: '1px solid rgba(184,150,46,0.2)', borderRadius: 10, color: '#B8962E', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },
  tabBar: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.06)', overflowX: 'auto', position: 'sticky', top: 0, background: '#FAF7F0', zIndex: 50, paddingTop: 4, scrollbarWidth: 'none' },
  tab: { padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' },
  tabActive: { padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '2px solid #B8962E', color: '#B8962E', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  content: { display: 'flex', flexDirection: 'column', gap: 16, animation: 'waFadeIn 0.2s ease' },
  card: { background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#1a1a2e', margin: '0 0 16px' },
  muted: { color: '#94a3b8', fontSize: 13 },
  primaryBtn: { padding: '8px 18px', background: 'linear-gradient(135deg, #C9A83A, #B8962E)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(184,150,46,0.2)', transition: 'all 0.15s' },
  secBtn: { padding: '8px 18px', background: '#FAF7F0', border: '1px solid rgba(184,150,46,0.2)', borderRadius: 8, color: '#B8962E', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  smBtn: { padding: '5px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#475569', fontWeight: 500, transition: 'all 0.12s' },
  smBtnDanger: { padding: '5px 12px', background: 'rgba(220,53,53,0.05)', border: '1px solid rgba(220,53,53,0.12)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#dc2626', fontWeight: 500, transition: 'all 0.12s' },
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statBox: { flex: '1 1 90px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', minWidth: 90, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  statVal: (k, v) => ({ fontSize: 24, fontWeight: 700, color: (k === 'stress' && v >= 5) || (k === 'coins' && v < 0) ? '#dc2626' : '#1a1a2e' }),
  statLbl: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 4, fontWeight: 500 },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  qBox: { background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  qVal: { fontSize: 22, fontWeight: 700, color: '#1a1a2e' },
  qLbl: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4, fontWeight: 500, letterSpacing: '0.3px' },
  tHead: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', fontWeight: 600, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px' },
  tRow: { display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', fontSize: 13, transition: 'background 0.1s' },
  tCol: { flex: 1, minWidth: 0 },
  empty: { padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 },
  tierPill: (t) => ({ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: TIER_COLORS[t] + '15', color: TIER_COLORS[t] }),
  statusPill: (s) => {
    const cfg = EVENT_STATUS_CONFIG[s] || EVENT_STATUS_CONFIG.draft;
    return { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color };
  },
  sourceBadge: (s) => ({ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: s === 'override' ? '#fef3c7' : s === 'manual' ? '#fef2f2' : '#eef2ff', color: s === 'override' ? '#92400e' : s === 'manual' ? '#dc2626' : '#4338ca' }),
  deltaBadge: (v) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: v > 0 ? '#f0fdf4' : '#fef2f2', color: v > 0 ? '#16a34a' : '#dc2626' }),
  toastOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' },
  toastBox: { padding: '20px 40px', background: 'linear-gradient(135deg, #16a34a, #059669)', color: '#fff', borderRadius: 14, fontSize: 14, fontWeight: 700, boxShadow: '0 12px 40px rgba(22,163,74,0.4)', textAlign: 'center', animation: 'waFadeIn 0.3s ease', pointerEvents: 'auto' },
  evCard: { background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s, border-color 0.15s' },
  eTag: { padding: '2px 8px', background: 'rgba(184,150,46,0.08)', borderRadius: 6, fontSize: 11, color: '#B8962E', fontWeight: 500 },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', boxSizing: 'border-box', transition: 'border-color 0.15s', outline: 'none' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', background: '#fff', transition: 'border-color 0.15s' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
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
