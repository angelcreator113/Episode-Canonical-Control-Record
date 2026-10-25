/**
 * World Events routes — where the event goes next, for the Event Package
 *
 * GET    /api/v1/world/:showId/events/:eventId/flow
 * POST   /api/v1/world/:showId/events/:eventId/fill-missing
 *
 * Evoni, 2026-10-25: "What else can we improve on the event page and how it
 * flows?" … "I want them all and show me first". Part of the worldEvents
 * router; ./index.js mounts it.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/flow
//
// Read-only, no AI (services/eventFlowService). Each part fails on its own:
// a failed part is null and its message is under errors.<part>.
// 200 {
//   success: true,
//   beat14: { episode_id, host: { profile_id, name } | null, people,
//             attached: <opportunity> | null, best: <opportunity + fit> | null,
//             others, draft: { name, opportunity_type, from } | null } | null,
//   defaults: [{ field, value, source: 'brand'|'venue', basis }] | null,
//   clashes: { day, sameDay, doubleBooked, money, lines: [{ kind, field, text }] } | null,
//   errors?: { <part>: message }
// }
// 404 when the event is not live in this show.
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId/flow', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { loadEventFlow } = require('../../services/eventFlowService');
    const parts = await loadEventFlow(models, { showId, event });
    return res.json({ success: true, ...parts });
  } catch (err) {
    console.error('[EventFlow] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load what comes next for this event' });
  }
});

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/fill-missing
//
// Fill what's missing (services/eventFillMissingService): every empty field
// the page can fill, drafted at once. Writes nothing; the page saves the
// accepted drafts through the event PUT, so every draft is on that PUT's
// allowlist (update.js allowedFields) or dropped.
// 200 { success: true, data: { drafts: [{ field, label, value, source: 'ai'|'rate_card', reason }], asked: [field] } }
// 404 the event is not live in this show; 409 it has started its episode
// 429 the AI daily budget refused the call (aiCostTracker), with its reason
// 502 the model failed after its retries; 503 ANTHROPIC_API_KEY not configured
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/fill-missing', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.used_in_episode_id) {
      return res.status(409).json({ success: false, error: 'This event has started its episode, so its package is read-only.' });
    }
    const { EVENT_PUT_FIELDS } = require('./update');
    const { draftMissing } = require('../../services/eventFillMissingService');
    const result = await draftMissing(models, { showId, event, allowed: EVENT_PUT_FIELDS });
    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, error: result.error, ...(result.code ? { code: result.code } : {}) });
    }
    return res.json({ success: true, data: { drafts: result.drafts, asked: result.asked } });
  } catch (err) {
    console.error('[FillMissing] Error:', err);
    return res.status(500).json({ success: false, error: 'Couldn\'t draft the missing fields right now.' });
  }
});

module.exports = router;
