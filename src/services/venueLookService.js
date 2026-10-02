/**
 * The Event Venue Look (Evoni's ruling L1, 2026-10-02, and her answers
 * Q1-Q10; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L1. "Each event carries an Event Venue Look: overall look, décor and
 *   colours, lighting and time, event areas, signage, must include/avoid,
 *   and reference images. 'Draft from event details' fills it from the
 *   host, description, activity and dress code; it is labelled Auto-drafted
 *   and editable. It feeds the Scene Brief's event layer. The venue is the
 *   place; the look is how it's dressed for this occasion. Scene images
 *   never contain characters."
 *
 * Stored on world_events.venue_look (Q1):
 *   {
 *     overall, decor, lighting, signage, must_include, must_avoid: text,
 *     areas: [name, ...]                    // named spaces (Q5)
 *     references: [{ asset_id, use_as_reference }]   // Q6: at most 3 ticked
 *     sources: { <part>: 'auto-drafted' | 'edited' }  // per part (Q8)
 *   }
 *
 * The draft (Q7, as Evoni changed it) reads the host, description, activity
 * and dress code, the event's prestige, and the venue's own description as
 * context only, so the dressing fits the space; the look still describes
 * the occasion, not the place. A redraft keeps every part Evoni edited, with
 * no confirm (Q8). The look is editable while the event's episode is a
 * draft and locks when the episode is accepted (Q9).
 */

const Anthropic = require('@anthropic-ai/sdk');

const MODELS = ['claude-haiku-4-5-20251001'];
const SOURCES = Object.freeze({ DRAFTED: 'auto-drafted', EDITED: 'edited' });
// The seven parts, in order; references are the seventh and are never drafted.
const TEXT_PARTS = Object.freeze(['overall', 'decor', 'lighting', 'signage', 'must_include', 'must_avoid']);
const PARTS = Object.freeze(['overall', 'decor', 'lighting', 'areas', 'signage', 'must_include', 'must_avoid']);
const PART_LABELS = Object.freeze({
  overall: 'Overall look',
  decor: 'Décor and colours',
  lighting: 'Lighting and time',
  areas: 'Event areas',
  signage: 'Signage',
  must_include: 'Must include',
  must_avoid: 'Must avoid',
});
const TEXT_MAX = 600;
const AREA_MAX = 60;
const AREAS_MAX = 12;
const REFERENCES_TICKED_MAX = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class VenueLookError extends Error {
  constructor(message, status = 400, code = 'VENUE_LOOK_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const cleanText = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[venueLook] stored look is not JSON:', err.message);
    return fallback;
  }
}

/** The stored look in its full shape (every part present), or null. */
function readVenueLook(raw) {
  const look = parseJson(raw, null);
  if (!look || typeof look !== 'object') return null;
  const out = { areas: [], references: [], sources: {} };
  for (const part of TEXT_PARTS) out[part] = cleanText(look[part]);
  out.areas = Array.isArray(look.areas) ? look.areas.map(cleanText).filter(Boolean) : [];
  out.references = Array.isArray(look.references)
    ? look.references.filter((r) => r && UUID_RE.test(String(r.asset_id))).map((r) => ({ asset_id: String(r.asset_id), use_as_reference: r.use_as_reference === true }))
    : [];
  const sources = look.sources && typeof look.sources === 'object' ? look.sources : {};
  for (const part of PARTS) {
    if (sources[part] === SOURCES.DRAFTED || sources[part] === SOURCES.EDITED) out.sources[part] = sources[part];
  }
  return out;
}

/** True when any part has content (a look with only references counts). */
function hasLookContent(look) {
  if (!look) return false;
  return TEXT_PARTS.some((p) => look[p]) || look.areas.length > 0 || look.references.length > 0;
}

const partValue = (look, part) => (part === 'areas' ? (look?.areas || []).join('\n') : (look?.[part] || ''));

/**
 * Evoni's save: validated, with each part's source. A part whose value she
 * changed is Edited; an unchanged part keeps its source; an emptied part
 * has none.
 */
function normaliseLookInput(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new VenueLookError('venue_look must be an object');
  const out = { areas: [], references: [], sources: {} };
  for (const part of TEXT_PARTS) {
    const text = input[part] === undefined ? (current?.[part] || '') : cleanText(input[part]);
    if (text.length > TEXT_MAX) throw new VenueLookError(`${PART_LABELS[part]} must be at most ${TEXT_MAX} characters`);
    out[part] = text;
  }
  const areasIn = input.areas === undefined ? (current?.areas || []) : input.areas;
  if (!Array.isArray(areasIn)) throw new VenueLookError('Event areas must be a list');
  const seen = new Set();
  for (const raw of areasIn) {
    const name = cleanText(raw);
    if (!name) continue;
    if (name.length > AREA_MAX) throw new VenueLookError(`An event area name must be at most ${AREA_MAX} characters`);
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.areas.push(name); }
  }
  if (out.areas.length > AREAS_MAX) throw new VenueLookError(`At most ${AREAS_MAX} event areas`);

  const refsIn = input.references === undefined ? (current?.references || []) : input.references;
  if (!Array.isArray(refsIn)) throw new VenueLookError('references must be a list');
  const seenRefs = new Set();
  for (const r of refsIn) {
    const id = String(r?.asset_id || '');
    if (!UUID_RE.test(id)) throw new VenueLookError('Each reference image needs an asset_id');
    if (seenRefs.has(id)) continue;
    seenRefs.add(id);
    out.references.push({ asset_id: id, use_as_reference: r.use_as_reference === true });
  }
  if (out.references.filter((r) => r.use_as_reference).length > REFERENCES_TICKED_MAX) {
    throw new VenueLookError(`At most ${REFERENCES_TICKED_MAX} reference images can be used as references`);
  }

  for (const part of PARTS) {
    const value = partValue(out, part);
    if (!value) continue;
    const before = current ? partValue(current, part) : '';
    out.sources[part] = value === before && current?.sources?.[part] ? current.sources[part] : SOURCES.EDITED;
  }
  return out;
}

/**
 * A draft merged into the current look: parts Evoni edited are kept (Q8);
 * every other part takes the draft and is Auto-drafted. References are
 * never drafted.
 */
function mergeDraft(current, draft) {
  const out = { areas: [], references: current?.references || [], sources: {} };
  const keptEdited = [];
  for (const part of PARTS) {
    const editedNow = current?.sources?.[part] === SOURCES.EDITED && partValue(current, part);
    if (editedNow) {
      if (part === 'areas') out.areas = [...current.areas];
      else out[part] = current[part];
      out.sources[part] = SOURCES.EDITED;
      keptEdited.push(part);
      continue;
    }
    if (part === 'areas') out.areas = draft.areas;
    else out[part] = draft[part];
    if (partValue(out, part)) out.sources[part] = SOURCES.DRAFTED;
  }
  for (const part of TEXT_PARTS) if (out[part] === undefined) out[part] = '';
  return { look: out, keptEdited };
}

/** The look's event, with the episode lock (Q9). */
async function loadLookEvent(sequelize, { showId, eventId }) {
  const [[event]] = await sequelize.query(
    `SELECT e.id, e.show_id, e.name, e.host, e.host_brand, e.description, e.format, e.category, e.event_type,
            e.dress_code, e.prestige, e.venue_location_id, e.venue_name, e.venue_look, e.updated_at,
            e.used_in_episode_id, ep.evaluation_status
       FROM world_events e
       LEFT JOIN episodes ep ON ep.id = e.used_in_episode_id AND ep.deleted_at IS NULL
      WHERE e.id = :eventId AND e.show_id = :showId AND e.deleted_at IS NULL`,
    { replacements: { eventId, showId } });
  if (!event) throw new VenueLookError('Event not found', 404, 'EVENT_NOT_FOUND');
  return event;
}

function assertEditable(event) {
  if (event.evaluation_status === 'accepted') {
    throw new VenueLookError("This event's episode is accepted: its venue look is locked", 409, 'VENUE_LOOK_LOCKED');
  }
}

/** The look with each reference's image URL, for showing. */
async function withReferenceUrls(sequelize, look) {
  if (!look || !look.references.length) return look;
  const ids = look.references.map((r) => r.asset_id);
  const [rows] = await sequelize.query(
    `SELECT id, COALESCE(s3_url_processed, s3_url_raw) AS url FROM assets
      WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids } }).catch((err) => { console.error('[venueLook] reference urls load failed:', err.message); return [[]]; });
  const urls = new Map(rows.map((r) => [String(r.id), r.url || null]));
  return { ...look, references: look.references.map((r) => ({ ...r, url: urls.get(r.asset_id) || null })) };
}

async function writeLook(sequelize, eventId, look) {
  const stored = { ...look, references: look.references.map(({ asset_id, use_as_reference }) => ({ asset_id, use_as_reference })) };
  const [[row]] = await sequelize.query(
    `UPDATE world_events SET venue_look = CAST(:look AS jsonb), updated_at = NOW()
      WHERE id = :eventId RETURNING updated_at`,
    { replacements: { look: JSON.stringify(stored), eventId } });
  return row?.updated_at || null;
}

async function getVenueLook(sequelize, { showId, eventId }) {
  const event = await loadLookEvent(sequelize, { showId, eventId });
  return {
    venue_look: await withReferenceUrls(sequelize, readVenueLook(event.venue_look)),
    editable: event.evaluation_status !== 'accepted',
  };
}

/** Evoni's save (an empty look clears it). */
async function saveVenueLook(sequelize, { showId, eventId, input }) {
  const event = await loadLookEvent(sequelize, { showId, eventId });
  assertEditable(event);
  const current = readVenueLook(event.venue_look);
  const look = normaliseLookInput(input, current);
  if (look.references.length) {
    const [found] = await sequelize.query('SELECT id FROM assets WHERE id IN (:ids) AND deleted_at IS NULL',
      { replacements: { ids: look.references.map((r) => r.asset_id) } });
    if (found.length !== look.references.length) throw new VenueLookError('A reference image no longer exists', 404, 'ASSET_NOT_FOUND');
  }
  const updatedAt = hasLookContent(look)
    ? await writeLook(sequelize, eventId, look)
    : (await sequelize.query('UPDATE world_events SET venue_look = NULL, updated_at = NOW() WHERE id = :eventId RETURNING updated_at',
      { replacements: { eventId } }))[0]?.[0]?.updated_at || null;
  return { venue_look: hasLookContent(look) ? await withReferenceUrls(sequelize, look) : null, updated_at: updatedAt };
}

async function loadVenueDescription(sequelize, event) {
  if (!event.venue_location_id) return null;
  const [[loc]] = await sequelize.query(
    'SELECT name, description FROM world_locations WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: event.venue_location_id } }).catch((err) => { console.error('[venueLook] venue load failed:', err.message); return [[]]; });
  return loc ? { name: cleanText(loc.name), description: cleanText(loc.description) } : null;
}

function buildDraftPrompt(event, venue) {
  const host = cleanText(event.host_brand) || cleanText(event.host) || 'not given';
  const activity = [event.format, event.category].map((v) => cleanText(v).replace(/_/g, ' ')).filter(Boolean).join(', ') || 'not given';
  const venueBlock = venue && (venue.description || venue.name)
    ? `The venue, for context only (do not describe the building; describe how it is dressed for this occasion so the dressing fits the space): ${[venue.name, venue.description].filter(Boolean).join(': ')}`
    : 'The venue: not given.';
  return `You design event dressing for "Styling Adventures with Lala", a luxury fashion life-simulator show.

Draft the Venue Look for this event: how the venue is dressed for this occasion. The venue is the place; the look is the occasion.

Event: ${cleanText(event.name) || 'Untitled event'}
Host: ${host}
Description: ${cleanText(event.description) || 'not given'}
Activity: ${activity}
Dress code: ${cleanText(event.dress_code) || 'not given'}
Prestige (1-10): ${event.prestige ?? 'not given'}
${venueBlock}

Scene images never contain people or characters, and never contain readable text.

Return JSON only:
{
  "overall": "One or two sentences: the overall look of the dressed space.",
  "decor": "Décor and colours: florals, linens, props, palette.",
  "lighting": "Lighting and time: how the space is lit for the occasion.",
  "areas": ["Named spaces within the venue, e.g. Bar, Runway, VIP lounge (at most 6)"],
  "signage": "Signage shapes and placement, with no readable text.",
  "must_include": "Short list of things that must be visible.",
  "must_avoid": "Short list of things that must not appear."
}
Each text at most 300 characters.`;
}

function parseDraft(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('draft had no JSON');
  const json = JSON.parse(match[0]);
  const out = { areas: [] };
  for (const part of TEXT_PARTS) out[part] = cleanText(json[part]).slice(0, TEXT_MAX);
  out.areas = (Array.isArray(json.areas) ? json.areas : [])
    .map((a) => cleanText(a).slice(0, AREA_MAX)).filter(Boolean)
    .filter((a, i, all) => all.findIndex((x) => x.toLowerCase() === a.toLowerCase()) === i)
    .slice(0, AREAS_MAX);
  if (!TEXT_PARTS.some((p) => out[p]) && !out.areas.length) throw new Error('draft was empty');
  return out;
}

/** "Draft from event details" (L1): Haiku, budget-gated by aiCostTracker. */
async function draftVenueLook(sequelize, { showId, eventId, anthropic } = {}) {
  const event = await loadLookEvent(sequelize, { showId, eventId });
  assertEditable(event);
  const current = readVenueLook(event.venue_look);
  const venue = await loadVenueDescription(sequelize, event);
  const prompt = buildDraftPrompt(event, venue);
  const api = anthropic || getClient();
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await api.messages.create({ model: MODELS[0], max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
      const draft = parseDraft(response?.content?.[0]?.text);
      const { look, keptEdited } = mergeDraft(current, draft);
      const updatedAt = await writeLook(sequelize, eventId, look);
      return { venue_look: await withReferenceUrls(sequelize, look), kept_edited: keptEdited, updated_at: updatedAt };
    } catch (err) {
      if (err?.status === 429) throw new VenueLookError(err.message, 429, 'AI_BUDGET_EXCEEDED');
      lastErr = err;
      console.error(`[venueLook] draft attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw new VenueLookError(`Drafting failed: ${lastErr?.message || 'unknown error'}`, 502, 'VENUE_LOOK_DRAFT_FAILED');
}

module.exports = {
  MODELS,
  SOURCES,
  PARTS,
  TEXT_PARTS,
  PART_LABELS,
  REFERENCES_TICKED_MAX,
  VenueLookError,
  readVenueLook,
  hasLookContent,
  normaliseLookInput,
  mergeDraft,
  buildDraftPrompt,
  parseDraft,
  getVenueLook,
  saveVenueLook,
  draftVenueLook,
};
