'use strict';
/**
 * characterCrossingRoutes.js — Character Crossings
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/character-crossings', characterCrossingRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /                       — list crossings; query: character_id, gap_confirmed
 * POST   /                       — create crossing
 * PUT    /:id                    — update crossing
 * POST   /:id/propose-gap        — Amber generates gap score + reasoning
 * PUT    /:id/confirm-gap         — set gap_confirmed=true, update registry_characters
 * GET    /tracker                 — Dashboard data: crossings by gap score desc
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

router.use(requireAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// GET /
router.get('/', async (req, res) => {
  const { CharacterCrossing, RegistryCharacter, StoryClockMarker } = getModels(req);
  try {
    const where = {};
    if (req.query.character_id)  where.character_id = req.query.character_id;
    if (req.query.gap_confirmed) where.gap_confirmed = req.query.gap_confirmed === 'true';

    const crossings = await CharacterCrossing.findAll({
      where,
      include: [
        { model: RegistryCharacter, as: 'character', attributes: ['id', 'selected_name', 'display_name', 'role_type', 'performing_publicly', 'dimensions_performed', 'dimensions_hidden'] },
        { model: StoryClockMarker, as: 'marker', attributes: ['id', 'name', 'calendar_date'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ crossings });
  } catch (err) {
    console.error('[Crossings] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  const { CharacterCrossing } = getModels(req);
  try {
    const { character_id, crossing_date, calendar_event_id, trigger, initial_feed_state } = req.body;
    if (!character_id) return res.status(400).json({ error: 'character_id required' });

    const crossing = await CharacterCrossing.create({
      character_id, crossing_date, calendar_event_id,
      trigger, initial_feed_state,
    });
    res.status(201).json({ crossing });
  } catch (err) {
    console.error('[Crossings] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  const { CharacterCrossing } = getModels(req);
  try {
    const crossing = await CharacterCrossing.findByPk(req.params.id);
    if (!crossing) return res.status(404).json({ error: 'Crossing not found' });
    await crossing.update(req.body);
    res.json({ crossing });
  } catch (err) {
    console.error('[Crossings] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/propose-gap — Amber generates performance gap score
router.post('/:id/propose-gap', aiRateLimiter, async (req, res) => {
  const models = getModels(req);
  const { CharacterCrossing, RegistryCharacter } = models;
  try {
    const crossing = await CharacterCrossing.findByPk(req.params.id, {
      include: [{ model: RegistryCharacter, as: 'character' }],
    });
    if (!crossing) return res.status(404).json({ error: 'Crossing not found' });

    const char = crossing.character;
    if (!char) return res.status(404).json({ error: 'Character not found' });

    let score = null;
    let reasoning = '';
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const charName = char.selected_name || char.display_name;
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are Amber, production intelligence for "Before Lala". Assess the performance gap for a character who has begun performing publicly.

Performance gap = distance between who they actually are (interior) and who they present (public). 0 = perfectly authentic, 100 = total performance.

Return JSON: {"score": 0-100, "reasoning": "paragraph explaining the gap", "dimensions_performed": ["..."], "dimensions_hidden": ["..."]}

Available dimensions: ambition, desire, visibility, grief, class, body, habits, belonging, shadow, integration`,
        messages: [{
          role: 'user',
          content: `Character: ${charName} (${char.role_type || 'unknown'})
Role: ${char.role_label || 'none'}
Core belief: ${char.core_belief || 'none'}
Personality: ${char.personality || 'none'}
Description: ${char.description || 'none'}
Initial feed state: ${crossing.initial_feed_state || 'unknown'}
Trigger for going public: ${crossing.trigger || 'unknown'}`,
        }],
      });
      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      score = parsed.score || null;
      reasoning = parsed.reasoning || '';
      // Store dimensions for later confirmation
      crossing._proposed_dimensions_performed = parsed.dimensions_performed || [];
      crossing._proposed_dimensions_hidden = parsed.dimensions_hidden || [];
    } catch (aiErr) {
      console.warn('[Crossings] Claude gap proposal failed:', aiErr.message);
      return res.status(503).json({ error: 'AI service unavailable' });
    }

    crossing.performance_gap_score = score;
    crossing.gap_proposed_by_amber = reasoning;
    // gap_confirmed stays false — Evoni must confirm
    await crossing.save();

    res.json({
      crossing_id: crossing.id,
      character: char.selected_name || char.display_name,
      score,
      reasoning,
      dimensions_performed: crossing._proposed_dimensions_performed,
      dimensions_hidden: crossing._proposed_dimensions_hidden,
      note: 'Proposal only — confirm via PUT /:id/confirm-gap',
    });
  } catch (err) {
    console.error('[Crossings] propose-gap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/confirm-gap
router.put('/:id/confirm-gap', async (req, res) => {
  const models = getModels(req);
  const { CharacterCrossing, RegistryCharacter } = models;
  try {
    const crossing = await CharacterCrossing.findByPk(req.params.id);
    if (!crossing) return res.status(404).json({ error: 'Crossing not found' });

    crossing.gap_confirmed = true;
    await crossing.save();

    // Update registry_characters
    const char = await RegistryCharacter.findByPk(crossing.character_id);
    if (char) {
      char.performing_publicly = true;
      if (req.body.dimensions_performed) char.dimensions_performed = req.body.dimensions_performed;
      if (req.body.dimensions_hidden)    char.dimensions_hidden = req.body.dimensions_hidden;
      await char.save();
    }

    res.json({ crossing, character_updated: !!char });
  } catch (err) {
    console.error('[Crossings] confirm-gap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tracker — Dashboard data
router.get('/tracker', async (req, res) => {
  const { CharacterCrossing, RegistryCharacter, StoryClockMarker } = getModels(req);
  try {
    const crossings = await CharacterCrossing.findAll({
      include: [
        { model: RegistryCharacter, as: 'character', attributes: ['id', 'selected_name', 'display_name', 'role_type', 'performing_publicly', 'dimensions_performed', 'dimensions_hidden'] },
        { model: StoryClockMarker, as: 'marker', attributes: ['id', 'name'] },
      ],
      order: [['performance_gap_score', 'DESC NULLS LAST']],
    });
    const unconfirmed = crossings.filter(c => !c.gap_confirmed && c.performance_gap_score !== null);
    const highGap = crossings.filter(c => c.performance_gap_score >= 70);

    res.json({ crossings, unconfirmed_count: unconfirmed.length, high_gap_count: highGap.length });
  } catch (err) {
    console.error('[Crossings] tracker error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
