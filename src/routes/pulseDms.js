'use strict';
/**
 * DMs on The Pulse (Task #2984; The Pulse spec §3; services/pulseDms.js).
 * Mounted at /api/v1/pulse-dms.
 *
 *   GET /?show_id=&at=&profile_id=   threads with their messages and both
 *                                    profiles. With `at` (an order, "present"
 *                                    or "ep:<n>:<phase>"): live messages at
 *                                    or before it only, nothing behind the
 *                                    curtain. Without: every draft and live
 *                                    message, with the gate (requireAuth).
 *                                    profile_id=lala is Lala's Feed profile
 *                                    (her Phone, which does not know her id);
 *                                    the response names the profile read.
 *   POST / { show_id, profile_a_id, profile_b_id, sender_profile_id, story_order?, topic? }
 *                                    opens (or reuses) the pair's thread and
 *                                    queues its next message by the sender
 *                                    (requireAuth + ADMIN + aiRateLimiter;
 *                                    queues only, never drafts in the request)
 *   POST /:threadId/next { sender_profile_id?, story_order? }
 *                                    queues the next message; the sender
 *                                    defaults to whoever did not write last
 *   PUT /messages/:id { action: approve | edit | reject, text? }   (ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);
const intOrNull = (v) => (v === undefined || v === null || v === '' ? null : (Number.isInteger(Number(v)) ? Number(v) : NaN));
const engineOn = () => process.env.PULSE_ENGINE_ENABLED === 'true';

/** A DmError, QueueError or RequestCapError (429) as its response; false for anything else. */
function sendKnown(res, err) {
  const { DmError } = require('../services/pulseDms');
  const { QueueError } = require('../services/pulseQueue');
  const { RequestCapError } = require('../services/pulseRequests');
  if (err instanceof DmError || err instanceof QueueError || err instanceof RequestCapError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const isLala = String(req.query.profile_id || '').toLowerCase() === 'lala';
    const profileId = isLala
      ? await require('../services/lalaFeedProfile').lalaProfileId(getModels().sequelize)
      : intOrNull(req.query.profile_id);
    if (isLala && profileId == null) return res.json({ success: true, at: null, profile_id: null, threads: [] });
    if (Number.isNaN(profileId)) return res.status(400).json({ success: false, error: 'profile_id must be a whole number.' });
    let at = null;
    if (req.query.at !== undefined && req.query.at !== '') {
      try {
        at = await require('../services/storyClock').resolveAt(getModels(), showId, String(req.query.at));
      } catch (atErr) {
        if (atErr.status === 400) return res.status(400).json({ success: false, error: atErr.message });
        throw atErr;
      }
      if (!Number.isInteger(at)) at = 0;   // no published episode yet: the very start
    }
    const threads = await require('../services/pulseDms').threadsOf(getModels(), showId, { at, profileId });
    return res.json({ success: true, at, profile_id: profileId, threads });
  } catch (err) {
    console.error('[PulseDms] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const a = intOrNull(body.profile_a_id);
    const b = intOrNull(body.profile_b_id);
    const sender = intOrNull(body.sender_profile_id);
    const at = intOrNull(body.story_order);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return res.status(400).json({ success: false, error: 'profile_a_id and profile_b_id are required.' });
    if (!Number.isInteger(sender)) return res.status(400).json({ success: false, error: 'sender_profile_id says who writes first.' });
    if (Number.isNaN(at)) return res.status(400).json({ success: false, error: 'story_order must be a whole number.' });
    const models = getModels();
    const dms = require('../services/pulseDms');
    const opened = Number.isInteger(at) ? at : await require('../services/storyClock').presentOrder(models, showId);
    // A refused first message opens no thread (Task #3053).
    const { thread, job } = await dms.startConversation(models, {
      showId, a, b, at: opened, topic: body.topic, senderProfileId: sender, messageAt: Number.isInteger(at) ? at : null,
    });
    return res.status(201).json({ success: true, thread_id: thread.id, job_id: job.id, engine_on: engineOn() });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseDms] POST error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:threadId/next', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.threadId)) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const body = req.body || {};
    const sender = intOrNull(body.sender_profile_id);
    const at = intOrNull(body.story_order);
    if (Number.isNaN(sender) || Number.isNaN(at)) return res.status(400).json({ success: false, error: 'sender_profile_id and story_order must be whole numbers.' });
    const job = await require('../services/pulseDms').enqueueMessage(getModels(), { threadId: req.params.threadId, senderProfileId: sender, at });
    return res.status(201).json({ success: true, job_id: job.id, engine_on: engineOn() });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseDms] POST next error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/messages/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Message not found' });
    const message = await getModels().PulseDmMessage.findByPk(req.params.id);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    const body = req.body || {};
    await require('../services/pulseDms').decide(message, String(body.action || ''), { text: body.text, by: byOf(req) });
    return res.json({
      success: true,
      message: { id: message.id, status: message.status, text: message.text, posted_at: message.posted_at, decided_by: message.decided_by, decided_at: message.decided_at },
    });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseDms] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
