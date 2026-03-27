// routes/novelIntelligenceRoutes.js
//
// Mount in app.js:
//   const novelIntelligenceRoutes = require('./routes/novelIntelligenceRoutes');
//   app.use('/api/v1/novel', novelIntelligenceRoutes);

const express   = require('express');
const crypto    = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const router    = express.Router();
const db        = require('../models');
const { optionalAuth } = require('../middleware/auth');
const { Op }    = require('sequelize');

const client = new Anthropic();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

// Build voice rule injection string for a series
async function getVoiceRules(seriesId) {
  const where = {
    status: 'active',
    confirmed_by_author: true,
  };
  if (seriesId) {
    where[Op.or] = [{ series_id: seriesId }, { series_id: null }];
  }
  const rules = await db.VoiceRule.findAll({
    where,
    order: [['signal_count', 'DESC']],
    limit: 30,
  });
  if (!rules.length) return '';
  return '\n\nAUTHOR VOICE RULES (learned from edits — always apply):\n' +
    rules.map(r => `• [${r.rule_type}] ${r.character_name ? r.character_name + ': ' : ''}${r.rule_text}`)
      .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT-AS-SIGNAL ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/novel/signal
router.post('/signal', optionalAuth, async (req, res) => {
  const { line_id, original_text, edited_text, book_id, chapter_id, series_id, scene_context } = req.body;

  if (!original_text || !edited_text) return res.status(400).json({ error: 'original_text and edited_text required' });
  if (original_text.trim() === edited_text.trim()) return res.json({ skipped: true, reason: 'no change detected' });

  try {
    const analysis = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are analyzing an author's edit to detect voice patterns for a novel writing system.

ORIGINAL (what AI wrote): ${original_text}
EDITED (what author changed it to): ${edited_text}
SCENE CONTEXT: ${scene_context || 'unknown'}

Analyze what the author changed and why. Respond ONLY in JSON:
{
  "diff_summary": "one sentence describing what changed and why it matters",
  "pattern_tag": "snake_case label for this pattern type (e.g. video_opening_address, bestie_greeting, interior_reflection_opening)",
  "pattern_confidence": 0.0-1.0,
  "rule_hypothesis": "If this edit is representative, the voice rule would be: [write the rule as a direct instruction]",
  "character_name": "JustAWoman or Lala or null if unclear"
}`,
      }],
    });

    let parsed;
    try {
      parsed = JSON.parse(analysis.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { diff_summary: 'Edit captured', pattern_tag: 'general', pattern_confidence: 0.3 };
    }

    const signal = await db.VoiceSignal.create({
      series_id:    series_id || null,
      book_id:      book_id || null,
      chapter_id:   chapter_id || null,
      line_id:      line_id || null,
      original_text,
      edited_text,
      diff_summary:       parsed.diff_summary,
      pattern_tag:        parsed.pattern_tag,
      pattern_confidence: parsed.pattern_confidence,
      scene_context:      scene_context || null,
      status: 'analyzed',
    });

    const patternCount = await db.VoiceSignal.count({
      where: {
        pattern_tag: parsed.pattern_tag,
        status: { [Op.in]: ['analyzed', 'grouped'] },
        series_id: series_id || null,
      },
    });

    let proposedRule = null;

    if (patternCount >= 3 && parsed.pattern_confidence >= 0.6) {
      const existingProposal = await db.VoiceRule.findOne({
        where: {
          series_id: series_id || null,
          rule_type: parsed.pattern_tag,
          status: 'proposed',
        },
      });

      if (!existingProposal) {
        proposedRule = await db.VoiceRule.create({
          series_id:        series_id || null,
          character_name:   parsed.character_name || null,
          rule_text:        parsed.rule_hypothesis,
          rule_type:        parsed.pattern_tag.includes('opening') ? 'scene_opening'
                          : parsed.pattern_tag.includes('closing') ? 'scene_closing'
                          : parsed.pattern_tag.includes('address') ? 'address_pattern'
                          : 'dialogue_pattern',
          example_original: original_text,
          example_edited:   edited_text,
          signal_count:     patternCount,
          status:           'proposed',
        });

        await db.VoiceSignal.update(
          { status: 'grouped', proposed_rule_id: proposedRule.id },
          { where: { pattern_tag: parsed.pattern_tag, series_id: series_id || null, status: 'analyzed' } }
        );
      }
    }

    return res.json({
      signal_id:       signal.id,
      pattern_tag:     parsed.pattern_tag,
      pattern_count:   patternCount,
      proposed_rule:   proposedRule,
      rule_threshold:  3,
    });
  } catch (err) {
    console.error('Signal capture error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/novel/voice-rules/proposed
router.get('/voice-rules/proposed', optionalAuth, async (req, res) => {
  const { series_id } = req.query;
  try {
    const rules = await db.VoiceRule.findAll({
      where: {
        status: 'proposed',
        ...(series_id ? { series_id } : {}),
      },
      order: [['signal_count', 'DESC']],
    });
    return res.json({ rules });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/novel/voice-rules/:id/confirm
router.post('/voice-rules/:id/confirm', optionalAuth, async (req, res) => {
  try {
    const rule = await db.VoiceRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await rule.update({ status: 'active', confirmed_by_author: true, confirmed_at: new Date() });
    return res.json({ rule });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/novel/voice-rules/:id/dismiss
router.post('/voice-rules/:id/dismiss', optionalAuth, async (req, res) => {
  try {
    const rule = await db.VoiceRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await rule.update({ status: 'superseded' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/novel/voice-rules/active
router.get('/voice-rules/active', optionalAuth, async (req, res) => {
  const { series_id } = req.query;
  try {
    const where = {
      status: 'active',
      confirmed_by_author: true,
    };
    if (series_id) {
      where[Op.or] = [
        { series_id },
        { series_id: null },
      ];
    }
    const rules = await db.VoiceRule.findAll({
      where,
      order: [['signal_count', 'DESC']],
    });
    return res.json({ rules, injection_context: await getVoiceRules(series_id) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MANUSCRIPT-TO-METADATA CASCADE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/novel/manuscript/cascade
router.post('/manuscript/cascade', optionalAuth, async (req, res) => {
  const { book_id, series_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  try {
    const stories = await db.StorytellerStory.findAll({
      where: {
        book_id,
        status: { [Op.in]: ['approved', 'edited'] },
      },
      order: [['created_at', 'ASC']],
    });

    if (stories.length === 0) {
      return res.status(422).json({ error: 'No approved stories found for this book. Approve at least one story first.' });
    }

    const storyIds = stories.map(s => s.id);
    const lines = await db.StorytellerLine.findAll({
      where: {
        story_id: { [Op.in]: storyIds },
        status: { [Op.in]: ['approved', 'edited'] },
      },
      order: [['story_id', 'ASC'], ['order', 'ASC']],
    });

    const linesByStory = {};
    lines.forEach(l => {
      if (!linesByStory[l.story_id]) linesByStory[l.story_id] = [];
      linesByStory[l.story_id].push(l.content);
    });

    const storySummaries = stories.map((s, i) => {
      const storyLines = linesByStory[s.id] || [];
      const wordCount = storyLines.join(' ').split(/\s+/).length;
      const excerpt = storyLines.slice(0, 3).join(' ').slice(0, 300);
      return `Story ${i + 1}: "${s.title || 'Untitled'}" (${wordCount} words)\nOpening: ${excerpt}…`;
    }).join('\n\n');

    const voiceRules = await getVoiceRules(series_id);

    const cascadePrompt = `You are the metadata architect for a literary novel about JustAWoman — a mother, wife, and content creator building toward legacy.

FRANCHISE CONTEXT:
- Her wound: she does everything right and the right room has not found her yet
- Her goal: to be legendary — the woman other women point to in 20 years
- Her audience: Besties — women who feel personally chosen, not just followed
- The arc: Establishment → Pressure → Crisis → Integration
- Lala appears in Book 1 as ONE intrusive thought only
${voiceRules}

APPROVED STORIES (${stories.length} total):
${storySummaries}

Generate the full manuscript metadata. Respond ONLY in valid JSON:
{
  "book_title": "Literary title that could only come from this manuscript",
  "tagline": "One line. Evocative. Not a summary.",
  "one_line_logline": "A [protagonist] story about [want] and [wound]",
  "amazon_description": "3-4 paragraphs. Amazon back cover copy. No spoilers. Written for the reader who picks this up cold.",
  "section_establishment": "Literary section title for Establishment arc (not the word 'Establishment')",
  "section_pressure": "Literary section title for Pressure arc",
  "section_crisis": "Literary section title for Crisis arc",
  "section_integration": "Literary section title for Integration arc",
  "table_of_contents": [
    {
      "chapter_number": 1,
      "title": "Chapter title that comes from this story's emotional core",
      "arc_stage": "establishment|pressure|crisis|integration",
      "summary": "One sentence — what happens emotionally, not plotwise"
    }
  ],
  "dominant_themes": ["theme1", "theme2", "theme3"],
  "recurring_motifs": ["motif1", "motif2"],
  "pain_point_summary": [
    { "category": "visibility", "description": "How this pain manifests across these stories" }
  ],
  "lala_seed_moments": [
    { "story_number": 1, "moment": "Description of where her voice went boldest" }
  ]
}`;

    const response = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 4000,
      messages:   [{ role: 'user', content: cascadePrompt }],
    });

    let metadata;
    try {
      metadata = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Metadata generation failed to parse. Try again.' });
    }

    const existing = await db.ManuscriptMetadata.findOne({ where: { book_id } });

    const record = existing
      ? await existing.update({
          ...metadata,
          stories_included:  stories.length,
          generated_at:      new Date(),
          generation_model:  'claude-opus-4-5',
          author_approved:   false,
          lala_seed_count:   metadata.lala_seed_moments?.length || 0,
        })
      : await db.ManuscriptMetadata.create({
          series_id:         series_id || null,
          book_id,
          stories_included:  stories.length,
          generation_model:  'claude-opus-4-5',
          lala_seed_count:   metadata.lala_seed_moments?.length || 0,
          ...metadata,
        });

    return res.json({
      ok:              true,
      metadata:        record,
      stories_read:    stories.length,
      lines_read:      lines.length,
    });
  } catch (err) {
    console.error('Cascade error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/novel/manuscript/metadata/:book_id
router.get('/manuscript/metadata/:book_id', optionalAuth, async (req, res) => {
  try {
    const metadata = await db.ManuscriptMetadata.findOne({
      where: { book_id: req.params.book_id },
    });
    if (!metadata) return res.status(404).json({ error: 'No metadata generated yet for this book.' });
    return res.json({ metadata });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/novel/manuscript/metadata/:id/override
router.patch('/manuscript/metadata/:id/override', optionalAuth, async (req, res) => {
  try {
    const record = await db.ManuscriptMetadata.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    const overrides = { ...(record.author_overrides || {}), ...req.body.overrides };
    await record.update({ author_overrides: overrides, author_approved: req.body.approve || false });
    return res.json({ metadata: record });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BRAIN DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/novel/brain/check-duplicate
router.post('/brain/check-duplicate', optionalAuth, async (req, res) => {
  const { content, title, brain_type = 'story', series_id: _series_id, source_document, source_version } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const contentHash = sha256(content);
  const titleHash   = title ? sha256(title) : null;

  try {
    const exactMatch = await db.BrainFingerprint.findOne({
      where: { brain_type, content_hash: contentHash, status: 'active' },
    });

    if (exactMatch) {
      return res.json({
        is_duplicate:   true,
        duplicate_type: 'exact',
        existing_id:    exactMatch.entry_id,
        message:        'Exact duplicate — this content already exists in the brain.',
        action:         'skip',
      });
    }

    const nearMatch = titleHash ? await db.BrainFingerprint.findOne({
      where: { brain_type, title_hash: titleHash, status: 'active' },
    }) : null;

    const versionConflict = source_document && source_version ? await db.BrainFingerprint.findAll({
      where: {
        brain_type,
        source_document,
        status: 'active',
        source_version: { [Op.ne]: source_version },
      },
      limit: 5,
    }) : [];

    return res.json({
      is_duplicate:     false,
      near_duplicate:   !!nearMatch,
      near_match_id:    nearMatch?.entry_id || null,
      version_conflict: versionConflict.length > 0,
      version_conflict_count: versionConflict.length,
      older_version:    versionConflict[0]?.source_version || null,
      content_hash:     contentHash,
      action:           nearMatch ? 'review' : versionConflict.length > 0 ? 'supersede_old' : 'allow',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/novel/brain/register-fingerprint
router.post('/brain/register-fingerprint', optionalAuth, async (req, res) => {
  const { entry_id, content, title, brain_type = 'story', series_id, source_document, source_version } = req.body;
  if (!entry_id || !content) return res.status(400).json({ error: 'entry_id and content required' });

  try {
    const fingerprint = await db.BrainFingerprint.create({
      brain_type,
      series_id:       series_id || null,
      entry_id,
      content_hash:    sha256(content),
      title_hash:      title ? sha256(title) : null,
      source_document: source_document || null,
      source_version:  source_version  || null,
      status:          'active',
    });
    return res.json({ fingerprint });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/novel/brain/supersede-version
router.post('/brain/supersede-version', optionalAuth, async (req, res) => {
  const { brain_type, source_document, old_version, series_id } = req.body;
  if (!brain_type || !source_document || !old_version) {
    return res.status(400).json({ error: 'brain_type, source_document, old_version required' });
  }

  try {
    const [count] = await db.BrainFingerprint.update(
      { status: 'superseded' },
      {
        where: {
          brain_type,
          source_document,
          source_version: old_version,
          status: 'active',
          ...(series_id ? { series_id } : {}),
        },
      }
    );
    return res.json({ superseded_count: count, message: `${count} entries from ${source_document} ${old_version} marked superseded.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
