'use strict';
/**
 * Audience polls, public side (Task #3005; The Pulse spec §11;
 * docs/reads/2026-10-12-pulse-public-extras-read.md §1, §3). Mounted at
 * /api/v1/public/polls. No auth middleware and no req.user: the landing page
 * is for logged-out visitors. Evoni, 2026-10-12: one vote per browser plus a
 * rate limit; no accounts, no captcha.
 *
 *   GET /                  open polls (question and labels, no counts) and
 *                          those closed in the last week (with counts); no
 *                          wardrobe, event, episode or show ids
 *   POST /:id/vote { option_id }
 *                          one vote per poll per browser and per IP. The
 *                          browser's id is an HttpOnly pulse_voter cookie set
 *                          here; it and the IP are hashed with POLL_HASH_SALT
 *                          (503 until it is set) and never stored or logged
 *                          raw. Its own limiter, on top of the global ones.
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const getModels = () => require('../models');

const COOKIE = 'pulse_voter';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;   // a year, in seconds
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many votes, please try again later' },
});

/** The browser's voter id from its cookie, or null. */
function voterFromCookie(header) {
  for (const part of String(header || '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return UUID_RE.test(value) ? value : null;
    }
  }
  return null;
}

// PUBLIC: the landing page's audience polls; question and option labels only (counts once closed), no production ids, no identity read.
router.get('/', readLimiter, async (req, res) => {
  try {
    const polls = await require('../services/pulsePolls').publicPolls(getModels());
    res.set('Cache-Control', 'no-store');
    return res.json({ polls });
  } catch (err) {
    console.error('[PublicPolls] read failed:', err.message);
    return res.json({ polls: [] });
  }
});

// PUBLIC: an anonymous vote; one per poll per browser cookie and per IP, both stored only as salted hashes.
router.post('/:id/vote', voteLimiter, async (req, res) => {
  try {
    if (!String(process.env.POLL_HASH_SALT || '').trim()) {
      return res.status(503).json({ success: false, error: 'Voting is not set up yet.' });
    }
    let voterId = voterFromCookie(req.headers.cookie);
    if (!voterId) {
      voterId = crypto.randomUUID();
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.append('Set-Cookie', `${COOKIE}=${voterId}; Max-Age=${COOKIE_MAX_AGE}; Path=/api/v1/public/polls; HttpOnly; SameSite=Lax${secure}`);
    }
    await require('../services/pulsePolls').castVote(getModels(), {
      pollId: req.params.id, optionId: req.body?.option_id, voterId, ip: req.ip,
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    const { PollError } = require('../services/pulsePolls');
    if (err instanceof PollError) return res.status(err.status).json({ success: false, error: err.message });
    console.error('[PublicPolls] vote failed:', err.message);
    return res.status(500).json({ success: false, error: 'The vote could not be counted.' });
  }
});

module.exports = router;
