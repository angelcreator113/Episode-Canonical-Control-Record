/**
 * The public landing page's one read (Task #2821; contract in
 * docs/reads/2026-10-10-website-content-read.md §4). This file holds a
 * single GET and nothing else: no write verb, no optionalAuth, no req.user.
 * It returns published website slots only, built field by field
 * (websiteSlotService.publicContent), with cache headers and its own rate
 * limit. A failed read answers { slots: {} } so the site keeps its bundled
 * defaults; it never shows an error page.
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const siteContentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// PUBLIC: the landing page's published media slots (Tier 4 shape, but no auth middleware at all: the handler reads no identity); whitelisted fields only, no ids, no drafts.
router.get('/site-content', siteContentLimiter, async (req, res) => {
  let body = { slots: {}, updated_at: null };
  try {
    const models = require('../models');
    const { publicContent } = require('../services/websiteSlotService');
    body = await publicContent(models);
  } catch (err) {
    console.error('[PublicSite] site content read failed; serving no slots:', err.message);
  }
  const etag = `"${crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex')}"`;
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.set('ETag', etag);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  return res.json(body);
});

module.exports = router;
