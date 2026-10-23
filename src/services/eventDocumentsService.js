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
    // The last overlay drawn from it stays, now out of date
    // (eventDocumentOverlayService.overlayState) until the new version is approved.
    overlay: prev?.overlay || null,
    ...patch,
    updated_at: now,
    history,
  };
}

async function loadEvent(sequelize, showId, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1${transaction ? ' FOR UPDATE' : ''}`,
    { replacements: { eventId, showId }, ...(transaction ? { transaction } : {}) }
  );
  const event = rows && rows[0];
  if (!event) throw new EventDocumentError(404, 'Event not found');
  if (typeof event.outfit_pieces === 'string') event.outfit_pieces = parseJSON(event.outfit_pieces, []);
  return event;
}

// One key of canon_consequences.documents, leaving every other key of the
// event's canon_consequences as it is.
async function writeDocument(sequelize, eventId, type, doc, { transaction } = {}) {
  await sequelize.query(
    `UPDATE world_events
        SET canon_consequences = COALESCE(canon_consequences, '{}'::jsonb)
          || jsonb_build_object('documents',
               COALESCE(canon_consequences->'documents', '{}'::jsonb)
               || jsonb_build_object(CAST(:type AS text), CAST(:doc AS jsonb))),
            updated_at = NOW()
      WHERE id = :eventId AND deleted_at IS NULL`,
    { replacements: { eventId, type, doc: JSON.stringify(doc) }, ...(transaction ? { transaction } : {}) }
  );
  return doc;
}

/**
 * A read-modify-write of one document, in one transaction with the event
 * row locked (audit Low, 2026-10-23), so a draft, an edit and an approval
 * cannot overwrite one another: each reads the version the one before it
 * wrote. `change(prev, event)` returns the document to write, or null to
 * write nothing; it may throw an EventDocumentError. Returns
 * { event, doc, written }.
 *
 * expectedVersion (optional): the version the client last read. When sent
 * and the stored version differs, the write is refused with 409, so an
 * approval never approves a version its sender did not see.
 */
async function changeDocument(sequelize, { showId, eventId, type, expectedVersion }, change) {
  return sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, showId, eventId, { transaction });
    const prev = readDocuments(event)[type];
    if (expectedVersion != null && Number(prev?.version || 0) !== Number(expectedVersion)) {
      throw new EventDocumentError(409, `The ${DOC_TYPES[type].label.toLowerCase()} changed since you opened it (now version ${prev?.version || 0}). Reload it and try again.`);
    }
    const doc = await change(prev, event);
    if (!doc) return { event, doc: prev, written: false };
    await writeDocument(sequelize, eventId, type, doc, { transaction });
    return { event, doc, written: true };
  });
}

/** An expected version sent by a client: a whole number, or null when absent. */
function readExpectedVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new EventDocumentError(400, 'version must be a whole number');
  return n;
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
  // The look the shopping list adds up and Lala's coins (Evoni, 2026-10-09:
  // the list's total was wrong): the same look and charges as Finalize, read
  // here so every place that shows the list shows one total.
  const { shoppingListContext } = require('./eventDocumentOverlayService');
  const { look, balance } = await shoppingListContext(models.sequelize, event);
  return {
    ...readDocuments(event),
    deliverables: await expectedOfHer(models.sequelize, event.id),
    look: look ? { state: look.state, pieces: look.pieces, total: look.total } : null,
    balance,
  };
}

/**
 * Draft, or redraft: a new draft written from the event. The items are
 * written by the AI outside the transaction (no row is held locked across
 * a model call); the new version is then built on the document as it
 * stands under the lock.
 */
async function draftDocument(models, { showId, eventId, type, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const event = await loadEvent(models.sequelize, showId, eventId);
  const items = await draftItems(models, event, type, showId);
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (prev) => {
    const now = new Date().toISOString();
    return nextVersion(prev, type, { items, source: 'draft', drafted_at: now, edited_at: null }, now);
  });
  return doc;
}

/** Edit: her own items; an edited document is a draft until approved again. */
async function editDocument(models, { showId, eventId, type, items, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (prev) => {
    if (!prev) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
    const now = new Date().toISOString();
    const next = nextVersion(prev, type, { items: normalizeItems(type, items), source: 'edited', edited_at: now }, now);
    if (next.items.length === 0) throw new EventDocumentError(400, 'A document needs at least one item');
    return next;
  });
  return doc;
}

/**
 * The approved document drawn as its overlay (Evoni, 2026-10-07: "i want
 * both the shopping list and career list and invitations as overlays"),
 * recorded on the document as overlay { asset_id, url, version, made_at }.
 * Not placed on a beat ("none of the overlays should be beats for now").
 * A drawing failure leaves the approval as it is.
 */
async function withOverlay(models, event, type, doc) {
  const { makeDocumentOverlay } = require('./eventDocumentOverlayService');
  try {
    const deliverables = type === 'career_plan' ? await expectedOfHer(models.sequelize, event.id) : [];
    const overlay = await makeDocumentOverlay(models, { event, type, doc, deliverables });
    if (!overlay) return doc;
    // Recorded only on the version it was drawn from: a newer edit that
    // landed while it was drawn is left as it is.
    const { doc: saved } = await changeDocument(models.sequelize, { showId: event.show_id, eventId: event.id, type }, (current) => (
      current && current.version === doc.version ? { ...current, overlay } : null
    ));
    return saved && saved.version === doc.version ? saved : doc;
  } catch (err) {
    console.error(`[EventDocuments] ${type} overlay failed (the approval stands):`, err.message);
    return doc;
  }
}

/**
 * Approve: the current version, as it is, and draw its overlay. Approving
 * an approved document whose overlay is missing or out of date draws it again.
 */
async function approveDocument(models, { showId, eventId, type, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const { overlayState } = require('./eventDocumentOverlayService');
  // The approval is read and written under the event row lock, so it
  // approves the version stored at that moment and never writes an older
  // copy over a newer edit (audit Low, 2026-10-23).
  const { event, doc: prev, written } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (current) => {
    if (!current) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
    if (current.status === 'approved') return null;
    const now = new Date().toISOString();
    return { ...current, status: 'approved', approved_at: now, updated_at: now };
  });
  if (written) return withOverlay(models, event, type, prev);
  // Already approved: draw its overlay again when missing or out of date.
  let lookTotal = null;
  if (type === 'shopping_list') {
    const { shoppingListContext, shoppingLines } = require('./eventDocumentOverlayService');
    const { look } = await shoppingListContext(models.sequelize, event);
    if (look) lookTotal = shoppingLines(prev, look.pieces).total;
  }
  return overlayState(prev, lookTotal) === 'current' ? prev : withOverlay(models, event, type, prev);
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

// ─── "Use in episode": the approved list applied to an episode (Task #2883) ──
//
// The same tasks Start Episode makes (shoppingListTasks), applied to an
// episode already started. Each task keeps its from_event_document tag
// ({ type, version }), the link to the list; the todo list needs nothing
// more. A Draft list is refused. Applying again adds nothing new:
//   - a list line already on the episode (same slot and label) keeps its
//     task, completed or not;
//   - a new line is added;
//   - an open task the list does not hold (the standard slots, a line an
//     earlier version had) gives way to the list, as at Start Episode;
//   - a completed task the list does not hold is kept: done work is never lost.

const taskKey = (t) => `${String(t?.slot || '').trim().toLowerCase()}|${String(t?.label || '').trim().toLowerCase()}`;

async function useShoppingListInEpisode(models, episodeId) {
  const { sequelize } = models;
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId } });
  if (!episode) throw new EventDocumentError(404, 'Episode not found');

  const { listEpisodeEvents } = require('./episodeEventsService');
  const anchor = (await listEpisodeEvents(models, episodeId)).events[0] || null;
  if (!anchor) throw new EventDocumentError(404, 'This episode has no event, so it has no shopping list.');
  const [[event]] = await sequelize.query('SELECT * FROM world_events WHERE id = :id', { replacements: { id: anchor.id } });
  if (!event) throw new EventDocumentError(404, 'Event not found');

  const doc = readDocuments(event).shopping_list;
  if (!doc) throw new EventDocumentError(404, 'The event has no shopping list yet. Draft and approve it in the Event Package.');
  if (doc.status !== 'approved') throw new EventDocumentError(409, 'Approve the shopping list in the Event Package before using it in the episode.');
  const listTasks = shoppingListTasks(doc);
  if (!listTasks.length) throw new EventDocumentError(409, 'The approved shopping list has no lines.');

  const [[row]] = await sequelize.query(
    'SELECT id, tasks, deleted_at FROM episode_todo_lists WHERE episode_id = :episodeId',
    { replacements: { episodeId } });
  const live = row && !row.deleted_at;
  const existing = live ? (parseJSON(row.tasks, []) || []) : [];
  const byKey = new Map(existing.map((t) => [taskKey(t), t]));
  const listKeys = new Set(listTasks.map(taskKey));

  const tasks = listTasks.map((t) => {
    const had = byKey.get(taskKey(t));
    return had ? { ...t, completed: had.completed === true } : t;
  });
  const keptDone = existing.filter((t) => t.completed === true && !listKeys.has(taskKey(t)));
  const next = [...tasks, ...keptDone];
  const added = listTasks.filter((t) => !byKey.has(taskKey(t))).length;
  const removed = existing.filter((t) => t.completed !== true && !listKeys.has(taskKey(t))).length;
  const changed = !live || added > 0 || removed > 0
    || JSON.stringify(next.map((t) => [taskKey(t), t.from_event_document?.version ?? null])) !== JSON.stringify(existing.map((t) => [taskKey(t), t.from_event_document?.version ?? null]));

  if (changed) {
    if (row) {
      await sequelize.query(
        `UPDATE episode_todo_lists SET tasks = CAST(:tasks AS jsonb), event_id = :eventId, deleted_at = NULL, updated_at = NOW()
          WHERE id = :id AND episode_id = :episodeId`,
        { replacements: { tasks: JSON.stringify(next), eventId: event.id, id: row.id, episodeId } });
    } else {
      await sequelize.query(
        `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, status, created_at, updated_at)
         VALUES (:id, :episodeId, :showId, :eventId, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
        { replacements: { id: require('crypto').randomUUID(), episodeId, showId: episode.show_id || null, eventId: event.id, tasks: JSON.stringify(next) } });
    }
  }
  return { added, removed, kept_done: keptDone.length, version: doc.version, tasks: next };
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
  useShoppingListInEpisode,
};
