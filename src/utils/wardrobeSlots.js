'use strict';

/**
 * Wardrobe slot taxonomy — the 5 buckets that outfit UIs + scoring roll up to.
 *
 * DB keeps `clothing_category` granular (dress, top, bottom, shoes, jewelry,
 * accessory, bag, outerwear, perfume) so filtering, browse-pool scoring, and
 * AI prompts can distinguish pieces. UIs group those into five user-facing
 * slots so the player sees one "Outfit" row instead of juggling dress vs
 * top+bottom, and one "Accessories" row instead of bag vs hair-bow.
 *
 * Keep this file in sync with frontend/src/lib/wardrobeSlots.js — the shape
 * is intentionally identical so client + server agree on routing and reports.
 */

// Ordered slot keys — also the render order for per-slot breakdown UIs.
const SLOT_KEYS = ['outfit', 'shoes', 'jewelry', 'accessories', 'fragrance'];

// Per-slot metadata. `accepts` lists the `clothing_category` values routed to
// this slot; `multi` flags slots that can hold more than one piece (jewelry
// and accessories each stack — necklace + earrings, bag + hair bow).
const SLOT_DEFS = {
  outfit:      { key: 'outfit',      label: 'Outfit',      icon: '👗', required: true,  multi: false, accepts: ['dress', 'top', 'bottom', 'outerwear'], desc: 'Dress, or top + bottom (outerwear layers on top)' },
  shoes:       { key: 'shoes',       label: 'Shoes',       icon: '👠', required: true,  multi: false, accepts: ['shoes'],                                  desc: 'One pair' },
  jewelry:     { key: 'jewelry',     label: 'Jewelry',     icon: '💍', required: false, multi: true,  accepts: ['jewelry'],                                desc: 'Necklace, earrings, bracelets — multiple allowed' },
  accessories: { key: 'accessories', label: 'Accessories', icon: '👜', required: false, multi: true,  accepts: ['accessory', 'bag'],                       desc: 'Bag, hair pieces, scarf, belt — multiple allowed' },
  fragrance:   { key: 'fragrance',   label: 'Fragrance',   icon: '🌸', required: false, multi: false, accepts: ['perfume'],                                desc: 'One scent' },
};

// Reverse map: clothing_category → slot key. Computed once at module load.
const CATEGORY_TO_SLOT = SLOT_KEYS.reduce((acc, slot) => {
  for (const cat of SLOT_DEFS[slot].accepts) acc[cat] = slot;
  return acc;
}, {});

// Synonyms + plurals + common misspellings that should still resolve to a slot.
// Keeps the canonical `accepts` lists in SLOT_DEFS tight (what the upload form
// offers) while letting legacy data, AI-classified items, or pasted imports
// still bucket correctly. Kept in sync with the frontend twin.
const CATEGORY_ALIASES = {
  // outfit slot
  dresses: 'dress', gown: 'dress', gowns: 'dress', sundress: 'dress',
  tops: 'top', shirt: 'top', shirts: 'top', blouse: 'top', blouses: 'top', tee: 'top', tshirt: 'top', 't-shirt': 'top', tank: 'top',
  bottoms: 'bottom', skirt: 'bottom', skirts: 'bottom', pants: 'bottom', pant: 'bottom', trousers: 'bottom', jeans: 'bottom', shorts: 'bottom',
  jacket: 'outerwear', coat: 'outerwear', blazer: 'outerwear', cardigan: 'outerwear',
  // shoes slot
  heels: 'shoes', heel: 'shoes', boots: 'shoes', boot: 'shoes', sandals: 'shoes', sandal: 'shoes',
  sneakers: 'shoes', sneaker: 'shoes', flats: 'shoes', flat: 'shoes', loafers: 'shoes', pumps: 'shoes',
  // jewelry slot
  necklace: 'jewelry', necklaces: 'jewelry', earring: 'jewelry', earrings: 'jewelry',
  ring: 'jewelry', rings: 'jewelry', bracelet: 'jewelry', bracelets: 'jewelry', watch: 'jewelry',
  jewellery: 'jewelry',
  // accessories slot
  accessories: 'accessory', bags: 'bag', handbag: 'bag', handbags: 'bag', purse: 'bag', purses: 'bag', clutch: 'bag', clutches: 'bag', minaudiere: 'bag', minaudière: 'bag', tote: 'bag', totes: 'bag',
  scarf: 'accessory', scarves: 'accessory', hat: 'accessory', hats: 'accessory',
  belt: 'accessory', belts: 'accessory', sunglasses: 'accessory', glasses: 'accessory', gloves: 'accessory',
  hair: 'accessory', 'hair bow': 'accessory', 'hair clip': 'accessory', headband: 'accessory',
  // fragrance slot
  fragrance: 'perfume', fragrances: 'perfume', perfumes: 'perfume', cologne: 'perfume', scent: 'perfume',
  // Legacy categories still ambient in older seed data — collapse under outfit
  // since they'd show on top or bottom of the body.
  swimwear: 'top', swimsuit: 'top', bikini: 'top', activewear: 'top',
};

/**
 * Given a wardrobe item's clothing_category, return the UI slot key it belongs
 * to, or null if the category doesn't map to any of the 5 slots. Falls back to
 * a loose lowercase comparison so "Jewelry" and "JEWELRY" route the same as
 * "jewelry" — older rows have inconsistent casing.
 *
 * Resolution order:
 *   1. Exact canonical match (dress, top, shoes, etc.)
 *   2. Alias match (dresses → dress → outfit, handbag → bag → accessories)
 *   3. Substring match against the canonical keys (last-ditch for free-text
 *      categories like "Evening Dress" — picks up "dress")
 *   4. null
 */
function getSlotForCategory(clothing_category) {
  if (!clothing_category || typeof clothing_category !== 'string') return null;
  const normalized = clothing_category.toLowerCase().trim();
  // 1. Canonical
  if (CATEGORY_TO_SLOT[normalized]) return CATEGORY_TO_SLOT[normalized];
  // 2. Alias
  const aliased = CATEGORY_ALIASES[normalized];
  if (aliased && CATEGORY_TO_SLOT[aliased]) return CATEGORY_TO_SLOT[aliased];
  // 3. Substring against canonical + alias keys — helps "evening dress",
  // "ankle boots", "leather jacket" resolve without needing exact match.
  for (const key of Object.keys(CATEGORY_TO_SLOT)) {
    if (normalized.includes(key)) return CATEGORY_TO_SLOT[key];
  }
  for (const key of Object.keys(CATEGORY_ALIASES)) {
    if (normalized.includes(key)) return CATEGORY_TO_SLOT[CATEGORY_ALIASES[key]];
  }
  return null;
}

/**
 * Bucket an array of wardrobe items by slot. Items whose clothing_category
 * doesn't map to a known slot land under `__unassigned` so callers can still
 * see them (e.g. surface a "fix this item's category" warning in the UI).
 */
function groupItemsBySlot(items) {
  const out = { outfit: [], shoes: [], jewelry: [], accessories: [], fragrance: [], __unassigned: [] };
  for (const item of items || []) {
    const cat = item.clothing_category || item.itemType || item.item_type;
    const slot = getSlotForCategory(cat);
    if (slot) out[slot].push(item);
    else out.__unassigned.push(item);
  }
  return out;
}

module.exports = {
  SLOT_KEYS,
  SLOT_DEFS,
  CATEGORY_TO_SLOT,
  CATEGORY_ALIASES,
  getSlotForCategory,
  groupItemsBySlot,
};
