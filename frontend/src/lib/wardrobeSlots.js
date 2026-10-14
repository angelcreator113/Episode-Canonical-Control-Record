/**
 * Wardrobe slot taxonomy — frontend twin of src/utils/wardrobeSlots.js.
 *
 * Keep both files in lock-step: same keys, same accepts lists, same metadata.
 * If you change one, change the other — the backend scores by slot and the
 * frontend renders by slot, so divergence shows up as mis-bucketed items.
 */

// Hair is the hairstyle or wig, one at a time (Evoni, 2026-10-14, Task #3167).
export const SLOT_KEYS = ['outfit', 'shoes', 'jewelry', 'accessories', 'hair', 'fragrance'];

export const SLOT_DEFS = {
  outfit:      { key: 'outfit',      label: 'Outfit',      icon: '👗', required: true,  multi: false, accepts: ['dress', 'top', 'bottom', 'outerwear'], desc: 'Dress, or top + bottom (outerwear layers on top)' },
  shoes:       { key: 'shoes',       label: 'Shoes',       icon: '👠', required: true,  multi: false, accepts: ['shoes'],                                  desc: 'One pair' },
  jewelry:     { key: 'jewelry',     label: 'Jewelry',     icon: '💍', required: false, multi: true,  accepts: ['jewelry'],                                desc: 'Necklace, earrings, bracelets — multiple allowed' },
  accessories: { key: 'accessories', label: 'Accessories', icon: '👜', required: false, multi: true,  accepts: ['accessory', 'bag'],                       desc: 'Bag, hair bows and clips, scarf, belt — multiple allowed' },
  hair:        { key: 'hair',        label: 'Hair',        icon: '💇', required: false, multi: false, accepts: ['hair'],                                   desc: 'One hairstyle or wig' },
  fragrance:   { key: 'fragrance',   label: 'Fragrance',   icon: '🌸', required: false, multi: false, accepts: ['perfume'],                                desc: 'One scent' },
};

export const CATEGORY_TO_SLOT = SLOT_KEYS.reduce((acc, slot) => {
  for (const cat of SLOT_DEFS[slot].accepts) acc[cat] = slot;
  return acc;
}, {});

// Synonyms + plurals + common misspellings — mirror of src/utils/wardrobeSlots.js
// Keep both files in sync. Letting legacy / AI-classified / free-text categories
// still route to a slot without forcing a DB rewrite.
export const CATEGORY_ALIASES = {
  dresses: 'dress', gown: 'dress', gowns: 'dress', sundress: 'dress',
  tops: 'top', shirt: 'top', shirts: 'top', blouse: 'top', blouses: 'top', tee: 'top', tshirt: 'top', 't-shirt': 'top', tank: 'top',
  bottoms: 'bottom', skirt: 'bottom', skirts: 'bottom', pants: 'bottom', pant: 'bottom', trousers: 'bottom', jeans: 'bottom', shorts: 'bottom',
  jacket: 'outerwear', coat: 'outerwear', blazer: 'outerwear', cardigan: 'outerwear',
  heels: 'shoes', heel: 'shoes', boots: 'shoes', boot: 'shoes', sandals: 'shoes', sandal: 'shoes',
  sneakers: 'shoes', sneaker: 'shoes', flats: 'shoes', flat: 'shoes', loafers: 'shoes', pumps: 'shoes',
  necklace: 'jewelry', necklaces: 'jewelry', earring: 'jewelry', earrings: 'jewelry',
  ring: 'jewelry', rings: 'jewelry', bracelet: 'jewelry', bracelets: 'jewelry', watch: 'jewelry',
  jewellery: 'jewelry',
  accessories: 'accessory', bags: 'bag', handbag: 'bag', handbags: 'bag', purse: 'bag', purses: 'bag', clutch: 'bag', clutches: 'bag', minaudiere: 'bag', 'minaudière': 'bag', tote: 'bag', totes: 'bag',
  scarf: 'accessory', scarves: 'accessory', hat: 'accessory', hats: 'accessory',
  belt: 'accessory', belts: 'accessory', sunglasses: 'accessory', glasses: 'accessory', gloves: 'accessory',
  // Hair accessories stay accessories (Evoni, 2026-10-14, Task #3167): the
  // Hair slot is the hairstyle or wig.
  'hair bow': 'accessory', 'hair bows': 'accessory', 'hair clip': 'accessory', 'hair clips': 'accessory',
  headband: 'accessory', headbands: 'accessory', 'hair accessory': 'accessory', 'hair accessories': 'accessory',
  'hair pin': 'accessory', 'hair pins': 'accessory', hairpin: 'accessory', hairpins: 'accessory',
  'hair tie': 'accessory', 'hair ties': 'accessory', scrunchie: 'accessory', scrunchies: 'accessory',
  // hair slot
  wig: 'hair', wigs: 'hair', hairstyle: 'hair', hairstyles: 'hair', 'hair style': 'hair', hairdo: 'hair',
  fragrance: 'perfume', fragrances: 'perfume', perfumes: 'perfume', cologne: 'perfume', scent: 'perfume',
  swimwear: 'top', swimsuit: 'top', bikini: 'top', activewear: 'top',
};

// Sub-category options per slot, for UIs that want a two-level "which slot, then
// which specific category" picker on upload. Fragrance + shoes + jewelry each
// only map to one underlying category, so their "sub" is a single-item list.
export const SLOT_SUBCATEGORIES = {
  outfit:      [{ value: 'dress', label: '👗 Dress' }, { value: 'top', label: '👚 Top' }, { value: 'bottom', label: '👖 Bottom' }, { value: 'outerwear', label: '🧥 Outerwear' }],
  shoes:       [{ value: 'shoes', label: '👠 Shoes' }],
  jewelry:     [{ value: 'jewelry', label: '💍 Jewelry' }],
  accessories: [{ value: 'bag', label: '👜 Bag' }, { value: 'accessory', label: '🎀 Accessory (hair bow, scarf, belt)' }],
  hair:        [{ value: 'hair', label: '💇 Hair (hairstyle, wig)' }],
  fragrance:   [{ value: 'perfume', label: '🌸 Perfume' }],
};

// Aliases that hold a category's name ("hair bow" holds "hair"), read before
// the category names in the substring step.
const SPECIFIC_ALIASES = Object.keys(CATEGORY_ALIASES)
  .filter((alias) => Object.keys(CATEGORY_TO_SLOT).some((cat) => alias !== cat && alias.includes(cat)));

/**
 * Given a wardrobe item's clothing_category, return the UI slot key it belongs
 * to, or null if unknown. Three-stage resolution: canonical → alias → substring
 * match against canonical + alias keys (catches "evening dress", "ankle boots").
 */
export function getSlotForCategory(clothing_category) {
  if (!clothing_category || typeof clothing_category !== 'string') return null;
  const normalized = clothing_category.toLowerCase().trim();
  if (CATEGORY_TO_SLOT[normalized]) return CATEGORY_TO_SLOT[normalized];
  const aliased = CATEGORY_ALIASES[normalized];
  if (aliased && CATEGORY_TO_SLOT[aliased]) return CATEGORY_TO_SLOT[aliased];
  // An alias that holds a category's name is the more specific one, so it is
  // read first: "velvet hair bow" is an accessory, not Hair (Task #3167).
  for (const key of SPECIFIC_ALIASES) {
    if (normalized.includes(key)) return CATEGORY_TO_SLOT[CATEGORY_ALIASES[key]];
  }
  for (const key of Object.keys(CATEGORY_TO_SLOT)) {
    if (normalized.includes(key)) return CATEGORY_TO_SLOT[key];
  }
  for (const key of Object.keys(CATEGORY_ALIASES)) {
    if (normalized.includes(key)) return CATEGORY_TO_SLOT[CATEGORY_ALIASES[key]];
  }
  return null;
}

/**
 * Bucket wardrobe items into the slots. Items with an unknown category land
 * in `__unassigned` so the UI can flag them.
 */
export function groupItemsBySlot(items) {
  const out = { __unassigned: [] };
  for (const slot of SLOT_KEYS) out[slot] = [];
  for (const item of items || []) {
    const cat = item.clothing_category || item.itemType || item.item_type;
    const slot = getSlotForCategory(cat);
    if (slot) out[slot].push(item);
    else out.__unassigned.push(item);
  }
  return out;
}
