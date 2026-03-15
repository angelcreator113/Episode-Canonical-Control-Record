'use strict';

/**
 * feedSchedulerRoutes.js — Feed Automation Scheduler API
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/feed-scheduler', feedSchedulerRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /status          — scheduler status + last run summary
 * GET    /history         — past run reports (newest first)
 * GET    /config          — current scheduler configuration
 * PUT    /config          — update scheduler configuration
 * POST   /start           — start the scheduler
 * POST   /stop            — stop the scheduler
 * POST   /run-now         — trigger a single cycle immediately
 * POST   /fill-one        — generate a single profile (for testing)
 * GET    /layer-status    — current cap counts for both layers
 */

const express = require('express');
const router  = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  getHistory,
  getConfig,
  updateConfig,
  runManualCycle,
  generateCreatorSpark,
  generateAndSaveProfile,
  setDb,
} = require('../services/feedScheduler');

// ── GET /status ─────────────────────────────────────────────────────────────
router.get('/status', optionalAuth, (req, res) => {
  res.json(getSchedulerStatus());
});

// ── GET /history ────────────────────────────────────────────────────────────
router.get('/history', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const history = getHistory();
  res.json({ history: history.slice(0, limit), total: history.length });
});

// ── GET /config ─────────────────────────────────────────────────────────────
router.get('/config', optionalAuth, (req, res) => {
  res.json(getConfig());
});

// ── PUT /config ─────────────────────────────────────────────────────────────
router.put('/config', optionalAuth, (req, res) => {
  const updated = updateConfig(req.body);
  res.json({ config: updated, message: 'Configuration updated' });
});

// ── POST /start ─────────────────────────────────────────────────────────────
router.post('/start', optionalAuth, (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const intervalHours = req.body.interval_hours || null;
  startScheduler(intervalHours, db);
  res.json({ message: 'Feed scheduler started', status: getSchedulerStatus() });
});

// ── POST /stop ──────────────────────────────────────────────────────────────
router.post('/stop', optionalAuth, (req, res) => {
  stopScheduler();
  res.json({ message: 'Feed scheduler stopped', status: getSchedulerStatus() });
});

// ── POST /run-now ───────────────────────────────────────────────────────────
router.post('/run-now', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  setDb(db);

  try {
    const report = await runManualCycle(db);
    res.json({ message: 'Manual cycle complete', report });
  } catch (err) {
    console.error('[FeedScheduler] Manual run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /fill-one ──────────────────────────────────────────────────────────
// Generate a single auto-filled profile (useful for testing)
router.post('/fill-one', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const layer = req.body.feed_layer || 'real_world';

  try {
    const spark = generateCreatorSpark(layer);
    const profile = await generateAndSaveProfile(db, spark, layer);
    res.json({
      message: `Auto-generated profile for ${layer}`,
      spark,
      profile,
    });
  } catch (err) {
    console.error('[FeedScheduler] Fill-one error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /layer-status ───────────────────────────────────────────────────────
router.get('/layer-status', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');

  try {
    const FEED_CAPS = { real_world: 443, lalaverse: 200 };
    const layers = {};

    for (const [layer, cap] of Object.entries(FEED_CAPS)) {
      const total = await db.SocialProfile.count({ where: { feed_layer: layer, lalaverse_cap_exempt: false } });
      const generated = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'generated' } });
      const finalized = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'finalized' } });
      const crossed = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'crossed' } });

      layers[layer] = {
        total, cap, remaining: cap - total,
        fill_pct: Math.round((total / cap) * 100),
        breakdown: { generated, finalized, crossed },
      };
    }

    res.json({ layers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
