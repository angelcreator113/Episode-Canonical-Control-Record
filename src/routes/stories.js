/**
 * stories.js — Story Persistence + Social Import + Novel Assembler
 *
 * Mounts under /api/v1/stories
 *
 * Story Persistence:
 *   POST   /                       Save or update a story
 *   GET    /character/:charKey      List all stories for a character
 *   GET    /:id                     Get single story
 *   PATCH  /:id                     Update story text/status
 *   DELETE /:id                     Delete story
 *   POST   /:id/approve             Approve a story
 *   POST   /auto-save               Auto-save from StoryReviewPanel
 *
 * Social Import:
 *   POST   /social/import           Import social content
 *   GET    /social/character/:charKey  List imports for a character
 *   PATCH  /social/:id              Update import canon status
 *   DELETE /social/:id              Delete import
 *   POST   /social/:id/detect-lala  Run Lala detection on import
 *
 * Novel Assembler:
 *   POST   /assemblies              Create assembly
 *   GET    /assemblies/character/:charKey  List assemblies for character
 *   GET    /assemblies/:id          Get single assembly
 *   PATCH  /assemblies/:id          Update assembly
 *   DELETE /assemblies/:id          Delete assembly
 *   POST   /assemblies/:id/compile  Compile assembly text + emotional curve
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
} catch (e) {
  console.warn('⚠ Anthropic SDK not available for stories routes');
}

// ============================================================================
// STORY PERSISTENCE
// ============================================================================

/**
 * POST / — Save or update a story (upsert by character_key + story_number)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const {
      character_key, story_number, title, text, phase, story_type,
      word_count, status, task_brief, new_character, new_character_name,
      new_character_role, opening_line, editor_notes,
    } = req.body;

    if (!character_key || !story_number || !title || !text) {
      return res.status(400).json({ error: 'character_key, story_number, title, and text are required' });
    }

    // Upsert: find existing or create new
    let story = await db.StorytellerStory.findOne({
      where: { character_key, story_number },
    });

    if (story) {
      await story.update({
        title, text, phase, story_type,
        word_count: word_count || text.split(/\s+/).length,
        status: status || story.status,
        task_brief: task_brief || story.task_brief,
        new_character, new_character_name, new_character_role,
        opening_line, editor_notes,
        version: story.version + 1,
      });
    } else {
      story = await db.StorytellerStory.create({
        id: uuidv4(),
        character_key, story_number, title, text, phase, story_type,
        word_count: word_count || text.split(/\s+/).length,
        status: status || 'draft',
        task_brief, new_character, new_character_name,
        new_character_role, opening_line, editor_notes,
      });
    }

    res.json({ success: true, story });
  } catch (err) {
    console.error('❌ Story save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auto-save — Auto-save from StoryReviewPanel (lighter payload)
 */
router.post('/auto-save', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const { character_key, story_number, text, editor_notes } = req.body;

    if (!character_key || !story_number) {
      return res.status(400).json({ error: 'character_key and story_number are required' });
    }

    const story = await db.StorytellerStory.findOne({
      where: { character_key, story_number },
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found — save the full story first' });
    }

    const updates = {};
    if (text !== undefined) {
      updates.text = text;
      updates.word_count = text.split(/\s+/).length;
    }
    if (editor_notes !== undefined) updates.editor_notes = editor_notes;
    updates.version = story.version + 1;

    await story.update(updates);
    res.json({ success: true, version: story.version, word_count: story.word_count });
  } catch (err) {
    console.error('❌ Auto-save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /character/:charKey — List all stories for a character
 */
router.get('/character/:charKey', async (req, res) => {
  try {
    const db = require('../models');
    const stories = await db.StorytellerStory.findAll({
      where: { character_key: req.params.charKey },
      order: [['story_number', 'ASC']],
    });
    res.json({ stories, count: stories.length });
  } catch (err) {
    console.error('❌ Story list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /:id — Get single story
 */
router.get('/:id', async (req, res) => {
  try {
    const db = require('../models');
    const story = await db.StorytellerStory.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (err) {
    console.error('❌ Story get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:id — Update story
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const story = await db.StorytellerStory.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const allowedFields = [
      'title', 'text', 'phase', 'story_type', 'status',
      'editor_notes', 'consistency_result', 'therapy_memories',
    ];
    const updates = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (updates.text) updates.word_count = updates.text.split(/\s+/).length;
    updates.version = story.version + 1;

    await story.update(updates);
    res.json({ success: true, story });
  } catch (err) {
    console.error('❌ Story update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /:id — Delete story
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const db = require('../models');
    const story = await db.StorytellerStory.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    await story.destroy();
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('❌ Story delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /:id/approve — Approve a story
 */
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const story = await db.StorytellerStory.findByPk(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    await story.update({
      status: 'approved',
      approved_at: new Date(),
    });

    res.json({ success: true, story });
  } catch (err) {
    console.error('❌ Story approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SOCIAL MEDIA IMPORT
// ============================================================================

const PLATFORMS = ['instagram', 'twitter', 'tiktok', 'youtube', 'reddit', 'custom'];

/**
 * POST /social/import — Import social content and run AI analysis
 */
router.post('/social/import', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const { character_key, platform, source_url, raw_content, import_batch } = req.body;

    if (!character_key || !platform || !raw_content) {
      return res.status(400).json({ error: 'character_key, platform, and raw_content are required' });
    }

    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    }

    // Create the import record first
    const importRecord = await db.SocialMediaImport.create({
      id: uuidv4(),
      character_key,
      platform,
      source_url,
      raw_content,
      import_batch: import_batch || `batch-${Date.now()}`,
    });

    // Run AI analysis in background
    let aiResult = null;
    if (Anthropic && process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const analysisPrompt = `Analyze this social media content from ${platform} for a fictional character study.
The character is "${character_key}" from the Prime Studios universe.

Content:
---
${raw_content.slice(0, 3000)}
---

Return JSON only (no markdown):
{
  "detected_voice": "string - the voice/persona detected (e.g., 'vulnerable confession', 'defiant proclamation', 'masked humor')",
  "emotional_tags": ["array", "of", "emotional", "tone", "tags"],
  "parsed_content": {
    "key_statements": ["most important lines"],
    "subtext": "what's really being said beneath the surface",
    "character_moment": "what this reveals about the character"
  },
  "lala_detected": false,
  "lala_markers": []
}

For lala_detected: set true ONLY if the content shows signs of a character breaking through their surface persona — speaking in third person, referencing an alter ego, sudden tone shifts from controlled to raw, or direct "she/her" references about self.`;

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: analysisPrompt }],
        });

        const text = response.content[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
          await importRecord.update({
            detected_voice: aiResult.detected_voice,
            emotional_tags: aiResult.emotional_tags,
            parsed_content: aiResult.parsed_content,
            lala_detected: aiResult.lala_detected || false,
            lala_markers: aiResult.lala_markers || [],
          });
        }
      } catch (aiErr) {
        console.warn('⚠ AI analysis failed for social import:', aiErr.message);
      }
    }

    const updatedRecord = await db.SocialMediaImport.findByPk(importRecord.id);
    res.json({ success: true, import: updatedRecord, ai_analyzed: !!aiResult });
  } catch (err) {
    console.error('❌ Social import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /social/character/:charKey — List imports for a character
 */
router.get('/social/character/:charKey', async (req, res) => {
  try {
    const db = require('../models');
    const imports = await db.SocialMediaImport.findAll({
      where: { character_key: req.params.charKey },
      order: [['created_at', 'DESC']],
    });
    res.json({ imports, count: imports.length });
  } catch (err) {
    console.error('❌ Social list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /social/:id — Update import canon status
 */
router.patch('/social/:id', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const record = await db.SocialMediaImport.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Import not found' });

    const allowedFields = ['canon_status', 'assigned_story_id', 'emotional_tags'];
    const updates = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    await record.update(updates);
    res.json({ success: true, import: record });
  } catch (err) {
    console.error('❌ Social update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /social/:id — Delete import
 */
router.delete('/social/:id', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const record = await db.SocialMediaImport.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Import not found' });
    await record.destroy();
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('❌ Social delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /social/:id/detect-lala — Run Lala detection on import
 */
router.post('/social/:id/detect-lala', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const record = await db.SocialMediaImport.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Import not found' });

    if (!Anthropic || !process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const lalaPrompt = `You are the Lala Emergence Detection Engine for Prime Studios.

Analyze this social media content for signs of "Lala" — the alter ego / emergent persona within JustAWoman.

Lala emerges when:
- Third-person self-reference ("She needs to stop pretending")
- Sudden raw honesty after controlled tone
- References to "the other one" or "her"
- Protective anger on behalf of vulnerable self
- Code-switching between polished and unfiltered voice
- Breaking the fourth wall of her own persona

Content from ${record.platform}:
---
${record.raw_content.slice(0, 4000)}
---

Return JSON only:
{
  "lala_detected": true/false,
  "confidence": 0.0-1.0,
  "markers": [
    {
      "type": "third_person|tone_shift|protective_anger|code_switch|wall_break",
      "excerpt": "the exact text that triggered detection",
      "analysis": "why this is a Lala marker"
    }
  ],
  "emergence_stage": "dormant|stirring|surfacing|present|dominant"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: lalaPrompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      await record.update({
        lala_detected: result.lala_detected || false,
        lala_markers: result.markers || [],
      });
      res.json({ success: true, detection: result, import: await db.SocialMediaImport.findByPk(req.params.id) });
    } else {
      res.json({ success: false, error: 'AI returned no parseable result' });
    }
  } catch (err) {
    console.error('❌ Lala detection error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// NOVEL ASSEMBLER
// ============================================================================

/**
 * POST /assemblies — Create assembly
 */
router.post('/assemblies', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const { title, character_key, story_ids, social_import_ids } = req.body;

    if (!title || !character_key) {
      return res.status(400).json({ error: 'title and character_key are required' });
    }

    const assembly = await db.NovelAssembly.create({
      id: uuidv4(),
      title,
      character_key,
      story_ids: story_ids || [],
      social_import_ids: social_import_ids || [],
      status: 'draft',
    });

    res.json({ success: true, assembly });
  } catch (err) {
    console.error('❌ Assembly create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assemblies/character/:charKey — List assemblies for character
 */
router.get('/assemblies/character/:charKey', async (req, res) => {
  try {
    const db = require('../models');
    const assemblies = await db.NovelAssembly.findAll({
      where: { character_key: req.params.charKey },
      order: [['created_at', 'DESC']],
    });
    res.json({ assemblies, count: assemblies.length });
  } catch (err) {
    console.error('❌ Assembly list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assemblies/:id — Get single assembly
 */
router.get('/assemblies/:id', async (req, res) => {
  try {
    const db = require('../models');
    const assembly = await db.NovelAssembly.findByPk(req.params.id);
    if (!assembly) return res.status(404).json({ error: 'Assembly not found' });
    res.json(assembly);
  } catch (err) {
    console.error('❌ Assembly get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /assemblies/:id — Update assembly
 */
router.patch('/assemblies/:id', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const assembly = await db.NovelAssembly.findByPk(req.params.id);
    if (!assembly) return res.status(404).json({ error: 'Assembly not found' });

    const allowedFields = [
      'title', 'story_ids', 'social_import_ids', 'assembly_order',
      'chapter_breaks', 'status', 'metadata',
    ];
    const updates = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    await assembly.update(updates);
    res.json({ success: true, assembly });
  } catch (err) {
    console.error('❌ Assembly update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /assemblies/:id — Delete assembly
 */
router.delete('/assemblies/:id', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const assembly = await db.NovelAssembly.findByPk(req.params.id);
    if (!assembly) return res.status(404).json({ error: 'Assembly not found' });
    await assembly.destroy();
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('❌ Assembly delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assemblies/:id/compile — Compile assembly: stitch stories, compute emotional curve
 */
router.post('/assemblies/:id/compile', authenticateToken, async (req, res) => {
  try {
    const db = require('../models');
    const assembly = await db.NovelAssembly.findByPk(req.params.id);
    if (!assembly) return res.status(404).json({ error: 'Assembly not found' });

    // Fetch all stories in order
    const storyIds = assembly.story_ids || [];
    const stories = await db.StorytellerStory.findAll({
      where: { id: storyIds },
      order: [['story_number', 'ASC']],
    });

    // Fetch social imports if any
    const socialIds = assembly.social_import_ids || [];
    let socialImports = [];
    if (socialIds.length > 0) {
      socialImports = await db.SocialMediaImport.findAll({
        where: { id: socialIds },
        order: [['created_at', 'ASC']],
      });
    }

    // Build compiled text with chapter markers
    let compiledText = '';
    let totalWords = 0;
    const chapterBreaks = [];
    const emotionalCurve = [];

    // Use assembly_order if provided, otherwise stories in order
    const order = assembly.assembly_order || stories.map((s, i) => ({
      type: 'story', id: s.id, position: i,
    }));

    for (const item of order) {
      if (item.type === 'story') {
        const story = stories.find(s => s.id === item.id);
        if (story) {
          chapterBreaks.push({
            position: totalWords,
            title: story.title,
            story_number: story.story_number,
            type: 'story',
          });
          compiledText += `\n\n--- ${story.title} ---\n\n${story.text}`;
          totalWords += story.word_count || story.text.split(/\s+/).length;

          // Build emotional curve data point
          emotionalCurve.push({
            story_number: story.story_number,
            title: story.title,
            phase: story.phase,
            word_position: totalWords,
            intensity: getPhaseIntensity(story.phase),
          });
        }
      } else if (item.type === 'import') {
        const imp = socialImports.find(s => s.id === item.id);
        if (imp) {
          chapterBreaks.push({
            position: totalWords,
            title: `[${imp.platform}] Import`,
            type: 'import',
          });
          compiledText += `\n\n--- [${imp.platform} Import] ---\n\n${imp.raw_content}`;
          totalWords += imp.raw_content.split(/\s+/).length;
        }
      }
    }

    // If no custom order, just stitch stories sequentially
    if (!assembly.assembly_order) {
      compiledText = '';
      totalWords = 0;
      chapterBreaks.length = 0;

      for (const story of stories) {
        chapterBreaks.push({
          position: totalWords,
          title: story.title,
          story_number: story.story_number,
          type: 'story',
        });
        compiledText += `\n\n--- ${story.title} ---\n\n${story.text}`;
        const wc = story.word_count || story.text.split(/\s+/).length;
        totalWords += wc;

        emotionalCurve.push({
          story_number: story.story_number,
          title: story.title,
          phase: story.phase,
          word_position: totalWords,
          intensity: getPhaseIntensity(story.phase),
        });
      }
    }

    await assembly.update({
      compiled_text: compiledText.trim(),
      total_word_count: totalWords,
      chapter_breaks: chapterBreaks,
      emotional_curve: emotionalCurve,
      status: 'review',
    });

    res.json({
      success: true,
      assembly: await db.NovelAssembly.findByPk(req.params.id),
      stats: {
        stories_included: stories.length,
        social_imports_included: socialImports.length,
        total_words: totalWords,
        chapters: chapterBreaks.length,
      },
    });
  } catch (err) {
    console.error('❌ Assembly compile error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper: map phase to emotional intensity (0-1)
function getPhaseIntensity(phase) {
  const map = {
    establishment: 0.3,
    pressure: 0.6,
    crisis: 0.9,
    integration: 0.5,
  };
  return map[phase] || 0.4;
}

module.exports = router;
