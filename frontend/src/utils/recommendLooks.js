/**
 * Recommended looks (Evoni, 2026-10-03, episode creation step 3): two or
 * three whole outfits for an event, built from the closet's per-piece
 * event_match (GET …/events/:eventId/wardrobe-options, scored by
 * scorePieceForEvent). Deterministic, no AI.
 *
 * A look is the outfit (a dress, or a top with a bottom), shoes, and one
 * piece each of jewelry, bag or accessory, and fragrance when the closet
 * has them. Pieces Lala owns come first; within that, the higher match.
 * Each look starts from a different outfit; the other slots take the best
 * piece unless an unused one is nearly as good (within VARIETY_MARGIN), so
 * the looks differ without getting worse.
 *
 * Returns [{ key, label, pieces, match, owned, toBuy, toBuyCost, missing }]
 * where match is the rounded mean event_match, toBuy the pieces she does
 * not own, toBuyCost their coin_cost, and missing the required slots the
 * closet could not fill ('shoes').
 *
 * Pure; no I/O.
 */
import { CATEGORY_TO_SLOT, CATEGORY_ALIASES } from '../lib/wardrobeSlots';
import { lookTotal } from '../lib/lookCharge';

export const VARIETY_MARGIN = 10;
const LABELS = ['Look A', 'Look B', 'Look C'];

// The base category (dress, top, bottom, outerwear, shoes, jewelry, bag,
// accessory, perfume), resolved the way getSlotForCategory resolves a slot.
export function baseCategory(clothingCategory) {
  if (!clothingCategory || typeof clothingCategory !== 'string') return null;
  const n = clothingCategory.toLowerCase().trim();
  if (CATEGORY_TO_SLOT[n]) return n;
  if (CATEGORY_ALIASES[n] && CATEGORY_TO_SLOT[CATEGORY_ALIASES[n]]) return CATEGORY_ALIASES[n];
  for (const key of Object.keys(CATEGORY_TO_SLOT)) if (n.includes(key)) return key;
  for (const key of Object.keys(CATEGORY_ALIASES)) if (n.includes(key)) return CATEGORY_ALIASES[key];
  return null;
}

const match = (item) => (Number.isFinite(Number(item?.event_match)) ? Number(item.event_match) : 0);
export const isOwned = (item) => item?.is_owned === true || item?.is_owned === 'true' || item?.is_owned === 1;
const owned = isOwned;
const byRank = (a, b) => (owned(b) - owned(a)) || (match(b) - match(a)) || String(a.name || '').localeCompare(String(b.name || ''));

// The best piece for a slot, or an unused one nearly as good.
function pick(ranked, used) {
  if (!ranked.length) return null;
  const best = ranked[0];
  if (!used.has(best.id)) return best;
  const alt = ranked.find((p) => !used.has(p.id) && owned(p) === owned(best) && match(best) - match(p) <= VARIETY_MARGIN);
  return alt || best;
}

export function recommendLooks(items, { count = 3 } = {}) {
  const buckets = {};
  for (const item of items || []) {
    const cat = baseCategory(item?.clothing_category);
    if (!cat || !item.id) continue;
    (buckets[cat] = buckets[cat] || []).push(item);
  }
  for (const list of Object.values(buckets)) list.sort(byRank);
  const get = (cat) => buckets[cat] || [];

  // Outfit bases: each dress alone, each top with the best bottom.
  const bottom = get('bottom')[0] || null;
  const bases = [
    ...get('dress').map((d) => [d]),
    ...(bottom ? get('top').map((t) => [t, bottom]) : []),
  ];
  const baseRank = (b) => ({ allOwned: b.every(owned), m: b.reduce((s, p) => s + match(p), 0) / b.length });
  bases.sort((a, b) => {
    const ra = baseRank(a); const rb = baseRank(b);
    return (rb.allOwned - ra.allOwned) || (rb.m - ra.m);
  });

  const looks = [];
  const usedBy = { shoes: new Set(), jewelry: new Set(), accent: new Set(), perfume: new Set() };
  const accents = [...get('bag'), ...get('accessory')].sort(byRank);
  for (const base of bases.slice(0, count)) {
    const pieces = [...base];
    const add = (slot, ranked) => {
      const p = pick(ranked, usedBy[slot]);
      if (p) { pieces.push(p); usedBy[slot].add(p.id); }
      return p;
    };
    const shoes = add('shoes', get('shoes'));
    add('jewelry', get('jewelry'));
    add('accent', accents);
    add('perfume', get('perfume'));

    const toBuy = pieces.filter((p) => !owned(p));
    looks.push({
      key: pieces.map((p) => p.id).join('+'),
      label: LABELS[looks.length] || `Look ${looks.length + 1}`,
      pieces,
      match: Math.round(pieces.reduce((s, p) => s + match(p), 0) / pieces.length),
      owned: toBuy.length === 0,
      toBuy,
      // What Complete would charge for the look (lib/lookCharge: gifted and
      // borrowed free, a rental at its rental price; Evoni, 2026-10-07).
      toBuyCost: lookTotal(pieces),
      missing: shoes ? [] : ['shoes'],
    });
  }
  return looks;
}
