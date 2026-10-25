/**
 * World Events routes — episode stories
 *
 * POST   /api/v1/world/:showId/episodes/:episodeId/generate-story
 * GET    /api/v1/world/:showId/stories
 * GET    /api/v1/world/:showId/stories/:storyId
 * PUT    /api/v1/world/:showId/stories/:storyId
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');

// ═══════════════════════════════════════════════════════════════════════
// STORIES — auto-generate prose stories from episodes
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-story
router.post('/world/:showId/episodes/:episodeId/generate-story', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const { format = 'short_story', povCharacter = 'lala' } = req.body;
    const models = req.app?.get?.('models') || require('../../models');
    const { generateEpisodeStory } = require('../../services/storyGenerationService');

    const result = await generateEpisodeStory(episodeId, showId, models.sequelize, { format, povCharacter });

    return res.json({
      success: true,
      message: `${result.format} generated — ${result.wordCount} words`,
      data: result,
    });
  } catch (err) {
    console.error('[StoryGen] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/stories — list all stories for a show
router.get('/world/:showId/stories', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { episode_id, format, status, limit = 50 } = req.query;
    const models = req.app?.get?.('models') || require('../../models');
    const { getStories } = require('../../services/storyGenerationService');

    const stories = await getStories(models.sequelize, {
      showId, episodeId: episode_id || null, format, status, limit: parseInt(limit),
    });

    return res.json({ success: true, data: stories, count: stories.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/stories/:storyId — get a single story with full content
router.get('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');

    const [story] = await models.sequelize.query(
      'SELECT * FROM stories WHERE id = :storyId AND deleted_at IS NULL LIMIT 1',
      { replacements: { storyId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!story) return res.status(404).json({ success: false, error: 'Story not found' });

    return res.json({ success: true, data: story });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/stories/:storyId — update story content (editing)
router.put('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { content, title, status } = req.body;
    const models = req.app?.get?.('models') || require('../../models');

    const sets = [];
    const replacements = { storyId };
    if (content !== undefined) { sets.push('content = :content'); replacements.content = content; sets.push('word_count = :wc'); replacements.wc = content.split(/\s+/).filter(Boolean).length; }
    if (title !== undefined) { sets.push('title = :title'); replacements.title = title; }
    if (status !== undefined) { sets.push('status = :status'); replacements.status = status; }
    sets.push('updated_at = NOW()');

    await models.sequelize.query(`UPDATE stories SET ${sets.join(', ')} WHERE id = :storyId`, { replacements });

    return res.json({ success: true, message: 'Story updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
