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

// ── Voice-specific tone assignments (all 6 tones covered) ────────────────────
const VOICE_TONES = {
  voice_a: ['literary', 'dark'],    // psychological depth + moral ambiguity
  voice_b: ['thriller', 'intimate'],// pacing + closeness
  voice_c: ['lyrical', 'warm'],     // sensory language + connection
};

// ── Helper: build generation prompt ───────────────────────────────────────
const VOICE_DEEP_HINTS = {
  voice_a: 'Lean into grief, family architecture, body history, the unprocessed loss, parent wounds. Interiority and the weight of the past.',
  voice_b: 'Lean into ambition, class/money, politics, career wounds, active dilemmas. Tension, stakes, and forward momentum.',
  voice_c: 'Lean into sexuality/desire, sensory signatures, habits/rituals, the unseen, comfort rituals. The body, warmth, what intimacy costs.',
};

function buildGenerationPrompt({ scene_brief, voice_key, characters_in_scene, charBlocks }) {
  const tones = VOICE_TONES[voice_key] || ['literary'];
  const toneMod = tones.map(t => TONE_MODIFIERS[t]).join(' ');
  const deepHint = VOICE_DEEP_HINTS[voice_key] || '';

  return `TONE: ${toneMod}

CHARACTERS IN SCENE: ${(characters_in_scene || []).join(', ')}
${charBlocks || ''}

DEEP PROFILE GUIDANCE: ${deepHint}
Use the character dossier fields above — body history, sensory signatures, family wounds, desire patterns, verbal tells, comfort rituals — to make these people feel irreducible. Not all of it. The specific details that would surface in THIS scene.

SCENE BRIEF:
${scene_brief}

Write a 2500–3500 word scene. Adult literary fiction — explicit language, sexuality, and conflict permitted. Close third person. End on a shift, not a resolution. Return ONLY the prose — no meta commentary, no title.`;
}

// ── Helper: build structured character blocks for generation ───────────────
function buildCharacterBlock(dossier, relationships) {
  const d = dossier;
  const lines = [];
  lines.push(`${d.display_name || d.character_key}`);

  // Identity triad
  if (d.core_wound) lines.push(`  Wound: ${d.core_wound}`);
  if (d.core_desire) lines.push(`  Desire: ${d.core_desire}`);
  if (d.hidden_want) lines.push(`  Hidden want: ${d.hidden_want}`);
  if (d.core_belief) lines.push(`  Belief: ${d.core_belief}`);

  // Living context (situational grounding)
  const lc = d.living_context || {};
  if (lc.current_season) lines.push(`  Current season: ${lc.current_season}`);
  if (lc.active_pressures) lines.push(`  Active pressures: ${lc.active_pressures}`);
  if (lc.home_environment) lines.push(`  Home environment: ${lc.home_environment}`);
  if (lc.financial_reality) lines.push(`  Financial reality: ${lc.financial_reality}`);
  if (lc.relationship_to_deadlines) lines.push(`  Relationship to pressure: ${lc.relationship_to_deadlines}`);

  // Strengths from personality_matrix
  const strengths = d.personality_matrix?.strengths;
  if (strengths?.length) lines.push(`  Strengths: ${strengths.join(', ')}`);

  // Deep profile dimensions (selective — only populated fields)
  const dp = d.deep_profile || {};
  if (dp.life_stage?.stage) lines.push(`  Life stage: ${dp.life_stage.stage}`);
  if (dp.life_stage?.relationship_to_time) lines.push(`  Relationship to time: ${dp.life_stage.relationship_to_time}`);
  if (dp.the_body?.body_history) lines.push(`  Body history: ${dp.the_body.body_history}`);
  if (dp.the_body?.sensory_signature) lines.push(`  Sensory signature: ${dp.the_body.sensory_signature}`);
  if (dp.class_and_money?.money_wound) lines.push(`  Money wound: ${dp.class_and_money.money_wound}`);
  if (dp.class_and_money?.class_mobility_cost) lines.push(`  Class mobility cost: ${dp.class_and_money.class_mobility_cost}`);
  if (dp.sexuality_and_desire?.the_pattern) lines.push(`  Desire pattern: ${dp.sexuality_and_desire.the_pattern}`);
  if (dp.sexuality_and_desire?.what_theyve_never_said) lines.push(`  Never said: ${dp.sexuality_and_desire.what_theyve_never_said}`);
  if (dp.family_architecture?.parent_wounds) lines.push(`  Parent wounds: ${dp.family_architecture.parent_wounds}`);
  if (dp.family_architecture?.the_family_secret) lines.push(`  Family secret: ${dp.family_architecture.the_family_secret}`);
  if (dp.grief_and_loss?.the_unprocessed_loss) lines.push(`  Unprocessed loss: ${dp.grief_and_loss.the_unprocessed_loss}`);
  if (dp.ambition_and_identity?.what_they_gave_up) lines.push(`  What they gave up: ${dp.ambition_and_identity.what_they_gave_up}`);
  if (dp.habits_and_rituals?.comfort_ritual) lines.push(`  Comfort ritual: ${dp.habits_and_rituals.comfort_ritual}`);
  if (dp.habits_and_rituals?.physical_tell) lines.push(`  Physical tell: ${dp.habits_and_rituals.physical_tell}`);
  if (dp.speech_and_silence?.how_they_argue) lines.push(`  Argues: ${dp.speech_and_silence.how_they_argue}`);
  if (dp.speech_and_silence?.verbal_tells) lines.push(`  Verbal tells: ${dp.speech_and_silence.verbal_tells}`);
  if (dp.the_unseen?.the_embarrassing_memory) lines.push(`  Embarrassing memory: ${dp.the_unseen.the_embarrassing_memory}`);
  if (dp.the_unseen?.what_they_lie_about) lines.push(`  Maintenance lies: ${dp.the_unseen.what_they_lie_about}`);
  if (dp.politics_and_justice?.the_injustice_they_cant_ignore) lines.push(`  Injustice: ${dp.politics_and_justice.the_injustice_they_cant_ignore}`);

  // Relationships to other characters in the scene
  if (relationships?.length) {
    lines.push('');
    relationships.forEach(r => {
      const label = [r.role_tag, r.family_role].filter(Boolean).join(', ');
      lines.push(`  → ${r.person}${label ? ` (${label})` : ''}`);
      if (r.source_knows) lines.push(`    ${d.display_name || d.character_key} knows: ${r.source_knows}`);
      if (r.target_knows) lines.push(`    ${r.person} knows: ${r.target_knows}`);
      if (r.reader_knows) lines.push(`    Reader knows: ${r.reader_knows}`);
      if (!r.source_knows && !r.target_knows && !r.reader_knows) {
        // Fallback to situation/tension/conflict
        const detail = r.situation || r.conflict || r.tension;
        if (detail) lines.push(`    ${detail}`);
      }
    });
  }

  return lines.join('\n');
}

// ── Helper: fetch full scene context for characters ───────────────────────
async function fetchSceneContext(characterKeys, registryId) {
  if (!characterKeys?.length || !registryId) return { dossiers: [], charBlocks: '' };

  // Fetch rich dossiers
  const chars = await db.RegistryCharacter.findAll({
    where: { registry_id: registryId, character_key: characterKeys },
    attributes: [
      'id', 'character_key', 'display_name', 'icon', 'portrait_url',
      'core_desire', 'core_wound', 'core_belief', 'hidden_want',
      'living_context', 'personality_matrix', 'deep_profile',
    ],
  });

  const dossiers = chars.map(c => c.toJSON());
  if (!dossiers.length) return { dossiers: [], charBlocks: '' };

  // Fetch all relationship edges between characters in the scene
  const charIds = dossiers.map(d => d.id);
  const edges = charIds.length ? await db.sequelize.query(
    `SELECT cr.character_id_a, cr.character_id_b,
            cr.relationship_type, cr.role_tag, cr.family_role,
            cr.status, cr.situation, cr.tension_state, cr.conflict_summary,
            cr.source_knows, cr.target_knows, cr.reader_knows,
            ca.display_name AS char_a_name, ca.character_key AS char_a_key,
            cb.display_name AS char_b_name, cb.character_key AS char_b_key
     FROM character_relationships cr
     JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
     JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
     WHERE cr.confirmed = true
       AND cr.character_id_a IN (:charIds)
       AND cr.character_id_b IN (:charIds)`,
    { replacements: { charIds }, type: db.sequelize.QueryTypes.SELECT }
  ) : [];

  // Group edges by character
  const edgesByChar = {};
  dossiers.forEach(d => { edgesByChar[d.id] = []; });
  edges.forEach(e => {
    // Add from A's perspective
    if (edgesByChar[e.character_id_a]) {
      edgesByChar[e.character_id_a].push({
        person: e.char_b_name,
        character_key: e.char_b_key,
        role_tag: e.role_tag,
        family_role: e.family_role,
        situation: e.situation,
        tension: e.tension_state,
        conflict: e.conflict_summary,
        source_knows: e.source_knows,
        target_knows: e.target_knows,
        reader_knows: e.reader_knows,
      });
    }
    // Add from B's perspective (flipped knowledge)
    if (edgesByChar[e.character_id_b]) {
      edgesByChar[e.character_id_b].push({
        person: e.char_a_name,
        character_key: e.char_a_key,
        role_tag: e.role_tag,
        family_role: e.family_role,
        situation: e.situation,
        tension: e.tension_state,
        conflict: e.conflict_summary,
        source_knows: e.target_knows,
        target_knows: e.source_knows,
        reader_knows: e.reader_knows,
      });
    }
  });

  // Build structured text blocks
  const blocks = dossiers.map(d =>
    buildCharacterBlock(d, edgesByChar[d.id])
  );

  return {
    dossiers,
    charBlocks: blocks.length ? `\n\nCHARACTER DOSSIERS:\n${blocks.join('\n\n')}` : '',
  };
}

// ── POST /generate-story-multi ────────────────────────────────────────────
router.post('/generate-story-multi', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, book_id, scene_brief, characters_in_scene, registry_id, tone_dial } = req.body;
    if (!scene_brief) {
      return res.status(400).json({ error: 'scene_brief is required' });
    }

    // Fetch enriched character context (living context + relationships + knowledge asymmetry)
    const { dossiers, charBlocks } = await fetchSceneContext(characters_in_scene, registry_id);

    const promptA = buildGenerationPrompt({
      scene_brief, voice_key: 'voice_a',
      characters_in_scene: characters_in_scene || [], charBlocks,
    });
    const promptB = buildGenerationPrompt({
      scene_brief, voice_key: 'voice_b',
      characters_in_scene: characters_in_scene || [], charBlocks,
    });
    const promptC = buildGenerationPrompt({
      scene_brief, voice_key: 'voice_c',
      characters_in_scene: characters_in_scene || [], charBlocks,
    });

    // Send keep-alive headers for long generation
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    const keepAlive = setInterval(() => {
      try { res.write(' '); } catch (_) { /* ignore */ }
    }, 15000);

    // Generate all 3 voices in parallel (blind — each voice doesn't see the others)
    // Each voice gets its own 2 tones from the full palette of 6
    const [resultA, resultB, resultC] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: VOICE_SYSTEM.voice_a,
        messages: [{ role: 'user', content: promptA }],
      }),
      anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: VOICE_SYSTEM.voice_b,
        messages: [{ role: 'user', content: promptB }],
      }),
      anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: VOICE_SYSTEM.voice_c,
        messages: [{ role: 'user', content: promptC }],
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
      return `${j.display_name} (${j.character_key}): desire="${j.core_desire || ''}", wound="${j.core_wound || ''}", hidden_want="${j.hidden_want || ''}", strengths=${JSON.stringify(j.personality_matrix?.strengths || [])}`;
    }).join('\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a character registry curator. After reading a story, propose specific updates to character registry profiles. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CURRENT PROFILES:\n${profileCtx || '(none)'}\n\nSTORY:\n${story.text}\n\nPropose registry updates in JSON:\n{\n  "updates": [\n    {\n      "character_key": "key",\n      "field": "core_desire|core_wound|hidden_want|core_belief|living_context|voice_notes",\n      "current_value": "what it is now",\n      "proposed_value": "what it should become",\n      "reason": "why this scene changes this"\n    }\n  ]\n}`,
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

/**
 * POST /scene-revelation
 * Analyze a generated scene for character revelations and propose deep_profile additions.
 * Body: { scene_text, characters_in_scene: [character_key], registry_id }
 * Returns: { revelations: { [character_key]: proposed_deep_profile_additions } }
 */
router.post('/scene-revelation', optionalAuth, async (req, res) => {
  const { scene_text, characters_in_scene, registry_id } = req.body;

  if (!scene_text || !characters_in_scene?.length || !registry_id) {
    return res.status(400).json({ error: 'scene_text, characters_in_scene, and registry_id required' });
  }

  try {
    // Fetch existing dossiers with deep_profile
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id, character_key: characters_in_scene },
      attributes: ['id', 'character_key', 'display_name', 'deep_profile', 'core_wound', 'core_desire', 'hidden_want'],
    });

    if (!chars.length) return res.json({ revelations: {} });

    const charSummaries = chars.map(c => {
      const dp = c.deep_profile || {};
      const filledDims = Object.keys(dp).filter(k => dp[k] && Object.values(dp[k]).some(v => v));
      return `${c.display_name} (${c.character_key}): wound="${c.core_wound || '?'}", desire="${c.core_desire || '?'}", known dimensions: ${filledDims.join(', ') || 'none'}`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a literary analyst extracting character revelations from a scene.

CHARACTERS IN SCENE:
${charSummaries}

Read the scene carefully. For each character, identify what the scene REVEALS about them that was not previously known. Map revelations to the 14 deep_profile dimensions:
life_stage, the_body, class_and_money, religion_and_meaning, race_and_culture, sexuality_and_desire, family_architecture, friendship_and_loyalty, ambition_and_identity, habits_and_rituals, speech_and_silence, grief_and_loss, politics_and_justice, the_unseen

Only propose additions the scene actually demonstrates through action, dialogue, or interiority — not inferences. Use the character's exact behavioral evidence.

Return JSON: { "[character_key]": { "dimension_name": { "field": "value" }, ... }, ... }
Only include characters and dimensions where the scene reveals something new.`,
      messages: [{ role: 'user', content: scene_text.substring(0, 15000) }],
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ revelations: {}, note: 'No structured revelations extracted' });
    }
    const revelations = JSON.parse(jsonMatch[0]);

    return res.json({
      success: true,
      revelations,
      characters: chars.map(c => ({ id: c.id, character_key: c.character_key, display_name: c.display_name })),
    });
  } catch (err) {
    console.error('[scene-revelation]', err?.message);
    return res.status(500).json({ error: err?.message || 'Scene revelation failed' });
  }
});

module.exports = router;
