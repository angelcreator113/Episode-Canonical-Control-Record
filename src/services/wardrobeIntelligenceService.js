'use strict';

const { SLOT_KEYS, SLOT_DEFS, groupItemsBySlot } = require('../utils/wardrobeSlots');

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
  if (!items || items.length === 0) {
    return {
      slot: slotKey,
      label: def.label,
      icon: def.icon,
      required: def.required,
      items: [],
      match: 0,
      status: 'empty',
      reason: def.required ? `No ${def.label.toLowerCase()} selected — required for this event.` : null,
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
    required: def.required,
    items: items.map(i => ({ id: i.id, name: i.name, tier: i.tier, brand: i.brand })),
    match: Math.round(match),
    status,
    reason,
  };
}

function scoreOutfitForEvent(wardrobeItems, event) {
  if (!wardrobeItems?.length || !event) return null;

  const eventPrestige = event.prestige || 5;
  const _eventType = event.event_type || 'invite';

  // Calculate outfit tier (average of all pieces)
  const tierSum = wardrobeItems.reduce((s, i) => s + (TIER_VALUES[i.tier] || 2), 0);
  const avgTier = tierSum / wardrobeItems.length;

  // Calculate total outfit cost
  const outfitCost = wardrobeItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  // Prestige alignment: how well does outfit tier match event prestige?
  // Prestige 1-3 → basic/mid fine. Prestige 7-10 → need luxury/elite
  const expectedTier = eventPrestige <= 3 ? 1.5 : eventPrestige <= 5 ? 2 : eventPrestige <= 7 ? 3 : 3.5;
  const tierGap = avgTier - expectedTier;

  let matchScore = 50; // neutral baseline
  const signals = [];

  // Overdressed (+)
  if (tierGap > 1) {
    matchScore += 15;
    signals.push({ type: 'overdressed', text: 'She\'s overdressed — power move or trying too hard', narrative: 'confidence_or_overcompensation' });
  }
  // Perfect match
  else if (Math.abs(tierGap) <= 0.5) {
    matchScore += 30;
    signals.push({ type: 'perfect_match', text: 'Outfit matches the room perfectly', narrative: 'confidence_boost' });
  }
  // Slightly under
  else if (tierGap >= -1) {
    matchScore += 10;
    signals.push({ type: 'slight_under', text: 'Slightly underdressed — she knows it', narrative: 'mild_anxiety' });
  }
  // Very underdressed
  else {
    matchScore -= 15;
    signals.push({ type: 'underdressed', text: 'She\'s underdressed for this event — everyone will notice', narrative: 'anxiety' });
  }

  // Brand alignment with event
  const brands = [...new Set(wardrobeItems.map(i => i.brand).filter(Boolean))];
  if (event.host_brand && brands.includes(event.host_brand)) {
    matchScore += 20;
    signals.push({ type: 'brand_match', text: `Wearing ${event.host_brand} to their own event — smart`, narrative: 'strategic' });
  }

  // All owned vs borrowed/rented
  const _allOwned = wardrobeItems.every(i => i.is_owned || i.acquisition_type === 'purchased');
  const hasBorrowed = wardrobeItems.some(i => i.acquisition_type === 'borrowed' || i.acquisition_type === 'rented');
  if (hasBorrowed) {
    signals.push({ type: 'borrowed', text: 'Some pieces are borrowed — she\'s faking it', narrative: 'vulnerability' });
  }

  // ── Per-slot breakdown ─────────────────────────────────────────────
  // Bucket the items into our 5 UI slots and score each one against the
  // event independently. The aggregate `match_score` above stays the source
  // of truth for narrative mood / signals; the `slots` array is purely a
  // "where's the weak link?" readout that the outfit-picker modal renders
  // as a row per slot.
  const bySlot = groupItemsBySlot(wardrobeItems);
  const slots = SLOT_KEYS.map(key => scoreSingleSlot(key, bySlot[key] || [], event, expectedTier));
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

async function detectRepeats(wardrobeItems, showId, models) {
  const { sequelize } = models;
  const repeats = [];

  for (const item of wardrobeItems) {
    try {
      const [rows] = await sequelize.query(
        `SELECT ew.episode_id, e.title, e.episode_number, e.air_date,
                we.name as event_name, we.prestige as event_prestige
         FROM episode_wardrobe ew
         JOIN episodes e ON e.id = ew.episode_id AND e.deleted_at IS NULL
         LEFT JOIN world_events we ON we.used_in_episode_id = e.id
         WHERE ew.wardrobe_id = :wardrobeId AND e.show_id = :showId
         ORDER BY e.episode_number DESC`,
        { replacements: { wardrobeId: item.id, showId } }
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
  const repeats = await detectRepeats(wardrobeItems, showId, models);
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
  scoreOutfitForEvent,
  detectRepeats,
  getBrandRelationships,
  getWardrobeGrowthArc,
  generateOutfitReactionTriggers,
  getWardrobeIntelligence,
  buildScriptContext,
};
