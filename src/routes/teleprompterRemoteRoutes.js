'use strict';

/**
 * The teleprompter's phone remote (Teleprompter batch 3; Evoni, 2026-10-20).
 * Mounted at /api/v1/teleprompter-remote, ahead of the global /api limiters
 * (the desktop asks for commands about every 700ms, which the global 500 per
 * 15 minutes would cut off in minutes); these routes carry their own limits.
 *
 * The desktop, signed in (requireAuth, owner only):
 *   POST   /                      open a session { episode_id? } → { id, token, expires_at }
 *                                 (the token is sent once and never kept: only its sha256)
 *   GET    /:id/commands?after=n  the phone's commands after seq n
 *   PUT    /:id/state             what the desktop is doing, for the phone to show
 *   DELETE /:id                   End (soft delete)
 *
 * The phone, reached by the QR code (no account; the token is the key):
 *   GET    /phone/state           X-Remote-Token → { state, expires_at, seq }
 *   POST   /phone/commands        X-Remote-Token, { command } (an allowlisted one)
 * A token with no live session (wrong, ended, expired) is a 410.
 *
 * Before migration 20261020120000 has run, every route is a 409 that says so.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const remote = require('../services/teleprompterRemoteService');

const router = express.Router();
const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip);

// The desktop: polling about 86 times a minute plus its state; per user.
const desktopLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from the teleprompter, please slow down' },
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
});
// The phone: button presses and a state check every 1.5 seconds; per address.
const phoneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many presses, please slow down' },
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

const sendError = (res, err, what) => {
  if (err.status) return res.status(err.status).json({ success: false, error: err.message, ...(err.code ? { code: err.code } : {}) });
  console.error(`[TeleprompterRemote] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: 'The phone remote hit a problem. Try again.' });
};

// PUBLIC: token-authenticated teleprompter remote. The phone reads its own session's state only (looked up by the token's sha256).
router.get('/phone/state', phoneLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const data = await remote.stateByToken(models.sequelize, { token: req.get('X-Remote-Token') });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err, 'phone state');
  }
});

// PUBLIC: token-authenticated teleprompter remote. Adds one allowlisted command to the token's live session.
router.post('/phone/commands', phoneLimiter, async (req, res) => {
  try {
    const data = await remote.addCommand(models.sequelize, { token: req.get('X-Remote-Token'), command: (req.body || {}).command });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err, 'phone command');
  }
});

router.post('/', requireAuth, desktopLimiter, async (req, res) => {
  try {
    const { session, token } = await remote.createSession(models.sequelize, { userId: req.user?.id, episodeId: (req.body || {}).episode_id || null });
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, data: { ...session, token } });
  } catch (err) {
    return sendError(res, err, 'open');
  }
});

router.get('/:id/commands', requireAuth, desktopLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const data = await remote.commandsAfter(models.sequelize, { id: req.params.id, userId: req.user?.id, after: req.query.after });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err, 'poll');
  }
});

router.put('/:id/state', requireAuth, desktopLimiter, async (req, res) => {
  try {
    const row = await remote.putState(models.sequelize, { id: req.params.id, userId: req.user?.id, state: (req.body || {}).state });
    if (!row) return res.status(410).json({ success: false, error: remote.GONE, code: 'SESSION_GONE' });
    return res.json({ success: true, data: { command_seq: row.command_seq, expires_at: row.expires_at } });
  } catch (err) {
    return sendError(res, err, 'state');
  }
});

router.delete('/:id', requireAuth, desktopLimiter, async (req, res) => {
  try {
    const ended = await remote.endSession(models.sequelize, { id: req.params.id, userId: req.user?.id });
    return res.json({ success: true, data: { ended } });
  } catch (err) {
    return sendError(res, err, 'end');
  }
});

module.exports = router;
