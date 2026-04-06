'use strict';

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const multer  = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { optionalAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/requestValidation');
const Anthropic          = require('@anthropic-ai/sdk');
const sceneGenService    = require('../services/sceneGenerationService');
const artifactService    = require('../services/artifactDetectionService');
const postProcessService = require('../services/postProcessingService');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}
const refinementQueue    = require('../queues/sceneRefinementQueue');
const { SceneSet, SceneAngle, Show, Episode, SceneSetEpisode, GenerationJob } = require('../models');

const S3_BUCKET  = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});

const uploadSceneSetImages = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 20 },
]);

// Ensure generation_jobs table exists (safe to call multiple times)
let generationJobsSynced = false;
async function ensureGenerationJobsTable() {
  if (generationJobsSynced || !GenerationJob) return;
  try {
    // Add timeout to prevent sync from hanging
    await Promise.race([
      GenerationJob.sync(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 5000)),
    ]);
    generationJobsSynced = true;
  } catch (err) {
    console.warn('[SceneSets] GenerationJob sync failed (non-fatal):', err.message);
    generationJobsSynced = true; // Don't retry — accept it's unavailable
  }
}

// ─── GET /  — list all scene sets ─────────────────────────────────────────────

router.get('/', optionalAuth, async (req, res) => {
  try {
    let sets;
    try {
      const includes = [{ model: SceneAngle, as: 'angles', required: false }];
      if (Show) includes.push({ model: Show, as: 'show', attributes: ['id', 'name', 'icon', 'color'], required: false });
      if (Episode && SceneSetEpisode) {
        includes.push({
          model: Episode,
          as: 'episodes',
          attributes: ['id', 'title', 'episode_number', 'season_number'],
          through: { attributes: [] },
          required: false,
        });
      }
      sets = await SceneSet.findAll({
        include: includes,
        order: [['created_at', 'DESC']],
      });
    } catch (includeErr) {
      console.warn('Scene Sets query with includes failed, retrying minimal:', includeErr.message);
      try {
        sets = await SceneSet.findAll({ order: [['created_at', 'DESC']] });
      } catch (minErr) {
        console.warn('Scene Sets minimal query also failed:', minErr.message);
        return res.json({ success: true, count: 0, data: [], note: minErr.message });
      }
    }
    res.json({ success: true, count: (sets || []).length, data: sets || [] });
  } catch (err) {
    console.error('Scene Sets GET / error:', err);
    res.json({ success: true, count: 0, data: [], note: err.message });
  }
});

// ─── POST /  — create a new scene set ─────────────────────────────────────────

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      name,
      scene_type,
      canonical_description,
      mood_tags,
      aesthetic_tags,
      beat_numbers,
      universe_id,
      show_id,
      base_runway_model,
      notes,
      episode_ids,
    } = req.body;

    if (!name || !scene_type) {
      return res.status(400).json({ success: false, error: 'name and scene_type are required' });
    }

    const createFields = {
      name,
      scene_type,
      canonical_description: canonical_description || null,
      mood_tags: mood_tags || [],
      aesthetic_tags: aesthetic_tags || [],
      beat_numbers: beat_numbers || [],
      universe_id: universe_id || null,
      show_id: show_id || null,
      base_runway_model: base_runway_model || 'gen3a_turbo',
      notes: notes || null,
      generation_status: canonical_description ? 'generating' : 'pending',
    };
    let set;
    try {
      set = await SceneSet.create(createFields);
    } catch (createErr) {
      // Retry without generation_status if the column doesn't exist yet
      if (createErr.message && createErr.message.includes('generation_status')) {
        delete createFields.generation_status;
        set = await SceneSet.create(createFields);
      } else {
        throw createErr;
      }
    }

    // Link episodes if provided
    if (Array.isArray(episode_ids) && episode_ids.length > 0 && SceneSetEpisode) {
      for (const epId of episode_ids) {
        await SceneSetEpisode.findOrCreate({
          where: { scene_set_id: set.id, episode_id: epId },
          defaults: { scene_set_id: set.id, episode_id: epId },
        });
      }
    }

    // Auto-enqueue base generation when a description is provided
    let jobId = null;
    if (canonical_description) {
      await ensureGenerationJobsTable();
      const job = await GenerationJob.create({
        job_type: 'generate_base',
        scene_set_id: set.id,
        payload: {},
      });
      jobId = job.id;
    }

    res.status(201).json({ success: true, data: set, jobId });
  } catch (err) {
    console.error('Scene Sets POST / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:id  — single scene set with angles ────────────────────────────────

router.get('/:id', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const includes = [{ model: SceneAngle, as: 'angles' }];
    if (Show) includes.push({ model: Show, as: 'show', attributes: ['id', 'name', 'icon', 'color'] });
    if (Episode && SceneSetEpisode) {
      includes.push({
        model: Episode,
        as: 'episodes',
        attributes: ['id', 'title', 'episode_number', 'season_number'],
        through: { attributes: [] },
      });
    }
    const set = await SceneSet.findByPk(req.params.id, {
      include: includes,
      order: [[{ model: SceneAngle, as: 'angles' }, 'sort_order', 'ASC']],
    });
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });
    res.json({ success: true, data: set });
  } catch (err) {
    console.error('Scene Sets GET /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:id  — update a scene set ──────────────────────────────────────────

router.put('/:id', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const allowed = [
      'name', 'scene_type', 'canonical_description',
      'mood_tags', 'aesthetic_tags', 'beat_numbers',
      'base_runway_model', 'base_still_url', 'notes',
      'style_reference_url', 'negative_prompt', 'variation_count',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await set.update(updates);
    res.json({ success: true, data: set });
  } catch (err) {
    console.error('Scene Sets PUT /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:id  — soft-delete a scene set ──────────────────────────────────

router.delete('/:id', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });
    await set.destroy();
    res.json({ success: true, message: 'Scene set deleted' });
  } catch (err) {
    console.error('Scene Sets DELETE /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/upload-base  — upload a custom base image ─────────────────────

router.post('/:id/upload-base', validateUUIDParam('id'), optionalAuth, uploadSceneSetImages, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });
    const uploaded = [
      ...(req.files?.images || []),
      ...(req.files?.image || []),
    ].filter(Boolean);
    if (uploaded.length === 0) return res.status(400).json({ success: false, error: 'No image file provided' });

    const uploadedUrls = [];
    for (let i = 0; i < uploaded.length; i += 1) {
      const file = uploaded[i];
      const ext = file.mimetype === 'image/png' ? 'png'
                : file.mimetype === 'image/webp' ? 'webp'
                : 'jpg';
      const ts = Date.now();
      const s3Key = `scene-sets/${set.id}/angles/base/still-${ts}-${i}.${ext}`;

      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }));

      uploadedUrls.push({
        url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`,
        originalName: file.originalname || `Upload ${i + 1}`,
      });
    }

    const primaryUrl = uploadedUrls[0].url;

    // Clean up old base image from S3
    if (set.base_still_url) {
      try {
        const bucketHost = `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;
        const idx = set.base_still_url.indexOf(bucketHost);
        if (idx !== -1) {
          const oldKey = decodeURIComponent(set.base_still_url.slice(idx + bucketHost.length));
          await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }));
        }
      } catch (_) { /* best-effort cleanup */ }
    }

    await set.update({
      base_still_url: primaryUrl,
      base_runway_seed: `uploaded-${Date.now()}`,
      generation_status: 'complete',
    });

    // Auto-analyze uploaded image with Claude Vision to fill description, prompt, and suggest angles
    let visionAnalysis = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = getAnthropicClient();
        const visionResponse = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: primaryUrl } },
              { type: 'text', text: `Analyze this location image for a luxury fashion show called "Styling Adventures with Lala".

Return a JSON object with these fields:
{
  "description": "2-3 sentence description of the space — layout, key furniture/features, lighting, mood, color palette, materials.",
  "prompt": "A detailed scene generation prompt to recreate this space. Include: architectural style, lighting, colors, key objects, materials, atmosphere. Start with 'Empty room.' Under 400 characters.",
  "scene_type": "HOME_BASE | CLOSET | EVENT_LOCATION | TRANSITION | EXTERIOR",
  "mood_tags": ["3-5", "mood", "words"],
  "suggested_angles": [
    {
      "label": "SHORT_UPPERCASE_LABEL",
      "name": "Human-readable name",
      "description": "What this angle shows — be specific to THIS location",
      "camera_direction": "Detailed camera instruction for generating this view. Include position, direction, what should be visible, and how to extend the space beyond what the reference shows."
    }
  ]
}

IMPORTANT for suggested_angles:
- Suggest 4-6 angles that make sense for THIS SPECIFIC location
- Do NOT include generic angles that don't fit (e.g. no CLOSET for a restaurant, no VANITY for an outdoor space)
- Each angle should show a DIFFERENT part or perspective of the space
- camera_direction should instruct the AI to extend/imagine the room beyond the reference image
- Use labels like: WIDE, ENTRANCE, BAR, SEATING, STAGE, BACKSTAGE, TABLE, SKYLINE, GARDEN, BALCONY, HALLWAY, LOBBY, POOL, KITCHEN, BED, CLOSET, VANITY, WINDOW, DOORWAY, OVERHEAD, DETAIL, etc.
- First angle should always be the widest/most establishing view

Return ONLY the JSON object, no other text.` },
            ],
          }],
        });

        const text = visionResponse.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          visionAnalysis = JSON.parse(jsonMatch[0]);
          const updates = {};
          if (visionAnalysis.description && !set.canonical_description) {
            updates.canonical_description = visionAnalysis.description;
          }
          if (visionAnalysis.prompt && !set.base_runway_prompt) {
            updates.base_runway_prompt = visionAnalysis.prompt;
          }
          if (visionAnalysis.scene_type && !set.scene_type) {
            updates.scene_type = visionAnalysis.scene_type;
          }
          if (visionAnalysis.mood_tags && (!set.mood_tags || set.mood_tags.length === 0)) {
            updates.mood_tags = visionAnalysis.mood_tags;
          }
          if (Object.keys(updates).length > 0) {
            await set.update(updates);
          }
        }
      } catch (visionErr) {
        console.warn('[SceneSets] Vision analysis failed (non-blocking):', visionErr.message);
      }
    }

    // Create location-appropriate angles based on vision analysis (or handle multi-upload)
    let createdAngles = [];
    if (uploadedUrls.length > 1) {
      // Multi-image upload: create angle entries from each uploaded image
      const existingCount = await SceneAngle.count({ where: { scene_set_id: set.id } });
      createdAngles = await SceneAngle.bulkCreate(
        uploadedUrls.map((img, idx) => {
          const baseName = String(img.originalName || `Upload ${idx + 1}`)
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .trim()
            .slice(0, 100);
          return {
            scene_set_id: set.id,
            angle_label: 'OTHER',
            angle_name: baseName || `Uploaded Angle ${idx + 1}`,
            angle_description: 'Uploaded reference angle',
            camera_direction: 'Uploaded still reference for this room angle.',
            generation_status: 'complete',
            still_image_url: img.url,
            sort_order: existingCount + idx,
          };
        }),
        { returning: true }
      );

      if (!set.cover_angle_id && createdAngles[0]?.id) {
        await set.update({ cover_angle_id: createdAngles[0].id });
      }
    } else if (visionAnalysis?.suggested_angles?.length > 0) {
      // Single image + vision analysis: create location-specific angles
      // Clear old generic angles first
      await SceneAngle.destroy({ where: { scene_set_id: set.id }, force: true });

      createdAngles = await SceneAngle.bulkCreate(
        visionAnalysis.suggested_angles.map((angle, idx) => ({
          scene_set_id: set.id,
          angle_label: (angle.label || 'OTHER').toUpperCase().replace(/[^A-Z_]/g, ''),
          angle_name: angle.name || `Angle ${idx + 1}`,
          angle_description: angle.description || '',
          camera_direction: angle.camera_direction || '',
          generation_status: 'pending',
          sort_order: idx,
        })),
        { returning: true }
      );
    } else {
      // Fallback: reset existing angles to regenerate from new base
      await SceneAngle.update(
        { still_image_url: null, video_clip_url: null, generation_status: 'pending' },
        { where: { scene_set_id: set.id } }
      );
    }

    res.json({
      success: true,
      data: {
        stillUrl: primaryUrl,
        seed: set.base_runway_seed,
        uploadedCount: uploadedUrls.length,
        angleCountCreated: createdAngles.length,
        visionAnalysis: visionAnalysis || null,
      },
    });
  } catch (err) {
    console.error('Scene Sets POST /:id/upload-base error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/generate-base  — generate the base scene ─────────────────────

router.post('/:id/generate-base', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    if (set.base_runway_seed && !req.body?.force) {
      return res.status(409).json({
        success: false,
        error: 'Base already generated. Pass { "force": true } to regenerate.',
        seed: set.base_runway_seed,
      });
    }

    try { await set.update({ generation_status: 'generating' }); } catch (e) {
      console.warn('generate-base: could not update generation_status:', e.message);
    }

    await ensureGenerationJobsTable();
    const job = await GenerationJob.create({
      job_type: 'generate_base',
      scene_set_id: set.id,
      payload: { force: !!(req.body?.force) },
    });

    res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
  } catch (err) {
    console.error('Scene Sets POST /:id/generate-base error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles  — add an angle to a scene set ────────────────────────

// ─── POST /:id/suggest-angles  — AI suggests angles for a scene set ─────────

const VALID_ANGLE_LABELS = ['WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY', 'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'];

function buildFallbackAngleSuggestions(set, existingLabels = []) {
  const candidates = [
    {
      angle_label: 'ESTABLISHING',
      angle_name: `${set.name || 'Location'} Overview`,
      camera_direction: 'Wide establishing view from the room edge, framing key architectural landmarks and entrances.',
      description: 'Introduces layout, status cues, and immediate spatial context for scene transitions.',
      beat_affinity: [1, 2],
    },
    {
      angle_label: 'WIDE',
      angle_name: 'Primary Wide',
      camera_direction: 'Three-quarter wide shot covering the main action zone with headroom for movement.',
      description: 'Best for dialogue movement and scene geography while preserving room identity.',
      beat_affinity: [2, 3, 4],
    },
    {
      angle_label: 'DOORWAY',
      angle_name: 'Entrance Frame',
      camera_direction: 'Camera placed near the doorway to capture arrivals and exits with depth into the room.',
      description: 'Supports reveals, interruptions, and social power shifts through threshold staging.',
      beat_affinity: [1, 4],
    },
    {
      angle_label: 'WINDOW',
      angle_name: 'Window Side',
      camera_direction: 'Side angle near windows to use natural backlight and contour faces against the interior.',
      description: 'Useful for reflective beats and visual contrast between interior and exterior mood.',
      beat_affinity: [3, 5],
    },
    {
      angle_label: 'CLOSE',
      angle_name: 'Detail Close',
      camera_direction: 'Tight framing on a key decor plane or character position to emphasize texture and stakes.',
      description: 'Highlights emotional pressure and luxury detail without losing scene continuity.',
      beat_affinity: [4, 5],
    },
  ];

  const existingSet = new Set(existingLabels || []);
  return candidates
    .filter((c) => !existingSet.has(c.angle_label))
    .slice(0, 5);
}

router.post('/:id/suggest-angles', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id, {
      include: [{ model: SceneAngle, as: 'angles' }],
    });
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const existingLabels = (set.angles || []).map(a => a.angle_label);
    const sceneType = set.scene_type || 'OTHER';
    const descriptionContext = [
      set.canonical_description,
      set.script_context,
      set.base_runway_prompt,
      set.name ? `Location name: ${set.name}` : null,
      set.scene_type ? `Location type: ${set.scene_type}` : null,
    ].filter(Boolean).join('\n');

    if (!descriptionContext) {
      return res.status(400).json({ success: false, error: 'Add a scene set name or description first' });
    }

    const prompt = `You are a cinematic director planning camera angles and room coverage for a scene location.

Scene name: ${set.name}
Scene type: ${sceneType}
Description: ${descriptionContext}
${set.mood_tags?.length ? `Mood: ${set.mood_tags.join(', ')}` : ''}
${set.aesthetic_tags?.length ? `Aesthetic: ${set.aesthetic_tags.join(', ')}` : ''}
${existingLabels.length ? `Already created angles: ${existingLabels.join(', ')} — do NOT suggest duplicates of these.` : ''}

Suggest 4-6 distinct camera angles or room areas for this location. For event spaces, include BOTH different camera angles of the main space AND separate areas/rooms (entrance, outdoor area, interior rooms, etc.).

Valid angle_label values: ${VALID_ANGLE_LABELS.join(', ')}. Use OTHER for non-standard angles.

Return ONLY a JSON array with objects containing:
- angle_label: one of the valid labels above
- angle_name: a short descriptive name (2-4 words, e.g. "Glass Door Entrance")
- camera_direction: detailed camera placement and framing description (1-2 sentences)
- description: what this angle captures and why it matters for storytelling (1 sentence)
- beat_affinity: array of beat numbers 1-5 this angle works best for (e.g. [1,2])

Return raw JSON only, no markdown or explanation.`;

    let suggestions;
    try {
      const client = getAnthropicClient();
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text.trim();
      try {
        suggestions = JSON.parse(text);
      } catch {
        // Try to extract JSON array from response
        const match = text.match(/\[[\s\S]*\]/);
        if (match) suggestions = JSON.parse(match[0]);
        else throw new Error('Could not parse AI suggestions');
      }
    } catch (aiErr) {
      console.warn('Scene Sets suggest-angles AI unavailable, using fallback suggestions:', aiErr?.message || aiErr);
      suggestions = buildFallbackAngleSuggestions(set, existingLabels);
      return res.json({
        success: true,
        data: suggestions,
        meta: {
          source: 'fallback',
          warning: 'AI suggestions unavailable; returned default cinematic angle set.',
        },
      });
    }

    // Validate and sanitize
    suggestions = suggestions
      .filter(s => s.angle_label && s.angle_name)
      .map(s => ({
        angle_label: VALID_ANGLE_LABELS.includes(s.angle_label) ? s.angle_label : 'OTHER',
        angle_name: String(s.angle_name).slice(0, 100),
        camera_direction: String(s.camera_direction || '').slice(0, 300),
        description: String(s.description || '').slice(0, 200),
        beat_affinity: Array.isArray(s.beat_affinity) ? s.beat_affinity.filter(b => Number.isInteger(b) && b >= 1 && b <= 10) : [],
      }));

    res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('Scene Sets POST /:id/suggest-angles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/ai-camera-direction  — AI generates camera direction for an angle

router.post('/:id/ai-camera-direction', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const { angle_label, angle_name } = req.body;
    if (!angle_label) return res.status(400).json({ success: false, error: 'angle_label is required' });

    const prompt = `You are a cinematic director. Generate a camera direction for this scene angle.

Scene: ${set.name}
Description: ${set.canonical_description || 'No description available'}
Angle label: ${angle_label}
${angle_name ? `Angle name: ${angle_name}` : ''}

Write a concise camera placement and framing direction (1-2 sentences). Describe where the camera is, what it's facing, and the composition. Return only the direction text, nothing else.`;

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });

    const direction = message.content[0].text.trim();
    res.json({ success: true, data: { camera_direction: direction } });
  } catch (err) {
    console.error('Scene Sets POST /:id/ai-camera-direction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles  — add an angle to a scene set ────────────────────────

router.post('/:id/angles', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const {
      angle_name,
      angle_label,
      angle_description,
      beat_affinity,
      camera_direction,
      camera_motion,
      video_duration,
      style_reference_url,
      variation_count,
    } = req.body;

    if (!angle_label || !angle_name) {
      return res.status(400).json({ success: false, error: 'angle_name and angle_label are required' });
    }

    const angle = await SceneAngle.create({
      scene_set_id: set.id,
      angle_name,
      angle_label,
      angle_description: angle_description || null,
      beat_affinity: beat_affinity || [],
      camera_direction: camera_direction || null,
      camera_motion: camera_motion || null,
      video_duration: video_duration || null,
      style_reference_url: style_reference_url || null,
      variation_count: variation_count || 1,
      generation_status: 'pending',
    });

    res.status(201).json({ success: true, data: angle });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/generate  — generate a specific angle ────────

router.post('/:id/angles/:angleId/generate', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    await ensureGenerationJobsTable();
    const job = await GenerationJob.create({
      job_type: 'generate_angle',
      scene_set_id: set.id,
      scene_angle_id: angle.id,
      payload: {},
    });

    // Mark the angle as generating and clear stale assets so the frontend shows a spinner
    try {
      await angle.update({ generation_status: 'generating', still_image_url: null, video_clip_url: null });
    } catch (e) {
      console.warn('generate-angle: could not update angle status:', e.message);
    }

    res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/generate-video  — on-demand video for an angle ─

router.post('/:id/angles/:angleId/generate-video', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    if (!angle.still_image_url && !set.base_still_url) {
      return res.status(400).json({
        success: false,
        error: 'No source image available. Generate the angle still first.',
      });
    }

    await ensureGenerationJobsTable();
    const job = await GenerationJob.create({
      job_type: 'generate_angle_video',
      scene_set_id: set.id,
      scene_angle_id: angle.id,
      payload: {},
    });

    // Note: angle stays 'complete' (still visible) while video generates in background
    res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/generate-video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:id/angles/:angleId  — soft-delete a single angle ──────────────

router.delete('/:id/angles/:angleId', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: req.params.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });
    await angle.destroy();
    res.json({ success: true, message: 'Angle deleted' });
  } catch (err) {
    console.error('Scene Sets DELETE /:id/angles/:angleId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/upload  — upload image for an angle ───────────

router.post('/:id/angles/:angleId/upload', validateUUIDParam('id'), optionalAuth, uploadSceneSetImages, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: req.params.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    const uploaded = [
      ...(req.files?.images || []),
      ...(req.files?.image || []),
    ].filter(Boolean);
    if (uploaded.length === 0) return res.status(400).json({ success: false, error: 'No image file provided' });

    const file = uploaded[0];
    const ext = file.mimetype === 'image/png' ? 'png'
              : file.mimetype === 'image/webp' ? 'webp'
              : 'jpg';
    const ts = Date.now();
    const s3Key = `scene-sets/${req.params.id}/angles/${angle.id}/still-${ts}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'max-age=31536000',
    }));

    const imageUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    await angle.update({
      still_image_url: imageUrl,
      generation_status: 'complete',
    });

    res.json({ success: true, data: angle });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /:id/angles/:angleId  — rename / update angle fields ──────────────

router.patch('/:id/angles/:angleId', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: req.params.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    const allowed = ['angle_label', 'angle_name', 'angle_description', 'camera_direction', 'beat_affinity'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updatable fields provided' });
    }

    await angle.update(updates);
    res.json({ success: true, data: angle });
  } catch (err) {
    console.error('Scene Sets PATCH /:id/angles/:angleId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:id/angles  — delete all angles for a scene set ─────────────────

router.delete('/:id/angles', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });
    const count = await SceneAngle.destroy({ where: { scene_set_id: set.id } });
    res.json({ success: true, message: `Deleted ${count} angles` });
  } catch (err) {
    console.error('Scene Sets DELETE /:id/angles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /artifact-categories  — list all artifact categories ────────────────

router.get('/artifact-categories', optionalAuth, async (req, res) => {
  try {
    res.json({ success: true, data: artifactService.ARTIFACT_CATEGORIES });
  } catch (err) {
    console.error('Scene Sets GET /artifact-categories error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/review  — submit manual quality review ───────

router.post('/:id/angles/:angleId/review', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: req.params.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    const { categories, notes } = req.body;
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ success: false, error: 'categories must be an array of artifact category keys' });
    }

    const review = artifactService.createManualReview(categories, notes || null);

    await angle.update({
      quality_review: review,
      quality_score: review.qualityScore,
      artifact_flags: review.flags,
    });

    res.json({ success: true, data: { review, refinedPromptSuffix: review.refinedPromptSuffix } });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/review error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/analyze  — run auto quality analysis ─────────

router.post('/:id/angles/:angleId/analyze', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: req.params.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });
    if (!angle.still_image_url) {
      return res.status(400).json({ success: false, error: 'No still image to analyze' });
    }

    const analysis = await artifactService.analyzeImageQuality(angle.still_image_url);

    await angle.update({
      quality_score: analysis.qualityScore,
      artifact_flags: analysis.flags,
    });

    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/analyze error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/regenerate  — regenerate with refined prompt ──

router.post('/:id/angles/:angleId/regenerate', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    // Accept artifact categories to address, or use previously flagged ones
    const categories = req.body.categories
      || (angle.artifact_flags || []).map(f => f.category).filter(Boolean);

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No artifact categories specified. Submit a review first or pass categories in the request body.',
      });
    }

    const result = await sceneGenService.regenerateAngleRefined(
      angle, set, categories, { SceneAngle, SceneSet }
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/regenerate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/post-process  — run post-processing pipeline ─

router.post('/:id/angles/:angleId/post-process', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    if (!angle.still_image_url) {
      return res.status(400).json({ success: false, error: 'No generated assets to post-process' });
    }

    const options = {
      skipSharp: req.body.skipSharp || false,
      skipCloudinary: req.body.skipCloudinary || false,
      skipFFmpeg: req.body.skipFFmpeg || false,
      sharpOptions: req.body.sharpOptions || {},
      cloudinarySettings: req.body.cloudinarySettings || {},
      ffmpegOptions: req.body.ffmpegOptions || {},
    };

    const result = await postProcessService.processAngleAssets(angle, set, { SceneAngle }, options);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/post-process error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/angles/:angleId/auto-refine  — queue auto-refinement ─────────

router.post('/:id/angles/:angleId/auto-refine', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    const categories = req.body.categories
      || (angle.artifact_flags || []).map(f => f.category).filter(Boolean);

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No artifact categories to refine against. Run analysis or submit a review first.',
      });
    }

    const job = await refinementQueue.addRefinementJob({
      angleId: angle.id,
      sceneSetId: set.id,
      artifactCategories: categories,
      pass: 1,
      qualityThreshold: req.body.qualityThreshold || refinementQueue.QUALITY_THRESHOLD,
      runPostProcessing: req.body.runPostProcessing !== false,
    });

    res.json({ success: true, data: { jobId: job.id, pass: 1, maxPasses: refinementQueue.MAX_REFINEMENT_PASSES } });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/auto-refine error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /refinement-queue/stats  — refinement queue statistics ──────────────

router.get('/refinement-queue/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await refinementQueue.getQueueStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /refinement-queue/jobs/:jobId  — get refinement job status ──────────

router.get('/refinement-queue/jobs/:jobId', optionalAuth, async (req, res) => {
  try {
    const job = await refinementQueue.getRefinementJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      success: true,
      data: {
        id: job.id,
        state,
        progress,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /by-type/:sceneType  — filter by scene_type ─────────────────────────

router.get('/by-type/:sceneType', optionalAuth, async (req, res) => {
  try {
    const validTypes = ['HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION', 'OTHER'];
    const sceneType = req.params.sceneType.toUpperCase();

    if (!validTypes.includes(sceneType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid scene_type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const sets = await SceneSet.findAll({
      where: { scene_type: sceneType },
      include: [{ model: SceneAngle, as: 'angles' }],
      order: [['name', 'ASC']],
    });

    res.json({ success: true, count: sets.length, data: sets });
  } catch (err) {
    console.error('Scene Sets GET /by-type/:sceneType error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /for-beat/:beatNumber  — scene sets + angles for a given beat ───────

router.get('/for-beat/:beatNumber', optionalAuth, async (req, res) => {
  try {
    const beatNumber = parseInt(req.params.beatNumber, 10);
    if (isNaN(beatNumber)) {
      return res.status(400).json({ success: false, error: 'beatNumber must be an integer' });
    }

    // Op.contains on JSONB array — requires Sequelize v5+
    // Fallback: sequelize.literal if Op.contains doesn't work with your setup
    let sets;
    try {
      sets = await SceneSet.findAll({
        where: {
          event_compatibility: { [Op.contains]: [beatNumber] },
        },
        include: [{
          model: SceneAngle,
          as: 'angles',
          where: {
            beat_affinity: { [Op.contains]: [beatNumber] },
          },
          required: false,
        }],
        order: [['name', 'ASC']],
      });
    } catch (opErr) {
      // Fallback: raw SQL literal for JSONB contains
      console.warn('Op.contains failed, using raw SQL fallback:', opErr.message);
      const { sequelize } = require('../models');
      sets = await SceneSet.findAll({
        where: sequelize.literal(`event_compatibility @> '${JSON.stringify([beatNumber])}'::jsonb`),
        include: [{
          model: SceneAngle,
          as: 'angles',
          where: sequelize.literal(`"angles"."beat_affinity" @> '${JSON.stringify([beatNumber])}'::jsonb`),
          required: false,
        }],
        order: [['name', 'ASC']],
      });
    }

    res.json({ success: true, beat: beatNumber, count: sets.length, data: sets });
  } catch (err) {
    console.error('Scene Sets GET /for-beat/:beatNumber error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:id/preview-prompt  — preview the AI prompt without generating ─────

router.get('/:id/preview-prompt', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angleLabel = (req.query.angle || 'WIDE').toUpperCase();
    const prompt = sceneGenService.buildPrompt(set, angleLabel);
    const videoPrompt = sceneGenService.buildVideoPrompt(set, angleLabel);
    const negativePrompt = sceneGenService.NEGATIVE_PROMPT;

    res.json({
      success: true,
      data: {
        prompt,
        videoPrompt,
        negativePrompt,
        promptLength: prompt.length,
        angleLabel,
      },
    });
  } catch (err) {
    console.error('Scene Sets GET /:id/preview-prompt error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /:id/angles/reorder  — reorder angles by sort_order ───────────────

router.patch('/:id/angles/reorder', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const { order } = req.body; // [{ id: 'uuid', sort_order: 0 }, ...]
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'order must be an array of { id, sort_order }' });
    }

    for (const item of order) {
      if (!item.id || typeof item.sort_order !== 'number') continue;
      await SceneAngle.update(
        { sort_order: item.sort_order },
        { where: { id: item.id, scene_set_id: set.id } }
      );
    }

    const angles = await SceneAngle.findAll({
      where: { scene_set_id: set.id },
      order: [['sort_order', 'ASC']],
    });

    res.json({ success: true, data: angles });
  } catch (err) {
    console.error('Scene Sets PATCH /:id/angles/reorder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/cascade-regenerate  — save + regen base + all angles ──────────

router.post('/:id/cascade-regenerate', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    // Optionally update the description first
    if (req.body.canonical_description !== undefined) {
      await set.update({ canonical_description: req.body.canonical_description });
    }

    // Mark as generating (non-fatal if column not yet migrated)
    try { await set.update({ generation_status: 'generating' }); } catch (e) {
      console.warn('cascade-regenerate: could not update generation_status:', e.message);
    }

    await ensureGenerationJobsTable();
    const job = await GenerationJob.create({
      job_type: 'cascade_regenerate',
      scene_set_id: set.id,
      payload: { force: true },
    });

    res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
  } catch (err) {
    console.error('Scene Sets POST /:id/cascade-regenerate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /jobs/set/:setId  — get all active jobs for a scene set ─────────────
// IMPORTANT: This must be defined BEFORE /jobs/:jobId to prevent "set" being
// captured as a :jobId parameter.

router.get('/jobs/set/:setId', optionalAuth, async (req, res) => {
  try {
    if (!GenerationJob) return res.json({ success: true, data: [] });
    await ensureGenerationJobsTable();
    const jobs = await GenerationJob.findAll({
      where: {
        scene_set_id: req.params.setId,
        status: ['queued', 'processing'],
      },
      order: [['created_at', 'ASC']],
    });

    res.json({ success: true, data: jobs });
  } catch (err) {
    if (err.message?.includes('does not exist')) return res.json({ success: true, data: [] });
    console.error('Scene Sets GET /jobs/set/:setId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /jobs/:jobId  — poll a single job status ────────────────────────────

router.get('/jobs/:jobId', optionalAuth, async (req, res) => {
  try {
    if (!GenerationJob) {
      return res.status(404).json({ success: false, error: 'Generation jobs not available' });
    }
    await ensureGenerationJobsTable();
    const job = await GenerationJob.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    res.json({
      success: true,
      data: {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        scene_set_id: job.scene_set_id,
        scene_angle_id: job.scene_angle_id,
        result: job.result,
        error: job.error,
        attempts: job.attempts,
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at,
      },
    });
  } catch (err) {
    // Return 404 instead of 500 to stop polling loops
    if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
      return res.status(404).json({ success: false, error: 'Job not found — table may not exist' });
    }
    console.error('Scene Sets GET /jobs/:jobId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─── PATCH /:id/cover-angle  — set persistent cover image ───────────────────

router.patch('/:id/cover-angle', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const { angle_id } = req.body;

    // Allow null to clear cover
    if (angle_id) {
      const angle = await SceneAngle.findOne({
        where: { id: angle_id, scene_set_id: set.id },
      });
      if (!angle) return res.status(400).json({ success: false, error: 'Angle does not belong to this set' });
    }

    await set.update({ cover_angle_id: angle_id || null });
    res.json({ success: true, data: set });
  } catch (err) {
    console.error('Scene Sets PATCH /:id/cover-angle error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/episodes  — link episodes to a scene set ────────────────────

router.post('/:id/episodes', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const { episode_ids } = req.body;
    if (!Array.isArray(episode_ids) || episode_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'episode_ids array is required' });
    }

    const results = [];
    for (const episodeId of episode_ids) {
      const [link] = await SceneSetEpisode.findOrCreate({
        where: { scene_set_id: set.id, episode_id: episodeId },
        defaults: { scene_set_id: set.id, episode_id: episodeId },
      });
      results.push(link);
    }

    // Return updated episodes list
    const episodes = await Episode.findAll({
      include: [{
        model: SceneSet,
        as: 'sceneSets',
        where: { id: set.id },
        attributes: [],
        through: { attributes: [] },
      }],
      attributes: ['id', 'title', 'episode_number', 'season_number'],
    });

    res.json({ success: true, data: episodes });
  } catch (err) {
    console.error('Scene Sets POST /:id/episodes error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:id/episodes/:episodeId  — unlink an episode ───────────────────

router.delete('/:id/episodes/:episodeId', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const destroyed = await SceneSetEpisode.destroy({
      where: {
        scene_set_id: req.params.id,
        episode_id: req.params.episodeId,
      },
    });
    if (!destroyed) return res.status(404).json({ success: false, error: 'Link not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Scene Sets DELETE /:id/episodes/:episodeId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// SCENE STUDIO routes for scene sets
// ══════════════════════════════════════════════════════════════════════

const sceneStudioController = require('../controllers/sceneStudioController');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/v1/scene-sets/:id/canvas - Load canvas state for scene set
router.get('/:id/canvas', validateUUIDParam('id'), asyncHandler(sceneStudioController.getSceneSetCanvas));

// PUT /api/v1/scene-sets/:id/canvas - Bulk save canvas for scene set
router.put('/:id/canvas', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.saveSceneSetCanvas));

// POST /api/v1/scene-sets/:id/generate-object - AI object generation (DALL-E 3) for scene sets
router.post('/:id/generate-object', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.generateSceneSetObject));

// POST /api/v1/scene-sets/:id/regenerate-background - AI background variation for scene sets
router.post('/:id/regenerate-background', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.regenerateSceneSetBackground));

// POST /api/v1/scene-sets/:id/angles/:angleId/generate-depth - Depth map estimation for angle
router.post('/:id/angles/:angleId/generate-depth', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.generateAngleDepth));

// GET /api/v1/scene-sets/:id/angles/:angleId/depth-map - Proxy depth map image (avoids S3 CORS)
router.get('/:id/angles/:angleId/depth-map', validateUUIDParam('id'), asyncHandler(sceneStudioController.proxyAngleDepthMap));

// POST /api/v1/scene-sets/:id/objects - Add object to scene set canvas
router.post('/:id/objects', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.addSceneSetObject));

// PATCH /api/v1/scene-sets/:id/objects/:objectId - Update object on scene set
router.patch('/:id/objects/:objectId', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.updateObject));

// DELETE /api/v1/scene-sets/:id/objects/:objectId - Remove object from scene set
router.delete('/:id/objects/:objectId', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.deleteObject));

// POST /api/v1/scene-sets/:id/objects/:objectId/duplicate - Duplicate object
router.post('/:id/objects/:objectId/duplicate', validateUUIDParam('id'), optionalAuth, asyncHandler(sceneStudioController.duplicateObject));

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE LOCK — extract and save color palette/materials from base image
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/lock-style', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });
    if (!set.base_still_url) return res.status(400).json({ error: 'No base image to analyze' });

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: set.base_still_url } },
          { type: 'text', text: `Extract the visual style DNA of this room. Return JSON:
{
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "materials": ["material1", "material2", "material3"],
  "lighting_type": "string — warm golden / cool daylight / dramatic / soft ambient",
  "design_style": "string — modern minimalist / art deco / bohemian / etc.",
  "key_textures": ["texture1", "texture2", "texture3"]
}
Return ONLY JSON.` },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Failed to parse style data' });

    const styleData = JSON.parse(match[0]);
    await set.update({ visual_language: { ...set.visual_language, ...styleData, locked: true } });

    res.json({ success: true, data: styleData });
  } catch (err) {
    console.error('Style lock error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH GENERATE ALL ANGLES
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/generate-all-angles', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });

    const pendingAngles = await SceneAngle.findAll({
      where: { scene_set_id: set.id, generation_status: 'pending' },
      order: [['sort_order', 'ASC']],
    });

    if (pendingAngles.length === 0) {
      return res.json({ success: true, message: 'No pending angles to generate', queued: 0 });
    }

    // Return immediately, generate in background
    res.json({ success: true, queued: pendingAngles.length, message: `Generating ${pendingAngles.length} angles in background` });

    // Background generation
    const sceneGenService = require('../services/sceneGenerationService');
    const models = require('../models');
    for (const angle of pendingAngles) {
      try {
        await sceneGenService.generateAngle(angle, set, models);
      } catch (err) {
        console.error(`[BatchGen] Angle ${angle.angle_name} failed:`, err.message);
      }
    }
    console.log(`[BatchGen] Completed batch generation for scene set: ${set.name}`);
  } catch (err) {
    console.error('Batch generate error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TIME-OF-DAY VARIANTS — generate morning/afternoon/evening/night
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/time-variants', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });
    if (!set.canonical_description && !set.base_runway_prompt) {
      return res.status(400).json({ error: 'Scene needs a description or prompt first' });
    }

    const timeVariants = [
      { suffix: 'Morning', lighting: 'Soft golden morning light streaming through windows. Warm sunrise glow. Fresh, calm, beginning-of-day atmosphere.' },
      { suffix: 'Afternoon', lighting: 'Bright natural daylight. Clear, even illumination. Productive, alert, fully-lit atmosphere.' },
      { suffix: 'Evening', lighting: 'Warm amber evening light. Table lamps and soft overhead glow. Intimate, relaxed, golden-hour warmth.' },
      { suffix: 'Night', lighting: 'Moody nighttime lighting. Accent lamps, candlelight, city glow through windows. Dramatic shadows, intimate atmosphere.' },
    ];

    const createdAngles = await SceneAngle.bulkCreate(
      timeVariants.map((v, idx) => ({
        scene_set_id: set.id,
        angle_label: 'WIDE',
        angle_name: `${set.name} — ${v.suffix}`,
        angle_description: `${v.suffix} lighting variant of the base scene`,
        camera_direction: `Wide establishing shot. ${v.lighting} Maintain the same room layout, furniture, and design — only change the lighting and time of day.`,
        generation_status: 'pending',
        sort_order: 100 + idx,
      })),
      { returning: true }
    );

    res.json({ success: true, created: createdAngles.length, angles: createdAngles });
  } catch (err) {
    console.error('Time variants error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE SET TEMPLATES — pre-built templates for common locations
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/templates/list', optionalAuth, async (req, res) => {
  const templates = [
    { id: 'luxury_bedroom', name: 'Luxury Bedroom', scene_type: 'HOME_BASE',
      description: 'Elegant master bedroom with king bed, soft textiles, warm lighting, vanity area',
      angles: ['WIDE', 'BED', 'VANITY', 'WINDOW', 'CLOSET', 'DOORWAY'] },
    { id: 'walk_in_closet', name: 'Walk-in Closet', scene_type: 'CLOSET',
      description: 'Spacious walk-in with organized racks, island dresser, full-length mirrors, soft lighting',
      angles: ['WIDE', 'RACKS', 'MIRROR', 'ISLAND', 'SHOES', 'DETAIL'] },
    { id: 'gala_venue', name: 'Gala Venue', scene_type: 'EVENT_LOCATION',
      description: 'Grand ballroom with chandeliers, round tables, stage, gold accents',
      angles: ['ESTABLISHING', 'STAGE', 'SEATING', 'BAR', 'ENTRANCE', 'OVERHEAD'] },
    { id: 'fashion_runway', name: 'Fashion Runway', scene_type: 'EVENT_LOCATION',
      description: 'Sleek runway with front row seating, dramatic lighting, backstage area',
      angles: ['ESTABLISHING', 'RUNWAY', 'FRONT_ROW', 'BACKSTAGE', 'ENTRANCE', 'DETAIL'] },
    { id: 'rooftop_bar', name: 'Rooftop Bar', scene_type: 'EVENT_LOCATION',
      description: 'Upscale rooftop with city skyline, lounge seating, ambient string lights',
      angles: ['ESTABLISHING', 'BAR', 'LOUNGE', 'SKYLINE', 'ENTRANCE', 'DETAIL'] },
    { id: 'luxury_restaurant', name: 'Luxury Restaurant', scene_type: 'EVENT_LOCATION',
      description: 'Fine dining with intimate table settings, wine display, warm ambiance',
      angles: ['ESTABLISHING', 'TABLE', 'BAR', 'WINDOW', 'ENTRANCE', 'DETAIL'] },
    { id: 'studio_apartment', name: 'Studio / Content Space', scene_type: 'HOME_BASE',
      description: 'Modern content creation studio with ring light, backdrop, desk setup',
      angles: ['WIDE', 'DESK', 'BACKDROP', 'WINDOW', 'SHELF', 'DOORWAY'] },
    { id: 'city_street', name: 'City Street', scene_type: 'TRANSITION',
      description: 'Upscale city sidewalk with boutiques, cafe terraces, golden hour light',
      angles: ['ESTABLISHING', 'STOREFRONT', 'CAFE', 'CROSSWALK', 'ALLEY', 'DETAIL'] },
    { id: 'press_room', name: 'Press Room / Interview Set', scene_type: 'EVENT_LOCATION',
      description: 'Professional press backdrop, interview chairs, camera setup, branded wall',
      angles: ['WIDE', 'STAGE', 'AUDIENCE', 'BACKSTAGE', 'DETAIL', 'ENTRANCE'] },
    { id: 'garden_terrace', name: 'Garden Terrace', scene_type: 'EVENT_LOCATION',
      description: 'Elegant outdoor terrace with floral arrangements, fairy lights, fountain',
      angles: ['ESTABLISHING', 'SEATING', 'GARDEN', 'FOUNTAIN', 'ENTRANCE', 'OVERHEAD'] },
  ];
  res.json({ success: true, templates });
});

router.post('/:id/apply-template', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const { template_id } = req.body;
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });

    // Fetch template list from the endpoint above
    const templates = (await new Promise(resolve => {
      const mockRes = { json: (d) => resolve(d.templates) };
      router.handle({ method: 'GET', url: '/templates/list', query: {} }, mockRes, () => {});
    })).catch?.() || [];

    // Hardcoded fallback
    const templateMap = {
      luxury_bedroom: { angles: ['WIDE', 'BED', 'VANITY', 'WINDOW', 'CLOSET', 'DOORWAY'] },
      walk_in_closet: { angles: ['WIDE', 'RACKS', 'MIRROR', 'ISLAND', 'SHOES', 'DETAIL'] },
      gala_venue: { angles: ['ESTABLISHING', 'STAGE', 'SEATING', 'BAR', 'ENTRANCE', 'OVERHEAD'] },
      fashion_runway: { angles: ['ESTABLISHING', 'RUNWAY', 'FRONT_ROW', 'BACKSTAGE', 'ENTRANCE', 'DETAIL'] },
      rooftop_bar: { angles: ['ESTABLISHING', 'BAR', 'LOUNGE', 'SKYLINE', 'ENTRANCE', 'DETAIL'] },
      luxury_restaurant: { angles: ['ESTABLISHING', 'TABLE', 'BAR', 'WINDOW', 'ENTRANCE', 'DETAIL'] },
      studio_apartment: { angles: ['WIDE', 'DESK', 'BACKDROP', 'WINDOW', 'SHELF', 'DOORWAY'] },
      city_street: { angles: ['ESTABLISHING', 'STOREFRONT', 'CAFE', 'CROSSWALK', 'ALLEY', 'DETAIL'] },
      press_room: { angles: ['WIDE', 'STAGE', 'AUDIENCE', 'BACKSTAGE', 'DETAIL', 'ENTRANCE'] },
      garden_terrace: { angles: ['ESTABLISHING', 'SEATING', 'GARDEN', 'FOUNTAIN', 'ENTRANCE', 'OVERHEAD'] },
    };

    const tpl = templateMap[template_id];
    if (!tpl) return res.status(400).json({ error: 'Unknown template' });

    // Clear existing angles and create template angles
    await SceneAngle.destroy({ where: { scene_set_id: set.id }, force: true });
    const createdAngles = await SceneAngle.bulkCreate(
      tpl.angles.map((label, idx) => ({
        scene_set_id: set.id,
        angle_label: label,
        angle_name: label.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        angle_description: `${label} view of ${set.name}`,
        generation_status: 'pending',
        sort_order: idx,
      })),
      { returning: true }
    );

    res.json({ success: true, created: createdAngles.length, angles: createdAngles });
  } catch (err) {
    console.error('Apply template error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WARDROBE × SCENE MATCHING — find wardrobe items matching event dress code
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/wardrobe-match', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });

    const sequelize = require('../models').sequelize;

    // Find events linked to this scene set
    const [events] = await sequelize.query(
      `SELECT dress_code, dress_code_keywords, name FROM world_events
       WHERE scene_set_id = :setId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { setId: set.id } }
    );

    if (!events.length) {
      return res.json({ success: true, event: null, matches: [], message: 'No event linked to this scene set' });
    }

    const event = events[0];
    const keywords = typeof event.dress_code_keywords === 'string'
      ? JSON.parse(event.dress_code_keywords || '[]')
      : (event.dress_code_keywords || []);

    // Search wardrobe library for matching items
    let matches = [];
    if (keywords.length > 0) {
      matches = await sequelize.query(
        `SELECT id, name, image_url, thumbnail_url, item_type, color, tags
         FROM wardrobe_library
         WHERE deleted_at IS NULL
           AND (tags::text ILIKE ANY(ARRAY[:keywords])
                OR name ILIKE ANY(ARRAY[:keywords])
                OR color ILIKE ANY(ARRAY[:keywords]))
         LIMIT 12`,
        {
          replacements: { keywords: keywords.map(k => `%${k}%`) },
          type: sequelize.QueryTypes.SELECT,
        }
      );
    }

    res.json({ success: true, event: { name: event.name, dress_code: event.dress_code, keywords }, matches });
  } catch (err) {
    console.error('Wardrobe match error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEASON VARIANTS — generate spring/summer/fall/winter versions
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/season-variants', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ error: 'Scene set not found' });

    const seasonVariants = [
      { suffix: 'Spring', desc: 'Fresh spring atmosphere. Pastel accents, blooming flowers visible through windows, light fabrics, bright natural light, airy feeling.' },
      { suffix: 'Summer', desc: 'Warm summer atmosphere. Golden light, open windows, tropical plants, lightweight materials, vibrant energy.' },
      { suffix: 'Fall', desc: 'Cozy autumn atmosphere. Warm amber tones, rich textures (velvet, wool), candles, falling leaves visible outside, harvest colors.' },
      { suffix: 'Winter', desc: 'Elegant winter atmosphere. Cool blue-white light, frosty windows, plush throws, metallic accents, snow visible outside, warm interior contrast.' },
    ];

    const createdAngles = await SceneAngle.bulkCreate(
      seasonVariants.map((v, idx) => ({
        scene_set_id: set.id,
        angle_label: 'WIDE',
        angle_name: `${set.name} — ${v.suffix}`,
        angle_description: `${v.suffix} seasonal variant`,
        camera_direction: `Wide establishing shot. ${v.desc} Maintain the same room layout and furniture — only change seasonal decor, lighting, and atmosphere.`,
        generation_status: 'pending',
        sort_order: 200 + idx,
      })),
      { returning: true }
    );

    res.json({ success: true, created: createdAngles.length, angles: createdAngles });
  } catch (err) {
    console.error('Season variants error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITE / REJECT ANGLE — star or reject a generated angle
// ═══════════════════════════════════════════════════════════════════════════════

router.patch('/:id/angles/:angleId/favorite', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({ where: { id: req.params.angleId, scene_set_id: req.params.id } });
    if (!angle) return res.status(404).json({ error: 'Angle not found' });

    const review = angle.quality_review || {};
    review.favorited = !review.favorited;
    review.reviewed_at = new Date();
    await angle.update({ quality_review: review });

    res.json({ success: true, favorited: review.favorited });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/angles/:angleId/reject', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({ where: { id: req.params.angleId, scene_set_id: req.params.id } });
    if (!angle) return res.status(404).json({ error: 'Angle not found' });

    const review = angle.quality_review || {};
    review.rejected = true;
    review.reject_reason = req.body.reason || 'Rejected by user';
    review.reviewed_at = new Date();

    // Save current image to history before resetting
    const history = review.generation_history || [];
    if (angle.still_image_url) {
      history.push({
        url: angle.still_image_url,
        rejected_at: new Date(),
        reason: review.reject_reason,
        attempt: angle.generation_attempt,
      });
    }
    review.generation_history = history;

    await angle.update({
      quality_review: review,
      generation_status: 'pending',
      generation_attempt: (angle.generation_attempt || 1) + 1,
    });

    res.json({ success: true, message: 'Angle rejected — ready to regenerate', history_count: history.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION HISTORY — view previous generations for an angle
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/angles/:angleId/history', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const angle = await SceneAngle.findOne({ where: { id: req.params.angleId, scene_set_id: req.params.id } });
    if (!angle) return res.status(404).json({ error: 'Angle not found' });

    const review = angle.quality_review || {};
    const history = review.generation_history || [];

    // Add current image as the latest entry
    const current = angle.still_image_url ? {
      url: angle.still_image_url,
      current: true,
      attempt: angle.generation_attempt,
      quality_score: angle.quality_score,
      favorited: review.favorited || false,
    } : null;

    res.json({ success: true, current, history, total: history.length + (current ? 1 : 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EPISODE TIMELINE FILMSTRIP — visual preview of all beats with scenes
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/episode/:episodeId/filmstrip', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const sequelize = require('../models').sequelize;

    // Load scene plan beats for this episode
    const [beats] = await sequelize.query(
      `SELECT sp.beat_number, sp.beat_name, sp.scene_set_id, sp.angle_label, sp.shot_type, sp.emotional_intent,
              ss.name as scene_name, ss.base_still_url,
              sa.still_image_url as angle_image_url
       FROM scene_plans sp
       LEFT JOIN scene_sets ss ON ss.id = sp.scene_set_id AND ss.deleted_at IS NULL
       LEFT JOIN scene_angles sa ON sa.scene_set_id = sp.scene_set_id AND sa.angle_label = sp.angle_label AND sa.deleted_at IS NULL AND sa.generation_status = 'complete'
       WHERE sp.episode_id = :episodeId AND sp.deleted_at IS NULL
       ORDER BY sp.beat_number ASC`,
      { replacements: { episodeId } }
    );

    // Fill in missing beats with empty slots (14-beat structure)
    const filmstrip = [];
    for (let i = 1; i <= 14; i++) {
      const beat = beats.find(b => b.beat_number === i);
      filmstrip.push({
        beat_number: i,
        beat_name: beat?.beat_name || `Beat ${i}`,
        scene_name: beat?.scene_name || null,
        image_url: beat?.angle_image_url || beat?.base_still_url || null,
        shot_type: beat?.shot_type || null,
        emotional_intent: beat?.emotional_intent || null,
        has_scene: !!beat?.scene_set_id,
      });
    }

    res.json({ success: true, filmstrip, covered: filmstrip.filter(f => f.has_scene).length });
  } catch (err) {
    console.error('Filmstrip error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIDE-BY-SIDE COMPARISON — original upload vs generated angles
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/comparison', validateUUIDParam('id'), optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id, {
      include: [{ model: SceneAngle, as: 'angles', order: [['sort_order', 'ASC']] }],
    });
    if (!set) return res.status(404).json({ error: 'Scene set not found' });

    const comparisons = (set.angles || [])
      .filter(a => a.still_image_url && a.generation_status === 'complete')
      .map(a => ({
        angle_id: a.id,
        angle_name: a.angle_name,
        angle_label: a.angle_label,
        original: set.base_still_url,
        generated: a.still_image_url,
        quality_score: a.quality_score,
        favorited: a.quality_review?.favorited || false,
      }));

    res.json({ success: true, base_image: set.base_still_url, comparisons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
