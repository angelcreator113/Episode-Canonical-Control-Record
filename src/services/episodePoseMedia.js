'use strict';

/**
 * The image work for character poses (episode_character_poses;
 * episodePosesService). Each uploaded photo is processed in the background,
 * one at a time, in this process, so uploads return at once:
 *
 *   1. Colour and light: EXIF rotation, levels stretched (normalise), a
 *      touch more colour, light sharpening; at most 4000px on the long side.
 *      Here, with sharp: no outside service, no cost.
 *   2. Upscale: Real-ESRGAN on Replicate (wardrobeImageService.aiUpscaleImage,
 *      budget-gated and logged) only when the photo is under 1600px tall, x2
 *      or x4. Done before the background comes off, on the photo with its
 *      background, so the cut-out is made from the larger photo and no
 *      transparency has to survive the upscale. Missing token, a refusal or
 *      a failure skips it and says so in steps; the photo still goes on.
 *   3. Background removal: remove.bg (REMOVEBG_API_KEY, type person),
 *      budget-gated through imageCostService.runImageCall; RunwayMLService
 *      when remove.bg is not set up or fails (never after a budget refusal).
 *   4. Edges: the faint halo remove.bg leaves is cut, the edge softened by
 *      half a pixel, and the empty margin trimmed (8px kept). sharp again.
 *
 * Files, under episodes/{episodeId}/poses/{poseId}/: original.<ext> (never
 * changed), {run}-enhanced.jpg (steps 1-2, with its background) and
 * {run}-final.png (the cut-out). {run} is the run's time, so a reprocess
 * never serves an old cached file.
 */

const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { runImageCall, isBudgetError } = require('./imageCostService');
const poses = require('./episodePosesService');

const { ASSET_BUCKET: BUCKET, requireAssetBucket } = require('./assetBucket');
const REGION = process.env.AWS_REGION || 'us-east-1';
const MAX_SIDE = 4000;
const UPSCALE_BELOW = 1600;
const EDGE_CUT = 24; // alpha at or below this is halo, not her
const EDGE_PAD = 8;
const FORMAT_FILES = Object.freeze({
  jpeg: { ext: 'jpg', contentType: 'image/jpeg' },
  png: { ext: 'png', contentType: 'image/png' },
  webp: { ext: 'webp', contentType: 'image/webp' },
  heif: { ext: 'avif', contentType: 'image/avif' }, // sharp reads AVIF as heif; HEIC is not built in
});
const READ_FORMATS = Object.freeze(Object.keys(FORMAT_FILES));

let s3Client = null;
const getS3 = () => {
  if (!s3Client) {
    const config = { region: REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
    }
    s3Client = new S3Client(config);
  }
  return s3Client;
};

const publicUrl = (key) => `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
const posePrefix = (episodeId, poseId) => `episodes/${episodeId}/poses/${poseId}`;

async function putBuffer(key, body, contentType) {
  await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: body, ContentType: contentType }));
  return publicUrl(key);
}

async function getBuffer(key) {
  const res = await getS3().send(new GetObjectCommand({ Bucket: requireAssetBucket(), Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Reads an upload: { width, height, format }. A file sharp cannot read is a 400. */
async function readUpload(buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch (err) {
    console.error('[poses] upload is not a readable image:', err.message);
    throw new poses.PoseError(400, 'That file is not a photo we can read. Use JPG, PNG or WebP.');
  }
  if (!READ_FORMATS.includes(meta.format)) {
    throw new poses.PoseError(400, `That is a ${meta.format || 'unknown'} file. Use JPG, PNG or WebP.`);
  }
  // EXIF orientations 5-8 turn the photo on its side: its upright size swaps.
  const turned = (meta.orientation || 1) >= 5;
  return { width: turned ? meta.height : meta.width, height: turned ? meta.width : meta.height, format: meta.format };
}

/** The upscale for a photo this tall: 0 (none needed), 2 or 4. */
function upscaleFactor(height) {
  if (!height || height >= UPSCALE_BELOW) return 0;
  return height >= UPSCALE_BELOW / 2 ? 2 : 4;
}

/**
 * The box around what is left of her: the smallest rectangle holding every
 * pixel with alpha above `threshold`, grown by `pad` and kept inside the
 * image. alpha: one byte per pixel, rows top to bottom. null when empty.
 */
function alphaBounds(alpha, width, height, { threshold = 0, pad = EDGE_PAD } = {}) {
  let top = height; let bottom = -1; let left = width; let right = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alpha[row + x] > threshold) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  const l = Math.max(0, left - pad);
  const t = Math.max(0, top - pad);
  return { left: l, top: t, width: Math.min(width - 1, right + pad) - l + 1, height: Math.min(height - 1, bottom + pad) - t + 1 };
}

/** Maps an alpha value: the halo (at or below EDGE_CUT) goes, the rest stretches back to 0-255. */
const cutHalo = (a) => (a <= EDGE_CUT ? 0 : Math.min(255, Math.round(((a - EDGE_CUT) * 255) / (255 - EDGE_CUT))));

/** Step 1: colour and light. Returns { buffer (JPEG), width, height }. */
async function colorFix(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .normalise({ lower: 1, upper: 99 })
    .modulate({ saturation: 1.06 })
    .sharpen({ sigma: 0.6 })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/** Re-encodes an upscaled photo as JPEG, at most MAX_SIDE on the long side. */
async function capJpeg(buffer) {
  const { data, info } = await sharp(buffer)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/** Step 2: Real-ESRGAN on Replicate, from the photo's public URL. Returns the result as a Buffer. */
async function upscale(url, factor) {
  // Required here so a server without Replicate set up never loads it.
  const { aiUpscaleImage } = require('./wardrobeImageService');
  const out = await aiUpscaleImage(url, { scale: factor, faceEnhance: false });
  return out.buffer;
}

/** Step 3: the background off. Returns { buffer (PNG with alpha), provider }. */
async function removeBackground(buffer) {
  const removeBgKey = process.env.REMOVEBG_API_KEY || process.env.REMOVE_BG_API_KEY;
  const runway = require('./RunwayMLService');
  if (!removeBgKey && !runway.isConfigured()) {
    throw new Error('Background removal is not set up on the server (REMOVEBG_API_KEY).');
  }
  if (removeBgKey) {
    try {
      const form = new FormData();
      form.append('image_file', buffer, { filename: 'pose.jpg', contentType: 'image/jpeg' });
      form.append('size', 'auto');
      form.append('type', 'person');
      form.append('format', 'png');
      const res = await runImageCall({ model: 'remove.bg', provider: 'removebg' }, () => axios.post(
        'https://api.remove.bg/v1.0/removebg', form,
        { headers: { ...form.getHeaders(), 'X-Api-Key': removeBgKey }, responseType: 'arraybuffer', timeout: 90000 }));
      return { buffer: Buffer.from(res.data), provider: 'remove.bg' };
    } catch (err) {
      console.error('[poses] remove.bg failed:', err.message);
      // A budget refusal is not a provider failure: no paid fallback.
      if (isBudgetError(err) || !runway.isConfigured()) throw err;
    }
  }
  return { buffer: await runway.removeBackground(buffer), provider: 'runway' };
}

/**
 * Step 4: the edges. Cuts the halo, softens the edge by half a pixel, cuts
 * what the softening spread into the empty area, and trims the margin.
 * Returns { buffer (PNG), width, height }.
 */
async function cleanEdges(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = cutHalo(data[i * channels + channels - 1]);
  // extractChannel: sharp hands back three channels from a one-channel blur.
  const soft = await sharp(alpha, { raw: { width, height, channels: 1 } }).blur(0.5).extractChannel(0).raw().toBuffer();
  if (soft.length !== alpha.length) throw new Error(`Edge step read ${soft.length} bytes for ${alpha.length} pixels`);
  for (let i = 0; i < soft.length; i += 1) {
    data[i * channels + channels - 1] = alpha[i] === 0 && soft[i] <= EDGE_CUT ? 0 : soft[i];
  }
  const box = alphaBounds(soft, width, height, { threshold: EDGE_CUT });
  if (!box) throw new Error('Nobody was left in the photo after the background came off. Try a photo where she stands out from the background.');
  const out = await sharp(data, { raw: { width, height, channels } })
    .extract(box)
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

const skipReason = (err) => (isBudgetError(err) ? "skipped: today's image budget is used up" : 'skipped: the upscale failed');

/**
 * Processes one pose, start to finish. job.steps is filled as it goes, so a
 * failure records what was done.
 */
async function processPose(job) {
  const { sequelize, poseId, episodeId, originalKey, steps } = job;
  const prefix = posePrefix(episodeId, poseId);
  const run = Date.now();
  await poses.setState(sequelize, poseId, 'processing', { steps });

  const original = job.buffer || await getBuffer(originalKey);
  job.buffer = null;
  let enhanced = await colorFix(original);
  steps.color = true;
  let enhancedKey = `${prefix}/${run}-enhanced.jpg`;
  let enhancedUrl = await putBuffer(enhancedKey, enhanced.buffer, 'image/jpeg');

  const factor = upscaleFactor(enhanced.height);
  if (!factor) steps.upscale = 'not needed';
  else if (!process.env.REPLICATE_API_TOKEN) steps.upscale = 'skipped: upscaling is not set up on the server';
  else {
    try {
      enhanced = await capJpeg(await upscale(enhancedUrl, factor));
      enhancedKey = `${prefix}/${run}-enhanced-x${factor}.jpg`;
      enhancedUrl = await putBuffer(enhancedKey, enhanced.buffer, 'image/jpeg');
      steps.upscale = `x${factor}`;
    } catch (err) {
      console.error(`[poses] upscale failed for ${poseId}; going on without it:`, err.message);
      steps.upscale = skipReason(err);
    }
  }
  await poses.setState(sequelize, poseId, 'processing', { steps, enhancedKey, enhancedUrl });

  const cut = await removeBackground(enhanced.buffer);
  steps.background = cut.provider;
  const final = await cleanEdges(cut.buffer);
  steps.edges = true;
  const finalKey = `${prefix}/${run}-final.png`;
  const finalUrl = await putBuffer(finalKey, final.buffer, 'image/png');
  await poses.setState(sequelize, poseId, 'ready', {
    steps, finalKey, finalUrl, finalWidth: final.width, finalHeight: final.height,
  });
}

// ── The processing queue: one photo at a time, in this process ──────────────

const queue = [];
const active = new Set();
let running = false;

/** Pose ids queued or running here (listPoses leaves these alone). */
const activeIds = () => [...active];

/**
 * Queues a pose. buffer: the original, when the upload still has it;
 * otherwise the job downloads originalKey. False when it is already queued.
 */
function enqueue(sequelize, { poseId, episodeId, originalKey, buffer = null }) {
  if (active.has(poseId)) return false;
  active.add(poseId);
  queue.push({ sequelize, poseId, episodeId, originalKey, buffer, steps: {} });
  setImmediate(drain);
  return true;
}

function plainError(err) {
  if (isBudgetError(err)) return "Today's image budget is used up. Try again tomorrow.";
  if (err?.response?.status === 402) return 'The background-removal account is out of credits.';
  return err?.message || 'Processing failed';
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        await processPose(job);
      } catch (err) {
        console.error(`[poses] processing failed for ${job.poseId}:`, err.message);
        try {
          await poses.setState(job.sequelize, job.poseId, 'failed', { error: plainError(err), steps: job.steps });
        } catch (dbErr) {
          console.error('[poses] could not record the failure:', dbErr.message);
        }
      } finally {
        job.buffer = null;
        active.delete(job.poseId);
      }
    }
  } finally {
    running = false;
  }
}

module.exports = {
  BUCKET, MAX_SIDE, UPSCALE_BELOW, EDGE_CUT, FORMAT_FILES, publicUrl, posePrefix, putBuffer, getBuffer,
  readUpload, upscaleFactor, alphaBounds, cutHalo, colorFix, capJpeg, removeBackground, cleanEdges,
  processPose, enqueue, activeIds, plainError,
};
