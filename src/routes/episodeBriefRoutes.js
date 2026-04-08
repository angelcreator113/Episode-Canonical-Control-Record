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

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
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

// ── GENERATE GROUNDED SCRIPT ──────────────────────────────────────────────────

router.post('/:episodeId/generate-script', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    if (!showId) {
      return res.status(400).json({ error: 'showId is required in request body' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) {
      return res.status(400).json({ error: 'Episode Brief not found. Create the Brief first.' });
    }

    console.log(`[ScriptGen] Generating grounded script for episode: ${episodeId}`);

    const { generateGroundedScript } = require('../services/groundedScriptGeneratorService');
    const models = require('../models');
    const script = await generateGroundedScript(episodeId, showId, models);

    // Save script to episode
    try {
      const episode = await models.Episode.findByPk(episodeId);
      if (episode) {
        await episode.update({ script_content: script });
      }
    } catch (saveErr) {
      console.warn('[ScriptGen] Could not save to episode:', saveErr.message);
    }

    return res.json({ success: true, script, episodeId });
  } catch (err) {
    console.error('[ScriptGen] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── REWRITE SINGLE LINE (with Show Brain voice DNA) ───────────────────────────

router.post('/:episodeId/rewrite-line', optionalAuth, async (req, res) => {
  try {
    const { line, speaker, beatName, beatContext, showId: _showId } = req.body;
    if (!line) return res.status(400).json({ error: 'line is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    // Load voice DNA from Show Brain
    const models = require('../models');
    let voiceLaws = '';
    try {
      if (models.FranchiseKnowledge) {
        const laws = await models.FranchiseKnowledge.findAll({
          where: { status: 'active', always_inject: true },
          attributes: ['title', 'content', 'category'], limit: 30,
        });
        // For line rewrites, prioritize voice/character rules but include all
        const voiceFirst = laws.sort((a, b) => {
          const aVoice = /voice|lala|jawihp|character/i.test(a.title) ? 0 : 1;
          const bVoice = /voice|lala|jawihp|character/i.test(b.title) ? 0 : 1;
          return aVoice - bVoice;
        });
        voiceLaws = voiceFirst
          .map(l => { try { const c = JSON.parse(l.content); return `${l.title}: ${c.summary || c.rule || ''}`; } catch { return l.title; } })
          .join('\n');
      }
    } catch (err) { console.warn('[RewriteLine] Failed to load voice laws:', err?.message); }

    const isLala = speaker === 'Lala';
    const isPrime = speaker === 'Prime' || speaker === 'Me';

    const prompt = `You are rewriting a single line of dialogue for "Styling Adventures with Lala."

${voiceLaws ? `SHOW BRAIN VOICE RULES:\n${voiceLaws}\n\n` : ''}
SPEAKER: ${speaker}
BEAT: ${beatName || 'Unknown'}
${beatContext ? `EMOTIONAL CONTEXT: ${beatContext}\n` : ''}
ORIGINAL LINE: ${line}

${isLala ? 'Rewrite as Lala — confident, short, punchy, calls people "bestie", slightly dramatic, always positive. Max 2 sentences.' : ''}
${isPrime ? 'Rewrite as JAWIHP (Prime) — warm, direct, addresses "besties", reacts naturally, community-focused.' : ''}
${!isLala && !isPrime ? `Rewrite naturally for ${speaker}.` : ''}

Return ONLY the rewritten dialogue. No speaker prefix, no quotes, no explanation.`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
    const rewrittenLine = response.content[0]?.text?.trim() || line;

    return res.json({ rewrittenLine, original: line });
  } catch (err) {
    console.error('[RewriteLine] Error:', err.message);
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
