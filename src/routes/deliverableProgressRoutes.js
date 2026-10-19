'use strict';

/**
 * Deliverables that check themselves (services/deliverableProgress; Evoni,
 * 2026-10-19). Mounted at /api/v1/deliverable-progress. Reads need a
 * sign-in; linking and unlinking are ADMIN. No AI call; no money touched.
 *
 *   GET    /events/:eventId                 a deal's deliverables with "Pulse stories: 2 of 3"
 *   GET    /opportunities/:id               the same, for a deal (its event)
 *   GET    /brands?name=                    every deal with a brand (for the brand profile)
 *   GET    /posts/:postId                   what a post counts toward, and the open ones it could (ADMIN)
 *   GET    /deliverables/:id/suggestions    posts that could count toward it, best first (ADMIN)
 *   POST   /deliverables/:id/posts { post_id }   count a post toward it (ADMIN)
 *   DELETE /deliverables/:id/posts/:postId       stop counting it (ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const service = () => require('../services/deliverableProgress');
const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

function sendError(res, err, label) {
  const { DeliverableError } = service();
  if (err instanceof DeliverableError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[DeliverableProgress] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/events/:eventId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().progressForEvent(getModels(), req.params.eventId)) });
  } catch (err) {
    return sendError(res, err, 'GET /events/:eventId');
  }
});

router.get('/opportunities/:id', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().progressForOpportunity(getModels(), req.params.id)) });
  } catch (err) {
    return sendError(res, err, 'GET /opportunities/:id');
  }
});

router.get('/brands', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, deals: await service().progressForBrand(getModels(), req.query.name) });
  } catch (err) {
    return sendError(res, err, 'GET /brands');
  }
});

router.get('/posts/:postId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().forPost(getModels(), req.params.postId)) });
  } catch (err) {
    return sendError(res, err, 'GET /posts/:postId');
  }
});

router.get('/deliverables/:id/suggestions', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().suggestions(getModels(), req.params.id)) });
  } catch (err) {
    return sendError(res, err, 'GET /deliverables/:id/suggestions');
  }
});

router.post('/deliverables/:id/posts', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const progress = await service().link(getModels(), { deliverableId: req.params.id, postId: req.body?.post_id, by: byOf(req) });
    return res.json({ success: true, ...progress });
  } catch (err) {
    return sendError(res, err, 'POST /deliverables/:id/posts');
  }
});

router.delete('/deliverables/:id/posts/:postId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const progress = await service().unlink(getModels(), { deliverableId: req.params.id, postId: req.params.postId });
    return res.json({ success: true, ...progress });
  } catch (err) {
    return sendError(res, err, 'DELETE /deliverables/:id/posts/:postId');
  }
});

module.exports = router;
