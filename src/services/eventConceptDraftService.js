'use strict';

/**
 * eventConceptDraftService — the creation draft for a new event
 * (docs/EVENT_EPISODE_FLOW.md §8(u) R1, R8; §8(v)). Task #2122.
 *
 * draftEventConcept drafts a concept, an activity and a public description
 * for an event started from a Feed creator (POST /world/:showId/events/
 * from-profile). One Haiku 4.5 call. It never blocks creation (§8(v) 1):
 * a missing API key, the draft's own rate limit, aiCostTracker's budget
 * refusal (it patches the SDK and throws), an API error, a timeout or an
 * unusable reply all return null, and the caller keeps today's template
 * fields. It never throws. One attempt only: a 10s timeout, no retry and
 * the SDK's own retries off, so creation waits at most about 10s for it.
 *
 * The same call also drafts styling (§8(u) R7, Task #2124): dress_code,
 * dress_code_keywords and a styling_brief. Styling is optional in the
 * result: when it is missing or invalid the concept draft is still returned,
 * with no styling key.
 *
 * It also drafts the taxonomy and start time (§8(u) R3, Task #2126):
 * category and format from WorldEvent's own isIn lists, and event_time as
 * 24h HH:MM (the format eventBasics' FORMAT_START_TIMES suggests and the
 * Event Package saves). Each is validated alone; an invalid one is dropped
 * with a warning and everything else is kept.
 *
 * It drafts the event's name last (§8(u) R1, R3, R9; Task #2135), written
 * from the concept, activity and format, under the suggest-names prompt's
 * own name rules. A name that is empty, 40 characters or longer, or the
 * route's fallback "Event with <creator>" is dropped with a warning (never
 * truncated: a cut name reads broken), and everything else is kept.
 *
 * The draft has its own per-user limit (§8(v) 5) because aiRateLimiter is
 * route middleware that answers 429, which would fail creation itself. It
 * reads the same env vars with the same defaults.
 */

// The model file is required directly, not the models index: it exports the
// taxonomy lists on its define function and needs no database.
const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');

const MODELS = ['claude-haiku-4-5-20251001'];
const DRAFT_TIMEOUT_MS = 10000;
const MAX_TOKENS = 1000;
const FIELD_MAX = { concept: 300, activity: 300, description: 1200 };
// Task #2135: a drafted name is kept only when under this many characters,
// the suggest-names prompt's "Each name is under 40 characters." rule.
const NAME_LIMIT = 40;
// Quotation marks in a drafted name (Evoni, Task #2135 review): double
// quotes, straight and curly, are stripped anywhere; single quotes only when
// they wrap the whole name, so an apostrophe (' or ’) inside it is kept.
// (The suggest-names handler still strips every single quote.)
const DOUBLE_QUOTES = /["“”]/g;
const WRAPPING_SINGLE_QUOTES = /^['‘’]\s*(.*?)\s*['‘’]$/;
// For comparing against the fallback only: every quotation mark.
const QUOTE_MARKS = /["'‘’“”]/g;

function stripNameQuotes(raw) {
  const name = raw.replace(DOUBLE_QUOTES, '').replace(/\s+/g, ' ').trim();
  const wrapped = name.match(WRAPPING_SINGLE_QUOTES);
  return wrapped ? wrapped[1] : name;
}

// Styling (Task #2124). dress_code is STRING(200) on world_events.
const STYLING_MAX = { dress_code: 200, keyword: 30, text: 300, item: 120, list: 5 };
const KEYWORDS_MIN = 3;
const KEYWORDS_MAX = 8;
// The wardrobe's own formality scale: wardrobeImageService's item analysis
// returns "formality": "casual|smart-casual|business|formal|black-tie".
const FORMALITY_SCALE = ['casual', 'smart-casual', 'business', 'formal', 'black-tie'];
// dress_code_keywords are matched against wardrobe items' aesthetic_tags
// (wardrobe.js outfit scoring: substring either way; episodeOrchestrationRoute:
// exact match). There is no closed vocabulary, so the prompt prefers the tags
// items actually carry: the seeded items' aesthetic_tags (wardrobe.js seed)
// and the examples wardrobeImageService's analysis prompt gives.
const PREFERRED_KEYWORDS = [
  'elegant', 'couture', 'statement', 'romantic', 'iconic', 'bold', 'luxury', 'casual',
  'versatile', 'soft', 'modern', 'elevated', 'street', 'sparkling', 'powerful', 'minimal',
  'feminine', 'dramatic', 'sophisticated', 'sharp', 'clean', 'classic', 'vintage', 'structured',
  'professional', 'practical', 'glamorous', 'fresh', 'cozy', 'comfortable',
  'old-money', 'minimalist', 'bohemian', 'streetwear', 'preppy', 'glam',
];

// §8(u) R8, verbatim.
const R8_CONTRACT = 'The public event description explains why the event exists, what attendees will actually do, the setting/atmosphere, and what guests should expect. It contains no database stats, evaluation language, or private story consequences.';

const limitWindowMs = () => parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '300000', 10);
const limitMax = () => parseInt(process.env.AI_RATE_LIMIT_PER_IP || '30', 10);

// userKey → timestamps (ms) of draft calls inside the current window.
const draftCalls = new Map();

// Records a call and returns true when the user is under the limit;
// returns false (recording nothing) when the limit is reached.
function takeDraftSlot(userKey, now = Date.now()) {
  const windowStart = now - limitWindowMs();
  const recent = (draftCalls.get(userKey) || []).filter((t) => t > windowStart);
  if (recent.length >= limitMax()) {
    draftCalls.set(userKey, recent);
    return false;
  }
  recent.push(now);
  draftCalls.set(userKey, recent);
  return true;
}

function resetDraftLimit() {
  draftCalls.clear();
}

const words = (v) => (typeof v === 'string' ? v.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '');

// No show name (doctrine rule 11). The creator is who the event was started
// from, not its organizer or host (§8(r); Task #1790), so the prompt does
// not call them either.
function buildDraftPrompt(profile, context = {}) {
  const p = profile || {};
  const facts = [
    words(p.display_name) || words(p.handle) ? `Started from Feed creator: ${words(p.display_name) || words(p.handle)}` : null,
    words(p.content_category) ? `Creator's niche: ${words(p.content_category)}` : null,
    words(p.archetype) ? `Creator's archetype: ${words(p.archetype)}` : null,
    words(context.venueName) ? `Venue: ${words(context.venueName)}` : null,
  ].filter(Boolean);

  return `Draft a fictional social event in Lala's world, fitting the Feed creator it was started from.

${facts.length > 0 ? facts.join('\n') : 'No details beyond the event existing — keep it simple and do not invent specifics.'}

Write these:
- concept: one sentence saying what the event is and why it exists.
- activity: one sentence saying what attendees will actually do there.
- description: the public event description, two to four sentences. ${R8_CONTRACT}
- category: exactly one of ${CATEGORY_VALUES.join(', ')}.
- format: exactly one of ${FORMAT_VALUES.join(', ')}. Choose it from the concept and activity above.
- event_time: the start time that fits the concept and activity, as 24-hour HH:MM (e.g. 18:30).
- styling, for what guests wear to this event and this activity:
  - dress_code: a short dress code, under 200 characters.
  - dress_code_keywords: ${KEYWORDS_MIN} to ${KEYWORDS_MAX} lower-case style words, each a single word or a hyphenated compound such as old-money or smart-casual. Prefer words from this list, which wardrobe items are tagged with: ${PREFERRED_KEYWORDS.join(', ')}.
  - styling_brief:
    - activity: what guests are physically doing, as it affects clothing.
    - formality: exactly one of ${FORMALITY_SCALE.join(', ')}.
    - function_requirements: 1 to ${STYLING_MAX.list} short items (what the clothing must allow).
    - avoid: 1 to ${STYLING_MAX.list} short items (what not to wear).
    - style_direction: one sentence on the look.
    - environment (optional): the setting, as it affects clothing.
    - footwear_requirements (optional): one short phrase.
- name: write this last, from the concept, activity and format above. Each name is under 40 characters. No quotation marks in the name itself.

Rules:
- Do not call the creator the event's organizer or host.
- Do not invent a venue, date or guest names the details above don't give you.
- No quotation marks inside the values.

Return ONLY this JSON, no other text:
{"concept": "...", "activity": "...", "description": "...", "category": "...", "format": "...", "event_time": "HH:MM", "styling": {"dress_code": "...", "dress_code_keywords": ["..."], "styling_brief": {"activity": "...", "formality": "...", "function_requirements": ["..."], "avoid": ["..."], "style_direction": "...", "environment": "...", "footwear_requirements": "..."}}, "name": "..."}`;
}

function cleanField(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).trim();
}

// Lower-case, spaces and underscores to hyphens (Task #2124 review): "Old
// Money" → "old-money", "black_tie" → "black-tie".
const hyphenate = (v) => (typeof v === 'string'
  ? v.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  : '');
// A keyword is one word or a hyphenated compound of words.
const KEYWORD_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// A list of short strings (a lone string counts as one item), capped; [] when
// there is nothing usable.
function cleanList(value, maxItems, maxLen) {
  const items = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return items.map((v) => cleanField(v, maxLen)).filter(Boolean).slice(0, maxItems);
}

// The styling object from a model reply, or null when it is missing or any
// required field is invalid. Optional fields are dropped when unusable.
function parseStyling(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dressCode = cleanField(raw.dress_code, STYLING_MAX.dress_code);
  // Keywords: normalised to single words or hyphenated compounds; anything
  // else is dropped.
  const keywords = [...new Set(cleanList(raw.dress_code_keywords, KEYWORDS_MAX * 2, STYLING_MAX.keyword)
    .map(hyphenate)
    .filter((k) => KEYWORD_SHAPE.test(k)))].slice(0, KEYWORDS_MAX);
  const b = raw.styling_brief && typeof raw.styling_brief === 'object' ? raw.styling_brief : null;
  if (!dressCode || keywords.length < KEYWORDS_MIN || !b) return null;

  const formality = hyphenate(b.formality);
  const brief = {
    activity: cleanField(b.activity, STYLING_MAX.text),
    formality: FORMALITY_SCALE.includes(formality) ? formality : '',
    function_requirements: cleanList(b.function_requirements, STYLING_MAX.list, STYLING_MAX.item),
    avoid: cleanList(b.avoid, STYLING_MAX.list, STYLING_MAX.item),
    style_direction: cleanField(b.style_direction, STYLING_MAX.text),
  };
  if (!brief.activity || !brief.formality || brief.function_requirements.length === 0
    || brief.avoid.length === 0 || !brief.style_direction) return null;

  const environment = cleanField(b.environment, STYLING_MAX.text);
  const footwear = cleanField(b.footwear_requirements, STYLING_MAX.item);
  if (environment) brief.environment = environment;
  if (footwear) brief.footwear_requirements = footwear;

  return { dress_code: dressCode, dress_code_keywords: keywords, styling_brief: brief };
}

// Lower-case, spaces and hyphens to underscores: "Workout Class" →
// "workout_class", "pop-up" → "pop_up".
const underscore = (v) => (typeof v === 'string'
  ? v.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  : '');

// A start time as zero-padded 24h HH:MM, or '' when it doesn't parse.
function normaliseTime(v) {
  const m = typeof v === 'string' ? v.trim().match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// category, format and event_time from a reply; each is kept only when
// valid, with a warning naming any that was dropped.
function parseTaxonomy(parsed) {
  const out = {};
  const category = underscore(parsed.category);
  const format = underscore(parsed.format);
  const time = normaliseTime(parsed.event_time);
  if (CATEGORY_VALUES.includes(category)) out.category = category;
  else console.warn(`[eventConceptDraft] category ${JSON.stringify(parsed.category)} not allowed; left for the Package to suggest`);
  if (FORMAT_VALUES.includes(format)) out.format = format;
  else console.warn(`[eventConceptDraft] format ${JSON.stringify(parsed.format)} not allowed; left for the Package to suggest`);
  if (time) out.event_time = time;
  else console.warn(`[eventConceptDraft] event_time ${JSON.stringify(parsed.event_time)} did not parse; left for the Package to suggest`);
  return out;
}

// The route's fallback name (from-profile: "Event with <creator>"), or null
// when the profile has no name to build it from.
function fallbackNameFor(profile) {
  const creator = profile && (profile.display_name || profile.handle);
  return creator ? `Event with ${creator}` : null;
}

const nameKey = (v) => v.replace(QUOTE_MARKS, '').replace(/\s+/g, ' ').trim().toLowerCase();

// The drafted name, or '' (with a warning) when it is empty, 40 characters
// or longer, or the fallback name. Quotation marks are stripped first
// (stripNameQuotes); the name is never truncated.
function parseName(raw, profile) {
  const name = typeof raw === 'string' ? stripNameQuotes(raw) : '';
  if (!name) {
    console.warn('[eventConceptDraft] name missing or empty; the event keeps its fallback name');
    return '';
  }
  if (name.length >= NAME_LIMIT) {
    console.warn(`[eventConceptDraft] name ${JSON.stringify(name)} is ${name.length} characters (limit: under ${NAME_LIMIT}); the event keeps its fallback name`);
    return '';
  }
  const fallback = fallbackNameFor(profile);
  if (fallback && nameKey(name) === nameKey(fallback)) {
    console.warn(`[eventConceptDraft] name ${JSON.stringify(name)} is the fallback pattern; the event keeps its fallback name`);
    return '';
  }
  return name;
}

// The three concept fields from a model reply, or null when any is missing;
// plus `styling` when the reply's styling is valid (Task #2124), and `name`
// when the reply's name is valid (Task #2135; `profile` gives the fallback
// name it must not equal).
function parseDraftReply(text, profile = null) {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error('[eventConceptDraft] reply was not valid JSON:', err.message);
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const draft = {
    concept: cleanField(parsed.concept, FIELD_MAX.concept),
    activity: cleanField(parsed.activity, FIELD_MAX.activity),
    description: cleanField(parsed.description, FIELD_MAX.description),
  };
  if (!draft.concept || !draft.activity || !draft.description) return null;

  Object.assign(draft, parseTaxonomy(parsed));

  const styling = parseStyling(parsed.styling);
  if (styling) draft.styling = styling;
  else console.warn('[eventConceptDraft] styling missing or invalid; keeping the concept draft without styling');

  const name = parseName(parsed.name, profile);
  if (name) draft.name = name;
  return draft;
}

/**
 * @param {object} profile  the SocialProfile row (plain object)
 * @param {object} context  { venueName, userId }
 * @returns {Promise<{concept, activity, description, category?, format?, event_time?, styling?, name?}|null>}
 */
async function draftEventConcept(profile, context = {}) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return null;

    const userKey = context.userId ? `user:${context.userId}` : 'anonymous';
    if (!takeDraftSlot(userKey)) {
      console.warn(`[eventConceptDraft] draft limit reached for ${userKey}; creating without a draft`);
      return null;
    }

    const prompt = buildDraftPrompt(profile, context);
    const Anthropic = require('@anthropic-ai/sdk');
    // One attempt (Evoni, Task #2122 review): 10s timeout, no retry, SDK
    // retries off. Any error, overload included, falls to the catch below.
    const client = new Anthropic({ timeout: DRAFT_TIMEOUT_MS, maxRetries: 0 });
    const response = await client.messages.create({
      model: MODELS[0],
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const draft = parseDraftReply(response.content?.[0]?.text, profile);
    if (!draft) console.error('[eventConceptDraft] unusable reply; creating without a draft');
    return draft;
  } catch (err) {
    console.error('[eventConceptDraft] draft failed; creating without a draft:', err.message);
    return null;
  }
}

module.exports = {
  draftEventConcept,
  buildDraftPrompt,
  parseDraftReply,
  parseStyling,
  parseTaxonomy,
  parseName,
  normaliseTime,
  takeDraftSlot,
  resetDraftLimit,
  R8_CONTRACT,
  MODELS,
  DRAFT_TIMEOUT_MS,
  NAME_LIMIT,
  FORMALITY_SCALE,
  PREFERRED_KEYWORDS,
};
