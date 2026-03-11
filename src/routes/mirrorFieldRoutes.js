'use strict';
/**
 * mirrorFieldRoutes.js — The Mirror Field
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/social-profiles', mirrorFieldRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * POST /:id/mirror/propose   — Amber proposes mirror dimension via Claude
 * POST /:id/mirror/confirm   — Evoni confirms dimension
 * GET  /mirror/self-portrait  — all confirmed profiles grouped by dimension
 */
const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

const DIMENSION_LABELS = {
  ambition:         'The part of her that wants to be legendary',
  desire_unnamed:   "The part of her that wants and hasn't named it yet",
  visibility_wound: 'The part of her that wants to be seen that badly',
  grief:            'The part of her that has already lost something',
  class:            'The part of her that knows what money means',
  body:             'The part of her that lives in her body',
  habits:           'The part of her that repeats without noticing',
  belonging:        'The part of her looking for where she fits',
  shadow:           "The part of her she hasn't looked at directly",
  integration:      'Lala — the part of her that finally consolidated',
};

// POST /:id/mirror/propose
router.post('/:id/mirror/propose', async (req, res) => {
  const { SocialProfile } = getModels(req);
  try {
    const profile = await SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    let reasoning = '';
    let dimension = null;
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are Amber, production intelligence for "Before Lala". You analyze Feed profiles and map each to a dimension of JustAWoman's interior life.

Available dimensions: ambition, desire_unnamed, visibility_wound, grief, class, body, habits, belonging, shadow, integration

Return JSON: {"dimension": "...", "reasoning": "2-sentence explanation of why this profile maps to this dimension"}`,
        messages: [{
          role: 'user',
          content: `Profile: @${profile.handle} (${profile.platform})
Archetype: ${profile.archetype || 'unknown'}
Content persona: ${profile.content_persona || 'none'}
Real signal: ${profile.real_signal || 'none'}
Lala relevance score: ${profile.lala_relevance_score || 0}
Vibe: ${profile.vibe_sentence || ''}`,
        }],
      });
      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      dimension = parsed.dimension || null;
      reasoning = parsed.reasoning || '';
    } catch (aiErr) {
      console.warn('[MirrorField] Claude proposal failed:', aiErr.message);
      return res.status(503).json({ error: 'AI service unavailable', detail: aiErr.message });
    }

    // Save proposal — does NOT set mirror_confirmed
    profile.mirror_proposed_by_amber = reasoning;
    await profile.save();

    res.json({
      profile_id: profile.id,
      proposed_dimension: dimension,
      reasoning,
      label: DIMENSION_LABELS[dimension] || null,
      note: 'Proposal only — confirm via POST /:id/mirror/confirm',
    });
  } catch (err) {
    console.error('[MirrorField] propose error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/mirror/confirm
router.post('/:id/mirror/confirm', async (req, res) => {
  const { SocialProfile } = getModels(req);
  try {
    const profile = await SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { dimension } = req.body;
    if (!dimension) return res.status(400).json({ error: 'dimension required' });

    profile.justawoman_mirror = dimension;
    profile.mirror_confirmed = true;
    profile.mirror_confirmed_at = new Date();
    await profile.save();

    res.json({ profile_id: profile.id, dimension, confirmed: true });
  } catch (err) {
    console.error('[MirrorField] confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /mirror/self-portrait
router.get('/mirror/self-portrait', async (req, res) => {
  const { SocialProfile } = getModels(req);
  try {
    const profiles = await SocialProfile.findAll({
      where: { mirror_confirmed: true },
      attributes: ['id', 'handle', 'display_name', 'platform', 'archetype', 'justawoman_mirror', 'mirror_confirmed_at'],
      order: [['mirror_confirmed_at', 'ASC']],
    });

    // Group by dimension
    const portrait = {};
    for (const dim of Object.keys(DIMENSION_LABELS)) {
      portrait[dim] = {
        label: DIMENSION_LABELS[dim],
        profiles: profiles.filter(p => p.justawoman_mirror === dim),
      };
    }

    res.json({ portrait, total_confirmed: profiles.length });
  } catch (err) {
    console.error('[MirrorField] self-portrait error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
