'use strict';
/**
 * hairLibraryRoutes.js
 * Mount at: app.use('/api/v1/hair-library', hairLibraryRoutes)
 *
 * GET    /api/v1/hair-library?show_id=&event_type=&vibe=
 * GET    /api/v1/hair-library/:id
 * POST   /api/v1/hair-library
 * PUT    /api/v1/hair-library/:id
 * DELETE /api/v1/hair-library/:id
 * POST   /api/v1/hair-library/generate    ← Claude-powered bulk generation
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

// ── GET /api/v1/hair-library ──────────────────────────────────────────────
// List all hair styles for a show, with optional filters
router.get('/', requireAuth, async (req, res) => {
  const db = require('../models');
  const { show_id, event_type, vibe, is_active } = req.query;
  if (!show_id) return res.status(400).json({ error: 'show_id required' });
  try {
    const where = { show_id };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    let items = await db.HairLibrary.findAll({
      where,
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
    // Filter by event_type (JSONB array contains)
    if (event_type) {
      items = items.filter(i =>
        Array.isArray(i.event_types) && i.event_types.includes(event_type)
      );
    }
    // Filter by vibe tag
    if (vibe) {
      items = items.filter(i =>
        Array.isArray(i.vibe_tags) && i.vibe_tags.includes(vibe)
      );
    }
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('hair-library GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v1/hair-library/:id ─────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.HairLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/hair-library ─────────────────────────────────────────────
// Create a single hair style
router.post('/', requireAuth, async (req, res) => {
  const db = require('../models');
  const {
    show_id, name, description,
    vibe_tags, occasion_tags, event_types,
    reference_photo_url, color_state, length, texture,
    career_echo_potential, is_justAWoman_style,
    is_active, sort_order,
  } = req.body;
  if (!show_id || !name) {
    return res.status(400).json({ error: 'show_id and name required' });
  }
  try {
    const item = await db.HairLibrary.create({
      show_id, name, description,
      vibe_tags: vibe_tags || [],
      occasion_tags: occasion_tags || [],
      event_types: event_types || [],
      reference_photo_url,
      color_state, length, texture,
      career_echo_potential,
      is_justAWoman_style: is_justAWoman_style || false,
      is_active: is_active !== undefined ? is_active : true,
      sort_order: sort_order || 0,
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('hair-library POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/v1/hair-library/:id ─────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.HairLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const allowed = [
      'name', 'description', 'vibe_tags', 'occasion_tags', 'event_types',
      'reference_photo_url', 'color_state', 'length', 'texture',
      'career_echo_potential', 'is_justAWoman_style', 'is_active', 'sort_order',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await item.update(updates);
    res.json(item);
  } catch (err) {
    console.error('hair-library PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/v1/hair-library/:id ──────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.HairLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.destroy();
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/hair-library/generate ───────────────────────────────────
// Claude-powered generation of Lala's full hair library for a show
// Body: { show_id, count?: 8, replace_existing?: false }
router.post('/generate', requireAuth, aiRateLimiter, async (req, res) => {
  const db = require('../models');
  const { show_id, count = 8, replace_existing = false } = req.body;
  if (!show_id) return res.status(400).json({ error: 'show_id required' });
  try {
    if (!replace_existing) {
      const existing = await db.HairLibrary.count({ where: { show_id } });
      if (existing >= 4) {
        return res.status(409).json({
          error: 'Hair library already has items. Pass replace_existing: true to regenerate.',
          existing_count: existing,
        });
      }
    }
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You design the hair library for Lala — a confident AI fashion creator living in LalaVerse.
Lala's hair reflects JustAWoman's real styles. Each look has a name, a mood, and a moment it belongs to.
Respond ONLY with a valid JSON array. No preamble, no markdown.`,
      messages: [{
        role: 'user',
        content: `Generate exactly ${count} hair styles for Lala's library.

These should represent JustAWoman's actual hair aesthetics — not generic stock looks.
Include a range: sleek/pressed styles, natural styles, protective styles,
editorial styles for high-prestige events, and casual/everyday styles.

Each should feel like it belongs to one specific woman's actual rotation,
not a generic beauty catalog.

Return a JSON array where each object has:
{
  "name": "evocative style name",
  "description": "1-2 sentences — what this look is and when Lala wears it",
  "vibe_tags": ["sleek", "natural", "editorial", etc.],
  "occasion_tags": ["gala", "press_day", "date", "casual", "content_day", etc.],
  "event_types": ["industry", "dating", "family", "social_drama"] — which categories this works for,
  "color_state": "natural black | honey highlights | auburn | etc.",
  "length": "pixie | bob | shoulder | mid-back | waist-length",
  "texture": "silk press | natural coils | waves | straight | braided | twisted",
  "career_echo_potential": "1 sentence connecting this look to JustAWoman's journey, or null",
  "is_justAWoman_style": true or false,
  "sort_order": 0-${count - 1}
}

Return exactly ${count} objects. No other text.`,
      }],
    });
    const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    let styles;
    try {
      styles = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Claude returned invalid JSON', raw });
    }
    if (replace_existing) {
      await db.HairLibrary.destroy({ where: { show_id } });
    }
    const created = await Promise.all(
      styles.map(s =>
        db.HairLibrary.create({
          show_id,
          name: s.name,
          description: s.description,
          vibe_tags: s.vibe_tags || [],
          occasion_tags: s.occasion_tags || [],
          event_types: s.event_types || [],
          color_state: s.color_state,
          length: s.length,
          texture: s.texture,
          career_echo_potential: s.career_echo_potential || null,
          is_justAWoman_style: s.is_justAWoman_style || false,
          is_active: true,
          sort_order: s.sort_order || 0,
        })
      )
    );
    res.status(201).json({ generated: created.length, items: created });
  } catch (err) {
    console.error('hair-library generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
