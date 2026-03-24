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
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── REPLICATE CONFIG ───────────────────────────────────────────────────────

// DepthAnythingV2 — high-quality monocular depth estimation
const DEPTH_MODEL = 'chenxwh/depth-anything-v2';
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max at 5s intervals
const POLL_INTERVAL_MS = 5000;

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
 */
async function runDepthEstimation(imageUrl) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  console.log('[DepthEstimation] Creating prediction with DepthAnythingV2...');

  // Create prediction via Replicate's models API
  let createResponse;
  try {
    createResponse = await axios.post(
      `${REPLICATE_API_BASE}/models/${DEPTH_MODEL}/predictions`,
      {
        input: {
          image: imageUrl,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        timeout: 300000, // 5 minute timeout for sync wait
      }
    );
  } catch (apiError) {
    const status = apiError.response?.status;
    const detail = apiError.response?.data?.detail || apiError.message;
    throw new Error(`Replicate API error: ${status} — ${detail}`);
  }

  // If the API responded synchronously (Prefer: wait), check for output
  if (createResponse.data.status === 'succeeded' && createResponse.data.output) {
    console.log('[DepthEstimation] Prediction completed synchronously');
    return createResponse.data.output;
  }

  // Otherwise, poll for completion
  const predictionUrl = createResponse.data.urls?.get || `${REPLICATE_API_BASE}/predictions/${createResponse.data.id}`;

  console.log(`[DepthEstimation] Polling prediction ${createResponse.data.id}...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const pollResponse = await axios.get(predictionUrl, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      timeout: 15000,
    });

    const { status, output, error } = pollResponse.data;

    if (status === 'succeeded') {
      console.log('[DepthEstimation] Prediction completed');
      return output;
    }

    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Depth estimation ${status}: ${error || 'unknown error'}`);
    }
  }

  throw new Error('Depth estimation timed out after 5 minutes');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
