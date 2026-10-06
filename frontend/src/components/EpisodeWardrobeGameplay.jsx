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
import { GAME_SLOT_DEFS as SLOT_DEFS, OTHER_GROUP, ALL_GROUP, SETS_GROUP, MULTI_SLOTS, gameSlotFor, closetGroupFor, fetchClosetWithTotal, slotPieces, outfitPieces, normalizeSlots, matchingSetsFrom, equipInto, wornLooks } from '../lib/closetGrouping';

// ─── CONSTANTS ───

// Game slots and the category → slot resolution live in lib/closetGrouping
// (Task #2377), built on the shared taxonomy in lib/wardrobeSlots.

const TIER_STYLES = {
  basic: { bg: 'var(--lala-parchment-2)', border: 'var(--lala-parchment-3)', color: 'var(--lala-ink-muted)', emoji: '🧵' },
  mid: { bg: 'var(--lala-lavender-soft)', border: 'var(--lala-lavender-line)', color: 'var(--lala-lavender-text)', emoji: '💜' },
  luxury: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', color: 'var(--warning-text)', emoji: '💎' },
  elite: { bg: 'var(--warning-bg)', border: 'var(--warning)', color: 'var(--warning-text)', emoji: '👑' },
};
const ROLE_STYLES = {
  safe: { bg: 'var(--success-bg)', border: 'var(--success-border)', label: '✅ Safe', color: 'var(--success-text)' },
  stretch: { bg: 'var(--lala-lavender-soft)', border: 'var(--lala-lavender-line)', label: '⬆️ Stretch', color: 'var(--lala-lavender-text)' },
  risky: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', label: '⚡ Risky', color: 'var(--danger-text)' },
  locked_tease: { bg: 'var(--lala-parchment-2)', border: 'var(--lala-parchment-3)', label: '🔒 Locked', color: 'var(--lala-ink-muted)' },
};
const CAT_ICONS = { dress: '👗', top: '👚', bottom: '👖', shoes: '👠', accessories: '👜', accessory: '👜', bag: '👜', jewelry: '💍', perfume: '🌸' };

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
    background: 'var(--lala-parchment-2)',
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

export default function EpisodeWardrobeGameplay({ episodeId, showId, event = {}, characterState = {}, onOutfitComplete, onCoinsChange }) {
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
  // W3: how many pieces the closet holds (the server's total), and a load error.
  const [closetTotal, setClosetTotal] = useState(null);
  const [closetError, setClosetError] = useState(null);
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
  // Linked pieces the server did not count because they await approval
  // (completion scores approved pieces only; Evoni's ruling, 2026-09-26).
  const pendingPieces = outfitLocked && Array.isArray(score.data?.pending) ? score.data.pending : [];
  // What the panel says when there is no score to show.
  const scoreMessage = {
    empty: 'Equip a piece to see how Lala feels.',
    loading: 'Lala is looking…',
    error: "Couldn't score this outfit right now.",
  }[score.status] || 'None of these pieces could be scored.';

  // ─── Load pool ───
  // The pool is asked with the coins as they stand when it loads, read from a
  // ref: with the coins in its deps, a purchase reloaded the pool twice (the
  // coins changed, and purchaseItem reloads it), each time behind the
  // full-screen spinner (Evoni, 2026-10-05). A quiet reload keeps the game on
  // screen.
  const coinsRef = useRef(localCoins ?? characterState.coins ?? 0);
  coinsRef.current = localCoins ?? characterState.coins ?? 0;
  const loadPool = useCallback(async ({ quiet = false } = {}) => {
    if (!showId) return;
    if (!quiet) setLoading(true);
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
        character_state: { ...characterState, coins: coinsRef.current },
      });
      setPool(res.data.pool || []);
      setPoolBreakdown(res.data.pool_breakdown || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load wardrobe');
    } finally { setLoading(false); }
  }, [showId, episodeId, event, characterState]);

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
            if (!slot) return;
            // W2: several accessories and jewellery pieces come back together.
            if (MULTI_SLOTS.has(slot)) restored[slot] = [...(restored[slot] || []), { ...item, can_select: true }];
            else restored[slot] = { ...item, can_select: true };
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
            if (draft && typeof draft === 'object') setFilledSlots(normalizeSlots(draft));
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
    if (outfitPieces(filledSlots).length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(filledSlots));
    }
  }, [filledSlots, episodeId, slotsReady]);

  // ─── v3: Load closet (full wardrobe for browse) ───
  // W3 (Evoni, 2026-10-01): reloaded each time the Full Closet or Search
  // opens, so a piece added since the page loaded appears.
  const loadCloset = useCallback(async () => {
    if (!showId) return;
    setClosetLoading(true);
    setClosetError(null);
    try {
      // Task #2377: every page, not one limit=200 request (which dropped the
      // oldest items once a closet passed 200).
      const { items, total } = await fetchClosetWithTotal(api, showId);
      setClosetTotal(total);
      const loaded = Array.isArray(items) ? items.map(i => ({
        ...i,
        aesthetic_tags: typeof i.aesthetic_tags === 'string' ? JSON.parse(i.aesthetic_tags) : (i.aesthetic_tags || []),
        event_types: typeof i.event_types === 'string' ? JSON.parse(i.event_types) : (i.event_types || []),
        match_score: 0,
      })) : [];
      setClosetItems(loaded);
      return loaded;
    } catch (err) {
      console.error('Failed to load closet:', err);
      setClosetError(err?.response?.data?.error || err?.message || 'network error');
      return null;
    }
    finally { setClosetLoading(false); }
  }, [showId]);

  // W3: pieces per closet group, for the switcher's counts.
  const closetGroupCounts = useMemo(() => {
    const counts = { [ALL_GROUP.key]: closetItems.length, [SETS_GROUP.key]: matchingSetsFrom(closetItems).length };
    for (const item of closetItems) {
      const key = closetGroupFor(item.clothing_category);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [closetItems]);

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
    outfitPieces(filledSlots).forEach(({ slot: key }) => {
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
    const ids = outfitPieces(filledSlots).map(({ item }) => item.id).filter(Boolean);
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
          newSlots[slot.key] = MULTI_SLOTS.has(slot.key) ? [candidates[0]] : candidates[0];
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
    // Task #2377: the Other tab holds every item no game slot accepts
    // (outerwear, unknown or missing category) so none vanish.
    if (activeSlot === SETS_GROUP.key) return []; // W1: the Sets group lists sets, not pieces
    const inSlot = activeSlot === ALL_GROUP.key
      ? () => true
      : activeSlot === OTHER_GROUP.key
        ? (item) => !gameSlotFor(item.clothing_category)
        : (item) => gameSlotFor(item.clothing_category) === activeSlot;

    if (browseMode === 'pool') {
      return pool.filter(inSlot)
        .sort((a, b) => b.match_score - a.match_score);
    }
    if (browseMode === 'closet') {
      return closetWithReach.filter(inSlot)
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0) || String(a.name || '').localeCompare(String(b.name || '')));
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
    const slotKey = gameSlotFor(item.clothing_category);
    if (!slotKey) { setInspecting(item); return; } // Other: browse-only
    // One rule for a piece and a set (equipInto): a dress clears top and
    // bottom, and the reverse; Accessories and Jewelry add beside the rest (W2).
    setFilledSlots(prev => equipInto(prev, item));
    setInspecting(null);
  };

  // W1: the closet's matching sets, and wearing one: every selectable piece
  // into its own slot at once. A locked piece, or one with no game slot, is
  // left out and named.
  const matchingSets = useMemo(() => matchingSetsFrom(closetWithReach), [closetWithReach]);
  const looks = useMemo(() => wornLooks(filledSlots), [filledSlots]);
  const wearSet = (set) => {
    const locked = set.pieces.filter(p => !p.can_select);
    const noSlot = set.pieces.filter(p => p.can_select && !gameSlotFor(p.clothing_category));
    const wearable = set.pieces.filter(p => p.can_select && gameSlotFor(p.clothing_category));
    // The body (a dress, or the separates) first, so the rest add to it.
    const order = ['body', 'top', 'bottom'];
    wearable.sort((a, b) => {
      const ia = order.indexOf(gameSlotFor(a.clothing_category));
      const ib = order.indexOf(gameSlotFor(b.clothing_category));
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    });
    setFilledSlots(prev => wearable.reduce((acc, piece) => equipInto(acc, piece), prev));
    const notes = [];
    if (locked.length) notes.push(`${locked.length} piece${locked.length === 1 ? '' : 's'} left out (locked): ${locked.map(p => p.name).join(', ')}`);
    if (noSlot.length) notes.push(`${noSlot.length} piece${noSlot.length === 1 ? '' : 's'} left out (no game slot): ${noSlot.map(p => p.name).join(', ')}`);
    setSuccess([`Wearing the ${set.name}`, ...notes].join(' · '));
  };

  // Wear a piece's whole matching set from For This Event (Evoni, 2026-10-05:
  // the set's name showed on the card but only Full Closet could wear it).
  // The set's pieces are the closet's, loaded first when it is not yet.
  const wearSetOf = async (item) => {
    const closet = closetItems.length > 0 ? closetItems : await loadCloset();
    if (!closet) { setError('Could not load the closet to wear the set'); return; }
    const set = matchingSetsFrom(closet.map(i => withReach(i, { coins, reputation })))
      .find(x => String(x.id) === String(item.outfit_set_id));
    if (!set) { setError(`The ${item.outfit_set_name || 'matching set'} has no pieces in the closet`); return; }
    wearSet(set);
  };

  // W2: in a multi slot, one piece comes off (itemId); the rest stay.
  const removeFromSlot = (slotKey, itemId) => {
    setFilledSlots(prev => {
      if (MULTI_SLOTS.has(slotKey) && itemId) {
        const rest = slotPieces(prev, slotKey).filter(p => p.id !== itemId);
        return { ...prev, [slotKey]: rest.length ? rest : undefined };
      }
      return { ...prev, [slotKey]: undefined };
    });
  };

  const purchaseItem = async (item) => {
    setPurchasing(item.id);
    try {
      // The episode's id goes on the ledger row (§8(aa) M3, Task #2248).
      const res = await api.post('/api/v1/wardrobe/purchase', { wardrobe_id: item.id, show_id: showId, episode_id: episodeId || undefined });
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

        // Refresh pool to get updated ownership flags (once, quietly), and
        // tell the page its balance changed.
        markOwnedInCloset([item.id]);
        onCoinsChange?.();
        await loadPool({ quiet: true });

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
      const items = outfitPieces(filledSlots).filter(({ item }) => item.can_select);
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
      if ((res.data?.coins_spent || 0) > 0) onCoinsChange?.();
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

  // Evoni's Episode mock: what the look costs, the pieces Lala does not own yet.
  const lookCost = useMemo(() => outfitPieces(filledSlots)
    .filter(({ item: w }) => w && w.is_owned === false)
    .reduce((n, { item: w }) => n + (Number(w.coin_cost) || 0), 0), [filledSlots]);

  // ─── RENDER ───
  if (loading) {
    return (
      <div style={W.container}>
        <div style={W.loadingBox}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Opening the closet...</div>
          <div style={{ fontSize: 12, color: 'var(--lala-ink-muted)' }}>Loading wardrobe for this event</div>
        </div>
      </div>
    );
  }

  return (
    <div style={W.container}>
      {error && <div style={W.errorBanner}>{error}<button onClick={() => setError(null)} style={W.xBtn}>✕</button></div>}
      {success && <div style={W.successBanner}>{success}</div>}

      {/* ═══ LALA'S LOOK (Evoni's Episode mock, 2026-10-05): the look, the
          beat that needs it, the dress code; the event's name, prestige,
          strictness and host stay as tags. ═══ */}
      <div style={W.eventBanner} data-testid="look-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={W.lookTitle}>Lala's look</h3>
            <span style={W.lookChip}>{outfitLocked ? 'Locked' : 'Beat 8 needs it'}</span>
            <span style={W.eventName}>for {event.name || 'Untitled Event'}</span>
          </div>
          <div style={W.eventTags}>
            <span style={W.eventTag}>Prestige {event.prestige || '?'}</span>
            <span style={W.eventTag}>Strictness {event.strictness || '?'}</span>
            {event.host_brand && <span style={W.eventTag}>{event.host_brand}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--lala-ink-muted)', fontWeight: 600 }}>Lala has</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: coins < 100 ? 'var(--danger-text)' : 'var(--lala-ink)' }}>{Number(coins).toLocaleString()} coins</div>
          {!outfitLocked && (
            <button type="button" style={W.linkBtn} onClick={() => { setBrowseMode('closet'); setActiveSlot(ALL_GROUP.key); loadCloset(); }}>Open full closet</button>
          )}
        </div>
      </div>
      {event.dress_code && (
        <div style={W.dressCode} data-testid="look-dress-code"><strong>Dress code:</strong> {event.dress_code}</div>
      )}

      {/* ═══ TODO CHECKLIST (collapsible) ═══ */}
      {todoCompletion && (
        <details open style={{ marginBottom: 12, background: todoCompletion.allDone ? 'var(--success-bg)' : 'var(--lala-parchment)', border: `1px solid ${todoCompletion.allDone ? 'var(--success-border)' : 'var(--lala-gold)'}`, borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--lala-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋 Getting Ready — {todoCompletion.done}/{todoCompletion.total}</span>
            {todoCompletion.allDone && <span style={{ color: 'var(--success-text)', fontSize: 11 }}>✓ Ready!</span>}
          </summary>
          <div style={{ padding: '0 16px 10px' }}>
            {todoCompletion.tasks.map(t => (
              <div key={t.slot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: t.completed ? 0.6 : 1 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, border: t.completed ? 'none' : '1.5px solid var(--lala-gold)', background: t.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.completed && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: t.completed ? 'var(--lala-ink-muted)' : 'var(--lala-ink)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.label}</span>
                {!t.required && <span style={{ fontSize: 9, color: 'var(--lala-gold-text)' }}>optional</span>}
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
            <div data-testid="locked-synergy" style={{ fontSize: 12, color: 'var(--lala-ink-muted)' }}>
              {synergy
                ? <>Synergy: {synergy.total}/100 — {synergy.confidence.emoji} {synergy.confidence.label}</>
                : scoreMessage}
            </div>
            {pendingPieces.length > 0 && (
              <div data-testid="pending-note" title={pendingPieces.map(p => p.name).filter(Boolean).join(', ')} style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 2 }}>
                {pendingPieces.length === 1
                  ? "1 piece awaiting approval isn't counted yet"
                  : `${pendingPieces.length} pieces awaiting approval aren't counted yet`}
              </div>
            )}
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
                <span data-testid="synergy-score" style={{ fontSize: 18, fontWeight: 800, color: synergy ? synergy.confidence.color : 'var(--lala-ink-muted)', opacity: score.status === 'loading' ? 0.5 : 1 }}>
                  {synergy ? `${synergy.confidence.emoji || ''} ${synergy.total}` : (score.status === 'loading' ? '…' : '—')}
                </span>
              </div>
              <div style={W.synergyBar}>
                <div style={{ height: '100%', width: `${synergy ? synergy.total : 0}%`, borderRadius: 4, background: synergy ? synergy.confidence.color : 'transparent', transition: 'width 0.5s' }} />
              </div>
              <div data-testid="lala-line" style={{ fontSize: 11, fontStyle: 'italic', color: synergy ? synergy.confidence.color : 'var(--lala-ink-muted)', marginTop: 5 }}>
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

            {/* W1: a matching set worn shows as one look. */}
            {looks.map(look => (
              <div key={look.id} data-testid="outfit-look" style={{ padding: '6px 10px', marginBottom: 6, borderRadius: 8, background: 'var(--lala-lavender-soft)', border: '1px solid var(--lala-lavender-line)', color: 'var(--lala-lavender-text)', fontSize: 12, fontWeight: 700 }}>
                {`Look: ${look.name}`}
              </div>
            ))}

            {/* Slots */}
            {visibleSlots.map(slot => {
              // W2: Accessories and Jewelry hold several pieces; the rest one.
              const pieces = slotPieces(filledSlots, slot.key);
              const multi = MULTI_SLOTS.has(slot.key);
              const item = pieces[0];
              const isActive = activeSlot === slot.key;
              return (
                <div key={slot.key} data-testid={`slot-${slot.key}`}
                  onClick={() => (!item || multi) && setActiveSlot(slot.key)}
                  style={{
                    ...W.slotCard,
                    border: isActive ? '2px solid var(--lala-lavender)' : item ? '1px solid var(--lala-parchment-3)' : '1px dashed var(--lala-lavender-line)',
                    background: item ? 'var(--lala-parchment)' : isActive ? 'var(--lala-lavender-soft)' : 'var(--surface-card)',
                    cursor: item && !multi ? 'default' : 'pointer',
                  }}>
                  {(multi && pieces.length > 0 ? pieces : [item]).map((piece, pi) => (
                    <div key={piece?.id || 'empty'} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: pi ? 6 : 0 }}>
                      {piece ? (
                        <GarmentImage item={piece} fallback={slot.icon} size={40} />
                      ) : (
                        <span style={{ fontSize: 20 }}>{slot.icon}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {pi === 0 && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lala-ink)' }}>
                            {slot.label}
                            {slot.required && !piece && <span style={{ color: 'var(--danger-text)', fontSize: 9 }}> *</span>}
                            {multi && pieces.length > 1 && <span style={{ color: 'var(--lala-ink-muted)', fontSize: 10, fontWeight: 400 }}> · {pieces.length} pieces</span>}
                          </div>
                        )}
                        {piece ? (
                          <div style={{ fontSize: 13, color: 'var(--lala-ink)', fontWeight: 700 }}>{piece.name}</div>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--lala-ink-muted)' }}>{slot.desc}</div>
                        )}
                      </div>
                      {/* Owned, or still to buy (charged at Finalize), as in Evoni's Episode mock. */}
                      {piece && (
                        <span data-testid={`slot-cost-${piece.id}`} style={{ fontSize: 12, color: 'var(--lala-ink-muted)', whiteSpace: 'nowrap' }}>
                          {piece.is_owned !== false ? 'owned' : `to buy · 🪙 ${Number(piece.coin_cost || 0).toLocaleString()}`}
                        </span>
                      )}
                      {piece && (
                        <button onClick={(e) => { e.stopPropagation(); removeFromSlot(slot.key, piece.id); setActiveSlot(slot.key); }}
                          aria-label={`Remove ${piece.name}`} style={W.removeBtn}>✕</button>
                      )}
                    </div>
                  ))}
                  {item && !multi && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={W.miniTier(item.tier)}>{TIER_STYLES[item.tier]?.emoji} {item.tier}</span>
                      {item.match_score != null && <span style={{ fontSize: 9, color: 'var(--lala-ink-muted)' }}>Match: {item.match_score}</span>}
                    </div>
                  )}
                  {multi && item && (
                    <div style={{ fontSize: 10, color: 'var(--lala-lavender-text)', marginTop: 4 }}>+ Add another</div>
                  )}
                </div>
              );
            })}

            {/* What the look costs Lala (the pieces still to buy), against her coins. */}
            <div data-testid="look-cost" style={W.costBar}>
              <span>Look costs <strong>🪙 {lookCost.toLocaleString()}</strong> · Lala has <strong>{Number(coins).toLocaleString()}</strong></span>
              <span>After the look <strong style={{ color: coins - lookCost < 0 ? 'var(--danger-text)' : 'var(--lala-ink)' }}>{(coins - lookCost).toLocaleString()}</strong></span>
            </div>
            <button onClick={lockOutfit} disabled={!canLock || confirming}
              style={{ ...W.lockBtn, opacity: canLock ? 1 : 0.4 }}>
              {confirming ? '⏳ Locking...' : canLock ? '🔒 Lock Outfit' : '⚠️ Fill required slots'}
            </button>
            {!canLock && (
              <div style={{ fontSize: 10, color: 'var(--lala-ink-muted)', textAlign: 'center' }}>
                Need: {!filledSlots.body && !(filledSlots.top && filledSlots.bottom) ? 'body ' : ''}
                {!filledSlots.shoes ? 'shoes' : ''}
              </div>
            )}
            <button onClick={handleLalaSuggests} disabled={suggestingOutfit || pool.length === 0}
              style={{ ...W.lockBtn, background: 'var(--surface-card)', color: 'var(--lala-lavender-text)', border: '1px solid var(--lala-lavender)', marginTop: 6, opacity: pool.length > 0 ? 1 : 0.4 }}>
              {suggestingOutfit ? '✨ Lala is thinking...' : '✨ Lala Suggests'}
            </button>
          </div>

          {/* ──── RIGHT: BROWSE ──── */}
          <div style={W.browsePanel}>
            {/* Browse mode tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 10, background: 'var(--lala-parchment-2)', borderRadius: 8, padding: 3 }}>
              {[
                { key: 'pool', label: 'For This Event' },
                { key: 'closet', label: 'Full Closet' },
                { key: 'search', label: 'Search' },
              ].map(m => (
                <button key={m.key} onClick={() => {
                  setBrowseMode(m.key);
                  if (m.key === 'pool' && (activeSlot === OTHER_GROUP.key || activeSlot === ALL_GROUP.key)) setActiveSlot('body');
                  // W3: the Full Closet opens on All, and reloads.
                  if (m.key === 'closet') setActiveSlot(ALL_GROUP.key);
                  if (m.key !== 'pool' && (m.key !== browseMode || closetItems.length === 0)) loadCloset();
                }}
                  style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: browseMode === m.key ? 700 : 400, background: browseMode === m.key ? 'var(--surface-card)' : 'transparent', color: browseMode === m.key ? 'var(--lala-lavender-text)' : 'var(--lala-ink-muted)', cursor: 'pointer', boxShadow: browseMode === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Search bar */}
            {browseMode === 'search' && (
              <input type="text" placeholder="Search by name, brand, or tag..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
            )}

            {closetError && browseMode !== 'pool' && (
              <div data-testid="closet-error" role="alert" style={{ padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: 12 }}>
                Couldn't load the closet ({closetError}). <button type="button" onClick={loadCloset} style={{ border: 'none', background: 'none', color: 'var(--danger-text)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>Try again</button>
              </div>
            )}
            {closetLoading && browseMode !== 'pool' && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--lala-ink-muted)', fontSize: 12 }}>Loading closet...</div>
            )}

            <div style={W.browseHeader}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lala-ink)' }}>
                  {activeSlot === OTHER_GROUP.key ? OTHER_GROUP.icon : activeSlot === ALL_GROUP.key ? ALL_GROUP.icon : activeSlot === SETS_GROUP.key ? SETS_GROUP.icon : (CAT_ICONS[SLOT_DEFS.find(s => s.key === activeSlot)?.categories?.[0]] || '👕')} {browseMode === 'pool' ? 'Matches the dress code · ' : ''}{activeSlot === 'body' ? 'Dress' : activeSlot === OTHER_GROUP.key ? OTHER_GROUP.label : activeSlot === ALL_GROUP.key ? ALL_GROUP.label : activeSlot === SETS_GROUP.key ? SETS_GROUP.label : SLOT_DEFS.find(s => s.key === activeSlot)?.label || activeSlot}
                </div>
                <div style={{ fontSize: 11, color: 'var(--lala-ink-muted)' }}>{activeSlot === SETS_GROUP.key
                  ? `${matchingSets.length} set${matchingSets.length === 1 ? '' : 's'} · Wear a set to equip every piece`
                  : `${filteredBrowseItems.length} items · ${activeSlot === OTHER_GROUP.key ? 'Browse only — no game slot' : 'Click to equip'}`}</div>
                {browseMode === 'closet' && !closetLoading && !closetError && (
                  <div data-testid="closet-count" style={{ fontSize: 11, color: closetTotal != null && closetTotal > closetItems.length ? 'var(--danger-text)' : 'var(--lala-parchment-3)' }}>
                    {`${closetItems.length} of ${closetTotal ?? closetItems.length} pieces${closetTotal != null && closetTotal > closetItems.length ? ' — some did not load' : ''}`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {/* Task #2377: the Full Closet and Search offer every category
                    (Bottom even with a dress on, filled slots, and Other); the
                    event pool keeps its open-slot switcher. */}
                {(browseMode === 'pool'
                  ? visibleSlots.filter(s => MULTI_SLOTS.has(s.key) || !filledSlots[s.key])
                  : [ALL_GROUP, SETS_GROUP, ...SLOT_DEFS, OTHER_GROUP]
                ).map(s => (
                  <button key={s.key} onClick={() => setActiveSlot(s.key)} title={s.label} aria-label={s.label}
                    style={{ ...W.slotSwitch, background: activeSlot === s.key ? 'var(--lala-lavender)' : 'var(--lala-parchment-2)', color: activeSlot === s.key ? 'var(--text-inverse)' : 'var(--lala-ink-muted)' }}>
                    {s.icon}
                    {/* W3: each group's piece count in the closet. */}
                    {browseMode !== 'pool' && <span style={{ fontSize: 9, marginLeft: 2 }}>{closetGroupCounts[s.key] || 0}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={W.browseGrid}>
              {/* W1: each matching set as one look; Wear the set equips every piece. */}
              {browseMode !== 'pool' && activeSlot === SETS_GROUP.key && matchingSets.map(set => {
                const wornIds = new Set(outfitPieces(filledSlots).map(({ item: w }) => w.id));
                const wearing = set.pieces.every(p => wornIds.has(p.id));
                return (
                  <div key={set.id} data-testid={`matching-set-${set.id}`} style={{ ...W.browseCard, gridColumn: '1/-1', border: '1px solid var(--lala-lavender-line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lala-ink)' }}>{set.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--lala-ink-muted)' }}>{`${set.pieces.length} pieces`}</div>
                      </div>
                      {wearing
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-text)' }}>✓ Wearing</span>
                        : <button type="button" onClick={() => wearSet(set)} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: 'var(--lala-lavender)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Wear the set</button>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {set.pieces.map(p => (
                        <div key={p.id} title={p.name} style={{ width: 56, textAlign: 'center', opacity: p.can_select ? 1 : 0.45 }}>
                          <GarmentImage item={p} fallback={CAT_ICONS[p.clothing_category] || '👕'} size={48} />
                          <div style={{ fontSize: 9, color: 'var(--lala-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {browseMode !== 'pool' && activeSlot === SETS_GROUP.key && matchingSets.length === 0 && !closetLoading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: 'var(--lala-ink-muted)', fontSize: 12 }}>
                  No matching sets yet. Link pieces as a set in the show's Wardrobe (select pieces, then Create set).
                </div>
              )}
              {filteredBrowseItems.map((item, idx) => {
                const ts = TIER_STYLES[item.tier] || TIER_STYLES.basic;
                const rs = ROLE_STYLES[item.pool_role] || ROLE_STYLES.safe;
                const isLocked = !item.is_owned;
                const isUsed = outfitPieces(filledSlots).some(({ item: fi }) => fi?.id === item.id);
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
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lala-ink)', marginBottom: 1 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--lala-ink-muted)', marginBottom: 4 }}>{item.color || '—'} · {item.era_alignment || '—'}</div>
                    {item.outfit_set_id && (
                      <div data-testid={`closet-set-${item.id}`} style={{ fontSize: 10, color: 'var(--lala-lavender-text)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{`🔗 ${item.outfit_set_name || 'Matching set'}`}</span>
                        {browseMode === 'pool' && (
                          <button type="button" data-testid={`wear-set-${item.id}`}
                            onClick={(e) => { e.stopPropagation(); wearSetOf(item); }}
                            style={{ padding: '2px 8px', border: 'none', borderRadius: 5, background: 'var(--lala-lavender)', color: 'var(--text-inverse)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                            Wear the set
                          </button>
                        )}
                      </div>
                    )}
                    {browseMode !== 'pool' && (
                      <div data-testid={`closet-category-${item.id}`} style={{ fontSize: 10, color: 'var(--lala-ink-muted)', marginBottom: 4 }}>
                        {`${item.clothing_category || 'no category'} · ${[...SLOT_DEFS, OTHER_GROUP].find(g => g.key === closetGroupFor(item.clothing_category))?.label || 'Other'}`}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                      {(item.aesthetic_tags || []).slice(0, 3).map((t, i) => (
                        <span key={i} style={W.tagPill}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ flex: 1, height: 3, background: 'var(--lala-parchment-2)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.match_score / 60) * 100)}%`, borderRadius: 2, background: item.match_score >= 40 ? 'var(--success)' : item.match_score >= 20 ? 'var(--warning)' : 'var(--danger)' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{item.match_score}</span>
                    </div>
                    <div style={{ fontSize: 9, marginTop: 3, fontWeight: 600,
                      color: isUsed ? 'var(--lala-lavender-text)' : item.can_select ? 'var(--success-text)' : item.can_purchase ? 'var(--warning)' : 'var(--danger)' }}>
                      {isUsed ? '✓ In outfit'
                        : item.can_select ? (item.can_purchase ? `✅ Tap to equip · 🪙 ${item.coin_cost} on Lock` : '✅ Tap to equip')
                        : item.can_purchase ? (
                          <span onClick={(e) => { e.stopPropagation(); purchaseItem(item); }}
                            style={{ cursor: 'pointer', color: 'var(--warning-text)' }}>
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
              {filteredBrowseItems.length === 0 && activeSlot !== SETS_GROUP.key && !(browseMode !== 'pool' && closetLoading) && !(browseMode === 'search' && !searchQuery.trim()) && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: 'var(--lala-ink-muted)' }}>
                  <div style={{ fontSize: 24 }}>{[...SLOT_DEFS, OTHER_GROUP].find(s => s.key === activeSlot)?.icon || '👕'}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>No {activeSlot} items available</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ OUTFIT HISTORY ═══ */}
      {outfitHistory.length > 0 && (
        <details style={{ marginTop: 16, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--lala-ink)' }}>
            👗 Outfit History — {outfitHistory.length} episode{outfitHistory.length !== 1 ? 's' : ''}
          </summary>
          <div style={{ padding: '0 16px 12px' }}>
            {outfitHistory.map(ep => (
              <div key={ep.episode_id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--lala-parchment-2)', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--lala-parchment-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--lala-lavender-text)', flexShrink: 0 }}>
                  {ep.episode_number || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lala-ink)' }}>{ep.episode_title || 'Untitled'}</div>
                  <div style={{ fontSize: 10, color: 'var(--lala-ink-muted)' }}>
                    {ep.event_name && <span>{ep.event_name} · </span>}
                    {ep.items.length} pieces · {ep.items.map(i => i.name).slice(0, 3).join(', ')}{ep.items.length > 3 ? '...' : ''}
                  </div>
                </div>
                {ep.prestige && <span style={{ fontSize: 10, color: 'var(--lala-gold-text)', fontWeight: 600 }}>⭐{ep.prestige}</span>}
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
                <div style={{ fontSize: 12, color: 'var(--lala-ink-muted)' }}>{inspecting.clothing_category} · {inspecting.color || '—'} · {inspecting.tier}</div>
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--lala-parchment-2)', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Match Score</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: inspecting.match_score >= 40 ? 'var(--success-text)' : 'var(--warning-text)' }}>{inspecting.match_score}/60</span>
              </div>
              <div style={{ height: 6, background: 'var(--lala-parchment-3)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (inspecting.match_score / 60) * 100)}%`, borderRadius: 3, background: inspecting.match_score >= 40 ? 'var(--success)' : 'var(--warning)' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {(inspecting.match_reasons || []).map((r, i) => <span key={i} style={W.reasonPill}>{r}</span>)}
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--warning-bg)', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lala-lavender-text)', letterSpacing: 1, marginBottom: 3 }}>LALA SAYS</div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--lala-ink-muted)' }}>"{inspecting.lala_reaction}"</div>
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
              <div style={{ padding: 10, background: 'var(--lala-parchment-2)', borderRadius: 8, textAlign: 'center', color: 'var(--lala-ink-muted)', fontSize: 12, fontWeight: 600 }}>
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
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, color: 'var(--danger-text)', fontSize: 13, marginBottom: 10 },
  successBanner: { padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, color: 'var(--success-text)', fontSize: 13, marginBottom: 10, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer' },
  eventBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', padding: '18px 22px', background: 'var(--surface-card)', border: '1px solid var(--lala-lavender-line)', borderRadius: 14, marginBottom: 10, color: 'var(--lala-ink)' },
  lookTitle: { margin: 0, fontFamily: 'var(--font-prose)', fontSize: 22, fontWeight: 600, color: 'var(--lala-ink)' },
  lookChip: { padding: '2px 10px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning-text)', fontSize: 12, fontWeight: 600 },
  linkBtn: { marginTop: 4, padding: 0, border: 'none', background: 'none', color: 'var(--lala-lavender-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dressCode: { padding: '12px 16px', marginBottom: 12, borderRadius: 12, background: 'var(--accent-subtle)', color: 'var(--lala-ink)', fontSize: 14, lineHeight: 1.5 },
  eventLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--accent-dark)', marginBottom: 2 },
  eventName: { fontSize: 13, color: 'var(--lala-ink-muted)' },
  eventTags: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 },
  eventTag: { padding: '2px 8px', background: 'var(--lala-lavender-soft)', borderRadius: 999, fontSize: 11, color: 'var(--lala-lavender-text)' },
  lockedBanner: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'var(--success-bg)', border: '2px solid var(--success-border)', borderRadius: 12, marginBottom: 12 },
  unlockBtn: { marginLeft: 'auto', padding: '6px 14px', background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: 'var(--lala-ink-muted)' },
  // flexWrap: at 375px the browse panel drops under the slots (Task #2377).
  mainLayout: { display: 'flex', flexWrap: 'wrap', gap: 16, minHeight: 480 },
  // The slots column is 250px beside the browse panel and the full width
  // once it wraps onto its own row at phone width (Evoni, 2026-10-05: it
  // stayed 250px and left half the screen empty). The browse panel's large
  // grow weight keeps the slots at about 250px when the two share a row.
  slotsPanel: { flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 6 },
  confidenceCard: { padding: 12, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12, marginBottom: 2 },
  synergyBar: { height: 6, background: 'var(--lala-parchment-2)', borderRadius: 3, overflow: 'hidden' },
  synBadge: { padding: '1px 5px', background: 'var(--lala-lavender-soft)', borderRadius: 3, fontSize: 8, color: 'var(--lala-lavender-text)', fontWeight: 600 },
  costBar: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4, padding: '10px 12px', borderRadius: 10, background: 'var(--lala-lavender-soft)', color: 'var(--lala-ink)', fontSize: 13 },
  slotCard: { padding: '8px 12px', borderRadius: 10, transition: 'all 0.15s' },
  removeBtn: { width: 22, height: 22, borderRadius: '50%', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  miniTier: (tier) => ({ padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 600, background: (TIER_STYLES[tier] || TIER_STYLES.basic).bg, color: (TIER_STYLES[tier] || TIER_STYLES.basic).color }),
  lockBtn: { padding: '11px 18px', background: 'var(--lala-lavender)', border: 'none', borderRadius: 10, color: 'var(--text-inverse)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  browsePanel: { flex: '999 1 280px', minWidth: 0 },
  browseHeader: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  slotSwitch: { width: 30, height: 30, borderRadius: 7, border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  browseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 },
  browseCard: { padding: 12, borderRadius: 12, background: 'var(--surface-card)', transition: 'all 0.15s' },
  rolePill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700 },
  tierPill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  tagPill: { padding: '1px 4px', background: 'var(--lala-parchment-2)', borderRadius: 3, fontSize: 8, color: 'var(--lala-ink-muted)' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: 'var(--surface-card)', borderRadius: 18, padding: 22, maxWidth: 420, width: '100%', position: 'relative', maxHeight: '80vh', overflowY: 'auto' },
  modalClose: { position: 'absolute', top: 12, right: 12, background: 'var(--lala-parchment-2)', border: 'none', width: 28, height: 28, borderRadius: '50%', fontSize: 13, cursor: 'pointer', color: 'var(--lala-ink-muted)' },
  reasonPill: { padding: '2px 6px', background: 'var(--lala-lavender-soft)', borderRadius: 4, fontSize: 9, color: 'var(--lala-lavender-text)', fontWeight: 600 },
  modalSelectBtn: { width: '100%', padding: '11px', background: 'var(--lala-lavender)', border: 'none', borderRadius: 10, color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  modalBuyBtn: { width: '100%', padding: '9px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, color: 'var(--warning-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
};
