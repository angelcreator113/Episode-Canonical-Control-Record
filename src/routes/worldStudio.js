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
  const Anthropic = require('@anthropic-ai/sdk');
  const client    = new Anthropic();
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      if (msg.stop_reason === 'max_tokens') {
        console.warn(`Claude response truncated (max_tokens=${maxTokens}). Consider increasing limit.`);
      }
      return msg.content[0]?.text || '';
    } catch (aiErr) {
      const status = aiErr?.status;
      const errMsg = String(aiErr?.error?.error?.message || aiErr?.message || aiErr);
      // Retry on 429 (rate limit) or 529 (overloaded) with exponential backoff
      if ((status === 429 || status === 529) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`Claude API ${status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.error('Claude API error:', errMsg);
      const err = new Error(errMsg);
      err.aiStatus = status || (errMsg.includes('credit balance') ? 402 : errMsg.includes('rate') ? 429 : 502);
      throw err;
    }
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

// ── Utility helpers ──────────────────────────────────────────────────────

/** Parse "late 20s" → 28, "early 30s" → 32, "mid 40s" → 45, "20s" → 25 */
function parseAgeRange(ageRange) {
  if (!ageRange) return null;
  const s = ageRange.toLowerCase().trim();
  const numMatch = s.match(/(\d+)/);
  if (!numMatch) return null;
  const base = parseInt(numMatch[1], 10);
  if (s.includes('late'))  return base + 8;
  if (s.includes('early')) return base + 2;
  if (s.includes('mid'))   return base + 5;
  // bare "20s", "30s" etc → midpoint
  if (s.match(/\d+s/))     return base + 5;
  return base;
}

/** Derive pronouns from gender */
function derivePronouns(gender) {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'male')       return 'he/him';
  if (g === 'female')     return 'she/her';
  if (g === 'non_binary' || g === 'non-binary' || g === 'nonbinary') return 'they/them';
  if (g === 'agender')    return 'they/them';
  return null;
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
  spouse:          'support',
  partner:         'special',
  temptation:      'shadow',
  ex:              'pressure',
  confidant:       'support',
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
  spouse:          'Spouse',
  partner:         'Partner',
  temptation:      'Temptation',
  ex:              'Ex',
  confidant:       'Confidant',
  friend:          'Friend',
  coworker:        'Coworker',
};

// Map World Studio tension_type → character_relationships tension_state
const TENSION_MAP = {
  romantic:     'simmering',
  professional: 'calm',
  creative:     'simmering',
  power:        'volatile',
  unspoken:     'simmering',
  moral:        'simmering',
  fidelity:     'volatile',
  temptation:   'simmering',
  betrayal:     'fractured',
  guilt:        'simmering',
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
  spouse:          'IRL',
  partner:         'IRL',
  temptation:      'IRL',
  ex:              'IRL',
  confidant:       'IRL',
  friend:          'IRL',
  coworker:        'Professional',
};

// Natural inter-character pairing rules: [typeA, typeB, rel_type, conn_mode, tension, romantic?]
const INTER_CHAR_PAIRINGS = [
  // Original pairings
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
  // Fidelity & moral dynamics
  ['spouse',        'temptation',      'Fidelity Test',       'IRL',          'volatile',   false],
  ['spouse',        'love_interest',   'Emotional Affair Risk','IRL',         'simmering',  false],
  ['spouse',        'ex',              'Unfinished History',  'IRL',          'simmering',  false],
  ['partner',       'temptation',      'Loyalty vs Desire',   'IRL',          'volatile',   true],
  ['partner',       'rival',           'Partner Under Pressure','IRL',        'simmering',  false],
  ['partner',       'ex',              'Past vs Present',     'IRL',          'simmering',  false],
  ['temptation',    'love_interest',   'Competing Attractions','IRL',         'simmering',  true],
  ['temptation',    'one_night_stand', 'Dangerous Pattern',   'IRL',          'volatile',   true],
  ['temptation',    'confidant',       'The Friend Who Knows','IRL',          'simmering',  false],
  ['ex',            'love_interest',   'Old vs New',          'IRL',          'simmering',  true],
  ['ex',            'ex',              'Shared Damage',       'IRL',          'simmering',  false],
  ['spouse',        'spouse',          'Married Couple',      'IRL',          'calm',       true],
  ['spouse',        'confidant',       'Trust Circle',        'IRL',          'calm',       false],
  ['confidant',     'antagonist',      'Divided Loyalty',     'IRL',          'volatile',   false],
  // Friend & coworker pairings
  ['friend',         'friend',          'Close Friends',       'IRL',          'calm',       false],
  ['friend',         'love_interest',   'Blurred Lines',       'IRL',          'simmering',  true],
  ['friend',         'rival',           'Friendly Rivalry',    'IRL',          'simmering',  false],
  ['friend',         'confidant',       'Inner Circle',        'IRL',          'calm',       false],
  ['friend',         'ex',              'Stayed Friends',      'IRL',          'simmering',  false],
  ['friend',         'temptation',      'Dangerous Friendship','IRL',          'simmering',  true],
  ['coworker',       'coworker',        'Office Dynamic',      'Professional', 'calm',       false],
  ['coworker',       'rival',           'Workplace Rivalry',   'Professional', 'simmering',  false],
  ['coworker',       'mentor',          'Office Mentorship',   'Professional', 'calm',       false],
  ['coworker',       'love_interest',   'Office Romance',      'Professional', 'simmering',  true],
  ['coworker',       'friend',          'Work Friends',        'IRL',          'calm',       false],
  ['coworker',       'antagonist',      'Office Politics',     'Professional', 'volatile',   false],
  // Recurring character pairings
  ['recurring',      'love_interest',   'Recurring Chemistry', 'IRL',          'simmering',  true],
  ['recurring',      'rival',           'Recurring Friction',  'IRL',          'simmering',  false],
  ['recurring',      'friend',          'Familiar Face',       'IRL',          'calm',       false],
  ['recurring',      'coworker',        'Regular Crossover',   'Professional', 'calm',       false],
  ['recurring',      'recurring',       'Parallel Lives',      'IRL',          'calm',       false],
];

// Gender-aware sexuality compatibility for romantic pairings
// Characters now carry a `gender` field (male|female|non_binary|agender)
function areSexuallyCompatible(a, b) {
  const sA = (a.sexuality || '').toLowerCase();
  const sB = (b.sexuality || '').toLowerCase();
  const gA = (a.gender || '').toLowerCase();
  const gB = (b.gender || '').toLowerCase();
  // If either has no sexuality defined, allow the pairing (data not yet generated)
  if (!sA || !sB) return true;
  // Bisexual/pansexual/queer/fluid are compatible with anyone
  const flex = ['bisexual', 'pansexual', 'queer', 'fluid'];
  if (flex.includes(sA) || flex.includes(sB)) return true;
  // Non-binary/agender: compatible unless BOTH are strictly straight
  if (['non_binary', 'agender'].includes(gA) || ['non_binary', 'agender'].includes(gB)) {
    return !(sA === 'straight' && sB === 'straight');
  }
  // With explicit gender: check actual compatibility
  if (gA && gB) {
    const sameGender = gA === gB;
    if (sA === 'straight' && sB === 'straight') return !sameGender;
    if (sA === 'gay' && sB === 'gay') return sameGender;
    if (sA === 'lesbian' && sB === 'lesbian') return sameGender;
    return false;
  }
  // Fallback (no gender data): use old heuristic
  if (sA === 'straight' && sB === 'straight') return true;
  if (sA === sB && ['gay', 'lesbian'].includes(sA)) return true;
  return false;
}

// In-memory rate limiter for ecosystem preview (max 3 per minute per IP)
const previewRateLimit = new Map();
function checkPreviewRateLimit(ip) {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const maxRequests = 3;
  const key = ip || 'unknown';
  const timestamps = (previewRateLimit.get(key) || []).filter(t => now - t < window);
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  previewRateLimit.set(key, timestamps);
  // Cleanup old entries every 100 calls
  if (previewRateLimit.size > 100) {
    for (const [k, v] of previewRateLimit) {
      if (v.every(t => now - t > window)) previewRateLimit.delete(k);
    }
  }
  return true;
}

// Server-side preview cache (keyed by preview_id, expires after 10 min)
const previewCache = new Map();
function storePreview(previewId, data, ownerId = null) {
  previewCache.set(previewId, { data, ownerId, expires: Date.now() + 10 * 60_000 });
  // Cleanup expired entries
  for (const [k, v] of previewCache) {
    if (Date.now() > v.expires) previewCache.delete(k);
  }
  // Also persist to DB so it survives page navigation & server restarts
  persistPreviewToDB(previewId, data, ownerId).catch(err => console.error('preview persist error:', err.message));
}

// Background cleanup: purge expired in-memory previews every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [k, v] of previewCache) {
    if (now > v.expires) { previewCache.delete(k); cleaned++; }
  }
  if (cleaned > 0) console.log(`preview-cache cleanup: purged ${cleaned} expired entries`);
}, 5 * 60_000);
function getPreview(previewId, requesterId = null) {
  const entry = previewCache.get(previewId);
  if (!entry) return null;
  if (Date.now() > entry.expires) { previewCache.delete(previewId); return null; }
  // Owner check: if preview has an owner and requester doesn't match, deny
  if (entry.ownerId && requesterId && entry.ownerId !== requesterId) return null;
  return entry.data;
}

// Persistent preview storage in DB
async function ensurePreviewsTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ecosystem_previews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      preview_id VARCHAR(255) UNIQUE NOT NULL,
      world_tag VARCHAR(100) NOT NULL DEFAULT 'lalaverse',
      characters JSONB NOT NULL DEFAULT '[]',
      generation_notes TEXT DEFAULT '',
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(e => console.warn('[world-studio] ecosystem_previews table create error:', e?.message));
}
let previewsTableReady = false;
async function persistPreviewToDB(previewId, data, _ownerId = null) {
  if (!previewsTableReady) { await ensurePreviewsTable(); previewsTableReady = true; }
  await sequelize.query(`
    INSERT INTO ecosystem_previews (preview_id, world_tag, characters, generation_notes, status)
    VALUES (:previewId, :worldTag, :characters, :notes, 'pending')
    ON CONFLICT (preview_id) DO UPDATE SET characters = :characters, generation_notes = :notes, updated_at = NOW()
  `, {
    replacements: {
      previewId,
      worldTag: data.world_tag || 'lalaverse',
      characters: JSON.stringify(data.characters || []),
      notes: data.generation_notes || '',
    },
    type: sequelize.QueryTypes.INSERT,
  });
}

// Cleanup orphaned previews older than 1 hour (fire once on startup, then hourly)
async function cleanupOrphanedPreviews() {
  try {
    await ensurePreviewsTable();
    const [result] = await sequelize.query(
      `DELETE FROM ecosystem_previews WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour' RETURNING preview_id`,
      { type: sequelize.QueryTypes.SELECT }
    ).catch(e => { console.warn('[world-studio] preview cleanup query error:', e?.message); return [[]]; });
    if (result?.preview_id) console.log('Cleaned orphaned preview:', result.preview_id);
  } catch (err) { console.warn('[world-studio] preview cleanup error:', err?.message); }
}
setTimeout(cleanupOrphanedPreviews, 10_000); // 10s after startup
setInterval(cleanupOrphanedPreviews, 60 * 60_000); // then hourly

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
async function _findOrCreateLalaVerseRegistry(req) {
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

Character types available:
- love_interest: someone she could actually fall for. Complex. Not available in a simple way.
- industry_peer: another creator or brand figure at a similar level. Collaborative energy that hides competitive undercurrent.
- mentor: someone ahead of her who sees something in her. Their help comes with their own agenda.
- antagonist: not a villain. Someone whose success or presence makes Lala's path harder without meaning to.
- one_night_stand: someone she meets once. The encounter means something even if they don't stay.
- rival: direct competition. They respect each other and can't stand each other.
- collaborator: someone she creates with. Creative chemistry that bleeds into everything else.
- spouse: someone who is married — to another character or to someone offscreen. Their commitment is real but so is the complexity.
- partner: someone in a committed relationship (not married). Their loyalty is tested by circumstances.
- temptation: someone who exists to test another character's commitment. They're not evil — they're magnetic, and the pull is real.
- ex: someone from a character's past. The history didn't end clean.
- confidant: a trusted friend who knows secrets. Their loyalty can become a weapon or a shield.
- friend: someone in her life she genuinely likes and trusts. The friendship is real — not strategic. They show up, they listen, they call her on her shit.
- coworker: someone she works alongside daily. Not a mentor, not a rival — someone who shares the grind. The relationship is shaped by proximity and shared pressure.

CHARACTERS MUST HAVE MORAL DEPTH:
- Some characters are faithful and choose loyalty even when tested. A faithful character's story is about the COST of staying loyal when desire pulls elsewhere.
- Some characters cheat, lie, or betray — not because they're villains but because they're human.
- Some characters are the temptation — they pursue someone taken, and their reasons are complicated.
- Arguments, breakups, reconciliations, and moral choices should be baked into character DNA.
- Every character has a moral code — even the ones who violate it.

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

Character types available:
- love_interest: someone she shouldn't want. Complex. Probably dangerous in some way — emotionally, professionally, or both.
- industry_peer: someone in her professional orbit. The relationship is never purely professional.
- mentor: someone older or more powerful who sees her potential. Their guidance always costs something.
- antagonist: not a cartoon villain. Someone whose goals directly conflict with hers. They may even be right.
- one_night_stand: an encounter that reveals something about who she is right now. Brief but meaningful.
- rival: someone who mirrors her in uncomfortable ways. The competition is personal.
- collaborator: someone she builds something with. Trust is earned slowly and can shatter fast.
- spouse: someone married — maybe to her, maybe to someone else. The marriage is real and messy. Commitment doesn't mean simple.
- partner: someone in a committed relationship. Their loyalty is tested by the world around them.
- temptation: the person who makes someone question everything they said they'd never do. They don't have to try — they just are.
- ex: someone from her past or another character's past. The wound is still open even if they pretend it isn't.
- confidant: a friend who knows too much. Sometimes the most dangerous person in the room is the one who keeps your secrets.
- friend: someone who is genuinely in her corner. No agenda, no leverage — just real human connection. In a world full of transactional relationships, a friend is rare and precious.
- coworker: someone she sees every day at work. They share deadlines, office politics, and the kind of bond that only comes from surviving the same corporate battlefield together.

CHARACTERS MUST HAVE MORAL DEPTH:
- Characters argue, cheat, stay faithful, break up, reconcile, betray, and forgive — sometimes all in the same story.
- A married man who stays faithful is interesting because of what he's resisting, not because he's boring.
- A woman who pursues someone taken is interesting because she knows it's wrong and does it anyway.
- Infidelity isn't a plot device. It's a character reveal. Show why it happens.
- Faithfulness isn't passive. It's a choice made against real temptation, and it costs something.
- Breakups happen because two real people ran out of ways to stay. Show the exhaustion.
- Every character should have a moral code — even the ones who violate it.

For intimate_eligible characters: write intimate_style, intimate_dynamic, and what she feels with honesty and specificity. This is a grittier, more emotionally charged world than LalaVerse. The intimacy is rawer, more complicated, often tangled up in power and vulnerability.`,
  },
};

/**
 * Create a registry_characters entry from a world_character,
 * then cross-link both records.
 */
async function syncToRegistry(req, worldCharId, c, registryId, worldTag = 'lalaverse', protagonistName = null) {
  const rcId = uuidv4();
  const charKey = (c.name || 'char').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 80) + '_' + worldCharId.substring(0, 8);
  const roleType = ROLE_MAP[c.character_type] || 'special';

  await sequelize.query(
    `INSERT INTO registry_characters
       (id, registry_id, character_key, display_name, selected_name, subtitle,
        role_type, role_label, appearance_mode, status,
        core_desire, core_fear, core_wound, mask_persona, truth_persona,
        character_archetype, signature_trait, emotional_baseline, description,
        personality_matrix, aesthetic_dna, career_status,
        relationships_map, voice_signature, story_presence,
        evolution_tracking, extra_fields, name_options,
        gender, pronouns, age, sexuality, relationship_status, hometown, current_city,
        physical_presence,
        world_character_id, sort_order, created_at, updated_at)
     VALUES
       (:id, :registry_id, :char_key, :display_name, :selected_name, :subtitle,
        :role_type, :role_label, 'on_page', 'draft',
        :core_desire, :core_fear, :core_wound, :mask_persona, :truth_persona,
        :character_archetype, :signature_trait, :emotional_baseline, :description,
        :personality_matrix, :aesthetic_dna, :career_status,
        :relationships_map, :voice_signature, :story_presence,
        :evolution_tracking, :extra_fields, :name_options,
        :gender, :pronouns, :age, :sexuality, :relationship_status, :hometown, :current_city,
        :physical_presence,
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
        // Essence Profile — corrected semantic mappings
        core_desire: c.real_want || null,                    // what they'd never admit wanting
        core_fear: c.core_fear || null,                      // new prompt field
        core_wound: c.desire_they_wont_admit || null,        // the complicating private desire
        mask_persona: c.public_persona || null,              // how the world sees them
        truth_persona: c.private_reality || null,            // what only close people know
        character_archetype: c.character_archetype || null,   // new prompt field
        signature_trait: c.signature || null,
        emotional_baseline: c.emotional_baseline || null,     // new prompt field
        description: [c.occupation, c.dynamic].filter(Boolean).join('. ') || null,

        personality_matrix: JSON.stringify({
          core_wound: c.desire_they_wont_admit || null,
          desire_line: c.real_want || null,
          fear_line: c.core_fear || null,
          coping_mechanism: c.moral_code || null,
          self_deception: c.surface_want || null,
          at_their_best: c.at_their_best || null,
          at_their_worst: c.at_their_worst || null,
        }),
        aesthetic_dna: JSON.stringify({
          era_aesthetic: c.aesthetic || null,
          color_palette: c.color_palette || null,              // new prompt field
          signature_silhouette: c.signature_silhouette || null, // new prompt field
          signature_accessories: c.signature_accessories || null, // new prompt field
          glam_energy: c.glam_energy || null,                  // new prompt field
          visual_evolution_notes: null,
        }),
        career_status: JSON.stringify({
          profession: c.occupation || null,
          career_goal: c.career_goal || null,                  // new prompt field
          reputation_level: null,
          brand_relationships: null,
          financial_status: null,
          public_recognition: c.public_persona || null,
          ongoing_arc: c.arc_role || null,
        }),
        relationships_map: JSON.stringify({
          allies: null, rivals: null, mentors: null,
          love_interests: null, business_partners: null,
          dynamic_notes: c.dynamic || null,
          tension_type: c.tension_type || null,
          what_they_want_from_lala: c.what_they_want_from_lala || null,
          attracted_to: c.attracted_to || null,
          how_they_love: c.how_they_love || null,
        }),
        voice_signature: JSON.stringify({
          speech_pattern: c.speech_pattern || null,
          vocabulary_tone: c.vocabulary_tone || null,
          catchphrases: c.catchphrases || null,
          internal_monologue_style: c.internal_monologue_style || null,
          emotional_reactivity: c.emotional_baseline || null,
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
          intimate_eligible: c.intimate_eligible || false,
          intimate_style: c.intimate_style || null,
          intimate_dynamic: c.intimate_dynamic || null,
          what_lala_feels: c.what_lala_feels || null,
          moral_code: c.moral_code || null,
          fidelity_pattern: c.fidelity_pattern || null,
          committed_to: c.committed_to || null,
          career_echo_connection: c.career_echo_connection || false,
        }),
        name_options: JSON.stringify([c.name]),
        // Demographics layer
        gender: c.gender || null,
        pronouns: derivePronouns(c.gender),
        age: parseAgeRange(c.age_range),
        sexuality: c.sexuality || null,
        relationship_status: c.relationship_status || null,
        hometown: c.origin_story || null,
        current_city: c.world_location || null,
        physical_presence: c.aesthetic || null,
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

  // Auto-seed a relationship candidate linking this character to the protagonist
  await syncRelationships(rcId, c, registryId, protagonistName);

  return rcId;
}

/**
 * After creating a registry_characters entry, auto-seed a character_relationships
 * row linking the new character to Lala (the protagonist) as an unconfirmed candidate.
 * This feeds the Relationship Engine → Candidates tab.
 */
async function syncRelationships(rcId, c, registryId, protagonistName = null) {
  try {
    // Find the protagonist in the same registry
    // Check role_type first, then fall back to display_name (supports Lala, JustAWoman, etc.)
    let [protag] = await sequelize.query(
      `SELECT id FROM registry_characters
       WHERE registry_id = :registry_id AND role_type = 'protagonist' AND deleted_at IS NULL
       LIMIT 1`,
      { replacements: { registry_id: registryId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!protag && protagonistName) {
      [protag] = await sequelize.query(
        `SELECT id FROM registry_characters
         WHERE registry_id = :registry_id AND LOWER(display_name) = LOWER(:name) AND deleted_at IS NULL
         LIMIT 1`,
        { replacements: { registry_id: registryId, name: protagonistName }, type: sequelize.QueryTypes.SELECT }
      );
    }
    if (!protag) {
      // Final fallback: try 'lala' for backwards compatibility
      [protag] = await sequelize.query(
        `SELECT id FROM registry_characters
         WHERE registry_id = :registry_id AND LOWER(display_name) = 'lala' AND deleted_at IS NULL
         LIMIT 1`,
        { replacements: { registry_id: registryId }, type: sequelize.QueryTypes.SELECT }
      );
    }
    if (!protag) {
      console.warn('syncRelationships: No protagonist found in registry', registryId);
      return null;
    }
    // Don't create a self-relationship
    if (protag.id === rcId) return null;

    // Check for existing relationship between these two
    const [existing] = await sequelize.query(
      `SELECT id FROM character_relationships
       WHERE (character_id_a = :a AND character_id_b = :b)
          OR (character_id_a = :b AND character_id_b = :a)
       LIMIT 1`,
      { replacements: { a: protag.id, b: rcId }, type: sequelize.QueryTypes.SELECT }
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
          :conn_mode, 'knows_protagonist', 'Active', :situation,
          :tension_state, :pain_cat, :notes,
          false, NOW(), NOW())`,
      {
        replacements: {
          id: relId,
          char_a: protag.id,
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
    console.log(`syncRelationships: Created candidate relationship ${relId} (protagonist ↔ ${c.name})`);
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
async function seedInterCharacterRelationships(characters, registryId, maxPairs = 5) {
  let created = 0;
  const pairs = [];
  const seeded = [];

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

  // Prioritize volatile/simmering tension over calm, cap scaled by character count
  pairs.sort((x, y) => {
    const tensionRank = { volatile: 0, simmering: 1, calm: 2 };
    return (tensionRank[x.rule[4]] ?? 2) - (tensionRank[y.rule[4]] ?? 2);
  });
  const selected = pairs.slice(0, maxPairs);

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
      seeded.push({ a, b, relType, connMode });
    } catch (err) {
      console.error(`seedInterChar error (${a.name} ↔ ${b.name}):`, err.message);
    }
  }

  // Backfill relationships_map JSONB on registry characters with seeded data
  if (seeded.length > 0) {
    await backfillRelationshipsMap(seeded);
  }

  return created;
}

/**
 * After seeding inter-character relationships, update the relationships_map JSONB
 * on each registry character with categorized relationship data.
 */
async function backfillRelationshipsMap(seededPairs) {
  // Group relationships by registry character
  const charRels = new Map(); // registry_character_id → { allies: [], rivals: [], mentors: [], love_interests: [] }
  for (const { a, b, relType } of seededPairs) {
    for (const [self, other] of [[a, b], [b, a]]) {
      if (!self.registry_character_id) continue;
      if (!charRels.has(self.registry_character_id)) {
        charRels.set(self.registry_character_id, { allies: [], rivals: [], mentors: [], love_interests: [], business_partners: [] });
      }
      const map = charRels.get(self.registry_character_id);
      const entry = other.name;
      if (/roman|love|affair|attract|triangle|blurred|office romance|complicated history|old vs new|competing/i.test(relType)) {
        map.love_interests.push(entry);
      } else if (/rival|pressure|politics|competition/i.test(relType)) {
        map.rivals.push(entry);
      } else if (/mentor|guidance|apprentice/i.test(relType)) {
        map.mentors.push(entry);
      } else if (/collab|partner|ally|creative partner|professional ally/i.test(relType)) {
        map.business_partners.push(entry);
      } else {
        map.allies.push(entry);
      }
    }
  }

  // Merge into existing relationships_map on each registry character
  for (const [rcId, rels] of charRels) {
    try {
      const [existing] = await sequelize.query(
        'SELECT relationships_map FROM registry_characters WHERE id = :id',
        { replacements: { id: rcId }, type: sequelize.QueryTypes.SELECT }
      );
      const current = (existing?.relationships_map && typeof existing.relationships_map === 'object')
        ? existing.relationships_map : {};

      const merged = {
        ...current,
        allies: [...new Set([...(current.allies || []), ...rels.allies])].filter(Boolean) || null,
        rivals: [...new Set([...(current.rivals || []), ...rels.rivals])].filter(Boolean) || null,
        mentors: [...new Set([...(current.mentors || []), ...rels.mentors])].filter(Boolean) || null,
        love_interests: [...new Set([...(current.love_interests || []), ...rels.love_interests])].filter(Boolean) || null,
        business_partners: [...new Set([...(current.business_partners || []), ...rels.business_partners])].filter(Boolean) || null,
      };

      await sequelize.query(
        'UPDATE registry_characters SET relationships_map = :map, updated_at = NOW() WHERE id = :id',
        { replacements: { id: rcId, map: JSON.stringify(merged) }, type: sequelize.QueryTypes.UPDATE }
      );
    } catch (err) {
      console.error(`backfillRelationshipsMap error for ${rcId}:`, err.message);
    }
  }
}

// Variable scene length logic based on relationship depth and type
function resolveSceneLength(characterType, sceneType, _dynamic) {
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
      character_count: rawCount = 8,
    } = req.body;
    const character_count = Math.max(3, Math.min(20, parseInt(rawCount, 10) || 8));

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const series_label = req.body.series_label || wCfg.series_label;

    const {
      city           = wCfg.defaults.city,
      industry       = wCfg.defaults.industry,
      career_stage   = wCfg.defaults.career_stage,
      era            = wCfg.defaults.era,
      protagonist    = wCfg.protagonist,
    } = world_context;

    // Fetch existing world characters in this world to avoid duplication
    const existing = await Q(req, `
      SELECT name, character_type, occupation FROM world_characters
      WHERE status != 'archived' AND world_tag = :world_tag ORDER BY created_at DESC
    `, { replacements: { world_tag } });

    const result = await claude(
      wCfg.system_prompt,

      `Generate ${character_count} world characters for ${wCfg.title}.

PROTAGONIST: ${protagonist}
WORLD: ${city}, ${industry} industry
CAREER STAGE: ${career_stage}
ERA: ${era}

${existing.length > 0 ? `EXISTING CHARACTERS (don't duplicate):\n${existing.map(e => `- ${e.name} (${e.character_type})`).join('\n')}` : ''}

Include a MIX of character types. At minimum: 2 love_interest or one_night_stand, 1 industry_peer, 1 mentor or collaborator, 1 antagonist or rival.
Also include at least 1 of: spouse, partner, temptation, or ex — to create fidelity/moral tension.
At least one character should be committed (married or partnered) and at least one should test that commitment.

Return JSON only:
{
  "characters": [
    {
      "name": "full name",
      "gender": "male|female|non_binary|agender — explicit gender for relationship compatibility",
      "age_range": "e.g. late 20s",
      "occupation": "specific job/role",
      "world_location": "where they exist in ${wCfg.title}",
      "character_type": "love_interest|industry_peer|mentor|antagonist|rival|collaborator|one_night_stand|spouse|partner|temptation|ex|confidant",
      "character_archetype": "Strategist|Dreamer|Performer|Guardian|Rebel|Visionary|Healer|Trickster|Sage|Creator — their core archetype",
      "emotional_baseline": "calm|volatile|guarded|warm|anxious|detached|intense|playful — their default emotional register",
      "at_their_best": "one sentence — who they are when everything aligns",
      "at_their_worst": "one sentence — who they become when cornered or broken",
      "relationship_status": "single|dating|engaged|married|divorced|separated|its_complicated — their actual status, not what they tell people",
      "committed_to": "name of the person they're committed to (another character or offscreen person), or null if single",
      "moral_code": "1-2 sentences about their personal ethics — what lines they won't cross, or what lines they pretend they won't cross",
      "fidelity_pattern": "faithful_tested|faithful_untested|emotionally_unfaithful|physically_unfaithful|serial_cheater|loyal_until_broken|would_never|already_has — how they behave when commitment meets temptation",
      "sexuality": "straight|gay|lesbian|bisexual|pansexual|queer|fluid — be intentional, this drives romantic pairing logic",
      "intimate_eligible": true|false,
      "core_fear": "the thing they're most afraid of — distinct from what they want",
      "aesthetic": "how they look, dress, move — specific and visual",
      "color_palette": "2-3 signature colors that define their visual identity (e.g. 'matte black, champagne gold, oxblood')",
      "signature_silhouette": "their signature clothing shape (e.g. 'oversized blazers over slip dresses')",
      "signature_accessories": "1-2 items they're known for (e.g. 'thin gold chain, vintage watch')",
      "glam_energy": "Minimal|Maximal|Editorial — their beauty/grooming intensity",
      "signature": "the one thing about them that is unforgettable",
      "surface_want": "what they'd tell you they want",
      "real_want": "what they'd never admit",
      "career_goal": "their specific professional ambition — distinct from surface_want",
      "what_they_want_from_lala": "what they're actually seeking from ${protagonist} specifically",
      "how_they_meet": "the specific scenario — not generic",
      "dynamic": "the texture of their connection with ${protagonist}",
      "tension_type": "romantic|professional|creative|power|unspoken|moral|fidelity|temptation|betrayal|guilt",
      "speech_pattern": "how they talk — sentence structure, pace, verbal tics (e.g. 'clipped sentences, never asks questions, uses silence as punctuation')",
      "vocabulary_tone": "the register and flavor of their language (e.g. 'corporate polish masking street vernacular')",
      "catchphrases": "1-2 signature phrases or verbal habits they repeat (e.g. 'honestly though...', 'that's not my problem')",
      "internal_monologue_style": "how their inner thoughts sound — formal, fragmented, poetic, anxious, detached, etc.",
      "intimate_style": "how they are in intimate moments — only for intimate_eligible characters, null otherwise",
      "intimate_dynamic": "the specific dynamic between them — only for intimate_eligible, null otherwise",
      "what_lala_feels": "what ${protagonist} physically and emotionally experiences with this person — intimate_eligible only, null otherwise",
      "arc_role": "how this character changes ${protagonist}'s trajectory",
      "exit_reason": "how or why they leave her world, or null if they stay",
      "career_echo_connection": true|false,
      "attracted_to": "who they actually pursue — specific, not a label",
      "how_they_love": "their connection pattern (e.g. 'avoidant until she isn't, then fully in')",
      "desire_they_wont_admit": "the thing that complicates the above (dimmed, private)",
      "family_layer": "real_world | ${world_tag} | series_2",
      "origin_story": "where they came from before ${protagonist}'s world",
      "public_persona": "how the world sees them",
      "private_reality": "what only close people know"
    }
  ],
  "generation_notes": "brief note on ecosystem logic — who connects to who, what tensions exist, which characters test each other's loyalty/fidelity, who argues, who stays, who leaves"
}`,
      16000
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
    const WorldCharacter = req.app.locals.db?.WorldCharacter || require('../models').WorldCharacter;
    for (const c of parsed.characters) {
      const wcRecord = await WorldCharacter.create({
        batch_id: batchId,
        name: c.name,
        gender: c.gender || null,
        age_range: c.age_range || null,
        occupation: c.occupation || null,
        world_location: c.world_location || null,
        character_type: c.character_type,
        sexuality: c.sexuality || null,
        intimate_eligible: c.intimate_eligible || false,
        aesthetic: c.aesthetic || null,
        signature: c.signature || null,
        surface_want: c.surface_want || null,
        real_want: c.real_want || null,
        what_they_want_from_lala: c.what_they_want_from_lala || null,
        how_they_meet: c.how_they_meet || null,
        dynamic: c.dynamic || null,
        tension_type: c.tension_type || null,
        intimate_style: c.intimate_style || null,
        intimate_dynamic: c.intimate_dynamic || null,
        what_lala_feels: c.what_lala_feels || null,
        arc_role: c.arc_role || null,
        exit_reason: c.exit_reason || null,
        career_echo_connection: c.career_echo_connection || false,
        attracted_to: c.attracted_to || null,
        how_they_love: c.how_they_love || null,
        desire_they_wont_admit: c.desire_they_wont_admit || null,
        relationship_graph: c.relationship_graph || [],
        family_layer: c.family_layer || null,
        origin_story: c.origin_story || null,
        public_persona: c.public_persona || null,
        private_reality: c.private_reality || null,
        relationship_status: c.relationship_status || null,
        committed_to: c.committed_to || null,
        moral_code: c.moral_code || null,
        fidelity_pattern: c.fidelity_pattern || null,
        world_tag: world_tag,
        status: 'draft',
      });
      const charId = wcRecord.id;

      // Sync to canonical registry
      const rcId = await syncToRegistry(req, charId, c, registryId, world_tag, wCfg.protagonist);
      inserted.push({ ...c, id: charId, registry_character_id: rcId });
    }

    // Seed inter-character relationships (not just Lala-centric)
    const relCap = Math.max(5, Math.min(15, Math.floor(inserted.length * (inserted.length - 1) / 6)));
    const interCount = await seedInterCharacterRelationships(inserted, registryId, relCap);
    console.log(`generate-ecosystem: Seeded ${interCount} inter-character relationship(s) (cap: ${relCap})`);

    res.status(201).json({ characters: inserted, batch_id: batchId, count: inserted.length, inter_relationships: interCount, generation_notes: parsed.generation_notes });
  } catch (err) {
    console.error('generate-ecosystem error:', err.message);
    const status = err.aiStatus || 500;
    res.status(status).json({ error: err.message });
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
      `SELECT wc.*, rc.character_key
       FROM world_characters wc
       LEFT JOIN registry_characters rc ON rc.id = wc.registry_character_id
       ${where} ORDER BY wc.character_type, wc.name`,
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

    // Resolve character_key from linked registry character
    if (char.registry_character_id && !char.character_key) {
      try {
        const [reg] = await Q(req,
          'SELECT character_key FROM registry_characters WHERE id = :rid',
          { replacements: { rid: char.registry_character_id } }
        );
        if (reg) char.character_key = reg.character_key;
      } catch (_) { /* registry lookup failed, non-critical */ }
    }

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
      'gender','ethnicity','species','is_alive','death_date','death_cause','death_impact',
      'character_type','intimate_eligible','relationship_status','committed_to','moral_code','fidelity_pattern',
      // Dossier-aligned fields
      'core_fear','character_archetype','emotional_baseline','at_their_best','at_their_worst',
      'color_palette','signature_silhouette','signature_accessories','glam_energy',
      'speech_pattern','vocabulary_tone','catchphrases','internal_monologue_style','career_goal'];
    const updates = [];
    const rep = { id: req.params.id };
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = :${f}`); rep[f] = req.body[f]; }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    await sequelize.query(`UPDATE world_characters SET ${updates.join(', ')} WHERE id = :id`, { replacements: rep, type: sequelize.QueryTypes.UPDATE });
    const [char] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });

    // Auto re-sync to registry if linked
    let registrySynced = false;
    try {
      const [rc] = await Q(req,
        'SELECT id FROM registry_characters WHERE world_character_id = :id',
        { replacements: { id: req.params.id } }
      );
      if (rc) {
        const roleType = ROLE_MAP[char.character_type] || 'special';
        await sequelize.query(
          `UPDATE registry_characters SET
            display_name = :name, selected_name = :selected_name, subtitle = :subtitle,
            role_type = :role_type, role_label = :role_label,
            core_desire = :core_desire, core_fear = :core_fear,
            core_wound = :core_wound, mask_persona = :mask_persona, truth_persona = :truth_persona,
            character_archetype = :character_archetype, signature_trait = :signature_trait,
            emotional_baseline = :emotional_baseline, description = :description,
            personality_matrix = :personality_matrix, aesthetic_dna = :aesthetic_dna,
            career_status = :career_status, relationships_map = :relationships_map,
            voice_signature = :voice_signature, story_presence = :story_presence,
            evolution_tracking = :evolution_tracking, extra_fields = :extra_fields,
            gender = :gender, pronouns = :pronouns, age = :age, sexuality = :sexuality,
            relationship_status = :relationship_status,
            hometown = :hometown, current_city = :current_city,
            physical_presence = :physical_presence,
            updated_at = NOW()
          WHERE id = :rc_id`,
          {
            replacements: {
              rc_id: rc.id,
              name: char.name,
              selected_name: char.name,
              subtitle: [char.age_range, char.occupation].filter(Boolean).join(' · ') || null,
              role_type: roleType,
              role_label: char.character_type || null,
              core_desire: char.real_want || null,
              core_fear: char.core_fear || null,
              core_wound: char.desire_they_wont_admit || null,
              mask_persona: char.public_persona || null,
              truth_persona: char.private_reality || null,
              character_archetype: char.character_archetype || null,
              signature_trait: char.signature || null,
              emotional_baseline: char.emotional_baseline || null,
              description: [char.occupation, char.dynamic].filter(Boolean).join('. ') || null,
              personality_matrix: JSON.stringify({
                core_wound: char.desire_they_wont_admit || null,
                desire_line: char.real_want || null,
                fear_line: char.core_fear || null,
                coping_mechanism: char.moral_code || null,
                self_deception: char.surface_want || null,
                at_their_best: char.at_their_best || null,
                at_their_worst: char.at_their_worst || null,
              }),
              aesthetic_dna: JSON.stringify({
                era_aesthetic: char.aesthetic || null,
                color_palette: char.color_palette || null,
                signature_silhouette: char.signature_silhouette || null,
                signature_accessories: char.signature_accessories || null,
                glam_energy: char.glam_energy || null,
                visual_evolution_notes: null,
              }),
              career_status: JSON.stringify({
                profession: char.occupation || null,
                career_goal: char.career_goal || null,
                reputation_level: null, brand_relationships: null, financial_status: null,
                public_recognition: char.public_persona || null,
                ongoing_arc: char.arc_role || null,
              }),
              relationships_map: JSON.stringify({
                allies: null, rivals: null, mentors: null,
                love_interests: null, business_partners: null,
                dynamic_notes: char.dynamic || null,
                tension_type: char.tension_type || null,
                what_they_want_from_lala: char.what_they_want_from_lala || null,
                attracted_to: char.attracted_to || null,
                how_they_love: char.how_they_love || null,
              }),
              voice_signature: JSON.stringify({
                speech_pattern: char.speech_pattern || null,
                vocabulary_tone: char.vocabulary_tone || null,
                catchphrases: char.catchphrases || null,
                internal_monologue_style: char.internal_monologue_style || null,
                emotional_reactivity: char.emotional_baseline || null,
              }),
              story_presence: JSON.stringify({
                appears_in_books: char.world_tag,
                current_story_status: char.how_they_meet || null,
                unresolved_threads: null,
                future_potential: char.exit_reason ? 'Will exit' : 'Yes',
              }),
              evolution_tracking: JSON.stringify({
                version_history: null,
                era_changes: char.world_location || null,
                personality_shifts: null,
              }),
              extra_fields: JSON.stringify({
                source: 'world_studio',
                world_character_id: req.params.id,
                intimate_eligible: char.intimate_eligible || false,
                intimate_style: char.intimate_style || null,
                intimate_dynamic: char.intimate_dynamic || null,
                what_lala_feels: char.what_lala_feels || null,
                moral_code: char.moral_code || null,
                fidelity_pattern: char.fidelity_pattern || null,
                committed_to: char.committed_to || null,
                career_echo_connection: char.career_echo_connection || false,
              }),
              gender: char.gender || null,
              pronouns: derivePronouns(char.gender),
              age: parseAgeRange(char.age_range),
              sexuality: char.sexuality || null,
              relationship_status: char.relationship_status || null,
              hometown: char.origin_story || null,
              current_city: char.world_location || null,
              physical_presence: char.aesthetic || null,
            },
            type: sequelize.QueryTypes.UPDATE,
          }
        );
        registrySynced = true;
      }
    } catch (syncErr) {
      console.error('PUT re-sync error:', syncErr.message);
    }

    res.json({ character: char, registry_synced: registrySynced });
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
    ).catch(e => console.warn('[world-studio] registry sync (activate) error:', e?.message));
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
    ).catch(e => console.warn('[world-studio] registry sync (archive) error:', e?.message));
    res.json({ archived: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/characters/:id/deepen — AI fills in missing fields
router.post('/world/characters/:id/deepen', optionalAuth, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
    }
    const [char] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });
    if (!char) return res.status(404).json({ error: 'Character not found' });

    const wCfg = WORLD_CONFIGS[char.world_tag] || WORLD_CONFIGS['lalaverse'];

    // Identify empty fields to fill — includes all dossier-aligned fields
    const fillable = [
      // Core narrative
      'origin_story','public_persona','private_reality','moral_code','fidelity_pattern',
      'attracted_to','how_they_love','desire_they_wont_admit','aesthetic','arc_role',
      'exit_reason','how_they_meet','dynamic',
      // Intimate (only for eligible)
      ...(char.intimate_eligible ? ['intimate_style','intimate_dynamic','what_lala_feels'] : []),
      // Dossier essence fields
      'core_fear','character_archetype','emotional_baseline','at_their_best','at_their_worst',
      // Aesthetic DNA
      'color_palette','signature_silhouette','signature_accessories','glam_energy',
      // Voice
      'speech_pattern','vocabulary_tone','catchphrases','internal_monologue_style',
      // Career
      'career_goal',
    ];
    const missing = fillable.filter(f => !char[f]);
    if (missing.length === 0) return res.json({ character: char, deepened: false, message: 'All fields already filled' });

    // Field descriptions for Claude
    const fieldDescriptions = {
      origin_story: 'where they came from before the protagonist\'s world',
      public_persona: 'how the world sees them',
      private_reality: 'what only close people know',
      moral_code: '1-2 sentences about their personal ethics',
      fidelity_pattern: 'faithful_tested|faithful_untested|emotionally_unfaithful|physically_unfaithful|serial_cheater|loyal_until_broken|would_never|already_has',
      attracted_to: 'who they actually pursue — specific, not a label',
      how_they_love: 'their connection pattern (e.g. avoidant until she isn\'t, then fully in)',
      desire_they_wont_admit: 'the private desire that complicates everything',
      aesthetic: 'how they look, dress, move — specific and visual',
      arc_role: 'how this character changes the protagonist\'s trajectory',
      exit_reason: 'how or why they leave, or null if they stay',
      how_they_meet: 'the specific scenario — not generic',
      dynamic: 'the texture of their connection with the protagonist',
      intimate_style: 'how they are in intimate moments',
      intimate_dynamic: 'the specific dynamic between them',
      what_lala_feels: 'what the protagonist physically and emotionally experiences with this person',
      core_fear: 'the thing they\'re most afraid of — distinct from what they want',
      character_archetype: 'Strategist|Dreamer|Performer|Guardian|Rebel|Visionary|Healer|Trickster|Sage|Creator',
      emotional_baseline: 'calm|volatile|guarded|warm|anxious|detached|intense|playful',
      at_their_best: 'one sentence — who they are when everything aligns',
      at_their_worst: 'one sentence — who they become when cornered or broken',
      color_palette: '2-3 signature colors (e.g. matte black, champagne gold, oxblood)',
      signature_silhouette: 'their signature clothing shape (e.g. oversized blazers over slip dresses)',
      signature_accessories: '1-2 items they\'re known for',
      glam_energy: 'Minimal|Maximal|Editorial',
      speech_pattern: 'how they talk — sentence structure, pace, verbal tics',
      vocabulary_tone: 'the register and flavor of their language',
      catchphrases: '1-2 signature phrases or verbal habits they repeat',
      internal_monologue_style: 'how their inner thoughts sound — formal, fragmented, poetic, anxious, etc.',
      career_goal: 'their specific professional ambition',
    };

    const result = await claude(
      wCfg.system_prompt,
      `Deepen this existing character by filling in missing fields. Only generate the MISSING fields listed below.

CHARACTER: ${char.name}
Type: ${char.character_type}
Gender: ${char.gender || 'unknown'}
Occupation: ${char.occupation || 'unknown'}
Age: ${char.age_range || 'unknown'}
Sexuality: ${char.sexuality || 'unknown'}
Relationship status: ${char.relationship_status || 'unknown'}
Existing aesthetic: ${char.aesthetic || 'none'}
Existing dynamic: ${char.dynamic || 'none'}
Existing signature: ${char.signature || 'none'}
Surface want: ${char.surface_want || 'none'}
Real want: ${char.real_want || 'none'}
Intimate eligible: ${char.intimate_eligible}

MISSING FIELDS TO FILL:
${missing.map(f => `- ${f}: ${fieldDescriptions[f] || f}`).join('\n')}

Return JSON only — an object with ONLY the missing field keys and their values. Be specific, vivid, and true to this character's type.`,
      6000
    );

    const parsed = parseJSON(result);
    if (!parsed) return res.status(500).json({ error: 'Deepen failed — Claude returned unparseable response' });

    // Update only the fields that were missing and got generated
    const updates = [];
    const replacements = { id: req.params.id };
    for (const field of missing) {
      if (parsed[field] !== undefined && parsed[field] !== null) {
        updates.push(`${field} = :${field}`);
        replacements[field] = parsed[field];
      }
    }
    if (updates.length > 0) {
      await sequelize.query(
        `UPDATE world_characters SET ${updates.join(', ')}, updated_at = NOW() WHERE id = :id`,
        { replacements, type: sequelize.QueryTypes.UPDATE }
      );
    }

    // Auto re-sync to registry so dossier stays current
    const [updated] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });
    let registrySynced = false;
    try {
      const [rc] = await Q(req,
        'SELECT id, registry_id FROM registry_characters WHERE world_character_id = :id',
        { replacements: { id: req.params.id } }
      );
      if (rc) {
        const _wCfgSync = WORLD_CONFIGS[updated.world_tag] || WORLD_CONFIGS['lalaverse'];
        const roleType = ROLE_MAP[updated.character_type] || 'special';
        await sequelize.query(
          `UPDATE registry_characters SET
            display_name = :display_name, selected_name = :selected_name, subtitle = :subtitle,
            role_type = :role_type, role_label = :role_label,
            core_desire = :core_desire, core_fear = :core_fear,
            core_wound = :core_wound, mask_persona = :mask_persona, truth_persona = :truth_persona,
            character_archetype = :character_archetype, signature_trait = :signature_trait,
            emotional_baseline = :emotional_baseline, description = :description,
            personality_matrix = :personality_matrix, aesthetic_dna = :aesthetic_dna,
            career_status = :career_status, relationships_map = :relationships_map,
            voice_signature = :voice_signature, story_presence = :story_presence,
            evolution_tracking = :evolution_tracking, extra_fields = :extra_fields,
            gender = :gender, pronouns = :pronouns, age = :age, sexuality = :sexuality,
            relationship_status = :relationship_status,
            hometown = :hometown, current_city = :current_city,
            physical_presence = :physical_presence,
            updated_at = NOW()
          WHERE id = :rc_id`,
          {
            replacements: {
              rc_id: rc.id,
              display_name: updated.name,
              selected_name: updated.name,
              subtitle: [updated.age_range, updated.occupation].filter(Boolean).join(' · ') || null,
              role_type: roleType,
              role_label: updated.character_type || null,
              core_desire: updated.real_want || null,
              core_fear: updated.core_fear || null,
              core_wound: updated.desire_they_wont_admit || null,
              mask_persona: updated.public_persona || null,
              truth_persona: updated.private_reality || null,
              character_archetype: updated.character_archetype || null,
              signature_trait: updated.signature || null,
              emotional_baseline: updated.emotional_baseline || null,
              description: [updated.occupation, updated.dynamic].filter(Boolean).join('. ') || null,
              personality_matrix: JSON.stringify({
                core_wound: updated.desire_they_wont_admit || null,
                desire_line: updated.real_want || null,
                fear_line: updated.core_fear || null,
                coping_mechanism: updated.moral_code || null,
                self_deception: updated.surface_want || null,
                at_their_best: updated.at_their_best || null,
                at_their_worst: updated.at_their_worst || null,
              }),
              aesthetic_dna: JSON.stringify({
                era_aesthetic: updated.aesthetic || null,
                color_palette: updated.color_palette || null,
                signature_silhouette: updated.signature_silhouette || null,
                signature_accessories: updated.signature_accessories || null,
                glam_energy: updated.glam_energy || null,
                visual_evolution_notes: null,
              }),
              career_status: JSON.stringify({
                profession: updated.occupation || null,
                career_goal: updated.career_goal || null,
                reputation_level: null, brand_relationships: null, financial_status: null,
                public_recognition: updated.public_persona || null,
                ongoing_arc: updated.arc_role || null,
              }),
              relationships_map: JSON.stringify({
                allies: null, rivals: null, mentors: null,
                love_interests: null, business_partners: null,
                dynamic_notes: updated.dynamic || null,
                tension_type: updated.tension_type || null,
                what_they_want_from_lala: updated.what_they_want_from_lala || null,
                attracted_to: updated.attracted_to || null,
                how_they_love: updated.how_they_love || null,
              }),
              voice_signature: JSON.stringify({
                speech_pattern: updated.speech_pattern || null,
                vocabulary_tone: updated.vocabulary_tone || null,
                catchphrases: updated.catchphrases || null,
                internal_monologue_style: updated.internal_monologue_style || null,
                emotional_reactivity: updated.emotional_baseline || null,
              }),
              story_presence: JSON.stringify({
                appears_in_books: updated.world_tag,
                current_story_status: updated.how_they_meet || null,
                unresolved_threads: null,
                future_potential: updated.exit_reason ? 'Will exit' : 'Yes',
              }),
              evolution_tracking: JSON.stringify({
                version_history: null,
                era_changes: updated.world_location || null,
                personality_shifts: null,
              }),
              extra_fields: JSON.stringify({
                source: 'world_studio',
                world_character_id: req.params.id,
                intimate_eligible: updated.intimate_eligible || false,
                intimate_style: updated.intimate_style || null,
                intimate_dynamic: updated.intimate_dynamic || null,
                what_lala_feels: updated.what_lala_feels || null,
                moral_code: updated.moral_code || null,
                fidelity_pattern: updated.fidelity_pattern || null,
                committed_to: updated.committed_to || null,
                career_echo_connection: updated.career_echo_connection || false,
              }),
              gender: updated.gender || null,
              pronouns: derivePronouns(updated.gender),
              age: parseAgeRange(updated.age_range),
              sexuality: updated.sexuality || null,
              relationship_status: updated.relationship_status || null,
              hometown: updated.origin_story || null,
              current_city: updated.world_location || null,
              physical_presence: updated.aesthetic || null,
            },
            type: sequelize.QueryTypes.UPDATE,
          }
        );
        registrySynced = true;
      }
    } catch (syncErr) {
      console.error('deepen re-sync error:', syncErr.message);
    }

    res.json({ character: updated, deepened: true, fields_filled: updates.length, registry_synced: registrySynced });
  } catch (err) {
    console.error('deepen error:', err.message);
    res.status(err.aiStatus || 500).json({ error: err.message });
  }
});

// POST /world/characters/:id/re-sync
// Push current world character data back into its linked registry character
router.post('/world/characters/:id/re-sync', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: req.params.id } });
    if (!char) return res.status(404).json({ error: 'Character not found' });

    const [rc] = await Q(req,
      'SELECT id, registry_id FROM registry_characters WHERE world_character_id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!rc) return res.status(404).json({ error: 'No linked registry character found — was this character synced?' });

    const _wCfg = WORLD_CONFIGS[char.world_tag] || WORLD_CONFIGS['lalaverse'];
    const roleType = ROLE_MAP[char.character_type] || 'special';

    await sequelize.query(
      `UPDATE registry_characters SET
        display_name = :display_name, selected_name = :selected_name,
        subtitle = :subtitle, role_type = :role_type, role_label = :role_label,
        core_desire = :core_desire, core_fear = :core_fear,
        core_wound = :core_wound, mask_persona = :mask_persona, truth_persona = :truth_persona,
        character_archetype = :character_archetype, signature_trait = :signature_trait,
        emotional_baseline = :emotional_baseline, description = :description,
        personality_matrix = :personality_matrix, aesthetic_dna = :aesthetic_dna,
        career_status = :career_status, relationships_map = :relationships_map,
        voice_signature = :voice_signature, story_presence = :story_presence,
        evolution_tracking = :evolution_tracking, extra_fields = :extra_fields,
        gender = :gender, pronouns = :pronouns, age = :age, sexuality = :sexuality,
        relationship_status = :relationship_status,
        hometown = :hometown, current_city = :current_city,
        physical_presence = :physical_presence,
        updated_at = NOW()
      WHERE id = :rc_id`,
      {
        replacements: {
          rc_id: rc.id,
          display_name: char.name,
          selected_name: char.name,
          subtitle: [char.age_range, char.occupation].filter(Boolean).join(' · ') || null,
          role_type: roleType,
          role_label: char.character_type || null,
          core_desire: char.real_want || null,
          core_fear: char.core_fear || null,
          core_wound: char.desire_they_wont_admit || null,
          mask_persona: char.public_persona || null,
          truth_persona: char.private_reality || null,
          character_archetype: char.character_archetype || null,
          signature_trait: char.signature || null,
          emotional_baseline: char.emotional_baseline || null,
          description: [char.occupation, char.dynamic].filter(Boolean).join('. ') || null,
          personality_matrix: JSON.stringify({
            core_wound: char.desire_they_wont_admit || null,
            desire_line: char.real_want || null,
            fear_line: char.core_fear || null,
            coping_mechanism: char.moral_code || null,
            self_deception: char.surface_want || null,
            at_their_best: char.at_their_best || null,
            at_their_worst: char.at_their_worst || null,
          }),
          aesthetic_dna: JSON.stringify({
            era_aesthetic: char.aesthetic || null,
            color_palette: char.color_palette || null,
            signature_silhouette: char.signature_silhouette || null,
            signature_accessories: char.signature_accessories || null,
            glam_energy: char.glam_energy || null,
            visual_evolution_notes: null,
          }),
          career_status: JSON.stringify({
            profession: char.occupation || null,
            career_goal: char.career_goal || null,
            reputation_level: null, brand_relationships: null,
            financial_status: null, public_recognition: char.public_persona || null,
            ongoing_arc: char.arc_role || null,
          }),
          relationships_map: JSON.stringify({
            allies: null, rivals: null, mentors: null,
            love_interests: null, business_partners: null,
            dynamic_notes: char.dynamic || null,
            tension_type: char.tension_type || null,
            what_they_want_from_lala: char.what_they_want_from_lala || null,
            attracted_to: char.attracted_to || null,
            how_they_love: char.how_they_love || null,
          }),
          voice_signature: JSON.stringify({
            speech_pattern: char.speech_pattern || null,
            vocabulary_tone: char.vocabulary_tone || null,
            catchphrases: char.catchphrases || null,
            internal_monologue_style: char.internal_monologue_style || null,
            emotional_reactivity: char.emotional_baseline || null,
          }),
          story_presence: JSON.stringify({
            appears_in_books: char.world_tag,
            current_story_status: char.how_they_meet || null,
            unresolved_threads: null,
            future_potential: char.exit_reason ? 'Will exit' : 'Yes',
          }),
          evolution_tracking: JSON.stringify({
            version_history: null,
            era_changes: char.world_location || null,
            personality_shifts: null,
          }),
          extra_fields: JSON.stringify({
            source: 'world_studio',
            world_character_id: req.params.id,
            intimate_eligible: char.intimate_eligible || false,
            intimate_style: char.intimate_style || null,
            intimate_dynamic: char.intimate_dynamic || null,
            what_lala_feels: char.what_lala_feels || null,
            moral_code: char.moral_code || null,
            fidelity_pattern: char.fidelity_pattern || null,
            committed_to: char.committed_to || null,
            career_echo_connection: char.career_echo_connection || false,
          }),
          gender: char.gender || null,
          pronouns: derivePronouns(char.gender),
          age: parseAgeRange(char.age_range),
          sexuality: char.sexuality || null,
          relationship_status: char.relationship_status || null,
          hometown: char.origin_story || null,
          current_city: char.world_location || null,
          physical_presence: char.aesthetic || null,
        },
        type: sequelize.QueryTypes.UPDATE,
      }
    );

    const [updated] = await Q(req, 'SELECT * FROM registry_characters WHERE id = :id', { replacements: { id: rc.id } });
    res.json({ synced: true, registry_character: updated });
  } catch (err) {
    console.error('re-sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /world/characters/bulk-re-sync
// Re-sync all active world characters to their linked registry entries
router.post('/world/characters/bulk-re-sync', optionalAuth, async (req, res) => {
  try {
    const { world_tag = 'lalaverse' } = req.body;
    const chars = await Q(req,
      `SELECT wc.*, rc.id AS rc_id FROM world_characters wc
       JOIN registry_characters rc ON rc.world_character_id = wc.id
       WHERE wc.status != 'archived' AND wc.world_tag = :world_tag`,
      { replacements: { world_tag } }
    );

    if (!chars.length) {
      return res.json({ synced: 0, message: 'No linked characters found to re-sync' });
    }

    let synced = 0;
    const errors = [];
    for (const char of chars) {
      try {
        const roleType = ROLE_MAP[char.character_type] || 'special';
        await sequelize.query(
          `UPDATE registry_characters SET
            display_name = :name, selected_name = :selected_name, subtitle = :subtitle,
            role_type = :role_type, role_label = :role_label,
            core_desire = :core_desire, core_fear = :core_fear,
            core_wound = :core_wound, mask_persona = :mask_persona, truth_persona = :truth_persona,
            character_archetype = :character_archetype, signature_trait = :signature_trait,
            emotional_baseline = :emotional_baseline, description = :description,
            personality_matrix = :personality_matrix, aesthetic_dna = :aesthetic_dna,
            career_status = :career_status, relationships_map = :relationships_map,
            voice_signature = :voice_signature, story_presence = :story_presence,
            evolution_tracking = :evolution_tracking, extra_fields = :extra_fields,
            gender = :gender, pronouns = :pronouns, age = :age, sexuality = :sexuality,
            relationship_status = :relationship_status,
            hometown = :hometown, current_city = :current_city,
            physical_presence = :physical_presence,
            updated_at = NOW()
          WHERE id = :rc_id`,
          {
            replacements: {
              rc_id: char.rc_id,
              name: char.name,
              selected_name: char.name,
              subtitle: [char.age_range, char.occupation].filter(Boolean).join(' · ') || null,
              role_type: roleType,
              role_label: char.character_type || null,
              core_desire: char.real_want || null,
              core_fear: char.core_fear || null,
              core_wound: char.desire_they_wont_admit || null,
              mask_persona: char.public_persona || null,
              truth_persona: char.private_reality || null,
              character_archetype: char.character_archetype || null,
              signature_trait: char.signature || null,
              emotional_baseline: char.emotional_baseline || null,
              description: [char.occupation, char.dynamic].filter(Boolean).join('. ') || null,
              personality_matrix: JSON.stringify({
                core_wound: char.desire_they_wont_admit || null,
                desire_line: char.real_want || null,
                fear_line: char.core_fear || null,
                coping_mechanism: char.moral_code || null,
                self_deception: char.surface_want || null,
                at_their_best: char.at_their_best || null,
                at_their_worst: char.at_their_worst || null,
              }),
              aesthetic_dna: JSON.stringify({
                era_aesthetic: char.aesthetic || null,
                color_palette: char.color_palette || null,
                signature_silhouette: char.signature_silhouette || null,
                signature_accessories: char.signature_accessories || null,
                glam_energy: char.glam_energy || null,
                visual_evolution_notes: null,
              }),
              career_status: JSON.stringify({
                profession: char.occupation || null,
                career_goal: char.career_goal || null,
                reputation_level: null, brand_relationships: null, financial_status: null,
                public_recognition: char.public_persona || null,
                ongoing_arc: char.arc_role || null,
              }),
              relationships_map: JSON.stringify({
                allies: null, rivals: null, mentors: null,
                love_interests: null, business_partners: null,
                dynamic_notes: char.dynamic || null,
                tension_type: char.tension_type || null,
                what_they_want_from_lala: char.what_they_want_from_lala || null,
                attracted_to: char.attracted_to || null,
                how_they_love: char.how_they_love || null,
              }),
              voice_signature: JSON.stringify({
                speech_pattern: char.speech_pattern || null,
                vocabulary_tone: char.vocabulary_tone || null,
                catchphrases: char.catchphrases || null,
                internal_monologue_style: char.internal_monologue_style || null,
                emotional_reactivity: char.emotional_baseline || null,
              }),
              story_presence: JSON.stringify({
                appears_in_books: char.world_tag,
                current_story_status: char.how_they_meet || null,
                unresolved_threads: null,
                future_potential: char.exit_reason ? 'Will exit' : 'Yes',
              }),
              evolution_tracking: JSON.stringify({
                version_history: null,
                era_changes: char.world_location || null,
                personality_shifts: null,
              }),
              extra_fields: JSON.stringify({
                source: 'world_studio',
                world_character_id: char.id,
                intimate_eligible: char.intimate_eligible || false,
                intimate_style: char.intimate_style || null,
                intimate_dynamic: char.intimate_dynamic || null,
                what_lala_feels: char.what_lala_feels || null,
                moral_code: char.moral_code || null,
                fidelity_pattern: char.fidelity_pattern || null,
                committed_to: char.committed_to || null,
                career_echo_connection: char.career_echo_connection || false,
              }),
              gender: char.gender || null,
              pronouns: derivePronouns(char.gender),
              age: parseAgeRange(char.age_range),
              sexuality: char.sexuality || null,
              relationship_status: char.relationship_status || null,
              hometown: char.origin_story || null,
              current_city: char.world_location || null,
              physical_presence: char.aesthetic || null,
            },
            type: sequelize.QueryTypes.UPDATE,
          }
        );
        synced++;
      } catch (err) {
        errors.push({ name: char.name, error: err.message });
      }
    }

    res.json({ synced, total: chars.length, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error('bulk-re-sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
      ).catch(e => console.warn('[world-studio] delete character relationships error:', e?.message));
    }
    // Remove linked registry character
    await sequelize.query(
      `DELETE FROM registry_characters WHERE world_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(e => console.warn('[world-studio] delete registry character error:', e?.message));
    // Remove linked scenes
    await sequelize.query(
      `DELETE FROM intimate_scenes WHERE character_a_id = :id OR character_b_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(e => console.warn('[world-studio] delete intimate scenes error:', e?.message));
    // Remove extended relationships
    await sequelize.query(
      `DELETE FROM character_relationships_extended WHERE character_id = :id OR related_character_id = :id`,
      { replacements: { id: req.params.id }, type: sequelize.QueryTypes.DELETE }
    ).catch(e => console.warn('[world-studio] delete extended relationships error:', e?.message));
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
    `).catch(e => { console.warn('[world-studio] tension-check query error:', e?.message); return []; });

    // Also include intimate-eligible characters without relationship records
    // who haven't had a scene yet (one-night-stand candidates)
    const oneNightCandidates = await Q(req, `
      SELECT wc.* FROM world_characters wc
      WHERE wc.character_type = 'one_night_stand'
        AND wc.status = 'active'
        AND wc.intimate_eligible = true
        AND NOT EXISTS (SELECT 1 FROM intimate_scenes WHERE character_a_id = wc.id OR character_b_id = wc.id)
    `).catch(e => { console.warn('[world-studio] one-night candidates query error:', e?.message); return []; });

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
    `, { replacements: { a: character_a_id, b: character_b_id || character_a_id } }).catch(e => { console.warn('[world-studio] scene history query error:', e?.message); return []; });

    // Determine scene length
    const { min, max, label: _label } = resolveSceneLength(charA.character_type, scene_type, charA.dynamic);

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
${charA.emotional_baseline ? `Emotional baseline: ${charA.emotional_baseline}` : ''}
${charA.at_their_best ? `At their best: ${charA.at_their_best}` : ''}
${charA.at_their_worst ? `At their worst: ${charA.at_their_worst}` : ''}
${charA.intimate_style ? `In intimate moments: ${charA.intimate_style}` : ''}
${charA.what_lala_feels ? `What she feels with this person: ${charA.what_lala_feels}` : ''}
${charA.dynamic ? `Their dynamic: ${charA.dynamic}` : ''}
${charA.fidelity_pattern ? `Fidelity pattern: ${charA.fidelity_pattern}` : ''}
${charA.relationship_status ? `Relationship status: ${charA.relationship_status}${charA.committed_to ? ` (committed to ${charA.committed_to})` : ''}` : ''}
${charA.moral_code ? `Moral code: ${charA.moral_code}` : ''}
${charA.core_fear ? `Core fear: ${charA.core_fear}` : ''}
${charA.speech_pattern ? `Speech pattern: ${charA.speech_pattern}` : ''}
${charA.vocabulary_tone ? `Vocabulary tone: ${charA.vocabulary_tone}` : ''}
${charA.catchphrases ? `Verbal habits: ${charA.catchphrases}` : ''}
${charA.internal_monologue_style ? `Inner monologue style: ${charA.internal_monologue_style}` : ''}

${charB ? `OTHER CHARACTER: ${charB.name}
${charB.aesthetic ? `Aesthetic: ${charB.aesthetic}` : ''}
${charB.color_palette ? `Color palette: ${charB.color_palette}` : ''}
${charB.signature_silhouette ? `Signature look: ${charB.signature_silhouette}` : ''}
${charB.signature_accessories ? `Signature accessories: ${charB.signature_accessories}` : ''}
${charB.emotional_baseline ? `Emotional baseline: ${charB.emotional_baseline}` : ''}
${charB.at_their_best ? `At their best: ${charB.at_their_best}` : ''}
${charB.at_their_worst ? `At their worst: ${charB.at_their_worst}` : ''}
${charB.intimate_style ? `In intimate moments: ${charB.intimate_style}` : ''}
${charB.intimate_dynamic ? `Their dynamic: ${charB.intimate_dynamic}` : ''}
${charB.surface_want ? `What they want: ${charB.surface_want}` : ''}
${charB.real_want ? `What they'd never admit: ${charB.real_want}` : ''}
${charB.core_fear ? `Core fear: ${charB.core_fear}` : ''}
${charB.fidelity_pattern ? `Fidelity pattern: ${charB.fidelity_pattern}` : ''}
${charB.relationship_status ? `Relationship status: ${charB.relationship_status}${charB.committed_to ? ` (committed to ${charB.committed_to})` : ''}` : ''}
${charB.moral_code ? `Moral code: ${charB.moral_code}` : ''}
${charB.speech_pattern ? `Speech pattern: ${charB.speech_pattern}` : ''}
${charB.vocabulary_tone ? `Vocabulary tone: ${charB.vocabulary_tone}` : ''}
${charB.catchphrases ? `Verbal habits: ${charB.catchphrases}` : ''}
${charB.how_they_love ? `How they love: ${charB.how_they_love}` : ''}` : 'OTHER CHARACTER: Unknown — this is a first encounter'}

SCENE TYPE: ${scene_type}
LOCATION: ${location || 'a private space in LalaVerse'}
CONTEXT: ${sceneContext || 'After a charged evening. The tension has been building.'}
TENSION THAT TRIGGERED THIS: ${trigger_tension || 'Unresolved'}
CAREER STAGE: ${career_stage}

FIDELITY DYNAMICS: ${[charA, charB].filter(Boolean).some(c => c.fidelity_pattern && c.fidelity_pattern !== 'faithful_untested') ? 'One or both characters carry fidelity complexity. This should inform the emotional weight of the scene — guilt, recklessness, the awareness of crossing a line, or the deliberate choice not to.' : 'No active fidelity tension in this pairing.'}

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
    console.error('scene generate error:', err.message);
    const status = err.aiStatus || 500;
    res.status(status).json({ error: err.message });
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

    const [charA] = await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: scene.character_a_id } }).catch(e => { console.warn('[world-studio] charA query error:', e?.message); return [{}]; });
    const charB   = scene.character_b_id
      ? (await Q(req, 'SELECT * FROM world_characters WHERE id = :id', { replacements: { id: scene.character_b_id } }).catch(e => { console.warn('[world-studio] charB query error:', e?.message); return [{}]; }))[0]
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
      ).catch(e => console.warn('[world-studio] tension state update error:', e?.message));
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
    ).catch(e => console.warn('[world-studio] continuity beat insert error:', e?.message));

    // 4. Extract memory
    let memoryResult;
    try {
      memoryResult = await claude(
        `Extract the emotional memory from this intimate scene. Be specific about what she learns about herself, about desire, about power, about what she wants.`,
        `SCENE: ${scene.full_text?.substring(0, 1500)}
CHARACTER: ${scene.character_a_name}
RELATIONSHIP SHIFT: ${scene.relationship_shift}

Return JSON: { "memory_statement": "what she now knows or feels", "memory_type": "belief|constraint|character_dynamic|pain_point", "confidence": 0.0-1.0 }`
      );
    } catch (memErr) {
      console.error('Memory extraction Claude error:', memErr.message);
      memoryResult = null;
    }
    const mem = parseJSON(memoryResult);
    if (mem?.memory_statement) {
      await sequelize.query(
        `INSERT INTO storyteller_memories (id, type, statement, confidence, confirmed, source_ref, created_at, updated_at)
         VALUES (:id, :type, :statement, :confidence, false, :source, NOW(), NOW())`,
        { replacements: { id: uuidv4(), type: mem.memory_type || 'character_dynamic', statement: mem.memory_statement, confidence: mem.confidence || 0.8, source: `intimate_scene:${sceneId}` }, type: sequelize.QueryTypes.INSERT }
      ).catch(e => console.warn('[world-studio] memory insert error:', e?.message));
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
  let result;
  try {
    result = await claude(
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
  } catch (contErr) {
    console.error('Continuation Claude error:', contErr.message);
    return;
  }

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
 * GET /world/preview/:previewId
 * Restore a server-side preview — checks in-memory cache first, then DB.
 */
router.get('/world/preview/:previewId', optionalAuth, async (req, res) => {
  // Try in-memory cache first (fast path)
  const cached = getPreview(req.params.previewId);
  if (cached) return res.json({ preview_id: req.params.previewId, ...cached });

  // Fall back to DB
  try {
    if (!previewsTableReady) { await ensurePreviewsTable(); previewsTableReady = true; }
    const [row] = await Q(req,
      `SELECT * FROM ecosystem_previews WHERE preview_id = :pid AND status = 'pending'`,
      { replacements: { pid: req.params.previewId } }
    );
    if (!row) return res.status(404).json({ error: 'Preview not found' });
    const characters = typeof row.characters === 'string' ? JSON.parse(row.characters) : row.characters;
    res.json({ preview_id: row.preview_id, characters, generation_notes: row.generation_notes, world_tag: row.world_tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /world/previews
 * List all saved (pending) ecosystem previews — survives page navigation.
 */
router.get('/world/previews', optionalAuth, async (req, res) => {
  try {
    if (!previewsTableReady) { await ensurePreviewsTable(); previewsTableReady = true; }
    const rows = await Q(req,
      `SELECT preview_id, world_tag, generation_notes, status, created_at,
              jsonb_array_length(characters) AS character_count
       FROM ecosystem_previews
       ORDER BY created_at DESC
       LIMIT 20`
    );
    res.json({ previews: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * DELETE /world/previews/:previewId
 * Discard a saved preview.
 */
router.delete('/world/previews/:previewId', optionalAuth, async (req, res) => {
  try {
    if (!previewsTableReady) { await ensurePreviewsTable(); previewsTableReady = true; }
    await sequelize.query(
      `DELETE FROM ecosystem_previews WHERE preview_id = :pid`,
      { replacements: { pid: req.params.previewId }, type: sequelize.QueryTypes.DELETE }
    );
    previewCache.delete(req.params.previewId);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * POST /world/generate-ecosystem-preview
 * Same Claude prompt as generate-ecosystem BUT does NOT commit to DB.
 * Returns preview characters so the user can select/deselect before confirming.
 */
router.post('/world/generate-ecosystem-preview', optionalAuth, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
    }

    // Rate limit: max 3 previews per minute per IP
    if (!checkPreviewRateLimit(req.ip)) {
      return res.status(429).json({ error: 'Too many preview requests — max 3 per minute. Wait and try again.' });
    }

    const {
      world_tag = 'lalaverse',
      world_context = {},
      character_count: rawCount = 8,
    } = req.body;
    const character_count = Math.max(3, Math.min(20, parseInt(rawCount, 10) || 8));

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const _series_label = req.body.series_label || wCfg.series_label;

    const {
      city         = wCfg.defaults.city,
      industry     = wCfg.defaults.industry,
      career_stage = wCfg.defaults.career_stage,
      era          = wCfg.defaults.era,
      protagonist  = wCfg.protagonist,
    } = world_context;

    // Fetch active characters in this world to avoid duplication
    const existing = await Q(req, `
      SELECT name, character_type, occupation FROM world_characters
      WHERE status != 'archived' AND world_tag = :world_tag ORDER BY created_at DESC
    `, { replacements: { world_tag } });

    // Adaptive token limit: ~1600 tokens per character (40+ fields + JSON overhead)
    const tokenLimit = Math.max(8000, Math.min(20000, character_count * 1600 + 2000));

    const result = await claude(
      wCfg.system_prompt,

      `Generate ${character_count} world characters for ${wCfg.title}.

PROTAGONIST: ${protagonist}
WORLD: ${city}, ${industry} industry
CAREER STAGE: ${career_stage}
ERA: ${era}

${existing.length > 0 ? `EXISTING CHARACTERS (don't duplicate these names or archetypes):\n${existing.map(e => `- ${e.name} (${e.character_type})`).join('\n')}` : ''}

Include a MIX of character types. At minimum: 2 love_interest or one_night_stand, 1 industry_peer, 1 mentor or collaborator, 1 antagonist or rival.
Also include at least 1 of: spouse, partner, temptation, or ex — to create fidelity/moral tension.
At least one character should be committed (married or partnered) and at least one should test that commitment.
At least 2-3 characters should be intimate_eligible.
Every character name MUST be unique — no duplicates within this batch.

Return JSON only:
{
  "characters": [
    {
      "name": "full name — must be unique, no duplicates",
      "gender": "male|female|non_binary|agender — explicit gender for relationship compatibility",
      "age_range": "e.g. late 20s",
      "occupation": "specific job/role",
      "world_location": "where they exist in ${wCfg.title}",
      "character_type": "love_interest|industry_peer|mentor|antagonist|rival|collaborator|one_night_stand|spouse|partner|temptation|ex|confidant|friend|coworker",
      "character_archetype": "Strategist|Dreamer|Performer|Guardian|Rebel|Visionary|Healer|Trickster|Sage|Creator — their core archetype",
      "emotional_baseline": "calm|volatile|guarded|warm|anxious|detached|intense|playful — their default emotional register",
      "at_their_best": "one sentence — who they are when everything aligns",
      "at_their_worst": "one sentence — who they become when cornered or broken",
      "relationship_status": "single|dating|engaged|married|divorced|separated|its_complicated — their actual status, not what they tell people",
      "committed_to": "name of the person they're committed to (another character or offscreen person), or null if single",
      "moral_code": "1-2 sentences about their personal ethics — what lines they won't cross, or what lines they pretend they won't cross",
      "fidelity_pattern": "faithful_tested|faithful_untested|emotionally_unfaithful|physically_unfaithful|serial_cheater|loyal_until_broken|would_never|already_has — how they behave when commitment meets temptation",
      "sexuality": "straight|gay|lesbian|bisexual|pansexual|queer|fluid — be intentional, this drives romantic pairing logic",
      "intimate_eligible": true|false,
      "core_fear": "the thing they're most afraid of — distinct from what they want",
      "aesthetic": "how they look, dress, move — specific and visual",
      "color_palette": "2-3 signature colors that define their visual identity (e.g. 'matte black, champagne gold, oxblood')",
      "signature_silhouette": "their signature clothing shape (e.g. 'oversized blazers over slip dresses')",
      "signature_accessories": "1-2 items they're known for (e.g. 'thin gold chain, vintage watch')",
      "glam_energy": "Minimal|Maximal|Editorial — their beauty/grooming intensity",
      "signature": "the one thing about them that is unforgettable",
      "surface_want": "what they'd tell you they want",
      "real_want": "what they'd never admit",
      "career_goal": "their specific professional ambition — distinct from surface_want",
      "what_they_want_from_protagonist": "what they're actually seeking from ${protagonist} specifically",
      "how_they_meet": "the specific scenario — not generic",
      "dynamic": "the texture of their connection with ${protagonist}",
      "tension_type": "romantic|professional|creative|power|unspoken|moral|fidelity|temptation|betrayal|guilt",
      "speech_pattern": "how they talk — sentence structure, pace, verbal tics (e.g. 'clipped sentences, never asks questions, uses silence as punctuation')",
      "vocabulary_tone": "the register and flavor of their language (e.g. 'corporate polish masking street vernacular')",
      "catchphrases": "1-2 signature phrases or verbal habits they repeat (e.g. 'honestly though...', 'that's not my problem')",
      "internal_monologue_style": "how their inner thoughts sound — formal, fragmented, poetic, anxious, detached, etc.",
      "intimate_style": "how they are in intimate moments — only for intimate_eligible characters, null otherwise",
      "intimate_dynamic": "the specific dynamic between them — only for intimate_eligible, null otherwise",
      "what_protagonist_feels": "what ${protagonist} physically and emotionally experiences with this person — intimate_eligible only, null otherwise",
      "arc_role": "how this character changes ${protagonist}'s trajectory",
      "exit_reason": "how or why they leave her world, or null if they stay",
      "career_echo_connection": true|false,
      "attracted_to": "who they actually pursue — specific, not a label",
      "how_they_love": "their connection pattern (e.g. 'avoidant until she isn't, then fully in')",
      "desire_they_wont_admit": "the thing that complicates the above (dimmed, private)",
      "family_layer": "real_world | ${world_tag} | series_2",
      "origin_story": "where they came from before ${protagonist}'s world",
      "public_persona": "how the world sees them",
      "private_reality": "what only close people know"
    }
  ],
  "generation_notes": "brief note on ecosystem logic — who connects to who, what tensions exist, which characters test each other's loyalty/fidelity, who argues, who stays, who leaves"
}`,
      tokenLimit
    );

    const parsed = parseJSON(result);
    if (!parsed?.characters?.length) {
      return res.status(500).json({ error: 'Preview generation failed — Claude returned no characters' });
    }

    // Post-processing: deduplicate names within batch and against existing
    const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
    const seenNames = new Set();
    parsed.characters = parsed.characters.filter(c => {
      const lower = (c.name || '').toLowerCase();
      if (!lower || seenNames.has(lower) || existingNames.has(lower)) return false;
      seenNames.add(lower);
      return true;
    });

    // Normalize field names: map protagonist-specific fields to DB column names
    for (const c of parsed.characters) {
      if (c.what_they_want_from_protagonist) {
        c.what_they_want_from_lala = c.what_they_want_from_protagonist;
        delete c.what_they_want_from_protagonist;
      }
      if (c.what_protagonist_feels) {
        c.what_lala_feels = c.what_protagonist_feels;
        delete c.what_protagonist_feels;
      }
    }

    if (!parsed.characters.length) {
      return res.status(500).json({ error: 'All generated characters were duplicates of existing ones — try again' });
    }

    // Persist preview server-side so it survives browser refresh
    const previewId = uuidv4();
    const ownerId = req.user?.id || req.ip || null;
    storePreview(previewId, {
      characters: parsed.characters,
      generation_notes: parsed.generation_notes || '',
      world_tag,
    }, ownerId);

    res.json({
      preview_id: previewId,
      characters: parsed.characters,
      generation_notes: parsed.generation_notes || '',
      count: parsed.characters.length,
    });
  } catch (err) {
    console.error('generate-ecosystem-preview error:', err.message);
    const status = err.aiStatus || 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /world/generate-ecosystem-confirm
 * Takes the user-selected characters from the preview and commits them to DB + registry.
 */
router.post('/world/generate-ecosystem-confirm', optionalAuth, async (req, res) => {
  const { show_id, preview_id } = req.body;
  const t = await sequelize.transaction();
  try {
    let {
      characters = [],
      generation_notes = '',
      world_tag = 'lalaverse',
    } = req.body;

    // If preview_id provided, restore from server-side cache (survives browser refresh)
    if (preview_id && !characters.length) {
      const cached = getPreview(preview_id);
      if (cached) {
        characters = cached.data?.characters || cached.characters || [];
        generation_notes = generation_notes || cached.data?.generation_notes || cached.generation_notes || '';
        world_tag = cached.data?.world_tag || cached.world_tag || world_tag;
      }
    }

    const wCfg = WORLD_CONFIGS[world_tag] || WORLD_CONFIGS['lalaverse'];
    const series_label = req.body.series_label || wCfg.series_label;

    if (!characters.length) {
      await t.rollback();
      return res.status(400).json({ error: 'No characters to confirm' });
    }

    // Validate required columns exist (migration may not have run)
    const cols = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'world_characters'`,
      { type: sequelize.QueryTypes.SELECT, transaction: t }
    );
    const colNames = new Set(cols.map(c => c.column_name));
    const required = ['relationship_status', 'committed_to', 'moral_code', 'fidelity_pattern', 'sexuality', 'family_layer', 'origin_story', 'public_persona', 'private_reality'];
    const missing = required.filter(c => !colNames.has(c));
    if (missing.length) {
      await t.rollback();
      console.error(`generate-ecosystem-confirm: missing columns: ${missing.join(', ')}. Run: npx sequelize-cli db:migrate`);
      return res.status(500).json({
        error: `Database schema outdated — missing columns: ${missing.join(', ')}. Run migrations on the server.`,
      });
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
        transaction: t,
      }
    );

    // Insert each character + sync to registry (all within transaction)
    const registryId = await findOrCreateRegistryForWorld(req, world_tag);
    const inserted = [];
    const WorldCharacter = req.app.locals.db?.WorldCharacter || require('../models').WorldCharacter;
    for (const c of characters) {
      const wcRecord = await WorldCharacter.create({
        batch_id: batchId,
        name: c.name,
        gender: c.gender || null,
        age_range: c.age_range || null,
        occupation: c.occupation || null,
        world_location: c.world_location || null,
        character_type: c.character_type,
        sexuality: c.sexuality || null,
        intimate_eligible: c.intimate_eligible || false,
        aesthetic: c.aesthetic || null,
        signature: c.signature || null,
        surface_want: c.surface_want || null,
        real_want: c.real_want || null,
        what_they_want_from_lala: c.what_they_want_from_lala || null,
        how_they_meet: c.how_they_meet || null,
        dynamic: c.dynamic || null,
        tension_type: c.tension_type || null,
        intimate_style: c.intimate_style || null,
        intimate_dynamic: c.intimate_dynamic || null,
        what_lala_feels: c.what_lala_feels || null,
        arc_role: c.arc_role || null,
        exit_reason: c.exit_reason || null,
        career_echo_connection: c.career_echo_connection || false,
        attracted_to: c.attracted_to || null,
        how_they_love: c.how_they_love || null,
        desire_they_wont_admit: c.desire_they_wont_admit || null,
        relationship_graph: c.relationship_graph || [],
        family_layer: c.family_layer || null,
        origin_story: c.origin_story || null,
        public_persona: c.public_persona || null,
        private_reality: c.private_reality || null,
        relationship_status: c.relationship_status || null,
        committed_to: c.committed_to || null,
        moral_code: c.moral_code || null,
        fidelity_pattern: c.fidelity_pattern || null,
        world_tag: world_tag,
        status: 'draft',
      }, { transaction: t });
      const charId = wcRecord.id;

      // Sync to canonical registry (pass protagonist name for correct lookup)
      let rcId = null;
      try {
        rcId = await syncToRegistry(req, charId, c, registryId, world_tag, wCfg.protagonist);
      } catch (syncErr) {
        console.error(`syncToRegistry failed for ${c.name}:`, syncErr.message);
        // Non-fatal: character is still created in world_characters, registry link can be retried via re-sync
      }
      inserted.push({ ...c, id: charId, registry_character_id: rcId });
    }

    await t.commit();

    // Seed inter-character relationships outside transaction (non-fatal)
    // Scale cap by character count: ~n*(n-1)/6, min 5, max 15
    const relCap = Math.max(5, Math.min(15, Math.floor(inserted.length * (inserted.length - 1) / 6)));
    const interCount = await seedInterCharacterRelationships(inserted, registryId, relCap);
    console.log(`generate-ecosystem-confirm: Seeded ${interCount} inter-character relationship(s) (cap: ${relCap})`);

    // Clear preview cache entry and mark DB preview as confirmed
    if (preview_id) {
      previewCache.delete(preview_id);
      sequelize.query(
        `UPDATE ecosystem_previews SET status = 'confirmed', updated_at = NOW() WHERE preview_id = :pid`,
        { replacements: { pid: preview_id }, type: sequelize.QueryTypes.UPDATE }
      ).catch(e => console.warn('[world-studio] preview confirm error:', e?.message));
    }

    res.status(201).json({
      characters: inserted,
      batch_id: batchId,
      count: inserted.length,
      inter_relationships: interCount,
      generation_notes,
    });
  } catch (err) {
    await t.rollback();
    // Clean up orphaned preview on rollback
    if (preview_id) {
      previewCache.delete(preview_id);
      sequelize.query(
        `UPDATE ecosystem_previews SET status = 'failed', updated_at = NOW() WHERE preview_id = :pid`,
        { replacements: { pid: preview_id }, type: sequelize.QueryTypes.UPDATE }
      ).catch(e => console.warn('[world-studio] preview fail-mark error:', e?.message));
    }
    console.error('generate-ecosystem-confirm error:', err);
    const detail = err.original?.message || err.parent?.message || '';
    res.status(500).json({
      error: err.message,
      ...(detail && { detail }),
      hint: detail.includes('column') ? 'Run migrations: npx sequelize-cli db:migrate' : undefined,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CROSS-BATCH RELATIONSHIP SEEDING
// ══════════════════════════════════════════════════════════════════════════════

// POST /world/characters/seed-cross-batch — seed relationships across existing batches
router.post('/world/characters/seed-cross-batch', optionalAuth, async (req, res) => {
  try {
    const { world_tag = 'lalaverse', max_pairs = 10 } = req.body;
    // Fetch all active characters in this world that have registry IDs
    const characters = await Q(req, `
      SELECT id, name, character_type, sexuality, gender, dynamic,
             registry_character_id, batch_id
      FROM world_characters
      WHERE world_tag = :world_tag AND status = 'active' AND registry_character_id IS NOT NULL
      ORDER BY created_at ASC
    `, { replacements: { world_tag } });

    if (characters.length < 2) return res.json({ seeded: 0, message: 'Need at least 2 active characters' });

    // Only pair characters from DIFFERENT batches
    const batches = [...new Set(characters.map(c => c.batch_id).filter(Boolean))];
    if (batches.length < 2) return res.json({ seeded: 0, message: 'Need characters from at least 2 batches' });

    // Build cross-batch pairs
    const pairs = [];
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const a = characters[i], b = characters[j];
        if (a.batch_id === b.batch_id) continue; // same batch — skip
        const rule = INTER_CHAR_PAIRINGS.find(
          ([tA, tB]) => (a.character_type === tA && b.character_type === tB) ||
                        (a.character_type === tB && b.character_type === tA)
        );
        if (rule) {
          const isRomantic = rule[5];
          if (isRomantic && !areSexuallyCompatible(a, b)) continue;
          pairs.push({ a, b, rule });
        }
      }
    }
    pairs.sort((x, y) => {
      const tensionRank = { volatile: 0, simmering: 1, calm: 2 };
      return (tensionRank[x.rule[4]] ?? 2) - (tensionRank[y.rule[4]] ?? 2);
    });

    let seeded = 0;
    for (const { a, b, rule } of pairs.slice(0, Math.min(max_pairs, 20))) {
      const [, , relType, connMode, tension] = rule;
      try {
        const [existing] = await sequelize.query(
          `SELECT id FROM character_relationships
           WHERE (character_id_a = :idA AND character_id_b = :idB)
              OR (character_id_a = :idB AND character_id_b = :idA) LIMIT 1`,
          { replacements: { idA: a.registry_character_id, idB: b.registry_character_id }, type: sequelize.QueryTypes.SELECT }
        );
        if (existing) continue;
        const relId = uuidv4();
        await sequelize.query(
          `INSERT INTO character_relationships
             (id, character_id_a, character_id_b, relationship_type,
              connection_mode, lala_connection, status, situation,
              tension_state, notes, confirmed, created_at, updated_at)
           VALUES (:id, :a, :b, :rel, :conn, 'independent', 'Active',
                   :sit, :tension, :notes, false, NOW(), NOW())`,
          { replacements: {
            id: relId, a: a.registry_character_id, b: b.registry_character_id,
            rel: relType, conn: connMode,
            sit: [a.dynamic, b.dynamic].filter(Boolean).join(' / ') || null,
            tension, notes: `Cross-batch: ${a.name} ↔ ${b.name}`,
          }, type: sequelize.QueryTypes.INSERT }
        );
        seeded++;
      } catch (e) { console.error('cross-batch seed error:', e.message); }
    }
    res.json({ seeded, total_candidates: pairs.length, batches: batches.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT CHARACTER DOSSIER
// ══════════════════════════════════════════════════════════════════════════════

// GET /world/characters/:id/export — export full character dossier as JSON
router.get('/world/characters/:id/export', optionalAuth, async (req, res) => {
  try {
    const [char] = await Q(req,
      'SELECT * FROM world_characters WHERE id = :id',
      { replacements: { id: req.params.id } }
    );
    if (!char) return res.status(404).json({ error: 'Not found' });

    // Build structured dossier
    const dossier = {
      meta: { exported_at: new Date().toISOString(), world_tag: char.world_tag, source: 'world_studio' },
      identity: {
        name: char.name, age_range: char.age_range, gender: char.gender,
        occupation: char.occupation, character_type: char.character_type,
        world_location: char.world_location,
      },
      essence: {
        character_archetype: char.character_archetype, emotional_baseline: char.emotional_baseline,
        core_fear: char.core_fear, at_their_best: char.at_their_best, at_their_worst: char.at_their_worst,
        signature: char.signature,
      },
      desires: {
        surface_want: char.surface_want, real_want: char.real_want,
        what_they_want_from_protagonist: char.what_they_want_from_lala,
        attracted_to: char.attracted_to, how_they_love: char.how_they_love,
        desire_they_wont_admit: char.desire_they_wont_admit,
      },
      moral_profile: {
        moral_code: char.moral_code, fidelity_pattern: char.fidelity_pattern,
        relationship_status: char.relationship_status, committed_to: char.committed_to,
        sexuality: char.sexuality,
      },
      aesthetic_dna: {
        aesthetic: char.aesthetic, color_palette: char.color_palette,
        signature_silhouette: char.signature_silhouette,
        signature_accessories: char.signature_accessories, glam_energy: char.glam_energy,
      },
      voice: {
        speech_pattern: char.speech_pattern, vocabulary_tone: char.vocabulary_tone,
        catchphrases: char.catchphrases, internal_monologue_style: char.internal_monologue_style,
      },
      story: {
        how_they_meet: char.how_they_meet, dynamic: char.dynamic,
        origin_story: char.origin_story, public_persona: char.public_persona,
        private_reality: char.private_reality, arc_role: char.arc_role,
        career_goal: char.career_goal,
      },
      intimate: {
        intimate_eligible: char.intimate_eligible, intimate_style: char.intimate_style,
        intimate_dynamic: char.intimate_dynamic, what_protagonist_feels: char.what_lala_feels,
      },
    };
    res.setHeader('Content-Disposition', `attachment; filename="${char.name.replace(/[^a-zA-Z0-9]/g, '_')}_dossier.json"`);
    res.json(dossier);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { console.warn('[world-studio] extended relationships query error:', err?.message); }

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
      } catch (err) { console.warn('[world-studio] extended relationship update error:', err?.message); }
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
    } catch (err) { console.warn('[world-studio] extended relationship delete error:', err?.message); }

    // Remove from JSONB graph
    const graph = safeJson(char.relationship_graph).filter(r => r.rel_id !== req.params.relId);
    await sequelize.query(
      `UPDATE world_characters SET relationship_graph = :graph, updated_at = NOW() WHERE id = :id`,
      { replacements: { graph: JSON.stringify(graph), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    );

    res.json({ deleted: true, graph });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════
   WORLD LOCATIONS — CRUD for WorldLocation model
   ═══════════════════════════════════════════════════════════ */

// GET /world/locations — list all locations
router.get('/world/locations', optionalAuth, async (req, res) => {
  try {
    const WorldLocation = models.WorldLocation;
    if (!WorldLocation) {
      const rows = await Q(req, 'SELECT * FROM world_locations ORDER BY name ASC LIMIT 200');
      return res.json({ locations: rows });
    }

    // Try rich query with includes, fall back to simple query if columns missing
    try {
      const include = [];
      include.push({
        model: WorldLocation,
        as: 'childLocations',
        attributes: ['id', 'name', 'location_type'],
        required: false,
      });
      if (models.SceneSet) {
        include.push({
          model: models.SceneSet,
          as: 'sceneSets',
          attributes: ['id', 'name', 'scene_type', 'base_still_url', 'generation_status'],
          required: false,
        });
      }
      if (models.WorldEvent) {
        try {
          include.push({
            model: models.WorldEvent,
            as: 'events',
            attributes: ['id', 'name', 'event_type', 'status'],
            required: false,
            limit: 5,
          });
        } catch { /* association may not exist */ }
      }
      if (models.StoryCalendarEvent) {
        try {
          include.push({
            model: models.StoryCalendarEvent,
            as: 'calendarEvents',
            attributes: ['id', 'title', 'event_type', 'start_datetime'],
            required: false,
            limit: 5,
          });
        } catch { /* association may not exist */ }
      }

      // Include resident profiles
      if (models.SocialProfile) {
        try {
          include.push({
            model: models.SocialProfile,
            as: 'residents',
            attributes: ['id', 'handle', 'display_name', 'archetype', 'follower_tier', 'city'],
            where: { deleted_at: null },
            required: false,
            limit: 10,
          });
        } catch { /* association may not exist */ }
      }

      const rows = await WorldLocation.findAll({
        include,
        order: [['name', 'ASC']],
        limit: 200,
      });
      return res.json({ locations: rows });
    } catch (richErr) {
      // Fallback: simple query without includes
      console.warn('WorldLocations rich query failed, falling back:', richErr.message);
      const rows = await WorldLocation.findAll({ order: [['name', 'ASC']], limit: 200 });
      return res.json({ locations: rows });
    }
  } catch (err) { res.json({ locations: [] }); }
});

// POST /world/locations — create a location
router.post('/world/locations', optionalAuth, async (req, res) => {
  try {
    const { name, description, location_type, sensory_details, narrative_role, associated_characters, parent_location_id, metadata, street_address, city, district, coordinates, venue_type, venue_details, property_type, style_guide, floor_plan } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const WorldLocation = models.WorldLocation;
    if (WorldLocation) {
      const loc = await WorldLocation.create({
        name, slug, description,
        location_type: location_type || 'interior',
        sensory_details: sensory_details || {},
        narrative_role, associated_characters: associated_characters || [],
        parent_location_id, metadata: metadata || {},
        street_address: street_address || null,
        city: city || null,
        district: district || null,
        coordinates: coordinates || null,
        venue_type: venue_type || null,
        venue_details: venue_details || null,
        property_type: property_type || null,
        style_guide: style_guide || null,
        floor_plan: floor_plan || null,
      });
      return res.json({ location: loc });
    }
    const id = require('uuid').v4();
    await sequelize.query(
      `INSERT INTO world_locations (id, name, slug, description, location_type, sensory_details, narrative_role, associated_characters, parent_location_id, metadata, created_at, updated_at)
       VALUES (:id, :name, :slug, :desc, :lt, :sd::jsonb, :nr, :ac::jsonb, :plid, :meta::jsonb, NOW(), NOW())`,
      { replacements: { id, name, slug, desc: description || null, lt: location_type || 'interior', sd: JSON.stringify(sensory_details || {}), nr: narrative_role || null, ac: JSON.stringify(associated_characters || []), plid: parent_location_id || null, meta: JSON.stringify(metadata || {}) } }
    );
    res.json({ location: { id, name, slug, description, location_type, sensory_details, narrative_role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /world/locations/:id — update a location
router.put('/world/locations/:id', optionalAuth, async (req, res) => {
  try {
    const allowed = ['name', 'description', 'location_type', 'sensory_details', 'narrative_role', 'associated_characters', 'parent_location_id', 'metadata', 'street_address', 'city', 'district', 'coordinates', 'venue_type', 'venue_details', 'property_type', 'style_guide', 'floor_plan'];
    const WorldLocation = models.WorldLocation;
    if (WorldLocation) {
      const loc = await WorldLocation.findByPk(req.params.id);
      if (!loc) return res.status(404).json({ error: 'Not found' });
      const updates = {};
      for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
      if (updates.name) updates.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await loc.update(updates);
      return res.json({ location: loc });
    }
    res.status(500).json({ error: 'WorldLocation model not available' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /world/locations/:id
router.delete('/world/locations/:id', optionalAuth, async (req, res) => {
  try {
    const WorldLocation = models.WorldLocation;
    if (WorldLocation) {
      const loc = await WorldLocation.findByPk(req.params.id);
      if (!loc) return res.status(404).json({ error: 'Not found' });
      await loc.destroy();
      return res.json({ deleted: true });
    }
    await sequelize.query('DELETE FROM world_locations WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/locations/seed-infrastructure — generate full DREAM city infrastructure
router.post('/world/locations/seed-infrastructure', optionalAuth, async (req, res) => {
  try {
    const WorldLocation = models.WorldLocation;
    if (!WorldLocation) return res.status(500).json({ error: 'WorldLocation model not available' });

    // Full DREAM city infrastructure — cities, districts, venues, properties, landmarks
    const DREAM_INFRA = [
      // ── D: DAZZLE DISTRICT (Fashion & Luxury) ──
      { name: 'Dazzle District', location_type: 'city', city: 'Dazzle District', narrative_role: 'hub', description: 'Fashion capital of the LalaVerse. Couture houses, runway shows, designer studios. Every sidewalk is a runway.', sensory_details: { sight: 'Neon-lit runways reflected in rain-slicked cobblestones', sound: 'Click of heels on marble, camera shutters', smell: 'French perfume mixed with espresso', atmosphere: 'Glamorous and competitive, beauty as currency' } },
      { name: 'Runway Quarter', location_type: 'district', city: 'Dazzle District', district: 'Runway Quarter', description: 'The heart of fashion — where shows happen and deals are made.' },
      { name: 'Boutique Row', location_type: 'street', city: 'Dazzle District', district: 'Runway Quarter', street_address: 'Boutique Row', description: 'High-end shopping street lined with designer boutiques and pop-ups.' },
      { name: 'Atelier Circle', location_type: 'venue', city: 'Dazzle District', district: 'Runway Quarter', street_address: '1 Atelier Circle', venue_type: 'gallery', narrative_role: 'battleground', description: 'The premier fashion show venue. Atelier Circuit shows happen here.', venue_details: { capacity: '500', dress_code: 'Black Tie', price_level: '5', vibe_tags: ['couture', 'exclusive', 'high-stakes'] } },
      { name: 'Dazzle Academy', location_type: 'venue', city: 'Dazzle District', district: 'Runway Quarter', street_address: '15 Academy Boulevard', venue_type: 'school', narrative_role: 'sanctuary', description: 'World\'s top fashion school — atelier workshops, fabric libraries, student runway shows.', sensory_details: { sight: 'Mannequins draped in student work, mood boards', sound: 'Sewing machines whirring', smell: 'Fresh linen, dye chemicals', atmosphere: 'Creative pressure-cooker, mentorship and rivalry' } },
      { name: 'Dazzle House HQ', location_type: 'venue', city: 'Dazzle District', district: 'Runway Quarter', street_address: '100 Couture Tower', venue_type: 'office', description: 'Headquarters of Dazzle House — the most powerful fashion corporation in the LalaVerse.' },
      { name: 'The Style Market', location_type: 'venue', city: 'Dazzle District', street_address: '42 Market Lane', venue_type: 'boutique', description: 'Where street style meets luxury. Emerging designers get discovered here.' },
      { name: 'Lala\'s Penthouse', location_type: 'property', city: 'Dazzle District', district: 'Runway Quarter', street_address: '88 Skyline Drive, PH-1', property_type: 'penthouse', narrative_role: 'sanctuary', description: 'JustAWoman\'s luxury penthouse overlooking the Runway Quarter. Floor-to-ceiling windows with city views.' },

      // ── R: RADIANCE ROW (Beauty & Wellness) ──
      { name: 'Radiance Row', location_type: 'city', city: 'Radiance Row', narrative_role: 'hub', description: 'Beauty & wellness heartland. Skincare labs, salons, beauty schools. Reinvention is the local religion.', sensory_details: { sight: 'Pink-tinged lighting, glass storefronts with gold lettering', sound: 'Gentle spa music, bubbling serums', smell: 'Rose water, shea butter, botanical extracts', atmosphere: 'Curated perfection hiding fierce competition' } },
      { name: 'Salon Strip', location_type: 'street', city: 'Radiance Row', street_address: 'Salon Strip', description: 'The most famous beauty street — every salon, lash studio, and nail bar worth knowing.' },
      { name: 'Glow Labs HQ', location_type: 'venue', city: 'Radiance Row', street_address: '200 Luminance Plaza', venue_type: 'office', description: 'Headquarters of Glow Labs — skincare breakthroughs and viral beauty products.' },
      { name: 'Radiance Institute', location_type: 'venue', city: 'Radiance Row', street_address: '50 Glow Academy Way', venue_type: 'school', narrative_role: 'sanctuary', description: 'Most prestigious beauty academy. Graduates dominate Glow Week.', sensory_details: { sight: 'Chemical beakers with pink liquids, skin scan monitors', sound: 'Centrifuges humming', smell: 'Essential oils, lab-grade chemicals', atmosphere: 'Where art meets chemistry' } },
      { name: 'The Glow Spa', location_type: 'venue', city: 'Radiance Row', street_address: '77 Serenity Terrace', venue_type: 'spa', narrative_role: 'sanctuary', description: 'Ultra-luxury wellness retreat. Where influencers recover between scandals.', venue_details: { price_level: '5', dress_code: 'Resort Wear', vibe_tags: ['wellness', 'luxury', 'retreat'] } },

      // ── E: ECHO PARK (Entertainment & Nightlife) ──
      { name: 'Echo Park', location_type: 'city', city: 'Echo Park', narrative_role: 'hub', description: 'Entertainment & nightlife hub. Music studios, comedy clubs, creator houses. Something here becomes a meme by morning.', sensory_details: { sight: 'Giant LED billboards, red carpet flash photography', sound: 'Bass drops, crowd cheers, camera drones', smell: 'Fog machine haze, champagne', atmosphere: 'Electric and relentless, fame as oxygen' } },
      { name: 'Music Row', location_type: 'street', city: 'Echo Park', street_address: 'Music Row', description: 'Recording studios, music venues, and producer offices line both sides.' },
      { name: 'Club Neon', location_type: 'venue', city: 'Echo Park', street_address: '9 Neon Boulevard', venue_type: 'club', narrative_role: 'battleground', description: 'The nightclub where careers are made and destroyed. The Nightlife Queen\'s domain.', venue_details: { hours: '10PM - 4AM', capacity: '800', dress_code: 'Trendy/Upscale', price_level: '4', vibe_tags: ['nightlife', 'exclusive', 'VIP'] } },
      { name: 'Nova Studios', location_type: 'venue', city: 'Echo Park', street_address: '300 Soundstage Drive', venue_type: 'recording_studio', narrative_role: 'battleground', description: 'Major entertainment production studio — sound stages, editing bays, content creation.', sensory_details: { sight: 'Soundstage lights, green screens', sound: 'Director calls, playback speakers', atmosphere: 'High stakes, magic when it works' } },
      { name: 'The Comedy Cellar', location_type: 'venue', city: 'Echo Park', street_address: '21 Laugh Lane, Basement', venue_type: 'theater', description: 'Underground comedy venue. The Viral Comedian got her start here.' },

      // ── A: ASCENT TOWER (Tech & Innovation) ──
      { name: 'Ascent Tower', location_type: 'city', city: 'Ascent Tower', narrative_role: 'hub', description: 'Tech & innovation district. Digital platforms, creator economy tools, startups. Building the tools everyone uses.', sensory_details: { sight: 'Glass towers, holographic pitch decks', sound: 'Keyboard clicks, startup pitch bells', smell: 'New electronics, matcha lattes', atmosphere: 'Optimistic futurism, disruption worship' } },
      { name: 'Innovation Hub', location_type: 'venue', city: 'Ascent Tower', street_address: '1 Founders Circle', venue_type: 'coworking', description: 'Open-plan innovation space where platform founders and engineers collaborate.' },
      { name: 'Ascent Tech Institute', location_type: 'venue', city: 'Ascent Tower', street_address: '500 Code Campus', venue_type: 'school', narrative_role: 'sanctuary', description: 'Technology and innovation school. Many LalaVerse platform founders came from here.' },
      { name: 'Dream Market Collective', location_type: 'venue', city: 'Ascent Tower', street_address: '250 Commerce Spire', venue_type: 'office', narrative_role: 'crossroads', description: 'The platform creators use to sell. Brand deal nexus, negotiation suites.', sensory_details: { sight: 'Projector pitch decks, contract paperwork', sound: 'Quiet conference room tension', atmosphere: 'Where art sells its soul — or makes its fortune' } },
      { name: 'Trend Summit Arena', location_type: 'venue', city: 'Ascent Tower', street_address: '10 Vision Plaza', venue_type: 'theater', description: 'Annual Trend Summit happens here. Where the future of creator economy is debated.' },

      // ── M: MAVERICK HARBOR (Creator Economy & Counter-culture) ──
      { name: 'Maverick Harbor', location_type: 'city', city: 'Maverick Harbor', narrative_role: 'hub', description: 'Creator economy & counter-culture. Content houses, podcast networks, underground scenes. Fame is suspicious here.', sensory_details: { sight: 'Ring lights in windows, pastel facades, warehouse murals', sound: '"Hey guys welcome back", podcast intros', smell: 'Fresh merch packaging, coffee', atmosphere: 'Collaborative, entrepreneurial, anti-algorithm' } },
      { name: 'Creator Studios Row', location_type: 'street', city: 'Maverick Harbor', street_address: 'Creator Studios Row', description: 'Content creator studios, collab spaces, and editing suites.' },
      { name: 'Podcast Row', location_type: 'district', city: 'Maverick Harbor', description: 'Every major podcast network and audio studio in the LalaVerse.' },
      { name: 'The Underground', location_type: 'venue', city: 'Maverick Harbor', district: 'Podcast Row', street_address: '13 Warehouse Alley', venue_type: 'bar', narrative_role: 'haven', description: 'Off-grid speakeasy and gallery. Where people drop the performance.', sensory_details: { sight: 'Dim amber lighting, graffiti art, exposed brick', sound: 'Low bass, whispered conversations, jazz', smell: 'Candle wax, whiskey, oil paint', atmosphere: 'Raw and real' }, venue_details: { hours: '8PM - 3AM', dress_code: 'Come as you are', price_level: '3', vibe_tags: ['underground', 'authentic', 'creative'] } },
      { name: 'Harbor Docks', location_type: 'landmark', city: 'Maverick Harbor', street_address: 'Harbor Docks Marina', description: 'The waterfront where Creator Cruise departures happen. Marina with yachts and houseboats.' },
      { name: 'The Creator Conservatory', location_type: 'venue', city: 'Maverick Harbor', street_address: '75 Content Campus', venue_type: 'school', narrative_role: 'sanctuary', description: 'Content creation and media school. The school that legitimized being a creator.' },
      { name: 'Pulse Media Network', location_type: 'venue', city: 'Maverick Harbor', street_address: '400 Talent Tower', venue_type: 'office', description: 'Talent management and influencer partnerships HQ. The middleman with enormous invisible power.' },
    ];

    let created = 0;
    for (const item of DREAM_INFRA) {
      const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const exists = await WorldLocation.findOne({ where: { slug } }).catch(() => null);
      if (exists) continue;
      await WorldLocation.create({ ...item, slug });
      created++;
    }

    res.json({ success: true, created, total: DREAM_INFRA.length, message: `Seeded ${created} DREAM locations across 5 cities` });
  } catch (err) {
    console.error('Seed infrastructure error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   WORLD STATE — CRUD for WorldStateSnapshot + WorldTimelineEvent
   ═══════════════════════════════════════════════════════════ */

// GET /world/state/snapshots
router.get('/world/state/snapshots', optionalAuth, async (req, res) => {
  try {
    const WSS = models.WorldStateSnapshot;
    if (!WSS) return res.json({ snapshots: [] });
    const rows = await WSS.findAll({ order: [['timeline_position', 'DESC'], ['created_at', 'DESC']], limit: 50 });
    res.json({ snapshots: rows });
  } catch (err) { res.json({ snapshots: [] }); }
});

// POST /world/state/snapshots
router.post('/world/state/snapshots', optionalAuth, async (req, res) => {
  try {
    const { snapshot_label, book_id, chapter_id, active_threads, world_facts, character_states, relationship_states, timeline_position } = req.body;
    if (!snapshot_label) return res.status(400).json({ error: 'snapshot_label required' });
    const WSS = models.WorldStateSnapshot;
    if (!WSS) return res.status(500).json({ error: 'Model not available' });
    const snap = await WSS.create({ snapshot_label, book_id, chapter_id, active_threads: active_threads || [], world_facts: world_facts || [], character_states: character_states || {}, relationship_states: relationship_states || {}, timeline_position: timeline_position || 0 });
    res.json({ snapshot: snap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /world/state/snapshots/:id
router.put('/world/state/snapshots/:id', optionalAuth, async (req, res) => {
  try {
    const WSS = models.WorldStateSnapshot;
    if (!WSS) return res.status(500).json({ error: 'Model not available' });
    const snap = await WSS.findByPk(req.params.id);
    if (!snap) return res.status(404).json({ error: 'Not found' });
    const allowed = ['snapshot_label', 'book_id', 'chapter_id', 'active_threads', 'world_facts', 'character_states', 'relationship_states', 'timeline_position'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await snap.update(updates);
    res.json({ snapshot: snap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /world/state/snapshots/:id
router.delete('/world/state/snapshots/:id', optionalAuth, async (req, res) => {
  try {
    const WSS = models.WorldStateSnapshot;
    if (!WSS) return res.status(500).json({ error: 'Model not available' });
    const snap = await WSS.findByPk(req.params.id);
    if (!snap) return res.status(404).json({ error: 'Not found' });
    await snap.destroy();
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /world/state/timeline — timeline events
router.get('/world/state/timeline', optionalAuth, async (req, res) => {
  try {
    const WTE = models.WorldTimelineEvent;
    if (!WTE) return res.json({ events: [] });
    const where = {};
    if (req.query.is_canon === 'true') where.is_canon = true;
    if (req.query.event_type) where.event_type = req.query.event_type;
    const rows = await WTE.findAll({ where, order: [['sort_order', 'DESC'], ['created_at', 'DESC']], limit: 100, include: models.WorldLocation ? [{ model: models.WorldLocation, as: 'location', attributes: ['id', 'name', 'location_type'] }] : [] });
    res.json({ events: rows });
  } catch (err) { res.json({ events: [] }); }
});

// POST /world/state/timeline — create timeline event
router.post('/world/state/timeline', optionalAuth, async (req, res) => {
  try {
    const { event_name, event_description, story_date, sort_order, event_type, characters_involved, location_id, impact_level, consequences, is_canon } = req.body;
    if (!event_name) return res.status(400).json({ error: 'event_name required' });
    const WTE = models.WorldTimelineEvent;
    if (!WTE) return res.status(500).json({ error: 'Model not available' });
    const evt = await WTE.create({ event_name, event_description, story_date, sort_order: sort_order || 0, event_type: event_type || 'plot', characters_involved: characters_involved || [], location_id, impact_level: impact_level || 'minor', consequences: consequences || [], is_canon: is_canon !== false });

    // #10 World → Calendar sync: auto-create StoryCalendarEvent if model available
    try {
      const SCE = models.StoryCalendarEvent;
      if (SCE) {
        await SCE.create({ title: event_name, event_type: event_type === 'world' ? 'world_event' : event_type === 'character' ? 'character_event' : 'story_event', start_datetime: story_date ? new Date(story_date) : new Date(), what_world_knows: event_description || '', what_only_we_know: (consequences || []).join('; '), logged_by: 'world_state' });
      }
    } catch (_) { /* calendar sync is best-effort */ }

    res.json({ event: evt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /world/state/timeline/:id
router.put('/world/state/timeline/:id', optionalAuth, async (req, res) => {
  try {
    const WTE = models.WorldTimelineEvent;
    if (!WTE) return res.status(500).json({ error: 'Model not available' });
    const evt = await WTE.findByPk(req.params.id);
    if (!evt) return res.status(404).json({ error: 'Not found' });
    const allowed = ['event_name', 'event_description', 'story_date', 'sort_order', 'event_type', 'characters_involved', 'location_id', 'impact_level', 'consequences', 'is_canon'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await evt.update(updates);
    res.json({ event: evt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /world/state/timeline/:id
router.delete('/world/state/timeline/:id', optionalAuth, async (req, res) => {
  try {
    const WTE = models.WorldTimelineEvent;
    if (!WTE) return res.status(500).json({ error: 'Model not available' });
    const evt = await WTE.findByPk(req.params.id);
    if (!evt) return res.status(404).json({ error: 'Not found' });
    await evt.destroy();
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════
   TENSION SCANNER — Find high-tension character pairs for story generation
   ═══════════════════════════════════════════════════════════ */

// GET /world/tension-scanner — character pairs with unresolved tension
router.get('/world/tension-scanner', optionalAuth, async (req, res) => {
  try {
    const rows = await Q(req,
      `SELECT c.id, c.display_name, c.character_type, c.status, c.relationship_graph, c.world_tag
       FROM world_characters c WHERE c.status = 'active'
       ORDER BY c.display_name ASC`
    );
    const pairs = [];
    const seen = new Set();
    for (const char of rows) {
      const graph = safeJson(char.relationship_graph);
      for (const rel of graph) {
        const tension = rel.tension_state || rel.tension_level || 'Stable';
        const isHigh = ['Simmering', 'Explosive', 'Unresolved', 'High', 'high', 'simmering', 'explosive'].includes(tension);
        if (!isHigh) continue;
        const pairKey = [char.id, rel.related_character_id || rel.target_id].sort().join('|');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        pairs.push({
          char_a: { id: char.id, name: char.display_name, world_tag: char.world_tag },
          char_b: { id: rel.related_character_id || rel.target_id, name: rel.related_character_name || rel.target_name },
          tension_state: tension,
          relationship_type: rel.relationship_type || 'unknown',
          conflict_summary: rel.conflict_summary || rel.history_summary || '',
          romantic: !!rel.is_romantic,
        });
      }
    }
    res.json({ pairs, count: pairs.length });
  } catch (err) { res.json({ pairs: [], count: 0 }); }
});

// POST /world/create-story-task — generate a story task from a world character
router.post('/world/create-story-task', optionalAuth, async (req, res) => {
  try {
    const { character_id } = req.body;
    if (!character_id) return res.status(400).json({ error: 'character_id required' });
    const [char] = await Q(req,
      `SELECT id, display_name, character_key, character_type, world_tag, surface_want, real_want, arc_role, origin_story, relationship_graph, how_they_meet, dynamic
       FROM world_characters WHERE id = :id`,
      { replacements: { id: character_id } }
    );
    if (!char) return res.status(404).json({ error: 'Character not found' });
    const graph = safeJson(char.relationship_graph);
    const keyRels = graph.slice(0, 3).map(r => `${r.related_character_name || 'unknown'} (${r.relationship_type || 'connected'})`).join(', ');
    const task = {
      title: `${char.display_name} — ${char.arc_role || char.character_type || 'Character'} Arc`,
      description: [char.origin_story, char.how_they_meet, char.dynamic].filter(Boolean).join(' ').slice(0, 500),
      story_type: char.character_type === 'protagonist' ? 'character_arc' : 'character_development',
      world: char.world_tag || 'book-1',
      characters: [char.character_key || char.display_name?.toLowerCase().replace(/\s+/g, '')],
      surface_want: char.surface_want || '',
      real_want: char.real_want || '',
      key_relationships: keyRels,
      source: 'world_studio',
    };
    res.json({ task });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /world/create-tension-proposal — generate story proposal from tension pair
router.post('/world/create-tension-proposal', optionalAuth, async (req, res) => {
  try {
    const { char_a_name, char_b_name, tension_state, relationship_type, conflict_summary, romantic } = req.body;
    if (!char_a_name || !char_b_name) return res.status(400).json({ error: 'char_a_name and char_b_name required' });
    const proposal = {
      scene_title: `${char_a_name} × ${char_b_name} — ${tension_state || 'Tension'} ${romantic ? '♡' : ''}`,
      situation: conflict_summary || `Unresolved ${tension_state || 'tension'} between ${char_a_name} and ${char_b_name}`,
      emotional_stakes: romantic ? 'Desire vs. safety, vulnerability' : 'Power, trust, or loyalty at stake',
      internal_conflict: `Both characters want different things from this ${relationship_type || 'relationship'}`,
      characters: [char_a_name.toLowerCase().replace(/\s+/g, ''), char_b_name.toLowerCase().replace(/\s+/g, '')],
      tone: romantic ? 'intimate' : 'tense',
      scene_type: romantic ? 'intimate_encounter' : 'confrontation',
      source: 'tension_scanner',
    };
    res.json({ proposal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /world/context-summary — auto-enrich world context for story generation
router.get('/world/context-summary', optionalAuth, async (req, res) => {
  try {
    const WSS = models.WorldStateSnapshot;
    const WL = models.WorldLocation;

    // Latest snapshot facts
    let facts = [], threads = [], snapshotLabel = '';
    if (WSS) {
      const snap = await WSS.findOne({ order: [['timeline_position', 'DESC'], ['created_at', 'DESC']] });
      if (snap) {
        facts = Array.isArray(snap.world_facts) ? snap.world_facts.slice(0, 8) : [];
        threads = Array.isArray(snap.active_threads) ? snap.active_threads.slice(0, 6) : [];
        snapshotLabel = snap.snapshot_label;
      }
    }

    // Location names for picker
    let locations = [];
    if (WL) {
      locations = await WL.findAll({ attributes: ['id', 'name', 'location_type', 'narrative_role'], order: [['name', 'ASC']], limit: 50 });
    }

    // Active thread count from StoryThread
    let activeThreadCount = 0;
    try {
      const ST = models.StoryThread;
      if (ST) activeThreadCount = await ST.count({ where: { status: 'active' } });
    } catch (err) { console.warn('[world-studio] thread count error:', err?.message); }

    // Tension pair count
    let tensionCount = 0;
    try {
      const chars = await Q(req, `SELECT relationship_graph FROM world_characters WHERE status = 'active'`);
      for (const c of chars) {
        const graph = safeJson(c.relationship_graph);
        for (const r of graph) {
          const t = r.tension_state || r.tension_level || 'Stable';
          if (['Simmering', 'Explosive', 'Unresolved', 'High', 'high', 'simmering', 'explosive'].includes(t)) tensionCount++;
        }
      }
    } catch (err) { console.warn('[world-studio] tension count error:', err?.message); }

    res.json({ facts, threads, snapshotLabel, locations, activeThreadCount, tensionCount: Math.floor(tensionCount / 2) });
  } catch (err) { res.json({ facts: [], threads: [], locations: [], activeThreadCount: 0, tensionCount: 0 }); }
});

/* ═══════════════════════════════════════════════════════════
   WORLD MAP — Upload custom map image for DREAM map
   ═══════════════════════════════════════════════════════════ */

const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const mapS3 = new S3Client({ region: AWS_REGION });
const mapUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});

// POST /world/map/upload — upload custom DREAM map image
router.post('/world/map/upload', optionalAuth, mapUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file provided' });
    if (!S3_BUCKET) return res.status(500).json({ success: false, error: 'S3 bucket not configured — set S3_PRIMARY_BUCKET env var' });

    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const s3Key = `world-map/dream-map-${Date.now()}.${ext}`;

    await mapS3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      CacheControl: 'max-age=31536000',
    }));

    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    // Store URL in page_content using the model
    let dbSaved = false;
    try {
      const PageContent = models.PageContent;
      if (PageContent) {
        await PageContent.upsert(
          { page_name: 'world_foundation', constant_key: 'MAP_IMAGE_URL', data: url },
          { conflictFields: ['page_name', 'constant_key'], returning: true }
        );
        dbSaved = true;
      }
    } catch (dbErr) {
      console.warn('[world-map] page_content save failed:', dbErr?.message);
    }

    res.json({ success: true, url, db_saved: dbSaved, message: 'Map image uploaded' });
  } catch (err) {
    console.error('[world-map] Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/map — get current map image URL
router.get('/world/map', optionalAuth, async (req, res) => {
  try {
    const PageContent = models.PageContent;
    if (!PageContent) return res.json({ url: null });
    const row = await PageContent.findOne({ where: { page_name: 'world_foundation', constant_key: 'MAP_IMAGE_URL' } });
    res.json({ url: row?.data || null });
  } catch (err) {
    console.warn('[world-map] GET map failed:', err?.message);
    res.json({ url: null });
  }
});

// GET /world/map/positions — get saved city positions
router.get('/world/map/positions', optionalAuth, async (req, res) => {
  try {
    const PageContent = models.PageContent;
    if (!PageContent) return res.json({ positions: {} });
    const row = await PageContent.findOne({ where: { page_name: 'world_foundation', constant_key: 'MAP_CITY_POSITIONS' } });
    res.json({ positions: row?.data || {} });
  } catch (err) {
    console.warn('[world-map] GET positions failed:', err?.message);
    res.json({ positions: {} });
  }
});

// PUT /world/map/positions — save city positions
router.put('/world/map/positions', optionalAuth, async (req, res) => {
  try {
    const { positions } = req.body;
    if (!positions || typeof positions !== 'object') return res.status(400).json({ error: 'positions required' });
    const PageContent = models.PageContent;
    if (!PageContent) return res.status(500).json({ error: 'PageContent model not available' });
    await PageContent.upsert(
      { page_name: 'world_foundation', constant_key: 'MAP_CITY_POSITIONS', data: positions },
      { conflictFields: ['page_name', 'constant_key'], returning: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[world-map] PUT positions failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
