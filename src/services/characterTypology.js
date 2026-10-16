'use strict';

/**
 * A character's typology seed (Character Consistency Engine step 6a; the
 * spec's Piece 3: "grow the psychological layers from a shared root instead
 * of generating each independently"; Evoni, 2026-10-16: "yes start step 6").
 *
 *   registry_characters.typology  { enneagram: { type: 1-9, wing: 1-9|null },
 *                                   mbti: 'INFJ'|null, why, set_by, set_at }
 *
 * The Enneagram type is the primary seed (wound-based; it maps onto the
 * want / wound / mask architecture). MBTI is an optional dial that tunes
 * how they phrase things, never who they are. `why` records the reasoning
 * (the spec's #9), so a character who feels off can be checked against it.
 *
 *   ENNEAGRAM, MBTI_TYPES
 *   normalizeTypology(body, { by })   the stored shape, or a TypologyError (400)
 *   typologyLabel(typology)           "Type 3w4, The Achiever"
 *   seedBlock(typology)               the TYPOLOGY SEED block for the interior,
 *                                     depth and character-context prompts; ''
 *   voiceDial(typology)               the MBTI line for the voice build; ''
 *   suggestTypology(character, { factsBlock })   one Sonnet call that reads
 *                                     their writing and proposes a type, a
 *                                     wing, an MBTI and why; saves nothing
 */

const MODELS = ['claude-sonnet-4-6'];

const ENNEAGRAM = Object.freeze({
  1: { name: 'The Reformer', fear: 'being corrupt, wrong or bad', desire: 'to be good and in integrity', wound: 'learned early that mistakes made them unacceptable', mask: 'composed, principled, quietly critical' },
  2: { name: 'The Helper', fear: 'being unwanted or unloved for themselves', desire: 'to be loved', wound: 'learned that love had to be earned by being needed', mask: 'warm, generous, indispensable' },
  3: { name: 'The Achiever', fear: 'being worthless without achievement', desire: 'to feel valuable and admired', wound: 'learned that they were loved for what they did, not who they were', mask: 'polished, effortless, successful' },
  4: { name: 'The Individualist', fear: 'having no identity or significance', desire: 'to find themselves and their significance', wound: 'felt fundamentally different, missing something others had', mask: 'distinctive, deep, aesthetically singular' },
  5: { name: 'The Investigator', fear: 'being useless, helpless or incapable', desire: 'to be capable and competent', wound: 'learned the world asked too much and gave too little', mask: 'detached, knowing, self-contained' },
  6: { name: 'The Loyalist', fear: 'being without support or guidance', desire: 'to have security and support', wound: 'learned the ground could give way without warning', mask: 'reliable, alert, loyal' },
  7: { name: 'The Enthusiast', fear: 'being deprived or trapped in pain', desire: 'to be satisfied and free', wound: 'learned to outrun pain by staying in motion', mask: 'bright, spontaneous, always on to the next thing' },
  8: { name: 'The Challenger', fear: 'being harmed or controlled by others', desire: 'to protect themselves and stay in control', wound: 'learned that softness got them hurt', mask: 'strong, direct, untouchable' },
  9: { name: 'The Peacemaker', fear: 'loss, separation and conflict', desire: 'to have inner and outer peace', wound: 'learned their own wants disturbed the peace, so they stopped having them', mask: 'easy, agreeable, unbothered' },
});

const MBTI_TYPES = Object.freeze([
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);

class TypologyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'TypologyError'; }
}

/** The wings a type can take: the types either side of it on the circle. */
const wingsOf = (type) => [type === 1 ? 9 : type - 1, type === 9 ? 1 : type + 1];

/** The stored shape from a request body; a TypologyError when a value is wrong. */
function normalizeTypology(body = {}, { by = null, now = new Date() } = {}) {
  const raw = body.enneagram || {};
  const type = Number(raw.type);
  if (!Number.isInteger(type) || !ENNEAGRAM[type]) throw new TypologyError('The Enneagram type is a whole number from 1 to 9.');
  let wing = raw.wing === null || raw.wing === undefined || raw.wing === '' ? null : Number(raw.wing);
  if (wing !== null && !wingsOf(type).includes(wing)) throw new TypologyError(`A Type ${type}'s wing is ${wingsOf(type).join(' or ')}.`);
  if (Number.isNaN(wing)) wing = null;
  const mbti = body.mbti ? String(body.mbti).trim().toUpperCase() : null;
  if (mbti && !MBTI_TYPES.includes(mbti)) throw new TypologyError('MBTI is one of the 16 four-letter types, or none.');
  const why = typeof body.why === 'string' && body.why.trim() ? body.why.trim().slice(0, 1000) : null;
  return { enneagram: { type, wing }, mbti, why, set_by: by, set_at: now.toISOString() };
}

const typeOf = (typology) => {
  const type = Number(typology?.enneagram?.type);
  return ENNEAGRAM[type] ? type : null;
};

/** "Type 3w4, The Achiever"; '' with no type. */
function typologyLabel(typology) {
  const type = typeOf(typology);
  if (!type) return '';
  const wing = typology.enneagram.wing ? `w${typology.enneagram.wing}` : '';
  return `Type ${type}${wing}, ${ENNEAGRAM[type].name}`;
}

/** The TYPOLOGY SEED block: the shared root the inner life grows from; '' with no type. */
function seedBlock(typology) {
  const type = typeOf(typology);
  if (!type) return '';
  const e = ENNEAGRAM[type];
  const wing = typology.enneagram.wing ? ENNEAGRAM[typology.enneagram.wing] : null;
  return [
    `TYPOLOGY SEED (the shared root; the inner life grows from it and never contradicts it): Enneagram ${typologyLabel(typology)}.`,
    `- Core fear: ${e.fear}. Core desire: ${e.desire}.`,
    `- The wound under it: ${e.wound}.`,
    `- How the mask tends to read: ${e.mask}.`,
    ...(wing ? [`- The ${typology.enneagram.wing} wing colours it with ${wing.name.replace(/^The /, 'the ')}'s ${wing.desire.replace(/^to /, 'need to ')}.`] : []),
    ...(typology.why ? [`- Why this type: ${typology.why}`] : []),
    'Their want, wound, mask, forbidden want and dilemma descend from this type: make the line from type to each one visible.',
  ].join('\n');
}

/** The MBTI dial for the voice: phrasing only; '' with none. */
function voiceDial(typology) {
  const mbti = typology?.mbti;
  return mbti && MBTI_TYPES.includes(mbti)
    ? `MBTI dial: ${mbti}. It tunes how they phrase things (directness, abstraction, warmth), not who they are or what they want.`
    : '';
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** The writing a suggestion reads: what is already written about them, not the machinery. */
const READ_FIELDS = [
  'description', 'prose_overview', 'core_belief', 'core_wound', 'core_desire', 'core_fear', 'hidden_want',
  'mask_persona', 'truth_persona', 'personality', 'signature_trait', 'want_architecture', 'wound', 'the_mask',
  'self_narrative', 'blind_spot', 'dilemma', 'living_state',
];

/**
 * Proposes a typology from their writing (the spec's predict-from-text):
 * { enneagram: { type, wing }, mbti, why }. Saves nothing; a TypologyError
 * when there is nothing to read or the answer cannot be read.
 */
async function suggestTypology(character, { factsBlock = '' } = {}) {
  const c = character?.toJSON ? character.toJSON() : (character || {});
  const known = {};
  for (const f of READ_FIELDS) {
    const v = c[f];
    if (v !== null && v !== undefined && v !== '' && !(typeof v === 'object' && !Object.keys(v).length)) known[f] = v;
  }
  if (!Object.keys(known).length) throw new TypologyError('There is nothing written about them yet to read a type from.', 409);
  const types = Object.entries(ENNEAGRAM).map(([n, e]) => `${n}: ${e.name} (fear: ${e.fear}; desire: ${e.desire})`).join('\n');
  const prompt = `Read this character and say which Enneagram type they are. Read the wound and the fear under the behaviour, not the surface.

Character: ${c.selected_name || c.display_name || 'this character'}
${JSON.stringify(known, null, 2)}
${factsBlock ? `\n${factsBlock}\n` : ''}
The types:
${types}

Answer with JSON only:
{"enneagram": {"type": 1-9, "wing": the type either side of it, or null}, "mbti": "one of the 16 four-letter types, or null if the writing does not show it", "why": "two sentences: the evidence in their writing for this type"}`;
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[characterTypology] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  try {
    const parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
    const { enneagram, mbti, why } = normalizeTypology(parsed);
    return { enneagram, mbti, why };
  } catch (err) {
    console.error('[characterTypology] the suggestion could not be read:', err.message);
    throw new TypologyError('The suggestion came back in a form that could not be read. Try again.', 502);
  }
}

module.exports = {
  ENNEAGRAM, MBTI_TYPES, TypologyError, wingsOf, normalizeTypology, typologyLabel, seedBlock, voiceDial, suggestTypology,
};
