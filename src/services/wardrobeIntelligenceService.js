'use strict';

const { SLOT_KEYS, SLOT_DEFS, groupItemsBySlot, getSlotForCategory } = require('../utils/wardrobeSlots');

/**
 * Wardrobe Intelligence Service
 *
 * Powers all wardrobe-driven narrative decisions:
 * 1. Outfit match scoring (outfit vs event — not filtering, scoring)
 * 2. Repeat outfit detection (worn before → script tension or power move)
 * 3. Brand relationship tracking (loyalty → opportunities)
 * 4. Outfit cost vs prestige gap (drives confidence/anxiety)
 * 5. Wardrobe growth arc (closet value over time)
 * 6. Feed reaction triggers (what social profiles say about the outfit)
 * 7. Financial pressure (can she afford this outfit for this event?)
 */

// ── 1. OUTFIT MATCH SCORING ─────────────────────────────────────────────────
// Scores how well an outfit matches an event — NOT a filter, a narrative signal

const TIER_VALUES = { basic: 1, mid: 2, luxury: 3, elite: 4 };
const TIER_LABELS = { 1: 'basic', 2: 'mid', 3: 'luxury', 4: 'elite' };

// ── Secondary evaluation signals ────────────────────────────────────────────
// These fire on the aggregate outfit (not per-slot) and add narrative texture
// that tier-gap alone can't express. Each helper returns either `null` (no
// opinion) or a `{ type, text, narrative, delta }` signal that can be merged
// into the main signals array + match score.

// Rough color families for harmony detection. Items with unknown color names
// fall through as "neutral" — no bonus, no penalty. Kept deliberately small:
// expanding it past ~20 groups makes the signal noisy.
const COLOR_FAMILIES = {
  warm: ['red', 'orange', 'coral', 'rust', 'burgundy', 'maroon', 'terracotta', 'rose', 'pink'],
  cool: ['blue', 'navy', 'teal', 'mint', 'green', 'emerald', 'aqua', 'sky'],
  neutral: ['black', 'white', 'grey', 'gray', 'beige', 'cream', 'ivory', 'nude', 'tan', 'taupe'],
  metallic: ['gold', 'silver', 'bronze', 'champagne', 'copper', 'rose gold'],
  jewel: ['purple', 'violet', 'lavender', 'plum', 'amethyst', 'sapphire', 'ruby'],
  pastel: ['blush', 'peach', 'lavender', 'mint', 'buttercream', 'powder'],
};
function classifyColor(name) {
  if (!name || typeof name !== 'string') return 'unknown';
  const lower = name.toLowerCase();
  for (const [family, members] of Object.entries(COLOR_FAMILIES)) {
    if (members.some(c => lower.includes(c))) return family;
  }
  return 'unknown';
}

function normalizeTagList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value).map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  // Handles JSON arrays serialized as text in older rows.
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter split.
    }
  }

  return raw
    .split(/[|,;/]/)
    .map(v => v.toLowerCase().trim())
    .filter(Boolean);
}

function getEventMatchTargets(event) {
  return [event?.event_type, event?.dress_code]
    .map(v => String(v || '').toLowerCase().trim())
    .filter(Boolean);
}

function itemMatchesEventContext(item, event) {
  const targets = getEventMatchTargets(event);
  if (targets.length === 0) return false;

  const occasion = String(item?.occasion || '').toLowerCase().trim();
  const eventTypes = normalizeTagList(item?.event_types);
  const tokens = [occasion, ...eventTypes].filter(Boolean);
  if (tokens.length === 0) return false;

  return targets.some(target => tokens.some(tok => tok.includes(target) || target.includes(tok)));
}

/**
 * Color harmony — rewards outfits whose pieces sit in the same family (or all
 * neutrals + one accent), flags chaotic palettes. Neutrals + metallics are
 * treated as universal anchors so "black dress + gold jewelry" reads as
 * cohesive, not conflicted.
 */
function evaluateColorHarmony(items) {
  const families = items.map(i => classifyColor(i.color)).filter(f => f !== 'unknown');
  if (families.length < 2) return null;
  const anchors = new Set(['neutral', 'metallic']);
  const colorful = families.filter(f => !anchors.has(f));
  const uniqueColorful = new Set(colorful);
  if (uniqueColorful.size === 0) {
    return { type: 'color_cohesive', text: 'All neutrals/metallics — classic palette', narrative: 'confidence_boost', delta: 6 };
  }
  if (uniqueColorful.size === 1) {
    return { type: 'color_cohesive', text: `Anchored on ${[...uniqueColorful][0]} — palette holds together`, narrative: 'confidence_boost', delta: 6 };
  }
  if (uniqueColorful.size >= 3) {
    return { type: 'color_busy', text: 'Three+ color families fighting — palette reads busy', narrative: 'mild_anxiety', delta: -8 };
  }
  return null;
}

/**
 * Occasion precision — matches items' `occasion` tag against the event's
 * dress_code / event_type keywords. Precise match (≥60% of items tagged for
 * this occasion) bumps the score; 0% hits gets flagged.
 */
function evaluateOccasionPrecision(items, event) {
  if (getEventMatchTargets(event).length === 0) return null;

  const taggedItems = items.filter(i => {
    const occ = (i.occasion || '').toLowerCase();
    const eventTypes = normalizeTagList(i.event_types);
    return Boolean(occ) || eventTypes.length > 0;
  });
  if (taggedItems.length === 0) return null;

  const hits = taggedItems.filter(i => itemMatchesEventContext(i, event)).length;
  const ratio = taggedItems.length ? hits / taggedItems.length : 0;
  if (ratio >= 0.6) return { type: 'occasion_precise', text: 'Tagged pieces align with this event context', narrative: 'strategic', delta: 6 };
  if (ratio === 0 && taggedItems.length >= 2) return { type: 'occasion_miss', text: 'Tagged pieces do not align with this event context', narrative: 'mild_anxiety', delta: -6 };
  return null;
}

/**
 * Season match — if the event has a known month/season and items have season
 * tags, reward alignment. An all-winter outfit at a summer brunch reads wrong.
 */
function evaluateSeasonMatch(items, event) {
  const eventSeason = (event?.season || '').toLowerCase();
  if (!eventSeason) return null;
  const wrong = items.filter(i => {
    const s = (i.season || '').toLowerCase();
    return s && s !== 'all-season' && s !== eventSeason;
  }).length;
  if (wrong === 0) return null;
  if (wrong >= Math.ceil(items.length / 2)) {
    return { type: 'season_off', text: `Half the pieces are wrong-season for a ${eventSeason} event`, narrative: 'mild_anxiety', delta: -5 };
  }
  return { type: 'season_minor', text: `${wrong} piece${wrong > 1 ? 's are' : ' is'} wrong-season for a ${eventSeason} event`, narrative: 'mild_anxiety', delta: -2 };
}

/**
 * Era consistency — items carry era_alignment (foundation/glow_up/luxury/
 * prime/legacy). Mixing eras reads as "throwback"; a single-era outfit reads
 * as intentional. Only fires when ≥50% of items have an era tag.
 */
function evaluateEraConsistency(items) {
  const withEra = items.filter(i => i.era_alignment);
  if (withEra.length < Math.ceil(items.length / 2)) return null;
  const eras = new Set(withEra.map(i => i.era_alignment));
  if (eras.size === 1) {
    return { type: 'era_consistent', text: `Grounded in the ${[...eras][0]} era — reads intentional`, narrative: 'confidence_boost', delta: 4 };
  }
  if (eras.size >= 3) {
    return { type: 'era_mixed', text: `Three eras mixed (${[...eras].join(', ')}) — reads like a throwback`, narrative: 'tension', delta: -3 };
  }
  return null;
}

/**
 * evaluateCharacterMoodFit — same outfit, different headspace, different
 * score. Reads character_state.stress and character_state.reputation and
 * modulates the outfit signal:
 *
 *   - High stress wearing a confidence outfit → relief delta (+4)
 *   - High stress wearing a tense/anxious outfit → compounded penalty (-3)
 *   - Low rep wearing a strongly overdressed outfit → "trying too hard"
 *     overcompensation penalty (-3)
 *   - Low rep wearing tier-matched outfit → authenticity boost (+2)
 *   - High rep wearing underdressed outfit → reputation expects more (-4)
 *
 * Returns null when characterState isn't available (UI calls without it
 * to avoid extra DB hops). Without this, the same dress at the same gala
 * always scored the same regardless of Lala's headspace — the wardrobe
 * was context-blind to her actual state.
 *
 * tier_gap is the same metric scoreOutfitForEvent already computes (avg
 * outfit tier minus expected event tier).
 */
function evaluateCharacterMoodFit(tierGap, narrativeMood, characterState) {
  if (!characterState) return null;
  const stress = parseInt(characterState.stress, 10) || 0;
  const reputation = parseInt(characterState.reputation, 10) || 0;

  // Stress relief from a confident outfit
  if (stress >= 7 && narrativeMood === 'confidence') {
    return { type: 'mood_relief', text: 'Stressed Lala in a confidence look — the outfit is doing the work', narrative: 'stress_relief', delta: 4 };
  }
  // Stress compounded by an anxious outfit
  if (stress >= 7 && (narrativeMood === 'anxiety' || narrativeMood === 'tension')) {
    return { type: 'mood_compound', text: 'Already stressed and the outfit reads anxious — the room will feel it', narrative: 'compound_stress', delta: -3 };
  }
  // Low-rep character overdressed = trying too hard
  if (reputation <= 2 && tierGap > 1) {
    return { type: 'overcompensation', text: 'Reaching for a tier she hasn\'t earned yet — reads as trying too hard', narrative: 'overcompensation', delta: -3 };
  }
  // Low-rep character tier-matched = knowing your place, authentic
  if (reputation <= 2 && Math.abs(tierGap) <= 0.5) {
    return { type: 'authentic_fit', text: 'Dressing for her current tier, not chasing — reads authentic', narrative: 'authenticity', delta: 2 };
  }
  // High-rep character underdressed = reputation expects more
  if (reputation >= 7 && tierGap < -1) {
    return { type: 'rep_underdressed', text: 'Her reputation precedes her — this look feels beneath her now', narrative: 'rep_drag', delta: -4 };
  }
  return null;
}

/**
 * Score a single slot against an event. Returns { match, status, reason } where
 * match is 0–100 and status is one of: 'empty' (nothing in the slot), 'low'
 * (<45), 'ok' (45–74), 'good' (75+). The reason is a short string the UI can
 * render directly — keeps the rendering code dumb.
 *
 * Slot scoring works on the same prestige-expected-tier model as the overall
 * score, but applied to THIS slot's items only, so creators can see exactly
 * which slot is dragging the total down. Multi-item slots (jewelry, access-
 * ories) average their pieces and add a small coordination bonus when 2+
 * pieces share at least one aesthetic tag.
 */
function scoreSingleSlot(slotKey, items, event, expectedTier) {
  const def = SLOT_DEFS[slotKey];
  // Per-event override for which slots are required. Events on shows that
  // demand a full 5-slot outfit (fragrance + jewelry + accessories included)
  // pass `required_slots: ['outfit','shoes','jewelry','accessories','fragrance']`.
  // Falls back to the slot def's own `required` when the event doesn't
  // specify, so outfit + shoes stay required by default for everyone else.
  const isRequired = Array.isArray(event?.required_slots)
    ? event.required_slots.includes(slotKey)
    : def.required;
  if (!items || items.length === 0) {
    return {
      slot: slotKey,
      label: def.label,
      icon: def.icon,
      required: isRequired,
      items: [],
      match: 0,
      status: 'empty',
      reason: isRequired ? `No ${def.label.toLowerCase()} selected — required for this event.` : null,
    };
  }

  // Average tier across the items in this slot.
  const tiers = items.map(i => TIER_VALUES[i.tier] || 2);
  const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length;
  const gap = avgTier - expectedTier;

  let match;
  let reason;
  if (gap >= 1.5) {
    match = 75;
    reason = `Tier is above the event — ${def.label} reads as overdressed.`;
  } else if (Math.abs(gap) <= 0.5) {
    match = 92;
    reason = `Tier nails the event's prestige.`;
  } else if (gap >= -1) {
    match = 65;
    reason = `Slightly under the event's tier — works but not hero-level.`;
  } else {
    match = 30;
    reason = `Tier is well under what the event expects (need ${TIER_LABELS[Math.round(expectedTier)] || 'higher'}).`;
  }

  // Host-brand bonus — wearing the host brand on the key piece is a statement.
  if (event && event.host_brand && items.some(i => i.brand === event.host_brand)) {
    match = Math.min(100, match + 8);
    reason = `${reason} Wearing ${event.host_brand} to their own event.`.trim();
  }

  // Multi-item coordination — reward jewelry/accessories that share tags.
  if (def.multi && items.length >= 2) {
    const tagSets = items.map(i => new Set((i.aesthetic_tags || []).map(t => String(t).toLowerCase())));
    const shared = [...tagSets[0]].filter(t => tagSets.every(s => s.has(t)));
    if (shared.length > 0) {
      match = Math.min(100, match + 4);
      reason = `${reason} Pieces coordinate on ${shared.slice(0, 2).join('/')}.`.trim();
    }
  }

  // Borrowed/rented piece flag — doesn't tank the score, but surfaces.
  const borrowed = items.find(i => i.acquisition_type === 'borrowed' || i.acquisition_type === 'rented');
  if (borrowed) {
    reason = `${reason} (${borrowed.name} is ${borrowed.acquisition_type}.)`.trim();
  }

  const status = match >= 75 ? 'good' : match >= 45 ? 'ok' : 'low';
  return {
    slot: slotKey,
    label: def.label,
    icon: def.icon,
    required: isRequired,
    items: items.map(i => ({ id: i.id, name: i.name, tier: i.tier, brand: i.brand })),
    match: Math.round(match),
    status,
    reason,
  };
}

function getExpectedTier(eventPrestige) {
  return eventPrestige <= 3 ? 1.5 : eventPrestige <= 5 ? 2 : eventPrestige <= 7 ? 3 : 3.5;
}

function getTierAlignmentScore(tierGap) {
  if (tierGap >= 1.5) return 72;
  if (tierGap > 1) return 80;
  if (Math.abs(tierGap) <= 0.5) return 94;
  if (tierGap >= -1) return 66;
  if (tierGap >= -1.5) return 48;
  return 28;
}

function scorePieceForEvent(item, event) {
  if (!item || !event) return null;

  const eventPrestige = event.prestige || 5;
  const expectedTier = getExpectedTier(eventPrestige);
  const itemTier = TIER_VALUES[item.tier] || 2;
  const tierGap = itemTier - expectedTier;

  const signals = [];
  let attributeScore = 50;

  const baseTierScore = getTierAlignmentScore(tierGap);
  if (tierGap > 1) {
    signals.push({ type: 'overdressed', text: 'This piece reads above the room tier', narrative: 'confidence_or_overcompensation' });
  } else if (Math.abs(tierGap) <= 0.5) {
    signals.push({ type: 'perfect_match', text: 'This piece matches the event tier', narrative: 'confidence_boost' });
  } else if (tierGap >= -1) {
    signals.push({ type: 'slight_under', text: 'This piece is slightly under event tier', narrative: 'mild_anxiety' });
  } else {
    signals.push({ type: 'underdressed', text: 'This piece is under event tier for the room', narrative: 'anxiety' });
  }

  if (event.host_brand && item.brand && item.brand === event.host_brand) {
    attributeScore += 22;
    signals.push({ type: 'brand_match', text: `Host-brand alignment: ${event.host_brand}`, narrative: 'strategic' });
  }

  const occasion = (item.occasion || '').toLowerCase();
  const eventTypes = normalizeTagList(item.event_types);
  const hasEventContextTags = Boolean(occasion) || eventTypes.length > 0;
  if (hasEventContextTags && getEventMatchTargets(event).length > 0) {
    if (itemMatchesEventContext(item, event)) {
      attributeScore += 12;
      signals.push({ type: 'occasion_precise', text: 'Occasion/event-type tags align to this event', narrative: 'strategic' });
    } else {
      attributeScore -= 5;
      signals.push({ type: 'occasion_miss', text: 'Occasion/event-type tags do not align cleanly', narrative: 'mild_anxiety' });
    }
  }

  if (Array.isArray(event.required_slots) && event.required_slots.length > 0) {
    const slot = getSlotForCategory(item.clothing_category);
    if (slot && event.required_slots.includes(slot)) {
      attributeScore += 4;
      signals.push({ type: 'required_slot', text: `${slot} is a required slot for this event`, narrative: 'strategic' });
    }
  }

  const eventSeason = (event.season || '').toLowerCase();
  const itemSeason = (item.season || '').toLowerCase();
  if (eventSeason && itemSeason && itemSeason !== 'all-season' && itemSeason !== eventSeason) {
    attributeScore -= 4;
    signals.push({ type: 'season_off', text: `Season mismatch for ${eventSeason} event`, narrative: 'mild_anxiety' });
  }

  if (item.acquisition_type === 'borrowed' || item.acquisition_type === 'rented') {
    attributeScore -= 1;
    signals.push({ type: 'borrowed', text: `Piece is ${item.acquisition_type}`, narrative: 'vulnerability' });
  }

  const timesWorn = parseInt(item.times_worn, 10) || 0;
  if (timesWorn >= 6 && eventPrestige >= 8) {
    attributeScore -= 3;
    signals.push({ type: 'repeat_fatigue', text: 'Heavy repeat on a high-prestige event', narrative: 'tension' });
  } else if (timesWorn >= 3) {
    attributeScore += 3;
    signals.push({ type: 'signature_piece', text: 'Repeat wear can read as signature styling', narrative: 'confidence_boost' });
  }

  attributeScore = Math.max(0, Math.min(100, attributeScore));
  const matchScore = Math.round((baseTierScore * 0.65) + (attributeScore * 0.35));

  let narrativeMood = 'neutral';
  if (matchScore >= 80) narrativeMood = 'confidence';
  else if (tierGap < -1) narrativeMood = 'anxiety';
  else if (tierGap > 1) narrativeMood = 'overcompensation';
  else if (matchScore < 55) narrativeMood = 'tension';

  return {
    match_score: Math.max(0, Math.min(100, matchScore)),
    piece_tier: itemTier,
    expected_tier: expectedTier,
    tier_gap: tierGap,
    signals,
    narrative_mood: narrativeMood,
  };
}

/**
 * Tier value lookup used by both the outfit scorer and the authenticity
 * gate (kept here so the gate can use the same scale without re-deriving).
 * Defined inline as a const since TIER_VALUES is already exported.
 */
const ARC_TIER_CAPS = {
  // Average outfit tier the arc stage can authentically pull off without
  // reading as overreach. Above the cap → "trying too hard" penalty.
  foundation: 1.5,  // basic + occasional mid
  building: 2.2,    // mid solid, occasional luxury
  glow_up: 2.8,     // luxury comfortable, occasional elite
  prime: 4.0,       // no ceiling
};

/**
 * evaluateAuthenticityFit — penalize outfits that exceed what the
 * character's wardrobe arc stage can support. Foundation Lala in an
 * all-elite gala outfit reads as overreach; prime Lala in the same
 * outfit reads as her standard. Without this, low-arc characters could
 * borrow/rent their way to perfect scores and never feel like they
 * earned the tier.
 *
 * Returns null when arcStage isn't provided (UI calls without it to
 * avoid a separate DB lookup).
 */
/**
 * evaluateRarityBonus — outfit pieces with non-trivial unlock gates
 * (brand_exclusive, season_drop, reputation, coin) feel rarer than
 * generic ownable pieces. The lock_type field exists on every wardrobe
 * row but no scorer ever read it. Now hitting the runway in a
 * brand-exclusive piece adds narrative weight ('she got the invite-only
 * version'); pulling out a season_drop reads as cultural currency.
 *
 * Counts pieces with lock_type ∈ {brand_exclusive, season_drop,
 * reputation, coin}. Trivial 'none' / null pieces don't count.
 *
 *   ≥1 brand_exclusive or season_drop → +5 (rarity surfaces)
 *   ≥2 of these                       → +8 (curated, intentional)
 *   ≥1 reputation/coin gate           → +2 (earned)
 *
 * Caps at +8. Returns null when nothing qualifies so the signal stays
 * out of the breakdown for ordinary outfits.
 */
/**
 * evaluateColorPsychology — color carries emotional valence the outfit
 * scorer used to ignore. Wearing red/burgundy reads as power; pastels
 * read as soft / vulnerable; metallics read as celebration. The
 * existing color_harmony signal only checks family cohesion (do
 * pieces match?), not whether the dominant family fits the event's
 * emotional pitch.
 *
 * Determines the dominant family across the outfit and compares it
 * to a context bucket derived from event_type + prestige + dress_code:
 *
 *   high_stakes  prestige ≥7, gala/premiere/brand_deal      →  warm/metallic/jewel  +4
 *   intimate     prestige ≤4 OR event_type=date/dinner/coffee →  pastel/neutral     +3
 *   celebratory  launch/after_party/opening + dress mentions sparkle →  metallic/jewel +5
 *   professional press/fitting/meeting + business in dress code  →  cool/neutral     +3
 *
 * Mismatches are softer penalties (-2) so creators don't feel
 * boxed in — color is one signal among many.
 *
 * Returns null when no dominant family or no clear context — color
 * harmony already covers the "do pieces match" angle.
 */
function evaluateColorPsychology(items, event) {
  if (!items?.length || !event) return null;
  const families = items.map(i => classifyColor(i.color)).filter(f => f !== 'unknown');
  if (families.length === 0) return null;
  // Dominant family — most-common, requires ≥half the pieces to qualify.
  const counts = {};
  for (const f of families) counts[f] = (counts[f] || 0) + 1;
  const [dominant, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (count < Math.ceil(families.length / 2)) return null;

  const eventType = String(event.event_type || '').toLowerCase();
  const dressCode = String(event.dress_code || '').toLowerCase();
  const prestige = parseInt(event.prestige, 10) || 5;
  const HIGH_STAKES = ['gala', 'premiere', 'brand_deal'].includes(eventType) || prestige >= 7;
  const INTIMATE = ['date', 'dinner', 'coffee'].includes(eventType) || prestige <= 4;
  const CELEBRATORY = ['launch', 'after_party', 'opening'].includes(eventType)
    || /sparkle|disco|metallic|dazzle|festive/.test(dressCode);
  const PROFESSIONAL = ['press', 'fitting', 'meeting', 'interview'].includes(eventType)
    || /business|professional|corporate|chic professional/.test(dressCode);

  // Match table — best-fit family per context. The order here is the
  // priority when an event hits multiple buckets (celebratory beats
  // high_stakes, professional beats intimate).
  let context, bestFamilies, narrativeMatch, narrativeMiss;
  if (CELEBRATORY) {
    context = 'celebratory'; bestFamilies = ['metallic', 'jewel']; narrativeMatch = 'occasion_match'; narrativeMiss = 'occasion_drag';
  } else if (PROFESSIONAL) {
    context = 'professional'; bestFamilies = ['cool', 'neutral']; narrativeMatch = 'composed'; narrativeMiss = 'too_loud';
  } else if (HIGH_STAKES) {
    context = 'high_stakes'; bestFamilies = ['warm', 'metallic', 'jewel']; narrativeMatch = 'power_signal'; narrativeMiss = 'underwhelming';
  } else if (INTIMATE) {
    context = 'intimate'; bestFamilies = ['pastel', 'neutral']; narrativeMatch = 'authentic_softness'; narrativeMiss = 'overdialed';
  } else {
    return null;
  }

  if (bestFamilies.includes(dominant)) {
    const text = {
      celebratory: `Mostly ${dominant} — reads festive, matches the room`,
      professional: `Mostly ${dominant} — reads composed`,
      high_stakes: `Mostly ${dominant} — color carries the room's weight`,
      intimate: `Mostly ${dominant} — soft tones read as authentic, not performative`,
    }[context];
    const delta = context === 'celebratory' ? 5 : context === 'high_stakes' ? 4 : 3;
    return { type: `color_${context}_match`, text, narrative: narrativeMatch, delta };
  }
  // Color directly conflicts with the context. Pastel at a power gala or
  // jewel tones at a brunch — soft penalty since the rest of the outfit
  // can still rescue it.
  const conflict = {
    celebratory: ['neutral', 'pastel'],
    professional: ['warm', 'jewel', 'metallic'],
    high_stakes: ['pastel'],
    intimate: ['warm', 'jewel'],
  }[context];
  if (conflict?.includes(dominant)) {
    const text = {
      celebratory: `Dominant ${dominant} reads quiet for a celebration`,
      professional: `Dominant ${dominant} reads loud for a professional context`,
      high_stakes: `Dominant ${dominant} feels gentle for the room's stakes`,
      intimate: `Dominant ${dominant} reads performative for an intimate moment`,
    }[context];
    return { type: `color_${context}_miss`, text, narrative: narrativeMiss, delta: -2 };
  }
  return null;
}

function evaluateRarityBonus(items) {
  if (!items?.length) return null;
  const elite = items.filter(i => ['brand_exclusive', 'season_drop'].includes(i.lock_type));
  const earned = items.filter(i => ['reputation', 'coin'].includes(i.lock_type));
  if (elite.length === 0 && earned.length === 0) return null;
  if (elite.length >= 2) {
    const tags = [...new Set(elite.map(i => i.lock_type))].join('+');
    return { type: 'rarity_curated', text: `Multiple ${tags} pieces — outfit reads as curated, not borrowed`, narrative: 'cultural_currency', delta: 8 };
  }
  if (elite.length >= 1) {
    return { type: 'rarity_signature', text: `Wearing ${elite[0].lock_type.replace('_', ' ')} — rarity reads`, narrative: 'cultural_currency', delta: 5 };
  }
  if (earned.length >= 1) {
    return { type: 'rarity_earned', text: `${earned.length} earned-unlock piece${earned.length > 1 ? 's' : ''} — feels worked-for`, narrative: 'authenticity', delta: 2 };
  }
  return null;
}

function evaluateAuthenticityFit(avgTier, arcStage) {
  if (!arcStage) return null;
  const cap = ARC_TIER_CAPS[arcStage];
  if (cap == null) return null;
  const overreach = avgTier - cap;
  if (overreach <= 0) return null;
  if (overreach >= 1.5) {
    return { type: 'arc_overreach_strong', text: `Wearing ${arcStage}+two-tiers above her arc — reads loud / borrowed / unearned`, narrative: 'overreach', delta: -6 };
  }
  if (overreach >= 0.8) {
    return { type: 'arc_overreach', text: `One tier above what her ${arcStage} arc has earned — reads as stretching`, narrative: 'overreach', delta: -4 };
  }
  return { type: 'arc_stretch', text: `Slightly above her ${arcStage} arc — borderline authentic`, narrative: 'mild_stretch', delta: -2 };
}

function scoreOutfitForEvent(wardrobeItems, event, ctx = {}) {
  if (!wardrobeItems?.length || !event) return null;
  // Backwards compat: previous signature accepted characterState as the
  // 3rd positional arg. If a non-null non-object is passed, or an object
  // with state-shaped keys but no `characterState` wrapper, treat it as
  // the legacy characterState.
  const characterState = ctx?.characterState
    ?? (ctx && ('coins' in ctx || 'stress' in ctx || 'reputation' in ctx) ? ctx : null);
  const arcStage = ctx?.arcStage || null;

  const eventPrestige = event.prestige || 5;
  const _eventType = event.event_type || 'invite';

  // Calculate outfit tier (average of all pieces)
  const tierSum = wardrobeItems.reduce((s, i) => s + (TIER_VALUES[i.tier] || 2), 0);
  const avgTier = tierSum / wardrobeItems.length;

  // Calculate total outfit cost
  const outfitCost = wardrobeItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  // Prestige alignment: how well does outfit tier match event prestige?
  // Prestige 1-3 → basic/mid fine. Prestige 7-10 → need luxury/elite
  const expectedTier = getExpectedTier(eventPrestige);
  const tierGap = avgTier - expectedTier;

  const tierComponent = getTierAlignmentScore(tierGap);
  let secondaryDelta = 0;
  const signals = [];

  // Overdressed (+)
  if (tierGap > 1) {
    secondaryDelta += 10;
    signals.push({ type: 'overdressed', text: 'She\'s overdressed — power move or trying too hard', narrative: 'confidence_or_overcompensation' });
  }
  // Perfect match
  else if (Math.abs(tierGap) <= 0.5) {
    secondaryDelta += 16;
    signals.push({ type: 'perfect_match', text: 'Outfit matches the room perfectly', narrative: 'confidence_boost' });
  }
  // Slightly under
  else if (tierGap >= -1) {
    secondaryDelta += 4;
    signals.push({ type: 'slight_under', text: 'Slightly underdressed — she knows it', narrative: 'mild_anxiety' });
  }
  // Very underdressed
  else {
    secondaryDelta -= 14;
    signals.push({ type: 'underdressed', text: 'She\'s underdressed for this event — everyone will notice', narrative: 'anxiety' });
  }

  // Brand alignment with event
  const brands = [...new Set(wardrobeItems.map(i => i.brand).filter(Boolean))];
  if (event.host_brand && brands.includes(event.host_brand)) {
    secondaryDelta += 16;
    signals.push({ type: 'brand_match', text: `Wearing ${event.host_brand} to their own event — smart`, narrative: 'strategic' });
  }

  // All owned vs borrowed/rented
  const _allOwned = wardrobeItems.every(i => i.is_owned || i.acquisition_type === 'purchased');
  const hasBorrowed = wardrobeItems.some(i => i.acquisition_type === 'borrowed' || i.acquisition_type === 'rented');
  if (hasBorrowed) {
    secondaryDelta -= 1;
    signals.push({ type: 'borrowed', text: 'Some pieces are borrowed — she\'s faking it', narrative: 'vulnerability' });
  }

  // ── Secondary evaluation signals ─────────────────────────────────
  // Layer color/occasion/season/era checks on top of the tier-gap score.
  // Each helper returns either null or { type, text, narrative, delta }; we
  // push the signal onto the stack and apply its delta to matchScore.
  // Compute provisional narrative_mood from tier gap so the mood-fit
  // helper can compare against character headspace. Mood is finalized
  // below after all secondary signals are in.
  const provisionalMood = tierGap < -1 ? 'anxiety' : tierGap > 1 ? 'overcompensation' : Math.abs(tierGap) <= 0.5 ? 'confidence' : 'tension';
  for (const sig of [
    evaluateColorHarmony(wardrobeItems),
    evaluateOccasionPrecision(wardrobeItems, event),
    evaluateSeasonMatch(wardrobeItems, event),
    evaluateEraConsistency(wardrobeItems),
    evaluateCharacterMoodFit(tierGap, provisionalMood, characterState),
    evaluateAuthenticityFit(avgTier, arcStage),
    evaluateRarityBonus(wardrobeItems),
    evaluateColorPsychology(wardrobeItems, event),
  ]) {
    if (sig) {
      secondaryDelta += sig.delta || 0;
      signals.push({ type: sig.type, text: sig.text, narrative: sig.narrative, delta: sig.delta });
    }
  }

  // ── Per-slot breakdown ─────────────────────────────────────────────
  // Bucket the items into our 5 UI slots and score each one against the
  // event independently. The aggregate `match_score` above stays the source
  // of truth for narrative mood / signals; the `slots` array is purely a
  // "where's the weak link?" readout that the outfit-picker modal renders
  // as a row per slot.
  const bySlot = groupItemsBySlot(wardrobeItems);
  const slots = SLOT_KEYS.map(key => scoreSingleSlot(key, bySlot[key] || [], event, expectedTier));
  const scoredSlots = slots.filter(s => s.required || (s.items && s.items.length > 0));
  const slotComponent = scoredSlots.length
    ? scoredSlots.reduce((sum, s) => sum + (s.match || 0), 0) / scoredSlots.length
    : tierComponent;

  const secondaryComponent = Math.max(0, Math.min(100, 50 + secondaryDelta));
  const matchScore = Math.round((tierComponent * 0.50) + (slotComponent * 0.25) + (secondaryComponent * 0.25));

  const unassigned = bySlot.__unassigned && bySlot.__unassigned.length
    ? bySlot.__unassigned.map(i => ({ id: i.id, name: i.name, clothing_category: i.clothing_category }))
    : [];

  return {
    match_score: Math.max(0, Math.min(100, matchScore)),
    outfit_tier: avgTier,
    expected_tier: expectedTier,
    tier_gap: tierGap,
    outfit_cost: outfitCost,
    signals,
    brands,
    piece_count: wardrobeItems.length,
    narrative_mood: tierGap < -1 ? 'anxiety' : tierGap > 1 ? 'overcompensation' : Math.abs(tierGap) <= 0.5 ? 'confidence' : 'tension',
    // New in the 5-slot redesign. Clients can render the breakdown without
    // duplicating the tier-gap logic; legacy clients that only read
    // match_score keep working.
    slots,
    unassigned,
  };
}

// ── 2. REPEAT OUTFIT DETECTION ──────────────────────────────────────────────

async function detectRepeats(wardrobeItems, showId, models, context = {}) {
  const { sequelize } = models;
  const repeats = [];
  const currentEventId = context?.currentEventId || null;

  for (const item of wardrobeItems) {
    try {
      const [rows] = await sequelize.query(
        `SELECT ew.episode_id, e.title, e.episode_number, e.air_date,
                we.id as world_event_id,
                we.name as event_name, we.prestige as event_prestige
         FROM episode_wardrobe ew
         JOIN episodes e ON e.id = ew.episode_id AND e.deleted_at IS NULL
         LEFT JOIN world_events we ON we.used_in_episode_id = e.id
         WHERE ew.wardrobe_id = :wardrobeId AND e.show_id = :showId
           AND (:currentEventId IS NULL OR we.id IS DISTINCT FROM :currentEventId)
         ORDER BY e.episode_number DESC`,
        { replacements: { wardrobeId: item.id, showId, currentEventId } }
      );

      if (rows.length > 0) {
        repeats.push({
          wardrobe_id: item.id,
          name: item.name,
          times_worn: rows.length,
          last_worn: rows[0],
          history: rows,
          narrative: rows.length >= 3
            ? { type: 'signature_piece', text: `This is becoming her signature — ${item.name} worn ${rows.length} times`, mood: 'power' }
            : rows.length === 1
            ? { type: 'repeat', text: `She wore ${item.name} before — ${rows[0].event_name || `Episode ${rows[0].episode_number}`}`, mood: 'risk' }
            : { type: 'frequent', text: `${item.name} is a frequent pick — ${rows.length} appearances`, mood: 'familiar' },
        });
      }
    } catch { /* non-blocking per item */ }
  }

  return repeats;
}

// ── 3. BRAND RELATIONSHIP TRACKING ──────────────────────────────────────────

async function getBrandRelationships(showId, models) {
  const { sequelize } = models;

  try {
    const [rows] = await sequelize.query(
      `SELECT w.brand, COUNT(*) as wear_count,
              SUM(CASE WHEN w.tier = 'luxury' THEN 1 WHEN w.tier = 'elite' THEN 2 ELSE 0 END) as prestige_points,
              MAX(e.episode_number) as last_episode,
              ARRAY_AGG(DISTINCT w.clothing_category) as categories
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.brand IS NOT NULL AND w.brand != ''
       JOIN episodes e ON e.id = ew.episode_id AND e.show_id = :showId AND e.deleted_at IS NULL
       GROUP BY w.brand
       ORDER BY wear_count DESC`,
      { replacements: { showId } }
    );

    return rows.map(r => ({
      brand: r.brand,
      wear_count: parseInt(r.wear_count),
      prestige_points: parseInt(r.prestige_points) || 0,
      last_episode: r.last_episode,
      categories: r.categories,
      loyalty_level: r.wear_count >= 5 ? 'ambassador' : r.wear_count >= 3 ? 'loyal' : r.wear_count >= 2 ? 'repeat' : 'trial',
      opportunity_ready: r.wear_count >= 3, // 3+ wears = brand should notice
    }));
  } catch {
    return [];
  }
}

// ── 4. WARDROBE GROWTH ARC ──────────────────────────────────────────────────

async function getWardrobeGrowthArc(showId, models) {
  const { sequelize } = models;

  try {
    const [rows] = await sequelize.query(
      `SELECT
         e.episode_number,
         COUNT(ew.id) as pieces_used,
         COALESCE(AVG(CASE w.tier WHEN 'basic' THEN 1 WHEN 'mid' THEN 2 WHEN 'luxury' THEN 3 WHEN 'elite' THEN 4 ELSE 2 END), 2) as avg_tier,
         COALESCE(SUM(w.price), 0) as outfit_value,
         COUNT(DISTINCT w.brand) as unique_brands
       FROM episodes e
       LEFT JOIN episode_wardrobe ew ON ew.episode_id = e.id
       LEFT JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE e.show_id = :showId AND e.deleted_at IS NULL
       GROUP BY e.episode_number
       ORDER BY e.episode_number ASC`,
      { replacements: { showId } }
    );

    // Closet inventory stats
    const [inventory] = await sequelize.query(
      `SELECT
         COUNT(*) as total_pieces,
         COALESCE(SUM(price), 0) as total_value,
         COUNT(CASE WHEN tier = 'luxury' THEN 1 END) as luxury_count,
         COUNT(CASE WHEN tier = 'elite' THEN 1 END) as elite_count,
         COUNT(DISTINCT brand) as unique_brands,
         COUNT(DISTINCT clothing_category) as categories_covered
       FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
      { replacements: { showId } }
    );

    const inv = inventory[0] || {};

    return {
      episodes: rows,
      inventory: {
        total_pieces: parseInt(inv.total_pieces) || 0,
        total_value: parseFloat(inv.total_value) || 0,
        luxury_count: parseInt(inv.luxury_count) || 0,
        elite_count: parseInt(inv.elite_count) || 0,
        unique_brands: parseInt(inv.unique_brands) || 0,
        categories_covered: parseInt(inv.categories_covered) || 0,
      },
      arc_stage: (parseInt(inv.elite_count) || 0) > 0 ? 'prime'
        : (parseInt(inv.luxury_count) || 0) > 0 ? 'glow_up'
        : (parseInt(inv.total_pieces) || 0) > 10 ? 'building'
        : 'foundation',
    };
  } catch {
    return { episodes: [], inventory: {}, arc_stage: 'foundation' };
  }
}

// ── 5. FEED REACTION TRIGGERS ───────────────────────────────────────────────

function generateOutfitReactionTriggers(outfitScore, repeats, brandRelationships) {
  const triggers = [];

  // Based on match score
  if (outfitScore?.narrative_mood === 'anxiety') {
    triggers.push({ type: 'shade', trigger: 'underdressed', text: 'Someone will post about her outfit not matching the vibe' });
    triggers.push({ type: 'support', trigger: 'bestie_defense', text: 'A friend defends her look in comments' });
  }
  if (outfitScore?.narrative_mood === 'confidence') {
    triggers.push({ type: 'flex', trigger: 'outfit_praise', text: 'Multiple profiles repost her look' });
    triggers.push({ type: 'comparison', trigger: 'who_wore_it_better', text: 'Another creator wore something similar — comparison post' });
  }
  if (outfitScore?.narrative_mood === 'overcompensation') {
    triggers.push({ type: 'gossip', trigger: 'trying_too_hard', text: 'Whispers that she\'s overdoing it — who is she trying to impress?' });
  }

  // Based on repeats
  const signaturePiece = repeats?.find(r => r.narrative?.type === 'signature_piece');
  if (signaturePiece) {
    triggers.push({ type: 'brand_content', trigger: 'signature_recognition', text: `${signaturePiece.name} is becoming her signature — brand takes notice` });
  }
  const repeatedPiece = repeats?.find(r => r.narrative?.type === 'repeat');
  if (repeatedPiece) {
    triggers.push({ type: 'shade', trigger: 'outfit_repeat', text: `"Didn't she wear that ${repeatedPiece.name} to ${repeatedPiece.last_worn?.event_name || 'the last event'}?"` });
  }

  // Based on brand loyalty
  const loyalBrands = brandRelationships?.filter(b => b.opportunity_ready) || [];
  if (loyalBrands.length > 0) {
    triggers.push({ type: 'brand_content', trigger: 'brand_loyalty_noticed', text: `${loyalBrands[0].brand} notices Lala's loyalty — DM incoming` });
  }

  return triggers;
}

// ── 6. FULL WARDROBE INTELLIGENCE FOR SCRIPT WRITER ─────────────────────────

async function getWardrobeIntelligence(wardrobeItems, event, showId, models) {
  const outfitScore = scoreOutfitForEvent(wardrobeItems, event);
  const repeats = await detectRepeats(wardrobeItems, showId, models, { currentEventId: event?.id || null });
  const brandRelationships = await getBrandRelationships(showId, models);
  const growthArc = await getWardrobeGrowthArc(showId, models);
  const feedTriggers = generateOutfitReactionTriggers(outfitScore, repeats, brandRelationships);

  // Financial pressure from outfit
  let financialPressure = null;
  if (outfitScore) {
    const outfitCost = outfitScore.outfit_cost;
    try {
      const [states] = await models.sequelize.query(
        `SELECT coins FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
        { replacements: { showId } }
      );
      const balance = parseFloat(states?.[0]?.coins) || 0;
      financialPressure = {
        outfit_cost: outfitCost,
        balance,
        can_afford: balance >= outfitCost,
        remaining_after: balance - outfitCost,
        pressure: balance < outfitCost ? 'cant_afford'
          : balance - outfitCost < 100 ? 'tight'
          : 'comfortable',
      };
    } catch { /* no character state */ }
  }

  return {
    outfit_score: outfitScore,
    repeats,
    brand_relationships: brandRelationships,
    growth_arc: growthArc,
    feed_triggers: feedTriggers,
    financial_pressure: financialPressure,

    // Summary for script writer prompt injection
    script_context: buildScriptContext(outfitScore, repeats, brandRelationships, growthArc, feedTriggers, financialPressure),
  };
}

function buildScriptContext(outfitScore, repeats, brandRelationships, growthArc, feedTriggers, financialPressure) {
  const lines = [];

  if (outfitScore) {
    lines.push(`OUTFIT MATCH: ${outfitScore.match_score}/100 — ${outfitScore.narrative_mood}`);
    for (const sig of outfitScore.signals) {
      lines.push(`  ${sig.text}`);
    }
    lines.push(`  Pieces: ${outfitScore.piece_count}, Total cost: $${outfitScore.outfit_cost}, Brands: ${outfitScore.brands.join(', ') || 'unbranded'}`);
  }

  if (repeats?.length > 0) {
    lines.push(`REPEAT DETECTION:`);
    for (const r of repeats) {
      lines.push(`  ${r.narrative.text}`);
    }
  }

  if (brandRelationships?.length > 0) {
    const loyal = brandRelationships.filter(b => b.loyalty_level !== 'trial');
    if (loyal.length > 0) {
      lines.push(`BRAND LOYALTY: ${loyal.map(b => `${b.brand} (${b.wear_count}x, ${b.loyalty_level})`).join(', ')}`);
    }
  }

  if (growthArc) {
    lines.push(`WARDROBE ARC: ${growthArc.arc_stage} — ${growthArc.inventory.total_pieces} pieces, $${growthArc.inventory.total_value} total value`);
  }

  if (financialPressure) {
    lines.push(`OUTFIT FINANCIALS: $${financialPressure.outfit_cost} outfit, $${financialPressure.balance} balance → ${financialPressure.pressure}`);
    if (financialPressure.pressure === 'cant_afford') {
      lines.push(`  SCRIPT DIRECTIVE: She cannot afford this outfit. Show the internal stress — checking the price tag, calculating in her head, wondering if she can return it.`);
    }
  }

  if (feedTriggers?.length > 0) {
    lines.push(`FEED TRIGGERS FROM OUTFIT:`);
    for (const t of feedTriggers) {
      lines.push(`  [${t.type}] ${t.text}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  scorePieceForEvent,
  scoreOutfitForEvent,
  detectRepeats,
  getBrandRelationships,
  getWardrobeGrowthArc,
  generateOutfitReactionTriggers,
  getWardrobeIntelligence,
  buildScriptContext,
};
