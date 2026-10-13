'use strict';

/**
 * Voice Profiles (Task #2967; The Pulse spec §7;
 * docs/reads/2026-10-12-pulse-posting-read.md §1-2). Evoni, 2026-10-12:
 * characters at depth_level active or alive post; voices live in
 * pulse_voices.
 *
 *   BANNED_PHRASES            the shared list of AI-sounding phrases no
 *                             post may use; findBanned(text) finds them
 *   eligible(db, showId, { stage })  revealed characters at the stage
 *                             (active: Active or Alive; alive: Alive) with
 *                             a Feed profile, each with their voice or none
 *   aliveProfiles(db, ids)    which of these Feed profiles are Alive
 *   voiceSource(character, profile)  the public face a voice is built
 *                             from; sourceHash() fingerprints it
 *   buildVoice(db, characterId)  one Haiku call: the habits, saved
 *   normalizeHabits(raw)      the habits' shape, cleaned and capped
 *   addExample / removeExample   Evoni's edits and pinned posts
 *
 * Stages (Evoni, 2026-10-12; docs/reads/2026-10-12-pulse-decisions-read.md
 * §1): an Active character gets a Voice Profile and can post; an Alive one
 * also takes part in ongoing conversations (DMs), relationships (closeness
 * from the social world) and event reactions.
 *
 * A voice is how a character talks in public. It is built from the public
 * face only (the mask, public persona, voice signature, posting voice).
 * Wounds, author-only notes and Living State never go into it; Living State
 * shapes what they post, as private context, when a post is drafted.
 */

const crypto = require('crypto');

const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];
const ACTIVE_STAGES = ['active', 'alive'];   // a voice, and posting
const ALIVE_STAGES = ['alive'];             // also DMs, closeness, event reactions
const POSTING_STAGES = ACTIVE_STAGES;
const stagesFor = (stage) => (stage === 'alive' ? ALIVE_STAGES : ACTIVE_STAGES);
const MAX_EXAMPLES = 20;
const MAX_TEXT = 600;

/** Phrases that read as AI-written: no draft may use them (the gate checks, #2969). */
const BANNED_PHRASES = [
  'delve', 'delving', 'tapestry', 'a testament to', 'testament to', 'in today\'s fast-paced', 'fast-paced world',
  'it\'s important to note', 'it is important to note', 'navigate the complexities', 'navigating the',
  'embark on a journey', 'embarking on', 'a journey of', 'unleash', 'unlock the', 'elevate your',
  'game-changer', 'game changer', 'let\'s dive in', 'dive into', 'deep dive', 'in the realm of', 'realm of',
  'a symphony of', 'symphony of', 'nestled', 'vibrant tapestry', 'seamlessly', 'seamless', 'resonate with',
  'resonates with', 'i\'m thrilled to', 'thrilled to announce', 'excited to share', 'humbled and honored',
  'at the end of the day', 'in conclusion', 'furthermore', 'moreover', 'ever-evolving', 'ever-changing landscape',
  'landscape of', 'stands as a', 'serves as a reminder', 'a reminder that', 'whether you\'re', 'not just a',
  'more than just', 'treasure trove', 'beacon of', 'labyrinth', 'multifaceted',
  'pivotal', 'paramount', 'meticulous', 'meticulously', 'bustling', 'captivating', 'breathtaking',
  'unparalleled', 'kaleidoscope', 'intricate', 'boundless', 'transformative', 'holistic',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED_RE = BANNED_PHRASES.map((p) => [p, new RegExp(`(^|[^a-z])${escape(p)}(?![a-z])`, 'i')]);

/** The banned phrases in a text, in list order; [] when none. */
function findBanned(text) {
  if (typeof text !== 'string' || !text) return [];
  const flat = text.replace(/[‘’]/g, '\'');
  return BANNED_RE.filter(([, re]) => re.test(flat)).map(([p]) => p);
}

// The public face a voice is built from: never wounds, author-only notes or Living State.
const CHARACTER_FIELDS = ['display_name', 'selected_name', 'character_key', 'mask_persona', 'the_mask', 'public_persona',
  'signature_trait', 'social_presence', 'character_archetype', 'voice_signature', 'demographic_voice_signature',
  'platform_primary', 'years_posting', 'first_language', 'current_city', 'age', 'pronouns'];
const PROFILE_FIELDS = ['handle', 'display_name', 'platform', 'archetype', 'posting_voice', 'vibe_sentence', 'content_persona', 'follower_tier'];

const filled = (v) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim())
  && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

/** The public face, as { character, profile }, with empty fields left out. */
function voiceSource(character = {}, profile = {}) {
  const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => filled(obj?.[f])).map((f) => [f, obj[f]]));
  return { character: pick(character, CHARACTER_FIELDS), profile: pick(profile, PROFILE_FIELDS) };
}

/** A stable fingerprint of the public face: a changed face means the voice needs a rebuild. */
function sourceHash(source) {
  const stable = (v) => (Array.isArray(v) ? v.map(stable)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
  return crypto.createHash('sha256').update(JSON.stringify(stable(source))).digest('hex');
}

const CASES = ['lowercase', 'sentence', 'mixed', 'caps for emphasis'];
const EMOJI = ['never', 'rarely', 'sometimes', 'often'];
const LENGTHS = ['short', 'medium', 'long'];
const TEMPERAMENTS = ['oversharer', 'regular', 'lurker'];
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const list = (v, n, max = 80) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const oneOf = (v, allowed, fallback) => (allowed.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : fallback);

/**
 * The habits' shape: { case, punctuation, emoji: { use, favorites },
 * sentence_length, temperament, topics, never_says, signature_phrases }. Unknown keys
 * are dropped, lists capped, and a signature phrase that is banned removed.
 */
function normalizeHabits(raw = {}) {
  const emoji = raw.emoji && typeof raw.emoji === 'object' ? raw.emoji : { use: raw.emoji };
  return {
    case: oneOf(raw.case, CASES, 'sentence'),
    punctuation: str(raw.punctuation),
    emoji: { use: oneOf(emoji.use, EMOJI, 'rarely'), favorites: list(emoji.favorites, 8, 16) },
    sentence_length: oneOf(raw.sentence_length, LENGTHS, 'short'),
    // How readily they post (Task #2970): an oversharer posts about anything, a lurker mostly comments.
    temperament: oneOf(raw.temperament, TEMPERAMENTS, 'regular'),
    topics: list(raw.topics, 10),
    never_says: list(raw.never_says, 15),
    signature_phrases: list(raw.signature_phrases, 8).filter((p) => findBanned(p).length === 0),
  };
}

class VoiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** The character and its Feed profile, or a VoiceError. */
async function loadCharacter(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new VoiceError(404, 'Character not found');
  if (!POSTING_STAGES.includes(character.depth_level)) {
    throw new VoiceError(409, 'Only characters at the active or alive stage post on The Pulse.');
  }
  if (!character.feed_profile_id) throw new VoiceError(409, 'This character has no Feed profile to post from.');
  const [[profile]] = await db.sequelize.query(
    `SELECT ${['id', ...PROFILE_FIELDS].map((f) => (f === 'follower_tier' ? 'follower_tier::text AS follower_tier' : f)).join(', ')}
       FROM social_profiles WHERE id = :id AND deleted_at IS NULL`, { replacements: { id: character.feed_profile_id } });
  if (!profile) throw new VoiceError(409, 'This character\'s Feed profile is gone.');
  return { character, profile };
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function buildPrompt(source) {
  return `You describe how a character writes on a social network, as concrete habits a writer can copy.
Use only this public face of the character. Do not invent private feelings.

${JSON.stringify(source, null, 2)}

Answer with JSON only, in this shape:
{
  "case": "lowercase" | "sentence" | "mixed" | "caps for emphasis",
  "punctuation": "one line: e.g. no full stops, lots of ellipses, double exclamation marks",
  "emoji": { "use": "never" | "rarely" | "sometimes" | "often", "favorites": ["up to 8 emoji"] },
  "sentence_length": "short" | "medium" | "long",
  "temperament": "oversharer" | "regular" | "lurker" (how readily they post: an oversharer posts about everything, a lurker mostly watches and comments),
  "topics": ["up to 10 things they post about"],
  "never_says": ["up to 15 words or phrases they would never use"],
  "signature_phrases": ["up to 8 phrases or slang they really use"]
}
Never use these phrases anywhere: ${BANNED_PHRASES.slice(0, 30).join(', ')}.`;
}

/** Builds (or rebuilds) a character's voice: one AI call, then saved. Examples are kept. */
async function buildVoice(db, characterId) {
  const { character, profile } = await loadCharacter(db, characterId);
  const source = voiceSource(character.toJSON(), profile);
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 800, messages: [{ role: 'user', content: buildPrompt(source) }] });
      break;
    } catch (modelErr) {
      console.warn(`[PulseVoices] building with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (parseErr) {
    console.error('[PulseVoices] could not read the built voice:', parseErr.message);
    throw new VoiceError(502, 'The voice came back in a form that could not be read. Try again.');
  }
  const values = {
    social_profile_id: profile.id,
    habits_json: normalizeHabits(parsed),
    source_hash: sourceHash(source),
    status: 'built',
    built_at: new Date(),
    // A rebuilt voice is a new voice: it waits for Evoni's approval again (Task #3029).
    approved_at: null,
    approved_by: null,
  };
  const existing = await db.PulseVoice.findOne({ where: { registry_character_id: character.id } });
  if (existing) return existing.update(values);
  return db.PulseVoice.create({ registry_character_id: character.id, examples_json: [], ...values });
}

/**
 * Evoni's approval (Task #3029; Evoni, 2026-10-12: "Approve their voice
 * before automated posting starts"). Her edits keep it; a rebuild clears it.
 * Only the worker's jobs (ambient, event, comment, storyline) need it;
 * drafting she starts herself does not.
 */
const isApproved = (voice) => Boolean(voice && voice.approved_at);

async function approveVoice(voice, by = null) {
  await voice.update({ approved_at: new Date(), approved_by: by ? String(by).slice(0, 255) : null });
  return voice;
}

async function unapproveVoice(voice) {
  await voice.update({ approved_at: null, approved_by: null });
  return voice;
}

/**
 * Why the worker may not draft for this character now, or null when it may:
 * no voice, or a voice not approved. Checked again when a job runs, as an
 * approval can be withdrawn after the job was queued.
 */
async function automationBlocker(db, characterId) {
  const voice = await db.PulseVoice.findOne({ where: { registry_character_id: characterId } });
  if (!voice) return 'No Voice Profile yet.';
  if (!isApproved(voice)) {
    const character = await db.RegistryCharacter.findByPk(characterId, { attributes: ['display_name', 'selected_name'] });
    const name = character ? (character.selected_name || character.display_name) : 'This character';
    return `${name}'s voice is waiting for approval in Admin › The Pulse › Voices.`;
  }
  return null;
}

/** Does the voice need a rebuild: none yet, or the public face changed since it was built. */
function needsRebuild(voice, source) {
  return !voice || voice.source_hash !== sourceHash(source);
}

/**
 * The show's posting characters: active/alive, with a Feed profile, and not
 * hidden from Lala at the story moment `at` (default the present; services/pulseReveals.js).
 * Each with their voice (or null) and whether it needs a rebuild.
 */
async function eligible(db, showId, { at, stage = 'active' } = {}) {
  const { sequelize } = db;
  const [rows] = await sequelize.query(
    `SELECT rc.id FROM registry_characters rc JOIN character_registries cr ON cr.id = rc.registry_id
      WHERE cr.show_id = :showId AND rc.deleted_at IS NULL AND cr.deleted_at IS NULL
        AND rc.depth_level::text IN (:stages) AND rc.feed_profile_id IS NOT NULL
      ORDER BY rc.display_name`, { replacements: { showId, stages: stagesFor(stage) } });
  if (!rows.length) return [];
  const characters = await db.RegistryCharacter.findAll({ where: { id: rows.map((r) => r.id) } });
  const profileIds = characters.map((c) => c.feed_profile_id);
  const [profiles] = await sequelize.query(
    `SELECT ${['id', ...PROFILE_FIELDS].map((f) => (f === 'follower_tier' ? 'follower_tier::text AS follower_tier' : f)).join(', ')}
       FROM social_profiles WHERE id IN (:profileIds) AND deleted_at IS NULL`, { replacements: { profileIds } });
  const profileOf = new Map(profiles.map((p) => [Number(p.id), p]));
  const moment = Number.isInteger(at) ? at : await require('./storyClock').presentOrder(db, showId);
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const { hiddenProfiles } = await require('./pulseReveals').revealsAt(db, showId, moment, { lalaProfileId: lalaId });
  const voices = await db.PulseVoice.findAll({ where: { registry_character_id: characters.map((c) => c.id) } });
  const voiceOf = new Map(voices.map((v) => [v.registry_character_id, v]));
  const byName = new Map(rows.map((r, i) => [r.id, i]));
  return characters
    .filter((c) => profileOf.has(Number(c.feed_profile_id)) && !hiddenProfiles.has(Number(c.feed_profile_id)))
    .sort((a, b) => byName.get(a.id) - byName.get(b.id))
    .map((c) => {
      const profile = profileOf.get(Number(c.feed_profile_id));
      const voice = voiceOf.get(c.id) || null;
      return { character: c, profile, voice, needs_rebuild: needsRebuild(voice, voiceSource(c.toJSON(), profile)) };
    });
}

/** The Feed profiles among `profileIds` whose registry character is Alive, as a Set of numbers. */
async function aliveProfiles(db, profileIds) {
  const ids = [...new Set((profileIds || []).map(Number).filter(Number.isInteger))];
  if (!ids.length) return new Set();
  const [rows] = await db.sequelize.query(
    `SELECT DISTINCT feed_profile_id FROM registry_characters
      WHERE feed_profile_id IN (:ids) AND depth_level::text IN (:stages) AND deleted_at IS NULL`,
    { replacements: { ids, stages: ALIVE_STAGES } });
  return new Set(rows.map((r) => Number(r.feed_profile_id)));
}

/** Adds an example (kind pinned or edit) to a voice, newest first, keeping MAX_EXAMPLES. */
async function addExample(voice, { text, kind = 'pinned', postId = null, by = null } = {}) {
  const clean = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : '';
  if (!clean) throw new VoiceError(400, 'An example needs its text.');
  if (!['pinned', 'edit'].includes(kind)) throw new VoiceError(400, 'kind must be pinned or edit.');
  const examples = Array.isArray(voice.examples_json) ? voice.examples_json : [];
  if (postId && examples.some((e) => e.post_id === postId)) throw new VoiceError(409, 'That post is already an example.');
  const example = { id: crypto.randomUUID(), text: clean, kind, post_id: postId, added_by: by, added_at: new Date().toISOString() };
  await voice.update({ examples_json: [example, ...examples].slice(0, MAX_EXAMPLES) });
  return example;
}

async function removeExample(voice, exampleId) {
  const examples = Array.isArray(voice.examples_json) ? voice.examples_json : [];
  const next = examples.filter((e) => e.id !== exampleId);
  if (next.length === examples.length) throw new VoiceError(404, 'Example not found');
  await voice.update({ examples_json: next });
}

module.exports = {
  BANNED_PHRASES, POSTING_STAGES, ACTIVE_STAGES, ALIVE_STAGES, MAX_EXAMPLES, TEMPERAMENTS, aliveProfiles,
  findBanned, voiceSource, sourceHash, normalizeHabits, needsRebuild, eligible, buildVoice, addExample, removeExample, VoiceError,
  isApproved, approveVoice, unapproveVoice, automationBlocker,
};
