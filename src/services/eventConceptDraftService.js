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
 * fields. It never throws.
 *
 * The draft has its own per-user limit (§8(v) 5) because aiRateLimiter is
 * route middleware that answers 429, which would fail creation itself. It
 * reads the same env vars with the same defaults.
 */

const MODELS = ['claude-haiku-4-5-20251001'];
const DRAFT_TIMEOUT_MS = 15000;
const MAX_TOKENS = 600;
const FIELD_MAX = { concept: 300, activity: 300, description: 1200 };

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

Write three things:
- concept: one sentence saying what the event is and why it exists.
- activity: one sentence saying what attendees will actually do there.
- description: the public event description, two to four sentences. ${R8_CONTRACT}

Rules:
- Do not name the event, and do not call the creator its organizer or host.
- Do not invent a venue, date, time, dress code or guest names the details above don't give you.
- No quotation marks inside the values.

Return ONLY this JSON, no other text:
{"concept": "...", "activity": "...", "description": "..."}`;
}

function cleanField(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).trim();
}

// The three fields from a model reply, or null when any is missing.
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
  return draft.concept && draft.activity && draft.description ? draft : null;
}

/**
 * @param {object} profile  the SocialProfile row (plain object)
 * @param {object} context  { venueName, userId }
 * @returns {Promise<{concept, activity, description}|null>}
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
    // Short timeout, no SDK retries: creation must not wait on a slow call.
    const client = new Anthropic({ timeout: DRAFT_TIMEOUT_MS, maxRetries: 0 });

    // House retry pattern: two attempts per model, 2s backoff on 529/503.
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await client.messages.create({
            model,
            max_tokens: MAX_TOKENS,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) break;
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      console.error('[eventConceptDraft] no response (overloaded or unavailable); creating without a draft');
      return null;
    }

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
  takeDraftSlot,
  resetDraftLimit,
  R8_CONTRACT,
  MODELS,
};
