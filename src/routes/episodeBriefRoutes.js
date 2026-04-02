'use strict';

/**
 * Episode Brief + Scene Planner Routes
 * Mount at: /api/v1/episode-brief
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { EpisodeBrief, ScenePlan, Episode, SceneSet } = require('../models');
const { generateScenePlan, getScenePlanForScriptGenerator } = require('../services/scenePlannerService');

// ── GET / CREATE BRIEF ────────────────────────────────────────────────────────

router.get('/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    let brief = await EpisodeBrief.findOne({
      where: { episode_id: episodeId, deleted_at: null },
    });

    if (!brief) {
      const episode = await Episode.findByPk(episodeId);
      if (!episode) return res.status(404).json({ error: 'Episode not found' });

      brief = await EpisodeBrief.create({
        episode_id: episodeId,
        show_id: episode.show_id,
        status: 'draft',
      });
    }

    return res.json({ data: brief });
  } catch (err) {
    console.error('[EpisodeBrief] GET error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UPDATE BRIEF ──────────────────────────────────────────────────────────────

router.put('/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    let brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) return res.status(404).json({ error: 'Brief not found. GET first to auto-create.' });

    if (brief.status === 'locked') {
      return res.status(409).json({ error: 'Brief is locked. Unlock before editing.' });
    }

    const updatable = [
      'arc_number', 'position_in_arc', 'episode_archetype',
      'narrative_purpose', 'designed_intent', 'allowed_outcomes',
      'forward_hook', 'lala_state_snapshot', 'event_id', 'event_difficulty',
    ];

    const updates = {};
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    await brief.update(updates);
    return res.json({ data: brief });
  } catch (err) {
    console.error('[EpisodeBrief] PUT error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK BRIEF ────────────────────────────────────────────────────────────────

router.post('/:episodeId/lock', optionalAuth, async (req, res) => {
  try {
    const brief = await EpisodeBrief.findOne({ where: { episode_id: req.params.episodeId } });
    if (!brief) return res.status(404).json({ error: 'Brief not found' });

    await brief.update({ status: 'locked' });
    return res.json({ data: brief, message: 'Brief locked.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GENERATE SCENE PLAN (AI) ──────────────────────────────────────────────────

router.post('/:episodeId/generate-plan', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) {
      return res.status(400).json({
        error: 'Create and fill out the Episode Brief before generating a plan.',
      });
    }

    const episode = await Episode.findByPk(episodeId);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    console.log(`[ScenePlanner] Generating plan for episode: ${episodeId}`);

    const plan = await generateScenePlan(episodeId, episode.show_id, brief.toJSON(), { save: true });

    return res.json({
      success: true,
      message: `Scene plan generated — ${plan.length} beats mapped.`,
      data: plan,
    });
  } catch (err) {
    console.error('[ScenePlanner] generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET SCENE PLAN ────────────────────────────────────────────────────────────

router.get('/:episodeId/plan', optionalAuth, async (req, res) => {
  try {
    const plans = await ScenePlan.findAll({
      where: { episode_id: req.params.episodeId, deleted_at: null },
      order: [['beat_number', 'ASC']],
      include: [{
        model: SceneSet,
        as: 'sceneSet',
        attributes: ['id', 'name', 'scene_type', 'script_context', 'base_still_url'],
        required: false,
      }],
    });

    return res.json({ data: plans, count: plans.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── UPDATE SINGLE BEAT ────────────────────────────────────────────────────────

router.put('/:episodeId/plan/:beatNumber', optionalAuth, async (req, res) => {
  try {
    const { episodeId, beatNumber } = req.params;

    const plan = await ScenePlan.findOne({
      where: { episode_id: episodeId, beat_number: parseInt(beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found in plan' });
    if (plan.locked) return res.status(409).json({ error: 'Beat is locked. Unlock first.' });

    const updatable = ['scene_set_id', 'angle_label', 'shot_type', 'emotional_intent', 'transition_in', 'director_note'];
    const updates = { ai_suggested: false };
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.scene_set_id) {
      const sceneSet = await SceneSet.findByPk(updates.scene_set_id);
      if (sceneSet) {
        updates.scene_context = sceneSet.script_context || sceneSet.canonical_description?.slice(0, 400);
      }
    }

    await plan.update(updates);
    return res.json({ data: plan });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK BEAT (toggle) ────────────────────────────────────────────────────────

router.post('/:episodeId/plan/:beatNumber/lock', optionalAuth, async (req, res) => {
  try {
    const plan = await ScenePlan.findOne({
      where: { episode_id: req.params.episodeId, beat_number: parseInt(req.params.beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found' });

    await plan.update({ locked: !plan.locked });
    return res.json({ data: plan, message: plan.locked ? 'Beat locked.' : 'Beat unlocked.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK ALL BEATS ────────────────────────────────────────────────────────────

router.post('/:episodeId/plan/lock-all', optionalAuth, async (req, res) => {
  try {
    await ScenePlan.update({ locked: true }, { where: { episode_id: req.params.episodeId } });
    return res.json({ success: true, message: 'All beats locked — ready for script generation.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── SCRIPT CONTEXT (for script generator) ─────────────────────────────────────

router.get('/:episodeId/script-context', optionalAuth, async (req, res) => {
  try {
    const context = await getScenePlanForScriptGenerator(req.params.episodeId);
    return res.json({
      data: context,
      count: context.length,
      ready: context.every(b => b.locked),
      message: context.every(b => b.locked)
        ? 'All beats locked — ready for script generation.'
        : `${context.filter(b => !b.locked).length} beats still unlocked.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
