const express = require('express');
const router = express.Router();
const { SceneFootageLink, Scene, ScriptMetadata } = require('../models');

// Create scene-footage link
router.post('/', async (req, res) => {
  try {
    const { sceneId, footageId, matchType = 'manual', confidenceScore, notes, createdBy } = req.body;

    if (!sceneId || !footageId) {
      return res.status(400).json({ error: 'sceneId and footageId are required' });
    }

    // Check if link already exists
    const existing = await SceneFootageLink.findOne({
      where: { scene_id: sceneId }
    });

    if (existing) {
      return res.status(409).json({ error: 'This scene is already linked to footage' });
    }

    const link = await SceneFootageLink.create({
      scene_id: sceneId,
      footage_id: footageId,
      match_type: matchType,
      confidence_score: confidenceScore,
      notes: notes || null,
      created_by: createdBy || 'system'
    });

    const linkWithDetails = await SceneFootageLink.findByPk(link.id, {
      include: [
        { model: ScriptMetadata, as: 'aiScene' },
        { model: Scene, as: 'footage' }
      ]
    });

    res.status(201).json(linkWithDetails);
  } catch (error) {
    console.error('Error creating scene link:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all links for an episode
router.get('/episode/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params;

    const links = await SceneFootageLink.findAll({
      include: [
        {
          model: ScriptMetadata,
          as: 'aiScene',
          where: { episode_id: episodeId },
          required: true
        },
        {
          model: Scene,
          as: 'footage',
          where: { deleted_at: null },
          required: true
        }
      ]
    });

    res.json(links);
  } catch (error) {
    console.error('Error fetching scene links:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete scene-footage link
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const link = await SceneFootageLink.findByPk(id);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    await link.destroy();
    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Error deleting scene link:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-match footage to scenes
router.post('/auto-match', async (req, res) => {
  try {
    const { episodeId, scriptId } = req.body;

    if (!episodeId || !scriptId) {
      return res.status(400).json({ error: 'episodeId and scriptId are required' });
    }

    // Get all AI scenes for this script
    const aiScenes = await ScriptMetadata.findAll({
      where: {
        episode_id: episodeId,
        script_id: scriptId,
        type: 'scene'
      }
    });

    // Get all footage for this episode
    const footage = await Scene.findAll({
      where: {
        episode_id: episodeId,
        deleted_at: null
      }
    });

    const matches = [];
    const suggestions = [];

    // Attempt to match by scene number and type
    for (const aiScene of aiScenes) {
      // Extract scene number from name (e.g., "Scene 1" -> 1)
      const sceneNumMatch = aiScene.name?.match(/Scene (\d+)/i);
      if (!sceneNumMatch) continue;

      const sceneNum = sceneNumMatch[1];

      // Check if already linked
      const existingLink = await SceneFootageLink.findOne({
        where: { scene_id: aiScene.id }
      });

      if (existingLink) continue;

      // Look for matching footage
      for (const footageItem of footage) {
        const footageName = footageItem.name || '';
        const footageNameLower = footageName.toLowerCase();

        // Check for scene number match
        const hasSceneNum = footageName.includes(sceneNum) || 
                           footageName.includes(`scene${sceneNum}`) ||
                           footageName.includes(`scene_${sceneNum}`);

        if (!hasSceneNum) continue;

        // Check scene type match
        const sceneType = aiScene.metadata?.sceneType?.toLowerCase() || '';
        let confidenceScore = 0.5;

        if (sceneType && footageNameLower.includes(sceneType)) {
          confidenceScore = 0.9;
          // High confidence - auto-link
          const link = await SceneFootageLink.create({
            scene_id: aiScene.id,
            footage_id: footageItem.id,
            match_type: 'auto',
            confidence_score: confidenceScore,
            notes: 'Auto-matched by filename pattern',
            created_by: 'auto-match-system'
          });

          matches.push({
            sceneId: aiScene.id,
            sceneName: aiScene.name,
            footageId: footageItem.id,
            footageName: footageItem.name,
            confidenceScore,
            linkId: link.id
          });

          break; // Move to next AI scene
        } else if (hasSceneNum) {
          // Moderate confidence - suggest
          suggestions.push({
            sceneId: aiScene.id,
            sceneName: aiScene.name,
            footageId: footageItem.id,
            footageName: footageItem.name,
            confidenceScore: 0.6
          });
        }
      }
    }

    res.json({
      matched: matches.length,
      suggested: suggestions.length,
      matches,
      suggestions
    });
  } catch (error) {
    console.error('Error auto-matching scenes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
