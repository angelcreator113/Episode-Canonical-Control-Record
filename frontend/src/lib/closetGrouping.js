/**
 * Episode Wardrobe game — category grouping and Full Closet loading
 * (Task #2377).
 *
 * The game's slots (Body/Top/Bottom/Shoes/Accessories/Jewelry/Perfume) are
 * finer than the shared five-slot taxonomy in lib/wardrobeSlots (which folds
 * dress/top/bottom into one "outfit" slot), so they are keyed by the shared
 * *canonical category* instead: a clothing_category is resolved to a
 * canonical category through CATEGORY_TO_SLOT / CATEGORY_ALIASES (the one
 * canonical map, shared with the backend twin src/utils/wardrobeSlots.js),
 * then to the game slot that lists it.
 *
 * A category the game has no slot for (outerwear, a free-text value, a
 * missing one) resolves to the Other group, so the Full Closet shows every
 * item rather than dropping it.
 */
import { CATEGORY_TO_SLOT, CATEGORY_ALIASES } from './wardrobeSlots';

export const GAME_SLOT_DEFS = [
  { key: 'body', icon: '👗', label: 'Body', categories: ['dress'], required: true, desc: 'Dress or Top+Bottom' },
  { key: 'top', icon: '👚', label: 'Top', categories: ['top'], required: false, desc: 'With bottom' },
  { key: 'bottom', icon: '👖', label: 'Bottom', categories: ['bottom'], required: false, desc: 'With top' },
  { key: 'shoes', icon: '👠', label: 'Shoes', categories: ['shoes'], required: true, desc: 'Required' },
  { key: 'accessories', icon: '👜', label: 'Accessories', categories: ['accessory', 'bag'], required: false, desc: 'Optional' },
  { key: 'jewelry', icon: '💍', label: 'Jewelry', categories: ['jewelry'], required: false, desc: 'Optional' },
  { key: 'perfume', icon: '🌸', label: 'Perfume', categories: ['perfume'], required: false, desc: 'Optional' },
];

// W2 (Evoni, 2026-10-01): "Accessories and jewellery allow several pieces
// at once; body (dress or top+bottom) and shoes stay single." A multi slot
// holds an array of pieces; every other slot holds one piece.
export const MULTI_SLOTS = new Set(['accessories', 'jewelry']);

/** The pieces in one slot, as an array (a single slot gives 0 or 1). */
export function slotPieces(filled, key) {
  const v = filled?.[key];
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

/** Every piece worn, as [{ slot, item }], multi slots expanded. */
export function outfitPieces(filled) {
  const out = [];
  for (const key of Object.keys(filled || {})) {
    for (const item of slotPieces(filled, key)) out.push({ slot: key, item });
  }
  return out;
}

/**
 * Slots in the current shape: a multi slot as an array (a draft saved
 * before W2 held one piece there), a single slot as one piece.
 */
export function normalizeSlots(raw) {
  const out = {};
  for (const [key, v] of Object.entries(raw || {})) {
    if (MULTI_SLOTS.has(key)) {
      const pieces = slotPieces(raw, key);
      if (pieces.length) out[key] = pieces;
    } else if (v && !Array.isArray(v)) {
      out[key] = v;
    } else if (Array.isArray(v) && v[0]) {
      out[key] = v[0];
    }
  }
  return out;
}

// W3 (Evoni, 2026-10-01): the Full Closet opens on every piece at once.
export const ALL_GROUP = { key: 'all', icon: '🗂️', label: 'All', categories: [], required: false, desc: 'Every piece in the closet' };
// The Full Closet's catch-all for items no game slot accepts. Browse-only:
// these pieces cannot be equipped into a game slot.
export const OTHER_GROUP = { key: 'other', icon: '🧥', label: 'Other', categories: [], required: false, desc: 'Outerwear and uncategorized pieces' };

const exactCanonical = (w) => (CATEGORY_TO_SLOT[w] ? w : CATEGORY_ALIASES[w] || null);

/**
 * clothing_category → canonical category ('dress', 'bottom', 'outerwear' …),
 * or null. Stages: exact canonical; alias; the last word (the head noun —
 * "Mini Skirt" → bottom, "Dress Shoes" → shoes, "wide-leg pants" → bottom);
 * then any canonical/alias key contained in the value ("ankle boots").
 */
export function canonicalCategory(clothingCategory) {
  if (clothingCategory == null) return null;
  const n = String(clothingCategory).toLowerCase().trim().replace(/\s+/g, ' ');
  if (!n) return null;
  const direct = exactCanonical(n);
  if (direct) return direct;
  const words = n.split(/[\s/_,&+-]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const hit = exactCanonical(words[i]);
    if (hit) return hit;
  }
  for (const key of Object.keys(CATEGORY_TO_SLOT)) {
    if (n.includes(key)) return key;
  }
  for (const key of Object.keys(CATEGORY_ALIASES)) {
    if (n.includes(key)) return CATEGORY_ALIASES[key];
  }
  return null;
}

/** clothing_category → game slot key, or null when no game slot accepts it. */
export function gameSlotFor(clothingCategory) {
  const canonical = canonicalCategory(clothingCategory);
  if (!canonical) return null;
  return GAME_SLOT_DEFS.find(s => s.categories.includes(canonical))?.key || null;
}

/** clothing_category → Full Closet group key: a game slot, or 'other'. */
export function closetGroupFor(clothingCategory) {
  return gameSlotFor(clothingCategory) || OTHER_GROUP.key;
}

/** Bucket items into every game slot plus Other; no item is dropped. */
export function groupClosetItems(items) {
  const out = {};
  for (const s of GAME_SLOT_DEFS) out[s.key] = [];
  out[OTHER_GROUP.key] = [];
  for (const item of items || []) {
    if (!item) continue;
    out[closetGroupFor(item.clothing_category)].push(item);
  }
  return out;
}

export const CLOSET_PAGE_SIZE = 200;
// Hard stop so a server that ignores `page` cannot loop forever:
// 100 pages × 200 = 20,000 items, far above any closet.
export const CLOSET_MAX_PAGES = 100;

/**
 * Every non-deleted wardrobe item for the show (GET /api/v1/wardrobe pages
 * through `page`/`limit`). The endpoint defaults to 50 and a single
 * `limit=200` request silently dropped the oldest items, so this reads
 * until the server's pagination.total is reached or a page comes back short.
 */
export async function fetchAllClosetItems(api, showId, options) {
  return (await fetchClosetWithTotal(api, showId, options)).items;
}

/**
 * { items, total }: every closet item, and how many the server says the
 * closet holds (null when it does not say). A total above items.length means
 * some pieces did not load (W3).
 */
export async function fetchClosetWithTotal(api, showId, { pageSize = CLOSET_PAGE_SIZE, maxPages = CLOSET_MAX_PAGES } = {}) {
  const all = [];
  let serverTotal = null;
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await api.get(`/api/v1/wardrobe?show_id=${encodeURIComponent(showId)}&limit=${pageSize}&page=${page}`);
    const body = res?.data;
    const rows = body?.data || body?.items || (Array.isArray(body) ? body : []);
    if (!Array.isArray(rows) || rows.length === 0) break;
    let added = 0;
    for (const row of rows) {
      const key = row?.id ?? `__${all.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(row);
      added += 1;
    }
    const total = Number(body?.pagination?.total);
    if (Number.isFinite(total)) serverTotal = total;
    if (Number.isFinite(total) && all.length >= total) break;
    if (rows.length < pageSize || added === 0) break;
    if (page === maxPages) {
      console.warn(`[closet] stopped after ${maxPages} pages (${all.length} items); the closet may be incomplete`);
    }
  }
  return { items: all, total: serverTotal };
}
