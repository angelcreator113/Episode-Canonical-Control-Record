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
 * GET /characters/scene-context/:characterKey
 * Returns living_context + relationship edges for scene brief auto-populate.
 * Query params: ?registry_id=UUID (required)
 */
router.get('/characters/scene-context/:characterKey', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const db = require('../models');
    const { characterKey } = req.params;
    const { registry_id } = req.query;

    if (!registry_id) return res.status(400).json({ success: false, error: 'registry_id query param required' });

    // Find the character by key + registry
    const character = await RegistryCharacter.findOne({
      where: { character_key: characterKey, registry_id },
      attributes: ['id', 'character_key', 'display_name', 'living_context', 'career_status', 'hidden_want', 'core_wound', 'core_desire', 'core_belief', 'core_fear'],
    });
    if (!character) return res.status(404).json({ success: false, error: 'Character not found in registry' });

    // Fetch relationship edges involving this character
    const edges = await db.sequelize.query(
      `SELECT cr.id, cr.relationship_type, cr.role_tag, cr.status,
              cr.family_role, cr.is_blood_relation, cr.is_romantic,
              cr.situation, cr.tension_state, cr.conflict_summary,              cr.source_knows, cr.target_knows, cr.reader_knows,              cr.character_id_a, cr.character_id_b,
              ca.display_name AS char_a_name, ca.character_key AS char_a_key,
              cb.display_name AS char_b_name, cb.character_key AS char_b_key
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
       WHERE cr.confirmed = true
         AND (cr.character_id_a = :charId OR cr.character_id_b = :charId)
       ORDER BY cr.role_tag ASC NULLS LAST, cr.relationship_type ASC`,
      { replacements: { charId: character.id }, type: db.sequelize.QueryTypes.SELECT }
    );

    // Build readable relationship summaries relative to the queried character
    const relationships = edges.map(e => {
      const isA = e.character_id_a === character.id;
      const otherName = isA ? e.char_b_name : e.char_a_name;
      const otherKey = isA ? e.char_b_key : e.char_a_key;
      return {
        person: otherName,
        character_key: otherKey,
        type: e.relationship_type,
        role_tag: e.role_tag || null,
        family_role: e.family_role || null,
        status: e.status,
        situation: e.situation || null,
        tension: e.tension_state || null,
        conflict: e.conflict_summary || null,
        source_knows: isA ? e.source_knows : e.target_knows,
        target_knows: isA ? e.target_knows : e.source_knows,
        reader_knows: e.reader_knows || null,
      };
    });

    return res.json({
      success: true,
      character_key: characterKey,
      display_name: character.display_name,
      hidden_want: character.hidden_want || null,
      core_wound: character.core_wound || null,
      core_desire: character.core_desire || null,
      core_belief: character.core_belief || null,
      core_fear: character.core_fear || null,
      living_context: character.living_context || {},
      financial_status: character.career_status?.financial_status || null,
      relationships,
    });
  } catch (err) {
    console.error('[CharacterRegistry] GET /characters/scene-context/:characterKey error:', err);
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
 * GET /characters/:id/plot-threads
 * Returns plot threads stored in extra_fields.plot_threads
 */
router.get('/characters/:id/plot-threads', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const threads = (character.extra_fields?.plot_threads) || [];
    return res.json({ success: true, threads });
  } catch (err) {
    console.error('[CharacterRegistry] GET plot-threads error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/:id/plot-threads
 * Add a new plot thread
 */
router.post('/characters/:id/plot-threads', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const { title, description, status, source } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    const threads = (character.extra_fields?.plot_threads) || [];
    const newThread = {
      id: `pt-${Date.now()}`,
      title,
      description: description || '',
      status: status || 'open',
      source: source || '',
      created_at: new Date().toISOString(),
    };
    threads.push(newThread);

    character.extra_fields = { ...(character.extra_fields || {}), plot_threads: threads };
    character.changed('extra_fields', true);
    await character.save();

    return res.json({ success: true, thread: newThread, threads });
  } catch (err) {
    console.error('[CharacterRegistry] POST plot-threads error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /characters/:id/plot-threads/:threadId
 * Update a plot thread
 */
router.put('/characters/:id/plot-threads/:threadId', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const threads = (character.extra_fields?.plot_threads) || [];
    const idx = threads.findIndex(t => t.id === req.params.threadId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Thread not found' });

    const { title, description, status, source } = req.body;
    if (title !== undefined) threads[idx].title = title;
    if (description !== undefined) threads[idx].description = description;
    if (status !== undefined) threads[idx].status = status;
    if (source !== undefined) threads[idx].source = source;
    threads[idx].updated_at = new Date().toISOString();

    character.extra_fields = { ...(character.extra_fields || {}), plot_threads: threads };
    character.changed('extra_fields', true);
    await character.save();

    return res.json({ success: true, thread: threads[idx], threads });
  } catch (err) {
    console.error('[CharacterRegistry] PUT plot-threads error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /characters/:id/plot-threads/:threadId
 * Delete a plot thread
 */
router.delete('/characters/:id/plot-threads/:threadId', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const character = await RegistryCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });

    const threads = (character.extra_fields?.plot_threads) || [];
    const filtered = threads.filter(t => t.id !== req.params.threadId);

    character.extra_fields = { ...(character.extra_fields || {}), plot_threads: filtered };
    character.changed('extra_fields', true);
    await character.save();

    return res.json({ success: true, threads: filtered });
  } catch (err) {
    console.error('[CharacterRegistry] DELETE plot-threads error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /characters/:id
 * Update any character fields
 */
router.put('/characters/:id', express.json(), async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body is required' });
    }
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
      // Section 9: Registry Sync fields
      'wound_depth', 'belief_pressured', 'emotional_function', 'writer_notes',
      // Section 9-13: Character Depth Engine
      'body_relationship', 'body_history', 'body_currency', 'body_control_pattern',
      'money_behavior_pattern', 'money_behavior_note',
      'time_orientation_v2', 'time_orientation_note',
      'change_capacity_v2', 'change_conditions', 'change_blocker',
      'circumstance_advantages', 'circumstance_disadvantages', 'luck_belief', 'luck_belief_vs_stated',
      'self_narrative', 'actual_narrative', 'narrative_gap_type',
      'blind_spot', 'blind_spot_category', 'blind_spot_visible_to',
      'operative_cosmology_v2', 'cosmology_vs_stated_religion',
      'foreclosed_category', 'foreclosure_origin', 'foreclosure_vs_stated_want',
      'joy_source', 'joy_accessibility', 'joy_vs_ambition',
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
 * POST /characters/bulk-delete
 * Bulk soft-delete multiple characters by id array
 */
router.post('/characters/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    }
    const { RegistryCharacter } = getModels();
    const { Op } = require('sequelize');
    const deleted = await RegistryCharacter.destroy({ where: { id: { [Op.in]: ids } } });
    return res.json({ success: true, deleted, message: `${deleted} character(s) deleted` });
  } catch (err) {
    console.error('[CharacterRegistry] POST /characters/bulk-delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/bulk-status
 * Bulk update status for multiple characters
 */
router.post('/characters/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    }
    const validStatuses = ['draft', 'accepted', 'finalized', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${validStatuses.join(', ')}` });
    }
    const { RegistryCharacter } = getModels();
    const [updated] = await RegistryCharacter.update({ status }, { where: { id: { [Op.in]: ids } } });
    return res.json({ success: true, updated, message: `${updated} character(s) updated to ${status}` });
  } catch (err) {
    console.error('[CharacterRegistry] POST /characters/bulk-status error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/bulk-move
 * Move multiple characters to a different registry
 */
router.post('/characters/bulk-move', async (req, res) => {
  try {
    const { ids, registryId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    }
    if (!registryId) {
      return res.status(400).json({ success: false, error: 'registryId is required' });
    }
    const { RegistryCharacter, CharacterRegistry } = getModels();
    const registry = await CharacterRegistry.findByPk(registryId);
    if (!registry) return res.status(404).json({ success: false, error: 'Target registry not found' });
    const [moved] = await RegistryCharacter.update({ registry_id: registryId }, { where: { id: { [Op.in]: ids } } });
    return res.json({ success: true, moved, message: `${moved} character(s) moved to ${registry.title}` });
  } catch (err) {
    console.error('[CharacterRegistry] POST /characters/bulk-move error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /characters/:id/clone
 * Duplicate a character with all profile data
 */
router.post('/characters/:id/clone', async (req, res) => {
  try {
    const { RegistryCharacter } = getModels();
    const original = await RegistryCharacter.findByPk(req.params.id);
    if (!original) return res.status(404).json({ success: false, error: 'Character not found' });

    const data = original.toJSON();
    // Remove unique fields
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    delete data.deleted_at;
    // Mark as draft copy
    data.display_name = `${data.display_name} (Copy)`;
    data.character_key = `${data.character_key}-copy-${Date.now()}`;
    data.status = 'draft';
    data.selected_name = null;
    data.sort_order = (data.sort_order || 0) + 1;

    const clone = await RegistryCharacter.create(data);
    return res.json({ success: true, character: clone, message: 'Character cloned' });
  } catch (err) {
    console.error('[CharacterRegistry] POST /characters/:id/clone error:', err);
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

    // NOTE: Finalization ONLY locks the record (HTTP 403 on future edits).
    // Promotion to LalaVerse canon is a separate, deliberate author action
    // via POST /characters/:charId/promote-to-canon.
    // Interior Monologue characters do not auto-promote. The author gate is intentional.

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

/**
 * POST /characters/:id/backfill-sections
 * Infer and populate empty JSONB sections (career, aesthetic, voice, story,
 * evolution, living_context) from whatever data already exists on the character.
 */
router.post('/characters/:id/backfill-sections', async (req, res) => {
  const { id } = req.params;
  const db = getModels();
  try {
    const character = await db.RegistryCharacter.findByPk(id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // Determine which JSONB sections are empty
    const hasData = (val) => val && typeof val === 'object' && Object.values(val).some(v => v && v !== '');
    const emptySections = [];
    if (!hasData(character.career_status))       emptySections.push('career_status');
    if (!hasData(character.aesthetic_dna))        emptySections.push('aesthetic_dna');
    if (!hasData(character.voice_signature))      emptySections.push('voice_signature');
    if (!hasData(character.story_presence))       emptySections.push('story_presence');
    if (!hasData(character.evolution_tracking))   emptySections.push('evolution_tracking');
    if (!hasData(character.living_context))       emptySections.push('living_context');

    if (emptySections.length === 0) {
      return res.json({ success: true, message: 'All sections already populated', filled: [] });
    }

    // Gather everything we know
    const known = {};
    const fields = [
      'display_name','selected_name','subtitle','role_type','role_label',
      'description','core_belief','core_wound','core_desire','core_fear',
      'hidden_want','mask_persona','truth_persona','personality',
      'signature_trait','emotional_baseline','pressure_type','pressure_quote',
      'character_archetype','writer_notes','ethnicity','gender',
    ];
    for (const f of fields) {
      if (character[f]) known[f] = character[f];
    }
    // Include populated JSONB sections as context
    if (hasData(character.career_status))     known.career_status = character.career_status;
    if (hasData(character.aesthetic_dna))      known.aesthetic_dna = character.aesthetic_dna;
    if (hasData(character.voice_signature))    known.voice_signature = character.voice_signature;
    if (hasData(character.deep_profile))       known.deep_profile_summary = character.deep_profile;
    if (hasData(character.relationships_map))  known.relationships_map = character.relationships_map;

    const sectionSchemas = {
      career_status: `{ "profession": "their job title", "career_goal": "what success means to them", "reputation_level": "how the world sees their career", "brand_relationships": "professional tasks, affiliations", "financial_status": "their industry/financial reality", "public_recognition": "who or what opposes them professionally", "ongoing_arc": "their career wound or ongoing professional tension" }`,
      aesthetic_dna: `{ "era_aesthetic": "how they dress — style era/vibe", "color_palette": "their visual color world", "signature_silhouette": "how they look — specific physical details", "signature_accessories": "the object always near them", "glam_energy": "how a room changes when they enter", "visual_evolution_notes": "how their look has changed over time" }`,
      voice_signature: `{ "speech_pattern": "how they speak — rhythm, vocabulary, register", "vocabulary_tone": "a sentence that could only be theirs", "catchphrases": "their tell — what they do when lying or hiding", "internal_monologue_style": "what they never say directly — always approaches sideways", "emotional_reactivity": "what silence means for them" }`,
      story_presence: `{ "appears_in_books": "which books/worlds", "appears_in_shows": "which shows", "appears_in_series": "which series", "current_story_status": "what triggers their entrance into a story", "unresolved_threads": "story types they're suited for", "future_potential": "Yes or No — can they introduce new characters" }`,
      evolution_tracking: `{ "version_history": "what just happened — recent event that changed something", "era_changes": "where they are in their arc right now", "personality_shifts": "what they are avoiding — the thing they know they need to face" }`,
      living_context: `{ "active_pressures": "what is pressing on them right now", "support_network": "who holds them up and what it costs", "home_environment": "what daily domestic life looks like", "relationship_to_deadlines": "how they relate to time pressure", "financial_reality": "actual financial situation — specific", "current_season": "the emotional season they are in" }`,
    };

    const sectionsToFill = emptySections.map(s => `"${s}": ${sectionSchemas[s]}`).join(',\n');

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are filling in missing profile sections for an existing character in the LalaVerse franchise.

Here is everything currently known about this character:
${JSON.stringify(known, null, 2)}

Generate ONLY the following empty sections. Infer from existing data. Be specific to THIS character — no generic filler. Use null for fields you truly cannot infer.

Return ONLY valid JSON with these keys:
{
${sectionsToFill}
}`,
      messages: [{ role: 'user', content: `Fill in the missing sections for ${known.display_name || 'this character'}.` }],
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse Claude response' });
    const generated = JSON.parse(jsonMatch[0]);

    // Apply each generated section
    const filled = [];
    for (const section of emptySections) {
      if (generated[section] && typeof generated[section] === 'object') {
        // Clean nulls
        const clean = {};
        for (const [k, v] of Object.entries(generated[section])) {
          clean[k] = (v === null || v === undefined) ? '' : v;
        }
        character[section] = clean;
        filled.push(section);
      }
    }

    await character.save();

    // Also normalize relationships_map if it's in array format
    if (Array.isArray(character.relationships_map)) {
      const rm = character.relationships_map;
      const flat = { allies: '', rivals: '', mentors: '', love_interests: '', business_partners: '', dynamic_notes: '' };
      const typeMap = { support: 'allies', familial: 'allies', pressure: 'rivals', shadow: 'rivals', mirror: 'mentors', romantic: 'love_interests', transactional: 'business_partners', creation: 'allies' };
      const notes = [];
      rm.forEach(r => {
        const cat = typeMap[r.type] || 'allies';
        const label = r.target || 'Unknown';
        const detail = r.feels ? `${label} (${r.feels})` : label;
        flat[cat] = flat[cat] ? `${flat[cat]}, ${detail}` : detail;
        if (r.note) notes.push(`${label}: ${r.note}`);
      });
      if (notes.length) flat.dynamic_notes = notes.join('. ');
      character.relationships_map = flat;
      await character.save();
      filled.push('relationships_map_normalized');
    }

    // Also backfill plot_threads into extra_fields if empty
    const ef = character.extra_fields || {};
    if (!ef.plot_threads || !ef.plot_threads.length) {
      try {
        const threadResp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `Generate 2-4 plot threads for this character based on their profile. Each thread should be a specific unresolved situation.\n\nCharacter: ${JSON.stringify(known, null, 2)}\n\nReturn ONLY valid JSON array:\n[\n  { "thread": "specific unresolved situation", "status": "open", "activation_condition": "what would bring this thread into a story" }\n]`,
          messages: [{ role: 'user', content: `Generate plot threads for ${known.display_name || 'this character'}.` }],
        });
        const ptRaw = threadResp.content[0].text;
        const ptMatch = ptRaw.match(/\[[\s\S]*\]/);
        if (ptMatch) {
          const ptArr = JSON.parse(ptMatch[0]);
          const plotThreads = ptArr.map((t, i) => ({
            id: `pt-${Date.now()}-${i}`,
            title: t.thread || t.title || '',
            description: t.activation_condition || t.description || '',
            status: t.status || 'open',
            source: 'auto-generated',
          }));
          character.extra_fields = { ...ef, plot_threads: plotThreads };
          await character.save();
          filled.push('plot_threads');
        }
      } catch (ptErr) {
        console.error('[Backfill] Plot threads generation failed:', ptErr.message);
      }
    }

    return res.json({
      success: true,
      character_id: id,
      character_name: character.display_name,
      filled,
      total_empty: emptySections.length,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /backfill-sections error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /registries/:registryId/backfill-all
 * Bulk backfill: iterate every character in a registry and fill empty JSONB sections.
 */
router.post('/registries/:registryId/backfill-all', async (req, res) => {
  const { registryId } = req.params;
  const db = getModels();
  try {
    const registry = await db.CharacterRegistry.findByPk(registryId, {
      include: [{ model: db.RegistryCharacter, as: 'characters' }],
    });
    if (!registry) return res.status(404).json({ error: 'Registry not found' });

    const chars = registry.characters || [];
    if (chars.length === 0) return res.json({ success: true, results: [], message: 'No characters in registry' });

    const hasData = (val) => val && typeof val === 'object' && Object.values(val).some(v => v && v !== '');
    const fields = [
      'display_name','selected_name','subtitle','role_type','role_label',
      'description','core_belief','core_wound','core_desire','core_fear',
      'hidden_want','mask_persona','truth_persona','personality',
      'signature_trait','emotional_baseline','pressure_type','pressure_quote',
      'character_archetype','writer_notes','ethnicity','gender',
    ];
    const sectionSchemas = {
      career_status: `{ "profession": "their job title", "career_goal": "what success means to them", "reputation_level": "how the world sees their career", "brand_relationships": "professional affiliations", "financial_status": "their financial reality", "public_recognition": "public perception", "ongoing_arc": "their career tension" }`,
      aesthetic_dna: `{ "era_aesthetic": "how they dress", "color_palette": "their visual color world", "signature_silhouette": "physical details", "signature_accessories": "the object always near them", "glam_energy": "how a room changes when they enter", "visual_evolution_notes": "how their look has changed" }`,
      voice_signature: `{ "speech_pattern": "how they speak", "vocabulary_tone": "a sentence that could only be theirs", "catchphrases": "their tell when lying or hiding", "internal_monologue_style": "what they never say directly", "emotional_reactivity": "what silence means for them" }`,
      story_presence: `{ "appears_in_books": "which books/worlds", "appears_in_shows": "which shows", "appears_in_series": "which series", "current_story_status": "story entrance trigger", "unresolved_threads": "story types they suit", "future_potential": "can they introduce new characters" }`,
      evolution_tracking: `{ "version_history": "recent event that changed something", "era_changes": "where they are in their arc", "personality_shifts": "what they are avoiding" }`,
      living_context: `{ "active_pressures": "what presses on them now", "support_network": "who holds them up", "home_environment": "daily domestic life", "relationship_to_deadlines": "how they relate to time pressure", "financial_reality": "actual financial situation", "current_season": "emotional season" }`,
    };

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const results = [];

    for (const character of chars) {
      const emptySections = [];
      if (!hasData(character.career_status))       emptySections.push('career_status');
      if (!hasData(character.aesthetic_dna))        emptySections.push('aesthetic_dna');
      if (!hasData(character.voice_signature))      emptySections.push('voice_signature');
      if (!hasData(character.story_presence))       emptySections.push('story_presence');
      if (!hasData(character.evolution_tracking))   emptySections.push('evolution_tracking');
      if (!hasData(character.living_context))       emptySections.push('living_context');

      if (emptySections.length === 0) {
        results.push({ id: character.id, name: character.display_name, filled: [], skipped: true });
        continue;
      }

      const known = {};
      for (const f of fields) {
        if (character[f]) known[f] = character[f];
      }
      if (hasData(character.career_status))     known.career_status = character.career_status;
      if (hasData(character.aesthetic_dna))      known.aesthetic_dna = character.aesthetic_dna;
      if (hasData(character.voice_signature))    known.voice_signature = character.voice_signature;
      if (hasData(character.deep_profile))       known.deep_profile_summary = character.deep_profile;

      const sectionsToFill = emptySections.map(s => `"${s}": ${sectionSchemas[s]}`).join(',\n');

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `You are filling in missing profile sections for an existing character in the LalaVerse franchise.\n\nHere is everything currently known about this character:\n${JSON.stringify(known, null, 2)}\n\nGenerate ONLY the following empty sections. Infer from existing data. Be specific to THIS character — no generic filler. Use null for fields you truly cannot infer.\n\nReturn ONLY valid JSON with these keys:\n{\n${sectionsToFill}\n}`,
          messages: [{ role: 'user', content: `Fill in the missing sections for ${known.display_name || 'this character'}.` }],
        });

        const raw = response.content[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ id: character.id, name: character.display_name, filled: [], error: 'Parse error' });
          continue;
        }
        const generated = JSON.parse(jsonMatch[0]);

        const filled = [];
        const updateData = {};
        for (const section of emptySections) {
          if (generated[section] && typeof generated[section] === 'object') {
            const clean = {};
            for (const [k, v] of Object.entries(generated[section])) {
              clean[k] = (v === null || v === undefined) ? '' : v;
            }
            updateData[section] = clean;
            filled.push(section);
          }
        }
        if (filled.length > 0) {
          await db.RegistryCharacter.update(updateData, { where: { id: character.id } });
        }

        // Normalize array-format relationships_map
        if (Array.isArray(character.relationships_map)) {
          const rm = character.relationships_map;
          const flat = { allies: '', rivals: '', mentors: '', love_interests: '', business_partners: '', dynamic_notes: '' };
          const typeMap = { support: 'allies', familial: 'allies', pressure: 'rivals', shadow: 'rivals', mirror: 'mentors', romantic: 'love_interests', transactional: 'business_partners', creation: 'allies' };
          const notes = [];
          rm.forEach(r => {
            const cat = typeMap[r.type] || 'allies';
            const label = r.target || 'Unknown';
            const detail = r.feels ? `${label} (${r.feels})` : label;
            flat[cat] = flat[cat] ? `${flat[cat]}, ${detail}` : detail;
            if (r.note) notes.push(`${label}: ${r.note}`);
          });
          if (notes.length) flat.dynamic_notes = notes.join('. ');
          await db.RegistryCharacter.update({ relationships_map: flat }, { where: { id: character.id } });
          filled.push('relationships_map_normalized');
        }

        // Backfill plot_threads
        const ef = character.extra_fields || {};
        if (!ef.plot_threads || !ef.plot_threads.length) {
          try {
            const threadResp = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1500,
              system: `Generate 2-4 plot threads for this character based on their profile. Each thread should be a specific unresolved situation.\n\nCharacter: ${JSON.stringify(known, null, 2)}\n\nReturn ONLY valid JSON array:\n[\n  { "thread": "specific unresolved situation", "status": "open", "activation_condition": "what would bring this thread into a story" }\n]`,
              messages: [{ role: 'user', content: `Generate plot threads for ${known.display_name || 'this character'}.` }],
            });
            const ptRaw = threadResp.content[0].text;
            const ptMatch = ptRaw.match(/\[[\s\S]*\]/);
            if (ptMatch) {
              const ptArr = JSON.parse(ptMatch[0]);
              const plotThreads = ptArr.map((t, i) => ({
                id: `pt-${Date.now()}-${i}`,
                title: t.thread || t.title || '',
                description: t.activation_condition || t.description || '',
                status: t.status || 'open',
                source: 'auto-generated',
              }));
              await db.RegistryCharacter.update(
                { extra_fields: { ...ef, plot_threads: plotThreads } },
                { where: { id: character.id } }
              );
              filled.push('plot_threads');
            }
          } catch (ptErr) {
            console.error(`[Backfill-all] Plot threads failed for ${character.display_name}:`, ptErr.message);
          }
        }

        results.push({ id: character.id, name: character.display_name, filled });
      } catch (aiErr) {
        console.error(`[Backfill-all] Error for ${character.display_name}:`, aiErr.message);
        results.push({ id: character.id, name: character.display_name, filled: [], error: aiErr.message });
      }
    }

    const totalFilled = results.reduce((sum, r) => sum + r.filled.length, 0);
    return res.json({
      success: true,
      registry_id: registryId,
      total_characters: chars.length,
      total_sections_filled: totalFilled,
      results,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /backfill-all error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /characters/:id/deep-profile/generate
 * DEPRECATED: This is the legacy 14-dimension anthropology system.
 * The canonical system is the 10-dimension Character Depth Engine (de_* columns)
 * served by /api/v1/character-depth routes. This endpoint is retained for
 * backward compatibility but new integrations should use the Depth Engine.
 *
 * Returns a PREVIEW only — call POST /deep-profile/accept to persist.
 * Backfill: infer deep_profile from a character's existing profile fields.
 * For characters created before the deep_profile system existed.
 */
router.post('/characters/:id/deep-profile/generate', async (req, res) => {
  const { id } = req.params;
  const db = getModels();
  try {
    const character = await db.RegistryCharacter.findByPk(id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const existing = character.deep_profile || {};
    const filledDims = Object.keys(existing).filter(k => {
      const v = existing[k];
      return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
    });
    if (filledDims.length >= 10) {
      return res.status(400).json({ error: 'Deep profile already substantially populated', filled: filledDims.length });
    }

    // Gather everything we know about this character
    const dossier = {
      name: character.display_name || character.selected_name,
      role_type: character.role_type,
      role_label: character.role_label,
      subtitle: character.subtitle,
      gender: character.gender,
      ethnicity: character.ethnicity,
      personality: character.personality,
      description: character.description,
      core_wound: character.core_wound,
      core_desire: character.core_desire,
      core_fear: character.core_fear,
      core_belief: character.core_belief,
      hidden_want: character.hidden_want,
      mask_persona: character.mask_persona,
      truth_persona: character.truth_persona,
      character_archetype: character.character_archetype,
      signature_trait: character.signature_trait,
      emotional_baseline: character.emotional_baseline,
      pressure_type: character.pressure_type,
      pressure_quote: character.pressure_quote,
      aesthetic_dna: character.aesthetic_dna,
      career_status: character.career_status,
      voice_signature: character.voice_signature,
      living_context: character.living_context,
      relationships_map: character.relationships_map,
      story_presence: character.story_presence,
      writer_notes: character.writer_notes,
    };

    // Remove null/undefined/empty entries
    const cleanDossier = {};
    for (const [k, v] of Object.entries(dossier)) {
      if (v !== null && v !== undefined && v !== '') cleanDossier[k] = v;
    }

    const isMinor = character.age != null && character.age < 18;

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const minorSexualityRule = isMinor
      ? `\n\nIMPORTANT — MINOR SAFEGUARD: This character is a minor (age ${character.age}). Do NOT generate the "sexuality_and_desire" dimension. Instead, set it to: { "note": "Dimension deferred — character is a minor." }\n`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: `You are generating a 14-dimension deep character anthropology for an existing character.

Here is everything currently known about this character:
${JSON.stringify(cleanDossier, null, 2)}

${filledDims.length > 0 ? `EXISTING deep_profile dimensions (do NOT overwrite — only fill empty dimensions):\n${JSON.stringify(existing, null, 2)}` : ''}
${minorSexualityRule}
Generate the deep_profile. Infer what you can from the existing data. Use null for fields you genuinely cannot infer — do NOT fabricate generic filler. Every non-null field should be specific to THIS person.

Return ONLY a JSON object matching this structure (include ALL 14 top-level dimensions):
{ "life_stage": { "stage", "relationship_to_time", "relationship_to_love", "relationship_to_ambition", "relationship_to_body", "relationship_to_mortality" },
  "the_body": { "body_image", "physical_health", "relationship_to_body", "physical_presence", "body_history", "sensory_signature" },
  "class_and_money": { "class_of_origin", "current_class", "class_mobility_cost", "money_wound", "spending_pattern", "what_money_means" },
  "religion_and_meaning": { "religious_background", "current_belief", "relationship_to_god", "what_they_believe_about_suffering", "personal_ritual", "meaning_making_style" },
  "race_and_culture": { "ethnic_identity", "cultural_inheritance", "relationship_to_culture", "what_culture_taught_them", "racial_experience", "code_switching" },
  "sexuality_and_desire": { "orientation", "relationship_to_desire", "formative_experience", "what_intimacy_means", "what_they_need_to_feel_desire", "the_pattern", "what_theyve_never_said" },
  "family_architecture": { "birth_order", "family_role", "parent_wounds", "sibling_dynamics", "what_family_taught_about_love", "the_family_secret" },
  "friendship_and_loyalty": { "how_they_make_friends", "how_they_keep_friends", "the_oldest_friend", "who_they_actually_call", "betrayal_history", "what_loyalty_means" },
  "ambition_and_identity": { "how_they_define_themselves", "origin_story_of_ambition", "what_they_gave_up", "relationship_to_success", "relationship_to_others_success", "what_they_would_do_differently" },
  "habits_and_rituals": { "morning", "comfort_ritual", "avoidance_tell", "food", "physical_tell", "what_they_consume", "what_their_space_looks_like" },
  "speech_and_silence": { "how_they_argue", "what_they_never_say_directly", "how_they_receive_compliments", "what_silence_means", "verbal_tells", "speech_rhythm" },
  "grief_and_loss": { "what_they_have_lost", "how_they_grieve", "the_unprocessed_loss", "relationship_to_death" },
  "politics_and_justice": { "what_they_believe_about_fairness", "the_injustice_they_cant_ignore", "where_their_hypocrisy_lives", "what_they_gave_up_on" },
  "the_unseen": { "the_embarrassing_memory", "the_irrational_fear", "what_they_lie_about", "private_opinions", "what_makes_them_laugh", "jealousy_object", "who_they_were_at_14", "the_compliment_they_remember", "the_criticism_they_cant_let_go", "what_they_do_with_ten_free_minutes" }
}`,
      messages: [{ role: 'user', content: `Generate the full deep_profile for ${cleanDossier.name || 'this character'}.` }],
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse Claude response' });
    const generated = JSON.parse(jsonMatch[0]);

    // Hard enforcement: strip sexuality_and_desire for minors regardless of what Claude returned
    if (isMinor) {
      generated.sexuality_and_desire = { note: 'Dimension deferred — character is a minor.' };
    }

    // Merge: don't overwrite existing filled fields
    const merged = { ...existing };
    for (const [dimKey, dimVal] of Object.entries(generated)) {
      if (!dimVal || typeof dimVal !== 'object') continue;
      merged[dimKey] = merged[dimKey] || {};
      for (const [fieldKey, fieldVal] of Object.entries(dimVal)) {
        if (fieldVal === null || fieldVal === undefined) continue;
        if (!merged[dimKey][fieldKey]) {
          merged[dimKey][fieldKey] = fieldVal;
        }
      }
    }

    // Preview only — do NOT write to DB here.
    // The author must explicitly call POST /deep-profile/accept to persist.
    return res.json({
      success: true,
      character_id: id,
      character_name: character.display_name,
      proposed: merged,
      saved: false,
      message: 'Preview only — call POST /characters/:id/deep-profile/accept with { "proposed": <this object> } to save.',
      dimensions_filled: Object.keys(merged).filter(k => {
        const v = merged[k];
        return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
      }).length,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /deep-profile/generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /characters/:id/deep-profile/writer-input
 * DEPRECATED: Legacy 14-dimension system. See /api/v1/character-depth for canonical 10-dimension engine.
 * Accept free text from the writer, parse it into deep_profile dimensions via Claude,
 * return proposed additions for one-click accept.
 */
router.post('/characters/:id/deep-profile/writer-input', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Provide at least 10 characters of free text.' });
  }

  const db = getModels();
  try {
    const character = await db.RegistryCharacter.findByPk(id, {
      attributes: ['id', 'display_name', 'deep_profile', 'core_wound', 'core_desire', 'hidden_want'],
    });
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const existing = character.deep_profile || {};

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are parsing a writer's free-text notes about a character into the structured deep_profile format.

CHARACTER: ${character.display_name}
Core wound: ${character.core_wound || 'unknown'}
Core desire: ${character.core_desire || 'unknown'}
Hidden want: ${character.hidden_want || 'unknown'}

EXISTING deep_profile (do NOT overwrite populated fields — only propose additions for null/empty fields, or append to existing text with " — " separator):
${JSON.stringify(existing, null, 2)}

Parse the writer's text into the 14 deep_profile dimensions. Return ONLY a JSON object with the same structure as deep_profile. Include ONLY dimensions/fields that the writer's text actually informs — omit dimensions entirely if the text says nothing about them. Be specific and preserve the writer's voice. Do not invent information the writer didn't provide.`,
      messages: [{ role: 'user', content: text.trim() }],
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse Claude response' });
    }
    const proposed = JSON.parse(jsonMatch[0]);

    return res.json({
      success: true,
      character_id: id,
      character_name: character.display_name,
      proposed_additions: proposed,
      existing_profile: existing,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /deep-profile/writer-input error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /characters/:id/deep-profile/accept
 * DEPRECATED: Legacy 14-dimension system. See /api/v1/character-depth for canonical 10-dimension engine.
 * Merge proposed deep_profile additions into the character's existing deep_profile.
 */
router.post('/characters/:id/deep-profile/accept', async (req, res) => {
  const { id } = req.params;
  const { additions } = req.body;

  if (!additions || typeof additions !== 'object') {
    return res.status(400).json({ error: 'additions object required' });
  }

  const db = getModels();
  try {
    const character = await db.RegistryCharacter.findByPk(id, {
      attributes: ['id', 'display_name', 'deep_profile'],
    });
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const existing = character.deep_profile || {};

    // Deep merge: for each dimension, merge sub-fields
    const merged = { ...existing };
    for (const [dimKey, dimVal] of Object.entries(additions)) {
      if (!dimVal || typeof dimVal !== 'object') continue;
      merged[dimKey] = merged[dimKey] || {};
      for (const [fieldKey, fieldVal] of Object.entries(dimVal)) {
        if (fieldVal === null || fieldVal === undefined) continue;
        const existingVal = merged[dimKey][fieldKey];
        if (!existingVal) {
          merged[dimKey][fieldKey] = fieldVal;
        } else if (typeof existingVal === 'string' && typeof fieldVal === 'string') {
          // Append new info to existing
          merged[dimKey][fieldKey] = `${existingVal} — ${fieldVal}`;
        }
      }
    }

    character.deep_profile = merged;
    await character.save();

    return res.json({
      success: true,
      character_id: id,
      deep_profile: merged,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /deep-profile/accept error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /characters/bulk-deep-profile
 * DEPRECATED: Legacy 14-dimension system. See /api/v1/character-depth for canonical 10-dimension engine.
 * Generate deep profiles for multiple characters sequentially.
 * NOTE: This bulk endpoint writes directly to DB for operational convenience.
 * Body: { ids: [1,2,3] }
 */
router.post('/characters/bulk-deep-profile', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 characters per batch' });
  }

  const db = getModels();
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results = { succeeded: 0, failed: 0, skipped: 0, errors: [] };

  for (const id of ids) {
    try {
      const character = await db.RegistryCharacter.findByPk(id);
      if (!character) { results.skipped++; continue; }

      const existing = character.deep_profile || {};
      const filledDims = Object.keys(existing).filter(k => {
        const v = existing[k];
        return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
      });
      if (filledDims.length >= 10) { results.skipped++; continue; }

      const dossier = {};
      for (const [k, v] of Object.entries({
        name: character.display_name || character.selected_name,
        role_type: character.role_type, role_label: character.role_label,
        subtitle: character.subtitle, gender: character.gender,
        ethnicity: character.ethnicity, personality: character.personality,
        description: character.description, core_wound: character.core_wound,
        core_desire: character.core_desire, core_fear: character.core_fear,
        core_belief: character.core_belief, hidden_want: character.hidden_want,
        mask_persona: character.mask_persona, truth_persona: character.truth_persona,
        character_archetype: character.character_archetype,
        signature_trait: character.signature_trait,
        emotional_baseline: character.emotional_baseline,
        aesthetic_dna: character.aesthetic_dna, career_status: character.career_status,
        voice_signature: character.voice_signature, living_context: character.living_context,
      })) { if (v !== null && v !== undefined && v !== '') dossier[k] = v; }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: `You are generating a 14-dimension deep character anthropology.
Character data: ${JSON.stringify(dossier, null, 2)}
${filledDims.length > 0 ? `Existing (do NOT overwrite): ${JSON.stringify(existing, null, 2)}` : ''}
Return ONLY a JSON object with 14 dimensions: life_stage, the_body, class_and_money, religion_and_meaning, race_and_culture, sexuality_and_desire, family_architecture, friendship_and_loyalty, ambition_and_identity, habits_and_rituals, speech_and_silence, grief_and_loss, politics_and_justice, the_unseen. Use null for fields you cannot infer. Be specific to THIS character.`,
        messages: [{ role: 'user', content: `Generate deep_profile for ${dossier.name || 'this character'}.` }],
      });

      const raw = response.content[0].text;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { results.failed++; results.errors.push(`${character.display_name}: parse failed`); continue; }
      const generated = JSON.parse(jsonMatch[0]);

      const merged = { ...existing };
      for (const [dimKey, dimVal] of Object.entries(generated)) {
        if (!dimVal || typeof dimVal !== 'object') continue;
        merged[dimKey] = merged[dimKey] || {};
        for (const [fieldKey, fieldVal] of Object.entries(dimVal)) {
          if (fieldVal === null || fieldVal === undefined) continue;
          if (!merged[dimKey][fieldKey]) merged[dimKey][fieldKey] = fieldVal;
        }
      }

      character.deep_profile = merged;
      await character.save();
      results.succeeded++;
    } catch (err) {
      results.failed++;
      results.errors.push(`ID ${id}: ${err.message}`);
    }
  }

  return res.json({ success: true, ...results });
});

/**
 * POST /characters/:id/writer-paragraph/generate
 * Generate a writer-friendly narrative paragraph from the character's deep_profile + registry data.
 */
router.post('/characters/:id/writer-paragraph/generate', async (req, res) => {
  const { id } = req.params;
  const db = getModels();
  try {
    const character = await db.RegistryCharacter.findByPk(id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const dp = character.deep_profile || {};
    const hasProfile = Object.keys(dp).some(k => {
      const v = dp[k];
      return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
    });

    const charData = {};
    for (const [k, v] of Object.entries({
      name: character.display_name || character.selected_name,
      role_type: character.role_type, role_label: character.role_label,
      subtitle: character.subtitle, gender: character.gender,
      ethnicity: character.ethnicity, personality: character.personality,
      description: character.description, core_wound: character.core_wound,
      core_desire: character.core_desire, core_fear: character.core_fear,
      hidden_want: character.hidden_want, mask_persona: character.mask_persona,
      truth_persona: character.truth_persona, character_archetype: character.character_archetype,
      signature_trait: character.signature_trait, emotional_baseline: character.emotional_baseline,
      aesthetic_dna: character.aesthetic_dna, voice_signature: character.voice_signature,
    })) { if (v !== null && v !== undefined && v !== '') charData[k] = v; }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are writing a rich, literary character paragraph for a writer's reference.

CHARACTER REGISTRY DATA:
${JSON.stringify(charData, null, 2)}

${hasProfile ? `DEEP PROFILE (14-dimension anthropology):\n${JSON.stringify(dp, null, 2)}` : 'No deep profile available — work only with registry data.'}

Write a single, flowing paragraph (200–400 words) that captures who this person IS — not a list of traits but a lived-in portrait. Write it as a writer's reference paragraph, the kind of text a novelist pins above their desk. Include specific sensory details, behavioral tells, contradictions, and emotional textures. Do NOT use bullet points, headers, or labels. Write prose.`,
      messages: [{ role: 'user', content: `Write the writer paragraph for ${charData.name || 'this character'}.` }],
    });

    const paragraph = response.content[0].text.trim();

    return res.json({
      success: true,
      character_id: id,
      character_name: character.display_name || character.selected_name,
      paragraph,
    });
  } catch (err) {
    console.error('[CharacterRegistry] POST /writer-paragraph/generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /characters/bulk-writer-paragraph
 * Generate writer paragraphs for multiple characters sequentially.
 * Body: { ids: [1,2,3] }
 */
router.post('/characters/bulk-writer-paragraph', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 characters per batch' });
  }

  const db = getModels();
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results = { succeeded: 0, failed: 0, skipped: 0, paragraphs: [] };

  for (const id of ids) {
    try {
      const character = await db.RegistryCharacter.findByPk(id);
      if (!character) { results.skipped++; continue; }

      const dp = character.deep_profile || {};
      const charData = {};
      for (const [k, v] of Object.entries({
        name: character.display_name || character.selected_name,
        role_type: character.role_type, role_label: character.role_label,
        subtitle: character.subtitle, gender: character.gender,
        ethnicity: character.ethnicity, personality: character.personality,
        description: character.description, core_wound: character.core_wound,
        core_desire: character.core_desire, hidden_want: character.hidden_want,
        mask_persona: character.mask_persona, truth_persona: character.truth_persona,
        character_archetype: character.character_archetype,
        signature_trait: character.signature_trait,
        aesthetic_dna: character.aesthetic_dna, voice_signature: character.voice_signature,
      })) { if (v !== null && v !== undefined && v !== '') charData[k] = v; }

      const hasProfile = Object.keys(dp).some(k => {
        const v = dp[k];
        return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are writing a rich, literary character paragraph for a writer's reference.
CHARACTER: ${JSON.stringify(charData, null, 2)}
${hasProfile ? `DEEP PROFILE:\n${JSON.stringify(dp, null, 2)}` : ''}
Write a single flowing paragraph (200–400 words) capturing who this person IS — a writer's reference portrait with sensory details, behavioral tells, contradictions, emotional textures. Prose only, no lists or headers.`,
        messages: [{ role: 'user', content: `Write the writer paragraph for ${charData.name || 'this character'}.` }],
      });

      const paragraph = response.content[0].text.trim();
      results.paragraphs.push({ id, name: character.display_name || character.selected_name, paragraph });
      results.succeeded++;
    } catch (err) {
      results.failed++;
    }
  }

  return res.json({ success: true, ...results });
});

module.exports = router;
