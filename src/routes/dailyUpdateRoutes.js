'use strict';
/**
 * The daily update (automation step 2; services/dailyUpdate). Mounted at
 * /api/v1/daily-update.
 *
 *   GET /?since=&now=   since yesterday, waiting for her, the next three
 *                       days and today's AI spend, across every show
 *                       (ADMIN: it lists drafts, secrets and deals). Reads
 *                       only; deciding an item goes through that item's own
 *                       endpoint (listed in services/dailyUpdate).
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { dailyUpdate, DailyUpdateError } = require('../services/dailyUpdate');
    try {
      const update = await dailyUpdate(require('../models'), { since: req.query.since || null, now: req.query.now || null });
      return res.json({ success: true, ...update });
    } catch (err) {
      if (err instanceof DailyUpdateError) return res.status(err.status).json({ success: false, error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[DailyUpdate] GET / error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
