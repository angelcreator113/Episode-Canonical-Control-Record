'use strict';
/**
 * Audience polls, Admin side (Task #3005; The Pulse spec §11;
 * services/pulsePolls.js). Mounted at /api/v1/pulse-polls. The public read
 * and the vote are routes/publicPolls.js.
 *
 *   GET /?show_id=            the show's polls with options and counts (requireAuth)
 *   POST / { show_id, world_event_id | episode_id, question?, options: [{ label, wardrobe_ids }], closes_at? }
 *                             a draft (ADMIN)
 *   PUT /:id { question?, options?, closes_at? }   a draft only (ADMIN)
 *   POST /:id/open            draft -> open (ADMIN)
 *   POST /:id/close           open -> closed (ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendKnown(res, err) {
  const { PollError } = require('../services/pulsePolls');
  if (err instanceof PollError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

/** The poll by id, or a 404 sent. */
async function pollOr404(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ success: false, error: 'Poll not found' }); return null; }
  const poll = await getModels().PulsePoll.findByPk(req.params.id);
  if (!poll) { res.status(404).json({ success: false, error: 'Poll not found' }); return null; }
  return poll;
}

/** The poll as Admin sees it, after a change. */
async function shaped(poll) {
  const list = await require('../services/pulsePolls').listForShow(getModels(), poll.show_id);
  return list.find((p) => p.id === poll.id) || null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const polls = await require('../services/pulsePolls').listForShow(getModels(), showId);
    return res.json({ success: true, polls, voting_ready: Boolean(String(process.env.POLL_HASH_SALT || '').trim()) });
  } catch (err) {
    console.error('[PulsePolls] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const poll = await require('../services/pulsePolls').createPoll(getModels(), {
      showId, worldEventId: body.world_event_id, episodeId: body.episode_id,
      question: body.question, options: body.options, closesAt: body.closes_at,
    });
    return res.status(201).json({ success: true, poll: await shaped(poll) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulsePolls] POST error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const poll = await pollOr404(req, res);
    if (!poll) return undefined;
    const body = req.body || {};
    await require('../services/pulsePolls').updatePoll(getModels(), poll, {
      question: body.question, options: body.options, closesAt: body.closes_at,
    });
    return res.json({ success: true, poll: await shaped(poll) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulsePolls] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/open', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const poll = await pollOr404(req, res);
    if (!poll) return undefined;
    await require('../services/pulsePolls').openPoll(getModels(), poll);
    return res.json({ success: true, poll: await shaped(poll) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulsePolls] open error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/close', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const poll = await pollOr404(req, res);
    if (!poll) return undefined;
    await require('../services/pulsePolls').closePoll(poll);
    return res.json({ success: true, poll: await shaped(poll) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulsePolls] close error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
