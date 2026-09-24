'use strict';

/**
 * Event terms (Task #1814, slice 1a) — the four kinds of term an event
 * carries, per the deliverables doctrine (docs/EVENT_EPISODE_FLOW.md §8(t)
 * item 1), each in its own home (Evoni's storage ruling, option E):
 *
 *   access requirements — world_events.requirements (object, unchanged)
 *   deliverables        — event_deliverables rows (EventDeliverable.js)
 *   restrictions        — world_events.restrictions (array of {type, description})
 *   compensation        — world_events.is_paid / payment_amount
 *
 * An Opportunity proposes terms; both opportunity-to-event paths
 * (scheduleOpportunityAsEvent in feedEventPipelineService.js and
 * convertOpportunityToEvent in careerPipelineService.js) carry them with
 * the helpers here. The Event Package edits them; Start Episode
 * (generateEpisodeFromEvent) stamps episode_id on the deliverables and
 * snapshots all four onto the brief (buildTermsSnapshot).
 *
 * Nothing here records fulfilment (slice 1b): every row is written pending.
 */

const { v4: uuidv4 } = require('uuid');

const DESCRIPTION_MAX = 2000;
const TYPE_MAX = 50;
const DUE_DATE_MAX = 50;

function text(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function parseJson(raw, fallback) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[EventTerms] could not parse stored JSON, using the fallback:', err.message);
    return fallback;
  }
}

/**
 * Opportunity.deliverables (JSONB array of {type?, description, due_date?,
 * completed}) → rows for event_deliverables. An entry without a
 * description is skipped (a row cannot be written without one); a bare
 * string entry is taken as its description. `completed` is not carried:
 * every carried row starts pending (fulfilment is slice 1b).
 */
function deliverablesFromOpportunity(opp) {
  const raw = parseJson(opp?.deliverables, []);
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (const item of raw) {
    const entry = typeof item === 'string' ? { description: item } : (item || {});
    const description = text(entry.description);
    if (!description) continue;
    rows.push({
      description: description.slice(0, DESCRIPTION_MAX),
      deliverable_type: text(entry.type).slice(0, TYPE_MAX) || null,
      due_date: text(entry.due_date).slice(0, DUE_DATE_MAX) || null,
      required: true,
    });
  }
  return rows;
}

/**
 * Opportunity.exclusivity (TEXT) → the event's restrictions array. The
 * only restriction an opportunity can propose today.
 */
function restrictionsFromOpportunity(opp) {
  const exclusivity = text(opp?.exclusivity);
  return exclusivity ? [{ type: 'exclusivity', description: exclusivity }] : [];
}

/**
 * Opportunity.payment_amount (DECIMAL(10,2), which node-postgres returns
 * as a string) → the event's is_paid / payment_amount. The event column is
 * INTEGER, so the amount is rounded to the nearest whole number; is_paid
 * is true when that rounded amount is above zero. Contractual pay only:
 * rewards are not touched.
 */
function compensationFromOpportunity(opp) {
  const amount = Number.parseFloat(opp?.payment_amount);
  const rounded = Number.isFinite(amount) ? Math.round(amount) : 0;
  return rounded > 0
    ? { is_paid: true, payment_amount: rounded }
    : { is_paid: false, payment_amount: 0 };
}

/**
 * Inserts deliverable rows for one event, all pending. Returns the number
 * written. Throws on a database error — callers creating an event catch
 * it, log it and carry on (the event is already created).
 */
async function insertEventDeliverables(sequelize, eventId, rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const replacements = { event_id: eventId };
  const values = rows.map((row, i) => {
    replacements[`id${i}`] = uuidv4();
    replacements[`description${i}`] = row.description;
    replacements[`type${i}`] = row.deliverable_type || null;
    replacements[`due${i}`] = row.due_date || null;
    replacements[`required${i}`] = row.required !== false;
    return `(:id${i}, :event_id, :description${i}, :type${i}, :due${i}, :required${i}, 'pending', NOW(), NOW())`;
  });
  await sequelize.query(
    `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, due_date, required, status, created_at, updated_at)
     VALUES ${values.join(', ')}`,
    { replacements, transaction: options.transaction }
  );
  return rows.length;
}

/** The event's live deliverables, oldest first. */
async function listEventDeliverables(sequelize, eventId) {
  const [rows] = await sequelize.query(
    `SELECT id, event_id, description, deliverable_type, due_date, required, status,
            completed_at, submitted_at, approved_at, episode_id, created_at, updated_at
     FROM event_deliverables
     WHERE event_id = :eventId AND deleted_at IS NULL
     ORDER BY created_at ASC, id ASC`,
    { replacements: { eventId } }
  );
  return rows || [];
}

/**
 * Start Episode: stamps the episode on every live deliverable of the
 * event. Returns the number of rows the UPDATE reports, or null when the
 * driver does not report one.
 */
async function stampDeliverablesEpisode(sequelize, eventId, episodeId) {
  const [, meta] = await sequelize.query(
    `UPDATE event_deliverables SET episode_id = :episodeId, updated_at = NOW()
     WHERE event_id = :eventId AND deleted_at IS NULL`,
    { replacements: { eventId, episodeId } }
  );
  return typeof meta?.rowCount === 'number' ? meta.rowCount : null;
}

/**
 * The accepted terms, as the brief snapshots them
 * (EpisodeBrief.event_metadata.terms).
 */
function buildTermsSnapshot(event, deliverables) {
  const ev = event || {};
  const requirements = parseJson(ev.requirements, {});
  const restrictions = parseJson(ev.restrictions, []);
  const amount = Number(ev.payment_amount);
  return {
    access_requirements: requirements && typeof requirements === 'object' && !Array.isArray(requirements) ? requirements : {},
    deliverables: (deliverables || []).map((d) => ({
      id: d.id,
      description: d.description,
      deliverable_type: d.deliverable_type || null,
      due_date: d.due_date || null,
      required: d.required !== false,
      status: d.status || 'pending',
    })),
    restrictions: Array.isArray(restrictions) ? restrictions : [],
    compensation: {
      is_paid: ev.is_paid === true || ev.is_paid === 'true',
      payment_amount: Number.isFinite(amount) ? amount : 0,
    },
  };
}

/**
 * Validates restrictions as sent to the event PUT. Accepts an array whose
 * entries are strings or { type?, description }; returns { value } (the
 * normalised array, entries without text dropped) or { error }.
 */
function normalizeRestrictions(input) {
  if (!Array.isArray(input)) return { error: 'restrictions must be an array' };
  const value = [];
  for (const item of input) {
    const entry = typeof item === 'string' ? { description: item } : item;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'each restriction must be a string or an object with a description' };
    }
    const description = text(entry.description);
    if (!description) continue;
    value.push({
      type: text(entry.type).slice(0, TYPE_MAX) || 'other',
      description: description.slice(0, DESCRIPTION_MAX),
    });
  }
  return { value };
}

module.exports = {
  deliverablesFromOpportunity,
  restrictionsFromOpportunity,
  compensationFromOpportunity,
  insertEventDeliverables,
  listEventDeliverables,
  stampDeliverablesEpisode,
  buildTermsSnapshot,
  normalizeRestrictions,
  DESCRIPTION_MAX,
  TYPE_MAX,
  DUE_DATE_MAX,
};
