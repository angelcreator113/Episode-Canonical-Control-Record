'use strict';

/**
 * Character poses: photos of Lala and JustAWoman for one episode, labelled
 * Front, Back, Side or Glamour, on the episode's Files tab (Evoni,
 * 2026-10-20). Mounted at /api/v1/episode-poses. All requireAuth; the two
 * that start paid processing (remove.bg, Replicate) add aiRateLimiter.
 *
 *   GET    /:episodeId                     the episode's poses (by character, then pose,
 *                                          the default first, then newest)
 *   POST   /:episodeId                     upload one (multipart: image, character_key, pose);
 *                                          processing starts at once (202 Accepted)
 *   PATCH  /:episodeId/:poseId             character_key, pose, is_default (one per pose)
 *   POST   /:episodeId/:poseId/reprocess   run the processing again from the original
 *   DELETE /:episodeId/:poseId             soft delete (files stay in S3)
 *
 * The original is never changed; the enhanced photo and the cut-out are
 * further files (episodePoseMedia).
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const models = require('../models');
const poses = require('../services/episodePosesService');
const media = require('../services/episodePoseMedia');

const router = express.Router();

const MAX_MB = 25;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if ((file.mimetype || '').startsWith('image/') || IMAGE_EXTS.includes(ext)) cb(null, true);
    else cb(new poses.PoseError(400, 'Only photos can be uploaded here'));
  },
});

const sendError = (res, err, what) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `That photo is over ${MAX_MB} MB` : err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: message });
  }
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[Poses] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    const rows = await poses.listPoses(models.sequelize, req.params.episodeId, { activeIds: media.activeIds() });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return sendError(res, err, 'list');
  }
});

// Stores a photo as a new pose of this episode and starts its processing.
async function storePose(req, episode, fields, { buffer, filename, size }) {
  const info = await media.readUpload(buffer);
  const id = uuidv4();
  // The stored name and type follow what the file is, not what it is called.
  const { ext, contentType } = media.FORMAT_FILES[info.format];
  const originalKey = `${media.posePrefix(episode.id, id)}/original.${ext}`;
  const originalUrl = await media.putBuffer(originalKey, buffer, contentType);
  const row = await poses.createPose(models.sequelize, {
    id, episode_id: episode.id, show_id: episode.show_id,
    character_key: fields.character_key, pose: fields.pose,
    original_filename: filename, content_type: contentType, file_size_bytes: size,
    width: info.width, height: info.height,
    original_key: originalKey, original_url: originalUrl, created_by: req.user?.id ? String(req.user.id) : null,
  });
  media.enqueue(models.sequelize, {
    poseId: id, episodeId: episode.id, originalKey, characterKey: fields.character_key, buffer,
  });
  return row;
}

router.post('/:episodeId', requireAuth, aiRateLimiter, (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr;
      const file = req.file;
      if (!file) throw new poses.PoseError(400, 'No photo was sent (field "image")');
      const fields = poses.readFields(req.body, { requireAll: true });
      const episode = await poses.findEpisode(models.sequelize, req.params.episodeId);
      const row = await storePose(req, episode, fields, { buffer: file.buffer, filename: file.originalname, size: file.size });
      return res.status(202).json({ success: true, data: row });
    } catch (err) {
      return sendError(res, err, 'upload');
    }
  });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /:episodeId/from-lookbook { image_id, character_key, pose }
 * Files one of this episode's Style photos (Files › Style photos, usually
 * from To sort) as a character pose (Evoni, 2026-10-22: one drop zone, then
 * sort). The photo becomes a pose and is processed like an upload; it
 * leaves Style photos.
 */
router.post('/:episodeId/from-lookbook', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const fields = poses.readFields(req.body || {}, { requireAll: true });
    const episode = await poses.findEpisode(models.sequelize, req.params.episodeId);
    const imageId = String(req.body?.image_id || '');
    if (!UUID_RE.test(imageId)) throw new poses.PoseError(400, 'Choose a photo from Style photos (image_id)');
    const [[img]] = await models.sequelize.query(
      `SELECT id, image_url, s3_key, file_name, file_size_bytes FROM episode_lookbook_images
        WHERE id = :imageId AND episode_id = :episodeId AND source = 'upload' AND deleted_at IS NULL LIMIT 1`,
      { replacements: { imageId, episodeId: episode.id } });
    if (!img) throw new poses.PoseError(404, "That photo is not in this episode's Style photos");
    let buffer;
    try {
      buffer = img.s3_key ? await media.getBuffer(img.s3_key) : await require('../services/youtubeThumbnailService').fetchImage(img.image_url);
    } catch (err) {
      console.error('[Poses] Style photo could not be read:', err.message);
      throw new poses.PoseError(502, 'That photo could not be read. Try again.');
    }
    const row = await storePose(req, episode, fields, { buffer, filename: img.file_name, size: img.file_size_bytes ?? buffer.length });
    await require('../services/episodeLookbookService').deleteImage(models, episode.id, img.id);
    return res.status(202).json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'from-lookbook');
  }
});

router.patch('/:episodeId/:poseId', requireAuth, async (req, res) => {
  try {
    const row = await poses.updatePose(models.sequelize, req.params.episodeId, req.params.poseId, req.body || {});
    if (!row) return res.status(404).json({ success: false, error: 'Pose not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'update');
  }
});

router.post('/:episodeId/:poseId/reprocess', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const pose = await poses.getPose(models.sequelize, req.params.episodeId, req.params.poseId);
    if (!pose) return res.status(404).json({ success: false, error: 'Pose not found' });
    if (media.activeIds().includes(pose.id)) {
      return res.status(409).json({ success: false, error: 'This photo is already being processed' });
    }
    const row = await poses.setState(models.sequelize, pose.id, 'queued', { steps: {} });
    media.enqueue(models.sequelize, {
      poseId: pose.id, episodeId: pose.episode_id, originalKey: pose.original_key, characterKey: pose.character_key,
    });
    return res.status(202).json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'reprocess');
  }
});

router.delete('/:episodeId/:poseId', requireAuth, async (req, res) => {
  try {
    const removed = await poses.removePose(models.sequelize, req.params.episodeId, req.params.poseId);
    if (!removed) return res.status(404).json({ success: false, error: 'Pose not found' });
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'delete');
  }
});

module.exports = router;
