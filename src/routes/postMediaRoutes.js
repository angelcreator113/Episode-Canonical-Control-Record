'use strict';
/**
 * Visual Memory, phase 2, with real Pulse post formats (services/postMedia).
 * Mounted at /api/v1/post-media. All ADMIN: these are Evoni's tools; what the
 * public sees is filtered in the feed routes.
 *
 *   GET  /formats                       the formats and how many pictures each
 *                                       takes; the deliverable → format map
 *   GET  /posts/:postId                 the post, its pictures and its poster's
 *                                       library
 *   PUT  /posts/:postId                 { asset_ids: [...], format? } — its
 *                                       pictures, in order; 409 with pictures
 *                                       when a live or scheduled post would
 *                                       show one that is not approved and public
 *   POST /posts/:postId/approve-pictures   its library pictures approved and public
 *   GET  /posts/:postId/suggestions     the poster's pictures ranked for its caption
 *   GET  /needs-picture?show_id=&character_id=   posts with no picture
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];
const service = () => require('../services/postMedia');
const models = () => require('../models');
const byOf = (req) => req.user?.email || req.user?.id || null;

function sendError(res, err, label) {
  const { MediaError } = require('../services/mediaLibrary');
  if (err instanceof MediaError) {
    return res.status(err.status).json({ success: false, error: err.message, ...(err.pictures ? { code: 'pictures_not_public', pictures: err.pictures } : {}) });
  }
  console.error(`[PostMedia] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/formats', ...admin, (req, res) => {
  const s = service();
  return res.json({
    success: true,
    formats: s.FORMATS.map((f) => ({ key: f, label: s.FORMAT_LABELS[f], min: s.PICTURES[f][0], max: s.PICTURES[f][1] })),
    deliverables: s.FORMAT_FOR_DELIVERABLE,
    story_hours: s.STORY_HOURS,
  });
});

router.get('/needs-picture', ...admin, async (req, res) => {
  try {
    const posts = await service().needsPicture(models(), { showId: req.query.show_id || null, characterId: req.query.character_id || null, limit: req.query.limit });
    return res.json({ success: true, posts });
  } catch (err) {
    return sendError(res, err, 'GET /needs-picture');
  }
});

router.get('/posts/:postId', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().pictureEditor(models(), req.params.postId)) });
  } catch (err) {
    return sendError(res, err, 'GET /posts/:postId');
  }
});

router.put('/posts/:postId', ...admin, async (req, res) => {
  try {
    const out = await service().attachPictures(models(), req.params.postId, {
      assetIds: req.body?.asset_ids ?? [], format: req.body?.format || null, by: byOf(req),
    });
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'PUT /posts/:postId');
  }
});

router.post('/posts/:postId/approve-pictures', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().approvePictures(models(), req.params.postId)) });
  } catch (err) {
    return sendError(res, err, 'POST /posts/:postId/approve-pictures');
  }
});

router.get('/posts/:postId/suggestions', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await service().suggestFor(models(), req.params.postId, { limit: req.query.limit })) });
  } catch (err) {
    return sendError(res, err, 'GET /posts/:postId/suggestions');
  }
});

module.exports = router;
