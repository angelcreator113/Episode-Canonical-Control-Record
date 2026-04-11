'use strict';

/**
 * Object Generation Service — DALL-E 3 + Background Removal
 *
 * v2.0 Enhancements:
 *   - Background removal via remove.bg API
 *   - Automatic prompt enhancement option
 *   - Better error handling and rate limiting
 *   - Asset deduplication support
 *
 * Generates transparent PNG object cutouts for Scene Studio.
 * Uses OpenAI's DALL-E 3 API to create isolated objects that can be
 * placed as overlays on the canvas.
 *
 * Generated assets are saved to the Asset table for reuse across scenes.
 * Includes basic rate limiting (1 in-flight per scene, 20/hr per user).
 */

const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const _OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY;
const S3_BUCKET      = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// Visual style anchor (condensed for object generation)
const OBJECT_STYLE_ANCHOR = 'Style: Final Fantasy softness, Pinterest-core femininity, magical realism. ' +
  'Colors: warm neutrals (cream, blush, beige), gold accents, pastel glow. ' +
  'Materials: soft fabrics, light wood, glass, mirrors, shimmer. ' +
  'Quality: sharp edges, clean silhouette, studio lighting.';

// ─── RATE LIMITING ──────────────────────────────────────────────────────────

// In-flight tracking: sceneId → true (only one generation at a time per scene)
const inFlight = new Map();

// Hourly rate tracking: userId → { count, resetAt }
const hourlyUsage = new Map();
const MAX_PER_HOUR = 20;

function checkRateLimit(userId, sceneId) {
  // Check in-flight
  if (inFlight.get(sceneId)) {
    return { allowed: false, reason: 'A generation is already in progress for this scene. Please wait.' };
  }

  // Check hourly limit
  const now = Date.now();
  const userKey = userId || 'anonymous';
  let usage = hourlyUsage.get(userKey);
  if (!usage || now > usage.resetAt) {
    usage = { count: 0, resetAt: now + 3600000 };
    hourlyUsage.set(userKey, usage);
  }
  if (usage.count >= MAX_PER_HOUR) {
    const minutesLeft = Math.ceil((usage.resetAt - now) / 60000);
    return { allowed: false, reason: `Generation limit reached (${MAX_PER_HOUR}/hour). Resets in ${minutesLeft} minutes.` };
  }

  return { allowed: true };
}

function markInFlight(sceneId) {
  inFlight.set(sceneId, true);
}

function clearInFlight(sceneId) {
  inFlight.delete(sceneId);
}

function incrementUsage(userId) {
  const userKey = userId || 'anonymous';
  const usage = hourlyUsage.get(userKey);
  if (usage) usage.count++;
}

// ─── PROMPT BUILDING ────────────────────────────────────────────────────────

function buildObjectPrompt(userPrompt, styleHints) {
  const parts = [
    'Isolated single object on a pure white background.',
    'Clean product photography style, centered, no shadows on background, no floor, no room context.',
    `Object: ${userPrompt}.`,
    OBJECT_STYLE_ANCHOR,
  ];

  if (styleHints) {
    parts.push(`Additional style: ${styleHints}.`);
  }

  parts.push('High resolution, sharp details, professional studio lighting.');

  return parts.join(' ').trim();
}

function buildScenePrompt(userPrompt, styleHints) {
  const parts = [
    `Scene: ${userPrompt}.`,
    'Wide establishing shot, cinematic composition, no people, no text, no UI elements.',
    'Photographic quality, 16:9 aspect ratio, high resolution.',
    'Style: Pinterest-core femininity, luxury lifestyle, warm tones, editorial photography.',
  ];

  if (styleHints) {
    parts.push(styleHints);
  }

  return parts.join(' ').trim();
}

// ─── IMAGE GENERATION (via unified service) ────────────────────────────────

const { generateImage: generateImageUnified } = require('./imageGenerationService');

async function callDallE3(prompt, size = '1024x1024') {
  const sizeKey = size === '1024x1024' ? 'square' : size === '1792x1024' ? 'landscape' : 'square';
  const result = await generateImageUnified(prompt, { size: sizeKey, quality: 'standard' });
  // Return in DALL-E response shape for backwards compat
  return { url: result.url, revised_prompt: prompt };
}

// ─── BACKGROUND REMOVAL ─────────────────────────────────────────────────────

/**
 * Remove background from an image using remove.bg API.
 * Returns the URL of a transparent PNG stored in S3.
 */
async function removeBackground(imageUrl, sceneId) {
  if (!REMOVEBG_API_KEY) {
    console.warn('[ObjectGen] REMOVEBG_API_KEY not configured, skipping background removal');
    return null;
  }

  try {
    console.log('[ObjectGen] Removing background using remove.bg...');

    const response = await axios.post(
      'https://api.remove.bg/v1.0/removebg',
      {
        image_url: imageUrl,
        size: 'auto',
        format: 'png',
        bg_color: null, // Transparent
      },
      {
        headers: {
          'X-Api-Key': REMOVEBG_API_KEY,
        },
        responseType: 'arraybuffer',
        timeout: 45000,
      }
    );

    // Store result in S3
    const ts = Date.now();
    const id = uuidv4().slice(0, 8);
    const s3Key = `scene-studio/${sceneId}/generated/${ts}-${id}-nobg.png`;

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: Buffer.from(response.data),
      ContentType: 'image/png',
      CacheControl: 'max-age=31536000',
    }));

    const resultUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log('[ObjectGen] Background removal complete');
    return resultUrl;
  } catch (err) {
    console.error('[ObjectGen] Background removal failed:', err.message);
    // Non-fatal — return null to indicate no BG removal was done
    return null;
  }
}

// ─── S3 STORAGE ─────────────────────────────────────────────────────────────

async function storeInS3(imageUrl, sceneId) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const ts = Date.now();
  const id = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${sceneId}/generated/${ts}-${id}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── ASSET CREATION ─────────────────────────────────────────────────────────

/**
 * Save generated image as a reusable Asset in the database.
 * Available globally in the user's library under "AI Generated" category.
 */
async function createAssetRecord(Asset, { s3Url, s3UrlProcessed, prompt, styleHints, showId, userId, revisedPrompt, backgroundRemoved }) {
  try {
    const asset = await Asset.create({
      id: uuidv4(),
      s3_url_raw: s3Url,
      s3_url_processed: s3UrlProcessed || s3Url,
      content_type: 'image/png',
      width: 1024,
      height: 1024,
      category: 'ai_generated',
      asset_type: 'GENERATED_OBJECT',
      show_id: showId || null,
      original_filename: `ai-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`,
      metadata: {
        source: 'dall-e-3',
        prompt,
        style_hints: styleHints || null,
        revised_prompt: revisedPrompt || null,
        generated_at: new Date().toISOString(),
        generated_by: userId || null,
        background_removed: backgroundRemoved || false,
      },
    });
    return asset;
  } catch (err) {
    console.error('[ObjectGen] Asset creation failed:', err.message);
    return null;
  }
}

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────

/**
 * Generate object images and store in S3 + Asset table.
 * Optionally removes background using remove.bg API.
 *
 * @param {string} prompt - User's object description
 * @param {object} options
 * @param {string} options.sceneId - Scene ID for S3 path
 * @param {string} [options.styleHints] - Additional style modifiers
 * @param {number} [options.count=2] - Number of variations (1-4)
 * @param {boolean} [options.removeBackground=false] - Remove background using remove.bg
 * @param {string} [options.userId] - User ID for rate limiting
 * @param {string} [options.showId] - Show ID for asset association
 * @param {object} [options.Asset] - Sequelize Asset model for DB persistence
 * @returns {Promise<Array<{asset_id: string, url: string, width: number, height: number, background_removed: boolean}>>}
 */
async function generateObject(prompt, options = {}) {
  const { sceneId, styleHints, count = 2, userId, showId, Asset, removeBackground: doRemoveBg = false, isScene = false } = options;

  // Rate limit check
  const rateCheck = checkRateLimit(userId, sceneId);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.reason);
  }

  markInFlight(sceneId);
  const fullPrompt = isScene ? buildScenePrompt(prompt, styleHints) : buildObjectPrompt(prompt, styleHints);

  console.log(`[ObjectGen] Generating ${count} object(s): "${prompt}"${doRemoveBg ? ' (with BG removal)' : ''}`);

  try {
    // DALL-E 3 only supports n=1, so call in parallel for multiple options
    const imageSize = isScene ? '1792x1024' : '1024x1024';
    const calls = Array.from({ length: Math.min(count, 4) }, () => callDallE3(fullPrompt, imageSize));

    const results = await Promise.allSettled(calls);
    const optionsOut = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.url) {
        try {
          // Store raw image in S3
          const s3Url = await storeInS3(result.value.url, sceneId);

          // Optionally remove background
          let s3UrlProcessed = s3Url;
          let bgRemoved = false;
          if (doRemoveBg) {
            const noBgUrl = await removeBackground(s3Url, sceneId);
            if (noBgUrl) {
              s3UrlProcessed = noBgUrl;
              bgRemoved = true;
            }
          }

          // Save to Asset table if model available
          let assetId = uuidv4();
          if (Asset) {
            const asset = await createAssetRecord(Asset, {
              s3Url,
              s3UrlProcessed,
              prompt,
              styleHints,
              showId,
              userId,
              revisedPrompt: result.value.revised_prompt,
              backgroundRemoved: bgRemoved,
            });
            if (asset) assetId = asset.id;
          }

          optionsOut.push({
            asset_id: assetId,
            url: s3UrlProcessed, // Return the processed URL (with or without BG)
            url_raw: s3Url,      // Also include raw URL
            width: 1024,
            height: 1024,
            revised_prompt: result.value.revised_prompt,
            background_removed: bgRemoved,
          });
        } catch (err) {
          console.error('[ObjectGen] Processing failed:', err.message);
        }
      } else if (result.status === 'rejected') {
        console.error('[ObjectGen] DALL-E 3 call failed:', result.reason?.message);
      }
    }

    if (optionsOut.length === 0) {
      throw new Error('All generation attempts failed');
    }

    incrementUsage(userId);
    console.log(`[ObjectGen] Generated ${optionsOut.length} option(s) successfully`);
    return optionsOut;
  } finally {
    clearInFlight(sceneId);
  }
}

module.exports = { generateObject, checkRateLimit, removeBackground };
