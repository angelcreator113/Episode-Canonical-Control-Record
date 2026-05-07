'use strict';

const express = require('express');
const router = express.Router();
const {
  createFollowProfileFromDNA,
  buildFollowInfluenceContext,
  detectFollowTensions,
} = require('../services/characterFollowService');

const { requireAuth } = require('../middleware/auth');

// ── GET /character-follows — list all follow profiles ────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.CharacterFollowProfile) return res.json({ profiles: [] });

  try {
    const profiles = await db.CharacterFollowProfile.findAll({
      order: [['character_name', 'ASC']],
    });
    return res.json({ profiles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /character-follows/tensions/:charA/:charB — detect follow tensions ───
// (Must be before /:characterKey to avoid "tensions" matching as a characterKey)
router.get('/tensions/:charA/:charB', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');

  try {
    const tensions = await detectFollowTensions(db, req.params.charA, req.params.charB);
    return res.json(tensions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /character-follows/:characterKey — single profile detail ─────────────
router.get('/:characterKey', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.CharacterFollowProfile) return res.status(404).json({ error: 'Follow profiles not available' });

  try {
    const profile = await db.CharacterFollowProfile.findOne({
      where: { character_key: req.params.characterKey },
    });
    if (!profile) return res.status(404).json({ error: 'No follow profile found for this character' });

    // Also get their actual follows
    let follows = [];
    if (db.SocialProfileFollower) {
      follows = await db.SocialProfileFollower.findAll({
        where: { character_key: req.params.characterKey },
        include: db.SocialProfile ? [{
          model: db.SocialProfile,
          as: 'socialProfile',
          attributes: ['id', 'handle', 'display_name', 'platform', 'content_category',
            'archetype', 'follower_count_approx', 'current_trajectory', 'adult_content_present'],
        }] : [],
        order: [['influence_level', 'DESC']],
      });
    }

    return res.json({ profile, follows, follow_count: follows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /character-follows/generate/:characterKey — generate from DNA ───────
router.post('/generate/:characterKey', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.CharacterFollowProfile || !db.RegistryCharacter) {
    return res.status(500).json({ error: 'Required models not available' });
  }

  try {
    const result = await createFollowProfileFromDNA(db, req.params.characterKey);
    return res.json({
      success: true,
      created: result.created,
      profile: result.profile,
      reasoning: result.generated.generation_reasoning,
    });
  } catch (err) {
    console.error('[character-follows] generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /character-follows/generate-batch — generate for multiple characters ─
router.post('/generate-batch', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.CharacterFollowProfile || !db.RegistryCharacter) {
    return res.status(500).json({ error: 'Required models not available' });
  }

  try {
    const { character_keys } = req.body;
    let keys = character_keys;

    // If no keys provided, generate for all registry characters that don't have profiles yet
    if (!keys || keys.length === 0) {
      const { Op } = require('sequelize');
      const existing = await db.CharacterFollowProfile.findAll({
        attributes: ['character_key'],
        raw: true,
      });
      const existingKeys = new Set(existing.map(e => e.character_key));

      const characters = await db.RegistryCharacter.findAll({
        where: { status: { [Op.in]: ['accepted', 'finalized'] } },
        attributes: ['character_key'],
        raw: true,
      });
      keys = characters.map(c => c.character_key).filter(k => !existingKeys.has(k));
    }

    const results = [];
    for (const key of keys) {
      try {
        const result = await createFollowProfileFromDNA(db, key);
        results.push({ character_key: key, success: true, created: result.created });
      } catch (err) {
        results.push({ character_key: key, success: false, error: err.message });
      }
    }

    return res.json({
      total: keys.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /character-follows/:characterKey — hand-tune a profile ─────────────
router.patch('/:characterKey', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.CharacterFollowProfile) return res.status(500).json({ error: 'Not available' });

  try {
    const profile = await db.CharacterFollowProfile.findOne({
      where: { character_key: req.params.characterKey },
    });
    if (!profile) return res.status(404).json({ error: 'No follow profile found' });

    const allowed = [
      'category_affinity', 'archetype_affinity', 'motivation_weights',
      'drama_bonus', 'adult_penalty', 'same_platform_bonus',
      'follower_tier_affinity', 'base_follow_threshold',
      'consumption_style', 'consumption_context',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length > 0) {
      updates.hand_tuned = true;
      await profile.update(updates);
    }

    return res.json({ profile: await profile.reload() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /character-follows/:characterKey/influence-context — story injection ──
router.get('/:characterKey/influence-context', requireAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');

  try {
    const context = await buildFollowInfluenceContext(db, req.params.characterKey, {
      limit: parseInt(req.query.limit) || 10,
      includeSharedWith: req.query.shared_with || null,
    });
    return res.json({ character_key: req.params.characterKey, context });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
