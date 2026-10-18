'use strict';

/**
 * Brands on The Pulse (automation step 3; Evoni, 2026-10-18;
 * services/brandPulse). Everything here is ADMIN: the drafts are hers to
 * see first.
 *
 *   GET  /api/v1/brand-pulse?show_id=          each brand: its Pulse account,
 *                                               reps, recent posts, replies
 *                                               waiting
 *   POST /api/v1/brand-pulse/accounts          "Give the brands their Pulse
 *                                               accounts": makes the missing ones
 *   POST /api/v1/brand-pulse/brands/:brandId/draft  { show_id, rep?, about? }
 *                                               one everyday post through the
 *                                               gate (one AI call)
 *   POST /api/v1/brand-pulse/draft-week        { show_id } this week for every
 *                                               brand; passing posts scheduled
 *                                               (one AI call)
 *   GET  /api/v1/brand-pulse/brands/:brandId/replies?show_id=  posts it could answer
 *   POST /api/v1/brand-pulse/brands/:brandId/replies  { post_id, rep? } a reply,
 *                                               left as a draft (one AI call)
 *   GET  /api/v1/brand-pulse/brands/:brandId/deals?show_id=  its deals, and
 *                                               whether each can be announced
 *   POST /api/v1/brand-pulse/brands/:brandId/deals/:dealId/announce  { rep? }
 *                                               an announcement, always to
 *                                               Review (one AI call)
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let models = null;
const getModels = () => {
  if (!models) models = require('../models');
  return models;
};

/** A known refusal sent; false when the error is not one. */
function sendKnown(res, err) {
  const { BrandPulseError } = require('../services/brandPulse');
  const { RequestCapError } = require('../services/pulseRequests');
  if (err instanceof BrandPulseError || err instanceof RequestCapError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  if (err?.status === 429) {
    res.status(429).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

function badIds(res, ...ids) {
  if (ids.every((id) => UUID_RE.test(String(id || '')))) return false;
  res.status(400).json({ success: false, error: 'Those ids are not valid.' });
  return true;
}

router.get('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = req.query.show_id || null;
    if (showId && badIds(res, showId)) return undefined;
    return res.json({ success: true, ...(await require('../services/brandPulse').overview(getModels(), { showId })) });
  } catch (err) {
    console.error('[BrandPulse] GET / error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/accounts', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/brandPulse').ensureAccounts(getModels())) });
  } catch (err) {
    console.error('[BrandPulse] POST /accounts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/brands/:brandId/draft', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const { show_id: showId, rep = null, about = null } = req.body || {};
    if (badIds(res, req.params.brandId, showId)) return undefined;
    const out = await require('../services/brandPulse').draftBrandPost(getModels(), { showId, brandId: req.params.brandId, repKey: rep, about });
    return res.json({ success: true, post: out.post, review: out.review, published: out.published, scheduled_at: out.scheduled_at || null });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] POST /brands/:brandId/draft error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/draft-week', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const { show_id: showId, per_brand: perBrand } = req.body || {};
    if (badIds(res, showId)) return undefined;
    return res.json({ success: true, ...(await require('../services/brandPulse').draftWeek(getModels(), { showId, perBrand })) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] POST /draft-week error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/brands/:brandId/replies', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (badIds(res, req.params.brandId, req.query.show_id)) return undefined;
    const posts = await require('../services/brandPulse').replyCandidates(getModels(), { showId: req.query.show_id, brandId: req.params.brandId });
    return res.json({ success: true, posts });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] GET /brands/:brandId/replies error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/brands/:brandId/replies', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const { post_id: postId, rep = null } = req.body || {};
    if (badIds(res, req.params.brandId, postId)) return undefined;
    const out = await require('../services/brandPulse').draftReply(getModels(), { postId, brandId: req.params.brandId, repKey: rep });
    return res.json({ success: true, comment: out.comment, sent: out.sent });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] POST /brands/:brandId/replies error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/brands/:brandId/deals', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (badIds(res, req.params.brandId, req.query.show_id)) return undefined;
    const deals = await require('../services/brandPulse').dealsFor(getModels(), { showId: req.query.show_id, brandId: req.params.brandId });
    return res.json({ success: true, deals });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] GET /brands/:brandId/deals error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/brands/:brandId/deals/:dealId/announce', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (badIds(res, req.params.brandId, req.params.dealId)) return undefined;
    const out = await require('../services/brandPulse').draftDealAnnouncement(getModels(), { dealId: req.params.dealId, brandId: req.params.brandId, repKey: req.body?.rep || null });
    return res.json({ success: true, post: out.post, review: out.review, published: out.published });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[BrandPulse] POST /brands/:brandId/deals/:dealId/announce error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
