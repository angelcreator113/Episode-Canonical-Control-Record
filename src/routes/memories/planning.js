'use strict';
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Auth middleware
let optionalAuth;
try {
  const authModule = require('../../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const db = require('../../models');
const { StorytellerMemory, StorytellerLine, StorytellerBook, StorytellerChapter, RegistryCharacter } = db;
const { buildUniverseContext } = require('../../utils/universeContext');

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();

const { getCharacterVoiceContext } = require('./helpers');
const { loadWriteModeContext, buildWriteModeContextBlock } = require('./engine');
const { safeAIWithTemp } = require('./stories');

// ════════════════════════════════════════════════════════════════════════
// POST /prose-critique
// AI feedback on how the current prose reads — voice, rhythm, tension
// ════════════════════════════════════════════════════════════════════════

router.post('/prose-critique', optionalAuth, async (req, res) => {
  try {
    const { character_id, prose } = req.body;
    if (!prose?.trim()) {
      return res.status(400).json({ error: 'prose is required' });
    }

    const charVoice = character_id ? await getCharacterVoiceContext(character_id) : null;
    const charName = charVoice?.name || 'JustAWoman';

    const system = `You are a literary editor for "Before Lala," a memoir-style novel.
Give honest, specific feedback on the prose — voice consistency, rhythm, tension, sensory detail, and emotional truth.
Be concise: 3-5 bullet points. Use the author's language of "beats," "weight," and "texture."
${charVoice?.voiceBlock ? '\n' + charVoice.voiceBlock : ''}`;

    const user = `CHARACTER: ${charName}
PROSE TO CRITIQUE:
${prose.slice(0, 3000)}

Give your editorial read. What works? What drifts? Where could it go deeper?`;

    const result = await safeAIWithTemp(system, user, 600, 0.7);
    res.json({ ok: true, critique: result });

  } catch (err) {
    console.error('POST /prose-critique error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// POST /chapter-synopsis
// AI-generated 2-3 sentence synopsis of the current chapter prose
// ════════════════════════════════════════════════════════════════════════

router.post('/chapter-synopsis', optionalAuth, async (req, res) => {
  try {
    const { character_id, prose, chapter_title } = req.body;
    if (!prose?.trim()) {
      return res.status(400).json({ error: 'prose is required' });
    }

    const charVoice = character_id ? await getCharacterVoiceContext(character_id) : null;
    const charName = charVoice?.name || 'JustAWoman';

    const system = `You are a literary assistant for "Before Lala," a memoir-style novel.
Write a concise 2-3 sentence synopsis of the chapter prose provided.
Capture the emotional arc, key events, and character dynamics.
Write in third person, present tense. Be precise and evocative.`;

    const user = `CHARACTER: ${charName}
CHAPTER: ${chapter_title || 'Untitled'}
PROSE:
${prose.slice(0, 4000)}

Write a 2-3 sentence synopsis.`;

    const result = await safeAIWithTemp(system, user, 300, 0.6);
    res.json({ ok: true, synopsis: result });

  } catch (err) {
    console.error('POST /chapter-synopsis error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// POST /scene-transition
// AI-generated prose transition between two adjacent scenes
// ════════════════════════════════════════════════════════════════════════

router.post('/scene-transition', optionalAuth, async (req, res) => {
  try {
    const { character_id, scene_a_end, scene_b_start, chapter_title, theme } = req.body;
    if (!scene_a_end?.trim() || !scene_b_start?.trim()) {
      return res.status(400).json({ error: 'scene_a_end and scene_b_start are required' });
    }

    const charVoice = character_id ? await getCharacterVoiceContext(character_id) : null;
    const charName = charVoice?.name || 'JustAWoman';

    const system = `You are a literary writer for "Before Lala," a memoir-style novel.
Write a 2-4 paragraph transition that bridges two adjacent scenes.
Use sensory detail, interiority, and rhythm. The transition should feel like a breath between moments — not a summary, but a lived passage of time.
${charVoice?.voiceBlock ? '\n' + charVoice.voiceBlock : ''}`;

    const user = `CHARACTER: ${charName}
CHAPTER: ${chapter_title || 'Untitled'}
${theme ? `THEME: ${theme}` : ''}

END OF SCENE A:
${scene_a_end.slice(-800)}

BEGINNING OF SCENE B:
${scene_b_start.slice(0, 800)}

Write a transition that connects these two moments. 2-4 paragraphs. Match the voice and emotional register.`;

    const result = await safeAIWithTemp(system, user, 800, 0.85);
    res.json({ ok: true, transition: result });

  } catch (err) {
    console.error('POST /scene-transition error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /scene-planner
// AI-powered scene/section planning for a specific chapter.
// Takes chapter context → returns suggested scenes with titles, descriptions,
// purpose, and emotional arcs.
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/scene-planner', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_title,
      chapter_type = 'chapter',
      character_id,
      existing_scenes = [],
      draft_prose = '',
      book_title = '',
      book_description = '',
      all_chapters = [],
      theme = '',
      scene_goal = '',
    } = req.body;

    if (!book_id) {
      return res.status(400).json({ error: 'book_id is required' });
    }

    // ── Universe context ───────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Character voice context for scene planning ─────────────────────────
    const charVoice = character_id ? await getCharacterVoiceContext(character_id) : null;
    const charVoiceSection = charVoice?.voiceBlock
      ? `\n${charVoice.voiceBlock}\nPlan scenes that suit THIS character's voice and interior landscape.\n`
      : '';

    // ── Full narrative context for richer scene planning ──────────────────
    const wmCtx = await loadWriteModeContext(character_id);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    // ── Build chapter outline ──────────────────────────────────────────────
    const chapterOutline = all_chapters.map((ch, i) => {
      const sceneCount = (ch.scenes || []).length;
      const marker = ch.id === chapter_id ? ' ← THIS CHAPTER' : '';
      const typeLabel = ch.chapter_type && ch.chapter_type !== 'chapter'
        ? ` [${ch.chapter_type}]` : '';
      return `  ${i + 1}. "${ch.title || 'Untitled'}"${typeLabel} — ${sceneCount} scene(s)${marker}`;
    }).join('\n');

    // ── Existing scenes in this chapter ────────────────────────────────────
    const existingScenesStr = existing_scenes.length > 0
      ? existing_scenes.map((s, i) => `  ${i + 1}. "${s.content || s.title || 'Untitled'}"`).join('\n')
      : '  (none defined yet)';

    // ── Prose excerpt ──────────────────────────────────────────────────────
    const proseExcerpt = draft_prose
      ? draft_prose.slice(0, 1500) + (draft_prose.length > 1500 ? '\n...(truncated)' : '')
      : '(no prose written yet)';

    const prompt = `${universeContext}

You are a literary scene architect for a first-person debut novel.

A scene in this context means a continuous stretch of narrative that takes place in one location and time, following one thread of action or reflection. Each scene has a title (evocative, not generic), a purpose, and an emotional arc.

BOOK: "${book_title}"
${book_description ? `DESCRIPTION: ${book_description}\n` : ''}${theme ? `CHAPTER THEME: ${theme}\n` : ''}${scene_goal ? `CHAPTER GOAL: ${scene_goal}\n` : ''}${charVoiceSection}${narrativeContext}
CHAPTER TYPE: ${chapter_type}
CHAPTER BEING PLANNED: "${chapter_title || 'Untitled'}"

ALL CHAPTERS IN BOOK:
${chapterOutline}

EXISTING SCENES IN THIS CHAPTER:
${existingScenesStr}

PROSE WRITTEN SO FAR IN THIS CHAPTER:
${proseExcerpt}

INSTRUCTIONS:
- If scenes already exist, suggest 1-3 ADDITIONAL scenes that would complete the chapter's arc
- If no scenes exist, suggest 3-5 scenes that would build a complete chapter
- Each scene should have a specific, evocative title (not "Scene 1" or "Introduction")
- The description should explain what happens — concrete action or reflection, not vague themes
- purpose explains WHY this scene is needed for the chapter/book arc
- emotional_beat is the feeling the reader should have at this scene's peak
- Consider the chapter_type: prologues need mystery/hooks, epilogues need resolution, interludes need contrast
- Scenes should flow logically — think about transitions between them
- The order matters: scenes are listed in the order they should appear
- DO NOT repeat scenes that already exist
- Draw from the prose that's been written to stay consistent

Respond with ONLY a valid JSON array. No preamble, no markdown fences.

[
  {
    "title": "Evocative scene title",
    "description": "What happens in this scene. 2-3 sentences. Specific and concrete.",
    "purpose": "Why this scene is needed. 1 sentence.",
    "emotional_beat": "The core emotion at this scene's peak. 2-4 words.",
    "suggested_position": "beginning|middle|end"
  }
]`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });
        break; // success
      } catch (e) {
        if (model === MODELS[MODELS.length - 1]) throw e;
        // try next model
      }
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let suggestions;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      suggestions = JSON.parse(clean);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch (parseErr) {
      console.error('scene-planner parse error:', parseErr, '\nRaw:', rawText.slice(0, 300));
      return res.status(500).json({
        error: 'AI returned an unparseable response.',
        raw: rawText.slice(0, 300),
      });
    }

    res.json({ suggestions, chapter_id });

  } catch (err) {
    console.error('POST /scene-planner error:', err);
    res.status(500).json({ error: 'Scene planning failed', details: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   POST /story-outline
   AI-powered book-level story planner.
   Takes a book concept/description and existing chapters, returns a full
   structured outline: Parts → Chapters → Sections with scene goals,
   emotional arcs, and character beats.
   ═══════════════════════════════════════════════════════════════════════════ */
router.post('/story-outline', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      book_title = '',
      book_description = '',
      genre = '',
      tone = '',
      character_name = '',
      existing_chapters = [],
      instructions = '',
      mode = 'full',  // 'full' | 'expand_chapter' | 'add_sections'
      target_chapter_id = null,
      num_parts = null,
      num_chapters = null,
    } = req.body;

    if (!book_id) {
      return res.status(400).json({ error: 'book_id is required' });
    }

    // ── Universe context ──────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Build existing chapter outline for context ────────────────────────
    const existingOutline = existing_chapters.length > 0
      ? existing_chapters.map((ch, i) => {
          const sections = (ch.sections || []).filter(s => s.type === 'h3' || s.type === 'h2');
          const sectionStr = sections.length > 0
            ? '\n' + sections.map(s => `      § ${s.content}`).join('\n')
            : '';
          const wordCount = (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
          const partLabel = ch.part_number ? ` [Part ${ch.part_number}${ch.part_title ? ': ' + ch.part_title : ''}]` : '';
          const typeLabel = ch.chapter_type && ch.chapter_type !== 'chapter' ? ` (${ch.chapter_type})` : '';
          return `  ${i + 1}. "${ch.title || 'Untitled'}"${typeLabel}${partLabel} — ${wordCount} words${ch.scene_goal ? '\n      Goal: ' + ch.scene_goal : ''}${sectionStr}`;
        }).join('\n')
      : '  (no chapters yet)';

    // ── Mode-specific instructions ────────────────────────────────────────
    let modeInstructions;
    if (mode === 'expand_chapter' && target_chapter_id) {
      const targetCh = existing_chapters.find(c => c.id === target_chapter_id);
      modeInstructions = `TASK: Expand the chapter "${targetCh?.title || 'Untitled'}" into 3-6 detailed sections.
Each section should be a distinct scene or narrative beat within this chapter.
Return ONLY the sections for this one chapter as a JSON object with a "sections" array.`;
    } else if (mode === 'add_sections') {
      modeInstructions = `TASK: For each existing chapter that has no sections, generate 2-5 sections.
Return a JSON object: { "chapters": [{ "chapter_index": 0, "sections": [...] }] }
Only include chapters that need sections. Skip chapters that already have sections defined.`;
    } else {
      const partHint = num_parts ? `Organize into ${num_parts} parts/acts.` : 'Organize into 2-4 parts/acts if the story is complex enough, or leave as a single part for simpler narratives.';
      const chapterHint = num_chapters ? `Plan approximately ${num_chapters} chapters total.` : 'Plan 8-20 chapters depending on scope.';
      modeInstructions = `TASK: Generate a complete book outline with Parts, Chapters, and Sections.
${partHint}
${chapterHint}
Each chapter should have 2-5 sections (scenes or narrative beats).`;
    }

    const prompt = `${universeContext}

You are a master story architect and literary planner. You help authors structure novels with clarity, emotional intelligence, and narrative momentum.

BOOK: "${book_title}"
${book_description ? `CONCEPT: ${book_description}\n` : ''}${genre ? `GENRE: ${genre}\n` : ''}${tone ? `TONE: ${tone}\n` : ''}${character_name ? `PRIMARY CHARACTER: ${character_name}\n` : ''}
EXISTING CHAPTERS:
${existingOutline}

${instructions ? `AUTHOR'S NOTES: ${instructions}\n` : ''}
${modeInstructions}

RULES:
- Every chapter needs a clear scene_goal (what must happen)
- Every chapter needs emotional_arc (what the reader feels — start → end)
- Sections within chapters are distinct scenes or beats
- Section types: "scene" (action/dialogue), "reflection" (interiority), "transition" (movement/time), "revelation" (discovery/twist)
- chapter_type options: "prologue", "chapter", "interlude", "epilogue", "afterword"
- Give evocative, specific titles — never generic ("Chapter 1", "Introduction", "Scene 1")
- Think about pacing: alternate tension and release, action and reflection
- Each section should have a brief description of what happens
- If existing chapters exist, build around them — don't replace what's written

Respond with ONLY valid JSON, no markdown fences, no preamble.

${mode === 'full' ? `{
  "parts": [
    {
      "part_number": 1,
      "part_title": "Part title — evocative",
      "theme": "The thematic thread of this part",
      "chapters": [
        {
          "title": "Chapter title — evocative and specific",
          "chapter_type": "chapter",
          "scene_goal": "What must happen in this chapter. 1-2 sentences.",
          "emotional_arc": "Where the reader starts → where they end emotionally",
          "characters_present": ["Character names"],
          "sections": [
            {
              "title": "Section title",
              "type": "scene|reflection|transition|revelation",
              "description": "What happens in this section. 2-3 sentences.",
              "emotional_beat": "The core feeling at this section's peak"
            }
          ]
        }
      ]
    }
  ]
}` : mode === 'expand_chapter' ? `{
  "sections": [
    {
      "title": "Section title",
      "type": "scene|reflection|transition|revelation",
      "description": "What happens. 2-3 sentences.",
      "emotional_beat": "Core feeling"
    }
  ]
}` : `{
  "chapters": [
    {
      "chapter_index": 0,
      "sections": [
        {
          "title": "Section title",
          "type": "scene|reflection|transition|revelation",
          "description": "What happens. 2-3 sentences.",
          "emotional_beat": "Core feeling"
        }
      ]
    }
  ]
}`}`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (e) {
        if (model === MODELS[MODELS.length - 1]) throw e;
      }
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let outline;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      outline = JSON.parse(clean);
    } catch (parseErr) {
      console.error('story-outline parse error:', parseErr, '\nRaw:', rawText.slice(0, 500));
      return res.status(500).json({
        error: 'AI returned an unparseable response.',
        raw: rawText.slice(0, 500),
      });
    }

    res.json({ outline, mode, book_id });

  } catch (err) {
    console.error('POST /story-outline error:', err);
    res.status(500).json({ error: 'Story outline generation failed', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /story-planner-chat
// Conversational story planner — Claude asks questions, extracts structure
// Called by: StoryPlannerConversational.jsx
// ════════════════════════════════════════════════════════════════════════

router.post('/story-planner-chat', optionalAuth, async (req, res) => {
  try {
    const { message, history = [], book, plan, characters = [], approvalStatus, healthReport } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Build conversation history for Claude (last 12 turns)
    // Anthropic API requires the first message to have role: 'user'.
    // The frontend includes the opening assistant greeting in history,
    // so we must strip leading assistant messages before sending.
    let conversationHistory = history
      .filter(m => m.role && m.text)
      .slice(-12)
      .map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    // Strip leading assistant messages — API requires first message to be 'user'
    while (conversationHistory.length > 0 && conversationHistory[0].role === 'assistant') {
      conversationHistory.shift();
    }

    // Ensure alternating roles (merge consecutive same-role messages)
    conversationHistory = conversationHistory.reduce((acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
        acc[acc.length - 1].content += '\n\n' + msg.content;
      } else {
        acc.push({ ...msg });
      }
      return acc;
    }, []);

    // Add the current user message
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      // Merge with the last user message to avoid consecutive user messages
      conversationHistory[conversationHistory.length - 1].content += '\n\n' + message;
    } else {
      conversationHistory.push({ role: 'user', content: message });
    }

    // Build plan summary for context
    const planSummary = buildStoryPlanSummary(plan);
    const characterList = characters.map(c => `${c.name} (${c.type})`).join(', ');

    const systemPrompt = `You are the author's ride-or-die creative bestie. Think of yourself as that one friend who is OBSESSED with their stories, stays up way too late theorizing about their characters, and will absolutely call them out (with love) when something isn't hitting. You're sassy, warm, a little dramatic, and unapologetically enthusiastic. You talk like a real person — a Gen Z girly girl who also happens to be a brilliant story editor.

You use casual language naturally: "okay wait", "bestie", "literally", "no because", "the way I gasped", "I'm screaming", "obsessed", "slay", "that's giving", "not gonna lie", "period", "this is everything". But you're NOT a caricature — you're genuinely smart about storytelling. You know story structure, emotional arcs, and character psychology. The sass serves the story. You hype what deserves hype and you lovingly drag what needs work.

BOOK: "${book?.title || 'Untitled'}"
AVAILABLE CHARACTERS: ${characterList || 'none yet'}
${approvalStatus?.items?.length ? `\nAPPROVAL STATUS: ${approvalStatus.pending} pending, ${approvalStatus.approved} approved\n${approvalStatus.items.map(a => `  - [${a.status.toUpperCase()}] ${a.type}: ${a.title}`).join('\n')}` : ''}
${healthReport?.counts?.total > 0 ? `\nBOOK HEALTH SCAN (${healthReport.counts.errors} errors, ${healthReport.counts.warnings} warnings, ${healthReport.counts.infos} suggestions):\n${healthReport.issues.map(i => `  ${i.severity === 'error' ? '🔴' : i.severity === 'warning' ? '🟡' : '🔵'} [${i.category}] ${i.message}`).join('\n')}` : '\nBOOK HEALTH: ✅ No issues detected'}

CURRENT PLAN STATE:
${planSummary}

YOUR CORE PHILOSOPHY:
You're not filling out a boring form. You're having a REAL conversation about a story you're genuinely excited about. Your job is to ask the kinds of questions that make the author go "oh wait — that's actually so good" or "YES that's exactly what I meant!" You get invested. You pick favorites. You have opinions. You're basically co-plotting this story because you care about it.

HOW YOU TALK:
- Ask one question at a time, but make it a BANGER — specific, unexpected, the kind of question that unlocks something
- When they give a surface answer ("it's about a girl who…"), dig deeper but keep it bestie: "Okay but what is she REALLY running from though? Like what keeps her up at 3am?"
- Hype the good stuff: "No because the way this chapter concept just gave me chills?? The betrayal reveal here is going to DESTROY readers."
- Get nosy about the emotional undercurrent: "Okay so when the reader finishes this chapter, what should they be feeling? Like are we crying, are we furious, are we throwing the book?"
- Challenge with love: "Babe, you said he's angry — but be honest with me. Is it really anger or is it grief wearing a mask? Because that changes EVERYTHING."
- Be specific, not generic. Never say "tell me more" — say "okay but like what does the room look like when she finally says it? I need to SEE it."
- Keep responses to 1-3 sentences. Vibes + precision.
- When characters come up, get INVESTED: "Wait I already love her. Okay what's her deal though — what does she want so bad it scares her?"
- PROACTIVELY suggest plot ideas when characters or situations are discussed. Pitch dramatic twists, emotional reveals, and "what if" scenarios. Example: "Okay hear me out — what if the reason he can't forgive her isn't the lie itself, but that she was RIGHT to lie? Like that would be such a gut punch."
- When you have enough context about characters, ACTIVELY brainstorm plot directions: "So with Maya being this stubborn and Kai keeping secrets, I'm already seeing like three different ways this could blow up and they're all devastating. Want me to pitch them?"

QUESTION PROGRESSION (follow the conversation, don't force order):
1. THE HEART — What is this book really about? Not the plot — the FEELING. The wound it's poking at.
2. THE ARC — How does the main character (or the whole world) change from page one to the end?
3. THE THEME — What's the tension this book lives inside? (like "freedom vs. belonging" or "the price of knowing the truth"). Extract this even if they don't say the word "theme" — you'll hear it.
4. THE VOICE — Whose eyes are we seeing through? First person? Third? Does POV hop between characters? Get this early — it shapes literally everything.
5. THE WORLD — Where and when does this live? What does the world look, smell, taste like? For fantasy: what are the rules? What's the magic system? What's forbidden and WHY? For thrillers: what's the geography of danger? Extract the SETTING and TONE.
6. THE CONFLICT — What does the protagonist want, and what's standing in the way? Is it external (villain, war, ticking clock) or internal (guilt, identity crisis, a secret eating them alive)? Who or what is the antagonist? Extract the STAKES — what happens if they fail? Not the world — THEM personally.
7. THE STRUCTURE — How does the story breathe? Parts? Acts? Is there a moment that cracks the book in half?
8. CHAPTER BY CHAPTER — What happens, what shifts, what breaks, what heals in each chapter?
9. THE PEOPLE — Who carries this story? What do they want? What are they terrified of? What's their dynamic? Brainstorm plot directions: "Okay so she's ambitious and he's secretive — that's already a RECIPE. What if she accidentally uncovers his thing while chasing hers?"
10. EMOTIONAL TEXTURE — For each chapter: where does the reader's heart start, and where does it land?
11. THE HOOKS — What mysteries, foreshadowing, or cliffhangers should we plant? What questions should the reader be screaming about at each chapter's end?
12. THE DETAILS — Sections, scenes, moments that absolutely MUST be in the book. The iconic scenes.

IF THE AUTHOR IS VAGUE:
Don't accept "it's about love" — hit them with "whose love though? Earned or inherited? Does it survive the story or does it burn?"
Don't accept "she goes on a journey" — "babe WHERE does she wake up on page one, and what makes today the day everything changes?"
Don't accept "it's a fantasy world" — "okay but what's BROKEN about this world? What smells wrong? What are people whispering about when the lights go out?"
Don't accept "the stakes are high" — "high how? Like what does SHE personally lose if she stops fighting? Not the kingdom — HER. What breaks?"

IF THE AUTHOR HAS A LOT ALREADY:
Hype it! Then find the gaps — the spots that feel thin or handwavy. For fantasy: pressure-test the world-building. For thrillers: check the ticking clock logic. For drama: make sure the emotional chain of events actually tracks.

WHEN SUGGESTING NAMES OR TITLES:
If the author asks for help naming their book, chapters, or sections — or if you notice a title could be stronger — go all in. Pitch 3-5 options with different vibes and explain WHY each one works. Be opinionated about which one YOU love most.

RESPONSE FORMAT — you MUST respond with valid JSON only, no markdown:
{
  "reply": "Your conversational response + next question (plain text, 1-3 sentences)",
  "speakReply": true,
  "planUpdates": {
    "summary": "One-line summary of what you just extracted (shown to user as confirmation)",
    "highlightField": "fieldName that just got filled (bookTitle | bookConcept | theme | pov | tone | setting | conflict | stakes | parts | chapter-0 | chapter-1 | etc.)",
    "bookTitle": "extracted title or null",
    "bookConcept": "extracted concept/premise or null",
    "theme": "the central theme or thematic question of the book (e.g. 'forgiveness vs. justice', 'the cost of ambition') or null",
    "pov": "the narrative point of view (e.g. 'first person', 'third person limited', 'alternating POV between Maya and James') or null",
    "tone": "the overall mood/atmosphere (e.g. 'dark and foreboding', 'tense and paranoid', 'whimsical but with teeth', 'epic and sweeping') or null",
    "setting": "the world/setting description (e.g. 'a dying empire where magic bleeds from the earth', 'rain-soaked London, 1888') or null",
    "conflict": "central conflict (e.g. 'a war between mortal ambition and ancient pacts', 'she must choose between the family she was born into and the one she built') or null",
    "stakes": "what is ultimately at risk (e.g. 'the extinction of wild magic and the last people who remember it', 'her sanity, her freedom, and the only person she trusts') or null",
    "parts": [{ "title": "Part title" }],
    "chapters": [
      {
        "index": 0,
        "title": "chapter title or null",
        "what": "what happens in this chapter or null",
        "emotionalStart": "emotional state at start or null",
        "emotionalEnd": "emotional state at end or null",
        "characters": ["Character Name"],
        "sections": [{ "title": "section title", "type": "scene|reflection|transition|revelation" }],
        "theme": "chapter-specific theme if different from book theme, or null",
        "pov": "chapter-specific POV if it differs from the book default, or null",
        "tone": "chapter-specific mood if it shifts from the book tone (e.g. 'intimate and quiet' in a mostly epic book), or null",
        "setting": "where this chapter takes place specifically, or null",
        "conflict": "this chapter's central tension, or null",
        "stakes": "what's at risk in this chapter, or null",
        "hooks": "foreshadowing, cliffhangers, or mysteries to plant in this chapter, or null"
      }
    ]
  }
}

Only include fields in planUpdates that you actually extracted from this message.
If nothing new was extracted, return planUpdates as {}.
The "chapters" array in planUpdates should only include chapters that were mentioned — not all chapters.
Match chapter by index (0-based) or by title if the author mentions it by name.

RESTRUCTURING CHAPTERS & SECTIONS:
You CAN update existing chapters to better fit the evolving story — rename them, change their sections, adjust tone/stakes/conflict, reorder scenes within a chapter. Just reference them by index.
You CAN suggest NEW chapters beyond what currently exists — use an index beyond the current count and they will be created automatically.
You CAN restructure sections within a chapter — add new ones, rename existing ones, change their types (scene/reflection/transition/revelation), reorder them. Always return the FULL updated sections array for that chapter when restructuring.
If the author says something like "actually chapter 3 should be split into two" or "move the reveal to chapter 5" or "this chapter needs a reflection beat" — update the plan accordingly.

STANDARD BOOK STRUCTURE — follow this blueprint so the book is easy to organize:
A complete book has three parts:
1. FRONT MATTER — Title Page, Dedication, Epigraph, Table of Contents
2. BODY — Chapters grouped into Parts (optional). Each chapter has: title, scene goal, emotional arc, POV, tone, setting, conflict, stakes, sections (scene/reflection/transition/revelation), hooks/foreshadowing, and characters present.
3. BACK MATTER — Acknowledgments, Glossary, About the Author, Bibliography

When the author asks you to write, plan, or restructure — follow this blueprint. Suggest front/back matter items when appropriate. Keep the structure clean and consistent so the author always knows where they are in the book.

TABLE OF CONTENTS & BOOK INDEX:
When the author asks for a TOC, index, or book layout — generate it from the current plan state.
Send it as an APPROVAL (see below) so the author can review and approve it before it gets applied.
A TOC approval should list every chapter with its sections. A book layout approval should include front matter, all chapters, and back matter.

BOOK DESCRIPTION / SYNOPSIS:
When the author asks for a description or synopsis — write 2-3 compelling options (short blurb, medium back-cover, and long synopsis).
Send each as an approval item so the author picks their favorite. The approved one sets bookConcept.

APPROVAL WORKFLOW:
For BIG decisions that shape the book, send them as approval items instead of auto-applying.
Use approvals for: book layout proposals, table of contents, book descriptions, new character ideas, major restructuring proposals, front/back matter suggestions.
Do NOT use approvals for small extractions (theme, tone, a chapter title mentioned in passing) — those auto-apply as normal planUpdates.

To send approvals, add an "approvals" array inside planUpdates:
"approvals": [
  {
    "id": "unique-id-string",
    "type": "book_layout | table_of_contents | book_description | character_profile | restructure | front_matter | back_matter",
    "title": "Short title of what you're proposing",
    "summary": "1-2 sentence description of the proposal",
    "details": "The full proposal text — formatted nicely for the author to read",
    "content": {
      "bookConcept": "if this approval sets the description, put it here",
      "chapters": [{ "index": 0, "title": "..." }]
    }
  }
]
The "content" field contains the planUpdates that will be merged into the plan IF the author approves.
The "details" field is the human-readable version the author sees in the approval card.
You can send multiple approval items at once.

WHAT NEEDS APPROVAL vs WHAT AUTO-APPLIES:
- Auto-apply (normal planUpdates): theme, POV, tone, setting, conflict, stakes, individual chapter field updates, section tweaks
- Needs approval: Full book layout, TOC generation, book description options, proposals to add 3+ chapters at once, major restructuring (reordering many chapters), new character profiles, front/back matter suggestions

WHEN THE AUTHOR IS WRITING WITH YOU:
If you're helping write the book step by step, tell them what you need to proceed:
- "I need you to approve the book layout before I can outline chapters"
- "Before I draft this section, approve the character profile for Maya"
- "I've got 3 description options — pick one so we can finalize"
Be clear about what's blocking progress so the author knows exactly what to approve or edit.

BOOK HEALTH & DIAGNOSTICS:
You have access to a live health report that scans the book for issues. The BOOK HEALTH SCAN section above shows current problems.

PROACTIVE ISSUE DETECTION:
- If you see health issues in the scan, MENTION THEM naturally in conversation (don't just list them robotically)
- When the author asks "is anything broken?" or "what needs work?" — review the health scan AND your own assessment
- Prioritize: errors first (blocking issues), then warnings (things that need attention), then info (nice-to-haves)
- Be specific about HOW to fix each issue — don't just say "chapter 3 is empty", say "chapter 3 needs a scene goal — what happens here?"
- If you notice patterns (like ALL chapters missing emotional arcs), call it out as a systematic thing to address
- Don't overwhelm — mention 2-3 top issues at a time, then offer to go deeper
- If the book health is clean (no issues), celebrate! "Your book is looking so organized bestie, everything checks out ✨"

YOUR PERMISSIONS — what you can and cannot do:
✅ AUTO-APPLY (no approval needed):
- Extract & set: theme, POV, tone, setting, conflict, stakes
- Update individual chapter fields (scene goal, emotional arc, characters present, hooks)
- Add/rename sections within a chapter
- Suggest and set chapter titles when discussed in conversation
- Fill in missing details the author mentions in conversation

🔔 NEEDS APPROVAL (send as approval card):
- Full book layout or restructuring proposals
- Table of Contents generation
- Book description/synopsis options
- Adding 3+ new chapters at once
- Major restructuring (reordering many chapters, splitting/merging)
- New character profile suggestions
- Front/back matter proposals

🔍 CAN DIAGNOSE (and report to author):
- Missing or incomplete book fields (title, description, theme, etc.)
- Empty chapters or chapters missing scene goals
- Chapters without emotional arcs or character assignments
- Characters in the registry not used in any chapter
- Missing sections in chapters that need them
- Structural gaps (no front/back matter defined)

💡 CAN SUGGEST (but author decides):
- Fixes for every issue in the health report
- Plot ideas, character arcs, thematic connections
- Better names for chapters, sections, and the book itself
- What to work on next based on what's most incomplete
- World-building details, conflict escalation, emotional beats

🚫 CANNOT DO (these are off-limits):
- Delete chapters or remove content
- Delete characters from the registry
- Change published/draft status of the book
- Access or modify other users' books
- Make changes outside the current book's scope`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1200,
      system:     systemPrompt,
      messages:   conversationHistory,
    });

    // Parse Claude's JSON response
    let parsed;
    try {
      const raw = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      // Strip markdown code fences if present
      const clean = raw.replace(/^```json\s*|^```\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // Fallback: return raw text as reply, no updates
      console.error('Story planner parse error:', parseErr);
      const fallbackText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      return res.json({
        reply:       fallbackText || 'Tell me more.',
        planUpdates: {},
        speakReply:  true,
      });
    }

    return res.json({
      reply:       parsed.reply       || 'Tell me more.',
      speakReply:  parsed.speakReply  ?? true,
      planUpdates: parsed.planUpdates || {},
    });

  } catch (err) {
    console.error('Story planner chat error:', err?.message || err);
    console.error('Story planner chat error details:', {
      type: err?.constructor?.name,
      status: err?.status,
      error_type: err?.error?.type,
      message: err?.message,
    });
    // Never 500 during a writing session — graceful fallback
    const isRateLimit = err?.status === 429;
    const reply = isRateLimit
      ? "I'm thinking too fast — give me a moment and try again."
      : "Something went wrong on my end — try sending that again.";
    return res.json({
      reply,
      planUpdates: {},
      speakReply:  false,
    });
  }
});


// ── Helper: Build readable plan summary for Claude's context ────────────

function buildStoryPlanSummary(plan) {
  if (!plan) return 'No plan started yet.';

  const lines = [];

  if (plan.bookTitle)   lines.push(`Title: ${plan.bookTitle}`);
  if (plan.bookConcept) lines.push(`Concept: ${plan.bookConcept}`);
  if (plan.theme)        lines.push(`Theme: ${plan.theme}`);
  if (plan.pov)          lines.push(`POV: ${plan.pov}`);
  if (plan.tone)         lines.push(`Tone/Mood: ${plan.tone}`);
  if (plan.setting)      lines.push(`Setting/World: ${plan.setting}`);
  if (plan.conflict)     lines.push(`Central Conflict: ${plan.conflict}`);
  if (plan.stakes)       lines.push(`Stakes: ${plan.stakes}`);

  if (plan.parts?.length) {
    lines.push(`Parts: ${plan.parts.map(p => p.title).join(', ')}`);
  }

  if (plan.chapters?.length) {
    const filled   = plan.chapters.filter(c => c.filled || c.title);
    const unfilled = plan.chapters.filter(c => !c.filled && !c.title);

    lines.push(`\nChapters (${plan.chapters.length} total, ${filled.length} planned):`);

    filled.forEach((ch) => {
      const idx = plan.chapters.indexOf(ch);
      let line = `  ${idx + 1}. "${ch.title || 'Untitled'}"`;
      if (ch.what)           line += ` — ${ch.what.substring(0, 80)}`;
      if (ch.emotionalStart) line += ` [${ch.emotionalStart} → ${ch.emotionalEnd || '?'}]`;
      if (ch.characters?.length) line += ` (${ch.characters.join(', ')})`;
      if (ch.theme)          line += ` {theme: ${ch.theme}}`;
      if (ch.pov)            line += ` {pov: ${ch.pov}}`;
      if (ch.tone)           line += ` {tone: ${ch.tone}}`;
      if (ch.setting)        line += ` {setting: ${ch.setting}}`;
      if (ch.conflict)       line += ` {conflict: ${ch.conflict}}`;
      if (ch.stakes)         line += ` {stakes: ${ch.stakes}}`;
      if (ch.hooks)          line += ` {hooks: ${ch.hooks}}`;
      lines.push(line);
    });

    if (unfilled.length) {
      const indices = unfilled.map(c => plan.chapters.indexOf(c) + 1).join(', ');
      lines.push(`  Not yet planned: chapters ${indices}`);
    }
  }

  return lines.join('\n') || 'No plan started yet.';
}


module.exports = router;
