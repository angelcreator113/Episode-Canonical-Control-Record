'use strict';
/**
 * Trust per character (automation step 5; services/pulseTrust). Mounted at
 * /api/v1/pulse-trust. All ADMIN.
 *
 *   GET  /profiles/:id      { profile_id, level, levels, always_review }
 *   PUT  /profiles/:id      { level: review_all | trusted | full }
 *   POST /undo/:postId      a post that went out on trust goes back to
 *                           Review with what was waived
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const isId = (v) => /^\d+$/.test(String(v));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendError(res, err, label) {
  const { TrustError } = require('../services/pulseTrust');
  if (err instanceof TrustError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[PulseTrust] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/profiles/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, error: 'Feed profile not found.' });
    const db = require('../models');
    const trust = require('../services/pulseTrust');
    const profile = await db.SocialProfile.findByPk(req.params.id, { attributes: ['id', 'pulse_trust'] });
    if (!profile) return res.status(404).json({ success: false, error: 'Feed profile not found.' });
    return res.json({
      success: true, profile_id: profile.id, level: trust.levelOf(profile.pulse_trust),
      levels: trust.LEVELS, always_review: trust.ALWAYS_REVIEW, waivable_flags: trust.WAIVABLE_FLAGS,
    });
  } catch (err) {
    return sendError(res, err, 'GET /profiles/:id');
  }
});

router.put('/profiles/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, error: 'Feed profile not found.' });
    const out = await require('../services/pulseTrust').setTrust(require('../models'), req.params.id, req.body?.level);
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'PUT /profiles/:id');
  }
});

router.post('/undo/:postId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.postId)) return res.status(404).json({ success: false, error: 'Post not found.' });
    const post = await require('../services/pulseTrust').undoTrust(require('../models'), req.params.postId);
    return res.json({ success: true, post: { id: post.id, status: post.status, review: post.gate_json?.review || [] } });
  } catch (err) {
    return sendError(res, err, 'POST /undo/:postId');
  }
});

module.exports = router;
