'use strict';

/**
 * Inpainting Service — Replicate API (Dual-Model)
 *
 * Two modes:
 *   1. Object REMOVAL (no prompt) — uses LaMa (Large Mask Inpainting).
 *      Fast, no prompt needed, seamlessly continues the background.
 *   2. Creative FILL (with prompt) — uses lucataco/sdxl-inpainting.
 *      Generates new content described by the user's prompt.
 */

const axios = require('axios');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_INPAINT_VERSION = process.env.REPLICATE_INPAINT_VERSION || 'a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7';
const REPLICATE_LAMA_VERSION = process.env.REPLICATE_LAMA_VERSION || 'cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72';
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;

// ─── MODEL CONFIG ───────────────────────────────────────────────────────────

function extractReplicateOutputUrl(output) {
  if (!output) return null;

  if (typeof output === 'string') {
    return output;
  }

  if (output instanceof URL) {
    return output.toString();
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const nestedUrl = extractReplicateOutputUrl(item);
      if (nestedUrl) return nestedUrl;
    }
    return null;
  }

  if (typeof output.url === 'function') {
    const resolved = output.url();
    if (resolved instanceof URL) return resolved.toString();
    if (typeof resolved === 'string') return resolved;
  }

  if (typeof output.url === 'string') {
    return output.url;
  }

  for (const key of ['image', 'images', 'file', 'files', 'output']) {
    if (output[key]) {
      const nestedUrl = extractReplicateOutputUrl(output[key]);
      if (nestedUrl) return nestedUrl;
    }
  }

  if (typeof output.toString === 'function' && output.toString !== Object.prototype.toString) {
    const resolved = output.toString();
    if (/^https?:\/\//i.test(resolved)) {
      return resolved;
    }
  }

  return null;
}
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
 * Run LaMa for clean object removal (no prompt needed).
 * LaMa uses Fourier convolutions to seamlessly fill masked regions
 * with background continuation — ideal for removing objects.
 * Uses explicit version hash (community model — requires predictions endpoint).
 */
async function runLamaRemoval(imageUrl, maskUrl) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  console.log('[Inpainting] Using LaMa model for object removal');
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      version: REPLICATE_LAMA_VERSION,
      input: {
        image: imageUrl,
        mask: maskUrl,
        hd_strategy: 'Resize',
        hd_strategy_resize_limit: 2048,
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[Inpainting] LaMa API error (${status}):`, detail);
    throw new Error(`LaMa API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[Inpainting] LaMa prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      const outputUrl = extractReplicateOutputUrl(prediction.output);
      let resolvedUrl = outputUrl;

      if (!resolvedUrl || resolvedUrl === 'undefined' || resolvedUrl === 'null' || resolvedUrl === '[object Object]') {
        console.warn('[Inpainting] SDK output unusable; fetching raw prediction payload.');
        const rawResp = await axios.get(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
          timeout: 10000,
        });
        resolvedUrl = extractReplicateOutputUrl(rawResp.data?.output);
      }

      if (!resolvedUrl) {
        const outputSummary = Array.isArray(prediction.output)
          ? `array(${prediction.output.length})`
          : prediction.output && typeof prediction.output === 'object'
            ? `object keys=${Object.keys(prediction.output).join(',') || '(none)'}`
            : String(prediction.output);
        console.error('[Inpainting] Unexpected LaMa output shape:', outputSummary);
        if (prediction.logs) {
          console.error('[Inpainting] LaMa prediction logs:', prediction.logs.slice(-1000));
        }
        throw new Error('LaMa model returned no output URL');
      }

      console.log('[Inpainting] LaMa removal completed');
      return resolvedUrl;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`LaMa ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }
  }

  throw new Error('LaMa removal timed out');
}

/**
 * Run SDXL inpainting for creative fills (prompt-driven).
 * Uses explicit version hash for Replicate predictions API compatibility.
 */
async function runSdxlInpainting(imageUrl, maskUrl, prompt, options = {}) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const { strength = 0.85, guidanceScale = 7.5 } = options;
  const qualityPrompt = [
    prompt,
    'Photographic quality, seamless blend with surrounding area.',
  ].join(' ');
  const negativePrompt = 'text, watermark, logo, blurry, low quality, artifacts, seams, distorted, ghosting, smudges, duplicated textures, patches, painted look';

  console.log(`[Inpainting] Using SDXL inpainting: prompt="${prompt.slice(0, 80)}...", strength=${strength}`);
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      version: REPLICATE_INPAINT_VERSION,
      input: {
        image: imageUrl,
        mask: maskUrl,
        prompt: qualityPrompt,
        negative_prompt: negativePrompt,
        strength: strength,
        num_outputs: 1,
        num_inference_steps: 40,
        guidance_scale: guidanceScale,
        scheduler: 'K_EULER',
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[Inpainting] Replicate API error (${status}):`, detail);
    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[Inpainting] Prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      console.log('[Inpainting] SDXL prediction completed');
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

async function getRemoteImageDimensions(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const metadata = await sharp(Buffer.from(response.data)).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine source image dimensions');
  }

  return { width: metadata.width, height: metadata.height };
}

async function refineRemovalMask(maskBuffer) {
  // Slight dilation + feathering helps LaMa remove edge halos and leftover fragments.
  return sharp(maskBuffer)
    .greyscale()
    .threshold(16)
    .dilate(2)
    .blur(0.8)
    .png()
    .toBuffer();
}

/**
 * Store a mask image (base64 data URL) to S3 for Replicate to access.
 */
async function storeMask(maskDataUrl, entityId, sourceImageUrl, options = {}) {
  const { forRemoval = false } = options;
  // Convert data:image/png;base64,... to buffer
  const base64Data = maskDataUrl.replace(/^data:image\/\w+;base64,/, '');
  let buffer = Buffer.from(base64Data, 'base64');

  if (sourceImageUrl) {
    const maskMetadata = await sharp(buffer).metadata();
    const sourceDimensions = await getRemoteImageDimensions(sourceImageUrl);
    const maskWidth = maskMetadata.width || 0;
    const maskHeight = maskMetadata.height || 0;

    if (maskWidth !== sourceDimensions.width || maskHeight !== sourceDimensions.height) {
      console.log(
        `[Inpainting] Resizing mask from ${maskWidth}x${maskHeight} to ${sourceDimensions.width}x${sourceDimensions.height}`
      );

      buffer = await sharp(buffer)
        .resize(sourceDimensions.width, sourceDimensions.height, {
          fit: 'fill',
          kernel: sharp.kernel.nearest,
        })
        .png()
        .toBuffer();
    }
  }

  if (forRemoval) {
    buffer = await refineRemovalMask(buffer);
  }

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
 * When mode is 'remove' (or no prompt given), uses LaMa for clean removal.
 * When mode is 'fill' (or a prompt is provided), uses SDXL inpainting.
 */
async function inpaintImage(imageUrl, maskDataUrl, prompt, entityId, options = {}) {
  const { userId, strength, mode } = options;

  const rateCheck = checkRateLimit(userId, entityId);
  if (!rateCheck.allowed) throw new Error(rateCheck.reason);

  markInFlight(entityId);

  try {
    // Choose model based on mode/prompt
    const isRemoval = mode === 'remove' || !prompt;

    // Upload mask to S3 so Replicate can access it
    const maskUrl = await storeMask(maskDataUrl, entityId, imageUrl, {
      forRemoval: isRemoval,
    });

    let resultUrl;

    if (isRemoval) {
      console.log('[Inpainting] Mode: REMOVAL (LaMa)');
      resultUrl = await runLamaRemoval(imageUrl, maskUrl);
    } else {
      console.log(`[Inpainting] Mode: FILL (SDXL) — "${prompt.slice(0, 60)}"`);
      resultUrl = await runSdxlInpainting(imageUrl, maskUrl, prompt, { strength });
    }

    // Store result in S3
    const s3Url = await storeInpaintedImage(resultUrl, entityId);

    incrementUsage(userId);

    return { inpainted_url: s3Url };
  } finally {
    clearInFlight(entityId);
  }
}

module.exports = { inpaintImage, checkRateLimit };
