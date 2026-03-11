'use strict';
/**
 * characterGenerationService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A character born into Prime Studios is fully alive the moment they are
 * created. This service fires at creation and produces everything in one event:
 *
 *   Deep Profile (14 dimensions)
 *   Prose Overview
 *   Living State
 *   Want Architecture (surface / real / forbidden)
 *   Wound (with Deep Profile dimension mapping)
 *   The Mask (with divergence map)
 *   Triggers (3-5 destabilization conditions)
 *   Blind Spot (author-only)
 *   Change Capacity
 *   Self-Narrative
 *   Operative Cosmology
 *   Foreclosed Possibility
 *   Experience of Joy
 *   Time Orientation
 *   Dilemma (seeded from wound + want)
 *   Social Presence decision + Feed profile creation if yes
 *   Family Tree (with Ghost Characters)
 *   Belonging Map
 *
 * All outputs require author confirmation before writing to DB.
 * The automation is the proposal. The author is the gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const Anthropic = require('@anthropic-ai/sdk');
const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEEP_PROFILE_DIMENSIONS = [
  'life_stage', 'the_body', 'class_money', 'religion_meaning',
  'race_culture', 'sexuality_desire', 'family_architecture',
  'friendship_loyalty', 'ambition_identity', 'habits_rituals',
  'speech_silence', 'grief_loss', 'politics_justice', 'the_unseen',
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateFullCharacter
 * Takes the author's character spark (name, vibe, role, world context)
 * and returns a complete proposed interior architecture.
 *
 * Nothing is written to DB until author confirms.
 */
async function generateFullCharacter({ spark, worldContext, bookContext, existingCharacters = [] }) {
  const { name, vibe, role } = spark;

  // Build the world context string
  const worldString = worldContext
    ? `World: ${worldContext.name}. ${worldContext.description || ''}. Tone: ${worldContext.tone || 'contemporary realism'}.`
    : 'World: LalaVerse. A contemporary world where identity, social media, and commerce intersect.';

  const bookString = bookContext
    ? `Book: ${bookContext.title}. This character belongs to this narrative moment.`
    : '';

  const castString = existingCharacters.length > 0
    ? `Existing cast: ${existingCharacters.map(c => `${c.selected_name} (${c.role_type})`).join(', ')}.`
    : '';

  // Run generation in parallel where possible
  const [
    interiorArchitecture,
    socialPresenceDecision,
    familyTree,
    belongingMap,
  ] = await Promise.all([
    generateInteriorArchitecture({ name, vibe, role, worldString, bookString, castString }),
    determinesSocialPresence({ name, vibe, role, worldString }),
    generateFamilyTree({ name, vibe, role, worldString }),
    generateBelongingMap({ name, vibe, role, worldString }),
  ]);

  // Generate Feed profile if social presence = yes
  let feedProfileProposal = null;
  if (socialPresenceDecision.social_presence) {
    feedProfileProposal = await generateFeedProfile({
      name, vibe, role, worldString,
      interior: interiorArchitecture,
    });
  }

  // Extract ghost characters from family tree
  const ghostCharacters = extractGhostCharacters({
    familyTree,
    existingCharacters,
    characterName: name,
  });

  return {
    // What gets written to registry_characters
    proposed: {
      selected_name:           name,
      depth_level:             'breathing',  // newly generated character starts at breathing
      want_architecture:       interiorArchitecture.want_architecture,
      wound:                   interiorArchitecture.wound,
      the_mask:                interiorArchitecture.the_mask,
      living_state:            interiorArchitecture.living_state,
      triggers:                interiorArchitecture.triggers,
      blind_spot:              interiorArchitecture.blind_spot,
      change_capacity:         interiorArchitecture.change_capacity,
      self_narrative:          interiorArchitecture.self_narrative,
      operative_cosmology:     interiorArchitecture.operative_cosmology,
      foreclosed_possibility:  interiorArchitecture.foreclosed_possibility,
      experience_of_joy:       interiorArchitecture.experience_of_joy,
      time_orientation:        interiorArchitecture.time_orientation,
      dilemma:                 interiorArchitecture.dilemma,
      deep_profile:            interiorArchitecture.deep_profile,
      prose_overview:          interiorArchitecture.prose_overview,
      social_presence:         socialPresenceDecision.social_presence,
      social_presence_reason:  socialPresenceDecision.reason,
      family_tree:             familyTree,
      belonging_map:           belongingMap,
      ghost_characters:        ghostCharacters,
      generation_context: {
        world_id:           worldContext?.id   || null,
        book_id:            bookContext?.id    || null,
        generated_at:       new Date().toISOString(),
        generation_version: '2.0',
      },
    },
    // Feed profile proposal — separate creation event
    feed_profile_proposal: feedProfileProposal,
    // Ghost characters for author review
    ghost_characters: ghostCharacters,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERIOR ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────

async function generateInteriorArchitecture({ name, vibe, role, worldString, bookString, castString }) {
  const prompt = `${worldString}
${bookString}
${castString}

You are generating the complete interior architecture for a character.

Character: ${name}
Vibe: ${vibe}
Role in story: ${role}

Generate a complete JSON object with exactly these fields. Every field is required. Be specific, contradictory where appropriate, and never generic.

{
  "want_architecture": {
    "surface_want": "what they say they want — the public ambition",
    "real_want": "what they actually want underneath — may contradict surface",
    "forbidden_want": "what they want but will not admit even to themselves — should feel dangerous or shameful to them"
  },
  "wound": {
    "description": "the formative experience that reorganized how they move through the world",
    "origin_period": "when this happened — childhood, adolescence, last year, etc.",
    "deep_profile_dimensions_affected": ["list of dimensions from: life_stage, the_body, class_money, religion_meaning, race_culture, sexuality_desire, family_architecture, friendship_loyalty, ambition_identity, habits_rituals, speech_silence, grief_loss, politics_justice, the_unseen"],
    "downstream_effects": "how the wound manifests in daily behavior — specific, not abstract"
  },
  "the_mask": {
    "description": "the self they lead with publicly — the performance",
    "divergence_map": ["list of ways the mask diverges from the deep profile — each divergence is a potential plot point"],
    "feed_profile_is_mask": true or false
  },
  "living_state": {
    "current_situation": "where they are in their life right now",
    "active_tension": "what is currently unresolved",
    "momentum": "what direction their life is moving"
  },
  "triggers": [
    "specific condition 1 that destabilizes them and pulls them out of their mask",
    "specific condition 2",
    "specific condition 3",
    "specific condition 4 (optional)",
    "specific condition 5 (optional)"
  ],
  "blind_spot": "something true about this character that they cannot see — author-only knowledge",
  "change_capacity": {
    "mobility": "rigid OR fluid OR conditional",
    "conditions_for_change": "what would have to happen for this person to actually change",
    "armor_type": "how their wound calcified — what they built to protect themselves"
  },
  "self_narrative": "the story they tell themselves about who they are and why — almost always partially wrong",
  "operative_cosmology": "not their stated religion — the actual logic they use to make meaning. Is the world random, rigged, fair, responsive to effort? How do they explain why things happen to them?",
  "foreclosed_possibility": "what they have secretly given up on — something they no longer believe is available to them in this life",
  "experience_of_joy": "what makes this specific person come completely alive — present, lit up, fully themselves. As specific as the wound.",
  "time_orientation": "past_anchored OR future_obsessed OR impulsive_present OR waiting",
  "dilemma": {
    "central_tension": "the core impossible choice this character carries",
    "option_a": "one horn of the dilemma",
    "option_b": "the other horn",
    "what_both_cost": "what is lost no matter which way they go"
  },
  "deep_profile": {
    "life_stage": "their current life stage and what it costs them",
    "the_body": "physical presence, how they experience their body vs how others read it, where stress and grief live physically",
    "class_money": "their money behavior pattern — not status label but how they actually move when money is present or absent",
    "religion_meaning": "their actual meaning-making system",
    "race_culture": "how race and culture shape their interior life and public navigation",
    "sexuality_desire": "desire as it actually functions for them — not orientation label but lived experience",
    "family_architecture": "the structure of their family and what it produced in them",
    "friendship_loyalty": "how they do friendship — what they give, what they withhold, who they choose",
    "ambition_identity": "what they are building and how it defines them",
    "habits_rituals": "the private behaviors that reveal who they actually are",
    "speech_silence": "what they say easily, what they cannot say, what they say wrong",
    "grief_loss": "what they have lost and how they carry it",
    "politics_justice": "how they understand fairness and power in the world",
    "the_unseen": "what is operating in them that they have no language for yet"
  },
  "prose_overview": "A single paragraph in close third-person italic voice that captures who this person is — not a summary of their attributes but a felt sense of their presence. 80-120 words. The kind of paragraph that makes a reader feel they already know this person."
}

Return ONLY the JSON object. No preamble. No explanation.`;

  const response = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.error('[characterGenerationService] Interior architecture parse failed:', clean.slice(0, 200));
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PRESENCE DECISION
// ─────────────────────────────────────────────────────────────────────────────

async function determinesSocialPresence({ name, vibe, role, worldString }) {
  const prompt = `${worldString}

Character: ${name}
Vibe: ${vibe}
Role: ${role}

Does this character have a social media presence? Consider their role, age, class, ambition, aesthetic, and world context.

Return JSON only:
{
  "social_presence": true or false,
  "reason": "one sentence explaining why",
  "inferred_platform": "instagram OR tiktok OR youtube OR twitter OR none",
  "inferred_handle_style": "brief description of what their handle would feel like"
}`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return { social_presence: false, reason: 'Could not determine', inferred_platform: 'none' }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED PROFILE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function generateFeedProfile({ name, vibe, role, worldString, interior }) {
  const maskDesc = interior?.the_mask?.description || '';
  const ambition = interior?.deep_profile?.ambition_identity || '';

  const prompt = `${worldString}

Character: ${name}
Vibe: ${vibe}
Role: ${role}
Their mask: ${maskDesc}
Their ambition: ${ambition}

Generate their social media profile. The profile should reflect their mask, not their deep interior.
The gap between the Feed profile and the Deep Profile is where the story lives.

Return JSON only:
{
  "handle": "their username — no @ symbol",
  "display_name": "their display name",
  "platform": "instagram OR tiktok OR youtube OR twitter",
  "bio": "their bio — 1-2 sentences in their voice",
  "vibe_tags": ["3-5 aesthetic/content tags"],
  "starting_state": "rising OR peaking OR plateauing",
  "follower_range": "nano (1k-10k) OR micro (10k-100k) OR mid (100k-500k) OR macro (500k+)",
  "content_posture": "what they post about — their performed self",
  "gap_from_deep_profile": "one sentence describing the gap between who they perform and who they actually are"
}`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY TREE
// ─────────────────────────────────────────────────────────────────────────────

async function generateFamilyTree({ name, vibe, role, worldString }) {
  const prompt = `${worldString}

Character: ${name}
Vibe: ${vibe}
Role: ${role}

Generate their family structure. Family members are Ghost Characters — they exist and can be promoted to full registry entries.

Return JSON only:
{
  "members": [
    {
      "name": "full name",
      "relation": "mother/father/sibling/etc",
      "age": 00,
      "alive": true,
      "personality_sketch": "one sentence",
      "social_media_presence": true or false,
      "relationship_to_character": "the emotional dynamic in one sentence"
    }
  ],
  "generational_wound": "the pattern that repeats across generations without anyone naming it",
  "family_relationship_to_money": "how money functions in this family",
  "family_relationship_to_faith": "how religion/meaning operates in this family",
  "family_relationship_to_ambition": "what the family believes about getting ahead",
  "structural_facts": "marriages, divorces, estrangements, losses — the architecture",
  "characters_emotional_stance": "how they feel about where they came from — proud, ashamed, complicated, desperate to escape, desperate to return"
}`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// BELONGING MAP
// ─────────────────────────────────────────────────────────────────────────────

async function generateBelongingMap({ name, vibe, role, worldString }) {
  const prompt = `${worldString}

Character: ${name}
Vibe: ${vibe}
Role: ${role}

What groups, communities, and institutions shape this character's identity?
Include places they were excluded from — exclusion carries as much weight as belonging.

Return JSON only:
{
  "belongs_to": [
    {
      "name": "group/community/institution name",
      "type": "church/friend_group/professional/online/neighborhood/cultural/school/movement",
      "how_long": "duration",
      "what_it_gives_them": "one sentence",
      "what_it_costs_them": "one sentence"
    }
  ],
  "excluded_from": [
    {
      "name": "group they could not or cannot access",
      "why": "reason for exclusion",
      "what_it_means_to_them": "how they carry this"
    }
  ]
}`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST CHARACTER EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractGhostCharacters({ familyTree, existingCharacters, characterName }) {
  if (!familyTree?.members) return [];
  const existingNames = new Set(existingCharacters.map(c =>
    (c.selected_name || '').toLowerCase()
  ));
  return familyTree.members
    .filter(m => m.name && !existingNames.has(m.name.toLowerCase()))
    .map(m => ({
      name:         m.name,
      relation:     m.relation,
      mentioned_in: `${characterName} family tree`,
      mention_count: 1,
      promoted:     false,
      sketch:       m.personality_sketch || '',
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH LEVEL CALCULATOR
// Called when updating a character to auto-calculate their depth level
// ─────────────────────────────────────────────────────────────────────────────

function calculateDepthLevel(character) {
  const has = (field) => {
    const val = character[field];
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return !!val;
  };

  // Alive: full interior + entanglements + voice distinct
  const aliveFields = ['want_architecture', 'wound', 'the_mask', 'triggers',
    'blind_spot', 'dilemma', 'deep_profile', 'prose_overview'];
  if (aliveFields.every(has)) return 'alive';

  // Active: entangled with Feed or other characters
  if (has('feed_profile_id') || has('living_state')) return 'active';

  // Breathing: deep profile populated
  if (has('deep_profile') || has('wound') || has('want_architecture')) return 'breathing';

  // Sparked: handle/vibe only
  return 'sparked';
}

module.exports = {
  generateFullCharacter,
  generateInteriorArchitecture,
  determinesSocialPresence,
  generateFeedProfile,
  generateFamilyTree,
  generateBelongingMap,
  extractGhostCharacters,
  calculateDepthLevel,
};
