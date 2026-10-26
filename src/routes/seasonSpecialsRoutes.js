'use strict';

/**
 * Special episodes (services/seasonSpecials; Evoni, 2026-10-26: "All three
 * and on YouTube, show me first"). Every route is requireAuth; none calls
 * AI. Before the season_specials migration has run each write answers 409
 * SEASON_SPECIALS_MIGRATION_PENDING ("needs its migration first"); the
 * roadmap and the release schedule read as before.
 *
 *   POST   /world/:showId/season/specials                     + Add a special { kind, after_slot_number, event_id?, title?, special_type?, release_date?, release_time? }
 *   PATCH  /world/:showId/season/specials/:specialId          edit { title, special_type, after_slot_number, event_id, release_date, release_time }
 *   DELETE /world/:showId/season/specials/:specialId          remove one that has no episode
 *   POST   /world/:showId/season/two-parters                  Make it a two-parter { slot_id } (Part 1; Part 2 is the next weekly slot)
 *   DELETE /world/:showId/season/two-parters/:twoPartId       undo, while Part 2 has no episode
 *   POST   /world/:showId/season/two-parters/:twoPartId/part-two   Start Part 2 (its episode, from Part 1)
 *
 * A full season (services/seasonFullSpecials; Evoni, 2026-10-26: "Yes placed
 * events should be seen as full, they should have both options, no limit"):
 *   GET    /world/:showId/season/full/events/:eventId              the Event page's choice: will it be a special,
 *                                                                  where (story order), its date, and each weekly
 *                                                                  episode it could swap into
 *   POST   /world/:showId/season/full/events/:eventId/special      Make it a special (at its story position)
 *   POST   /world/:showId/season/full/events/:eventId/swap         Swap it into E_n { slot_id }; E_n's event becomes a special
 *   POST   /world/:showId/season/full/events/:eventId/next-season  Move to the next season instead (its first open slot)
 *   POST   /world/:showId/season/specials/:specialId/story-position  Move a special to its story position
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const specials = require('../services/seasonSpecials');
const full = require('../services/seasonFullSpecials');

const router = express.Router();
const modelsOf = (req) => req.app?.get?.('models') || require('../models');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

for (const name of ['showId', 'specialId', 'twoPartId', 'eventId']) {
  router.param(name, (req, res, next, value) => (UUID.test(value) ? next() : res.status(404).json({ success: false, error: 'Not found.' })));
}

function fail(res, err, where) {
  if (err instanceof specials.SpecialsError || (err?.status && err?.code)) {
    console.warn(`[seasonSpecials] ${where} refused (${err.code}):`, err.message);
    return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  }
  console.error(`[seasonSpecials] ${where} failed:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.post('/world/:showId/season/specials', requireAuth, async (req, res) => {
  try {
    const data = await specials.createSpecial(modelsOf(req).sequelize, req.params.showId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'add a special');
  }
});

router.patch('/world/:showId/season/specials/:specialId', requireAuth, async (req, res) => {
  try {
    const data = await specials.updateSpecial(modelsOf(req).sequelize, req.params.showId, req.params.specialId, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'edit a special');
  }
});

router.delete('/world/:showId/season/specials/:specialId', requireAuth, async (req, res) => {
  try {
    const data = await specials.removeSpecial(modelsOf(req).sequelize, req.params.showId, req.params.specialId);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'remove a special');
  }
});

router.post('/world/:showId/season/two-parters', requireAuth, async (req, res) => {
  try {
    const data = await specials.createTwoParter(modelsOf(req).sequelize, req.params.showId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'make a two-parter');
  }
});

router.delete('/world/:showId/season/two-parters/:twoPartId', requireAuth, async (req, res) => {
  try {
    const data = await specials.removeTwoParter(modelsOf(req).sequelize, req.params.showId, req.params.twoPartId);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'undo a two-parter');
  }
});

router.post('/world/:showId/season/two-parters/:twoPartId/part-two', requireAuth, async (req, res) => {
  try {
    const data = await specials.startPartTwo(modelsOf(req).sequelize, req.params.showId, req.params.twoPartId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'start Part 2');
  }
});

router.get('/world/:showId/season/full/events/:eventId', requireAuth, async (req, res) => {
  try {
    const data = await full.fullChoice(modelsOf(req).sequelize, req.params.showId, req.params.eventId);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'read the full-season choice');
  }
});

router.post('/world/:showId/season/full/events/:eventId/special', requireAuth, async (req, res) => {
  try {
    const data = await full.makeSpecial(modelsOf(req).sequelize, req.params.showId, req.params.eventId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'make it a special');
  }
});

router.post('/world/:showId/season/full/events/:eventId/swap', requireAuth, async (req, res) => {
  try {
    const data = await full.swapIntoSlot(modelsOf(req).sequelize, req.params.showId, req.params.eventId, req.body?.slot_id);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'swap it into a weekly episode');
  }
});

router.post('/world/:showId/season/full/events/:eventId/next-season', requireAuth, async (req, res) => {
  try {
    const data = await full.moveToNextSeason(modelsOf(req).sequelize, req.params.showId, req.params.eventId);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'move it to the next season');
  }
});

router.post('/world/:showId/season/specials/:specialId/story-position', requireAuth, async (req, res) => {
  try {
    const data = await full.moveToStory(modelsOf(req).sequelize, req.params.showId, req.params.specialId);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'move a special to its story position');
  }
});

module.exports = router;
