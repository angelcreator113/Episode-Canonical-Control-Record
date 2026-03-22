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
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

  // RunwayML promptText max is 1000 chars — keep it focused
  const descriptionSlice = (sceneSet.canonical_description || '').slice(0, 500);

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
 * Step 1: Generate a still image from text prompt.
 * POST /v1/text_to_image
 * Returns { jobId }
 */
async function startTextToImage(prompt, seed = undefined) {
  const parsedSeed = seed != null && /^\d+$/.test(String(seed)) ? Number(seed) : undefined;
  const payload = {
    model: 'gen4_image',
    promptText: prompt,
    ratio: '1280:720',
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
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
  const parsedSeed = seed != null && /^\d+$/.test(String(seed)) ? Number(seed) : undefined;
  const payload = {
    model: 'gen3a_turbo',
    promptText: prompt,
    promptImage: imageUrl,
    ratio: '1280:768',
    duration: 5,
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
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

    // Lock the seed + base still URL — permanent
    await SceneSet.update({
      base_runway_seed: lockedSeed,
      base_still_url: stillUrl,
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

    // Upload frame to S3
    const frameBuffer = fs.readFileSync(tmpFrame);
    const s3Key = `scene-sets/${setId}/angles/${angleId}/still.jpg`;
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
    try { fs.unlinkSync(tmpVideo); } catch (_) {}
    try { fs.unlinkSync(tmpFrame); } catch (_) {}
  }
}

async function generateAngle(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_still_url) {
    throw new Error('base_still_url not set on parent scene set. Run generateBaseScene first.');
  }

  // Use movement-focused prompt for video (scene is already in the base image)
  const videoPrompt = buildVideoPrompt(sceneSet, sceneAngle.angle_label, sceneAngle.camera_direction);
  // Keep the full prompt for logging/debugging
  const fullPrompt = buildPrompt(sceneSet, sceneAngle.angle_label, sceneAngle.camera_direction);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: fullPrompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    console.log(`[SceneGen] Starting image-anchored video for angle: ${sceneAngle.angle_name}`);
    console.log(`[SceneGen] Video prompt: ${videoPrompt}`);

    // Image-anchored: use base still as promptImage → image_to_video directly
    const { jobId: videoJobId } = await startImageToVideo(
      videoPrompt,
      sceneSet.base_still_url,
    );
    const videoResult = await pollTask(videoJobId);

    if (videoResult.status !== 'SUCCEEDED') {
      await SceneAngle.update({ generation_status: 'failed' }, { where: { id: sceneAngle.id } });
      throw new Error(`Angle video failed: ${videoResult.error}`);
    }

    const videoUrl = await storeInS3(videoResult.outputUrl, sceneSet.id, sceneAngle.id, 'video');
    console.log(`[SceneGen] Angle video complete: ${sceneAngle.angle_name}`);

    // Extract first frame from the generated video as this angle's still
    let stillUrl = sceneSet.base_still_url; // fallback
    try {
      stillUrl = await extractFirstFrame(videoUrl, sceneSet.id, sceneAngle.id);
      console.log(`[SceneGen] First frame extracted for: ${sceneAngle.angle_name}`);
    } catch (frameErr) {
      console.warn(`[SceneGen] First frame extraction failed (using base still): ${frameErr.message}`);
    }

    const totalCost = videoResult.creditsUsed || 0;

    await SceneAngle.update({
      still_image_url: stillUrl,
      video_clip_url: videoUrl,
      runway_seed: String(videoResult.seed ?? videoJobId),
      generation_status: 'complete',
      generation_cost: totalCost,
    }, { where: { id: sceneAngle.id } });

    // Update cumulative set cost
    await SceneSet.increment('generation_cost', {
      by: totalCost,
      where: { id: sceneSet.id },
    });

    return { success: true, stillUrl, videoUrl, seed: videoResult.seed };
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
  pollTask,
  LALAVERSE_VISUAL_ANCHOR,
  ANGLE_MODIFIERS,
  VIDEO_MOVEMENT_MODIFIERS,
};
