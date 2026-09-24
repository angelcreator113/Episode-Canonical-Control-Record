/**
 * Event Deliverables Routes (Task #1814, slice 1a)
 *
 * What Lala owes an event (docs/EVENT_EPISODE_FLOW.md §8(t) item 1). The
 * Event Package's Terms area edits them here; they lock at Start Episode,
 * the same moment the Package stops editing (world_events.
 * used_in_episode_id set), and a write after that is refused with 409.
 *
 * GET    /api/v1/world/:showId/events/:eventId/deliverables                  — List
 * POST   /api/v1/world/:showId/events/:eventId/deliverables                  — Add
 * PUT    /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId   — Edit
 * DELETE /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId   — Remove (soft)
 * POST   /api/v1/world/:showId/events/:eventId/deliverables/:deliverableId/status — Advance (Task #1815)
 *
 * The add/edit/remove routes edit only the terms themselves: description,
 * deliverable_type, due_date, required. The PUT refuses status and its
 * timestamps (400 DELIVERABLE_STATUS_NOT_EDITABLE).
 *
 * Fulfilment (slice 1b, §8(t) item 4) is the status POST alone: after
 * Start Episode a row moves pending → completed → submitted → approved,
 * one step forward at a time, each move stamping its own timestamp
 * (completed_at, submitted_at, approved_at). The rules are
 * validateDeliverableTransition (eventTermsService.js). Completing an
 * episode never moves a deliverable.
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
  DESCRIPTION_MAX, TYPE_MAX, DUE_DATE_MAX,
} = require('../services/eventTermsService');

const TERMS_LOCKED_CODE = 'EVENT_TERMS_LOCKED';
const STATUS_NOT_EDITABLE_CODE = 'DELIVERABLE_STATUS_NOT_EDITABLE';
const NOT_STARTED_CODE = 'DELIVERABLE_NOT_STARTED';
const STATUS_CONFLICT_CODE = 'DELIVERABLE_STATUS_CONFLICT';

// Fulfilment fields: written only by the status POST.
const FULFILMENT_FIELDS = ['status', 'completed_at', 'submitted_at', 'approved_at'];

const RETURNING = `RETURNING id, event_id, description, deliverable_type, due_date, required, status,
                 completed_at, submitted_at, approved_at, episode_id, created_at, updated_at`;

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

// The event, scoped to the show. null when absent or deleted.
async function loadEvent(sequelize, showId, eventId) {
  const [rows] = await sequelize.query(
    'SELECT id, show_id, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { eventId, showId } }
  );
  return rows?.[0] || null;
}

function lockedBody(event) {
  return {
    success: false,
    code: TERMS_LOCKED_CODE,
    error: 'This event\'s terms are locked: an episode has been started from it.',
    used_in_episode_id: event.used_in_episode_id,
  };
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
  for (const [key, max] of [['deliverable_type', TYPE_MAX], ['due_date', DUE_DATE_MAX]]) {
    if (b[key] === undefined) continue;
    if (b[key] === null) { fields[key] = null; continue; }
    if (typeof b[key] !== 'string') return { error: `${key} must be a string or null` };
    const v = b[key].trim();
    if (v.length > max) return { error: `${key} must be at most ${max} characters` };
    fields[key] = v || null;
  }
  if (b.required !== undefined) {
    if (typeof b.required !== 'boolean') return { error: 'required must be true or false' };
    fields.required = b.required;
  }
  return { fields };
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/deliverables
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId/deliverables', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const deliverables = await listEventDeliverables(models.sequelize, eventId);
    return res.json({ success: true, deliverables, locked: !!event.used_in_episode_id });
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

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.used_in_episode_id) return res.status(409).json(lockedBody(event));

    const f = parsed.fields;
    const [rows] = await models.sequelize.query(
      `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, due_date, required, status, created_at, updated_at)
       VALUES (:id, :eventId, :description, :deliverable_type, :due_date, :required, 'pending', NOW(), NOW())
       RETURNING id, event_id, description, deliverable_type, due_date, required, status,
                 completed_at, submitted_at, approved_at, episode_id, created_at, updated_at`,
      { replacements: {
        id: uuidv4(), eventId,
        description: f.description,
        deliverable_type: f.deliverable_type ?? null,
        due_date: f.due_date ?? null,
        required: f.required !== false,
      } }
    );
    return res.status(201).json({ success: true, deliverable: rows?.[0] || null });
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
      return res.status(400).json({ success: false, error: 'No editable fields sent (description, deliverable_type, due_date, required)' });
    }

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.used_in_episode_id) return res.status(409).json(lockedBody(event));

    const setClauses = keys.map((k) => `${k} = :${k}`);
    const [rows] = await models.sequelize.query(
      `UPDATE event_deliverables SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL
       RETURNING id, event_id, description, deliverable_type, due_date, required, status,
                 completed_at, submitted_at, approved_at, episode_id, created_at, updated_at`,
      { replacements: { ...parsed.fields, deliverableId, eventId } }
    );
    if (!rows?.[0]) return res.status(404).json({ success: false, error: 'Deliverable not found' });
    return res.json({ success: true, deliverable: rows[0] });
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

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.used_in_episode_id) return res.status(409).json(lockedBody(event));

    const [rows] = await models.sequelize.query(
      `UPDATE event_deliverables SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL
       RETURNING id`,
      { replacements: { deliverableId, eventId } }
    );
    if (!rows?.[0]) return res.status(404).json({ success: false, error: 'Deliverable not found' });
    return res.json({ success: true, deleted: rows[0].id });
  } catch (error) {
    console.error('Delete event deliverable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove deliverable', message: error.message });
  }
});


// ═══════════════════════════════════════════
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
    const [rows] = await models.sequelize.query(
      `UPDATE event_deliverables SET status = :to, ${check.timestampColumn} = NOW(), updated_at = NOW()
       WHERE id = :deliverableId AND event_id = :eventId AND deleted_at IS NULL AND status = :from
       ${RETURNING}`,
      { replacements: { to, from: deliverable.status, deliverableId, eventId } }
    );
    if (!rows?.[0]) {
      return res.status(409).json({
        success: false,
        code: STATUS_CONFLICT_CODE,
        error: 'The deliverable changed while this was being saved; reload and try again.',
      });
    }
    return res.json({ success: true, deliverable: rows[0] });
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
