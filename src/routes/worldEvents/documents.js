/**
 * World Events routes — event documents
 *
 * GET    /api/v1/world/:showId/events/:eventId/documents
 * POST   /api/v1/world/:showId/events/:eventId/documents/:type/draft
 * PUT    /api/v1/world/:showId/events/:eventId/documents/:type
 * POST   /api/v1/world/:showId/events/:eventId/documents/:type/approve
 * POST   /api/v1/world/:showId/events/:eventId/documents/:type/restore
 * POST   /api/v1/world/:showId/events/:eventId/documents/:type/lines/:index/redraft
 * POST   /api/v1/world/:showId/events/:eventId/documents/shopping_list/keep-look
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { isBudgetError } = require('../../services/imageCostService');
const { getModels } = require('./helpers');

// ── In-world documents beside the invitation (Evoni, 2026-10-06) ──
// The event's wardrobe shopping list and career plan, each Draft / Edit /
// Redraft / Approve like the invitation, stored in the event's
// canon_consequences.documents (src/services/eventDocumentsService.js).
// Episodes keep the lists they already have.
const eventDocumentsError = (res, err, where) => {
  console.error(`[EventDocuments] ${where} failed:`, err.message);
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, error: err.message });
};

// GET /world/:showId/events/:eventId/documents — both documents (null until drafted)
router.get('/world/:showId/events/:eventId/documents', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { getDocuments } = require('../../services/eventDocumentsService');
    const data = await getDocuments(models, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'GET documents');
  }
});

// POST /world/:showId/events/:eventId/documents/:type/draft — draft or redraft (one AI call);
// { budget: true } words a shopping list's pieces to buy for her shortfall
router.post('/world/:showId/events/:eventId/documents/:type/draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { draftDocument } = require('../../services/eventDocumentsService');
    const { showId, eventId, type } = req.params;
    const data = await draftDocument(models, { showId, eventId, type, version: req.body?.version, budget: req.body?.budget === true });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'draft');
  }
});

// PUT /world/:showId/events/:eventId/documents/:type — edit the items ({ items: [...], note? }),
// or an offer letter's words ({ letter: { greeting, opening, opportunity, next_steps, closing, sender_name, sender_title } })
router.put('/world/:showId/events/:eventId/documents/:type', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { editDocument } = require('../../services/eventDocumentsService');
    const { showId, eventId, type } = req.params;
    const data = await editDocument(models, { showId, eventId, type, items: req.body?.items, note: req.body?.note, letter: req.body?.letter, version: req.body?.version });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'edit');
  }
});

// POST /world/:showId/events/:eventId/documents/:type/approve — approve the current version
router.post('/world/:showId/events/:eventId/documents/:type/approve', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { approveDocument } = require('../../services/eventDocumentsService');
    const { showId, eventId, type } = req.params;
    const data = await approveDocument(models, { showId, eventId, type, version: req.body?.version });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'approve');
  }
});

// POST /world/:showId/events/:eventId/documents/:type/restore — { fromVersion, version? }
// An earlier version from history, as a new draft version (Undo uses it too).
router.post('/world/:showId/events/:eventId/documents/:type/restore', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { restoreDocument } = require('../../services/eventDocumentsService');
    const { showId, eventId, type } = req.params;
    const data = await restoreDocument(models, { showId, eventId, type, fromVersion: req.body?.fromVersion, version: req.body?.version });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'restore');
  }
});

// POST /world/:showId/events/:eventId/documents/:type/lines/:index/redraft — { version? }
// One line re-worded (one AI call), the rest kept; a new draft version.
router.post('/world/:showId/events/:eventId/documents/:type/lines/:index/redraft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { redraftLine } = require('../../services/eventDocumentsService');
    const { showId, eventId, type, index } = req.params;
    const data = await redraftLine(models, { showId, eventId, type, index, version: req.body?.version });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'line redraft');
  }
});

// POST /world/:showId/events/:eventId/documents/shopping_list/keep-look — { version? }
// Keep the list for the look as it is now ("Look changed" → Keep). No new version.
router.post('/world/:showId/events/:eventId/documents/shopping_list/keep-look', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { keepListForLook } = require('../../services/eventDocumentsService');
    const { showId, eventId } = req.params;
    const data = await keepListForLook(models, { showId, eventId, version: req.body?.version });
    return res.json({ success: true, data });
  } catch (err) {
    return eventDocumentsError(res, err, 'keep look');
  }
});

module.exports = router;
