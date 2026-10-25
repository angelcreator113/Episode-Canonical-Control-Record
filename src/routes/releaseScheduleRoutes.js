'use strict';

/**
 * The show's release schedule (services/releaseSchedule; Evoni, 2026-10-25).
 * Every route is requireAuth. Schedule dates are computed on read; the only
 * date written is an episode's own air_date, set or cleared by hand.
 *
 *   GET  /world/:showId/release-schedule            the schedule and every episode's date
 *   PUT  /world/:showId/release-schedule            save { release_schedule } (other distribution_defaults keys kept)
 *   POST /world/:showId/release-schedule/preview    { release_schedule }: the dates it would give and what moves; nothing saved
 *   PUT  /world/:showId/episodes/:episodeId/release-date  { air_date: 'YYYY-MM-DD' | null }; null is "Back to the schedule"
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const releaseSchedule = require('../services/releaseSchedule');

const router = express.Router();
const modelsOf = (req) => req.app?.get?.('models') || require('../models');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A show or episode id that is not a uuid is not found (not a database error).
for (const name of ['showId', 'episodeId']) {
  router.param(name, (req, res, next, value) => (UUID.test(value) ? next() : res.status(404).json({ success: false, error: 'Not found.' })));
}

function fail(res, err, where) {
  if (err instanceof releaseSchedule.ScheduleError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[releaseSchedule] ${where} failed:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/world/:showId/release-schedule', requireAuth, async (req, res) => {
  try {
    const view = await releaseSchedule.viewFor(modelsOf(req).sequelize, req.params.showId);
    if (!view) return res.status(404).json({ success: false, error: 'Show not found.' });
    return res.json({ success: true, data: view });
  } catch (err) {
    return fail(res, err, 'read');
  }
});

router.put('/world/:showId/release-schedule', requireAuth, async (req, res) => {
  try {
    const { sequelize } = modelsOf(req);
    await releaseSchedule.saveSchedule(sequelize, req.params.showId, req.body?.release_schedule);
    const view = await releaseSchedule.viewFor(sequelize, req.params.showId);
    return res.json({ success: true, data: view });
  } catch (err) {
    return fail(res, err, 'save');
  }
});

router.post('/world/:showId/release-schedule/preview', requireAuth, async (req, res) => {
  try {
    const { sequelize } = modelsOf(req);
    const draft = releaseSchedule.normalize(req.body?.release_schedule);
    const now = new Date();
    const before = await releaseSchedule.viewFor(sequelize, req.params.showId, { now });
    if (!before) return res.status(404).json({ success: false, error: 'Show not found.' });
    const after = await releaseSchedule.viewFor(sequelize, req.params.showId, { schedule: draft, now });
    return res.json({ success: true, data: { ...after, moves: releaseSchedule.moves(before, after) } });
  } catch (err) {
    return fail(res, err, 'preview');
  }
});

router.put('/world/:showId/episodes/:episodeId/release-date', requireAuth, async (req, res) => {
  try {
    const { sequelize } = modelsOf(req);
    const day = req.body?.air_date === undefined ? undefined : req.body.air_date || null;
    if (day === undefined) return res.status(400).json({ success: false, error: 'air_date: a date as YYYY-MM-DD, or null for back to the schedule.' });
    await releaseSchedule.setEpisodeDate(sequelize, req.params.showId, req.params.episodeId, day);
    const view = await releaseSchedule.viewFor(sequelize, req.params.showId);
    return res.json({ success: true, data: view });
  } catch (err) {
    return fail(res, err, 'episode date');
  }
});

module.exports = router;
