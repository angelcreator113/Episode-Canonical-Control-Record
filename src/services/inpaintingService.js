'use strict';

/**
 * Inpainting Service — Replicate API (SDXL Inpainting)
 *
 * Removes unwanted objects from images by painting over them with a mask,
 * then using AI to fill the masked area with contextually appropriate content.
 *
 * Uses lucataco/sdxl-inpainting model via Replicate.
 */

const axios = require('axios');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_INPAINT_MODEL = process.env.REPLICATE_INPAINT_MODEL || 'lucataco/sdxl-inpainting';
const REPLICATE_INPAINT_VERSION = process.env.REPLICATE_INPAINT_VERSION || 'a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7';
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;

// ─── RATE LIMITING ──────────────────────────────────────────────────────────

const inFlight = new Map();
const hourlyUsage = new Map();
const MAX_PER_HOUR = 15;

function checkRateLimit(userId, entityId) {
  if (inFlight.get(entityId)) {
    return { allowed: false, reason: 'An inpainting operation is already in progress. Please wait.' };
  }
  const now = Date.now();
  const userKey = userId || 'anonymous';
  let usage = hourlyUsage.get(userKey);
  if (!usage || now > usage.resetAt) {
    usage = { count: 0, resetAt: now + 3600000 };
    hourlyUsage.set(userKey, usage);
  }
  if (usage.count >= MAX_PER_HOUR) {
    const minutesLeft = Math.ceil((usage.resetAt - now) / 60000);
    return { allowed: false, reason: `Inpainting limit reached (${MAX_PER_HOUR}/hour). Resets in ${minutesLeft} minutes.` };
  }
  return { allowed: true };
}

function markInFlight(entityId) { inFlight.set(entityId, true); }
function clearInFlight(entityId) { inFlight.delete(entityId); }
function incrementUsage(userId) {
  const userKey = userId || 'anonymous';
  const usage = hourlyUsage.get(userKey);
  if (usage) usage.count++;
}

// ─── REPLICATE API ──────────────────────────────────────────────────────────

/**
 * Run SDXL inpainting on Replicate.
 *
 * @param {string} imageUrl - Source image URL
 * @param {string} maskUrl - Mask image URL (white = area to fill, black = keep)
 * @param {string} prompt - What to fill the area with
 * @param {object} options
 * @returns {Promise<string>} Output image URL from Replicate
 */
async function runInpainting(imageUrl, maskUrl, prompt, options = {}) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const { strength = 0.85, guidanceScale = 7.5, width = 1920, height = 1080 } = options;
  const qualityPrompt = [
    prompt,
    'Photographic quality.',
    'Make the filled region look like an untouched original image.',
    'Preserve scene geometry, perspective, lighting direction, shadows, texture continuity, and color balance.',
    'Blend seamlessly with the surrounding environment and continue nearby structures naturally.',
  ].join(' ');
  const negativePrompt = [
    'text',
    'watermark',
    'logo',
    'blurry',
    'low quality',
    'artifacts',
    'seams',
    'distorted',
    'ghosting',
    'smudges',
    'duplicated textures',
    'patches',
    'painted look',
    'new objects',
  ].join(', ');

  console.log(`[Inpainting] Starting inpaint: prompt="${prompt.slice(0, 80)}...", strength=${strength}`);

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      // Use explicit model version for compatibility with Replicate predictions API.
      version: REPLICATE_INPAINT_VERSION,
      input: {
        image: imageUrl,
        mask: maskUrl,
        prompt: qualityPrompt,
        negative_prompt: negativePrompt,
        strength: strength,
        num_outputs: 1,
        num_inference_steps: 36,
        guidance_scale: guidanceScale,
        scheduler: 'K_EULER',
        width: width,
        height: height,
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[Inpainting] Replicate API error (${status}) [${REPLICATE_INPAINT_MODEL}@${REPLICATE_INPAINT_VERSION}]:`, detail);
    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[Inpainting] Prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      console.log('[Inpainting] Prediction completed');
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      if (!outputUrl) throw new Error('Inpainting model returned no output URL');
      return outputUrl;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Inpainting ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }
  }

  throw new Error('Inpainting timed out');
}

// ─── S3 STORAGE ─────────────────────────────────────────────────────────────

async function storeInpaintedImage(imageUrl, entityId) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/inpainted/${ts}-${uid}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));

  const resultUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`[Inpainting] Result stored: ${s3Key}`);
  return resultUrl;
}

/**
 * Store a mask image (base64 data URL) to S3 for Replicate to access.
 */
async function storeMask(maskDataUrl, entityId) {
  // Convert data:image/png;base64,... to buffer
  const base64Data = maskDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/masks/${ts}-${uid}-mask.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'max-age=86400',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Inpaint (remove/fill) an area of a scene background.
 *
 * @param {string} imageUrl - Source background image URL
 * @param {string} maskDataUrl - Base64 data URL of the mask (white = fill area)
 * @param {string} prompt - What to fill with (default: "clean seamless background")
 * @param {string} entityId - Scene ID for S3 path + rate limiting
 * @param {object} options - { userId, strength }
 * @returns {Promise<{inpainted_url: string}>}
 */
async function inpaintImage(imageUrl, maskDataUrl, prompt, entityId, options = {}) {
  const { userId, strength } = options;

  const rateCheck = checkRateLimit(userId, entityId);
  if (!rateCheck.allowed) throw new Error(rateCheck.reason);

  markInFlight(entityId);

  try {
    // Upload mask to S3 so Replicate can access it
    const maskUrl = await storeMask(maskDataUrl, entityId);

    // Run inpainting
    const resultUrl = await runInpainting(imageUrl, maskUrl, prompt || 'clean seamless continuation of surrounding area', { strength });

    // Store result in S3
    const s3Url = await storeInpaintedImage(resultUrl, entityId);

    incrementUsage(userId);

    return { inpainted_url: s3Url };
  } finally {
    clearInFlight(entityId);
  }
}

module.exports = { inpaintImage, checkRateLimit };
