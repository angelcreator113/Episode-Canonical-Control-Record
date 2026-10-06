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
 * A category the game has no slot for (a free-text value, a missing one)
 * resolves to the Other group, so the Full Closet shows every
 * item rather than dropping it.
 */
import { CATEGORY_TO_SLOT, CATEGORY_ALIASES } from './wardrobeSlots';

export const GAME_SLOT_DEFS = [
  { key: 'body', icon: '👗', label: 'Body', categories: ['dress'], required: true, desc: 'Dress or Top+Bottom' },
  { key: 'top', icon: '👚', label: 'Top', categories: ['top'], required: false, desc: 'With bottom' },
  { key: 'bottom', icon: '👖', label: 'Bottom', categories: ['bottom'], required: false, desc: 'With top' },
  // Evoni, 2026-10-06: a jacket over a blouse. One layer (jacket, blazer,
  // coat, cardigan) over a dress or a top and bottom; before, outerwear had
  // no slot and sat in Other, browse-only.
  { key: 'outerwear', icon: '🧥', label: 'Outerwear', categories: ['outerwear'], required: false, desc: 'Layers over the outfit' },
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
export const OTHER_GROUP = { key: 'other', icon: '📦', label: 'Other', categories: [], required: false, desc: 'Uncategorized pieces' };

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

// ─── W1 (Evoni, 2026-10-01): matching sets ───
// "Wardrobe pieces can be linked as a matching set; choosing the set equips
// every piece in its own slot at once, and the set shows as one look.
// Pieces stay individually choosable." A set is the pieces sharing
// outfit_set_id (named outfit_set_name; POST /api/v1/wardrobe/matching-sets).
export const SETS_GROUP = { key: 'sets', icon: '🔗', label: 'Sets', categories: [], required: false, desc: 'Matching sets' };

/** The matching sets among closet items: [{ id, name, pieces }], by name. */
export function matchingSetsFrom(items) {
  const byId = new Map();
  for (const item of items || []) {
    const id = item?.outfit_set_id;
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id, name: item.outfit_set_name || 'Matching set', pieces: [] });
    byId.get(id).pieces.push(item);
  }
  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/**
 * The slots after equipping one piece (pure): a dress clears top and
 * bottom, a top or bottom clears the dress, Accessories and Jewelry add
 * beside the rest (W2), any other slot is replaced. A piece with no game
 * slot changes nothing.
 */
export function equipInto(filled, item) {
  const slotKey = gameSlotFor(item?.clothing_category);
  if (!slotKey) return filled;
  if (MULTI_SLOTS.has(slotKey)) {
    const worn = slotPieces(filled, slotKey);
    return worn.some((p) => p.id === item.id) ? filled : { ...filled, [slotKey]: [...worn, item] };
  }
  if (slotKey === 'body') return { ...filled, body: item, top: undefined, bottom: undefined };
  if (slotKey === 'top' || slotKey === 'bottom') return { ...filled, [slotKey]: item, body: undefined };
  return { ...filled, [slotKey]: item };
}

/**
 * The looks being worn: a set shows as one look once two or more of its
 * pieces are on. [{ id, name, worn }].
 */
export function wornLooks(filled) {
  const byId = new Map();
  for (const { item } of outfitPieces(filled)) {
    const id = item?.outfit_set_id;
    if (!id) continue;
    const look = byId.get(id) || { id, name: item.outfit_set_name || 'Matching set', worn: 0 };
    look.worn += 1;
    byId.set(id, look);
  }
  return [...byId.values()].filter((l) => l.worn >= 2);
}

/**
 * A closet card's backdrop (Evoni, 2026-10-05: cut-out pieces sat on a flat
 * box): the piece's game slot, else 'other'. WorldAdmin.css colours each
 * .wa-wd-backdrop.bd-<key> with a pastel and a studio glow.
 */
export function backdropFor(item) {
  return closetGroupFor(item?.clothing_category);
}
