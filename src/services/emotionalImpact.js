/**
 * emotionalImpact.js
 * src/services/emotionalImpact.js
 *
 * Emotional Impact Analysis
 *
 * Characters carry the weight of what you write.
 * Every scene leaves residue.
 * When the weight crosses their wound threshold -- they knock.
 *
 * WHEN IT RUNS:
 *   When prose is sent to review from WriteMode.
 *   The system reads what happened to the character in the scene
 *   and shifts their emotional state accordingly.
 *
 * DIMENSIONS (1-10):
 *   anger, fear, grief, shame, hope, betrayal, confusion, longing
 *
 * THE RULE:
 *   Characters don't know they're being analyzed.
 *   The shifts happen beneath the story.
 *   Sometimes a scene that looks calm on the surface
 *   quietly pushes shame to 7.
 */

'use strict';

let anthropic;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch { anthropic = null; }

/* Lazy model loader */
let _models = null;
function getModels() {
  if (!_models) { _models = require('../models'); }
  return _models;
}

const thresholdDetection = (() => {
  try { return require('./thresholdDetection'); }
  catch { return null; }
})();

/* ================================================================
   ANALYZE PROSE — determine emotional shifts for one character
   ================================================================ */

async function analyzeProse({ prose, character, existingState }) {
  if (!anthropic) {
    console.warn('[EmotionalImpact] No Anthropic client — skipping analysis');
    return null;
  }

  const currentState = existingState || {};
  const stateStr = Object.entries(currentState)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'all at baseline (3)';

  const system = `You are a psychological narrative analyst. You read fiction prose and determine the emotional impact on a specific character.

CHARACTER: ${character.selected_name || character.display_name || character.name}
ROLE: ${character.role_type || 'unknown'}
ARCHETYPE: ${character.character_archetype || 'unknown'}
CORE WOUND: ${character.core_wound || 'unknown'}
CORE FEAR: ${character.core_fear || 'unknown'}
CORE DESIRE: ${character.core_desire || 'unknown'}
EMOTIONAL BASELINE: ${character.emotional_baseline || 'unknown'}
PERSONALITY: ${character.personality || 'unknown'}

CURRENT EMOTIONAL STATE: ${stateStr}

DIMENSIONS TO ANALYZE:
  anger (1-10)    — frustration, rage, injustice
  fear (1-10)     — anxiety, dread, threat of loss
  grief (1-10)    — loss, mourning, absence
  shame (1-10)    — inadequacy, exposure, failure
  hope (1-10)     — possibility, expectation, light ahead
  betrayal (1-10) — trust broken, surprise betrayal, deception
  confusion (1-10) — disorientation, identity crisis, lost direction
  longing (1-10)  — desire, want, ache for what's missing

RULES:
-- Read the prose as if this character just lived through it.
-- Some scenes affect them deeply. Some barely register.
-- A scene where their wound is touched shifts more.
-- A calm scene might still create longing or hope.
-- Shifts are typically +1 to +3 for meaningful scenes, -1 for relief.
-- Never drop hope below 1.
-- Consider both surface events AND subtext.
-- The character's core wound amplifies specific dimensions.

RESPOND WITH ONLY A JSON OBJECT of emotional shifts (deltas, not absolutes).
Example: {"fear": 2, "shame": 1, "hope": -1}
Only include dimensions that actually shift. Empty {} if the scene doesn't impact them.
No explanation. No markdown. Just the JSON.`;

  const user = `Read this prose and determine the emotional impact on ${character.selected_name || character.display_name}:\n\n${prose.slice(0, 4000)}`;

  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    console.error('[EmotionalImpact] Analysis failed:', e.message);
    return null;
  }
}

/* ================================================================
   APPLY SHIFTS — update CharacterTherapyProfile.emotional_state
   ================================================================ */

function applyShifts(currentState, deltas) {
  const DIMENSIONS = ['anger', 'fear', 'grief', 'shame', 'hope', 'betrayal', 'confusion', 'longing'];
  const DEFAULT_BASELINE = 3;
  const result = { ...currentState };

  for (const dim of DIMENSIONS) {
    const current = result[dim] || DEFAULT_BASELINE;
    const delta = deltas[dim] || 0;
    // Clamp between 1 and 10
    result[dim] = Math.max(1, Math.min(10, current + delta));
  }

  return result;
}

/* ================================================================
   PROCESS CHAPTER PROSE — full pipeline
   Analyze → shift → save → check thresholds
   ================================================================ */

async function processChapterProse({ prose, characterId, chapterId }) {
  const models = getModels();

  if (!prose || !characterId) {
    return { skipped: true, reason: 'No prose or character' };
  }

  // Load the character
  let character;
  try {
    character = await models.RegistryCharacter.findByPk(characterId);
  } catch (e) {
    console.error('[EmotionalImpact] Could not load character:', e.message);
    return { skipped: true, reason: 'Character not found' };
  }
  if (!character) return { skipped: true, reason: 'Character not found' };

  // Get or create therapy profile
  let profile;
  try {
    [profile] = await models.CharacterTherapyProfile.findOrCreate({
      where: { character_id: characterId },
      defaults: {
        character_id: characterId,
        emotional_state: { anger: 3, fear: 3, grief: 3, shame: 3, hope: 5, betrayal: 3, confusion: 3, longing: 3 },
        baseline: { anger: 3, fear: 3, grief: 3, shame: 3, hope: 5, betrayal: 3, confusion: 3, longing: 3 },
        known: [],
        sensed: [],
        never_knows: [],
        deja_vu_events: [],
        primary_defense: 'rationalize',
        sessions_completed: 0,
        session_log_history: [],
      },
    });
  } catch (e) {
    console.error('[EmotionalImpact] Profile lookup failed:', e.message);
    return { skipped: true, reason: 'Profile error' };
  }

  // Analyze the prose
  const deltas = await analyzeProse({
    prose,
    character: character.toJSON(),
    existingState: profile.emotional_state,
  });

  if (!deltas || Object.keys(deltas).length === 0) {
    console.log(`[EmotionalImpact] ${character.selected_name || character.display_name} — no emotional shift from this scene`);
    return { skipped: false, shifted: false, character: character.selected_name || character.display_name };
  }

  // Apply shifts
  const oldState = { ...(profile.emotional_state || {}) };
  const newState = applyShifts(oldState, deltas);

  // Save updated state
  await profile.update({ emotional_state: newState });

  console.log(`[EmotionalImpact] ${character.selected_name || character.display_name} emotional shift:`,
    Object.entries(deltas).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', '));
  console.log(`[EmotionalImpact] New state:`,
    Object.entries(newState).filter(([, v]) => v >= 6).map(([k, v]) => `${k}:${v}`).join(', ') || 'all below 6');

  // Check thresholds — this is where knocks and emails happen
  if (thresholdDetection) {
    try {
      await thresholdDetection.checkAllThresholds(models);
    } catch (e) {
      console.error('[EmotionalImpact] Threshold check failed (non-fatal):', e.message);
    }
  }

  return {
    skipped: false,
    shifted: true,
    character: character.selected_name || character.display_name,
    deltas,
    oldState,
    newState,
    elevated: Object.entries(newState).filter(([, v]) => v >= 6).map(([k, v]) => ({ dimension: k, value: v })),
  };
}

module.exports = {
  analyzeProse,
  applyShifts,
  processChapterProse,
};
