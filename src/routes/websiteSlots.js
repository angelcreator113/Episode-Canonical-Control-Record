/**
 * The public landing page's media slots, managed by admins (Task #2821;
 * docs/reads/2026-10-10-website-content-read.md). Every route is
 * requireAuth + authorize(['ADMIN']). Uploads are refused with 503
 * SITE_STORAGE_NOT_CONFIGURED until SITE_PUBLIC_BUCKET is set. The public
 * read lives in its own file (publicSite.js) so nothing here is public.
 */
const express = require('express');
const multer = require('multer');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];

function sendSlotError(res, err, where) {
  console.error(`[WebsiteSlots] ${where} failed:`, err.message);
  if (err.status) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  return res.status(500).json({ success: false, error: 'The website slot could not be saved. Try again.' });
}

// One file per request, field "file", 25 MB at most (the clip cap; images
// are held to 5 MB by the service).
const slotUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
const oneFile = (req, res, next) => slotUpload.single('file')(req, res, (err) => {
  if (err) {
    console.error('[WebsiteSlots] upload rejected:', err.message);
    return res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 25 MB.' : err.message, code: err.code || 'UPLOAD_REJECTED' });
  }
  return next();
});

const svc = () => require('../services/websiteSlotService');
const models = () => require('../models');

router.get('/', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().listSlots(models()) });
  } catch (err) {
    return sendSlotError(res, err, 'GET /');
  }
});

router.post('/:slotKey/media', ...admin, oneFile, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().uploadMedia(models(), req.params.slotKey, req.file) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /:slotKey/media');
  }
});

// The site's logo from a show's logo in Show Settings (a copy, as a draft).
router.post('/logo/from-show', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().useShowLogo(models(), req.body?.show_id) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /logo/from-show');
  }
});

router.put('/:slotKey/youtube', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().setYoutube(models(), req.params.slotKey, req.body && req.body.url) });
  } catch (err) {
    return sendSlotError(res, err, 'PUT /:slotKey/youtube');
  }
});

router.patch('/:slotKey', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().updateDetails(models(), req.params.slotKey, req.body || {}) });
  } catch (err) {
    return sendSlotError(res, err, 'PATCH /:slotKey');
  }
});

router.post('/:slotKey/poster', ...admin, oneFile, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().uploadPoster(models(), req.params.slotKey, req.file) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /:slotKey/poster');
  }
});

router.post('/:slotKey/captions', ...admin, oneFile, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().uploadCaptions(models(), req.params.slotKey, req.file) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /:slotKey/captions');
  }
});

router.post('/:slotKey/publish', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().publishSlot(models(), req.params.slotKey) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /:slotKey/publish');
  }
});

router.post('/:slotKey/unpublish', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, data: await svc().unpublishSlot(models(), req.params.slotKey) });
  } catch (err) {
    return sendSlotError(res, err, 'POST /:slotKey/unpublish');
  }
});

module.exports = router;
