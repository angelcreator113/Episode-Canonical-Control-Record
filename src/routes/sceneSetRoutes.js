'use strict';

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const multer  = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { optionalAuth } = require('../middleware/auth');
const sceneGenService    = require('../services/sceneGenerationService');
const artifactService    = require('../services/artifactDetectionService');
const postProcessService = require('../services/postProcessingService');
const refinementQueue    = require('../queues/sceneRefinementQueue');
const { SceneSet, SceneAngle, Universe, Show, GenerationJob } = require('../models');

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

// ─── GET /  — list all scene sets ─────────────────────────────────────────────

router.get('/', optionalAuth, async (req, res) => {
  try {
    const sets = await SceneSet.findAll({
      include: [{ model: SceneAngle, as: 'angles' }],
      order: [['created_at', 'DESC'], [{ model: SceneAngle, as: 'angles' }, 'sort_order', 'ASC']],
    });
    res.json({ success: true, count: sets.length, data: sets });
  } catch (err) {
    console.error('Scene Sets GET / error:', err);
    res.status(500).json({ success: false, error: err.message });
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
    } = req.body;

    if (!name || !scene_type) {
      return res.status(400).json({ success: false, error: 'name and scene_type are required' });
    }

    const set = await SceneSet.create({
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
    });

    // Auto-enqueue base generation when a description is provided
    let jobId = null;
    if (canonical_description) {
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

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id, {
      include: [{ model: SceneAngle, as: 'angles' }],
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

router.put('/:id', optionalAuth, async (req, res) => {
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

router.delete('/:id', optionalAuth, async (req, res) => {
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

router.post('/:id/upload-base', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file provided' });

    const ext = req.file.mimetype === 'image/png' ? 'png'
              : req.file.mimetype === 'image/webp' ? 'webp'
              : 'jpg';
    const ts = Date.now();
    const s3Key = `scene-sets/${set.id}/angles/base/still-${ts}.${ext}`;

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

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      CacheControl: 'max-age=31536000',
    }));

    const stillUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    await set.update({
      base_still_url: stillUrl,
      base_runway_seed: `uploaded-${Date.now()}`,
      generation_status: 'complete',
    });

    // Clear stale angle thumbnails — they were generated from the old base image
    await SceneAngle.update(
      { still_image_url: null, video_clip_url: null, generation_status: 'pending' },
      { where: { scene_set_id: set.id } }
    );

    res.json({ success: true, data: { stillUrl, seed: set.base_runway_seed } });
  } catch (err) {
    console.error('Scene Sets POST /:id/upload-base error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:id/generate-base  — generate the base scene ─────────────────────

router.post('/:id/generate-base', optionalAuth, async (req, res) => {
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

    await set.update({ generation_status: 'generating' });

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

router.post('/:id/angles', optionalAuth, async (req, res) => {
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

router.post('/:id/angles/:angleId/generate', optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    const angle = await SceneAngle.findOne({
      where: { id: req.params.angleId, scene_set_id: set.id },
    });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found' });

    const job = await GenerationJob.create({
      job_type: 'generate_angle',
      scene_set_id: set.id,
      scene_angle_id: angle.id,
      payload: {},
    });

    // Mark the angle as generating and clear stale assets so the frontend shows a spinner
    await angle.update({ generation_status: 'generating', still_image_url: null, video_clip_url: null });

    res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
  } catch (err) {
    console.error('Scene Sets POST /:id/angles/:angleId/generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:id/angles/:angleId  — soft-delete a single angle ──────────────

router.delete('/:id/angles/:angleId', optionalAuth, async (req, res) => {
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

// ─── DELETE /:id/angles  — delete all angles for a scene set ─────────────────

router.delete('/:id/angles', optionalAuth, async (req, res) => {
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
  res.json({ success: true, data: artifactService.ARTIFACT_CATEGORIES });
});

// ─── POST /:id/angles/:angleId/review  — submit manual quality review ───────

router.post('/:id/angles/:angleId/review', optionalAuth, async (req, res) => {
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

router.post('/:id/angles/:angleId/analyze', optionalAuth, async (req, res) => {
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

router.post('/:id/angles/:angleId/regenerate', optionalAuth, async (req, res) => {
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

router.post('/:id/angles/:angleId/post-process', optionalAuth, async (req, res) => {
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

router.post('/:id/angles/:angleId/auto-refine', optionalAuth, async (req, res) => {
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

router.get('/:id/preview-prompt', optionalAuth, async (req, res) => {
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

router.patch('/:id/angles/reorder', optionalAuth, async (req, res) => {
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

router.post('/:id/cascade-regenerate', optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    // Optionally update the description first
    if (req.body.canonical_description !== undefined) {
      await set.update({ canonical_description: req.body.canonical_description });
    }

    await set.update({ generation_status: 'generating' });

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
    const jobs = await GenerationJob.findAll({
      where: {
        scene_set_id: req.params.setId,
        status: ['queued', 'processing'],
      },
      order: [['created_at', 'ASC']],
    });

    res.json({ success: true, data: jobs });
  } catch (err) {
    console.error('Scene Sets GET /jobs/set/:setId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /jobs/:jobId  — poll a single job status ────────────────────────────

router.get('/jobs/:jobId', optionalAuth, async (req, res) => {
  try {
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
    console.error('Scene Sets GET /jobs/:jobId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
