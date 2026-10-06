// routes/brainSyncRoutes.js
//
// Brain Update (Evoni, 2026-10-03, Brain Update step 1;
// docs/BRAIN_OWNERSHIP.md): a source page's Review Brain Update drawer.
// Mount at /api/v1
//
// POST /api/v1/franchise-brain/sync/:source/preview — what syncing this page would change (reads only)
// POST /api/v1/franchise-brain/sync/:source/apply   — apply the reviewed sync (fingerprint from the preview)
// GET  /api/v1/franchise-brain/sync/status          — per page, how many Brain cards it owns (reads only; World Setup)
//
// Body for both: { page_data } (the page's usePageData data map); apply
// also { fingerprint }. Both require auth; preview is a POST only because
// it carries the page. No AI is called.

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../models');
const { SyncError, previewSync, applySync, syncStatus } = require('../services/brainSyncService');

const fail = (res, err, what) => {
  if (err instanceof SyncError) return res.status(err.status).json({ error: err.message });
  console.error(`[BrainSync] ${what} failed:`, err);
  return res.status(500).json({ error: err.message });
};

router.get('/franchise-brain/sync/status', requireAuth, async (req, res) => {
  try {
    const data = await syncStatus(db.sequelize);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'status');
  }
});

router.post('/franchise-brain/sync/:source/preview', requireAuth, async (req, res) => {
  try {
    const data = await previewSync(db.sequelize, req.params.source, req.body?.page_data);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'preview');
  }
});

router.post('/franchise-brain/sync/:source/apply', requireAuth, async (req, res) => {
  try {
    const data = await applySync(db.sequelize, req.params.source, req.body?.page_data, req.body?.fingerprint);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'apply');
  }
});

module.exports = router;
