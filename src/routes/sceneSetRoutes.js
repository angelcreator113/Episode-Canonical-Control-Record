'use strict';

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { optionalAuth } = require('../middleware/auth');
const sceneGenService  = require('../services/sceneGenerationService');
const { SceneSet, SceneAngle, Universe, Show } = require('../models');

// ─── GET /  — list all scene sets ─────────────────────────────────────────────

router.get('/', optionalAuth, async (req, res) => {
  try {
    const sets = await SceneSet.findAll({
      include: [{ model: SceneAngle, as: 'angles' }],
      order: [['created_at', 'DESC']],
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
      generation_status: 'pending',
    });

    res.status(201).json({ success: true, data: set });
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
      'base_runway_model', 'notes',
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

// ─── POST /:id/generate-base  — generate the base scene ─────────────────────

router.post('/:id/generate-base', optionalAuth, async (req, res) => {
  try {
    const set = await SceneSet.findByPk(req.params.id);
    if (!set) return res.status(404).json({ success: false, error: 'Scene set not found' });

    if (set.base_runway_seed && !req.body.force) {
      return res.status(409).json({
        success: false,
        error: 'Base already generated. Pass { "force": true } to regenerate.',
        seed: set.base_runway_seed,
      });
    }

    const result = await sceneGenService.generateBaseScene(set, { SceneSet, SceneAngle });
    res.json({ success: true, data: result });
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

    const result = await sceneGenService.generateAngle(angle, set, { SceneAngle, SceneSet });
    res.json({ success: true, data: result });
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

// ─── GET /by-type/:sceneType  — filter by scene_type ─────────────────────────

router.get('/by-type/:sceneType', optionalAuth, async (req, res) => {
  try {
    const validTypes = ['HOME_BASE', 'RECURRING', 'ONE_SHOT', 'TRANSITIONAL', 'FLASHBACK'];
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

module.exports = router;
