'use strict';

/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17).
 * Mounted at /api/v1/youtube-thumbnails. All requireAuth.
 *
 *   GET  /episodes/:episodeId/sources   the episode, its show, its show's saved style,
 *                                        and the pictures to choose from
 *   POST /render                         a preview PNG (no saving)
 *   POST /episodes/:episodeId            render and save as the episode's primary thumbnail
 *   PUT  /shows/:showId/style            save the show's style for every episode
 *   GET  /episodes/:episodeId/saved      the episode's saved thumbnails, its current one first
 *   POST /episodes/:episodeId/saved/:thumbnailId/primary   make a saved one the episode's thumbnail
 *   DELETE /episodes/:episodeId/saved/:thumbnailId          delete a saved one (not the current one)
 *   GET  /episodes/:episodeId/draft      the episode's arrangement (layers), or null
 *   PUT  /episodes/:episodeId/draft      keep the episode's arrangement
 *   POST /episodes/:episodeId/pictures   keep an uploaded picture (S3); { url, label }
 *   GET  /fonts/:key                     a thumbnail font, for the editor (thumbnailLayers.FONTS)
 *
 * This is the one place an episode's thumbnail is edited (Evoni, 2026-10-20).
 *
 * Render and save take `spec`: layers ({ version: 2, layers }; Evoni,
 * 2026-10-21: moved, resized and turned freely; thumbnailLayers), as JSON
 * or a multipart field. The earlier spec (JSON: layout, title, kicker,
 * badge, accent, textColor, dim, backgroundUrl, lalaUrl, jawUrl, with
 * optional files `background`, `lala` and `jaw`) still renders, so a page
 * opened before this change keeps working until it is reloaded.
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const yt = require('../services/youtubeThumbnailService');
const thumbLayers = require('../services/thumbnailLayers');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new yt.ThumbnailError(400, 'Only images can be used'));
  },
}).fields([{ name: 'background', maxCount: 1 }, { name: 'lala', maxCount: 1 }, { name: 'jaw', maxCount: 1 }]);

const sendError = (res, err, what) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'An image is over 15 MB' : err.message });
  }
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[YouTubeThumbnail] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: err.message });
};

const pictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new yt.ThumbnailError(400, 'Only images can be used'));
  },
}).single('image');

const readBody = (req) => {
  try {
    return typeof req.body?.spec === 'string' ? JSON.parse(req.body.spec) : (req.body?.spec || req.body || {});
  } catch (err) {
    console.error('[YouTubeThumbnail] spec is not JSON:', err.message);
    throw new yt.ThumbnailError(400, 'spec must be JSON');
  }
};

/** The PNG for a request: layers when the spec is version 2, else the earlier spec and its images. */
async function renderRequest(req) {
  const body = readBody(req);
  if (Number(body?.version) === 2) return yt.renderSpec(thumbLayers.readLayers(body, yt.allowedImageUrl));
  const { spec, images } = await readRender(req, body);
  return yt.render(spec, images);
}

/** Reads the earlier multipart request: the spec and its images, as Buffers. */
async function readRender(req, body) {
  const spec = yt.readSpec(body);
  const file = (name) => req.files?.[name]?.[0]?.buffer || null;
  const lalaUrl = typeof body.lalaUrl === 'string' && body.lalaUrl ? body.lalaUrl : null;
  const figures = spec.layout !== 'center';
  const [background, lala, jaw] = await Promise.all([
    file('background') || (spec.backgroundUrl ? yt.fetchImage(spec.backgroundUrl) : null),
    figures ? (file('lala') || (lalaUrl ? yt.fetchImage(lalaUrl) : null)) : null,
    figures ? (file('jaw') || (spec.jawUrl ? yt.fetchImage(spec.jawUrl) : null)) : null,
  ]);
  return { spec, images: { background, lala, jaw } };
}

router.get('/episodes/:episodeId/sources', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.sources(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'sources');
  }
});

router.post('/render', requireAuth, (req, res) => {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr;
      const png = await renderRequest(req);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-store');
      return res.send(png);
    } catch (err) {
      return sendError(res, err, 'render');
    }
  });
});

router.post('/episodes/:episodeId', requireAuth, (req, res) => {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr;
      const [[episode]] = await models.sequelize.query(
        'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
        { replacements: { episodeId: req.params.episodeId } });
      if (!episode) throw new yt.ThumbnailError(404, 'Episode not found');
      const png = await renderRequest(req);
      const saved = await yt.saveAsPrimary(models.sequelize, episode.id, png);
      return res.status(201).json({ success: true, data: saved });
    } catch (err) {
      return sendError(res, err, 'save');
    }
  });
});

router.put('/shows/:showId/style', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.saveStyle(models.sequelize, req.params.showId, req.body || {}) });
  } catch (err) {
    return sendError(res, err, 'style');
  }
});

router.get('/episodes/:episodeId/saved', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.listSaved(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'saved list');
  }
});

router.post('/episodes/:episodeId/saved/:thumbnailId/primary', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.makePrimary(models.sequelize, req.params.episodeId, req.params.thumbnailId) });
  } catch (err) {
    return sendError(res, err, 'make primary');
  }
});

router.delete('/episodes/:episodeId/saved/:thumbnailId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.removeSaved(models.sequelize, req.params.episodeId, req.params.thumbnailId) });
  } catch (err) {
    return sendError(res, err, 'delete');
  }
});

router.get('/episodes/:episodeId/draft', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.getDraft(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'draft');
  }
});

router.put('/episodes/:episodeId/draft', requireAuth, async (req, res) => {
  try {
    const spec = await yt.saveDraft(models.sequelize, req.params.episodeId, readBody(req), req.user?.id ? String(req.user.id) : null);
    return res.json({ success: true, data: spec });
  } catch (err) {
    return sendError(res, err, 'draft save');
  }
});

router.post('/episodes/:episodeId/pictures', requireAuth, (req, res) => {
  pictureUpload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr;
      if (!req.file) throw new yt.ThumbnailError(400, 'Choose a picture to upload');
      const [[episode]] = await models.sequelize.query(
        'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
        { replacements: { episodeId: req.params.episodeId } });
      if (!episode) throw new yt.ThumbnailError(404, 'Episode not found');
      const picture = await yt.uploadPicture(episode.id, req.file.buffer, req.file.originalname);
      return res.status(201).json({ success: true, data: picture });
    } catch (err) {
      return sendError(res, err, 'picture upload');
    }
  });
});

// The editor draws with the same fonts the server renders with.
router.get('/fonts/:key', requireAuth, (req, res) => {
  const file = thumbLayers.fontFile(req.params.key);
  if (!file) return res.status(404).json({ success: false, error: 'No such font' });
  res.set('Cache-Control', 'private, max-age=604800');
  return res.type('font/ttf').sendFile(file, (err) => {
    if (err && !res.headersSent) {
      console.error('[YouTubeThumbnail] font send failed:', err.message);
      res.status(500).json({ success: false, error: 'Could not send the font' });
    } else if (err) {
      console.error('[YouTubeThumbnail] font send failed after headers:', err.message);
    }
  });
});

module.exports = router;
