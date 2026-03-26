/**
 * storyEvaluationRoutes.js — Story Evaluation Engine v2
 *
 * Blind 3-agent generation → editorial evaluation → memory proposals →
 * registry update proposals → manuscript write-back.
 *
 * Routes (all mounted under /api/v1/memories):
 *   POST /generate-story-multi    — blind 3-voice generation
 *   POST /evaluate-stories        — Claude Opus evaluation
 *   POST /propose-memory          — plot + revelation memory proposals
 *   POST /propose-registry-update — propose updates to character registry
 *   POST /write-back              — write approved version to manuscript lines
 *   GET  /eval-stories/:storyId   — fetch story with all evaluation data
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../models');

const anthropic = new Anthropic();
const { buildArcContext, buildArcContextPromptSection } = require('../services/arcTrackingService');
const { enrichAfterWriteBack } = require('../services/storyEnrichmentService');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

// ── Voice system prompts for blind 3-agent generation ─────────────────────
const VOICE_SYSTEM_BASE = {
  voice_a: `You are a literary voice that prioritises depth and interiority. Write in close third-person, past tense, literary present. Focus on what the character cannot say aloud, the subtext beneath every gesture. Every scene should feel like standing inside the character's ribcage.`,
  voice_b: `You are a narrative voice that prioritises tension and momentum. Write in close third-person, past tense. Every paragraph should tighten the noose — desire vs. obstacle, silence vs. eruption. Pace like a thriller, feel like literature.`,
  voice_c: `You are a sensory-first voice that prioritises desire and the body. Write in close third-person, past tense, lyric-literary register. Let the reader feel skin, breath, fabric, heat. The body knows before the mind does.`,
};

// Build voice system prompts enriched with character wounds/desires
function buildVoiceSystem(dossiers) {
  if (!dossiers?.length) return VOICE_SYSTEM_BASE;
  const charLines = dossiers.map(d => {
    const parts = [`${d.display_name || d.character_key}`];
    if (d.core_wound) parts.push(`  Wound: ${d.core_wound}`);
    if (d.core_desire) parts.push(`  Desire: ${d.core_desire}`);
    if (d.hidden_want) parts.push(`  Hidden want: ${d.hidden_want}`);
    if (d.core_fear) parts.push(`  Fear: ${d.core_fear}`);
    if (d.emotional_baseline) parts.push(`  Emotional baseline: ${d.emotional_baseline}`);
    return parts.join('\n');
  }).join('\n\n');
  const prefix = `CHARACTER ESSENTIALS (know these, let them shape every sentence):\n${charLines}\n\n---\n\n`;
  return {
    voice_a: prefix + VOICE_SYSTEM_BASE.voice_a,
    voice_b: prefix + VOICE_SYSTEM_BASE.voice_b,
    voice_c: prefix + VOICE_SYSTEM_BASE.voice_c,
  };
}

// ── Tone dial modifiers ───────────────────────────────────────────────────
const TONE_MODIFIERS = {
  literary:      'Prioritise psychological depth, subtext, and thematic resonance. Sentence-level craft matters most.',
  thriller:      'Prioritise pacing, stakes escalation, and chapter-end hooks. Keep sentences taut.',
  lyrical:       'Prioritise sensory language, metaphor, and emotional texture. Let prose breathe.',
  intimate:      'Prioritise closeness — body language, breath, silence, desire. Every distance is a choice.',
  dark:          'Prioritise tension, moral ambiguity, and unflinching honesty. No comfort, only truth.',
  warm:          'Prioritise connection, humour, and earned tenderness. Light that knows about darkness.',
  confessional:  'Prioritise raw honesty, direct address, breaking the frame. The character speaks as if no one is watching — then realises someone is.',
  ambient:       'Prioritise atmosphere, slow-burn, texture over plot. The scene breathes. Meaning accumulates in the spaces.',
  charged:       'Prioritise electric tension, desire held back, everything about to happen. The air between people is the story.',
};

// ── Voice-specific tone assignments (all 6 tones covered) ────────────────────
const VOICE_TONES = {
  voice_a: ['literary', 'dark'],    // psychological depth + moral ambiguity
  voice_b: ['thriller', 'intimate'],// pacing + closeness
  voice_c: ['lyrical', 'warm'],     // sensory language + connection
};

// ── Helper: build generation prompt ───────────────────────────────────────
const VOICE_DEEP_HINTS_BASE = {
  voice_a: 'Lean into grief, family architecture, body history, the unprocessed loss, parent wounds. Interiority and the weight of the past.',
  voice_b: 'Lean into ambition, class/money, politics, career wounds, active dilemmas. Tension, stakes, and forward momentum.',
  voice_c: 'Lean into sexuality/desire, sensory signatures, habits/rituals, the unseen, comfort rituals. The body, warmth, what intimacy costs.',
};

// Build dynamic deep hints from actual character dossier wounds/desires
function buildDynamicDeepHints(dossiers, voiceKey) {
  const base = VOICE_DEEP_HINTS_BASE[voiceKey] || '';
  if (!dossiers?.length) return base;
  const charSpecific = dossiers.map(d => {
    const parts = [];
    if (voiceKey === 'voice_a') {
      if (d.deep_profile?.grief_and_loss?.the_unprocessed_loss) parts.push(`unprocessed loss: "${d.deep_profile.grief_and_loss.the_unprocessed_loss}"`);
      if (d.deep_profile?.family_architecture?.parent_wounds) parts.push(`parent wounds: "${d.deep_profile.family_architecture.parent_wounds}"`);
      if (d.core_wound) parts.push(`core wound: "${d.core_wound}"`);
    } else if (voiceKey === 'voice_b') {
      if (d.deep_profile?.ambition_and_identity?.what_they_gave_up) parts.push(`what they gave up: "${d.deep_profile.ambition_and_identity.what_they_gave_up}"`);
      if (d.deep_profile?.class_and_money?.money_wound) parts.push(`money wound: "${d.deep_profile.class_and_money.money_wound}"`);
      if (d.living_context?.active_pressures) parts.push(`active pressure: "${d.living_context.active_pressures}"`);
    } else if (voiceKey === 'voice_c') {
      if (d.deep_profile?.sexuality_and_desire?.the_pattern) parts.push(`desire pattern: "${d.deep_profile.sexuality_and_desire.the_pattern}"`);
      if (d.deep_profile?.the_body?.sensory_signature) parts.push(`sensory signature: "${d.deep_profile.the_body.sensory_signature}"`);
      if (d.deep_profile?.habits_and_rituals?.comfort_ritual) parts.push(`comfort ritual: "${d.deep_profile.habits_and_rituals.comfort_ritual}"`);
    }
    return parts.length ? `  ${d.display_name || d.character_key}: ${parts.join('; ')}` : null;
  }).filter(Boolean);
  return charSpecific.length ? `${base}\n\nCHARACTER-SPECIFIC FOCUS:\n${charSpecific.join('\n')}` : base;
}

// Build selective dramatic irony hints from author knowledge (blind spots only)
function buildDramaticIronyHints(dossiers) {
  if (!dossiers?.length) return '';
  const hints = dossiers.map(d => {
    if (!d.blind_spot && !d.actual_narrative) return null;
    const parts = [`${d.display_name || d.character_key}`];
    if (d.blind_spot) parts.push(`  Cannot see: ${d.blind_spot}`);
    if (d.actual_narrative) parts.push(`  True story (reader should sense): ${d.actual_narrative}`);
    return parts.join('\n');
  }).filter(Boolean);
  if (!hints.length) return '';
  return `\n\nDRAMATIC IRONY (the reader should SENSE these truths, but the character cannot name them — show through behaviour, body, choices, NOT through telling):\n${hints.join('\n\n')}`;
}

function buildGenerationPrompt({ scene_brief, voice_key, characters_in_scene, charBlocks, tone_dial, dossiers, must_include, never_include }) {
  const tones = VOICE_TONES[voice_key] || ['literary'];
  const toneMod = tones.map(t => TONE_MODIFIERS[t]).join(' ');
  // Layer the writer's chosen tone_dial(s) on top of the voice's assigned tones
  // tone_dial can be a string (legacy) or array (new multi-select)
  const dialTones = Array.isArray(tone_dial) ? tone_dial : (tone_dial ? [tone_dial] : []);
  const dialMod = dialTones
    .map(t => TONE_MODIFIERS[t])
    .filter(Boolean)
    .map(m => `WRITER'S TONE DIAL: ${m}`)
    .join('\n');
  const dialBlock = dialMod ? `\n${dialMod}` : '';
  const deepHint = buildDynamicDeepHints(dossiers, voice_key);
  const ironyHint = buildDramaticIronyHints(dossiers);

  // Must/Never constraints
  let constraints = '';
  if (must_include) constraints += `\nMUST INCLUDE in this scene: ${must_include}`;
  if (never_include) constraints += `\nNEVER INCLUDE in this scene: ${never_include}`;

  return `TONE: ${toneMod}${dialBlock}

You are writing ONE of THREE blind perspectives of the same scene. Two other voices are writing their own versions simultaneously. Do NOT try to cover everything — lean HARD into your voice's specialty. Assume the other voices will handle what you skip. Be distinctive, not comprehensive.

CHARACTERS IN SCENE: ${(characters_in_scene || []).join(', ')}
${charBlocks || ''}${ironyHint}

DEEP PROFILE GUIDANCE: ${deepHint}
Use the character dossier fields above — body history, sensory signatures, family wounds, desire patterns, verbal tells, comfort rituals — to make these people feel irreducible. Not all of it. The specific details that would surface in THIS scene.${constraints}

SCENE BRIEF:
${scene_brief}

Write a 2500–3500 word scene. Adult literary fiction — explicit language, sexuality, and conflict permitted. Close third person. End on a shift, not a resolution. Return ONLY the prose — no meta commentary, no title.`;
}

// ── Character depth knowledge classification ─────────────────────────────────
// CHARACTER_KNOWLEDGE → injected into all 3 generation agents (A, B, C)
// AUTHOR_KNOWLEDGE_ONLY → injected into evaluation agent + author layer ONLY
const _CHARACTER_KNOWLEDGE_FIELDS = [
  'body_relationship', 'body_history', 'body_currency', 'body_control_pattern',
  'money_behavior_pattern', 'money_behavior_note',
  'time_orientation_v2', 'time_orientation_note',
  'change_capacity_v2', 'change_conditions', 'change_blocker',
  'circumstance_advantages', 'circumstance_disadvantages',
  'luck_belief', 'luck_belief_vs_stated',
  'self_narrative',
  'operative_cosmology_v2', 'cosmology_vs_stated_religion',
  'joy_source', 'joy_accessibility', 'joy_vs_ambition',
];

const _AUTHOR_KNOWLEDGE_ONLY_FIELDS = [
  'blind_spot',
  'blind_spot_category',
  'blind_spot_visible_to',
  'actual_narrative',
  'narrative_gap_type',
  'foreclosed_category',
  'foreclosure_origin',
  'foreclosure_vs_stated_want',
];

// ── Helper: build depth lines for character block (character knowledge only) ─
function buildDepthLines(d) {
  const lines = [];
  if (d.body_relationship) lines.push(`  Body relationship: ${d.body_relationship}`);
  if (d.body_history) lines.push(`  Body history (depth): ${d.body_history}`);
  if (d.body_currency) lines.push(`  Body as currency: ${d.body_currency}`);
  if (d.body_control_pattern) lines.push(`  Body control pattern: ${d.body_control_pattern}`);
  if (d.money_behavior_pattern) lines.push(`  Money pattern: ${d.money_behavior_pattern}`);
  if (d.money_behavior_note) lines.push(`  Money note: ${d.money_behavior_note}`);
  if (d.time_orientation_v2) lines.push(`  Time orientation: ${d.time_orientation_v2}`);
  if (d.time_orientation_note) lines.push(`  Time note: ${d.time_orientation_note}`);
  if (d.change_capacity_v2) lines.push(`  Change capacity: ${d.change_capacity_v2}`);
  if (d.change_conditions) lines.push(`  Change conditions: ${d.change_conditions}`);
  if (d.change_blocker) lines.push(`  Change blocker: ${d.change_blocker}`);
  if (d.circumstance_advantages) lines.push(`  Unchosen advantages: ${d.circumstance_advantages}`);
  if (d.circumstance_disadvantages) lines.push(`  Unchosen obstacles: ${d.circumstance_disadvantages}`);
  if (d.luck_belief) lines.push(`  Luck belief: ${d.luck_belief}`);
  if (d.luck_belief_vs_stated) lines.push(`  Luck gap: ${d.luck_belief_vs_stated}`);
  if (d.self_narrative) lines.push(`  Self-narrative: ${d.self_narrative}`);
  if (d.operative_cosmology_v2) lines.push(`  Operative cosmology: ${d.operative_cosmology_v2}`);
  if (d.cosmology_vs_stated_religion) lines.push(`  Cosmology gap: ${d.cosmology_vs_stated_religion}`);
  if (d.joy_source) lines.push(`  Joy source: ${d.joy_source}`);
  if (d.joy_accessibility) lines.push(`  Joy accessibility: ${d.joy_accessibility}`);
  if (d.joy_vs_ambition) lines.push(`  Joy vs ambition: ${d.joy_vs_ambition}`);
  return lines;
}

// ── Helper: build author-knowledge lines (evaluation agent only) ─────────────
function buildAuthorKnowledgeLines(d) {
  const lines = [];
  if (d.blind_spot) lines.push(`  BLIND SPOT: ${d.blind_spot}`);
  if (d.blind_spot_category) lines.push(`  Blind spot category: ${d.blind_spot_category}`);
  if (d.actual_narrative) lines.push(`  ACTUAL NARRATIVE: ${d.actual_narrative}`);
  if (d.narrative_gap_type) lines.push(`  Narrative gap type: ${d.narrative_gap_type}`);
  if (d.foreclosed_category) lines.push(`  FORECLOSED POSSIBILITY: ${d.foreclosed_category}`);
  if (d.foreclosure_origin) lines.push(`  Foreclosure origin: ${d.foreclosure_origin}`);
  if (d.foreclosure_vs_stated_want) lines.push(`  Foreclosure vs stated want: ${d.foreclosure_vs_stated_want}`);
  return lines;
}

// ── Helper: build structured character blocks for generation ───────────────
function buildCharacterBlock(dossier, relationships) {
  const d = dossier;
  const lines = [];
  lines.push(`${d.display_name || d.character_key}`);

  // Archetype & trait
  if (d.character_archetype) lines.push(`  Archetype: ${d.character_archetype}`);
  if (d.signature_trait) lines.push(`  Signature trait: ${d.signature_trait}`);

  // Identity triad
  if (d.core_wound) lines.push(`  Wound: ${d.core_wound}`);
  if (d.core_desire) lines.push(`  Desire: ${d.core_desire}`);
  if (d.core_fear) lines.push(`  Fear: ${d.core_fear}`);
  if (d.hidden_want) lines.push(`  Hidden want: ${d.hidden_want}`);
  if (d.core_belief) lines.push(`  Belief: ${d.core_belief}`);

  // Mask vs Truth
  if (d.mask_persona) lines.push(`  Public self (mask): ${d.mask_persona}`);
  if (d.truth_persona) lines.push(`  True self (hidden): ${d.truth_persona}`);
  if (d.emotional_baseline) lines.push(`  Emotional baseline: ${d.emotional_baseline}`);

  // Living context (situational grounding)
  const lc = d.living_context || {};
  if (lc.current_season) lines.push(`  Current season: ${lc.current_season}`);
  if (lc.active_pressures) lines.push(`  Active pressures: ${lc.active_pressures}`);
  if (lc.home_environment) lines.push(`  Home environment: ${lc.home_environment}`);
  if (lc.financial_reality) lines.push(`  Financial reality: ${lc.financial_reality}`);
  if (lc.relationship_to_deadlines) lines.push(`  Relationship to pressure: ${lc.relationship_to_deadlines}`);

  // Strengths from personality_matrix
  const strengths = d.personality_matrix?.strengths;
  if (strengths?.length) lines.push(`  Strengths: ${strengths.join(', ')}`);

  // Deep profile dimensions (selective — only populated fields)
  const dp = d.deep_profile || {};
  if (dp.life_stage?.stage) lines.push(`  Life stage: ${dp.life_stage.stage}`);
  if (dp.life_stage?.relationship_to_time) lines.push(`  Relationship to time: ${dp.life_stage.relationship_to_time}`);
  if (dp.the_body?.body_history) lines.push(`  Body history: ${dp.the_body.body_history}`);
  if (dp.the_body?.sensory_signature) lines.push(`  Sensory signature: ${dp.the_body.sensory_signature}`);
  if (dp.class_and_money?.money_wound) lines.push(`  Money wound: ${dp.class_and_money.money_wound}`);
  if (dp.class_and_money?.class_mobility_cost) lines.push(`  Class mobility cost: ${dp.class_and_money.class_mobility_cost}`);
  if (dp.sexuality_and_desire?.the_pattern) lines.push(`  Desire pattern: ${dp.sexuality_and_desire.the_pattern}`);
  if (dp.sexuality_and_desire?.what_theyve_never_said) lines.push(`  Never said: ${dp.sexuality_and_desire.what_theyve_never_said}`);
  if (dp.family_architecture?.parent_wounds) lines.push(`  Parent wounds: ${dp.family_architecture.parent_wounds}`);
  if (dp.family_architecture?.the_family_secret) lines.push(`  Family secret: ${dp.family_architecture.the_family_secret}`);
  if (dp.grief_and_loss?.the_unprocessed_loss) lines.push(`  Unprocessed loss: ${dp.grief_and_loss.the_unprocessed_loss}`);
  if (dp.ambition_and_identity?.what_they_gave_up) lines.push(`  What they gave up: ${dp.ambition_and_identity.what_they_gave_up}`);
  if (dp.habits_and_rituals?.comfort_ritual) lines.push(`  Comfort ritual: ${dp.habits_and_rituals.comfort_ritual}`);
  if (dp.habits_and_rituals?.physical_tell) lines.push(`  Physical tell: ${dp.habits_and_rituals.physical_tell}`);
  if (dp.speech_and_silence?.how_they_argue) lines.push(`  Argues: ${dp.speech_and_silence.how_they_argue}`);
  if (dp.speech_and_silence?.verbal_tells) lines.push(`  Verbal tells: ${dp.speech_and_silence.verbal_tells}`);
  if (dp.the_unseen?.the_embarrassing_memory) lines.push(`  Embarrassing memory: ${dp.the_unseen.the_embarrassing_memory}`);
  if (dp.the_unseen?.what_they_lie_about) lines.push(`  Maintenance lies: ${dp.the_unseen.what_they_lie_about}`);
  if (dp.politics_and_justice?.the_injustice_they_cant_ignore) lines.push(`  Injustice: ${dp.politics_and_justice.the_injustice_they_cant_ignore}`);

  // Voice signature (dialogue patterns)
  const vs = d.voice_signature || {};
  if (vs.speech_pattern) lines.push(`  Speech pattern: ${vs.speech_pattern}`);
  if (vs.vocabulary_level) lines.push(`  Vocabulary: ${vs.vocabulary_level}`);
  if (vs.verbal_tics) lines.push(`  Verbal tics: ${vs.verbal_tics}`);
  if (vs.silence_pattern) lines.push(`  Silence pattern: ${vs.silence_pattern}`);

  // Story presence
  const sp = d.story_presence || {};
  if (sp.entrance_energy) lines.push(`  Entrance energy: ${sp.entrance_energy}`);
  if (sp.scene_role) lines.push(`  Default scene role: ${sp.scene_role}`);

  // Evolution tracking
  const et = d.evolution_tracking || {};
  if (et.current_arc) lines.push(`  Current arc: ${et.current_arc}`);
  if (et.arc_stage) lines.push(`  Arc stage: ${et.arc_stage}`);
  if (et.last_shift) lines.push(`  Last shift: ${et.last_shift}`);

  // Career status
  const cs = d.career_status || {};
  if (cs.current_role) lines.push(`  Career: ${cs.current_role}`);
  if (cs.financial_status) lines.push(`  Financial: ${cs.financial_status}`);

  // Aesthetic DNA
  const ad = d.aesthetic_dna || {};
  if (ad.visual_signature) lines.push(`  Visual signature: ${ad.visual_signature}`);
  if (ad.color_palette) lines.push(`  Color palette: ${ad.color_palette}`);

  // Character depth dimensions (character knowledge — safe for voice generation)
  const depthLines = buildDepthLines(d);
  if (depthLines.length) {
    lines.push('');
    lines.push(...depthLines);
  }

  // Relationships to other characters in the scene
  if (relationships?.length) {
    lines.push('');
    relationships.forEach(r => {
      const label = [r.role_tag, r.family_role].filter(Boolean).join(', ');
      lines.push(`  → ${r.person}${label ? ` (${label})` : ''}`);
      if (r.source_knows) lines.push(`    ${d.display_name || d.character_key} knows: ${r.source_knows}`);
      if (r.target_knows) lines.push(`    ${r.person} knows: ${r.target_knows}`);
      if (r.reader_knows) lines.push(`    Reader knows: ${r.reader_knows}`);
      if (!r.source_knows && !r.target_knows && !r.reader_knows) {
        // Fallback to situation/tension/conflict
        const detail = r.situation || r.conflict || r.tension;
        if (detail) lines.push(`    ${detail}`);
      }
    });
  }

  return lines.join('\n');
}

// ── Helper: fetch full scene context for characters ───────────────────────
async function fetchSceneContext(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return { dossiers: [], charBlocks: '' };

  // Fetch rich dossiers
  const chars = await db.RegistryCharacter.findAll({
    where: { registry_id: registryId, character_key: characterKeys },
    attributes: [
      'id', 'character_key', 'display_name', 'icon', 'portrait_url',
      'core_desire', 'core_wound', 'core_belief', 'core_fear', 'hidden_want',
      'mask_persona', 'truth_persona', 'character_archetype', 'signature_trait',
      'emotional_baseline', 'aesthetic_dna', 'voice_signature', 'story_presence',
      'evolution_tracking', 'career_status',
      'living_context', 'personality_matrix', 'deep_profile',
      // Depth engine fields — character knowledge
      'body_relationship', 'body_history', 'body_currency', 'body_control_pattern',
      'money_behavior_pattern', 'money_behavior_note',
      'time_orientation_v2', 'time_orientation_note',
      'change_capacity_v2', 'change_conditions', 'change_blocker',
      'circumstance_advantages', 'circumstance_disadvantages',
      'luck_belief', 'luck_belief_vs_stated',
      'self_narrative', 'operative_cosmology_v2', 'cosmology_vs_stated_religion',
      'joy_source', 'joy_accessibility', 'joy_vs_ambition',
      // Depth engine fields — author knowledge (for evaluation agent only)
      'blind_spot', 'blind_spot_category', 'blind_spot_visible_to',
      'actual_narrative', 'narrative_gap_type',
      'foreclosed_category', 'foreclosure_origin', 'foreclosure_vs_stated_want',
    ],
  });

  const dossiers = chars.map(c => c.toJSON());
  if (!dossiers.length) return { dossiers: [], charBlocks: '' };

  // Fetch all relationship edges between characters in the scene
  const charIds = dossiers.map(d => d.id);
  const edges = charIds.length ? await db.sequelize.query(
    `SELECT cr.character_id_a, cr.character_id_b,
            cr.relationship_type, cr.role_tag, cr.family_role,
            cr.status, cr.situation, cr.tension_state, cr.conflict_summary,
            cr.source_knows, cr.target_knows, cr.reader_knows,
            ca.display_name AS char_a_name, ca.character_key AS char_a_key,
            cb.display_name AS char_b_name, cb.character_key AS char_b_key
     FROM character_relationships cr
     JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
     JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
     WHERE cr.confirmed = true
       AND cr.character_id_a IN (:charIds)
       AND cr.character_id_b IN (:charIds)`,
    { replacements: { charIds }, type: db.sequelize.QueryTypes.SELECT }
  ) : [];

  // Group edges by character
  const edgesByChar = {};
  dossiers.forEach(d => { edgesByChar[d.id] = []; });
  edges.forEach(e => {
    // Add from A's perspective
    if (edgesByChar[e.character_id_a]) {
      edgesByChar[e.character_id_a].push({
        person: e.char_b_name,
        character_key: e.char_b_key,
        role_tag: e.role_tag,
        family_role: e.family_role,
        situation: e.situation,
        tension: e.tension_state,
        conflict: e.conflict_summary,
        source_knows: e.source_knows,
        target_knows: e.target_knows,
        reader_knows: e.reader_knows,
      });
    }
    // Add from B's perspective (flipped knowledge)
    if (edgesByChar[e.character_id_b]) {
      edgesByChar[e.character_id_b].push({
        person: e.char_a_name,
        character_key: e.char_a_key,
        role_tag: e.role_tag,
        family_role: e.family_role,
        situation: e.situation,
        tension: e.tension_state,
        conflict: e.conflict_summary,
        source_knows: e.target_knows,
        target_knows: e.source_knows,
        reader_knows: e.reader_knows,
      });
    }
  });

  // Build structured text blocks
  const blocks = dossiers.map(d =>
    buildCharacterBlock(d, edgesByChar[d.id])
  );

  return {
    dossiers,
    charBlocks: blocks.length ? `\n\nCHARACTER DOSSIERS:\n${blocks.join('\n\n')}` : '',
  };
}

// ── Helper: load accumulated story memories for characters in scene ────────
// Enhanced: loads ALL memory types + relationship events for deep continuity
async function loadStoryMemoriesForScene(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';

    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    // Load ALL confirmed memories (expanded from 50 → 80, all types)
    const memories = await db.StorytellerMemory.findAll({
      where: { character_id: charIds, confirmed: true },
      order: [['created_at', 'DESC']],
      limit: 80,
    });

    // Group by type for structured injection
    const byType = {};
    memories.forEach(m => {
      if (!byType[m.type]) byType[m.type] = [];
      byType[m.type].push(m);
    });

    const sections = [];

    // Events — what has HAPPENED (critical for continuity)
    if (byType.event?.length) {
      sections.push('ESTABLISHED EVENTS (facts — do NOT contradict these):\n' +
        byType.event.slice(0, 15).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Relationships
    if (byType.relationship?.length) {
      sections.push('RELATIONSHIP STATE:\n' +
        byType.relationship.slice(0, 10).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Character dynamics
    if (byType.character_dynamic?.length) {
      sections.push('CHARACTER DYNAMICS:\n' +
        byType.character_dynamic.slice(0, 8).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Pain points
    if (byType.pain_point?.length) {
      sections.push('ACCUMULATED PAIN POINTS (build on these, don\'t repeat):\n' +
        byType.pain_point.slice(0, 12).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Belief shifts
    if (byType.belief_shift?.length) {
      sections.push('BELIEF SHIFTS (track where the character is NOW):\n' +
        byType.belief_shift.slice(0, 8).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Transformations
    if (byType.transformation?.length) {
      sections.push('TRANSFORMATIONS (permanent changes):\n' +
        byType.transformation.slice(0, 6).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Constraints
    if (byType.constraint?.length) {
      sections.push('ACTIVE CONSTRAINTS:\n' +
        byType.constraint.slice(0, 6).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Therapy openings
    if (byType.therapy_opening?.length) {
      sections.push('THERAPEUTIC THREADS (unresolved emotional threads to weave in):\n' +
        byType.therapy_opening.slice(0, 5).map(m => `  • [${charMap[m.character_id] || '?'}] ${m.statement}`).join('\n'));
    }
    // Beliefs & goals
    const beliefsAndGoals = [...(byType.belief || []), ...(byType.goal || [])];
    if (beliefsAndGoals.length) {
      sections.push('CURRENT BELIEFS & GOALS:\n' +
        beliefsAndGoals.slice(0, 8).map(m => `  • [${charMap[m.character_id] || '?'}] [${m.type}] ${m.statement}`).join('\n'));
    }

    // Load relationship turning points (recent events)
    let relEventSection = '';
    try {
      const relEvents = await db.sequelize.query(
        `SELECT re.title, re.event_type, re.tension_after, re.relationship_stage,
                ca.display_name AS char_a_name, cb.display_name AS char_b_name
         FROM relationship_events re
         JOIN character_relationships cr ON cr.id = re.relationship_id
         JOIN registry_characters ca ON ca.id = cr.character_id_a
         JOIN registry_characters cb ON cb.id = cr.character_id_b
         WHERE (cr.character_id_a IN (:charIds) OR cr.character_id_b IN (:charIds))
         ORDER BY re.created_at DESC
         LIMIT 10`,
        { replacements: { charIds }, type: db.sequelize.QueryTypes.SELECT }
      );
      if (relEvents.length) {
        relEventSection = '\nRELATIONSHIP TURNING POINTS (recent — inform emotional tone):\n' +
          relEvents.map(e => `  • ${e.char_a_name} ↔ ${e.char_b_name}: ${e.title} [${e.event_type}] → ${e.relationship_stage || '?'}, tension: ${e.tension_after ?? '?'}/10`).join('\n');
      }
    } catch { /* relationship_events table may not exist yet */ }

    // Load social profiles linked to characters in scene (parasocial context)
    let socialSection = '';
    try {
      const socialProfiles = await db.SocialProfile.findAll({
        where: { registry_character_id: charIds, status: { [db.Sequelize.Op.in]: ['crossed', 'finalized'] } },
        attributes: ['handle', 'platform', 'parasocial_function', 'emotional_activation', 'current_trajectory', 'registry_character_id'],
        limit: 5,
      });
      if (socialProfiles.length) {
        socialSection = '\nSOCIAL MEDIA PRESENCE (parasocial dynamics in play):\n' +
          socialProfiles.map(sp => `  • ${sp.handle} (${sp.platform}): ${sp.parasocial_function || ''} — activation: ${sp.emotional_activation || '?'}, trajectory: ${sp.current_trajectory || '?'}`).join('\n');
      }
    } catch { /* social_profiles table may not exist yet */ }

    return sections.length || relEventSection || socialSection
      ? '\n\nSTORY MEMORY (accumulated knowledge — the AI MUST respect these established facts):\n' + sections.join('\n\n') + relEventSection + socialSection
      : '';
  } catch (err) {
    console.error('[loadStoryMemoriesForScene] error:', err?.message);
    return '';
  }
}

// ── Helper: load therapy profiles (psychodynamic depth) ───────────────────
async function loadTherapyProfiles(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';
    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    const profiles = await db.CharacterTherapyProfile.findAll({
      where: { character_id: charIds },
    });
    if (!profiles.length) return '';

    const lines = profiles.map(tp => {
      const name = charMap[tp.character_id] || '?';
      const parts = [`${name}`];
      if (tp.primary_defense) parts.push(`  Primary defense mechanism: ${tp.primary_defense}`);
      // emotional_state is a JSONB object — extract key states
      const es = tp.emotional_state || {};
      if (es.dominant) parts.push(`  Dominant emotional state: ${es.dominant}`);
      if (es.suppressed) parts.push(`  Suppressed emotion: ${es.suppressed}`);
      if (es.volatility) parts.push(`  Emotional volatility: ${es.volatility}`);
      // sensed — things the character senses but hasn't named
      const sensed = Array.isArray(tp.sensed) ? tp.sensed : [];
      if (sensed.length) parts.push(`  Senses but can't name: ${sensed.slice(0, 5).join('; ')}`);
      // known — things the character knows about themselves
      const known = Array.isArray(tp.known) ? tp.known : [];
      if (known.length) parts.push(`  Self-aware of: ${known.slice(0, 5).join('; ')}`);
      // never_knows — things the character will never see
      const never = Array.isArray(tp.never_knows) ? tp.never_knows : [];
      if (never.length) parts.push(`  Blind to (NEVER realizes): ${never.slice(0, 3).join('; ')}`);
      // deja_vu — recurring psychodynamic patterns
      const deja = Array.isArray(tp.deja_vu_events) ? tp.deja_vu_events : [];
      if (deja.length) parts.push(`  Recurring pattern (déjà vu): ${deja.slice(0, 3).join('; ')}`);
      return parts.length > 1 ? parts.join('\n') : null;
    }).filter(Boolean);

    return lines.length
      ? `\n\nPSYCHODYNAMIC PROFILES (shape HOW characters react — their defenses, what they sense but can't name, what they'll never see):\n${lines.join('\n\n')}`
      : '';
  } catch (err) {
    console.error('[loadTherapyProfiles] error:', err?.message);
    return '';
  }
}

// ── Helper: load franchise knowledge (critical narrative rules) ───────────
async function loadFranchiseConstraints(characterKeys) {
  try {
    // Load critical + always-inject franchise knowledge
    const rules = await db.FranchiseKnowledge.findAll({
      where: {
        status: 'active',
        [db.Sequelize.Op.or]: [
          { severity: 'critical' },
          { always_inject: true },
        ],
      },
      attributes: ['title', 'content', 'category', 'severity', 'applies_to'],
      order: [['severity', 'ASC']], // critical first
      limit: 20,
    });
    if (!rules.length) return '';

    // Filter to rules that apply globally or to characters in scene
    const relevant = rules.filter(r => {
      const appliesTo = Array.isArray(r.applies_to) ? r.applies_to : [];
      if (!appliesTo.length || r.always_inject) return true; // global rule
      return characterKeys?.some(k => appliesTo.includes(k));
    });
    if (!relevant.length) return '';

    const lines = relevant.map(r => {
      const sev = r.severity === 'critical' ? '🔒 LOCKED' : '⚠️ IMPORTANT';
      return `  ${sev} [${r.category}] ${r.title}: ${r.content}`;
    });

    return `\n\nFRANCHISE RULES (NEVER violate these — they are authorial law):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadFranchiseConstraints] error:', err?.message);
    return '';
  }
}

// ── Helper: load author notes (intent/plant/watch markers) ────────────────
async function loadAuthorNotes(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';
    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    const notes = await db.AuthorNote.findAll({
      where: {
        entity_type: 'character',
        entity_id: charIds,
        visible_to_amber: true,
      },
      attributes: ['entity_id', 'note_text', 'note_type'],
      order: [['created_at', 'DESC']],
      limit: 15,
    });
    if (!notes.length) return '';

    const lines = notes.map(n => {
      const name = charMap[n.entity_id] || '?';
      const tag = n.note_type?.toUpperCase() || 'NOTE';
      return `  [${tag}] ${name}: ${n.note_text}`;
    });

    return `\n\nAUTHOR'S INTENT (honor these directives — they represent the writer's vision):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadAuthorNotes] error:', err?.message);
    return '';
  }
}

// ── Helper: load world location sensory data ──────────────────────────────
async function loadWorldLocationContext(sceneBrief, characterKeys, registryId) {
  try {
    // Try to find locations via registry universe or associated characters
    const chars = registryId ? await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys || [] },
      attributes: ['id', 'character_key'],
    }) : [];
    const charIds = chars.map(c => c.id);

    // Find locations associated with scene characters
    let locations = [];
    if (charIds.length) {
      locations = await db.WorldLocation.findAll({
        where: {
          [db.Sequelize.Op.or]: charIds.map(id => db.sequelize.where(
            db.sequelize.fn('jsonb_exists', db.sequelize.col('associated_characters'), id),
            true
          )),
        },
        attributes: ['name', 'location_type', 'sensory_details', 'narrative_role', 'description'],
        limit: 5,
      });
    }

    // Fallback: search location names mentioned in the scene brief
    if (!locations.length && sceneBrief) {
      const words = sceneBrief.toLowerCase().split(/\s+/).filter(w => w.length > 4 && /^[a-z]+$/i.test(w)).slice(0, 20);
      if (words.length) {
        locations = await db.WorldLocation.findAll({
          where: {
            [db.Sequelize.Op.or]: words.map(w => ({
              name: { [db.Sequelize.Op.iLike]: `%${w}%` },
            })),
          },
          attributes: ['name', 'location_type', 'sensory_details', 'narrative_role', 'description'],
          limit: 3,
        });
      }
    }

    if (!locations.length) return '';

    const lines = locations.map(loc => {
      const parts = [`${loc.name} (${loc.location_type || 'space'})`];
      if (loc.narrative_role) parts.push(`  Narrative role: ${loc.narrative_role}`);
      const sd = loc.sensory_details || {};
      if (sd.sight) parts.push(`  Sight: ${sd.sight}`);
      if (sd.sound) parts.push(`  Sound: ${sd.sound}`);
      if (sd.smell) parts.push(`  Smell: ${sd.smell}`);
      if (sd.texture) parts.push(`  Texture: ${sd.texture}`);
      if (sd.atmosphere) parts.push(`  Atmosphere: ${sd.atmosphere}`);
      if (loc.description) parts.push(`  ${loc.description}`);
      return parts.join('\n');
    });

    return `\n\nWORLD LOCATIONS (use these sensory details to ground the scene physically):\n${lines.join('\n\n')}`;
  } catch (err) {
    console.error('[loadWorldLocationContext] error:', err?.message);
    return '';
  }
}

// ── Helper: load voice rules (prose-level style patterns) ─────────────────
async function loadVoiceRules(characterKeys) {
  try {
    const rules = await db.VoiceRule.findAll({
      where: {
        status: 'active',
        [db.Sequelize.Op.or]: [
          { character_name: characterKeys || [] },
          { character_name: null }, // series-wide rules
        ],
      },
      attributes: ['character_name', 'rule_text', 'rule_type', 'example_original', 'example_edited'],
      order: [['signal_count', 'DESC']],
      limit: 15,
    });
    if (!rules.length) return '';

    const lines = rules.map(r => {
      const who = r.character_name || 'ALL';
      const example = r.example_edited ? ` (e.g. "${r.example_edited}")` : '';
      return `  [${who}] ${r.rule_type}: ${r.rule_text}${example}`;
    });

    return `\n\nVOICE RULES (prose-level patterns the author has established — maintain these):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadVoiceRules] error:', err?.message);
    return '';
  }
}

// ── Helper: load scene arc metadata from SceneProposal ────────────────────
async function loadSceneArcMetadata(chapterId) {
  if (!chapterId) return '';
  try {
    const proposal = await db.SceneProposal.findOne({
      where: { chapter_id: chapterId, status: { [db.Sequelize.Op.in]: ['accepted', 'adjusted', 'proposed'] } },
      order: [['created_at', 'DESC']],
      attributes: ['arc_stage', 'arc_function', 'emotional_stakes', 'wounds_unaddressed', 'tensions_unresolved', 'scene_type', 'suggested_tone'],
    });
    if (!proposal) return '';

    const parts = [];
    if (proposal.arc_stage) parts.push(`Arc stage: ${proposal.arc_stage}`);
    if (proposal.arc_function) parts.push(`Scene's narrative function: ${proposal.arc_function}`);
    if (proposal.emotional_stakes) parts.push(`Emotional stakes: ${proposal.emotional_stakes}`);
    if (proposal.scene_type && proposal.scene_type !== 'general') parts.push(`Scene type: ${proposal.scene_type}`);
    const wounds = Array.isArray(proposal.wounds_unaddressed) ? proposal.wounds_unaddressed : [];
    if (wounds.length) parts.push(`Wounds yet unaddressed: ${wounds.join('; ')}`);
    const tensions = Array.isArray(proposal.tensions_unresolved) ? proposal.tensions_unresolved : [];
    if (tensions.length) parts.push(`Tensions unresolved: ${tensions.join('; ')}`);

    return parts.length
      ? `\n\nSCENE ARC METADATA (this scene's role in the larger story — write with this PURPOSE):\n  ${parts.join('\n  ')}`
      : '';
  } catch (err) {
    console.error('[loadSceneArcMetadata] error:', err?.message);
    return '';
  }
}

// ── Helper: load continuity timeline context (beats, conflicts, character positions) ──
async function loadContinuityContext(characterKeys, _registryId) {
  if (!characterKeys?.length) return '';
  try {
    if (!db.ContinuityTimeline || !db.ContinuityBeat) return '';

    // Find active timelines that have beats involving characters in this scene
    const timelines = await db.ContinuityTimeline.findAll({
      where: { status: 'active' },
      include: [{
        model: db.ContinuityBeat, as: 'beats',
        include: [{ model: db.ContinuityCharacter, as: 'characters', through: { attributes: [] } }],
        order: [['sort_order', 'ASC']],
      }],
      limit: 5,
    });
    if (!timelines.length) return '';

    const sections = [];
    for (const tl of timelines) {
      const beats = tl.beats || [];
      if (!beats.length) continue;

      // Filter to beats involving scene characters (match by name)
      const charSet = new Set(characterKeys.map(k => k.toLowerCase()));
      const relevantBeats = beats.filter(b =>
        (b.characters || []).some(c => charSet.has((c.name || '').toLowerCase()))
      );
      if (!relevantBeats.length) continue;

      const beatLines = relevantBeats.slice(-10).map(b => {
        const charNames = (b.characters || []).map(c => c.name).join(', ');
        return `  [${b.time_tag || '?'}] ${b.name} @ ${b.location || '?'} — ${charNames}`;
      });
      sections.push(`Timeline "${tl.title}" (${tl.season_tag || 'active'}):\n${beatLines.join('\n')}`);
    }

    // Detect same-time conflicts across beats
    const allBeats = timelines.flatMap(tl => tl.beats || []);
    const conflicts = [];
    for (let i = 0; i < allBeats.length; i++) {
      for (let j = i + 1; j < allBeats.length; j++) {
        const a = allBeats[i], b = allBeats[j];
        if (a.time_tag && a.time_tag === b.time_tag && a.location !== b.location) {
          const aChars = (a.characters || []).map(c => c.name);
          const bChars = (b.characters || []).map(c => c.name);
          const overlap = aChars.filter(n => bChars.includes(n));
          if (overlap.length) {
            conflicts.push(`  ⚠ ${overlap.join(', ')} at "${a.time_tag}" — in "${a.location}" AND "${b.location}"`);
          }
        }
      }
    }
    if (conflicts.length) {
      sections.push('CONTINUITY CONFLICTS (characters in two places at once — avoid or acknowledge):\n' + conflicts.join('\n'));
    }

    return sections.length
      ? `\n\nCONTINUITY ENGINE (where characters ARE in the timeline — respect this):\n${sections.join('\n\n')}`
      : '';
  } catch (err) {
    console.error('[loadContinuityContext] error:', err?.message);
    return '';
  }
}

// ── Helper: load character growth log (arc progression visible to generation) ──
async function loadCharacterGrowthContext(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    if (!db.CharacterGrowthLog) return '';

    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';

    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    // Load recent growth entries (accepted ones only, most recent first)
    const logs = await db.CharacterGrowthLog.findAll({
      where: {
        character_id: charIds,
        author_decision: ['accepted', null], // include unreviewed + accepted
      },
      order: [['created_at', 'DESC']],
      limit: 20,
    });
    if (!logs.length) return '';

    // Group by character
    const grouped = {};
    logs.forEach(l => {
      const name = charMap[l.character_id] || '?';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(l);
    });

    const sections = Object.entries(grouped).map(([name, entries]) => {
      const lines = entries.slice(0, 5).map(e => {
        const flag = e.update_type === 'flagged_contradiction' ? ' ⚠ CONTRADICTION' : '';
        return `  ${e.field_updated}: "${e.previous_value || '—'}" → "${e.new_value}"${flag}${e.growth_source ? ` (${e.growth_source})` : ''}`;
      });
      return `${name} — recent changes:\n${lines.join('\n')}`;
    });

    return `\n\nCHARACTER GROWTH ARC (how these characters have been changing — write with awareness of their trajectory):\n${sections.join('\n\n')}`;
  } catch (err) {
    console.error('[loadCharacterGrowthContext] error:', err?.message);
    return '';
  }
}

// ── Helper: load world state snapshot (temporal grounding) ──
async function loadWorldStateContext(chapterId, bookId) {
  if (!chapterId && !bookId) return '';
  try {
    if (!db.WorldStateSnapshot) return '';

    // Find the most recent snapshot for this chapter/book
    const where = {};
    if (chapterId) where.chapter_id = chapterId;
    else if (bookId) where.book_id = bookId;

    const snapshot = await db.WorldStateSnapshot.findOne({
      where,
      order: [['timeline_position', 'DESC'], ['created_at', 'DESC']],
    });

    // Also get recent timeline events
    let events = [];
    if (db.WorldTimelineEvent) {
      const eventWhere = { is_canon: true };
      if (chapterId) eventWhere.chapter_id = chapterId;
      else if (bookId) eventWhere.book_id = bookId;

      events = await db.WorldTimelineEvent.findAll({
        where: eventWhere,
        order: [['sort_order', 'DESC']],
        limit: 10,
      });
    }

    const sections = [];

    if (snapshot) {
      const parts = [`World State: "${snapshot.snapshot_label}"`];
      const threads = Array.isArray(snapshot.active_threads) ? snapshot.active_threads : [];
      if (threads.length) parts.push(`  Active threads: ${threads.slice(0, 6).map(t => typeof t === 'string' ? t : t.name || JSON.stringify(t)).join('; ')}`);
      const facts = Array.isArray(snapshot.world_facts) ? snapshot.world_facts : [];
      if (facts.length) parts.push(`  Established facts: ${facts.slice(0, 6).map(f => typeof f === 'string' ? f : f.fact || JSON.stringify(f)).join('; ')}`);
      sections.push(parts.join('\n'));
    }

    if (events.length) {
      const eventLines = events.map(e => {
        const impact = e.impact_level !== 'minor' ? ` [${e.impact_level}]` : '';
        const chars = Array.isArray(e.characters_involved) ? e.characters_involved.map(c => c.name || c.id || c).join(', ') : '';
        return `  [${e.story_date || '?'}] ${e.event_name}${impact}${chars ? ` — ${chars}` : ''}`;
      });
      sections.push('Recent timeline events:\n' + eventLines.join('\n'));
    }

    return sections.length
      ? `\n\nWORLD STATE (the current reality of this world — ground the scene in what's TRUE):\n${sections.join('\n\n')}`
      : '';
  } catch (err) {
    console.error('[loadWorldStateContext] error:', err?.message);
    return '';
  }
}

// ── Helper: load character crossing context (digital ↔ narrative boundary) ──
async function loadCharacterCrossingContext(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    if (!db.CharacterCrossing) return '';

    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';

    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    const crossings = await db.CharacterCrossing.findAll({
      where: { character_id: charIds },
      order: [['created_at', 'DESC']],
      limit: 10,
    });
    if (!crossings.length) return '';

    const lines = crossings.map(cx => {
      const name = charMap[cx.character_id] || '?';
      const parts = [`${name}`];
      if (cx.trigger) parts.push(`crossed via: ${cx.trigger}`);
      if (cx.initial_feed_state) parts.push(`feed state at crossing: ${cx.initial_feed_state}`);
      if (cx.performance_gap_score != null) parts.push(`performance gap: ${cx.performance_gap_score}/10`);
      if (cx.gap_proposed_by_amber) parts.push(`gap observed: ${cx.gap_proposed_by_amber}`);
      return `  ${parts.join(' — ')}`;
    });

    return `\n\nCHARACTER CROSSINGS (when digital personas crossed into narrative reality — the gap between performance and truth):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadCharacterCrossingContext] error:', err?.message);
    return '';
  }
}

// ── Helper: load recent social feed context (entanglements + trajectory) ──
async function loadSocialFeedContext(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return '';
  try {
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return '';
    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    // Load social profiles (full field set for deep generation context)
    const profiles = await db.SocialProfile.findAll({
      where: { registry_character_id: charIds },
      attributes: [
        'id', 'registry_character_id', 'handle', 'platform', 'display_name', 'vibe_sentence',
        'follower_tier', 'follower_count_approx', 'post_frequency', 'engagement_rate', 'platform_metrics',
        'content_persona', 'posting_voice', 'comment_energy', 'archetype',
        'adult_content_present', 'adult_content_type', 'adult_content_framing',
        'parasocial_function', 'emotional_activation', 'watch_reason', 'what_it_costs_her',
        'current_trajectory', 'trajectory_detail', 'current_state',
        'moment_log', 'sample_captions', 'sample_comments', 'controversy_history',
        'lala_relevance_score', 'lala_relevance_reason',
        'justawoman_mirror', 'mirror_proposed_by_amber',
        'visibility_tier', 'pinned_post',
      ],
    });
    if (!profiles.length) return '';
    const profileIds = profiles.map(p => p.id);

    // Load recent unresolved entanglement events
    let events = [];
    try {
      events = await db.EntanglementEvent.findAll({
        where: { profile_id: profileIds, resolved: false },
        attributes: ['profile_id', 'event_type', 'description', 'new_state', 'affected_dimensions'],
        order: [['created_at', 'DESC']],
        limit: 8,
      });
    } catch { /* table may not exist */ }

    const profileMap = {};
    profiles.forEach(p => { profileMap[p.id] = p; });

    const sections = [];

    // Profile context (full depth)
    profiles.forEach(p => {
      const name = charMap[p.registry_character_id] || '?';
      const parts = [`${name} — @${p.handle} (${p.platform})`];
      if (p.vibe_sentence) parts.push(`  Vibe: ${p.vibe_sentence}`);
      if (p.follower_tier) parts.push(`  Reach: ${p.follower_tier}${p.follower_count_approx ? ` (~${p.follower_count_approx})` : ''}`);
      if (p.post_frequency) parts.push(`  Post frequency: ${p.post_frequency}`);
      if (p.engagement_rate) parts.push(`  Engagement rate: ${p.engagement_rate}`);
      if (p.content_persona) parts.push(`  Content persona: ${p.content_persona}`);
      if (p.posting_voice) parts.push(`  Posting voice: ${p.posting_voice}`);
      if (p.comment_energy) parts.push(`  Comment energy: ${p.comment_energy}`);
      if (p.archetype) parts.push(`  Archetype: ${p.archetype}`);
      if (p.current_trajectory) parts.push(`  Trajectory: ${p.current_trajectory}${p.trajectory_detail ? ` — ${p.trajectory_detail}` : ''}`);
      if (p.current_state) parts.push(`  Current state: ${p.current_state}`);
      if (p.emotional_activation) parts.push(`  Emotional activation: ${p.emotional_activation}`);
      if (p.parasocial_function) parts.push(`  Parasocial function: ${p.parasocial_function}`);
      if (p.watch_reason) parts.push(`  Why people watch: ${p.watch_reason}`);
      if (p.what_it_costs_her) parts.push(`  What it costs her: ${p.what_it_costs_her}`);
      if (p.adult_content_present) parts.push(`  Adult content: ${p.adult_content_type || 'yes'}${p.adult_content_framing ? ` (${p.adult_content_framing})` : ''}`);
      if (p.justawoman_mirror) parts.push(`  Mirror theme: ${p.justawoman_mirror}`);
      if (p.visibility_tier) parts.push(`  Visibility: ${p.visibility_tier}`);
      const captions = Array.isArray(p.sample_captions) ? p.sample_captions : [];
      if (captions.length) parts.push(`  Voice example: "${captions[0]}"`);
      const comments = Array.isArray(p.sample_comments) ? p.sample_comments : [];
      if (comments.length) parts.push(`  Comment example: "${comments[0]}"`);
      if (p.pinned_post) parts.push(`  Pinned: ${typeof p.pinned_post === 'string' ? p.pinned_post : JSON.stringify(p.pinned_post)}`);
      const controversies = Array.isArray(p.controversy_history) ? p.controversy_history : [];
      if (controversies.length) parts.push(`  Recent controversies: ${controversies.slice(0, 3).map(c => typeof c === 'string' ? c : c.summary || JSON.stringify(c)).join('; ')}`);
      if (p.lala_relevance_score > 0) parts.push(`  LalaVerse relevance: ${p.lala_relevance_score}/10${p.lala_relevance_reason ? ` — ${p.lala_relevance_reason}` : ''}`);
      sections.push(parts.join('\n'));
    });

    // Active entanglements
    if (events.length) {
      const eventLines = events.map(e => {
        const prof = profileMap[e.profile_id];
        const handle = prof?.handle || '?';
        const dims = Array.isArray(e.affected_dimensions) ? e.affected_dimensions.join(', ') : '';
        return `  @${handle}: ${e.event_type}${e.new_state ? ` → ${e.new_state}` : ''} — ${e.description || ''}${dims ? ` [affects: ${dims}]` : ''}`;
      });
      sections.push('ACTIVE ENTANGLEMENTS (unresolved social events creating pressure):\n' + eventLines.join('\n'));
    }

    return sections.length
      ? `\n\nSOCIAL FEED CONTEXT (the parasocial/digital pressure layer — characters exist in public):\n${sections.join('\n\n')}`
      : '';
  } catch (err) {
    console.error('[loadSocialFeedContext] error:', err?.message);
    return '';
  }
}

// ── POST /generate-story-multi ────────────────────────────────────────────
router.post('/generate-story-multi', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, book_id, scene_brief, characters_in_scene, registry_id, tone_dial, must_include, never_include } = req.body;
    if (!scene_brief) {
      return res.status(400).json({ error: 'scene_brief is required' });
    }

    // Fetch enriched character context (living context + relationships + knowledge asymmetry)
    const { dossiers, charBlocks } = await fetchSceneContext(characters_in_scene, registry_id);

    // Load ALL enrichment layers in parallel — use allSettled so one failure doesn't block generation
    const enrichmentResults = await Promise.allSettled([
      loadStoryMemoriesForScene(characters_in_scene, registry_id),
      loadTherapyProfiles(characters_in_scene, registry_id),
      loadFranchiseConstraints(characters_in_scene),
      loadAuthorNotes(characters_in_scene, registry_id),
      loadWorldLocationContext(scene_brief, characters_in_scene, registry_id),
      loadVoiceRules(characters_in_scene),
      loadSceneArcMetadata(chapter_id),
      loadSocialFeedContext(characters_in_scene, registry_id),
      loadContinuityContext(characters_in_scene, registry_id),
      loadCharacterGrowthContext(characters_in_scene, registry_id),
      loadWorldStateContext(chapter_id, book_id),
      loadCharacterCrossingContext(characters_in_scene, registry_id),
    ]);
    const settled = enrichmentResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.error(`[generate-story-multi] enrichment layer ${i} failed:`, r.reason?.message);
      return '';
    });
    const [storyMemories, therapyCtx, franchiseCtx, authorNoteCtx, worldCtx, voiceRuleCtx, arcCtx, socialCtx, continuityCtx, growthCtx, worldStateCtx, crossingCtx] = settled;

    // Load arc tracking context for POV character (first in scene)
    const povCharKey = characters_in_scene?.[0];
    let arcTrackingSection = '';
    if (povCharKey) {
      try {
        const arcCtxData = await buildArcContext(db, povCharKey);
        arcTrackingSection = buildArcContextPromptSection(arcCtxData);
      } catch (e) {
        console.error('[arc-tracking] failed to load arc context:', e.message);
      }
    }

    const fullCharBlocks = charBlocks + storyMemories + therapyCtx + franchiseCtx + authorNoteCtx + worldCtx + voiceRuleCtx + arcCtx + socialCtx + continuityCtx + growthCtx + worldStateCtx + crossingCtx + arcTrackingSection;

    const genOpts = { characters_in_scene: characters_in_scene || [], charBlocks: fullCharBlocks, tone_dial, dossiers, must_include, never_include };
    const promptA = buildGenerationPrompt({ scene_brief, voice_key: 'voice_a', ...genOpts });
    const promptB = buildGenerationPrompt({ scene_brief, voice_key: 'voice_b', ...genOpts });
    const promptC = buildGenerationPrompt({ scene_brief, voice_key: 'voice_c', ...genOpts });

    // Build voice system prompts enriched with character wounds/desires
    const VOICE_SYSTEM = buildVoiceSystem(dossiers);

    // Generate all 3 voices in parallel (blind — each voice doesn't see the others)
    // Each voice gets its own 2 tones from the full palette of 6
    req.setTimeout(300000); // 5 min for long AI generation
    const [resultA, resultB, resultC] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: VOICE_SYSTEM.voice_a,
        messages: [{ role: 'user', content: promptA }],
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: VOICE_SYSTEM.voice_b,
        messages: [{ role: 'user', content: promptB }],
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: VOICE_SYSTEM.voice_c,
        messages: [{ role: 'user', content: promptC }],
      }),
    ]);

    const storyA = resultA.content?.[0]?.text || '';
    const storyB = resultB.content?.[0]?.text || '';
    const storyC = resultC.content?.[0]?.text || '';

    // Persist as a StorytellerStory record
    const charKey = (characters_in_scene || ['ensemble'])[0];
    const maxNum = await db.StorytellerStory.max('story_number', { where: { character_key: charKey } });
    const nextStoryNumber = (maxNum || 0) + 1;
    const story = await db.StorytellerStory.create({
      character_key: charKey,
      story_number: nextStoryNumber,
      title: `Eval Scene — ${(scene_brief || '').slice(0, 80)}`,
      text: '',
      phase: 'establishment',
      story_type: 'eval_scene',
      status: 'pending_evaluation',
      chapter_id: chapter_id || null,
      book_id: book_id || null,
      scene_brief,
      tone_dial: Array.isArray(tone_dial) ? tone_dial.join(', ') : (tone_dial || 'literary'),
      characters_in_scene,
      must_include: must_include || null,
      never_include: never_include || null,
      registry_dossiers_used: dossiers,
      story_a: storyA,
      story_b: storyB,
      story_c: storyC,
      task_brief: {
        task: scene_brief,
        phase: 'establishment',
        story_type: 'eval_scene',
        title: `Eval Scene — ${(scene_brief || '').slice(0, 80)}`,
        obstacle: 'Evaluation scene — multi-voice comparison',
        tone_dial: Array.isArray(tone_dial) ? tone_dial.join(', ') : (tone_dial || 'literary'),
        characters_in_scene,
      },
    });

    const wordCount = (t) => (t || '').split(/\s+/).filter(Boolean).length;

    // Compute token usage
    const tokenUsage = {
      input: (resultA.usage?.input_tokens || 0) + (resultB.usage?.input_tokens || 0) + (resultC.usage?.input_tokens || 0),
      output: (resultA.usage?.output_tokens || 0) + (resultB.usage?.output_tokens || 0) + (resultC.usage?.output_tokens || 0),
    };

    // Build enrichment summary so frontend can show what data was loaded
    const enrichment_loaded = {
      therapy_profiles: therapyCtx.length > 0,
      franchise_rules: franchiseCtx.length > 0,
      author_notes: authorNoteCtx.length > 0,
      world_locations: worldCtx.length > 0,
      voice_rules: voiceRuleCtx.length > 0,
      scene_arc: arcCtx.length > 0,
      social_feed: socialCtx.length > 0,
      story_memories: storyMemories.length > 0,
      continuity_engine: continuityCtx.length > 0,
      character_growth: growthCtx.length > 0,
      world_state: worldStateCtx.length > 0,
      character_crossings: crossingCtx.length > 0,
    };

    return res.json({
      success: true,
      story_id: story.id,
      stories: {
        voice_a: { text: storyA, word_count: wordCount(storyA) },
        voice_b: { text: storyB, word_count: wordCount(storyB) },
        voice_c: { text: storyC, word_count: wordCount(storyC) },
      },
      token_usage: tokenUsage,
      enrichment_loaded,
    });
  } catch (err) {
    console.error('[generate-story-multi]', err?.message);
    if (res.headersSent) return res.end();
    return res.status(500).json({ error: err?.message || 'Multi-generation failed' });
  }
});

// ── POST /evaluate-stories ────────────────────────────────────────────────
router.post('/evaluate-stories', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.story_a || !story.story_b || !story.story_c) {
      return res.status(400).json({ error: 'All three story variants must exist before evaluation' });
    }

    // Build author-knowledge block for evaluation agent (never shown to voice generation agents)
    let authorKnowledgeBlock = '';
    if (story.registry_dossiers_used?.length) {
      const akLines = story.registry_dossiers_used
        .map(d => {
          const aLines = buildAuthorKnowledgeLines(d);
          return aLines.length ? `${d.display_name || d.character_key}:\n${aLines.join('\n')}` : null;
        })
        .filter(Boolean);
      if (akLines.length) {
        authorKnowledgeBlock = `\n\nAUTHOR KNOWLEDGE (use for evaluation depth — these truths are invisible to the characters):\n${akLines.join('\n\n')}`;
      }
    }

    // Load franchise constraints + author notes + enrichment context for evaluation
    const charKeys = story.characters_in_scene || [];
    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
    const [evalFranchise, evalAuthorNotes, evalContinuity, evalGrowth, evalWorldState, evalCrossings] = await Promise.all([
      loadFranchiseConstraints(charKeys),
      loadAuthorNotes(charKeys, regId),
      loadContinuityContext(charKeys, regId),
      loadCharacterGrowthContext(charKeys, regId),
      loadWorldStateContext(story.chapter_id, story.book_id),
      loadCharacterCrossingContext(charKeys, regId),
    ]);
    const evalExtraCtx = evalFranchise + evalAuthorNotes + evalContinuity + evalGrowth + evalWorldState + evalCrossings;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: `You are a ruthlessly honest literary editor. Evaluate three blind versions of the same scene. Your PRIMARY task is to create a synthesised version that COMBINES the best elements from ALL three voices into an enhanced final version — do NOT simply pick the winner's text. Return ONLY valid JSON — no markdown fences, no commentary.`,
      messages: [{
        role: 'user',
        content: `Original brief:\n"${story.scene_brief || ''}"\n\nTone dial: ${story.tone_dial || 'literary'}${story.must_include ? `\nMust include: ${story.must_include}` : ''}${story.never_include ? `\nNever include: ${story.never_include}` : ''}${authorKnowledgeBlock}${evalExtraCtx}\n\n=== VOICE A (Depth & Interiority) ===\n${story.story_a}\n\n=== VOICE B (Tension & Momentum) ===\n${story.story_b}\n\n=== VOICE C (Sensory & Desire) ===\n${story.story_c}\n\nReturn JSON:\n{\n  "scores": {\n    "voice_a": { "interiority": 0-10, "desire_tension": 0-10, "specificity": 0-10, "stakes": 0-10, "voice": 0-10, "body_presence": 0-10, "originality": 0-10, "prose_efficiency": 0-10, "scene_fulfillment": 0-10, "total": 0-90, "summary": "one sentence", "best_moment": "direct quote" },\n    "voice_b": { ...same },\n    "voice_c": { ...same }\n  },\n  "winner": "voice_a"|"voice_b"|"voice_c",\n  "winner_reason": "why this version wins",\n  "what_each_brings": { "voice_a": "strength", "voice_b": "strength", "voice_c": "strength" },\n  "proofreading": { "voice_a": ["issue"], "voice_b": ["issue"], "voice_c": ["issue"] },\n  "franchise_violations": ["any narrative rule or locked constraint that was broken — or empty array if none"],\n  "brief_diagnosis": { "score": 0-10, "what_was_missing": "text", "improved_brief": "text" },\n  "synthesis_notes": "Detailed explanation of how you combined elements: which passages/moments came from Voice A, which pacing/structure from Voice B, which sensory details from Voice C, and what you enhanced or rewrote to unify them into a cohesive whole",\n  "approved_version": "A FULLY SYNTHESISED version (2500-3500 words) that COMBINES the strongest elements from ALL three voices using proportional weighting — the highest-scoring voice's approaches to interiority, momentum, and sensory detail should dominate, while layering in the unique strengths of the lower-scoring voices. Take Voice A's best interiority/psychological depth passages, Voice B's best tension/pacing/structural momentum, and Voice C's best sensory details/desire/body language. Weave them together into a unified narrative that is BETTER than any single version. Enhance weak transitions, deepen where all three fell short, and ensure tonal consistency throughout. Verify the synthesis delivers everything the original brief asked for and respects ALL franchise rules."\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    let evaluation;
    try {
      evaluation = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[evaluate-stories] JSON parse failed:', parseErr.message, 'raw length:', raw.length);
      return res.status(422).json({ error: 'Evaluation returned invalid JSON — retry', raw_preview: raw.slice(0, 500) });
    }

    // Persist evaluation + set the synthesised text as the story text
    story.evaluation_result = evaluation;
    story.text = evaluation.approved_version || '';
    story.word_count = (story.text || '').split(/\s+/).filter(Boolean).length;
    story.status = 'evaluated';
    story.pipeline_step = 'evaluate';
    await story.save();

    // Auto-save revision history (synthesis = revision 1)
    try {
      await db.StoryRevision.create({
        story_id,
        revision_number: 1,
        text: story.text,
        word_count: story.word_count,
        revision_type: 'synthesis',
        revision_source: 'evaluation_engine',
        change_summary: `Synthesised from 3 voices. Winner: ${evaluation.winner}. ${evaluation.synthesis_notes?.substring(0, 200) || ''}`,
      });
    } catch { /* StoryRevision table may not exist yet */ }

    // Auto-update pipeline tracking
    try {
      const [pipeline] = await db.PipelineTracking.findOrCreate({
        where: { story_id },
        defaults: { story_id, current_step: 'evaluate', started_at: new Date() },
      });
      await pipeline.update({
        current_step: 'evaluate',
        step_evaluate: { completed_at: new Date(), winner: evaluation.winner, score: evaluation.scores },
      });
    } catch { /* PipelineTracking table may not exist yet */ }

    // Token usage for evaluation
    const evalTokenUsage = {
      input: msg.usage?.input_tokens || 0,
      output: msg.usage?.output_tokens || 0,
    };

    return res.json({ success: true, evaluation, story_id, token_usage: evalTokenUsage });
  } catch (err) {
    console.error('[evaluate-stories]', err?.message);
    return res.status(500).json({ error: err?.message || 'Evaluation failed' });
  }
});

// ── POST /propose-memory ──────────────────────────────────────────────────
router.post('/propose-memory', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.text) return res.status(400).json({ error: 'Story must have approved text first' });

    // Load existing memories for context
    const charKeys = story.characters_in_scene || [];
    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;

    // Look up character_id for the story's character_key
    let characterId = null;
    if (story.character_key && regId) {
      const regChar = await db.RegistryCharacter.findOne({
        where: { character_key: story.character_key, registry_id: regId },
        attributes: ['id'],
      });
      if (regChar) characterId = regChar.id;
    }

    const memWhere = characterId ? { character_id: characterId } : {};
    const [existingMemories, continuityCtx, growthCtx, worldStateCtx] = await Promise.all([
      db.StorytellerMemory.findAll({
        where: memWhere,
        order: [['created_at', 'DESC']],
        limit: 30,
        attributes: ['type', 'statement', 'confidence'],
      }),
      loadContinuityContext(charKeys, regId),
      loadCharacterGrowthContext(charKeys, regId),
      loadWorldStateContext(story.chapter_id, story.book_id),
    ]);

    const memCtx = existingMemories.map(m =>
      `[${m.type}] ${m.statement} (confidence: ${m.confidence})`
    ).join('\n');

    const enrichmentCtx = continuityCtx + growthCtx + worldStateCtx;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a narrative memory architect. Given a story and existing character memories, propose new memories that should be stored. IMPORTANT: Do NOT propose memories that duplicate or closely restate existing memories listed below — only propose genuinely NEW information this scene reveals. Respect the established timeline, character growth arc, and world state provided below. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CHARACTER: ${story.character_key}\n\nEXISTING MEMORIES (do NOT duplicate these):\n${memCtx || '(none yet)'}${enrichmentCtx}\n\nSTORY TEXT:\n${story.text}\n\nPropose memories in JSON:\n{\n  "plot_memories": [\n    { "type": "event|relationship|belief|constraint", "content": "what happened", "weight": 1-10, "reason": "why this matters for future stories" }\n  ],\n  "character_revelations": [\n    { "type": "transformation|pain_point|character_dynamic", "content": "what was revealed", "weight": 1-10, "reason": "why this changes the character" }\n  ]\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    let proposals;
    try {
      proposals = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[propose-memory] JSON parse failed:', parseErr.message);
      return res.status(422).json({ error: 'Memory proposal returned invalid JSON — retry', raw_preview: raw.slice(0, 500) });
    }

    story.plot_memory_proposal = proposals.plot_memories || [];
    story.character_revelation_proposal = proposals.character_revelations || [];
    await story.save();

    return res.json({ success: true, proposals, story_id });
  } catch (err) {
    console.error('[propose-memory]', err?.message);
    return res.status(500).json({ error: err?.message || 'Memory proposal failed' });
  }
});

// ── POST /propose-registry-update ─────────────────────────────────────────
router.post('/propose-registry-update', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Load current registry profiles for characters in scene
    const charKeys = story.characters_in_scene || [];
    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;

    let charProfiles = [];
    if (charKeys.length && regId) {
      charProfiles = await db.RegistryCharacter.findAll({
        where: { registry_id: regId, character_key: charKeys },
      });
    }

    // Load growth + continuity context to prevent contradictory proposals
    const [growthCtx, continuityCtx, worldStateCtx] = await Promise.all([
      loadCharacterGrowthContext(charKeys, regId),
      loadContinuityContext(charKeys, regId),
      loadWorldStateContext(story.chapter_id, story.book_id),
    ]);
    const enrichmentCtx = growthCtx + continuityCtx + worldStateCtx;

    const profileCtx = charProfiles.map(c => {
      const j = c.toJSON();
      return `${j.display_name} (${j.character_key}): desire="${j.core_desire || ''}", wound="${j.core_wound || ''}", hidden_want="${j.hidden_want || ''}", strengths=${JSON.stringify(j.personality_matrix?.strengths || [])}`;
    }).join('\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a character registry curator. After reading a story, propose specific updates to character registry profiles. Respect the character growth history, continuity timeline, and world state provided — do NOT propose changes that contradict established arcs. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CURRENT PROFILES:\n${profileCtx || '(none)'}${enrichmentCtx}\n\nSTORY:\n${story.text}\n\nPropose registry updates in JSON:\n{\n  "updates": [\n    {\n      "character_key": "key",\n      "field": "core_desire|core_wound|hidden_want|core_belief|living_context|voice_signature",\n      "current_value": "what it is now",\n      "proposed_value": "what it should become",\n      "reason": "why this scene changes this"\n    }\n  ]\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    let proposals;
    try {
      proposals = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[propose-registry-update] JSON parse failed:', parseErr.message);
      return res.status(422).json({ error: 'Registry update proposal returned invalid JSON — retry', raw_preview: raw.slice(0, 500) });
    }

    story.registry_update_proposals = proposals.updates || [];
    await story.save();

    return res.json({ success: true, proposals: proposals.updates || [], story_id });
  } catch (err) {
    console.error('[propose-registry-update]', err?.message);
    return res.status(500).json({ error: err?.message || 'Registry update proposal failed' });
  }
});

// ── POST /write-back ──────────────────────────────────────────────────────
router.post('/write-back', optionalAuth, async (req, res) => {
  const { story_id, chapter_id, confirmed_memories, confirmed_registry_updates } = req.body;
  if (!story_id || !chapter_id) {
    return res.status(400).json({ error: 'story_id and chapter_id are required' });
  }

  const transaction = await db.sequelize.transaction();
  try {

    const story = await db.StorytellerStory.findByPk(story_id, { transaction, lock: true });
    if (!story) { await transaction.rollback(); return res.status(404).json({ error: 'Story not found' }); }
    if (!story.text) { await transaction.rollback(); return res.status(400).json({ error: 'No approved text to write back' }); }
    if (story.status === 'written_back') { await transaction.rollback(); return res.status(409).json({ error: 'Story already written back' }); }

    // Verify chapter exists
    const chapter = await db.StorytellerChapter.findByPk(chapter_id, { transaction });
    if (!chapter) { await transaction.rollback(); return res.status(404).json({ error: 'Chapter not found' }); }

    // 1. Write story text as lines in the chapter
    const paragraphs = story.text.split('\n').filter(p => p.trim());
    const existingLines = await db.StorytellerLine.count({ where: { chapter_id }, transaction });
    let lineOrder = existingLines;

    for (const para of paragraphs) {
      await db.StorytellerLine.create({
        chapter_id,
        text: para.trim(),
        sort_order: lineOrder++,
        status: 'approved',
      }, { transaction });
    }

    // 2. Commit confirmed memories — resolve character_id from character_key
    if (confirmed_memories?.length) {
      let charId = null;
      if (story.character_key) {
        const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
        const regChar = regId
          ? await db.RegistryCharacter.findOne({ where: { character_key: story.character_key, registry_id: regId }, attributes: ['id'], transaction })
          : await db.RegistryCharacter.findOne({ where: { character_key: story.character_key }, attributes: ['id'], transaction });
        if (regChar) charId = regChar.id;
      }
      for (const mem of confirmed_memories) {
        await db.StorytellerMemory.create({
          character_id: mem.character_id || charId,
          type: mem.type || 'event',
          statement: mem.content || mem.statement,
          confidence: 1.0,
          confirmed: true,
          confirmed_at: new Date(),
          source_type: 'scene',
          source_ref: `story_${story.story_number}`,
          tags: mem.tags || [],
        }, { transaction });
      }
    }

    // 3. Apply confirmed registry updates (whitelist safe fields)
    const SAFE_REGISTRY_FIELDS = new Set([
      'core_desire', 'core_wound', 'core_belief', 'hidden_want',
      'living_context', 'voice_signature', 'display_name',
      'personality_matrix', 'deep_profile', 'extra_fields',
    ]);
    if (confirmed_registry_updates?.length) {
      for (const upd of confirmed_registry_updates) {
        if (!upd.field || !SAFE_REGISTRY_FIELDS.has(upd.field)) continue;
        const char = await db.RegistryCharacter.findOne({
          where: { character_key: upd.character_key },
          transaction,
        });
        if (char && upd.proposed_value !== undefined) {
          char[upd.field] = upd.proposed_value;
          await char.save({ transaction });
        }
      }
    }

    // 4. Mark story as written back
    story.written_back_at = new Date();
    story.written_back_chapter_id = chapter_id;
    story.memory_confirmed_at = confirmed_memories?.length ? new Date() : story.memory_confirmed_at;
    story.status = 'written_back';
    await story.save({ transaction });

    await transaction.commit();

    // Fire async enrichment pipeline (non-blocking — does not delay response)
    enrichAfterWriteBack(db, {
      story: story.toJSON(),
      chapter: chapter.toJSON(),
      storyText: story.text,
      confirmedMemories: confirmed_memories,
      confirmedRegistryUpdates: confirmed_registry_updates,
    }).catch(err => console.error('[post-write-back enrichment]', err?.message));

    return res.json({
      success: true,
      story_id,
      chapter_id,
      lines_written: paragraphs.length,
      memories_committed: confirmed_memories?.length || 0,
      registry_updates_applied: confirmed_registry_updates?.length || 0,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('[write-back]', err?.message);
    return res.status(500).json({ error: err?.message || 'Write-back failed' });
  }
});

// ── GET /eval-stories/:storyId — fetch story with all evaluation data ─────
router.get('/eval-stories/:storyId', optionalAuth, async (req, res) => {
  try {
    const story = await db.StorytellerStory.findByPk(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json({ story });
  } catch (err) {
    console.error('[eval-stories/get]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to fetch story' });
  }
});

// ── GET /eval-stories/:storyId/enrichment — enrichment status ────────────
router.get('/eval-stories/:storyId/enrichment', optionalAuth, async (req, res) => {
  try {
    const story = await db.StorytellerStory.findByPk(req.params.storyId, {
      attributes: ['id', 'status', 'enrichment_status'],
    });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json({
      story_id: story.id,
      status: story.status,
      enrichment: story.enrichment_status || null,
    });
  } catch (err) {
    console.error('[eval-stories/enrichment]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to fetch enrichment status' });
  }
});

/**
 * POST /scene-revelation
 * Analyze a generated scene for character revelations and propose deep_profile additions.
 * Body: { scene_text, characters_in_scene: [character_key], registry_id }
 * Returns: { revelations: { [character_key]: proposed_deep_profile_additions } }
 */
router.post('/scene-revelation', optionalAuth, async (req, res) => {
  const { scene_text, characters_in_scene, registry_id } = req.body;

  if (!scene_text || !characters_in_scene?.length || !registry_id) {
    return res.status(400).json({ error: 'scene_text, characters_in_scene, and registry_id required' });
  }

  try {
    // Fetch existing dossiers with deep_profile
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id, character_key: characters_in_scene },
      attributes: ['id', 'character_key', 'display_name', 'deep_profile', 'core_wound', 'core_desire', 'hidden_want'],
    });

    if (!chars.length) return res.json({ revelations: {} });

    const charSummaries = chars.map(c => {
      const dp = c.deep_profile || {};
      const filledDims = Object.keys(dp).filter(k => dp[k] && Object.values(dp[k]).some(v => v));
      return `${c.display_name} (${c.character_key}): wound="${c.core_wound || '?'}", desire="${c.core_desire || '?'}", known dimensions: ${filledDims.join(', ') || 'none'}`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a literary analyst extracting character revelations from a scene.

CHARACTERS IN SCENE:
${charSummaries}

Read the scene carefully. For each character, identify what the scene REVEALS about them that was not previously known. Map revelations to the 14 deep_profile dimensions:
life_stage, the_body, class_and_money, religion_and_meaning, race_and_culture, sexuality_and_desire, family_architecture, friendship_and_loyalty, ambition_and_identity, habits_and_rituals, speech_and_silence, grief_and_loss, politics_and_justice, the_unseen

Only propose additions the scene actually demonstrates through action, dialogue, or interiority — not inferences. Use the character's exact behavioral evidence.

Return JSON: { "[character_key]": { "dimension_name": { "field": "value" }, ... }, ... }
Only include characters and dimensions where the scene reveals something new.`,
      messages: [{ role: 'user', content: scene_text.substring(0, 15000) }],
    });

    const raw = response.content?.[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ revelations: {}, note: 'No structured revelations extracted' });
    }
    let revelations;
    try {
      revelations = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[scene-revelation] JSON parse failed:', parseErr.message);
      return res.status(422).json({ error: 'Scene revelation returned invalid JSON', raw_preview: raw.slice(0, 500) });
    }

    return res.json({
      success: true,
      revelations,
      characters: chars.map(c => ({ id: c.id, character_key: c.character_key, display_name: c.display_name })),
    });
  } catch (err) {
    console.error('[scene-revelation]', err?.message);
    return res.status(500).json({ error: err?.message || 'Scene revelation failed' });
  }
});

module.exports = router;
