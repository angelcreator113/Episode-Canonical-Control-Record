'use strict';

/**
 * Prime Studios — World Character Generator + Intimate Scene Generator
 * Mount at: /api/v1/world
 *
 * World Character routes:
 *   POST   /world/generate-ecosystem     — generate full character ecosystem batch
 *   GET    /world/characters             — list world characters (?type= ?status= ?intimate_eligible=)
 *   GET    /world/characters/:id         — single character detail
 *   PUT    /world/characters/:id         — update character
 *   POST   /world/characters/:id/activate — set status = active
 *   POST   /world/characters/:id/archive  — set status = archived
 *   DELETE /world/characters/:id         — delete character + registry + relationships
 *   POST   /world/seed-relationships     — seed relationship candidates for all active chars
 *   GET    /world/batches                — list generation batches
 *
 * Intimate Scene routes:
 *   GET    /world/tension-check          — check all relationships for scene triggers
 *   POST   /world/scenes/generate        — generate intimate scene for character pair
 *   GET    /world/scenes                 — list scenes (?character_id= ?status=)
 *   GET    /world/scenes/:sceneId        — single scene detail
 *   POST   /world/scenes/:sceneId/approve — approve → write to StoryTeller
 *   POST   /world/scenes/:sceneId/continue — generate morning-after continuation
 *   DELETE /world/scenes/:sceneId        — delete draft scene
 *   GET    /world/scenes/:sceneId/continuations — list continuations for scene
 *   POST   /world/continuations/:contId/approve — approve continuation → write to StoryTeller
 */

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

// ── Auth ───────────────────────────────────────────────────────────────────
let optionalAuth;
try {
  const m = require('../middleware/auth');
  optionalAuth = m.optionalAuth || m.authenticate || ((q, r, n) => n());
} catch (e) { optionalAuth = (q, r, n) => n(); }

// ── DB ─────────────────────────────────────────────────────────────────────
const models = require('../models');
const sequelize = models.sequelize;
const Q  = (req, sql, opts) => sequelize.query(sql, { type: sequelize.QueryTypes.SELECT, ...opts });

async function claude(system, user, maxTokens = 4000) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic();
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    if (msg.stop_reason === 'max_tokens') {
      console.warn(`Claude response truncated (max_tokens=${maxTokens}). Consider increasing limit.`);
    }
    return msg.content[0]?.text || '';
  } catch (e) {
    console.error('Claude error:', e.message);
    return null;
  }
}

function parseJSON(raw) {
  try { return JSON.parse((raw || '').replace(/```json|```/g, '').trim()); }
  catch (_) { return null; }
}

function safeJson(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Registry sync helpers ──────────────────────────────────────────────────
// Map World Studio character types → Registry role_type enum
const ROLE_MAP = {
  love_interest:   'special',
  industry_peer:   'mirror',
  mentor:          'support',
  antagonist:      'shadow',
  rival:           'pressure',
  collaborator:    'mirror',
  one_night_stand: 'special',
  recurring:       'special',
};

// Map World Studio character_type → relationship_type for character_relationships
const REL_TYPE_MAP = {
  love_interest:   'Love Interest',
  industry_peer:   'Industry Peer',
  mentor:          'Mentor',
  antagonist:      'Antagonist',
  rival:           'Rival',
  collaborator:    'Collaborator',
  one_night_stand: 'One Night Stand',
  recurring:       'Recurring',
};

// Map World Studio tension_type → character_relationships tension_state
const TENSION_MAP = {
  romantic:     'simmering',
  professional: 'calm',
  creative:     'simmering',
  power:        'volatile',
  unspoken:     'simmering',
};

// Map World Studio character_type → connection_mode
const CONNECTION_MODE_MAP = {
  love_interest:   'IRL',
  industry_peer:   'Professional',
  mentor:          'Professional',
  antagonist:      'IRL',
  rival:           'Professional',
  collaborator:    'Professional',
  one_night_stand: 'Passing',
  recurring:       'IRL',
};

// Natural inter-character pairing rules: [typeA, typeB, rel_type, conn_mode, tension, romantic?]
const INTER_CHAR_PAIRINGS = [
  ['love_interest', 'rival',           'Romantic Rivalry',    'IRL',          'volatile',   true],
  ['love_interest', 'love_interest',   'Love Triangle',       'IRL',          'simmering',  true],
  ['love_interest', 'one_night_stand', 'Complicated History', 'IRL',          'simmering',  true],
  ['industry_peer', 'collaborator',    'Professional Ally',   'Professional', 'calm',       false],
  ['industry_peer', 'industry_peer',   'Industry Connection', 'Professional', 'calm',       false],
  ['industry_peer', 'rival',           'Professional Rival',  'Professional', 'simmering',  false],
  ['mentor',        'antagonist',      'Power Struggle',      'Professional', 'volatile',   false],
  ['mentor',        'collaborator',    'Mentorship',          'Professional', 'calm',       false],
  ['antagonist',    'rival',           'Dark Alliance',       'IRL',          'simmering',  false],
  ['collaborator',  'collaborator',    'Creative Partners',   'Professional', 'calm',       false],
  ['rival',         'rival',           'Mutual Rivalry',      'Professional', 'volatile',   false],
  ['one_night_stand','rival',          'Unexpected Link',     'IRL',          'simmering',  false],
];

// Sexuality compatibility for romantic pairings
function areSexuallyCompatible(a, b) {
  const sA = (a.sexuality || '').toLowerCase();
  const sB = (b.sexuality || '').toLowerCase();
  // If either has no sexuality defined, allow the pairing (data not yet generated)
  if (!sA || !sB) return true;
  // Bisexual/pansexual/queer are compatible with anyone
  const flexA = ['bisexual', 'pansexual', 'queer', 'fluid'].includes(sA);
  const flexB = ['bisexual', 'pansexual', 'queer', 'fluid'].includes(sB);
  if (flexA || flexB) return true;
  // Straight characters: only compatible with opposite orientation markers
  // Gay/lesbian: only compatible with same orientation markers
  // Since we don't track gender separately, use orientation labels:
  // straight + straight = compatible (opposite genders assumed)
  if (sA === 'straight' && sB === 'straight') return true;
  // gay + gay or lesbian + lesbian = compatible
  if (sA === sB && ['gay', 'lesbian'].includes(sA)) return true;
  // All other combos (straight + gay, etc.) = not compatible
  return false;
}

/**
 * Find (or create) a registry for the given world tag so generated characters
 * can be inserted into registry_characters with a valid registry_id.
 */
async function findOrCreateRegistryForWorld(req, worldTag = 'lalaverse') {
  const [existing] = await Q(req,
    `SELECT id FROM character_registries WHERE book_tag = :tag LIMIT 1`,
    { replacements: { tag: worldTag } }
  ).catch(() => []);
  if (existing) return existing.id;

  const regId = uuidv4();
  const title = WORLD_CONFIGS[worldTag]?.title || worldTag;
  await sequelize.query(
    `INSERT INTO character_registries (id, title, book_tag, description, created_at, updated_at)
     VALUES (:id, :title, :tag, 'Auto-created by World Studio', NOW(), NOW())`,
    { replacements: { id: regId, title, tag: worldTag }, type: sequelize.QueryTypes.INSERT }
  );
  return regId;
}

// Backward-compat alias
async function findOrCreateLalaVerseRegistry(req) {
  return findOrCreateRegistryForWorld(req, 'lalaverse');
}

// ── World configurations for multi-world generation ────────────────────────
const WORLD_CONFIGS = {
  'lalaverse': {
    title: 'LalaVerse',
    series_label: 'lalaverse_s1',
    protagonist: 'Lala',
    defaults: {
      city: 'a major city',
      industry: 'content creation and fashion',
      career_stage: 'early career — rising but not arrived',
      era: 'now',
    },
    system_prompt: `You create vivid, complex characters for LalaVerse — a fictional world where Lala, a confident AI fashion game character who became sentient, is building her life and career.

Lala has JustAWoman's entire confidence playbook running invisibly underneath her. She's magnetic, styled, direct. She knows what she wants. She doesn't always know why she wants it.

Create characters who feel like real people — with their own ambitions, contradictions, secrets, and desires. Not props. Not types. People who change Lala's trajectory by existing in her world.

Character types needed:
- love_interest: someone she could actually fall for. Complex. Not available in a simple way.
- industry_peer: another creator or brand figure at a similar level. Collaborative energy that hides competitive undercurrent.
- mentor: someone ahead of her who sees something in her. Their help comes with their own agenda.
- antagonist: not a villain. Someone whose success or presence makes Lala's path harder without meaning to.
- one_night_stand: someone she meets once. The encounter means something even if they don't stay.
- rival: direct competition. They respect each other and can't stand each other.
- collaborator: someone she creates with. Creative chemistry that bleeds into everything else.

For intimate_eligible characters: write intimate_style, intimate_dynamic, and what_lala_feels with honesty and specificity. These inform how scenes between them are generated. Be real about desire, tension, and what makes physical connection between these specific people feel true to who they are.`,
  },
  'book-1': {
    title: 'Book 1 · Before Lala',
    series_label: 'book1_s1',
    protagonist: 'JustAWoman',
    defaults: {
      city: 'a sprawling city that never stops moving',
      industry: 'corporate power, nightlife, and survival',
      career_stage: 'mid-career — established but trapped',
      era: 'now',
    },
    system_prompt: `You create vivid, complex characters for Book 1 · Before Lala — the dramatic thriller world of JustAWoman's real life before Lala existed. This is a world of secrets, power dynamics, betrayal, and raw ambition.

JustAWoman is a woman navigating a world that was never designed for her — corporate politics, dangerous relationships, family pressure, and the kind of loneliness that comes from being strong too long. She's sharp, guarded, magnetic, and exhausted in ways she won't admit.

Create characters who are deeply entangled in her world — people she can't escape, people she shouldn't trust, people she needs despite knowing better. Every character should feel like they have their own gravity.

Character types needed:
- love_interest: someone she shouldn't want. Complex. Probably dangerous in some way — emotionally, professionally, or both.
- industry_peer: someone in her professional orbit. The relationship is never purely professional.
- mentor: someone older or more powerful who sees her potential. Their guidance always costs something.
- antagonist: not a cartoon villain. Someone whose goals directly conflict with hers. They may even be right.
- one_night_stand: an encounter that reveals something about who she is right now. Brief but meaningful.
- rival: someone who mirrors her in uncomfortable ways. The competition is personal.
- collaborator: someone she builds something with. Trust is earned slowly and can shatter fast.

For intimate_eligible characters: write intimate_style, intimate_dynamic, and what she feels with honesty and specificity. This is a grittier, more emotionally charged world than LalaVerse. The intimacy is rawer, more complicated, often tangled up in power and vulnerability.`,
  },
};

/**
 * Create a registry_characters entry from a world_character,
 * then cross-link both records.
 */
async function syncToRegistry(req, worldCharId, c, registryId, worldTag = 'lalaverse') {
  const rcId = uuidv4();
  const charKey = (c.name || 'char').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 80) + '_' + worldCharId.substring(0, 8);
  const roleType = ROLE_MAP[c.character_type] || 'special';

  await sequelize.query(
    `INSERT INTO registry_characters
       (id, registry_id, character_key, display_name, selected_name, subtitle,
        role_type, role_label, appearance_mode, status,
        core_desire, core_fear, signature_trait, description,
        personality_matrix, aesthetic_dna, career_status,
        relationships_map, voice_signature, story_presence,
        evolution_tracking, extra_fields, name_options,
        world_character_id, sort_order, created_at, updated_at)
     VALUES
       (:id, :registry_id, :char_key, :display_name, :selected_name, :subtitle,
        :role_type, :role_label, 'on_page', 'draft',
        :core_desire, :core_fear, :signature_trait, :description,
        :personality_matrix, :aesthetic_dna, :career_status,
        :relationships_map, :voice_signature, :story_presence,
        :evolution_tracking, :extra_fields, :name_options,
        :world_char_id, 0, NOW(), NOW())`,
    {
      replacements: {
        id: rcId,
        registry_id: registryId,
        char_key: charKey,
        display_name: c.name,
        selected_name: c.name,
        subtitle: [c.age_range, c.occupation].filter(Boolean).join(' · ') || null,
        role_type: roleType,
        role_label: c.character_type || null,
        core_desire: c.surface_want || null,
        core_fear: c.real_want || null,
        signature_trait: c.signature || null,
        description: [c.occupation, c.dynamic].filter(Boolean).join('. ') || null,

        personality_matrix: JSON.stringify({
          core_wound: null, desire_line: c.surface_want || null,
          fear_line: c.real_want || null, coping_mechanism: null,
          self_deception: null, at_their_best: null, at_their_worst: null,
        }),
        aesthetic_dna: JSON.stringify({
          era_aesthetic: c.aesthetic || null, color_palette: null,
          signature_silhouette: null, signature_accessories: null,
          glam_energy: null, visual_evolution_notes: null,
        }),
        career_status: JSON.stringify({
          profession: c.occupation || null, career_goal: c.surface_want || null,
          reputation_level: null, brand_relationships: null,
          financial_status: null, public_recognition: null,
          ongoing_arc: c.arc_role || null,
        }),
        relationships_map: JSON.stringify({
          allies: null, rivals: null, mentors: null,
          love_interests: null, business_partners: null,
          dynamic_notes: c.dynamic || null,
          tension_type: c.tension_type || null,
          what_they_want_from_lala: c.what_they_want_from_lala || null,
        }),
        voice_signature: JSON.stringify({
          speech_pattern: null, vocabulary_tone: null,
          catchphrases: c.signature || null,
          internal_monologue_style: null, emotional_reactivity: null,
        }),
        story_presence: JSON.stringify({
          appears_in_books: worldTag,
          current_story_status: c.how_they_meet || null,
          unresolved_threads: null,
          future_potential: c.exit_reason ? 'Will exit' : 'Yes',
        }),
        evolution_tracking: JSON.stringify({
          version_history: null,
          era_changes: c.world_location || null,
          personality_shifts: null,
        }),
        extra_fields: JSON.stringify({
          source: 'world_studio',
          world_character_id: worldCharId,
          sexuality: c.sexuality || null,
          intimate_eligible: c.intimate_eligible || false,
          intimate_style: c.intimate_style || null,
          intimate_dynamic: c.intimate_dynamic || null,
          what_lala_feels: c.what_lala_feels || null,
        }),
        name_options: JSON.stringify([c.name]),
        world_char_id: worldCharId,
      },
      type: sequelize.QueryTypes.INSERT,
    }
  );

  // Update world_characters with the cross-link
  await sequelize.query(
    `UPDATE world_characters SET registry_character_id = :rcId WHERE id = :wcId`,
    { replacements: { rcId, wcId: worldCharId }, type: sequelize.QueryTypes.UPDATE }
  );

  // Auto-seed a relationship candidate linking this character to Lala
  await syncRelationships(rcId, c, registryId);

  return rcId;
}

/**
 * After creating a registry_characters entry, auto-seed a character_relationships
 * row linking the new character to Lala (the protagonist) as an unconfirmed candidate.
 * This feeds the Relationship Engine → Candidates tab.
 */
async function syncRelationships(rcId, c, registryId) {
  try {
    // Find Lala (the protagonist) in the same registry
    // Check role_type first, then fall back to display_name
    let [lala] = await sequelize.query(
      `SELECT id FROM registry_characters
       WHERE registry_id = :registry_id AND role_type = 'protagonist' AND deleted_at IS NULL
       LIMIT 1`,
      { replacements: { registry_id: registryId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!lala) {
      [lala] = await sequelize.query(
        `SELECT id FROM registry_characters
         WHERE registry_id = :registry_id AND LOWER(display_name) = 'lala' AND deleted_at IS NULL
         LIMIT 1`,
        { replacements: { registry_id: registryId }, type: sequelize.QueryTypes.SELECT }
      );
    }
    if (!lala) {
      console.warn('syncRelationships: No protagonist found in registry', registryId);
      return null;
    }
    // Don't create a self-relationship
    if (lala.id === rcId) return null;

    // Check for existing relationship between these two
    const [existing] = await sequelize.query(
      `SELECT id FROM character_relationships
       WHERE (character_id_a = :a AND character_id_b = :b)
          OR (character_id_a = :b AND character_id_b = :a)
       LIMIT 1`,
      { replacements: { a: lala.id, b: rcId }, type: sequelize.QueryTypes.SELECT }
    );
    if (existing) return existing.id;

    const relId = uuidv4();
    await sequelize.query(
      `INSERT INTO character_relationships
         (id, character_id_a, character_id_b, relationship_type,
          connection_mode, lala_connection, status, situation,
          tension_state, pain_point_category, notes,
          confirmed, created_at, updated_at)
       VALUES
         (:id, :char_a, :char_b, :rel_type,
          :conn_mode, 'knows_lala', 'Active', :situation,
          :tension_state, :pain_cat, :notes,
          false, NOW(), NOW())`,
      {
        replacements: {
          id: relId,
          char_a: lala.id,
          char_b: rcId,
          rel_type: REL_TYPE_MAP[c.character_type] || 'Connection',
          conn_mode: CONNECTION_MODE_MAP[c.character_type] || 'IRL',
          situation: c.dynamic || null,
          tension_state: TENSION_MAP[c.tension_type] || 'calm',
          pain_cat: null,
          notes: c.what_they_want_from_lala || null,
        },
        type: sequelize.QueryTypes.INSERT,
      }
    );
    console.log(`syncRelationships: Created candidate relationship ${relId} (Lala ↔ ${c.name})`);
    return relId;
  } catch (err) {
    console.error('syncRelationships error (non-fatal):', err.message);
    return null;
  }
}

/**
 * Seed inter-character relationships (not just Lala-centric).
 * Takes an array of { registry_character_id, name, character_type, tension_type, dynamic }
 * and creates candidate relationships between natural pairings.
 *
 * @param {Array} characters - world chars with registry_character_id set
 * @param {string} registryId - the registry these characters belong to
 * @returns {number} count of relationships created
 */
async function seedInterCharacterRelationships(characters, registryId) {
  let created = 0;
  const pairs = [];

  // Build all possible pairs from INTER_CHAR_PAIRINGS rules
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const a = characters[i];
      const b = characters[j];
      if (!a.registry_character_id || !b.registry_character_id) continue;

      // Try to find a matching pairing rule (check both orderings)
      const rule = INTER_CHAR_PAIRINGS.find(
        ([tA, tB]) =>
          (a.character_type === tA && b.character_type === tB) ||
          (a.character_type === tB && b.character_type === tA)
      );
      if (rule) {
        // For romantic pairings, check sexuality compatibility
        const isRomantic = rule[5];
        if (isRomantic && !areSexuallyCompatible(a, b)) continue;
        pairs.push({ a, b, rule });
      }
    }
  }

  // Limit to avoid flooding: max 5 inter-char relationships per batch
  // Prioritize volatile/simmering tension over calm
  pairs.sort((x, y) => {
    const tensionRank = { volatile: 0, simmering: 1, calm: 2 };
    return (tensionRank[x.rule[4]] ?? 2) - (tensionRank[y.rule[4]] ?? 2);
  });
  const selected = pairs.slice(0, 5);

  for (const { a, b, rule } of selected) {
    const [, , relType, connMode, tension] = rule;
    try {
      // Check if relationship already exists between these two
      const [existing] = await sequelize.query(
        `SELECT id FROM character_relationships
         WHERE (character_id_a = :idA AND character_id_b = :idB)
            OR (character_id_a = :idB AND character_id_b = :idA)
         LIMIT 1`,
        { replacements: { idA: a.registry_character_id, idB: b.registry_character_id }, type: sequelize.QueryTypes.SELECT }
      );
      if (existing) continue;

      const relId = uuidv4();
      // Combine both characters' dynamics for the situation note
      const situation = [a.dynamic, b.dynamic].filter(Boolean).join(' / ') || null;
      const notes = `Inter-character: ${a.name} (${a.character_type}) ↔ ${b.name} (${b.character_type})`;

      await sequelize.query(
        `INSERT INTO character_relationships
           (id, character_id_a, character_id_b, relationship_type,
            connection_mode, lala_connection, status, situation,
            tension_state, pain_point_category, notes,
            confirmed, created_at, updated_at)
         VALUES
           (:id, :char_a, :char_b, :rel_type,
            :conn_mode, 'independent', 'Active', :situation,
            :tension_state, :pain_cat, :notes,
            false, NOW(), NOW())`,
        {
          replacements: {
            id: relId,
            char_a: a.registry_character_id,
            char_b: b.registry_character_id,
            rel_type: relType,
            conn_mode: connMode,
            situation,
            tension_state: tension,
            pain_cat: null,
            notes,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );
      console.log(`seedInterChar: Created ${relType} candidate ${relId} (${a.name} ↔ ${b.name})`);
      created++;
    } catch (err) {
      console.error(`seedInterChar error (${a.name} ↔ ${b.name}):`, err.message);
    }
  }
  return created;
}

// Variable scene length logic based on relationship depth and type
function resolveSceneLength(characterType, sceneType, dynamic) {
  // One-night stands: punchy, electric, not drawn out
  if (sceneType === 'one_night_stand' || characterType === 'one_night_stand') return { min: 400, max: 700,  label: 'short' };
  // First encounters: tension-heavy, slow build
  if (sceneType === 'first_encounter') return { min: 600,  max: 900,  label: 'medium' };
  // Recurring love interest: full, emotionally complex
  if (characterType === 'love_interest' && sceneType === 'recurring') return { min: 900, max: 1400, label: 'long' };
  // Hook up: direct, felt, not sentimental
  if (sceneType === 'hook_up') return { min: 500,  max: 800,  label: 'medium' };
  // Charged moment (almost but not quite): shorter, leaves reader wanting
  if (sceneType === 'charged_moment') return { min: 300,  max: 500,  label: 'short' };
  // Default
  return { min: 600, max: 900, label: 'medium' };
}

// ══════════════════════════════════════════════════════════════════════════════
// WORLD CHARACTER GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

// POST /world/generate-ecosystem
router.post('/world/generate-ecosystem', optionalAuth, async (req, res) => {
  try {
    const {
      show_id,
      world_tag = 'lalaverse',
      world_context = {},
      character_count = 8,
    } = req.body;

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const series_label = req.body.series_label || wCfg.series_label;

    const {
      city           = wCfg.defaults.city,
      industry       = wCfg.defaults.industry,
      career_stage   = wCfg.defaults.career_stage,
      era            = wCfg.defaults.era,
      protagonist    = wCfg.protagonist,
    } = world_context;

    // Fetch existing world characters to avoid duplication
    const existing = await Q(req, `
      SELECT name, character_type, occupation FROM world_characters
      WHERE status != 'archived' ORDER BY created_at DESC LIMIT 20
    `);

    const result = await claude(
      wCfg.system_prompt,

      `Generate ${character_count} world characters for ${wCfg.title}.

PROTAGONIST: ${protagonist}
WORLD: ${city}, ${industry} industry
CAREER STAGE: ${career_stage}
ERA: ${era}

${existing.length > 0 ? `EXISTING CHARACTERS (don't duplicate):\n${existing.map(e => `- ${e.name} (${e.character_type})`).join('\n')}` : ''}

Include at least: 2 love_interest or one_night_stand, 2 industry_peer, 1 mentor, 1 antagonist or rival, 1 collaborator.

Return JSON only:
{
  "characters": [
    {
      "name": "full name",
      "age_range": "e.g. late 20s",
      "occupation": "specific job/role",
      "world_location": "where they exist in ${wCfg.title}",
      "character_type": "love_interest|industry_peer|mentor|antagonist|rival|collaborator|one_night_stand",
      "sexuality": "straight|gay|lesbian|bisexual|pansexual|queer|fluid — be intentional, this drives romantic pairing logic",
      "intimate_eligible": true|false,
      "aesthetic": "how they look, dress, move — specific and visual",
      "signature": "the one thing about them that is unforgettable",
      "surface_want": "what they'd tell you they want",
      "real_want": "what they'd never admit",
      "what_they_want_from_lala": "what they're actually seeking from ${protagonist} specifically",
      "how_they_meet": "the specific scenario — not generic",
      "dynamic": "the texture of their connection with ${protagonist}",
      "tension_type": "romantic|professional|creative|power|unspoken",
      "intimate_style": "how they are in intimate moments — only for intimate_eligible characters, null otherwise",
      "intimate_dynamic": "the specific dynamic between them — only for intimate_eligible, null otherwise",
      "what_lala_feels": "what ${protagonist} physically and emotionally experiences with this person — intimate_eligible only, null otherwise",
      "arc_role": "how this character changes ${protagonist}'s trajectory",
      "exit_reason": "how or why they leave her world, or null if they stay",
      "career_echo_connection": true|false,
      "attracted_to": "who they actually pursue — specific, not a label (e.g. 'men with authority she can dismantle, women who are further ahead than her')",
      "how_they_love": "their connection pattern (e.g. 'avoidant until she isn't, then fully in')",
      "desire_they_wont_admit": "the thing that complicates the above (dimmed, private)",
      "family_layer": "real_world | ${world_tag} | series_2",
      "origin_story": "where they came from before ${protagonist}'s world",
      "public_persona": "how the world sees them",
      "private_reality": "what only close people know"
    }
  ],
  "generation_notes": "brief note on the ecosystem logic — who connects to who, what tensions exist between them"
}`,
      10000
    );

    const parsed = parseJSON(result);
    if (!parsed?.characters?.length) {
      return res.status(500).json({ error: 'Character generation failed — Claude returned no characters' });
    }

    // Create batch record
    const batchId = uuidv4();
    await sequelize.query(
      `INSERT INTO world_character_batches (id, show_id, series_label, world_context, character_count, generation_notes, created_at, updated_at)
       VALUES (:id, :show_id, :label, :context, :count, :notes, NOW(), NOW())`,
      { replacements: { id: batchId, show_id: show_id || null, label: series_label, context: JSON.stringify(world_context), count: parsed.characters.length, notes: parsed.generation_notes || '' }, type: sequelize.QueryTypes.INSERT }
    );

    // Insert each character + sync to registry
    const registryId = await findOrCreateRegistryForWorld(req, world_tag);
    const inserted = [];
    for (const c of parsed.characters) {
      const charId = uuidv4();
      await sequelize.query(
        `INSERT INTO world_characters
           (id, batch_id, name, age_range, occupation, world_location, character_type,
            sexuality, intimate_eligible, aesthetic, signature,
            surface_want, real_want, what_they_want_from_lala,
            how_they_meet, dynamic, tension_type,
            intimate_style, intimate_dynamic, what_lala_feels,
            arc_role, exit_reason, career_echo_connection,
            attracted_to, how_they_love, desire_they_wont_admit,
            relationship_graph, family_layer, origin_story,
            public_persona, private_reality,
            status, current_tension, created_at, updated_at)
         VALUES
           (:id, :batch_id, :name, :age_range, :occupation, :world_location, :char_type,
            :sexuality, :intimate_eligible, :aesthetic, :signature,
            :surface_want, :real_want, :what_from_lala,
            :how_meet, :dynamic, :tension_type,
            :intimate_style, :intimate_dynamic, :what_lala_feels,
            :arc_role, :exit_reason, :career_echo,
            :attracted_to, :how_they_love, :desire_they_wont_admit,
            :relationship_graph, :family_layer, :origin_story,
            :public_persona, :private_reality,
            'draft', 'Stable', NOW(), NOW())`,
        {
          replacements: {
            id: charId, batch_id: batchId,
            name: c.name, age_range: c.age_range || null, occupation: c.occupation || null,
            world_location: c.world_location || null, char_type: c.character_type,
            sexuality: c.sexuality || null,
            intimate_eligible: c.intimate_eligible || false,
            aesthetic: c.aesthetic || null, signature: c.signature || null,
            surface_want: c.surface_want || null, real_want: c.real_want || null,
            what_from_lala: c.what_they_want_from_lala || null,
            how_meet: c.how_they_meet || null, dynamic: c.dynamic || null,
            tension_type: c.tension_type || null,
            intimate_style: c.intimate_style || null, intimate_dynamic: c.intimate_dynamic || null,
            what_lala_feels: c.what_lala_feels || null,
            arc_role: c.arc_role || null, exit_reason: c.exit_reason || null,
            career_echo: c.career_echo_connection || false,
            attracted_to: c.attracted_to || null,
            how_they_love: c.how_they_love || null,
            desire_they_wont_admit: c.desire_they_wont_admit || null,
            relationship_graph: JSON.stringify(c.relationship_graph || []),
            family_layer: c.family_layer || null,
            origin_story: c.origin_story || null,
            public_persona: c.public_persona || null,
            private_reality: c.private_reality || null,
            world_tag: world_tag,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );

      // Sync to canonical registry
      const rcId = await syncToRegistry(req, charId, c, registryId, world_tag);
      inserted.push({ ...c, id: charId, registry_character_id: rcId });
    }

    // Seed inter-character relationships (not just Lala-centric)
    const interCount = await seedInterCharacterRelationships(inserted, registryId);
    console.log(`generate-ecosystem: Seeded ${interCount} inter-character relationship(s)`);

    res.status(201).json({ characters: inserted, batch_id: batchId, count: inserted.length, inter_relationships: interCount, generation_notes: parsed.generation_notes });
  } catch (err) {
    console.error('generate-ecosystem error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /world/characters
router.get('/world/characters', optionalAuth, async (req, res) => {
  try {
    const { character_type, status, intimate_eligible, world_tag } = req.query;
    let where = 'WHERE 1=1';
    const rep = {};
    if (world_tag)         { where += ' AND world_tag = :world_tag';          rep.world_tag = world_tag; }
    if (character_type)    { where += ' AND character_type = :type';         rep.type = character_type; }
    if (status)            { where += ' AND status = :status';                rep.status = status; }
    if (intimate_eligible) { where += ` AND intimate_eligible = ${intimate_eligible === 'true'}`; }

    const characters = await Q(req,
      `SELECT * FROM world_characters ${where} ORDER BY character_type, name`,
      { replacements: rep }
    );
    res.json({ characters, count: characters.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/characters/:id
router.get('/world/characters/:id', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });
    if (!char) return res.status(404).json({ error: 'Character not found' });

    // Fetch their scenes
    const scenes = await Q(req,
      `SELECT id, scene_type, intensity, status, word_count, created_at
       FROM intimate_scenes
       WHERE character_a_id = :id OR character_b_id = :id
       ORDER BY created_at DESC`,
      { replacements: { id: req.params.id } }
    );

    res.json({ character: char, scenes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /world/characters/:id
router.put('/world/characters/:id', optionalAuth, async (req, res) => {
  try {
    const fields = ['name','age_range','occupation','world_location','sexuality','aesthetic','signature','surface_want','real_want',
      'what_they_want_from_lala','how_they_meet','dynamic','tension_type','intimate_style',
      'intimate_dynamic','what_lala_feels','arc_role','exit_reason','current_tension','status',
      'attracted_to','how_they_love','desire_they_wont_admit','relationship_graph',
      'family_layer','origin_story','public_persona','private_reality',
      'gender','ethnicity','species','is_alive','death_date','death_cause','death_impact'];
    const updates = [];
    const rep = { id: req.params.id };
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = :${f}`); rep[f] = req.body[f]; }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    await sequelize.query(`UPDATE world_characters SET ${updates.join(', ')} WHERE id = :id`, { replacements: rep, type: sequelize.QueryTypes.UPDATE });
    const [char] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ character: char });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /world/characters/:id/activate
router.post('/world/characters/:id/activate', optionalAuth, async (req, res) => {
  try {
    await sequelize.query(`UPDATE world_characters SET status = 'active', updated_at = NOW() WHERE id = :id`, { replacements: { id: req.params.id }, type: sequelize.QueryTypes.UPDATE });
    // Sync → registry: accepted
    await sequelize.query(
      `UPDATE registry_characters SET status = 'accepted', updated_at = NOW() WHERE world_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    ).catch(() => {});
    res.json({ activated: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/characters/:id/archive
router.post('/world/characters/:id/archive', optionalAuth, async (req, res) => {
  try {
    await sequelize.query(`UPDATE world_characters SET status = 'archived', updated_at = NOW() WHERE id = :id`, { replacements: { id: req.params.id }, type: sequelize.QueryTypes.UPDATE });
    // Sync → registry: declined
    await sequelize.query(
      `UPDATE registry_characters SET status = 'declined', updated_at = NOW() WHERE world_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    ).catch(() => {});
    res.json({ archived: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /world/characters/:id
router.delete('/world/characters/:id', optionalAuth, async (req, res) => {
  try {
    // Remove linked relationship rows (via registry_characters)
    const [rc] = await Q(req,
      `SELECT id FROM registry_characters WHERE world_character_id = :id`,
      { replacements: { id: req.params.id } }
    ).catch(() => []);
    if (rc) {
      await sequelize.query(
        `DELETE FROM character_relationships WHERE character_id_a = :rcId OR character_id_b = :rcId`,
        { replacements: { rcId: rc.id }, type: sequelize.QueryTypes.DELETE }
      ).catch(() => {});
    }
    // Remove linked registry character
    await sequelize.query(
      `DELETE FROM registry_characters WHERE world_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(() => {});
    // Remove linked scenes
    await sequelize.query(
      `DELETE FROM intimate_scenes WHERE character_a_id = :id OR character_b_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(() => {});
    // Remove extended relationships
    await sequelize.query(
      `DELETE FROM character_relationships_extended WHERE character_id = :id OR related_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(() => {});
    // Delete the character
    await sequelize.query(
      `DELETE FROM world_characters WHERE id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    );
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/seed-relationships — manually seed relationship candidates for all active world characters
router.post('/world/seed-relationships', optionalAuth, async (req, res) => {
  try {
    const { world_tag = 'lalaverse' } = req.body;
    const registryId = await findOrCreateRegistryForWorld(req, world_tag);

    // Get all active world characters that have a registry_character_id
    const worldChars = await Q(req, `
      SELECT wc.id, wc.name, wc.character_type, wc.tension_type,
             wc.dynamic, wc.what_they_want_from_lala,
             wc.registry_character_id, wc.sexuality
      FROM world_characters wc
      WHERE wc.status = 'active'
        AND wc.registry_character_id IS NOT NULL
      ORDER BY wc.name
    `);

    // 1) Lala-centric relationships (existing behaviour)
    let lalaSeeded = 0;
    for (const wc of worldChars) {
      const relId = await syncRelationships(wc.registry_character_id, wc, registryId);
      if (relId) lalaSeeded++;
    }

    // 2) Inter-character relationships (new)
    const interSeeded = await seedInterCharacterRelationships(worldChars, registryId);

    res.json({
      lala_seeded: lalaSeeded,
      inter_seeded: interSeeded,
      total_active: worldChars.length,
      message: `Seeded ${lalaSeeded} Lala relationship(s) + ${interSeeded} inter-character relationship(s) from ${worldChars.length} active characters`,
    });
  } catch (err) {
    console.error('seed-relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /world/batches
router.get('/world/batches', optionalAuth, async (req, res) => {
  try {
    const batches = await Q(req, 'SELECT * FROM world_character_batches ORDER BY created_at DESC');
    res.json({ batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// INTIMATE SCENE GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

// GET /world/tension-check — scan all active world character relationships for scene triggers
router.get('/world/tension-check', optionalAuth, async (req, res) => {
  try {
    // Characters eligible for intimate scenes with non-calm tension
    // Join through registry_characters since character_relationships references registry IDs
    const triggered = await Q(req, `
      SELECT wc.*,
             cr.tension_state, cr.situation, cr.relationship_type, cr.connection_mode,
             cr.id AS relationship_id
      FROM world_characters wc
      JOIN registry_characters rc ON rc.world_character_id = wc.id AND rc.deleted_at IS NULL
      LEFT JOIN character_relationships cr
        ON (cr.character_id_a = rc.id OR cr.character_id_b = rc.id)
        AND cr.confirmed = true
        AND cr.tension_state IN ('simmering', 'volatile', 'fractured')
      WHERE wc.intimate_eligible = true
        AND wc.status = 'active'
        AND cr.id IS NOT NULL
      ORDER BY
        CASE cr.tension_state
          WHEN 'volatile' THEN 1
          WHEN 'simmering' THEN 2
          WHEN 'fractured' THEN 3
        END
    `).catch(() => []);

    // Also include intimate-eligible characters without relationship records
    // who haven't had a scene yet (one-night-stand candidates)
    const oneNightCandidates = await Q(req, `
      SELECT wc.* FROM world_characters wc
      WHERE wc.character_type = 'one_night_stand'
        AND wc.status = 'active'
        AND wc.intimate_eligible = true
        AND NOT EXISTS (SELECT 1 FROM intimate_scenes WHERE character_a_id = wc.id OR character_b_id = wc.id)
    `).catch(() => []);

    res.json({
      triggered,
      one_night_candidates: oneNightCandidates,
      trigger_count: triggered.length + oneNightCandidates.length,
    });
  } catch (err) {
    console.error('tension-check error:', err);
    res.json({ triggered: [], one_night_candidates: [], trigger_count: 0 });
  }
});

// POST /world/scenes/generate — generate intimate scene
router.post('/world/scenes/generate', optionalAuth, async (req, res) => {
  try {
    const {
      character_a_id,
      character_b_id,
      scene_type = 'hook_up',
      location,
      world_context: sceneContext,
      career_stage = 'early_career',
      book_id,
      trigger_tension,
    } = req.body;

    if (!character_a_id) return res.status(400).json({ error: 'character_a_id required' });

    // Load character profiles
    const [charA] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: character_a_id } });
    const charB   = character_b_id
      ? (await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: character_b_id } }))[0]
      : null;

    if (!charA) return res.status(404).json({ error: 'Character A not found' });

    // Fetch recent scene history between these two
    const sceneHistory = await Q(req, `
      SELECT scene_type, intensity, created_at FROM intimate_scenes
      WHERE (character_a_id = :a AND character_b_id = :b)
         OR (character_a_id = :b AND character_b_id = :a)
      ORDER BY created_at DESC LIMIT 3
    `, { replacements: { a: character_a_id, b: character_b_id || character_a_id } }).catch(() => []);

    // Determine scene length
    const { min, max, label } = resolveSceneLength(charA.character_type, scene_type, charA.dynamic);

    const careerVoice = {
      early_career: 'She is still learning the dimensions of her own power. She moves toward what she wants but there is still something discovering itself in her.',
      rising:       'She knows what she wants. She moves through the world like someone who has stopped apologizing. The confidence is real but she is still learning its edges.',
      peak:         'She is fully arrived. She takes what she wants without explanation. The space she occupies when she enters a room is not something she performs — it is simply hers.',
      established:  'Everything she does now comes from somewhere deep. She has earned her certainty. She is generous with herself in ways she never used to be.',
    };

    const result = await claude(
      `You write intimate and romantic scenes for literary fiction set in LalaVerse.

Your scenes are immersive, physically and emotionally present, written in close third person from the protagonist's perspective. The reader should feel like they are in the room — aware of temperature, proximity, the small decisions that lead to the larger ones.

You write desire honestly. Not euphemistically, not graphically. You write the physical reality of connection between two specific people who carry their histories into the room with them. What makes a scene land is specificity — not what two people do in general, but what these two people do, shaped by who they are.

Three beats: the approach (the moment before — tension, awareness, the decision being made without being stated), the scene (present, immersive, honest), the aftermath (one beat — what she notices, what shifts, what the air feels like after).

The career stage shapes her voice. ${careerVoice[career_stage] || careerVoice.early_career}`,

      `Write an intimate scene between these characters.

PROTAGONIST: ${charA.name}
${charA.aesthetic ? `Aesthetic: ${charA.aesthetic}` : ''}
${charA.intimate_style ? `In intimate moments: ${charA.intimate_style}` : ''}
${charA.what_lala_feels ? `What she feels with this person: ${charA.what_lala_feels}` : ''}
${charA.dynamic ? `Their dynamic: ${charA.dynamic}` : ''}

${charB ? `OTHER CHARACTER: ${charB.name}
${charB.aesthetic ? `Aesthetic: ${charB.aesthetic}` : ''}
${charB.intimate_style ? `In intimate moments: ${charB.intimate_style}` : ''}
${charB.intimate_dynamic ? `Their dynamic: ${charB.intimate_dynamic}` : ''}
${charB.surface_want ? `What they want: ${charB.surface_want}` : ''}
${charB.real_want ? `What they'd never admit: ${charB.real_want}` : ''}` : 'OTHER CHARACTER: Unknown — this is a first encounter'}

SCENE TYPE: ${scene_type}
LOCATION: ${location || 'a private space in LalaVerse'}
CONTEXT: ${sceneContext || 'After a charged evening. The tension has been building.'}
TENSION THAT TRIGGERED THIS: ${trigger_tension || 'Unresolved'}
CAREER STAGE: ${career_stage}

${sceneHistory.length > 0 ? `SCENE HISTORY: They have been here before — ${sceneHistory.map(s => s.scene_type).join(', ')}. This shapes the tone.` : 'SCENE HISTORY: This is a first encounter between them.'}

Target length: ${min}–${max} words total across all three beats.

Return JSON only:
{
  "approach_text": "the moment before — tension, awareness, the small decisions",
  "scene_text": "the scene itself — immersive, present, honest",
  "aftermath_text": "one beat after — what she notices, what shifts",
  "intensity": "charged|tender|intense|electric|quiet",
  "relationship_shift": "what changed between them after this",
  "new_tension_state": "Stable|Friction Building|Unresolved|Broken"
}`,
      3000
    );

    const parsed = parseJSON(result);
    if (!parsed?.scene_text) {
      return res.status(500).json({ error: 'Scene generation failed — try again' });
    }

    const fullText = [parsed.approach_text, parsed.scene_text, parsed.aftermath_text].filter(Boolean).join('\n\n');
    const wordCount = fullText.split(/\s+/).length;

    // Save scene
    const sceneId = uuidv4();
    await sequelize.query(
      `INSERT INTO intimate_scenes
         (id, character_a_id, character_b_id, character_a_name, character_b_name,
          book_id, scene_type, location, world_context, career_stage, trigger_tension,
          approach_text, scene_text, aftermath_text, full_text, word_count,
          intensity, relationship_shift, new_tension_state, status, created_at, updated_at)
       VALUES
         (:id, :a_id, :b_id, :a_name, :b_name,
          :book_id, :scene_type, :location, :context, :career_stage, :trigger,
          :approach, :scene, :aftermath, :full, :wc,
          :intensity, :shift, :new_tension, 'draft', NOW(), NOW())`,
      {
        replacements: {
          id: sceneId,
          a_id: character_a_id, b_id: character_b_id || null,
          a_name: charA.name, b_name: charB?.name || null,
          book_id: book_id || null,
          scene_type, location: location || null,
          context: sceneContext || null, career_stage,
          trigger: trigger_tension || null,
          approach: parsed.approach_text || null,
          scene: parsed.scene_text,
          aftermath: parsed.aftermath_text || null,
          full: fullText, wc: wordCount,
          intensity: parsed.intensity || 'charged',
          shift: parsed.relationship_shift || null,
          new_tension: parsed.new_tension_state || 'Stable',
        },
        type: sequelize.QueryTypes.INSERT,
      }
    );

    const [scene] = await Q(req, 'SELECT * FROM intimate_scenes WHERE id = :id', { replacements: { id: sceneId } });
    res.status(201).json({ scene, characters: { a: charA, b: charB } });
  } catch (err) {
    console.error('scene generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /world/scenes
router.get('/world/scenes', optionalAuth, async (req, res) => {
  try {
    const { character_id, status, scene_type } = req.query;
    let where = 'WHERE 1=1';
    const rep = {};
    if (character_id) { where += ' AND (character_a_id = :cid OR character_b_id = :cid)'; rep.cid = character_id; }
    if (status)       { where += ' AND status = :status';      rep.status = status; }
    if (scene_type)   { where += ' AND scene_type = :stype';   rep.stype = scene_type; }

    const scenes = await Q(req,
      `SELECT * FROM intimate_scenes ${where} ORDER BY created_at DESC`,
      { replacements: rep }
    );
    res.json({ scenes, count: scenes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/scenes/:sceneId
router.get('/world/scenes/:sceneId', optionalAuth, async (req, res) => {
  try {
    const [scene] = await Q(req, 'SELECT * FROM intimate_scenes WHERE id = :id', { replacements: { id: req.params.sceneId } });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const [charA] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: scene.character_a_id } }).catch(() => [{}]);
    const charB   = scene.character_b_id
      ? (await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: scene.character_b_id } }).catch(() => [{}]))[0]
      : null;

    const continuations = await Q(req, 'SELECT * FROM scene_continuations WHERE scene_id = :id ORDER BY created_at ASC', { replacements: { id: req.params.sceneId } });

    res.json({ scene, characters: { a: charA, b: charB }, continuations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /world/scenes/:sceneId/approve — approve, run all post-scene automations
router.post('/world/scenes/:sceneId/approve', optionalAuth, async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { chapter_id, book_id } = req.body;

    const [scene] = await Q(req, 'SELECT * FROM intimate_scenes WHERE id = :id', { replacements: { id: sceneId } });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    // 1. Write to StoryTeller as approved lines
    let targetChapterId = chapter_id;
    if (!targetChapterId && book_id) {
      // Create a new chapter for this scene
      targetChapterId = uuidv4();
      const [maxOrder] = await Q(req,
        `SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM storyteller_chapters WHERE book_id = :bid`,
        { replacements: { bid: book_id } }
      );
      await sequelize.query(
        `INSERT INTO storyteller_chapters (id, book_id, title, order_index, story_type, created_at, updated_at)
         VALUES (:id, :book_id, :title, :order_index, 'intimate_scene', NOW(), NOW())`,
        { replacements: { id: targetChapterId, book_id, title: `${scene.scene_type.replace(/_/g, ' ')} — ${scene.character_a_name} & ${scene.character_b_name || 'unknown'}`, order_index: (maxOrder?.max_idx ?? -1) + 1 }, type: sequelize.QueryTypes.INSERT }
      );
    }

    if (targetChapterId) {
      const beats = [
        { text: scene.approach_text, label: 'approach' },
        { text: scene.scene_text, label: 'scene' },
        { text: scene.aftermath_text, label: 'aftermath' },
      ].filter(b => b.text);

      for (let i = 0; i < beats.length; i++) {
        const paragraphs = beats[i].text.split(/\n\n+/).filter(p => p.trim());
        for (let j = 0; j < paragraphs.length; j++) {
          await sequelize.query(
            `INSERT INTO storyteller_lines (id, chapter_id, text, status, order_index, source_type, source_ref, created_at, updated_at)
             VALUES (:id, :chapter_id, :text, 'approved', :order_index, 'intimate_scene', :source_ref, NOW(), NOW())`,
            { replacements: { id: uuidv4(), chapter_id: targetChapterId, text: paragraphs[j], order_index: i * 100 + j, source_ref: sceneId }, type: sequelize.QueryTypes.INSERT }
          );
        }
      }
    }

    // 2. Update relationship tension state
    if (scene.new_tension_state && scene.character_b_id) {
      await sequelize.query(
        `UPDATE character_relationships SET tension_state = :state, updated_at = NOW()
         WHERE (character_id_a = :a AND character_id_b = :b) OR (character_id_a = :b AND character_id_b = :a)`,
        { replacements: { state: scene.new_tension_state, a: scene.character_a_id, b: scene.character_b_id }, type: sequelize.QueryTypes.UPDATE }
      ).catch(() => {});
      await sequelize.query(
        `UPDATE world_characters SET current_tension = :state, updated_at = NOW() WHERE id = :id`,
        { replacements: { state: scene.new_tension_state, id: scene.character_b_id }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    // 3. Log as scene event in continuity
    const sceneEvent = {
      scene_id: sceneId,
      scene_type: 'intimate_encounter',
      characters: [scene.character_a_name, scene.character_b_name].filter(Boolean),
      intensity: scene.intensity,
      relationship_shift: scene.relationship_shift,
      logged_at: new Date().toISOString(),
    };
    // Log to continuity beats if timeline exists (soft fail)
    await sequelize.query(
      `INSERT INTO continuity_beats (id, timeline_id, name, location, time_tag, note, order_index, created_at, updated_at)
       SELECT :id, ct.id, :name, :location, :time_tag, :note, COALESCE(MAX(cb.order_index), 0) + 1, NOW(), NOW()
       FROM continuity_timelines ct
       LEFT JOIN continuity_beats cb ON cb.timeline_id = ct.id
       WHERE ct.show_id IS NOT NULL
       GROUP BY ct.id
       LIMIT 1`,
      {
        replacements: {
          id: uuidv4(),
          name: `Intimate encounter — ${scene.character_a_name} & ${scene.character_b_name || 'unknown'}`,
          location: scene.location || 'private',
          time_tag: `Scene ${scene.scene_type}`,
          note: scene.relationship_shift || scene.intensity,
        },
        type: sequelize.QueryTypes.INSERT,
      }
    ).catch(() => {});

    // 4. Extract memory
    const memoryResult = await claude(
      `Extract the emotional memory from this intimate scene. Be specific about what she learns about herself, about desire, about power, about what she wants.`,
      `SCENE: ${scene.full_text?.substring(0, 1500)}
CHARACTER: ${scene.character_a_name}
RELATIONSHIP SHIFT: ${scene.relationship_shift}

Return JSON: { "memory_statement": "what she now knows or feels", "memory_type": "belief|constraint|character_dynamic|pain_point", "confidence": 0.0-1.0 }`
    );
    const mem = parseJSON(memoryResult);
    if (mem?.memory_statement) {
      await sequelize.query(
        `INSERT INTO storyteller_memories (id, type, statement, confidence, confirmed, source_ref, created_at, updated_at)
         VALUES (:id, :type, :statement, :confidence, false, :source, NOW(), NOW())`,
        { replacements: { id: uuidv4(), type: mem.memory_type || 'character_dynamic', statement: mem.memory_statement, confidence: mem.confidence || 0.8, source: `intimate_scene:${sceneId}` }, type: sequelize.QueryTypes.INSERT }
      ).catch(() => {});
    }

    // 5. Generate morning-after continuation in background
    generateContinuation(req, scene, 'morning_after').catch(e => console.error('Continuation error:', e));

    // Update scene status
    await sequelize.query(
      `UPDATE intimate_scenes SET status = 'approved', scene_logged = true, tension_updated = true, memory_extracted = true, chapter_id = :chapter_id, updated_at = NOW() WHERE id = :id`,
      { replacements: { id: sceneId, chapter_id: targetChapterId || null }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ approved: true, chapter_id: targetChapterId, continuation_generating: true, scene_event: sceneEvent });
  } catch (err) {
    console.error('scene approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function generateContinuation(req, scene, continuationType) {
  const result = await claude(
    `You write the morning-after or story continuation that follows an intimate scene in LalaVerse.
This is not a wrap-up. It's the next moment — what she notices when she wakes, what the light looks like, what his absence or presence means. One to three paragraphs. Then the story continues — her life doesn't stop because something happened.
Write in close third person. Present and specific. The intimate encounter happened. The world goes on. She goes on.`,
    `Write the ${continuationType.replace('_', ' ')} continuation.

WHAT JUST HAPPENED:
${scene.full_text?.substring(0, 800)}

RELATIONSHIP SHIFT: ${scene.relationship_shift}
INTENSITY: ${scene.intensity}
CHARACTER A: ${scene.character_a_name}
CHARACTER B: ${scene.character_b_name || 'the other person'}

Write 2-3 paragraphs. Start with a sensory detail. End with her moving forward — toward something in her actual life. Her career, her next thing, the day ahead. She doesn't linger longer than the scene deserves.`
  );

  if (!result) return;

  const contId = uuidv4();
  const wordCount = result.split(/\s+/).length;

  await sequelize.query(
    `INSERT INTO scene_continuations (id, scene_id, continuation_type, text, word_count, status, created_at, updated_at)
     VALUES (:id, :scene_id, :type, :text, :wc, 'draft', NOW(), NOW())`,
    { replacements: { id: contId, scene_id: scene.id, type: continuationType, text: result.trim(), wc: wordCount }, type: sequelize.QueryTypes.INSERT }
  );

  await sequelize.query(
    `UPDATE intimate_scenes SET continuation_generated = true, updated_at = NOW() WHERE id = :id`,
    { replacements: { id: scene.id }, type: sequelize.QueryTypes.UPDATE }
  );
}

// POST /world/scenes/:sceneId/continue — manually trigger continuation
router.post('/world/scenes/:sceneId/continue', optionalAuth, async (req, res) => {
  try {
    const { continuation_type = 'morning_after' } = req.body;
    const [scene] = await Q(req, 'SELECT * FROM intimate_scenes WHERE id = :id', { replacements: { id: req.params.sceneId } });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    await generateContinuation(req, scene, continuation_type);
    res.json({ generating: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /world/scenes/:sceneId
router.delete('/world/scenes/:sceneId', optionalAuth, async (req, res) => {
  try {
    await sequelize.query(
      `DELETE FROM intimate_scenes WHERE id = :id AND status = 'draft'`,
      { replacements: { id: req.params.sceneId }, type: sequelize.QueryTypes.DELETE }
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/scenes/:sceneId/continuations
router.get('/world/scenes/:sceneId/continuations', optionalAuth, async (req, res) => {
  try {
    const continuations = await Q(req,
      'SELECT * FROM scene_continuations WHERE scene_id = :id ORDER BY created_at ASC',
      { replacements: { id: req.params.sceneId } }
    );
    res.json({ continuations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /world/continuations/:contId/approve — write continuation to StoryTeller
router.post('/world/continuations/:contId/approve', optionalAuth, async (req, res) => {
  try {
    const { chapter_id } = req.body;
    const [cont] = await Q(req, 'SELECT * FROM scene_continuations WHERE id = :id', { replacements: { id: req.params.contId } });
    if (!cont) return res.status(404).json({ error: 'Continuation not found' });

    if (chapter_id) {
      const paragraphs = cont.text.split(/\n\n+/).filter(p => p.trim());
      const [maxOrder] = await Q(req, `SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM storyteller_lines WHERE chapter_id = :cid`, { replacements: { cid: chapter_id } });
      for (let i = 0; i < paragraphs.length; i++) {
        await sequelize.query(
          `INSERT INTO storyteller_lines (id, chapter_id, text, status, order_index, source_type, source_ref, created_at, updated_at)
           VALUES (:id, :chapter_id, :text, 'approved', :order_index, 'scene_continuation', :source, NOW(), NOW())`,
          { replacements: { id: uuidv4(), chapter_id, text: paragraphs[i], order_index: (maxOrder?.max_idx ?? -1) + 1 + i, source: cont.id }, type: sequelize.QueryTypes.INSERT }
        );
      }
    }

    await sequelize.query(
      `UPDATE scene_continuations SET status = 'approved', chapter_id = :chapter_id, updated_at = NOW() WHERE id = :id`,
      { replacements: { id: req.params.contId, chapter_id: chapter_id || null }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ approved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PREVIEW FLOW  (generate-ecosystem-preview → select → generate-ecosystem-confirm)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /world/generate-ecosystem-preview
 * Same Claude prompt as generate-ecosystem BUT does NOT commit to DB.
 * Returns preview characters so the user can select/deselect before confirming.
 */
router.post('/world/generate-ecosystem-preview', optionalAuth, async (req, res) => {
  try {
    const {
      world_tag = 'lalaverse',
      world_context = {},
      character_count = 8,
    } = req.body;

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const series_label = req.body.series_label || wCfg.series_label;

    const {
      city         = wCfg.defaults.city,
      industry     = wCfg.defaults.industry,
      career_stage = wCfg.defaults.career_stage,
      era          = wCfg.defaults.era,
      protagonist  = wCfg.protagonist,
    } = world_context;

    // Fetch existing to avoid duplication
    const existing = await Q(req, `
      SELECT name, character_type, occupation FROM world_characters
      WHERE status != 'archived' ORDER BY created_at DESC LIMIT 20
    `);

    const result = await claude(
      wCfg.system_prompt,

      `Generate ${character_count} world characters for ${wCfg.title}.

PROTAGONIST: ${protagonist}
WORLD: ${city}, ${industry} industry
CAREER STAGE: ${career_stage}
ERA: ${era}

${existing.length > 0 ? `EXISTING CHARACTERS (don't duplicate):\n${existing.map(e => `- ${e.name} (${e.character_type})`).join('\n')}` : ''}

Include at least: 2 love_interest or one_night_stand, 2 industry_peer, 1 mentor, 1 antagonist or rival, 1 collaborator.

Return JSON only:
{
  "characters": [
    {
      "name": "full name",
      "age_range": "e.g. late 20s",
      "occupation": "specific job/role",
      "world_location": "where they exist in ${wCfg.title}",
      "character_type": "love_interest|industry_peer|mentor|antagonist|rival|collaborator|one_night_stand",
      "sexuality": "straight|gay|lesbian|bisexual|pansexual|queer|fluid — be intentional, this drives romantic pairing logic",
      "intimate_eligible": true|false,
      "aesthetic": "how they look, dress, move — specific and visual",
      "signature": "the one thing about them that is unforgettable",
      "surface_want": "what they'd tell you they want",
      "real_want": "what they'd never admit",
      "what_they_want_from_lala": "what they're actually seeking from ${protagonist} specifically",
      "how_they_meet": "the specific scenario — not generic",
      "dynamic": "the texture of their connection with ${protagonist}",
      "tension_type": "romantic|professional|creative|power|unspoken",
      "intimate_style": "how they are in intimate moments — only for intimate_eligible characters, null otherwise",
      "intimate_dynamic": "the specific dynamic between them — only for intimate_eligible, null otherwise",
      "what_lala_feels": "what ${protagonist} physically and emotionally experiences with this person — intimate_eligible only, null otherwise",
      "arc_role": "how this character changes ${protagonist}'s trajectory",
      "exit_reason": "how or why they leave her world, or null if they stay",
      "career_echo_connection": true|false,
      "attracted_to": "who they actually pursue — specific, not a label (e.g. 'men with authority she can dismantle, women who are further ahead than her')",
      "how_they_love": "their connection pattern (e.g. 'avoidant until she isn't, then fully in')",
      "desire_they_wont_admit": "the thing that complicates the above (dimmed, private)",
      "family_layer": "real_world | ${world_tag} | series_2",
      "origin_story": "where they came from before ${protagonist}'s world",
      "public_persona": "how the world sees them",
      "private_reality": "what only close people know"
    }
  ],
  "generation_notes": "brief note on the ecosystem logic — who connects to who, what tensions exist between them"
}`,
      10000
    );

    const parsed = parseJSON(result);
    if (!parsed?.characters?.length) {
      return res.status(500).json({ error: 'Preview generation failed — Claude returned no characters' });
    }

    // Return characters WITHOUT committing to DB
    res.json({
      characters: parsed.characters,
      generation_notes: parsed.generation_notes || '',
      count: parsed.characters.length,
    });
  } catch (err) {
    console.error('generate-ecosystem-preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /world/generate-ecosystem-confirm
 * Takes the user-selected characters from the preview and commits them to DB + registry.
 */
router.post('/world/generate-ecosystem-confirm', optionalAuth, async (req, res) => {
  try {
    const {
      characters = [],
      generation_notes = '',
      show_id,
      world_tag = 'lalaverse',
    } = req.body;

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const series_label = req.body.series_label || wCfg.series_label;

    if (!characters.length) {
      return res.status(400).json({ error: 'No characters to confirm' });
    }

    // Create batch record
    const batchId = uuidv4();
    await sequelize.query(
      `INSERT INTO world_character_batches (id, show_id, series_label, world_context, character_count, generation_notes, created_at, updated_at)
       VALUES (:id, :show_id, :label, :context, :count, :notes, NOW(), NOW())`,
      {
        replacements: {
          id: batchId,
          show_id: show_id || null,
          label: series_label,
          context: JSON.stringify({ source: 'preview_confirm', world_tag }),
          count: characters.length,
          notes: generation_notes,
        },
        type: sequelize.QueryTypes.INSERT,
      }
    );

    // Insert each character + sync to registry
    const registryId = await findOrCreateRegistryForWorld(req, world_tag);
    const inserted = [];
    for (const c of characters) {
      const charId = uuidv4();
      await sequelize.query(
        `INSERT INTO world_characters
           (id, batch_id, name, age_range, occupation, world_location, character_type,
            sexuality, intimate_eligible, aesthetic, signature,
            surface_want, real_want, what_they_want_from_lala,
            how_they_meet, dynamic, tension_type,
            intimate_style, intimate_dynamic, what_lala_feels,
            arc_role, exit_reason, career_echo_connection,
            attracted_to, how_they_love, desire_they_wont_admit,
            relationship_graph, family_layer, origin_story,
            public_persona, private_reality,
            world_tag, status, current_tension, created_at, updated_at)
         VALUES
           (:id, :batch_id, :name, :age_range, :occupation, :world_location, :char_type,
            :sexuality, :intimate_eligible, :aesthetic, :signature,
            :surface_want, :real_want, :what_from_lala,
            :how_meet, :dynamic, :tension_type,
            :intimate_style, :intimate_dynamic, :what_lala_feels,
            :arc_role, :exit_reason, :career_echo,
            :attracted_to, :how_they_love, :desire_they_wont_admit,
            :relationship_graph, :family_layer, :origin_story,
            :public_persona, :private_reality,
            :world_tag, 'draft', 'Stable', NOW(), NOW())`,
        {
          replacements: {
            id: charId, batch_id: batchId,
            name: c.name, age_range: c.age_range || null, occupation: c.occupation || null,
            world_location: c.world_location || null, char_type: c.character_type,
            sexuality: c.sexuality || null,
            intimate_eligible: c.intimate_eligible || false,
            aesthetic: c.aesthetic || null, signature: c.signature || null,
            surface_want: c.surface_want || null, real_want: c.real_want || null,
            what_from_lala: c.what_they_want_from_lala || null,
            how_meet: c.how_they_meet || null, dynamic: c.dynamic || null,
            tension_type: c.tension_type || null,
            intimate_style: c.intimate_style || null, intimate_dynamic: c.intimate_dynamic || null,
            what_lala_feels: c.what_lala_feels || null,
            arc_role: c.arc_role || null, exit_reason: c.exit_reason || null,
            career_echo: c.career_echo_connection || false,
            attracted_to: c.attracted_to || null,
            how_they_love: c.how_they_love || null,
            desire_they_wont_admit: c.desire_they_wont_admit || null,
            relationship_graph: JSON.stringify(c.relationship_graph || []),
            family_layer: c.family_layer || null,
            origin_story: c.origin_story || null,
            public_persona: c.public_persona || null,
            private_reality: c.private_reality || null,
            world_tag: world_tag,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );

      // Sync to canonical registry
      const rcId = await syncToRegistry(req, charId, c, registryId, world_tag);
      inserted.push({ ...c, id: charId, registry_character_id: rcId });
    }

    // Seed inter-character relationships (not just Lala-centric)
    const interCount = await seedInterCharacterRelationships(inserted, registryId);
    console.log(`generate-ecosystem-confirm: Seeded ${interCount} inter-character relationship(s)`);

    res.status(201).json({
      characters: inserted,
      batch_id: batchId,
      count: inserted.length,
      inter_relationships: interCount,
      generation_notes,
    });
  } catch (err) {
    console.error('generate-ecosystem-confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RELATIONSHIP GRAPH CRUD  (inline JSONB + extended table)
// ══════════════════════════════════════════════════════════════════════════════

// GET /world/characters/:id/relationships
router.get('/world/characters/:id/relationships', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req,
      'SELECT id, relationship_graph FROM world_characters WHERE id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!char) return res.status(404).json({ error: 'Not found' });

    // Also fetch from extended table
    let extended = [];
    try {
      extended = await Q(req,
        `SELECT * FROM character_relationships_extended
         WHERE character_id = :id ORDER BY created_at DESC`,
        { replacements: { id: req.params.id } }
      );
    } catch (_) {}

    res.json({
      relationship_graph: safeJson(char.relationship_graph),
      extended,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/characters/:id/relationships
router.post('/world/characters/:id/relationships', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req,
      'SELECT id, relationship_graph FROM world_characters WHERE id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!char) return res.status(404).json({ error: 'Not found' });

    const {
      related_character_id, related_character_name, related_character_source,
      relationship_type, family_role, history_summary, current_status,
      tension_state, romantic_eligible, knows_about_transfer, series_layer, notes,
    } = req.body;

    const relId = uuidv4();

    // 1. Write to extended table
    try {
      await sequelize.query(
        `INSERT INTO character_relationships_extended
         (id, character_id, related_character_id, related_character_name,
          related_character_source, relationship_type, family_role,
          history_summary, current_status, tension_state,
          romantic_eligible, knows_about_transfer, series_layer, notes,
          created_at, updated_at)
         VALUES
         (:id, :cid, :rid, :rname, :rsource, :rtype, :frole,
          :history, :cstatus, :tension,
          :romantic, :transfer, :layer, :notes,
          NOW(), NOW())`,
        {
          replacements: {
            id: relId, cid: req.params.id,
            rid: related_character_id || null,
            rname: related_character_name || null,
            rsource: related_character_source || 'world_characters',
            rtype: relationship_type || null,
            frole: family_role || null,
            history: history_summary || null,
            cstatus: current_status || 'active',
            tension: tension_state || 'Stable',
            romantic: !!romantic_eligible,
            transfer: !!knows_about_transfer,
            layer: series_layer || null,
            notes: notes || null,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );
    } catch (e) { console.error('extended table write failed:', e.message); }

    // 2. Append to JSONB graph on world_characters
    const graph = safeJson(char.relationship_graph);
    graph.push({
      rel_id: relId,
      character_id: related_character_id || null,
      character_name: related_character_name || '',
      relationship_type: relationship_type || '',
      family_role: family_role || null,
      history_summary: history_summary || '',
      current_status: current_status || 'active',
      knows_about_transfer: !!knows_about_transfer,
      notes: notes || '',
    });
    await sequelize.query(
      `UPDATE world_characters SET relationship_graph = :graph, updated_at = NOW() WHERE id = :id`,
      { replacements: { graph: JSON.stringify(graph), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ relationship: { id: relId }, graph });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /world/characters/:id/relationships/:relId
router.put('/world/characters/:id/relationships/:relId', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req,
      'SELECT id, relationship_graph FROM world_characters WHERE id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!char) return res.status(404).json({ error: 'Not found' });

    // Update extended table row
    const extFields = [
      'related_character_name', 'relationship_type', 'family_role',
      'history_summary', 'current_status', 'tension_state',
      'romantic_eligible', 'knows_about_transfer', 'series_layer', 'notes',
    ];
    const updates = [];
    const rep = { relId: req.params.relId, cid: req.params.id };
    extFields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = :${f}`); rep[f] = req.body[f]; }
    });
    if (updates.length) {
      updates.push('updated_at = NOW()');
      try {
        await sequelize.query(
          `UPDATE character_relationships_extended SET ${updates.join(', ')} WHERE id = :relId AND character_id = :cid`,
          { replacements: rep, type: sequelize.QueryTypes.UPDATE }
        );
      } catch (_) {}
    }

    // Update JSONB graph
    const graph = safeJson(char.relationship_graph);
    const idx = graph.findIndex(r => r.rel_id === req.params.relId);
    if (idx !== -1) {
      graph[idx] = { ...graph[idx], ...req.body };
      await sequelize.query(
        `UPDATE world_characters SET relationship_graph = :graph, updated_at = NOW() WHERE id = :id`,
        { replacements: { graph: JSON.stringify(graph), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    res.json({ updated: true, graph });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /world/characters/:id/relationships/:relId
router.delete('/world/characters/:id/relationships/:relId', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req,
      'SELECT id, relationship_graph FROM world_characters WHERE id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!char) return res.status(404).json({ error: 'Not found' });

    // Remove from extended table
    try {
      await sequelize.query(
        `DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid`,
        { replacements: { relId: req.params.relId, cid: req.params.id }, type: sequelize.QueryTypes.DELETE }
      );
    } catch (_) {}

    // Remove from JSONB graph
    const graph = safeJson(char.relationship_graph).filter(r => r.rel_id !== req.params.relId);
    await sequelize.query(
      `UPDATE world_characters SET relationship_graph = :graph, updated_at = NOW() WHERE id = :id`,
      { replacements: { graph: JSON.stringify(graph), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ deleted: true, graph });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
