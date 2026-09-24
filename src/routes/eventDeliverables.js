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
 *
 * Only the terms themselves are edited: description, deliverable_type,
 * due_date, required. Status and its timestamps are fulfilment (slice 1b)
 * and are not writable here; every row stays pending.
 *
 * Location: src/routes/eventDeliverables.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../middleware/auth');
const {
  listEventDeliverables, DESCRIPTION_MAX, TYPE_MAX, DUE_DATE_MAX,
} = require('../services/eventTermsService');

const TERMS_LOCKED_CODE = 'EVENT_TERMS_LOCKED';

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

module.exports = router;
module.exports.TERMS_LOCKED_CODE = TERMS_LOCKED_CODE;
