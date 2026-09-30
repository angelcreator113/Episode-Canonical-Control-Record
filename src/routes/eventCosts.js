/**
 * Event Costs Routes (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md §5)
 *
 * A deal event's itemised costs, and who pays each (Law 7). The Event
 * Package's Terms area edits them here. Finalize charges each row Lala pays
 * (paid_by 'lala'); a row the host or brand pays is comped and never charged
 * (Law 6). eventCostsService holds the rules.
 *
 * GET    /api/v1/world/:showId/events/:eventId/costs                 — List
 * POST   /api/v1/world/:showId/events/:eventId/costs                 — Add
 * PUT    /api/v1/world/:showId/events/:eventId/costs/:costId         — Edit
 * DELETE /api/v1/world/:showId/events/:eventId/costs/:costId         — Remove (soft)
 * POST   /api/v1/world/:showId/events/:eventId/costs/draft-extras    — Draft the extras
 *
 * Only a deal event (deal_type set) takes costs: a legacy event is charged
 * its cost_coins entry cost and styling extras as before (D8), so a write
 * to one is refused with 400 EVENT_NOT_A_DEAL.
 *
 * The rows lock with the terms (D4): once findTermsLockEpisode finds the
 * episode the event started, every write is refused with 409
 * EVENT_TERMS_LOCKED.
 *
 * Location: src/routes/eventCosts.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../middleware/auth');
const { findTermsLockEpisode, termsLockedBody } = require('../utils/eventTermsLock');
const {
  isDealEvent, listEventCosts, readCostBody, draftExtrasCosts,
} = require('../services/eventCostsService');

const NOT_A_DEAL_CODE = 'EVENT_NOT_A_DEAL';
const COST_COLUMNS = 'id, event_id, kind, label, amount, paid_by, created_at, updated_at';

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[EventCosts] canon_consequences parse failed:', err.message);
    return fallback;
  }
}

// The event, scoped to the show. null when absent or deleted. FOR UPDATE
// inside a write's transaction, so two writes to one event queue.
async function loadEvent(sequelize, showId, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT id, show_id, deal_type, canon_consequences FROM world_events
      WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1
      ${transaction ? 'FOR UPDATE' : ''}`,
    { replacements: { eventId, showId }, transaction }
  );
  return rows?.[0] || null;
}

// The drafted amounts (doctrine rule 14): { <cost id>: { key, amount } }.
function draftedCostsOf(event) {
  const cc = parseJson(event?.canon_consequences, {}) || {};
  return cc.automation?.drafted_values?.costs || {};
}

const notADealBody = () => ({
  success: false,
  code: NOT_A_DEAL_CODE,
  error: 'Itemised costs are for deal events. Choose a deal type first; this event is charged its entry cost.',
});

/**
 * Runs a cost write in one transaction, after the checks every write
 * shares: the event exists, is a deal, and its terms are not locked.
 * `write(t, event)` returns { status, body }.
 */
async function withWritableEvent(req, res, label, write) {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { sequelize } = models;

    const result = await sequelize.transaction(async (transaction) => {
      const event = await loadEvent(sequelize, showId, eventId, { transaction });
      if (!event) return { status: 404, body: { success: false, error: 'Event not found' } };
      if (!isDealEvent(event)) return { status: 400, body: notADealBody() };
      const lockEpisode = await findTermsLockEpisode(sequelize, eventId, { transaction });
      if (lockEpisode) return { status: 409, body: termsLockedBody(lockEpisode, ['costs']) };
      return write(transaction, event, sequelize);
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(`${label} error:`, error);
    return res.status(500).json({ success: false, error: `Failed to ${label.toLowerCase()}`, message: error.message });
  }
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/costs
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId/costs', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadEvent(models.sequelize, showId, eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const costs = await listEventCosts(models.sequelize, eventId);
    const lockEpisode = await findTermsLockEpisode(models.sequelize, eventId);
    return res.json({
      success: true,
      costs,
      drafted: draftedCostsOf(event),
      deal: isDealEvent(event),
      locked: !!lockEpisode,
    });
  } catch (error) {
    console.error('List event costs error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load costs', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/costs/draft-extras
// Declared before /costs/:costId so the path is not read as a cost id.
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/costs/draft-extras', requireAuth, (req, res) => withWritableEvent(
  req, res, 'Draft extras', async (transaction, event, sequelize) => {
    const drafted = await draftExtrasCosts(sequelize, event.id, { transaction });
    const costs = await listEventCosts(sequelize, event.id, { transaction });
    return { status: 200, body: { success: true, drafted, costs } };
  }
));


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/costs
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/costs', requireAuth, (req, res) => {
  const parsed = readCostBody(req.body, { partial: false });
  if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
  return withWritableEvent(req, res, 'Add cost', async (transaction, event, sequelize) => {
    const f = parsed.fields;
    const [rows] = await sequelize.query(
      `INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
       VALUES (:id, :eventId, :kind, :label, :amount, :paid_by, clock_timestamp(), clock_timestamp())
       RETURNING ${COST_COLUMNS}`,
      { replacements: {
        id: uuidv4(), eventId: event.id, kind: f.kind, label: f.label ?? null,
        amount: f.amount, paid_by: f.paid_by || 'lala',
      }, transaction }
    );
    return { status: 201, body: { success: true, cost: rows?.[0] || null } };
  });
});


// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/events/:eventId/costs/:costId
// ═══════════════════════════════════════════

router.put('/world/:showId/events/:eventId/costs/:costId', requireAuth, (req, res) => {
  const parsed = readCostBody(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
  const keys = Object.keys(parsed.fields);
  if (keys.length === 0) {
    return res.status(400).json({ success: false, error: 'No editable fields sent (kind, label, amount, paid_by)' });
  }
  return withWritableEvent(req, res, 'Update cost', async (transaction, event, sequelize) => {
    // Field names come from readCostBody's fixed list, never from the request.
    const setClauses = keys.map((k) => `${k} = :${k}`).join(', ');
    const [rows] = await sequelize.query(
      `UPDATE event_costs SET ${setClauses}, updated_at = NOW()
        WHERE id = :costId AND event_id = :eventId AND deleted_at IS NULL
        RETURNING ${COST_COLUMNS}`,
      { replacements: { ...parsed.fields, costId: req.params.costId, eventId: event.id }, transaction }
    );
    if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Cost not found' } };
    return { status: 200, body: { success: true, cost: rows[0] } };
  });
});


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/events/:eventId/costs/:costId
// Soft delete (deleted_at), like every other event child.
// ═══════════════════════════════════════════

router.delete('/world/:showId/events/:eventId/costs/:costId', requireAuth, (req, res) => withWritableEvent(
  req, res, 'Remove cost', async (transaction, event, sequelize) => {
    const [rows] = await sequelize.query(
      `UPDATE event_costs SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = :costId AND event_id = :eventId AND deleted_at IS NULL
        RETURNING id`,
      { replacements: { costId: req.params.costId, eventId: event.id }, transaction }
    );
    if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Cost not found' } };
    return { status: 200, body: { success: true, deleted: rows[0].id } };
  }
));

module.exports = router;
