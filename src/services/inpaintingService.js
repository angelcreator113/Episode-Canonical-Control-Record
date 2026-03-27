'use strict';

/**
 * Inpainting Service — Replicate API (Dual-Model)
 *
 * Two modes:
 *   1. Object REMOVAL (no prompt) — SDXL context-aware cleanup (with LaMa fallback).
 *      Higher quality on complex interiors/textures.
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
const REPLICATE_FLUX_FILL_PRO_VERSION = process.env.REPLICATE_FLUX_FILL_PRO_VERSION || '';
const REPLICATE_FLUX_FILL_PRO_MODEL = process.env.REPLICATE_FLUX_FILL_PRO_MODEL || 'black-forest-labs/flux-fill-pro';
const REMOVAL_TIER_DEFAULT = process.env.REMOVAL_TIER_DEFAULT || 'standard';
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;
const STRICT_REMOVE_PASSES = Math.max(1, Math.min(3, parseInt(process.env.STRICT_REMOVE_PASSES || '2', 10)));

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
const providerCooldownUntil = new Map();
const MAX_PER_HOUR = 15;

function parseRetryAfterSeconds(error) {
  const direct = Number.parseInt(String(error?.retryAfter || ''), 10);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const responseRetry = Number.parseInt(String(error?.response?.data?.retry_after || ''), 10);
  if (Number.isFinite(responseRetry) && responseRetry > 0) return responseRetry;

  const msg = String(error?.message || '');
  const retryAfterMatch = msg.match(/retry_after["':\s]+(\d+)/i);
  if (retryAfterMatch) {
    return Number.parseInt(retryAfterMatch[1], 10);
  }

  const approxMatch = msg.match(/resets\s+in\s+~?(\d+)s/i);
  if (approxMatch) {
    return Number.parseInt(approxMatch[1], 10);
  }

  return 0;
}

function setProviderCooldown(userId, entityId, seconds) {
  const durationSec = Math.max(1, Math.min(120, Number.parseInt(String(seconds || 0), 10) || 8));
  const until = Date.now() + (durationSec * 1000);
  const userKey = userId || 'anonymous';
  providerCooldownUntil.set(`entity:${entityId}`, until);
  providerCooldownUntil.set(`user:${userKey}`, until);
}

function checkRateLimit(userId, entityId) {
  const now = Date.now();
  const userKey = userId || 'anonymous';
  const entityUntil = providerCooldownUntil.get(`entity:${entityId}`) || 0;
  const userUntil = providerCooldownUntil.get(`user:${userKey}`) || 0;
  const providerUntil = Math.max(entityUntil, userUntil);
  if (providerUntil > now) {
    const secondsLeft = Math.max(1, Math.ceil((providerUntil - now) / 1000));
    return {
      allowed: false,
      reason: `Inpainting provider is rate-limited. Retry in ${secondsLeft}s.`,
      retryAfter: secondsLeft,
      status: 429,
    };
  }

  if (inFlight.get(entityId)) {
    return { allowed: false, reason: 'An inpainting operation is already in progress. Please wait.', status: 429, retryAfter: 8 };
  }
  let usage = hourlyUsage.get(userKey);
  if (!usage || now > usage.resetAt) {
    usage = { count: 0, resetAt: now + 3600000 };
    hourlyUsage.set(userKey, usage);
  }
  if (usage.count >= MAX_PER_HOUR) {
    const minutesLeft = Math.ceil((usage.resetAt - now) / 60000);
    return {
      allowed: false,
      reason: `Inpainting limit reached (${MAX_PER_HOUR}/hour). Resets in ${minutesLeft} minutes.`,
      status: 429,
      retryAfter: minutesLeft * 60,
    };
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
 * Advanced object removal using SDXL inpainting with a neutral cleanup prompt.
 * Falls back to LaMa in caller when this path fails.
 */
async function runSdxlRemoval(imageUrl, maskUrl) {
  const removalPrompt = [
    'Clean, natural background continuation.',
    'Remove the masked object completely.',
    'Preserve scene geometry, lighting, and texture consistency.',
    'Photorealistic, seamless blend, no artifacts.',
  ].join(' ');

  return runSdxlInpainting(imageUrl, maskUrl, removalPrompt, {
    strength: 0.95,
    guidanceScale: 6.5,
  });
}

/**
 * Strict deterministic removal path for erase tool.
 * Runs LaMa for one or more passes and avoids generative models entirely.
 */
async function runStrictLamaRemoval(imageUrl, maskUrl) {
  let currentUrl = imageUrl;

  for (let pass = 1; pass <= STRICT_REMOVE_PASSES; pass++) {
    console.log(`[Inpainting] Strict LaMa pass ${pass}/${STRICT_REMOVE_PASSES}`);
    currentUrl = await runLamaRemoval(currentUrl, maskUrl);
  }

  return currentUrl;
}

/**
 * Premium removal tier using FLUX Fill Pro.
 * Uses version hash when configured, otherwise falls back to model slug run.
 */
async function runFluxFillProRemoval(imageUrl, maskUrl) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  console.log('[Inpainting] Using FLUX Fill Pro premium removal');
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  const prompt = [
    'Remove masked object and reconstruct a realistic background.',
    'Maintain exact scene perspective, lighting, and texture continuity.',
    'Photorealistic and artifact-free.',
  ].join(' ');

  if (!REPLICATE_FLUX_FILL_PRO_VERSION) {
    try {
      const output = await replicate.run(REPLICATE_FLUX_FILL_PRO_MODEL, {
        input: {
          image: imageUrl,
          mask: maskUrl,
          prompt,
        },
      });

      const outputUrl = extractReplicateOutputUrl(output);
      if (!outputUrl) {
        throw new Error('FLUX Fill Pro model run returned no output URL');
      }

      console.log('[Inpainting] FLUX Fill Pro removal completed (model slug run)');
      return outputUrl;
    } catch (err) {
      const status = err.response?.status || err.status;
      const detail = err.response?.data?.detail || err.message;
      console.error(`[Inpainting] FLUX Fill Pro model-run error (${status}):`, detail);
      throw new Error(`FLUX Fill Pro model-run error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      version: REPLICATE_FLUX_FILL_PRO_VERSION,
      input: {
        image: imageUrl,
        mask: maskUrl,
        prompt,
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[Inpainting] FLUX Fill Pro API error (${status}):`, detail);
    throw new Error(`FLUX Fill Pro API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[Inpainting] FLUX Fill Pro prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      const outputUrl = extractReplicateOutputUrl(prediction.output);
      if (!outputUrl) {
        throw new Error('FLUX Fill Pro returned no output URL');
      }
      console.log('[Inpainting] FLUX Fill Pro removal completed');
      return outputUrl;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`FLUX Fill Pro ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }
  }

  throw new Error('FLUX Fill Pro removal timed out');
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

// ─── REFERENCE IMAGE COMPOSITING ────────────────────────────────────────────

/**
 * Composite a reference image onto the background using a mask.
 * The reference image is scaled to fit the mask's bounding box (cover fit).
 * Returns a publicly-accessible S3 URL of the composited result.
 */
async function compositeReferenceImage(backgroundUrl, maskUrl, referenceUrl, entityId) {
  console.log('[Inpainting] Server-side compositing: background + reference via mask');

  // Download all three images
  const [bgRes, maskRes, refRes] = await Promise.all([
    axios.get(backgroundUrl, { responseType: 'arraybuffer', timeout: 30000 }),
    axios.get(maskUrl, { responseType: 'arraybuffer', timeout: 30000 }),
    axios.get(referenceUrl, { responseType: 'arraybuffer', timeout: 30000 }),
  ]);

  const bgBuffer = Buffer.from(bgRes.data);
  const maskBuffer = Buffer.from(maskRes.data);
  const refBuffer = Buffer.from(refRes.data);

  // Get background dimensions
  const bgMeta = await sharp(bgBuffer).metadata();
  const bgW = bgMeta.width;
  const bgH = bgMeta.height;

  // Resize mask to match background
  const maskResized = await sharp(maskBuffer)
    .resize(bgW, bgH, { fit: 'fill' })
    .greyscale()
    .png()
    .toBuffer();

  // Find the bounding box of the white area in the mask
  const maskRaw = await sharp(maskResized).raw().toBuffer();
  let minX = bgW, minY = bgH, maxX = 0, maxY = 0;
  for (let y = 0; y < bgH; y++) {
    for (let x = 0; x < bgW; x++) {
      const pixel = maskRaw[y * bgW + x];
      if (pixel > 200) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const maskRegionW = maxX - minX + 1;
  const maskRegionH = maxY - minY + 1;

  if (maskRegionW <= 0 || maskRegionH <= 0) {
    console.warn('[Inpainting] Empty mask — returning background as-is');
    return backgroundUrl;
  }

  console.log(`[Inpainting] Mask bounding box: (${minX},${minY}) ${maskRegionW}x${maskRegionH}`);

  // Resize reference to cover-fit the mask bounding box
  const refMeta = await sharp(refBuffer).metadata();
  const refAspect = refMeta.width / refMeta.height;
  const maskAspect = maskRegionW / maskRegionH;

  let cropW, cropH;
  if (refAspect > maskAspect) {
    cropH = maskRegionH;
    cropW = Math.round(maskRegionH * refAspect);
  } else {
    cropW = maskRegionW;
    cropH = Math.round(maskRegionW / refAspect);
  }

  const refResized = await sharp(refBuffer)
    .resize(cropW, cropH, { fit: 'fill' })
    .extract({
      left: Math.max(0, Math.round((cropW - maskRegionW) / 2)),
      top: Math.max(0, Math.round((cropH - maskRegionH) / 2)),
      width: Math.min(maskRegionW, cropW),
      height: Math.min(maskRegionH, cropH),
    })
    .png()
    .toBuffer();

  // Create the reference layer at full background size (transparent everywhere except mask region)
  const refLayer = await sharp({
    create: { width: bgW, height: bgH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: refResized, left: minX, top: minY }])
    .png()
    .toBuffer();

  // Composite: background + reference clipped to mask
  // 1. Use the mask as alpha for the reference layer
  const refWithMask = await sharp(refLayer)
    .joinChannel(maskResized) // adds mask as alpha
    .png()
    .toBuffer();

  // Actually, sharp's joinChannel replaces channels. Let me use composite instead.
  // Strategy: composite reference onto background using mask as opacity
  const result = await sharp(bgBuffer)
    .resize(bgW, bgH)
    .composite([{
      input: refLayer,
      blend: 'over',
      // We need to mask this — use the mask as the alpha channel
    }])
    .png()
    .toBuffer();

  // Better approach: create ref layer with mask as alpha channel
  // Step 1: Make ref layer with correct alpha from mask
  const refRGBA = await sharp(refLayer).ensureAlpha().raw().toBuffer();
  const maskPixels = await sharp(maskResized).raw().toBuffer();

  // Apply mask as alpha
  for (let i = 0; i < bgW * bgH; i++) {
    refRGBA[i * 4 + 3] = maskPixels[i]; // set alpha from mask
  }

  const maskedRef = await sharp(refRGBA, { raw: { width: bgW, height: bgH, channels: 4 } })
    .png()
    .toBuffer();

  // Final composite
  const finalResult = await sharp(bgBuffer)
    .resize(bgW, bgH)
    .composite([{ input: maskedRef, blend: 'over' }])
    .png()
    .toBuffer();

  // Upload to S3
  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/composited/${ts}-${uid}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: finalResult,
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));

  const compositeUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`[Inpainting] Composite stored: ${s3Key}`);
  return compositeUrl;
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

async function refineRemovalMask(maskBuffer, options = {}) {
  const expandPx = Math.max(0, Math.min(20, Math.round(options.expandPx ?? 2)));
  const featherPx = Math.max(0, Math.min(5, Number(options.featherPx ?? 0.8)));

  // Slight dilation + feathering helps LaMa remove edge halos and leftover fragments.
  return sharp(maskBuffer)
    .greyscale()
    .threshold(16)
    .dilate(expandPx)
    .blur(featherPx)
    .png()
    .toBuffer();
}

/**
 * Store a mask image (base64 data URL) to S3 for Replicate to access.
 */
async function storeMask(maskDataUrl, entityId, sourceImageUrl, options = {}) {
  const { forRemoval = false, maskExpand, maskFeather } = options;
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
    buffer = await refineRemovalMask(buffer, {
      expandPx: maskExpand,
      featherPx: maskFeather,
    });
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
 * When mode is 'remove' (or no prompt given), uses tiered removal:
 * premium: FLUX Fill Pro -> SDXL -> LaMa
 * standard: SDXL -> LaMa
 * When mode is 'fill' (or a prompt is provided), uses SDXL inpainting.
 */
async function inpaintImage(imageUrl, maskDataUrl, prompt, entityId, options = {}) {
  const { userId, strength, mode, removalTier, strictRemove = false, maskExpand, maskFeather, referenceImageUrl } = options;

  const rateCheck = checkRateLimit(userId, entityId);
  if (!rateCheck.allowed) {
    const blockedError = new Error(rateCheck.reason);
    blockedError.status = rateCheck.status || 429;
    if (rateCheck.retryAfter) blockedError.retryAfter = rateCheck.retryAfter;
    throw blockedError;
  }

  markInFlight(entityId);

  try {
    // Choose model based on mode/prompt
    const isRemoval = mode === 'remove' || !prompt;

    // Upload mask to S3 so Replicate can access it
    const maskUrl = await storeMask(maskDataUrl, entityId, imageUrl, {
      forRemoval: isRemoval,
      maskExpand,
      maskFeather,
    });

    let resultUrl;

    // Reference image mode: composite the reference onto the background,
    // then use SDXL to blend the edges naturally.
    if (referenceImageUrl) {
      console.log('[Inpainting] Mode: REFERENCE FILL — compositing + AI edge blend');
      const compositedUrl = await compositeReferenceImage(imageUrl, maskUrl, referenceImageUrl, entityId);
      // Now inpaint the composited result with a soft edge blend
      const blendPrompt = prompt || 'Seamless blend, match surrounding lighting, texture, and perspective. Photorealistic.';
      // Create a dilated mask for edge blending only (expand the mask edges)
      resultUrl = await runSdxlInpainting(compositedUrl, maskUrl, blendPrompt, {
        strength: strength || 0.45,
        guidanceScale: 5.0,
      });
    } else if (isRemoval) {
      const tier = (removalTier || (mode === 'remove-premium' ? 'premium' : REMOVAL_TIER_DEFAULT)).toLowerCase();
      console.log(`[Inpainting] Mode: REMOVAL (tier=${tier}, strict=${strictRemove})`);

      if (strictRemove) {
        // Never use generative fallback in strict remove mode.
        resultUrl = await runStrictLamaRemoval(imageUrl, maskUrl);
      } else if (tier === 'premium') {
        try {
          resultUrl = await runFluxFillProRemoval(imageUrl, maskUrl);
        } catch (fluxError) {
          console.warn('[Inpainting] FLUX premium removal failed; falling back to SDXL:', fluxError.message);
          try {
            resultUrl = await runSdxlRemoval(imageUrl, maskUrl);
          } catch (sdxlError) {
            console.warn('[Inpainting] SDXL removal failed; falling back to LaMa:', sdxlError.message);
            resultUrl = await runLamaRemoval(imageUrl, maskUrl);
          }
        }
      } else {
        try {
          resultUrl = await runSdxlRemoval(imageUrl, maskUrl);
        } catch (sdxlError) {
          console.warn('[Inpainting] SDXL removal failed; falling back to LaMa:', sdxlError.message);
          resultUrl = await runLamaRemoval(imageUrl, maskUrl);
        }
      }
    } else {
      console.log(`[Inpainting] Mode: FILL (SDXL) — "${prompt.slice(0, 60)}"`);
      resultUrl = await runSdxlInpainting(imageUrl, maskUrl, prompt, { strength });
    }

    // Store result in S3
    const s3Url = await storeInpaintedImage(resultUrl, entityId);

    incrementUsage(userId);

    return { inpainted_url: s3Url };
  } catch (error) {
    const status = Number.parseInt(String(error?.status || error?.response?.status || ''), 10);
    const isProviderRateLimit = status === 429 || /rate[-\s]?limit|throttled|too many requests/i.test(String(error?.message || ''));

    if (isProviderRateLimit) {
      const retryAfter = parseRetryAfterSeconds(error) || 8;
      setProviderCooldown(userId, entityId, retryAfter);

      const limitError = new Error(`Inpainting provider is rate-limited. Retry in ${retryAfter}s.`);
      limitError.status = 429;
      limitError.retryAfter = retryAfter;
      throw limitError;
    }

    throw error;
  } finally {
    clearInFlight(entityId);
  }
}

module.exports = { inpaintImage, checkRateLimit };
