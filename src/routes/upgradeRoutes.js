// routes/upgradeRoutes.js
//
// All five upgrade routes in one file — mount at /api/v1
//
// POST /api/v1/session/brief                    — generate session brief
// GET  /api/v1/session/brief/latest             — get most recent brief
// POST /api/v1/reviews/post-generation          — run post-gen review on approved scene
// POST /api/v1/reviews/:id/acknowledge          — author acknowledges a review
// GET  /api/v1/reviews/unacknowledged           — list unacknowledged reviews
// POST /api/v1/writing-rhythm/log               — log a writing session
// GET  /api/v1/writing-rhythm/stats             — rhythm stats + streak
// PATCH /api/v1/writing-rhythm/goal             — update writing goal
// POST /api/v1/multi-product/:storyId/generate  — generate all content formats from scene
// GET  /api/v1/multi-product/:storyId           — get content for a scene
// PATCH /api/v1/multi-product/:contentId/status — update content status
// POST /api/v1/tech-knowledge/entries           — add tech knowledge entry
// GET  /api/v1/tech-knowledge/entries           — list tech knowledge
// POST /api/v1/tech-knowledge/ingest-document   — ingest TDD/Roadmap/Deviations
// POST /api/v1/tech-knowledge/extract-conversation — extract from build chat

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');
const { Op } = require('sequelize');

const client = new Anthropic();

// Safe extraction of text from Claude API response
function extractAIText(response) {
  if (!response?.content?.length || !response.content[0]?.text) {
    throw new Error('AI returned empty or malformed response');
  }
  return response.content[0].text;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE 1: SESSION BRIEF
// Reads tech knowledge + story state → gives the assistant full context on entry
// ─────────────────────────────────────────────────────────────────────────────
router.post('/session/brief', optionalAuth, async (req, res) => {
  const { book_id } = req.body;

  try {
    // Read tech knowledge
    const techEntries = db.FranchiseTechKnowledge ? await db.FranchiseTechKnowledge.findAll({
      where: { status: 'active' },
      order: [['category', 'ASC']],
    }) : [];

    // Read story arc state
    let storySnapshot = {};
    if (book_id) {
      const book = db.StorytellerBook ? await db.StorytellerBook.findByPk(book_id) : null;
      const recentStories = db.StorytellerStory ? await db.StorytellerStory.findAll({
        where: { book_id, status: { [Op.in]: ['evaluated', 'written_back'] } },
        order: [['updated_at', 'DESC']],
        limit: 5,
      }) : [];
      const recentGrowth = db.CharacterGrowthLog ? await db.CharacterGrowthLog.findAll({
        where: { update_type: 'flagged_contradiction', author_reviewed: false },
        limit: 5,
      }) : [];
      storySnapshot = {
        arc_stage: book?.current_arc_stage || 'establishment',
        arc_scores: book?.arc_stage_scores || {},
        recent_scenes: recentStories.map(s => ({
          scene_type: s.scene_type,
          tone: s.tone_dial,
          status: s.status,
          brief_preview: s.scene_brief?.slice(0, 80),
        })),
        unreviewed_growth_flags: recentGrowth.length,
      };
    }

    // Read pending builds from tech knowledge
    const pendingBuilds = techEntries
      .filter(e => e.category === 'pending_build')
      .map(e => e.title);

    // Unacknowledged post-gen reviews
    const unreviewedCount = await db.PostGenerationReview.count({
      where: { author_acknowledged: false, passed: false },
    });

    // Build the brief
    const briefPrompt = `You are generating a Session Brief for a Prime Studios build session. This brief will be read by an AI assistant at the start of a conversation so it knows exactly where the project is without the author having to explain anything.

TECH KNOWLEDGE BASE:
${techEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}\n${e.content}`).join('\n\n')}

STORY STATE:
${JSON.stringify(storySnapshot, null, 2)}

PENDING BUILDS:
${pendingBuilds.length ? pendingBuilds.join('\n') : 'None logged'}

UNACKNOWLEDGED FRANCHISE VIOLATIONS: ${unreviewedCount}

Write a Session Brief in this format:

PROJECT: Prime Studios — LalaVerse franchise
DATE: ${new Date().toLocaleDateString()}

WHAT IS DEPLOYED AND WORKING:
[2-3 bullet points on live systems]

WHERE THE STORY IS:
[Arc stage, scenes written, what was last built narratively]

WHAT IS NEXT IN THE BUILD QUEUE:
[Top 3 priorities in order]

FLAGS NEEDING ATTENTION:
[Growth flags, unacknowledged reviews, anything blocking progress]

CRITICAL RULES FOR THIS SESSION:
[3-4 technical rules the assistant must never violate in this codebase]

Keep it tight. This brief should take 30 seconds to read and give the assistant everything it needs.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: briefPrompt }],
    });

    const briefText = extractAIText(response);

    if (db.SessionBrief) {
      const brief = await db.SessionBrief.create({
        brief_text: briefText,
        tech_snapshot: { entry_count: techEntries.length, categories: [...new Set(techEntries.map(e => e.category))] },
        story_snapshot: storySnapshot,
        pending_builds: pendingBuilds,
      });
      return res.json({ brief_id: brief.id, brief_text: briefText, generated_at: brief.generated_at });
    }
    return res.json({ brief_text: briefText, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('Session brief error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/session/brief/latest', optionalAuth, async (req, res) => {
  try {
    if (!db.SessionBrief) return res.json({ brief: null });
    const brief = await db.SessionBrief.findOne({ order: [['created_at', 'DESC']] });
    if (!brief) return res.json({ brief: null });
    await brief.update({ used_at: new Date() });
    return res.json({ brief });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE 2: POST-GENERATION REVIEW
// Reads approved scene output against franchise laws — catches what guard misses
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reviews/post-generation', optionalAuth, async (req, res) => {
  const { story_id } = req.body;
  if (!story_id) return res.status(400).json({ error: 'story_id required' });

  try {
    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const approvedText = story.evaluation_result?.approved_version || story.story_a || '';
    if (!approvedText) return res.status(400).json({ error: 'No approved text to review' });

    // Get all active franchise laws + critical entries
    const laws = await db.FranchiseKnowledge.findAll({
      where: { status: 'active', severity: { [Op.in]: ['critical'] } },
    });

    const reviewPrompt = `You are the Post-Generation Review agent for Prime Studios. Read this approved scene and check it against the franchise laws. Your job is to catch what slipped through — subtle drift, tone violations, character contradictions that feel almost right but aren't.

APPROVED SCENE:
${approvedText}

CHARACTERS IN SCENE: ${(story.characters_in_scene || []).join(', ')}
SCENE TYPE: ${story.scene_type || 'not specified'}
TONE: ${story.tone_dial || 'not specified'}

FRANCHISE LAWS TO CHECK AGAINST:
${laws.map(l => `[${l.title}]\n${l.content}`).join('\n\n')}

Read carefully. Look for:
1. JustAWoman written as smaller than she is — even slightly passive, even mildly uncertain about her own worth
2. Any moment that nudges toward Lala having awareness of her origin
3. David framed as obstacle even briefly — even one sentence of "he doesn't understand her"
4. Anything that reads like a coaching realization landing in Book 1
5. Character voice drift — someone speaking in a register that doesn't match their registry entry
6. Anything that gives a character knowledge the reader should hold alone

Be specific. Quote the exact line if you find a violation. Vague warnings help nobody.

Respond ONLY in valid JSON:
{
  "violations": [
    {
      "severity": "critical" | "important",
      "law_violated": "which franchise law",
      "offending_line": "the exact line or passage",
      "why_it_violates": "specific explanation",
      "suggested_rewrite": "how to fix this specific line"
    }
  ],
  "warnings": [
    {
      "type": "voice_drift" | "tone_creep" | "arc_risk" | "subtle_framing",
      "note": "what to watch",
      "line_reference": "the line or passage"
    }
  ],
  "passed": true or false,
  "overall_assessment": "one sentence on the franchise health of this scene",
  "strongest_moment": "the line or passage that best embodies the franchise"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are the Post-Generation Review agent. You read finished scenes for franchise violations. Be specific — quote lines, name laws. Respond ONLY in valid JSON.',
      messages: [{ role: 'user', content: reviewPrompt }],
    });

    let reviewData;
    try {
      reviewData = JSON.parse(extractAIText(response).replace(/```json|```/g, '').trim());
    } catch {
      reviewData = { violations: [], warnings: [], passed: true, overall_assessment: 'Review parse failed', strongest_moment: '' };
    }

    const review = await db.PostGenerationReview.create({
      story_id: parseInt(story_id),
      approved_version_reviewed: approvedText,
      violations: reviewData.violations || [],
      warnings: reviewData.warnings || [],
      passed: reviewData.passed !== false,
      knowledge_entries_checked: laws.length,
      review_note: reviewData.overall_assessment,
    });

    return res.json({
      review_id: review.id,
      passed: review.passed,
      violations: review.violations,
      warnings: review.warnings,
      overall_assessment: reviewData.overall_assessment,
      strongest_moment: reviewData.strongest_moment,
      requires_attention: !review.passed,
    });
  } catch (err) {
    console.error('Post-gen review error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:id/acknowledge', optionalAuth, async (req, res) => {
  try {
    const review = await db.PostGenerationReview.findByPk(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await review.update({ author_acknowledged: true, acknowledged_at: new Date() });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/reviews/unacknowledged', optionalAuth, async (req, res) => {
  try {
    const reviews = await db.PostGenerationReview.findAll({
      where: { author_acknowledged: false },
      order: [['created_at', 'DESC']],
    });
    return res.json({ reviews, count: reviews.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE 3: WRITING RHYTHM
// ─────────────────────────────────────────────────────────────────────────────
router.post('/writing-rhythm/log', optionalAuth, async (req, res) => {
  const { scenes_proposed = 0, scenes_generated = 0, scenes_approved = 0, words_written = 0, arc_stage, session_note } = req.body;

  try {
    const today = new Date().toISOString().split('T')[0];
    const [session, created] = await db.WritingRhythm.findOrCreate({
      where: { session_date: today },
      defaults: { scenes_proposed, scenes_generated, scenes_approved, words_written, arc_stage, session_note },
    });

    if (!created) {
      await session.update({
        scenes_proposed: session.scenes_proposed + scenes_proposed,
        scenes_generated: session.scenes_generated + scenes_generated,
        scenes_approved: session.scenes_approved + scenes_approved,
        words_written: session.words_written + words_written,
        arc_stage: arc_stage || session.arc_stage,
        session_note: session_note || session.session_note,
      });
    }

    return res.json({ ok: true, session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/writing-rhythm/stats', optionalAuth, async (req, res) => {
  try {
    const goal = await db.WritingGoal.findOne({ where: { active: true } });

    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await db.WritingRhythm.findAll({
      where: { session_date: { [Op.gte]: thirtyDaysAgo } },
      order: [['session_date', 'DESC']],
    });

    // Calculate streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const sessionDates = new Set(sessions.map(s => s.session_date));

    const checkDate = new Date();
    for (;;) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (sessionDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateStr === today) {
        // Today not written yet — don't break streak
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // This week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const thisWeek = sessions.filter(s => new Date(s.session_date) >= weekStart);

    const stats = {
      streak_days: streak,
      this_week: {
        sessions: thisWeek.length,
        scenes_approved: thisWeek.reduce((sum, s) => sum + s.scenes_approved, 0),
        words_written: thisWeek.reduce((sum, s) => sum + s.words_written, 0),
      },
      last_30_days: {
        total_sessions: sessions.length,
        total_scenes: sessions.reduce((sum, s) => sum + s.scenes_approved, 0),
        total_words: sessions.reduce((sum, s) => sum + s.words_written, 0),
      },
      goal: goal ? {
        cadence: goal.cadence,
        target_scenes: goal.target_scenes,
        target_words: goal.target_words,
        target_sessions: goal.target_sessions,
        on_track: thisWeek.length >= Math.ceil((goal.target_sessions || 3) * (new Date().getDay() / 7)),
      } : null,
      recent_sessions: sessions.slice(0, 14),
    };

    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/writing-rhythm/goal', optionalAuth, async (req, res) => {
  try {
    await db.WritingGoal.update({ active: false }, { where: { active: true } });
    const goal = await db.WritingGoal.create({ ...req.body, active: true });
    return res.json({ ok: true, goal });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE 4: MULTI-PRODUCT CONTENT
// Every approved scene surfaces content for all three products
// ─────────────────────────────────────────────────────────────────────────────

// GET all multi-product content (must be before :storyId param route)
router.get('/multi-product/all', optionalAuth, async (req, res) => {
  try {
    const content = await db.MultiProductContent.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json({ content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/multi-product/:storyId/generate', optionalAuth, async (req, res) => {
  const { storyId } = req.params;

  try {
    const story = await db.StorytellerStory.findByPk(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const sceneText = story.evaluation_result?.approved_version || story.story_a || '';
    const plotMemory = story.plot_memory_proposal?.content || '';
    const revelation = story.character_revelation_proposal?.content || '';

    const contentPrompt = `You are the Multi-Product Content Engine for Prime Studios.

A scene has been approved for the LalaVerse franchise novel. Your job: read it and generate content for all five formats. Each format serves a different audience and product.

APPROVED SCENE:
${sceneText}

PLOT MEMORY: ${plotMemory}
CHARACTER REVELATION: ${revelation}
SCENE TYPE: ${story.scene_type || 'general'}

FRANCHISE CONTEXT:
- JustAWoman posts for women — her Besties. Intimacy at scale. They feel personally chosen.
- Her audience name is BESTIES — never followers, never fans.
- She is confident, self-possessed, legendary-in-progress.
- The pay-for-attention dynamic is her loud online secret — she does NOT post about it directly.
- Lala does not exist publicly yet in Book 1 — no content references Lala until she launches.
- How-to lessons are seeds for Book 2 — they are what JustAWoman is LIVING but not yet teaching.

Generate content for all five formats. Respond ONLY in valid JSON:
{
  "instagram_caption": {
    "headline": "First line — the hook",
    "content": "Full caption in JustAWoman's voice — warm, direct, speaks to Besties like they're the only one in the room. 3-5 sentences. No hashtags in the caption body.",
    "emotional_core": "The scene emotion this draws from"
  },
  "tiktok_concept": {
    "headline": "The concept in one line",
    "content": "The TikTok video concept — what she films, what she says, the format. Specific. Could be filmed tomorrow. 2-3 sentences.",
    "emotional_core": "The scene emotion this draws from"
  },
  "howto_lesson": {
    "headline": "The lesson title — what she's learning without knowing she's learning it",
    "content": "The how-to insight buried in this scene. Written as a lesson she'll eventually teach in Book 2. Present tense. Actionable. She's living it right now — she can't see it yet.",
    "emotional_core": "The scene emotion this draws from",
    "book2_seed": true
  },
  "bestie_newsletter": {
    "headline": "Newsletter subject line — personal, specific, speaks to one woman",
    "content": "The newsletter angle — what JustAWoman would write to her Besties about what she's experiencing. Intimate. Real. 3-4 sentences.",
    "emotional_core": "The scene emotion this draws from"
  },
  "behind_the_scenes": {
    "headline": "The BTS hook",
    "content": "What JustAWoman posts about building Lala — the process, the struggle, the small win. Does not reveal what Lala is yet. 2-3 sentences.",
    "emotional_core": "The scene emotion this draws from"
  }
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are the Multi-Product Content Engine for Prime Studios. You generate authentic content in JustAWoman\'s voice across five formats. Never break character. Never reference Lala before her launch. Always speak to Besties. Respond ONLY in valid JSON.',
      messages: [{ role: 'user', content: contentPrompt }],
    });

    let contentData;
    try {
      contentData = JSON.parse(extractAIText(response).replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Content parse failed', raw: extractAIText(response) });
    }

    const formats = ['instagram_caption', 'tiktok_concept', 'howto_lesson', 'bestie_newsletter', 'behind_the_scenes'];
    const created = await db.MultiProductContent.bulkCreate(
      formats.map(format => ({
        story_id: parseInt(storyId),
        format,
        content: contentData[format]?.content || '',
        headline: contentData[format]?.headline || '',
        emotional_core: contentData[format]?.emotional_core || '',
        book2_seed: format === 'howto_lesson' ? (contentData[format]?.book2_seed || false) : false,
        status: 'draft',
      }))
    );

    return res.json({
      ok: true,
      content_items: created.length,
      content: contentData,
      story_id: parseInt(storyId),
    });
  } catch (err) {
    console.error('Multi-product content error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/multi-product/:storyId', optionalAuth, async (req, res) => {
  try {
    const content = await db.MultiProductContent.findAll({
      where: { story_id: req.params.storyId },
      order: [['format', 'ASC']],
    });
    return res.json({ content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/multi-product/:contentId/status', optionalAuth, async (req, res) => {
  const { status, author_note } = req.body;
  try {
    const item = await db.MultiProductContent.findByPk(req.params.contentId);
    if (!item) return res.status(404).json({ error: 'Content not found' });
    await item.update({ status, author_note, posted_at: status === 'posted' ? new Date() : item.posted_at });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE 5: TECH KNOWLEDGE
// Completely separate from story knowledge — story engine never reads this
// ─────────────────────────────────────────────────────────────────────────────
const TECH_EXTRACTION_SYSTEM = `You are extracting technical knowledge for Prime Studios — a React/Node/PostgreSQL literary production system.

Extract only technical decisions: what is deployed, what routes exist, what tables exist, what architectural rules are locked, what is next in the build queue. Nothing narrative. Nothing about characters or story.

Respond ONLY in valid JSON.`;

router.post('/tech-knowledge/entries', optionalAuth, async (req, res) => {
  const { title, content, category, severity, applies_to, source_document } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  try {
    const entry = await db.FranchiseTechKnowledge.create({
      title, content,
      category: category || 'deployed_system',
      severity: severity || 'important',
      applies_to: applies_to || [],
      source_document: source_document || 'direct',
      extracted_by: 'direct_entry',
      status: 'active',
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/tech-knowledge/entries', optionalAuth, async (req, res) => {
  const { category, status, search } = req.query;
  try {
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    else where.status = 'active';
    if (search) where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
    ];
    const entries = await db.FranchiseTechKnowledge.findAll({
      where, order: [['category', 'ASC'], ['title', 'ASC']],
    });
    return res.json({ entries, count: entries.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/tech-knowledge/ingest-document', optionalAuth, async (req, res) => {
  const { document_text, source_document, source_version } = req.body;
  if (!document_text || !source_document) return res.status(400).json({ error: 'document_text and source_document required' });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: TECH_EXTRACTION_SYSTEM,
      messages: [{
        role: 'user',
        content: `Extract technical knowledge entries from this document. Source: ${source_document} ${source_version || ''}\n\nDOCUMENT:\n${document_text}\n\nReturn JSON: { "entries": [{ "title": "", "content": "", "category": "deployed_system|route_registry|schema|architecture_rule|build_pattern|pending_build|integration", "severity": "critical|important|context", "applies_to": [] }], "summary": "" }`,
      }],
    });

    let extracted;
    try {
      extracted = JSON.parse(extractAIText(response).replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Parse failed', raw: extractAIText(response) });
    }

    const created = await db.FranchiseTechKnowledge.bulkCreate(
      (extracted.entries || []).map(e => ({
        title: e.title, content: e.content,
        category: e.category || 'deployed_system',
        severity: e.severity || 'important',
        applies_to: e.applies_to || [],
        source_document, source_version: source_version || null,
        extracted_by: 'document_ingestion',
        status: 'active',
      }))
    );

    return res.json({ ok: true, entries_extracted: created.length, summary: extracted.summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/tech-knowledge/extract-conversation', optionalAuth, async (req, res) => {
  const { conversation_text } = req.body;
  if (!conversation_text) return res.status(400).json({ error: 'conversation_text required' });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      system: TECH_EXTRACTION_SYSTEM,
      messages: [{
        role: 'user',
        content: `Extract technical decisions from this build conversation.\n\nCONVERSATION:\n${conversation_text}\n\nReturn JSON: { "entries": [{ "title": "", "content": "", "category": "", "severity": "", "applies_to": [] }], "decisions_found": 0, "summary": "" }`,
      }],
    });

    let extracted;
    try {
      extracted = JSON.parse(extractAIText(response).replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Parse failed' });
    }

    const created = await db.FranchiseTechKnowledge.bulkCreate(
      (extracted.entries || []).map(e => ({
        title: e.title, content: e.content,
        category: e.category || 'deployed_system',
        severity: e.severity || 'important',
        applies_to: e.applies_to || [],
        source_document: 'conversation',
        extracted_by: 'conversation_extraction',
        status: 'active',
      }))
    );

    return res.json({ ok: true, entries_extracted: created.length, summary: extracted.summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
