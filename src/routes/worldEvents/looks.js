/**
 * World Events routes — venue look and event look
 *
 * GET    /api/v1/world/:showId/events/:eventId/venue-look
 * PUT    /api/v1/world/:showId/events/:eventId/venue-look
 * POST   /api/v1/world/:showId/events/:eventId/venue-look/draft
 * GET    /api/v1/world/:showId/events/:eventId/look
 * POST   /api/v1/world/:showId/events/:eventId/look/brief
 * POST   /api/v1/world/:showId/events/:eventId/look/generate
 * POST   /api/v1/world/:showId/events/:eventId/look/upload
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { getModels } = require('./helpers');

// The Event Venue Look (L1; Evoni, 2026-10-02, answers Q1-Q10,
// docs/EVENT_EPISODE_FLOW.md §8(hh)): how the venue is dressed for this
// occasion. Editable while the event's episode is a draft; locked once it
// is accepted (409 VENUE_LOOK_LOCKED).
//   GET  .../venue-look         { venue_look, editable }
//   PUT  .../venue-look         body { venue_look } — Evoni's edit
//   POST .../venue-look/draft   "Draft from event details" (Haiku); keeps
//                               every part she edited (Q8)
// The ids of an event look request are ids: a bad show, event or set id is
// a 400 with its reason, not a database cast error (fourth audit, 2026-10-15).
const lookIds = (req, res, next) => {
  const { validateUUID } = require('../../middleware/requestValidation');
  for (const [name, value] of [['showId', req.params.showId], ['eventId', req.params.eventId], ['scene_set_id', req.body?.scene_set_id]]) {
    if (value != null && value !== '' && (typeof value !== 'string' || !validateUUID(value))) {
      return res.status(400).json({ success: false, code: 'BAD_ID', error: `${name} must be an id` });
    }
  }
  return next();
};

const sendVenueLookError = (res, err, label) => {
  const { VenueLookError } = require('../../services/venueLookService');
  if (err instanceof VenueLookError) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/world/:showId/events/:eventId/venue-look', requireAuth, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { getVenueLook } = require('../../services/venueLookService');
    const data = await getVenueLook(models.sequelize, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look read');
  }
});

router.put('/world/:showId/events/:eventId/venue-look', requireAuth, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { saveVenueLook } = require('../../services/venueLookService');
    const data = await saveVenueLook(models.sequelize, {
      showId: req.params.showId, eventId: req.params.eventId, input: req.body?.venue_look,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look save');
  }
});

router.post('/world/:showId/events/:eventId/venue-look/draft', requireAuth, aiRateLimiter, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { draftVenueLook } = require('../../services/venueLookService');
    const data = await draftVenueLook(models.sequelize, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look draft');
  }
});

// "Generate this look" (L7-L9; Evoni, 2026-10-02, answers 1-4 and 6,
// docs/EVENT_EPISODE_FLOW.md §8(hh)): the event's Venue Look made into an
// image on its venue's scene set.
//   GET  .../look            the event's set, the venue's approval, its look
//   POST .../look/brief      the step (look, base or awaiting_approval) with
//                            its brief and cost, shown first (S2); read only
//   POST .../look/generate   body { overrides?, scene_set_id? }: runs the
//                            step after the cost is confirmed (202)
const sendLookImageError = (res, err, label) => {
  const { VenueLookImageError } = require('../../services/venueLookImageService');
  if (err instanceof VenueLookImageError) {
    return res.status(err.status).json({ success: false, code: err.code, error: err.message, ...(err.options ? { options: err.options } : {}) });
  }
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/world/:showId/events/:eventId/look', requireAuth, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { eventLook } = require('../../services/venueLookImageService');
    const data = await eventLook(models.sequelize, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendLookImageError(res, err, 'Event look read');
  }
});

router.post('/world/:showId/events/:eventId/look/brief', requireAuth, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { lookBrief } = require('../../services/venueLookImageService');
    const data = await lookBrief(models.sequelize, {
      showId: req.params.showId, eventId: req.params.eventId,
      chosenSetId: req.body?.scene_set_id || null, overrides: req.body?.overrides,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendLookImageError(res, err, 'Event look brief');
  }
});

router.post('/world/:showId/events/:eventId/look/generate', requireAuth, aiRateLimiter, lookIds, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { startLook } = require('../../services/venueLookImageService');
    const { result, run } = await startLook(models, {
      showId: req.params.showId, eventId: req.params.eventId,
      chosenSetId: req.body?.scene_set_id || null, overrides: req.body?.overrides,
    });
    res.status(run ? 202 : 200).json({ success: true, data: result });
    if (run) await run();
  } catch (err) {
    if (!res.headersSent) return sendLookImageError(res, err, 'Event look generate');
    console.error('Event look generate error after reply:', err);
  }
});

// An event's look from an uploaded image (Evoni, 2026-10-15): one image
// field (image or images), JPEG, PNG or WebP, up to 10 MB; scene_set_id
// chooses the set when the venue has several (answer 3).
// A refused file is a 400 or 413 with its reason, not a 500 (audit, 2026-10-15).
const lookUpload = require('../../middleware/uploadOrRefuse').uploadOrRefuse(require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
}).fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 1 }]), { label: 'Event look upload' });

router.post('/world/:showId/events/:eventId/look/upload', requireAuth, lookUpload, lookIds, async (req, res) => {
  try {
    const file = [...(req.files?.images || []), ...(req.files?.image || [])][0];
    if (!file) return res.status(400).json({ success: false, error: 'No image file provided' });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { uploadLook } = require('../../services/venueLookImageService');
    const storeImage = async (set) => {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
      const region = process.env.AWS_REGION || 'us-east-1';
      const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
      const key = `scene-sets/${set.id}/looks/${req.params.eventId}/upload-${Date.now()}.${ext}`;
      await new S3Client({ region }).send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'max-age=31536000',
      }));
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    };
    const data = await uploadLook(models, {
      showId: req.params.showId, eventId: req.params.eventId, chosenSetId: req.body?.scene_set_id || null, storeImage,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendLookImageError(res, err, 'Event look upload');
  }
});

module.exports = router;
