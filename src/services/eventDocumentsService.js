'use strict';

/**
 * eventDocumentsService — the Event Package's in-world documents beside the
 * invitation: Lala's wardrobe shopping list and her career plan (Evoni,
 * 2026-10-06: "add wardrobe shopping list and career list to event package
 * so I can do exactly what invitations does"; they live on the event, and
 * episodes keep the lists they already have).
 *
 * Each document goes through the invitation's steps: Draft (written from
 * the event), Edit (Evoni's own words), Redraft (a new draft, the old one
 * kept in history) and Approve. It is stored as the invitation's editable
 * text is, in the event's canon_consequences JSON (invitation_text there,
 * documents.<type> here), so no schema change:
 *
 *   canon_consequences.documents.shopping_list = {
 *     type, status: 'draft' | 'approved', version, source: 'draft' | 'edited',
 *     items: [{ slot, label, description, required, section? , goal_id? }],
 *     drafted_at, edited_at, approved_at,
 *     history: [ the earlier versions, newest first, at most HISTORY_MAX ]
 *   }
 *
 * The drafts reuse the episode lists' own writers (todoListService):
 * generateTasks for the shopping list's slots, generateCareerTasks for the
 * career plan's "This event" goals, plus her active career goals as
 * "Bigger goals". Both writers are Haiku calls, logged and budget-gated by
 * aiCostTracker, and both fall back to the event's own fields on failure.
 */

const DOC_TYPES = Object.freeze({
  shopping_list: { label: 'Shopping list' },
  career_plan: { label: 'Career plan' },
});

const HISTORY_MAX = 10;
const ITEMS_MAX = 20;
const LABEL_MAX = 200;
const DESCRIPTION_MAX = 300;
const CAREER_SECTIONS = new Set(['this_event', 'bigger_goals']);
const BIGGER_GOALS_MAX = 5;

class EventDocumentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isDocType(type) {
  return Object.prototype.hasOwnProperty.call(DOC_TYPES, type);
}

function parseJSON(value, fallback) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (err) {
      console.error('[EventDocuments] unreadable JSON on the event:', err.message);
      return fallback;
    }
  }
  return fallback;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The event's two documents, each null until drafted. */
function readDocuments(event) {
  const cc = parseJSON(event?.canon_consequences, {}) || {};
  const docs = cc.documents && typeof cc.documents === 'object' ? cc.documents : {};
  return {
    shopping_list: docs.shopping_list || null,
    career_plan: docs.career_plan || null,
  };
}

/**
 * A document's items as stored: a label each (items without one are
 * dropped), trimmed, at most ITEMS_MAX. Career items keep their section
 * ("this_event" or "bigger_goals", this_event by default).
 */
function normalizeItems(type, items) {
  if (!Array.isArray(items)) throw new EventDocumentError(400, 'items must be an array');
  const out = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const label = text(raw.label, LABEL_MAX);
    if (!label) continue;
    const item = {
      slot: text(raw.slot, 60) || `item_${out.length + 1}`,
      label,
      description: text(raw.description, DESCRIPTION_MAX),
      required: raw.required === true,
    };
    if (type === 'career_plan') {
      item.section = CAREER_SECTIONS.has(raw.section) ? raw.section : 'this_event';
      if (raw.goal_id) item.goal_id = String(raw.goal_id);
    }
    out.push(item);
    if (out.length >= ITEMS_MAX) break;
  }
  return out;
}

/** The next version of a document; the one it replaces goes into history. */
function nextVersion(prev, type, patch, now = new Date().toISOString()) {
  let history = [];
  if (prev) {
    const earlier = Array.isArray(prev.history) ? prev.history : [];
    const replaced = { ...prev };
    delete replaced.history;
    history = [replaced, ...earlier].slice(0, HISTORY_MAX);
  }
  return {
    type,
    status: 'draft',
    version: (prev?.version || 0) + 1,
    source: 'draft',
    items: [],
    drafted_at: prev?.drafted_at || null,
    edited_at: prev?.edited_at || null,
    approved_at: null,
    ...patch,
    updated_at: now,
    history,
  };
}

async function loadEvent(sequelize, showId, eventId) {
  const [rows] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { eventId, showId } }
  );
  const event = rows && rows[0];
  if (!event) throw new EventDocumentError(404, 'Event not found');
  if (typeof event.outfit_pieces === 'string') event.outfit_pieces = parseJSON(event.outfit_pieces, []);
  return event;
}

// One key of canon_consequences.documents, leaving every other key of the
// event's canon_consequences as it is.
async function writeDocument(sequelize, eventId, type, doc) {
  await sequelize.query(
    `UPDATE world_events
        SET canon_consequences = COALESCE(canon_consequences, '{}'::jsonb)
          || jsonb_build_object('documents',
               COALESCE(canon_consequences->'documents', '{}'::jsonb)
               || jsonb_build_object(CAST(:type AS text), CAST(:doc AS jsonb))),
            updated_at = NOW()
      WHERE id = :eventId AND deleted_at IS NULL`,
    { replacements: { eventId, type, doc: JSON.stringify(doc) } }
  );
  return doc;
}

/** Her active career goals, highest priority first, as "Bigger goals". */
async function biggerGoals(models, showId) {
  if (!models.CareerGoal) return [];
  try {
    const goals = await models.CareerGoal.findAll({
      attributes: ['id', 'title', 'description', 'priority'],
      where: { show_id: showId, status: 'active' },
      order: [['priority', 'ASC'], ['created_at', 'ASC']],
      limit: BIGGER_GOALS_MAX,
      raw: true,
    });
    return (goals || []).map((g, i) => ({
      slot: `goal_${i + 1}`,
      label: g.title,
      description: g.description || '',
      required: false,
      section: 'bigger_goals',
      goal_id: g.id,
    }));
  } catch (err) {
    console.error('[EventDocuments] career goals read failed (the plan keeps its event goals):', err.message);
    return [];
  }
}

/** The items a fresh draft starts from. */
async function draftItems(models, event, type, showId) {
  const { generateTasks, generateCareerTasks } = require('./todoListService');
  if (type === 'shopping_list') {
    const tasks = await generateTasks(event);
    return normalizeItems(type, tasks);
  }
  const tasks = await generateCareerTasks(event);
  const thisEvent = (tasks || []).map((t) => ({ ...t, section: 'this_event' }));
  return normalizeItems(type, [...thisEvent, ...(await biggerGoals(models, showId))]);
}

function assertType(type) {
  if (!isDocType(type)) throw new EventDocumentError(400, `Unknown document: ${type}`);
}

/**
 * What the deal expects of her at this event (Evoni, 2026-10-06: "add
 * deliverables to career goals list whichever ones are expected of her for
 * that event"): each of the event's deliverables, as the episode's task list
 * shows it (socialTaskSource.deliverableTask). Read live from the terms,
 * never stored in the career plan, so an Edit or Redraft cannot drop one and
 * the list always matches the deal. Start Episode already puts them on the
 * episode's task list, required.
 */
async function expectedOfHer(sequelize, eventId) {
  const { listEventDeliverables } = require('./eventTermsService');
  const { withDeliverableTasks } = require('../utils/socialTaskSource');
  try {
    const rows = await listEventDeliverables(sequelize, eventId);
    return withDeliverableTasks([], rows).map((t) => ({
      id: t.deliverable_id,
      label: t.label,
      detail: t.description,
      required: t.required,
      owed_to: t.owed_to,
    }));
  } catch (err) {
    console.error('[EventDocuments] deliverables read failed (the career plan shows none):', err.message);
    return [];
  }
}

/** GET: both documents, and the deliverables expected of her. */
async function getDocuments(models, { showId, eventId }) {
  const event = await loadEvent(models.sequelize, showId, eventId);
  return { ...readDocuments(event), deliverables: await expectedOfHer(models.sequelize, event.id) };
}

/** Draft, or redraft: a new draft written from the event. */
async function draftDocument(models, { showId, eventId, type }) {
  assertType(type);
  const event = await loadEvent(models.sequelize, showId, eventId);
  const prev = readDocuments(event)[type];
  const now = new Date().toISOString();
  const items = await draftItems(models, event, type, showId);
  const doc = nextVersion(prev, type, { items, source: 'draft', drafted_at: now, edited_at: null }, now);
  return writeDocument(models.sequelize, eventId, type, doc);
}

/** Edit: her own items; an edited document is a draft until approved again. */
async function editDocument(models, { showId, eventId, type, items }) {
  assertType(type);
  const event = await loadEvent(models.sequelize, showId, eventId);
  const prev = readDocuments(event)[type];
  if (!prev) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
  const now = new Date().toISOString();
  const doc = nextVersion(prev, type, { items: normalizeItems(type, items), source: 'edited', edited_at: now }, now);
  if (doc.items.length === 0) throw new EventDocumentError(400, 'A document needs at least one item');
  return writeDocument(models.sequelize, eventId, type, doc);
}

/** Approve: the current version, as it is. */
async function approveDocument(models, { showId, eventId, type }) {
  assertType(type);
  const event = await loadEvent(models.sequelize, showId, eventId);
  const prev = readDocuments(event)[type];
  if (!prev) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
  if (prev.status === 'approved') return prev;
  const now = new Date().toISOString();
  const doc = { ...prev, status: 'approved', approved_at: now, updated_at: now };
  return writeDocument(models.sequelize, eventId, type, doc);
}

// ─── Start Episode: the approved documents carried into the episode ─────────
//
// PR 3 of the event documents (Evoni, 2026-10-06: the documents live on the
// event; episodes keep the lists they already have). Start Episode reads the
// event's documents once, and only an approved one is used:
//   - an approved shopping list becomes the episode's wardrobe list
//     (episode_todo_lists.tasks), in place of the standard slots;
//   - an approved career plan's "This event" lines become Lala's goals on
//     the episode's task list (social_tasks), in place of the goals written
//     from the event's fields. Its "Bigger goals" stay on the event: they are
//     her career goals, tracked as CareerGoal rows, not this episode's tasks.
// A draft is never carried. An episode already started keeps its lists.

/** The event's document of this type, when it is approved; else null. */
function approvedDocument(event, type) {
  const doc = readDocuments(event)[type];
  return doc && doc.status === 'approved' && Array.isArray(doc.items) && doc.items.length ? doc : null;
}

const docTag = (doc) => ({ type: doc.type, version: doc.version });

/** An approved shopping list's lines as the episode's wardrobe tasks. */
function shoppingListTasks(doc) {
  return (doc?.items || []).map((i, n) => ({
    slot: i.slot,
    label: i.label,
    description: i.description || '',
    required: i.required === true,
    completed: false,
    order: n + 1,
    from_event_document: docTag(doc),
  }));
}

/** An approved career plan's "This event" lines as Lala's goal tasks. */
function careerPlanGoals(doc) {
  return (doc?.items || [])
    .filter((i) => (i.section || 'this_event') === 'this_event')
    .map((i) => ({
      slot: `plan_${i.slot}`,
      label: i.label,
      description: i.description || '',
      timing: 'during',
      platform: null,
      task_source: 'goal',
      required: false,
      completed: false,
      from_event_document: docTag(doc),
    }));
}

module.exports = {
  DOC_TYPES,
  HISTORY_MAX,
  EventDocumentError,
  isDocType,
  readDocuments,
  normalizeItems,
  nextVersion,
  getDocuments,
  draftDocument,
  editDocument,
  approveDocument,
  approvedDocument,
  shoppingListTasks,
  careerPlanGoals,
};
