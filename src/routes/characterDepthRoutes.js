'use strict';

/**
 * src/routes/characterDepthRoutes.js
 *
 * Character Depth Engine — 10 dimensions of character depth.
 * Base path: /api/v1/character-depth
 *
 * Endpoints:
 *   GET    /:charId              — Get all depth dimensions
 *   PUT    /:charId              — Update depth dimensions
 *   POST   /:charId/generate     — Generate all 10 dimensions via Claude
 *   POST   /:charId/generate/:dimension — Generate a single dimension
 *   POST   /:charId/confirm      — Accept proposed values and write to DB
 */

const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// ── Auth middleware ──
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// ── Models ──
const db = require('../models');
const { RegistryCharacter, CharacterRegistry } = db;
const { AUTHOR_ONLY_FIELDS } = require('../models/RegistryCharacter');

// ── Anthropic ──
const anthropic = new Anthropic();
const FAST_MODEL = 'claude-haiku-4-5-20251001';
const DEEP_MODEL = 'claude-sonnet-4-20250514';

// ── All depth engine field names (de_ prefix) ──
const DE_FIELDS = [
  // Body
  'de_body_relationship','de_body_currency','de_body_control','de_body_comfort','de_body_history',
  // Money
  'de_money_behavior','de_money_origin_class','de_money_current_class','de_class_gap_direction','de_money_wound',
  // Time
  'de_time_orientation','de_time_wound',
  // Luck & Circumstance
  'de_world_belief','de_circumstance_advantages','de_circumstance_disadvantages','de_luck_interpretation','de_circumstance_wound',
  // Self-Narrative
  'de_self_narrative_origin','de_self_narrative_turning_point','de_self_narrative_villain','de_actual_narrative_gap','de_therapy_target',
  // Blind Spot
  'de_blind_spot_category','de_blind_spot','de_blind_spot_evidence','de_blind_spot_crack_condition',
  // Change Capacity
  'de_change_capacity','de_change_capacity_score','de_change_condition','de_change_witness','de_arc_function',
  // Operative Cosmology
  'de_operative_cosmology','de_stated_religion','de_cosmology_conflict','de_meaning_making_style',
  // Foreclosed Possibility
  'de_foreclosed_possibilities','de_foreclosure_origins','de_foreclosure_visibility','de_crack_conditions',
  // Joy
  'de_joy_trigger','de_joy_body_location','de_joy_origin','de_forbidden_joy','de_joy_threat_response','de_joy_current_access',
];

// Dimension → field mapping for single-dimension generation
const DIMENSION_FIELDS = {
  body:       ['de_body_relationship','de_body_currency','de_body_control','de_body_comfort','de_body_history'],
  money:      ['de_money_behavior','de_money_origin_class','de_money_current_class','de_class_gap_direction','de_money_wound'],
  time:       ['de_time_orientation','de_time_wound'],
  luck:       ['de_world_belief','de_circumstance_advantages','de_circumstance_disadvantages','de_luck_interpretation','de_circumstance_wound'],
  narrative:  ['de_self_narrative_origin','de_self_narrative_turning_point','de_self_narrative_villain','de_actual_narrative_gap','de_therapy_target'],
  blindspot:  ['de_blind_spot_category','de_blind_spot','de_blind_spot_evidence','de_blind_spot_crack_condition'],
  change:     ['de_change_capacity','de_change_capacity_score','de_change_condition','de_change_witness','de_arc_function'],
  cosmology:  ['de_operative_cosmology','de_stated_religion','de_cosmology_conflict','de_meaning_making_style'],
  foreclosed: ['de_foreclosed_possibilities','de_foreclosure_origins','de_foreclosure_visibility','de_crack_conditions'],
  joy:        ['de_joy_trigger','de_joy_body_location','de_joy_origin','de_forbidden_joy','de_joy_threat_response','de_joy_current_access'],
};

// ── Helpers ──

function stripAuthorFields(obj) {
  const clean = { ...obj };
  for (const field of AUTHOR_ONLY_FIELDS) {
    delete clean[field];
  }
  return clean;
}

function isAuthor(req) {
  return !!req.user;
}

function buildCharacterContext(character) {
  const c = character.toJSON ? character.toJSON() : character;
  const sections = [];

  sections.push(`CHARACTER: ${c.selected_name || c.display_name}`);
  sections.push(`Role: ${c.role_type || 'unknown'}`);
  if (c.subtitle) sections.push(`Subtitle: ${c.subtitle}`);

  // Core psychology
  if (c.core_wound) sections.push(`Core Wound: ${c.core_wound}`);
  if (c.core_desire) sections.push(`Core Desire: ${c.core_desire}`);
  if (c.core_fear) sections.push(`Core Fear: ${c.core_fear}`);
  if (c.core_belief) sections.push(`Core Belief: ${c.core_belief}`);
  if (c.hidden_want) sections.push(`Hidden Want: ${c.hidden_want}`);
  if (c.mask_persona) sections.push(`Mask Persona: ${c.mask_persona}`);
  if (c.truth_persona) sections.push(`Truth Persona: ${c.truth_persona}`);

  // Interior architecture
  if (c.want_architecture) sections.push(`Want Architecture: ${JSON.stringify(c.want_architecture)}`);
  if (c.wound) sections.push(`Wound Detail: ${JSON.stringify(c.wound)}`);
  if (c.the_mask) sections.push(`The Mask: ${JSON.stringify(c.the_mask)}`);
  if (c.triggers) sections.push(`Triggers: ${JSON.stringify(c.triggers)}`);
  if (c.living_state) sections.push(`Living State: ${JSON.stringify(c.living_state)}`);
  if (c.dilemma) sections.push(`Central Dilemma: ${JSON.stringify(c.dilemma)}`);

  // Existing depth dimensions
  if (c.self_narrative) sections.push(`Self Narrative: ${c.self_narrative}`);
  if (c.operative_cosmology) sections.push(`Operative Cosmology: ${c.operative_cosmology}`);
  if (c.blind_spot) sections.push(`Blind Spot: ${c.blind_spot}`);
  if (c.foreclosed_possibility) sections.push(`Foreclosed Possibility: ${c.foreclosed_possibility}`);
  if (c.experience_of_joy) sections.push(`Experience of Joy: ${c.experience_of_joy}`);
  if (c.change_capacity) sections.push(`Change Capacity: ${JSON.stringify(c.change_capacity)}`);

  // Deep profile
  if (c.deep_profile && Object.keys(c.deep_profile).length > 0) {
    sections.push(`Deep Profile (14 dimensions): ${JSON.stringify(c.deep_profile)}`);
  }

  // Family
  if (c.family_tree) sections.push(`Family Tree: ${JSON.stringify(c.family_tree)}`);

  // Therapy
  if (c.therapy_primary_defense) sections.push(`Primary Defense: ${c.therapy_primary_defense}`);
  if (c.therapy_baseline) sections.push(`Therapy Baseline: ${JSON.stringify(c.therapy_baseline)}`);

  return sections.join('\n');
}

const SYSTEM_PROMPT = `You are generating character depth dimensions for a character in the LalaVerse franchise. You have access to the character's full dossier from the registry. You must generate values that are consistent with the wound, mask, family architecture, and existing character truth. Do not invent a generic character. Read the dossier and generate from what is already true.

Generate in JSON only. No preamble. No markdown. Return a JSON object with exactly the fields specified. All text fields should be 1-3 sentences — specific, not vague. Specificity is the standard. 'She has anxiety about money' is not specific. 'She grew up watching her mother count change at the end of the month and learned that safety is something you can always lose' is specific.

For AUTHOR_ONLY fields (de_blind_spot, de_blind_spot_evidence, de_blind_spot_crack_condition, de_actual_narrative_gap): generate as if writing a private note to the author. What does she not know about herself? Be exact.

For de_joy_trigger: this is not a category. This is the specific thing. Not 'creative work' — 'the twenty minutes after she posts something she made with her whole self, before she checks the comments.'

ENUM constraints — use ONLY these values:
- de_body_relationship: currency, discipline, burden, stranger, home, evidence
- de_money_behavior: hoarder, compulsive_giver, spend_to_feel, deprivation_guilt, control, performs_wealth, performs_poverty
- de_money_origin_class / de_money_current_class: poverty, working_class, middle_class, upper_middle, wealthy, ultra_wealthy
- de_class_gap_direction: up, down, stable
- de_time_orientation: past_anchored, future_oriented, present_impulsive, perpetual_waiter, cyclical
- de_world_belief: random, rigged, effort, divine, strategy
- de_blind_spot_category: impact, pattern, motivation, strength, wound
- de_change_capacity: highly_rigid, conditionally_open, cyclically_mobile, highly_fluid, fixed_by_choice
- de_arc_function: arc, fixed, both
- de_operative_cosmology: deserving, contractual, indifferent, relational, authored
- de_joy_threat_response: fight, grieve, deny

INTEGER fields (0-100): de_body_currency, de_body_control, de_body_comfort, de_luck_interpretation, de_change_capacity_score, de_joy_current_access

JSONB fields:
- de_foreclosed_possibilities: array of strings from [love, safety, belonging, success, being_known]
- de_foreclosure_origins: object mapping category to text description
- de_foreclosure_visibility: object mapping category to integer 0-100
- de_crack_conditions: object mapping category to text description`;

function buildDimensionPrompt(dimension, fields) {
  return `Generate ONLY the following fields for the ${dimension} dimension:\n${fields.map(f => `- ${f}`).join('\n')}\n\nReturn a JSON object with exactly these keys.`;
}

async function callClaude(systemPrompt, userMessage, model = FAST_MODEL, maxTokens = 4000) {
  const system = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    return res.content[0]?.text || '';
  } catch (err) {
    if (err.status === 529 || err.message?.includes('overloaded')) {
      const fallback = model === FAST_MODEL ? DEEP_MODEL : FAST_MODEL;
      const res = await anthropic.messages.create({
        model: fallback,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      });
      return res.content[0]?.text || '';
    }
    throw err;
  }
}

function parseJSON(text) {
  // Strip markdown fences if present
  const cleaned = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}


/* ═══════════════════════════════════════════════════════════════════════════════
   GET /:charId — Get all depth dimensions for a character
   ═══════════════════════════════════════════════════════════════════════════════ */
router.get('/:charId', requireAuth, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.charId);
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    const json = character.toJSON();

    // Extract only de_ fields
    const depth = {};
    for (const field of DE_FIELDS) {
      depth[field] = json[field] ?? null;
    }

    // Strip author-only fields if not author
    const result = isAuthor(req) ? depth : stripAuthorFields(depth);

    return res.json({
      success: true,
      character_id: character.id,
      character_name: character.selected_name || character.display_name,
      depth: result,
    });
  } catch (err) {
    console.error('GET /character-depth/:charId error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════════
   PUT /:charId — Update depth dimensions
   ═══════════════════════════════════════════════════════════════════════════════ */
router.put('/:charId', requireAuth, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.charId);
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    // Finalized guard
    if (character.status === 'finalized') {
      return res.status(403).json({
        success: false,
        error: 'Character is finalized. Use the finalization override flow to modify.',
      });
    }

    // Only accept de_ fields
    const updates = {};
    for (const field of DE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid depth fields provided' });
    }

    await character.update(updates);

    const json = character.toJSON();
    const depth = {};
    for (const field of DE_FIELDS) {
      depth[field] = json[field] ?? null;
    }

    return res.json({
      success: true,
      character_id: character.id,
      depth: isAuthor(req) ? depth : stripAuthorFields(depth),
    });
  } catch (err) {
    console.error('PUT /character-depth/:charId error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════════
   POST /:charId/generate — Generate all 10 dimensions via Claude
   ═══════════════════════════════════════════════════════════════════════════════ */
router.post('/:charId/generate', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.charId, {
      include: [{ model: CharacterRegistry, as: 'registry' }],
    });
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    const context = buildCharacterContext(character);
    const userMessage = `Here is the character dossier:\n\n${context}\n\nGenerate ALL 10 depth dimensions. Return a single JSON object with all de_ fields.`;

    const raw = await callClaude(SYSTEM_PROMPT, userMessage, DEEP_MODEL, 8000);
    const proposed = parseJSON(raw);

    // Only keep valid de_ fields
    const filtered = {};
    for (const field of DE_FIELDS) {
      if (proposed[field] !== undefined) {
        filtered[field] = proposed[field];
      }
    }

    return res.json({
      success: true,
      character_id: character.id,
      character_name: character.selected_name || character.display_name,
      proposed: filtered,
      saved: false,
      message: 'Preview only — call POST /confirm to save these values.',
    });
  } catch (err) {
    console.error('POST /character-depth/:charId/generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════════
   POST /:charId/generate/:dimension — Generate a single dimension
   ═══════════════════════════════════════════════════════════════════════════════ */
router.post('/:charId/generate/:dimension', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { charId, dimension } = req.params;
    const fields = DIMENSION_FIELDS[dimension];
    if (!fields) {
      return res.status(400).json({
        success: false,
        error: `Invalid dimension "${dimension}". Valid: ${Object.keys(DIMENSION_FIELDS).join(', ')}`,
      });
    }

    const character = await RegistryCharacter.findByPk(charId, {
      include: [{ model: CharacterRegistry, as: 'registry' }],
    });
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    const context = buildCharacterContext(character);
    const dimPrompt = buildDimensionPrompt(dimension, fields);
    const userMessage = `Here is the character dossier:\n\n${context}\n\n${dimPrompt}`;

    const raw = await callClaude(SYSTEM_PROMPT, userMessage, FAST_MODEL, 4000);
    const proposed = parseJSON(raw);

    // Only keep valid fields for this dimension
    const filtered = {};
    for (const field of fields) {
      if (proposed[field] !== undefined) {
        filtered[field] = proposed[field];
      }
    }

    return res.json({
      success: true,
      character_id: charId,
      dimension,
      proposed: filtered,
      saved: false,
      message: `Preview only — call POST /confirm to save.`,
    });
  } catch (err) {
    console.error(`POST /character-depth/:charId/generate/${req.params.dimension} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════════
   POST /:charId/confirm — Accept proposed values and write to DB
   ═══════════════════════════════════════════════════════════════════════════════ */
router.post('/:charId/confirm', requireAuth, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.charId);
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    // Finalized guard
    if (character.status === 'finalized') {
      return res.status(403).json({
        success: false,
        error: 'Character is finalized. Use the finalization override flow to modify.',
      });
    }

    const { proposed } = req.body;
    if (!proposed || typeof proposed !== 'object') {
      return res.status(400).json({ success: false, error: 'Missing "proposed" object in request body' });
    }

    // Only accept de_ fields
    const updates = {};
    for (const field of DE_FIELDS) {
      if (proposed[field] !== undefined) {
        updates[field] = proposed[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid depth fields in proposed object' });
    }

    await character.update(updates);

    const json = character.toJSON();
    const depth = {};
    for (const field of DE_FIELDS) {
      depth[field] = json[field] ?? null;
    }

    return res.json({
      success: true,
      character_id: character.id,
      depth: isAuthor(req) ? depth : stripAuthorFields(depth),
      saved: true,
      fields_written: Object.keys(updates).length,
    });
  } catch (err) {
    console.error('POST /character-depth/:charId/confirm error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
