'use strict';

/**
 * Depth Estimation Service — Replicate API (DepthAnythingV2)
 *
 * Generates depth maps from existing scene images using Replicate-hosted
 * DepthAnythingV2 model. Depth maps are stored in S3 as grayscale PNGs
 * and can be used for:
 *   - Parallax / Ken Burns 3D effects
 *   - Depth-of-field blur
 *   - 3D model export
 *
 * Follows the same patterns as objectGenerationService.js:
 *   - Rate limiting (1 in-flight per entity, 10/hr per user)
 *   - S3 storage with consistent key structure
 *   - Non-fatal error handling
 */

const axios = require('axios');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── REPLICATE CONFIG ───────────────────────────────────────────────────────

// DepthAnythingV2 via chenxwh (community model — requires version-based predictions endpoint)
const DEPTH_MODEL = 'chenxwh/depth-anything-v2';
const DEPTH_MODEL_VERSION = 'b239ea33cff32bb7abb5db39ffe9a09c14cbc2894331d1ef66fe096eed88ebd4';
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 120; // ~3 minutes at 1.5s intervals

// ─── RATE LIMITING ──────────────────────────────────────────────────────────

const inFlight = new Map();
const hourlyUsage = new Map();
const MAX_PER_HOUR = 10;

function checkRateLimit(userId, entityId) {
  if (inFlight.get(entityId)) {
    return { allowed: false, reason: 'A depth estimation is already in progress. Please wait.' };
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
    return { allowed: false, reason: `Depth estimation limit reached (${MAX_PER_HOUR}/hour). Resets in ${minutesLeft} minutes.` };
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
 * Create a prediction on Replicate and poll until complete.
 * Returns the grey depth map URL.
 *
 * Uses replicate.predictions.create with an explicit version hash because
 * chenxwh/depth-anything-v2 is a community model — the /v1/models/{owner}/{name}/predictions
 * endpoint only works for official models and returns 404 for community ones.
 */
async function runDepthEstimation(imageUrl) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  console.log('[DepthEstimation] Creating prediction with DepthAnythingV2...');

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      version: DEPTH_MODEL_VERSION,
      input: {
        image: imageUrl,
        model_size: 'Large',
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[DepthEstimation] Replicate API error (${status}):`, detail);
    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[DepthEstimation] Prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      console.log('[DepthEstimation] Prediction completed');
      // Model outputs { grey_depth, color_depth } — prefer grey for depth maps
      const depthUrl = prediction.output?.grey_depth || prediction.output?.color_depth;
      if (!depthUrl) {
        throw new Error('Depth model returned no output URLs');
      }
      return depthUrl;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Depth estimation ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }

    console.log(`[DepthEstimation] Status: ${prediction.status} (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
  }

  throw new Error('Depth estimation timed out after polling');
}

// ─── S3 STORAGE ─────────────────────────────────────────────────────────────

/**
 * Download the depth map from Replicate's output URL and store in S3.
 */
async function storeDepthMap(depthMapUrl, entityId) {
  const response = await axios.get(depthMapUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/depth/${ts}-${uid}-depth.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));

  const resultUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`[DepthEstimation] Depth map stored: ${s3Key}`);
  return resultUrl;
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Generate a depth map from an image URL.
 *
 * @param {string} imageUrl - Source image URL (scene background or still)
 * @param {object} opts
 * @param {string} opts.entityId - Scene ID or angle ID (for S3 path + rate limiting)
 * @param {string} opts.userId - For hourly rate limiting
 * @returns {{ depth_map_url: string, model_used: string }}
 */
async function generateDepthMap(imageUrl, { entityId, userId } = {}) {
  if (!imageUrl) throw new Error('imageUrl is required for depth estimation');
  if (!entityId) throw new Error('entityId is required');

  // Rate limit check
  const rateCheck = checkRateLimit(userId, entityId);
  if (!rateCheck.allowed) throw new Error(rateCheck.reason);

  markInFlight(entityId);

  try {
    // Run depth estimation via Replicate (returns grey depth URL directly)
    const depthUrl = await runDepthEstimation(imageUrl);

    // Store in S3
    const storedUrl = await storeDepthMap(depthUrl, entityId);

    incrementUsage(userId);

    return {
      depth_map_url: storedUrl,
      model_used: DEPTH_MODEL,
    };
  } finally {
    clearInFlight(entityId);
  }
}

module.exports = {
  generateDepthMap,
};
