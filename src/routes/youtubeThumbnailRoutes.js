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
 *
 * This is the one place an episode's thumbnail is edited (Evoni, 2026-10-20).
 *
 * Render and save take multipart: `spec` (JSON: layout, title, kicker, badge,
 * accent, textColor, dim, backgroundUrl, lalaUrl, jawUrl) and optional files
 * `background`, `lala` and `jaw` (JustAWoman; an upload wins over its URL).
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const yt = require('../services/youtubeThumbnailService');

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

/** Reads the multipart request: the spec and its images, as Buffers. */
async function readRender(req) {
  let body = {};
  try {
    body = typeof req.body?.spec === 'string' ? JSON.parse(req.body.spec) : (req.body?.spec || req.body || {});
  } catch (err) {
    console.error('[YouTubeThumbnail] spec is not JSON:', err.message);
    throw new yt.ThumbnailError(400, 'spec must be JSON');
  }
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
      const { spec, images } = await readRender(req);
      const png = await yt.render(spec, images);
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
      const { spec, images } = await readRender(req);
      const png = await yt.render(spec, images);
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

module.exports = router;
