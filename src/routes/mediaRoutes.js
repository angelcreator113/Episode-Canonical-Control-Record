'use strict';
/**
 * Visual Memory, phase 1: the shared picture library (services/mediaLibrary).
 * Mounted at /api/v1/media. Reads need sign-in and see only what the reader
 * may (an ADMIN everything; anyone else approved pictures that are not
 * private); every write is ADMIN. Nothing here writes canon.
 *
 *   GET    /?entity_type=&entity_id=     the pictures tagged with one thing
 *   GET    /taggables?q=                 characters, places, events, brands
 *                                        to tag, by name (ADMIN)
 *   GET    /:id                          one picture with its tags
 *   POST   /                             a picture: an image file ("image",
 *                                        stored like other uploads) or { url };
 *                                        caption, status, visibility,
 *                                        usage_rights, details, links (JSON)
 *   PUT    /:id                          caption, status, visibility,
 *                                        usage_rights, details
 *   DELETE /:id                          soft, with its tags
 *   POST   /:id/links                    { entity_type, entity_id, role }
 *   DELETE /:id/links/:linkId            untag (soft)
 *   POST   /bring-existing               carry portraits, scene stills,
 *                                        invitations and post pictures in
 */
const express = require('express');
const multer = require('multer');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];
const byOf = (req) => req.user?.email || req.user?.id || null;
const media = () => require('../services/mediaLibrary');
const models = () => require('../models');

function sendError(res, err, label) {
  const { MediaError } = media();
  if (err instanceof MediaError) return res.status(err.status).json({ success: false, error: err.message });
  const { PulseImageError } = require('../services/pulseImageService');
  if (err instanceof PulseImageError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[Media] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } }).single('image');
const oneImage = (req, res, next) => imageUpload(req, res, (err) => {
  if (!err) return next();
  console.error('[Media] upload rejected:', err.message);
  return res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'The picture is 15 MB at most.' : err.message });
});

// A multipart form sends links and details as JSON text.
const NOT_JSON = Symbol('not JSON');
const parsed = (v) => {
  if (v == null || typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[Media] a form field was not JSON:', err.message);
    return NOT_JSON;
  }
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await media().listFor(models(), {
      entityType: req.query.entity_type, entityId: req.query.entity_id, audience: media().audienceOf(req.user),
    });
    return res.json({ success: true, items });
  } catch (err) {
    return sendError(res, err, 'GET /');
  }
});

router.get('/taggables', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, items: await media().taggables(models(), req.query.q) });
  } catch (err) {
    return sendError(res, err, 'GET /taggables');
  }
});

router.post('/bring-existing', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await media().bringExisting(models(), { by: byOf(req) })) });
  } catch (err) {
    return sendError(res, err, 'POST /bring-existing');
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, asset: await media().getAsset(models(), req.params.id, { audience: media().audienceOf(req.user) }) });
  } catch (err) {
    return sendError(res, err, 'GET /:id');
  }
});

router.post('/', ...admin, oneImage, async (req, res) => {
  try {
    const body = req.body || {};
    let stored = null;
    if (req.file) {
      const { storePulseImage } = require('../services/pulseImageService');
      stored = await storePulseImage(req.file, { keyPrefix: 'media', label: 'The picture' });
    }
    const links = parsed(body.links);
    const details = parsed(body.details);
    if (links === NOT_JSON || details === NOT_JSON) return res.status(400).json({ success: false, error: 'links and details must be JSON.' });
    const out = await media().createAsset(models(), {
      url: stored ? stored.url : body.url,
      storageKey: stored?.key || null, width: stored?.width || null, height: stored?.height || null,
      caption: body.caption, source: stored ? 'upload' : (body.source || 'upload'),
      status: body.status || 'approved', visibility: body.visibility || 'internal',
      usageRights: body.usage_rights, details, links: links || [], by: byOf(req),
    });
    return res.status(out.reused ? 200 : 201).json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'POST /');
  }
});

router.put('/:id', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, asset: await media().updateAsset(models(), req.params.id, req.body || {}) });
  } catch (err) {
    return sendError(res, err, 'PUT /:id');
  }
});

router.delete('/:id', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await media().removeAsset(models(), req.params.id)) });
  } catch (err) {
    return sendError(res, err, 'DELETE /:id');
  }
});

router.post('/:id/links', ...admin, async (req, res) => {
  try {
    await media().getAsset(models(), req.params.id);
    const out = await media().linkAsset(models(), req.params.id, req.body || {}, { by: byOf(req) });
    return res.json({ success: true, ...out, asset: await media().getAsset(models(), req.params.id) });
  } catch (err) {
    return sendError(res, err, 'POST /:id/links');
  }
});

router.delete('/:id/links/:linkId', ...admin, async (req, res) => {
  try {
    await media().getAsset(models(), req.params.id);
    await media().unlinkLink(models(), req.params.id, req.params.linkId);
    return res.json({ success: true, asset: await media().getAsset(models(), req.params.id) });
  } catch (err) {
    return sendError(res, err, 'DELETE /:id/links/:linkId');
  }
});

module.exports = router;
