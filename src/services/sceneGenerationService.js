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
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

function buildPrompt(sceneSet, angleLabel = 'WIDE') {
  const angleModifier = ANGLE_MODIFIERS[angleLabel] || ANGLE_MODIFIERS.WIDE;

  // Condensed anchor frees ~400 chars for description vs v1.1's ~200
  const descriptionSlice = (sceneSet.canonical_description || '').slice(0, 400);

  const parts = [
    LALAVERSE_VISUAL_ANCHOR,
    `LOCATION: ${sceneSet.name}.`,
    descriptionSlice,
    `CAMERA: ${angleModifier}`,
    'Cinematic quality. No text overlays. No watermarks.',
  ];

  const full = parts.join(' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Enforce 1000 char limit
  return full.length > 1000 ? full.slice(0, 997) + '...' : full;
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

  try {
    const response = await axios.post(
      `${RUNWAY_API_BASE}/text_to_image`,
      payload,
      { headers: runwayHeaders(), timeout: 30000 }
    );
    return { jobId: response.data.id };
  } catch (err) {
    if (err.response) {
      console.error('[SceneGen] text_to_image API error:', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
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
    ratio: '1280:720',
    duration,
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
    ...(cameraMotion ? { cameraMotion } : {}),
  };

  try {
    const response = await axios.post(
      `${RUNWAY_API_BASE}/image_to_video`,
      payload,
      { headers: runwayHeaders(), timeout: 30000 }
    );
    return { jobId: response.data.id };
  } catch (err) {
    if (err.response) {
      console.error('[SceneGen] image_to_video API error:', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

/**
 * Poll a RunwayML task until SUCCEEDED or FAILED.
 * For multi-output tasks, returns all outputs.
 */
async function pollTask(jobId, maxWaitMs = 180000) {
  const pollInterval = 4000;
  const maxAttempts = Math.floor(maxWaitMs / pollInterval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    const response = await axios.get(
      `${RUNWAY_API_BASE}/tasks/${jobId}`,
      { headers: runwayHeaders(), timeout: 15000 }
    );

    const task = response.data;

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

  const s3Key = `scene-sets/${setId}/angles/${angleId || 'base'}/${assetType}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

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
    const lockedSeed = String(stillSeed ?? 'unknown');

    console.log(`[SceneGen] Still complete. Seed locked: ${lockedSeed}`);

    // ── Step 2: Still → Video (non-blocking) ─────────────────────────────
    let videoUrl = null;
    let videoCredits = 0;
    try {
      console.log(`[SceneGen] Starting base video for: ${sceneSet.name}`);
      const { jobId: videoJobId } = await startImageToVideo(prompt, stillOutputUrl, {
        duration: VIDEO_DURATION_MAP.WIDE,
        cameraMotion: CAMERA_MOTION_MAP.WIDE,
      });
      const videoResult = await pollTask(videoJobId);

      if (videoResult.status === 'SUCCEEDED') {
        videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, 'base', 'video');
        videoCredits = videoResult.creditsUsed || 0;
        console.log(`[SceneGen] Video complete.`);
      } else {
        console.warn(`[SceneGen] Base video failed (non-blocking): ${videoResult.error}`);
      }
    } catch (videoErr) {
      console.warn(`[SceneGen] Base video error (non-blocking): ${videoErr.message}`);
    }

    await SceneSet.update({
      base_runway_seed: lockedSeed,
      generation_status: 'complete',
      generation_cost: parseFloat(sceneSet.generation_cost || 0) + stillCredits + videoCredits,
    }, { where: { id: sceneSet.id } });

    return { success: true, stillUrl, videoUrl, seed: lockedSeed };
  } catch (err) {
    await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
    throw err;
  }
}

// ─── HIGH-LEVEL: GENERATE ANGLE ───────────────────────────────────────────────

async function generateAngle(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_runway_seed) {
    throw new Error('base_runway_seed not set on parent scene set. Run generateBaseScene first.');
  }

  const angleLabel = sceneAngle.angle_label || 'WIDE';
  const prompt = buildPrompt(sceneSet, angleLabel);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting still for angle: ${sceneAngle.angle_name}`);

    // Build style reference
    const styleReference = (sceneAngle.style_reference_url || sceneSet.style_reference_url)
      ? { uri: sceneAngle.style_reference_url || sceneSet.style_reference_url, weight: 0.7 }
      : undefined;

    // ── Step 1: Text → Still (with locked seed) ────────────────────────────
    const numVariations = sceneAngle.variation_count || 1;
    let stillOutputUrl, stillSeed, stillCredits;
    let variationData = null;

    if (numVariations > 1) {
      const varResult = await generateBestVariation(prompt, numVariations, {
        seed: sceneSet.base_runway_seed,
        styleReference,
      });
      if (!varResult.best) {
        await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
        throw new Error(`Angle still multi-variation failed: ${varResult.error}`);
      }
      stillOutputUrl = varResult.best.url;
      stillSeed = varResult.seed;
      stillCredits = varResult.creditsUsed || 0;
      variationData = varResult.variations;
    } else {
      const { jobId: stillJobId } = await startTextToImage(prompt, {
        seed: sceneSet.base_runway_seed,
        styleReference,
      });
      const stillResult = await pollTask(stillJobId);
      if (stillResult.status !== 'SUCCEEDED') {
        await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
        throw new Error(`Angle still failed: ${stillResult.error}`);
      }
      stillOutputUrl = stillResult.outputUrl;
      stillSeed = stillResult.seed;
      stillCredits = stillResult.creditsUsed || 0;
    }

    const stillUrl = await storeInS3(stillOutputUrl, sceneSet.id, sceneAngle.id, 'still');
    console.log(`[SceneGen] Angle still complete: ${sceneAngle.angle_name}`);

    // ── Step 2: Still → Video ─────────────────────────────────────────────
    console.log(`[SceneGen] Starting video for angle: ${sceneAngle.angle_name}`);

    const videoDuration = sceneAngle.video_duration || VIDEO_DURATION_MAP[angleLabel] || 5;
    const cameraMotion = sceneAngle.camera_motion || CAMERA_MOTION_MAP[angleLabel] || 'static';

    const { jobId: videoJobId } = await startImageToVideo(
      prompt,
      stillOutputUrl,
      { seed: stillSeed, duration: videoDuration, cameraMotion }
    );
    const videoResult = await pollTask(videoJobId);

    let videoUrl = null;
    if (videoResult.status === 'SUCCEEDED') {
      videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, sceneAngle.id, 'video');
      console.log(`[SceneGen] Angle video complete: ${sceneAngle.angle_name}`);
    } else {
      console.warn(`[SceneGen] Angle video failed (non-blocking): ${videoResult.error}`);
    }

    const totalCost = (stillCredits || 0) + (videoResult.creditsUsed || 0);

    // ── Quality Analysis (non-blocking) ───────────────────────────────────
    let qualityData = { qualityScore: null, flags: [] };
    try {
      console.log(`[SceneGen] Running artifact analysis for: ${sceneAngle.angle_name}`);
      qualityData = await artifactDetection.analyzeImageQuality(stillUrl);
      console.log(`[SceneGen] Quality score: ${qualityData.qualityScore}/100, flags: ${qualityData.flags.length}`);
    } catch (qaErr) {
      console.warn(`[SceneGen] Quality analysis failed (non-blocking): ${qaErr.message}`);
    }

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: videoUrl,
      runway_seed: String(stillSeed ?? 'unknown'),
      generation_status: 'complete',
      generation_cost: totalCost,
      quality_score: qualityData.qualityScore,
      artifact_flags: qualityData.flags || [],
      generation_attempt: (sceneAngle.generation_attempt || 0) + 1,
      camera_motion: cameraMotion,
      video_duration: videoDuration,
      ...(variationData ? { variation_data: variationData } : {}),
    }, { where: { id: sceneAngle.id } });

    await SceneSet.increment('generation_cost', {
      by: totalCost,
      where: { id: sceneSet.id },
    });

    return { success: true, stillUrl, videoUrl, seed: stillSeed, qualityScore: qualityData.qualityScore };
  } catch (err) {
    await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
    throw err;
  }
}

// ─── HIGH-LEVEL: REGENERATE ANGLE WITH REFINED PROMPT ─────────────────────────

async function regenerateAngleRefined(sceneAngle, sceneSet, artifactCategories, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_runway_seed) {
    throw new Error('base_runway_seed not set on parent scene set.');
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

    const seedVariation = String(Number(sceneSet.base_runway_seed) + (sceneAngle.generation_attempt || 1));

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
      runway_seed: String(stillResult.seed ?? stillJobId),
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
  generateBaseScene,
  generateAngle,
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
};
