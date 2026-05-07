// ─────────────────────────────────────────────────────────────────────────────
// characterGenerator.js — Character Generator v5.3
// Prime Studios · LalaVerse
//
// Routes:
// GET  /ecosystem          — current world health view
// POST /propose-seeds      — Claude proposes seeds
// POST /generate-batch     — v5.3 batch generation with full demographic snapshot
// POST /check-staging      — collision + saturation + coherence checks
// POST /commit             — save staged character to Registry + world_characters
// POST /rewrite-field      — rewrite a single field via Claude
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// ─── Role type definitions (registry role types) ─────────────────────────────
const ROLE_TYPES = ['pressure', 'mirror', 'support', 'shadow', 'special'];

const ROLE_DEFINITIONS = {
  pressure:    'Creates friction that forces growth. Their logic collides with the protagonist\'s.',
  mirror:      'Reflects something the protagonist cannot see in herself. The comparison lives here.',
  support:     'Present, invested, imperfect. Carries their own wounds into the relationship.',
  shadow:      'Represents the road not taken or the version of the protagonist she fears becoming.',
  special:     'Outside the normal role taxonomy. Franchise-level significance.',
};

// ─── 14 character role types (v5.3 narrative function roles) ─────────────────
const _CHARACTER_ROLE_TYPES = [
  'love_interest', 'one_night_stand', 'industry_peer', 'mentor',
  'antagonist', 'rival', 'collaborator', 'spouse', 'partner',
  'temptation', 'ex', 'confidant', 'friend', 'coworker',
];

// Map character role → registry role_type
const ROLE_MAP = {
  love_interest:   'special',
  one_night_stand: 'special',
  industry_peer:   'mirror',
  mentor:          'support',
  antagonist:      'shadow',
  rival:           'pressure',
  collaborator:    'mirror',
  spouse:          'support',
  partner:         'special',
  temptation:      'shadow',
  ex:              'pressure',
  confidant:       'support',
  friend:          'support',
  coworker:        'mirror',
};

// Roles that get intimate profiles
const INTIMATE_ELIGIBLE_ROLES = [
  'love_interest', 'one_night_stand', 'partner', 'spouse', 'temptation', 'ex',
];

// ─── World configs ───────────────────────────────────────────────────────────
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

// ─── 42 Inter-character pairing rules ────────────────────────────────────────
// [typeA, typeB, relationship_name, tension_type, is_romantic]
const INTER_CHAR_PAIRINGS = [
  ['love_interest', 'rival',          'Romantic Rivalry',         'volatile',   true],
  ['love_interest', 'friend',         'Blurred Lines',            'simmering',  true],
  ['love_interest', 'collaborator',   'Creative Entanglement',    'simmering',  true],
  ['love_interest', 'love_interest',  'Love Triangle',            'simmering',  true],
  ['one_night_stand', 'love_interest','Before It Had a Name',     'simmering',  true],
  ['one_night_stand', 'partner',      'Interference',             'volatile',   true],
  ['spouse', 'temptation',            'Fidelity Test',            'volatile',   false],
  ['partner', 'temptation',           'Loyalty vs Desire',        'volatile',   true],
  ['ex', 'love_interest',             'Unfinished',               'simmering',  true],
  ['ex', 'partner',                   'The Replacement',          'volatile',   false],
  ['ex', 'temptation',                'Regression Risk',          'volatile',   true],
  ['mentor', 'rival',                 'Legacy vs Ambition',       'simmering',  false],
  ['mentor', 'antagonist',            'Competing Agendas',        'fractured',  false],
  ['collaborator', 'rival',           'Partnership Friction',     'simmering',  false],
  ['collaborator', 'industry_peer',   'Creative Competition',     'calm',       false],
  ['industry_peer', 'antagonist',     'Industry Conflict',        'volatile',   false],
  ['industry_peer', 'mentor',         'Power Differential',       'simmering',  false],
  ['friend', 'confidant',             'Inner Circle',             'calm',       false],
  ['friend', 'rival',                 'Complicated Loyalty',      'simmering',  false],
  ['confidant', 'antagonist',         'Compromised Trust',        'fractured',  false],
  ['confidant', 'ex',                 'History Keeper',            'simmering',  false],
  ['coworker', 'love_interest',       'Workplace Tension',        'simmering',  true],
  ['coworker', 'antagonist',          'Professional Friction',    'volatile',   false],
  ['spouse', 'friend',                'Outside the Marriage',     'calm',       false],
  ['spouse', 'confidant',             'The One Who Knows',        'simmering',  false],
  ['temptation', 'friend',            'The Betrayal Setup',       'volatile',   false],
  ['temptation', 'confidant',         'What She Told No One',     'fractured',  false],
  ['antagonist', 'friend',            'Enemy of a Friend',        'volatile',   false],
  ['antagonist', 'collaborator',      'Forced Alliance',          'simmering',  false],
  ['rival', 'collaborator',           'Competitive Partnership',  'simmering',  false],
  ['rival', 'rival',                  'Mutual Threat',            'volatile',   false],
  ['mentor', 'collaborator',          'Unequal Partnership',      'simmering',  false],
  ['mentor', 'confidant',             'Trusted Advisor',          'calm',       false],
  ['love_interest', 'antagonist',     'Dangerous Attraction',     'volatile',   true],
  ['love_interest', 'coworker',       'Office Romance',           'simmering',  true],
  ['one_night_stand', 'coworker',     'The Morning After at Work','volatile',   false],
  ['one_night_stand', 'friend',       'Complicated Morning',      'simmering',  true],
  ['spouse', 'antagonist',            'Threatened Marriage',      'volatile',   false],
  ['partner', 'ex',                   'Overlap',                  'volatile',   false],
  ['partner', 'friend',              'Third Wheel',               'simmering',  false],
  ['ex', 'friend',                    'The One Who Stayed',       'simmering',  false],
  ['temptation', 'coworker',          'Professional Hazard',      'simmering',  true],
];

// ─── Sexuality compatibility check ───────────────────────────────────────────
function isRomanticallyCompatible(charA, charB) {
  const sA = (charA.sexuality || '').toLowerCase();
  const sB = (charB.sexuality || '').toLowerCase();
  const flexible = ['bisexual', 'pansexual', 'queer', 'fluid'];
  if (flexible.some(f => sA.includes(f)) || flexible.some(f => sB.includes(f))) return true;
  if (sA.includes('straight') && sB.includes('straight')) return true;
  if (sA.includes('gay') && sB.includes('gay')) return true;
  if (sA.includes('lesbian') && sB.includes('lesbian')) return true;
  return false;
}

// ─── Demographic Snapshot: reads existing roster from DB ─────────────────────
async function buildDemographicSnapshot(db) {
  try {
    const chars = await db.sequelize.query(
      `SELECT age, current_city, class_origin, family_structure, follower_tier,
              sibling_position, relationship_status, platform_primary
       FROM registry_characters WHERE deleted_at IS NULL`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    const total = chars.length;
    if (total === 0) return { empty: true, gaps: [] };

    const ages = chars.map(c => c.age).filter(Boolean);
    const ageRanges = {
      '18-22': ages.filter(a => a >= 18 && a <= 22).length,
      '23-27': ages.filter(a => a >= 23 && a <= 27).length,
      '28-32': ages.filter(a => a >= 28 && a <= 32).length,
      '33-38': ages.filter(a => a >= 33 && a <= 38).length,
      '39-45': ages.filter(a => a >= 39 && a <= 45).length,
      'unset': total - ages.length,
    };

    const CITIES = ['nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row'];
    const cityCount = {};
    CITIES.forEach(c => { cityCount[c] = chars.filter(ch => ch.current_city === c).length; });

    const CLASS_VALUES = ['destitute', 'working_poor', 'working_class', 'lower_middle', 'middle', 'upper_middle', 'wealthy'];
    const classCount = {};
    CLASS_VALUES.forEach(c => { classCount[c] = chars.filter(ch => ch.class_origin === c).length; });

    const FAMILY_VALUES = ['two_parent_stable', 'two_parent_volatile', 'single_parent',
      'raised_by_relatives', 'foster', 'blended', 'effectively_alone', 'chosen_family'];
    const familyCount = {};
    FAMILY_VALUES.forEach(f => { familyCount[f] = chars.filter(c => c.family_structure === f).length; });

    // Detect gaps
    const gaps = [];
    if (ageRanges['33-38'] === 0) gaps.push('No characters aged 33-38 — add mid-30s characters');
    if (ageRanges['39-45'] === 0) gaps.push('No characters aged 39-45 — add characters in their 40s');
    if (ageRanges['23-27'] > total * 0.4) gaps.push('Over 40% of characters clustered in 23-27 age range — diversify ages');
    CITIES.forEach(c => {
      if (cityCount[c] === 0) gaps.push(`No characters in ${c.replace(/_/g, ' ')} — assign at least one`);
    });
    if (classCount['destitute'] === 0 && classCount['working_poor'] === 0) {
      gaps.push('No characters from destitute or working_poor origin');
    }
    if (classCount['wealthy'] === 0) gaps.push('No wealthy origin characters');
    if (familyCount['single_parent'] === 0) gaps.push('No characters raised by single parent');
    if (familyCount['foster'] === 0) gaps.push('No fostered characters');
    if (familyCount['effectively_alone'] === 0) gaps.push('No characters who were effectively alone');

    return { total, ageRanges, cityCount, classCount, familyCount, gaps };
  } catch (e) {
    console.error('[buildDemographicSnapshot] DB query failed:', e.message);
    return { empty: true, gaps: [] };
  }
}

// ─── Demographic Coherence Check (advisory, not blocking) ────────────────────
function checkDemographicCoherence(characters) {
  const warnings = [];

  const list = Array.isArray(characters) ? characters : [characters];
  list.forEach((c, i) => {
    const classOrigin = c.class_origin;
    const moneyPattern = c.money_behavior_pattern;
    const familyStruct = c.family_structure;
    const age = c.age;
    const yearsPosting = c.years_posting;

    if (['destitute', 'working_poor'].includes(classOrigin) && moneyPattern === 'performs_wealth') {
      warnings.push({
        character_index: i,
        name: c.name,
        rule: 'poverty_performs_wealth',
        message: `${c.name}: ${classOrigin} origin + performs_wealth. Coherent if wound is visibility or belonging — verify.`,
      });
    }

    if (classOrigin === 'wealthy' && moneyPattern === 'hoarder') {
      warnings.push({
        character_index: i,
        name: c.name,
        rule: 'wealthy_hoarder',
        message: `${c.name}: wealthy origin + hoarder. Requires loss-of-security origin story — verify.`,
      });
    }

    if (familyStruct === 'effectively_alone' && c.origin_story &&
        !c.origin_story.toLowerCase().includes('invisib') &&
        !c.origin_story.toLowerCase().includes('abandon') &&
        !c.origin_story.toLowerCase().includes('isolat')) {
      warnings.push({
        character_index: i,
        name: c.name,
        rule: 'isolation_no_wound',
        message: `${c.name}: effectively_alone family but origin_story doesn't reference invisibility/abandonment. Verify intentional.`,
      });
    }

    if (age && yearsPosting && (age - yearsPosting) < 14) {
      warnings.push({
        character_index: i,
        name: c.name,
        rule: 'posting_age_math',
        message: `${c.name}: age ${age} with ${yearsPosting} years posting = started at ${age - yearsPosting}. Adjust.`,
      });
    }
  });

  return warnings;
}

// ─── v5.3 System Prompt ──────────────────────────────────────────────────────
function buildSystemPrompt(gapsArray) {
  const gapsText = gapsArray.length > 0
    ? gapsArray.map(g => `- ${g}`).join('\n')
    : '- No critical gaps. Distribute demographics freely but avoid clustering ages between 22–26.';

  return `You are the Prime Studios Character Generation Engine for the LalaVerse franchise.
You generate supporting characters for two protagonists:
- JustAWoman — a content creator in the real world. Book 1: Before Lala.
   Layer: real-world. Mid-career. Married to David. Building toward legendary.
- Lala — a sentient AI fashion character living in LalaVerse (which sits on
   the internet). Early career, rising but not arrived. Does not know she was
   built by JustAWoman.

Characters populate the world these two protagonists move through. Every
character is a pressure system, not a prop.

---

## LAYER ASSIGNMENT (REQUIRED)

Every character must be assigned to exactly one layer:
- real-world   — exists in JustAWoman's physical and online world
- lalaverse    — exists inside LalaVerse (the internet-world Lala inhabits)
- series-2     — future layer; Lala is protagonist, JustAWoman is celebrity

Layer determines current_city options:
- real-world characters: current_city = "outside_lalaverse"
- lalaverse characters: current_city must be one of the 5 canon city ENUMs:
    nova_prime | velour_city | the_drift | solenne | cascade_row
- series-2 characters: same city ENUMs as lalaverse

DO NOT assign a character to a "book" or "timeline."
Books are story containers. Layers are world containers.
A character belongs to a layer. They appear in whichever books their layer
intersects with.

---

## ROLE TYPES (14 TYPES — ASSIGN EXACTLY ONE)

| Role             | Narrative Function |
|------------------|---------------------|
| love_interest    | Complex, not available in a simple way |
| one_night_stand  | Meets once, the encounter means something |
| industry_peer    | Collaborative with competitive undercurrent |
| mentor           | Ahead of her, help comes with an agenda |
| antagonist       | Makes her path harder without meaning to |
| rival            | Direct competition, mutual respect and disdain |
| collaborator     | Creates with her, chemistry bleeds into everything |
| spouse           | Married to another character or offscreen person |
| partner          | Committed relationship (not married) |
| temptation       | Tests another character's commitment |
| ex               | History didn't end clean |
| confidant        | Trusted friend, loyalty can be weapon or shield |
| friend           | Genuine connection, not strategic |
| coworker         | Shaped by proximity and shared pressure |

---

## BATCH COMPOSITION REQUIREMENTS

Every batch MUST include at minimum:
- 2 characters with role: love_interest OR one_night_stand
- 1 character with role: industry_peer
- 1 character with role: mentor OR collaborator
- 1 character with role: antagonist OR rival
- 1 character with role: spouse, partner, temptation, OR ex
  (for fidelity/moral tension — at least one committed character
   and one who tests that commitment)

Batch size: generate exactly as many characters as requested (default 5).

---

## DEMOGRAPHIC GENERATION (ALL 25 FIELDS REQUIRED)

Demographics are NOT optional. Every generated character must have all 25
demographic fields populated. null or "unknown" is NOT acceptable for:
  age, current_city, class_origin, family_structure

Characters come into existence with world-facts, not just psychology.

### DEMOGRAPHIC GAP DETECTION
The current roster has the following gaps that must be filled BEFORE
generating more characters who match what already exists:

${gapsText}

### THE 25 FIELDS

**Identity**
- age              Integer. Actual age, not a range. Do not cluster 22–26.
- birth_year       Derived from age. Current year minus age.
- cultural_background  Specific. "Nigerian-American" not "Black."
- nationality      Country of citizenship.
- first_language   Language spoken before English, or English if none.

**Geography**
- hometown         City, state/country where they grew up.
- current_city     ENUM — see Layer Assignment above for valid values.
- city_migration_history  One sentence. Where they came from, when, why.

**Class**
- class_origin     ENUM: destitute | working_poor | working_class |
                    lower_middle | middle | upper_middle | wealthy
- current_class    ENUM: same options as class_origin.
- class_mobility_direction  ENUM: ascending | descending | stable | volatile

**Family**
- family_structure ENUM: two_parent_stable | two_parent_volatile |
                    single_parent | raised_by_relatives | foster |
                    blended | effectively_alone | chosen_family
- parents_status   One sentence. Alive, absent, deceased, estranged.
- sibling_position ENUM: only | oldest | middle | youngest
- sibling_count    Integer. 0 if only child.
- relationship_status  Current: single | dating | partnered | married |
                        separated | divorced | widowed | complicated
- has_children     Boolean.
- children_ages    Array of integers if has_children. Empty array if not.

**Career & Education**
- education_experience  One sentence.
- career_history        One sentence. What she did before where she is now.
- years_posting         Integer. Must be age-coherent — cannot have started before 14.

**Physical & Voice**
- physical_presence     Social-perceptual ONLY. Not height/weight. One to two sentences.
- demographic_voice_signature  How she actually talks. Rhythm, vocabulary, register shifts.

**Online Presence**
- platform_primary  ENUM: instagram | tiktok | youtube | twitter
- follower_tier     ENUM: ghost | micro | mid | macro | mega

---

## CHARACTER PROFILE FIELDS

**Core Identity**
- name, occupation, location, aesthetic, signature_quote

**Desire Architecture**
- surface_want, real_want, what_they_want_from_protagonist, how_they_meet

**Dynamic**
- dynamic, tension_type (calm|simmering|volatile|fractured|healing), arc_role

**Attraction & Desire**
- sexuality, attracted_to, how_they_love, desire_they_wont_admit

**Psychological Architecture**
- origin_story, public_persona, private_reality, moral_code, fidelity_pattern

---

## INTIMATE PROFILE (ROLE-GATED)

Generate an intimate profile ONLY for characters with these roles:
  love_interest | one_night_stand | partner | spouse | temptation | ex

Conditionally include for:
  collaborator — only if the dynamic field indicates romantic/sexual tension

DO NOT generate an intimate profile for:
  coworker | mentor | friend | confidant | industry_peer | antagonist | rival

The intimate profile contains:
- intimate_presence     How she shows up physically in intimate space.
- what_she_gives        What she offers in intimacy.
- what_she_withholds    What she keeps back even there.
- the_encounter         If role is one_night_stand: one paragraph. Null for other roles.

---

## COHERENCE RULES

These combinations require intentional narrative justification:

- class_origin: destitute or working_poor + money_behavior_pattern: performs_wealth
  → Coherent if the wound is visibility or belonging. Flag otherwise.

- class_origin: wealthy + money_behavior_pattern: hoarder
  → Coherent if the origin_story explains a loss of security. Flag otherwise.

- family_structure: effectively_alone + no wound of invisibility or abandonment
  → Flag. Isolation without wound is psychologically incomplete.

- years_posting + age implies posting started before age 14
  → Flag. Adjust years_posting down or raise age.

---

## OUTPUT FORMAT

Return a JSON array. No preamble. No markdown fences. No trailing text.
Each element is one character object. All fields present. No nulls on
required fields (age, current_city, class_origin, family_structure).

[
  {
    "name": "",
    "age": 0,
    "birth_year": 0,
    "cultural_background": "",
    "nationality": "",
    "first_language": "",
    "hometown": "",
    "current_city": "",
    "city_migration_history": "",
    "class_origin": "",
    "current_class": "",
    "class_mobility_direction": "",
    "family_structure": "",
    "parents_status": "",
    "sibling_position": "",
    "sibling_count": 0,
    "relationship_status": "",
    "has_children": false,
    "children_ages": [],
    "education_experience": "",
    "career_history": "",
    "years_posting": 0,
    "physical_presence": "",
    "demographic_voice_signature": "",
    "platform_primary": "",
    "follower_tier": "",
    "layer": "",
    "role_type": "",
    "occupation": "",
    "location": "",
    "aesthetic": "",
    "signature_quote": "",
    "surface_want": "",
    "real_want": "",
    "what_they_want_from_protagonist": "",
    "how_they_meet": "",
    "dynamic": "",
    "tension_type": "",
    "arc_role": "",
    "sexuality": "",
    "attracted_to": "",
    "how_they_love": "",
    "desire_they_wont_admit": "",
    "origin_story": "",
    "public_persona": "",
    "private_reality": "",
    "moral_code": "",
    "fidelity_pattern": "",
    "intimate_profile": null
  }
]

intimate_profile shape when present:
{
  "intimate_presence": "",
  "what_she_gives": "",
  "what_she_withholds": "",
  "the_encounter": null
}

the_encounter is a string (one paragraph) only when role is one_night_stand.
Null for all other roles including when intimate_profile is present.`;
}

// ─── User Prompt Builder ─────────────────────────────────────────────────────
function buildUserPrompt(batchSize = 5, protagonistFocus = null, demographicHints = []) {
  const focus = protagonistFocus
    ? `Focus this batch on characters who orbit ${protagonistFocus}.`
    : 'Distribute characters across both JustAWoman\'s world and LalaVerse.';

  const hints = demographicHints.length
    ? `Demographic guidance for this batch:\n${demographicHints.map(h =>
        `- ${h.age_range || '?'}, ${h.city_hint || '?'}, ${h.class_origin_hint || '?'}, ${h.family_hint || '?'}`
      ).join('\n')}`
    : '';

  return `Generate ${batchSize} characters. ${focus}

${hints}

Confirm batch composition requirements are met before finalizing output.
Return JSON array only.`;
}

// ─── PAIN CATEGORIES ─────────────────────────────────────────────────────────
const _PAIN_CATEGORIES = [
  'comparison_spiral', 'visibility_gap', 'identity_drift',
  'financial_risk', 'consistency_collapse', 'clarity_deficit',
  'external_validation', 'restart_cycle',
];

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /ecosystem ──────────────────────────────────────────────────────────
router.get('/ecosystem', requireAuth, async (req, res) => {
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
      ROLE_TYPES.forEach(r => { roleCount[r] = 0; });
      worldChars.forEach(c => { if (roleCount[c.role_type] !== undefined) roleCount[c.role_type]++; });

      const statusCount = {
        draft: worldChars.filter(c => c.status === 'draft').length,
        accepted: worldChars.filter(c => c.status === 'accepted').length,
        finalized: worldChars.filter(c => c.status === 'finalized').length,
        declined: worldChars.filter(c => c.status === 'declined').length,
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
        saturated,
        empty,
        health: saturated.length === 0 && empty.length === 0 ? 'balanced' :
                saturated.length > 0 ? 'oversaturated' : 'sparse',
      };
    };

    const allChars = registries.flatMap(r => r.characters || []);

    return res.json({
      book1: {
        ...WORLD_CONFIGS.book1,
        stats: buildWorldStats(worldCharsMap.book1),
        characters: worldCharsMap.book1.map(c => ({
          id: c.id, name: c.selected_name || c.display_name,
          role_type: c.role_type, status: c.status,
        })),
      },
      lalaverse: {
        ...WORLD_CONFIGS.lalaverse,
        stats: buildWorldStats(worldCharsMap.lalaverse),
        characters: worldCharsMap.lalaverse.map(c => ({
          id: c.id, name: c.selected_name || c.display_name,
          role_type: c.role_type, status: c.status,
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

// ─── POST /propose-seeds ─────────────────────────────────────────────────────
router.post('/propose-seeds', requireAuth, aiRateLimiter, async (req, res) => {
  const {
    world,
    count: seedCount,
    role_type_focus: _role_type_focus,
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
${ROLE_TYPES.map(r => `- ${r}: ${ROLE_DEFINITIONS[r]}`).join('\n')}

TENSION RULES:
- The tension is a single sentence describing the live wire running through this person
- It must be a genuine internal contradiction — two things that are both true and both cost something
- It should be specific enough that no other character in this world could have exactly this tension
- Adult register: real wounds, real desires, real contradictions. No softening.

DIVERSITY:
- Vary gender freely: women, men, nonbinary — use what fits the tension
- Vary age within the range
- Vary career meaningfully — not all content creators
- Each seed should feel like a different kind of person

DEMOGRAPHIC HINTS:
For each seed, include a demographic_hint object:
{
  age_range: '18-22' | '23-27' | '28-32' | '33-38' | '39-45',
  city_hint: one of nova_prime, velour_city, the_drift, solenne, cascade_row,
  class_origin_hint: one of destitute, working_poor, working_class, lower_middle, middle, upper_middle, wealthy,
  family_hint: brief (e.g. 'raised by grandmother', 'single parent, oldest of 4')
}
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

// ─── POST /generate-batch (v5.3) ────────────────────────────────────────────
router.post('/generate-batch', requireAuth, aiRateLimiter, async (req, res) => {
  const {
    batch_size = 5,
    protagonist_focus = null,
    demographic_hints = [],
  } = req.body;

  const db = req.app.locals.db || require('../models');

  try {
    // Step 1: Build fresh demographic snapshot from DB
    const snapshot = await buildDemographicSnapshot(db);
    console.log(`[generate-batch] Demographic snapshot: ${snapshot.total || 0} chars, ${snapshot.gaps?.length || 0} gaps`);

    // Step 2: Build prompts with gaps injected
    const systemPrompt = buildSystemPrompt(snapshot.gaps || []);
    const userPrompt = buildUserPrompt(batch_size, protagonist_focus, demographic_hints);

    // Step 3: Call Claude
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content?.[0]?.text || '';
    let characters;
    try {
      characters = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!Array.isArray(characters)) {
        characters = characters.characters || [];
      }
    } catch {
      return res.status(500).json({ error: 'Failed to parse character batch from Claude.' });
    }

    // Step 4: Run coherence checks
    const warnings = checkDemographicCoherence(characters);

    // Step 5: Return for staging UI
    return res.json({
      characters,
      count: characters.length,
      demographic_snapshot: snapshot,
      coherence_warnings: warnings,
      generation_notes: `Generated ${characters.length} characters. ${warnings.length} coherence warnings.`,
    });
  } catch (err) {
    console.error('[generate-batch] error:', err?.message);
    const status = err?.aiStatus || 500;
    return res.status(status).json({ error: 'Batch generation failed: ' + err?.message });
  }
});

// ─── POST /check-staging ─────────────────────────────────────────────────────
router.post('/check-staging', requireAuth, async (req, res) => {
  try {
    const { character, existingCharacters, ecosystemStats } = req.body;

    if (!character) return res.status(400).json({ error: 'character required' });

    const warnings = [];
    const errors = [];

    const name = character.name || character.identity?.name || '';
    const roleType = character.role_type || character.identity?.role_type || '';
    const world = character.layer || character.identity?.world || 'book1';

    // Name collision check
    const existing = existingCharacters || [];
    const exactMatch = existing.find(c =>
      c.name?.toLowerCase() === name.toLowerCase()
    );
    if (exactMatch) {
      errors.push({
        type: 'name_collision',
        severity: 'critical',
        message: `"${name}" already exists in the registry.`,
      });
    }

    // Phonetic similarity
    const phoneticMatch = existing.find(c => {
      const a = (c.name || '').toLowerCase().slice(0, 3);
      const b = name.toLowerCase().slice(0, 3);
      return a === b && c.name?.toLowerCase() !== name.toLowerCase();
    });
    if (phoneticMatch) {
      warnings.push({
        type: 'phonetic_similarity',
        severity: 'warning',
        message: `"${name}" sounds similar to existing character "${phoneticMatch.name}".`,
      });
    }

    // Role saturation
    const worldStats = ecosystemStats?.[world]?.stats;
    if (worldStats?.roleCount && roleType) {
      const currentCount = worldStats.roleCount[roleType] || 0;
      if (currentCount >= 4) {
        warnings.push({
          type: 'role_saturation',
          severity: 'warning',
          message: `${world} already has ${currentCount} ${roleType} characters.`,
        });
      }
    }

    // Demographic coherence
    const demographicWarnings = checkDemographicCoherence(character);
    warnings.push(...demographicWarnings.map(w => ({
      type: 'demographic_coherence',
      severity: 'warning',
      message: w.message,
      field: w.field,
    })));

    return res.json({
      errors,
      warnings,
      can_commit: errors.length === 0,
    });
  } catch (err) {
    console.error('[character-generator] check-staging error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /commit (v5.3 — flat character format) ─────────────────────────────
router.post('/commit', requireAuth, async (req, res) => {
  const { character, registryId } = req.body;
  // Support legacy format too
  const c = character || req.body.profile;

  if (!c || !registryId) {
    return res.status(400).json({ error: 'character and registryId required' });
  }

  const db = req.app.locals.db || require('../models');
  const { Op } = require('sequelize');

  try {
    const rawName = c.name || 'unnamed';

    // Duplicate guard
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
      return res.json({
        success: true,
        character_id: existing.id,
        name: existing.display_name,
        message: `${rawName} already exists (duplicate prevented).`,
        duplicate: true,
      });
    }

    // Check if PNOS seed character — block edit
    const PNOS_SEEDS = ['JustAWoman', 'David', 'Dana', 'Chloe', 'Jade', 'Marcus', 'Miles', 'Noah'];
    if (PNOS_SEEDS.includes(rawName)) {
      return res.status(403).json({ error: `${rawName} is a PNOS Book 1 seed character and cannot be overwritten.` });
    }

    const baseKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uniqueKey = `${baseKey}-${Date.now().toString(36)}`;

    const roleType = c.role_type || 'friend';
    const registryRole = ROLE_MAP[roleType] || 'support';
    const intimateEligible = INTIMATE_ELIGIBLE_ROLES.includes(roleType) ||
      (roleType === 'collaborator' && c.dynamic && /romantic|sexual|tension/i.test(c.dynamic));

    // Build registry character data
    const characterData = {
      registry_id: registryId,
      character_key: uniqueKey,
      display_name: rawName,
      selected_name: rawName,
      role_type: registryRole,
      role_label: roleType,
      appearance_mode: 'on_page',
      status: 'draft',

      // Psychology
      core_desire: c.real_want || c.surface_want || '',
      core_wound: c.origin_story || '',
      signature_trait: c.signature_quote || c.aesthetic || '',
      mask_persona: c.public_persona || '',
      truth_persona: c.private_reality || '',
      description: c.occupation || '',

      // JSONB
      personality_matrix: JSON.stringify({
        surface_want: c.surface_want,
        real_want: c.real_want,
        moral_code: c.moral_code,
        fidelity_pattern: c.fidelity_pattern,
        public_persona: c.public_persona,
        private_reality: c.private_reality,
      }),
      aesthetic_dna: JSON.stringify({
        aesthetic: c.aesthetic,
        signature_quote: c.signature_quote,
      }),
      career_status: JSON.stringify({
        profession: c.occupation,
        career_history: c.career_history,
      }),
      extra_fields: JSON.stringify({
        source: 'character_generator_v5.3',
        layer: c.layer,
        sexuality: c.sexuality,
        attracted_to: c.attracted_to,
        how_they_love: c.how_they_love,
        desire_they_wont_admit: c.desire_they_wont_admit,
        intimate_eligible: intimateEligible,
        intimate_profile: c.intimate_profile || null,
      }),

      // Demographics (25 fields)
      age: c.age || null,
      birth_year: c.birth_year || null,
      cultural_background: c.cultural_background || null,
      nationality: c.nationality || null,
      first_language: c.first_language || null,
      hometown: c.hometown || null,
      current_city: c.current_city || null,
      city_migration_history: c.city_migration_history || null,
      class_origin: c.class_origin || null,
      current_class: c.current_class || null,
      class_mobility_direction: c.class_mobility_direction || null,
      family_structure: c.family_structure || null,
      parents_status: c.parents_status || null,
      sibling_position: c.sibling_position || null,
      sibling_count: c.sibling_count ?? null,
      relationship_status: c.relationship_status || null,
      has_children: c.has_children ?? null,
      children_ages: c.children_ages || null,
      education_experience: c.education_experience || null,
      career_history: c.career_history || null,
      years_posting: c.years_posting ?? null,
      physical_presence: c.physical_presence || null,
      demographic_voice_signature: c.demographic_voice_signature || null,
      platform_primary: c.platform_primary || null,
      follower_tier: c.follower_tier || null,

      // Intimate eligibility — set on the actual boolean column
      intimate_eligible: intimateEligible,
    };

    const newChar = await db.RegistryCharacter.create(characterData);

    // Also create world_characters entry for lalaverse/series-2 layer characters
    let worldCharId = null;
    if (c.layer === 'lalaverse' || c.layer === 'series-2') {
      try {
        const wcData = {
          name: rawName,
          age_range: c.age ? String(c.age) : null,
          occupation: c.occupation || null,
          world_location: c.location || null,
          character_type: roleType,
          intimate_eligible: intimateEligible,
          aesthetic: c.aesthetic || null,
          signature: c.signature_quote || null,
          surface_want: c.surface_want || null,
          real_want: c.real_want || null,
          what_they_want_from_lala: c.what_they_want_from_protagonist || null,
          how_they_meet: c.how_they_meet || null,
          dynamic: c.dynamic || null,
          tension_type: c.tension_type || null,
          arc_role: c.arc_role || null,
          sexuality: c.sexuality || null,
          attracted_to: c.attracted_to || null,
          how_they_love: c.how_they_love || null,
          desire_they_wont_admit: c.desire_they_wont_admit || null,
          origin_story: c.origin_story || null,
          public_persona: c.public_persona || null,
          private_reality: c.private_reality || null,
          moral_code: c.moral_code || null,
          fidelity_pattern: c.fidelity_pattern || null,
          family_layer: c.layer || null,
          registry_character_id: newChar.id,
          status: 'draft',
        };

        // Write intimate profile to intimate_style fields if present
        if (c.intimate_profile) {
          wcData.intimate_style = c.intimate_profile.intimate_presence || null;
          wcData.intimate_dynamic = c.intimate_profile.what_she_gives || null;
          wcData.what_lala_feels = c.intimate_profile.what_she_withholds || null;
        }

        const wcRecord = await db.WorldCharacter.create(wcData);
        worldCharId = wcRecord?.id || null;

        // Update registry character with world_character_id cross-link
        if (worldCharId) {
          await db.RegistryCharacter.update(
            { world_character_id: worldCharId },
            { where: { id: newChar.id } }
          );
        }
      } catch (wcErr) {
        console.error(`[commit] world_characters insert failed for ${rawName}:`, wcErr.message);
      }
    }

    // Write intimate_profile to intimate_scenes if role is one_night_stand and the_encounter exists
    if (c.intimate_profile?.the_encounter && roleType === 'one_night_stand') {
      try {
        await db.sequelize.query(
          `INSERT INTO intimate_scenes (id, character_a_id, character_a_name, scene_type, scene_text, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'one_night_stand', $3, 'draft', NOW(), NOW())`,
          {
            bind: [newChar.id, rawName, c.intimate_profile.the_encounter],
            type: db.sequelize.QueryTypes.INSERT,
          }
        );
      } catch (scErr) {
        console.error(`[commit] intimate_scenes insert failed for ${rawName}:`, scErr.message);
      }
    }

    return res.json({
      success: true,
      character_id: newChar.id,
      world_character_id: worldCharId,
      name: rawName,
      layer: c.layer,
      role_type: roleType,
      registry_role: registryRole,
      message: `${rawName} committed to registry as draft.`,
    });
  } catch (err) {
    console.error('[commit] error:', err?.message);
    return res.status(500).json({ error: 'Commit failed: ' + err?.message });
  }
});

// ─── POST /seed-relationships (v5.3 — 42 pairing rules) ─────────────────────
router.post('/seed-relationships', requireAuth, async (req, res) => {
  const { character_ids, registryId } = req.body;
  if (!character_ids?.length || !registryId) {
    return res.status(400).json({ error: 'character_ids array and registryId required' });
  }

  const db = req.app.locals.db || require('../models');
  const { Op } = require('sequelize');

  try {
    // Load all characters in the batch
    const chars = await db.RegistryCharacter.findAll({
      where: { id: { [Op.in]: character_ids }, deleted_at: null },
      attributes: ['id', 'display_name', 'role_label', 'extra_fields'],
    });

    const getCharData = (c) => {
      const extra = typeof c.extra_fields === 'string' ? JSON.parse(c.extra_fields || '{}') : (c.extra_fields || {});
      return {
        id: c.id,
        name: c.display_name,
        role_type: c.role_label || 'friend',
        sexuality: extra.sexuality || '',
      };
    };

    const charData = chars.map(getCharData);
    const created = [];
    let skipped = 0;

    // Generate pairs and match against pairing rules
    const candidates = [];
    for (let i = 0; i < charData.length; i++) {
      for (let j = i + 1; j < charData.length; j++) {
        const a = charData[i];
        const b = charData[j];

        // Find matching pairing rule
        const rule = INTER_CHAR_PAIRINGS.find(([tA, tB]) =>
          (a.role_type === tA && b.role_type === tB) ||
          (a.role_type === tB && b.role_type === tA)
        );
        if (!rule) continue;

        const [, , relName, tensionType, isRomantic] = rule;

        // Check sexuality compatibility for romantic pairings
        if (isRomantic && !isRomanticallyCompatible(a, b)) {
          skipped++;
          continue;
        }

        candidates.push({ a, b, relName, tensionType, isRomantic });
      }
    }

    // Sort by tension (volatile first) and limit to 5
    const tensionPriority = { volatile: 0, fractured: 1, simmering: 2, calm: 3 };
    candidates.sort((x, y) => (tensionPriority[x.tensionType] || 3) - (tensionPriority[y.tensionType] || 3));
    const selected = candidates.slice(0, 5);

    for (const { a, b, relName, tensionType, isRomantic } of selected) {
      try {
        // Check for existing relationship
        const existing = await db.CharacterRelationship.findOne({
          where: {
            [Op.or]: [
              { character_id_a: a.id, character_id_b: b.id },
              { character_id_a: b.id, character_id_b: a.id },
            ],
          },
        });
        if (existing) continue;

        await db.CharacterRelationship.create({
          character_id_a: a.id,
          character_id_b: b.id,
          relationship_type: relName,
          tension_state: tensionType,
          is_romantic: isRomantic,
          status: 'Active',
          confirmed: false,
          notes: `Auto-seeded: ${a.name} (${a.role_type}) × ${b.name} (${b.role_type})`,
        });
        created.push(`${a.name} × ${b.name}: ${relName}`);
      } catch (relErr) {
        console.error(`[seed-relationships] Failed: ${a.name} × ${b.name}:`, relErr.message);
      }
    }

    return res.json({
      success: true,
      relationships_created: created,
      skipped_incompatible: skipped,
      total_candidates: candidates.length,
    });
  } catch (err) {
    console.error('[seed-relationships] error:', err?.message);
    return res.status(500).json({ error: 'Relationship seeding failed: ' + err?.message });
  }
});

// ─── POST /rewrite-field ─────────────────────────────────────────────────────
router.post('/rewrite-field', requireAuth, aiRateLimiter, async (req, res) => {
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
      system: `You are rewriting a single character profile field for an AI-generated character. Match the adult-fiction register — specific, grounded, no softening. Return ONLY the new text (no quotes, no preamble, no explanation).\n\nCharacter: ${characterContext?.name || 'Unknown'}\nRole: ${characterContext?.role || '?'}\nLayer: ${characterContext?.layer || '?'}`,
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
