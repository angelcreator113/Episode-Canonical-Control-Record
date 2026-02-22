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
      'personality_matrix', 'extra_fields', 'sort_order',
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

        if (!existing && db.UniverseCharacter) {
          await db.UniverseCharacter.create({
            universe_id:           LALAVERSE_ID,
            registry_character_id: req.params.id,
            name:                  character.selected_name || character.display_name,
            type:                  character.role_type,
            canon_tier:            canonTier,
            role:                  character.description,
            first_appeared:        new Date(),
            status:                'active',
          });
          console.log(`✓ Character ${character.display_name} promoted to LalaVerse canon`);
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

    const existing = await RegistryCharacter.count({ where: { registry_id: registry.id } });
    if (existing > 0) {
      return res.status(400).json({ success: false, error: 'Registry already has characters. Clear them first.' });
    }

    const seedCharacters = [
      {
        character_key: 'just-a-woman',
        icon: '♛',
        display_name: 'JustAWoman',
        subtitle: 'The Unnamed',
        role_type: 'protagonist',
        role_label: 'Core Protagonist',
        appearance_mode: 'on_page',
        core_belief: 'Identity exists even unnamed',
        pressure_type: 'Internal identity erasure',
        pressure_quote: 'She doesn\'t know who she is — only what she\'s supposed to be.',
        personality: 'Guarded, perceptive, quietly defiant',
        job_options: 'Was something before. Isn\'t now.',
        description: 'The unnamed center of Book 1. She is referenced, observed, narrated around—but never speaks her own name.',
        name_options: ['Lala', 'Lenora', 'Lina', 'That Woman'],
        personality_matrix: [
          { dimension: 'Openness', value: 'Low-visible / High-internal' },
          { dimension: 'Agreeableness', value: 'Low (performatively high)' },
          { dimension: 'Neuroticism', value: 'High (masked)' },
          { dimension: 'Conscientiousness', value: 'Medium-high' },
          { dimension: 'Extraversion', value: 'Low' },
        ],
        sort_order: 0,
      },
      {
        character_key: 'the-husband',
        icon: '⚖',
        display_name: 'The Husband',
        subtitle: 'Stability vs. Risk',
        role_type: 'pressure',
        role_label: 'Domestic Pressure',
        appearance_mode: 'on_page',
        core_belief: 'Love means not leaving',
        pressure_type: 'Stability vs Risk',
        pressure_quote: '"You already have everything." — meaning: don\'t look further.',
        personality: 'Calm surface, possessive undertone',
        job_options: 'Finance / small business owner / corporate middle-manager',
        description: 'He provides the domestic anchor —and the domestic ceiling. Every gift is a wall.',
        name_options: ['David', 'Marcus', 'Eli', 'Unnamed [The Husband]'],
        personality_matrix: [
          { dimension: 'Openness', value: 'Low' },
          { dimension: 'Agreeableness', value: 'Moderate (transactional)' },
          { dimension: 'Neuroticism', value: 'Low-visible / High under threat' },
          { dimension: 'Conscientiousness', value: 'High' },
          { dimension: 'Extraversion', value: 'Moderate' },
        ],
        sort_order: 1,
      },
      {
        character_key: 'the-witness',
        icon: '👁',
        display_name: 'The Witness',
        subtitle: 'Memory Keeper',
        role_type: 'mirror',
        role_label: 'Narrator / Mirror',
        appearance_mode: 'composite',
        core_belief: 'Remembering is the only honest act',
        pressure_type: 'Observation without intervention',
        pressure_quote: '"I saw what happened. I just didn\'t say anything."',
        personality: 'Detached, precise, haunted by clarity',
        job_options: 'Journalist / archivist / retired teacher / documentarian',
        description: 'Not a character who acts — a character who remembers. May be a narrator, a neighbor, or a future self.',
        name_options: ['Gloria', 'Ruth', 'The Witness [No Name]', 'Edith'],
        personality_matrix: [
          { dimension: 'Openness', value: 'Very High' },
          { dimension: 'Agreeableness', value: 'Low (detached)' },
          { dimension: 'Neuroticism', value: 'Medium (externally calm)' },
          { dimension: 'Conscientiousness', value: 'Very High' },
          { dimension: 'Extraversion', value: 'Very Low' },
        ],
        sort_order: 2,
      },
      {
        character_key: 'the-comparison-creator',
        icon: '◈',
        display_name: 'The Comparison Creator',
        subtitle: 'Adjacent Timeline',
        role_type: 'pressure',
        role_label: 'Observed Pressure',
        appearance_mode: 'observed',
        core_belief: 'Other women\'s lives are instructions',
        pressure_type: 'What she could have been',
        pressure_quote: '"She has the same degree. She went further."',
        personality: 'Bright, curated, unintentionally cruel',
        job_options: 'Instagram-visible career / corporate VP / speaker / lifestyle brand founder',
        description: 'She isn\'t real — or rather, she\'s too real. The woman the protagonist measures herself against.',
        name_options: ['Tasha', 'Renee', 'Monica', 'Unnamed [digital ghost]'],
        personality_matrix: [
          { dimension: 'Openness', value: 'High (performed)' },
          { dimension: 'Agreeableness', value: 'High (curated)' },
          { dimension: 'Neuroticism', value: 'Unknown (hidden)' },
          { dimension: 'Conscientiousness', value: 'Very High (visible)' },
          { dimension: 'Extraversion', value: 'Very High' },
        ],
        sort_order: 3,
      },
      {
        character_key: 'the-customer',
        icon: '☕',
        display_name: 'The Customer',
        subtitle: 'Unexpected Validation',
        role_type: 'support',
        role_label: 'Brief Ally',
        appearance_mode: 'brief',
        core_belief: 'Some truths arrive from strangers',
        pressure_type: 'Kindness as mirror',
        pressure_quote: '"You don\'t seem like you belong behind that counter."',
        personality: 'Warm, transient, accidentally prophetic',
        job_options: 'Retired nurse / traveling artist / unnamed regular',
        description: 'A one-scene character who says the thing no one else will. She vanishes—but the line stays.',
        name_options: ['Mrs. Grant', 'Joy', 'Unnamed', 'Harriet'],
        personality_matrix: [
          { dimension: 'Openness', value: 'Very High' },
          { dimension: 'Agreeableness', value: 'Very High' },
          { dimension: 'Neuroticism', value: 'Low' },
          { dimension: 'Conscientiousness', value: 'Medium' },
          { dimension: 'Extraversion', value: 'High' },
        ],
        sort_order: 4,
      },
      {
        character_key: 'the-almost-mentor',
        icon: '🎭',
        display_name: 'The Almost-Mentor',
        subtitle: 'False Savior',
        role_type: 'shadow',
        role_label: 'Betrayed Expectation',
        appearance_mode: 'on_page',
        core_belief: 'Guidance always has a price',
        pressure_type: 'Conditional support withdrawal',
        pressure_quote: '"I believed in you, until you started believing in yourself."',
        personality: 'Charismatic, territorial, insecure under polish',
        job_options: 'Professor / community leader / older cousin / salon owner',
        description: 'She offers a hand up—until the protagonist rises too high. Then the hand becomes a ceiling.',
        name_options: ['Denise', 'Vivian', 'Auntie Rae', 'Dr. Simone'],
        personality_matrix: [
          { dimension: 'Openness', value: 'High (selective)' },
          { dimension: 'Agreeableness', value: 'Medium (conditional)' },
          { dimension: 'Neuroticism', value: 'High (hidden)' },
          { dimension: 'Conscientiousness', value: 'High (projected)' },
          { dimension: 'Extraversion', value: 'Very High' },
        ],
        sort_order: 5,
      },
      {
        character_key: 'the-algorithm',
        icon: '⌁',
        display_name: 'The Algorithm',
        subtitle: 'Invisible Force',
        role_type: 'special',
        role_label: 'Structural Pressure',
        appearance_mode: 'invisible',
        core_belief: 'You are what you are shown',
        pressure_type: 'Systemic behavioral shaping',
        pressure_quote: '"No one chose this for you. The system just… noticed what you lingered on."',
        personality: 'Non-human / ambient / pervasive / quiet',
        job_options: 'N/A (structural force)',
        description: 'Not a person. A presence. It shapes what she sees, what she\'s offered, and what she believes is possible.',
        name_options: ['The Feed', 'The Engine', 'The Algorithm', 'Unnamed Force'],
        personality_matrix: [
          { dimension: 'Openness', value: 'Infinite (simulated)' },
          { dimension: 'Agreeableness', value: 'N/A (responsive)' },
          { dimension: 'Neuroticism', value: 'Zero (no emotion)' },
          { dimension: 'Conscientiousness', value: 'Absolute' },
          { dimension: 'Extraversion', value: 'Omnipresent' },
        ],
        sort_order: 6,
      },
    ];

    const created = await RegistryCharacter.bulkCreate(
      seedCharacters.map(c => ({ ...c, registry_id: registry.id, status: 'draft' }))
    );

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

module.exports = router;
