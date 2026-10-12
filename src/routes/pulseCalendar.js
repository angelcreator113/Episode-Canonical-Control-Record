'use strict';
/**
 * Admin › The Pulse › Calendar (Task #2988; The Pulse spec §4;
 * services/pulseCalendar.js). Mounted at /api/v1/pulse-calendar. Read only.
 *
 *   GET /?show_id=&from=&to=   the show's story moments in order, each with
 *                              its posts (drafts marked), reveals, events,
 *                              closeness changes and DMs; from/to are story
 *                              orders, an order, "present" or ep:<n>:<phase>
 *                              (requireAuth)
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const models = getModels();
    const clock = require('../services/storyClock');
    const bound = async (value) => {
      if (value === undefined || value === '') return null;
      return clock.resolveAt(models, showId, String(value));
    };
    let from;
    let to;
    try {
      from = await bound(req.query.from);
      to = await bound(req.query.to);
    } catch (atErr) {
      if (atErr.status === 400) return res.status(400).json({ success: false, error: atErr.message.replace(/^at /, 'from and to ') });
      throw atErr;
    }
    const calendar = await require('../services/pulseCalendar').calendarOf(models, showId, { from: from ?? null, to: to ?? null });
    return res.json({ success: true, from: from ?? null, to: to ?? null, ...calendar });
  } catch (err) {
    console.error('[PulseCalendar] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
