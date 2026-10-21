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

router.post('/:episodeId', requireAuth, aiRateLimiter, (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr;
      const file = req.file;
      if (!file) throw new poses.PoseError(400, 'No photo was sent (field "image")');
      const fields = poses.readFields(req.body, { requireAll: true });
      const episode = await poses.findEpisode(models.sequelize, req.params.episodeId);
      const info = await media.readUpload(file.buffer);

      const id = uuidv4();
      // The stored name and type follow what the file is, not what it is called.
      const { ext, contentType } = media.FORMAT_FILES[info.format];
      const originalKey = `${media.posePrefix(episode.id, id)}/original.${ext}`;
      const originalUrl = await media.putBuffer(originalKey, file.buffer, contentType);
      const row = await poses.createPose(models.sequelize, {
        id, episode_id: episode.id, show_id: episode.show_id,
        character_key: fields.character_key, pose: fields.pose,
        original_filename: file.originalname, content_type: contentType, file_size_bytes: file.size,
        width: info.width, height: info.height,
        original_key: originalKey, original_url: originalUrl, created_by: req.user?.id ? String(req.user.id) : null,
      });
      media.enqueue(models.sequelize, {
        poseId: id, episodeId: episode.id, originalKey, characterKey: fields.character_key, buffer: file.buffer,
      });
      return res.status(202).json({ success: true, data: row });
    } catch (err) {
      return sendError(res, err, 'upload');
    }
  });
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
