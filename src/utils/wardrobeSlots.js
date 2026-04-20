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

/**
 * Given a wardrobe item's clothing_category, return the UI slot key it belongs
 * to, or null if the category doesn't map to any of the 5 slots. Falls back to
 * a loose lowercase comparison so "Jewelry" and "JEWELRY" route the same as
 * "jewelry" — older rows have inconsistent casing.
 */
function getSlotForCategory(clothing_category) {
  if (!clothing_category || typeof clothing_category !== 'string') return null;
  return CATEGORY_TO_SLOT[clothing_category.toLowerCase().trim()] || null;
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
  getSlotForCategory,
  groupItemsBySlot,
};
