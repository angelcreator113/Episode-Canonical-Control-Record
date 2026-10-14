'use strict';
/**
 * Shop the Look on the public website (Task #3021; The Pulse spec §10;
 * docs/reads/2026-10-12-pulse-shop-the-look-read.md §4). Mounted at
 * /api/v1/public/looks. No auth middleware and no req.user: the website is
 * for logged-out visitors. Only looks Evoni published
 * (styleSheetDistributionService.publishStyleSheetToSite) and still shows;
 * each link is read live from its piece, and the disclosure comes first
 * (styleSheetDistributionService.disclosureFor). A look's random key is its only
 * public id: no episode, show or wardrobe ids, and no prices, leave here.
 * Text only until website storage is live.
 *
 *   GET /        published looks, newest first: key, title, published_at
 *   GET /:key    one published look: title, caption, disclosure, links
 */
const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const getModels = () => require('../models');
const service = () => require('../services/styleSheetDistributionService');

const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// PUBLIC: the website's list of published Shop the Look pages; keys, titles and dates only, no production ids, no identity read.
router.get('/', readLimiter, async (req, res) => {
  try {
    const looks = await service().listPublicLooks(getModels());
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ looks });
  } catch (err) {
    console.error('[PublicLooks] list failed:', err.message);
    return res.json({ looks: [] });
  }
});

// PUBLIC: one published Shop the Look page; its caption, links and the disclosure, no production ids or prices, no identity read.
router.get('/:key', readLimiter, async (req, res) => {
  try {
    const look = await service().publicLook(getModels(), req.params.key);
    if (!look) return res.status(404).json({ error: 'Look not found' });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ look });
  } catch (err) {
    console.error('[PublicLooks] read failed:', err.message);
    return res.status(500).json({ error: 'The look could not be loaded.' });
  }
});

module.exports = router;
