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
 * The draft has its own per-user limit (§8(v) 5) because aiRateLimiter is
 * route middleware that answers 429, which would fail creation itself. It
 * reads the same env vars with the same defaults.
 */

const MODELS = ['claude-haiku-4-5-20251001'];
const DRAFT_TIMEOUT_MS = 10000;
const MAX_TOKENS = 1000;
const FIELD_MAX = { concept: 300, activity: 300, description: 1200 };

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
- styling, for what guests wear to this event and this activity:
  - dress_code: a short dress code, under 200 characters.
  - dress_code_keywords: ${KEYWORDS_MIN} to ${KEYWORDS_MAX} single lower-case style words (hyphens allowed). Prefer words from this list, which wardrobe items are tagged with: ${PREFERRED_KEYWORDS.join(', ')}.
  - styling_brief:
    - activity: what guests are physically doing, as it affects clothing.
    - formality: exactly one of ${FORMALITY_SCALE.join(', ')}.
    - function_requirements: 1 to ${STYLING_MAX.list} short items (what the clothing must allow).
    - avoid: 1 to ${STYLING_MAX.list} short items (what not to wear).
    - style_direction: one sentence on the look.
    - environment (optional): the setting, as it affects clothing.
    - footwear_requirements (optional): one short phrase.

Rules:
- Do not name the event, and do not call the creator its organizer or host.
- Do not invent a venue, date, time or guest names the details above don't give you.
- No quotation marks inside the values.

Return ONLY this JSON, no other text:
{"concept": "...", "activity": "...", "description": "...", "styling": {"dress_code": "...", "dress_code_keywords": ["..."], "styling_brief": {"activity": "...", "formality": "...", "function_requirements": ["..."], "avoid": ["..."], "style_direction": "...", "environment": "...", "footwear_requirements": "..."}}}`;
}

function cleanField(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).trim();
}

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
  const keywords = [...new Set(cleanList(raw.dress_code_keywords, KEYWORDS_MAX * 2, STYLING_MAX.keyword)
    .map((k) => k.toLowerCase()))].slice(0, KEYWORDS_MAX);
  const b = raw.styling_brief && typeof raw.styling_brief === 'object' ? raw.styling_brief : null;
  if (!dressCode || keywords.length < KEYWORDS_MIN || !b) return null;

  const formality = typeof b.formality === 'string' ? b.formality.trim().toLowerCase() : '';
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

// The three concept fields from a model reply, or null when any is missing;
// plus `styling` when the reply's styling is valid (Task #2124).
function parseDraftReply(text) {
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

  const styling = parseStyling(parsed.styling);
  if (styling) draft.styling = styling;
  else console.warn('[eventConceptDraft] styling missing or invalid; keeping the concept draft without styling');
  return draft;
}

/**
 * @param {object} profile  the SocialProfile row (plain object)
 * @param {object} context  { venueName, userId }
 * @returns {Promise<{concept, activity, description, styling?}|null>}
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

    const draft = parseDraftReply(response.content?.[0]?.text);
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
  takeDraftSlot,
  resetDraftLimit,
  R8_CONTRACT,
  MODELS,
  DRAFT_TIMEOUT_MS,
  FORMALITY_SCALE,
  PREFERRED_KEYWORDS,
};
