/**
 * Character Registry Routes
 * CRUD for registries and their characters
 * Location: src/routes/characterRegistry.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

/* ------------------------------------------------------------------ */
/*  Lazy model loader                                                  */
/* ------------------------------------------------------------------ */
let models = null;
function getModels() {
  if (!models) {
    models = require('../models');
  }
  return models;
}

/* ================================================================== */
/*  REGISTRIES                                                         */
/* ================================================================== */

/**
 * GET /registries
 * List all registries with character-count + status summary
 */
router.get('/registries', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const registries = await CharacterRegistry.findAll({
      include: [{ model: RegistryCharacter, as: 'characters', attributes: ['id', 'character_key', 'status', 'role_type', 'display_name', 'icon', 'sort_order'] }],
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, registries });
  } catch (err) {
    console.error('[CharacterRegistry] GET /registries error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /registries
 * Create a new registry (optionally with initial characters array)
 */
router.post('/registries', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const { title, book_tag, description, core_rule, show_id, characters } = req.body;

    const registry = await CharacterRegistry.create({
      title: title || 'Untitled Registry',
      book_tag: book_tag || null,
      description: description || null,
      core_rule: core_rule || null,
      show_id: show_id || null,
    });

    if (Array.isArray(characters) && characters.length > 0) {
      const charRows = characters.map((c, idx) => ({
        registry_id: registry.id,
        character_key: c.character_key || `char-${idx}`,
        icon: c.icon || null,
        display_name: c.display_name || `Character ${idx + 1}`,
        subtitle: c.subtitle || null,
        role_type: c.role_type || 'pressure',
        role_label: c.role_label || null,
        appearance_mode: c.appearance_mode || 'on_page',
        status: 'draft',
        core_belief: c.core_belief || null,
        pressure_type: c.pressure_type || null,
        pressure_quote: c.pressure_quote || null,
        personality: c.personality || null,
        job_options: c.job_options || null,
        description: c.description || null,
        name_options: c.name_options || null,
        selected_name: c.selected_name || null,
        personality_matrix: c.personality_matrix || null,
        extra_fields: c.extra_fields || null,
        sort_order: c.sort_order ?? idx,
      }));
      await RegistryCharacter.bulkCreate(charRows);
    }

    // Reload with characters
    const full = await CharacterRegistry.findByPk(registry.id, {
      include: [{ model: RegistryCharacter, as: 'characters' }],
    });

    return res.status(201).json({ success: true, registry: full });
  } catch (err) {
    console.error('[CharacterRegistry] POST /registries error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /registries/default
 * Auto-find the first registry (or create one)
 */
router.get('/registries/default', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    let registry = await CharacterRegistry.findOne({
      include: [{ model: RegistryCharacter, as: 'characters', order: [['sort_order', 'ASC']] }],
      order: [['created_at', 'ASC']],
    });
    if (!registry) {
      registry = await CharacterRegistry.create({ title: 'My Registry', status: 'active' });
      registry = await CharacterRegistry.findByPk(registry.id, {
        include: [{ model: RegistryCharacter, as: 'characters' }],
      });
    }
    return res.json({ success: true, registry });
  } catch (err) {
    console.error('[CharacterRegistry] GET /registries/default error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /registries/:id
 * Get single registry with all characters
 */
router.get('/registries/:id', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const registry = await CharacterRegistry.findByPk(req.params.id, {
      include: [{ model: RegistryCharacter, as: 'characters', order: [['sort_order', 'ASC']] }],
    });
    if (!registry) return res.status(404).json({ success: false, error: 'Registry not found' });
    return res.json({ success: true, registry });
  } catch (err) {
    console.error('[CharacterRegistry] GET /registries/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /registries/:id
 * Update registry metadata
 */
router.put('/registries/:id', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const registry = await CharacterRegistry.findByPk(req.params.id);
    if (!registry) return res.status(404).json({ success: false, error: 'Registry not found' });

    const allowed = ['title', 'book_tag', 'description', 'core_rule', 'status', 'show_id'];
    allowed.forEach(f => { if (req.body[f] !== undefined) registry[f] = req.body[f]; });
    await registry.save();

    const full = await CharacterRegistry.findByPk(registry.id, {
      include: [{ model: RegistryCharacter, as: 'characters' }],
    });
    return res.json({ success: true, registry: full });
  } catch (err) {
    console.error('[CharacterRegistry] PUT /registries/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /registries/:id
 * Soft-delete registry (cascades to characters)
 */
router.delete('/registries/:id', async (req, res) => {
  try {
    const { CharacterRegistry } = getModels();
    const registry = await CharacterRegistry.findByPk(req.params.id);
    if (!registry) return res.status(404).json({ success: false, error: 'Registry not found' });
    await registry.destroy();
    return res.json({ success: true, message: 'Registry deleted' });
  } catch (err) {
    console.error('[CharacterRegistry] DELETE /registries/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================== */
/*  CHARACTERS                                                         */
/* ================================================================== */

/**
 * POST /registries/:id/characters
 * Add a character to a registry
 */
router.post('/registries/:id/characters', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const registry = await CharacterRegistry.findByPk(req.params.id);
    if (!registry) return res.status(404).json({ success: false, error: 'Registry not found' });

    const {
      character_key, icon, display_name, subtitle, role_type, role_label,
      appearance_mode, core_belief, pressure_type, pressure_quote,
      personality, job_options, description, name_options, selected_name,
      personality_matrix, extra_fields, sort_order,
    } = req.body;

    const count = await RegistryCharacter.count({ where: { registry_id: registry.id } });

    const character = await RegistryCharacter.create({
      registry_id: registry.id,
      character_key: character_key || `char-${Date.now()}`,
      icon: icon || null,
      display_name: display_name || 'New Character',
      subtitle: subtitle || null,
      role_type: role_type || 'pressure',
      role_label: role_label || null,
      appearance_mode: appearance_mode || 'on_page',
      status: 'draft',
      core_belief: core_belief || null,
      pressure_type: pressure_type || null,
      pressure_quote: pressure_quote || null,
      personality: personality || null,
      job_options: job_options || null,
      description: description || null,
      name_options: name_options || null,
      selected_name: selected_name || null,
      personality_matrix: personality_matrix || null,
      extra_fields: extra_fields || null,
      sort_order: sort_order ?? count,
    });

    return res.status(201).json({ success: true, character });
  } catch (err) {
    console.error('[CharacterRegistry] POST characters error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /characters/:id
 * Get a single character by ID
 */
router.get('/characters/:id', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    return res.json({ success: true, character });
  } catch (err) {
    console.error('[CharacterRegistry] GET /characters/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /characters/:id
 * Update any character fields
 */
router.put('/characters/:id', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const allowed = [
      'character_key', 'icon', 'display_name', 'subtitle', 'role_type', 'role_label',
      'appearance_mode', 'status', 'core_belief', 'pressure_type', 'pressure_quote',
      'personality', 'job_options', 'description', 'name_options', 'selected_name',
      'personality_matrix', 'extra_fields', 'sort_order', 'portrait_url',
      // Section 1: Core Identity
      'canon_tier', 'first_appearance', 'era_introduced', 'creator',
      // Section 2: Essence Profile
      'core_desire', 'core_fear', 'core_wound', 'mask_persona',
      'truth_persona', 'character_archetype', 'signature_trait', 'emotional_baseline',
      // Sections 3-8: JSONB
      'aesthetic_dna', 'career_status', 'relationships_map',
      'story_presence', 'voice_signature', 'evolution_tracking',
    ];
    allowed.forEach(f => { if (req.body[f] !== undefined) character[f] = req.body[f]; });
    await character.save();

    return res.json({ success: true, character });
  } catch (err) {
    console.error('[CharacterRegistry] PUT characters/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /characters/:id
 * Soft-delete character
 */
router.delete('/characters/:id', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    await character.destroy();
    return res.json({ success: true, message: 'Character deleted' });
  } catch (err) {
    console.error('[CharacterRegistry] DELETE characters/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/:id/select-name
 * Select one of the name_options
 */
router.post('/characters/:id/select-name', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    character.selected_name = name;
    character.display_name = name;
    await character.save();

    return res.json({ success: true, character });
  } catch (err) {
    console.error('[CharacterRegistry] select-name error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/:id/set-status
 * Accept / Decline / Finalize a character
 */
router.post('/characters/:id/set-status', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const { status } = req.body;
    if (!['draft', 'accepted', 'declined', 'finalized'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Must be draft, accepted, declined, or finalized.' });
    }

    // Allow reverting from finalized (no longer permanently locked)

    character.status = status;
    await character.save();

    // Auto-promote to LalaVerse canon when finalized
    if (status === 'finalized') {
      const LALAVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e';
      try {
        const db = getModels();
        const canonTier = ['special'].includes(character.role_type)
          ? 'core_canon'
          : ['pressure', 'mirror'].includes(character.role_type)
          ? 'supporting_canon'
          : 'minor_canon';

        const existing = await db.UniverseCharacter?.findOne({
          where: { registry_character_id: req.params.id, universe_id: LALAVERSE_ID },
        });

        // Only promote world characters (on_page) to LalaVerse canon
        const isWorldCharacter = character.appearance_mode === 'on_page';

        if (!existing && db.UniverseCharacter) {
          if (isWorldCharacter) {
            await db.UniverseCharacter.create({
              universe_id:           LALAVERSE_ID,
              registry_character_id: req.params.id,
              name:                  character.selected_name || character.display_name,
              type:                  character.role_type,
              canon_tier:            canonTier,
              role:                  character.description,
              first_appeared:        new Date(),
              status:                'active',
              world_exists:          true,
            });
            console.log(`✓ World character ${character.display_name} promoted to LalaVerse canon`);
          } else {
            console.log(`⊘ ${character.display_name} not promoted — appearance_mode: ${character.appearance_mode} (not on_page)`);
          }
        }
      } catch (promoteErr) {
        // Log but don't fail the finalize
        console.error('Auto-promote error (non-fatal):', promoteErr);
      }
    }

    return res.json({ success: true, character });
  } catch (err) {
    console.error('[CharacterRegistry] set-status error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /registries/:id/seed-book1
 * Seed a registry with the Book 1 characters from the mockup
 */
router.post('/registries/:id/seed-book1', async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = getModels();
    const registry = await CharacterRegistry.findByPk(req.params.id);
    if (!registry) return res.status(404).json({ success: false, error: 'Registry not found' });

    // ── TDD v1.0 — Book 1 PNOS Characters (7) ────────────────────────
    const seedCharacters = [
      {
        character_key: 'just-a-woman',
        icon: '♛',
        display_name: 'JustAWoman',
        selected_name: 'JustAWoman',
        role_type: 'protagonist',
        role_label: 'Self / Protagonist',
        appearance_mode: 'on_page',
        core_belief: 'Am I delusional for wanting more than what I\'ve already built?',
        description: 'The woman doing everything right and not being seen. Active, posting, building. Wound is invisibility while trying, not fear of starting.',
        personality: 'Active, consistent, showing up every day. Not blocked by fear — she is posting, creating, putting herself out there. The wound is visibility.',
        status: 'accepted',
        sort_order: 0,
      },
      {
        character_key: 'the-husband',
        icon: '⚖',
        display_name: 'The Husband',
        selected_name: 'The Husband',
        role_type: 'pressure',
        role_label: 'Stabilizer / Quiet Mirror',
        appearance_mode: 'on_page',
        core_belief: 'Is wanting more a betrayal of what I already have?',
        description: 'Practical love that lands like doubt. He means protect. She hears: quit. Supportive and caring — not the obstacle. His concern comes from love.',
        personality: 'Calm, protective, grounded. Not the villain. Says "you already have everything" meaning safety, not ceiling.',
        status: 'draft',
        sort_order: 1,
      },
      {
        character_key: 'comparison-creator',
        icon: '◈',
        display_name: 'The Comparison Creator',
        selected_name: 'Chloe',
        role_type: 'mirror',
        role_label: 'Haunting Mirror / Alt. Timeline',
        appearance_mode: 'composite',
        core_belief: 'Was my hesitation self-protection or self-sabotage?',
        description: 'Genuine motivation — not a villain. Likable, successful, supportive. The comparison is JustAWoman\'s. Chloe never asked for it.',
        personality: 'Genuinely successful, genuinely likable, genuinely supportive. She is not doing anything wrong. She is just thriving.',
        status: 'draft',
        sort_order: 2,
      },
      {
        character_key: 'the-witness',
        icon: '👁',
        display_name: 'The Witness',
        selected_name: 'The Witness',
        role_type: 'support',
        role_label: 'Continuity / Pattern Holder',
        appearance_mode: 'brief',
        core_belief: 'Is this pattern a character flaw or creative searching?',
        description: 'Holds JustAWoman accountable to her own patterns without judgment. Reflects back what she cannot see about herself.',
        personality: 'Patient, observant, non-judgmental. Sees patterns others miss.',
        status: 'draft',
        sort_order: 3,
      },
      {
        character_key: 'the-almost-mentor',
        icon: '🎭',
        display_name: 'The Almost-Mentor',
        selected_name: 'The Almost-Mentor',
        role_type: 'shadow',
        role_label: 'Momentary Catalyst / False Rescue',
        appearance_mode: 'composite',
        core_belief: 'Do I need someone to believe in me before I believe in myself?',
        description: 'Appears when JustAWoman is most desperate for external validation. Offers just enough to create hope, then disappears.',
        personality: 'Charismatic, promising, ultimately absent. Creates dependency then withdraws.',
        status: 'draft',
        sort_order: 4,
      },
      {
        character_key: 'the-digital-products-customer',
        icon: '☕',
        display_name: 'The Digital Products Customer',
        selected_name: 'The Digital Products Customer',
        role_type: 'support',
        role_label: 'Quiet Witness to Her Worth',
        appearance_mode: 'composite',
        core_belief: 'Do I actually have something unique to offer?',
        description: 'The person who buys what JustAWoman makes. Evidence that her work lands. She never sees them clearly but they are always there.',
        personality: 'Quiet, appreciative, unseen but present. Proof that the work matters.',
        status: 'draft',
        sort_order: 5,
      },
      {
        character_key: 'lala',
        icon: '✦',
        display_name: 'Lala',
        selected_name: 'Lala',
        role_type: 'special',
        role_label: 'Creative Self / World Container',
        appearance_mode: 'on_page',
        core_belief: 'What happens when the world I built becomes its own kind of control?',
        description: 'Being built by JustAWoman. One intrusive thought in Book 1. Proto-voice — styled, confident, brief. Arrives as tonal rupture, not a character entering.',
        personality: 'Styled, confident, brief. A voice that interrupts — not a person who arrives.',
        status: 'draft',
        sort_order: 6,
      },
    ];

    const created = [];
    for (const c of seedCharacters) {
      const [record, wasCreated] = await RegistryCharacter.findOrCreate({
        where: { registry_id: registry.id, character_key: c.character_key },
        defaults: { ...c, registry_id: registry.id },
      });
      created.push(record);
    }

    // Reload registry
    const full = await CharacterRegistry.findByPk(registry.id, {
      include: [{ model: RegistryCharacter, as: 'characters' }],
    });

    return res.json({ success: true, registry: full, seeded: created.length });
  } catch (err) {
    console.error('[CharacterRegistry] seed-book1 error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/:charId/promote-to-canon
 * Manually promotes a character to LalaVerse universe level.
 * Creates a universe_characters record linking them to the universe.
 *
 * Body: { universe_id: string }
 */
router.post('/characters/:charId/promote-to-canon', async (req, res) => {
  try {
    const { charId } = req.params;
    const { universe_id } = req.body;
    const db = getModels();

    if (!universe_id) {
      return res.status(400).json({ error: 'universe_id is required' });
    }

    const character = await db.RegistryCharacter.findByPk(charId);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // Determine canon tier from role_type
    const canonTier = ['special'].includes(character.role_type)
      ? 'core_canon'
      : ['pressure', 'mirror'].includes(character.role_type)
      ? 'supporting_canon'
      : 'minor_canon';

    // Check if already promoted
    const existing = await db.UniverseCharacter?.findOne({
      where: { registry_character_id: charId, universe_id },
    });

    if (existing) {
      return res.json({ promoted: true, universe_character_id: existing.id, already_existed: true });
    }

    // Create universe character record
    const universeChar = await db.UniverseCharacter.create({
      universe_id,
      registry_character_id: charId,
      name:           character.selected_name || character.display_name,
      type:           character.role_type,
      canon_tier:     canonTier,
      role:           character.description,
      first_appeared: new Date(),
      status:         'active',
    });

    res.json({ promoted: true, universe_character_id: universeChar.id });
  } catch (err) {
    console.error('POST /promote-to-canon error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  PORTRAIT UPLOAD                                                    */
/* ================================================================== */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const portraitStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/portraits');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `portrait-${req.params.id}-${Date.now()}${ext}`);
  },
});

const portraitUpload = multer({
  storage: portraitStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * POST /characters/:id/portrait
 * Upload a portrait image for a character
 */
router.post('/characters/:id/portrait', portraitUpload.single('portrait'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });

    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const portrait_url = `/uploads/portraits/${req.file.filename}`;
    character.portrait_url = portrait_url;
    await character.save();

    return res.json({ success: true, portrait_url });
  } catch (err) {
    console.error('[CharacterRegistry] POST portrait error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /characters/:id/portrait
 * Remove portrait image
 */
router.delete('/characters/:id/portrait', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    // Delete file from disk if it exists
    if (character.portrait_url) {
      const filePath = path.join(__dirname, '../..', character.portrait_url);
      try { fs.unlinkSync(filePath); } catch {}
    }

    character.portrait_url = null;
    await character.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('[CharacterRegistry] DELETE portrait error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
