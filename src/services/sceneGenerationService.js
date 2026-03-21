'use strict';

/**
 * Scene Generation Service
 *
 * Handles RunwayML API calls for Scene Set generation.
 * Builds prompts from canonical_description + LalaVerse visual language.
 * Stores outputs in S3. Manages seed locking.
 *
 * RunwayML API used: Gen-3 Alpha Turbo (image-to-video and text-to-image)
 * Note: The existing RunwayMLService handles background removal and image
 * enhancement. This service is for generative scene creation — different
 * endpoints, different purpose.
 */

const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const RUNWAY_API_BASE = 'https://api.runwayml.com/v1';
const RUNWAY_API_KEY  = process.env.RUNWAY_ML_API_KEY;
const S3_BUCKET       = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION      = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── LALAVERSE VISUAL LANGUAGE (canonical anchor) ─────────────────────────────

const LALAVERSE_VISUAL_ANCHOR = `
Visual style: Final Fantasy softness meets Pinterest-core femininity with magical realism.
Color language: warm neutrals (cream, blush, soft beige), gold accents (never chrome), occasional pastel glow (lavender, peach, rose). Natural light is always hero lighting.
Material language: soft fabrics (linen, silk, cotton), light wood tones (oak, ash), glass, mirrors, subtle shimmer. Nothing industrial, nothing harsh.
Emotional tone: calm, intentional, beautiful but lived-in. Personal over perfect.
FORBIDDEN: neon lighting, cyberpunk elements, overly cluttered decor, ultra-minimal sterile design, dark moody lighting, Pinterest maximalism explosion, IKEA catalog emptiness.
`.trim();

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

  const parts = [
    LALAVERSE_VISUAL_ANCHOR,
    '',
    `LOCATION: ${sceneSet.name}`,
    sceneSet.canonical_description || '',
    '',
    `CAMERA: ${angleModifier}`,
    '',
    sceneSet.mood_tags?.length
      ? `MOOD: ${sceneSet.mood_tags.join(', ')}`
      : '',
    sceneSet.aesthetic_tags?.length
      ? `AESTHETIC: ${sceneSet.aesthetic_tags.join(', ')}`
      : '',
    '',
    'Cinematic quality. Soft natural lighting. No text overlays. No watermarks. Still frame suitable for background use.',
  ];

  return parts.filter(p => p !== undefined).join('\n').trim();
}

// ─── RUNWAY API CALLS ─────────────────────────────────────────────────────────

async function generateStill(prompt, options = {}) {
  if (!RUNWAY_API_KEY) throw new Error('RUNWAY_ML_API_KEY not configured');

  const payload = {
    model: options.model || 'gen3a_turbo',
    prompt_text: prompt,
    seed: options.seed || undefined,
    ratio: options.ratio || '16:9',
    duration: 1,
  };

  try {
    const response = await axios.post(
      `${RUNWAY_API_BASE}/image_to_video`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${RUNWAY_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-09-13',
        },
        timeout: 30000,
      }
    );

    return {
      jobId: response.data.id,
      status: response.data.status || 'RUNNING',
    };
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    throw new Error(`RunwayML generation failed: ${detail}`);
  }
}

async function pollGenerationStatus(jobId, maxWaitMs = 120000) {
  if (!RUNWAY_API_KEY) throw new Error('RUNWAY_ML_API_KEY not configured');

  const pollInterval = 3000;
  const maxAttempts = Math.floor(maxWaitMs / pollInterval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    const response = await axios.get(
      `${RUNWAY_API_BASE}/tasks/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-09-13',
        },
        timeout: 15000,
      }
    );

    const task = response.data;

    if (task.status === 'SUCCEEDED') {
      return {
        status: 'SUCCEEDED',
        outputUrl: task.output?.[0] || null,
        seed: task.seed || null,
        cost: task.credits_used || 0,
      };
    }

    if (task.status === 'FAILED') {
      return {
        status: 'FAILED',
        error: task.failure || 'Unknown failure',
      };
    }
  }

  return { status: 'TIMEOUT', error: `Job ${jobId} did not complete within ${maxWaitMs}ms` };
}

// ─── S3 STORAGE ───────────────────────────────────────────────────────────────

async function storeInS3(sourceUrl, setId, angleId, assetType) {
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  const buffer = Buffer.from(response.data);
  const contentType = response.headers['content-type'] || 'video/mp4';
  const ext = contentType.includes('image') ? 'jpg'
            : contentType.includes('mp4') ? 'mp4'
            : 'bin';

  const s3Key = `scene-sets/${setId}/angles/${angleId}/${assetType}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── HIGH-LEVEL ORCHESTRATION ─────────────────────────────────────────────────

async function generateBaseScene(sceneSet, models) {
  const { SceneSet } = models;

  const prompt = buildPrompt(sceneSet, 'WIDE');

  await SceneSet.update(
    { generation_status: 'generating', base_runway_prompt: prompt },
    { where: { id: sceneSet.id } }
  );

  try {
    const { jobId } = await generateStill(prompt, {
      model: sceneSet.base_runway_model || 'gen3a_turbo',
    });

    const result = await pollGenerationStatus(jobId);

    if (result.status !== 'SUCCEEDED') {
      await SceneSet.update(
        { generation_status: 'failed' },
        { where: { id: sceneSet.id } }
      );
      throw new Error(`Base generation failed: ${result.error}`);
    }

    const baseAngleId = 'base';
    const stillUrl = await storeInS3(result.outputUrl, sceneSet.id, baseAngleId, 'still');

    // LOCK the seed — never overwrite this
    await SceneSet.update({
      base_runway_seed: String(result.seed || jobId),
      generation_status: 'complete',
      generation_cost: parseFloat(sceneSet.generation_cost || 0) + (result.cost || 0),
    }, { where: { id: sceneSet.id } });

    return { success: true, stillUrl, seed: result.seed };
  } catch (err) {
    await SceneSet.update(
      { generation_status: 'failed' },
      { where: { id: sceneSet.id } }
    );
    throw err;
  }
}

async function generateAngle(sceneAngle, sceneSet, models) {
  const { SceneAngle, SceneSet } = models;

  if (!sceneSet.base_runway_seed) {
    throw new Error('Cannot generate angle: base_runway_seed not set. Run generateBaseScene first.');
  }

  const prompt = buildPrompt(sceneSet, sceneAngle.angle_label);

  await SceneAngle.update(
    { generation_status: 'generating', runway_prompt: prompt },
    { where: { id: sceneAngle.id } }
  );

  try {
    const { jobId } = await generateStill(prompt, {
      model: sceneSet.base_runway_model || 'gen3a_turbo',
      seed: sceneSet.base_runway_seed,
    });

    await SceneAngle.update({ runway_job_id: jobId }, { where: { id: sceneAngle.id } });

    const result = await pollGenerationStatus(jobId);

    if (result.status !== 'SUCCEEDED') {
      await SceneAngle.update(
        { generation_status: 'failed' },
        { where: { id: sceneAngle.id } }
      );
      throw new Error(`Angle generation failed: ${result.error}`);
    }

    const stillUrl = await storeInS3(result.outputUrl, sceneSet.id, sceneAngle.id, 'still');

    await SceneAngle.update({
      still_image_url: stillUrl,
      runway_seed: String(result.seed || jobId),
      generation_status: 'complete',
      generation_cost: result.cost || 0,
    }, { where: { id: sceneAngle.id } });

    await SceneSet.increment('generation_cost', {
      by: result.cost || 0,
      where: { id: sceneSet.id },
    });

    return { success: true, stillUrl, seed: result.seed };
  } catch (err) {
    await SceneAngle.update(
      { generation_status: 'failed' },
      { where: { id: sceneAngle.id } }
    );
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
  pollGenerationStatus,
  LALAVERSE_VISUAL_ANCHOR,
  ANGLE_MODIFIERS,
};
