/**
 * Reopen terms routes (Evoni's Reopen terms ruling, docs/EVENT_EPISODE_FLOW.md
 * §8(cc), 2026-09-30; Task #2378). The rules and the rebuild are in
 * services/termsReopenService.js.
 *
 * GET  /api/v1/world/:showId/events/:eventId/terms/reopen-eligibility — can these terms be reopened, and why not
 * POST /api/v1/world/:showId/events/:eventId/terms/reopen             — reopen (ADMIN; body { confirm: true })
 * POST /api/v1/world/:showId/events/:eventId/terms/relock             — Save and relock, rebuilding what Start Episode built (ADMIN)
 *
 * Location: src/routes/eventTermsReopen.js
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth, authorize } = require('../middleware/auth');
const { reopenEligibility, reopenTerms, relockTerms } = require('../services/termsReopenService');

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

router.get('/world/:showId/events/:eventId/terms/reopen-eligibility', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const [rows] = await models.sequelize.query(
      'SELECT id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId } }
    );
    if (!rows?.[0]) return res.status(404).json({ success: false, error: 'Event not found' });

    const check = await reopenEligibility(models.sequelize, eventId);
    const reopened = check.reopened
      ? { at: check.reopened.at ?? null, by: check.reopened.by ?? null, episode_id: check.reopened.episode_id ?? null }
      : null;
    return res.json({ success: true, eligible: check.eligible && !reopened, reasons: check.reasons, episode: check.episode, reopened });
  } catch (error) {
    console.error('Terms reopen eligibility error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check whether the terms can be reopened', message: error.message });
  }
});

router.post('/world/:showId/events/:eventId/terms/reopen', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const result = await reopenTerms(models.sequelize, {
      showId, eventId, user: req.user, confirm: req.body?.confirm,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Terms reopen error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reopen the terms', message: error.message });
  }
});

router.post('/world/:showId/events/:eventId/terms/relock', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const result = await relockTerms(models.sequelize, { showId, eventId, user: req.user });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Terms relock error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save and relock the terms', message: error.message });
  }
});

module.exports = router;
