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
const { scriptOverwriteBlocked, scriptOverwriteRefusalBody } = require('../utils/scriptOverwriteGuard');

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

    if (scriptOverwriteBlocked(episode.script_content, req.body)) {
      console.warn(`[ScriptWriter] Refused overwrite for episode ${episodeId}: existing script_content present, no confirmOverwrite flag.`);
      return res.status(409).json(scriptOverwriteRefusalBody());
    }

    const brief = await models.EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) return res.status(400).json({ error: 'Create an Episode Brief first' });

    console.log(`[ScriptWriter] Generate request for episode ${episodeId}`);

    // The episode's script revision now (A1c R1): the generated script is
    // saved to the episode only if nothing changed it while it was written.
    const { readScriptRevision } = require('../services/scriptSave');
    const expectRevision = await readScriptRevision(models, episodeId);

    const { generateEpisodeScript } = require('../services/episodeScriptWriterService');
    const script = await generateEpisodeScript(episodeId, showId, models, { expectRevision, guardBody: req.body, userId: req.user?.id });

    return res.json({
      success: true,
      message: `Script v${script.version} generated — ${script.word_count} words, ${script.beat_count} beats.`,
      data: script,
      script_revision: script.script_revision,
    });
  } catch (err) {
    console.error('[ScriptWriter] Generate error:', err);
    // Generated and kept as a Script Writer version, but not saved to the
    // episode (A1c R1, D10: no longer reported as a success).
    if (err?.scriptRow) {
      const { ScriptSaveError } = require('../services/scriptSave');
      const refusal = err instanceof ScriptSaveError ? err.body : null;
      return res.status(refusal ? err.status : 500).json({
        ...(refusal || { success: false, error: `The script was generated and kept as Script v${err.scriptRow.version}, but could not be saved to the episode: ${err.message}` }),
        saved: false,
        data: err.scriptRow,
      });
    }
    // A refused budget or a rate limit is a 429 with its code, as the
    // grounded routes answer it (Script page audit 3, 2026-10-19).
    if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
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

    // Lock it and save it to the episode together (A1c R1,
    // services/scriptSave.js): one transaction with the episode row locked,
    // the episode's locked beats kept, the replaced script kept as a
    // version. It replaces the episode's whole script, so the overwrite
    // guard applies as for the other writers (D10): an episode with a script
    // needs confirmOverwrite. A failure is reported, never swallowed, and
    // leaves this script unlocked.
    const models = require('../models');
    const { saveEpisodeScript, sendScriptSaveError } = require('../services/scriptSave');
    const { scriptKeepingLocks } = require('../utils/scriptBeatLocks');
    let saved;
    try {
      saved = await models.sequelize.transaction(async (transaction) => {
        const result = await saveEpisodeScript(models, script.episode_id, {
          writer: 'W4',
          source: 'generate',
          guard: req.body || {},
          userId: req.user?.id,
          transaction,
          compose: (row) => ({ script: scriptKeepingLocks(row, script.script_text).script }),
        });
        await script.update({ status: 'locked' }, { transaction });
        return result;
      });
    } catch (err) {
      console.error('[ScriptWriter] Could not lock the script and save it to the episode:', err.message);
      if (sendScriptSaveError(res, err)) return undefined;
      return res.status(500).json({ error: `The script was not locked: it could not be saved to the episode (${err.message}).` });
    }

    return res.json({ data: script, script_revision: saved.script_revision, message: 'Script locked and saved to episode.' });
  } catch (err) {
    console.error('[ScriptWriter] Lock error:', err.message);
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
        // Which Brain rules this generation will use, and which it will not (2026-10-04).
        brain_rules: context.brainRules,
        opportunities: context.opportunities.length,
        ready: context.scenePlan.length > 0 && !!context.brief,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
