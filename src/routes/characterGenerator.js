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

// ─── Demographic Snapshot: reads existing roster before generation ────────────
function buildDemographicSnapshot(existingCharacters) {
  const chars = existingCharacters || [];
  const total = chars.length;
  if (total === 0) return { empty: true };

  const ages = chars.map(c => c.age).filter(Boolean);
  const ageRanges = {
    '18-22': ages.filter(a => a >= 18 && a <= 22).length,
    '23-27': ages.filter(a => a >= 23 && a <= 27).length,
    '28-32': ages.filter(a => a >= 28 && a <= 32).length,
    '33-38': ages.filter(a => a >= 33 && a <= 38).length,
    '39-45': ages.filter(a => a >= 39 && a <= 45).length,
    'unset':  total - ages.length,
  };

  const cityCount = {};
  ['nova_prime','velour_city','the_drift','solenne','cascade_row'].forEach(c => {
    cityCount[c] = chars.filter(ch => ch.current_city === c).length;
  });
  const cityUnset = chars.filter(c => !c.current_city || c.current_city === 'unknown').length;

  const classCount = {};
  ['poverty','working_class','lower_middle','middle_class','upper_middle','wealthy','old_money'].forEach(c => {
    classCount[c] = chars.filter(ch => ch.class_origin === c).length;
  });

  const familyCount = {};
  ['two_parents_intact','single_mother','single_father','raised_by_grandparents',
   'raised_by_other_relatives','blended_family','foster_or_adopted','effectively_alone'].forEach(f => {
    familyCount[f] = chars.filter(c => c.family_structure === f).length;
  });

  const gaps = [];
  if (ageRanges['33-38'] === 0) gaps.push('no characters in their mid-30s');
  if (ageRanges['39-45'] === 0) gaps.push('no characters in their 40s');
  if (cityCount['the_drift'] === 0) gaps.push('no characters in The Drift');
  if (cityCount['solenne'] === 0) gaps.push('no characters in Solenne');
  if (cityCount['cascade_row'] === 0) gaps.push('no characters in Cascade Row');
  if (classCount['poverty'] === 0) gaps.push('no characters from poverty origin');
  if (classCount['working_class'] <= 1) gaps.push('very few working class origin characters');
  if (classCount['wealthy'] === 0 && classCount['old_money'] === 0) gaps.push('no wealthy origin characters');
  if (familyCount['single_mother'] === 0) gaps.push('no characters raised by single mother');
  if (familyCount['foster_or_adopted'] === 0) gaps.push('no characters who were fostered or adopted');
  if (familyCount['effectively_alone'] === 0) gaps.push('no characters who were effectively alone');

  return { total, ageRanges, cityCount, cityUnset, classCount, familyCount, gaps };
}

// ─── Demographic Coherence Check (advisory, not blocking) ────────────────────
function checkDemographicCoherence(character) {
  const warnings = [];
  const c = character;
  const profile = c.profile || c;
  const depth = profile.depth || {};
  const demo = profile.demographics || {};
  const psych = profile.psychology || {};
  const wound = psych.core_wound || depth.blind_spot || '';

  const classOrigin = demo.class_origin || c.class_origin;
  const moneyPattern = depth.money_behavior_pattern || demo.money_behavior_pattern;
  const familyStruct = demo.family_structure || c.family_structure;
  const age = demo.age || c.age || profile.identity?.age;
  const yearsPosting = demo.years_posting || c.years_posting;
  const classMobility = demo.class_mobility_direction || c.class_mobility_direction;
  const foreclosed = depth.foreclosed_category || c.foreclosed_category;

  if (classOrigin === 'poverty' && moneyPattern === 'performs_wealth') {
    warnings.push({
      field: 'money_behavior_pattern',
      message: 'Poverty origin + performs_wealth is a valid combination but requires a clear story reason',
      note: 'the performance is usually covering survival anxiety',
    });
  }
  if (classOrigin === 'wealthy' && moneyPattern === 'hoarder') {
    warnings.push({
      field: 'money_behavior_pattern',
      message: 'Wealthy origin + hoarder is unusual — confirm this is intentional',
      note: 'old_money hoarding is different from scarcity hoarding — both exist',
    });
  }

  if (familyStruct === 'effectively_alone' && wound &&
      !wound.toLowerCase().includes('invisible') &&
      !wound.toLowerCase().includes('seen') &&
      !wound.toLowerCase().includes('abandon')) {
    warnings.push({
      field: 'wound',
      message: 'effectively_alone family structure often produces invisibility or abandonment wounds',
      note: 'Confirm the stated wound connects to this specific family architecture',
    });
  }

  if (age && yearsPosting && (age - yearsPosting) < 14) {
    warnings.push({
      field: 'years_posting',
      message: `Age ${age} - ${yearsPosting} years posting = started at age ${age - yearsPosting}`,
      note: 'Started posting before age 14 — confirm this is intentional (child creator narrative)',
    });
  }

  if (classMobility === 'ascending' && foreclosed === 'belonging') {
    warnings.push({
      field: 'foreclosed_category',
      message: 'ascending mobility + foreclosed belonging is a strong combination',
      note: 'She rose but cannot feel she belongs where she arrived — confirm this is the story',
    });
  }

  return warnings;
}

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

DEMOGRAPHIC HINTS:
For each seed, also include a demographic_hint object:
{
  age_range: '18-22' | '23-27' | '28-32' | '33-38' | '39-45',
  city_hint: one of the 5 LalaVerse cities (nova_prime, velour_city, the_drift, solenne, cascade_row),
  class_origin_hint: one of poverty, working_class, lower_middle, middle_class, upper_middle, wealthy, old_money,
  family_hint: brief (e.g. 'raised by grandmother', 'single mother, oldest of 4')
}
The demographic_hint is a suggestion, not a lock.
generate-batch will finalize all demographic fields — the hint just sets direction.
Choose hints that create variety across the batch.
Do not suggest the same age_range or city for more than 2 seeds in a batch.

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
      "why_this_world": "one sentence — why they belong in this world specifically",
      "demographic_hint": {
        "age_range": "23-27",
        "city_hint": "nova_prime",
        "class_origin_hint": "working_class",
        "family_hint": "brief family note"
      }
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

  // Build demographic snapshot from existing roster for gap detection
  const snapshot = buildDemographicSnapshot(existingCharacters || []);
  const demographicContext = snapshot.empty ? '' : `
EXISTING ROSTER DEMOGRAPHICS:
Total characters: ${snapshot.total}
Age distribution: ${JSON.stringify(snapshot.ageRanges)}
City distribution: ${JSON.stringify(snapshot.cityCount)} (${snapshot.cityUnset} unset)
Class origin: ${JSON.stringify(snapshot.classCount)}
Family structure: ${JSON.stringify(snapshot.familyCount)}

GAPS TO FILL (prioritize these in your generation):
${snapshot.gaps.length > 0 ? snapshot.gaps.map(g => '- ' + g).join('\n') : '- No critical gaps. Vary naturally.'}
`;

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

${demographicContext}
═══════════════════════════════════════════════
DEMOGRAPHIC GENERATION — REQUIRED FOR ALL CHARACTERS
═══════════════════════════════════════════════

Every character MUST have a "demographics" object with all fields populated.
Do not leave them vague or unspecified. These are world facts, not psychological notes.

AGE: Generate a specific age between 18 and 45. Do not cluster between 22-26. A 38-year-old who has been grinding for 15 years is different from a 23-year-old who blew up overnight. If the roster gaps show no characters in their 30s or 40s, generate in those ranges.

CITY: Assign one of: nova_prime, velour_city, the_drift, solenne, cascade_row.
- nova_prime: ambition capital, everyone is building toward industry
- velour_city: fashion/beauty epicenter, aesthetics are currency, old money new money clash
- the_drift: underground, experimental, the city for people who don't fit the main narrative
- solenne: quieter, old world, legacy families, slower burn, longer memory
- cascade_row: emerging, hustler energy, everyone building from nothing
Choose the city that makes her story richer, not the most common in the roster.

CLASS ORIGIN (where she was born into, not where she is now):
poverty | working_class | lower_middle | middle_class | upper_middle | wealthy | old_money
Class origin shapes money_behavior_pattern and operative_cosmology. Make the choice intentional.

CURRENT CLASS vs ORIGIN: If they differ, specify class_mobility_direction.
- ascending: rose — carries survivor guilt, imposter syndrome, cost of leaving your people
- descending: fell — carries shame, reinvention, anger of losing what she had

FAMILY STRUCTURE: Do not default to two_parents_intact. Most people did not grow up this way.
- effectively_alone: parents physically present but not actually there — the invisible wound

CULTURAL BACKGROUND & NATIONALITY: Be specific. Not generic labels. The specific texture of identity — generation, region, how class and culture intersect for this particular person.

PHYSICAL PRESENCE: Not measurements. How she takes up space. What people notice before she speaks.

VOICE SIGNATURE: How she actually sounds. Cadence, vocabulary, code-switching patterns. In DMs vs captions vs arguments vs apologies.

CAREER HISTORY: What she tried before this. Nobody arrives at content creator without a before.

YEARS POSTING: A specific number between 1 and 12. Duration shapes the entire story.

FOLLOWER TIER: ghost (<1k) | micro (1k-10k) | mid (10k-100k) | macro (100k-1M) | mega (1M+)

CONSISTENCY RULE: All demographic fields must be internally consistent with psychological fields. The test: could you trace from class_origin → family_structure → wound → money_behavior_pattern → operative_cosmology in a single coherent line?
═══════════════════════════════════════════════

LIFE STAGE CONTEXT (infer from age ${seed.age}):
- Early Adulthood (18-28): identity formation, first real failures, belief that exceptions apply to them
- Establishment (29-39): building, proving, the gap between the life imagined and the life happening
- Midlife (40-54): reckoning, reinvention, the arithmetic of time becoming real
- Later Life (55-70): legacy, loss, the relief of caring less about the wrong things, new freedoms
- Elder (71+): witness consciousness, long perspective, the tenderness of finitude
Use the appropriate life stage to calibrate everything: how they relate to love, ambition, the body, mortality, time, regret, hope, other people's opinions.

Generate a complete profile. The "deep_profile" section is a 14-dimension character anthropology. Generate what you can reasonably infer from the seed info. Use null for fields you genuinely cannot infer — do NOT fabricate generic placeholder text. Every non-null field should be specific to THIS person.

Return ONLY valid JSON:
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
  "demographics": {
    "age": "number (18-45)",
    "birth_year": "number (LalaVerse calendar year)",
    "cultural_background": "specific cultural identity — generation, region, texture",
    "nationality": "where they're from, may differ from current city",
    "first_language": "shapes voice and code-switching",
    "hometown": "where they grew up — specific",
    "current_city": "nova_prime|velour_city|the_drift|solenne|cascade_row|outside_lalaverse",
    "city_migration_history": "cities lived in before current",
    "class_origin": "poverty|working_class|lower_middle|middle_class|upper_middle|wealthy|old_money",
    "current_class": "poverty|working_class|lower_middle|middle_class|upper_middle|wealthy|old_money",
    "class_mobility_direction": "ascending|descending|stable|volatile",
    "family_structure": "two_parents_intact|single_mother|single_father|raised_by_grandparents|raised_by_other_relatives|blended_family|foster_or_adopted|effectively_alone",
    "parents_status": "alive/gone/estranged/complicated — specific",
    "sibling_position": "only_child|oldest|middle|youngest",
    "sibling_count": "number",
    "relationship_status": "single|dating|committed|married|separated|divorced|widowed|complicated",
    "has_children": "boolean",
    "children_ages": "freeform: '4 and 7' or 'infant' or null",
    "education_experience": "what it cost and gave — not credentials",
    "career_history": "what she tried before this",
    "years_posting": "number (1-12)",
    "physical_presence": "how she takes up space, not appearance stats",
    "voice_signature_text": "cadence, vocabulary, code-switching — how she actually sounds",
    "platform_primary": "lalaverse_main|multi_platform|live_first|archive_heavy",
    "follower_tier": "ghost|micro|mid|macro|mega"
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
  "living_context": {
    "active_pressures": "what is pressing on them right now — specific, practical",
    "support_network": "who holds them up and what that costs",
    "home_environment": "what their daily domestic life looks and feels like",
    "relationship_to_deadlines": "how they relate to time pressure and urgency",
    "financial_reality": "their actual financial situation — specific, not abstract",
    "current_season": "the emotional season they are in — not calendar, life-season"
  },
  "psychology": {
    "core_wound": "the original injury — specific, adult",
    "desire_line": "what they are moving toward",
    "hidden_want": "what they actually want but will not admit — the desire beneath the desire",
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
        "relationship_type": "pressure|mirror|support|shadow|romantic|familial|transactional",
        "role_tag": "ally|detractor|mentor|dependency|rival|partner|family|neutral",
        "from_feels": "emotional position toward them",
        "source_knows": "what this character knows about them — specific, not generic",
        "target_knows": "what they know about this character — specific, not generic",
        "reader_knows": "what the reader should know that neither character knows yet"
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
    }
  ],
  "deep_profile": {
    "life_stage": {
      "stage": "early_adulthood|establishment|midlife|later_life|elder",
      "relationship_to_time": "how they experience time passing — abundance, urgency, arithmetic, legacy",
      "relationship_to_love": "how their age shapes what they want and tolerate in love",
      "relationship_to_ambition": "how their age shapes what they're still willing to chase",
      "relationship_to_body": "how their age shapes their experience of their physical self",
      "relationship_to_mortality": "how close death feels and what that does to their choices"
    },
    "the_body": {
      "body_image": "how they see themselves vs. how they actually look vs. how others see them",
      "physical_health": "chronic conditions, fatigue patterns, what the body costs them",
      "relationship_to_body": "do they live in their body or manage it from a distance? Does pleasure feel safe?",
      "physical_presence": "how much space do they take up? Do they shrink or command? Does it depend on the room?",
      "body_history": "violence, pregnancy, addiction, surgery, starvation, abuse — the body remembers",
      "sensory_signature": "what do they notice first? What sensory detail takes them back somewhere?"
    },
    "class_and_money": {
      "class_of_origin": "what did money mean in the house they grew up in?",
      "current_class": "where are they now vs. where they started?",
      "class_mobility_cost": "the psychological cost of moving up or down",
      "money_wound": "a specific financial trauma that still drives behavior",
      "spending_pattern": "spender, hoarder, avoider, performer — what does spending feel like emotionally?",
      "what_money_means": "safety? Freedom? Love? Proof of worth?"
    },
    "religion_and_meaning": {
      "religious_background": "what they were raised with — this lives in the body even when the mind rejects it",
      "current_belief": "practicing, lapsed, searching, atheist, spiritual, privately devout",
      "relationship_to_god": "do they pray? Argue? Have they abandoned it? Does it abandon them?",
      "what_they_believe_about_suffering": "about fairness, about whether good things happen to good people",
      "personal_ritual": "what do they do that is sacred to them even if they wouldn't call it that?",
      "meaning_making_style": "when something bad happens, what is their first move toward making sense of it?"
    },
    "race_and_culture": {
      "ethnic_identity": "what do they claim? What claims them?",
      "cultural_inheritance": "food, language, ritual, expectation, shame, pride — what got passed down?",
      "relationship_to_culture": "fully claimed, complicated, distant, actively reclaimed, or grieving a disconnection?",
      "what_culture_taught_them": "about women, about ambition, about marriage, about bodies, about loyalty",
      "racial_experience": "what has their race cost them? Given them? What rooms were they the only one?",
      "code_switching": "do they do it? When? What does it cost?"
    },
    "sexuality_and_desire": {
      "orientation": "who they're drawn to, including the complexity of understanding it",
      "relationship_to_desire": "is desire something they trust? Fear? Perform? Suppress? Have lost touch with?",
      "formative_experience": "the earliest experience that shaped how love and want got wired together",
      "what_intimacy_means": "safety, performance, surrender, power, proof of worth, connection, transaction?",
      "what_they_need_to_feel_desire": "safety, permission, darkness, humor, slowness, intensity? What turns it off?",
      "the_pattern": "who do they keep choosing and why? What does the pattern reveal about the wound?",
      "what_theyve_never_said": "the thing they want that they've never asked for — Voice C's domain"
    },
    "family_architecture": {
      "birth_order": "and what it gave them — responsibility, invisibility, freedom, resentment",
      "family_role": "the responsible one, the funny one, the invisible one, the problem, the golden child",
      "parent_wounds": "what did each parent carry that they unknowingly handed to this character?",
      "sibling_dynamics": "the specific texture — old grudges, old loyalties, who they call when things go wrong",
      "what_family_taught_about_love": "is it conditional? Is home a place that holds you or one you escape from?",
      "the_family_secret": "what is it? Who knows? What does carrying it cost?"
    },
    "friendship_and_loyalty": {
      "how_they_make_friends": "easily? With difficulty? Let people in quickly then panic and pull back?",
      "how_they_keep_friends": "initiator or waiter? Do they disappear when things get hard?",
      "the_oldest_friend": "who knew them before — what does that person know that no one else does?",
      "who_they_actually_call": "at 2 AM. Not who they should call. Who they actually call.",
      "betrayal_history": "who hurt them in a way they still carry — not just romantic",
      "what_loyalty_means": "to them specifically — loyal to a fault or learned it's a liability?"
    },
    "ambition_and_identity": {
      "how_they_define_themselves": "through work? Relationships? Who they are to other people?",
      "origin_story_of_ambition": "the story they tell about how they got here — usually a wound in disguise",
      "what_they_gave_up": "for the career, the relationship, the dream — the cost they don't calculate",
      "relationship_to_success": "afraid of it? Self-sabotage at the edge? Is success ever allowed to feel good?",
      "relationship_to_others_success": "especially people they love, especially people they started with",
      "what_they_would_do_differently": "if no one was watching and there were no consequences"
    },
    "habits_and_rituals": {
      "morning": "the first thing they do — phone, pray, lie still, make coffee with precision?",
      "comfort_ritual": "what they do when hurting that they'd never tell anyone about",
      "avoidance_tell": "what they clean, reorganize, or obsess over when avoiding something important",
      "food": "what they eat when no one is watching, what their mother cooked that they still make",
      "physical_tell": "how stress lives in their body — jaw, shoulders, stomach, throat — where first?",
      "what_they_consume": "what they read, watch, listen to when they need to feel less alone",
      "what_their_space_looks_like": "does their home look like who they are or who they're trying to become?"
    },
    "speech_and_silence": {
      "how_they_argue": "cold or loud? The precise devastating thing? Shut down? Apologize mid-point?",
      "what_they_never_say_directly": "what always comes out sideways",
      "how_they_receive_compliments": "deflect? Accept too eagerly? Go still and quiet?",
      "what_silence_means": "comfortable intimacy or abandonment?",
      "verbal_tells": "the specific patterns — 'I'm fine' when not, 'no worries' when many worries",
      "speech_rhythm": "trail off? Finish others' sentences? Long pauses? Talk fast when nervous?"
    },
    "grief_and_loss": {
      "what_they_have_lost": "people, versions of themselves, futures they believed in",
      "how_they_grieve": "toward people or away? Function or stop? Does it come out as anger, work, control?",
      "the_unprocessed_loss": "the one still running in the background as behavior rather than feeling",
      "relationship_to_death": "have they lost someone close? How old were they? Does death frighten or clarify?"
    },
    "politics_and_justice": {
      "what_they_believe_about_fairness": "is the world basically good or basically indifferent?",
      "the_injustice_they_cant_ignore": "what makes them actually angry, not performatively concerned?",
      "where_their_hypocrisy_lives": "the gap between what they believe and how they live",
      "what_they_gave_up_on": "the thing they used to believe could be fixed"
    },
    "the_unseen": {
      "the_embarrassing_memory": "years ago, still thinks about in the shower — unwitnessed, unresolved, alive",
      "the_irrational_fear": "not a phobia — something specific and slightly absurd they've never explained",
      "what_they_lie_about": "casually, regularly — the maintenance lies",
      "private_opinions": "opinions they hold that they'd never say in the current social climate",
      "what_makes_them_laugh": "not a big laugh — the specific small thing they can't resist",
      "jealousy_object": "the specific person or type of life that activates envy — what it reveals",
      "who_they_were_at_14": "the interests, obsessions, embarrassments that got buried — some still in there",
      "the_compliment_they_remember": "who said it, when, why it landed",
      "the_criticism_they_cant_let_go": "the one they're still trying to disprove or secretly believe is true",
      "what_they_do_with_ten_free_minutes": "the specific way they handle unexpected unscheduled time"
    }
  },
  "depth": {
    "body_relationship": "How does this character relate to her physical self? Is it currency? Art? Armor? A site of shame? A source of power?",
    "body_history": "What has happened to this body that shaped that relationship? Illness, pregnancy, injury, transformation, discipline, violation.",
    "body_currency": "Does she use her physical appearance as economic or social capital — consciously or not? How?",
    "body_control_pattern": "How does she use physical discipline, deprivation, or indulgence as a stress response?",
    "money_behavior_pattern": "hoarder|compulsive_giver|spends_to_feel_powerful|deprives_out_of_guilt|uses_money_to_control|performs_wealth|balanced|unknown",
    "money_behavior_note": "The specific flavor for this character — the origin in her wound or family architecture.",
    "time_orientation": "past_anchored|future_focused|present_impulsive|suspended|cyclical|unknown",
    "time_orientation_note": "How does this orientation manifest specifically for this character?",
    "change_capacity": "rigid|slow|conditional|fluid|ready|unknown",
    "change_conditions": "What specific conditions make change possible for her? Who needs to be present? What would she need to lose or gain?",
    "change_blocker": "What is the specific thing preventing change — the story, the relationship, the belief, the fear?",
    "circumstance_advantages": "The unchosen advantages — access, timing, proximity, doors that were open. What did she not earn?",
    "circumstance_disadvantages": "The unchosen obstacles — systems working against her, timing that cost her, doors closed before she arrived.",
    "luck_belief": "merit_based|rigged|divinely_ordered|random|relational|chaotic|unknown",
    "luck_belief_vs_stated": "The gap between what she says she believes about how the world works and what she actually operates from.",
    "operative_cosmology": "merit_based|rigged|divinely_ordered|random|relational|unknown",
    "cosmology_vs_stated_religion": "The gap between her stated religious/spiritual beliefs and the actual logic she uses to make meaning.",
    "self_narrative": "The story she tells herself about who she is and why — her origin story, her turning points, her villains, her justifications.",
    "actual_narrative": "AUTHOR KNOWLEDGE — what actually happened, who was actually responsible, what the turning point actually was.",
    "narrative_gap_type": "villain_misidentified|hero_exaggerated|wound_mislocated|cause_reversed|timeline_collapsed|significance_inverted|none_yet|unknown",
    "blind_spot": "AUTHOR KNOWLEDGE — The specific truth about this character that she cannot access. The thing the story is written toward delivering to her.",
    "blind_spot_category": "self_assessment|motivation|impact|pattern|relationship|wound|unknown",
    "foreclosed_category": "AUTHOR KNOWLEDGE — love|safety|belonging|success|rest|joy|visibility|being_known|being_chosen|starting_over|none|unknown",
    "foreclosure_origin": "AUTHOR KNOWLEDGE — When and why did this foreclosure happen? The specific moment or accumulated experience.",
    "foreclosure_vs_stated_want": "AUTHOR KNOWLEDGE — The gap between what she says she's pursuing and what she secretly doesn't believe is available to her.",
    "joy_source": "What makes this character come completely alive — not happy, alive. Present, lit up, fully herself. As specific as a wound.",
    "joy_accessibility": "freely_accessible|conditional|buried|forgotten|unknown",
    "joy_vs_ambition": "Are the joy source and the ambition aligned or in tension? Does what she's building give her the feeling she's actually looking for?"
  }
}

DEPTH FIELD RULES:
- The body_relationship should follow from the wound and the class/money history
- The money_behavior_pattern must be consistent with family architecture and wound
- The time_orientation should be consistent with the character's primary defense mechanism
- The change_capacity should create productive tension with their wound and arc stage
- The blind_spot must be something INVISIBLE to the character — not a secret they hide but a truth they genuinely cannot see. It should be obvious to the reader.
- The actual_narrative is the author's version — often harder, not kinder, than the self_narrative
- The narrative_gap_type should explain the specific distortion in the self_narrative
- The foreclosed_category must be a category the character actively WANTS but secretly doesn't believe is available to them specifically
- The joy_source must be as specific as a wound — not 'creativity' but the exact thing
- Do NOT generate content that contradicts existing locked registry fields
- Mark author_knowledge fields clearly in the depth section`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
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

  // ── Demographic coherence check (advisory, not blocking) ──
  const demographicWarnings = checkDemographicCoherence(character);
  warnings.push(...demographicWarnings.map(w => ({
    type: 'demographic_coherence',
    severity: 'warning',
    message: w.message,
    note: w.note,
    field: w.field,
  })));

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
    const demo       = profile.demographics || {};
    const depth      = profile.depth || {};

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
      gender:         identity.gender || seed?.gender || null,
      pronouns:       identity.pronouns || seed?.pronouns || null,
      role_type:      safeRole,
      role_label:     identity.role_type || seed?.role_type || 'support',
      appearance_mode: 'on_page',
      canon_tier:     identity.canon_eligible ? 'canon' : 'none',
      status:         'draft',

      // ── Psychology flat fields ──
      core_desire:        psych.desire_line || '',
      core_fear:          psych.fear_line || '',
      core_wound:         psych.core_wound || '',
      hidden_want:        psych.hidden_want || '',
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

      // ── living_context JSONB ──
      living_context: JSON.stringify(profile.living_context || {}),

      // ── deep_profile JSONB — 14-dimension character anthropology ──
      deep_profile: JSON.stringify(profile.deep_profile || {}),

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

      // ── Save plot threads to extra_fields ──
      extra_fields: threads.length > 0 ? JSON.stringify({ plot_threads: threads.map((t, i) => ({
        id: `pt-${Date.now()}-${i}`,
        title: t.thread || t.title || '',
        description: t.activation_condition || t.description || '',
        status: t.status || 'open',
        source: t.source || '',
      })) }) : null,

      // ── Demographics ──
      age:                      demo.age || identity.age || seed?.age || null,
      birth_year:               demo.birth_year || null,
      cultural_background:      demo.cultural_background || null,
      nationality:              demo.nationality || null,
      first_language:           demo.first_language || null,
      hometown:                 demo.hometown || null,
      current_city:             demo.current_city || null,
      city_migration_history:   demo.city_migration_history || null,
      class_origin:             demo.class_origin || null,
      current_class:            demo.current_class || null,
      class_mobility_direction: demo.class_mobility_direction || null,
      family_structure:         demo.family_structure || null,
      parents_status:           demo.parents_status || null,
      sibling_position:         demo.sibling_position || null,
      sibling_count:            demo.sibling_count ?? null,
      relationship_status:      demo.relationship_status || null,
      has_children:             demo.has_children ?? null,
      children_ages:            demo.children_ages || null,
      education_experience:     demo.education_experience || null,
      career_history:           demo.career_history || null,
      years_posting:            demo.years_posting ?? null,
      physical_presence:        demo.physical_presence || null,
      demographic_voice_signature: demo.voice_signature_text || null,
      platform_primary:         demo.platform_primary || null,
      follower_tier:            demo.follower_tier || null,

      // ── Character Depth Engine (Section 9-13) ──
      body_relationship:      depth.body_relationship || null,
      body_history:           depth.body_history || null,
      body_currency:          depth.body_currency || null,
      body_control_pattern:   depth.body_control_pattern || null,
      money_behavior_pattern: depth.money_behavior_pattern || null,
      money_behavior_note:    depth.money_behavior_note || null,
      time_orientation_v2:    depth.time_orientation || null,
      time_orientation_note:  depth.time_orientation_note || null,
      change_capacity_v2:     depth.change_capacity || null,
      change_conditions:      depth.change_conditions || null,
      change_blocker:         depth.change_blocker || null,
      circumstance_advantages:    depth.circumstance_advantages || null,
      circumstance_disadvantages: depth.circumstance_disadvantages || null,
      luck_belief:                depth.luck_belief || null,
      luck_belief_vs_stated:      depth.luck_belief_vs_stated || null,
      self_narrative:             depth.self_narrative || null,
      actual_narrative:           depth.actual_narrative || null,
      narrative_gap_type:         depth.narrative_gap_type || null,
      blind_spot:                 depth.blind_spot || null,
      blind_spot_category:        depth.blind_spot_category || null,
      blind_spot_visible_to:      depth.blind_spot_visible_to || null,
      operative_cosmology_v2:     depth.operative_cosmology || null,
      cosmology_vs_stated_religion: depth.cosmology_vs_stated_religion || null,
      foreclosed_category:        depth.foreclosed_category || null,
      foreclosure_origin:         depth.foreclosure_origin || null,
      foreclosure_vs_stated_want: depth.foreclosure_vs_stated_want || null,
      joy_source:                 depth.joy_source || null,
      joy_accessibility:          depth.joy_accessibility || null,
      joy_vs_ambition:            depth.joy_vs_ambition || null,
    };

    const newChar = await db.RegistryCharacter.create(characterData);

    // ── Create relationship edges from proposed_connections ──
    const connections = rels.proposed_connections || [];
    const createdRels = [];
    for (const conn of connections) {
      try {
        const targetName = conn.to_character;
        if (!targetName) continue;

        // Look up target character in same registry
        let target = await db.RegistryCharacter.findOne({
          where: {
            registry_id: registryId,
            [Op.or]: [
              { display_name: targetName },
              { selected_name: targetName },
            ],
            deleted_at: null,
          },
        });

        // If target doesn't exist, create a stub
        if (!target) {
          const stubKey = targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-stub-' + Date.now().toString(36);
          target = await db.RegistryCharacter.create({
            registry_id: registryId,
            character_key: stubKey,
            display_name: targetName,
            selected_name: targetName,
            role_type: 'support',
            status: 'stub',
            appearance_mode: 'on_page',
          });
          console.log(`[commit] Created stub character: "${targetName}" (${target.id})`);
        }

        await db.CharacterRelationship.create({
          character_id_a: newChar.id,
          character_id_b: target.id,
          relationship_type: conn.relationship_type || 'support',
          role_tag: conn.role_tag || null,
          source_knows: conn.source_knows || conn.from_knows || null,
          target_knows: conn.target_knows || conn.to_knows || null,
          reader_knows: conn.reader_knows || null,
          notes: conn.from_feels || null,
          status: 'Active',
          confirmed: false,
        });
        createdRels.push(`${rawName} → ${targetName}`);
        console.log(`[commit] Created relationship: ${rawName} → ${targetName} (${conn.relationship_type})`);
      } catch (relErr) {
        console.error(`[commit] Failed to create relationship to "${conn.to_character}":`, relErr.message);
      }
    }

    return res.json({
      success: true,
      character_id: newChar.id,
      name: newChar.display_name || newChar.selected_name,
      message: `${newChar.display_name || newChar.selected_name} added to registry as draft.`,
      relationships_created: createdRels,
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
