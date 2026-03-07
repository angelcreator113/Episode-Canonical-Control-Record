/**
 * storyEvaluationRoutes.js — Story Evaluation Engine v2
 *
 * Blind 3-agent generation → editorial evaluation → memory proposals →
 * registry update proposals → manuscript write-back.
 *
 * Routes (all mounted under /api/v1/memories):
 *   POST /generate-story-multi    — blind 3-voice generation
 *   POST /evaluate-stories        — Claude Opus evaluation
 *   POST /propose-memory          — plot + revelation memory proposals
 *   POST /propose-registry-update — propose updates to character registry
 *   POST /write-back              — write approved version to manuscript lines
 *   GET  /eval-stories/:storyId   — fetch story with all evaluation data
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../models');

const anthropic = new Anthropic();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

// ── Voice system prompts for blind 3-agent generation ─────────────────────
const VOICE_SYSTEM = {
  voice_a: `You are a literary voice that prioritises depth and interiority. Write in close third-person, past tense, literary present. Focus on what the character cannot say aloud, the subtext beneath every gesture. Every scene should feel like standing inside the character's ribcage.`,
  voice_b: `You are a narrative voice that prioritises tension and momentum. Write in close third-person, past tense. Every paragraph should tighten the noose — desire vs. obstacle, silence vs. eruption. Pace like a thriller, feel like literature.`,
  voice_c: `You are a sensory-first voice that prioritises desire and the body. Write in close third-person, past tense, lyric-literary register. Let the reader feel skin, breath, fabric, heat. The body knows before the mind does.`,
};

// ── Tone dial modifiers ───────────────────────────────────────────────────
const TONE_MODIFIERS = {
  literary:   'Prioritise psychological depth, subtext, and thematic resonance. Sentence-level craft matters most.',
  thriller:   'Prioritise pacing, stakes escalation, and chapter-end hooks. Keep sentences taut.',
  lyrical:    'Prioritise sensory language, metaphor, and emotional texture. Let prose breathe.',
  intimate:   'Prioritise closeness — body language, breath, silence, desire. Every distance is a choice.',
  dark:       'Prioritise tension, moral ambiguity, and unflinching honesty. No comfort, only truth.',
  warm:       'Prioritise connection, humour, and earned tenderness. Light that knows about darkness.',
};

// ── Helper: build generation prompt ───────────────────────────────────────
function buildGenerationPrompt({ scene_brief, tone_dial, characters_in_scene, dossiers }) {
  const toneMod = TONE_MODIFIERS[tone_dial] || TONE_MODIFIERS.literary;

  let charContext = '';
  if (dossiers && dossiers.length > 0) {
    charContext = `\n\nCHARACTER DOSSIERS:\n${dossiers.map(d =>
      `— ${d.display_name || d.character_key}: ${d.desire_line || ''} | wound: ${d.wound || ''} | strengths: ${(d.strengths || []).join(', ')}`
    ).join('\n')}`;
  }

  return `TONE: ${toneMod}

CHARACTERS IN SCENE: ${(characters_in_scene || []).join(', ')}
${charContext}

SCENE BRIEF:
${scene_brief}

Write a 2500–3500 word scene. Adult literary fiction — explicit language, sexuality, and conflict permitted. Close third person. End on a shift, not a resolution. Return ONLY the prose — no meta commentary, no title.`;
}

// ── POST /generate-story-multi ────────────────────────────────────────────
router.post('/generate-story-multi', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, book_id, scene_brief, tone_dial, characters_in_scene, registry_id } = req.body;
    if (!scene_brief) {
      return res.status(400).json({ error: 'scene_brief is required' });
    }

    // Load character dossiers from registry
    let dossiers = [];
    if (characters_in_scene?.length && registry_id) {
      const chars = await db.RegistryCharacter.findAll({
        where: {
          registry_id,
          character_key: characters_in_scene,
        },
        attributes: ['character_key', 'display_name', 'icon', 'desire_line', 'wound', 'strengths', 'portrait_url'],
      });
      dossiers = chars.map(c => c.toJSON());
    }

    const prompt = buildGenerationPrompt({
      scene_brief,
      tone_dial: tone_dial || 'literary',
      characters_in_scene: characters_in_scene || [],
      dossiers,
    });

    // Send keep-alive headers for long generation
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    const keepAlive = setInterval(() => {
      try { res.write(' '); } catch (_) { /* ignore */ }
    }, 15000);

    // Generate all 3 voices in parallel (blind — each voice doesn't see the others)
    const [resultA, resultB, resultC] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5000,
        system: VOICE_SYSTEM.voice_a,
        messages: [{ role: 'user', content: prompt }],
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5000,
        system: VOICE_SYSTEM.voice_b,
        messages: [{ role: 'user', content: prompt }],
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5000,
        system: VOICE_SYSTEM.voice_c,
        messages: [{ role: 'user', content: prompt }],
      }),
    ]);

    clearInterval(keepAlive);

    const storyA = resultA.content?.[0]?.text || '';
    const storyB = resultB.content?.[0]?.text || '';
    const storyC = resultC.content?.[0]?.text || '';

    // Persist as a StorytellerStory record
    const story = await db.StorytellerStory.create({
      character_key: (characters_in_scene || ['ensemble'])[0],
      story_number: 0,
      title: `Eval Scene — ${(scene_brief || '').slice(0, 80)}`,
      text: '',
      status: 'pending_evaluation',
      chapter_id: chapter_id || null,
      book_id: book_id || null,
      scene_brief,
      tone_dial: tone_dial || 'literary',
      characters_in_scene,
      registry_dossiers_used: dossiers,
      story_a: storyA,
      story_b: storyB,
      story_c: storyC,
    });

    const wordCount = (t) => (t || '').split(/\s+/).filter(Boolean).length;

    return res.end(JSON.stringify({
      success: true,
      story_id: story.id,
      stories: {
        voice_a: { text: storyA, word_count: wordCount(storyA) },
        voice_b: { text: storyB, word_count: wordCount(storyB) },
        voice_c: { text: storyC, word_count: wordCount(storyC) },
      },
    }));
  } catch (err) {
    console.error('[generate-story-multi]', err?.message);
    return res.status(500).json({ error: err?.message || 'Multi-generation failed' });
  }
});

// ── POST /evaluate-stories ────────────────────────────────────────────────
router.post('/evaluate-stories', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.story_a || !story.story_b || !story.story_c) {
      return res.status(400).json({ error: 'All three story variants must exist before evaluation' });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 8000,
      system: `You are a ruthlessly honest literary editor. Evaluate three blind versions of the same scene. Return ONLY valid JSON — no markdown fences, no commentary.`,
      messages: [{
        role: 'user',
        content: `Original brief:\n"${story.scene_brief || ''}"\n\nTone dial: ${story.tone_dial || 'literary'}\n\n=== VOICE A ===\n${story.story_a}\n\n=== VOICE B ===\n${story.story_b}\n\n=== VOICE C ===\n${story.story_c}\n\nReturn JSON:\n{\n  "scores": {\n    "voice_a": { "interiority": 0-10, "desire_tension": 0-10, "specificity": 0-10, "stakes": 0-10, "voice": 0-10, "body_presence": 0-10, "total": 0-60, "summary": "one sentence", "best_moment": "direct quote" },\n    "voice_b": { ...same },\n    "voice_c": { ...same }\n  },\n  "winner": "voice_a"|"voice_b"|"voice_c",\n  "winner_reason": "why this version wins",\n  "what_each_brings": { "voice_a": "strength", "voice_b": "strength", "voice_c": "strength" },\n  "proofreading": { "voice_a": ["issue"], "voice_b": ["issue"], "voice_c": ["issue"] },\n  "brief_diagnosis": { "score": 0-10, "what_was_missing": "text", "improved_brief": "text" },\n  "approved_version": "full synthesised text taking the best from each (2500-3500 words)"\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const evaluation = JSON.parse(raw);

    // Persist evaluation + set the synthesised text as the story text
    story.evaluation_result = evaluation;
    story.text = evaluation.approved_version || '';
    story.word_count = (story.text || '').split(/\s+/).filter(Boolean).length;
    story.status = 'evaluated';
    await story.save();

    return res.json({ success: true, evaluation, story_id });
  } catch (err) {
    console.error('[evaluate-stories]', err?.message);
    return res.status(500).json({ error: err?.message || 'Evaluation failed' });
  }
});

// ── POST /propose-memory ──────────────────────────────────────────────────
router.post('/propose-memory', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.text) return res.status(400).json({ error: 'Story must have approved text first' });

    // Load existing memories for context
    const existingMemories = await db.StorytellerMemory.findAll({
      where: { character_key: story.character_key },
      order: [['created_at', 'DESC']],
      limit: 30,
      attributes: ['type', 'content', 'weight'],
    });

    const memCtx = existingMemories.map(m =>
      `[${m.type}] ${m.content} (weight: ${m.weight})`
    ).join('\n');

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 4000,
      system: `You are a narrative memory architect. Given a story and existing character memories, propose new memories that should be stored. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CHARACTER: ${story.character_key}\n\nEXISTING MEMORIES:\n${memCtx || '(none yet)'}\n\nSTORY TEXT:\n${story.text}\n\nPropose memories in JSON:\n{\n  "plot_memories": [\n    { "type": "event|relationship|belief|constraint", "content": "what happened", "weight": 1-10, "reason": "why this matters for future stories" }\n  ],\n  "character_revelations": [\n    { "type": "transformation|pain_point|character_dynamic", "content": "what was revealed", "weight": 1-10, "reason": "why this changes the character" }\n  ]\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const proposals = JSON.parse(raw);

    story.plot_memory_proposal = proposals.plot_memories || [];
    story.character_revelation_proposal = proposals.character_revelations || [];
    await story.save();

    return res.json({ success: true, proposals, story_id });
  } catch (err) {
    console.error('[propose-memory]', err?.message);
    return res.status(500).json({ error: err?.message || 'Memory proposal failed' });
  }
});

// ── POST /propose-registry-update ─────────────────────────────────────────
router.post('/propose-registry-update', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required' });

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Load current registry profiles for characters in scene
    let charProfiles = [];
    if (story.characters_in_scene?.length && story.registry_dossiers_used?.[0]?.registry_id) {
      const rid = story.registry_dossiers_used[0].registry_id;
      charProfiles = await db.RegistryCharacter.findAll({
        where: { registry_id: rid, character_key: story.characters_in_scene },
      });
    }

    const profileCtx = charProfiles.map(c => {
      const j = c.toJSON();
      return `${j.display_name} (${j.character_key}): desire="${j.desire_line}", wound="${j.wound}", strengths=${JSON.stringify(j.strengths)}`;
    }).join('\n');

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 4000,
      system: `You are a character registry curator. After reading a story, propose specific updates to character registry profiles. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CURRENT PROFILES:\n${profileCtx || '(none)'}\n\nSTORY:\n${story.text}\n\nPropose registry updates in JSON:\n{\n  "updates": [\n    {\n      "character_key": "key",\n      "field": "desire_line|wound|strengths|life_domains|voice_notes",\n      "current_value": "what it is now",\n      "proposed_value": "what it should become",\n      "reason": "why this scene changes this"\n    }\n  ]\n}`,
      }],
    });

    let raw = msg.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const proposals = JSON.parse(raw);

    story.registry_update_proposals = proposals.updates || [];
    await story.save();

    return res.json({ success: true, proposals: proposals.updates || [], story_id });
  } catch (err) {
    console.error('[propose-registry-update]', err?.message);
    return res.status(500).json({ error: err?.message || 'Registry update proposal failed' });
  }
});

// ── POST /write-back ──────────────────────────────────────────────────────
router.post('/write-back', optionalAuth, async (req, res) => {
  try {
    const { story_id, chapter_id, confirmed_memories, confirmed_registry_updates } = req.body;
    if (!story_id || !chapter_id) {
      return res.status(400).json({ error: 'story_id and chapter_id are required' });
    }

    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.text) return res.status(400).json({ error: 'No approved text to write back' });

    // Verify chapter exists
    const chapter = await db.StorytellerChapter.findByPk(chapter_id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    // 1. Write story text as lines in the chapter
    const paragraphs = story.text.split('\n').filter(p => p.trim());
    const existingLines = await db.StorytellerLine.count({ where: { chapter_id } });
    let lineOrder = existingLines;

    for (const para of paragraphs) {
      await db.StorytellerLine.create({
        chapter_id,
        book_id: chapter.book_id,
        text: para.trim(),
        line_order: lineOrder++,
        line_type: 'prose',
      });
    }

    // 2. Commit confirmed memories
    if (confirmed_memories?.length) {
      for (const mem of confirmed_memories) {
        await db.StorytellerMemory.create({
          character_key: story.character_key,
          type: mem.type || 'event',
          content: mem.content,
          weight: mem.weight || 5,
          source: 'evaluation_engine',
          story_id: story.id,
        });
      }
    }

    // 3. Apply confirmed registry updates
    if (confirmed_registry_updates?.length) {
      for (const upd of confirmed_registry_updates) {
        const char = await db.RegistryCharacter.findOne({
          where: { character_key: upd.character_key },
        });
        if (char && upd.field && upd.proposed_value !== undefined) {
          char[upd.field] = upd.proposed_value;
          await char.save();
        }
      }
    }

    // 4. Mark story as written back
    story.written_back_at = new Date();
    story.written_back_chapter_id = chapter_id;
    story.memory_confirmed_at = confirmed_memories?.length ? new Date() : story.memory_confirmed_at;
    story.status = 'written_back';
    await story.save();

    return res.json({
      success: true,
      story_id,
      chapter_id,
      lines_written: paragraphs.length,
      memories_committed: confirmed_memories?.length || 0,
      registry_updates_applied: confirmed_registry_updates?.length || 0,
    });
  } catch (err) {
    console.error('[write-back]', err?.message);
    return res.status(500).json({ error: err?.message || 'Write-back failed' });
  }
});

// ── GET /eval-stories/:storyId — fetch story with all evaluation data ─────
router.get('/eval-stories/:storyId', optionalAuth, async (req, res) => {
  try {
    const story = await db.StorytellerStory.findByPk(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json({ story });
  } catch (err) {
    console.error('[eval-stories/get]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to fetch story' });
  }
});

module.exports = router;
