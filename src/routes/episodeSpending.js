/**
 * Event Spending Routes (the event cost split ruling, Evoni 2026-09-30;
 * docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa); build PR 4 of
 * docs/DEAL_COMPONENTS_DESIGN.md §6)
 *
 * "Event spending (drinks, valet, photo booth and other things Lala chooses
 * during the event) lives in the episode's Money tab, editable until
 * Complete, each line quantity × unit price, auto-drafted from the event's
 * extras as suggestions, charged at Complete like other costs."
 *
 * GET    /api/v1/world/:showId/episodes/:episodeId/spending            — List
 * POST   /api/v1/world/:showId/episodes/:episodeId/spending            — Add
 * PUT    /api/v1/world/:showId/episodes/:episodeId/spending/:lineId    — Edit
 * DELETE /api/v1/world/:showId/episodes/:episodeId/spending/:lineId    — Remove (soft)
 *
 * Once the episode is completed (its evaluation accepted, when Complete
 * charges the lines) every write is refused with 409 EPISODE_COMPLETED.
 * episodeSpendingService holds the rules.
 *
 * Location: src/routes/episodeSpending.js
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const {
  listSpending, readSpendingBody, isEpisodeCompleted, insertLine, spendingDraftState,
} = require('../services/episodeSpendingService');
const { findSourceEvent } = require('../services/episodeMoneyService');

const COMPLETED_CODE = 'EPISODE_COMPLETED';
const LINE_COLUMNS = `id, episode_id, event_id, label, quantity, unit_price, source, source_cost_id,
  drafted_quantity, drafted_unit_price, created_at, updated_at`;

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

const withState = (line) => (line ? { ...line, total: line.quantity * line.unit_price, draft_state: spendingDraftState(line) } : null);

// The episode, scoped to the show. null when absent or deleted. FOR UPDATE
// inside a write's transaction, so a write and Complete queue.
async function loadEpisode(sequelize, showId, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT id, show_id FROM episodes
      WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL LIMIT 1
      ${transaction ? 'FOR UPDATE' : ''}`,
    { replacements: { episodeId, showId }, transaction }
  );
  return rows?.[0] || null;
}

const completedBody = () => ({
  success: false,
  code: COMPLETED_CODE,
  error: 'This episode is complete: its event spending was charged and can no longer be edited.',
});

/**
 * Runs a spending write in one transaction, after the checks every write
 * shares: the episode exists in the show and is not completed.
 * `write(t, episode, sequelize)` returns { status, body }.
 */
async function withWritableEpisode(req, res, label, write) {
  try {
    const { showId, episodeId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { sequelize } = models;

    const result = await sequelize.transaction(async (transaction) => {
      const episode = await loadEpisode(sequelize, showId, episodeId, { transaction });
      if (!episode) return { status: 404, body: { success: false, error: 'Episode not found' } };
      if (await isEpisodeCompleted(sequelize, episodeId, { transaction })) return { status: 409, body: completedBody() };
      return write(transaction, episode, sequelize);
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(`${label} error:`, error);
    return res.status(500).json({ success: false, error: `Failed to ${label.toLowerCase()}`, message: error.message });
  }
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/episodes/:episodeId/spending
// ═══════════════════════════════════════════

router.get('/world/:showId/episodes/:episodeId/spending', requireAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const episode = await loadEpisode(models.sequelize, showId, episodeId);
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });

    const lines = (await listSpending(models.sequelize, episodeId)).map(withState);
    return res.json({
      success: true,
      lines,
      total: lines.reduce((sum, l) => sum + l.total, 0),
      editable: !(await isEpisodeCompleted(models.sequelize, episodeId)),
    });
  } catch (error) {
    console.error('List event spending error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load event spending', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/episodes/:episodeId/spending
// A line added by hand: no source, no drafted copy.
// ═══════════════════════════════════════════

router.post('/world/:showId/episodes/:episodeId/spending', requireAuth, (req, res) => {
  const parsed = readSpendingBody(req.body, { partial: false });
  if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
  return withWritableEpisode(req, res, 'Add spending', async (transaction, episode, sequelize) => {
    const event = await findSourceEvent(sequelize, episode.id);
    const line = await insertLine(sequelize, {
      ...parsed.fields, episode_id: episode.id, event_id: event?.id || null,
    }, { transaction });
    return { status: 201, body: { success: true, line: withState(line) } };
  });
});


// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/episodes/:episodeId/spending/:lineId
// ═══════════════════════════════════════════

router.put('/world/:showId/episodes/:episodeId/spending/:lineId', requireAuth, (req, res) => {
  const parsed = readSpendingBody(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
  const keys = Object.keys(parsed.fields);
  if (keys.length === 0) {
    return res.status(400).json({ success: false, error: 'No editable fields sent (label, quantity, unit_price)' });
  }
  return withWritableEpisode(req, res, 'Update spending', async (transaction, episode, sequelize) => {
    // Field names come from readSpendingBody's fixed list, never from the request.
    const setClauses = keys.map((k) => `${k} = :${k}`).join(', ');
    const [rows] = await sequelize.query(
      `UPDATE episode_spending_lines SET ${setClauses}, updated_at = NOW()
        WHERE id = :lineId AND episode_id = :episodeId AND deleted_at IS NULL
        RETURNING ${LINE_COLUMNS}`,
      { replacements: { ...parsed.fields, lineId: req.params.lineId, episodeId: episode.id }, transaction }
    );
    if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Spending line not found' } };
    return { status: 200, body: { success: true, line: withState(rows[0]) } };
  });
});


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/episodes/:episodeId/spending/:lineId
// Soft delete (deleted_at).
// ═══════════════════════════════════════════

router.delete('/world/:showId/episodes/:episodeId/spending/:lineId', requireAuth, (req, res) => withWritableEpisode(
  req, res, 'Remove spending', async (transaction, episode, sequelize) => {
    const [rows] = await sequelize.query(
      `UPDATE episode_spending_lines SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = :lineId AND episode_id = :episodeId AND deleted_at IS NULL
        RETURNING id`,
      { replacements: { lineId: req.params.lineId, episodeId: episode.id }, transaction }
    );
    if (!rows?.[0]) return { status: 404, body: { success: false, error: 'Spending line not found' } };
    return { status: 200, body: { success: true, deleted: rows[0].id } };
  }
));

module.exports = router;
