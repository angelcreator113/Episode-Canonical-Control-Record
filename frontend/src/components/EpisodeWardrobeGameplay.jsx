/**
 * EpisodeWardrobeGameplay v3 — Unified Outfit Experience
 *
 * Layout: Slots (left) | Browse Pool/Closet/Search (right)
 *
 * v3 additions:
 *   - Three browse modes: Pool (event-curated), Closet (full), Search
 *   - Live todo list sync from slot state
 *   - Lala Suggests (auto-fill from best items)
 *   - Outfit history across episodes
 *
 * Slots:
 *   👗 Body (dress) OR (👚 Top + 👖 Bottom) — smart detection
 *   👠 Shoes (required)
 *   👜 Accessories (optional)
 *   💍 Jewelry (optional)
 *   🌸 Perfume (optional)
 * 
 * Scoring (Task #1943; Evoni's ruling, 2026-09-26): one scorer, one number.
 *   Outfit Synergy, Lala's confidence line and the locked banner all show
 *   the server's canonical score (scoreOutfitForEvent, the scorer episode
 *   completion uses). A draft is scored by POST /outfit-score/:episodeId,
 *   debounced; a locked outfit by GET /outfit-score/:episodeId. The browser
 *   has no formula of its own.
 * 
 * Props:
 *   episodeId, showId, event, characterState, onOutfitComplete
 * 
 * Location: frontend/src/components/EpisodeWardrobeGameplay.jsx
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { resolveWardrobeImageUrl } from '../utils/wardrobeImage';
import { withReach } from '../utils/wardrobeReach';
import { CATEGORY_TO_SLOT, CATEGORY_ALIASES } from '../lib/wardrobeSlots';

// ─── CONSTANTS ───

const SLOT_DEFS = [
  { key: 'body', icon: '👗', label: 'Body', categories: ['dress'], required: true, desc: 'Dress or Top+Bottom' },
  { key: 'top', icon: '👚', label: 'Top', categories: ['top'], required: false, desc: 'With bottom' },
  { key: 'bottom', icon: '👖', label: 'Bottom', categories: ['bottom'], required: false, desc: 'With top' },
  { key: 'shoes', icon: '👠', label: 'Shoes', categories: ['shoes'], required: true, desc: 'Required' },
  { key: 'accessories', icon: '👜', label: 'Accessories', categories: ['accessory', 'bag'], required: false, desc: 'Optional' },
  { key: 'jewelry', icon: '💍', label: 'Jewelry', categories: ['jewelry'], required: false, desc: 'Optional' },
  { key: 'perfume', icon: '🌸', label: 'Perfume', categories: ['perfume'], required: false, desc: 'Optional' },
];

const TIER_STYLES = {
  basic: { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b', emoji: '🧵' },
  mid: { bg: '#eef2ff', border: '#c7d2fe', color: '#6366f1', emoji: '💜' },
  luxury: { bg: '#fef3c7', border: '#fde68a', color: '#92400e', emoji: '💎' },
  elite: { bg: '#fef3c7', border: '#f59e0b', color: '#78350f', emoji: '👑' },
};
const ROLE_STYLES = {
  safe: { bg: '#f0fdf4', border: '#bbf7d0', label: '✅ Safe', color: '#16a34a' },
  stretch: { bg: '#eef2ff', border: '#c7d2fe', label: '⬆️ Stretch', color: '#6366f1' },
  risky: { bg: '#fef2f2', border: '#fecaca', label: '⚡ Risky', color: '#dc2626' },
  locked_tease: { bg: '#f8fafc', border: '#e2e8f0', label: '🔒 Locked', color: '#94a3b8' },
};
const CAT_ICONS = { dress: '👗', top: '👚', bottom: '👖', shoes: '👠', accessories: '👜', accessory: '👜', bag: '👜', jewelry: '💍', perfume: '🌸' };

// A wardrobe item's game slot. Its clothing_category is resolved to a
// canonical category through the shared taxonomy (lib/wardrobeSlots: exact,
// then alias — 'accessories' → 'accessory', 'handbag' → 'bag', 'heels' →
// 'shoes'), then to the slot whose categories list it. Null when the game has
// no slot for it (outerwear).
function gameSlotFor(clothingCategory) {
  const n = String(clothingCategory || '').toLowerCase().trim();
  if (!n) return null;
  const canonical = CATEGORY_TO_SLOT[n] ? n : CATEGORY_ALIASES[n];
  if (!canonical) return null;
  return SLOT_DEFS.find(s => s.categories.includes(canonical))?.key || null;
}

// How long the draft score waits after the last slot change before asking
// the server (Task #1943).
const SCORE_DEBOUNCE_MS = 350;

// ─── GARMENT IMAGE ───
// Draws the item's real picture through the shared resolver. The category
// emoji stays as the placeholder when the item has no image, and replaces the
// image if it fails to load. Keyed by URL so a new URL gets a fresh attempt.

function GarmentImage({ item, fallback, size, height, radius = 8 }) {
  const url = resolveWardrobeImageUrl(item);
  return <GarmentImageInner key={url || 'none'} url={url} name={item?.name} fallback={fallback} size={size} height={height} radius={radius} />;
}

function GarmentImageInner({ url, name, fallback, size, height, radius }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size || '100%',
    height: height || size,
    borderRadius: radius,
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  };
  if (!url || failed) {
    const emojiSize = Math.min(40, Math.max(16, Math.round((height || size || 40) * 0.5)));
    return (
      <div data-testid="garment-fallback" role="img" aria-label={name || 'Wardrobe item'} style={box}>
        <span style={{ fontSize: emojiSize }}>{fallback}</span>
      </div>
    );
  }
  return (
    <div style={box}>
      <img
        src={url}
        alt={name || 'Wardrobe item'}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

// ─── MAIN COMPONENT ───

export default function EpisodeWardrobeGameplay({ episodeId, showId, event = {}, characterState = {}, onOutfitComplete }) {
  const [pool, setPool] = useState([]);
  const [poolBreakdown, setPoolBreakdown] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [localCoins, setLocalCoins] = useState(null); // tracks coins after purchases
  const coins = localCoins ?? characterState.coins ?? 0;
  const reputation = characterState.reputation ?? 0;

  // Slot state
  const [filledSlots, setFilledSlots] = useState({});
  const [activeSlot, setActiveSlot] = useState('body');
  const [inspecting, setInspecting] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [outfitLocked, setOutfitLocked] = useState(false);
  const [slotsReady, setSlotsReady] = useState(false);

  // v3: Browse modes, closet, search, todo, history, Lala Suggests
  const [browseMode, setBrowseMode] = useState('pool'); // pool | closet | search
  const [closetItems, setClosetItems] = useState([]);
  const [closetLoading, setClosetLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [todoList, setTodoList] = useState(null);
  const [outfitHistory, setOutfitHistory] = useState([]);
  const [suggestingOutfit, setSuggestingOutfit] = useState(false);

  // Task #1943: the score is the server's, for the draft and the locked outfit.
  // status: 'empty' (nothing equipped) | 'loading' | 'ready' | 'error'
  const [score, setScore] = useState({ status: 'empty', data: null });
  const lockCompleteRef = useRef(null); // slots to report once the locked score arrives

  // Smart detection: dress vs top+bottom
  const bodyMode = useMemo(() => {
    if (filledSlots.body) return 'dress';
    if (filledSlots.top || filledSlots.bottom) return 'separates';
    return 'none';
  }, [filledSlots.body, filledSlots.top, filledSlots.bottom]);

  const visibleSlots = useMemo(() => {
    return SLOT_DEFS.filter(s => {
      if (bodyMode === 'dress' && (s.key === 'top' || s.key === 'bottom')) return false;
      if (bodyMode === 'separates' && s.key === 'body') return false;
      return true;
    });
  }, [bodyMode]);

  // The server's answer in the shape the panel reads.
  const synergy = useMemo(() => {
    const d = score.data;
    if (!d || !d.hasOutfit) return null;
    return { total: d.score, confidence: d.confidence || {}, breakdown: d.breakdown || {} };
  }, [score.data]);
  // What the panel says when there is no score to show.
  const scoreMessage = {
    empty: 'Equip a piece to see how Lala feels.',
    loading: 'Lala is looking…',
    error: "Couldn't score this outfit right now.",
  }[score.status] || 'None of these pieces could be scored.';

  const filteredPool = useMemo(() => {
    const slot = SLOT_DEFS.find(s => s.key === activeSlot);
    if (!slot) return pool;
    return pool.filter(item => gameSlotFor(item.clothing_category) === slot.key)
      .sort((a, b) => b.match_score - a.match_score);
  }, [pool, activeSlot]);

  // ─── Load pool ───
  const loadPool = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/wardrobe/browse-pool', {
        show_id: showId,
        episode_id: episodeId,
        event_name: event.name || '',
        dress_code: event.dress_code || '',
        dress_code_keywords: event.dress_code_keywords || [],
        event_type: event.event_type || '',
        prestige: event.prestige || 5,
        strictness: event.strictness || 5,
        host_brand: event.host_brand || '',
        character_state: { ...characterState, coins: localCoins ?? characterState.coins ?? 0 },
      });
      setPool(res.data.pool || []);
      setPoolBreakdown(res.data.pool_breakdown || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load wardrobe');
    } finally { setLoading(false); }
  }, [showId, episodeId, event, characterState, localCoins]);

  useEffect(() => { loadPool(); }, [loadPool]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

  // ─── Restore slot picks (backend locked outfit OR localStorage draft) ───
  useEffect(() => {
    if (!episodeId || !showId) { setSlotsReady(true); return; }
    let cancelled = false;
    (async () => {
      try {
        // 1. Try loading a locked outfit from the backend
        const res = await api.get(`/api/v1/wardrobe/outfit/${episodeId}`);
        const backendItems = res.data?.items || [];
        if (!cancelled && backendItems.length > 0) {
          // Task #1943: slots by the shared category taxonomy (so 'accessory',
          // 'bag', 'handbag' … land in Accessories, not only 'accessories').
          // A locked piece is linked to this episode, so it is selectable:
          // without can_select a re-lock would silently leave it out.
          const restored = {};
          backendItems.forEach(item => {
            const slot = gameSlotFor(item.clothing_category);
            if (slot) restored[slot] = { ...item, can_select: true };
          });
          setFilledSlots(restored);
          setOutfitLocked(true);
          setSlotsReady(true);
          return;
        }
      } catch { /* backend outfit not available — fall through */ }

      // 2. Fall back to localStorage draft
      if (!cancelled) {
        try {
          const key = `wardrobe_draft_${episodeId}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            const draft = JSON.parse(saved);
            if (draft && typeof draft === 'object') setFilledSlots(draft);
          }
        } catch { /* ignore parse errors */ }
        setSlotsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [episodeId, showId]);

  // ─── Persist slot picks to localStorage whenever they change ───
  useEffect(() => {
    if (!episodeId || !slotsReady) return; // skip until initial restore is done
    const key = `wardrobe_draft_${episodeId}`;
    const filled = Object.entries(filledSlots).filter(([, v]) => v);
    if (filled.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(filledSlots));
    }
  }, [filledSlots, episodeId, slotsReady]);

  // ─── v3: Load closet (full wardrobe for browse) ───
  const loadCloset = useCallback(async () => {
    if (!showId || closetItems.length > 0) return;
    setClosetLoading(true);
    try {
      const res = await api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`);
      const items = res.data?.data || res.data?.items || res.data || [];
      setClosetItems(Array.isArray(items) ? items.map(i => ({
        ...i,
        aesthetic_tags: typeof i.aesthetic_tags === 'string' ? JSON.parse(i.aesthetic_tags) : (i.aesthetic_tags || []),
        event_types: typeof i.event_types === 'string' ? JSON.parse(i.event_types) : (i.event_types || []),
        match_score: 0,
      })) : []);
    } catch (err) {
      console.error('Failed to load closet:', err);
      setClosetItems([]);
    }
    finally { setClosetLoading(false); }
  }, [showId, closetItems.length]);

  // Task #1937: Closet and Search apply the backend's reach rule (owned, or
  // coin-locked and affordable, or reputation-locked and qualified) to the
  // coins and reputation the pool is asked with, so the three tabs agree and
  // follow the balance as it changes.
  const closetWithReach = useMemo(
    () => closetItems.map(i => withReach(i, { coins, reputation })),
    [closetItems, coins, reputation]
  );
  const markOwnedInCloset = (ids) => {
    const owned = new Set(ids);
    setClosetItems(prev => prev.map(i => (owned.has(i.id) ? { ...i, is_owned: true } : i)));
  };

  // ─── v3: Load todo list ───
  useEffect(() => {
    if (!episodeId) return;
    api.get(`/api/v1/episodes/${episodeId}/todo`).then(res => {
      setTodoList(res.data?.data || null);
    }).catch(() => {});
  }, [episodeId]);

  // ─── v3: Load outfit history ───
  useEffect(() => {
    if (!showId) return;
    api.get(`/api/v1/wardrobe/outfit-history/${showId}`).then(res => {
      setOutfitHistory(res.data?.history || []);
    }).catch(() => {});
  }, [showId]);

  // ─── v3: Live todo sync — compute completion from filledSlots ───
  const todoCompletion = useMemo(() => {
    if (!todoList?.tasks) return null;
    const filledCats = new Set();
    Object.entries(filledSlots).forEach(([key, item]) => {
      if (!item) return;
      if (key === 'body') filledCats.add('dress');
      else filledCats.add(key);
    });
    if (filledSlots.top && filledSlots.bottom) filledCats.add('dress');

    const tasks = todoList.tasks.filter(t => t.included !== false).map(t => ({
      ...t,
      completed: filledCats.has(t.slot),
    }));
    const done = tasks.filter(t => t.completed).length;
    return { tasks, done, total: tasks.length, allDone: done === tasks.length };
  }, [todoList, filledSlots]);

  // ─── Task #1943: the server's score, for the draft and the locked outfit ───
  // The ids on screen, order-free, so re-equipping the same pieces is not a
  // change. The event is the one on screen (EpisodeDetail's selectedEvent).
  const outfitIds = useMemo(() => {
    const ids = Object.values(filledSlots).filter(Boolean).map(i => i.id).filter(Boolean);
    return [...new Set(ids)].sort();
  }, [filledSlots]);
  const outfitKey = outfitIds.join(',');
  const eventId = event?.id || null;

  useEffect(() => {
    if (!episodeId || !slotsReady) return undefined;
    // Each run supersedes the last: its cleanup marks it stale (so a late
    // answer is ignored), cancels its timer and aborts its request.
    let stale = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const opts = controller ? { signal: controller.signal } : undefined;
    const ids = outfitKey ? outfitKey.split(',') : [];

    const run = async () => {
      setScore(prev => ({ status: 'loading', data: prev.data }));
      try {
        const res = outfitLocked
          ? await api.get(`/api/v1/wardrobe/outfit-score/${episodeId}${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''}`, opts)
          : await api.post(`/api/v1/wardrobe/outfit-score/${episodeId}`, { wardrobe_ids: ids, ...(eventId ? { event_id: eventId } : {}) }, opts);
        if (stale) return;
        setScore({ status: 'ready', data: res.data || null });
        if (outfitLocked && lockCompleteRef.current && onOutfitComplete) {
          const slots = lockCompleteRef.current;
          lockCompleteRef.current = null;
          const d = res.data || {};
          onOutfitComplete({ slots, synergy: { total: d.score ?? 0, confidence: d.confidence || null, breakdown: d.breakdown || {}, hasOutfit: !!d.hasOutfit } });
        }
      } catch (err) {
        if (stale) return; // superseded or aborted — a newer request owns the panel
        console.error('Outfit score failed:', err);
        setScore({ status: 'error', data: null });
      }
    };

    if (outfitLocked) {
      run();
      return () => { stale = true; controller?.abort(); };
    }
    if (ids.length === 0) {
      setScore({ status: 'empty', data: null });
      return undefined;
    }
    setScore(prev => ({ status: 'loading', data: prev.data }));
    const timer = setTimeout(run, SCORE_DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(timer); controller?.abort(); };
    // onOutfitComplete is read when the locked score arrives, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, eventId, outfitKey, outfitLocked, slotsReady]);

  // ─── v3: Lala Suggests ───
  const handleLalaSuggests = async () => {
    setSuggestingOutfit(true);
    try {
      // Use pool items if available, otherwise load them
      const items = pool.length > 0 ? pool : [];
      if (items.length === 0) { setSuggestingOutfit(false); return; }

      const newSlots = {};
      const used = new Set();

      // For each slot, find best selectable item
      for (const slot of SLOT_DEFS) {
        const candidates = items
          .filter(i => i.can_select && !used.has(i.id) && gameSlotFor(i.clothing_category) === slot.key)
          .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        if (candidates.length > 0) {
          newSlots[slot.key] = candidates[0];
          used.add(candidates[0].id);
        }
      }

      // Smart detection: if we got a dress, clear top/bottom
      if (newSlots.body) { newSlots.top = undefined; newSlots.bottom = undefined; }
      else if (newSlots.top || newSlots.bottom) { newSlots.body = undefined; }

      setFilledSlots(newSlots);
      setSuccess('Lala picked her favorites! Adjust as you like.');
    } catch { setError('Lala couldn\'t decide — try manually'); }
    finally { setSuggestingOutfit(false); }
  };

  // ─── v3: Browse items based on mode ───
  const filteredBrowseItems = useMemo(() => {
    const inSlot = (item) => gameSlotFor(item.clothing_category) === activeSlot;

    if (browseMode === 'pool') {
      return pool.filter(inSlot)
        .sort((a, b) => b.match_score - a.match_score);
    }
    if (browseMode === 'closet') {
      return closetWithReach.filter(inSlot)
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0) || a.name.localeCompare(b.name));
    }
    if (browseMode === 'search' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return closetWithReach.filter(item => {
        const name = (item.name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const tags = (item.aesthetic_tags || []).join(' ').toLowerCase();
        return (name.includes(q) || brand.includes(q) || tags.includes(q))
          && inSlot(item);
      });
    }
    return [];
  }, [pool, closetWithReach, browseMode, activeSlot, searchQuery]);

  // ─── Assign item to slot ───
  const assignToSlot = (item) => {
    if (!item.can_select) { setError('Cannot equip a locked item — purchase or unlock it first'); return; }
    const slotKey = gameSlotFor(item.clothing_category) || activeSlot;

    if (slotKey === 'body') {
      setFilledSlots(prev => ({ ...prev, body: item, top: undefined, bottom: undefined }));
    } else if (slotKey === 'top' || slotKey === 'bottom') {
      setFilledSlots(prev => ({ ...prev, [slotKey]: item, body: undefined }));
    } else {
      setFilledSlots(prev => ({ ...prev, [slotKey]: item }));
    }
    setInspecting(null);
  };

  const removeFromSlot = (slotKey) => {
    setFilledSlots(prev => ({ ...prev, [slotKey]: undefined }));
  };

  const purchaseItem = async (item) => {
    setPurchasing(item.id);
    try {
      const res = await api.post('/api/v1/wardrobe/purchase', { wardrobe_id: item.id, show_id: showId });
      if (res.data.success) {
        // Update local coin balance immediately
        if (res.data.coins_after != null) setLocalCoins(res.data.coins_after);

        // Close modal first so user sees the grid
        setInspecting(null);

        if (res.data.already_owned) {
          // Item was already owned — just equip it
          setSuccess(`"${item.name}" is already yours!`);
        } else {
          setSuccess(`Purchased "${item.name}" for ${res.data.cost} coins!`);
        }

        // Refresh pool to get updated ownership flags
        markOwnedInCloset([item.id]);
        await loadPool();

        // Auto-equip the purchased/owned item into the active slot
        const ownedItem = { ...item, is_owned: true, can_select: true, can_purchase: false };
        assignToSlot(ownedItem);
      }
    } catch (err) { setError(err.response?.data?.error || 'Purchase failed'); }
    finally { setPurchasing(null); }
  };

  const lockOutfit = async () => {
    setConfirming(true);
    try {
      const items = Object.entries(filledSlots).filter(([, v]) => v && v.can_select).map(([slot, item]) => ({ slot, item }));
      if (items.length === 0) { setError('No selectable items in outfit'); setConfirming(false); return; }
      // Task #1937: one request for the whole outfit. The server checks every
      // piece and the total cost first, then buys and links all of them in
      // one transaction, or none.
      const res = await api.post('/api/v1/wardrobe/lock-outfit-atomic', {
        episode_id: episodeId,
        show_id: showId,
        wardrobe_ids: items.map(({ item }) => item.id),
      });
      const bought = (res.data?.locked || []).filter(l => l.coin_purchased).map(l => l.id);
      if (bought.length > 0) markOwnedInCloset(bought);
      if (res.data?.coins_after != null) setLocalCoins(res.data.coins_after);
      // Task #1943: onOutfitComplete gets the server's score for the locked
      // outfit — the score effect reports it when the GET answers.
      lockCompleteRef.current = filledSlots;
      setOutfitLocked(true);
      setSuccess('Outfit locked! 🔒✨');
      // Clear localStorage draft — outfit is now persisted on backend
      try { localStorage.removeItem(`wardrobe_draft_${episodeId}`); } catch (err) { console.error('Could not clear the outfit draft:', err); }
    } catch (err) { setError(err.response?.data?.error || 'Failed to lock outfit'); }
    finally { setConfirming(false); }
  };

  const canLock = useMemo(() => {
    const hasBody = filledSlots.body || (filledSlots.top && filledSlots.bottom);
    const hasShoes = !!filledSlots.shoes;
    return hasBody && hasShoes;
  }, [filledSlots]);

  // ─── RENDER ───
  if (loading) {
    return (
      <div style={W.container}>
        <div style={W.loadingBox}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Opening the closet...</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading wardrobe for this event</div>
        </div>
      </div>
    );
  }

  return (
    <div style={W.container}>
      {error && <div style={W.errorBanner}>{error}<button onClick={() => setError(null)} style={W.xBtn}>✕</button></div>}
      {success && <div style={W.successBanner}>{success}</div>}

      {/* ═══ EVENT BANNER ═══ */}
      <div style={W.eventBanner}>
        <div>
          <div style={W.eventLabel}>STYLING FOR</div>
          <div style={W.eventName}>{event.name || 'Untitled Event'}</div>
          <div style={W.eventTags}>
            {event.dress_code && <span style={W.eventTag}>👗 {event.dress_code}</span>}
            <span style={W.eventTag}>⭐ {event.prestige || '?'}</span>
            <span style={W.eventTag}>📏 {event.strictness || '?'}</span>
            {event.host_brand && <span style={W.eventTag}>🏛️ {event.host_brand}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#880e4f', letterSpacing: 1, fontWeight: 600 }}>COINS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: coins < 100 ? '#dc2626' : '#4a1942' }}>🪙 {coins}</div>
        </div>
      </div>

      {/* ═══ TODO CHECKLIST (collapsible) ═══ */}
      {todoCompletion && (
        <details open style={{ marginBottom: 12, background: todoCompletion.allDone ? '#f0fdf4' : '#FAF7F0', border: `1px solid ${todoCompletion.allDone ? '#bbf7d0' : '#D4AF37'}`, borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋 Getting Ready — {todoCompletion.done}/{todoCompletion.total}</span>
            {todoCompletion.allDone && <span style={{ color: '#1A7A40', fontSize: 11 }}>✓ Ready!</span>}
          </summary>
          <div style={{ padding: '0 16px 10px' }}>
            {todoCompletion.tasks.map(t => (
              <div key={t.slot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: t.completed ? 0.6 : 1 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, border: t.completed ? 'none' : '1.5px solid #B8962E', background: t.completed ? '#1A7A40' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.completed && <span style={{ color: '#FFF', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: t.completed ? '#888' : '#1a1a2e', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.label}</span>
                {!t.required && <span style={{ fontSize: 9, color: '#B8962E' }}>optional</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ═══ LOCKED STATE ═══ */}
      {outfitLocked && (
        <div style={W.lockedBanner}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Outfit Locked</div>
            <div data-testid="locked-synergy" style={{ fontSize: 12, color: '#64748b' }}>
              {synergy
                ? <>Synergy: {synergy.total}/100 — {synergy.confidence.emoji} {synergy.confidence.label}</>
                : scoreMessage}
            </div>
          </div>
          <button onClick={() => setOutfitLocked(false)} style={W.unlockBtn}>↩ Unlock</button>
        </div>
      )}

      {/* ═══ MAIN LAYOUT ═══ */}
      {!outfitLocked && (
        <div style={W.mainLayout}>

          {/* ──── LEFT: SLOTS ──── */}
          <div style={W.slotsPanel}>
            {/* Confidence */}
            <div style={W.confidenceCard} aria-busy={score.status === 'loading'} data-score-status={score.status}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Outfit Synergy</span>
                <span data-testid="synergy-score" style={{ fontSize: 18, fontWeight: 800, color: synergy ? synergy.confidence.color : '#94a3b8', opacity: score.status === 'loading' ? 0.5 : 1 }}>
                  {synergy ? `${synergy.confidence.emoji || ''} ${synergy.total}` : (score.status === 'loading' ? '…' : '—')}
                </span>
              </div>
              <div style={W.synergyBar}>
                <div style={{ height: '100%', width: `${synergy ? synergy.total : 0}%`, borderRadius: 4, background: synergy ? `linear-gradient(90deg, ${synergy.confidence.color}80, ${synergy.confidence.color})` : 'transparent', transition: 'width 0.5s' }} />
              </div>
              <div data-testid="lala-line" style={{ fontSize: 11, fontStyle: 'italic', color: synergy ? synergy.confidence.color : '#94a3b8', marginTop: 5 }}>
                {synergy && synergy.confidence.lala ? `"${synergy.confidence.lala}"` : scoreMessage}
              </div>
              {synergy && synergy.total > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                  {Object.entries(synergy.breakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} style={W.synBadge}>+{v} {k.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Slots */}
            {visibleSlots.map(slot => {
              const item = filledSlots[slot.key];
              const isActive = activeSlot === slot.key;
              return (
                <div key={slot.key}
                  onClick={() => !item && setActiveSlot(slot.key)}
                  style={{
                    ...W.slotCard,
                    border: isActive ? '2px solid #6366f1' : item ? '2px solid #bbf7d0' : '1px solid #e2e8f0',
                    background: item ? '#f0fdf4' : isActive ? '#eef2ff' : '#fff',
                    cursor: item ? 'default' : 'pointer',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item ? (
                      <GarmentImage item={item} fallback={slot.icon} size={40} />
                    ) : (
                      <span style={{ fontSize: 20 }}>{slot.icon}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>
                        {slot.label}
                        {slot.required && !item && <span style={{ color: '#dc2626', fontSize: 9 }}> *</span>}
                      </div>
                      {item ? (
                        <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{item.name}</div>
                      ) : (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{slot.desc}</div>
                      )}
                    </div>
                    {item && (
                      <button onClick={(e) => { e.stopPropagation(); removeFromSlot(slot.key); setActiveSlot(slot.key); }}
                        style={W.removeBtn}>✕</button>
                    )}
                  </div>
                  {item && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={W.miniTier(item.tier)}>{TIER_STYLES[item.tier]?.emoji} {item.tier}</span>
                      {item.match_score != null && <span style={{ fontSize: 9, color: '#64748b' }}>Match: {item.match_score}</span>}
                    </div>
                  )}
                </div>
              );
            })}

            <button onClick={lockOutfit} disabled={!canLock || confirming}
              style={{ ...W.lockBtn, opacity: canLock ? 1 : 0.4 }}>
              {confirming ? '⏳ Locking...' : canLock ? '🔒 Lock Outfit' : '⚠️ Fill required slots'}
            </button>
            {!canLock && (
              <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                Need: {!filledSlots.body && !(filledSlots.top && filledSlots.bottom) ? 'body ' : ''}
                {!filledSlots.shoes ? 'shoes' : ''}
              </div>
            )}
            <button onClick={handleLalaSuggests} disabled={suggestingOutfit || pool.length === 0}
              style={{ ...W.lockBtn, background: 'linear-gradient(135deg, #B8962E, #D4AF37)', marginTop: 6, opacity: pool.length > 0 ? 1 : 0.4 }}>
              {suggestingOutfit ? '✨ Lala is thinking...' : '✨ Lala Suggests'}
            </button>
          </div>

          {/* ──── RIGHT: BROWSE ──── */}
          <div style={W.browsePanel}>
            {/* Browse mode tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 10, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
              {[
                { key: 'pool', label: 'For This Event' },
                { key: 'closet', label: 'Full Closet' },
                { key: 'search', label: 'Search' },
              ].map(m => (
                <button key={m.key} onClick={() => { setBrowseMode(m.key); if (m.key !== 'pool' && closetItems.length === 0) loadCloset(); }}
                  style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: browseMode === m.key ? 700 : 400, background: browseMode === m.key ? '#fff' : 'transparent', color: browseMode === m.key ? '#6366f1' : '#64748b', cursor: 'pointer', boxShadow: browseMode === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Search bar */}
            {browseMode === 'search' && (
              <input type="text" placeholder="Search by name, brand, or tag..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
            )}

            {closetLoading && browseMode !== 'pool' && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>Loading closet...</div>
            )}

            <div style={W.browseHeader}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  {CAT_ICONS[SLOT_DEFS.find(s => s.key === activeSlot)?.categories?.[0]] || '👕'} {activeSlot === 'body' ? 'Dress' : SLOT_DEFS.find(s => s.key === activeSlot)?.label || activeSlot}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{filteredBrowseItems.length} items · Click to equip</div>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {visibleSlots.filter(s => !filledSlots[s.key]).map(s => (
                  <button key={s.key} onClick={() => setActiveSlot(s.key)}
                    style={{ ...W.slotSwitch, background: activeSlot === s.key ? '#6366f1' : '#f1f5f9', color: activeSlot === s.key ? '#fff' : '#64748b' }}>
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>

            <div style={W.browseGrid}>
              {filteredBrowseItems.map((item, idx) => {
                const ts = TIER_STYLES[item.tier] || TIER_STYLES.basic;
                const rs = ROLE_STYLES[item.pool_role] || ROLE_STYLES.safe;
                const isLocked = !item.is_owned;
                const isUsed = Object.values(filledSlots).some(fi => fi?.id === item.id);
                return (
                  <div key={item.id}
                    onClick={() => {
                      if (isUsed) return;
                      if (item.can_select) assignToSlot(item);
                      else setInspecting(item);
                    }}
                    style={{
                      ...W.browseCard,
                      opacity: isUsed ? 0.3 : isLocked && !item.is_visible ? 0.4 : 1,
                      cursor: isUsed ? 'not-allowed' : 'pointer',
                      border: `1px solid ${rs.border}`,
                      animation: `fadeSlide 0.25s ease ${idx * 0.05}s both`,
                      position: 'relative',
                    }}
                    >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ ...W.rolePill, background: rs.bg, color: rs.color }}>{rs.label}</span>
                      <span style={{ ...W.tierPill, background: ts.bg, color: ts.color }}>{ts.emoji} {item.tier || 'basic'}</span>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <GarmentImage item={item} fallback={CAT_ICONS[item.clothing_category] || '👕'} height={120} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 1 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{item.color || '—'} · {item.era_alignment || '—'}</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                      {(item.aesthetic_tags || []).slice(0, 3).map((t, i) => (
                        <span key={i} style={W.tagPill}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ flex: 1, height: 3, background: '#f1f5f9', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.match_score / 60) * 100)}%`, borderRadius: 2, background: item.match_score >= 40 ? '#16a34a' : item.match_score >= 20 ? '#eab308' : '#dc2626' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{item.match_score}</span>
                    </div>
                    <div style={{ fontSize: 9, marginTop: 3, fontWeight: 600,
                      color: isUsed ? '#6366f1' : item.can_select ? '#16a34a' : item.can_purchase ? '#eab308' : '#dc2626' }}>
                      {isUsed ? '✓ In outfit'
                        : item.can_select ? (item.can_purchase ? `✅ Tap to equip · 🪙 ${item.coin_cost} on Lock` : '✅ Tap to equip')
                        : item.can_purchase ? (
                          <span onClick={(e) => { e.stopPropagation(); purchaseItem(item); }}
                            style={{ cursor: 'pointer', color: '#eab308' }}>
                            🪙 Buy for {item.coin_cost} coins
                          </span>
                        )
                        : item.lock_type === 'reputation' ? `🔒 Rep ${item.reputation_required}+`
                        : item.lock_type === 'coin' ? `🪙 Need ${item.coin_cost} coins`
                        : item.lock_type === 'brand_exclusive' ? '🏛️ Brand Exclusive'
                        : item.lock_type === 'season_drop' ? `🕒 Drops Ep ${item.season_unlock_episode}`
                        : '🔒 Locked'}
                    </div>
                  </div>
                );
              })}
              {filteredPool.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                  <div style={{ fontSize: 24 }}>{SLOT_DEFS.find(s => s.key === activeSlot)?.icon || '👕'}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>No {activeSlot} items available</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ OUTFIT HISTORY ═══ */}
      {outfitHistory.length > 0 && (
        <details style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#1a1a2e' }}>
            👗 Outfit History — {outfitHistory.length} episode{outfitHistory.length !== 1 ? 's' : ''}
          </summary>
          <div style={{ padding: '0 16px 12px' }}>
            {outfitHistory.map(ep => (
              <div key={ep.episode_id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>
                  {ep.episode_number || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{ep.episode_title || 'Untitled'}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {ep.event_name && <span>{ep.event_name} · </span>}
                    {ep.items.length} pieces · {ep.items.map(i => i.name).slice(0, 3).join(', ')}{ep.items.length > 3 ? '...' : ''}
                  </div>
                </div>
                {ep.prestige && <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>⭐{ep.prestige}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ═══ INSPECT MODAL ═══ */}
      {inspecting && (
        <div style={W.overlay} onClick={() => setInspecting(null)}>
          <div style={W.modal} onClick={e => e.stopPropagation()}>
            <button onClick={() => setInspecting(null)} style={W.modalClose}>✕</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <GarmentImage item={inspecting} fallback={CAT_ICONS[inspecting.clothing_category] || '👕'} size={96} radius={12} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{inspecting.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{inspecting.clothing_category} · {inspecting.color || '—'} · {inspecting.tier}</div>
              </div>
            </div>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Match Score</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: inspecting.match_score >= 40 ? '#16a34a' : '#eab308' }}>{inspecting.match_score}/60</span>
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (inspecting.match_score / 60) * 100)}%`, borderRadius: 3, background: inspecting.match_score >= 40 ? '#16a34a' : '#eab308' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {(inspecting.match_reasons || []).map((r, i) => <span key={i} style={W.reasonPill}>{r}</span>)}
              </div>
            </div>
            <div style={{ padding: 12, background: '#fef3c7', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: 1, marginBottom: 3 }}>LALA SAYS</div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#475569' }}>"{inspecting.lala_reaction}"</div>
            </div>
            {inspecting.can_select && (
              <button onClick={() => assignToSlot(inspecting)} style={W.modalSelectBtn}>✨ Equip</button>
            )}
            {inspecting.can_purchase && (
              <button onClick={() => purchaseItem(inspecting)} disabled={purchasing === inspecting.id}
                style={W.modalBuyBtn}>
                {purchasing === inspecting.id ? '⏳...' : `🪙 Buy for ${inspecting.coin_cost}`}
              </button>
            )}
            {!inspecting.can_select && !inspecting.can_purchase && (
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                🔒 {inspecting.lock_type === 'reputation' ? `Rep ${inspecting.reputation_required}+` :
                  inspecting.lock_type === 'brand_exclusive' ? 'Brand Exclusive' :
                  inspecting.lock_type === 'season_drop' ? `Drops Ep ${inspecting.season_unlock_episode}` :
                  inspecting.lock_type === 'coin' ? `Need ${inspecting.coin_cost} coins` : 'Locked'}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ─── STYLES ───
const W = {
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  loadingBox: { textAlign: 'center', padding: 60 },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 10 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 10, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' },
  eventBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)', borderRadius: 14, marginBottom: 12, color: '#4a1942' },
  eventLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#c2185b', marginBottom: 2 },
  eventName: { fontSize: 16, fontWeight: 800, marginBottom: 4, color: '#4a1942' },
  eventTags: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  eventTag: { padding: '2px 8px', background: 'rgba(194,24,91,0.1)', borderRadius: 5, fontSize: 10, color: '#880e4f' },
  lockedBanner: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 12, marginBottom: 12 },
  unlockBtn: { marginLeft: 'auto', padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#64748b' },
  mainLayout: { display: 'flex', gap: 16, minHeight: 480 },
  slotsPanel: { flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: 6 },
  confidenceCard: { padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 2 },
  synergyBar: { height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  synBadge: { padding: '1px 5px', background: '#eef2ff', borderRadius: 3, fontSize: 8, color: '#4338ca', fontWeight: 600 },
  slotCard: { padding: '8px 12px', borderRadius: 10, transition: 'all 0.15s' },
  removeBtn: { width: 22, height: 22, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  miniTier: (tier) => ({ padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 600, background: (TIER_STYLES[tier] || TIER_STYLES.basic).bg, color: (TIER_STYLES[tier] || TIER_STYLES.basic).color }),
  lockBtn: { padding: '11px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  browsePanel: { flex: 1, minWidth: 0 },
  browseHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  slotSwitch: { width: 30, height: 30, borderRadius: 7, border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  browseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 },
  browseCard: { padding: 12, borderRadius: 12, background: '#fff', transition: 'all 0.15s' },
  rolePill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700 },
  tierPill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  tagPill: { padding: '1px 4px', background: '#f1f5f9', borderRadius: 3, fontSize: 8, color: '#64748b' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 18, padding: 22, maxWidth: 420, width: '100%', position: 'relative', maxHeight: '80vh', overflowY: 'auto' },
  modalClose: { position: 'absolute', top: 12, right: 12, background: '#f1f5f9', border: 'none', width: 28, height: 28, borderRadius: '50%', fontSize: 13, cursor: 'pointer', color: '#64748b' },
  reasonPill: { padding: '2px 6px', background: '#eef2ff', borderRadius: 4, fontSize: 9, color: '#4338ca', fontWeight: 600 },
  modalSelectBtn: { width: '100%', padding: '11px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  modalBuyBtn: { width: '100%', padding: '9px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
};
