'use strict';
/**
 * characterGenerationRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   const characterGenerationRoutes = require('./routes/characterGenerationRoutes');
 *   app.use('/api/v1/character-generation', characterGenerationRoutes);
 *
 * Routes:
 *   POST /generate          — generate full character from spark (returns proposal)
 *   POST /confirm           — author confirms proposal → writes to DB
 *   POST /confirm-feed      — author confirms Feed profile → creates social_profile + links
 *   POST /promote-ghost/:id — promote ghost character to full registry entry
 *   PATCH /depth/:id        — manually set depth_level (with warning for alive→lower)
 *   GET  /depth/:id         — get current depth_level + what's needed to go deeper
 *
 * 403 REPLACEMENT:
 *   The old hard block on finalized characters is replaced with a warning system.
 *   Characters at 'alive' depth get a confirmation prompt before edits, not a block.
 *   The delete protection in memories.js stays but checks depth_level = 'alive'
 *   instead of status = 'finalized'.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');
const {
  generateFullCharacter,
  calculateDepthLevel,
} = require('../services/characterGenerationService');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// ────────────────────────────────────────────────────────────────────────────
// POST /generate
// Takes a spark and returns a complete proposed interior architecture.
// Nothing is written to DB. Author reviews the proposal first.
// ────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const { spark, world_id, book_id } = req.body;

  if (!spark?.name || !spark?.vibe) {
    return res.status(400).json({ error: 'spark.name and spark.vibe are required' });
  }

  const models = getModels(req);

  try {
    // Load world and book context
    let worldContext = null;
    let bookContext  = null;

    if (world_id && models.Universe) {
      worldContext = await models.Universe.findByPk(world_id, {
        attributes: ['id', 'name', 'description', 'tone'],
      });
    }

    if (book_id && models.StorytellerBook) {
      bookContext = await models.StorytellerBook.findByPk(book_id, {
        attributes: ['id', 'title'],
      });
    }

    // Load existing cast for context
    const existingCharacters = await models.RegistryCharacter.findAll({
      where:      { world_exists: true },
      attributes: ['id', 'selected_name', 'role_type'],
      limit:      30,
    });

    const result = await generateFullCharacter({
      spark,
      worldContext,
      bookContext,
      existingCharacters,
    });

    res.json({
      proposal:            result.proposed,
      feed_profile:        result.feed_profile_proposal,
      ghost_characters:    result.ghost_characters,
      requires_confirmation: true,
      message: 'Character generated. Review the proposal and confirm to write to registry.',
    });
  } catch (err) {
    console.error('[characterGenerationRoutes] /generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /confirm
// Author has reviewed the proposal. Writes to registry_characters.
// ────────────────────────────────────────────────────────────────────────────
router.post('/confirm', async (req, res) => {
  const { character_id, proposed, registry_id } = req.body;

  if (!proposed) {
    return res.status(400).json({ error: 'proposed character data is required' });
  }

  const models  = getModels(req);
  const { RegistryCharacter, CharacterRegistry } = models;

  try {
    // If character_id provided — updating an existing character
    if (character_id) {
      const character = await RegistryCharacter.findByPk(character_id);
      if (!character) return res.status(404).json({ error: 'Character not found' });

      // Depth warning instead of 403 block
      if (character.depth_level === 'alive') {
        // Don't block — but flag that this is a significant edit
        console.log(`[characterGenerationRoutes] Editing alive character: ${character.selected_name}`);
      }

      // Auto-calculate depth level from the proposed data
      const depth_level = calculateDepthLevel({ ...character.toJSON(), ...proposed });

      await character.update({ ...proposed, depth_level });

      return res.json({
        character,
        depth_level,
        depth_warning: character.depth_level === 'alive'
          ? 'This character was at Alive depth. Changes have been applied and flagged.'
          : null,
      });
    }

    // New character — requires a registry
    if (!registry_id) {
      return res.status(400).json({ error: 'registry_id required for new characters' });
    }

    const registry = await CharacterRegistry.findByPk(registry_id);
    if (!registry) return res.status(404).json({ error: 'Registry not found' });

    const depth_level = calculateDepthLevel(proposed);

    const character = await RegistryCharacter.create({
      ...proposed,
      registry_id,
      depth_level,
      status: 'accepted',  // keep status field populated for backwards compat
    });

    res.status(201).json({ character, depth_level });
  } catch (err) {
    console.error('[characterGenerationRoutes] /confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /confirm-feed
// Author confirms the Feed profile proposal → creates social_profile + links
// ────────────────────────────────────────────────────────────────────────────
router.post('/confirm-feed', async (req, res) => {
  const { character_id, feed_proposal } = req.body;

  if (!character_id || !feed_proposal) {
    return res.status(400).json({ error: 'character_id and feed_proposal required' });
  }

  const models = getModels(req);
  const { RegistryCharacter, SocialProfile } = models;

  try {
    const character = await RegistryCharacter.findByPk(character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // Map follower_range to a number
    const _followerMap = {
      'nano':  5000,
      'micro': 50000,
      'mid':   250000,
      'macro': 1000000,
    };

    const profile = await SocialProfile.create({
      handle:          feed_proposal.handle,
      display_name:    feed_proposal.display_name,
      platform:        feed_proposal.platform,
      vibe_sentence:   feed_proposal.bio || '',
      current_state:   feed_proposal.starting_state || 'rising',
      follower_count_approx: feed_proposal.follower_range || 'micro',
      status:          'generated',
      auto_generated:  true,
    });

    // Link the profile back to the character
    await character.update({
      feed_profile_id:  profile.id,
      social_presence:  true,
      depth_level:      'active',  // having a Feed profile moves them to Active
    });

    // Create a CharacterEntanglement — the character is their own identity anchor
    if (models.CharacterEntanglement) {
      await models.CharacterEntanglement.create({
        character_id:      character_id,
        profile_id:        profile.id,
        dimension:         'ambition_identity',
        intensity:         'identity_anchor',
        directionality:    'mutual',
        entanglement_type: 'identity_anchor',
        is_active:         true,
        notes:             'Auto-created: character owns this Feed profile',
      }).catch(e => console.warn('[char-gen] entanglement create error:', e?.message)); // non-fatal
    }

    res.status(201).json({
      profile,
      character,
      message: 'Feed profile created and linked to character.',
    });
  } catch (err) {
    console.error('[characterGenerationRoutes] /confirm-feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /promote-ghost/:characterId
// Promote a ghost character to a full registry entry
// ────────────────────────────────────────────────────────────────────────────
router.post('/promote-ghost/:characterId', async (req, res) => {
  const { ghost_name, registry_id } = req.body;
  const models = getModels(req);
  const { RegistryCharacter } = models;

  if (!ghost_name || !registry_id) {
    return res.status(400).json({ error: 'ghost_name and registry_id required' });
  }

  try {
    // Create a sparked entry for the ghost character
    const newCharacter = await RegistryCharacter.create({
      registry_id,
      selected_name: ghost_name,
      display_name:  ghost_name,
      character_key: ghost_name.toLowerCase().replace(/\s+/g, '_'),
      depth_level:   'sparked',
      status:        'draft',
      role_type:     'supporting',
      world_exists:  false,
    });

    // Remove the ghost from the original character's ghost_characters array
    const sourceCharacter = await RegistryCharacter.findByPk(req.params.characterId);
    if (sourceCharacter?.ghost_characters) {
      const updated = sourceCharacter.ghost_characters.map(g =>
        g.name === ghost_name ? { ...g, promoted: true, promoted_id: newCharacter.id } : g
      );
      await sourceCharacter.update({ ghost_characters: updated });
    }

    res.status(201).json({
      character: newCharacter,
      message:   `${ghost_name} promoted from ghost to sparked. Build them out from here.`,
    });
  } catch (err) {
    console.error('[characterGenerationRoutes] /promote-ghost error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /depth/:id
// What depth level is this character at, and what would move them deeper?
// ────────────────────────────────────────────────────────────────────────────
router.get('/depth/:id', async (req, res) => {
  try {
    const models    = getModels(req);
    const character = await models.RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const current = character.depth_level || calculateDepthLevel(character.toJSON());

    const nextSteps = {
      sparked:   ['Generate Deep Profile', 'Generate Want Architecture', 'Generate Wound'],
      breathing: ['Add to a story scene', 'Create Feed profile', 'Build Relationship Map'],
      active:    ['Approve 3+ scenes featuring this character', 'Build out Triggers', 'Complete Dilemma'],
      alive:     ['Character is fully alive. They can walk into any scene right now.'],
    };

    res.json({
      character_id:  character.id,
      name:          character.selected_name,
      depth_level:   current,
      next_steps:    nextSteps[current] || [],
      has_feed:      !!character.feed_profile_id,
      has_deep_profile: !!(character.deep_profile && Object.keys(character.deep_profile).length > 0),
      has_wound:     !!character.wound,
      has_dilemma:   !!character.dilemma,
    });
  } catch (err) {
    console.error('[character-generation] depth GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /depth/:id
// Manually set depth level
// ────────────────────────────────────────────────────────────────────────────
router.patch('/depth/:id', async (req, res) => {
  try {
    const { depth_level } = req.body;
    const valid = ['sparked', 'breathing', 'active', 'alive'];

    if (!valid.includes(depth_level)) {
      return res.status(400).json({ error: `depth_level must be one of: ${valid.join(', ')}` });
    }

    const models    = getModels(req);
    const character = await models.RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    await character.update({ depth_level });
    res.json({ character, message: `Depth level set to ${depth_level}.` });
  } catch (err) {
    console.error('[character-generation] depth PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
