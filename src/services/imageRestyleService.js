'use strict';

/**
 * Image Restyling Service — Replicate API (SDXL img2img)
 *
 * Transforms an existing scene background image by changing its
 * lighting, mood, and atmosphere while preserving the composition.
 * Uses Stability AI's SDXL model via Replicate in img2img mode.
 *
 * This is different from objectGenerationService which generates
 * NEW images from text — this MODIFIES an existing image.
 */

const axios = require('axios');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// SDXL img2img via Stability AI on Replicate
const SDXL_MODEL = 'stability-ai/sdxl';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // ~3 minutes

// ─── RATE LIMITING ──────────────────────────────────────────────────────────

const inFlight = new Map();
const hourlyUsage = new Map();
const MAX_PER_HOUR = 15;

function checkRateLimit(userId, entityId) {
  if (inFlight.get(entityId)) {
    return { allowed: false, reason: 'A restyling is already in progress. Please wait.' };
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
    return { allowed: false, reason: `Restyling limit reached (${MAX_PER_HOUR}/hour). Resets in ${minutesLeft} minutes.` };
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

// ─── TIME OF DAY + MOOD PROMPT MAPS ────────────────────────────────────────

const TIME_PROMPTS = {
  dawn: 'soft dawn lighting, pink and gold sky, early morning sun rays, warm pastel glow, sunrise atmosphere',
  day: 'bright natural daylight, clear warm sunlight, midday illumination, vivid colors, blue sky',
  golden: 'golden hour lighting, warm amber and honey tones, long dramatic shadows, sunset glow, rich warm highlights',
  night: 'nighttime scene, moonlight illumination, deep blues and indigos, soft ambient glow, stars visible, warm interior light from windows',
};

const MOOD_PROMPTS = {
  warm: 'warm inviting atmosphere, soft golden tones, cozy feeling, gentle light',
  dramatic: 'dramatic cinematic lighting, high contrast, deep rich shadows, moody atmosphere, chiaroscuro',
  soft: 'soft dreamy atmosphere, pastel color palette, gentle diffused light, ethereal glow',
  moody: 'moody contemplative atmosphere, muted desaturated tones, atmospheric haze, subdued lighting',
  ethereal: 'ethereal magical glow, luminous particles, otherworldly light, iridescent highlights, fantasy atmosphere',
};

// ─── REPLICATE API ──────────────────────────────────────────────────────────

/**
 * Restyle an image using SDXL img2img on Replicate.
 *
 * @param {string} imageUrl - URL of the source image to transform
 * @param {object} options
 * @param {string} [options.timeOfDay] - dawn/day/golden/night
 * @param {string} [options.mood] - warm/dramatic/soft/moody/ethereal
 * @param {string} [options.customPrompt] - Optional custom style prompt
 * @param {number} [options.strength] - How much to change (0.0-1.0, default 0.45)
 * @returns {Promise<string>} URL of the restyled image on Replicate
 */
async function runImgToImg(imageUrl, options = {}) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const { timeOfDay, mood, customPrompt, strength = 0.45 } = options;

  // Build the style prompt from time + mood
  const parts = [];
  if (timeOfDay && TIME_PROMPTS[timeOfDay]) parts.push(TIME_PROMPTS[timeOfDay]);
  if (mood && MOOD_PROMPTS[mood]) parts.push(MOOD_PROMPTS[mood]);
  if (customPrompt) parts.push(customPrompt);

  // Always include composition preservation hints
  parts.push('same room, same furniture, same composition, same camera angle, photographic quality');

  const prompt = parts.join(', ');
  const negativePrompt = 'different room, different layout, people, text, watermark, logo, blurry, low quality, deformed';

  console.log(`[ImageRestyle] Restyling with: time=${timeOfDay}, mood=${mood}, strength=${strength}`);
  console.log(`[ImageRestyle] Prompt: ${prompt.slice(0, 120)}...`);

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      model: SDXL_MODEL,
      input: {
        image: imageUrl,
        prompt,
        negative_prompt: negativePrompt,
        prompt_strength: strength,
        num_outputs: 1,
        width: 1024,
        height: 1024,
        refine: 'expert_ensemble_refiner',
        scheduler: 'K_EULER',
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    });
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[ImageRestyle] Replicate API error (${status}):`, detail);
    throw new Error(`Replicate API error: ${status || 'unknown'} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  console.log(`[ImageRestyle] Prediction ${prediction.id} created, polling...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    prediction = await replicate.predictions.get(prediction.id);

    if (prediction.status === 'succeeded') {
      console.log('[ImageRestyle] Prediction completed');
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      if (!outputUrl) {
        throw new Error('SDXL model returned no output URL');
      }
      return outputUrl;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Image restyling ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }

    console.log(`[ImageRestyle] Status: ${prediction.status} (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
  }

  throw new Error('Image restyling timed out');
}

// ─── S3 STORAGE ─────────────────────────────────────────────────────────────

async function storeRestyledImage(imageUrl, entityId) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/restyled/${ts}-${uid}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: 'image/png',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000',
  }));

  const resultUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`[ImageRestyle] Restyled image stored: ${s3Key}`);
  return resultUrl;
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Restyle a scene background image — change lighting, mood, atmosphere
 * while preserving the composition and content.
 *
 * @param {string} imageUrl - Source background image URL
 * @param {string} entityId - Scene or scene set ID (for S3 path + rate limiting)
 * @param {object} options - { timeOfDay, mood, customPrompt, strength, userId }
 * @returns {Promise<{restyled_url: string, time_of_day: string, mood: string}>}
 */
async function restyleBackground(imageUrl, entityId, options = {}) {
  const { userId, ...restyleOptions } = options;

  const rateCheck = checkRateLimit(userId, entityId);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.reason);
  }

  markInFlight(entityId);

  try {
    // Run img2img transformation via Replicate
    const replicateOutputUrl = await runImgToImg(imageUrl, restyleOptions);

    // Store in S3
    const s3Url = await storeRestyledImage(replicateOutputUrl, entityId);

    incrementUsage(userId);

    return {
      restyled_url: s3Url,
      time_of_day: restyleOptions.timeOfDay || null,
      mood: restyleOptions.mood || null,
    };
  } finally {
    clearInFlight(entityId);
  }
}

module.exports = { restyleBackground, checkRateLimit };
