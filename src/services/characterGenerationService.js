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
const { formatSystemPrompt } = require('./promptCacheHelper');
const { pulsePromptRules } = require('../utils/pulsePlatform');
const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const _DEEP_PROFILE_DIMENSIONS = [
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
/**
 * Whether a new character's social is The Pulse (Evoni, 2026-10-15 and
 * 2026-10-17: "lalaverse social media is The Pulse"). Lala's world is the
 * default; only JustAWoman's real world ("Before Lala", Book 1, or the
 * real_world layer asked for) keeps real apps. A LalaVerse world whose name
 * does not say "Lala" is still on The Pulse.
 */
function onPulseFor(worldContext, layer = null) {
  if (layer) return layer === 'lalaverse';
  const named = `${worldContext?.name || ''} ${worldContext?.description || ''}`;
  return !/before lala|book\s*1\b|justawoman|just a woman|real[\s_-]?world/i.test(named);
}

async function generateFullCharacter({ spark, worldContext, bookContext, existingCharacters = [], layer = null }) {
  const { name, vibe, role } = spark;
  const age = spark.age || null;
  const onPulse = onPulseFor(worldContext, layer);

  // Build the world context string
  const worldString = worldContext
    ? `World: ${worldContext.name}. ${worldContext.description || ''}. Tone: ${worldContext.tone || 'contemporary realism'}.`
    : WORLD_LINES.lalaverse;

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
    generateInteriorArchitecture({ name, vibe, role, worldString, bookString, castString, age }),
    determinesSocialPresence({ name, vibe, role, worldString, onPulse }),
    generateFamilyTree({ name, vibe, role, worldString }),
    generateBelongingMap({ name, vibe, role, worldString }),
  ]);

  // Generate Feed profile if social presence = yes
  let feedProfileProposal = null;
  if (socialPresenceDecision.social_presence) {
    feedProfileProposal = await generateFeedProfile({
      name, vibe, role, worldString,
      interior: interiorArchitecture,
      // Lala's world (the default) has one social app, The Pulse.
      onPulse,
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

// Static system prompt for interior architecture - cached for 90% cost reduction
const INTERIOR_ARCHITECTURE_SYSTEM = `You are generating the complete interior architecture for a character. Generate a complete JSON object with exactly these fields. Every field is required. Be specific, contradictory where appropriate, and never generic.

{
  "real_name": "their real full name, first and last: the name on their ID, fitting their background. Not their social media handle or the name they post under.",
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
    "mobility": "highly_rigid OR conditionally_open OR cyclically_mobile OR highly_fluid OR fixed_by_choice",
    "conditions_for_change": "what would have to happen for this person to actually change",
    "armor_type": "how their wound calcified — what they built to protect themselves"
  },
  "self_narrative": "the story they tell themselves about who they are and why — almost always partially wrong",
  "operative_cosmology": "not their stated religion — the actual logic they use to make meaning. Is the world random, rigged, fair, responsive to effort? How do they explain why things happen to them?",
  "foreclosed_possibility": "what they have secretly given up on — something they no longer believe is available to them in this life",
  "experience_of_joy": "what makes this specific person come completely alive — present, lit up, fully themselves. As specific as the wound.",
  "time_orientation": "past_anchored OR future_oriented OR present_impulsive OR perpetual_waiter OR cyclical",
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

// Sonnet 4.6 with the two-attempt loop (CLAUDE.md, AI conventions).
const INTERIOR_MODELS = ['claude-sonnet-4-6'];

/**
 * generateInteriorArchitecture
 * `known` is what the character already has (an existing character being
 * deepened), so the interior grows out of it rather than from a bare spark.
 * `only` limits the answer to those keys.
 */
async function generateInteriorArchitecture({ name, vibe, role, worldString, bookString, castString, age, known = null, only = null, factsBlock = '', seed = '' }) {
  const isMinor = age != null && age < 18;
  const minorRule = isMinor
    ? `\nIMPORTANT — MINOR SAFEGUARD: This character is a minor (age ${age}). Do NOT generate "sexuality_desire" content. Set it to: "Dimension deferred — character is a minor."\n`
    : '';
  const knownBlock = known && Object.keys(known).length > 0
    ? `\nThis character already exists. Everything below is canon: build the interior out of it and never contradict it.\n${JSON.stringify(known, null, 2)}\n`
    : '';
  const onlyRule = Array.isArray(only) && only.length > 0
    ? `\nReturn ONLY these keys of the JSON object: ${only.join(', ')}. Leave every other key out.\n`
    : '';

  // Dynamic user message with character-specific data only
  const userMessage = `${worldString}
${bookString || ''}
${castString || ''}
${minorRule}${knownBlock}${seed ? `\n${seed}\n` : ''}${factsBlock ? `\n${factsBlock}\n` : ''}${onlyRule}
Character: ${name}
Vibe: ${vibe}
Role in story: ${role}`;

  let response;
  for (const model of INTERIOR_MODELS) {
    try {
      response = await client.messages.create({
        model,
        max_tokens: 8000,
        // Cached system prompt - reduces input cost by ~90% for repeated calls
        system:     formatSystemPrompt(INTERIOR_ARCHITECTURE_SYSTEM),
        messages:   [{ role: 'user', content: userMessage }],
      });
      break;
    } catch (modelErr) {
      console.warn(`[characterGenerationService] interior with ${model} failed:`, modelErr.message);
      if (model === INTERIOR_MODELS[INTERIOR_MODELS.length - 1]) throw modelErr;
    }
  }

  const text  = response.content[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(match ? match[0] : clean);
    // Hard enforcement: strip sexuality_desire for minors regardless of what the model returned
    if (isMinor && parsed.deep_profile) {
      parsed.deep_profile.sexuality_desire = 'Dimension deferred — character is a minor.';
    }
    return parsed;
  } catch {
    console.error('[characterGenerationService] Interior architecture parse failed:', clean.slice(0, 200));
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEEPENING AN EXISTING CHARACTER
// A character who came from the feed (or the old system) has no interior.
// These fill in what is missing, and never touch what is already there.
// ─────────────────────────────────────────────────────────────────────────────

const INTERIOR_FIELDS = [
  'selected_name', // their real name (generated as real_name)
  'want_architecture', 'wound', 'the_mask', 'living_state', 'triggers',
  'blind_spot', 'change_capacity', 'self_narrative', 'operative_cosmology',
  'foreclosed_possibility', 'experience_of_joy', 'time_orientation',
  'dilemma', 'deep_profile',
];
const INTERIOR_TEXT = ['selected_name', 'blind_spot', 'self_narrative', 'operative_cosmology', 'foreclosed_possibility', 'experience_of_joy'];
const INTERIOR_OBJECTS = ['want_architecture', 'wound', 'the_mask', 'living_state', 'change_capacity', 'dilemma', 'deep_profile'];
// The five times (services/characterDepthFields; old names are renamed on the way in).
const { normalizeTimeOrientation, normalizeMobility } = require('./characterDepthFields');

function isFilled(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.values(val).some(isFilled);
  return !!val;
}

/** The interior fields this character is missing, limited to `requested` when given. */
function missingInteriorFields(character, requested = null) {
  const pool = Array.isArray(requested) && requested.length > 0
    ? INTERIOR_FIELDS.filter((f) => requested.includes(f))
    : INTERIOR_FIELDS;
  return pool.filter((f) => !isFilled(character[f]));
}

/** What a generated answer may write: only `fields`, and only values each column takes. */
function interiorUpdates(generated, fields) {
  const updates = {};
  for (const f of fields) {
    // The real name is asked for as real_name, so it is not read as a handle.
    const v = f === 'selected_name' ? generated?.real_name : generated?.[f];
    if (!isFilled(v)) continue;
    if (f === 'time_orientation') {
      const key = normalizeTimeOrientation(String(v).trim().toLowerCase().replace(/[\s-]+/g, '_'));
      if (key) updates[f] = key;
    } else if (f === 'triggers') {
      const list = (Array.isArray(v) ? v : [v]).filter(isFilled);
      if (list.length) updates[f] = list;
    } else if (INTERIOR_TEXT.includes(f)) {
      if (typeof v === 'string') updates[f] = v.trim();
    } else if (INTERIOR_OBJECTS.includes(f)) {
      if (typeof v !== 'object' || Array.isArray(v)) continue;
      // Change capacity's level in the five (services/characterDepthFields).
      updates[f] = f === 'change_capacity' && v.mobility !== undefined ? { ...v, mobility: normalizeMobility(v.mobility) } : v;
    }
  }
  return updates;
}

/**
 * The world line for a character's prompts (docs/CANON.md, "The two worlds").
 * Their `world` decides it; with none saved, their feed profile's layer does.
 * JustAWoman's world is ours (real places, real apps); Lala's world is the
 * LalaVerse, and nothing written from inside it names JustAWoman or says Lala
 * was made. Before 2026-10-16 every character was told "World: LalaVerse".
 */
const WORLD_LINES = {
  'book-1': "World: JustAWoman's world, our real world (Before Lala, Book 1). Real places, real apps, real money. The LalaVerse is only the game JustAWoman is building; this character does not live in it.",
  lalaverse: "World: the LalaVerse, Lala's world. A contemporary world where identity, social media, and commerce intersect; its social app is The Pulse. From inside it, nobody knows JustAWoman exists or that Lala was made: never name JustAWoman or say Lala was built.",
  'series-2': "World: the LalaVerse (series 2). A contemporary world where identity, social media, and commerce intersect; its social app is The Pulse.",
};
function worldOf(character, feedProfile = null) {
  if (WORLD_LINES[character?.world]) return character.world;
  if (feedProfile?.feed_layer === 'real_world') return 'book-1';
  if (feedProfile?.feed_layer) return 'lalaverse';
  return null;
}
function worldLineFor(character, feedProfile = null) {
  const world = worldOf(character, feedProfile);
  return world ? WORLD_LINES[world] : 'World: not set. Keep to what is known about this character; do not place them in a world.';
}

/** What the character already is, for the prompt. Empty values are left out. */
function characterContext(character, feedProfile = null) {
  const known = {};
  const fields = [
    'display_name', 'selected_name', 'world', 'role_type', 'role_label', 'description', 'prose_overview',
    'core_belief', 'core_wound', 'core_desire', 'core_fear', 'hidden_want', 'mask_persona',
    'truth_persona', 'personality', 'signature_trait', 'emotional_baseline', 'pressure_type',
    'pressure_quote', 'character_archetype', 'writer_notes', 'gender', 'pronouns', 'age',
    'ethnicity', 'hometown', 'current_city', 'class_origin', 'current_class', 'family_structure',
    'relationship_status', 'profession', 'career_status', 'aesthetic_dna', 'voice_signature',
    ...INTERIOR_FIELDS,
  ];
  for (const f of fields) if (isFilled(character[f])) known[f] = character[f];
  if (feedProfile) {
    const feed = {};
    for (const f of ['handle', 'platform', 'archetype', 'bio', 'content_persona', 'content_posture',
      'posting_voice', 'real_signal', 'career_pressure', 'city', 'follower_tier', 'vibe_tags']) {
      if (isFilled(feedProfile[f])) feed[f] = feedProfile[f];
    }
    if (Object.keys(feed).length) known.feed_profile = feed;
  }
  return known;
}

/** The events they host or attend, as prompt lines, added to what is known (services/characterEvents). */
function withEvents(known, events) {
  const lines = require('./characterEvents').eventsPromptLines(events);
  return lines ? { ...known, events_they_host_or_attend: lines } : known;
}

/**
 * generateMissingInterior
 * Asks for the missing fields of an existing character, built from what is
 * there and from their facts (factsBlock: services/characterFacts
 * factsPromptBlock; money, lifestyle and status prose must agree with it).
 * Returns the column values to write; writes nothing itself.
 */
async function generateMissingInterior({ character, feedProfile = null, events = [], fields, factsBlock = '' }) {
  // Their typology seed: the root the inner life grows from (step 6a; services/characterTypology).
  const seed = require('./characterTypology').seedBlock(character.typology);
  const name = character.display_name || character.selected_name || 'this character';
  const vibe = character.prose_overview || character.description || feedProfile?.content_persona || feedProfile?.bio || 'not written yet';
  const role = character.role_label || character.role_type || 'supporting';
  const age = Number.isInteger(character.age) ? character.age : null;
  const worldString = worldLineFor(character, feedProfile);
  const generated = await generateInteriorArchitecture({
    name, vibe, role, worldString, age,
    known: withEvents(characterContext(character, feedProfile), events),
    only: fields.map((f) => (f === 'selected_name' ? 'real_name' : f)),
    factsBlock,
    seed,
  });
  return interiorUpdates(generated, fields);
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PRESENCE DECISION
// ─────────────────────────────────────────────────────────────────────────────

async function determinesSocialPresence({ name, vibe, role, worldString, onPulse = false }) {
  const prompt = `${worldString}

Character: ${name}
Vibe: ${vibe}
Role: ${role}

${onPulse
    ? 'Is this character on The Pulse (the LalaVerse\'s one social app; Instagram, TikTok, YouTube and the rest do not exist here)? Consider their role, age, class, ambition, aesthetic, and world context.'
    : 'Does this character have a social media presence? Consider their role, age, class, ambition, aesthetic, and world context.'}

Return JSON only:
{
  "social_presence": true or false,
  "reason": "one sentence explaining why",
  "inferred_platform": "${onPulse ? 'pulse OR none' : 'instagram OR tiktok OR youtube OR twitter OR none'}",
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

async function generateFeedProfile({ name, vibe, role, worldString, interior, onPulse = false }) {
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
${onPulse ? pulsePromptRules('lalaverse') : ''}
Return JSON only:
{
  "handle": "their username — no @ symbol",
  "display_name": "their display name",
  "platform": "${onPulse ? 'pulse' : 'instagram OR tiktok OR youtube OR twitter'}",
  "bio": "their bio — 1-2 sentences in their voice",
  "vibe_tags": ["3-5 aesthetic/content tags"],
  "starting_state": "rising OR peaking OR plateauing",
  "follower_count": a whole number of followers fitting who they are now (emerging under 1,000; nano 1,000-9,999; micro 10,000-49,999; mid 50,000-249,999; macro 250,000-999,999; mega 1,000,000+),
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
  onPulseFor,
  generateInteriorArchitecture,
  worldLineFor,
  worldOf,
  generateMissingInterior,
  missingInteriorFields,
  interiorUpdates,
  characterContext,
  isFilled,
  INTERIOR_FIELDS,
  determinesSocialPresence,
  generateFeedProfile,
  generateFamilyTree,
  generateBelongingMap,
  extractGhostCharacters,
  calculateDepthLevel,
};
