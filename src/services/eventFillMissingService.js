'use strict';

/**
 * Fill what's missing (Evoni, 2026-10-25: "I want them all"): one ask that
 * drafts every empty field the Event Package can fill, for POST
 * /world/:showId/events/:eventId/fill-missing. Writes nothing: the page
 * shows each draft beside the field with Accept / Edit / Skip (and Accept
 * all), and saves the accepted ones through the event PUT.
 *
 * Two kinds of draft:
 *   ai         category, format, date, time, description, dress code, the
 *              invitation's theme and mood (what the invitation is written
 *              from), and the four story stakes; one model call, from the
 *              host, the venue, the slot's story purposes and the season line.
 *   rate_card  a deal's missing fees (appearance, partnership base,
 *              performance) from the rate card at Lala's tier, as Propose
 *              terms prices them. Never the AI: the deal decides money
 *              (dealTypeDraftService, "Rates are baselines").
 *
 * Two modes (Evoni, 2026-10-25: "Merge the Suggest with AI button into
 * Fill what's missing"):
 *   missing    (the default) the empty fields above.
 *   ideas      when nothing is empty: fresh alternatives for the six basics
 *              (date, time, description, dress code, category, format), as
 *              Suggest with AI offered; each says what it would replace
 *              (`current`), and one that repeats the current value is
 *              dropped. A deal's missing fees are still priced.
 *
 * Every draft is checked before it is returned: its field is one asked for
 * and on the event PUT's allowlist (update.js allowedFields), its value
 * passes the field's rule (a list's values, HH:MM, the column's length), its
 * reason is short. Anything else is dropped, never an error.
 *
 * The model call goes through the Anthropic SDK, which aiCostTracker
 * patches: logged and budget-gated like every call. A budget refusal is
 * answered as 429 and never retried.
 */

const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');
const { currentValue, todayIso, SUGGEST_BASICS_FIELDS } = require('../utils/suggestBasics');

// The fields the AI drafts, in the page's order. max: the column's limit.
const AI_FIELDS = Object.freeze([
  { field: 'category', label: 'Category', kind: 'list', values: CATEGORY_VALUES },
  { field: 'format', label: 'Format', kind: 'list', values: FORMAT_VALUES },
  { field: 'event_date', label: 'Date', kind: 'date' },
  { field: 'event_time', label: 'Time', kind: 'time' },
  { field: 'description', label: 'Description', kind: 'text', max: 1200, rule: 'guest-facing copy for attendees' },
  { field: 'dress_code', label: 'Dress code', kind: 'text', max: 200, rule: 'a short dress code' },
  { field: 'theme', label: 'Invitation theme', kind: 'text', max: 100, rule: 'the invitation\'s theme, a few words' },
  { field: 'mood', label: 'Invitation mood', kind: 'text', max: 100, rule: 'the invitation\'s mood, a few words' },
  { field: 'narrative_stakes', label: "What's at stake", kind: 'text', max: 600, rule: 'what this event means to Lala, a sentence or two' },
  { field: 'fail_consequence', label: 'If it goes wrong', kind: 'text', max: 400, rule: 'what failing here costs her' },
  { field: 'success_unlock', label: 'If it goes well', kind: 'text', max: 400, rule: 'what succeeding opens up' },
  { field: 'career_milestone', label: 'Career milestone', kind: 'text', max: 200, rule: 'the step this is in her career' },
]);
const AI_FIELD_NAMES = Object.freeze(AI_FIELDS.map((f) => f.field));
const SPEC = Object.fromEntries(AI_FIELDS.map((f) => [f.field, f]));
const REASON_MAX = 140;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// "Suggest fresh ideas": the basics Suggest with AI covered.
const IDEA_FIELDS = Object.freeze(AI_FIELD_NAMES.filter((f) => SUGGEST_BASICS_FIELDS.includes(f)));
const MODES = Object.freeze(['missing', 'ideas']);

// The deal's fee fields, priced from the rate card (dealPricingService
// EVENT_COMPONENTS: field and anchor).
const FEE_LABELS = { appearance_fee: 'Appearance fee', partnership_base_fee: 'Partnership base', performance_fee: 'Performance fee' };

const MODELS = ['claude-sonnet-4-6'];

/** The AI fields that are empty on the event, in order. */
function emptyAiFields(event) {
  return AI_FIELD_NAMES.filter((f) => currentValue(event, f) === null);
}

/**
 * The deal's missing fees from the rate card: [{ field, label, value,
 * source: 'rate_card', reason }]. None without a deal, a card, or an anchor
 * at the tier ("Missing is missing": a fee the card does not offer stays
 * for Evoni to price).
 */
function rateCardDrafts(event, card, tier) {
  if (!event || !card) return [];
  const { dealComponents, EVENT_COMPONENTS } = require('./dealPricingService');
  const out = [];
  for (const key of dealComponents(event)) {
    const spec = EVENT_COMPONENTS[key];
    if (!spec || event[spec.field] != null) continue;
    const amount = card.anchors?.[spec.anchor]?.[tier];
    if (amount == null || !Number.isFinite(Number(amount))) continue;
    out.push({
      field: spec.field, label: FEE_LABELS[spec.field] || spec.label, value: Math.round(Number(amount)),
      source: 'rate_card', reason: `The rate card's ${spec.label.toLowerCase()} at tier ${tier}`,
    });
  }
  return out;
}

const isRealDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** A model value, cleaned, or null when it does not pass its field's rule (a date: real, today or later). */
function cleanValue(field, raw, { now = new Date() } = {}) {
  const spec = SPEC[field];
  if (!spec || typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  if (spec.kind === 'list') return spec.values.includes(v) ? v : null;
  if (spec.kind === 'time') return TIME_RE.test(v) ? v : null;
  if (spec.kind === 'date') return isRealDate(v) && v >= todayIso(now) ? v : null;
  return v.length <= spec.max ? v : null;
}

/**
 * The model's reply → its drafts that pass, one per field at most, in
 * AI_FIELDS order: [{ field, label, value, source: 'ai', reason }].
 * `fields`: the ones asked for; `allowed`: the PUT's allowlist. With
 * `event` (ideas), a draft carries the value it would replace as
 * `current`, and one equal to it is dropped.
 */
function draftsFromReply(text, { fields, allowed, event = null, now }) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch (err) {
    console.error('[FillMissing] invalid JSON in model reply:', err.message);
    return [];
  }
  const list = Array.isArray(parsed?.drafts) ? parsed.drafts : [];
  const allow = new Set(allowed || []);
  const byField = new Map();
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const { field } = d;
    if (!fields.includes(field) || !allow.has(field) || byField.has(field)) continue;
    const value = cleanValue(field, d.value, { now });
    const reason = typeof d.reason === 'string' ? d.reason.trim() : '';
    if (value === null || !reason || reason.length > REASON_MAX) continue;
    const current = event ? currentValue(event, field) : null;
    if (current !== null && current === value) continue;
    byField.set(field, { field, label: SPEC[field].label, value, source: 'ai', reason, ...(current !== null ? { current } : {}) });
  }
  return AI_FIELD_NAMES.filter((f) => byField.has(f)).map((f) => byField.get(f));
}

/**
 * The prompt. facts: { name, event_type, prestige, host_brand, organizer,
 * venue: { name, city, venue_type } | null, season: string | null,
 * purposes: string[], pressure: string | null, deal_type }.
 */
function buildPrompt(event, facts, fields, { mode = 'missing', now = new Date() } = {}) {
  const ideas = mode === 'ideas';
  const lines = [
    facts.name ? `Name: ${facts.name}` : null,
    facts.event_type ? `Event type: ${String(facts.event_type).replace(/_/g, ' ')}` : null,
    typeof facts.prestige === 'number' ? `Prestige: ${facts.prestige}/10` : null,
    facts.host_brand ? `Host brand: ${facts.host_brand}` : null,
    facts.organizer ? `Organizer: ${facts.organizer}` : null,
    facts.venue?.name ? `Venue: ${facts.venue.name}${facts.venue.city ? `, ${facts.venue.city}` : ''}${facts.venue.venue_type ? ` (${String(facts.venue.venue_type).replace(/_/g, ' ')})` : ''}` : null,
    facts.season ? `Season: ${facts.season}` : null,
    ...(facts.purposes || []).map((p, i) => `${i === 0 ? 'Story purpose of its slot' : 'Also'}: ${p}`),
    facts.pressure ? `Desired pressure: ${facts.pressure}` : null,
    facts.deal_type ? `Deal: ${String(facts.deal_type).replace(/_/g, ' ')}` : null,
  ].filter(Boolean);
  const known = AI_FIELD_NAMES
    .filter((f) => !fields.includes(f) && currentValue(event, f) !== null)
    .map((f) => `${f}: ${String(currentValue(event, f)).slice(0, 300)}`);
  const rule = (f) => {
    const s = SPEC[f];
    if (s.kind === 'list') return `${f}: exactly one of ${s.values.join(', ')}`;
    if (s.kind === 'time') return `${f}: a start time, 24-hour HH:MM`;
    if (s.kind === 'date') return `${f}: a date on or after ${todayIso(now)}, as YYYY-MM-DD`;
    return `${f}: ${s.rule}, at most ${s.max} characters`;
  };
  const currentLines = fields
    .filter((f) => currentValue(event, f) !== null)
    .map((f) => `${f}: ${String(currentValue(event, f)).slice(0, 300)}`);
  const ask = ideas
    ? `${currentLines.length ? `Their current values:\n${currentLines.join('\n')}\n\n` : ''}Suggest a fresh alternative for each of these fields, different from its current value:`
    : 'Draft a value for each of these empty fields:';
  return `You are ${ideas ? 'suggesting fresh ideas for' : 'drafting the missing details of'} an event in Lala's world, a fashion and lifestyle show.

What is known about the event:
${lines.length ? lines.join('\n') : 'Very little beyond its existence; do not invent specifics.'}
${known.length ? `\nAlready decided (keep the drafts consistent with these):\n${known.join('\n')}\n` : ''}
${ask}
${fields.map((f) => `- ${rule(f)}`).join('\n')}

Rules:
- Fit the facts above and the slot's story purpose; do not invent a venue, guest or brand they do not give.
- Each draft has a reason of at most ${REASON_MAX} characters.

Return ONLY this JSON, no other text:
{"drafts": [{"field": "...", "value": "...", "reason": "..."}]}`;
}

/** The facts the prompt reads; each lookup is optional and logged. */
async function loadFacts(models, { showId, event }) {
  const logLookup = (what) => (e) => { console.error(`[FillMissing] ${what} lookup failed:`, e.message); return null; };
  const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
  const organizer = eventCreatorOrganizer(event);
  let cc = event.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[FillMissing] canon_consequences parse failed:', err.message); cc = {}; }
  }
  const venueId = event.venue_location_id || cc?.automation?.venue_location_id || null;
  const [profile, venue, season] = await Promise.all([
    (organizer?.profileId && models.SocialProfile)
      ? models.SocialProfile.findByPk(organizer.profileId, { attributes: ['display_name', 'handle'] }).catch(logLookup('organizer profile'))
      : Promise.resolve(null),
    (venueId && models.WorldLocation)
      ? models.WorldLocation.findByPk(venueId, { attributes: ['name', 'city', 'venue_type'] }).catch(logLookup('venue location'))
      : Promise.resolve(null),
    require('./seasonSlotService').eventSeasonContext(models.sequelize, showId, event.id).catch(logLookup('season context')),
  ]);
  const purposes = Array.isArray(season?.story_purposes)
    ? [...season.story_purposes].sort((a, b) => Number(Boolean(b?.primary)) - Number(Boolean(a?.primary)))
      .map((p) => String(p?.text || '').trim()).filter(Boolean)
    : [];
  if (!purposes.length && season?.story_purpose) purposes.push(String(season.story_purpose));
  return {
    name: event.name || null,
    event_type: event.event_type || null,
    prestige: typeof event.prestige === 'number' ? event.prestige : null,
    host_brand: event.host_brand || cc?.automation?.host_brand || null,
    organizer: profile?.display_name || profile?.handle || organizer?.displayName || organizer?.handle || event.host || null,
    venue: venue ? { name: venue.name, city: venue.city || null, venue_type: venue.venue_type || null } : (event.venue_name ? { name: event.venue_name, city: null, venue_type: null } : null),
    season: season ? [season.arc_title, season.label, season.phase?.title].filter(Boolean).join(' · ') || null : null,
    purposes,
    pressure: season?.desired_pressure || null,
    deal_type: event.deal_type || null,
  };
}

/** The repo's two-attempt loop: up to 2 attempts per model, 2s back-off on 529/503; a budget refusal is thrown at once. */
async function callModel(client, prompt, { wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const { isBudgetError } = require('./imageCostService');
  let lastErr = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await client.messages.create({ model, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] });
      } catch (apiErr) {
        if (isBudgetError(apiErr)) throw apiErr;
        lastErr = apiErr;
        const status = apiErr?.status || apiErr?.error?.status;
        if ((status === 529 || status === 503) && attempt < 1) {
          await wait(2000);
          continue;
        }
        break;
      }
    }
  }
  const err = new Error(lastErr?.message || 'no response');
  err.cause = lastErr;
  throw err;
}

const FAILED = 'Couldn\'t draft the missing fields right now.';

/**
 * Draft every missing field (mode 'missing'), or fresh ideas for the basics
 * (mode 'ideas'). Returns { status: 200, drafts, asked } or { status,
 * error, code? } (429 budget, 502 the model failed, 503 no key).
 * `client`/`wait`/`now`: the SDK client, the back-off wait and today (tests).
 */
async function draftMissing(models, { showId, event, allowed, mode = 'missing', client = null, wait, now = new Date() } = {}) {
  const ideas = mode === 'ideas';
  const asked = ideas ? [...IDEA_FIELDS] : emptyAiFields(event);
  let feeDrafts = [];
  try {
    const { loadRateCard, lalaPricingTier } = require('./dealPricingService');
    const card = await loadRateCard(models.sequelize);
    if (card) feeDrafts = rateCardDrafts(event, card, (await lalaPricingTier(models.sequelize, event)).tier);
  } catch (err) {
    console.error('[FillMissing] rate card read failed (no fee drafts):', err.message);
  }
  const allow = new Set(allowed || []);
  feeDrafts = feeDrafts.filter((d) => allow.has(d.field));
  if (!asked.length) return { status: 200, drafts: feeDrafts, asked };
  if (!client && !process.env.ANTHROPIC_API_KEY) return { status: 503, error: 'ANTHROPIC_API_KEY not configured' };

  const facts = await loadFacts(models, { showId, event });
  const prompt = buildPrompt(event, facts, asked, { mode, now });
  const Anthropic = client ? null : require('@anthropic-ai/sdk');
  const sdk = client || new Anthropic();
  let response;
  try {
    response = await callModel(sdk, prompt, { wait });
  } catch (err) {
    const { isBudgetError } = require('./imageCostService');
    if (isBudgetError(err)) {
      console.error('[FillMissing] AI budget refused the call:', err.message);
      return { status: 429, error: err.message, code: err.code };
    }
    console.error('[FillMissing] model call failed:', err.cause?.status || '', err.message);
    return { status: 502, error: FAILED };
  }
  const text = response?.content?.[0]?.text || '';
  const aiDrafts = draftsFromReply(text, { fields: asked, allowed, now, event: ideas ? event : null });
  if (!aiDrafts.length) console.error('[FillMissing] no usable drafts in model reply:', text.slice(0, 500));
  return { status: 200, drafts: [...aiDrafts, ...feeDrafts], asked };
}

module.exports = {
  AI_FIELDS, AI_FIELD_NAMES, IDEA_FIELDS, MODES, MODELS, REASON_MAX,
  emptyAiFields, rateCardDrafts, cleanValue, draftsFromReply, buildPrompt, loadFacts, callModel, draftMissing,
};
