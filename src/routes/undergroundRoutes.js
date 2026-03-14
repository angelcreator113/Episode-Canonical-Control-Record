'use strict';
/**
 * undergroundRoutes.js — Underground Visibility Tier (Component 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/social-profiles', undergroundRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PUT  /:id/visibility          — set visibility_tier for a profile
 * GET  /feed                    — list profiles for Feed view (excludes underground by default)
 * GET  /underground             — list underground-only profiles (Author Layer)
 *
 * Rules from brief:
 *   - Underground profiles excluded from main Feed view by default.
 *   - Visible only from Author Layer or character pages with direct entanglement.
 *   - Ripples from underground events only propagate to characters with explicit entanglement.
 *   - author_mode=true query param shows all tiers with underground indicator.
 */
const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

const VALID_TIERS = ['public', 'semi_private', 'underground'];

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:id/visibility — set visibility_tier for a social profile
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/visibility', async (req, res) => {
  const { SocialProfile } = getModels(req);
  try {
    const { visibility_tier } = req.body;
    if (!visibility_tier || !VALID_TIERS.includes(visibility_tier)) {
      return res.status(400).json({
        error: `visibility_tier required. Must be one of: ${VALID_TIERS.join(', ')}`,
      });
    }

    const profile = await SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await profile.update({ visibility_tier });
    res.json({
      profile: {
        id: profile.id,
        handle: profile.handle,
        display_name: profile.display_name,
        visibility_tier: profile.visibility_tier,
      },
    });
  } catch (err) {
    console.error('[Underground] PUT /:id/visibility error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /feed — list profiles for the main Feed view
//
// Default: excludes underground profiles.
// ?author_mode=true  → returns ALL tiers, with visibility_tier field exposed
// ?character_id=UUID → also includes underground profiles entangled with this character
// ─────────────────────────────────────────────────────────────────────────────
router.get('/feed', async (req, res) => {
  const models = getModels(req);
  const { SocialProfile, CharacterEntanglement } = models;
  try {
    const authorMode  = req.query.author_mode === 'true';
    const characterId = req.query.character_id;
    const seriesId    = req.query.series_id;

    const where = {};
    if (seriesId) where.series_id = seriesId;

    if (!authorMode) {
      // Default feed: public + semi_private only
      // Unless a character_id is specified — then also show underground profiles
      // that have a direct entanglement with that character
      if (characterId) {
        const entanglements = await CharacterEntanglement.findAll({
          where: { character_id: characterId, is_active: true },
          attributes: ['profile_id'],
        });
        const entangledProfileIds = entanglements.map(e => e.profile_id).filter(Boolean);

        where[Op.or] = [
          { visibility_tier: { [Op.in]: ['public', 'semi_private'] } },
          ...(entangledProfileIds.length > 0
            ? [{ id: { [Op.in]: entangledProfileIds }, visibility_tier: 'underground' }]
            : []),
        ];
      } else {
        where.visibility_tier = { [Op.in]: ['public', 'semi_private'] };
      }
    }
    // author_mode=true → no tier filter, show everything

    const profiles = await SocialProfile.findAll({
      where,
      attributes: [
        'id', 'handle', 'display_name', 'platform', 'current_state',
        'archetype', 'follower_tier', 'visibility_tier', 'vibe_sentence',
        'content_category', 'lala_relevance_score',
      ],
      order: [['handle', 'ASC']],
    });

    res.json({
      profiles,
      count: profiles.length,
      author_mode: authorMode,
    });
  } catch (err) {
    console.error('[Underground] GET /feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /underground — list underground-only profiles (Author Layer view)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/underground', async (req, res) => {
  const { SocialProfile } = getModels(req);
  try {
    const where = { visibility_tier: 'underground' };
    if (req.query.series_id) where.series_id = req.query.series_id;

    const profiles = await SocialProfile.findAll({
      where,
      attributes: [
        'id', 'handle', 'display_name', 'platform', 'current_state',
        'archetype', 'follower_tier', 'visibility_tier', 'vibe_sentence',
        'content_category', 'lala_relevance_score',
      ],
      order: [['handle', 'ASC']],
    });

    res.json({ profiles, count: profiles.length });
  } catch (err) {
    console.error('[Underground] GET /underground error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
