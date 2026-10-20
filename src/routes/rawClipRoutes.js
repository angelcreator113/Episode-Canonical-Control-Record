'use strict';

/**
 * Raw clips: the episode's raw, unedited video clips (Assets → Files;
 * Evoni, 2026-10-17). Mounted at /api/v1/episode-clips.
 *
 *   GET    /:episodeId                         the episode's clips
 *   POST   /:episodeId                         upload one (multipart: video, performer,
 *                                              guest_name?, label?, green_screen?, strength?)
 *   PATCH  /:episodeId/:clipId                 performer, guest_name, label, beat_number (the scene),
 *                                              is_favorite (one per beat), start_line (teleprompter)
 *   POST   /:episodeId/:clipId/remove-green    (re)run green removal { strength }
 *   DELETE /:episodeId/:clipId                 soft delete (files stay in S3)
 *
 * green_screen on upload queues green removal at once. The original is
 * never changed; the cut-out is a second file (rawClipMedia).
 *
 * is_favorite and start_line come with migration 20261020090000; until it
 * has run, clips list without them and a PATCH of them is a 409 that says so.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const clips = require('../services/rawClipsService');
const media = require('../services/rawClipMedia');

const router = express.Router();

const MAX_MB = Number(process.env.RAW_CLIP_MAX_MB) || 500;
const VIDEO_EXTS = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.3gp'];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      require('fs').mkdir(media.TMP_DIR, { recursive: true }, (err) => cb(err, media.TMP_DIR));
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if ((file.mimetype || '').startsWith('video/') || VIDEO_EXTS.includes(ext)) cb(null, true);
    else cb(new clips.RawClipError(400, 'Only video files can be uploaded here'));
  },
});

const sendError = (res, err, what) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `That clip is over ${MAX_MB} MB` : err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: message });
  }
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[RawClips] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    const rows = await clips.listClips(models.sequelize, req.params.episodeId, { activeIds: media.activeIds() });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return sendError(res, err, 'list');
  }
});

router.post('/:episodeId', requireAuth, (req, res) => {
  upload.single('video')(req, res, async (uploadErr) => {
    const file = req.file;
    let handedToJob = false;
    let thumbPath = null;
    try {
      if (uploadErr) throw uploadErr;
      if (!file) throw new clips.RawClipError(400, 'No video file was sent (field "video")');
      const fields = clips.readFields(req.body, { requirePerformer: true });
      const greenScreen = clips.truthy(req.body.green_screen);
      const strength = clips.readStrength(req.body.strength);
      const episode = await clips.findEpisode(models.sequelize, req.params.episodeId);

      const info = await media.inspect(file.path);
      thumbPath = info.thumbPath;
      const id = uuidv4();
      const prefix = media.clipPrefix(episode.id, id);
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
      const s3KeyRaw = `${prefix}/original${ext}`;
      const urlRaw = await media.uploadFile(file.path, s3KeyRaw, file.mimetype || 'video/mp4');
      let thumbKey = null;
      let thumbUrl = null;
      if (thumbPath) {
        thumbKey = `${prefix}/thumbnail.jpg`;
        thumbUrl = await media.uploadFile(thumbPath, thumbKey, 'image/jpeg');
      }

      const row = await clips.createClip(models.sequelize, {
        id, episode_id: episode.id, show_id: episode.show_id,
        performer: fields.performer, guest_name: fields.guest_name, label: fields.label ?? clips.readFields({ label: file.originalname }).label,
        original_filename: file.originalname, content_type: file.mimetype, file_size_bytes: file.size,
        duration_seconds: info.duration_seconds, width: info.width, height: info.height,
        s3_key_raw: s3KeyRaw, url_raw: urlRaw, thumbnail_key: thumbKey, thumbnail_url: thumbUrl,
        key_status: greenScreen ? 'queued' : 'none', key_strength: strength,
      });
      if (greenScreen) {
        handedToJob = media.enqueueKey(models.sequelize, { clipId: id, episodeId: episode.id, s3KeyRaw, strength, localPath: file.path });
      }
      return res.status(201).json({ success: true, data: row });
    } catch (err) {
      return sendError(res, err, 'upload');
    } finally {
      await media.removeFile(thumbPath);
      if (file && !handedToJob) await media.removeFile(file.path);
    }
  });
});

router.patch('/:episodeId/:clipId', requireAuth, async (req, res) => {
  try {
    const row = await clips.updateClip(models.sequelize, req.params.episodeId, req.params.clipId, req.body || {});
    if (!row) return res.status(404).json({ success: false, error: 'Clip not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'update');
  }
});

router.post('/:episodeId/:clipId/remove-green', requireAuth, async (req, res) => {
  try {
    const strength = clips.readStrength((req.body || {}).strength);
    const clip = await clips.getClip(models.sequelize, req.params.episodeId, req.params.clipId);
    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });
    if (media.activeIds().includes(clip.id)) {
      return res.status(409).json({ success: false, error: 'Green removal is already running for this clip' });
    }
    const row = await clips.setKeyState(models.sequelize, clip.id, 'queued', { strength });
    media.enqueueKey(models.sequelize, { clipId: clip.id, episodeId: clip.episode_id, s3KeyRaw: clip.s3_key_raw, strength });
    return res.status(202).json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'remove-green');
  }
});

router.delete('/:episodeId/:clipId', requireAuth, async (req, res) => {
  try {
    const removed = await clips.removeClip(models.sequelize, req.params.episodeId, req.params.clipId);
    if (!removed) return res.status(404).json({ success: false, error: 'Clip not found' });
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'delete');
  }
});

module.exports = router;
