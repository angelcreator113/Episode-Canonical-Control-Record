/**
 * Event Deliverables Routes (Task #1814, slice 1a)
 *
 * What Lala owes an event (docs/EVENT_EPISODE_FLOW.md §8(t) item 1). The
 * Event Package's Terms area edits them here; they lock at Start Episode,
 * the same moment the Package stops editing, and a write after that is
 * refused with 409. The lock is the one every term-writing route asks,
 * findTermsWriteLock (src/utils/eventTermsLock.js): the live brief naming
 * the event, else used_in_episode_id, lifted while the terms are reopened —
 * the same lock the costs routes and the event PUT use (audit Medium,
 * 2026-10-23). Each write runs in one transaction with the event row locked
 * (FOR UPDATE), as the costs routes' withWritableEvent does.
 *
 * GET    /api/v1/world/:showId/events/:eventId/deliverables                  — List
 * POST   /api/v1/world/:showId/events/:eventId/deliverables                  — Add
 * PUT    /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId   — Edit
 * DELETE /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId   — Remove (soft)
 * POST   /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId/status — Advance (Task #1815)
 *
 * The add/edit/remove routes edit only the terms themselves: description,
 * deliverable_type (one of the D15 formats in src/utils/deliverableFormats.js,
 * or null), platform (one the format allows; defaulted when it has only one)
 * and quantity (pieces, slides or days; ruling D15, 2026-09-30), due_date,
 * required, owed_to (host | brand; Task #2294) and fee. The PUT refuses
 * status and its timestamps (400 DELIVERABLE_STATUS_NOT_EDITABLE).
 *
 * Fulfilment (slice 1b, §8(t) item 4) is the status POST alone: after
 * Start Episode a row moves pending → completed → submitted → approved,
 * one step forward at a time, each move stamping its own timestamp
 * (completed_at, submitted_at, approved_at). The rules are
 * validateDeliverableTransition (eventTermsService.js). Completing an
 * episode never moves a deliverable. Approval pays a deal's content fee
 * (deal build PR 5, dealPayoutService.bookContentFee), in the same
 * transaction as the move.
 *
 * Location: src/routes/eventDeliverables.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../middleware/auth');
const {
  listEventDeliverables, validateDeliverableTransition, DELIVERABLE_STATUS_FLOW,
  DESCRIPTION_MAX, DUE_DATE_MAX, DELIVERABLE_OWED_TO, DELIVERABLE_TYPES,
} = require('../services/eventTermsService');
const { syncDraftedDealType } = require('../services/dealTypeDraftService');
const {
  formatOf, PLATFORMS, QUANTITY_MIN, QUANTITY_MAX,
} = require('../utils/deliverableFormats');
const { findTermsWriteLock } = require('../utils/eventTermsLock');
const { loadScopedEvent, assertTermsWritable } = require('../utils/eventScope');
const { withDeliverableDone, DELIVERABLE_DONE_STATUS } = require('../utils/socialTaskSource');

const TERMS_LOCKED_CODE = 'EVENT_TERMS_LOCKED';
const STATUS_NOT_EDITABLE_CODE = 'DELIVERABLE_STATUS_NOT_EDITABLE';
const NOT_STARTED_CODE = 'DELIVERABLE_NOT_STARTED';
const STATUS_CONFLICT_CODE = 'DELIVERABLE_STATUS_CONFLICT';

// Fulfilment fields: written only by the status POST.
const FULFILMENT_FIELDS = ['status', 'completed_at', 'submitted_at', 'approved_at'];

const RETURNING = `RETURNING id, event_id, description, deliverable_type, platform, quantity, due_date, required, status,
                 completed_at, submitted_at, approved_at, episode_id, owed_to, fee, created_at, updated_at`;

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

// The event, scoped to the show (loadScopedEvent, utils/eventScope.js).
// null when absent or deleted. FOR UPDATE inside a write's transaction, so
// two writes to one event queue.
function loadEvent(sequelize, showId, eventId, { transaction } = {}) {
  return loadScopedEvent(sequelize, {
    showId, eventId, transaction, lock: !!transaction,
    columns: 'id, show_id, used_in_episode_id, canon_consequences',
  });
}

// The episode that locks this event's terms, or null: the shared lock
// (findTermsWriteLock), so the deliverables, the costs and the event PUT
// never disagree. Reopened terms (Reopen ruling, §8(cc); Task #2378) lift it.
function findLock(sequelize, eventId, { transaction } = {}) {
  return findTermsWriteLock(sequelize, eventId, { transaction });
}

function lockedBody(event, lockEpisode) {
  return {
    success: false,
    code: TERMS_LOCKED_CODE,
    error: 'This event\'s terms are locked: an episode has been started from it.',
    used_in_episode_id: event.used_in_episode_id || lockEpisode?.id || null,
    episode: lockEpisode ? { id: lockEpisode.id, episode_number: lockEpisode.episode_number ?? null, title: lockEpisode.title ?? null } : null,
  };
}

/**
 * Runs a deliverable write in one transaction, after the checks every write
 * shares: the event exists in this show (locked FOR UPDATE) and its terms
 * are not locked. `write(transaction, event)` returns { status, body }.
 */
async function withWritableEvent(sequelize, showId, eventId, write) {
  return sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, showId, eventId, { transaction });
    if (!event) return { status: 404, body: { success: false, error: 'Event not found' } };
    // The shared terms check (assertTermsWritable), answered with this
    // route's own 409 body.
    const refusal = await assertTermsWritable(sequelize, eventId, {
      transaction, body: (lockEpisode) => lockedBody(event, lockEpisode),
    });
    if (refusal) return { status: refusal.status, body: refusal.body };
    return write(transaction, event);
  });
}

/**
 * Validates the editable fields. `partial` (PUT) allows any subset; POST
 * requires a description. Returns { fields } or { error }.
 */
function readDeliverableBody(body, { partial }) {
  const b = body && typeof body === 'object' ? body : {};
  const fields = {};

  if (b.description !== undefined || !partial) {
    const description = typeof b.description === 'string' ? b.description.trim() : '';
    if (!description) return { error: 'description is required' };
    if (description.length > DESCRIPTION_MAX) return { error: `description must be at most ${DESCRIPTION_MAX} characters` };
    fields.description = description;
  }
  // The fixed deliverable types (Evoni's Deal PR 3 ruling, QUESTION 2;
  // Task #2341): one of DELIVERABLE_TYPES, or null. Free text is refused, so
  // no price can depend on words in it.
  if (b.deliverable_type !== undefined) {
    if (b.deliverable_type !== null && !DELIVERABLE_TYPES.includes(b.deliverable_type)) {
      return { error: `deliverable_type must be one of ${DELIVERABLE_TYPES.join(', ')}, or null` };
    }
    fields.deliverable_type = b.deliverable_type;
  }
  // D15: the account (The Pulse, a private Pulse account, The PlayRoom), one
  // the format allows (checked against the type when both are sent), or
  // null. A type sent without one takes the format's first, The Pulse.
  if (b.platform !== undefined) {
    if (b.platform !== null && !PLATFORMS.includes(b.platform)) {
      return { error: `platform must be one of ${PLATFORMS.join(', ')}, or null` };
    }
    fields.platform = b.platform;
  }
  const format = formatOf(fields.deliverable_type);
  if (format && fields.platform != null && !format.platforms.includes(fields.platform)) {
    return { error: `${format.label} does not go on ${fields.platform}; choose ${format.platforms.join(' or ') || 'no platform'}` };
  }
  if (format && fields.platform === undefined) {
    fields.platform = format.platforms[0] || null;
  }
  // D15: the quantity (pieces, slides or days), a whole number.
  if (b.quantity !== undefined) {
    const quantity = Number(b.quantity);
    if (!Number.isInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
      return { error: `quantity must be a whole number from ${QUANTITY_MIN} to ${QUANTITY_MAX}` };
    }
    fields.quantity = quantity;
  }
  if (b.due_date !== undefined) {
    if (b.due_date === null) fields.due_date = null;
    else {
      if (typeof b.due_date !== 'string') return { error: 'due_date must be a string or null' };
      const v = b.due_date.trim();
      if (v.length > DUE_DATE_MAX) return { error: `due_date must be at most ${DUE_DATE_MAX} characters` };
      fields.due_date = v || null;
    }
  }
  if (b.required !== undefined) {
    if (typeof b.required !== 'boolean') return { error: 'required must be true or false' };
    fields.required = b.required;
  }
  // Who it is owed to (T2, §8(bb); Task #2294): host or brand.
  if (b.owed_to !== undefined) {
    if (!DELIVERABLE_OWED_TO.includes(b.owed_to)) return { error: `owed_to must be one of ${DELIVERABLE_OWED_TO.join(', ')}` };
    fields.owed_to = b.owed_to;
  }
  // The deliverable's fee in Prime Coins, paid on approval (deal build PR 3,
  // Task #2341): a whole number, 0 or more, or null. Propose terms drafts it.
  if (b.fee !== undefined) {
    if (b.fee === null || b.fee === '') { fields.fee = null; } else {
      const fee = Number(b.fee);
      if (!Number.isInteger(fee) || fee < 0) return { error: 'fee must be a whole number of Prime Coins, 0 or more, or null' };
      fields.fee = fee;
    }
  }
  return { fields };
}


/**
 * The GET's data: { deliverables, locked }, or null when the event is not
 * live in this show. Shared with the Event Package's combined GET
 * (worldEvents.js, /events/:eventId/package).
 */
async function loadDeliverables(sequelize, { showId, eventId }) {
  const event = await loadEvent(sequelize, showId, eventId);
  if (!event) return null;
  const deliverables = await listEventDeliverables(sequelize, eventId);
  const lockEpisode = await findLock(sequelize, eventId);
  return { deliverables, locked: !!lockEpisode };
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/deliverables
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId/deliverables', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const data = await loadDeliverables(models.sequelize, { showId, eventId });
    if (!data) return res.status(404).json({ success: false, error: 'Event not found' });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('List event deliverables error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load deliverables', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/deliverables
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/deliverables', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const parsed = readDeliverableBody(req.body, { partial: false });
    if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });

    const f = parsed.fields;
    const result = await withWritableEvent(models.sequelize, showId, eventId, async (transaction) => {
      const [rows] = await models.sequelize.query(
      `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, platform, quantity, due_date, required, owed_to, fee, status, created_at, updated_at)
       VALUES (:id, :eventId, :description, :deliverable_type, :platform, :quantity, :due_date, :required, :owed_to, :fee, 'pending', NOW(), NOW())
       RETURNING id, event_id, description, deliverable_type, platform, quantity, due_date, required, status,
                 completed_at, submitted_at, approved_at, episode_id, owed_to, fee, created_at, updated_at`,
      { replacements: {
        id: uuidv4(), eventId,
        description: f.description,
        deliverable_type: f.deliverable_type ?? null,
        platform: f.platform ?? null,
        quantity: f.quantity ?? formatOf(f.deliverable_type)?.defaultQuantity ?? 1,
        due_date: f.due_date ?? null,
        required: f.required !== false,
        owed_to: f.owed_to || 'host',
        fee: f.fee ?? null,
      }, transaction }
      );
      return { status: 201, body: { success: true, deliverable: rows?.[0] || null } };
    });
    // A brand-owed deliverable can change an Auto-drafted deal type (Task
    // #2330); after the commit, in its own transaction.
    if (result.status === 201) await syncDraftedDealType(models.sequelize, eventId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Create event deliverable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add deliverable', message: error.message });
  }
});


// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId
// ═══════════════════════════════════════════

router.put('/world/:showId/events/:eventId/deliverables/:deliverableId', requireAuth, async (req, res) => {
  try {
    const { showId, eventId, deliverableId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const sentFulfilment = FULFILMENT_FIELDS.filter((k) => req.body && typeof req.body === 'object' && req.body[k] !== undefined);
    if (sentFulfilment.length) {
      return res.status(400).json({
        success: false,
        code: STATUS_NOT_EDITABLE_CODE,
        error: `${sentFulfilment.join(', ')} cannot be edited here; fulfilment is recorded through POST .../deliverables/:deliverableId/status`,
      });
    }

    const parsed = readDeliverableBody(req.body, { partial: true });
    if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
    const keys = Object.keys(parsed.fields);
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'No editable fields sent (description, deliverable_type, platform, quantity, due_date, required, owed_to, fee)' });
    }

    const setClauses = keys.map((k) => `${k} = :${k}`);
    const result = await withWritableEvent(models.sequelize, showId, eventId, async (transaction) => {
      const [rows] = await models.sequelize.query(
        `UPDATE event_deliverables SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL
         RETURNING id, event_id, description, deliverable_type, platform, quantity, due_date, required, status,
                   completed_at, submitted_at, approved_at, episode_id, owed_to, fee, created_at, updated_at`,
        { replacements: { ...parsed.fields, deliverableId, eventId }, transaction }
      );
      if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Deliverable not found' } };
      return { status: 200, body: { success: true, deliverable: rows[0] } };
    });
    if (result.status === 200 && parsed.fields.owed_to !== undefined) await syncDraftedDealType(models.sequelize, eventId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Update event deliverable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update deliverable', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId
// Soft delete (deleted_at), like every other event child.
// ═══════════════════════════════════════════

router.delete('/world/:showId/events/:eventId/deliverables/:deliverableId', requireAuth, async (req, res) => {
  try {
    const { showId, eventId, deliverableId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const result = await withWritableEvent(models.sequelize, showId, eventId, async (transaction) => {
      const [rows] = await models.sequelize.query(
        `UPDATE event_deliverables SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL
         RETURNING id`,
        { replacements: { deliverableId, eventId }, transaction }
      );
      if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Deliverable not found' } };
      return { status: 200, body: { success: true, deleted: rows[0].id } };
    });
    if (result.status === 200) await syncDraftedDealType(models.sequelize, eventId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Delete event deliverable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove deliverable', message: error.message });
  }
});


// ═══════════════════════════════════════════
/** Ticks the episode's task for a deliverable, with the list row locked. */
async function markDeliverableTaskDone(sequelize, { episodeId, deliverableId, transaction }) {
  if (!episodeId) return false;
  const [rows] = await sequelize.query(
    'SELECT id, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
    { replacements: { episodeId }, transaction }
  );
  const row = rows?.[0];
  if (!row) return false;
  let list = row.social_tasks;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list || '[]');
    } catch (err) {
      console.error('[EventDeliverables] the episode\'s task list is not JSON, its task was left as it is:', err.message);
      return false;
    }
  }
  const next = withDeliverableDone(list, deliverableId);
  if (!next) return false;
  await sequelize.query(
    'UPDATE episode_todo_lists SET social_tasks = :tasks, updated_at = NOW() WHERE id = :id',
    { replacements: { tasks: JSON.stringify(next), id: row.id }, transaction }
  );
  return true;
}

// POST /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId/status
// Body: { status: 'completed' | 'submitted' | 'approved' }
// Records fulfilment (Task #1815). Only after Start Episode; one step
// forward at a time; stamps that status's timestamp.
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/deliverables/:deliverableId/status', requireAuth, async (req, res) => {
  try {
    const { showId, eventId, deliverableId } = req.params;
    const to = req.body && typeof req.body === 'object' ? req.body.status : undefined;
    // An unknown status is refused before anything is read. 'pending' is
    // known but is never a forward move; the transition check refuses it.
    if (typeof to !== 'string' || !DELIVERABLE_STATUS_FLOW.includes(to)) {
      const unknown = validateDeliverableTransition('pending', null);
      return res.status(400).json({ success: false, code: unknown.code, error: unknown.error });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const [found] = await models.sequelize.query(
      `SELECT id, event_id, status, episode_id FROM event_deliverables
       WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { deliverableId, eventId } }
    );
    const deliverable = found?.[0];
    if (!deliverable) return res.status(404).json({ success: false, error: 'Deliverable not found' });

    // Before Start Episode the terms are still being edited.
    if (!event.used_in_episode_id && !deliverable.episode_id) {
      return res.status(409).json({
        success: false,
        code: NOT_STARTED_CODE,
        error: 'Fulfilment is recorded after Start Episode; this event\'s terms are still being edited.',
      });
    }

    const check = validateDeliverableTransition(deliverable.status, to);
    if (!check.ok) {
      return res.status(400).json({ success: false, code: check.code, error: check.error, status: deliverable.status });
    }

    // check.timestampColumn comes from DELIVERABLE_STATUS_TIMESTAMP, never
    // from the request. The status guard makes the move compare-and-set.
    // The move to approved and its content fee (deal build PR 5;
    // DEAL_DESIGN.md §4) commit together: a deal that pays deliverables pays
    // the deliverable's fee once, when Evoni approves it (D6 keeps the move
    // manual). A failed booking rolls the approval back.
    const { sequelize } = models;
    const { rows, contentFee } = await sequelize.transaction(async (transaction) => {
      const [moved] = await sequelize.query(
        `UPDATE event_deliverables SET status = :to, ${check.timestampColumn} = NOW(), updated_at = NOW()
         WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL AND status = :from
         ${RETURNING}`,
        { replacements: { to, from: deliverable.status, deliverableId, eventId }, transaction }
      );
      if (!moved?.[0]) return { rows: moved, contentFee: null };
      // Submitted: the deliverable's task on the episode's list is done, in
      // the same transaction (Evoni, 2026-10-26). This route is the only way
      // a deliverable's task completes; the manual ticks refuse it.
      if (to === DELIVERABLE_DONE_STATUS) {
        await markDeliverableTaskDone(sequelize, { episodeId: deliverable.episode_id || event.used_in_episode_id, deliverableId, transaction });
      }
      if (to !== 'approved') return { rows: moved, contentFee: null };
      const [dealRows] = await sequelize.query(
        `SELECT id, name, deal_type, deal_components, host, host_brand, used_in_episode_id FROM world_events WHERE id = :eventId`,
        { replacements: { eventId }, transaction }
      );
      const { bookContentFee } = require('../services/dealPayoutService');
      const fee = await bookContentFee(sequelize, { showId, event: dealRows?.[0], deliverable: moved[0], transaction });
      return { rows: moved, contentFee: fee };
    });
    if (!rows?.[0]) {
      return res.status(409).json({
        success: false,
        code: STATUS_CONFLICT_CODE,
        error: 'The deliverable changed while this was being saved; reload and try again.',
      });
    }
    // Fulfilled: an approved deliverable proposes Lala's follower change for
    // Review (Task #3086). After the commit; a failure is logged, never thrown.
    if (to === 'approved') {
      try {
        await require('../services/pulseFollowers').proposeFromDeliverable(models, { showId, deliverable: rows[0] });
      } catch (err) {
        console.error('[EventDeliverables] the follower change could not be proposed:', err.message);
      }
    }
    return res.json({ success: true, deliverable: rows[0], content_fee: contentFee });
  } catch (error) {
    console.error('Advance event deliverable status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record deliverable status', message: error.message });
  }
});

module.exports = router;
module.exports.TERMS_LOCKED_CODE = TERMS_LOCKED_CODE;
module.exports.STATUS_NOT_EDITABLE_CODE = STATUS_NOT_EDITABLE_CODE;
module.exports.NOT_STARTED_CODE = NOT_STARTED_CODE;
module.exports.STATUS_CONFLICT_CODE = STATUS_CONFLICT_CODE;
module.exports.loadDeliverables = loadDeliverables;
