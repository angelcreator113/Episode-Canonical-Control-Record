'use strict';

/**
 * Voice clips: lines of an episode's script spoken by Evoni (Teleprompter
 * batch 3; Evoni, 2026-10-20). Mounted at /api/v1/script-voice-clips.
 *
 *   GET    /:episodeId            the episode's live clips
 *   POST   /:episodeId            upload one (multipart: audio, beat_number, line_index,
 *                                 speaker, line_text, duration_seconds?); the line's
 *                                 earlier clip is soft-deleted
 *   DELETE /:episodeId/:clipId    soft delete (the file stays in S3)
 *
 * Replacing a line's clip (an upload over it) and removing one are for the
 * clip's recorder or an admin (V-1; scriptVoiceClipsService.mayChange);
 * anyone else gets a 403 NOT_CLIP_OWNER, and an upload is refused before
 * its file goes to S3.
 *
 * The audio goes to S3 the raw clips' way (rawClipMedia.uploadFile), under
 * episodes/<episode>/voice-clips/. Before migration 20261020120000 has run,
 * each route is a 409 that says so, and an upload is refused before any file
 * goes to S3.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const voice = require('../services/scriptVoiceClipsService');
const media = require('../services/rawClipMedia');

const router = express.Router();

const MAX_MB = Number(process.env.VOICE_CLIP_MAX_MB) || 25;
const AUDIO_EXTS = ['.webm', '.ogg', '.oga', '.opus', '.m4a', '.mp4', '.mp3', '.wav', '.aac'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      require('fs').mkdir(media.TMP_DIR, { recursive: true }, (err) => cb(err, media.TMP_DIR));
    },
    filename: (req, file, cb) => cb(null, `voice-${Date.now()}-${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if ((file.mimetype || '').startsWith('audio/') || AUDIO_EXTS.includes(ext)) cb(null, true);
    else cb(new voice.VoiceClipError(400, 'Only audio files can be uploaded here'));
  },
});

const sendError = (res, err, what) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `That clip is over ${MAX_MB} MB` : err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: message });
  }
  if (err.status) return res.status(err.status).json({ success: false, error: err.message, ...(err.code ? { code: err.code } : {}) });
  console.error(`[ScriptVoiceClips] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: err.message });
};

const checkEpisodeId = (id) => {
  if (!UUID_RE.test(String(id || ''))) throw new voice.VoiceClipError(404, 'Episode not found');
};

router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    checkEpisodeId(req.params.episodeId);
    const rows = await voice.listClips(models.sequelize, req.params.episodeId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return sendError(res, err, 'list');
  }
});

router.post('/:episodeId', requireAuth, (req, res) => {
  upload.single('audio')(req, res, async (uploadErr) => {
    const file = req.file;
    try {
      if (uploadErr) throw uploadErr;
      checkEpisodeId(req.params.episodeId);
      if (!file) throw new voice.VoiceClipError(400, 'No audio was sent (field "audio")');
      const fields = voice.readFields(req.body || {});
      await voice.ensureTable(models.sequelize);
      const episode = await voice.findEpisode(models.sequelize, req.params.episodeId);
      await voice.checkMayRecord(models.sequelize, req.user, { episodeId: episode.id, beatNumber: fields.beat_number, lineIndex: fields.line_index });
      const id = uuidv4();
      const ext = path.extname(file.originalname || '').toLowerCase() || '.webm';
      const s3Key = voice.clipKey(episode.id, id, ext);
      const contentType = file.mimetype || 'audio/webm';
      const url = await media.uploadFile(file.path, s3Key, contentType);
      const { clip, replaced } = await voice.saveClip(models.sequelize, {
        ...fields, id, episode_id: episode.id, s3_key: s3Key, url, content_type: contentType,
        file_size_bytes: file.size, created_by: req.user?.id || null,
      }, req.user);
      return res.status(201).json({ success: true, data: clip, replaced });
    } catch (err) {
      return sendError(res, err, 'upload');
    } finally {
      if (file) await media.removeFile(file.path);
    }
  });
});

router.delete('/:episodeId/:clipId', requireAuth, async (req, res) => {
  try {
    checkEpisodeId(req.params.episodeId);
    if (!UUID_RE.test(String(req.params.clipId || ''))) return res.status(404).json({ success: false, error: 'Voice clip not found' });
    const removed = await voice.removeClip(models.sequelize, req.params.episodeId, req.params.clipId, req.user);
    if (!removed) return res.status(404).json({ success: false, error: 'Voice clip not found' });
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'delete');
  }
});

module.exports = router;
