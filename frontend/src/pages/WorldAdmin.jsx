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
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { InvitationButton, InvitationStyleFields } from '../components/InvitationGenerator';
import { EventInvitePreview } from './feed/FeedEnhancements';
import './WorldAdmin.css';

const SocialProfileGenerator = lazy(() => import('./SocialProfileGenerator'));

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
const TIER_COLORS = { slay: '#FFD700', pass: '#22c55e', safe: '#eab308', fail: '#dc2626' };
const TIER_EMOJIS = { slay: '👑', pass: '✨', safe: '😐', fail: '💔' };
const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };
const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];
const WARDROBE_TIER_COLORS = { basic: '#94a3b8', mid: '#6366f1', luxury: '#eab308', elite: '#ec4899' };
const WARDROBE_TIER_ICONS = { basic: '👟', mid: '👠', luxury: '💎', elite: '👑' };
const WARDROBE_CATEGORIES = ['all', 'dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'];
const CAT_ICONS = { all: '🏷️', dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessory: '🎀', jewelry: '💍', bag: '👜', outerwear: '🧥' };

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
  { key: 'episodes', icon: '📋', label: 'Episode Ledger' },
  { key: 'feed', icon: '👥', label: "Lala's Feed" },
  { key: 'feed-events', icon: '🎭', label: 'Feed Events' },
  { key: 'events', icon: '💌', label: 'Events Library' },
  { key: 'opportunities', icon: '💼', label: 'Opportunities' },
  { key: 'goals', icon: '🎯', label: 'Career Goals' },
  { key: 'wardrobe', icon: '👗', label: 'Wardrobe' },
  { key: 'characters', icon: '👑', label: 'Characters' },
  { key: 'decisions', icon: '🧠', label: 'Decision Log' },
];

function WorldAdmin() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [worldLocations, setWorldLocations] = useState([]);
  const [wardrobeFilter, setWardrobeFilter] = useState('all');       // all | owned | locked
  const [wardrobeTierFilter, setWardrobeTierFilter] = useState('all'); // all | basic | mid | luxury | elite
  const [wardrobeCatFilter, setWardrobeCatFilter] = useState('all');   // all | dress | top | ...
  const [seedingWardrobe, setSeedingWardrobe] = useState(false);
  const [editingWardrobeItem, setEditingWardrobeItem] = useState(null);   // item object or null
  const [wardrobeForm, setWardrobeForm] = useState({});
  const [savingWardrobe, setSavingWardrobe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
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
  const [feedEventResults, setFeedEventResults] = useState({}); // { templateName: { status, event } }
  const [eventSort, setEventSort] = useState('name'); // name | prestige | cost | created | status
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [aiFixSuggestions, setAiFixSuggestions] = useState(null);
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
        api.get(`/api/v1/world/${showId}/goals`).then(r => setGoals(r.data?.goals || [])).catch(() => setGoals([])),
        api.get(`/api/v1/wardrobe-library?showId=${showId}&limit=200`).then(r => setWardrobeItems(r.data?.data || [])).catch(() => setWardrobeItems([])),
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
        if (res.data.success) { setWorldEvents(p => [res.data.event, ...p]); setEditingEvent(null); setSuccessMsg('Event created!'); }
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
  const getSequenceWarnings = () => {
    const warnings = [];
    const episodeEvents = episodes.map(ep => ({
      ep,
      event: worldEvents.find(ev => ev.used_in_episode_id === ep.id),
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
    const names = worldEvents.map(ev => ev.name?.toLowerCase().trim());
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (names[i] && names[j] && names[i] === names[j]) {
          warnings.push({ type: 'name', eventName: worldEvents[i].name, fixType: 'merge',
            dupA: worldEvents[i], dupB: worldEvents[j],
            msg: `⚠️ Duplicate event name: "${worldEvents[i].name}"` });
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
    const usedTypes = new Set(worldEvents.filter(ev => ev.status === 'used').map(ev => ev.event_type));
    const essentialTypes = ['invite', 'deliverable', 'brand_deal'];
    for (const t of essentialTypes) {
      if (worldEvents.length >= 6 && !usedTypes.has(t)) {
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
  const handleAutoReorder = async () => {
    const linked = worldEvents.filter(ev => ev.used_in_episode_id);
    const sortedByPrestige = [...linked].sort((a, b) => (a.prestige || 0) - (b.prestige || 0));
    const sortedEps = [...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

    if (sortedByPrestige.length === 0) return;
    if (!window.confirm(`Reorder ${sortedByPrestige.length} events by prestige (low → high) across episodes? This changes all assignments.`)) return;

    try {
      for (let i = 0; i < sortedByPrestige.length && i < sortedEps.length; i++) {
        await api.post(`/api/v1/world/${showId}/events/${sortedByPrestige[i].id}/inject`, { episode_id: sortedEps[i].id });
      }
      setToast('✅ Events reordered by prestige');
      setTimeout(() => setToast(null), 3000);
      loadData();
    } catch { setToast('Reorder failed'); setTimeout(() => setToast(null), 3000); }
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

  // Fill gap — suggest best unlinked event for an episode
  const handleFillGap = (ep) => {
    const unlinked = worldEvents.filter(ev => !ev.used_in_episode_id && ev.status !== 'used');
    if (unlinked.length === 0) {
      setToast('No unlinked events available — create a new one');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    // Pick the best match: prefer matching career_tier to episode position
    const epPos = ep.episode_number || 1;
    const scored = unlinked.map(ev => ({
      ev,
      score: Math.abs((ev.prestige || 5) - (epPos * 0.7 + 2)) // rough fit
    })).sort((a, b) => a.score - b.score);
    setEventDetailModal(scored[0].ev);
  };

  // AI Rebalance — Amber reassigns all events optimally
  const handleAiRebalance = async () => {
    if (!window.confirm('Let Amber reassign all events across episodes for optimal variety? This will change all assignments.')) return;
    setAiFixLoading(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
        warnings: [{ msg: 'REBALANCE: Reassign all events across episodes for maximum variety in type, prestige, dress code, and difficulty. Build a rising arc.' }],
        events: worldEvents,
        episodes,
      });
      setAiFixSuggestions(res.data?.data || []);
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
      setAiFixSuggestions(res.data?.data || []);
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
    const ev = worldEvents.find(e => e.name === suggestion.event_name);
    if (!ev) return;

    const updates = {};
    if (suggestion.action === 'swap_type' && suggestion.new_value) updates.event_type = suggestion.new_value;
    if (suggestion.action === 'rename' && suggestion.new_value) updates.name = suggestion.new_value;
    if (suggestion.action === 'change_prestige' && suggestion.new_value) updates.prestige = parseInt(suggestion.new_value) || ev.prestige;

    if (Object.keys(updates).length === 0) return;

    try {
      const res = await api.put(`/api/v1/world/${showId}/events/${ev.id}`, { ...ev, ...updates });
      if (res.data.success) {
        setWorldEvents(prev => prev.map(e => e.id === ev.id ? res.data.event : e));
        setAiFixSuggestions(prev => prev.filter(s => s !== suggestion));
        setToast(`Applied: ${suggestion.suggestion.slice(0, 60)}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setToast(`Failed: ${err.message}`);
      setTimeout(() => setToast(null), 3000);
    }
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
      if (res.data.success) { setCharState(p => ({ ...p, state: res.data.state })); setEditingStats(false); setSuccessMsg('Stats updated!'); }
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
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={activeTab === t.key ? S.tabActive : S.tab}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

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

          <div className="wa-grid-4" style={S.qGrid}>
            {[{ v: episodes.length, l: 'Episodes' }, { v: acceptedEpisodes.length, l: 'Evaluated' }, { v: overrideCount, l: 'Overrides' }, { v: worldEvents.length, l: 'Events' }].map((s, i) => (
              <div key={i} style={S.qBox}><div style={S.qVal}>{s.v}</div><div style={S.qLbl}>{s.l}</div></div>
            ))}
          </div>

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

      {/* ════════════════════════ EPISODE LEDGER ════════════════════════ */}
      {activeTab === 'episodes' && (
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
      {activeTab === 'feed' && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading Feed...</div>}>
          <SocialProfileGenerator embedded showId={showId} defaultFeedLayer="lalaverse" onNavigateToTab={(tab, ev) => { setActiveTab(tab); if (ev) setEventDetailModal(ev); }} />
        </Suspense>
      )}

      {/* ════════════════════════ FEED EVENTS ════════════════════════ */}
      {activeTab === 'feed-events' && (
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
                    // Check completeness
                    const filled = [ev.host, ev.venue_name, ev.event_date, ev.dress_code, ev.description, ev.narrative_stakes].filter(Boolean).length;
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

          {/* Current season context */}
          <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 6 }}>
              Event Templates — {['January','February','March','April','May','June','July','August','September','October','November','December'][new Date().getMonth()]}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              Pick a template to create a new event. It will appear as a draft above until you mark it ready.
            </div>
          </div>

          {/* Feed event templates grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {[
              { name: 'Creator Roast Night', category: 'creator_economy', icon: '🔥', desc: 'Public roasting of creators by other creators. Everything is jokes until someone goes too far.', energy: 'chaotic' },
              { name: 'Fashion Mystery Box', category: 'fashion', icon: '📦', desc: 'Style looks from a mystery selection. Constraint reveals true taste — or lack of it.', energy: 'creative' },
              { name: 'Creator Speed Dating', category: 'creator_economy', icon: '⚡', desc: 'Rapid-fire collab pitches. Alliances form fast. Some are regretted faster.', energy: 'networking' },
              { name: 'Street Style Marathon', category: 'fashion', icon: '👟', desc: 'Extended street style documentation — the week\'s best looks ranked publicly.', energy: 'competitive' },
              { name: 'Beauty Battles', category: 'beauty', icon: '💄', desc: 'Head-to-head beauty challenges. The audience votes. The loser loses followers publicly.', energy: 'dramatic' },
              { name: 'Design Lab Week', category: 'creative', icon: '🎨', desc: 'Experimental design projects and innovation challenges. Where new ideas are tested publicly.', energy: 'creative' },
              { name: 'Community Build Week', category: 'creator_economy', icon: '🤝', desc: 'Collaborative content between otherwise competing creators. Forced proximity events.', energy: 'wholesome' },
              { name: 'The Great Glow-Up Challenge', category: 'beauty', icon: '✨', desc: 'Dramatic transformation challenge. Before and after content that goes viral.', energy: 'aspirational' },
              { name: 'Creator Charity Week', category: 'creator_economy', icon: '💝', desc: 'Creators raise money for causes. Reputation washing meets genuine impact.', energy: 'feel-good' },
              { name: 'Midnight Music Festival', category: 'music', icon: '🎵', desc: 'Late-night music and performance event. Unexpected collabs happen after midnight.', energy: 'electric' },
              { name: 'Virtual Travel Festival', category: 'lifestyle', icon: '✈️', desc: 'Digital travel content — who can make home feel like elsewhere.', energy: 'escapist' },
              { name: 'Artist Residency Month', category: 'creative', icon: '🖼️', desc: 'Creators slow down and make something intentional. The antidote to the content grind.', energy: 'reflective' },
              { name: 'Creator Talent Show', category: 'creator_economy', icon: '🎤', desc: 'Hidden talents revealed. Singers, dancers, comedians — the audience discovers new sides.', energy: 'surprising' },
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
                          const calRes = await api.post('/api/v1/calendar/events', {
                            title: template.name,
                            event_type: 'lalaverse_cultural',
                            cultural_category: template.category,
                            severity_level: 5,
                            what_world_knows: template.desc,
                            is_micro_event: true,
                            visibility: 'public',
                            start_datetime: new Date().toISOString(),
                          });
                          const calEvent = calRes.data?.event || calRes.data;
                          if (calEvent?.id) {
                            const spawnRes = await api.post(`/api/v1/calendar/events/${calEvent.id}/auto-spawn`, {
                              show_id: showId, event_count: 1, max_guests: 6,
                            });
                            if (spawnRes.data.success) {
                              const created = spawnRes.data.data.events?.[0];
                              const host = created?.canon_consequences?.automation?.host_display_name || created?.host || '';
                              setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'created', event: { ...created, host_display: host } } }));
                              loadData();
                              setToast(`"${created?.name || template.name}" created!`);
                            } else {
                              setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                              setToast('Auto-spawn failed', 'error');
                            }
                          }
                        } catch (err) {
                          setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                          setToast('Failed: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${cc.border}40`, background: `${cc.bg}80`, color: cc.text, fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                    >
                      {feedEventResults[template.name]?.status === 'creating' ? 'Creating — finding host and venue...' : 'Create This Event'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════ EVENTS LIBRARY ════════════════════════ */}
      {activeTab === 'events' && (
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
                        <>
                          <button onClick={() => handleFillGap(w.ep)}
                            style={{ padding: '2px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            📋 Suggest
                          </button>
                          <button onClick={() => handleAiGenerateForGap(w.ep)} disabled={aiFixLoading}
                            style={{ padding: '2px 8px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ✨ AI Create
                          </button>
                        </>
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
                              setEventForm({ ...EMPTY_EVENT, ...data });
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
            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca' }}>{selectedEvents.size} selected</span>
              {selectedEvents.size === 2 && (
                <button onClick={() => { const ids = [...selectedEvents]; setCompareEvents(worldEvents.filter(ev => ids.includes(ev.id))); }} style={{ padding: '3px 10px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>🔍 Compare</button>
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
                    {worldLocations.filter(l => l.location_type === 'venue' || l.venue_type).map(l => (
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
                  {!linkedEpisode && (
                    <button onClick={async () => {
                      try {
                        setToast('🎬 Generating episode...');
                        const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/generate-episode`);
                        if (res.data.success) {
                          setEpisodeBlueprint(res.data.data);
                          const ep = res.data.data.episode;
                          setToast(`✅ Episode ${ep?.episode_number || ''} "${ep?.title}" created — ${res.data.data.scenePlan?.length || 14} beats, ${res.data.data.socialTasks?.length || 0} social tasks`);
                          loadData();
                        } else {
                          setToast(res.data.error || 'Failed');
                        }
                      } catch (err) { setToast('Episode generation failed: ' + (err.response?.data?.error || err.message)); }
                      setTimeout(() => setToast(null), 5000);
                    }} style={{ ...S.smBtn, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>🎬 Generate Episode</button>
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
                    <img src={linkedScene.base_still_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6 }}>📍 {linkedScene.name}</div>
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
                              <img src={linkedScene.base_still_url} alt={linkedScene.name} style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {linkedScene.name}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>{linkedScene.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
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

                  {/* Financial Preview */}
                  {(() => {
                    const p = md.prestige || 5;
                    const eventIncome = md.is_paid ? (parseFloat(md.payment_amount) || 0) : 0;
                    const eventExpense = parseFloat(md.cost_coins) || 0;
                    // Estimate content revenue from social tasks
                    const contentRevenue = md.event_type === 'brand_deal' ? eventIncome * 0.1 : 0;
                    // Estimate outfit cost from prestige tier
                    const estOutfitCost = p >= 8 ? 400 : p >= 6 ? 250 : p >= 4 ? 120 : 50;
                    const totalIn = eventIncome + contentRevenue;
                    const totalOut = eventExpense + estOutfitCost;
                    const net = totalIn - totalOut;
                    return (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Financial Preview</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#16a34a' }}>Income</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{totalIn.toLocaleString()}</div>
                            {eventIncome > 0 && <div style={{ fontSize: 9, color: '#16a34a80' }}>Payment: {eventIncome}</div>}
                            {contentRevenue > 0 && <div style={{ fontSize: 9, color: '#16a34a80' }}>Content: +{contentRevenue}</div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#dc2626' }}>Expenses</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{totalOut.toLocaleString()}</div>
                            {eventExpense > 0 && <div style={{ fontSize: 9, color: '#dc262680' }}>Event: {eventExpense}</div>}
                            <div style={{ fontSize: 9, color: '#dc262680' }}>Outfit (est): ~{estOutfitCost}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? '#16a34a' : '#dc2626' }}>Net P&L</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: net >= 0 ? '#16a34a' : '#dc2626' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8' }}>{net >= 0 ? 'Profitable' : 'Costs more than earns'}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>Estimates based on prestige {p} tier. Actual costs depend on wardrobe selection.</div>
                      </div>
                    );
                  })()}

                  {/* Social Tasks */}
                  {(() => {
                    const savedTasks = auto.social_tasks || [];
                    const TIMING_COLORS = { before: '#f59e0b', during: '#6366f1', after: '#16a34a' };
                    const TIMING_LABELS = { before: 'Before', during: 'During', after: 'After' };
                    const checklistUrl = auto.social_checklist_url;
                    const requiredCount = savedTasks.filter(t => t.required).length;

                    // Group by timing
                    const grouped = {};
                    savedTasks.forEach(t => {
                      const k = t.timing || 'during';
                      if (!grouped[k]) grouped[k] = [];
                      grouped[k].push(t);
                    });

                    return (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>
                            Social Tasks {savedTasks.length > 0 ? `(${savedTasks.length} tasks, ${requiredCount} required)` : ''}
                          </div>
                          <button
                            onClick={async (e) => {
                              const btn = e.target;
                              btn.disabled = true;
                              btn.textContent = 'Generating...';
                              try {
                                const res = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-social-checklist`);
                                if (res.data.success) {
                                  // Update the event modal with new tasks + checklist URL
                                  const newAuto = { ...auto, social_tasks: res.data.data.tasks, social_checklist_url: res.data.data.assetUrl };
                                  const updated = { ...eventDetailModal, canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto } };
                                  setEventDetailModal(updated);
                                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                                  setToast(`Checklist generated — ${res.data.data.tasks.length} tasks`);
                                }
                              } catch (err) {
                                setToast('Failed: ' + (err.response?.data?.error || err.message));
                              }
                              btn.disabled = false;
                              btn.textContent = checklistUrl ? 'Regenerate Checklist' : 'Generate Checklist';
                            }}
                            style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #B8962E', background: '#FAF7F0', color: '#B8962E', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
                          >
                            {checklistUrl ? 'Regenerate Checklist' : 'Generate Checklist'}
                          </button>
                        </div>

                        {/* Checklist image preview */}
                        {checklistUrl && (
                          <div style={{ marginBottom: 10, textAlign: 'center' }}>
                            <img src={checklistUrl} alt="Social Checklist" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 10, border: '1px solid #e8e0d0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                          </div>
                        )}

                        {/* Task list */}
                        {savedTasks.length > 0 ? (
                          <div>
                            {['before', 'during', 'after'].filter(p => grouped[p]).map(phase => (
                              <div key={phase} style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: TIMING_COLORS[phase], textTransform: 'uppercase', marginBottom: 3 }}>{TIMING_LABELS[phase]}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 3 }}>
                                  {grouped[phase].map(t => (
                                    <div key={t.slot} style={{ padding: '3px 8px', background: '#f8f8f8', borderRadius: 5, borderLeft: `3px solid ${TIMING_COLORS[phase]}`, fontSize: 10 }}>
                                      <span style={{ fontWeight: 600, color: '#333' }}>{t.label}</span>
                                      <span style={{ color: '#aaa', marginLeft: 4 }}>{t.platform}</span>
                                      {t.required && <span style={{ color: TIMING_COLORS[phase], marginLeft: 4, fontSize: 8, fontWeight: 700 }}>req</span>}
                                      {t.source && <span style={{ color: t.source === 'platform' ? '#6366f1' : '#16a34a', marginLeft: 4, fontSize: 8 }}>{t.source}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                            No tasks generated yet. Click "Generate Checklist" to create tasks and a visual asset.
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
                      // Confirmation summary
                      const summary = `Mark "${md.name}" as ready?\n\nHost: ${md.host}\nVenue: ${md.venue_name}\nDate: ${md.event_date}\nPrestige: ${md.prestige}\n\nThis will:\n• Save all fields\n• Generate social checklist\n• Generate venue images\n• Move to Events Library`;
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
                              setToast(`Ready! Checklist done. Generating venue images...`);
                              // Auto-generate venue images
                              try {
                                const venueRes = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-venue`);
                                if (venueRes.data.success) {
                                  setToast(`Venue images + scene set created!`);
                                  loadData();
                                }
                              } catch { setToast('Ready! (venue generation skipped — no OPENAI_API_KEY or error)'); }
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
      {activeTab === 'goals' && (
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

      {/* ════════════════════════ WARDROBE ════════════════════════ */}
      {activeTab === 'wardrobe' && (() => {
        // Group items by type for summary
        const typeGroups = {};
        wardrobeItems.forEach(item => {
          const t = item.itemType || item.item_type || 'other';
          if (!typeGroups[t]) typeGroups[t] = [];
          typeGroups[t].push(item);
        });

        const filteredItems = wardrobeItems.filter(item => {
          const itemType = item.itemType || item.item_type || 'other';
          if (wardrobeCatFilter !== 'all' && itemType !== wardrobeCatFilter) return false;
          if (wardrobeFilter !== 'all') {
            const searchTerm = wardrobeFilter.toLowerCase();
            const nameMatch = (item.name || '').toLowerCase().includes(searchTerm);
            const descMatch = (item.description || '').toLowerCase().includes(searchTerm);
            const colorMatch = (item.color || '').toLowerCase().includes(searchTerm);
            const vendorMatch = (item.vendor || '').toLowerCase().includes(searchTerm);
            if (!nameMatch && !descMatch && !colorMatch && !vendorMatch) return false;
          }
          return true;
        });

        const openEditItem = (item) => {
          setEditingWardrobeItem(item);
          setWardrobeForm({
            name: item.name || '',
            description: item.description || '',
            itemType: item.itemType || item.item_type || '',
            color: item.color || '',
            defaultSeason: item.defaultSeason || item.default_season || '',
            defaultOccasion: item.defaultOccasion || item.default_occasion || '',
            defaultCharacter: item.defaultCharacter || item.default_character || '',
            vendor: item.vendor || '',
            price: item.price || '',
            website: item.website || '',
            tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
          });
        };

        const saveWardrobeItem = async () => {
          if (!editingWardrobeItem) return;
          setSavingWardrobe(true); setError(null);
          try {
            const payload = {
              ...wardrobeForm,
              tags: wardrobeForm.tags ? wardrobeForm.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
              price: wardrobeForm.price ? parseFloat(wardrobeForm.price) : null,
            };
            const res = await api.put(`/api/v1/wardrobe-library/${editingWardrobeItem.id}`, payload);
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
            const res = await api.delete(`/api/v1/wardrobe-library/${item.id}`);
            if (res.data.success) {
              setWardrobeItems(prev => prev.filter(i => i.id !== item.id));
              setEditingWardrobeItem(null);
              setSuccessMsg('Item deleted');
            }
          } catch (err) { setError(err.response?.data?.error || err.message); }
        };

        const wf = wardrobeForm;
        const setWf = (key, val) => setWardrobeForm(prev => ({ ...prev, [key]: val }));

        return (
          <div style={S.content}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ ...S.cardTitle, margin: 0 }}>👗 Wardrobe Library</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{wardrobeItems.length} items</span>
                <button onClick={() => navigate('/wardrobe-library/upload')} style={S.primaryBtn}>+ Upload Item</button>
              </div>
            </div>

            {/* Type Summary Cards */}
            {Object.keys(typeGroups).length > 0 && (
              <div className="wa-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
                {Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
                  const isActive = wardrobeCatFilter === type;
                  return (
                    <div key={type} onClick={() => setWardrobeCatFilter(isActive ? 'all' : type)}
                      style={{
                        padding: '12px 10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                        background: isActive ? '#6366f118' : '#fff',
                        border: isActive ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        transition: 'all 0.2s',
                      }}>
                      <div style={{ fontSize: 20 }}>{CAT_ICONS[type] || '🏷️'}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isActive ? '#6366f1' : '#1a1a2e' }}>{items.length}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>{type}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search + Category Filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <input
                type="text"
                placeholder="Search by name, color, vendor..."
                value={wardrobeFilter === 'all' ? '' : wardrobeFilter}
                onChange={e => setWardrobeFilter(e.target.value || 'all')}
                style={{ ...S.inp, flex: '1 1 200px', minWidth: 150, margin: 0 }}
              />
              <div style={{ width: 1, height: 24, background: '#e2e8f0', alignSelf: 'center' }} />
              {WARDROBE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setWardrobeCatFilter(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: wardrobeCatFilter === cat ? '#6366f1' : '#fff',
                    color: wardrobeCatFilter === cat ? '#fff' : '#64748b',
                    border: wardrobeCatFilter === cat ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  }}>
                  {CAT_ICONS[cat] || '🏷️'} {cat}
                </button>
              ))}
            </div>

            {/* ─── Edit Panel ─── */}
            {editingWardrobeItem && (
              <div style={{
                background: '#fff', border: '2px solid #6366f1', borderRadius: 14, padding: 24, marginBottom: 16,
                boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(editingWardrobeItem.thumbnailUrl || editingWardrobeItem.thumbnail_url || editingWardrobeItem.imageUrl || editingWardrobeItem.image_url) && (
                      <img src={editingWardrobeItem.thumbnailUrl || editingWardrobeItem.thumbnail_url || editingWardrobeItem.imageUrl || editingWardrobeItem.image_url}
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
                    <select value={wf.itemType} onChange={e => setWf('itemType', e.target.value)} style={S.sel}>
                      <option value="">Select...</option>
                      {['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'].map(c => (
                        <option key={c} value={c}>{c}</option>
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

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingWardrobeItem(null)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveWardrobeItem} disabled={savingWardrobe} style={S.primaryBtn}>
                    {savingWardrobe ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Item Grid — visual cards with thumbnails */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {filteredItems.map(item => {
                const imgUrl = item.thumbnailUrl || item.thumbnail_url || item.imageUrl || item.image_url;
                const itemType = item.itemType || item.item_type || '';
                const tags = Array.isArray(item.tags) ? item.tags : [];
                const isSelected = editingWardrobeItem?.id === item.id;

                return (
                  <div key={item.id} onClick={() => openEditItem(item)}
                    style={{
                      background: '#fff', border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: 12,
                      overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.2)' : 'none',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  >
                    {/* Image */}
                    <div style={{ width: '100%', aspectRatio: '1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      ) : null}
                      <div style={{ display: imgUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 48, color: '#cbd5e1' }}>
                        {CAT_ICONS[itemType] || '👗'}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
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
                  <button onClick={() => navigate('/wardrobe-library/upload')} style={S.primaryBtn}>
                    + Upload First Item
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════════════════════ CHARACTERS ════════════════════════ */}
      {activeTab === 'characters' && (
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
                {Object.entries(charState.state || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{STAT_ICONS[key]}</span>
                    <span style={{ flex: '0 0 100px', fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                    {editingStats ? (
                      <input type="number" value={statForm[key] ?? val} onChange={e => setStatForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                        style={{ width: 80, padding: '4px 8px', border: '1px solid #6366f1', borderRadius: 4, fontSize: 14, fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}
                        min={key === 'coins' ? -9999 : 0} max={key === 'coins' ? 99999 : 10} />
                    ) : (
                      <>
                        <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (val / (key === 'coins' ? 500 : 10)) * 100))}%`, borderRadius: 5, background: key === 'stress' ? (val >= 5 ? '#dc2626' : '#eab308') : key === 'coins' ? (val < 0 ? '#dc2626' : '#6366f1') : '#6366f1', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: (key === 'stress' && val >= 5) || (key === 'coins' && val < 0) ? '#dc2626' : '#1a1a2e' }}>{val}</span>
                      </>
                    )}
                  </div>
                ))}
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
      {activeTab === 'decisions' && (
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
      const res = await api.post(`/api/v1/opportunities/${showId}/${opp.id}/to-event`);
      if (res.data.success) { setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, event_id: res.data.event.id } : o)); loadData(); setToast(`Event created from "${opp.name}"`); }
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
                  {['booked','preparing','active'].includes(opp.status) && !opp.event_id && <button onClick={() => toEvent(opp)} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #B8962E', background: '#FAF7F0', color: '#B8962E', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>Create Event</button>}
                  {opp.event_id && <span style={{ fontSize: 9, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', borderRadius: 4 }}>Event linked</span>}
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
