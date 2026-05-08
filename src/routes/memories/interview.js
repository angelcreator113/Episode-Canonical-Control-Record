'use strict';
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Auth middleware
const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');

const db = require('../../models');
const { RegistryCharacter } = db;
const { buildUniverseContext } = require('../../utils/universeContext');

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();

const { getCharacterVoiceContext } = require('./helpers');
const { loadWriteModeContext, buildWriteModeContextBlock } = require('./engine');

// ═══════════════════════════════════════════════════════════════════════════════
// POST /scene-interview
// Takes 7 scene interview answers → Claude generates a structured scene brief
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/scene-interview', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id: _chapter_id,
      chapter_title,
      answers,
      characters = [],
    } = req.body;

    if (!answers || !book_id) {
      return res.status(400).json({ error: 'answers and book_id are required' });
    }

    // ── Get universe context ───────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Build the prompt ───────────────────────────────────────────────────
    const characterList = characters.length > 0
      ? characters.map(c => `- ${c.name} (${c.type})`).join('\n')
      : '- JustAWoman (protagonist)';

    const prompt = `${universeContext}

You are a narrative architect helping a first-time author write their debut novel.

The author has answered 7 questions about their upcoming chapter. Use their answers to build a structured scene brief that will guide their writing session.

CHAPTER: "${chapter_title}"

KNOWN CHARACTERS:
${characterList}

AUTHOR'S ANSWERS:

1. WHERE DOES THE SCENE OPEN?
${answers.location || '(not answered)'}

2. TIME AND WEATHER:
${answers.time_weather || '(not answered)'}

3. WHO IS PHYSICALLY PRESENT:
${answers.who_present || '(not answered)'}

4. CHARACTER RELATIONSHIPS AND ENERGY:
${answers.relationships || '(not answered)'}

5. WHAT JUST HAPPENED BEFORE THIS SCENE:
${answers.just_happened || '(not answered)'}

6. WHAT DOES SHE WANT RIGHT NOW:
${answers.wants_right_now || '(not answered)'}

7. WHAT IS SHE AFRAID OF RIGHT NOW:
${answers.afraid_of || '(not answered)'}

INSTRUCTIONS:
Build a scene brief from these answers. Be specific. Use the author's actual words and details — do not invent facts they didn't give you. The scene_setting should be atmospheric and grounded. The opening_suggestion should feel like the first line of a novel — intimate, specific, and in JustAWoman's voice.

This is a literary novel. First-person voice. Intimate. Real. Not commercial fiction.

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "scene_setting": "Full atmospheric description of the scene — where, when, what it feels, sounds, smells like. 3-5 sentences.",
  "theme": "The core emotional idea this chapter explores. One phrase.",
  "scene_goal": "What must happen by the end of this chapter. One or two sentences.",
  "emotional_state_start": "Where JustAWoman begins emotionally. 3-6 words.",
  "emotional_state_end": "Where she ends emotionally. 3-6 words.",
  "characters_present": ["Name1", "Name2"],
  "pov": "first_person",
  "opening_suggestion": "One suggested first line of the chapter. In JustAWoman's voice. Specific. Grounded in the scene details the author gave."
}`;

    // ── Call Claude (with model fallback + retry for overloaded errors) ──
    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`scene-interview: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break; // success
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`scene-interview: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          // If this model is overloaded or not found, try next model
          if (status === 529 || status === 503 || status === 404) {
            console.log(`scene-interview: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.status(503).json({
        error: 'The AI service is temporarily overloaded. Please wait a minute and try again.',
        retryable: true,
      });
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let brief;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      brief = JSON.parse(clean);
    } catch (parseErr) {
      console.error('scene-interview parse error:', parseErr, '\nRaw:', rawText);
      return res.status(500).json({
        error: 'Claude returned an unparseable response',
        raw: rawText.slice(0, 400),
      });
    }

    res.json({ brief });

  } catch (err) {
    console.error('POST /scene-interview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /narrative-intelligence
// Inline co-pilot: reads last 10 lines + chapter brief + venture context →
// returns a contextual writing suggestion
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/narrative-intelligence', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_brief = {},
      recent_lines = [],
      line_count = 0,
      characters = [],
      // ── venture context fields ───────────────────────────────────────────
      venture_context = '',
      pnos_act: _pnos_act = 'act_1',
      incoming_echoes = [],
      active_threads = [],
      // ── alive system fields ──────────────────────────────────────────────
      character_rules = '',
      book_question = '',
      exit_emotion = '',
      exit_emotion_note = '',
    } = req.body;

    if (!book_id || recent_lines.length === 0) {
      return res.status(400).json({ error: 'book_id and recent_lines are required' });
    }

    // ── Universe context ───────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Character list ─────────────────────────────────────────────────────
    const characterList = characters.length > 0
      ? characters.map(c => `- ${c.name} (${c.type})`).join('\n')
      : '- JustAWoman (protagonist)\n- Lala (proto-voice, not yet fully present)';

    // ── Recent lines formatted ─────────────────────────────────────────────
    const recentLinesFormatted = recent_lines
      .map((l, i) => `LINE ${line_count - recent_lines.length + i + 1}: ${l}`)
      .join('\n\n');

    // ── Chapter brief ──────────────────────────────────────────────────────
    const briefText = [
      chapter_brief.title        && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme        && `Theme: ${chapter_brief.theme}`,
      chapter_brief.scene_goal   && `Scene goal: ${chapter_brief.scene_goal}`,
      chapter_brief.emotional_state_start && `Emotional start: ${chapter_brief.emotional_state_start}`,
      chapter_brief.emotional_state_end   && `Emotional end: ${chapter_brief.emotional_state_end}`,
      chapter_brief.pov          && `POV: ${chapter_brief.pov}`,
      chapter_brief.chapter_notes && `Scene setting: ${chapter_brief.chapter_notes}`,
    ].filter(Boolean).join('\n');

    // ── Venture + echo context (new) ───────────────────────────────────────
    const ventureBlock = venture_context
      ? `\n═══════════════════════════════════════════════════════\nVENTURE HISTORY & PNOS ACT\n═══════════════════════════════════════════════════════\n${venture_context}\n`
      : '';

    const echoBlock = incoming_echoes.length > 0
      ? `\n═══════════════════════════════════════════════════════\nINCOMING ECHOES (moments planted earlier that should reverberate here)\n═══════════════════════════════════════════════════════\n${incoming_echoes.map(e => `• FROM: "${e.source_line_content?.slice(0, 80)}..."\n  PLANTED: ${e.note}\n  SHOULD LAND AS: ${e.landing_note || 'natural resonance'}`).join('\n\n')}\n`
      : '';

    const threadBlock = active_threads.length > 0
      ? `\nACTIVE PLOT THREADS: ${active_threads.join(', ')}`
      : '';

    // ── Alive system blocks ────────────────────────────────────────────
    const characterRulesBlock = character_rules
      ? `\n═══════════════════════════════════════════════════════\nCHARACTER APPEARANCE RULES\n═══════════════════════════════════════════════════════\n${character_rules}\n`
      : '';

    const bookQuestionBlock = book_question
      ? `\n═══════════════════════════════════════════════════════\nBOOK QUESTION LAYER\n═══════════════════════════════════════════════════════\n${book_question}\n`
      : '';

    const exitEmotionBlock = exit_emotion
      ? `\nEXIT EMOTION TARGET: ${exit_emotion}${exit_emotion_note ? ` — ${exit_emotion_note}` : ''}\n`
      : '';

    // ── Wardrobe context for this chapter ──────────────────────────────
    let wardrobeContext = '';
    try {
      if (chapter_id) {
        const { WardrobeContentAssignment, WardrobeLibrary, StorytellerLine } = db.models || db;
        if (WardrobeContentAssignment) {
          const chapterPieces = await WardrobeContentAssignment.findAll({
            where: { content_type: 'chapter', content_id: chapter_id, removed_at: null },
          });
          const lines = await StorytellerLine.findAll({
            where: { chapter_id }, attributes: ['id'],
          });
          const linePieces = lines.length ? await WardrobeContentAssignment.findAll({
            where: { content_type: 'scene_line', content_id: lines.map(l => l.id), removed_at: null },
          }) : [];

          const allPieces = [...chapterPieces, ...linePieces];
          if (allPieces.length > 0) {
            const enriched = await Promise.all(allPieces.map(async a => {
              const item = await WardrobeLibrary.findByPk(a.library_item_id);
              return item ? `${item.name}${item.brand ? ` by ${item.brand}` : ''}${a.scene_context ? `: "${a.scene_context}"` : ''}` : null;
            }));
            const filtered = enriched.filter(Boolean);
            if (filtered.length > 0) {
              wardrobeContext = `\n\nWARDROBE IN THIS CHAPTER:\n${filtered.join('\n')}\nReference these pieces naturally when relevant. A piece named here is already established — treat it as a continuity anchor.`;
            }
          }
        }
      }
    } catch (e) { /* never interrupt writing */ }

    const prompt = `${universeContext}
${ventureBlock}${echoBlock}${characterRulesBlock}${bookQuestionBlock}${wardrobeContext}
You are an intelligent co-writing partner for a first-time novelist writing a literary debut.

The author is writing in real time. You have just been given their last ${recent_lines.length} lines. Your job is to read what they've written, understand the emotional momentum, and offer ONE specific, useful suggestion that helps them continue.

CHAPTER BRIEF:
${briefText || 'No brief set yet.'}
${threadBlock}
${exitEmotionBlock}
KNOWN CHARACTERS:
${characterList}

RECENT LINES (most recent at bottom):
${recentLinesFormatted}

TOTAL LINES WRITTEN SO FAR: ${line_count}

YOUR TASK:
Analyze what's happening in these lines. Then choose the SINGLE most useful suggestion type:

- "continuation" — the scene is building but needs direction for what happens next
- "line" — the author needs actual prose; give them a line in JustAWoman's voice
- "character_cue" — a character is overdue to appear and their entrance would add value
- "sensory" — the scene is all interior monologue; needs a physical/sensory detail to ground it
- "lala" — the emotional conditions for Lala's proto-voice are present (frustration, creative spiral, the thought that sounds styled not afraid)
- "echo" — an incoming echo is ripe to land in this moment; suggest how to weave it in
- "appearance" — a character's appearance rules are being violated or an entrance needs attention

CHARACTER APPEARANCE RULES:
If character rules are provided, ensure suggestions respect those rules. Never describe a character appearing in a way that violates their architectural constraints.

BOOK QUESTION AWARENESS:
If a book question direction is provided (toward/holding/away), the suggestion should subtly align with that direction. "Toward" means the character is moving closer to answering yes. "Away" means doubt is winning. "Holding" means the tension is suspended.

EXIT EMOTION AWARENESS:
If an exit emotion is set, the scene should be building toward that emotional landing. Your suggestion should help the writer steer toward that target.

LALA DETECTION RULES:
Lala conditions are met when: the writing shows a creative spiral (trying and failing, comparing, feeling behind), AND there's an emotional peak (frustration, longing, self-doubt reaching maximum), AND the scene has been interior monologue for 5+ lines. When Lala conditions are met, ALWAYS choose type "lala".

ECHO RULES:
If incoming echoes are provided and the current emotional moment matches one of them, choose type "echo" and suggest how to weave the echo into the current scene. The reader should feel resonance, not exposition.

VENTURE AWARENESS:
If venture history is provided, remember: JustAWoman is not on attempt 1. The doubt carries the weight of all previous attempts. The hope is harder-won. The voice should reflect accumulated experience, not fresh naivety.

WRITING RULES:
- The author is writing in first person (JustAWoman's voice) and close third
- This is a literary novel — intimate, specific, real
- JustAWoman's voice is: direct, self-aware, occasionally funny, never performative
- Lala's proto-voice is: confident, styled, unapologetic, brief — one thought, not a speech
- Do NOT invent new characters or facts not established in the brief or lines
- Do NOT be generic — your suggestion must respond specifically to what was just written

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "type": "continuation|line|character_cue|sensory|lala|echo",
  "suggestion": "Your specific guidance in 1-3 sentences. What should the author consider doing next and why.",
  "line_suggestion": "If type is 'line' or 'lala': actual prose in JustAWoman's voice they can use or modify. If not applicable, omit this field.",
  "lala_line": "If type is 'lala': the proto-voice line. One thought. Styled. Brief. e.g. 'If it were me, I would've posted it already.' Omit if not lala.",
  "character": "If type is 'character_cue': the character's name. Omit otherwise.",
  "character_role": "If type is 'character_cue': their narrative function here. Omit otherwise.",
  "echo_id": "If type is 'echo': the echo ID being surfaced. Omit otherwise.",
  "what_to_do": "Optional. One concrete action the author can take right now. e.g. 'Describe what her hands are doing while she waits.'"
}`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let suggestion;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      suggestion = JSON.parse(clean);
    } catch (parseErr) {
      console.error('narrative-intelligence parse error:', parseErr);
      // Return a safe fallback rather than erroring
      return res.json({
        suggestion: {
          type: 'continuation',
          suggestion: 'Keep writing. Stay in her voice. What does she do next?',
          what_to_do: 'Write the next thing that happens — even if it\'s small.',
        },
      });
    }

    res.json({ suggestion });

  } catch (err) {
    console.error('POST /narrative-intelligence error:', err);
    // Fail gracefully — never interrupt the writing session with a 500
    res.json({
      suggestion: {
        type: 'continuation',
        suggestion: 'Keep writing. Stay in her voice.',
      },
    });
  }
});


// ══════════════════════════════════════════════════════════════════════════
// POST /continuity-check — Detect contradictions, jumps, disconnects
// ══════════════════════════════════════════════════════════════════════════

router.post('/continuity-check', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id: _chapter_id2,
      chapter_brief = {},
      all_lines,
      trigger_line,
    } = req.body;

    if (!book_id || !all_lines) {
      return res.status(400).json({ error: 'book_id and all_lines are required' });
    }

    const briefText = [
      chapter_brief.title        && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme        && `Theme: ${chapter_brief.theme}`,
      chapter_brief.scene_goal   && `Scene goal: ${chapter_brief.scene_goal}`,
      chapter_brief.emotional_state_start && `Emotional start: ${chapter_brief.emotional_state_start}`,
      chapter_brief.emotional_state_end   && `Emotional end: ${chapter_brief.emotional_state_end}`,
    ].filter(Boolean).join('\n');

    const prompt = `You are a continuity editor for a literary novel. A first-time author has just approved or edited a line. Check the full chapter for continuity issues.

CHAPTER BRIEF:
${briefText || 'Not set.'}

ALL APPROVED LINES:
${all_lines}

MOST RECENTLY APPROVED LINE:
${trigger_line}

CHECK FOR THESE THREE ISSUE TYPES:

1. FACTUAL CONTRADICTION
A character, location, time, or stated fact contradicts something established earlier.
Example: Character A was described as being at work in line 3 but is physically present in line 18 with no transition.

2. EMOTIONAL JUMP
The protagonist's emotional state shifts dramatically with no writing bridging the change.
Example: She's devastated and doubting herself in line 12, but energized and certain in line 15 with nothing in between.

3. NARRATIVE DISCONNECT
Something is introduced — a character, a phone call, an object, a decision — with no prior setup or explanation.
Example: Line 22 mentions a conversation she had with her sister, but no sister has been established.

RULES:
- Only flag REAL issues, not stylistic choices
- Minor POV shifts (first person to close third) are intentional — do NOT flag these
- If the chapter has no issues, return an empty array
- Be specific about which line numbers are involved
- Your suggestions must be actionable and concrete

Respond ONLY with valid JSON. No preamble. No markdown fences.

{
  "issues": [
    {
      "id": "issue-1",
      "type": "factual|emotional|narrative",
      "description": "Clear description of the specific issue found.",
      "lines_involved": [3, 18],
      "suggestion": "Concrete fix — what to write or change to resolve this."
    }
  ]
}

If no issues found: { "issues": [] }`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return res.json({ issues: [] }); // fail gracefully
    }

    res.json({ issues: result.issues || [] });

  } catch (err) {
    console.error('POST /continuity-check error:', err);
    res.json({ issues: [] }); // never 500 — fail gracefully
  }
});


// ══════════════════════════════════════════════════════════════════════════
// POST /rewrite-options — 3 alternative rewrites for a single line
// ══════════════════════════════════════════════════════════════════════════

router.post('/rewrite-options', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      line_id: _line_id,
      content,
      character_id,
      chapter_brief = {},
    } = req.body;

    if (!content || !book_id) {
      return res.status(400).json({ error: 'content and book_id are required' });
    }

    // Get universe context for voice consistency
    const universeContext = await buildUniverseContext(book_id, db);

    // Load character voice from registry for accurate voice rewrite
    const charVoice = character_id ? await getCharacterVoiceContext(character_id) : null;
    const charName = charVoice?.name || 'JustAWoman';
    const voiceDescription = charVoice?.voiceBlock
      ? `Use the character voice data below to define what "${charName}'s voice" actually means:\n${charVoice.voiceBlock}`
      : `More ${charName}. She's direct, self-aware, specific, occasionally funny. She doesn't perform. She doesn't dress things up. What would she actually say?`;

    // Load full narrative context for richer rewrites
    const wmCtx = await loadWriteModeContext(character_id);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    const briefContext = [
      chapter_brief.title                 && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme                 && `Theme: ${chapter_brief.theme}`,
      chapter_brief.pov                   && `POV: ${chapter_brief.pov}`,
      chapter_brief.emotional_state_start && `Emotional state: ${chapter_brief.emotional_state_start}`,
    ].filter(Boolean).join('\n');

    const prompt = `${universeContext}

You are a literary editor helping a first-time novelist improve a single line. The author has written something real but wants to see if it can be expressed better.

CHAPTER CONTEXT:
${briefContext || 'No brief set.'}
${narrativeContext}
ORIGINAL LINE:
"${content}"

Write exactly THREE rewrites of this line. Each rewrite serves a different purpose:

1. TIGHTER — Same meaning, fewer words. Cut what's unnecessary. Sharper, cleaner delivery. The core thought lands harder.

2. EMOTIONAL — More feeling. More vulnerability. More honest. Don't soften it — deepen it. What's the rawer version of this thought?

3. VOICE — ${voiceDescription}

RULES:
- Stay in the same POV as the original (first person if original is first person)
- Do NOT change the core meaning or introduce new facts
- Each rewrite must feel distinct from the others
- These are literary — not commercial, not self-help, not generic
- Preserve any dialect or speech patterns that feel intentional
${charVoice?.charRules || ''}

Respond ONLY with valid JSON. No preamble. No markdown.

{
  "options": [
    { "type": "tighter",   "text": "rewritten line here" },
    { "type": "emotional", "text": "rewritten line here" },
    { "type": "voice",     "text": "rewritten line here" }
  ]
}`;

    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`rewrite-options: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 600,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`rewrite-options: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`rewrite-options: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.status(503).json({ error: 'AI is busy — please try again in a moment' });
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse rewrite response' });
    }

    res.json({ options: result.options || [] });

  } catch (err) {
    console.error('POST /rewrite-options error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
//  CHARACTER VOICE INTERVIEW ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /character-interview-progress/:character_id
 * Load saved interview progress (stored in extra_fields.interview_progress)
 */
router.get('/character-interview-progress/:character_id', requireAuth, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const progress = character.extra_fields?.interview_progress || null;
    res.json({ progress });
  } catch (err) {
    console.error('GET /character-interview-progress error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-save-progress
 * Auto-save interview state after every answer so users can resume later.
 * Stores in extra_fields.interview_progress on the RegistryCharacter.
 */
router.post('/character-interview-save-progress', requireAuth, async (req, res) => {
  try {
    const {
      character_id,
      messages,
      answers,
      question_index,
      next_question,
      sensory_asked,
      private_life_asked,
      unspoken_asked,
      one_more_asked,
      last_contradiction_check,
      drift_history,
      relational_notes,
      current_drift,
      step,
    } = req.body;

    if (!character_id) return res.status(400).json({ error: 'character_id required' });

    const character = await RegistryCharacter.findByPk(character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const existingExtra = character.extra_fields || {};
    character.extra_fields = {
      ...existingExtra,
      interview_progress: {
        messages,
        answers,
        question_index,
        next_question,
        sensory_asked,
        private_life_asked,
        unspoken_asked,
        one_more_asked,
        last_contradiction_check,
        drift_history,
        relational_notes,
        current_drift,
        step,
        saved_at: new Date().toISOString(),
      },
    };
    // Sequelize needs JSONB change flagged explicitly
    character.changed('extra_fields', true);
    await character.save();

    res.json({ success: true });
  } catch (err) {
    console.error('POST /character-interview-save-progress error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-next
 * Called after each answer during the character interview.
 *
 * ════════════════════════════════════════════════════════════════════════
 * DRIFT DETECTION — when the author shifts characters mid-session
 * ════════════════════════════════════════════════════════════════════════
 *
 * 1. FOLLOWS IT — leans into the drift instead of redirecting back
 * 2. TAGS IT — saves the drift content as relational perception data
 * 3. BRIDGES IT — after following the drift, asks the bridge question
 *
 * Also preserves:
 * ─ First-answer deep read
 * ─ Hesitation catch mode
 * ─ Contradiction detection mode
 * ─ New character detection
 * ─ Plot thread detection
 */
router.post('/character-interview-next', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      character_name,
      character_type,
      answers_so_far            = [],
      next_base_question,
      existing_characters       = [],
      force_hesitation_catch    = false,
      force_contradiction_check = false,
      // ── Drift detection fields ──
      primary_character,            // who the session is about (fallback to character_name)
      known_characters    = [],     // [{ id, name, archetype, role }]
      drift_history       = [],     // previous drift events this session
      relational_notes    = [],     // accumulated cross-character observations
    } = req.body;

    const primaryName = primary_character || character_name;

    if (!answers_so_far.length || !answers_so_far[answers_so_far.length - 1]?.answer?.trim()) {
      return res.json({
        question: 'Take your time — what were you saying?',
        drift_detected: false,
        drifted_to: null,
        drift_type: null,
        bridge_question_ready: false,
        relational_note: null,
        thread_hint: null,
        contradiction_detected: null,
        new_characters: [],
        session_notes: [],
      });
    }

    // ── Universe context ──────────────────────────────────────────────
    let universeBlock = '';
    if (book_id) {
      try {
        const ctx = await buildUniverseContext(book_id, db);
        if (ctx) universeBlock = `\nUNIVERSE CONTEXT:\n${ctx}\n`;
      } catch (_) { /* non-fatal */ }
    }

    // ── Separate history from latest answer ──────────────────────────
    const previousAnswers = answers_so_far.slice(0, -1);
    const latestAnswer    = answers_so_far[answers_so_far.length - 1];
    const latestText      = latestAnswer?.answer || '';

    const historyFormatted = previousAnswers.length > 0
      ? previousAnswers.map((a, i) => `Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`).join('\n\n')
      : '(This is the first answer — no prior history)';

    const latestFormatted = latestAnswer
      ? `Q: ${latestAnswer.question}\nA: ${latestAnswer.answer}`
      : '(No answer provided)';

    const existingList = existing_characters.length
      ? `\nALREADY KNOWN CHARACTERS (do NOT flag as new):\n${existing_characters.join(', ')}\n`
      : '';

    // ── STEP 1: DRIFT DETECTION ─────────────────────────────────────
    const knownNames = known_characters
      .map(c => ({ ...c, searchTerms: [
        c.name,
        c.selected_name || '',
        ...(c.name?.toLowerCase().includes('husband') ? ['husband', 'him', 'he'] : []),
        ...(c.name?.toLowerCase().includes('comparison') ? ['chloe', 'comparison creator', 'her content'] : []),
        ...(c.name?.toLowerCase().includes('lala') ? ['lala'] : []),
        ...(c.name?.toLowerCase().includes('witness') ? ['witness'] : []),
        ...(c.name?.toLowerCase().includes('mentor') ? ['mentor', 'almost-mentor', 'almost mentor'] : []),
      ].filter(Boolean)}))
      .filter(c => c.name?.toLowerCase() !== primaryName?.toLowerCase());

    const answerLower = latestText.toLowerCase();

    const mentionedChars = knownNames.filter(c =>
      c.searchTerms.some(term => term && answerLower.includes(term.toLowerCase()))
    );

    let driftDetected = false;
    let driftedTo = null;
    let driftType = null;

    if (mentionedChars.length > 0) {
      const wordCount = latestText.split(/\s+/).length;
      const primaryLower = primaryName?.toLowerCase();
      const primaryMentions = primaryLower
        ? (answerLower.match(new RegExp(primaryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        : 0;
      const otherMentions = mentionedChars[0].searchTerms.reduce((count, term) =>
        count + (answerLower.match(new RegExp(term.toLowerCase(), 'g')) || []).length, 0
      );

      driftedTo = mentionedChars[0].name;
      driftDetected = true;

      if (wordCount > 40 && otherMentions >= primaryMentions) {
        driftType = 'full_shift';
      } else if (answerLower.includes('like') || answerLower.includes('unlike') ||
                 answerLower.includes('different') || answerLower.includes('compare')) {
        driftType = 'comparison';
      } else {
        driftType = 'mention';
      }
    }

    const alreadyBridged = drift_history.some(
      d => d.drifted_to === driftedTo && d.bridged === true
    );

    const lastDrift = drift_history[drift_history.length - 1];
    const bridgeQuestionReady = driftType !== 'full_shift' &&
      lastDrift?.drifted_to === driftedTo &&
      lastDrift?.type === 'full_shift' &&
      !alreadyBridged;

    // ── STEP 2: BUILD RELATIONAL NOTE ───────────────────────────────
    let relationalNote = null;
    if (driftDetected && driftType !== 'mention') {
      relationalNote = {
        primary_character: primaryName,
        drifted_to: driftedTo,
        type: driftType,
        raw_content: latestText,
        observation: null, // Claude will fill this
      };
    }

    // ── STEP 3: BUILD PROMPT ─────────────────────────────────────────

    // Drift context blocks
    const driftContext = driftDetected ? `
DRIFT DETECTED: The author drifted from ${primaryName} to ${driftedTo} (type: ${driftType}).
${driftType === 'full_shift' ? `They shifted significantly to talking about ${driftedTo}. FOLLOW this drift — do NOT redirect. Ask one question that explores ${primaryName}'s relationship to ${driftedTo} or how ${primaryName} sees/feels about ${driftedTo}. The author's mind went there for a reason.` : ''}
${driftType === 'comparison' ? `They compared ${primaryName} to ${driftedTo}. Lean into the comparison — what does it reveal about ${primaryName}?` : ''}
${driftType === 'mention' ? `They mentioned ${driftedTo} in passing. Acknowledge it lightly, stay with ${primaryName}.` : ''}
` : '';

    const bridgeContext = bridgeQuestionReady ? `
BRIDGE MOMENT: The author followed ${driftedTo} in the previous exchange. Now it's time to bridge back.
Ask the bridge question: "You were talking about ${primaryName} and kept coming back to ${driftedTo}. What does that drift tell you about ${primaryName} — not about ${driftedTo}?"
This is the question the author didn't know they had.
` : '';

    const relationalContext = relational_notes.length > 0
      ? `Cross-character observations collected so far:\n${relational_notes.slice(-3).map(n => `• ${n.primary_character} on ${n.drifted_to}: "${n.raw_content?.slice(0, 80)}..."`).join('\n')}`
      : '';

    // ── Choose prompt mode based on flags ─────────────────────────────
    let taskInstructions;

    if (force_hesitation_catch) {
      taskInstructions = `
THE AUTHOR TRAILED OFF OR HEDGED IN THEIR LAST ANSWER.

This means they are sitting on something they haven't fully articulated yet.
That unfinished thought is the most important thing in this interview right now.

YOUR TASK:
Ask ONE question that goes directly into the hesitation.
- If they said "I don't know" — ask what makes it hard to know.
- If they said "it's complicated" — ask what makes it complicated.
- If they trailed off mid-thought — ask what they were about to say.
- If they hedged ("sort of", "kind of") — ask for the version without the qualifier.

Do NOT move to the next planned question. Stay with what they just said.
One question only. Warm, curious, direct.`;

    } else if (force_contradiction_check) {
      taskInstructions = `
SCAN THE FULL CONVERSATION FOR TENSIONS AND CONTRADICTIONS.

Read every answer so far (including the latest). Look for places where:
- The author described the character one way early on, and a different way later
- The character seems to have two contradictory qualities that both feel true
- The author said something the character values, and something else that conflicts

YOUR TASK:
If you find a tension: ask ONE question that names it directly and invites the author
to sit with both truths. Something like:
"Earlier you said [X] — but just now it sounds like [Y]. What if both are true?"

If you find NO real tension: fall back to a genuine follow-up on the latest answer.

Return the tension in the "contradiction_detected" field.`;

    } else if (bridgeQuestionReady) {
      taskInstructions = `
BRIDGE MOMENT — this is the most important question of the session.
Ask: "You were talking about ${primaryName} and kept coming back to ${driftedTo}. What does that drift tell you about ${primaryName} — not about ${driftedTo}?"
Do NOT ask anything else. This IS the question.`;

    } else if (driftDetected && driftType === 'full_shift') {
      taskInstructions = `
DRIFT FOLLOW — the author shifted from ${primaryName} to ${driftedTo}.
Do NOT say "let's get back to ${primaryName}." Do NOT ignore the drift.
Ask one question that explores the relationship between ${primaryName} and ${driftedTo}.
Specifically: how does ${primaryName} experience, perceive, or feel about ${driftedTo}?
Frame it that way: "What does ${primaryName} feel watching ${driftedTo}..."
The observation from this drift belongs to ${primaryName}'s profile, not ${driftedTo}'s.
One question only. Follow the drift.`;

    } else if (driftDetected && driftType === 'comparison') {
      taskInstructions = `
The author is comparing ${primaryName} to ${driftedTo}. Lean into the comparison.
Ask one question that reveals what this comparison tells us about ${primaryName}.
One question only. Warm, curious.`;

    } else {
      taskInstructions = `
YOUR TASK:
1. Read WHAT THE AUTHOR JUST SAID carefully.
2. Ask ONE follow-up question that responds DIRECTLY to something specific.
   - Did they mention a name? Ask about that person.
   - Did they describe a feeling? Ask what created it.
   - Did they give a detail that suggests a scene? Ask what that scene looks like.
3. ONLY fall back to the planned next question if they gave you nothing to follow.
4. Check for plot threads and new character names.

One question only. Warm, curious, specific. Never clinical.`;
    }

    const prompt = `You are interviewing an author about one of their characters for a memoir called "Before Lala."

CHARACTER: ${primaryName} (type: ${character_type})
BOOK: LalaVerse — literary, psychological, first-person narrative
${universeBlock}
${existingList}
${relationalContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION HISTORY:
${historyFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THE AUTHOR JUST SAID:
${latestFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${next_base_question ? `NEXT PLANNED QUESTION (use as fallback only): ${next_base_question}` : ''}

${driftContext}
${bridgeContext}
${taskInstructions}

Respond with ONLY valid JSON. No preamble. No markdown fences.

{
  "question": "Your single question here",
  "relational_observation": "One sentence capturing what this drift revealed about how ${primaryName} perceives ${driftedTo} — or null if not applicable",
  "session_note": "One new thing learned about ${primaryName} from this exchange — or null",
  "thread_hint": "One sentence describing a plot thread you detected, or null",
  "contradiction_detected": "One sentence naming the tension you found (for contradiction mode), or null",
  "new_characters": []
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = {
        question: next_base_question || 'Tell me more about that.',
        relational_observation: null,
        session_note: null,
        thread_hint: null,
        contradiction_detected: null,
        new_characters: [],
      };
    }

    if (!Array.isArray(parsed.new_characters)) parsed.new_characters = [];

    // Attach Claude's relational observation to the note
    if (relationalNote && parsed.relational_observation) {
      relationalNote.observation = parsed.relational_observation;
    }

    res.json({
      question:              parsed.question,
      // Existing fields
      thread_hint:           parsed.thread_hint || null,
      contradiction_detected: parsed.contradiction_detected || null,
      new_characters:        parsed.new_characters,
      // Drift state
      drift_detected:        driftDetected,
      drifted_to:            driftedTo,
      drift_type:            driftType,
      bridge_question_ready: bridgeQuestionReady,
      // Relational note
      relational_note:       relationalNote,
      // Session note from Claude
      session_note:          parsed.session_note || null,
    });

  } catch (err) {
    console.error('POST /character-interview-next error:', err);
    res.json({
      question:               req.body.next_base_question || 'What else should I know about this character?',
      thread_hint:            null,
      contradiction_detected: null,
      new_characters:         [],
      drift_detected:         false,
      drifted_to:             null,
      drift_type:             null,
      bridge_question_ready:  false,
      relational_note:        null,
      session_note:           null,
    });
  }
});


/**
 * POST /character-interview-create-character
 * Called when the author confirms a newly detected character during an interview.
 * Creates a draft RegistryCharacter with what Claude inferred.
 */
router.post('/character-interview-create-character', requireAuth, async (req, res) => {
  try {
    const { registry_id, character, discovered_during } = req.body;
    if (!registry_id || !character?.name) {
      return res.status(400).json({ error: 'registry_id and character.name required' });
    }

    // Generate character_key from name
    const charKey = character.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Map appearance_mode values to valid enum values
    const modeMap = {
      'On-Page': 'on_page', 'on_page': 'on_page',
      'Composite': 'composite', 'composite': 'composite',
      'Referenced Only': 'observed', 'observed': 'observed',
      'Invisible': 'invisible', 'invisible': 'invisible',
      'Brief': 'brief', 'brief': 'brief',
    };
    const appearanceMode = modeMap[character.appearance_mode] || 'on_page';

    const created = await RegistryCharacter.create({
      registry_id,
      character_key:   charKey,
      display_name:    character.name,
      role_type:       character.type || 'special',
      description:     character.role || null,
      appearance_mode: appearanceMode,
      core_belief:     character.belief || null,
      pressure_type:   character.emotional_function || null,
      personality:     character.writer_notes || null,
      status:          'draft',
      subtitle:        discovered_during
        ? `Discovered during ${discovered_during} interview`
        : 'Discovered during interview',
      extra_fields: {
        discovered_during: discovered_during || null,
        auto_detected: true,
        detection_source: 'character_interview',
      },
    });

    res.json({ character: created });
  } catch (err) {
    console.error('POST /character-interview-create-character error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-complete
 * Called when the interview is complete.
 * Builds full character profile + discovers plot threads from all answers.
 *
 * UPGRADES:
 * ─ Extracts 3 new profile fields: sensory_anchor, private_self,
 *   unspoken_reaction (only if answers for those questions exist)
 * ─ Extracts contradictions as a separate array — NOT folded into notes.
 *   They get their own section in the profile view.
 * ─ Prompt rewritten to use the author's own words more aggressively
 */
router.post('/character-interview-complete', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      character_id: _character_id,
      character_name,
      character_type,
      answers = [],
      relational_notes = [],
    } = req.body;

    let universeContext = '';
    if (book_id) {
      try {
        universeContext = await buildUniverseContext(book_id, db);
      } catch (_) { /* proceed without */ }
    }

    const answersFormatted = answers
      .map((a, i) => `Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`)
      .join('\n\n');

    const prompt = `${universeContext}

You have just interviewed an author about one of their characters for their debut literary novel.

CHARACTER: ${character_name} (type: ${character_type})

FULL INTERVIEW:
${answersFormatted}

${relational_notes.length > 0 ? `
CROSS-CHARACTER OBSERVATIONS (captured during interview):
${relational_notes.map((n, i) => `${i+1}. [${n.primary_character} ↔ ${n.drifted_to}] ${n.observation}`).join('\n')}

These observations reveal how characters relate to each other through the author's instinctive associations. Use them to enrich the profile — especially pressure_type and personality sections.
` : ''}
════════════════════════════════════════════════════════
YOUR TASK — THREE PARTS
════════════════════════════════════════════════════════

PART 1 — CHARACTER PROFILE
Build the complete psychological profile from the author's own words.

Rules for the profile:
- Use their language wherever possible. Preserve their voice.
- Do not add facts they didn't give you.
- Do not make it sound like a character sheet — it should read like
  someone who deeply knows this person describing them.
- The profile should feel like it was written by the author, not by a system.

For sensory_anchor: look for the specific image, physical detail, or
moment they described. If they gave one, quote or closely paraphrase it.
This is the single most specific thing they said.

For private_self: look for what the author said about this character
alone, when no one is watching. If they answered that question, capture it here.
If they didn't answer it, omit the field.

For unspoken_reaction: look for what the protagonist thinks about this
character but would never say out loud. Only present for pressure/mirror
types and only if the author answered that question. Omit if not applicable.

For personality (writer notes): practical guidance for writing this character
in scenes — their voice, their behavior patterns, how they show up physically,
what they do when they're uncomfortable. 3-5 sentences. Concrete.

PART 2 — CONTRADICTIONS (captured as character gold, not problems)
Read the full interview for places where the author described this character
in two ways that seem to conflict. These are the most important things
in the whole interview. A character who is both X and Y is real.

For each tension you find, write ONE sentence naming both sides:
"She described [name] as [quality A] — and also as [quality B]. Both are true."

Return 0–3 contradictions. If you find none, return [].

PART 3 — PLOT THREADS
2–4 specific, concrete story possibilities that emerged from what the author said.
Each thread should feel inevitable given what was shared — not invented.

A plot thread is: a specific scene, conflict, or relationship dynamic that could
become a chapter or a turning point. Not a theme — a moment.

════════════════════════════════════════════════════════

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "profile": {
    "selected_name": "The name the author uses for this character",
    "description": "Who this character is and what they mean to the story. 2–4 sentences in the author's voice.",
    "core_belief": "The core belief or question this character pressures the protagonist with. One sentence.",
    "pressure_type": "What emotional work this character does in the story. 2–3 sentences.",
    "sensory_anchor": "The single specific image or physical detail that captures this character. Directly from the author's words. Omit if they didn't give one.",
    "private_self": "What this character is like alone when no one is watching. From the author's answer. Omit if not answered.",
    "unspoken_reaction": "What JustAWoman thinks about this character but won't say. From the author's answer. Omit if not applicable.",
    "personality": "Practical writer notes for scenes — voice, behavior, how they show up, what they do when uncomfortable. 3–5 sentences.",
    "personality_matrix": {
      "confidence": 0,
      "playfulness": 0,
      "luxury_tone": 0,
      "drama": 0,
      "softness": 0
    }
  },
  "contradictions": [
    "She described [name] as [quality A] — and also as [quality B]. Both are true."
  ],
  "threads": [
    {
      "title": "Short evocative title",
      "description": "What happens and why it matters. 2–3 sentences.",
      "chapter_hint": "The scene this could become. One sentence starting with 'The scene where...'"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      console.error('character-interview-complete parse error:', e);
      return res.status(500).json({ error: 'Failed to parse profile response' });
    }

    // Ensure arrays exist
    if (!Array.isArray(result.contradictions)) result.contradictions = [];
    if (!Array.isArray(result.threads))        result.threads = [];

    res.json(result);

  } catch (err) {
    console.error('POST /character-interview-complete error:', err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;
