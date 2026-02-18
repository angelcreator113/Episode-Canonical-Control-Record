/**
 * Browse Pool Generator
 * 
 * Generates the "closet browsing" illusion for Styling Adventures.
 * Creates a pool of candidate wardrobe items and a sequence of 
 * browse actions (open, scroll, hover, hover, hover, select) that
 * mimic the real-time styling experience.
 * 
 * Used in: Evaluate page Step 2 + Timeline UI Actions track
 * 
 * Location: src/utils/browsePoolGenerator.js
 */

'use strict';

// ─── CATEGORIES ───

const BROWSE_CATEGORIES = [
  { key: 'outfit', label: 'Outfit', closetCategory: 'Outfit', minItems: 5, maxItems: 8 },
  { key: 'accessories', label: 'Accessories', closetCategory: 'Accessories', minItems: 3, maxItems: 5 },
  { key: 'shoes', label: 'Shoes', closetCategory: 'Shoes', minItems: 3, maxItems: 4 },
  { key: 'bags', label: 'Bags', closetCategory: 'Bags', minItems: 2, maxItems: 3 },
  { key: 'fragrance', label: 'Fragrance', closetCategory: 'Fragrance', minItems: 2, maxItems: 3 },
];

// ─── BIAS PROFILES ───

const BIAS_PROFILES = {
  balanced: { style_weight: 1.0, formality_weight: 1.0, random_weight: 0.3 },
  glam: { style_boost: ['luxury', 'bold', 'dramatic', 'jewel'], formality_min: 7 },
  cozy: { style_boost: ['soft', 'warm', 'casual', 'knit'], formality_max: 5 },
  couture: { style_boost: ['couture', 'haute', 'structured', 'tailored'], formality_min: 8 },
  trendy: { style_boost: ['trendy', 'modern', 'street', 'fresh'], formality_max: 7 },
  romantic: { style_boost: ['romantic', 'vintage', 'lace', 'floral', 'soft'], formality_min: 5 },
};


/**
 * Generate a browse pool from available wardrobe items
 * 
 * @param {object} params
 * @param {Array} params.wardrobeItems - All available wardrobe items for this show
 * @param {object} params.selectedOutfit - The final chosen outfit items {outfit_id, accessory_ids, shoe_id, bag_id, fragrance_id}
 * @param {object} [params.event] - Event attributes for smart filtering {dress_code, prestige, strictness}
 * @param {string} [params.bias='balanced'] - Bias profile: balanced|glam|cozy|couture|trendy|romantic
 * @param {number} [params.poolSize=8] - Target pool size per category
 * @param {boolean} [params.includeWildcard=true] - Add 1 surprise item per category
 * @returns {object} {browse_pool, browse_actions, browse_script_lines}
 */
function generateBrowsePool({
  wardrobeItems = [],
  selectedOutfit = {},
  event = {},
  bias = 'balanced',
  poolSize = 8,
  includeWildcard = true,
}) {
  const biasProfile = BIAS_PROFILES[bias] || BIAS_PROFILES.balanced;
  const browsePool = {};
  const allBrowseActions = [];
  const scriptLines = [];
  let globalTimestamp = 0;

  for (const category of BROWSE_CATEGORIES) {
    // Filter items by category
    const categoryItems = wardrobeItems.filter(item => {
      const cat = (item.clothing_category || item.category || '').toLowerCase();
      return cat === category.key ||
             cat === category.closetCategory.toLowerCase() ||
             (item.tags && Array.isArray(item.tags.type) && item.tags.type.includes(category.key));
    });

    if (categoryItems.length === 0) {
      // Generate placeholder pool with fake items
      const pool = generatePlaceholderPool(category, poolSize, biasProfile);
      browsePool[category.key] = pool;
      const { actions, lines, endTime } = generateBrowseActions(
        category, pool, selectedOutfit[category.key + '_id'], globalTimestamp
      );
      allBrowseActions.push(...actions);
      scriptLines.push(...lines);
      globalTimestamp = endTime;
      continue;
    }

    // Score and sort items by relevance to event
    const scoredItems = categoryItems.map(item => ({
      ...item,
      relevance: scoreItemRelevance(item, event, biasProfile),
    })).sort((a, b) => b.relevance - a.relevance);

    // Build pool: top relevant + selected item guaranteed + optional wildcard
    const targetSize = Math.min(
      Math.max(category.minItems, Math.min(poolSize, category.maxItems)),
      scoredItems.length
    );

    const pool = [];
    const selectedId = selectedOutfit[category.key + '_id'];
    const usedIds = new Set();

    // Ensure selected item is in pool
    if (selectedId) {
      const selectedItem = scoredItems.find(i => i.id === selectedId);
      if (selectedItem) {
        pool.push({ ...selectedItem, is_selected: true });
        usedIds.add(selectedId);
      }
    }

    // Fill with top relevant items
    for (const item of scoredItems) {
      if (pool.length >= targetSize) break;
      if (usedIds.has(item.id)) continue;
      pool.push({ ...item, is_selected: false });
      usedIds.add(item.id);
    }

    // Add wildcard (lowest relevance item not already in pool)
    if (includeWildcard && scoredItems.length > pool.length) {
      const wildcard = [...scoredItems].reverse().find(i => !usedIds.has(i.id));
      if (wildcard) {
        pool.push({ ...wildcard, is_selected: false, is_wildcard: true });
      }
    }

    // Shuffle pool (but keep selected item at a natural position — not first, not last)
    const shuffled = shuffleWithSelectedPosition(pool, selectedId);
    browsePool[category.key] = shuffled;

    // Generate browse actions for this category
    const { actions, lines, endTime } = generateBrowseActions(
      category, shuffled, selectedId, globalTimestamp
    );
    allBrowseActions.push(...actions);
    scriptLines.push(...lines);
    globalTimestamp = endTime;
  }

  return {
    browse_pool: browsePool,
    browse_actions: allBrowseActions,
    browse_script_lines: scriptLines,
    config: {
      bias,
      pool_size: poolSize,
      include_wildcard: includeWildcard,
      total_items: Object.values(browsePool).reduce((sum, items) => sum + items.length, 0),
      total_actions: allBrowseActions.length,
      estimated_duration_s: Math.round(globalTimestamp * 10) / 10,
    },
  };
}


/**
 * Score an item's relevance to an event
 */
function scoreItemRelevance(item, event, biasProfile) {
  let score = 0;
  const tags = item.tags || {};
  const styles = tags.style || tags.styles || [];
  const formality = tags.formality || 5;
  const vibes = tags.vibe || tags.vibes || [];

  // Event dress code match
  if (event.dress_code) {
    const keywords = event.dress_code.toLowerCase().split(/\s+/);
    for (const kw of keywords) {
      if (styles.some(s => s.toLowerCase().includes(kw))) score += 3;
      if (vibes.some(v => v.toLowerCase().includes(kw))) score += 2;
    }
  }

  // Formality alignment with prestige
  if (event.prestige) {
    const diff = Math.abs(formality - event.prestige);
    score += Math.max(5 - diff, 0);
  }

  // Bias profile boosts
  if (biasProfile.style_boost) {
    for (const boost of biasProfile.style_boost) {
      if (styles.some(s => s.toLowerCase().includes(boost))) score += 2;
    }
  }
  if (biasProfile.formality_min && formality >= biasProfile.formality_min) score += 2;
  if (biasProfile.formality_max && formality <= biasProfile.formality_max) score += 2;

  // Random factor (prevents identical pools)
  score += Math.random() * (biasProfile.random_weight || 0.3) * 3;

  return Math.round(score * 10) / 10;
}


/**
 * Generate browse actions for a category
 */
function generateBrowseActions(category, pool, selectedId, startTime) {
  const actions = [];
  const lines = [];
  let t = startTime;

  // Open category
  actions.push({
    type: 'OPEN_CATEGORY',
    target: category.closetCategory,
    timestamp_s: round(t),
    duration_s: 1.2,
  });
  lines.push(`[UI:OPEN ClosetCategory ${category.closetCategory}]`);
  t += 1.2;

  // Scroll
  const scrollCount = Math.min(pool.length, 5);
  actions.push({
    type: 'SCROLL',
    target: 'ClosetItems',
    count: scrollCount,
    timestamp_s: round(t),
    duration_s: scrollCount * 0.3,
  });
  lines.push(`[UI:SCROLL ClosetItems x${scrollCount}]`);
  t += scrollCount * 0.3;

  // Hover 2-3 items before selecting
  const hoverCount = Math.min(pool.length - 1, 3);
  const nonSelectedItems = pool.filter(i => !i.is_selected && (i.id || i.name));
  const hoverTargets = nonSelectedItems.slice(0, hoverCount);

  for (const item of hoverTargets) {
    const itemName = item.name || item.id || 'Item';
    actions.push({
      type: 'HOVER',
      target: itemName,
      item_id: item.id,
      timestamp_s: round(t),
      duration_s: 0.4,
    });
    lines.push(`[UI:HOVER Item ${itemName}]`);
    t += 0.6; // hover + pause
  }

  // Select final item
  const selectedItem = pool.find(i => i.is_selected) || pool[pool.length - 1];
  const selectedName = selectedItem?.name || selectedItem?.id || category.closetCategory + 'Item';
  actions.push({
    type: 'SELECT',
    target: selectedName,
    item_id: selectedItem?.id,
    timestamp_s: round(t),
    duration_s: 0.6,
  });
  lines.push(`[UI:SELECT Item ${selectedName}]`);
  t += 0.6;

  // Check item
  actions.push({
    type: 'CHECK',
    target: `Checklist:${category.label}`,
    timestamp_s: round(t),
    duration_s: 0.5,
  });
  lines.push(`[UI:CHECK_ITEM Checklist:${category.label}]`);
  t += 0.8;

  // Small gap before next category
  t += 0.5;

  return { actions, lines, endTime: t };
}


/**
 * Generate placeholder pool when no real wardrobe items exist
 */
function generatePlaceholderPool(category, poolSize, biasProfile) {
  const count = Math.min(poolSize, category.maxItems);
  const items = [];
  const adjectives = biasProfile.style_boost || ['classic', 'elegant', 'modern', 'chic', 'bold'];

  for (let i = 0; i < count; i++) {
    const adj = adjectives[i % adjectives.length];
    items.push({
      id: `placeholder_${category.key}_${i + 1}`,
      name: `${capitalize(adj)} ${capitalize(category.label)} ${i + 1}`,
      is_placeholder: true,
      is_selected: i === count - 1, // last one is "selected"
      tags: { style: [adj], formality: 5 },
    });
  }

  return items;
}


/**
 * Shuffle array but place selected item at a natural position (60-80% through)
 */
function shuffleWithSelectedPosition(pool, selectedId) {
  const selected = pool.find(i => i.id === selectedId);
  const others = pool.filter(i => i.id !== selectedId);

  // Fisher-Yates shuffle
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  if (!selected) return others;

  // Insert selected at ~70% position
  const insertIdx = Math.floor(others.length * 0.7);
  others.splice(insertIdx, 0, selected);
  return others;
}


function round(n) { return Math.round(n * 10) / 10; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }


module.exports = {
  generateBrowsePool,
  scoreItemRelevance,
  generateBrowseActions,
  BROWSE_CATEGORIES,
  BIAS_PROFILES,
};
