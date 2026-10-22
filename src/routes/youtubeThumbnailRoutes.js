'use strict';

/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17).
 * Mounted at /api/v1/youtube-thumbnails. All requireAuth.
 *
 *   GET  /episodes/:episodeId/sources   the episode, its show, its show's saved style,
 *                                        and the pictures to choose from
 *   POST /render                         the file as it would be saved (no saving): PNG, or JPEG over 2 MB
 *   POST /render/small                   the same layers drawn small (JPEG, 640 wide), for the season grid
 *   POST /episodes/:episodeId            render and save as the episode's primary thumbnail
 *   PUT  /shows/:showId/style            save the show's style for every episode
 *   GET  /templates                      every show's named templates, with their pictures (the Templates page)
 *   GET  /shows/:showId/season           the show's episodes, each with its thumbnail (or none) and whether it has its own arrangement
 *   GET  /shows/:showId/templates        the show's named templates, the default first
 *   POST /shows/:showId/templates        save a new named template { name, spec, makeDefault? }
 *   PATCH /shows/:showId/templates/:templateId   rename, replace its layers, or make it the default
 *   DELETE /shows/:showId/templates/:templateId  delete one (the next becomes the default)
 *   GET  /episodes/:episodeId/versions   the episode's versions to compare, with their pictures
 *   POST /episodes/:episodeId/versions   keep the arrangement as a version { spec, name? }
 *   PATCH /episodes/:episodeId/versions/:versionId   rename it, or replace its layers
 *   DELETE /episodes/:episodeId/versions/:versionId  delete one
 *   GET  /episodes/:episodeId/saved      the episode's saved thumbnails, its current one first
 *   POST /episodes/:episodeId/saved/:thumbnailId/primary   make a saved one the episode's thumbnail
 *   DELETE /episodes/:episodeId/saved/:thumbnailId          delete a saved one (not the current one)
 *   GET  /episodes/:episodeId/draft      the episode's arrangement (layers), or null
 *   PUT  /episodes/:episodeId/draft      keep the episode's arrangement
 *   POST /episodes/:episodeId/pictures   keep an uploaded picture (S3); { url, label }
 *   POST /episodes/:episodeId/title-ideas         five title ideas with a hook each (AI, within the daily budget)
 *   POST /episodes/:episodeId/pictures/cut-out    a picture's background removed, kept as an upload (AI image budget)
 *   GET  /fonts/:key                     a thumbnail font, for the editor (thumbnailLayers.FONTS)
 *   GET  /preview?url=&w=                a smaller copy of one of our pictures, for the editor (WebP)
 *
 * This is the one place an episode's thumbnail is edited (Evoni, 2026-10-20).
 *
 * Render and save take the layers as JSON ({ version: 2, layers }; Evoni,
 * 2026-10-21: moved, resized and turned freely; thumbnailLayers). Pictures
 * are S3 addresses; an upload is kept first (POST /episodes/:id/pictures).
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const models = require('../models');
const yt = require('../services/youtubeThumbnailService');
const thumbLayers = require('../services/thumbnailLayers');
const thumbAi = require('../services/thumbnailAiService');

const router = express.Router();

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

/** The request's JSON body: the layers ({ version: 2, layers }), read by thumbnailLayers.readLayers. */
const readBody = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

/** The PNG for a request: its layers, drawn (thumbnailLayers). */
async function renderRequest(req) {
  return yt.renderSpec(thumbLayers.readLayers(readBody(req), yt.allowedImageUrl));
}

router.get('/episodes/:episodeId/sources', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.sources(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'sources');
  }
});

router.post('/render', requireAuth, async (req, res) => {
  try {
    // The file exactly as it would be saved: a JPEG when the PNG is over YouTube's 2 MB.
    const file = await yt.forYouTube(await renderRequest(req));
    res.set('Content-Type', file.mime);
    res.set('Cache-Control', 'no-store');
    res.set('X-Thumbnail-Bytes', String(file.bytes));
    res.set('X-Thumbnail-Png-Bytes', String(file.pngBytes));
    return res.send(file.buffer);
  } catch (err) {
    return sendError(res, err, 'render');
  }
});

// A whole season at once (Evoni, 2026-10-21): a small picture of each, quick to draw and to show in a grid.
router.post('/render/small', requireAuth, async (req, res) => {
  try {
    const jpeg = await yt.smallPreview(await renderRequest(req));
    res.set('Cache-Control', 'no-store');
    return res.type('image/jpeg').send(jpeg);
  } catch (err) {
    return sendError(res, err, 'small render');
  }
});

router.get('/shows/:showId/season', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.seasonEpisodes(models.sequelize, req.params.showId) });
  } catch (err) {
    return sendError(res, err, 'season');
  }
});

router.post('/episodes/:episodeId', requireAuth, async (req, res) => {
  try {
    const [[episode]] = await models.sequelize.query(
      'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId: req.params.episodeId } });
    if (!episode) throw new yt.ThumbnailError(404, 'Episode not found');
    // The layers are kept with it, so a saved thumbnail can become the show's template.
    const spec = thumbLayers.readLayers(readBody(req), yt.allowedImageUrl);
    const saved = await yt.saveAsPrimary(models.sequelize, episode.id, await yt.renderSpec(spec), spec);
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    return sendError(res, err, 'save');
  }
});

router.put('/shows/:showId/style', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.saveStyle(models.sequelize, req.params.showId, req.body || {}) });
  } catch (err) {
    return sendError(res, err, 'style');
  }
});

// A show's named templates (Evoni, 2026-10-21: several per show, renamed at will).
const userOf = (req) => (req.user?.id ? String(req.user.id) : null);

router.get('/templates', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.listAllTemplates(models.sequelize) });
  } catch (err) {
    return sendError(res, err, 'all templates');
  }
});

router.get('/shows/:showId/templates', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.listTemplates(models.sequelize, req.params.showId) });
  } catch (err) {
    return sendError(res, err, 'templates');
  }
});

router.post('/shows/:showId/templates', requireAuth, async (req, res) => {
  try {
    return res.status(201).json({ success: true, data: await yt.createTemplate(models.sequelize, req.params.showId, readBody(req), userOf(req)) });
  } catch (err) {
    return sendError(res, err, 'template save');
  }
});

router.patch('/shows/:showId/templates/:templateId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.updateTemplate(models.sequelize, req.params.showId, req.params.templateId, readBody(req), userOf(req)) });
  } catch (err) {
    return sendError(res, err, 'template change');
  }
});

router.delete('/shows/:showId/templates/:templateId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.deleteTemplate(models.sequelize, req.params.showId, req.params.templateId) });
  } catch (err) {
    return sendError(res, err, 'template delete');
  }
});

// An episode's versions to compare (Evoni, 2026-10-21).
router.get('/episodes/:episodeId/versions', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.listVersions(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'versions');
  }
});

router.post('/episodes/:episodeId/versions', requireAuth, async (req, res) => {
  try {
    return res.status(201).json({ success: true, data: await yt.createVersion(models.sequelize, req.params.episodeId, readBody(req), userOf(req)) });
  } catch (err) {
    return sendError(res, err, 'version save');
  }
});

router.patch('/episodes/:episodeId/versions/:versionId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.updateVersion(models.sequelize, req.params.episodeId, req.params.versionId, readBody(req)) });
  } catch (err) {
    return sendError(res, err, 'version change');
  }
});

router.delete('/episodes/:episodeId/versions/:versionId', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await yt.deleteVersion(models.sequelize, req.params.episodeId, req.params.versionId) });
  } catch (err) {
    return sendError(res, err, 'version delete');
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

// AI help (Evoni, 2026-10-21), within the daily budgets: title ideas, and a picture's background removed.
router.post('/episodes/:episodeId/title-ideas', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    return res.json({ success: true, data: await thumbAi.titleIdeas(models.sequelize, req.params.episodeId) });
  } catch (err) {
    return sendError(res, err, 'title ideas');
  }
});

router.post('/episodes/:episodeId/pictures/cut-out', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const [[episode]] = await models.sequelize.query(
      'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId: req.params.episodeId } });
    if (!episode) throw new yt.ThumbnailError(404, 'Episode not found');
    const body = readBody(req);
    const picture = await thumbAi.cutOut(episode.id, String(body.url || ''), body.name);
    return res.status(201).json({ success: true, data: picture });
  } catch (err) {
    return sendError(res, err, 'cut out');
  }
});

// The editor draws smaller copies of the pictures (faster); the saved file uses the full ones.
router.get('/preview', requireAuth, async (req, res) => {
  try {
    const webp = await yt.previewImage(String(req.query.url || ''), req.query.w);
    res.set('Cache-Control', 'private, max-age=86400');
    return res.type('image/webp').send(webp);
  } catch (err) {
    return sendError(res, err, 'preview');
  }
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
