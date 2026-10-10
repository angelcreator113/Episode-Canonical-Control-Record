'use strict';

/**
 * The public landing page's media slots (Task #2821; data shape and
 * endpoint contract in docs/reads/2026-10-10-website-content-read.md §3–§4).
 *
 * Files go only to the public site location Evoni sets up
 * (SITE_PUBLIC_BUCKET, optional SITE_PUBLIC_PREFIX and SITE_PUBLIC_CDN).
 * Until SITE_PUBLIC_BUCKET is set, every upload is refused with 503
 * SITE_STORAGE_NOT_CONFIGURED: there is no data-URL fallback and nothing
 * is written to the studio's buckets. A YouTube video needs no storage.
 *
 * Only published rows ever reach the public, through publicContent(), which
 * builds each slot field by field: no ids, no keys, no drafts.
 */

const crypto = require('crypto');

const SLOT_KEYS = Object.freeze([
  'hero', 'flagship_lala', 'pillar_fashion', 'pillar_characters', 'pillar_places', 'featured_video',
  'brand_world', 'brand_books', 'brand_studio', 'brand_fashion', 'logo',
]);
// What each slot may hold; every other slot is an image.
const SLOT_MEDIA = Object.freeze({
  featured_video: ['youtube', 'video_clip'],
  brand_studio: ['image', 'video_clip'],
});
const mediaFor = (slotKey) => SLOT_MEDIA[slotKey] || ['image'];

const IMAGE_TYPES = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });
const CLIP_TYPES = Object.freeze({ 'video/mp4': 'mp4' });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CLIP_BYTES = 25 * 1024 * 1024;
const MAX_CAPTIONS_BYTES = 200 * 1024;
const MAX_CLIP_SECONDS = 30;
const MAX_ALT = 300;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

class WebsiteSlotError extends Error {
  constructor(message, status = 400, code = 'INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── Storage: the public site location only ──

function storageConfig() {
  const bucket = (process.env.SITE_PUBLIC_BUCKET || '').trim();
  if (!bucket) return null;
  const prefix = (process.env.SITE_PUBLIC_PREFIX || 'site-public').trim().replace(/^\/+|\/+$/g, '') || 'site-public';
  return { bucket, prefix, cdn: (process.env.SITE_PUBLIC_CDN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || null, region: process.env.AWS_REGION || 'us-east-1' };
}

function requireStorage() {
  const cfg = storageConfig();
  if (!cfg) {
    throw new WebsiteSlotError(
      'Website uploads are off until the public site storage is set up (SITE_PUBLIC_BUCKET). A YouTube link still works.',
      503, 'SITE_STORAGE_NOT_CONFIGURED');
  }
  return cfg;
}

async function putObject(cfg, key, buffer, contentType) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: cfg.region });
  // Keys are never reused (a new upload gets a new key), so the object is immutable.
  await s3.send(new PutObjectCommand({
    Bucket: cfg.bucket, Key: key, Body: buffer, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable',
  }));
}

/** The public URL of a stored key: the CDN when set, else the S3 object URL. */
function publicUrl(key) {
  if (!key) return null;
  const cfg = storageConfig();
  if (!cfg) return null;
  return cfg.cdn ? `https://${cfg.cdn}/${key}` : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

// ── Measuring a clip (ffprobe); unmeasurable clips are refused ──

async function clipSeconds(buffer) {
  const fs = require('fs/promises');
  const os = require('os');
  const path = require('path');
  const { execFile } = require('child_process');
  const tmp = path.join(os.tmpdir(), `site-clip-${crypto.randomUUID()}.mp4`);
  await fs.writeFile(tmp, buffer);
  try {
    const out = await new Promise((resolve, reject) => {
      execFile(process.env.FFPROBE_BIN || 'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', tmp],
        { timeout: 15000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
    });
    const seconds = parseFloat(String(out).trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch (err) {
    console.error('[WebsiteSlots] ffprobe could not read the clip:', err.message);
    return null;
  } finally {
    await fs.unlink(tmp).catch((err) => console.error('[WebsiteSlots] temp clip cleanup failed:', err.message));
  }
}

// ── YouTube: youtube.com or youtu.be only, stored as the id ──

function youtubeIdFrom(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch (err) {
    throw new WebsiteSlotError('Paste a YouTube link (youtube.com or youtu.be).', 400, 'INVALID_YOUTUBE_URL');
  }
  const host = url.hostname.toLowerCase();
  let id = null;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') id = null;
  else if (host === 'youtu.be') id = url.pathname.split('/')[1] || null;
  else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      id = m ? m[1] : null;
    }
  }
  if (!id || !YOUTUBE_ID.test(id)) {
    throw new WebsiteSlotError('That is not a YouTube video link (youtube.com or youtu.be).', 400, 'INVALID_YOUTUBE_URL');
  }
  return id;
}

// ── Rows ──

function assertSlotKey(slotKey) {
  if (!SLOT_KEYS.includes(slotKey)) throw new WebsiteSlotError(`Unknown slot "${slotKey}".`, 404, 'SLOT_NOT_FOUND');
}

async function findSlot(models, slotKey) {
  return models.WebsiteSlot.findOne({ where: { slot_key: slotKey } });
}

async function ensureSlot(models, slotKey) {
  const found = await findSlot(models, slotKey);
  if (found) return found;
  try {
    return await models.WebsiteSlot.create({ slot_key: slotKey });
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    console.error('[WebsiteSlots] concurrent create, reading the existing row:', err.message);
    return findSlot(models, slotKey);
  }
}

// Every change goes through here: a where on the row's id and slot key, and
// any change to the media sends a published slot back to draft, so nothing
// unchecked goes live.
async function updateSlot(models, row, changes, { backToDraft = false } = {}) {
  const next = { ...changes };
  if (backToDraft) { next.status = 'draft'; next.published_at = null; }
  await models.WebsiteSlot.update(next, { where: { id: row.id, slot_key: row.slot_key } });
  return findSlot(models, row.slot_key);
}

/** The admin's view of a slot (drafts included; URLs resolved). */
function adminView(slotKey, row) {
  return {
    slot_key: slotKey,
    allowed_media: mediaFor(slotKey),
    media_type: row?.media_type || null,
    url: row?.file_key ? publicUrl(row.file_key) : null,
    youtube_id: row?.youtube_id || null,
    poster_url: publicUrl(row?.poster_key),
    captions_url: publicUrl(row?.captions_key),
    alt_text: row?.alt_text || null,
    has_speech: Boolean(row?.has_speech),
    duration_seconds: row?.duration_seconds != null ? Number(row.duration_seconds) : null,
    file_size_bytes: row?.file_size_bytes ?? null,
    status: row?.status || 'draft',
    published_at: row?.published_at || null,
    updated_at: row?.updated_at || null,
  };
}

async function listSlots(models) {
  const rows = await models.WebsiteSlot.findAll();
  const byKey = new Map(rows.map((r) => [r.slot_key, r]));
  return {
    storage_ready: Boolean(storageConfig()),
    slots: SLOT_KEYS.map((k) => adminView(k, byKey.get(k))),
  };
}

// ── Writes ──

function checkFile(file, types, maxBytes, label) {
  if (!file || !file.buffer || !file.buffer.length) throw new WebsiteSlotError(`Choose a ${label} to upload.`, 400, 'NO_FILE');
  if (!types[file.mimetype]) throw new WebsiteSlotError(`The ${label} must be ${Object.values(types).join(', ').toUpperCase()}.`, 400, 'INVALID_TYPE');
  if (file.buffer.length > maxBytes) throw new WebsiteSlotError(`The ${label} is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`, 400, 'TOO_LARGE');
}

/** Upload or replace a slot's image or clip. */
async function uploadMedia(models, slotKey, file) {
  assertSlotKey(slotKey);
  const cfg = requireStorage();
  const isClip = Boolean(file && CLIP_TYPES[file.mimetype]);
  const mediaType = isClip ? 'video_clip' : 'image';
  if (!mediaFor(slotKey).includes(mediaType)) {
    throw new WebsiteSlotError(`The ${slotKey} slot takes ${mediaFor(slotKey).join(' or ')}.`, 400, 'MEDIA_NOT_ALLOWED');
  }
  if (isClip) checkFile(file, CLIP_TYPES, MAX_CLIP_BYTES, 'clip');
  else checkFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES, 'image');

  let duration = null;
  if (isClip) {
    // Through the exports, so a test can stand in for ffprobe.
    duration = await module.exports.clipSeconds(file.buffer);
    if (duration == null) throw new WebsiteSlotError('The clip could not be measured; upload an MP4.', 400, 'CLIP_UNREADABLE');
    if (duration > MAX_CLIP_SECONDS) throw new WebsiteSlotError(`Clips are ${MAX_CLIP_SECONDS} seconds at most; this one is ${duration.toFixed(1)} seconds.`, 400, 'CLIP_TOO_LONG');
  }

  const ext = isClip ? CLIP_TYPES[file.mimetype] : IMAGE_TYPES[file.mimetype];
  const key = `${cfg.prefix}/${slotKey}/${crypto.randomUUID()}.${ext}`;
  await putObject(cfg, key, file.buffer, file.mimetype);
  const row = await ensureSlot(models, slotKey);
  const changes = {
    media_type: mediaType, file_key: key, youtube_id: null,
    duration_seconds: duration, file_size_bytes: file.buffer.length, content_type: file.mimetype,
  };
  // A slot that turns into an image keeps no poster or captions.
  if (mediaType === 'image') Object.assign(changes, { poster_key: null, captions_key: null, has_speech: false });
  return adminView(slotKey, await updateSlot(models, row, changes, { backToDraft: true }));
}

/**
 * The site's logo from a show's logo (Show Settings): its PNG is copied into
 * the public site location as the logo slot's image, as a draft. It is a
 * copy, not a link: a later change in Show Settings does not reach the site
 * until this is done again, and publishing stays a separate step.
 */
async function useShowLogo(models, showId) {
  requireStorage();
  if (!showId) throw new WebsiteSlotError('Choose a show.', 400, 'NO_SHOW');
  const { readLogo, logoBytes } = require('./showLogoService');
  const show = await models.Show.findByPk(showId);
  if (!show) throw new WebsiteSlotError('Show not found.', 404, 'SHOW_NOT_FOUND');
  const logo = readLogo(show.metadata);
  if (!logo) throw new WebsiteSlotError('That show has no logo yet. Add one in Show Settings.', 400, 'NO_SHOW_LOGO');
  let buffer;
  try {
    buffer = await logoBytes(logo);
  } catch (err) {
    console.error('[WebsiteSlots] the show logo could not be read:', err.message);
    throw new WebsiteSlotError(err.status ? err.message : "The show's logo could not be read. Try again.", 400, 'LOGO_UNREADABLE');
  }
  return uploadMedia(models, 'logo', { buffer, mimetype: 'image/png', originalname: 'show-logo.png', size: buffer.length });
}

/** Point a video slot at a YouTube video (stored as its id). */
async function setYoutube(models, slotKey, youtubeUrl) {
  assertSlotKey(slotKey);
  if (!mediaFor(slotKey).includes('youtube')) throw new WebsiteSlotError(`The ${slotKey} slot does not take a YouTube video.`, 400, 'MEDIA_NOT_ALLOWED');
  const id = youtubeIdFrom(youtubeUrl);
  const row = await ensureSlot(models, slotKey);
  return adminView(slotKey, await updateSlot(models, row, {
    media_type: 'youtube', youtube_id: id, file_key: null, duration_seconds: null, file_size_bytes: null, content_type: null, captions_key: null, has_speech: false,
  }, { backToDraft: true }));
}

/** Alt text and "has speech" (which makes captions required). */
async function updateDetails(models, slotKey, body = {}) {
  assertSlotKey(slotKey);
  const changes = {};
  if ('alt_text' in body) {
    if (body.alt_text !== null && typeof body.alt_text !== 'string') throw new WebsiteSlotError('Alt text must be text.');
    const alt = (body.alt_text || '').trim();
    if (alt.length > MAX_ALT) throw new WebsiteSlotError(`Alt text is ${MAX_ALT} characters at most.`);
    changes.alt_text = alt || null;
  }
  if ('has_speech' in body) {
    if (typeof body.has_speech !== 'boolean') throw new WebsiteSlotError('has_speech is true or false.');
    changes.has_speech = body.has_speech;
  }
  const row = await ensureSlot(models, slotKey);
  if (!Object.keys(changes).length) return adminView(slotKey, row);
  // Removing alt text or adding speech can make a live slot invalid: back to draft.
  const backToDraft = row.status === 'published' && ((('alt_text' in changes) && !changes.alt_text) || (changes.has_speech && !row.captions_key));
  return adminView(slotKey, await updateSlot(models, row, changes, { backToDraft }));
}

async function uploadPoster(models, slotKey, file) {
  assertSlotKey(slotKey);
  const cfg = requireStorage();
  const row = await ensureSlot(models, slotKey);
  if (!['video_clip', 'youtube'].includes(row.media_type)) throw new WebsiteSlotError('Only a video slot has a poster.', 400, 'MEDIA_NOT_ALLOWED');
  checkFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES, 'poster');
  const key = `${cfg.prefix}/${slotKey}/poster-${crypto.randomUUID()}.${IMAGE_TYPES[file.mimetype]}`;
  await putObject(cfg, key, file.buffer, file.mimetype);
  return adminView(slotKey, await updateSlot(models, row, { poster_key: key }, { backToDraft: true }));
}

async function uploadCaptions(models, slotKey, file) {
  assertSlotKey(slotKey);
  const cfg = requireStorage();
  const row = await ensureSlot(models, slotKey);
  if (row.media_type !== 'video_clip') throw new WebsiteSlotError('Captions belong to an uploaded clip (YouTube keeps its own).', 400, 'MEDIA_NOT_ALLOWED');
  if (!file || !file.buffer || !file.buffer.length) throw new WebsiteSlotError('Choose a WebVTT (.vtt) captions file.', 400, 'NO_FILE');
  if (file.buffer.length > MAX_CAPTIONS_BYTES) throw new WebsiteSlotError('The captions file is too large.', 400, 'TOO_LARGE');
  if (!file.buffer.toString('utf8', 0, 16).replace(/^\uFEFF/, '').startsWith('WEBVTT')) {
    throw new WebsiteSlotError('Captions must be a WebVTT file (it starts with "WEBVTT").', 400, 'INVALID_TYPE');
  }
  const key = `${cfg.prefix}/${slotKey}/captions-${crypto.randomUUID()}.vtt`;
  await putObject(cfg, key, file.buffer, 'text/vtt');
  return adminView(slotKey, await updateSlot(models, row, { captions_key: key }, { backToDraft: true }));
}

/** Publish: media present, alt text, a poster for a clip, captions for a clip with speech. */
async function publishSlot(models, slotKey) {
  assertSlotKey(slotKey);
  const row = await findSlot(models, slotKey);
  if (!row || !(row.file_key || row.youtube_id)) throw new WebsiteSlotError('Add the image or video before publishing.', 409, 'NO_MEDIA');
  if (!row.alt_text) throw new WebsiteSlotError('Add alt text before publishing.', 409, 'ALT_TEXT_REQUIRED');
  if (row.media_type === 'video_clip' && !row.poster_key) throw new WebsiteSlotError('A clip needs a poster image before publishing.', 409, 'POSTER_REQUIRED');
  if (row.media_type === 'video_clip' && row.has_speech && !row.captions_key) {
    throw new WebsiteSlotError('This clip has speech: add captions before publishing.', 409, 'CAPTIONS_REQUIRED');
  }
  if (row.file_key && !storageConfig()) throw new WebsiteSlotError('The public site storage is not set up.', 503, 'SITE_STORAGE_NOT_CONFIGURED');
  return adminView(slotKey, await updateSlot(models, row, { status: 'published', published_at: new Date() }));
}

async function unpublishSlot(models, slotKey) {
  assertSlotKey(slotKey);
  const row = await findSlot(models, slotKey);
  if (!row) return adminView(slotKey, null);
  return adminView(slotKey, await updateSlot(models, row, {}, { backToDraft: true }));
}

// ── The public read ──

/**
 * Published slots only, each built from a fixed list of fields. A slot whose
 * file cannot be given a public URL (storage not configured) is left out,
 * so the site keeps its bundled default for it.
 */
async function publicContent(models) {
  const rows = await models.WebsiteSlot.findAll({ where: { status: 'published' } });
  const slots = {};
  let updatedAt = null;
  for (const r of rows) {
    if (!SLOT_KEYS.includes(r.slot_key)) continue;
    const entry = { media_type: r.media_type, alt_text: r.alt_text || null };
    if (r.media_type === 'youtube') {
      if (!r.youtube_id) continue;
      entry.youtube_id = r.youtube_id;
    } else {
      const url = publicUrl(r.file_key);
      if (!url) continue;
      entry.url = url;
    }
    if (r.media_type !== 'image') {
      entry.poster_url = publicUrl(r.poster_key);
      entry.captions_url = publicUrl(r.captions_key);
      entry.duration_seconds = r.duration_seconds != null ? Number(r.duration_seconds) : null;
    }
    slots[r.slot_key] = entry;
    const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    if (!updatedAt || t > updatedAt) updatedAt = t;
  }
  return { slots, updated_at: updatedAt ? new Date(updatedAt).toISOString() : null };
}

module.exports = {
  useShowLogo,
  SLOT_KEYS,
  SLOT_MEDIA,
  MAX_CLIP_SECONDS,
  MAX_IMAGE_BYTES,
  MAX_CLIP_BYTES,
  WebsiteSlotError,
  storageConfig,
  publicUrl,
  youtubeIdFrom,
  clipSeconds,
  listSlots,
  uploadMedia,
  setYoutube,
  updateDetails,
  uploadPoster,
  uploadCaptions,
  publishSlot,
  unpublishSlot,
  publicContent,
};
