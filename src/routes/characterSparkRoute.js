/**
 * characterSparkRoute.js
 *
 * 3-field fast character entry with Claude Opus 4.5 pre-fill.
 * POST /   — create spark (name + desire_line + wound)
 * GET  /sparks         — list all sparks
 * GET  /sparks/:id     — get single spark
 * PATCH /sparks/:id    — update spark fields
 * POST /sparks/:id/prefill — run Claude Opus pre-fill expansion
 *
 * Mounted at: /api/v1/character-registry  (alongside existing registry routes)
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../models');

const anthropic = new Anthropic();

const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// ── POST /sparks — create a new spark ─────────────────────────────────────
router.post('/sparks', requireAuth, async (req, res) => {
  try {
    const { name, desire_line, wound, registry_id } = req.body;
    if (!name || !desire_line || !wound) {
      return res.status(400).json({ error: 'name, desire_line, and wound are required' });
    }

    const spark = await db.CharacterSpark.create({
      name: String(name).slice(0, 255),
      desire_line: String(desire_line),
      wound: String(wound),
      registry_id: registry_id || null,
      status: 'draft',
    });

    return res.json({ success: true, spark });
  } catch (err) {
    console.error('[character-spark/create]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to create spark' });
  }
});

// ── GET /sparks — list all sparks ─────────────────────────────────────────
router.get('/sparks', requireAuth, async (req, res) => {
  try {
    const { registry_id, status } = req.query;
    const where = {};
    if (registry_id) where.registry_id = registry_id;
    if (status) where.status = status;

    const sparks = await db.CharacterSpark.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
    return res.json({ sparks });
  } catch (err) {
    console.error('[character-spark/list]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to list sparks' });
  }
});

// ── GET /sparks/:id — get single spark ────────────────────────────────────
router.get('/sparks/:id', requireAuth, async (req, res) => {
  try {
    const spark = await db.CharacterSpark.findByPk(req.params.id);
    if (!spark) return res.status(404).json({ error: 'Spark not found' });
    return res.json({ spark });
  } catch (err) {
    console.error('[character-spark/get]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to get spark' });
  }
});

// ── PATCH /sparks/:id — update spark fields ───────────────────────────────
router.patch('/sparks/:id', requireAuth, async (req, res) => {
  try {
    const spark = await db.CharacterSpark.findByPk(req.params.id);
    if (!spark) return res.status(404).json({ error: 'Spark not found' });

    const allowed = ['name', 'desire_line', 'wound', 'status', 'registry_id', 'prefill_result'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) spark[key] = req.body[key];
    }
    await spark.save();
    return res.json({ success: true, spark });
  } catch (err) {
    console.error('[character-spark/update]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to update spark' });
  }
});

// ── POST /sparks/:id/prefill — Claude Opus 4.5 pre-fill expansion ────────
router.post('/sparks/:id/prefill', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const spark = await db.CharacterSpark.findByPk(req.params.id);
    if (!spark) return res.status(404).json({ error: 'Spark not found' });

    const system = `You are a master character architect for adult literary fiction. Given three core inputs (name, desire line, wound), expand into a complete character DNA profile. Return ONLY valid JSON — no markdown fences.`;

    const userPrompt = `Expand this character spark into a full DNA profile:

NAME: ${spark.name}
DESIRE LINE: ${spark.desire_line}
WOUND: ${spark.wound}

Return JSON with this structure:
{
  "display_name": "full name",
  "character_key": "snake_case_key",
  "icon": "single emoji",
  "desire_line": "refined desire line",
  "fear_line": "what they fear most",
  "wound": "refined wound",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "job": "what they do",
  "job_antagonist": "who opposes them at work",
  "personal_antagonist": "who opposes them personally",
  "recurring_object": "a physical object that symbolises their arc",
  "life_domains": {
    "career": "one-sentence career situation",
    "romantic": "one-sentence romantic situation",
    "family": "one-sentence family situation",
    "friends": "one-sentence friend situation"
  },
  "voice_notes": "how they speak — cadence, vocabulary, tics",
  "physical_description": "2-3 sentences of physical appearance",
  "secret": "something nobody knows",
  "backstory_hook": "2-3 sentence backstory seed"
}`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const prefill = JSON.parse(raw);

    spark.prefill_result = prefill;
    spark.status = 'prefilled';
    await spark.save();

    return res.json({ success: true, spark, prefill });
  } catch (err) {
    console.error('[character-spark/prefill]', err?.message);
    return res.status(500).json({ error: err?.message || 'Pre-fill failed' });
  }
});

module.exports = router;
