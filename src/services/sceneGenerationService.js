'use strict';

/**
 * Scene Generation Service — v2.0
 *
 * v2.0 enhancements:
 *   - Fixed aspect ratio: 1920:1080 for both text_to_image and image_to_video
 *   - Added negative_prompt to suppress common artifacts
 *   - Condensed LALAVERSE_VISUAL_ANCHOR to ~600 chars for better prompt budget
 *   - Style reference image support for visual consistency
 *   - Multi-variation generation (num_outputs) with auto-pick by quality score
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
const artifactDetection = require('./artifactDetectionService');

const RUNWAY_API_BASE    = 'https://api.dev.runwayml.com/v1';
const RUNWAY_API_KEY     = process.env.RUNWAY_ML_API_KEY;
const RUNWAY_API_VERSION = '2024-11-06';
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const S3_BUCKET          = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION         = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── LALAVERSE VISUAL ANCHOR (condensed ~590 chars) ─────────────────────────

const LALAVERSE_VISUAL_ANCHOR = `Style: Final Fantasy softness, Pinterest-core femininity, magical realism. Colors: warm neutrals (cream, blush, beige), gold accents, pastel glow (lavender, peach, rose). Natural hero lighting. Materials: soft fabrics (linen, silk), light wood (oak, ash), glass, mirrors, shimmer. Tone: calm, intentional, beautiful, lived-in. Quality: sharp edges on furniture, consistent hardware, correct chair/table legs, coherent reflections, clean fabric folds, precise floor patterns, minimal surface objects.`;

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

const ENVIRONMENT_ONLY_CONSTRAINT = 'Empty room. No people. No person. No human. No figure. No silhouette. No body. No face. No hands. No reflection of a person. Environment only.';

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

function buildPrompt(sceneSet, angleLabel = 'WIDE', customCameraDirection = null, eventContext = null) {
  const cameraText = customCameraDirection || ANGLE_MODIFIERS[angleLabel] || ANGLE_MODIFIERS.WIDE;

  // Condensed anchor frees ~400 chars for description vs v1.1's ~200
  const descriptionSlice = (sceneSet.canonical_description || '').slice(0, 350);

  const parts = [
    ENVIRONMENT_ONLY_CONSTRAINT,
    LALAVERSE_VISUAL_ANCHOR,
    `LOCATION: ${sceneSet.name}.`,
    descriptionSlice,
  ];

  // Inject event context (location_hint + dress_code atmosphere) into the prompt
  if (eventContext) {
    if (eventContext.location_hint) {
      parts.push(`Event setting: ${eventContext.location_hint.slice(0, 100)}.`);
    }
    if (eventContext.dress_code) {
      parts.push(`Atmosphere suggests ${eventContext.dress_code.toLowerCase()} dress code — adjust decor formality accordingly.`);
    }
    if (eventContext.prestige && eventContext.prestige >= 8) {
      parts.push('Elite luxury venue — opulent details, crystal, gold accents, dramatic lighting.');
    }
  }

  parts.push(`CAMERA: ${cameraText}`);

  // For non-WIDE angles, add room extension instruction
  if (angleLabel !== 'WIDE' && angleLabel !== 'OTHER') {
    parts.push('IMPORTANT: Extend and expand the visible room space beyond the original reference. Show areas of the room not visible in the base image — imagine the room continues in the camera direction. Maintain the same design language, color palette, and material quality throughout the extended space.');
  }

  parts.push('Photorealistic cinematic quality. No text overlays. No watermarks.');

  const full = parts.join(' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Enforce 1000 char limit
  return full.length > 1000 ? full.slice(0, 997) + '...' : full;
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
 * Step 1: Generate still image(s) from text prompt.
 * Supports num_outputs for multi-variation generation.
 * Supports style_reference for visual consistency.
 */
async function startTextToImage(prompt, options = {}) {
  const { seed, numOutputs = 1, styleReference, referenceImages } = options;
  const parsedSeed = seed != null && /^\d+$/.test(String(seed)) ? Number(seed) : undefined;

  const payload = {
    model: 'gen4_image',
    promptText: prompt,
    ratio: '1920:1080',
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
    ...(numOutputs > 1 ? { numOutputs } : {}),
    ...(styleReference ? { styleReference } : {}),
    ...(referenceImages && referenceImages.length > 0 ? { referenceImages } : {}),
  };

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${RUNWAY_API_BASE}/text_to_image`,
        payload,
        { headers: runwayHeaders(), timeout: 30000 }
      );
      return { jobId: response.data.id };
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (err.response) {
        console.error(`[SceneGen] text_to_image API error (attempt ${attempt}/${MAX_RETRIES}):`, JSON.stringify(err.response.data, null, 2));
      }
      if (!retryable || attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 2000;
      console.log(`[SceneGen] Retrying text_to_image in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
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
async function generateDallEStill(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const dallePrompt = prompt.length > 4000 ? prompt.slice(0, 3997) + '...' : prompt;

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1792x1024', // landscape 16:9-ish for cinematic scenes
      quality: 'hd',
      style: 'natural',
      response_format: 'url',
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  return response.data.data[0]?.url;
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
 * Generate multiple variations and auto-select the best by quality score.
 * Returns the best result plus all variation data.
 */
async function generateBestVariation(prompt, numVariations, options = {}) {
  const { seed, styleReference } = options;
  const variations = [];

  console.log(`[SceneGen] Generating ${numVariations} variations for best-pick...`);

  const { jobId } = await startTextToImage(prompt, {
    seed,
    numOutputs: Math.min(numVariations, 4),
    styleReference,
  });
  const result = await pollTask(jobId);

  if (result.status !== 'SUCCEEDED') {
    return { best: null, variations: [], error: result.error };
  }

  // Analyze each output for quality
  for (let i = 0; i < result.outputs.length; i++) {
    let quality = { qualityScore: 50, flags: [] };
    try {
      quality = await artifactDetection.analyzeImageQuality(result.outputs[i]);
    } catch (err) {
      console.warn(`[SceneGen] Quality analysis failed for variation ${i}: ${err.message}`);
    }
    variations.push({
      index: i,
      url: result.outputs[i],
      qualityScore: quality.qualityScore,
      flags: quality.flags,
    });
  }

  // Sort by quality score descending
  variations.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  const best = variations[0];
  console.log(`[SceneGen] Best variation: #${best.index} (score: ${best.qualityScore}/100)`);

  return {
    best,
    variations,
    seed: result.seed,
    creditsUsed: result.creditsUsed,
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
// ─── EVENT CONTEXT LOADER ────────────────────────────────────────────────────

async function loadEventContext(sceneSet, models) {
  try {
    const sequelize = models.sequelize;
    // Find events linked to this scene set
    const [events] = await sequelize.query(
      `SELECT location_hint, dress_code, prestige, name FROM world_events
       WHERE scene_set_id = :sceneSetId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { sceneSetId: sceneSet.id } }
    );
    if (events.length > 0) return events[0];

    // Fallback: find events linked to episodes that use this scene set
    const [epEvents] = await sequelize.query(
      `SELECT we.location_hint, we.dress_code, we.prestige, we.name
       FROM world_events we
       JOIN scene_set_episodes sse ON sse.episode_id = we.used_in_episode_id
       WHERE sse.scene_set_id = :sceneSetId AND we.deleted_at IS NULL AND sse.deleted_at IS NULL
       LIMIT 1`,
      { replacements: { sceneSetId: sceneSet.id } }
    );
    if (epEvents.length > 0) return epEvents[0];
  } catch (e) {
    // Tables may not exist yet
  }
  return null;
}

// ─── HIGH-LEVEL: GENERATE BASE SCENE ─────────────────────────────────────────

async function generateBaseScene(sceneSet, models) {
  const { SceneSet } = models;

  const eventContext = await loadEventContext(sceneSet, models);
  const prompt = buildPrompt(sceneSet, 'WIDE', null, eventContext);

  await SceneSet.update(
    { generation_status: 'generating', base_runway_prompt: prompt },
    { where: { id: sceneSet.id } }
  );

  try {
    console.log(`[SceneGen] Starting base still for: ${sceneSet.name}`);

    // Determine generation engine: DALL-E (default for stills) or Runway
    const useRunway = sceneSet.base_runway_model === 'runway' || !OPENAI_API_KEY;
    let stillUrl, lockedSeed = null, stillCredits = 0;

    if (!useRunway && OPENAI_API_KEY) {
      // ── DALL-E 3 path: richer detail for static scene stills ─────────
      console.log(`[SceneGen] Using DALL-E 3 for richer scene still`);
      try {
        const dalleUrl = await generateDallEStill(prompt);
        if (!dalleUrl) throw new Error('DALL-E 3 did not return an image URL');

        const s3Key = `scenes/${sceneSet.id}/base-still-${Date.now()}.png`;
        stillUrl = await downloadAndUploadToS3(dalleUrl, s3Key);
        console.log(`[SceneGen] DALL-E still complete, uploaded to S3`);
      } catch (dalleErr) {
        console.warn(`[SceneGen] DALL-E 3 failed, falling back to Runway:`, dalleErr.message);
        // Fall through to Runway path
        stillUrl = null;
      }
    }

    if (!stillUrl) {
      // ── Runway path: used as fallback or when video is needed ─────────
      console.log(`[SceneGen] Using Runway for scene still`);
      const styleReference = sceneSet.style_reference_url
        ? { uri: sceneSet.style_reference_url, weight: 0.7 }
        : undefined;

      const numVariations = sceneSet.variation_count || 1;
      let stillOutputUrl, stillSeed;

      if (numVariations > 1) {
        const varResult = await generateBestVariation(prompt, numVariations, { styleReference });
        if (!varResult.best) {
          await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
          throw new Error(`Base still multi-variation failed: ${varResult.error}`);
        }
        stillOutputUrl = varResult.best.url;
        stillSeed = varResult.seed;
        stillCredits = varResult.creditsUsed || 0;
      } else {
        const { jobId: stillJobId } = await startTextToImage(prompt, { styleReference });
        const stillResult = await pollTask(stillJobId);
        if (stillResult.status !== 'SUCCEEDED') {
          await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
          throw new Error(`Base still failed: ${stillResult.error}`);
        }
        stillOutputUrl = stillResult.outputUrl;
        stillSeed = stillResult.seed;
        stillCredits = stillResult.creditsUsed || 0;
      }

      stillUrl = await storeInS3(stillOutputUrl, sceneSet.id, 'base', 'still');
      lockedSeed = stillSeed != null ? String(stillSeed) : null;
    }

    // Clean up old base still from S3 (best-effort)
    if (sceneSet.base_still_url) {
      await deleteOldS3Asset(sceneSet.base_still_url);
    }

    console.log(`[SceneGen] Still complete.${lockedSeed ? ` Seed locked: ${lockedSeed}` : ' (DALL-E — no seed)'}`);

    // Lock the seed + base still URL — permanent
    await SceneSet.update({
      base_runway_seed: lockedSeed,
      base_still_url: stillUrl,
      generation_status: 'complete',
      generation_cost: parseFloat(sceneSet.generation_cost || 0) + stillCredits,
    }, { where: { id: sceneSet.id } });

    return { success: true, stillUrl, videoUrl: null, seed: lockedSeed };
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

async function generateAngle(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const eventContext = await loadEventContext(sceneSet, models);
  const prompt = buildPrompt(sceneSet, angleLabel, sceneAngle.camera_direction, eventContext);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting still for angle: ${sceneAngle.angle_name}`);

    // Clean up old assets from S3 (best-effort)
    if (sceneAngle.still_image_url) await deleteOldS3Asset(sceneAngle.still_image_url);
    if (sceneAngle.video_clip_url)  await deleteOldS3Asset(sceneAngle.video_clip_url);

    let stillUrl, totalCost = 0;

    // Try DALL-E first for richer stills, fall back to Runway
    const useRunway = sceneSet.base_runway_model === 'runway' || !OPENAI_API_KEY;
    if (!useRunway && OPENAI_API_KEY) {
      try {
        console.log(`[SceneGen] Using DALL-E 3 for angle still`);
        const dalleUrl = await generateDallEStill(prompt);
        if (dalleUrl) {
          const s3Key = `scenes/${sceneSet.id}/angles/${sceneAngle.id}/still-${Date.now()}.png`;
          stillUrl = await downloadAndUploadToS3(dalleUrl, s3Key);
        }
      } catch (dalleErr) {
        console.warn(`[SceneGen] DALL-E failed for angle, falling back to Runway:`, dalleErr.message);
      }
    }

    if (!stillUrl) {
      // Runway path
      const numericSeed = sceneSet.base_runway_seed && !isNaN(Number(sceneSet.base_runway_seed))
        ? Number(sceneSet.base_runway_seed)
        : null;
      const seedOpt = numericSeed !== null
        ? String(numericSeed + (sceneAngle.generation_attempt || 0) + 1)
        : undefined;

      const styleReference = (sceneAngle.style_reference_url || sceneSet.style_reference_url)
        ? { uri: sceneAngle.style_reference_url || sceneSet.style_reference_url, weight: 0.7 }
        : undefined;

      const referenceImages = sceneSet.base_still_url
        ? [{ uri: sceneSet.base_still_url, weight: 0.8 }]
        : undefined;

      const { jobId } = await startTextToImage(prompt, { seed: seedOpt, styleReference, referenceImages });
      const result = await pollTask(jobId);

      if (result.status !== 'SUCCEEDED') {
        await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
        throw new Error(`Angle still failed: ${result.error}`);
      }

      stillUrl = await storeInS3(result.outputUrl, sceneSet.id, sceneAngle.id, 'still');
      totalCost = result.creditsUsed || 0;
    }

    console.log(`[SceneGen] Still complete for angle: ${sceneAngle.angle_name}`);

    // Quality Analysis (non-blocking)
    let qualityData = { qualityScore: null, flags: [] };
    try {
      qualityData = await artifactDetection.analyzeImageQuality(stillUrl);
      console.log(`[SceneGen] Quality score: ${qualityData.qualityScore}/100, flags: ${qualityData.flags.length}`);
    } catch (qaErr) {
      console.warn(`[SceneGen] Quality analysis failed (non-blocking): ${qaErr.message}`);
    }

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: null,
      runway_seed: String(result.seed ?? jobId),
      generation_status: 'complete',
      generation_cost: totalCost,
      quality_score: qualityData.qualityScore,
      artifact_flags: qualityData.flags || [],
      generation_attempt: (sceneAngle.generation_attempt || 0) + 1,
    }, { where: { id: sceneAngle.id } });

    await SceneSet.increment('generation_cost', { by: totalCost, where: { id: sceneSet.id } });

    return { success: true, stillUrl, videoUrl: null, seed: result.seed, qualityScore: qualityData.qualityScore };
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

async function regenerateAngleRefined(sceneAngle, sceneSet, artifactCategories, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_still_url) {
    throw new Error('base_still_url not set on parent scene set. Run generateBaseScene first.');
  }

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const eventContext = await loadEventContext(sceneSet, models);
  const basePrompt = buildPrompt(sceneSet, angleLabel, null, eventContext);
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

    const { jobId: stillJobId } = await startTextToImage(refinedPrompt, {
      seed: seedVariation,
      styleReference,
    });
    const stillResult = await pollTask(stillJobId);

    if (stillResult.status !== 'SUCCEEDED') {
      await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
      throw new Error(`Refined angle still failed: ${stillResult.error}`);
    }

    const stillUrl = await storeInS3(stillResult.outputUrl, sceneSet.id, sceneAngle.id, 'still');

    // Video with camera motion and duration
    const videoDuration = sceneAngle.video_duration || VIDEO_DURATION_MAP[angleLabel] || 5;
    const cameraMotion = sceneAngle.camera_motion || CAMERA_MOTION_MAP[angleLabel] || 'static';

    const { jobId: videoJobId } = await startImageToVideo(
      refinedPrompt,
      stillResult.outputUrl,
      { seed: stillResult.seed, duration: videoDuration, cameraMotion }
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

    const totalCost = (stillResult.creditsUsed || 0) + (videoResult.creditsUsed || 0);

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
      seed: stillResult.seed,
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
  buildVideoPrompt,
  generateBaseScene,
  generateAngle,
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
};
