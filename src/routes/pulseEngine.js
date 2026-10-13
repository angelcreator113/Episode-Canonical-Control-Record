'use strict';
/**
 * The Pulse's posting engine settings and queue (Task #2968; The Pulse spec
 * §7 "Cost control"; services/pulseQueue.js). Mounted at /api/v1/pulse-engine.
 *
 *   GET /?show_id=   the daily request limits (automated, manual) and
 *                    ambient switch, requests taken today by lane
 *                    (services/pulseRequests.js), drafts made today,
 *                    whether the worker runs on this server, and the last
 *                    jobs (requireAuth)
 *   PUT /            { show_id, automated_requests?, manual_requests?,
 *                    ambient_enabled? } (requireAuth + ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badShow = (res) => res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });

/** A QueueError as its response; false for anything else. */
function sendKnown(res, err) {
  if (err instanceof require('../services/pulseQueue').QueueError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const state = await require('../services/pulseQueue').stateOf(getModels(), showId);
    return res.json({ success: true, ...state });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const queue = require('../services/pulseQueue');
    const db = getModels();
    await queue.saveSettings(db, showId, {
      automated_requests: body.automated_requests, manual_requests: body.manual_requests, ambient_enabled: body.ambient_enabled,
    });
    return res.json({ success: true, ...(await queue.stateOf(db, showId)) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
