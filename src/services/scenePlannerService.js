'use strict';

/**
 * Scene Planner Service — AI brain for mapping scenes to beats.
 *
 * Loads available scene sets for the show, calls Claude with the
 * Episode Brief + 14-beat structure + each scene's script_context,
 * returns a JSON plan grounding each beat in real location details.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { ScenePlan, SceneSet, SceneSetEpisode, SceneAngle } = require('../models');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// 14-beat canonical episode structure
const BEAT_STRUCTURE = [
  { number: 1, name: 'Opening Ritual', typical_location: 'HOME_BASE', description: 'Lala in her space — sets the emotional tone for the episode' },
  { number: 2, name: 'Login Sequence', typical_location: 'HOME_BASE', description: 'Checking phone/social — receives the episode catalyst' },
  { number: 3, name: 'Welcome', typical_location: 'HOME_BASE', description: 'Greeting the audience — introduces the episode question' },
  { number: 4, name: 'Interruption Pulse 1', typical_location: 'HOME_BASE', description: 'First disruption — text, call, memory — raises stakes' },
  { number: 5, name: 'Reveal', typical_location: 'CLOSET', description: 'The outfit/look reveal — wardrobe becomes part of the narrative' },
  { number: 6, name: 'Strategic Reaction', typical_location: 'HOME_BASE', description: 'Processing the reveal — doubt, confidence, or strategy shift' },
  { number: 7, name: 'Interruption Pulse 2', typical_location: 'TRANSITION', description: 'Second disruption — escalation, complication, or twist' },
  { number: 8, name: 'Transformation Loop', typical_location: 'CLOSET', description: 'Getting ready — the physical and mental transformation' },
  { number: 9, name: 'Reminder/Deadline', typical_location: 'TRANSITION', description: 'Time pressure — the event is approaching, urgency builds' },
  { number: 10, name: 'Event Travel', typical_location: 'TRANSITION', description: 'Moving to the event — anticipation, anxiety, or excitement' },
  { number: 11, name: 'Event Outcome', typical_location: 'EVENT_LOCATION', description: 'The main event — what happens when Lala arrives and performs' },
  { number: 12, name: 'Deliverable Creation', typical_location: 'EVENT_LOCATION', description: 'Creating the content/product — the work output of the episode' },
  { number: 13, name: 'Recap Panel', typical_location: 'HOME_BASE', description: 'Reflecting on what happened — audience engagement moment' },
  { number: 14, name: 'Cliffhanger', typical_location: 'HOME_BASE', description: 'Unresolved thread — drives viewer to next episode' },
];

/**
 * Load all available scene sets for a show, with their angles and images.
 */
async function loadAvailableSceneSets(showId) {
  const where = { generation_status: 'complete' };
  if (showId) where.show_id = showId;

  const sets = await SceneSet.findAll({
    where,
    include: [{
      model: SceneAngle,
      as: 'angles',
      attributes: ['id', 'angle_label', 'angle_name', 'still_image_url', 'generation_status'],
      required: false,
    }],
    order: [['name', 'ASC']],
  });

  return sets.map(s => ({
    id: s.id,
    name: s.name,
    scene_type: s.scene_type,
    script_context: s.script_context || s.canonical_description || null,
    angles: (s.angles || [])
      .filter(a => a.generation_status === 'complete' && a.still_image_url)
      .map(a => ({ label: a.angle_label, name: a.angle_name })),
    has_base_image: !!s.base_still_url,
  }));
}

/**
 * Generate a 14-beat scene plan using Claude.
 */
async function generateScenePlan(episodeId, showId, briefData, options = {}) {
  const { save = true } = options;

  // Load available scene sets
  const sceneSets = await loadAvailableSceneSets(showId);

  if (sceneSets.length === 0) {
    throw new Error('No scene sets available. Create scene sets before generating a plan.');
  }

  // Build the AI prompt
  const systemPrompt = `You are a scene planner for "Before Lala", a memoir-style reality show about a woman navigating fashion, social media, and self-discovery.

You map episodes to a 14-beat structure, assigning each beat to a specific scene set (location) with a camera angle, shot type, and emotional direction.

Your assignments must:
- Use ONLY scene sets from the provided list (match by ID)
- Ground each beat in the scene's actual script_context (room details, lighting, objects)
- Create natural visual flow between scenes (don't jump locations randomly)
- Match the episode's narrative_purpose and emotional arc
- Use variety in shot types and angles within each location

Return ONLY valid JSON — an array of 14 beat objects.`;

  const sceneSetList = sceneSets.map(s =>
    `- ID: ${s.id}\n  Name: ${s.name}\n  Type: ${s.scene_type}\n  Context: ${(s.script_context || 'No description').slice(0, 300)}\n  Angles: ${s.angles.map(a => a.label).join(', ') || 'BASE only'}`
  ).join('\n\n');

  const userPrompt = `## Episode Brief
- Archetype: ${briefData.episode_archetype || 'Not set'}
- Narrative Purpose: ${briefData.narrative_purpose || 'Not set'}
- Designed Intent: ${briefData.designed_intent || 'Not set'}
- Forward Hook: ${briefData.forward_hook || 'Not set'}
- Arc: ${briefData.arc_number || '?'} / Position: ${briefData.position_in_arc || '?'}

## Available Scene Sets
${sceneSetList}

## 14-Beat Structure
${BEAT_STRUCTURE.map(b => `${b.number}. ${b.name} (typical: ${b.typical_location}) — ${b.description}`).join('\n')}

## Task
Assign each of the 14 beats to a scene set from the list above. Return a JSON array of 14 objects:

\`\`\`json
[
  {
    "beat_number": 1,
    "beat_name": "Opening Ritual",
    "scene_set_id": "<uuid from list>",
    "angle_label": "WIDE",
    "shot_type": "establishing",
    "emotional_intent": "Warm intimacy — Lala alone in her space, morning light",
    "transition_in": "dissolve",
    "confidence": 0.9
  },
  ...
]
\`\`\`

shot_type options: establishing, medium, close, tracking, cutaway, transition
transition_in options: cut, glow, push, wipe, dissolve, none

Return ONLY the JSON array, no other text.`;

  console.log(`[ScenePlanner] Calling Claude with ${sceneSets.length} scene sets`);

  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Parse the response
  const text = response.content?.[0]?.text || '';
  let beats;
  try {
    // Extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    beats = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[ScenePlanner] Failed to parse AI response:', text.slice(0, 500));
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }

  if (!Array.isArray(beats) || beats.length === 0) {
    throw new Error('AI returned empty or invalid beat plan');
  }

  // Validate and enrich each beat with scene_context
  const sceneSetMap = new Map(sceneSets.map(s => [s.id, s]));
  const enrichedBeats = beats.map((beat, i) => {
    const sceneSet = sceneSetMap.get(beat.scene_set_id);
    return {
      beat_number: beat.beat_number || i + 1,
      beat_name: beat.beat_name || BEAT_STRUCTURE[i]?.name || `Beat ${i + 1}`,
      scene_set_id: sceneSet ? beat.scene_set_id : null,
      angle_label: beat.angle_label || null,
      shot_type: beat.shot_type || null,
      emotional_intent: beat.emotional_intent || null,
      transition_in: beat.transition_in || 'cut',
      scene_context: sceneSet?.script_context?.slice(0, 400) || null,
      ai_confidence: beat.confidence || 0.7,
    };
  });

  // Save to database
  if (save) {
    // Delete existing plan for this episode
    await ScenePlan.destroy({ where: { episode_id: episodeId }, force: true });

    const rows = enrichedBeats.map((beat, i) => ({
      episode_id: episodeId,
      episode_brief_id: null, // will link later if needed
      beat_number: beat.beat_number,
      beat_name: beat.beat_name,
      scene_set_id: beat.scene_set_id,
      angle_label: beat.angle_label,
      shot_type: beat.shot_type,
      emotional_intent: beat.emotional_intent,
      transition_in: beat.transition_in,
      scene_context: beat.scene_context,
      locked: false,
      sort_order: i,
      ai_suggested: true,
      ai_confidence: beat.ai_confidence,
    }));

    await ScenePlan.bulkCreate(rows);
    console.log(`[ScenePlanner] Saved ${rows.length} beats for episode ${episodeId}`);
  }

  return enrichedBeats;
}

/**
 * Get the scene plan formatted for the script generator.
 * Returns locked beats with their scene_context injected.
 */
async function getScenePlanForScriptGenerator(episodeId) {
  const plans = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet,
      as: 'sceneSet',
      attributes: ['id', 'name', 'scene_type', 'script_context', 'canonical_description'],
      required: false,
    }],
  });

  return plans.map(p => ({
    beat_number: p.beat_number,
    beat_name: p.beat_name,
    location: p.sceneSet?.name || 'Unknown',
    location_type: p.sceneSet?.scene_type || null,
    angle: p.angle_label,
    shot_type: p.shot_type,
    emotional_intent: p.emotional_intent,
    transition_in: p.transition_in,
    scene_context: p.scene_context || p.sceneSet?.script_context || p.sceneSet?.canonical_description || null,
    director_note: p.director_note,
    locked: p.locked,
  }));
}

module.exports = { generateScenePlan, getScenePlanForScriptGenerator, BEAT_STRUCTURE };
