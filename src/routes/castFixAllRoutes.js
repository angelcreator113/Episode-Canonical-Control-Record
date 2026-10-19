'use strict';

/**
 * Fix what can be fixed (services/castFixAll; Evoni, 2026-10-18), mounted
 * at /api/v1/cast/consistency beside The Cast's GET /consistency:
 *
 *   POST /api/v1/cast/consistency/fix-all { registry_id }   registry ids, comma-
 *        separated as in GET /consistency: every character through the steps
 *        their page has; rewrites come back queued (ADMIN; a few AI calls each)
 *   POST /api/v1/cast/consistency/apply-rewrites { items }   her one "Apply
 *        all": each queued rewrite swapped in, each "fine" kept as written;
 *        stale ones skipped (ADMIN)
 *   POST /api/v1/cast/consistency/undo { change }   one change from a run put
 *        back, unless it has changed since (409) (ADMIN)
 *   POST /api/v1/cast/consistency/fix-character/:id   one character's findings
 *        fixed at once from their page: rewrites applied, "fine" ones kept as
 *        written; { changes (each undoable), left, check } (ADMIN; one AI call)
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getModels = () => require('../models');
const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

function sendError(res, err, label) {
  const { FixAllError } = require('../services/castFixAll');
  if (err instanceof FixAllError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[CastFixAll] ${label} error:`, err);
  return res.status(err.status === 429 ? 429 : 500).json({ success: false, error: err.message });
}

router.post('/fix-all', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const ids = String(req.body?.registry_id || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length || ids.length > 20 || !ids.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ success: false, error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' });
    }
    const result = await require('../services/castFixAll').fixAll(getModels(), ids, { by: byOf(req) });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err, 'POST /consistency/fix-all');
  }
});

router.post('/fix-character/:id', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a character id (UUID)' });
    const result = await require('../services/castFixAll').fixCharacter(getModels(), req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err, 'POST /consistency/fix-character/:id');
  }
});

router.post('/apply-rewrites', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const results = await require('../services/castFixAll').applyQueued(getModels(), req.body?.items);
    return res.json({ success: true, results, applied: results.filter((r) => r.ok).length, skipped: results.filter((r) => !r.ok).length });
  } catch (err) {
    return sendError(res, err, 'POST /consistency/apply-rewrites');
  }
});

router.post('/undo', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const result = await require('../services/castFixAll').undoChange(getModels(), req.body?.change, { by: byOf(req) });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err, 'POST /consistency/undo');
  }
});

module.exports = router;
