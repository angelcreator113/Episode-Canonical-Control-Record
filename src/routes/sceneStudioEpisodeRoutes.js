'use strict';

/**
 * Scene Studio ↔ Episode Connection Routes
 * Mount at: /api/v1/scene-studio-episodes
 *
 * Connects venue images (scene sets + angles) to episode beats.
 * Allows editing which angle is used per beat, previewing the visual sequence.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const { ScenePlan, SceneSet, SceneAngle, SceneSetEpisode } = require('../models');

// C2 PR 3 (Evoni, 2026-11-24): these two beat writers answered 500 with
// err.message, so a deadlock, a lock timeout or a constraint reached the
// browser in the database's own words. A lock conflict that survived the
// bounded retries is the repo's retryable 409; anything else is a fixed
// sentence, with the error's class (never its message) in the log.
function beatWriteError(res, err, label) {
  const { RetryableConflictError } = require('../utils/episodeLocks');
  if (err instanceof RetryableConflictError) {
    console.error(`[SceneStudioEpisode] ${label} gave up after retries:`, err.name);
    return res.status(409).json({ error: err.message, code: err.code });
  }
  console.error(`[SceneStudioEpisode] ${label} failed:`, err?.name || 'Error', err);
  return res.status(500).json({ error: 'This beat could not be saved. Nothing was changed: try again.' });
}

// ── GET VISUAL SEQUENCE FOR EPISODE ──────────────────────────────────────────
// Returns all 14 beats with their scene set images and angles
// GET /api/v1/scene-studio-episodes/:episodeId/visual-sequence
router.get('/:episodeId/visual-sequence', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    const plans = await ScenePlan.findAll({
      where: { episode_id: episodeId, deleted_at: null },
      order: [['beat_number', 'ASC']],
      include: [{
        model: SceneSet,
        as: 'sceneSet',
        attributes: ['id', 'name', 'scene_type', 'base_still_url', 'canonical_description',
                     'aesthetic_tags', 'mood_tags', 'generation_status'],
        required: false,
        include: [{
          model: SceneAngle,
          as: 'angles',
          attributes: ['id', 'angle_label', 'angle_name', 'still_image_url', 'thumbnail_url',
                       'generation_status', 'mood', 'camera_direction', 'beat_affinity',
                       'quality_score', 'enhanced_still_url', 'depth_map_url', 'sort_order'],
          required: false,
          where: { deleted_at: null },
          order: [['sort_order', 'ASC']],
        }],
      }],
    });

    const sequence = plans.map(plan => {
      const p = plan.toJSON();
      const angles = p.sceneSet?.angles || [];

      // Find the active angle for this beat
      const activeAngle = p.angle_label
        ? angles.find(a => a.angle_label === p.angle_label) || angles[0]
        : angles.find(a => Array.isArray(a.beat_affinity) && a.beat_affinity.includes(p.beat_number))
          || angles[0]
          || null;

      return {
        beat_number: p.beat_number,
        beat_name: p.beat_name,
        emotional_intent: p.emotional_intent,
        shot_type: p.shot_type,
        transition_in: p.transition_in,
        director_note: p.director_note,
        locked: p.locked,

        // Scene set
        scene_set: p.sceneSet ? {
          id: p.sceneSet.id,
          name: p.sceneSet.name,
          scene_type: p.sceneSet.scene_type,
          base_still_url: p.sceneSet.base_still_url,
          generation_status: p.sceneSet.generation_status,
        } : null,

        // Active angle image
        active_angle: activeAngle ? {
          id: activeAngle.id,
          angle_label: activeAngle.angle_label,
          angle_name: activeAngle.angle_name,
          still_image_url: activeAngle.enhanced_still_url || activeAngle.still_image_url,
          thumbnail_url: activeAngle.thumbnail_url,
          mood: activeAngle.mood,
          camera_direction: activeAngle.camera_direction,
          quality_score: activeAngle.quality_score,
          has_depth_map: !!activeAngle.depth_map_url,
        } : null,

        // All available angles for this scene set
        available_angles: angles.map(a => ({
          id: a.id,
          angle_label: a.angle_label,
          angle_name: a.angle_name,
          still_image_url: a.enhanced_still_url || a.still_image_url,
          thumbnail_url: a.thumbnail_url,
          generation_status: a.generation_status,
          is_active: activeAngle?.id === a.id,
        })),

        // Feed moment preview
        feed_moment: p.feed_moment || null,
      };
    });

    // Stats
    const stats = {
      total_beats: sequence.length,
      beats_with_images: sequence.filter(b => b.active_angle?.still_image_url).length,
      beats_with_sets: sequence.filter(b => b.scene_set).length,
      all_locked: sequence.every(b => b.locked),
      unique_locations: [...new Set(sequence.filter(b => b.scene_set).map(b => b.scene_set.id))].length,
    };

    return res.json({ data: sequence, stats });
  } catch (err) {
    console.error('[SceneStudioEpisode] Visual sequence error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── CHANGE ANGLE FOR BEAT ────────────────────────────────────────────────────
// PUT /api/v1/scene-studio-episodes/:episodeId/beat/:beatNumber/angle
// Body: { angle_id }
router.put('/:episodeId/beat/:beatNumber/angle', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { episodeId, beatNumber } = req.params;
    const { angle_id } = req.body;

    if (!angle_id) return res.status(400).json({ error: 'angle_id is required' });

    const plan = await ScenePlan.findOne({
      where: { episode_id: episodeId, beat_number: parseInt(beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found' });
    if (plan.locked) return res.status(409).json({ error: 'Beat is locked' });

    const angle = await SceneAngle.findByPk(angle_id);
    if (!angle) return res.status(404).json({ error: 'Angle not found' });

    // C2 PR 3: the episode first, then the angle's set, live only and never
    // waited for under the episode's lock; then the beat's two updates as
    // one commit. This route took angle.scene_set_id with no liveness check
    // of any kind, so it moved a beat onto a set that had been removed.
    const { inEpisodeFirstTransaction, holdLiveSet } = require('../services/eventPlaceSync');
    const { lockEpisodes } = require('../utils/episodeLocks');
    const sceneSet = await inEpisodeFirstTransaction(ScenePlan.sequelize, async (transaction) => {
      await lockEpisodes(ScenePlan.sequelize, [episodeId], { transaction, mode: 'share' });
      if (!await holdLiveSet(ScenePlan.sequelize, angle.scene_set_id, { transaction, nowait: true })) return null;
      const set = await SceneSet.findByPk(angle.scene_set_id, { transaction });
      await plan.update({
        angle_label: angle.angle_label,
        scene_set_id: angle.scene_set_id,
        ai_suggested: false,
        ...(set ? { scene_context: set.script_context || set.canonical_description?.slice(0, 400) } : {}),
      }, { transaction });
      return set;
    });
    if (angle.scene_set_id && !sceneSet) return res.status(404).json({ error: 'Scene set not found' });

    return res.json({
      success: true,
      data: {
        beat_number: plan.beat_number,
        angle_label: angle.angle_label,
        angle_name: angle.angle_name,
        still_image_url: angle.still_image_url,
        scene_set_name: sceneSet?.name,
      },
    });
  } catch (err) {
    return beatWriteError(res, err, 'Change angle');
  }
});

// ── CHANGE SCENE SET FOR BEAT ────────────────────────────────────────────────
// PUT /api/v1/scene-studio-episodes/:episodeId/beat/:beatNumber/scene-set
// Body: { scene_set_id }
router.put('/:episodeId/beat/:beatNumber/scene-set', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { episodeId, beatNumber } = req.params;
    const { scene_set_id } = req.body;

    if (!scene_set_id) return res.status(400).json({ error: 'scene_set_id is required' });

    const plan = await ScenePlan.findOne({
      where: { episode_id: episodeId, beat_number: parseInt(beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found' });
    if (plan.locked) return res.status(409).json({ error: 'Beat is locked' });

    const sceneSet = await SceneSet.findByPk(scene_set_id, {
      include: [{
        model: SceneAngle,
        as: 'angles',
        where: { deleted_at: null },
        required: false,
        order: [['sort_order', 'ASC']],
      }],
    });
    if (!sceneSet) return res.status(404).json({ error: 'Scene set not found' });

    // Pick best angle for this beat
    const bestAngle = sceneSet.angles?.find(a =>
      Array.isArray(a.beat_affinity) && a.beat_affinity.includes(parseInt(beatNumber, 10))
    ) || sceneSet.angles?.[0];

    // C2 PR 3: the episode first, then the set's row, live only and never
    // waited for under the episode's lock; then the beat and its episode
    // link as ONE commit. The set was read above without a lock, so it
    // could be removed in between, and the link's failure was swallowed
    // into a 200 (the beat moved and the link silently did not).
    const { inEpisodeFirstTransaction, holdLiveSet } = require('../services/eventPlaceSync');
    const { lockEpisodes } = require('../utils/episodeLocks');
    const saved = await inEpisodeFirstTransaction(ScenePlan.sequelize, async (transaction) => {
      await lockEpisodes(ScenePlan.sequelize, [episodeId], { transaction, mode: 'share' });
      if (!await holdLiveSet(ScenePlan.sequelize, sceneSet.id, { transaction, nowait: true })) return false;
      await plan.update({
        scene_set_id: sceneSet.id,
        angle_label: bestAngle?.angle_label || null,
        scene_context: sceneSet.script_context || sceneSet.canonical_description?.slice(0, 400),
        ai_suggested: false,
      }, { transaction });
      // Ensure scene set is linked to episode
      await SceneSetEpisode.findOrCreate({
        where: { scene_set_id: sceneSet.id, episode_id: episodeId },
        defaults: { scene_set_id: sceneSet.id, episode_id: episodeId },
        transaction,
      });
      return true;
    });
    if (!saved) return res.status(404).json({ error: 'Scene set not found' });

    return res.json({
      success: true,
      data: {
        beat_number: plan.beat_number,
        scene_set: { id: sceneSet.id, name: sceneSet.name, scene_type: sceneSet.scene_type },
        angle: bestAngle ? {
          id: bestAngle.id,
          angle_label: bestAngle.angle_label,
          still_image_url: bestAngle.still_image_url,
        } : null,
        available_angles: (sceneSet.angles || []).map(a => ({
          id: a.id,
          angle_label: a.angle_label,
          angle_name: a.angle_name,
          still_image_url: a.still_image_url,
          thumbnail_url: a.thumbnail_url,
        })),
      },
    });
  } catch (err) {
    return beatWriteError(res, err, 'Change scene set');
  }
});

// ── GET AVAILABLE SCENE SETS FOR EPISODE ─────────────────────────────────────
// GET /api/v1/scene-studio-episodes/:showId/available-sets
router.get('/:showId/available-sets', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { scene_type } = req.query;

    const where = { deleted_at: null };
    if (showId !== 'all') where.show_id = showId;
    if (scene_type) where.scene_type = scene_type;

    const sets = await SceneSet.findAll({
      where,
      include: [{
        model: SceneAngle,
        as: 'angles',
        attributes: ['id', 'angle_label', 'angle_name', 'still_image_url', 'thumbnail_url',
                     'generation_status', 'quality_score'],
        where: { deleted_at: null },
        required: false,
      }],
      order: [['name', 'ASC']],
    });

    const results = sets.map(s => {
      const d = s.toJSON();
      const readyAngles = (d.angles || []).filter(a => a.generation_status === 'complete');
      return {
        id: d.id,
        name: d.name,
        scene_type: d.scene_type,
        base_still_url: d.base_still_url,
        generation_status: d.generation_status,
        canonical_description: d.canonical_description?.slice(0, 200),
        angle_count: d.angles?.length || 0,
        ready_angles: readyAngles.length,
        cover_image: readyAngles[0]?.still_image_url || d.base_still_url,
        angles: (d.angles || []).map(a => ({
          id: a.id,
          angle_label: a.angle_label,
          angle_name: a.angle_name,
          thumbnail_url: a.thumbnail_url || a.still_image_url,
          ready: a.generation_status === 'complete',
        })),
      };
    });

    return res.json({ data: results, count: results.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── EPISODE SCENE SETS SUMMARY ───────────────────────────────────────────────
// GET /api/v1/scene-studio-episodes/:episodeId/sets
router.get('/:episodeId/sets', requireAuth, async (req, res) => {
  try {
    const links = await SceneSetEpisode.findAll({
      where: { episode_id: req.params.episodeId },
      include: [{
        model: SceneSet,
        as: 'sceneSet',
        include: [{
          model: SceneAngle,
          as: 'angles',
          attributes: ['id', 'angle_label', 'still_image_url', 'thumbnail_url', 'generation_status'],
          where: { deleted_at: null },
          required: false,
        }],
      }],
    });

    const sets = links.map(l => {
      const ss = l.sceneSet?.toJSON();
      if (!ss) return null;
      return {
        id: ss.id,
        name: ss.name,
        scene_type: ss.scene_type,
        angle_count: ss.angles?.length || 0,
        cover_image: ss.angles?.find(a => a.generation_status === 'complete')?.still_image_url || ss.base_still_url,
      };
    }).filter(Boolean);

    return res.json({ data: sets, count: sets.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
