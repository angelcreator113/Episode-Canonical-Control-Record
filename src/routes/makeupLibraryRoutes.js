'use strict';
/**
 * makeupLibraryRoutes.js
 * Mount at: app.use('/api/v1/makeup-library', makeupLibraryRoutes)
 *
 * GET    /api/v1/makeup-library?show_id=&event_type=&mood=
 * GET    /api/v1/makeup-library/:id
 * POST   /api/v1/makeup-library
 * PUT    /api/v1/makeup-library/:id
 * DELETE /api/v1/makeup-library/:id
 * POST   /api/v1/makeup-library/generate    ← Claude-powered bulk generation
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

// ── GET /api/v1/makeup-library ────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const db = require('../models');
  const { show_id, event_type, mood, is_active } = req.query;
  if (!show_id) return res.status(400).json({ error: 'show_id required' });
  try {
    const where = { show_id };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (mood) where.mood_tag = mood;
    let items = await db.MakeupLibrary.findAll({
      where,
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
    // Filter by event_type (JSONB array)
    if (event_type) {
      items = items.filter(i =>
        Array.isArray(i.event_types) && i.event_types.includes(event_type)
      );
    }
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('makeup-library GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v1/makeup-library/:id ───────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.MakeupLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/makeup-library ───────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const db = require('../models');
  const {
    show_id, name, description,
    mood_tag, occasion_tags, event_types, aesthetic_tags,
    skin_finish, eye_look, lip_look,
    reference_photo_url,
    career_echo_potential, is_justAWoman_style,
    featured_brand,
    is_active, sort_order,
  } = req.body;
  if (!show_id || !name) {
    return res.status(400).json({ error: 'show_id and name required' });
  }
  try {
    const item = await db.MakeupLibrary.create({
      show_id, name, description,
      mood_tag,
      occasion_tags: occasion_tags || [],
      event_types: event_types || [],
      aesthetic_tags: aesthetic_tags || [],
      skin_finish, eye_look, lip_look,
      reference_photo_url,
      career_echo_potential,
      is_justAWoman_style: is_justAWoman_style || false,
      featured_brand,
      is_active: is_active !== undefined ? is_active : true,
      sort_order: sort_order || 0,
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('makeup-library POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/v1/makeup-library/:id ────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.MakeupLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const allowed = [
      'name', 'description', 'mood_tag', 'occasion_tags', 'event_types', 'aesthetic_tags',
      'skin_finish', 'eye_look', 'lip_look', 'reference_photo_url',
      'career_echo_potential', 'is_justAWoman_style', 'featured_brand',
      'is_active', 'sort_order',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await item.update(updates);
    res.json(item);
  } catch (err) {
    console.error('makeup-library PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/v1/makeup-library/:id ────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const db = require('../models');
  try {
    const item = await db.MakeupLibrary.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.destroy();
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/makeup-library/generate ─────────────────────────────────
// Claude-powered generation of Lala's full makeup library
// Body: { show_id, count?: 7, replace_existing?: false }
router.post('/generate', requireAuth, aiRateLimiter, async (req, res) => {
  const db = require('../models');
  const { show_id, count = 7, replace_existing = false } = req.body;
  if (!show_id) return res.status(400).json({ error: 'show_id required' });
  try {
    if (!replace_existing) {
      const existing = await db.MakeupLibrary.count({ where: { show_id } });
      if (existing >= 4) {
        return res.status(409).json({
          error: 'Makeup library already has items. Pass replace_existing: true to regenerate.',
          existing_count: existing,
        });
      }
    }
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You design the makeup library for Lala — a confident AI fashion creator living in LalaVerse.
Lala's makeup reflects JustAWoman's real looks. Each look has a name, a mood, and a specific moment it belongs to.
Respond ONLY with a valid JSON array. No preamble, no markdown.`,
      messages: [{
        role: 'user',
        content: `Generate exactly ${count} makeup looks for Lala's library.

These should represent JustAWoman's actual makeup aesthetic — not generic beauty looks.
Include a full range for Lala's life: a signature everyday look, high-glam for galas,
soft and natural for family events, editorial for press days, date-night looks,
and at least one look that is her statement — the one she's known for.

Return a JSON array where each object has:
{
  "name": "evocative look name",
  "description": "1-2 sentences — what this look communicates and when Lala wears it",
  "mood_tag": "single dominant mood — confident | soft | editorial | sultry | fresh | natural | bold",
  "occasion_tags": ["gala", "press_day", "date", "daytime", "content_day", "casual", "family", etc.],
  "event_types": ["industry", "dating", "family", "social_drama"] — which categories this works for,
  "aesthetic_tags": ["clean", "glam", "minimal", "editorial", etc.] — matches wardrobe aesthetic_tags,
  "skin_finish": "dewy | matte | satin | glazed | luminous",
  "eye_look": "cut crease | soft smoky | clean liner | bare | graphic | natural",
  "lip_look": "nude gloss | deep berry | red | coral | bare | bold matte",
  "career_echo_potential": "1 sentence connecting this look to JustAWoman's real journey, or null",
  "is_justAWoman_style": true or false,
  "featured_brand": "Ori Beauty | null — in-world brand if this is a brand look",
  "sort_order": 0-${count - 1}
}

Return exactly ${count} objects. No other text.`,
      }],
    });
    const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    let looks;
    try {
      looks = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Claude returned invalid JSON', raw });
    }
    if (replace_existing) {
      await db.MakeupLibrary.destroy({ where: { show_id } });
    }
    const created = await Promise.all(
      looks.map(l =>
        db.MakeupLibrary.create({
          show_id,
          name: l.name,
          description: l.description,
          mood_tag: l.mood_tag,
          occasion_tags: l.occasion_tags || [],
          event_types: l.event_types || [],
          aesthetic_tags: l.aesthetic_tags || [],
          skin_finish: l.skin_finish,
          eye_look: l.eye_look,
          lip_look: l.lip_look,
          career_echo_potential: l.career_echo_potential || null,
          is_justAWoman_style: l.is_justAWoman_style || false,
          featured_brand: l.featured_brand || null,
          is_active: true,
          sort_order: l.sort_order || 0,
        })
      )
    );
    res.status(201).json({ generated: created.length, items: created });
  } catch (err) {
    console.error('makeup-library generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
