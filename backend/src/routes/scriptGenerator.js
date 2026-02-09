const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');
const { analyzeWritingPatterns } = require('../utils/scriptParser');

/**
 * Get or create show configuration
 * GET /api/v1/shows/:showId/config
 */
router.get('/:showId/config', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;

    let config = await db.ShowConfig.findOne({ where: { show_id: showId } });

    if (!config) {
      // Create default config
      config = await db.ShowConfig.create({
        show_id: showId,
        target_duration: 600,
        target_scene_count: 7,
        format: 'YouTube long-form',
        niche_category: 'general',
        content_specs: {
          words_per_minute: 150,
          target_tolerance: 60
        }
      });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to get show config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * Update show configuration
 * PUT /api/v1/shows/:showId/config
 */
router.put('/:showId/config', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const updates = req.body;

    let config = await db.ShowConfig.findOne({ where: { show_id: showId } });

    if (!config) {
      config = await db.ShowConfig.create({ show_id: showId, ...updates });
    } else {
      await config.update(updates);
    }

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * Get show template
 * GET /api/v1/shows/:showId/template
 */
router.get('/:showId/template', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;

    const template = await db.ScriptTemplate.findOne({
      where: { show_id: showId },
      order: [['version', 'DESC']]
    });

    if (!template) {
      return res.status(404).json({ error: 'No template found for this show' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({ error: 'Failed to load template' });
  }
});

/**
 * Create or update script template
 * POST /api/v1/shows/:showId/template
 */
router.post('/:showId/template', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { name, template_content, variables, scene_structure } = req.body;

    const template = await db.ScriptTemplate.create({
      show_id: showId,
      name,
      template_content,
      variables,
      scene_structure,
      version: 1
    });

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * Generate AI suggestions for episode
 * POST /api/v1/episodes/:episodeId/script-suggestions
 */
router.post('/:episodeId/script-suggestions', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { template_id } = req.body;

    // Get episode with context
    const episode = await db.Episode.findByPk(episodeId, {
      include: [
        { model: db.Show }
      ]
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // If no template_id provided, return empty suggestions
    if (!template_id) {
      return res.json({ success: true, data: [] });
    }

    // Get template
    const template = await db.ScriptTemplate.findByPk(template_id);

    if (!template) {
      // Return empty suggestions instead of error
      return res.json({ success: true, data: [] });
    }

    // Generate smart suggestions based on show and episode context
    const suggestions = [];
    const showData = episode.Show || {};

    // Helper function to generate suggestions
    const generateSuggestion = (variable) => {
      const suggestionMap = {
        'opening_line': [
          `Welcome to ${showData.name || 'our show'}!`,
          `Hey everyone, welcome back!`,
          `Let's dive right in to today's amazing content!`
        ],
        'main_topic': [
          `Today we're exploring something special`,
          `Let's talk about what matters`,
          `Here's what we're covering today`
        ],
        'key_points': [
          `Key points to remember today`,
          `Important takeaways from our discussion`,
          `What you need to know`
        ],
        'closing_message': [
          `Thanks for joining us today!`,
          `Until next time, stay awesome!`,
          `Keep watching for more great content!`
        ]
      };

      const suggestions_list = suggestionMap[variable.key] || [''];
      return suggestions_list[Math.floor(Math.random() * suggestions_list.length)];
    };

    // Create suggestions for each variable
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        const suggestedValue = generateSuggestion(variable);
        
        suggestions.push({
          episode_id: episodeId,
          variable_key: variable.key,
          suggested_value: suggestedValue,
          context_used: 'show_context',
          confidence_score: 0.85
        });
      }
    }

    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions', details: error.message });
  }
});

/**
 * Generate script from template
 * POST /api/v1/templates/:templateId/generate
 */
router.post('/:templateId/generate', optionalAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { episode_id, variables } = req.body;

    const template = await db.ScriptTemplate.findByPk(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace variables in template
    let generatedScript = template.template_content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      generatedScript = generatedScript.replace(regex, value);
    });

    res.json({
      success: true,
      data: {
        script: generatedScript,
        template_used: template.name,
        variables_applied: variables,
        metadata: {
          estimated_duration: Math.round(generatedScript.split(/\s+/).length * 0.4),
          word_count: generatedScript.split(/\s+/).length,
          scene_count: (generatedScript.match(/SCENE \d+:/g) || []).length
        }
      }
    });
  } catch (error) {
    console.error('Failed to generate script:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

/**
 * Parse scenes from script content
 * POST /api/v1/scripts/:scriptId/parse-scenes
 */
router.post('/:scriptId/parse-scenes', optionalAuth, async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { parseScriptScenes } = require('../utils/scriptParser');

    const script = await db.EpisodeScript.findByPk(scriptId);

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Parse scenes from script content
    const scenes = parseScriptScenes(script.content);

    // Create scene records
    const createdScenes = await Promise.all(
      scenes.map((scene, index) =>
        db.EpisodeScene.create({
          episode_script_id: scriptId,
          scene_number: index + 1,
          title: scene.name,
          description: scene.description,
          content: scene.content,
          scene_type: scene.type || 'SCENE',
          duration_seconds: scene.duration || 0
        }).catch(err => {
          console.error(`Failed to create scene ${index + 1}:`, err);
          return null;
        })
      )
    );

    res.json({
      success: true,
      data: {
        scenes_parsed: scenes.length,
        scenes_created: createdScenes.filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Failed to parse scenes:', error);
    res.status(500).json({ error: 'Failed to parse scenes' });
  }
});

/**
 * AI suggestion generation helper
 */
async function generateSmartSuggestion({ variable, episode, patterns, pastScripts }) {
  // Context gathering
  const context = {
    episode_number: episode.episode_number,
    show_name: episode.show?.name,
    wardrobe_items: episode.episodeWardrobes?.map(ew => ew.wardrobe?.name).filter(Boolean) || [],
    past_themes: pastScripts.slice(0, 3).map(s => extractTheme(s.content)).filter(Boolean)
  };

  // Simple rule-based suggestions (can be enhanced with Claude API later)
  let suggestedValue = '';
  let reasoning = '';

  switch (variable.key) {
    case 'EMOTIONAL_FOCUS':
      const emotions = ['confidence', 'empowerment', 'self-discovery', 'transformation', 'freedom'];
      suggestedValue = emotions[Math.floor(Math.random() * emotions.length)];
      reasoning = `Based on ${patterns.emotional_tone} tone from past episodes`;
      break;

    case 'OUTFIT_INTENTION':
      if (context.wardrobe_items.length > 0) {
        suggestedValue = `Show-stopping elegance featuring ${context.wardrobe_items[0]}`;
        reasoning = `Based on wardrobe item: ${context.wardrobe_items[0]}`;
      } else {
        suggestedValue = 'Effortless confidence with elevated basics';
        reasoning = 'Default suggestion - no wardrobe context available';
      }
      break;

    case 'SOCIAL_PROOF':
      const engagement = 1000 + (episode.episode_number * 247);
      suggestedValue = `${engagement.toLocaleString()} besties already love this look`;
      reasoning = `Estimated based on episode ${episode.episode_number}`;
      break;

    default:
      if (variable.examples && variable.examples.length > 0) {
        suggestedValue = variable.examples[0];
        reasoning = 'Using template example';
      }
  }

  return {
    value: suggestedValue,
    context: { ...context, reasoning },
    confidence: 0.75
  };
}

function extractTheme(scriptContent) {
  // Simple theme extraction (look for common patterns)
  if (!scriptContent) return null;
  
  const themes = ['confidence', 'power', 'transformation', 'authenticity', 'style'];
  const lowerScript = scriptContent.toLowerCase();
  
  for (const theme of themes) {
    if (lowerScript.includes(theme)) {
      return theme;
    }
  }
  
  return null;
}

module.exports = router;
