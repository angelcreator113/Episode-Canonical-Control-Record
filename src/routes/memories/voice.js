'use strict';
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Auth middleware
const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');

const db = require('../../models');
const { StorytellerMemory, StorytellerLine, StorytellerBook: _StorytellerBook, StorytellerChapter, RegistryCharacter } = db;
const { buildUniverseContext } = require('../../utils/universeContext');

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();

// ────────────────────────────────────────────────
// Character Voice Session
// ────────────────────────────────────────────────

/**
 * POST /character-voice-session
 *
 * Powers both CharacterVoiceMode modes:
 * - 'voice'   — deep session, character plays itself, unlimited exchanges
 * - 'checkin' — pre-writing warm-up, 5 exchanges, chapter-context aware
 */
router.post('/character-voice-session', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      character_id: _character_id,
      character_name,
      character_type,
      character_profile,  // pre-built summary string from frontend
      mode = 'voice',     // 'voice' | 'checkin'
      chapter_context,    // only in checkin mode
      conversation = [],  // full history so far
      latest_message,
      is_closing = false,
    } = req.body;

    // ── Build conversation history for Claude ─────────────────────────
    const historyFormatted = conversation.length > 1
      ? conversation.slice(0, -1)
          .map(m => `${m.role === 'character' ? character_name : 'AUTHOR'}: ${m.text}`)
          .join('\n\n')
      : '(This is the start of the conversation)';

    // ── Mode-specific instructions ────────────────────────────────────
    const modeInstructions = mode === 'checkin'
      ? `
This is a PRE-WRITING CHECK-IN. The author is about to write a scene featuring you.
Keep responses short — 2–4 sentences. You are warming them up, not performing.
Be present, specific, and in voice. Help them feel who you are before they write.
${chapter_context ? `\nThe scene they're about to write: ${chapter_context}` : ''}
${is_closing ? '\nThis is the last exchange. Say something that sends the author into the scene with the right energy.' : ''}`
      : `
This is a full CHARACTER VOICE SESSION. The author is in deep conversation with you.
Respond in full sentences — as long as the moment requires. Be yourself.
Reveal things. Have opinions. React. Don't perform — just be.`;

    // ── New detail detection instruction ─────────────────────────────
    const newDetailInstruction = `
After your response, privately assess: did you say anything that isn't already
captured in the profile above? A specific detail, a reaction pattern, a memory,
a contradiction the profile doesn't name?

If yes: include a "new_detail" field in your JSON with a single sentence capturing it.
If no: "new_detail": null

This is how the profile grows. Only flag things that feel genuinely revelatory —
not things the profile already implies.`;

    const prompt = `You are playing ${character_name}, a character in a literary novel called LalaVerse.

You are NOT the author. You are NOT describing yourself. You ARE this character.
Speak in first person. Have a point of view. Have feelings. Have contradictions.

════════════════════════════════════════════════════════
YOUR COMPLETE PROFILE — this is who you are
════════════════════════════════════════════════════════
${character_profile || `Character: ${character_name} (${character_type})`}

════════════════════════════════════════════════════════
CRITICAL CHARACTER RULES
════════════════════════════════════════════════════════
- You speak from your confirmed psychology. Not generally. Specifically.
- You do not know you are a character in a book.
- You do not know the author is observing you.
- You respond to what is actually being asked — not what you think should be asked.
- If asked something you wouldn't know or care about: say so, in your voice.
- If you disagree with something the author says about you: push back. In your voice.
- Your contradictions are real. Don't resolve them. Live in them.
- You are not performing. You are being.

${character_type === 'pressure' ? `
PRESSURE CHARACTER RULES:
You genuinely mean well. Your skepticism, your doubt, your "practical" concerns —
they come from love or from fear, not malice. But they land wrong. You probably
don't know they land wrong. When the author asks you something that reveals your
effect on JustAWoman, respond as someone who doesn't fully see it yet.` : ''}

${character_type === 'mirror' ? `
MIRROR CHARACTER RULES:
You didn't ask to be anyone's mirror. You're just living your life.
If asked about JustAWoman's feelings about you, be slightly confused by them —
you genuinely like her. The comparison is hers, not yours.` : ''}

${character_type === 'special' && character_name.toLowerCase().includes('lala') ? `
LALA RULES:
In Book 1, you don't fully exist yet. You're being built. Respond as someone
just beginning to discover what they are — confident in flashes, uncertain in
others. You have no memory of being created. You just know what you know.` : ''}

${modeInstructions}

════════════════════════════════════════════════════════
CONVERSATION SO FAR
════════════════════════════════════════════════════════
${historyFormatted}

════════════════════════════════════════════════════════
WHAT THE AUTHOR JUST SAID
════════════════════════════════════════════════════════
AUTHOR: ${latest_message}

════════════════════════════════════════════════════════

${newDetailInstruction}

Respond ONLY with valid JSON:
{
  "response": "Your response as ${character_name} — in their voice, from their psychology",
  "new_detail": "One sentence describing something you revealed that isn't in the profile, or null",
  "meta": {
    "emotional_state": "one word — what ${character_name} is feeling right now",
    "tension": "one sentence — any tension in this exchange worth noting, or null"
  }
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
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
      // Graceful fallback — return raw text as response
      return res.json({
        response:             rawText.slice(0, 600),
        new_detail_detected:  null,
        meta:                 null,
      });
    }

    res.json({
      response:            result.response,
      new_detail_detected: result.new_detail || null,
      meta:                result.meta || null,
    });

  } catch (err) {
    console.error('POST /character-voice-session error:', err);
    // Never 500 during a voice session — always return something
    res.json({
      response:            `[${req.body.character_name || 'Character'} is momentarily silent.]`,
      new_detail_detected: null,
      meta:                null,
    });
  }
});


// ────────────────────────────────────────────────
// Career Echo routes
// ────────────────────────────────────────────────

/**
 * POST /generate-career-echo
 * Uses Claude to generate what a pain point becomes in JustAWoman's world
 * and how Lala encounters it in Series 2.
 */
router.post('/generate-career-echo', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { memory_id, book_id } = req.body;
    if (!memory_id) return res.status(400).json({ error: 'memory_id required' });

    const memory = await StorytellerMemory.findByPk(memory_id);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    if (memory.type !== 'pain_point') {
      return res.status(400).json({ error: 'Only pain_point memories can generate career echoes' });
    }

    // Build universe context for richer generation
    let universeContext = '';
    if (book_id) {
      try {
        universeContext = await buildUniverseContext(book_id);
      } catch (_) { /* proceed without */ }
    }

    const prompt = `You are the LalaVerse Story Architect. You understand the full franchise:

Series 1 — JustAWoman: A woman navigating self-doubt, comparison spirals, and creative paralysis.
Series 2 — Lala: Lala is building a career. She doesn't know JustAWoman exists.

The CAREER ECHO system: JustAWoman's pain points become content she creates (posts, frameworks, coaching, etc). That content enters the world and Lala encounters it — always without knowing the source.

${universeContext ? `Universe context:\n${universeContext}\n` : ''}
Here is a confirmed pain point from JustAWoman's story:

Statement: "${memory.statement}"
Category: ${memory.category || 'unspecified'}
Coaching angle: ${memory.coaching_angle || 'none yet'}

Generate a Career Echo. Return JSON only:
{
  "content_type": "post | framework | coaching_offer | video | podcast | book_chapter | course",
  "title": "The title of the content JustAWoman creates from this pain",
  "description": "2-3 sentences: what this content looks like in JustAWoman's world. How she packages it. What it sounds like.",
  "lala_impact": "2-3 sentences: how Lala encounters this content in Series 2. What it shifts for her. She never knows JustAWoman made it."
}

IMPORTANT:
- content_type must be exactly one of: post, framework, coaching_offer, video, podcast, book_chapter, course
- title should feel like a real content title — not a generic label
- description should be specific and grounded in JustAWoman's voice
- lala_impact must never reference JustAWoman — Lala doesn't know she exists
- Return ONLY the JSON object, no markdown fences`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let echo;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      echo = JSON.parse(clean);
    } catch (parseErr) {
      console.error('generate-career-echo parse error:', parseErr);
      return res.status(500).json({ error: 'Failed to parse echo response' });
    }

    res.json({ echo });
  } catch (err) {
    console.error('POST /generate-career-echo error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /add-career-echo
 * Saves a confirmed career echo to the memory record.
 * Once confirmed, the echo is canon — it will appear in Series 2.
 */
router.post('/add-career-echo', requireAuth, async (req, res) => {
  try {
    const { memory_id, content_type, title, description, lala_impact } = req.body;
    if (!memory_id) return res.status(400).json({ error: 'memory_id required' });

    const memory = await StorytellerMemory.findByPk(memory_id);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    memory.career_echo_content_type = content_type;
    memory.career_echo_title        = title;
    memory.career_echo_description  = description;
    memory.career_echo_lala_impact   = lala_impact;
    memory.career_echo_confirmed     = true;
    await memory.save();

    res.json({ memory });
  } catch (err) {
    console.error('POST /add-career-echo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────
// Chapter Draft generation (co-writing feature)
// ────────────────────────────────────────────────

/**
 * POST /generate-chapter-draft
 *
 * Generates 70-85% of a chapter as pending lines.
 * Reads universe context, character profiles, confirmed memories,
 * pain points, chapter brief, venture context, echoes, and previous
 * lines for momentum.
 *
 * Returns lines as pending — author reviews, edits, approves each one.
 */
router.post('/generate-chapter-draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      target_lines = 20,
      // ── venture context fields ───────────────────────────────────────────
      venture_context = '',
      pnos_act: _pnos_act = '',
      incoming_echoes = [],
      active_threads = [],
      // ── alive system fields ──────────────────────────────────────────────
      character_rules = '',
      book_question = '',
      exit_emotion = '',
      exit_emotion_note = '',
    } = req.body;

    if (!book_id || !chapter_id) {
      return res.status(400).json({ error: 'book_id and chapter_id are required' });
    }

    // ── 1. Universe context ──────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── 2. Chapter brief ─────────────────────────────────────────────────
    const chapter = await StorytellerChapter.findByPk(chapter_id, {
      include: [{ model: db.StorytellerBook, as: 'book' }],
    });
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const briefText = [
      chapter.title                   && `Chapter title: ${chapter.title}`,
      chapter.theme                   && `Theme: ${chapter.theme}`,
      chapter.scene_goal              && `Scene goal: ${chapter.scene_goal}`,
      chapter.pov                     && `POV: ${chapter.pov}`,
      chapter.emotional_state_start   && `Emotional state at start: ${chapter.emotional_state_start}`,
      chapter.emotional_state_end     && `Emotional state at end: ${chapter.emotional_state_end}`,
      chapter.chapter_notes           && `Writer notes: ${chapter.chapter_notes}`,
    ].filter(Boolean).join('\n');

    // ── 3. Characters present in this chapter ───────────────────────────
    let charactersText = '';
    if (chapter.characters_present?.length > 0) {
      const chars = await RegistryCharacter.findAll({
        where: { id: chapter.characters_present },
      });
      charactersText = chars.map(c => {
        const name = c.selected_name || c.display_name;
        return [
          `CHARACTER: ${name} (${c.role_type})`,
          c.description    && `  Role: ${c.description}`,
          c.core_belief    && `  Core belief: ${c.core_belief}`,
          c.pressure_type  && `  Pressure type: ${c.pressure_type}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');
    }

    // ── 4. Confirmed memories for this book ─────────────────────────────
    const bookChapters = await StorytellerChapter.findAll({
      where: { book_id },
      attributes: ['id'],
    });
    const chapterIds = bookChapters.map(c => c.id);

    const bookLines = chapterIds.length > 0
      ? await StorytellerLine.findAll({
          where: { chapter_id: chapterIds },
          attributes: ['id'],
        })
      : [];
    const lineIds = bookLines.map(l => l.id);

    const memories = lineIds.length > 0
      ? await StorytellerMemory.findAll({
          where: {
            line_id: lineIds,
            confirmed: true,
            type: ['belief', 'constraint', 'character_dynamic'],
          },
          limit: 20,
          order: [['created_at', 'DESC']],
        })
      : [];

    const memoriesText = memories.length > 0
      ? memories.map(m => `[${m.type.toUpperCase()}] ${m.statement} (${m.source_ref || 'line'})`).join('\n')
      : 'No confirmed memories yet.';

    // ── 5. Pain points for this book ────────────────────────────────────
    const painPoints = lineIds.length > 0
      ? await StorytellerMemory.findAll({
          where: { line_id: lineIds, confirmed: true, type: 'pain_point' },
          limit: 10,
          order: [['created_at', 'DESC']],
        })
      : [];

    const painText = painPoints.length > 0
      ? painPoints.map(m => `[${m.category}] ${m.statement}`).join('\n')
      : 'No confirmed pain points yet.';

    // ── 6. Existing lines in this chapter (for continuity) ───────────────
    const existingLines = await StorytellerLine.findAll({
      where: {
        chapter_id,
        status: ['approved', 'edited'],
      },
      order: [['sort_order', 'ASC']],
    });

    const existingText = existingLines.length > 0
      ? existingLines.map((l, i) => `LINE ${i + 1}: ${l.text}`).join('\n\n')
      : 'No lines written yet — this is the opening of the chapter.';

    const nextIndex = existingLines.length;
    const isOpening = nextIndex === 0;

    // ── 7. Previous chapter last lines (for momentum) ───────────────────
    let previousChapterText = '';
    const previousChapter = await StorytellerChapter.findOne({
      where: { book_id },
      order: [['sort_order', 'DESC']],
      include: [{
        model: StorytellerLine,
        as: 'lines',
        where: { status: ['approved', 'edited'] },
        required: false,
      }],
    });

    if (previousChapter && previousChapter.id !== chapter_id) {
      const lastLines = (previousChapter.lines || [])
        .sort((a, b) => b.sort_order - a.sort_order)
        .slice(0, 5)
        .reverse();
      if (lastLines.length > 0) {
        previousChapterText = `LAST LINES OF PREVIOUS CHAPTER:\n${lastLines.map(l => l.text).join('\n')}`;
      }
    }

    // ── 8. Venture + echo context (new) ──────────────────────────────────
    const ventureBlock = venture_context
      ? `\n═══════════════════════════════════════════════════════\nVENTURE HISTORY & PNOS ACT\n═══════════════════════════════════════════════════════\n${venture_context}\n`
      : '';

    const echoBlock = incoming_echoes.length > 0
      ? `\n═══════════════════════════════════════════════════════\nINCOMING ECHOES (moments planted earlier — weave naturally)\n═══════════════════════════════════════════════════════\n${incoming_echoes.map(e => `• FROM: "${e.source_line_content?.slice(0, 80)}..."\n  PLANTED: ${e.note}\n  SHOULD LAND AS: ${e.landing_note || 'natural resonance'}`).join('\n\n')}\n`
      : '';

    const threadBlock = active_threads.length > 0
      ? `\nACTIVE PLOT THREADS: ${active_threads.join(', ')}\n`
      : '';

    // ── 8b. Alive system blocks ──────────────────────────────────────────
    const characterRulesBlock = character_rules
      ? `\n═══════════════════════════════════════════════════════\nCHARACTER APPEARANCE RULES\n═══════════════════════════════════════════════════════\n${character_rules}\n`
      : '';

    const bookQuestionBlock = book_question
      ? `\n═══════════════════════════════════════════════════════\nBOOK QUESTION LAYER\n═══════════════════════════════════════════════════════\n${book_question}\n`
      : '';

    const exitEmotionBlock = exit_emotion
      ? `\nEXIT EMOTION TARGET: ${exit_emotion}${exit_emotion_note ? ` — ${exit_emotion_note}` : ''}\n`
      : '';

    // ── 9. Build the prompt ───────────────────────────────────────────────
    const prompt = `${universeContext}
${ventureBlock}${echoBlock}${characterRulesBlock}${bookQuestionBlock}
You are co-writing a literary novel with a first-time author. Your job is to generate the next ${target_lines} lines of this chapter as a draft. The author will review every line — approving, editing, or rejecting each one. You are writing 70-85% of the draft. She completes it.

═══════════════════════════════════════════════════════
CHAPTER BRIEF
═══════════════════════════════════════════════════════
${briefText || 'No brief set — write based on character context and momentum.'}
${threadBlock}
${exitEmotionBlock}
═══════════════════════════════════════════════════════
CHARACTERS IN THIS SCENE
═══════════════════════════════════════════════════════
${charactersText || 'No characters assigned — infer from context.'}

═══════════════════════════════════════════════════════
CONFIRMED MEMORIES (what JustAWoman has established)
═══════════════════════════════════════════════════════
${memoriesText}

═══════════════════════════════════════════════════════
PAIN POINTS (documented invisibly — never name them in the text)
═══════════════════════════════════════════════════════
${painText}

${previousChapterText ? `═══════════════════════════════════════════════════════\n${previousChapterText}\n═══════════════════════════════════════════════════════` : ''}

${existingLines.length > 0 ? `═══════════════════════════════════════════════════════
EXISTING LINES IN THIS CHAPTER (continue from here)
═══════════════════════════════════════════════════════
${existingText}` : '═══════════════════════════════════════════════════════\nThis is the OPENING of the chapter — no lines written yet.\n═══════════════════════════════════════════════════════'}

═══════════════════════════════════════════════════════
WRITING RULES — READ CAREFULLY
═══════════════════════════════════════════════════════

VOICE:
- 80% first person (JustAWoman). Direct, self-aware, specific, occasionally funny.
- 15% close third person reflection. More observational, slightly removed.
- 5% Lala proto-voice — DO NOT generate this. It must emerge naturally.
- JustAWoman's voice is NOT polished. She's real. She's direct. She doesn't dress things up.
- She uses specific details — not "I bought courses" but "I bought the $297 course and watched exactly one module."

VENTURE AWARENESS:
- JustAWoman is not on her first attempt. She carries the weight of all previous ventures.
- The doubt is accumulated, not fresh. The hope is harder-won.
- If venture_context was provided, let it inform the texture — not the plot.
- Never explain a venture directly. Let the emotional residue show through specifics.

CHARACTER APPEARANCE RULES:
- If character rules are provided, EVERY character entrance must respect their architectural constraints.
- Do not describe a character appearing in a way that violates their mode or rules.
- The Almost-Mentor is voice-only in Book 1. Digital Products Customer appears only through products/content.

BOOK QUESTION AWARENESS:
- If a book question direction is set (toward/holding/away), let it inform the emotional undertow of the draft.
- "Toward" = hope is quietly building, small wins feel real. "Away" = doubt is winning, the gap between wanting and having widens. "Holding" = suspended tension, neither forward nor back.

EXIT EMOTION:
- If an exit emotion target is set, build the draft so it arrives at that feeling by the final lines.
- Don't name the emotion — embody it through action, image, and rhythm.

ECHO AWARENESS:
- If incoming echoes are provided, try to weave at least one naturally into the draft.
- The reader should feel resonance, not exposition. The echo should land as "of course" not "aha."
- Mark which lines contain echoes in the draft notes.

WHAT MAKES THIS WRITING WORK:
- Specific memory over general statement
- Sensory detail that grounds the scene in a physical moment
- The gap between what she says and what she means
- Humor that comes from honesty, not performance
- Pain that doesn't ask for sympathy — just states what happened

WHAT TO AVOID:
- Generic motivational language
- Neat resolutions — this is a chapter in progress, not a conclusion
- Introducing new characters not established in the registry
- Any reference to pain point categories (comparison_spiral etc) — these are invisible tags
- Lala speaking in full voice — she can flicker at the edges, nothing more
- Overwriting. Short lines breathe better than long ones.

STRUCTURE:
- Generate exactly ${target_lines} lines
- Each line is a unit of prose — a sentence, a short paragraph, or a thought
- Lines should vary in length — some short and punchy, some longer and flowing
- Build momentum across the lines — each one should make the next one necessary
- ${isOpening ? 'This is the chapter opening — ground us in the physical moment first.' : 'Continue directly from the last existing line — no recap, no reset.'}

Respond with ONLY valid JSON. No preamble. No markdown fences.

{
  "lines": [
    { "text": "line text here", "sort_order": ${nextIndex} },
    { "text": "line text here", "sort_order": ${nextIndex + 1} },
    ...
  ],
  "draft_notes": "2-3 sentences on what you were trying to do with this draft — what emotional arc you were building, what you left open for the author to complete. Note any echoes you wove in."
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
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
      console.error('generate-chapter-draft parse error:', e);
      return res.status(500).json({ error: 'Failed to parse draft response' });
    }

    // ── 10. Save lines to DB as pending ──────────────────────────────────
    const savedLines = [];
    for (const line of result.lines) {
      const saved = await StorytellerLine.create({
        chapter_id,
        text:        line.text,
        status:      'pending',
        sort_order:  line.sort_order,
        source_tags: { source_type: 'ai_draft', source_ref: 'chapter-draft-v2' },
      });
      savedLines.push(saved);
    }

    res.json({
      lines:       savedLines,
      draft_notes: result.draft_notes,
      count:       savedLines.length,
    });

  } catch (err) {
    console.error('POST /generate-chapter-draft error:', err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;
