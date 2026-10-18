'use strict';

/**
 * Scheduled world moments (services/worldMoments; Evoni, 2026-10-18). ADMIN
 * only. No AI call in a request: events are drafted from the calendar, and
 * press and trend posts are queued for the posting engine.
 *
 *   GET  /?show_id=&days=      the calendar, the plan (7 days by default),
 *                              what was drafted lately, and whether the
 *                              server flags are on
 *   PUT  /settings             { show_id, auto_enabled?, cities?, press?,
 *                              trends?, award_shows? }
 *   POST /draft                { show_id, keys }: "Draft these"
 *   POST /plan-next-week       { show_id }: drafts what falls in the next
 *                              7 days and is not drafted (at most
 *                              MAX_DRAFT), as the automatic run would
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function showIdOf(req) {
  const id = req.query.show_id || req.body?.show_id;
  return UUID_RE.test(String(id || '')) ? id : null;
}

function sendError(res, err, label) {
  const { MomentsError } = require('../services/worldMoments');
  if (err instanceof MomentsError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[WorldMoments] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = showIdOf(req);
    if (!showId) return res.status(400).json({ success: false, error: 'show_id must be a show id.' });
    const moments = require('../services/worldMoments');
    const db = getModels();
    const days = Math.max(1, Math.min(moments.MAX_DAYS, parseInt(req.query.days, 10) || 7));
    const calendar = await moments.calendarOf(db, showId);
    const plan = await moments.planMoments(db, { showId, days });
    const { drafted, ...settings } = calendar;
    return res.json({
      success: true, settings, plan,
      recent: drafted.slice(-30).reverse(),
      server: {
        world_moments_enabled: process.env.WORLD_MOMENTS_ENABLED === 'true',
        pulse_engine_enabled: process.env.PULSE_ENGINE_ENABLED === 'true',
      },
    });
  } catch (err) {
    return sendError(res, err, 'GET /');
  }
});

router.put('/settings', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = showIdOf(req);
    if (!showId) return res.status(400).json({ success: false, error: 'show_id must be a show id.' });
    const { show_id: _ignored, ...fields } = req.body || {};
    const saved = await require('../services/worldMoments').saveSettings(getModels(), showId, fields);
    const { drafted, ...settings } = saved;
    return res.json({ success: true, settings });
  } catch (err) {
    return sendError(res, err, 'PUT /settings');
  }
});

router.post('/draft', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = showIdOf(req);
    if (!showId) return res.status(400).json({ success: false, error: 'show_id must be a show id.' });
    const out = await require('../services/worldMoments').draftMoments(getModels(), { showId, keys: req.body?.keys });
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'POST /draft');
  }
});

router.post('/plan-next-week', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = showIdOf(req);
    if (!showId) return res.status(400).json({ success: false, error: 'show_id must be a show id.' });
    const moments = require('../services/worldMoments');
    const db = getModels();
    const { moments: due } = await moments.planMoments(db, { showId, days: moments.LEAD_DAYS });
    const keys = due.filter((m) => !m.drafted).map((m) => m.key);
    if (!keys.length) return res.json({ success: true, results: [], drafted: 0 });
    const out = await moments.draftMoments(db, { showId, keys, max: moments.MAX_DRAFT });
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'POST /plan-next-week');
  }
});

module.exports = router;
