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

// DepthAnythingV2 via chenxwh (community model — requires SDK or version-based endpoint)
const DEPTH_MODEL = 'chenxwh/depth-anything-v2';

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
 * Create a prediction on Replicate and wait for it to complete.
 * Returns the output URL (depth map image).
 *
 * Uses the official Replicate SDK which correctly resolves community model
 * versions (the raw /v1/models/{owner}/{name}/predictions endpoint only
 * works for official models and returns 404 for community models).
 */
async function runDepthEstimation(imageUrl) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  console.log('[DepthEstimation] Creating prediction with DepthAnythingV2...');

  try {
    const output = await replicate.run(DEPTH_MODEL, {
      input: {
        image: imageUrl,
      },
    });

    console.log('[DepthEstimation] Prediction completed');
    return output;
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[DepthEstimation] Replicate API error (${status}):`, detail);
    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
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
    // Run depth estimation via Replicate
    const depthOutput = await runDepthEstimation(imageUrl);

    // Replicate returns either a string URL or an array — handle both
    const depthUrl = Array.isArray(depthOutput) ? depthOutput[0] : depthOutput;
    if (!depthUrl || typeof depthUrl !== 'string') {
      throw new Error('Unexpected depth model output format');
    }

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
