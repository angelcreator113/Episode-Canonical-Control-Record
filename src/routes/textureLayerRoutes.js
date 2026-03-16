// routes/textureLayerRoutes.js

const express = require('express');
const router  = express.Router();
const db      = require('../models');
const { generateTextureLayer } = require('../services/textureLayerService');
const { updateArcTracking }    = require('../services/arcTrackingService');

// ── Generate texture for a story ──────────────────────────────────────
router.post('/generate', async (req, res) => {
  const {
    story,
    character_key,
    characters_present,
    registry_id,
  } = req.body;

  if (!story || !character_key) {
    return res.status(400).json({ error: 'story and character_key required' });
  }

  try {
    // Check if texture already exists
    const existing = await db.StoryTexture.findOne({
      where: { story_number: story.story_number, character_key },
    });
    if (existing) {
      return res.json({ texture: existing, already_existed: true });
    }

    // Fetch character data
    const characterData = await db.RegistryCharacter.findOne({
      where: { character_key },
      attributes: [
        'id', 'display_name', 'name', 'core_wound', 'core_desire',
        'core_fear', 'de_body_relationship', 'de_body_currency',
        'platform_primary', 'follower_tier',
      ],
    });

    if (!characterData) {
      return res.status(404).json({ error: 'Character not found in registry' });
    }

    // Generate all texture layers — pass db for arc context
    const texture = await generateTextureLayer(db, story, {
      characterKey: character_key,
      characterData: characterData.dataValues,
      charactersPresent: characters_present || [],
      registryId: registry_id,
    });

    // Save to DB as proposed (not confirmed)
    const saved = await db.StoryTexture.create(texture);

    // Update arc tracking — phone appearance and bleed flag
    if (texture.phone_appeared || texture.bleed_text) {
      await updateArcTracking(db, character_key, {
        storyNumber:    story.story_number,
        storyType:      story.story_type,
        phase:          story.phase,
        phoneAppeared:  texture.phone_appeared || false,
      });
    }

    res.json({ texture: saved, proposed: true, saved: false });

  } catch (err) {
    console.error('Texture generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Confirm a texture layer (or individual field) ─────────────────────
const VALID_CONFIRM_FIELDS = [
  'inner_thought_confirmed', 'conflict_confirmed', 'body_narrator_confirmed',
  'private_moment_confirmed', 'post_confirmed', 'bleed_confirmed',
];

router.post('/confirm/:storyNumber', async (req, res) => {
  const { character_key, fields } = req.body;

  try {
    const texture = await db.StoryTexture.findOne({
      where: {
        story_number: req.params.storyNumber,
        character_key,
      },
    });

    if (!texture) {
      return res.status(404).json({ error: 'Texture not found' });
    }

    const updates = {};

    if (fields === 'all') {
      updates.inner_thought_confirmed  = true;
      updates.conflict_confirmed       = texture.conflict_eligible;
      updates.body_narrator_confirmed  = true;
      updates.private_moment_confirmed = texture.private_moment_eligible;
      updates.post_confirmed           = !!texture.post_text;
      updates.bleed_confirmed          = !!texture.bleed_text;
      updates.fully_confirmed          = true;
      updates.confirmed_at             = new Date();
    } else {
      const safeFields = (fields || []).filter(f => VALID_CONFIRM_FIELDS.includes(f));
      if (safeFields.length === 0) {
        return res.status(400).json({ error: 'No valid confirmation fields provided' });
      }
      safeFields.forEach(f => { updates[f] = true; });
      // Check if all applicable layers are now confirmed
      const updated = { ...texture.dataValues, ...updates };
      const allConfirmed = (
        updated.inner_thought_confirmed &&
        updated.body_narrator_confirmed &&
        (!updated.conflict_eligible  || updated.conflict_confirmed) &&
        (!updated.private_moment_eligible || updated.private_moment_confirmed) &&
        (!updated.post_text          || updated.post_confirmed) &&
        (!updated.bleed_text         || updated.bleed_confirmed)
      );
      if (allConfirmed) {
        updates.fully_confirmed = true;
        updates.confirmed_at    = new Date();
      }
    }

    await texture.update(updates);
    res.json({ texture: { ...texture.dataValues, ...updates }, confirmed: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reject and regenerate a single layer ─────────────────────────────
router.post('/regenerate/:storyNumber/:layer', async (req, res) => {
  const { character_key } = req.body;
  const { storyNumber, layer } = req.params;

  const layerFieldMap = {
    inner_thought:   ['inner_thought_type', 'inner_thought_text', 'inner_thought_confirmed'],
    conflict:        ['conflict_trigger', 'conflict_surface_text', 'conflict_subtext', 'conflict_silence_beat', 'conflict_resolution_type', 'conflict_confirmed'],
    body_narrator:   ['body_narrator_text', 'body_narrator_confirmed'],
    private_moment:  ['private_moment_setting', 'private_moment_held_thing', 'private_moment_sensory_anchor', 'private_moment_text', 'private_moment_confirmed'],
    post:            ['post_text', 'post_platform', 'post_audience_bestie', 'post_audience_paying_man', 'post_audience_competitive_woman', 'post_confirmed'],
    bleed:           ['bleed_text', 'bleed_confirmed'],
  };

  if (!layerFieldMap[layer]) {
    return res.status(400).json({ error: `Unknown layer: ${layer}` });
  }

  try {
    const texture = await db.StoryTexture.findOne({
      where: { story_number: storyNumber, character_key },
    });
    if (!texture) return res.status(404).json({ error: 'Texture not found' });

    // Clear the layer fields
    const clearUpdate = {};
    layerFieldMap[layer].forEach(f => { clearUpdate[f] = null; });
    clearUpdate.fully_confirmed = false;
    await texture.update(clearUpdate);

    res.json({ texture: { ...texture.dataValues, ...clearUpdate }, regenerate: layer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get texture for a story ─────────────────────────────────────────
router.get('/:characterKey/:storyNumber', async (req, res) => {
  try {
    const texture = await db.StoryTexture.findOne({
      where: {
        character_key: req.params.characterKey,
        story_number:  req.params.storyNumber,
      },
    });
    if (!texture) return res.status(404).json({ error: 'Not found' });
    res.json({ texture });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get all texture for a character (summary) ───────────────────────
router.get('/:characterKey', async (req, res) => {
  try {
    const textures = await db.StoryTexture.findAll({
      where: { character_key: req.params.characterKey },
      attributes: [
        'story_number', 'inner_thought_type',
        'conflict_eligible', 'private_moment_eligible',
        'phone_appeared', 'bleed_text',
        'fully_confirmed', 'amber_notes',
        'post_text',
      ],
      order: [['story_number', 'ASC']],
    });
    res.json({ textures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
