'use strict';

/**
 * Episode Script Writer Routes
 * Mount at: /api/v1/episode-scripts
 *
 * Full AI-powered script generation from beats + feed moments + financial pressure.
 * Creates versioned scripts, supports editing and approval flow.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// ── GENERATE SCRIPT ──────────────────────────────────────────────────────────
// POST /api/v1/episode-scripts/:episodeId/generate
router.post('/:episodeId/generate', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    if (!showId) return res.status(400).json({ error: 'showId is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const models = require('../models');
    const episode = await models.Episode.findByPk(episodeId);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const brief = await models.EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) return res.status(400).json({ error: 'Create an Episode Brief first' });

    console.log(`[ScriptWriter] Generate request for episode ${episodeId}`);

    const { generateEpisodeScript } = require('../services/episodeScriptWriterService');
    const script = await generateEpisodeScript(episodeId, showId, models);

    return res.json({
      success: true,
      message: `Script v${script.version} generated — ${script.word_count} words, ${script.beat_count} beats.`,
      data: script,
    });
  } catch (err) {
    console.error('[ScriptWriter] Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── LIST SCRIPT VERSIONS ─────────────────────────────────────────────────────
// GET /api/v1/episode-scripts/:episodeId
router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    const { EpisodeScript } = require('../models');
    const scripts = await EpisodeScript.findAll({
      where: { episode_id: req.params.episodeId, deleted_at: null },
      order: [['version', 'DESC']],
      attributes: ['id', 'version', 'status', 'title', 'word_count', 'beat_count',
                   'voice_score', 'generation_model', 'generation_tokens',
                   'financial_context', 'author_notes', 'edited_by', 'edited_at',
                   'created_at'],
    });
    return res.json({ data: scripts, count: scripts.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET SPECIFIC VERSION ─────────────────────────────────────────────────────
// GET /api/v1/episode-scripts/:episodeId/version/:version
router.get('/:episodeId/version/:version', requireAuth, async (req, res) => {
  try {
    const { EpisodeScript } = require('../models');
    const script = await EpisodeScript.findOne({
      where: {
        episode_id: req.params.episodeId,
        version: parseInt(req.params.version, 10),
        deleted_at: null,
      },
    });
    if (!script) return res.status(404).json({ error: 'Script version not found' });
    return res.json({ data: script });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET LATEST VERSION ───────────────────────────────────────────────────────
// GET /api/v1/episode-scripts/:episodeId/latest
router.get('/:episodeId/latest', requireAuth, async (req, res) => {
  try {
    const { EpisodeScript } = require('../models');
    const script = await EpisodeScript.findOne({
      where: { episode_id: req.params.episodeId, deleted_at: null },
      order: [['version', 'DESC']],
    });
    if (!script) return res.status(404).json({ error: 'No scripts found for this episode' });
    return res.json({ data: script });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── UPDATE SCRIPT (edit text, notes, status) ─────────────────────────────────
// PUT /api/v1/episode-scripts/:scriptId
router.put('/:scriptId', requireAuth, async (req, res) => {
  try {
    const { EpisodeScript } = require('../models');
    const script = await EpisodeScript.findByPk(req.params.scriptId);
    if (!script) return res.status(404).json({ error: 'Script not found' });
    if (script.status === 'locked') return res.status(409).json({ error: 'Script is locked' });

    const updatable = ['script_text', 'script_json', 'title', 'author_notes', 'status', 'voice_score'];
    const updates = {};
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Track edits
    if (updates.script_text || updates.script_json) {
      updates.edited_by = req.body.edited_by || 'author';
      updates.edited_at = new Date();
      if (updates.script_text) {
        updates.word_count = updates.script_text.split(/\s+/).filter(Boolean).length;
      }
    }

    await script.update(updates);
    return res.json({ data: script });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK SCRIPT ──────────────────────────────────────────────────────────────
// POST /api/v1/episode-scripts/:scriptId/lock
router.post('/:scriptId/lock', requireAuth, async (req, res) => {
  try {
    const { EpisodeScript } = require('../models');
    const script = await EpisodeScript.findByPk(req.params.scriptId);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    await script.update({ status: 'locked' });

    // Save locked script to episode
    try {
      const { Episode } = require('../models');
      await Episode.update(
        { script_content: script.script_text },
        { where: { id: script.episode_id } }
      );
    } catch { /* non-blocking */ }

    return res.json({ data: script, message: 'Script locked and saved to episode.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET GENERATION CONTEXT (preview what will feed the AI) ───────────────────
// GET /api/v1/episode-scripts/:episodeId/context
router.get('/:episodeId/context', requireAuth, async (req, res) => {
  try {
    const { showId } = req.query;
    if (!showId) return res.status(400).json({ error: 'showId query param required' });

    const models = require('../models');
    const { loadScriptContext } = require('../services/episodeScriptWriterService');
    const context = await loadScriptContext(req.params.episodeId, showId, models);

    return res.json({
      data: {
        has_brief: !!context.brief,
        brief_archetype: context.brief?.episode_archetype,
        scene_plan_beats: context.scenePlan.length,
        has_event: !!context.event,
        event_name: context.event?.name,
        event_prestige: context.event?.prestige,
        financial: context.financial,
        wardrobe_items: context.wardrobe.length,
        feed_moments: context.feedMoments.length,
        franchise_laws: context.franchiseLaws.length,
        opportunities: context.opportunities.length,
        ready: context.scenePlan.length > 0 && !!context.brief,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
