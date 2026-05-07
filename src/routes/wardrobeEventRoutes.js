'use strict';

/**
 * Wardrobe Event Integration Routes
 * Mount at: /api/v1/wardrobe-events
 *
 * Filters wardrobe by event dress code + affordability.
 * Recommends outfits based on prestige, financial pressure, and aesthetic match.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ── DRESS CODE → AESTHETIC TAG MAPPING ───────────────────────────────────────
const DRESS_CODE_TAGS = {
  'black tie':       ['elegant', 'formal', 'luxury', 'gala'],
  'cocktail':        ['cocktail', 'chic', 'dressy', 'night_out'],
  'semi-formal':     ['dressy', 'polished', 'sophisticated'],
  'business casual': ['polished', 'professional', 'minimal'],
  'casual':          ['casual', 'effortless', 'street'],
  'brunch':          ['casual', 'brunch', 'fresh', 'day_wear'],
  'beach':           ['resort', 'summer', 'beach', 'effortless'],
  'streetwear':      ['street', 'urban', 'bold', 'edgy'],
  'editorial':       ['editorial', 'avant_garde', 'bold', 'fashion_forward'],
  'red carpet':      ['red_carpet', 'luxury', 'designer', 'show_stopping'],
  'athleisure':      ['sporty', 'athleisure', 'casual'],
  'resort':          ['resort', 'vacation', 'luxury_casual'],
};

// ── TIER AFFORDABILITY BY FINANCIAL PRESSURE ─────────────────────────────────
const TIER_BUDGET = {
  desperate: ['basic'],
  tight:     ['basic', 'mid'],
  comfortable: ['basic', 'mid', 'luxury'],
  flush:     ['basic', 'mid', 'luxury', 'elite'],
};

// ── FILTER WARDROBE FOR EVENT ────────────────────────────────────────────────
// GET /api/v1/wardrobe-events/:showId/filter
// Query: event_id, dress_code, budget, prestige, character
router.get('/:showId/filter', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { event_id, dress_code, budget, prestige, character } = req.query;
    const { Wardrobe, WorldEvent, Episode } = require('../models');

    // Load event if provided
    let event = null;
    if (event_id) {
      event = await WorldEvent.findByPk(event_id);
    }

    const effectiveDressCode = dress_code || event?.dress_code || 'casual';
    const effectivePrestige = parseInt(prestige) || event?.prestige || 5;

    // Determine financial pressure
    let pressureLevel = budget || 'comfortable';
    if (!budget && event?.used_in_episode_id) {
      try {
        const episode = await Episode.findByPk(event.used_in_episode_id);
        if (episode) {
          const balance = parseFloat(episode.total_income || 0) - parseFloat(episode.total_expenses || 0);
          pressureLevel = balance < 0 ? 'desperate'
            : balance < 500 ? 'tight'
            : balance < 2000 ? 'comfortable'
            : 'flush';
        }
      } catch { /* use default */ }
    }

    // Get matching aesthetic tags
    const matchTags = DRESS_CODE_TAGS[effectiveDressCode.toLowerCase()] || DRESS_CODE_TAGS.casual;
    const allowedTiers = TIER_BUDGET[pressureLevel] || TIER_BUDGET.comfortable;

    // Build query
    const where = { deleted_at: null, is_visible: true };
    if (showId !== 'all') where.show_id = showId;
    if (character) where.character = character;

    const allItems = await Wardrobe.findAll({
      where,
      order: [['outfit_match_weight', 'DESC'], ['tier', 'DESC']],
    });

    // Score each item
    const scored = allItems.map(item => {
      const d = item.toJSON();
      let score = 0;
      const reasons = [];

      // Aesthetic tag match
      const itemTags = [...(d.aesthetic_tags || []), ...(d.event_types || [])];
      const tagOverlap = itemTags.filter(t => matchTags.includes(t.toLowerCase()));
      score += tagOverlap.length * 20;
      if (tagOverlap.length > 0) reasons.push(`matches: ${tagOverlap.join(', ')}`);

      // Occasion match
      if (d.occasion && effectiveDressCode.toLowerCase().includes(d.occasion.toLowerCase())) {
        score += 15;
        reasons.push('occasion match');
      }

      // Tier affordability
      if (allowedTiers.includes(d.tier)) {
        score += 10;
      } else {
        score -= 30;
        reasons.push(`${d.tier} may be out of budget`);
      }

      // Prestige alignment
      const tierPrestige = { basic: 2, mid: 5, luxury: 7, elite: 9 };
      const tierScore = tierPrestige[d.tier] || 3;
      if (Math.abs(tierScore - effectivePrestige) <= 2) {
        score += 10;
        reasons.push('prestige aligned');
      }

      // Is owned bonus
      if (d.is_owned) {
        score += 15;
        reasons.push('owned');
      }

      // Weight
      score += (d.outfit_match_weight || 5);

      // Price penalty if tight
      if (pressureLevel === 'desperate' && d.price > 100) {
        score -= 20;
        reasons.push('too expensive');
      } else if (pressureLevel === 'tight' && d.price > 500) {
        score -= 10;
        reasons.push('pricey');
      }

      return {
        ...d,
        match_score: score,
        match_reasons: reasons,
        affordable: allowedTiers.includes(d.tier),
        dress_code_match: tagOverlap.length > 0,
      };
    });

    // Sort by score, filter out very low scores
    const results = scored
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 40);

    // Group by category
    const byCategory = {};
    for (const item of results) {
      const cat = item.clothing_category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }

    return res.json({
      data: results,
      grouped: byCategory,
      count: results.length,
      filters: {
        dress_code: effectiveDressCode,
        prestige: effectivePrestige,
        pressure_level: pressureLevel,
        allowed_tiers: allowedTiers,
        match_tags: matchTags,
      },
      event: event ? { id: event.id, name: event.name, dress_code: event.dress_code } : null,
    });
  } catch (err) {
    console.error('[WardrobeEvent] Filter error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── SUGGEST OUTFIT FOR EVENT ─────────────────────────────────────────────────
// POST /api/v1/wardrobe-events/:showId/suggest
// Body: { event_id, episodeId }
router.post('/:showId/suggest', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { event_id, episodeId } = req.body;

    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const models = require('../models');
    const event = await models.WorldEvent.findByPk(event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Get candidate items
    const { Wardrobe, Episode } = models;
    const items = await Wardrobe.findAll({
      where: { show_id: showId, deleted_at: null, is_visible: true },
      order: [['outfit_match_weight', 'DESC']],
      limit: 50,
    });

    // Get financial context
    let financialNote = '';
    if (episodeId) {
      try {
        const ep = await Episode.findByPk(episodeId);
        if (ep) {
          const balance = parseFloat(ep.total_income || 0) - parseFloat(ep.total_expenses || 0);
          financialNote = `Lala's budget: $${balance}. ${balance < 0 ? 'She is in debt — choose items she already owns.' : balance < 500 ? 'Money is tight — keep it affordable.' : 'She can splurge a little.'}`;
        }
      } catch { /* skip */ }
    }

    const itemList = items.map(i => {
      const d = i.toJSON();
      return `- ${d.name} (${d.clothing_category}, ${d.tier}, $${d.price || '?'}, ${d.is_owned ? 'OWNED' : 'NOT OWNED'}) tags: ${(d.aesthetic_tags || []).join(', ')}`;
    }).join('\n');

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are Lala's personal stylist for "Styling Adventures with Lala."

EVENT: ${event.name}
Dress code: ${event.dress_code || 'Not specified'}
Prestige: ${event.prestige}/10
Host: ${event.host || 'Unknown'}
${financialNote}

AVAILABLE WARDROBE:
${itemList}

Pick 3-5 items that make a complete outfit for this event. Consider:
1. Dress code match
2. Affordability (prefer owned items if budget is tight)
3. Style cohesion
4. Event prestige level

Return JSON: { "outfit_name": "...", "vibe": "...", "items": [{ "name": "exact item name", "role": "what it does for the look" }], "lala_reaction": "what Lala says when she sees the outfit", "confidence_boost": 1-10 }

Return ONLY the JSON.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    let suggestion = null;
    try {
      const text = response.content[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) suggestion = JSON.parse(match[0]);
    } catch { /* return raw */ }

    return res.json({
      success: true,
      data: suggestion,
      event: { id: event.id, name: event.name, dress_code: event.dress_code },
    });
  } catch (err) {
    console.error('[WardrobeEvent] Suggest error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK OUTFIT FOR EPISODE ──────────────────────────────────────────────────
// POST /api/v1/wardrobe-events/:episodeId/lock-outfit
// Body: { wardrobe_ids: [...] }
router.post('/:episodeId/lock-outfit', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { wardrobe_ids } = req.body;

    if (!wardrobe_ids || !Array.isArray(wardrobe_ids)) {
      return res.status(400).json({ error: 'wardrobe_ids array is required' });
    }

    const { EpisodeWardrobe, Wardrobe } = require('../models');

    // Remove existing outfit links for this episode
    await EpisodeWardrobe.destroy({ where: { episode_id: episodeId } });

    // Create new links
    const links = [];
    for (const wardrobeId of wardrobe_ids) {
      const item = await Wardrobe.findByPk(wardrobeId);
      if (item) {
        const link = await EpisodeWardrobe.create({
          episode_id: episodeId,
          wardrobe_id: wardrobeId,
          approval_status: 'approved',
          worn_at: new Date(),
        });
        links.push({ link, item: item.toJSON() });
      }
    }

    return res.json({
      success: true,
      message: `${links.length} items locked for episode.`,
      data: links,
    });
  } catch (err) {
    console.error('[WardrobeEvent] Lock outfit error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
