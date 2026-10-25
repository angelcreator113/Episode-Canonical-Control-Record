/**
 * World Events routes — outfit, wardrobe options, feed activity
 *
 * GET    /api/v1/world/:showId/events/:eventId/outfit
 * PUT    /api/v1/world/:showId/events/:eventId/outfit
 * GET    /api/v1/world/:showId/events/:eventId/wardrobe-options
 * GET    /api/v1/world/:showId/events/:eventId/feed-activity
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════════════════════════════════
// OUTFIT PICKER — select wardrobe pieces for event + score the outfit
// ═══════════════════════════════════════════════════════════════════════

// GET /world/:showId/events/:eventId/outfit — get current outfit + score
router.get('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    // Scoped to this show and to live rows (audit Medium, 2026-10-23).
    const event = await loadScopedEvent(models.sequelize, {
      showId, eventId, columns: 'outfit_pieces, outfit_score, name, prestige, event_type, host_brand, dress_code',
    });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const pieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : (event.outfit_pieces || []);
    const score = typeof event.outfit_score === 'string' ? JSON.parse(event.outfit_score) : (event.outfit_score || null);

    return res.json({ success: true, pieces, score, event: { name: event.name, prestige: event.prestige, dress_code: event.dress_code } });
  } catch (err) {
    console.error('[Outfit] Load error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load the outfit' });
  }
});

// PUT /world/:showId/events/:eventId/outfit — save selected outfit pieces + auto-score
router.put('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { wardrobe_ids } = req.body;
    const models = await getModels();

    if (!wardrobe_ids || !Array.isArray(wardrobe_ids)) {
      return res.status(400).json({ success: false, error: 'wardrobe_ids array required' });
    }

    // Load event — scoped to this show and to live rows (audit High,
    // 2026-10-23).
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load wardrobe items — the pieces this show can wear: its own and the
    // shared ones (show_id NULL), the pool wardrobe-options offers below.
    const [items] = await models.sequelize.query(
      `SELECT id, name, clothing_category, brand, tier, price, coin_cost, color, is_owned,
              acquisition_type, aesthetic_tags, event_types, occasion, season, era_alignment,
              s3_url, s3_url_processed, times_worn, last_worn_date
       FROM wardrobe WHERE id IN (:ids) AND (show_id = :showId OR show_id IS NULL) AND deleted_at IS NULL`,
      { replacements: { ids: wardrobe_ids.length > 0 ? wardrobe_ids : ['00000000-0000-0000-0000-000000000000'], showId } }
    );

    // Build outfit pieces snapshot. coin_cost is the story price Finalize
    // charges, as select, purchase and lock do (Task #2346); price is the
    // real-world price, kept for display.
    const outfitPieces = items.map(i => ({
      id: i.id, name: i.name, category: i.clothing_category, brand: i.brand,
      tier: i.tier, price: parseFloat(i.price) || 0, coin_cost: Number(i.coin_cost) || 0, color: i.color,
      is_owned: i.is_owned, acquisition_type: i.acquisition_type,
      image_url: i.s3_url_processed || i.s3_url,
    }));

    // Score the outfit. Pull show-level `required_slots` off the Show's
    // metadata JSON so events on shows that demand a full 5-slot outfit
    // (fragrance + jewelry + accessories) light up the missing-required
    // treatment in the per-slot breakdown. Falls back to the scorer's
    // default (outfit + shoes required) when the show doesn't set it.
    const { scoreOutfitForEvent, detectRepeats, getBrandRelationships, generateOutfitReactionTriggers } = require('../../services/wardrobeIntelligenceService');
    let scoringEvent = event;
    try {
      if (models.Show) {
        const show = await models.Show.findByPk(showId, { attributes: ['metadata'] });
        const required = show?.metadata?.required_slots;
        if (Array.isArray(required) && required.length > 0) {
          scoringEvent = { ...event, required_slots: required };
        }
      }
    } catch (e) {
      console.warn('[Outfit] Could not read show required_slots:', e.message);
    }
    const outfitScore = scoreOutfitForEvent(items, scoringEvent);
    const repeats = await detectRepeats(items, showId, models, { currentEventId: eventId });
    const brandRels = await getBrandRelationships(showId, models);
    const feedTriggers = generateOutfitReactionTriggers(outfitScore, repeats, brandRels);

    const fullScore = {
      ...outfitScore,
      repeats: repeats.map(r => ({ name: r.name, times_worn: r.times_worn, narrative: r.narrative })),
      feed_triggers: feedTriggers,
      brand_loyalty: brandRels.filter(b => outfitPieces.some(p => p.brand === b.brand)),
    };

    // Save to event
    const [saved] = await models.sequelize.query(
      `UPDATE world_events SET outfit_pieces = :pieces, outfit_score = :score, updated_at = NOW()
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL RETURNING id`,
      { replacements: { pieces: JSON.stringify(outfitPieces), score: JSON.stringify(fullScore), eventId, showId } }
    );
    if (!Array.isArray(saved) || saved.length === 0) return res.status(404).json({ success: false, error: 'Event not found' });

    return res.json({ success: true, pieces: outfitPieces, score: fullScore });
  } catch (err) {
    console.error('[Outfit] Save error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save the outfit' });
  }
});

// GET /world/:showId/events/:eventId/wardrobe-options — all closet pieces with match info
router.get('/world/:showId/events/:eventId/wardrobe-options', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    // Load event — scoped to this show and to live rows (audit Medium,
    // 2026-10-23).
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load all wardrobe items for this show
    const [items] = await models.sequelize.query(
      `SELECT id, name, clothing_category, brand, tier, price, color, is_owned,
              acquisition_type, aesthetic_tags, event_types, occasion, season,
              s3_url, s3_url_processed, times_worn, last_worn_date, coin_cost
       FROM wardrobe WHERE (show_id = :showId OR show_id IS NULL) AND deleted_at IS NULL
       ORDER BY tier DESC, name ASC`,
      { replacements: { showId } }
    );

    // Keep recommendation scoring context aligned with outfit-save scoring.
    let scoringEvent = event;
    try {
      if (models.Show) {
        const show = await models.Show.findByPk(showId, { attributes: ['metadata'] });
        const required = show?.metadata?.required_slots;
        if (Array.isArray(required) && required.length > 0) {
          scoringEvent = { ...event, required_slots: required };
        }
      }
    } catch (e) {
      console.warn('[Outfit] Could not read show required_slots for options:', e.message);
    }

    // Score each item individually against the event
    const { scorePieceForEvent } = require('../../services/wardrobeIntelligenceService');
    const scored = items.map(item => {
      const singleScore = scorePieceForEvent(item, scoringEvent);
      return {
        ...item,
        image_url: item.s3_url_processed || item.s3_url,
        event_match: singleScore?.match_score || 50,
        event_signals: singleScore?.signals || [],
        narrative_mood: singleScore?.narrative_mood || 'neutral',
      };
    });

    // Sort by match score descending
    scored.sort((a, b) => b.event_match - a.event_match);

    return res.json({ success: true, items: scored, total: scored.length });
  } catch (err) {
    console.error('[Outfit] Wardrobe options error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load wardrobe options' });
  }
});

// GET /world/:showId/events/:eventId/feed-activity — get post-event feed posts
router.get('/world/:showId/events/:eventId/feed-activity', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();

    let event;
    if (models.WorldEvent) {
      event = await models.WorldEvent.findByPk(eventId, { attributes: ['id', 'name', 'canon_consequences'] });
    }
    if (!event) {
      const [rows] = await models.sequelize.query('SELECT id, name, canon_consequences FROM world_events WHERE id = :id', { replacements: { id: eventId } });
      event = rows?.[0];
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const cc = typeof event.canon_consequences === 'string' ? JSON.parse(event.canon_consequences) : (event.canon_consequences || {});
    const posts = cc.feed_activity || [];

    // If no posts yet, generate them
    if (posts.length === 0 && cc.automation) {
      try {
        const feedActivity = require('../../services/feedActivityService');
        const generated = await feedActivity.generatePostEventActivity(
          { ...event, canon_consequences: cc },
          models
        );
        return res.json({ success: true, posts: generated, generated: true });
      } catch { /* fall through */ }
    }

    return res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
