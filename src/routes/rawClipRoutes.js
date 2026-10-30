'use strict';

/**
 * Raw clips: the episode's raw, unedited video clips (Assets → Files;
 * Evoni, 2026-10-17). Mounted at /api/v1/episode-clips.
 *
 *   GET    /:episodeId                         the episode's clips
 *   POST   /:episodeId                         upload one (multipart: video, performer,
 *                                              guest_name?, label?, green_screen?, strength?,
 *                                              beat_number?, end_beat_number?, and for a
 *                                              teleprompter take start_line?, beat_marks? (JSON);
 *                                              the browser's own measure: seconds?, width?, height?)
 *   POST   /:episodeId/uploads                 start an upload in parts (JSON: the same fields,
 *                                              plus filename, content_type, size — or
 *                                              size_unknown: true for a take still recording) →
 *                                              { uploadId, clipId, key, partSize }
 *   PUT    /:episodeId/uploads/:uploadId/parts/:partNumber
 *                                              one part (the raw bytes, at most 10 MB)
 *   POST   /:episodeId/uploads/:uploadId/complete
 *                                              finish it (JSON: thumbnail? a small base64 JPEG;
 *                                              size, required when it started without one;
 *                                              fields? the take's fields as they ended up:
 *                                              label, beat_marks, seconds, width, height …)
 *                                              → 201 { success, data, stored, not_stored }
 *   DELETE /:episodeId/uploads/:uploadId       throw the upload away
 *   PATCH  /:episodeId/:clipId                 performer, guest_name, label, beat_number (the scene),
 *                                              end_beat_number (the beat it ends on),
 *                                              is_favorite (one per beat), start_line (teleprompter),
 *                                              beat_marks (a full-episode take's [{ beat, t }])
 *   POST   /:episodeId/:clipId/remove-green    (re)run green removal { strength }
 *   DELETE /:episodeId/:clipId                 soft delete (files stay in S3)
 *
 * green_screen on upload queues green removal at once. The original is
 * never changed; the cut-out is a second file (rawClipMedia).
 *
 * is_favorite and start_line come with migration 20261020090000; until it
 * has run, clips list without them and a PATCH of them is a 409 that says so.
 * beat_marks comes with migration 20261023235900, the same way, and
 * end_beat_number with 20261028120000.
 *
 * The browser measures every upload (frontend lib/videoProbe, 2026-10-28:
 * a 453 MB phone MP4 showed no length, size or picture): its length,
 * width, height and a thumbnail come with the upload. ffprobe is still
 * tried first, with a timeout; whatever it can't read, the browser's is used.
 *
 * A teleprompter take sends its beat, start line and beat markers with the
 * upload (Teleprompter audit 8, 2026-10-24: one request, not an upload and
 * then a PATCH). They are read by the same rules as a PATCH. The answer says
 * which were kept: `stored` and `not_stored` list start_line / beat_marks; a
 * field whose column is not there yet is not_stored, the clip is saved
 * anyway. seconds is the take's length the browser measured, used when
 * ffprobe can't time the file (a browser's WebM).
 *
 * Uploads in parts (Evoni, 2026-10-27: "ENOSPC: no space left on device"
 * on a 22-minute take): each 8 MB part goes straight on to S3 as one part
 * of an S3 multipart upload (rawClipMultipart), so nothing is kept on this
 * server's disk and there is no 500 MB limit (5 GB is). The teleprompter
 * and Assets → Files both upload this way; the one-request POST stays for
 * any older page still open, and checks there is room on the disk first.
 *
 * Failures answer in plain words (rawClipErrors): a full disk is a 507 that
 * says the take is still safe on the phone. The raw error is only logged.
 *
 * Saving while recording (Evoni, 2026-10-28): the teleprompter starts a
 * take's upload while it records (size_unknown: true) and sends each 8 MB
 * part as it fills. Until "complete" brings the size, a part may be 1 byte
 * to 8 MB and at most 640 parts (5 GB) are taken; at complete every part but
 * the last must be exactly 8 MB, or it is listed as missing (409) and sent
 * again. The fields that only exist once the take has ended (its beat
 * markers, its length, its picture size) come with complete, read by the
 * same rules as at the start.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const clips = require('../services/rawClipsService');
const media = require('../services/rawClipMedia');
const voiceFootage = require('../services/voiceFootageJobs');
const parts = require('../services/rawClipMultipart');
const { friendlyError, NO_ROOM, KeyNoRoomError } = require('../services/rawClipErrors');

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
    const message = err.code === 'LIMIT_FILE_SIZE' ? `That clip is over ${MAX_MB} MB` : 'The upload could not be read. Try again.';
    console.warn(`[RawClips] ${what} refused (${err.code}):`, err.message);
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: message });
  }
  // Plain words for Evoni; the raw error (ENOSPC, an S3 code) is only logged.
  const { status, message } = friendlyError(err);
  // A refused request is logged too (Teleprompter audit 9): a 4xx is not silent.
  if (status < 500) console.warn(`[RawClips] ${what} refused (${status}):`, err.message);
  else console.error(`[RawClips] ${what} failed (${status}):`, err.code || err.name || '', err.message);
  return res.status(status).json({ success: false, error: message });
};

// Room the one-request upload needs on the disk: the file, plus a margin
// (nginx buffers the body to disk as well, and the thumbnail is made there).
const DISK_MARGIN = 200 * 1024 * 1024;

/** A 507 before the one-request upload starts, when the disk has no room for it. */
async function roomForUpload(req) {
  if (typeof media.freeBytes !== 'function') return true;
  const incoming = Number(req.headers['content-length']) || 0;
  const free = await media.freeBytes(media.TMP_DIR);
  if (free == null) return true;
  if (free >= incoming + DISK_MARGIN) return true;
  console.error(`[RawClips] upload refused: ${Math.round(free / 1048576)} MB free on the temp disk for a ${Math.round(incoming / 1048576)} MB upload`);
  return false;
}

// The temp folder is swept on start and hourly; uploads in parts expire after 6 hours.
if (process.env.NODE_ENV !== 'test') {
  if (typeof media.startTmpSweeper === 'function') media.startTmpSweeper();
  parts.startExpirySweeper();
}

// ── Uploads in parts, straight to S3 ────────────────────────────────────────

/** The upload `uploadId` of this episode (and this person), or a 404. */
function ownUpload(req) {
  const entry = parts.get(req.params.uploadId);
  if (!entry || entry.episodeId !== String(req.params.episodeId)) {
    throw new clips.RawClipError(404, 'This upload was too old to finish, so it will start again. Tap Retry.');
  }
  if (entry.userId && req.user?.id && String(entry.userId) !== String(req.user.id)) {
    throw new clips.RawClipError(404, 'This upload was too old to finish, so it will start again. Tap Retry.');
  }
  return entry;
}

const isVideo = (filename, contentType) => {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return String(contentType || '').startsWith('video/') || VIDEO_EXTS.includes(ext);
};

router.post('/:episodeId/uploads', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const fields = clips.readFields(body, { requirePerformer: true });
    const greenScreen = clips.truthy(body.green_screen);
    const strength = clips.readStrength(body.strength);
    const seconds = clips.readTakeSeconds(body.seconds);
    const width = clips.readVideoSize(body.width);
    const height = clips.readVideoSize(body.height);
    if (fields.end_beat_number != null && fields.beat_number == null) throw new clips.RawClipError(400, 'Pick the beat the clip starts on before the beat it ends on');
    const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim().slice(0, 255) : 'take.mp4';
    const contentType = typeof body.content_type === 'string' && body.content_type.trim() ? body.content_type.trim().slice(0, 100) : 'video/mp4';
    if (!isVideo(filename, contentType)) throw new clips.RawClipError(400, 'Only video files can be uploaded here');
    // A take still recording has no size yet: it comes with complete.
    const unknown = body.size_unknown === true && (body.size === undefined || body.size === null);
    const size = unknown ? null : Number(body.size);
    if (!unknown) {
      if (!Number.isInteger(size) || size <= 0) throw new clips.RawClipError(400, 'The video is empty, or its size was not sent');
      if (size > parts.MAX_BYTES) throw new clips.RawClipError(413, 'That video is over 5 GB, too big to upload here');
      if (parts.partCount(size) > parts.MAX_PARTS) throw new clips.RawClipError(413, 'That video is too big to upload in parts');
    }
    const episode = await clips.findEpisode(models.sequelize, req.params.episodeId);

    const clipId = uuidv4();
    const ext = path.extname(filename).toLowerCase() || '.mp4';
    const key = `${media.clipPrefix(episode.id, clipId)}/original${ext}`;
    const entry = await parts.begin({
      episode, clipId, key, contentType, size, filename, userId: req.user?.id ?? null,
      fields: { ...fields, greenScreen, strength, seconds, width, height },
    });
    return res.status(201).json({ success: true, uploadId: entry.uploadId, clipId, key, partSize: entry.partSize, parts: unknown ? null : parts.partCount(size) });
  } catch (err) {
    return sendError(res, err, 'upload start');
  }
});

// One part's raw bytes, held in memory (at most 10 MB), never on disk.
const readPart = express.raw({ type: () => true, limit: '10mb' });

router.put('/:episodeId/uploads/:uploadId/parts/:partNumber', requireAuth, (req, res) => {
  readPart(req, res, async (readErr) => {
    try {
      if (readErr) {
        console.warn('[RawClips] part not read:', readErr.type || '', readErr.message);
        throw new clips.RawClipError(readErr.status === 413 ? 413 : 400, readErr.status === 413 ? 'That part is over 10 MB' : 'The part could not be read. Try again.');
      }
      const n = Number(req.params.partNumber);
      if (!Number.isInteger(n) || n < 1 || n > parts.MAX_PARTS) throw new clips.RawClipError(400, 'The part number must be a whole number from 1 to 10000');
      const entry = ownUpload(req);
      if (entry.result) return res.json({ success: true, partNumber: n, done: true });
      const most = entry.size == null ? parts.maxUnknownParts(entry.partSize) : parts.partCount(entry.size, entry.partSize);
      if (n > most) throw new clips.RawClipError(400, `This upload has only ${most} parts`);
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!parts.partFits(entry, n, body.length)) throw new clips.RawClipError(400, `Part ${n} arrived incomplete. Try again.`);
      const etag = await parts.putPart(entry, n, body);
      return res.json({ success: true, partNumber: n, etag });
    } catch (err) {
      return sendError(res, err, `upload part ${req.params.partNumber}`);
    }
  });
});

/** Joins the parts, stores the thumbnail and creates the clip row; the 201 body. */
async function completeUpload(entry, thumbnailB64) {
  const f = entry.fields;
  // Joined once: a retry after a later step failed does not join it again.
  if (!entry.urlRaw) entry.urlRaw = await parts.finish(entry);
  const urlRaw = entry.urlRaw;

  // Its length and size: ffprobe through a signed link, with a timeout; else the browser's.
  let info = null;
  let link = null;
  try {
    link = await parts.readLink(entry.key);
    info = await parts.probe(link);
  } catch (err) {
    console.error('[RawClips] no signed link to measure the take:', err.message);
  }

  const prefix = media.clipPrefix(entry.episodeId, entry.clipId);
  const thumbKey = `${prefix}/thumbnail.jpg`;
  let thumbUrl = null;
  const thumb = parts.readThumbnail(thumbnailB64);
  if (thumb) {
    try {
      thumbUrl = await parts.putSmall(thumbKey, thumb, 'image/jpeg');
    } catch (err) {
      console.error('[RawClips] thumbnail not stored (the clip is kept):', err.message);
    }
  } else if (link && info?.hasVideo) {
    const thumbPath = await parts.thumbnailFromLink(link, info.duration_seconds);
    try {
      if (thumbPath) thumbUrl = await media.uploadFile(thumbPath, thumbKey, 'image/jpeg');
    } catch (err) {
      console.error('[RawClips] thumbnail not stored (the clip is kept):', err.message);
    } finally {
      await media.removeFile(thumbPath);
    }
  }

  const extras = {};
  if (f.start_line !== undefined) extras.start_line = f.start_line;
  if (f.beat_marks !== undefined) extras.beat_marks = f.beat_marks;
  if (f.end_beat_number !== undefined) extras.end_beat_number = f.end_beat_number;
  let row = await clips.createClip(models.sequelize, {
    id: entry.clipId, episode_id: entry.episodeId, show_id: entry.showId,
    performer: f.performer, guest_name: f.guest_name, label: f.label ?? clips.readFields({ label: entry.filename }).label,
    original_filename: entry.filename, content_type: entry.contentType, file_size_bytes: entry.size,
    beat_number: f.beat_number ?? null,
    duration_seconds: info?.duration_seconds ?? f.seconds ?? null, width: info?.width ?? f.width ?? null, height: info?.height ?? f.height ?? null,
    s3_key_raw: entry.key, url_raw: urlRaw, thumbnail_key: thumbUrl ? thumbKey : null, thumbnail_url: thumbUrl,
    key_status: f.greenScreen ? 'queued' : 'none', key_strength: f.strength,
  });
  // No copy on this disk: the green-removal job reads the original from S3.
  if (f.greenScreen) media.enqueueKey(models.sequelize, { clipId: entry.clipId, episodeId: entry.episodeId, s3KeyRaw: entry.key, strength: f.strength, durationSeconds: row?.duration_seconds ?? info?.duration_seconds ?? f.seconds ?? null });
  // Voice from footage (V2): a new Lala clip's voice is queued for the footage-only worker (never fails the upload).
  await voiceFootage.onClipUploaded(models.sequelize, { ...row, id: entry.clipId, episode_id: entry.episodeId, performer: f.performer, s3_key_raw: entry.key }, { userId: entry.userId || null });
  let stored = [];
  let notStored = [];
  if (Object.keys(extras).length) {
    const kept = await clips.storeTakeExtras(models.sequelize, entry.episodeId, entry.clipId, extras);
    if (kept.row) row = { ...row, ...kept.row };
    ({ stored, notStored } = kept);
  }
  return { success: true, data: row, stored, not_stored: notStored };
}

/**
 * The upload's fields with the ones sent at complete (a take started while
 * recording: its markers, length and picture size only exist once it ends),
 * read by the same rules as at the start; a field not sent stays as it was.
 */
function endFields(fields, sent) {
  if (sent === undefined || sent === null) return fields;
  if (typeof sent !== 'object' || Array.isArray(sent)) throw new clips.RawClipError(400, 'fields must be an object');
  const next = { ...fields, ...clips.readFields(sent) };
  if (sent.seconds !== undefined) next.seconds = clips.readTakeSeconds(sent.seconds) ?? fields.seconds ?? null;
  if (sent.width !== undefined && sent.height !== undefined) {
    const width = clips.readVideoSize(sent.width);
    const height = clips.readVideoSize(sent.height);
    if (width && height) { next.width = width; next.height = height; }
  }
  if (next.end_beat_number != null && next.beat_number == null) throw new clips.RawClipError(400, 'Pick the beat the clip starts on before the beat it ends on');
  return next;
}

router.post('/:episodeId/uploads/:uploadId/complete', requireAuth, async (req, res) => {
  try {
    const entry = ownUpload(req);
    // Finished already (its answer was lost on the way): the same clip, not a second one.
    if (entry.result) return res.status(201).json(entry.result);
    const body = req.body || {};
    // Started while recording: the size comes now (a known one must match).
    parts.setSize(entry, body.size);
    if (!entry.completing) entry.fields = endFields(entry.fields, body.fields);
    const missing = parts.missingParts(entry);
    if (missing.length) {
      console.warn(`[RawClips] complete refused: ${missing.length} part(s) missing for ${entry.uploadId}`);
      return res.status(409).json({ success: false, error: 'Some of the take has not arrived yet. Tap Retry to send the rest.', missing: missing.slice(0, 100) });
    }
    if (!entry.completing) {
      entry.completing = completeUpload(entry, body.thumbnail)
        .then((out) => { entry.result = out; return out; })
        .finally(() => { entry.completing = null; });
    }
    const out = await entry.completing;
    return res.status(201).json(out);
  } catch (err) {
    return sendError(res, err, 'upload complete');
  }
});

router.delete('/:episodeId/uploads/:uploadId', requireAuth, async (req, res) => {
  try {
    const entry = ownUpload(req);
    if (entry.result) return res.json({ success: true, finished: true });
    await parts.abort(entry);
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'upload abort');
  }
});

router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    const rows = await clips.listClips(models.sequelize, req.params.episodeId, { activeIds: media.activeIds() });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return sendError(res, err, 'list');
  }
});

router.post('/:episodeId', requireAuth, async (req, res) => {
  // No room on the disk for this upload: a plain 507 before any of it is written.
  try {
    if (!(await roomForUpload(req))) {
      req.resume();
      return res.status(507).json({ success: false, error: NO_ROOM });
    }
  } catch (err) {
    console.error('[RawClips] disk room check failed; uploading anyway:', err.message);
  }
  return upload.single('video')(req, res, async (uploadErr) => {
    const file = req.file;
    let handedToJob = false;
    let thumbPath = null;
    try {
      if (uploadErr) throw uploadErr;
      if (!file) throw new clips.RawClipError(400, 'No video file was sent (field "video")');
      const fields = clips.readFields(req.body, { requirePerformer: true });
      const greenScreen = clips.truthy(req.body.green_screen);
      const strength = clips.readStrength(req.body.strength);
      const seconds = clips.readTakeSeconds(req.body.seconds);
      const width = clips.readVideoSize(req.body.width);
      const height = clips.readVideoSize(req.body.height);
      if (fields.end_beat_number != null && fields.beat_number == null) throw new clips.RawClipError(400, 'Pick the beat the clip starts on before the beat it ends on');
      const extras = {};
      if (fields.start_line !== undefined) extras.start_line = fields.start_line;
      if (fields.beat_marks !== undefined) extras.beat_marks = fields.beat_marks;
      if (fields.end_beat_number !== undefined) extras.end_beat_number = fields.end_beat_number;
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

      let row = await clips.createClip(models.sequelize, {
        id, episode_id: episode.id, show_id: episode.show_id,
        performer: fields.performer, guest_name: fields.guest_name, label: fields.label ?? clips.readFields({ label: file.originalname }).label,
        original_filename: file.originalname, content_type: file.mimetype, file_size_bytes: file.size,
        beat_number: fields.beat_number ?? null,
        duration_seconds: info.duration_seconds ?? seconds, width: info.width ?? width, height: info.height ?? height,
        s3_key_raw: s3KeyRaw, url_raw: urlRaw, thumbnail_key: thumbKey, thumbnail_url: thumbUrl,
        key_status: greenScreen ? 'queued' : 'none', key_strength: strength,
      });
      if (greenScreen) {
        handedToJob = media.enqueueKey(models.sequelize, { clipId: id, episodeId: episode.id, s3KeyRaw, strength, localPath: file.path, durationSeconds: info.duration_seconds ?? seconds });
      }
      // Voice from footage (V2): a new Lala clip's voice is queued for the footage-only worker (never fails the upload).
      await voiceFootage.onClipUploaded(models.sequelize, { ...row, id, episode_id: episode.id, performer: fields.performer, s3_key_raw: s3KeyRaw }, { userId: req.user?.id || null });
      let stored = [];
      let notStored = [];
      if (Object.keys(extras).length) {
        const kept = await clips.storeTakeExtras(models.sequelize, episode.id, id, extras);
        if (kept.row) row = { ...row, ...kept.row };
        ({ stored, notStored } = kept);
      }
      return res.status(201).json({ success: true, data: row, stored, not_stored: notStored });
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
    // Refused at once when the disk has no room (the job checks again when it starts).
    const hadCutout = Boolean(clip.url_cutout);
    if (typeof media.roomToKey === 'function') {
      const room = await media.roomToKey(clip.duration_seconds);
      if (!room.ok) throw new KeyNoRoomError(room.needs, room.free, hadCutout);
    }
    const row = await clips.setKeyState(models.sequelize, clip.id, 'queued', { strength });
    media.enqueueKey(models.sequelize, { clipId: clip.id, episodeId: clip.episode_id, s3KeyRaw: clip.s3_key_raw, strength, durationSeconds: clip.duration_seconds, hadCutout });
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
