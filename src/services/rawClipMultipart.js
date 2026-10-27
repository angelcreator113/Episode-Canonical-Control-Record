'use strict';

/**
 * A raw clip sent in parts, straight to S3 (Evoni, 2026-10-27: a 22-minute
 * take, about 430 MB, filled the server's disk and failed to save). The
 * browser sends the file in 8 MB parts; each part goes on to S3 as one part
 * of an S3 multipart upload and is never written to this server's disk.
 *
 * The uploads in progress are kept in this process's memory, keyed by the
 * S3 upload id: { uploadId, clipId, key, episodeId, showId, userId, fields,
 * size, partSize, parts: Map<partNumber, { etag, size }>, createdAt }. One
 * not finished in six hours is aborted in S3 and forgotten (sweepExpired,
 * hourly). A finished one keeps its answer for the same time, so a repeated
 * "complete" (its answer lost on a bad connection) gets the same clip back
 * instead of a second one. A server restart forgets them all: the browser
 * then starts the take's upload again from the start.
 *
 * Duration and size: ffprobe reads the file through a short-lived signed
 * link (only the bytes it needs; never a whole download), with a timeout;
 * when that does not work the browser's own measure of the take is used.
 */

const {
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand, PutObjectCommand, GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { requireAssetBucket } = require('./assetBucket');
const clips = require('./rawClipsService');
const media = require('./rawClipMedia');

const MB = 1024 * 1024;
const PART_SIZE = 8 * MB; // S3's smallest part is 5 MB (all but the last)
const MAX_PARTS = 10000; // S3's limit
const MAX_BYTES = 5 * 1024 * MB; // 5 GB: a sane top for one clip
const MAX_THUMB_BYTES = 500 * 1024;
const EXPIRE_MS = 6 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 20 * 1000;
const THUMB_TIMEOUT_MS = 30 * 1000;
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const pending = new Map();

/** How many parts a file of `size` bytes is in. */
const partCount = (size, partSize = PART_SIZE) => Math.max(1, Math.ceil(size / partSize));

/** The byte length part `n` must have (every part is partSize but the last). */
const expectedPartSize = (entry, n) => Math.min(entry.partSize, entry.size - (n - 1) * entry.partSize);

/** Starts the S3 upload and remembers it. Resolves the entry. */
async function begin({ episode, clipId, key, contentType, fields, size, filename, userId = null, partSize = PART_SIZE, now = Date.now() }) {
  const out = await media.getS3().send(new CreateMultipartUploadCommand({
    Bucket: requireAssetBucket(), Key: key, ContentType: contentType,
  }));
  if (!out?.UploadId) throw new Error('S3 did not start the upload (no UploadId)');
  const entry = {
    uploadId: out.UploadId, clipId, key, episodeId: String(episode.id), showId: episode.show_id ?? null, userId,
    contentType, filename, fields, size, partSize, parts: new Map(), createdAt: now, result: null, completing: null,
  };
  pending.set(entry.uploadId, entry);
  return entry;
}

/** The upload, or null when this server does not know it (expired, finished long ago, a restart). */
const get = (uploadId) => pending.get(String(uploadId)) || null;

/** Sends one part on to S3 and records its ETag; sending a part again replaces it. */
async function putPart(entry, partNumber, body) {
  const out = await media.getS3().send(new UploadPartCommand({
    Bucket: requireAssetBucket(), Key: entry.key, UploadId: entry.uploadId,
    PartNumber: partNumber, Body: body, ContentLength: body.length,
  }));
  if (!out?.ETag) throw new Error(`S3 did not confirm part ${partNumber} (no ETag)`);
  entry.parts.set(partNumber, { etag: out.ETag, size: body.length });
  return out.ETag;
}

/** Part numbers still missing before the upload can be finished. */
function missingParts(entry) {
  const missing = [];
  for (let n = 1; n <= partCount(entry.size, entry.partSize); n += 1) if (!entry.parts.has(n)) missing.push(n);
  return missing;
}

/** Joins the parts into the one file in S3. */
async function finish(entry) {
  const Parts = [...entry.parts.entries()].sort((a, b) => a[0] - b[0]).map(([PartNumber, p]) => ({ PartNumber, ETag: p.etag }));
  await media.getS3().send(new CompleteMultipartUploadCommand({
    Bucket: requireAssetBucket(), Key: entry.key, UploadId: entry.uploadId, MultipartUpload: { Parts },
  }));
  return media.publicUrl(entry.key);
}

/** Throws the upload away in S3 and forgets it. */
async function abort(entry) {
  pending.delete(entry.uploadId);
  await media.getS3().send(new AbortMultipartUploadCommand({
    Bucket: requireAssetBucket(), Key: entry.key, UploadId: entry.uploadId,
  }));
}

/** Aborts and forgets uploads older than EXPIRE_MS; forgets finished ones as old. Resolves the ids. */
async function sweepExpired(now = Date.now()) {
  const gone = [];
  for (const entry of [...pending.values()]) {
    if (now - entry.createdAt < EXPIRE_MS) continue;
    gone.push(entry.uploadId);
    if (entry.result) { pending.delete(entry.uploadId); continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      await abort(entry);
    } catch (err) {
      console.error(`[rawClips] expired upload ${entry.uploadId} not aborted in S3:`, err.message);
    }
  }
  if (gone.length) console.log(`[rawClips] forgot ${gone.length} upload(s) older than 6 hours:`, gone.join(', '));
  return gone;
}

let sweeper = null;
/** Sweeps hourly (once per process); the timer never keeps the process up. */
function startExpirySweeper() {
  if (sweeper) return sweeper;
  sweeper = setInterval(() => {
    sweepExpired().catch((err) => console.error('[rawClips] upload expiry sweep failed:', err.message));
  }, 60 * 60 * 1000);
  if (typeof sweeper.unref === 'function') sweeper.unref();
  return sweeper;
}

/** A short-lived signed link to read the file (ffprobe and ffmpeg read only what they need). */
const readLink = (key) => getSignedUrl(media.getS3(), new GetObjectCommand({ Bucket: requireAssetBucket(), Key: key }), { expiresIn: 10 * 60 });

/**
 * { duration_seconds, width, height, hasVideo } read through the signed
 * link, or null when ffprobe is missing, too slow, or can't read it (logged).
 */
async function probe(link) {
  try {
    const { stdout } = await media.run(FFPROBE, clips.probeArgs(link), { timeoutMs: PROBE_TIMEOUT_MS });
    return clips.readProbe(stdout.toString());
  } catch (err) {
    console.error('[rawClips] the uploaded take was not measured (the browser\'s length is used):', err.message);
    return null;
  }
}

/** A thumbnail made from the file through the signed link: a temp JPEG's path, or null (logged). */
async function thumbnailFromLink(link, durationSeconds) {
  const at = durationSeconds ? Math.min(1, durationSeconds / 3) : 0;
  let out = null;
  try {
    out = await media.tmpPath('thumb.jpg');
    await media.run(FFMPEG, clips.thumbnailArgs(link, out, at), { timeoutMs: THUMB_TIMEOUT_MS });
    return out;
  } catch (err) {
    console.error('[rawClips] thumbnail not made from the uploaded take:', err.message);
    await media.removeFile(out);
    return null;
  }
}

/**
 * The browser's thumbnail (a base64 JPEG, a data: URL or bare) as a Buffer,
 * or null when it is missing, too big or not a JPEG (logged, never fatal).
 */
function readThumbnail(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') { console.warn('[rawClips] thumbnail left out: not a string'); return null; }
  const b64 = value.replace(/^data:image\/jpe?g;base64,/i, '');
  if (b64.length > Math.ceil((MAX_THUMB_BYTES * 4) / 3) + 4) { console.warn('[rawClips] thumbnail left out: over 500 KB'); return null; }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) { console.warn('[rawClips] thumbnail left out: not a JPEG'); return null; }
  if (buf.length > MAX_THUMB_BYTES) { console.warn('[rawClips] thumbnail left out: over 500 KB'); return null; }
  return buf;
}

/** Puts a small file (the thumbnail) in S3 from memory. Resolves its URL. */
async function putSmall(key, body, contentType) {
  await media.getS3().send(new PutObjectCommand({
    Bucket: requireAssetBucket(), Key: key, Body: body, ContentLength: body.length, ContentType: contentType,
  }));
  return media.publicUrl(key);
}

/** Tests: forget every upload. */
const reset = () => pending.clear();

module.exports = {
  PART_SIZE, MAX_PARTS, MAX_BYTES, MAX_THUMB_BYTES, EXPIRE_MS,
  partCount, expectedPartSize, begin, get, putPart, missingParts, finish, abort,
  sweepExpired, startExpirySweeper, readLink, probe, thumbnailFromLink, readThumbnail, putSmall, reset,
};
