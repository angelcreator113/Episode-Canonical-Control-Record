'use strict';

/**
 * Scene Generation Service — v2.0
 *
 * v2.0 enhancements:
 *   - Fixed aspect ratio: 1920:1080 for both text_to_image and image_to_video
 *   - Added negative_prompt to suppress common artifacts
 *   - Condensed LALAVERSE_VISUAL_ANCHOR to ~600 chars for better prompt budget
 *   - Style reference image support for visual consistency
 *   - Single still generation per call (no multi-variation quality sort)
 *   - Camera motion control mapping for image_to_video
 *   - Scene-specific video duration per angle type
 *   - Post-processing pipeline integration (Sharp, Cloudinary, FFmpeg)
 *   - Multi-pass auto-refinement queue
 */

const axios = require('axios');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const artifactDetection = require('./artifactDetectionService');
const sceneSpecService = require('./sceneSpecService');
const imageCost = require('./imageCostService');
const Anthropic = require('@anthropic-ai/sdk');

const RUNWAY_API_BASE    = 'https://api.dev.runwayml.com/v1';
const RUNWAY_API_KEY     = process.env.RUNWAY_ML_API_KEY;
const RUNWAY_API_VERSION = '2024-11-06';
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const S3_BUCKET          = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION         = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });
const { buildSceneBrief, briefToPrompt, prepareSceneBrief } = require('./sceneBriefService');

// ─── LALAVERSE VISUAL ANCHOR (condensed ~590 chars) ─────────────────────────

const LALAVERSE_VISUAL_ANCHOR = `Style: Final Fantasy softness, Pinterest-core femininity, magical realism. Natural hero lighting. Materials: soft fabrics, glass, mirrors, shimmer. Tone: calm, intentional, beautiful, lived-in. Quality: sharp edges on furniture, consistent hardware, correct chair/table legs, coherent reflections, clean fabric folds, precise floor patterns, minimal surface objects.`;

// ─── NEGATIVE PROMPT (universal) ─────────────────────────────────────────────

const NEGATIVE_PROMPT = `person, people, human, figure, silhouette, body, face, hands, legs, shadow of a person, reflection of a person, neon lighting, cyberpunk, cluttered decor, ultra-minimal sterile, dark moody lighting, distorted furniture legs, melted objects, blobby shapes, warped reflections, text, watermarks, signatures, blurry, low resolution, oversaturated, chromatic aberration`;

// ─── ANGLE MODIFIERS ──────────────────────────────────────────────────────────

const ANGLE_MODIFIERS = {
  WIDE:         'Wide establishing shot showing the FULL room from corner to corner. Camera pulled back to maximum width. Include ceiling, floor, and all walls visible. Extended panoramic view revealing the complete space and all furniture.',
  CLOSET:       'Camera facing the wardrobe/closet area. Extend the view to show full-height clothing racks, shelving, and organized accessories. Soft warm glow on fabric textures. Show the full depth of the closet space as if the wall has been extended back.',
  VANITY:       'Camera at vanity/dressing table area. Show the full mirror, surface details, beauty products, and surrounding decor. Extend the view to include adjacent shelving or wall art. Soft glamour lighting.',
  WINDOW:       'Camera facing the window wall. Extend the view to show the FULL window and surrounding wall space. Natural golden light streaming in. Include curtains, window seat, or plants near the window. Show what is visible beyond the glass.',
  DOORWAY:      'Camera at the doorway threshold, looking into the room from outside. Wide enough to show the full door frame and hallway. Sense of arrival — revealing the room from an outsider perspective. Extended view showing the transition between spaces.',
  ESTABLISHING: 'Grand wide exterior or entrance shot. Camera pulled far back. Show the full facade, entrance, or grand interior from maximum distance. Include architectural details, landscaping, or approach path. The most expansive possible view.',
  ACTION:       'Dynamic angle with sense of movement or event energy. Slightly asymmetric composition. Show the space as if someone just walked through it. Extended view capturing the flow of the room.',
  CLOSE:        'Close-up shot on a signature surface, object, or detail. Intimate and personal. Show texture, material quality, and craftsmanship. Extend focus to include nearby complementary details.',
  OVERHEAD:     'High overhead angle looking straight down. Reveal the full room layout, furniture arrangement, and floor pattern. Bird\'s-eye view showing the complete spatial relationships.',
  OTHER:        'Unique compositional angle appropriate to this specific location. Extend the visible space beyond what the reference image shows.',
};

// ─── CAMERA MOTION MAPPING (per angle type) ─────────────────────────────────

const CAMERA_MOTION_MAP = {
  WIDE:         'slow_pan_right',
  CLOSET:       'slow_dolly_in',
  VANITY:       'slow_dolly_in',
  WINDOW:       'static',
  DOORWAY:      'slow_dolly_in',
  ESTABLISHING: 'slow_pan_right',
  ACTION:       'dynamic_tracking',
  CLOSE:        'slow_dolly_in',
  OVERHEAD:     'slow_zoom_out',
  OTHER:        'static',
};

// ─── VIDEO DURATION MAPPING (per angle type, in seconds) ────────────────────

const VIDEO_DURATION_MAP = {
  WIDE:         10,
  CLOSET:       5,
  VANITY:       5,
  WINDOW:       10,
  DOORWAY:      5,
  ESTABLISHING: 10,
  ACTION:       5,
  CLOSE:        5,
  OVERHEAD:     10,
  OTHER:        5,
};

// Require stronger base-image continuity for angle generations.
const CONSISTENCY_MIN_SCORE = 85;
const CONSISTENCY_MAX_RETRIES = 1;

// Video-specific movement descriptions for image_to_video (describe camera MOTION, not static composition)
const VIDEO_MOVEMENT_MODIFIERS = {
  WIDE:         'Camera slowly pulls back and pans to reveal the full room. Steady, smooth cinematic pullback.',
  CLOSET:       'Camera slowly dollies forward toward the wardrobe area. Gentle forward drift revealing fabric textures.',
  VANITY:       'Camera slowly pushes toward the vanity mirror, approaching surface details and reflections. Smooth forward glide.',
  WINDOW:       'Camera slowly pans toward the window as natural light brightens. Gentle lateral movement.',
  DOORWAY:      'Camera slowly retreats through the doorway, revealing the room from the threshold. Steady pullback.',
  ESTABLISHING: 'Camera slowly tilts up and pulls back to reveal the grand scope of the space. Majestic rising reveal.',
  ACTION:       'Camera moves dynamically through the space with slight handheld energy. Purposeful cinematic tracking.',
  CLOSE:        'Camera slowly pushes in for an intimate close-up of a surface or detail. Smooth gentle forward drift.',
  OVERHEAD:     'Camera slowly rises upward, revealing the room layout from above. Steady ascending crane movement.',
  OTHER:        'Camera moves gently through the space with natural flowing motion. Smooth cinematic drift.',
};

// ─── ENVIRONMENT-ONLY CONSTRAINT (Scene Rule #1 — frozen Session 21) ────────

const _ENVIRONMENT_ONLY_CONSTRAINT = 'Empty room. No people. No person. No human. No figure. No silhouette. No body. No face. No hands. No reflection of a person. Environment only.';

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

/**
 * The prompt for a scene set's image, from its Scene Brief (ruling S1,
 * 2026-09-30; sceneBriefService). This synchronous form builds the brief
 * from the scene set alone; generation (generateBaseScene, generateAngle,
 * regenerateAngleRefined) loads the World Location, and an event only when
 * one is chosen explicitly, with prepareSceneBrief. No generic style or
 * lighting text is added: lighting comes from the brief.
 */
function buildPrompt(sceneSet, angleLabel = 'WIDE', customCameraDirection = null) {
  const angle = String(angleLabel || 'WIDE').toUpperCase();
  return briefToPrompt(buildSceneBrief({
    sceneSet, angleLabel: angle, cameraDirection: customCameraDirection,
    continuity: angle !== 'WIDE' && angle !== 'OTHER',
  }));
}

/**
 * Build a short, movement-focused prompt for image_to_video angle generation.
 * The scene description is already in the base image — the video prompt
 * should only describe camera MOVEMENT so the AI animates the camera.
 */
function buildVideoPrompt(sceneSet, angleLabel, customCameraDirection) {
  const movementText = customCameraDirection
    ? `Camera movement: ${customCameraDirection}`
    : VIDEO_MOVEMENT_MODIFIERS[angleLabel] || VIDEO_MOVEMENT_MODIFIERS.WIDE;

  const parts = [
    movementText,
    `Scene: ${sceneSet.name}.`,
    'Maintain warm soft natural lighting. Photorealistic quality. No morphing. No text overlays.',
  ];

  return parts.join(' ').trim();
}

// ─── RUNWAY API HELPERS ───────────────────────────────────────────────────────

function runwayHeaders() {
  if (!RUNWAY_API_KEY) throw new Error('RUNWAY_ML_API_KEY not configured');
  return {
    'Authorization': `Bearer ${RUNWAY_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': RUNWAY_API_VERSION,
  };
}

/**
 * Step 1: Generate still image using Flux.
 * Uses image-to-image when a base/reference image is available so camera
 * angles stay anchored to the scene set's locked base still.
 */
async function startTextToImage(prompt, options = {}) {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured');
  }

  const { generateImageFromImage, generateImageUrl } = require('./imageGenerationService');
  const referenceImageUrl = options.referenceImage
    || options.referenceImages?.find(img => img?.uri)?.uri
    || null;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let imageUrl;

      if (referenceImageUrl) {
        const result = await generateImageFromImage(referenceImageUrl, prompt.slice(0, 4000), {
          size: 'landscape',
          seed: options.seed,
          guidanceScale: options.guidanceScale,
          onLogged: options.onLogged,
        });
        imageUrl = result?.url;
        console.log('[SceneGen] Flux Kontext still generated from base reference');
      } else {
        // quality 'standard' = fal-ai/flux/dev, 'hd' = fal-ai/flux-pro/v1.1
        // (imageGenerationService.fluxModelFor). Default: standard, as before.
        imageUrl = await generateImageUrl(prompt.slice(0, 4000), {
          provider: 'flux',
          size: 'landscape',
          quality: options.quality || 'standard',
          useCase: 'scene',
          seed: options.seed,
          onLogged: options.onLogged,
        });
        console.log('[SceneGen] Flux still generated from prompt only');
      }

      if (!imageUrl) throw new Error('Flux did not return an image URL');

      return { imageUrl, revisedPrompt: null };
    } catch (err) {
      if (imageCost.isBudgetError(err)) {
        console.error(`[SceneGen] Flux still refused: ${err.message}`);
        throw err; // budget refusal: never retried
      }
      const status = err.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (err.response) {
        console.error(`[SceneGen] Flux still error (attempt ${attempt}/${MAX_RETRIES}):`, JSON.stringify(err.response.data, null, 2));
      }
      if (!retryable || attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 2000;
      console.log(`[SceneGen] Retrying Flux still in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

/**
 * Download a temporary still URL and persist as a 1920x1080 JPEG in S3.
 */
async function downloadAndStoreStill(imageUrl, sceneSetId, suffix = 'still') {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  const buffer = Buffer.from(response.data);

  const processed = await sharp(buffer)
    .resize(1920, 1080, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 92 })
    .toBuffer();

  const s3Key = `scene-sets/${sceneSetId}/stills/${Date.now()}-${suffix}.jpg`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: processed,
    ContentType: 'image/jpeg',
    CacheControl: 'max-age=31536000',
  }));

  const s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`[SceneGen] Still stored: ${s3Key}`);
  return s3Url;
}

/**
 * Step 2: Generate a video clip from a still image + text prompt.
 * Fixed: ratio now matches text_to_image (1920:1080).
 * Added: camera motion control, scene-specific duration, negative prompt.
 */
async function startImageToVideo(prompt, imageUrl, options = {}) {
  const { seed, duration = 5, cameraMotion } = options;
  const parsedSeed = seed != null && /^\d+$/.test(String(seed)) ? Number(seed) : undefined;

  const payload = {
    model: 'gen3a_turbo',
    promptText: prompt,
    promptImage: imageUrl,
    duration,
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
    ...(cameraMotion ? { cameraMotion } : {}),
  };

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${RUNWAY_API_BASE}/image_to_video`,
        payload,
        { headers: runwayHeaders(), timeout: 30000 }
      );
      return { jobId: response.data.id };
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (err.response) {
        console.error(`[SceneGen] image_to_video API error (attempt ${attempt}/${MAX_RETRIES}):`, JSON.stringify(err.response.data, null, 2));
      }
      if (!retryable || attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 2000;
      console.log(`[SceneGen] Retrying image_to_video in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

// ─── DALL-E 3 STILL GENERATION ──────────────────────────────────────────────

/**
 * Generate a high-quality still image via DALL-E 3.
 * Returns the image URL directly (no polling needed).
 * Used as the default for scene stills — richer detail than Runway for static scenes.
 */
async function generateDallEStill(prompt, referenceImageUrl = null, angleLabel = null, extras = {}) {
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const dallePrompt = prompt.length > 4000 ? prompt.slice(0, 3997) + '...' : prompt;
  console.log(`[SceneGen] DALL-E prompt (${dallePrompt.length} chars): ${dallePrompt.slice(0, 100)}...`);

  try {
    // When a reference image exists, use gpt-image-1 edits endpoint
    // to maintain visual consistency with the base image
    if (referenceImageUrl) {
      console.log(`[SceneGen] Using gpt-image-1 edit with base image reference`);
      const imageRes = await axios.get(referenceImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const imageBuffer = Buffer.from(imageRes.data);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('model', 'gpt-image-1');
      form.append('image', imageBuffer, { filename: 'base.png', contentType: 'image/png' });

      // Add cropped reference region as additional context if available
      if (extras.croppedRefUrl) {
        const croppedRefUrl = extras.croppedRefUrl;
        try {
          const cropRes = await axios.get(croppedRefUrl, { responseType: 'arraybuffer', timeout: 15000 });
          form.append('image', Buffer.from(cropRes.data), { filename: 'crop-ref.png', contentType: 'image/png' });
          console.log(`[SceneGen] Added cropped reference for ${angleLabel}`);
        } catch { /* non-blocking */ }
      }

      // Build blueprint-driven constraints for the edit instruction
      const { imageAnalysis, styleLock, regionHint, anchors } = extras;
      let detailConstraints = '';

      // Blueprint layout — tells the AI what's on each wall
      const layoutMap = imageAnalysis?.layout_map;
      if (layoutMap) {
        const walls = [];
        if (layoutMap.back_wall) walls.push(`Back wall: ${layoutMap.back_wall}`);
        if (layoutMap.left_wall) walls.push(`Left wall: ${layoutMap.left_wall}`);
        if (layoutMap.right_wall) walls.push(`Right wall: ${layoutMap.right_wall}`);
        if (layoutMap.center) walls.push(`Center: ${layoutMap.center}`);
        if (layoutMap.ceiling) walls.push(`Ceiling: ${layoutMap.ceiling}`);
        if (walls.length) detailConstraints += ` Room blueprint: ${walls.join('. ')}.`;
      }

      // Anchor objects — things that MUST appear and never change
      if (anchors?.length) {
        detailConstraints += ` Fixed objects that must appear: ${anchors.join('; ')}.`;
      }

      // Wall color and window view
      if (imageAnalysis?.wall_color) detailConstraints += ` Walls: ${imageAnalysis.wall_color}.`;
      if (imageAnalysis?.visible_through_windows) detailConstraints += ` Outside windows: ${imageAnalysis.visible_through_windows}.`;

      // Style lock
      if (styleLock) {
        const lockParts = [];
        if (styleLock.color_palette) lockParts.push(`Colors: ${styleLock.color_palette.join(', ')}.`);
        if (styleLock.lighting_type) lockParts.push(`Lighting: ${styleLock.lighting_type}.`);
        if (lockParts.length) detailConstraints += ` ${lockParts.join(' ')}`;
      }
      if (regionHint) detailConstraints += ` ${regionHint}`;
      const editInstruction = `Do not render any text, labels, or annotations on the image. This is a photograph of a built set. The room is FIXED — nothing moves, nothing changes. You are repositioning the camera inside this same room to get a different shot. Every wall color, piece of furniture, decor item, and lighting fixture stays identical.${detailConstraints} ${dallePrompt}`;
      form.append('prompt', editInstruction);
      form.append('n', '1');
      form.append('size', '1536x1024');
      form.append('quality', 'high');

      // Budget-gated and logged to ai_usage_logs (Task #2387).
      const response = await imageCost.runImageCall(
        { model: 'gpt-image-1', width: 1536, height: 1024, quality: 'high', count: 1 },
        () => axios.post(
          'https://api.openai.com/v1/images/edits',
          form,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              ...form.getHeaders(),
            },
            timeout: 180000,
          }
        ),
      );

      const b64 = response.data.data[0]?.b64_json;
      if (b64) {
        // Upload the base64 result to S3 and return URL
        const imgBuf = Buffer.from(b64, 'base64');
        const s3Key = `scenes/dalle-edit-${Date.now()}.png`;
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: imgBuf,
          ContentType: 'image/png',
        }));
        const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
        console.log(`[SceneGen] DALL-E edit success (b64→S3): ${url}`);
        return url;
      }

      // Fallback: if response has a URL instead of b64, download and re-upload to S3
      // OpenAI URLs expire after ~1 hour so we must persist to S3
      const tempUrl = response.data.data[0]?.url;
      if (tempUrl) {
        const s3Key = `scenes/dalle-edit-${Date.now()}.png`;
        const persistedUrl = await downloadAndUploadToS3(tempUrl, s3Key);
        console.log(`[SceneGen] DALL-E edit success (url→S3): ${persistedUrl}`);
        return persistedUrl;
      }

      console.warn('[SceneGen] DALL-E edit returned no image data');
      return null;
    }

    // No reference image — use unified image generation service (Flux or DALL-E)
    const { generateImageUrl } = require('./imageGenerationService');
    const url = await generateImageUrl(dallePrompt, { size: 'landscape', quality: 'hd', useCase: 'scene' });
    console.log(`[SceneGen] Image generated: ${url ? 'got URL' : 'no URL'}`);
    return url;
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.response?.data || err.message;
    console.error(`[SceneGen] Image generation error:`, detail);
    if (imageCost.isBudgetError(err)) throw err; // keep the 429 and its message
    throw new Error(`Image generation failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
}

/**
 * Download an image from URL, upload to S3, return the S3 URL.
 */
async function downloadAndUploadToS3(imageUrl, s3Key) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const buffer = Buffer.from(response.data);

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'image/png',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── BASE STILL MODEL CHOICE (Task #2396) ───────────────────────────────────

/**
 * The models a scene set can draw its base still with (scene_sets.base_model).
 * Keys are what the column stores; `model` is the provider id the rate table
 * (imageCostService.RATE_TABLE) prices.
 *
 * gpt-image-1.5 sizes (1024x1024, 1536x1024, 1024x1536, auto) and qualities
 * (low, medium, high) are UNCONFIRMED against OpenAI's own docs: taken from
 * search-result summaries of developers.openai.com on 2026-09-30, whose pages
 * the agent session could not fetch.
 */
const SCENE_BASE_MODELS = {
  'flux-dev': {
    key: 'flux-dev', label: 'Flux dev', provider: 'fal', model: 'fal-ai/flux/dev',
    fluxQuality: 'standard', falSize: 'landscape_16_9', width: 1024, height: 576, quality: null,
  },
  'flux-pro-1.1': {
    key: 'flux-pro-1.1', label: 'Flux pro 1.1', provider: 'fal', model: 'fal-ai/flux-pro/v1.1',
    fluxQuality: 'hd', falSize: 'landscape_16_9', width: 1024, height: 576, quality: null,
  },
  'gpt-image-1.5': {
    key: 'gpt-image-1.5', label: 'GPT Image 1.5 (high)', provider: 'openai', model: 'gpt-image-1.5',
    width: 1536, height: 1024, quality: 'high',
  },
};

// Today's behaviour (Flux dev from the prompt) when neither the set nor the
// environment names a model.
const BUILTIN_BASE_MODEL_DEFAULT = 'flux-dev';

function isBaseModelKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENE_BASE_MODELS, value);
}

/** The default base model: env SCENE_BASE_MODEL_DEFAULT when valid, else flux-dev. */
function defaultBaseModel() {
  const fromEnv = process.env.SCENE_BASE_MODEL_DEFAULT;
  if (fromEnv) {
    if (isBaseModelKey(fromEnv)) return fromEnv;
    console.warn(`[SceneGen] SCENE_BASE_MODEL_DEFAULT="${fromEnv}" is not one of ${Object.keys(SCENE_BASE_MODELS).join(', ')}; using ${BUILTIN_BASE_MODEL_DEFAULT}`);
  }
  return BUILTIN_BASE_MODEL_DEFAULT;
}

/** The model key a scene set's base still uses: its base_model, else the default. */
function resolveBaseModel(sceneSet) {
  const chosen = sceneSet && sceneSet.base_model;
  if (chosen) {
    if (isBaseModelKey(chosen)) return chosen;
    console.warn(`[SceneGen] scene set ${sceneSet.id} has unknown base_model "${chosen}"; using the default`);
  }
  return defaultBaseModel();
}

/** Rate-table estimate of one base still with the given model key. */
function estimateBaseStillCost(modelKey) {
  const cfg = SCENE_BASE_MODELS[modelKey];
  if (!cfg) throw new Error(`Unknown base model "${modelKey}"`);
  return imageCost.estimateImageCost({
    model: cfg.model, width: cfg.width, height: cfg.height, quality: cfg.quality, count: 1,
  });
}

/**
 * Collects what runImageCall logged for a generation's provider calls, so
 * the record it produced carries the logged cost (Task #2396).
 * value(): the summed logged cost; 0 when no billed call ran (a pure crop);
 * null when every call was unpriced (never a made-up number, never a silent 0).
 */
function createCostCollector(label) {
  const c = {
    usd: 0, calls: 0, unpricedCalls: 0, usageLogIds: [], inputTokensUnpriced: false, estimateUsd: 0,
  };
  c.onLogged = (info) => {
    c.calls += 1;
    if (info.usageLogId != null) c.usageLogIds.push(info.usageLogId);
    if (typeof info.costUsd === 'number') c.usd += info.costUsd;
    else c.unpricedCalls += 1;
    if (typeof info.estimateUsd === 'number') c.estimateUsd += info.estimateUsd;
    if (info.inputTokensUnpriced) c.inputTokensUnpriced = true;
  };
  c.value = () => {
    if (c.calls === 0) return 0;
    if (c.unpricedCalls === c.calls) {
      console.warn(`[SceneGen] ${label}: no priced cost for its ${c.calls} image call(s); generation_cost not increased`);
      return null;
    }
    if (c.unpricedCalls > 0) {
      console.warn(`[SceneGen] ${label}: ${c.unpricedCalls} of ${c.calls} image call(s) unpriced; recording the priced part only`);
    }
    return Math.round(c.usd * 1e6) / 1e6;
  };
  return c;
}

/**
 * gpt-image-1.5 still: /v1/images/generations from the prompt, or
 * /v1/images/edits with the reference image when one is given. 1536x1024,
 * quality high, n 1. Budget-gated and logged by runImageCall; the b64 result
 * is saved to S3 as generateDallEStill does. Returns the S3 URL.
 */
async function generateGptImageStill(prompt, { referenceImageUrl = null, sceneSetId = null, onLogged } = {}) {
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const cfg = SCENE_BASE_MODELS['gpt-image-1.5'];
  const size = `${cfg.width}x${cfg.height}`;
  const text = prompt.length > 4000 ? `${prompt.slice(0, 3997)}...` : prompt;
  const plan = {
    model: cfg.model, width: cfg.width, height: cfg.height, quality: cfg.quality, count: 1,
    inputImages: Boolean(referenceImageUrl), onLogged,
  };

  let response;
  if (referenceImageUrl) {
    console.log('[SceneGen] gpt-image-1.5 edit with style reference');
    const refRes = await axios.get(referenceImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const FormData = require('form-data');
    const form = new FormData();
    form.append('model', cfg.model);
    form.append('image', Buffer.from(refRes.data), { filename: 'reference.png', contentType: 'image/png' });
    form.append('prompt', `Use the reference image for style, palette and materials only. Do not render any text. ${text}`);
    form.append('n', '1');
    form.append('size', size);
    form.append('quality', cfg.quality);
    response = await imageCost.runImageCall(plan, () => axios.post(
      'https://api.openai.com/v1/images/edits',
      form,
      { headers: { 'Authorization': `Bearer ${apiKey}`, ...form.getHeaders() }, timeout: 180000 },
    ));
  } else {
    console.log('[SceneGen] gpt-image-1.5 text-to-image');
    response = await imageCost.runImageCall(plan, () => axios.post(
      'https://api.openai.com/v1/images/generations',
      { model: cfg.model, prompt: text, n: 1, size, quality: cfg.quality },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 180000 },
    ));
  }

  const item = response.data?.data?.[0];
  const prefix = sceneSetId ? `scenes/${sceneSetId}/base-gpt-image-1.5` : 'scenes/gpt-image-1.5';
  if (item?.b64_json) {
    const s3Key = `${prefix}-${Date.now()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: s3Key, Body: Buffer.from(item.b64_json, 'base64'), ContentType: 'image/png',
    }));
    return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  }
  if (item?.url) {
    return downloadAndUploadToS3(item.url, `${prefix}-${Date.now()}.png`);
  }
  throw new Error('gpt-image-1.5 returned no image data');
}

/**
 * Draw a scene set's base still with the given model key.
 * Returns { stillUrl, cost (logged USD | null), usageLogIds, inputTokensUnpriced }.
 */
async function generateBaseStill(sceneSet, prompt, modelKey) {
  const cfg = SCENE_BASE_MODELS[modelKey];
  if (!cfg) throw new Error(`Unknown base model "${modelKey}"`);
  const costs = createCostCollector(`base still ${sceneSet.id} (${modelKey})`);
  let stillUrl;
  if (cfg.provider === 'openai') {
    stillUrl = await generateGptImageStill(prompt, {
      referenceImageUrl: sceneSet.style_reference_url || null,
      sceneSetId: sceneSet.id,
      onLogged: costs.onLogged,
    });
  } else {
    // Flux from the prompt. styleReference is passed as before; the Flux
    // text-to-image path does not use it (startTextToImage reads only
    // referenceImage/referenceImages).
    const styleReference = sceneSet.style_reference_url
      ? { uri: sceneSet.style_reference_url, weight: 0.7 }
      : undefined;
    const { imageUrl } = await startTextToImage(prompt, {
      styleReference, quality: cfg.fluxQuality, onLogged: costs.onLogged,
    });
    stillUrl = await downloadAndStoreStill(imageUrl, sceneSet.id, 'base');
  }
  return {
    stillUrl,
    cost: costs.value(),
    usageLogIds: costs.usageLogIds,
    inputTokensUnpriced: costs.inputTokensUnpriced,
  };
}

/**
 * Poll a RunwayML task until SUCCEEDED or FAILED.
 * For multi-output tasks, returns all outputs.
 */
async function pollTask(jobId, maxWaitMs = 180000) {
  const pollInterval = 4000;
  const maxAttempts = Math.floor(maxWaitMs / pollInterval);
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    let task;
    try {
      const response = await axios.get(
        `${RUNWAY_API_BASE}/tasks/${jobId}`,
        { headers: runwayHeaders(), timeout: 15000 }
      );
      task = response.data;
      consecutiveErrors = 0; // Reset on success
    } catch (pollErr) {
      consecutiveErrors++;
      console.warn(`  [RunwayML] Poll error for ${jobId} (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${pollErr.message}`);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        return { status: 'FAILED', error: `Polling failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${pollErr.message}` };
      }
      continue; // Retry on next interval
    }

    if (task.status === 'SUCCEEDED') {
      const outputs = Array.isArray(task.output) ? task.output : [task.output];
      return {
        status: 'SUCCEEDED',
        outputUrl: outputs[0],
        outputs,
        seed: task.seed ?? null,
        creditsUsed: task.creditsUsed ?? 0,
      };
    }

    if (task.status === 'FAILED') {
      return {
        status: 'FAILED',
        error: task.failure || task.failureCode || 'Unknown failure',
      };
    }

    console.log(`  [RunwayML] Task ${jobId} status: ${task.status} (attempt ${attempt + 1}/${maxAttempts})`);
  }

  return { status: 'TIMEOUT', error: `Job ${jobId} did not complete within ${maxWaitMs}ms` };
}

// ─── MULTI-VARIATION PICKER ─────────────────────────────────────────────────

/**
 * Single-image helper used by callers that previously requested variations.
 */
async function generateBestVariation(prompt, numVariations, options = {}) {
  const { setId } = options;
  const requested = Number(numVariations) || 1;
  if (requested > 1) {
    console.log(`[SceneGen] Variation count (${requested}) requested; forcing single still generation.`);
  }

  const { imageUrl } = await startTextToImage(prompt);
  const storedUrl = await downloadAndStoreStill(imageUrl, setId || 'unknown', 'still');
  const best = {
    index: 0,
    url: storedUrl,
    qualityScore: null,
    flags: [],
  };

  return {
    best,
    variations: [best],
    seed: null,
    creditsUsed: 0.04,
  };
}

// ─── S3 STORAGE ───────────────────────────────────────────────────────────────

async function storeInS3(sourceUrl, setId, angleId, assetType) {
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
  });

  const contentType = response.headers['content-type'] || 'application/octet-stream';
  const ext = contentType.includes('image') ? 'jpg'
            : contentType.includes('mp4') ? 'mp4'
            : contentType.includes('video') ? 'mp4'
            : 'bin';

  const ts = Date.now();
  const s3Key = `scene-sets/${setId}/angles/${angleId || 'base'}/${assetType}-${ts}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}
// ─── S3 CLEANUP ───────────────────────────────────────────────────────────────

/**
 * Store a raw buffer in S3.
 */
async function storeBufferInS3(buffer, setId, angleId, assetType, contentType) {
  const ext = contentType.includes('image') ? 'jpg'
            : contentType.includes('mp4') ? 'mp4'
            : 'bin';

  const s3Key = `scene-sets/${setId}/angles/${angleId || 'base'}/${assetType}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Delete an old S3 object by its full URL (if present).
 * Extracts the S3 key from the URL and issues a DeleteObjectCommand.
 * Silently ignores errors — cleanup is best-effort.
 */
async function deleteOldS3Asset(url) {
  if (!url || !S3_BUCKET) return;
  try {
    const bucketHost = `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;
    const idx = url.indexOf(bucketHost);
    if (idx === -1) return;
    const key = decodeURIComponent(url.slice(idx + bucketHost.length));
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`[SceneGen] Cleaned up old S3 asset: ${key}`);
  } catch (err) {
    console.warn(`[SceneGen] S3 cleanup failed (non-blocking): ${err.message}`);
  }
}
// ─── HIGH-LEVEL: GENERATE BASE SCENE ─────────────────────────────────────────

/**
 * The database handle for the Scene Brief's reads. Some callers pass only
 * { SceneSet, SceneAngle } (the generation worker, the refinement queue, the
 * angle regenerate route); a Sequelize model carries its connection, so the
 * brief still reads the set's World Location and chosen event.
 */
function briefDb(models) {
  return models?.sequelize || models?.SceneSet?.sequelize || models?.SceneAngle?.sequelize || null;
}

/**
 * Generate a scene set's base still with the set's model choice
 * (scene_sets.base_model, else the default — resolveBaseModel; Task #2396).
 *
 * options.skipAnalysis: skip the Claude Vision analysis and style auto-lock
 * that normally follow (the base-model comparison generates stills only).
 * options.eventId: the event chosen explicitly for this image (S1, S3);
 *   null for none. Not given: the event of the base's last brief (chosen
 *   explicitly then), never an event found by matching.
 * options.overrides: { <brief line key>: text } (S2's "Your override");
 *   without it, the overrides of the base's last brief.
 *
 * The prompt is the set's Scene Brief (S1); the brief is kept on
 * base_generation.brief.
 */
async function generateBaseScene(sceneSet, models, options = {}) {
  const { SceneSet } = models;

  const brief = await prepareSceneBrief(briefDb(models), sceneSet, {
    // Without overrides given, the base keeps the ones it was last generated
    // with (S2: the brief shown before generating shows them).
    angleLabel: 'WIDE',
    eventId: options.eventId !== undefined ? options.eventId : (sceneSet.base_generation?.brief?.event_id || null),
    overrides: options.overrides || sceneSet.base_generation?.brief?.overrides || {},
  });
  const prompt = briefToPrompt(brief);

  await SceneSet.update(
    { generation_status: 'generating', base_runway_prompt: prompt },
    { where: { id: sceneSet.id } }
  );

  try {
    const modelKey = resolveBaseModel(sceneSet);
    const cfg = SCENE_BASE_MODELS[modelKey];
    const estimate = estimateBaseStillCost(modelKey);
    console.log(`[SceneGen] Starting base still for: ${sceneSet.name} (${modelKey}, ${cfg.width}x${cfg.height})`);

    const { stillUrl, cost, usageLogIds, inputTokensUnpriced } = await generateBaseStill(sceneSet, prompt, modelKey);
    const lockedSeed = null;

    // Clean up old base still from S3 (best-effort)
    if (sceneSet.base_still_url) {
      await deleteOldS3Asset(sceneSet.base_still_url);
    }

    console.log(`[SceneGen] Still complete (${modelKey}); cost ${cost == null ? 'unpriced' : `$${cost}`}`);

    // generation_cost: the logged cost (the rate-table estimate plus any
    // priced input image tokens). An unpriced call adds nothing, with a
    // warning from the collector — never a made-up figure.
    const previousCost = parseFloat(sceneSet.generation_cost || 0) || 0;
    const baseGeneration = {
      ...(sceneSet.base_generation || {}),
      model_key: modelKey,
      model: cfg.model,
      provider: cfg.provider,
      width: cfg.width,
      height: cfg.height,
      quality: cfg.quality,
      estimate_usd: estimate.usd,
      cost_usd: cost,
      usage_log_ids: usageLogIds,
      input_tokens_unpriced: inputTokensUnpriced,
      generated_at: new Date().toISOString(),
      brief,
    };
    await SceneSet.update({
      base_runway_seed: lockedSeed,
      base_still_url: stillUrl,
      generation_status: 'complete',
      generation_cost: typeof cost === 'number' ? Math.round((previousCost + cost) * 1e4) / 1e4 : previousCost,
      base_generation: baseGeneration,
    }, { where: { id: sceneSet.id } });

    // ── Feature 4: Auto-lock style DNA from the new base image ──
    // Analyze the generated base image with Claude Vision and cache the
    // visual inventory + style lock so all future angles have concrete
    // details to preserve. Runs in background (non-blocking).
    if (process.env.ANTHROPIC_API_KEY && !options.skipAnalysis) {
      const updatedSet = { ...sceneSet, base_still_url: stillUrl };
      analyzeBaseImage(updatedSet, SceneSet).catch(err =>
        console.warn(`[SceneGen] Auto image analysis failed (non-blocking): ${err.message}`)
      );
      // Also auto-lock style if not already locked
      const vl = sceneSet.visual_language || {};
      if (!vl.locked) {
        try {
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'url', url: stillUrl } },
                { type: 'text', text: `Extract the visual style DNA of this room. Return JSON:
{
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "materials": ["material1", "material2", "material3"],
  "lighting_type": "warm golden / cool daylight / dramatic / soft ambient",
  "design_style": "modern minimalist / bohemian / etc.",
  "key_textures": ["texture1", "texture2", "texture3"]
}
Return ONLY JSON.` },
              ],
            }],
          });
          const text = response.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const styleData = JSON.parse(match[0]);
            await SceneSet.update(
              { visual_language: { ...vl, ...styleData, locked: true } },
              { where: { id: sceneSet.id } }
            );
            console.log(`[SceneGen] Auto-locked style DNA: ${styleData.design_style}`);
          }
        } catch (styleErr) {
          console.warn(`[SceneGen] Auto style lock failed (non-blocking): ${styleErr.message}`);
        }
      }
    }

    return { success: true, stillUrl, videoUrl: null, seed: lockedSeed, model: modelKey, cost };
  } catch (err) {
    await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
    throw err;
  }
}

// ─── HIGH-LEVEL: GENERATE ANGLE ───────────────────────────────────────────────

/**
 * Generate video for a specific Scene Angle using image-anchored approach.
 * Uses the parent set's base_still_url as promptImage for image_to_video,
 * ensuring visual consistency across all angles (same room).
 */
async function extractFirstFrame(videoUrl, setId, angleId) {
  const tmpVideo = path.join(os.tmpdir(), `scene-${angleId}.mp4`);
  const tmpFrame = path.join(os.tmpdir(), `scene-${angleId}-frame.jpg`);

  try {
    // Download video to temp file
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(tmpVideo, Buffer.from(response.data));

    // Extract LAST frame from video (frame 1 = input image; end frame = moved camera)
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-y', '-sseof', '-0.5', '-i', tmpVideo,
        '-vframes', '1', '-q:v', '2',
        tmpFrame,
      ], { timeout: 30000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // Upload frame to S3 with timestamp key for cache-busting
    const frameBuffer = fs.readFileSync(tmpFrame);
    const ts = Date.now();
    const s3Key = `scene-sets/${setId}/angles/${angleId}/still-${ts}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: frameBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=31536000',
    }));

    return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(tmpVideo); } catch (err) { console.warn('[SceneGen] cleanup tmpVideo:', err?.message); }
    try { fs.unlinkSync(tmpFrame); } catch (err) { console.warn('[SceneGen] cleanup tmpFrame:', err?.message); }
  }
}

// ─── CLAUDE VISION HELPERS ───────────────────────────────────────────────────

/**
 * Analyze a base image with Claude Vision to extract concrete visual details.
 * Returns a structured description of exactly what's in the image — colors,
 * furniture, decor, textures — so angle prompts can reference specifics.
 * Results are cached in visual_language.image_analysis.
 */
async function analyzeBaseImage(sceneSet, SceneSetModel) {
  if (!process.env.ANTHROPIC_API_KEY || !sceneSet.base_still_url) return null;

  const IMAGE_ANALYSIS_VERSION = 7; // bump to invalidate cache when schema changes
  // Check cache — skip if already analyzed for this base image with current version
  const vl = sceneSet.visual_language || {};
  if (vl.image_analysis?.source_url === sceneSet.base_still_url && vl.image_analysis?.version === IMAGE_ANALYSIS_VERSION) {
    console.log(`[SceneGen] Using cached image analysis for ${sceneSet.name}`);
    return vl.image_analysis;
  }

  try {
    console.log(`[SceneGen] Analyzing base image with Claude Vision for ${sceneSet.name}`);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: sceneSet.base_still_url } },
          { type: 'text', text: `You are a virtual production designer creating a SCENE BLUEPRINT for this room. This blueprint will be used to generate consistent camera angles — the room is a fixed set, only the camera moves.

Return JSON:
{
  "image_type": "room_photo | mood_board | collage | illustration | other",

  "layout_map": {
    "back_wall": "what is against the back wall (12 o'clock from camera)",
    "left_wall": "what is on the left wall (9 o'clock)",
    "right_wall": "what is on the right wall (3 o'clock)",
    "front_wall": "what is behind the camera / entrance area (6 o'clock)",
    "center": "what is in the center of the room",
    "ceiling": "what is on/hanging from the ceiling"
  },

  "anchor_objects": [
    {"name": "object name", "position": "which wall/area", "description": "exact appearance — color, material, size", "must_appear_in": ["which angles would see this object"]}
  ],

  "camera_regions": {
    "center_crop": "what you'd see zooming into the center 60%",
    "left_crop": "what you'd see looking at the left 40%",
    "right_crop": "what you'd see looking at the right 40%",
    "top_crop": "what you'd see looking at the upper 40%"
  },

  "wall_color": "exact wall color",
  "flooring": "exact floor type and color",
  "color_palette_hex": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "visible_through_windows": "what is visible outside",
  "atmosphere": "one sentence — mood, lighting quality, time of day",

  "description": "Write a rich 2-3 sentence description of this room as if describing a film set. Include: room size, wall colors, key furniture with materials/colors and positions, lighting sources, signature decor, window views, flooring, and overall mood. Be specific enough that someone could recreate this exact room from your description alone.",

  "room_properties": {
    "room_size": "compact | medium | spacious | grand",
    "ceiling_height": "standard | tall | vaulted | double_height",
    "room_shape": "rectangular | square | l_shaped | open_plan"
  }
}

CRITICAL: The layout_map and anchor_objects are the foundation. Be extremely specific about what is on each wall and which objects are signature (must never change between angles).
Return ONLY JSON.` },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[SceneGen] Image analysis returned no JSON. Response: ${text.slice(0, 200)}`);
      return null;
    }

    let analysis;
    try {
      analysis = JSON.parse(match[0]);
    } catch (parseErr) {
      console.warn(`[SceneGen] Image analysis JSON parse failed: ${parseErr.message}. Raw: ${match[0].slice(0, 200)}`);
      return null;
    }
    analysis.source_url = sceneSet.base_still_url;
    analysis.version = IMAGE_ANALYSIS_VERSION;
    analysis.analyzed_at = new Date().toISOString();

    // Cache blueprint in visual_language + auto-fill description if empty
    const updatedVl = { ...vl, image_analysis: analysis };
    if (analysis.layout_map) updatedVl.layout_map = analysis.layout_map;
    if (analysis.anchor_objects) updatedVl.anchor_objects = analysis.anchor_objects;
    if (analysis.camera_regions) updatedVl.camera_regions = analysis.camera_regions;
    if (analysis.room_properties && !vl.room_properties_manual) {
      updatedVl.room_properties = analysis.room_properties;
    }

    // Auto-fill description from image analysis if the set has no description yet
    const updateFields = { visual_language: updatedVl };
    if (analysis.description && !sceneSet.canonical_description) {
      updateFields.canonical_description = analysis.description;
      // Also regenerate the prompt from the new description
      const tempSet = { ...sceneSet, canonical_description: analysis.description, visual_language: updatedVl };
      updateFields.base_runway_prompt = buildPrompt(tempSet);
      console.log(`[SceneGen] Auto-filled description from image analysis`);
    }

    await SceneSetModel.update(
      updateFields,
      { where: { id: sceneSet.id } }
    );

    console.log(`[SceneGen] Image analysis complete: ${analysis.furniture?.length || 0} furniture, ${analysis.room_properties?.room_size || 'unknown'} room`);
    return analysis;
  } catch (err) {
    console.warn(`[SceneGen] Image analysis failed (non-blocking): ${err.message}`);
    return null;
  }
}

/**
 * Compare a generated angle image against the base image using Claude Vision.
 * Returns a consistency score (0-100) and list of discrepancies.
 * Used to auto-retry if the generated angle drifted too far from the base.
 */
async function checkAngleConsistency(baseImageUrl, angleImageUrl, angleName) {
  if (!process.env.ANTHROPIC_API_KEY) return { score: 100, issues: [], pass: true };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: baseImageUrl } },
          { type: 'image', source: { type: 'url', url: angleImageUrl } },
          { type: 'text', text: `These two images should be the SAME room photographed from different camera angles. Compare them and check if the second image preserved the room's identity.

Return JSON:
{
  "score": <0-100, where 100 = identical room, 0 = completely different>,
  "wall_color_match": <true/false>,
  "furniture_match": <true/false>,
  "layout_match": <true/false — are furniture positions consistent with being the same room?>,
  "decor_match": <true/false>,
  "window_view_match": <true/false — if windows visible, does the outside view match?>,
  "issues": ["specific discrepancy 1", "specific discrepancy 2"]
}
Score guide: 90+ = excellent (same room clearly), 70-89 = acceptable (minor drifts), below 70 = fail (different room). Pay special attention to whether furniture is in the CORRECT position — items should not teleport between walls. Return ONLY JSON.` },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { score: 100, issues: [], pass: true };

    const result = JSON.parse(match[0]);
    result.pass = (result.score || 0) >= 70;
    console.log(`[SceneGen] Consistency check for "${angleName}": score=${result.score}, pass=${result.pass}, issues=${result.issues?.length || 0}`);
    return result;
  } catch (err) {
    console.warn(`[SceneGen] Consistency check failed (non-blocking): ${err.message}`);
    return { score: 100, issues: [], pass: true };
  }
}

function buildIdentityLockPrompt(basePrompt, angleLabel, consistencyIssues = []) {
  const issueText = (consistencyIssues || []).slice(0, 4).join('; ');
  const lockText = [
    `CRITICAL CONTINUITY: This MUST be the exact same room as the reference image for angle ${angleLabel}.`,
    'Keep architecture, furniture identity, object positions, color palette, materials, and decor unchanged.',
    'Only change camera viewpoint/composition. Do not redesign, replace, remove, or add major objects.',
    issueText ? `Fix these continuity issues from the previous attempt: ${issueText}.` : '',
  ].filter(Boolean).join(' ');

  return `${lockText}\n\n${basePrompt}`;
}


// ─── MOOD VARIATION SYSTEM ───────────────────────────────────────────────────

/**
 * Mood presets — each defines color grading parameters for Sharp.
 * Applied to the base image (or any angle) to create lighting/atmosphere variants
 * WITHOUT regenerating the room. The furniture, layout, and decor stay pixel-perfect.
 */
const MOOD_PRESETS = {
  morning: {
    label: 'Morning',
    description: 'Soft golden morning light streaming through windows',
    tint: { r: 255, g: 230, b: 200 },  // warm golden
    brightness: 1.15,
    saturation: 1.05,
    contrast: 0.95,
  },
  golden_hour: {
    label: 'Golden Hour',
    description: 'Rich amber golden-hour warmth with long shadows',
    tint: { r: 255, g: 200, b: 140 },  // deep amber
    brightness: 1.05,
    saturation: 1.2,
    contrast: 1.1,
  },
  night: {
    label: 'Night',
    description: 'Moody nighttime with neon and fairy light glow',
    tint: { r: 180, g: 170, b: 255 },  // cool purple/blue
    brightness: 0.7,
    saturation: 1.15,
    contrast: 1.2,
  },
  glam: {
    label: 'Glam Mode',
    description: 'Vanity lights bright, warm beauty lighting',
    tint: { r: 255, g: 240, b: 230 },  // soft warm white
    brightness: 1.2,
    saturation: 0.95,
    contrast: 0.9,
  },
  filming: {
    label: 'Filming Mode',
    description: 'Ring light active, even studio-like illumination',
    tint: { r: 245, g: 245, b: 255 },  // neutral cool white
    brightness: 1.25,
    saturation: 0.9,
    contrast: 1.05,
  },
  cozy: {
    label: 'Cozy Evening',
    description: 'Warm table lamps and fairy lights, intimate glow',
    tint: { r: 255, g: 210, b: 170 },  // warm amber
    brightness: 0.85,
    saturation: 1.1,
    contrast: 1.05,
  },
  dramatic: {
    label: 'Dramatic',
    description: 'High contrast with deep shadows and bright highlights',
    tint: { r: 220, g: 200, b: 255 },  // slight purple
    brightness: 0.9,
    saturation: 1.3,
    contrast: 1.4,
  },
};

/**
 * Apply a mood preset to an image using Sharp color grading.
 * Returns the S3 URL of the mood-variant image.
 * The original image is NOT modified — a new file is created.
 */
async function applyMoodVariant(sourceImageUrl, mood, setId, angleId = 'base') {
  const preset = MOOD_PRESETS[mood];
  if (!preset || !sourceImageUrl) return null;

  try {
    console.log(`[SceneGen] Applying mood "${mood}" to ${angleId}`);
    const imageRes = await axios.get(sourceImageUrl, { responseType: 'arraybuffer', timeout: 30000 });

    // Apply color grading with Sharp
    let pipeline = sharp(imageRes.data);

    // Brightness and contrast
    pipeline = pipeline.modulate({
      brightness: preset.brightness,
      saturation: preset.saturation,
    });

    // Color tint via tint overlay
    const metadata = await sharp(imageRes.data).metadata();
    const w = metadata.width || 1920;
    const h = metadata.height || 1080;

    // Create a tint overlay
    const tintOverlay = await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: preset.tint.r, g: preset.tint.g, b: preset.tint.b, alpha: 0.15 },
      },
    }).png().toBuffer();

    // Composite tint over the graded image
    const gradedBuffer = await pipeline
      .composite([{ input: tintOverlay, blend: 'over' }])
      .png()
      .toBuffer();

    // Upload to S3
    const s3Key = `scene-sets/${setId}/moods/${angleId}-${mood}-${Date.now()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: gradedBuffer,
      ContentType: 'image/png',
      CacheControl: 'max-age=31536000',
    }));

    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`[SceneGen] Mood variant "${mood}" created: ${url}`);
    return url;
  } catch (err) {
    console.warn(`[SceneGen] Mood variant failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate all mood variants for a given image (base or angle).
 * Returns an object mapping mood names to S3 URLs.
 */
async function generateMoodVariants(sourceImageUrl, setId, angleId = 'base', moods = null) {
  const moodList = moods || Object.keys(MOOD_PRESETS);
  const results = {};

  for (const mood of moodList) {
    const url = await applyMoodVariant(sourceImageUrl, mood, setId, angleId);
    if (url) results[mood] = url;
  }

  return results;
}

// ─── REFERENCE REGION CROPPING ───────────────────────────────────────────────

/**
 * Maps angle labels to which region of the base image to crop as an
 * additional reference. Returns { left, top, width, height } as fractions (0-1).
 * For example, VANITY maps to the right 40% of the image.
 */
const ANGLE_CROP_REGIONS = {
  BED:      { left: 0.2, top: 0.1, width: 0.6, height: 0.8 },   // center
  VANITY:   { left: 0.6, top: 0.1, width: 0.4, height: 0.8 },   // right side
  WINDOW:   { left: 0.0, top: 0.0, width: 0.4, height: 1.0 },   // left side
  CLOSET:   { left: 0.0, top: 0.0, width: 0.35, height: 1.0 },  // far left
  STAGE:    { left: 0.0, top: 0.2, width: 0.4, height: 0.8 },   // left mid
  CLOSE:    { left: 0.3, top: 0.2, width: 0.4, height: 0.6 },   // center detail
  OVERHEAD: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 },   // full center
  DOORWAY:  { left: 0.1, top: 0.0, width: 0.8, height: 1.0 },   // wide center
  ACTION:   { left: 0.0, top: 0.1, width: 0.5, height: 0.8 },   // left half
};

/**
 * Crop a region from the base image to use as additional context for angle generation.
 * Downloads the base image, crops the relevant region, uploads to S3.
 * Returns the S3 URL of the cropped reference, or null if not applicable.
 */
async function cropReferenceRegion(baseImageUrl, angleLabel, setId) {
  const region = ANGLE_CROP_REGIONS[angleLabel];
  if (!region || !baseImageUrl) return null;

  try {
    const imageRes = await axios.get(baseImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const metadata = await sharp(imageRes.data).metadata();
    const w = metadata.width || 1920;
    const h = metadata.height || 1080;

    const cropLeft = Math.round(w * region.left);
    const cropTop = Math.round(h * region.top);
    const cropWidth = Math.min(Math.round(w * region.width), w - cropLeft);
    const cropHeight = Math.min(Math.round(h * region.height), h - cropTop);

    const croppedBuffer = await sharp(imageRes.data)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .resize(768, 512, { fit: 'inside' })
      .png()
      .toBuffer();

    const s3Key = `scene-sets/${setId}/ref-crops/${angleLabel.toLowerCase()}-${Date.now()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: s3Key, Body: croppedBuffer,
      ContentType: 'image/png', CacheControl: 'max-age=3600',
    }));

    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`[SceneGen] Cropped ${angleLabel} reference region: ${cropWidth}x${cropHeight} → ${url}`);
    return url;
  } catch (err) {
    console.warn(`[SceneGen] Reference crop failed (non-blocking): ${err.message}`);
    return null;
  }
}

/**
 * Returns a text hint about which part of the base image corresponds to this angle.
 */
function getReferenceRegionHint(angleLabel) {
  const hints = {
    BED:      'The bed area is in the CENTER of the base image.',
    VANITY:   'The vanity/mirror area is on the RIGHT side of the base image.',
    WINDOW:   'The window is on the LEFT side of the base image.',
    CLOSET:   'The closet area would be on the FAR LEFT or behind the camera in the base image.',
    STAGE:    'The music/performance corner is on the LEFT side of the base image.',
    CLOSE:    'Zoom into the CENTER of the base image for surface details.',
    OVERHEAD: 'Imagine looking straight DOWN at the center of the base image.',
    DOORWAY:  'The door is BEHIND the camera position in the base image — turn around.',
    ACTION:   'The action area spans the LEFT HALF of the base image.',
  };
  return hints[angleLabel] || '';
}

// ─── DEPTH MAP GENERATION ────────────────────────────────────────────────────

/**
 * Generate a depth map from the base image using Sharp edge detection.
 * This gives angle generation spatial context about foreground vs background.
 * Returns the S3 URL of the depth map, cached on the scene set.
 */
async function generateDepthMap(sceneSet, SceneSetModel) {
  if (!sceneSet.base_still_url) return null;

  // Check cache
  const vl = sceneSet.visual_language || {};
  if (vl.depth_map_url) return vl.depth_map_url;

  try {
    console.log(`[SceneGen] Generating depth map for ${sceneSet.name}`);
    const imageRes = await axios.get(sceneSet.base_still_url, { responseType: 'arraybuffer', timeout: 30000 });

    // Create a pseudo-depth map using luminance + blur gradient
    // This approximates depth: brighter areas appear closer, darker areas farther
    const depthBuffer = await sharp(imageRes.data)
      .grayscale()
      .blur(3)
      .normalize()
      .resize(768, 432, { fit: 'inside' })
      .png()
      .toBuffer();

    const s3Key = `scene-sets/${sceneSet.id}/depth-map-${Date.now()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: s3Key, Body: depthBuffer,
      ContentType: 'image/png', CacheControl: 'max-age=86400',
    }));

    const depthUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    // Cache on scene set
    await SceneSetModel.update(
      { visual_language: { ...vl, depth_map_url: depthUrl } },
      { where: { id: sceneSet.id } }
    );

    console.log(`[SceneGen] Depth map generated: ${depthUrl}`);
    return depthUrl;
  } catch (err) {
    console.warn(`[SceneGen] Depth map failed (non-blocking): ${err.message}`);
    return null;
  }
}

// ─── CROP + OUTPAINT CAMERA SYSTEM ───────────────────────────────────────────

/**
 * Camera directions for crop-based angles.
 * Each defines: which part of the base to keep, and which direction to extend.
 * Coordinates are fractions (0-1) of the base image dimensions.
 */
// Model for crop+outpaint angles (images/edits, 1536x1024, quality high).
const OUTPAINT_MODEL = 'gpt-image-1.5';

const CAMERA_CROP_MAP = {
  // Close-ups: crop a region, extend slightly
  VANITY_CLOSEUP:     { crop: { left: 0.55, top: 0.1, width: 0.45, height: 0.9 }, extend: 'right', extendAmount: 0.5 },
  VANITY:             { crop: { left: 0.55, top: 0.1, width: 0.45, height: 0.9 }, extend: 'right', extendAmount: 0.5 },
  WINDOW_CITYVIEW:    { crop: { left: 0.0, top: 0.0, width: 0.45, height: 1.0 }, extend: 'left', extendAmount: 0.5 },
  WINDOW:             { crop: { left: 0.0, top: 0.0, width: 0.45, height: 1.0 }, extend: 'left', extendAmount: 0.5 },
  NEON_HEADBOARD:     { crop: { left: 0.2, top: 0.0, width: 0.6, height: 0.7 }, extend: 'up', extendAmount: 0.3 },
  BED:                { crop: { left: 0.2, top: 0.1, width: 0.6, height: 0.9 }, extend: 'none', extendAmount: 0 },
  OVERHEAD_BED:       null, // Can't crop — needs full regeneration
  CHANDELIER_WORMS_EYE: null, // Can't crop — different perspective
  DOORWAY_ESTABLISHING: null, // Can't crop — behind camera
  TRIPOD_CONTENT_CREATOR: null, // Can't crop — different position
  BALCONY_GOLDEN_HOUR: { crop: { left: 0.0, top: 0.0, width: 0.5, height: 1.0 }, extend: 'left', extendAmount: 0.6 },
  DETAIL:             { crop: { left: 0.3, top: 0.3, width: 0.4, height: 0.4 }, extend: 'none', extendAmount: 0 },
  CLOSE:              { crop: { left: 0.3, top: 0.3, width: 0.4, height: 0.4 }, extend: 'none', extendAmount: 0 },
  WIDE:               null, // Base image IS the wide shot
};

/**
 * Generate an angle by cropping the base image and optionally outpainting.
 * Returns the S3 URL of the result, or null if this angle can't be cropped.
 *
 * For crop-only angles (BED, DETAIL): crops + upscales. Pixel-perfect.
 * For crop+extend angles (VANITY, WINDOW): crops, extends canvas, uses
 * gpt-image-1.5 (OUTPAINT_MODEL) to fill the new area while keeping original pixels.
 */
async function cropAndOutpaint(baseImageUrl, angleLabel, setId, angleId, prompt, { onLogged } = {}) {
  const config = CAMERA_CROP_MAP[angleLabel];
  if (!config || !baseImageUrl) return null;

  try {
    console.log(`[SceneGen] Crop+outpaint for ${angleLabel}: crop=${JSON.stringify(config.crop)}, extend=${config.extend}`);

    // Download base image
    const imageRes = await axios.get(baseImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const metadata = await sharp(imageRes.data).metadata();
    const w = metadata.width || 1920;
    const h = metadata.height || 1080;

    // Calculate crop region
    const cropLeft = Math.round(w * config.crop.left);
    const cropTop = Math.round(h * config.crop.top);
    const cropWidth = Math.min(Math.round(w * config.crop.width), w - cropLeft);
    const cropHeight = Math.min(Math.round(h * config.crop.height), h - cropTop);

    // Crop the region
    const croppedBuffer = await sharp(imageRes.data)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .toBuffer();

    if (config.extend === 'none' || config.extendAmount === 0) {
      // Pure crop — just upscale to target resolution
      const resultBuffer = await sharp(croppedBuffer)
        .resize(1536, 1024, { fit: 'cover' })
        .png()
        .toBuffer();

      const s3Key = `scene-sets/${setId}/angles/${angleId}/crop-${Date.now()}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: resultBuffer,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
      console.log(`[SceneGen] Pure crop complete for ${angleLabel}: ${url}`);
      return url;
    }

    // Crop + outpaint: extend the canvas and use OUTPAINT_MODEL to fill
    // Target: 1536x1024 final image
    const targetW = 1536;
    const targetH = 1024;

    // Scale cropped region to fit within the target, leaving room for extension
    const scaleFactor = config.extend === 'right' || config.extend === 'left'
      ? targetH / cropHeight
      : targetW / cropWidth;
    const scaledW = Math.round(cropWidth * scaleFactor);
    const scaledH = Math.round(cropHeight * scaleFactor);

    const scaledCrop = await sharp(croppedBuffer)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .png()
      .toBuffer();

    // Create the extended canvas with the crop positioned on one side
    let compositeLeft = 0;
    let compositeTop = 0;
    if (config.extend === 'right') compositeLeft = 0;
    if (config.extend === 'left') compositeLeft = targetW - scaledW;
    if (config.extend === 'up') compositeTop = targetH - scaledH;

    const canvas = await sharp({
      create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: scaledCrop, left: compositeLeft, top: compositeTop }])
      .png()
      .toBuffer();

    // Send to OUTPAINT_MODEL edits with the canvas as the image
    // The transparent area is where the AI will generate new content
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[SceneGen] No OPENAI_API_KEY — returning crop without outpaint');
      // Fall back to just the crop
      const s3Key = `scene-sets/${setId}/angles/${angleId}/crop-${Date.now()}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: canvas,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    const FormData = require('form-data');
    const form = new FormData();
    // gpt-image-1.5 since Task #2396 (Evoni, 2026-09-30); was gpt-image-1.
    form.append('model', OUTPAINT_MODEL);
    form.append('image', canvas, { filename: 'canvas.png', contentType: 'image/png' });
    form.append('prompt', `Do not render any text or labels. Continue this room seamlessly — match the existing wall color, flooring, lighting, and style exactly. Fill the transparent area with a natural continuation of this room. ${prompt || ''}`);
    form.append('size', '1536x1024');
    form.append('quality', 'high');

    // Budget-gated and logged to ai_usage_logs (Task #2387).
    const response = await imageCost.runImageCall(
      { model: OUTPAINT_MODEL, width: 1536, height: 1024, quality: 'high', count: 1, inputImages: true, onLogged },
      () => axios.post(
        'https://api.openai.com/v1/images/edits',
        form,
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, ...form.getHeaders() },
          timeout: 180000,
        }
      ),
    );

    // Get the result and upload to S3
    const b64 = response.data.data[0]?.b64_json;
    let resultUrl;
    if (b64) {
      const imgBuf = Buffer.from(b64, 'base64');
      const s3Key = `scene-sets/${setId}/angles/${angleId}/outpaint-${Date.now()}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: imgBuf,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      resultUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    } else {
      const tempUrl = response.data.data[0]?.url;
      if (tempUrl) {
        const s3Key = `scene-sets/${setId}/angles/${angleId}/outpaint-${Date.now()}.png`;
        resultUrl = await downloadAndUploadToS3(tempUrl, s3Key);
      }
    }

    console.log(`[SceneGen] Crop+outpaint complete for ${angleLabel}: ${resultUrl}`);
    return resultUrl;
  } catch (err) {
    console.warn(`[SceneGen] Crop+outpaint failed for ${angleLabel}: ${err.message}`);
    if (imageCost.isBudgetError(err)) throw err; // a refusal is not a fallback case
    return null;
  }
}

// ─── ANGLE GENERATION ────────────────────────────────────────────────────────

/**
 * The Scene Brief options for an angle (S1): the shot's camera and required
 * visible features (the SceneSpec camera contracts, else the anchor
 * objects), continuity with the base, and the event and overrides chosen for
 * the set's base. generateAngle and the brief shown before generating (S2,
 * POST /scene-sets/:id/brief) both use it, so what is shown is what is sent.
 * options.overrides replaces the base's overrides when given (S2's "Your
 * override"). options.imageAnalysis: the base's analysis when generating;
 * the preview reads only what the set already stores.
 */
function angleBriefOptions(sceneAngle, sceneSet, { imageAnalysis = null, overrides = null } = {}) {
  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const vl = sceneSet.visual_language || {};
  const anchorObjects = vl.anchor_objects || imageAnalysis?.anchor_objects || [];

  // ── The shot's required visible features: the SceneSpec camera
  // contracts (preferred), else the anchor objects ──
  const spec = sceneSet.scene_spec;
  let specConstraints = '';
  if (spec?.camera_contracts && spec?.objects) {
    specConstraints = sceneSpecService.buildAngleConstraints(spec, angleLabel);
  }

  // Build legacy anchors (used both as the fallback and as DALL-E hint)
  const relevantAnchors = anchorObjects
    .filter(a => !a.must_appear_in || a.must_appear_in.length === 0 || a.must_appear_in.some(label => angleLabel.includes(label)))
    .map(a => `${a.name} (${a.position}): ${a.description}`)
    .slice(0, 5);

  // The angle's Scene Brief (S1): the place, the event chosen for the set's
  // base (if any), this shot, and the environment. Lighting comes from the
  // brief; no state ambient or generic text is added.
  const baseBrief = sceneSet.base_generation?.brief || null;
  return {
    options: {
      angleLabel,
      cameraDirection: sceneAngle.camera_direction || null,
      requiredFeatures: specConstraints || (relevantAnchors.length ? `These must appear: ${relevantAnchors.join('; ')}` : null),
      continuity: Boolean(sceneSet.base_still_url),
      eventId: baseBrief?.event_id || null,
      overrides: overrides && typeof overrides === 'object' ? overrides : (baseBrief?.overrides || {}),
    },
    relevantAnchors,
    specConstraints,
  };
}

async function generateAngle(sceneAngle, sceneSet, models, options = {}) {
  const { SceneAngle, SceneSet } = models;

  const angleLabel = sceneAngle.angle_label || 'WIDE';

  // Analyze base image to get blueprint (cached)
  let imageAnalysis = null;
  if (sceneSet.base_still_url) {
    try {
      imageAnalysis = await analyzeBaseImage(sceneSet, SceneSet);
    } catch (err) {
      console.warn(`[SceneGen] Image analysis failed (non-blocking): ${err.message}`);
    }

    // Auto-build SceneSpec if not present
    if (!sceneSet.scene_spec && imageAnalysis) {
      try {
        const spec = await sceneSpecService.buildSceneSpec(sceneSet, SceneSet);
        if (spec) sceneSet.scene_spec = spec;
      } catch (specErr) {
        console.warn(`[SceneGen] SceneSpec build failed (non-blocking): ${specErr.message}`);
      }
    }
  }

  const { options: briefOptions, relevantAnchors, specConstraints } = angleBriefOptions(sceneAngle, sceneSet, {
    imageAnalysis, overrides: options.overrides,
  });
  const brief = await prepareSceneBrief(briefDb(models), sceneSet, briefOptions);
  const prompt = briefToPrompt(brief);
  if (specConstraints) console.log(`[SceneGen] Using SceneSpec camera contracts for ${angleLabel}`);

  // Keep base-image conditioning on by default. Only disable it for known
  // non-spatial composites where continuity checks are meaningless.
  const imageType = String(imageAnalysis?.image_type || '').toLowerCase();
  const disableReferenceTypes = new Set(['moodboard', 'mood_board', 'collage', 'style_board']);
  const shouldDisableReference = disableReferenceTypes.has(imageType);
  const referenceImageForEdit = shouldDisableReference ? null : sceneSet.base_still_url;

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting still for angle: ${sceneAngle.angle_name}`);

    let stillUrl, generatedSeed = null;
    let usedCropOutpaint = false;
    // Every billed image call below reports its logged cost here (Task #2396).
    const angleCosts = createCostCollector(`angle ${sceneAngle.id} (${angleLabel})`);

    // ── STEP 1: Try crop + outpaint (pixel-preserving) ──
    // For angles where we can crop from the base image, this gives the best
    // consistency because original pixels are kept untouched.
    if (referenceImageForEdit && CAMERA_CROP_MAP[angleLabel] !== undefined) {
      stillUrl = await cropAndOutpaint(
        referenceImageForEdit, angleLabel, sceneSet.id, sceneAngle.id, prompt,
        { onLogged: angleCosts.onLogged },
      );
      if (stillUrl) {
        usedCropOutpaint = true;
        console.log(`[SceneGen] Crop+outpaint succeeded for ${angleLabel}`);
      }
    }

    // ── STEP 2: Fall back to full generation if crop failed or not applicable ──
    if (!stillUrl) {

    // Try DALL-E first, fall back to Runway
    const useRunway = true;
    if (!useRunway && OPENAI_API_KEY) {
      try {
        // Enhance prompt with style lock if available
        let enhancedPrompt = prompt;
        const style = sceneSet.visual_language;
        if (style?.locked) {
          const styleParts = [];
          if (style.color_palette) styleParts.push(`Colors: ${style.color_palette.join(', ')}.`);
          if (style.lighting_type) styleParts.push(`Lighting: ${style.lighting_type}.`);
          if (style.design_style) styleParts.push(`Style: ${style.design_style}.`);
          if (styleParts.length > 0) {
            enhancedPrompt = `${styleParts.join(' ')} ${prompt}`;
          }
        }

        const dalleUrl = await generateDallEStill(enhancedPrompt, referenceImageForEdit, angleLabel, {
          imageAnalysis,
          styleLock: style?.locked ? style : null,
          regionHint: getReferenceRegionHint(angleLabel),
          anchors: relevantAnchors,
        });
        if (dalleUrl) {
          if (dalleUrl.includes(S3_BUCKET)) {
            stillUrl = dalleUrl;
          } else {
            const s3Key = `scenes/${sceneSet.id}/angles/${sceneAngle.id}/still-${Date.now()}.png`;
            stillUrl = await downloadAndUploadToS3(dalleUrl, s3Key);
          }
        }
      } catch (dalleErr) {
        console.warn(`[SceneGen] DALL-E failed for angle, falling back to Runway:`, dalleErr.message);
      }
    }

    if (!stillUrl) {
      // Runway fallback
      const styleReference = (sceneAngle.style_reference_url || sceneSet.style_reference_url)
        ? { uri: sceneAngle.style_reference_url || sceneSet.style_reference_url, weight: 0.7 }
        : undefined;
      const referenceImages = sceneSet.base_still_url
        ? [{ uri: sceneSet.base_still_url, weight: 0.8 }]
        : undefined;

      const { imageUrl } = await startTextToImage(prompt, {
        styleReference,
        referenceImages,
        guidanceScale: 1.5,
        onLogged: angleCosts.onLogged,
      });
      stillUrl = await downloadAndStoreStill(imageUrl, sceneSet.id, sceneAngle.id);
      generatedSeed = null;
    }
    } // end of fallback full-generation block

    let consistencyCheck = null;
    if (referenceImageForEdit && stillUrl && !usedCropOutpaint) {
      consistencyCheck = await checkAngleConsistency(referenceImageForEdit, stillUrl, sceneAngle.angle_name);
      let retryCount = 0;

      while ((consistencyCheck?.score || 0) < CONSISTENCY_MIN_SCORE && retryCount < CONSISTENCY_MAX_RETRIES) {
        retryCount += 1;
        console.warn(`[SceneGen] Consistency score ${consistencyCheck.score} below ${CONSISTENCY_MIN_SCORE} for ${angleLabel}; retrying (${retryCount}/${CONSISTENCY_MAX_RETRIES})`);

        const retryPrompt = buildIdentityLockPrompt(prompt, angleLabel, consistencyCheck?.issues || []);
        const { imageUrl: retryImageUrl } = await startTextToImage(retryPrompt, {
          referenceImages: [{ uri: referenceImageForEdit, weight: 0.95 }],
          guidanceScale: 1.3,
          onLogged: angleCosts.onLogged,
        });

        stillUrl = await downloadAndStoreStill(retryImageUrl, sceneSet.id, sceneAngle.id);
        consistencyCheck = await checkAngleConsistency(referenceImageForEdit, stillUrl, sceneAngle.angle_name);
      }
    }

    console.log(`[SceneGen] Still complete for angle: ${sceneAngle.angle_name}`);

    // ── SceneSpec post-generation validation ──
    let specValidation = null;
    if (spec?.camera_contracts && stillUrl) {
      try {
        specValidation = await sceneSpecService.validateAngleAgainstSpec(stillUrl, spec, angleLabel);
        console.log(`[SceneGen] Spec validation for ${angleLabel}: score=${specValidation.score}, missing=${specValidation.missing_required?.length || 0}`);
      } catch (valErr) {
        console.warn(`[SceneGen] Spec validation failed (non-blocking): ${valErr.message}`);
      }
    }

    const qualityReview = sceneAngle.quality_review || {};
    if (consistencyCheck) {
      qualityReview.base_consistency = {
        score: consistencyCheck.score,
        pass: (consistencyCheck.score || 0) >= CONSISTENCY_MIN_SCORE,
        issues: consistencyCheck.issues || [],
        validated_at: new Date().toISOString(),
        threshold: CONSISTENCY_MIN_SCORE,
      };
    }
    if (specValidation) {
      qualityReview.spec_validation = {
        score: specValidation.score,
        pass: specValidation.pass,
        missing_required: specValidation.missing_required,
        issues: specValidation.issues,
        validated_at: new Date().toISOString(),
      };
    }

    // The logged cost of this angle's image calls: the outpaint's estimate
    // plus any priced input image tokens, or Kontext's per-image estimate
    // (each consistency retry included); 0 for a pure crop; null (with a
    // warning) when every call was unpriced.
    const totalCost = angleCosts.value();

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: null,
      runway_seed: generatedSeed ? String(generatedSeed) : null,
      generation_status: 'complete',
      generation_cost: totalCost,
      generation_attempt: (sceneAngle.generation_attempt || 0) + 1,
      quality_review: qualityReview,
    }, { where: { id: sceneAngle.id } });

    if (typeof totalCost === 'number' && totalCost > 0) {
      await SceneSet.increment('generation_cost', { by: totalCost, where: { id: sceneSet.id } });
    }

    return { success: true, stillUrl, seed: generatedSeed, specValidation };
  } catch (err) {
    await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
    throw err;
  }
}

/**
 * Generate a video clip for an angle on demand (image→video, gen3a_turbo).
 * Uses the angle's existing still_image_url as the source image.
 * Call only after generateAngle() has completed successfully.
 */
async function generateAngleVideo(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  const sourceImageUrl = sceneAngle.still_image_url || sceneSet.base_still_url;
  if (!sourceImageUrl) {
    throw new Error('No source image available. Generate the angle still first.');
  }

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const videoPrompt = buildVideoPrompt(sceneSet, angleLabel, sceneAngle.camera_direction);
  const videoDuration = sceneAngle.video_duration || VIDEO_DURATION_MAP[angleLabel] || 5;
  const cameraMotion = sceneAngle.camera_motion || CAMERA_MOTION_MAP[angleLabel] || 'static';

  // Note: errors propagate naturally — angle stays 'complete' so the still image remains accessible
  console.log(`[SceneGen] Starting on-demand video for angle: ${sceneAngle.angle_name}`);

  const { jobId } = await startImageToVideo(videoPrompt, sourceImageUrl, {
    duration: videoDuration,
    cameraMotion,
  });
  const result = await pollTask(jobId);

  if (result.status !== 'SUCCEEDED') {
    throw new Error(`Angle video failed: ${result.error}`);
  }

  if (sceneAngle.video_clip_url) await deleteOldS3Asset(sceneAngle.video_clip_url);

  const videoUrl = await storeInS3(result.outputUrl, sceneSet.id, sceneAngle.id, 'video');
  const totalCost = result.creditsUsed || 0;

  console.log(`[SceneGen] Video complete for angle: ${sceneAngle.angle_name}`);

  await SceneAngle.update({
    video_clip_url: videoUrl,
    generation_status: 'complete',
    generation_cost: parseFloat(sceneAngle.generation_cost || 0) + totalCost,
  }, { where: { id: sceneAngle.id } });

  await SceneSet.increment('generation_cost', { by: totalCost, where: { id: sceneSet.id } });

  return { success: true, videoUrl };
}

// ─── HIGH-LEVEL: REGENERATE ANGLE WITH REFINED PROMPT ─────────────────────────

/**
 * The Scene Brief options for a refined angle regeneration: the angle's
 * camera label with continuity, and the base's event and overrides
 * (options.overrides replaces those, S2). regenerateAngleRefined and the
 * brief shown before it (POST /scene-sets/:id/brief with refine) share it.
 */
function refinedBriefOptions(sceneAngle, sceneSet, { overrides = null } = {}) {
  const baseBrief = sceneSet.base_generation?.brief || null;
  return {
    angleLabel: sceneAngle.angle_label || 'WIDE',
    continuity: true,
    eventId: baseBrief?.event_id || null,
    overrides: overrides && typeof overrides === 'object' ? overrides : (baseBrief?.overrides || {}),
  };
}

async function regenerateAngleRefined(sceneAngle, sceneSet, artifactCategories, models, options = {}) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_still_url) {
    throw new Error('base_still_url not set on parent scene set. Run generateBaseScene first.');
  }

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const brief = await prepareSceneBrief(briefDb(models), sceneSet, refinedBriefOptions(sceneAngle, sceneSet, {
    overrides: options.overrides,
  }));
  const basePrompt = briefToPrompt(brief);
  const refinedPrompt = artifactDetection.buildRefinedPrompt(basePrompt, artifactCategories);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: refinedPrompt, refined_prompt: refinedPrompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Regenerating angle with refined prompt: ${sceneAngle.angle_name}`);
    console.log(`[SceneGen] Addressing artifacts: ${artifactCategories.join(', ')}`);

    const numericSeed = sceneSet.base_runway_seed && !isNaN(Number(sceneSet.base_runway_seed))
      ? Number(sceneSet.base_runway_seed)
      : null;
    const seedVariation = numericSeed !== null
      ? String(numericSeed + (sceneAngle.generation_attempt || 1))
      : undefined;

    // Style reference
    const styleReference = (sceneAngle.style_reference_url || sceneSet.style_reference_url)
      ? { uri: sceneAngle.style_reference_url || sceneSet.style_reference_url, weight: 0.7 }
      : undefined;
    const referenceImages = sceneSet.base_still_url
      ? [{ uri: sceneSet.base_still_url, weight: 0.8 }]
      : undefined;

    const refineCosts = createCostCollector(`refined angle ${sceneAngle.id}`);
    const { imageUrl } = await startTextToImage(refinedPrompt, {
      seed: seedVariation,
      styleReference,
      referenceImages,
      onLogged: refineCosts.onLogged,
    });
    const stillUrl = await downloadAndStoreStill(imageUrl, sceneSet.id, sceneAngle.id);

    // Video with camera motion and duration
    const videoDuration = sceneAngle.video_duration || VIDEO_DURATION_MAP[angleLabel] || 5;
    const cameraMotion = sceneAngle.camera_motion || CAMERA_MOTION_MAP[angleLabel] || 'static';

    const { jobId: videoJobId } = await startImageToVideo(
      refinedPrompt,
      stillUrl,
      { duration: videoDuration, cameraMotion }
    );
    const videoResult = await pollTask(videoJobId);
    let videoUrl = null;
    if (videoResult.status === 'SUCCEEDED') {
      videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, sceneAngle.id, 'video');
    }

    let qualityData = { qualityScore: null, flags: [] };
    try {
      qualityData = await artifactDetection.analyzeImageQuality(stillUrl);
    } catch (qaErr) {
      console.warn(`[SceneGen] Quality analysis on refined image failed: ${qaErr.message}`);
    }

    // Still: the logged Kontext cost (rate-table estimate, Task #2396), not a
    // literal. Runway video credits are added as before (INFERRED unchanged).
    const totalCost = (refineCosts.value() || 0) + (videoResult.creditsUsed || 0);

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: videoUrl,
      runway_seed: String(videoResult.seed ?? videoJobId),
      generation_status: 'complete',
      generation_cost: totalCost,
      quality_score: qualityData.qualityScore,
      artifact_flags: qualityData.flags || [],
      generation_attempt: (sceneAngle.generation_attempt || 0) + 1,
      refined_prompt: refinedPrompt,
      camera_motion: cameraMotion,
      video_duration: videoDuration,
    }, { where: { id: sceneAngle.id } });

    await SceneSet.increment('generation_cost', { by: totalCost, where: { id: sceneSet.id } });

    return {
      success: true,
      stillUrl,
      videoUrl,
      seed: null,
      qualityScore: qualityData.qualityScore,
      artifactFlags: qualityData.flags,
      attempt: (sceneAngle.generation_attempt || 0) + 1,
    };
  } catch (err) {
    await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
    throw err;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  buildPrompt,
  briefDb,
  buildVideoPrompt,
  generateBaseScene,
  analyzeBaseImage,
  checkAngleConsistency,
  cropReferenceRegion,
  generateDepthMap,
  applyMoodVariant,
  generateMoodVariants,
  MOOD_PRESETS,
  generateAngle,
  angleBriefOptions,
  refinedBriefOptions,
  generateAngleVideo,
  regenerateAngleRefined,
  generateBestVariation,
  extractFirstFrame,
  pollTask,
  storeInS3,
  storeBufferInS3,
  LALAVERSE_VISUAL_ANCHOR,
  NEGATIVE_PROMPT,
  ANGLE_MODIFIERS,
  CAMERA_MOTION_MAP,
  VIDEO_DURATION_MAP,
  VIDEO_MOVEMENT_MODIFIERS,
  // Task #2396: base still model choice, true recorded costs
  SCENE_BASE_MODELS,
  OUTPAINT_MODEL,
  isBaseModelKey,
  defaultBaseModel,
  resolveBaseModel,
  estimateBaseStillCost,
  createCostCollector,
  generateBaseStill,
  generateGptImageStill,
  cropAndOutpaint,
};
