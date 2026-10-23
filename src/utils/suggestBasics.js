'use strict';

/**
 * Suggest basics (POST /world/:showId/events/:eventId/suggest-basics): the
 * pure parts — which fields to ask for, the prompt, and the check every
 * model suggestion passes before it is returned. Writes nothing; the page
 * saves a chosen suggestion through the event PUT.
 *
 * Contract (the Event Package page builds against it):
 *   body     { fields?: string[] } — any of SUGGEST_BASICS_FIELDS
 *   200      { success: true, data: { suggestions: [{ field, value, reason }] } }
 * A field is suggested when it is listed in `fields`; with no `fields`,
 * every one of the six that is empty on the event.
 */

const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');

const SUGGEST_BASICS_FIELDS = Object.freeze(['event_date', 'event_time', 'description', 'dress_code', 'category', 'format']);
const LIMITS = Object.freeze({ dress_code: 200, description: 1200, reason: 140 });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[SuggestBasics] unreadable JSON on the event:', err.message);
    return fallback;
  }
}

/** The automation copy of the event (calendar-spawned events keep date/venue there). */
function automationOf(event) {
  const cc = parseJson(event?.canon_consequences, {}) || {};
  return cc.automation && typeof cc.automation === 'object' ? cc.automation : {};
}

/** The field's current value on the event, or null when empty. */
function currentValue(event, field) {
  let v = event?.[field];
  if ((v == null || v === '') && (field === 'event_date' || field === 'event_time')) v = automationOf(event)[field];
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * The fields to suggest. { fields } or { error } (a 400).
 */
function readRequestedFields(body, event) {
  const sent = body && typeof body === 'object' ? body.fields : undefined;
  if (sent === undefined || sent === null) {
    return { fields: SUGGEST_BASICS_FIELDS.filter((f) => currentValue(event, f) === null) };
  }
  if (!Array.isArray(sent)) return { error: 'fields must be a list' };
  const unknown = sent.filter((f) => !SUGGEST_BASICS_FIELDS.includes(f));
  if (unknown.length) return { error: `fields must be any of ${SUGGEST_BASICS_FIELDS.join(', ')}` };
  return { fields: SUGGEST_BASICS_FIELDS.filter((f) => sent.includes(f)) };
}

/** Today as YYYY-MM-DD (UTC). */
function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** A suggestion's value, cleaned, or null when it does not pass. */
function cleanValue(field, raw, { today }) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  switch (field) {
    case 'category': return CATEGORY_VALUES.includes(v) ? v : null;
    case 'format': return FORMAT_VALUES.includes(v) ? v : null;
    case 'event_date': return isRealDate(v) && v >= today ? v : null;
    case 'event_time': return TIME_RE.test(v) ? v : null;
    case 'dress_code': return v.length <= LIMITS.dress_code ? v : null;
    case 'description': return v.length <= LIMITS.description ? v : null;
    default: return null;
  }
}

/**
 * The model's reply text → the suggestions that pass, at most one per
 * requested field, in the order of SUGGEST_BASICS_FIELDS. Anything invalid
 * is dropped, never an error; an unreadable reply is [].
 */
function suggestionsFromReply(text, { fields, now = new Date() }) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch (err) {
    console.error('[SuggestBasics] invalid JSON in model reply:', err.message);
    return [];
  }
  const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const today = todayIso(now);
  const byField = new Map();
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const field = s.field;
    if (!fields.includes(field) || byField.has(field)) continue;
    const value = cleanValue(field, s.value, { today });
    const reason = typeof s.reason === 'string' ? s.reason.trim() : '';
    if (value === null || !reason || reason.length > LIMITS.reason) continue;
    byField.set(field, { field, value, reason });
  }
  return SUGGEST_BASICS_FIELDS.filter((f) => byField.has(f)).map((f) => byField.get(f));
}

/**
 * The prompt. `facts`: { name, event_type, prestige, host_brand, organizer,
 * venue: { name, city } | null, season: string | null }.
 */
function buildSuggestBasicsPrompt(event, facts, fields, { now = new Date() } = {}) {
  const lines = [
    facts.name ? `Name: ${facts.name}` : null,
    facts.event_type ? `Event type: ${String(facts.event_type).replace(/_/g, ' ')}` : null,
    typeof facts.prestige === 'number' ? `Prestige: ${facts.prestige}/10` : null,
    facts.host_brand ? `Host brand: ${facts.host_brand}` : null,
    facts.organizer ? `Organizer: ${facts.organizer}` : null,
    facts.venue?.name ? `Venue: ${facts.venue.name}${facts.venue.city ? `, ${facts.venue.city}` : ''}` : null,
    facts.season ? `Season: ${facts.season}` : null,
  ].filter(Boolean);
  const current = SUGGEST_BASICS_FIELDS
    .map((f) => `${f}: ${currentValue(event, f) ?? '(empty)'}`)
    .join('\n');
  const rules = {
    event_date: `event_date — a date on or after ${todayIso(now)}, as YYYY-MM-DD`,
    event_time: 'event_time — a start time, 24-hour HH:MM',
    description: `description — guest-facing copy for attendees, at most ${LIMITS.description} characters`,
    dress_code: `dress_code — a short dress code, at most ${LIMITS.dress_code} characters`,
    category: `category — exactly one of: ${CATEGORY_VALUES.join(', ')}`,
    format: `format — exactly one of: ${FORMAT_VALUES.join(', ')}`,
  };
  return `You are filling in the basics of an event in Lala's world, a fashion and lifestyle show.

What is known about the event:
${lines.length ? lines.join('\n') : 'Very little beyond its existence — do not invent specifics.'}

Its current values:
${current}

Suggest a value for each of these fields:
${fields.map((f) => `- ${rules[f]}`).join('\n')}

Rules:
- Fit the facts above; do not invent a venue, guest or brand they do not give.
- Each suggestion has a reason of at most ${LIMITS.reason} characters.

Return ONLY this JSON, no other text:
{"suggestions": [{"field": "...", "value": "...", "reason": "..."}]}`;
}

module.exports = {
  SUGGEST_BASICS_FIELDS,
  LIMITS,
  currentValue,
  readRequestedFields,
  suggestionsFromReply,
  buildSuggestBasicsPrompt,
  todayIso,
};
