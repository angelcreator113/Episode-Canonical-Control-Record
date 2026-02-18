/**
 * Script Parse Route
 * 
 * POST /api/v1/episodes/:id/parse-script
 *   - Reads episode's script_content (or episode_scripts table)
 *   - Parses beats into a Scene Plan
 *   - Returns structured JSON for Scene Composer
 * 
 * POST /api/v1/scripts/parse
 *   - Accepts raw script text in body
 *   - Returns parsed Scene Plan (no episode required)
 *   - Useful for preview/testing before saving
 * 
 * POST /api/v1/episodes/:id/apply-scene-plan
 *   - Parses script AND creates scenes in the database
 *   - Pre-populates Scene Composer with real scene records
 * 
 * Location: src/routes/scriptParse.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { parseScript } = require('../utils/scriptBeatParser');

// Optional auth — allow unauthenticated for dev
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

/**
 * POST /api/v1/scripts/parse
 * 
 * Parse raw script text into a Scene Plan (no episode required).
 * Good for previewing before saving.
 * 
 * Body: { content: "## BEAT: OPENING...", title?: "Episode Title" }
 * Returns: Scene Plan JSON
 */
router.post('/parse', optionalAuth, async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Script content is required',
        hint: 'Send { content: "## BEAT: OPENING RITUAL\\n..." }'
      });
    }

    const scenePlan = parseScript(content, {
      episodeTitle: title || null,
    });

    if (!scenePlan.success) {
      return res.status(422).json({
        error: 'Failed to parse script',
        details: scenePlan.error,
      });
    }

    return res.json({
      success: true,
      scenePlan,
    });
  } catch (error) {
    console.error('Script parse error:', error);
    return res.status(500).json({
      error: 'Failed to parse script',
      message: error.message,
    });
  }
});


/**
 * POST /api/v1/episodes/:id/parse-script
 * 
 * Parse an episode's script_content into a Scene Plan.
 * Does NOT create scenes — just returns the plan for preview.
 * 
 * Returns: Scene Plan JSON
 */
router.post('/:id/parse-script', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Load episode
    let Episode;
    try {
      const models = require('../models');
      Episode = models.Episode;
    } catch (e) {
      return res.status(500).json({ error: 'Models not loaded' });
    }

    const episode = await Episode.findByPk(id);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Get script content — check episode.script_content first, then episode_scripts table
    let scriptContent = episode.script_content;

    if (!scriptContent) {
      // Try episode_scripts table
      try {
        const models = require('../models');
        if (models.EpisodeScript) {
          const script = await models.EpisodeScript.findOne({
            where: { episode_id: id },
            order: [['version', 'DESC']],
          });
          if (script) {
            scriptContent = script.content;
          }
        }
      } catch (e) {
        // Table might not exist, that's fine
      }
    }

    // Also check request body — user might paste script content directly
    if (!scriptContent && req.body.content) {
      scriptContent = req.body.content;
    }

    if (!scriptContent) {
      return res.status(422).json({
        error: 'No script content found',
        hint: 'Add script content to the episode first, or send { content: "..." } in the request body',
      });
    }

    const scenePlan = parseScript(scriptContent, {
      episodeId: id,
      episodeTitle: episode.title,
    });

    if (!scenePlan.success) {
      return res.status(422).json({
        error: 'Failed to parse script',
        details: scenePlan.error,
      });
    }

    return res.json({
      success: true,
      episodeId: id,
      episodeTitle: episode.title,
      scenePlan,
    });
  } catch (error) {
    console.error('Episode script parse error:', error);
    return res.status(500).json({
      error: 'Failed to parse episode script',
      message: error.message,
    });
  }
});


/**
 * POST /api/v1/episodes/:id/apply-scene-plan
 * 
 * Parse script AND create actual scene records in the database.
 * This is what Scene Composer calls to pre-populate scenes.
 * 
 * Body (optional): 
 *   { content: "...", clearExisting: false }
 *   - content: override script text (otherwise reads from episode)
 *   - clearExisting: if true, delete existing scenes first
 * 
 * Returns: Created scenes + Scene Plan metadata
 */
router.post('/:id/apply-scene-plan', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content: bodyContent, clearExisting = false } = req.body;

    // Load models
    let Episode, Scene;
    try {
      const models = require('../models');
      Episode = models.Episode;
      Scene = models.Scene || models.EpisodeScene;
    } catch (e) {
      return res.status(500).json({ error: 'Models not loaded' });
    }

    const episode = await Episode.findByPk(id);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Get script content
    let scriptContent = bodyContent || episode.script_content;
    if (!scriptContent) {
      try {
        const models = require('../models');
        if (models.EpisodeScript) {
          const script = await models.EpisodeScript.findOne({
            where: { episode_id: id },
            order: [['version', 'DESC']],
          });
          if (script) scriptContent = script.content;
        }
      } catch (e) { /* ignore */ }
    }

    if (!scriptContent) {
      return res.status(422).json({
        error: 'No script content found',
        hint: 'Add script content to the episode, or send { content: "..." }',
      });
    }

    // Parse the script
    const scenePlan = parseScript(scriptContent, {
      episodeId: id,
      episodeTitle: episode.title,
    });

    if (!scenePlan.success || scenePlan.scenes.length === 0) {
      return res.status(422).json({
        error: 'No beats found in script',
        hint: 'Script must contain ## BEAT: tags. Example: ## BEAT: OPENING RITUAL',
      });
    }

    // Optionally clear existing scenes
    if (clearExisting && Scene) {
      await Scene.destroy({
        where: { episode_id: id },
        force: true,
      });
    }

    // Create scene records
    const createdScenes = [];
    for (const sceneDef of scenePlan.scenes) {
      try {
        const sceneData = {
          episode_id: id,
          title: sceneDef.title,
          scene_number: sceneDef.scene_number,
          description: sceneDef.notes || '',
          duration_seconds: sceneDef.duration_seconds,
          status: 'draft',
          // Store the full beat metadata as JSONB
          metadata: {
            beat_type: sceneDef.beat_type,
            raw_beat_title: sceneDef.raw_beat_title,
            density: sceneDef.density,
            mood: sceneDef.mood,
            transition: sceneDef.transition,
            location_hint: sceneDef.location_hint,
            characters_expected: sceneDef.characters_expected,
            ui_expected: sceneDef.ui_expected,
            dialogue_count: sceneDef.dialogue_count,
            script_excerpt: sceneDef.script_excerpt,
            generated_from: 'script_beat_parser',
            generated_at: new Date().toISOString(),
          },
        };

        const created = await Scene.create(sceneData);
        createdScenes.push(created);
      } catch (sceneError) {
        console.error(`Failed to create scene ${sceneDef.scene_number}:`, sceneError.message);
        // Continue creating other scenes
      }
    }

    return res.json({
      success: true,
      episodeId: id,
      episodeTitle: episode.title,
      scenesCreated: createdScenes.length,
      scenesExpected: scenePlan.scenes.length,
      scenePlan,
      scenes: createdScenes,
    });
  } catch (error) {
    console.error('Apply scene plan error:', error);
    return res.status(500).json({
      error: 'Failed to apply scene plan',
      message: error.message,
    });
  }
});


module.exports = router;
