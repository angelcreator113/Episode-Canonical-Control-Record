// ─────────────────────────────────────────────────────────────────────────────
// characterGenerator.js — Character Generator backend routes
//
// Routes:
// GET  /ecosystem          — current world health view
// POST /propose-seeds      — Claude proposes 10 seeds
// POST /generate-batch     — generate 10 full profiles
// POST /check-staging      — collision + saturation checks
// POST /commit             — save staged character to Registry
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ─── Role type definitions ────────────────────────────────────────────────────
const ROLE_TYPES = ['pressure', 'mirror', 'support', 'shadow', 'special'];

const ROLE_DEFINITIONS = {
  pressure:    'Creates friction that forces growth. Their logic collides with the protagonist\'s.',
  mirror:      'Reflects something the protagonist cannot see in herself. The comparison lives here.',
  support:     'Present, invested, imperfect. Carries their own wounds into the relationship.',
  shadow:      'Represents the road not taken or the version of the protagonist she fears becoming.',
  special:     'Outside the normal role taxonomy. Franchise-level significance.',
};

// ─── World configs ────────────────────────────────────────────────────────────
const WORLD_CONFIGS = {
  book1: {
    label: 'Book 1 World',
    age_range: [28, 45],
    setting: 'Real world — suburban/urban America. Content creators, professionals, mothers, wives, friends.',
    tone: 'Grounded, specific, adult. The texture of real life: dinner tables, commutes, DMs, mortgages.',
    existing_characters: ['JustAWoman', 'David', 'Dana', 'Chloe', 'Jade', 'Marcus', 'Miles', 'Noah'],
  },
  lalaverse: {
    label: 'LalaVerse',
    age_range: [22, 35],
    setting: 'Fashion game universe on the internet. Content creators, brand figures, game-world entities.',
    tone: 'Elevated, stylized, aspirational but real. The stakes are careers, aesthetics, and identity.',
    existing_characters: ['Lala'],
  },
};

// ─── Pain point categories (for profile generation) ──────────────────────────
const PAIN_CATEGORIES = [
  'comparison_spiral', 'visibility_gap', 'identity_drift',
  'financial_risk', 'consistency_collapse', 'clarity_deficit',
  'external_validation', 'restart_cycle',
];

// ─── GET /ecosystem ───────────────────────────────────────────────────────────
router.get('/ecosystem', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');

  try {
    const registries = await db.CharacterRegistry.findAll({
      include: [{
        model: db.RegistryCharacter,
        as: 'characters',
        attributes: [
          'id', 'display_name', 'selected_name', 'role_type', 'status',
          'canon_tier', 'appearance_mode', 'createdAt',
        ],
      }],
    });

    // Group characters by registry book_tag
    const worldCharsMap = { book1: [], lalaverse: [] };
    for (const reg of registries) {
      const tag = reg.book_tag || '';
      const bucket = tag === 'lalaverse' ? 'lalaverse' : 'book1';
      for (const c of (reg.characters || [])) {
        worldCharsMap[bucket].push(c);
      }
    }

    const buildWorldStats = (worldChars) => {
      const roleCount = {};
      ROLE_TYPES.forEach((r) => { roleCount[r] = 0; });
      worldChars.forEach((c) => { if (roleCount[c.role_type] !== undefined) roleCount[c.role_type]++; });

      const statusCount = {
        draft: worldChars.filter((c) => c.status === 'draft').length,
        accepted: worldChars.filter((c) => c.status === 'accepted').length,
        finalized: worldChars.filter((c) => c.status === 'finalized').length,
        declined: worldChars.filter((c) => c.status === 'declined').length,
      };

      const canonCount = {
        eligible: worldChars.filter((c) => c.canon_tier && c.canon_tier !== 'none').length,
        not_eligible: worldChars.filter((c) => !c.canon_tier || c.canon_tier === 'none').length,
      };

      const saturated = Object.entries(roleCount)
        .filter(([, count]) => count > 4)
        .map(([role]) => role);
      const empty = Object.entries(roleCount)
        .filter(([role, count]) => count === 0 && role !== 'special')
        .map(([role]) => role);

      return {
        total: worldChars.length,
        roleCount,
        statusCount,
        canonCount,
        saturated,
        empty,
        health: saturated.length === 0 && empty.length === 0 ? 'balanced' :
                saturated.length > 0 ? 'oversaturated' : 'sparse',
      };
    };

    const allChars = registries.flatMap((r) => r.characters || []);

    return res.json({
      book1: {
        ...WORLD_CONFIGS.book1,
        stats: buildWorldStats(worldCharsMap.book1),
        characters: worldCharsMap.book1.map((c) => ({
          id: c.id,
          name: c.selected_name || c.display_name,
          role_type: c.role_type,
          status: c.status,
        })),
      },
      lalaverse: {
        ...WORLD_CONFIGS.lalaverse,
        stats: buildWorldStats(worldCharsMap.lalaverse),
        characters: worldCharsMap.lalaverse.map((c) => ({
          id: c.id,
          name: c.selected_name || c.display_name,
          role_type: c.role_type,
          status: c.status,
        })),
      },
      total_characters: allChars.length,
    });

  } catch (err) {
    console.error('[ecosystem] error:', err?.message);
    return res.json({
      book1: { stats: { total: 0, roleCount: {}, health: 'unknown' }, characters: [] },
      lalaverse: { stats: { total: 0, roleCount: {}, health: 'unknown' }, characters: [] },
      total_characters: 0,
    });
  }
});

// ─── POST /propose-seeds ──────────────────────────────────────────────────────
router.post('/propose-seeds', optionalAuth, async (req, res) => {
  const {
    world,
    count: seedCount,
    role_type_focus,
    existing_names,
    ecosystem_stats,
  } = req.body;
  const count = Math.min(Math.max(parseInt(seedCount) || 10, 1), 25);

  const worldConfig = world === 'lalaverse' ? WORLD_CONFIGS.lalaverse : WORLD_CONFIGS.book1;
  const [ageMin, ageMax] = worldConfig.age_range;

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const existingNamesStr = (existing_names || []).join(', ') || 'none yet';
    const ecosystemStr = ecosystem_stats
      ? `Current role distribution: ${JSON.stringify(ecosystem_stats.roleCount)}. Saturated roles (avoid adding more): ${ecosystem_stats.saturated?.join(', ') || 'none'}. Empty roles (prioritize): ${ecosystem_stats.empty?.join(', ') || 'none'}.`
      : '';

    const systemPrompt = `You are proposing ${count} character seeds for the ${worldConfig.label}.

WORLD CONTEXT:
${worldConfig.setting}
Tone: ${worldConfig.tone}
Age range: ${ageMin}–${ageMax}

EXISTING CHARACTERS (avoid name collision and phonetic similarity):
${existingNamesStr}

${ecosystemStr}

ROLE TYPES:
${ROLE_TYPES.map((r) => `- ${r}: ${ROLE_DEFINITIONS[r]}`).join('\n')}

TENSION RULES:
- The tension is a single sentence describing the live wire running through this person
- It must be a genuine internal contradiction — two things that are both true and both cost something
- It should be specific enough that no other character in this world could have exactly this tension
- Adult register: real wounds, real desires, real contradictions. No softening.
- Examples of good tension:
  "She built her career on being likable and now likability is the cage."
  "He knows exactly what his wife needs and gives her everything except that."
  "She left her marriage to find herself and found out she was her marriage."

DIVERSITY:
- Vary gender freely: women, men, nonbinary — use what fits the tension
- Vary age within the range
- Vary career meaningfully — not all content creators
- Each seed should feel like a different kind of person

Return ONLY valid JSON — no preamble, no markdown:
{
  "seeds": [
    {
      "name": "string",
      "age": number,
      "gender": "woman|man|nonbinary",
      "pronouns": "she/her|he/him|they/them",
      "world": "${world === 'lalaverse' ? 'lalaverse' : 'book1'}",
      "role_type": "pressure|mirror|support|shadow|special",
      "career": "one sentence describing their job",
      "tension": "one sentence — the live wire",
      "why_this_world": "one sentence — why they belong in this world specifically"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: Math.max(3000, count * 300),
      system: systemPrompt,
      messages: [{ role: 'user', content: `Propose ${count} character seeds.` }],
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse seeds from Claude.' });
    }

    return res.json({
      seeds: parsed.seeds || [],
      world,
      world_config: worldConfig,
    });

  } catch (err) {
    console.error('[propose-seeds] error:', err?.message);
    return res.status(500).json({ error: 'Seed proposal failed.' });
  }
});

// ─── POST /generate-batch ─────────────────────────────────────────────────────
router.post('/generate-batch', optionalAuth, async (req, res) => {
  const { seeds, existingCharacters } = req.body;

  if (!seeds?.length) {
    return res.status(400).json({ error: 'seeds array required' });
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const existingStr = (existingCharacters || [])
    .map((c) => `${c.name} (${c.role_type}) — ${c.tension || 'tension unknown'}`)
    .join('\n') || 'none yet';

  // Fetch protagonist consciousness for tonal consistency
  let protagonistConsciousness = '';
  try {
    const genDb = req.app.locals.db || require('../models');
    const { Op } = require('sequelize');
    const protag = await genDb.RegistryCharacter.findOne({
      where: {
        [Op.or]: [
          { role_type: 'protagonist' },
          { selected_name: { [Op.iLike]: '%justaw%' } },
          { display_name: { [Op.iLike]: '%justaw%' } },
        ],
        deleted_at: null,
      },
      attributes: ['selected_name', 'display_name', 'writer_notes'],
    });
    if (protag?.writer_notes) {
      let wn = typeof protag.writer_notes === 'string' ? JSON.parse(protag.writer_notes) : protag.writer_notes;
      const c = wn?.consciousness;
      if (c) {
        const lines = [];
        const pName = protag.selected_name || protag.display_name;
        lines.push(`PROTAGONIST CONSCIOUSNESS (${pName} — use for tonal calibration):`);
        if (c.interior_texture) lines.push(`  Interior: ${c.interior_texture.what_this_sounds_like || ''}`);
        if (c.body_consciousness) lines.push(`  Body: Fear in ${c.body_consciousness.fear_location || '?'}. Tell: ${c.body_consciousness.tell || ''}`);
        if (c.temporal_orientation) lines.push(`  Temporal: ${c.temporal_orientation.primary || 'present'}`);
        if (c.change_mechanism) lines.push(`  Change: ${c.change_mechanism.primary || ''}. Moves her: ${c.change_mechanism.what_actually_changes_her || ''}`);
        protagonistConsciousness = lines.join('\n');
      }
    }
  } catch (e) {
    console.error('[generate-batch] Failed to fetch protagonist consciousness:', e.message);
  }

  const generateOne = async (seed) => {
    const worldConfig = WORLD_CONFIGS[seed.world] || WORLD_CONFIGS.book1;
    const [ageMin, ageMax] = worldConfig.age_range;

    const systemPrompt = `You are generating a complete character profile for the Prime Studios LalaVerse franchise.

SEED:
Name: ${seed.name}
Age: ${seed.age}
Gender: ${seed.gender} (${seed.pronouns})
World: ${seed.world}
Role type: ${seed.role_type} — ${ROLE_DEFINITIONS[seed.role_type]}
Career: ${seed.career}
Core tension: ${seed.tension}

EXISTING CHARACTERS IN THIS WORLD (for relationship proposals):
${existingStr}

WORLD TONE: ${worldConfig.tone}

${protagonistConsciousness ? `${protagonistConsciousness}\nNew characters should feel like they inhabit the same emotional register — their consciousness should be at this level of specificity.\n` : ''}
REGISTER: Adult fiction. Explicit — real wounds, real sexuality, real conflict. No softening.
The profile should read like a file on a real person, not a character description.

Generate a complete profile. Return ONLY valid JSON:
{
  "identity": {
    "name": "${seed.name}",
    "age": ${seed.age},
    "gender": "${seed.gender}",
    "pronouns": "${seed.pronouns}",
    "world": "${seed.world}",
    "role_type": "${seed.role_type}",
    "canon_tier": "minor_canon|supporting_canon|core_canon",
    "story_presence": "story_only|registry|canon"
  },
  "living_state": {
    "current_emotional_state": "string — specific, not generic",
    "current_location": "city/neighborhood or LalaVerse location",
    "knows": "what they are certain of right now",
    "wants": "what they are actively reaching for",
    "unresolved": "what they cannot solve and cannot stop thinking about",
    "momentum": "rising|steady|falling|dormant"
  },
  "arc_timeline": {
    "where_they_are": "one sentence — position in their personal arc",
    "what_just_happened": "specific recent event that changed something",
    "what_is_approaching": "the next thing they can feel coming",
    "what_they_are_avoiding": "the thing they know they need to face"
  },
  "psychology": {
    "core_wound": "the original injury — specific, adult",
    "desire_line": "what they are moving toward",
    "fear_line": "what they are moving away from and pretending not to",
    "coping_mechanism": "how they manage the gap between desire and fear",
    "self_deception": "the story they tell themselves that is not quite true",
    "at_their_best": "who they are when the wound is not running the show",
    "at_their_worst": "who they are when it is",
    "active_dilemmas": [
      "binary option A vs binary option B — both true, both costly",
      "binary option A vs binary option B — both true, both costly",
      "binary option A vs binary option B — both true, both costly"
    ]
  },
  "aesthetic_dna": {
    "visual_signature": "how they look — specific details, not generic beauty descriptors",
    "style": "how they dress — specific, character-revealing",
    "signature_object": "the object that is always near them",
    "room_presence": "how a room changes when they enter it",
    "social_media_aesthetic": "what their feed looks like if they have one"
  },
  "career": {
    "job_title": "string",
    "industry": "string",
    "career_wound": "the specific professional injury they carry",
    "job_antagonist": "who or what opposes them professionally",
    "success_to_them": "what winning looks like in their own definition",
    "success_to_everyone_else": "what the world thinks winning looks like for them",
    "career_tasks": [
      "a specific real task they do regularly",
      "a specific real task they do regularly",
      "a specific real task they do regularly"
    ]
  },
  "relationships": {
    "romantic_status": "single|dating|partnered|married|complicated|ended",
    "romantic_detail": "specific texture of their current romantic situation",
    "what_they_want_from_love": "what they need that they are not saying out loud",
    "how_they_fight": "their specific pattern when a relationship is threatened",
    "last_ending_taught_them": "what their last significant relationship ending revealed",
    "who_they_call_at_2am": "name or description of that person",
    "proposed_connections": [
      {
        "to_character": "name of existing character",
        "direction": "one_way|two_way",
        "from_knows": "what this character knows about them",
        "to_knows": "what they know about this character (null if one_way unaware)",
        "from_feels": "emotional position",
        "relationship_type": "pressure|mirror|support|shadow|romantic|familial|transactional"
      }
    ]
  },
  "story_presence": {
    "worlds": ["book1"],
    "can_introduce_new_characters": false,
    "canon_eligible": false,
    "first_appearance_trigger": "the condition under which they enter a story naturally",
    "story_types_suited_for": ["internal", "collision", "wrong_win"]
  },
  "voice": {
    "how_they_speak": "specific speech pattern — rhythm, vocabulary, what they reach for",
    "what_they_never_say_directly": "the thing they always approach sideways",
    "their_tell": "what they do when they are lying or hiding",
    "signature_sentence_structure": "an example sentence that could only be theirs",
    "what_silence_means_for_them": "what it means when they go quiet"
  },
  "dilemma": {
    "active": "the binary choice that is currently live for them",
    "latent_1": "a second binary that could activate under pressure",
    "latent_2": "a third binary that the story engine can deploy",
    "collision_potential": "which existing character's dilemma collides most productively with theirs"
  },
  "plot_threads": [
    {
      "thread": "specific unresolved situation",
      "status": "open",
      "activation_condition": "what would bring this thread into a story"
    },
    {
      "thread": "specific unresolved situation",
      "status": "open",
      "activation_condition": "what would bring this thread into a story"
    },
    {
      "thread": "specific unresolved situation",
      "status": "open",
      "activation_condition": "what would bring this thread into a story"
    }
  ]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Generate full profile for ${seed.name}.` }],
      });

      const raw = response.content?.[0]?.text || '';
      const profile = JSON.parse(raw.replace(/```json|```/g, '').trim());

      return {
        seed,
        profile,
        status: 'generated',
        error: null,
      };
    } catch (err) {
      return {
        seed,
        profile: null,
        status: 'failed',
        error: err?.message,
      };
    }
  };

  try {
    // Generate sequentially to avoid Anthropic rate limits (parallel kills 7 of 8)
    const results = [];
    for (let i = 0; i < seeds.length; i++) {
      console.log(`[generate-batch] Generating ${i + 1}/${seeds.length}: ${seeds[i].name}`);
      const result = await generateOne(seeds[i]);
      results.push(result);
      // Small delay between calls to stay within rate limits
      if (i < seeds.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`[generate-batch] Done: ${results.filter((r) => r.status === 'generated').length} generated, ${results.filter((r) => r.status === 'failed').length} failed`);

    return res.json({
      batch: results,
      generated: results.filter((r) => r.status === 'generated').length,
      failed: results.filter((r) => r.status === 'failed').length,
    });

  } catch (err) {
    console.error('[generate-batch] error:', err?.message);
    return res.status(500).json({ error: 'Batch generation failed.' });
  }
});

// ─── POST /check-staging ──────────────────────────────────────────────────────
router.post('/check-staging', optionalAuth, async (req, res) => {
  const { character, existingCharacters, ecosystemStats } = req.body;

  if (!character) return res.status(400).json({ error: 'character required' });

  const warnings = [];
  const errors = [];

  const name = character.identity?.name || character.seed?.name || '';
  const roleType = character.identity?.role_type || character.seed?.role_type || '';
  const world = character.identity?.world || character.seed?.world || 'book1';

  // ── Name collision check
  const existing = existingCharacters || [];
  const exactMatch = existing.find((c) =>
    c.name?.toLowerCase() === name.toLowerCase()
  );
  if (exactMatch) {
    errors.push({
      type: 'name_collision',
      severity: 'critical',
      message: `"${name}" already exists in the registry.`,
    });
  }

  // Phonetic similarity (simple: first 3 chars match)
  const phoneticMatch = existing.find((c) => {
    const a = (c.name || '').toLowerCase().slice(0, 3);
    const b = name.toLowerCase().slice(0, 3);
    return a === b && c.name?.toLowerCase() !== name.toLowerCase();
  });
  if (phoneticMatch) {
    warnings.push({
      type: 'phonetic_similarity',
      severity: 'warning',
      message: `"${name}" sounds similar to existing character "${phoneticMatch.name}". May cause reader confusion.`,
    });
  }

  // ── Role saturation check
  const worldStats = ecosystemStats?.[world]?.stats;
  if (worldStats?.roleCount && roleType) {
    const currentCount = worldStats.roleCount[roleType] || 0;
    if (currentCount >= 4) {
      warnings.push({
        type: 'role_saturation',
        severity: 'warning',
        message: `${world} already has ${currentCount} ${roleType} characters. Consider a different role type.`,
      });
    }
    if (currentCount >= 6) {
      errors.push({
        type: 'role_oversaturation',
        severity: 'critical',
        message: `${world} is oversaturated with ${roleType} characters (${currentCount}). Strongly consider a different role type.`,
      });
    }
  }

  // ── Age range check
  const worldConfig = WORLD_CONFIGS[world] || WORLD_CONFIGS.book1;
  const age = character.identity?.age || character.seed?.age;
  if (age) {
    const [ageMin, ageMax] = worldConfig.age_range;
    if (age < ageMin || age > ageMax) {
      warnings.push({
        type: 'age_range',
        severity: 'warning',
        message: `Age ${age} is outside the ${world} range (${ageMin}–${ageMax}).`,
      });
    }
  }

  // ── Dilemma collision check (positive)
  const activeDilemma = character.dilemma?.active || character.profile?.dilemma?.active;
  const collisionTarget = character.dilemma?.collision_potential || character.profile?.dilemma?.collision_potential;

  const collisionCharacter = collisionTarget
    ? existing.find((c) => c.name?.toLowerCase().includes(collisionTarget.toLowerCase()))
    : null;

  return res.json({
    errors,
    warnings,
    can_commit: errors.length === 0,
    collision_character: collisionCharacter ? {
      name: collisionCharacter.name,
      role_type: collisionCharacter.role_type,
      dilemma_note: collisionTarget,
    } : null,
  });
});

// ─── POST /commit ─────────────────────────────────────────────────────────────
router.post('/commit', optionalAuth, async (req, res) => {
  const { profile, seed, registryId } = req.body;

  if (!profile || !registryId) {
    return res.status(400).json({ error: 'profile and registryId required' });
  }

  const db = req.app.locals.db || require('../models');

  try {
    const identity   = profile.identity || {};
    const living     = profile.living_state || {};
    const psych      = profile.psychology || {};
    const aesthetic  = profile.aesthetic_dna || {};
    const career     = profile.career || {};
    const rels       = profile.relationships || {};
    const voice      = profile.voice || {};
    const dilemma    = profile.dilemma || {};
    const storyPres  = profile.story_presence || {};
    const threads    = profile.plot_threads || [];

    // ── Duplicate guard: check if character with same name already exists in registry ──
    const rawName = seed?.name || identity.name || 'unnamed';
    const { Op } = require('sequelize');
    const existing = await db.RegistryCharacter.findOne({
      where: {
        registry_id: registryId,
        [Op.or]: [
          { display_name: rawName },
          { selected_name: rawName },
        ],
        deleted_at: null,
      },
    });
    if (existing) {
      console.log(`[commit] Duplicate blocked: "${rawName}" already exists in registry ${registryId} (id: ${existing.id})`);
      return res.json({
        success: true,
        character_id: existing.id,
        name: existing.display_name || existing.selected_name,
        message: `${rawName} already exists in registry (duplicate prevented).`,
        duplicate: true,
      });
    }

    // Generate a unique character_key slug from the name
    const baseKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uniqueKey = `${baseKey}-${Date.now().toString(36)}`;

    // Validate enum values against DB constraints
    const VALID_ROLE_TYPES = ['protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'];
    const VALID_APPEARANCE_MODES = ['on_page', 'composite', 'observed', 'invisible', 'brief'];
    const rawRole = (identity.role_type || seed?.role_type || 'support').toLowerCase().replace(/[^a-z]/g, '');
    const safeRole = VALID_ROLE_TYPES.includes(rawRole) ? rawRole : 'support';

    // ── Build relationships_map in the structure the Registry expects ──
    const relMap = { allies: '', rivals: '', mentors: '', love_interests: '', business_partners: '', dynamic_notes: '' };
    const typeToCategory = {
      support: 'allies', familial: 'allies',
      pressure: 'rivals', shadow: 'rivals',
      mirror: 'mentors',
      romantic: 'love_interests',
      transactional: 'business_partners',
    };
    (rels.proposed_connections || []).forEach(conn => {
      const cat = typeToCategory[conn.relationship_type] || 'allies';
      const label = `${conn.to_character} (${conn.from_feels || conn.relationship_type})`;
      relMap[cat] = relMap[cat] ? `${relMap[cat]}, ${label}` : label;
    });
    // Gather rich relationship context as dynamic notes
    const relNotes = [
      rels.romantic_status && `Status: ${rels.romantic_status}`,
      rels.romantic_detail,
      rels.what_they_want_from_love && `Wants from love: ${rels.what_they_want_from_love}`,
      rels.how_they_fight && `Fights by: ${rels.how_they_fight}`,
      rels.last_ending_taught_them && `Last ending taught: ${rels.last_ending_taught_them}`,
      rels.who_they_call_at_2am && `2 AM call: ${rels.who_they_call_at_2am}`,
    ].filter(Boolean).join('. ');
    if (relNotes) relMap.dynamic_notes = relNotes;

    // ── Build concise writer notes (not a data dump) ──
    const writerNoteLines = [
      dilemma.active && `Active Dilemma: ${dilemma.active}`,
      dilemma.latent_1 && `Latent Dilemma 1: ${dilemma.latent_1}`,
      dilemma.latent_2 && `Latent Dilemma 2: ${dilemma.latent_2}`,
      dilemma.collision_potential && `Collision: ${dilemma.collision_potential}`,
      living.unresolved && `Unresolved: ${living.unresolved}`,
      ...(psych.active_dilemmas || []).map(d => `Dilemma: ${d}`),
      ...(threads || []).map(t => `Thread: ${t.thread} [${t.status}] — ${t.activation_condition}`),
    ].filter(Boolean).join('\n');

    const arcTimeline = profile.arc_timeline || {};

    const characterData = {
      registry_id: registryId,
      character_key: uniqueKey,
      display_name:   seed?.name || identity.name,
      selected_name:  seed?.name || identity.name,
      role_type:      safeRole,
      role_label:     identity.role_type || seed?.role_type || 'support',
      appearance_mode: 'on_page',
      canon_tier:     identity.canon_eligible ? 'canon' : 'none',
      status:         'draft',

      // ── Psychology flat fields ──
      core_desire:        psych.desire_line || '',
      core_fear:          psych.fear_line || '',
      core_wound:         psych.core_wound || '',
      mask_persona:       psych.self_deception || '',
      truth_persona:      psych.at_their_worst || '',
      character_archetype: identity.role_type || seed?.role_type || '',
      signature_trait:    psych.coping_mechanism || '',
      emotional_baseline: living.current_emotional_state || '',
      belief_pressured:   psych.core_wound || '',
      emotional_function: psych.desire_line || '',
      description:        seed?.career
        ? `${seed.career}. ${living.current_emotional_state || ''}`
        : (living.current_emotional_state || ''),

      // ── personality_matrix JSONB ──
      personality_matrix: JSON.stringify({
        core_wound:        psych.core_wound,
        desire_line:       psych.desire_line,
        fear_line:         psych.fear_line,
        coping_mechanism:  psych.coping_mechanism,
        self_deception:    psych.self_deception,
        at_their_best:     psych.at_their_best,
        at_their_worst:    psych.at_their_worst,
      }),

      // ── career_status JSONB ──
      career_status: JSON.stringify({
        profession:         career.job_title || '',
        career_goal:        career.success_to_them || '',
        reputation_level:   career.success_to_everyone_else || '',
        brand_relationships: (career.career_tasks || []).join(', '),
        financial_status:   career.industry || '',
        public_recognition: career.job_antagonist || '',
        ongoing_arc:        career.career_wound || '',
      }),

      // ── aesthetic_dna JSONB ──
      aesthetic_dna: JSON.stringify({
        era_aesthetic:          aesthetic.style || '',
        color_palette:          aesthetic.social_media_aesthetic || '',
        signature_silhouette:   aesthetic.visual_signature || '',
        signature_accessories:  aesthetic.signature_object || '',
        glam_energy:            aesthetic.room_presence || '',
        visual_evolution_notes: '',
      }),

      // ── relationships_map JSONB ──
      relationships_map: JSON.stringify(relMap),

      // ── voice_signature JSONB ──
      voice_signature: JSON.stringify({
        speech_pattern:          voice.how_they_speak || '',
        vocabulary_tone:         voice.signature_sentence_structure || '',
        catchphrases:            voice.their_tell || '',
        internal_monologue_style: voice.what_they_never_say_directly || '',
        emotional_reactivity:    voice.what_silence_means_for_them || '',
      }),

      // ── story_presence JSONB ──
      story_presence: JSON.stringify({
        appears_in_books:    (storyPres.worlds || []).join(', '),
        appears_in_shows:    '',
        appears_in_series:   '',
        current_story_status: storyPres.first_appearance_trigger || '',
        unresolved_threads:  (storyPres.story_types_suited_for || []).join(', '),
        future_potential:    storyPres.can_introduce_new_characters ? 'Yes' : 'No',
      }),

      // ── evolution_tracking JSONB ──
      evolution_tracking: JSON.stringify({
        version_history:    arcTimeline.what_just_happened || '',
        era_changes:        arcTimeline.where_they_are || '',
        personality_shifts: arcTimeline.what_they_are_avoiding || '',
      }),

      // ── Writer notes (human-readable, not a JSON dump) ──
      writer_notes: writerNoteLines || '',

      name_options: JSON.stringify([seed?.name || identity.name]),
    };

    const newChar = await db.RegistryCharacter.create(characterData);

    return res.json({
      success: true,
      character_id: newChar.id,
      name: newChar.display_name || newChar.selected_name,
      message: `${newChar.display_name || newChar.selected_name} added to registry as draft.`,
    });

  } catch (err) {
    console.error('[commit] error:', err?.message);
    return res.status(500).json({ error: 'Commit failed: ' + err?.message });
  }
});

// ─── POST /rewrite-field ──────────────────────────────────────────────────────
router.post('/rewrite-field', optionalAuth, async (req, res) => {
  const { fieldPath, currentValue, characterContext } = req.body;
  if (!fieldPath || !currentValue) {
    return res.status(400).json({ error: 'fieldPath and currentValue required' });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are rewriting a single character profile field for an AI-generated character. Match the adult-fiction register — specific, grounded, no softening. Return ONLY the new text (no quotes, no preamble, no explanation).\n\nCharacter: ${characterContext?.name || 'Unknown'}\nRole: ${characterContext?.role || '?'}\nTension: ${characterContext?.tension || '?'}\nWorld: ${characterContext?.world || '?'}`,
      messages: [{
        role: 'user',
        content: `Rewrite this "${fieldPath}" field. Keep the same level of specificity but give a fresh take:\n\nCurrent: ${currentValue}\n\nNew version:`,
      }],
    });

    const newValue = response.content?.[0]?.text?.trim() || currentValue;
    return res.json({ fieldPath, newValue });
  } catch (err) {
    console.error('[rewrite-field] error:', err?.message);
    return res.status(500).json({ error: 'Rewrite failed: ' + err?.message });
  }
});

module.exports = router;
