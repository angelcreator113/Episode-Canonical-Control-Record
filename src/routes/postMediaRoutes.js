'use strict';
/**
 * Visual Memory, phase 2, with real Pulse post formats (services/postMedia).
 * Mounted at /api/v1/post-media. All ADMIN: these are Evoni's tools; what the
 * public sees is filtered in the feed routes.
 *
 *   GET  /formats                       the formats and how many pictures each
 *                                       takes; the deliverable → format map;
 *                                       post_picture: what a post's picture
 *                                       costs, the day's limit, how many each
 *                                       format gets
 *   GET  /posts/:postId                 the post, its pictures and its poster's
 *                                       library
 *   PUT  /posts/:postId                 { asset_ids: [...], format? } — its
 *                                       pictures, in order; 409 with pictures
 *                                       when a live or scheduled post would
 *                                       show one that is not approved and public
 *   POST /posts/:postId/approve-pictures   its library pictures approved and public
 *   GET  /posts/:postId/suggestions     the poster's pictures ranked for its caption
 *   POST /posts/:postId/suggestions     phase 4 (services/pictureSuggestions):
 *                                       the caption's reading (one text call,
 *                                       kept in post_picture_suggestions), their
 *                                       pictures ranked for it, and the plan:
 *                                       a recommendation, with use, edit,
 *                                       create and upload always offered.
 *                                       Nothing is made.
 *   POST /posts/:postId/suggestions/run { choice: { action: 'edit', asset_id,
 *                                       change, locks, include_person? } |
 *                                       { action: 'create', include_person? } }
 *                                       one image call; a private draft in
 *                                       their library, not put on the post
 *   POST /posts/:postId/suggestions/choice  { action: 'use' | 'upload',
 *                                       asset_id | result_asset_id }: what she
 *                                       chose in the panel, recorded
 *   GET  /suggestions/acceptance        per recommendation, how often it was
 *                                       taken and what was chosen instead
 *   GET  /needs-picture?show_id=&character_id=   posts with no picture
 *   GET  /posts/:postId/picture         its picture from the camera roll
 *                                       (services/postPictures): where it
 *                                       stands, the estimate, today's count
 *                                       against the day's limit, and photos of
 *                                       theirs that could be used instead
 *   POST /posts/:postId/picture         { make_now? } make (or retry) an
 *                                       approved post's picture now; make_now
 *                                       passes the image budget but not the
 *                                       day's post-picture limit
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];
const service = () => require('../services/postMedia');
const models = () => require('../models');
const byOf = (req) => req.user?.email || req.user?.id || null;

function sendError(res, err, label) {
  const { MediaError } = require('../services/mediaLibrary');
  const { PostPictureError } = require('../services/postPictures');
  const { CameraRollError } = require('../services/cameraRoll');
  if (err instanceof PostPictureError || err instanceof CameraRollError) return res.status(err.status).json({ success: false, error: err.message });
  if (err instanceof MediaError) {
    return res.status(err.status).json({ success: false, error: err.message, ...(err.pictures ? { code: 'pictures_not_public', pictures: err.pictures } : {}) });
  }
  const { PulseImageError } = require('../services/pulseImageService');
  if (err instanceof PulseImageError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[PostMedia] ${label} error:`, err);
  // The text or image budget refused the call: nothing was read or made.
  if (err.code === 'AI_BUDGET_EXCEEDED') {
    return res.status(429).json({ success: false, error: `${err.message} Nothing was made; try again when the budget resets.`, code: err.code });
  }
  if (err.response?.status) return res.status(502).json({ success: false, error: 'The AI tool could not answer. Try again later.' });
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/formats', ...admin, (req, res) => {
  const s = service();
  return res.json({
    success: true,
    formats: s.FORMATS.map((f) => ({ key: f, label: s.FORMAT_LABELS[f], min: s.PICTURES[f][0], max: s.PICTURES[f][1] })),
    deliverables: s.FORMAT_FOR_DELIVERABLE,
    story_hours: s.STORY_HOURS,
    // A post's picture from the camera roll after approval (services/postPictures).
    post_picture: (() => {
      const pp = require('../services/postPictures');
      return { per_picture_usd: pp.estimate(1), per_day: pp.dailyCap(), counts: pp.COUNT };
    })(),
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

router.post('/posts/:postId/suggestions', ...admin, aiRateLimiter, async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/pictureSuggestions').suggest(models(), req.params.postId)) });
  } catch (err) {
    return sendError(res, err, 'POST /posts/:postId/suggestions');
  }
});

router.post('/posts/:postId/suggestions/choice', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/pictureSuggestions').recordChoice(models(), req.params.postId, req.body || {})) });
  } catch (err) {
    return sendError(res, err, 'POST /posts/:postId/suggestions/choice');
  }
});

router.get('/suggestions/acceptance', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/pictureSuggestions').acceptance(models())) });
  } catch (err) {
    return sendError(res, err, 'GET /suggestions/acceptance');
  }
});

router.post('/posts/:postId/suggestions/run', ...admin, aiRateLimiter, async (req, res) => {
  try {
    const out = await require('../services/pictureSuggestions').run(models(), req.params.postId, { choice: req.body?.choice, by: byOf(req) });
    return res.status(201).json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'POST /posts/:postId/suggestions/run');
  }
});

router.get('/posts/:postId/picture', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/postPictures').statusOf(models(), req.params.postId)) });
  } catch (err) {
    return sendError(res, err, 'GET /posts/:postId/picture');
  }
});

router.post('/posts/:postId/picture', ...admin, aiRateLimiter, async (req, res) => {
  try {
    const job = await require('../services/postPictures').run(models(), req.params.postId, { by: byOf(req), makeNow: req.body?.make_now === true });
    return res.json({ success: true, job });
  } catch (err) {
    return sendError(res, err, 'POST /posts/:postId/picture');
  }
});

module.exports = router;
