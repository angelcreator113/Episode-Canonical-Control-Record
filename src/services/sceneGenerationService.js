'use strict';

/**
 * Scene Generation Service — v1.1
 *
 * Fixes from v1.0:
 *   - Hostname: api.runwayml.com → api.dev.runwayml.com
 *   - API version header: 2024-09-13 → 2024-11-06
 *   - Payload field names: snake_case → camelCase (promptText, promptImage)
 *   - Two-step generation:
 *       Step 1: POST /v1/text_to_image → still image
 *       Step 2: POST /v1/image_to_video → video clip (uses Step 1 URL as promptImage)
 *   - duration: 1 → 5 seconds (API minimum is 2, using 5 for show use)
 *   - ratio: '16:9' → '1280:720' (correct enum value)
 *   - Model: gen3a_turbo (available on both endpoints)
 *
 * Generation flow per angle:
 *   generateStill(prompt)        → polls → returns { stillUrl, seed, jobId }
 *   generateVideo(prompt, still) → polls → returns { videoUrl, jobId }
 *   Both stored in S3, URLs saved to scene_angles record.
 */

const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const RUNWAY_API_BASE    = 'https://api.dev.runwayml.com/v1';
const RUNWAY_API_KEY     = process.env.RUNWAY_ML_API_KEY;
const RUNWAY_API_VERSION = '2024-11-06';
const S3_BUCKET          = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION         = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── LALAVERSE VISUAL ANCHOR (canonical) ─────────────────────────────────────

const LALAVERSE_VISUAL_ANCHOR = `Visual style: Final Fantasy softness meets Pinterest-core femininity with magical realism. Color language: warm neutrals (cream, blush, soft beige), gold accents never chrome, occasional pastel glow (lavender, peach, rose). Natural light is always hero lighting. Material language: soft fabrics (linen, silk, cotton), light wood tones (oak, ash), glass, mirrors, subtle shimmer. Nothing industrial, nothing harsh. Emotional tone: calm, intentional, beautiful but lived-in. Personal over perfect. FORBIDDEN: neon lighting, cyberpunk, overly cluttered decor, ultra-minimal sterile design, dark moody lighting.`;

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

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

function buildPrompt(sceneSet, angleLabel = 'WIDE') {
  const angleModifier = ANGLE_MODIFIERS[angleLabel] || ANGLE_MODIFIERS.WIDE;

  // RunwayML promptText max is 1000 chars — keep it focused
  const descriptionSlice = (sceneSet.canonical_description || '').slice(0, 500);

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
 * Step 1: Generate a still image from text prompt.
 * POST /v1/text_to_image
 * Returns { jobId }
 */
async function startTextToImage(prompt, seed = undefined) {
  const payload = {
    model: 'gen4_image',
    promptText: prompt,
    ratio: '1280:720',
    ...(seed !== undefined ? { seed: parseInt(seed, 10) } : {}),
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
 * POST /v1/image_to_video
 * Returns { jobId }
 */
async function startImageToVideo(prompt, imageUrl, seed = undefined) {
  const payload = {
    model: 'gen3a_turbo',
    promptText: prompt,
    promptImage: imageUrl,
    ratio: '1280:768',
    duration: 5,
    ...(seed !== undefined && !isNaN(Number(seed)) ? { seed: parseInt(seed, 10) } : {}),
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
 * GET /v1/tasks/:id
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
      return {
        status: 'SUCCEEDED',
        outputUrl: Array.isArray(task.output) ? task.output[0] : task.output,
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

    // RUNNING / PENDING — keep polling
    console.log(`  [RunwayML] Task ${jobId} status: ${task.status} (attempt ${attempt + 1}/${maxAttempts})`);
  }

  return { status: 'TIMEOUT', error: `Job ${jobId} did not complete within ${maxWaitMs}ms` };
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

// ─── HIGH-LEVEL: GENERATE BASE SCENE ─────────────────────────────────────────

/**
 * Generate the base still + video for a Scene Set.
 * Locks base_runway_seed on first success — never overwritten.
 * Returns { stillUrl, videoUrl, seed }
 */
async function generateBaseScene(sceneSet, models) {
  const { SceneSet } = models;

  const prompt = buildPrompt(sceneSet, 'WIDE');

  await SceneSet.update(
    { generation_status: 'generating', base_runway_prompt: prompt },
    { where: { id: sceneSet.id } }
  );

  try {
    console.log(`[SceneGen] Starting base still for: ${sceneSet.name}`);

    // ── Step 1: Text → Still ───────────────────────────────────────────────
    const { jobId: stillJobId } = await startTextToImage(prompt);
    const stillResult = await pollTask(stillJobId);

    if (stillResult.status !== 'SUCCEEDED') {
      await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
      throw new Error(`Base still failed: ${stillResult.error}`);
    }

    const stillUrl = await storeInS3(stillResult.outputUrl, sceneSet.id, 'base', 'still');
    const lockedSeed = String(stillResult.seed ?? stillJobId);

    console.log(`[SceneGen] Still complete. Seed locked: ${lockedSeed}`);

    // ── Step 2: Still → Video (non-blocking) ─────────────────────────────
    let videoUrl = null;
    let videoResult = { creditsUsed: 0 };
    try {
      console.log(`[SceneGen] Starting base video for: ${sceneSet.name}`);
      const { jobId: videoJobId } = await startImageToVideo(prompt, stillResult.outputUrl);
      videoResult = await pollTask(videoJobId);

      if (videoResult.status === 'SUCCEEDED') {
        videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, 'base', 'video');
        console.log(`[SceneGen] Video complete.`);
      } else {
        console.warn(`[SceneGen] Base video failed (non-blocking): ${videoResult.error}`);
      }
    } catch (videoErr) {
      console.warn(`[SceneGen] Base video error (non-blocking): ${videoErr.message}`);
    }

    // Lock the seed — permanent
    await SceneSet.update({
      base_runway_seed: lockedSeed,
      generation_status: 'complete',
      generation_cost: parseFloat(sceneSet.generation_cost || 0) +
        (stillResult.creditsUsed || 0) + (videoResult.creditsUsed || 0),
    }, { where: { id: sceneSet.id } });

    return { success: true, stillUrl, videoUrl, seed: lockedSeed };
  } catch (err) {
    await SceneSet.update({ generation_status: 'failed' }, { where: { id: sceneSet.id } });
    throw err;
  }
}

// ─── HIGH-LEVEL: GENERATE ANGLE ───────────────────────────────────────────────

/**
 * Generate still + video for a specific Scene Angle.
 * Uses the parent set's locked base_runway_seed for visual consistency.
 */
async function generateAngle(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_runway_seed) {
    throw new Error('base_runway_seed not set on parent scene set. Run generateBaseScene first.');
  }

  const prompt = buildPrompt(sceneSet, sceneAngle.angle_label);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting still for angle: ${sceneAngle.angle_name}`);

    // ── Step 1: Text → Still (with locked seed) ────────────────────────────
    const { jobId: stillJobId } = await startTextToImage(prompt, sceneSet.base_runway_seed);
    const stillResult = await pollTask(stillJobId);

    if (stillResult.status !== 'SUCCEEDED') {
      await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
      throw new Error(`Angle still failed: ${stillResult.error}`);
    }

    const stillUrl = await storeInS3(stillResult.outputUrl, sceneSet.id, sceneAngle.id, 'still');
    console.log(`[SceneGen] Angle still complete: ${sceneAngle.angle_name}`);

    // ── Step 2: Still → Video ─────────────────────────────────────────────
    console.log(`[SceneGen] Starting video for angle: ${sceneAngle.angle_name}`);

    const { jobId: videoJobId } = await startImageToVideo(
      prompt,
      stillResult.outputUrl,
      stillResult.seed
    );
    const videoResult = await pollTask(videoJobId);

    let videoUrl = null;
    if (videoResult.status === 'SUCCEEDED') {
      videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, sceneAngle.id, 'video');
      console.log(`[SceneGen] Angle video complete: ${sceneAngle.angle_name}`);
    } else {
      console.warn(`[SceneGen] Angle video failed (non-blocking): ${videoResult.error}`);
    }

    const totalCost = (stillResult.creditsUsed || 0) + (videoResult.creditsUsed || 0);

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: videoUrl,
      runway_seed: String(stillResult.seed ?? stillJobId),
      generation_status: 'complete',
      generation_cost: totalCost,
    }, { where: { id: sceneAngle.id } });

    // Update cumulative set cost
    await SceneSet.increment('generation_cost', {
      by: totalCost,
      where: { id: sceneSet.id },
    });

    return { success: true, stillUrl, videoUrl, seed: stillResult.seed };
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
  pollTask,
  LALAVERSE_VISUAL_ANCHOR,
  ANGLE_MODIFIERS,
};
