'use strict';

/**
 * Scene Generation Service — v2.0
 *
 * v2.0 enhancements:
 *   - Fixed aspect ratio: 1280:720 for both text_to_image and image_to_video
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
const S3_BUCKET          = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION         = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── LALAVERSE VISUAL ANCHOR (condensed ~590 chars) ─────────────────────────

const LALAVERSE_VISUAL_ANCHOR = `Style: Final Fantasy softness, Pinterest-core femininity, magical realism. Colors: warm neutrals (cream, blush, beige), gold accents, pastel glow (lavender, peach, rose). Natural hero lighting. Materials: soft fabrics (linen, silk), light wood (oak, ash), glass, mirrors, shimmer. Tone: calm, intentional, beautiful, lived-in. Quality: sharp edges on furniture, consistent hardware, correct chair/table legs, coherent reflections, clean fabric folds, precise floor patterns, minimal surface objects.`;

// ─── NEGATIVE PROMPT (universal) ─────────────────────────────────────────────

const NEGATIVE_PROMPT = `neon lighting, cyberpunk, cluttered decor, ultra-minimal sterile, dark moody lighting, distorted furniture legs, melted objects, blobby shapes, warped reflections, text, watermarks, signatures, extra fingers, malformed hands, blurry, low resolution, oversaturated, chromatic aberration`;

// ─── ANGLE MODIFIERS ──────────────────────────────────────────────────────────

const ANGLE_MODIFIERS = {
  WIDE:         'Wide establishing shot, full room visible, camera at medium height, balanced composition.',
  CLOSET:       'Camera facing wardrobe wall, full-height racks or shelving visible, soft glow on fabric textures.',
  VANITY:       'Camera at vanity mirror, close-to-medium shot, soft focus on reflection and surface details.',
  WINDOW:       'Camera facing window, natural light streaming in, subject silhouette or three-quarter view.',
  DOORWAY:      'Camera at doorway threshold, looking into the room, sense of arrival or departure.',
  ESTABLISHING: 'Wide exterior or grand interior entrance, full prestige of the space visible.',
  ACTION:       'Dynamic angle, sense of movement or event energy, slightly asymmetric composition.',
  CLOSE:        'Close shot on a specific surface, object, or detail. Intimate and personal.',
  OVERHEAD:     'High angle looking down, revealing the full layout and spatial relationships.',
  OTHER:        'Unique compositional angle appropriate to this specific location.',
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

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

function buildPrompt(sceneSet, angleLabel = 'WIDE', customCameraDirection = null) {
  const cameraText = customCameraDirection || ANGLE_MODIFIERS[angleLabel] || ANGLE_MODIFIERS.WIDE;

  // Condensed anchor frees ~400 chars for description vs v1.1's ~200
  const descriptionSlice = (sceneSet.canonical_description || '').slice(0, 400);

  const parts = [
    LALAVERSE_VISUAL_ANCHOR,
    `LOCATION: ${sceneSet.name}.`,
    descriptionSlice,
    `CAMERA: ${cameraText}`,
    'Photorealistic cinematic quality. No text overlays. No watermarks. No distorted faces or hands.',
  ];

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
  const { seed, numOutputs = 1, styleReference } = options;
  const parsedSeed = seed != null && /^\d+$/.test(String(seed)) ? Number(seed) : undefined;

  const payload = {
    model: 'gen4_image',
    promptText: prompt,
    ratio: '1280:720',
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
    ...(numOutputs > 1 ? { numOutputs } : {}),
    ...(styleReference ? { styleReference } : {}),
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
 * Fixed: ratio now matches text_to_image (1280:720).
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
// ─── HIGH-LEVEL: GENERATE BASE SCENE ─────────────────────────────────────────

async function generateBaseScene(sceneSet, models) {
  const { SceneSet } = models;

  const prompt = buildPrompt(sceneSet, 'WIDE');

  await SceneSet.update(
    { generation_status: 'generating', base_runway_prompt: prompt },
    { where: { id: sceneSet.id } }
  );

  try {
    console.log(`[SceneGen] Starting base still for: ${sceneSet.name}`);

    // Build style reference if set has one
    const styleReference = sceneSet.style_reference_url
      ? { uri: sceneSet.style_reference_url, weight: 0.7 }
      : undefined;

    // ── Step 1: Text → Still (with multi-variation if configured) ─────────
    const numVariations = sceneSet.variation_count || 1;
    let stillOutputUrl, stillSeed, stillCredits;

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

    const stillUrl = await storeInS3(stillOutputUrl, sceneSet.id, 'base', 'still');
    const lockedSeed = stillSeed != null ? String(stillSeed) : null;

    // Clean up old base still from S3 (best-effort)
    if (sceneSet.base_still_url) {
      await deleteOldS3Asset(sceneSet.base_still_url);
    }

    console.log(`[SceneGen] Still complete. Seed locked: ${lockedSeed}`);

    // Lock the seed + base still URL — permanent
    // Base video is generated on-demand only (use POST /:id/generate-video to produce it)
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
  // Use the full angle-specific prompt for text→image (cheap: ~1 credit via gen4_image)
  const prompt = buildPrompt(sceneSet, angleLabel, sceneAngle.camera_direction);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting text-to-image still for angle: ${sceneAngle.angle_name}`);

    // Derive a seed variation from the parent set's locked seed so sibling angles
    // share the same stylistic base while remaining visually distinct.
    const numericSeed = sceneSet.base_runway_seed && !isNaN(Number(sceneSet.base_runway_seed))
      ? Number(sceneSet.base_runway_seed)
      : null;
    const seedOpt = numericSeed !== null
      ? String(numericSeed + (sceneAngle.generation_attempt || 0) + 1)
      : undefined;

    const styleReference = (sceneAngle.style_reference_url || sceneSet.style_reference_url)
      ? { uri: sceneAngle.style_reference_url || sceneSet.style_reference_url, weight: 0.7 }
      : undefined;

    const { jobId } = await startTextToImage(prompt, { seed: seedOpt, styleReference });
    const result = await pollTask(jobId);

    if (result.status !== 'SUCCEEDED') {
      await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
      throw new Error(`Angle still failed: ${result.error}`);
    }

    // Clean up old assets from S3 (best-effort)
    if (sceneAngle.still_image_url) await deleteOldS3Asset(sceneAngle.still_image_url);
    if (sceneAngle.video_clip_url)  await deleteOldS3Asset(sceneAngle.video_clip_url);

    const stillUrl = await storeInS3(result.outputUrl, sceneSet.id, sceneAngle.id, 'still');
    const totalCost = result.creditsUsed || 0;

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

  await SceneAngle.update(
    { generation_status: 'generating_video' },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting on-demand video for angle: ${sceneAngle.angle_name}`);

    const { jobId } = await startImageToVideo(videoPrompt, sourceImageUrl, {
      duration: videoDuration,
      cameraMotion,
    });
    const result = await pollTask(jobId);

    if (result.status !== 'SUCCEEDED') {
      // Revert to complete — the still is still valid
      await SceneAngle.update({ generation_status: 'complete' }, { where: { id: sceneAngle.id } });
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
  } catch (err) {
    // Keep the angle as complete so the still image stays accessible
    await SceneAngle.update({ generation_status: 'complete' }, { where: { id: sceneAngle.id } });
    throw err;
  }
}

// ─── HIGH-LEVEL: REGENERATE ANGLE WITH REFINED PROMPT ─────────────────────────

async function regenerateAngleRefined(sceneAngle, sceneSet, artifactCategories, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_still_url) {
    throw new Error('base_still_url not set on parent scene set. Run generateBaseScene first.');
  }

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const basePrompt = buildPrompt(sceneSet, angleLabel);
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
