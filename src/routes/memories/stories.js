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
const { StorytellerLine, RegistryCharacter } = db;
const { buildUniverseContext: _buildUniverseContext } = require('../../utils/universeContext');

let _buildArcContext, _buildArcContextPromptSection, _updateArcTracking;
try {
  ({ buildArcContext: _buildArcContext, buildArcContextPromptSection: _buildArcContextPromptSection, updateArcTracking: _updateArcTracking } = require('../../services/arcTrackingService'));
} catch { _buildArcContext = null; _buildArcContextPromptSection = null; _updateArcTracking = null; }

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();

const { getCharacterVoiceContext } = require('./helpers');
const { loadWriteModeContext, buildWriteModeContextBlock } = require('./engine');

// ═══════════════════════════════════════════════════════════════════════════════
// POST /voice-to-story
// Spoken words → story prose in JustAWoman's voice
// ═══════════════════════════════════════════════════════════════════════════════

const WRITE_MODE_ACT_VOICE = {
  act_1: {
    belief: 'If I find the right niche, everything will click.',
    voice:  'Raw. Eager. Still hopeful. She tries things with full belief, then quietly stops. Sentences cycle and restart. Not yet aware of the pattern.',
    tense:  'Present or close-past — the wound is fresh.',
  },
  act_2: {
    belief: 'Maybe I\'m just not meant for this. Maybe I\'m delusional.',
    voice:  'Heavier. Slower. Interior monologue rising. Shorter sentences when doubt peaks. The comparison spiral is loudest here.',
    tense:  'Interior, reflective — she is watching herself fail.',
  },
  act_3: {
    belief: 'What if I stop trying to fit into niches and create my own world?',
    voice:  'Something lifts. Permission, not confidence yet. Sentences start reaching further. A new rhythm appears.',
    tense:  'Present — she is noticing something for the first time.',
  },
  act_4: {
    belief: 'I can sustain this. Even when it\'s fragile.',
    voice:  'Quieter confidence. Less proving, more building. Doubt present but not in charge. Prose gets cleaner.',
    tense:  'Active present — she is doing the thing.',
  },
  act_5: {
    belief: 'This is the first thing I\'ve built that feels like me.',
    voice:  'Owned. Narrator and subject feel like the same person. Earned.',
    tense:  'Reflective present — she has arrived somewhere.',
  },
};

const WRITE_MODE_CHARACTER_RULES = `
KEY RULES:
- JustAWoman is ACTIVE — posting, trying, showing up. Wound is invisibility, not fear.
- The Husband never speaks aloud — he exists only in her interior monologue.
- Chloe appears on screens only — never in person, never in the same physical space.
- Lala in Book 1: one intrusive thought maximum — brief, different altitude, not JustAWoman being confident.
- First person. Vary sentence rhythm. Short when doubt peaks, longer when something opens.
- Do not give her clarity she hasn't yet earned.`;

router.post('/voice-to-story', optionalAuth, async (req, res) => {
  try {
    const {
      spoken,
      existing_prose = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      book_character: _book_character = 'JustAWoman',
      session_log    = [],
      character_id   = null,
      gen_length     = 'paragraph',
      stream         = false,
    } = req.body;

    if (!spoken?.trim()) {
      return res.json({ prose: null, hint: null });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;

    // Load voice + narrative context in parallel to reduce latency
    const [charVoice, wmCtx] = await Promise.all([
      getCharacterVoiceContext(character_id),
      character_id ? loadWriteModeContext(character_id) : Promise.resolve(null),
    ]);

    const recentProse = existing_prose
      ? existing_prose.split('\n\n').slice(-5).join('\n\n')
      : '';

    const sessionContext = session_log.length > 0
      ? `Recent spoken inputs this session:\n${session_log.slice(-3).map(l => `"${l.spoken.slice(0, 80)}"`).join('\n')}`
      : '';

    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const narrativeContext = wmCtx ? buildWriteModeContextBlock(wmCtx) : '';

    const lengthInstruction = gen_length === 'sentence'
      ? 'Write exactly 1–2 sentences. One vivid moment. One breath.'
      : 'Write 2–5 paragraphs. Rich but controlled.';

    const prompt = `You are writing a memoir in the voice of ${charName}.

The author just spoke this aloud — raw material, not polished prose:
"${spoken}"

YOUR JOB: Turn this into IMMERSIVE story. The reader should be INSIDE the scene — seeing it, smelling it, feeling it in their body.

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}

CURRENT ACT: ${act.voice}
CURRENT BELIEF: "${act.belief}"
PROSE TENSE/MODE: ${act.tense}

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${narrativeContext}${recentProse ? `WHAT WAS JUST WRITTEN (continue seamlessly from here — match the rhythm and flow):\n${recentProse}` : ''}

${sessionContext}

${charRules}

IMMERSION RULES:
- ${lengthInstruction}
- SENSORY DETAIL: Ground every moment. What does the room smell like? What does she hear? What is the light doing? What does the air feel like on skin? Don't list senses — weave them into the prose so the reader is THERE.
- EMOTION IN THE BODY: Don't say "she felt sad." Show it — the throat tightening, the hands going still, the breath she holds without meaning to. Emotions live in the body.
- DIALOGUE IS SPOKEN: When someone talks out loud, use dialogue. "Like this," she said. Internal thoughts stay in narration. The reader must always know what's spoken vs. thought.
- FLOW & CONTINUITY: Each passage must flow from the last like water. Read what came before and continue the emotional current — don't restart, don't summarize.
- SPECIFICITY: No generic details. Not "a store" — the name of the store. Not "music" — the song. Not "food" — what's on the plate. Use what the author gave you; if they didn't name it, choose something real and specific that fits.
- Stay close to what they said — the truth of it — but give it the shape of prose.
- If they trailed off or repeated themselves, that repetition IS the real thing — lean into it.
- Do not add events they didn't give you.
- End on something that pulls forward — not a conclusion.

Respond with ONLY the prose. No preamble. No explanation. No quotes around it.`;

    const maxTok = gen_length === 'sentence' ? 200 : 900;
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-5-20250514'];

    // ── STREAMING PATH ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      // Immediate heartbeat so frontend knows connection is alive
      res.write(`data: ${JSON.stringify({ type: 'processing' })}\n\n`);

      let streamed = false;
      for (const model of MODELS) {
        try {
          console.log(`voice-to-story stream: trying ${model}`);
          const streamResp = anthropic.messages.stream({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          let fullText = '';
          streamResp.on('text', (text) => {
            fullText += text;
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          });
          await streamResp.finalMessage();

          // Check for Lala hint
          let hint = null;
          const proseAndSpoken = (existing_prose + fullText).toLowerCase();
          const spiralCount = (proseAndSpoken.match(/can't|couldn't|wrong|what if|why|tired|keep/g) || []).length;
          const interiorCount = existing_prose.split('\n\n').length;
          if (spiralCount >= 4 && interiorCount >= 4) {
            hint = 'Something is building here — a different voice is close.';
          }
          res.write(`data: ${JSON.stringify({ type: 'done', hint })}\n\n`);
          res.end();
          streamed = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if (status === 529 || status === 503 || status === 404) {
            console.log(`voice-to-story stream: ${model} status ${status}, trying next`);
            continue;
          }
          throw apiErr;
        }
      }
      if (!streamed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI is busy — please try again in a moment' })}\n\n`);
        res.end();
      }
      return;
    }

    // ── NON-STREAMING (fallback) ──
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`voice-to-story: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`voice-to-story: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`voice-to-story: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, hint: null, error: 'AI is busy — please try again in a moment' });
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Check for Lala conditions — very subtle hint
    let hint = null;
    const proseAndSpoken = (existing_prose + prose).toLowerCase();
    const spiralCount = (proseAndSpoken.match(/can't|couldn't|wrong|what if|why|tired|keep/g) || []).length;
    const interiorCount = existing_prose.split('\n\n').length;
    if (spiralCount >= 4 && interiorCount >= 4) {
      hint = 'Something is building here — a different voice is close.';
    }

    res.json({ prose, hint });

  } catch (err) {
    console.error('POST /voice-to-story error:', err);
    res.json({
      prose: null,
      hint:  null,
      error: 'Could not generate prose — please try again',
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-edit
// Author says what's wrong → returns revised prose
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-edit', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose,
      edit_note,
      pnos_act      = 'act_1',
      chapter_title = '',
      character_id  = null,
    } = req.body;

    if (!current_prose?.trim() || !edit_note?.trim()) {
      return res.json({ prose: current_prose });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';

    // Load full narrative context (memories, threads, arcs, relationships, etc.)
    const wmCtx = await loadWriteModeContext(character_id);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    const prompt = `You are editing a memoir written in ${charName}'s voice.

CURRENT PROSE:
${current_prose}

THE AUTHOR'S NOTE ON WHAT NEEDS TO CHANGE:
"${edit_note}"

CHAPTER: ${chapter_title || 'Untitled'}
CURRENT VOICE: ${act.voice}
CURRENT BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${narrativeContext}${charRules}

EDITING RULES:
- Take the author's note seriously — they are telling you the truth of what's wrong.
- "That's not how she'd say it" → find how she would say it.
- "That part is too neat" → find the roughness.
- "She wouldn't have that clarity yet" → pull the clarity back.
- "More of that feeling" → expand that moment, compress others.
- "That's not what happened" → ask what the note says did happen, adjust accordingly.
- Preserve what is working. Change what the note says is wrong.
- Do not add new events or details beyond what exists plus what the note implies.
- Keep the same overall arc and length unless the note specifically asks to expand.

Respond with ONLY the revised prose. No preamble. No explanation.
The complete revised version from start to finish.`;

    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-edit: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-edit: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-edit: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: current_prose }); // return unchanged on total failure
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ prose });

  } catch (err) {
    console.error('POST /story-edit error:', err);
    res.json({ prose: req.body.current_prose });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-continue
// AI writes the next 2–4 paragraphs continuing from where the author left off
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-continue', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      book_character: _book_character2 = 'JustAWoman',
      character_id   = null,
      gen_length     = 'paragraph',
      stream         = false,
      // Full plan context
      emotional_state_start = '',
      emotional_state_end   = '',
      theme                 = '',
      pov                   = '',
      characters_present    = '',
      sections              = [],
      chapter_notes         = '',
      tone                  = '',
      setting               = '',
      conflict              = '',
      stakes                = '',
      hooks                 = '',
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ prose: null, error: 'Nothing written yet — write a few lines first.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';

    // Load full narrative context (memories, threads, arcs, relationships, etc.)
    const wmCtx = await loadWriteModeContext(character_id);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    // Send the last ~6 paragraphs for context — more context = better predictions
    const recentProse = current_prose.split('\n\n').slice(-6).join('\n\n');

    const lengthInstruction = gen_length === 'sentence'
      ? 'Write exactly 1–2 sentences. One beat. One moment. That\'s all.'
      : 'Write 2–4 paragraphs. Rich but controlled.';

    // Build plan context block for Claude
    const planContext = [];
    if (emotional_state_start || emotional_state_end) {
      planContext.push(`EMOTIONAL ARC: ${emotional_state_start || '?'} → ${emotional_state_end || '?'}`);
    }
    if (theme) planContext.push(`THEME: ${theme}`);
    if (pov) planContext.push(`POV: ${pov}`);
    if (tone) planContext.push(`TONE/MOOD: ${tone}`);
    if (setting) planContext.push(`SETTING: ${setting}`);
    if (conflict) planContext.push(`CONFLICT: ${conflict}`);
    if (stakes) planContext.push(`STAKES: ${stakes}`);
    if (hooks) planContext.push(`HOOKS TO PLANT: ${hooks}`);
    if (characters_present) {
      const chars = Array.isArray(characters_present) ? characters_present : characters_present;
      planContext.push(`CHARACTERS IN SCENE: ${typeof chars === 'string' ? chars : JSON.stringify(chars)}`);
    }
    if (chapter_notes && chapter_notes !== chapter_brief) {
      planContext.push(`AUTHOR'S NOTES: ${chapter_notes}`);
    }
    if (sections && sections.length > 0) {
      const sectionSummary = sections
        .filter(s => s.type === 'h2' || s.type === 'h3' || s.title || s.description)
        .map(s => `  - ${s.title || s.content || 'Section'}: ${s.description || s.prose?.slice(0, 80) || ''}`)
        .join('\n');
      if (sectionSummary) planContext.push(`SCENE STRUCTURE:\n${sectionSummary}`);
    }
    const planBlock = planContext.length > 0 ? planContext.join('\n') + '\n\n' : '';

    const prompt = `You are continuing a memoir in the voice of ${charName}.

The author has written prose below. They paused. Now pick up EXACTLY where they left off — same voice, same truth, same movement. The reader should not be able to tell where the author stopped and you began.

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}
${planBlock}CURRENT ACT: ${act.voice}
CURRENT BELIEF: "${act.belief}"
PROSE TENSE/MODE: ${act.tense}

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${narrativeContext}WHAT THE AUTHOR HAS WRITTEN (continue from the end):
${recentProse}

${charRules}

CONTINUATION RULES:
- ${lengthInstruction}
- PREDICT THE NEXT BEAT: Read the emotional current of what's already written. Where is it heading? What would naturally happen next in THIS specific moment? Not a big leap — the very next breath, the next small action, the next thought that would cross THIS character's mind given what just happened.
- SENSORY IMMERSION: Ground every moment in the physical world. What does the space smell like? What are the sounds? What is the light doing? What does her body feel like right now? Weave these in naturally — don't list them.
- EMOTION IN THE BODY: Never say "she felt X." Show it — the jaw clenching, the hands going still, the way she holds her coffee without drinking it. Emotions are physical.
- DIALOGUE IS SPOKEN: When someone talks aloud, use proper dialogue. "Like this." Internal thoughts stay in narration. The reader must always know what's spoken vs. thought.
- SEAMLESS FLOW: Continue the exact rhythm. If the last paragraph was short and tight, keep that tension. If it was opening up, let it breathe. Don't restart tone.
- SPECIFICITY: Real details. The name of the store, the song on the radio, what's on the plate. Never generic.
- If the last paragraph ended mid-thought, finish that thought first.
- If doubt was building, let it build one more turn — don't resolve it.
- If something just happened, let her sit with it before reacting.
- Do not add characters or events not implied by what's already written.
- End on something that pulls forward — not a conclusion.

Respond with ONLY the continuation prose. No preamble. No explanation.
Start exactly where they left off.`;

    const maxTok = gen_length === 'sentence' ? 200 : 900;
    const MODELS = ['claude-sonnet-4-6'];

    // ── STREAMING PATH ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let streamed = false;
      for (const model of MODELS) {
        try {
          console.log(`story-continue stream: trying ${model}`);
          const streamResp = anthropic.messages.stream({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          streamResp.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          });
          await streamResp.finalMessage();
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
          streamed = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-continue stream: ${model} status ${status}, trying next`);
            continue;
          }
          throw apiErr;
        }
      }
      if (!streamed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI is busy — please try again in a moment' })}\n\n`);
        res.end();
      }
      return;
    }

    // ── NON-STREAMING (fallback) ──
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-continue: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-continue: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-continue: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, error: 'AI is busy — please try again in a moment' });
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ prose });

  } catch (err) {
    console.error('POST /story-continue error:', err);
    res.json({ prose: null, error: 'Could not continue — please try again' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-deepen
// Takes the last paragraph and adds emotional/sensory depth
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-deepen', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      pnos_act       = 'act_1',
      chapter_title  = '',
      character_id   = null,
      // Full plan context
      chapter_brief         = '',
      emotional_state_start = '',
      emotional_state_end   = '',
      theme                 = '',
      pov                   = '',
      characters_present    = '',
      tone                  = '',
      setting               = '',
      conflict              = '',
      stakes                = '',
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ prose: null, error: 'Nothing to deepen yet.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const paragraphs = current_prose.split('\n\n').filter(p => p.trim());
    const lastParagraph = paragraphs[paragraphs.length - 1];
    const contextBefore = paragraphs.slice(-4, -1).join('\n\n');

    // Build plan context for deeper scene awareness
    const deepenPlanContext = [];
    if (chapter_brief) deepenPlanContext.push(`SCENE: ${chapter_brief}`);
    if (emotional_state_start || emotional_state_end) {
      deepenPlanContext.push(`EMOTIONAL ARC: ${emotional_state_start || '?'} → ${emotional_state_end || '?'}`);
    }
    if (theme) deepenPlanContext.push(`THEME: ${theme}`);
    if (pov) deepenPlanContext.push(`POV: ${pov}`);
    if (tone) deepenPlanContext.push(`TONE/MOOD: ${tone}`);
    if (setting) deepenPlanContext.push(`SETTING: ${setting}`);
    if (conflict) deepenPlanContext.push(`CONFLICT: ${conflict}`);
    if (stakes) deepenPlanContext.push(`STAKES: ${stakes}`);
    if (characters_present) {
      deepenPlanContext.push(`CHARACTERS: ${typeof characters_present === 'string' ? characters_present : JSON.stringify(characters_present)}`);
    }
    const deepenPlanBlock = deepenPlanContext.length > 0 ? deepenPlanContext.join('\n') + '\n' : '';

    const prompt = `You are deepening a moment in a memoir written in ${charName}'s voice.

${contextBefore ? `CONTEXT (what came before):\n${contextBefore}\n\n` : ''}
PARAGRAPH TO DEEPEN:
${lastParagraph}

CHAPTER: ${chapter_title || 'Untitled'}
${deepenPlanBlock}CURRENT VOICE: ${act.voice}
CURRENT BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${charRules}

YOUR JOB: Deepen this paragraph. Not rewrite — deepen.
- Find the body in it. Where is she standing? What does the air feel like? What's in her hands?
- Find the image underneath the feeling. "I was anxious" → What did the anxiety look like in her body?
- Slow down the moment. Give it more room to breathe.
- If there's dialogue or interior monologue, give it more weight — the pause before, the reaction after.
- Add 1–3 sentences of depth. Don't double the length. Just let the moment land harder.
- Preserve every single word and idea of the original. You're adding resonance, not rewriting.

Respond with the FULL REVISED PARAGRAPH ONLY. No preamble. No explanation.
The paragraph should feel like the same paragraph, just more alive.`;

    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-deepen: trying ${model} (attempt ${attempt + 1})`);
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
            console.log(`story-deepen: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-deepen: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, error: 'AI is busy — please try again in a moment' });
    }

    const deepened = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Reassemble with deepened last paragraph
    const before = paragraphs.slice(0, -1).join('\n\n');
    const fullProse = before ? before + '\n\n' + deepened : deepened;

    res.json({ prose: fullProse });

  } catch (err) {
    console.error('POST /story-deepen error:', err);
    res.json({ prose: null, error: 'Could not deepen — please try again' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-nudge
// Suggests what could happen next — a creative prompt, not prose
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-nudge', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      character_id   = null,
      // Full plan context
      emotional_state_start = '',
      emotional_state_end   = '',
      theme                 = '',
      pov: _pov             = '',
      characters_present    = '',
      tone                  = '',
      setting               = '',
      conflict              = '',
      stakes                = '',
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ nudge: 'Start with where they are — the room, the feeling, the thing they just did.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const recentProse = current_prose.split('\n\n').slice(-3).join('\n\n');

    // Build plan context for nudge awareness
    const nudgePlanContext = [];
    if (emotional_state_start || emotional_state_end) {
      nudgePlanContext.push(`EMOTIONAL ARC: ${emotional_state_start || '?'} → ${emotional_state_end || '?'}`);
    }
    if (theme) nudgePlanContext.push(`THEME: ${theme}`);
    if (tone) nudgePlanContext.push(`TONE/MOOD: ${tone}`);
    if (setting) nudgePlanContext.push(`SETTING: ${setting}`);
    if (conflict) nudgePlanContext.push(`CONFLICT: ${conflict}`);
    if (stakes) nudgePlanContext.push(`STAKES: ${stakes}`);
    if (characters_present) {
      nudgePlanContext.push(`CHARACTERS: ${typeof characters_present === 'string' ? characters_present : JSON.stringify(characters_present)}`);
    }
    const nudgePlanBlock = nudgePlanContext.length > 0 ? nudgePlanContext.join('\n') + '\n' : '';

    const prompt = `You are a writing partner for a memoir in ${charName}'s voice.

The author has written this so far:
${recentProse}

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}
${nudgePlanBlock}ACT ENERGY: ${act.voice}
BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}Give the writer a SHORT creative nudge — one sentence, maybe two. Not prose. A suggestion.
Think: what would a brilliant writing partner whisper to you at this point?

Examples of good nudges:
- "What did they do with their hands while they waited?"
- "They're circling. What are they avoiding naming?"
- "Something was left unsaid. What happens when it comes out?"
- "This is the moment before the spiral — lean into what they believe right before it breaks."
- "You're in their head. Get them back in their body."

RULES:
- One nudge. Not a list. Not options.
- Reference something specific from what they've written.
- Don't tell them what to write. Open a door.
- Match the emotional temperature of where they are.
- Be brief. A whisper, not a lecture.

Respond with ONLY the nudge. No preamble.`;

    const MODELS = ['claude-sonnet-4-6'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-nudge: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-nudge: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-nudge: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ nudge: 'Stay with where she is right now. Don\'t skip ahead.' });
    }

    const nudge = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ nudge });

  } catch (err) {
    console.error('POST /story-nudge error:', err);
    res.json({ nudge: 'Keep going — you\'re closer than you think.' });
  }
});


// ════════════════════════════════════════════════════════════════════════
// HELPER — safeAI: wrapper around anthropic.messages.create
// ════════════════════════════════════════════════════════════════════════

async function safeAI(systemPrompt, userPrompt, maxTokens = 800) {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system:     [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    console.error('safeAI call failed:', err.message);
    return null;
  }
}

// safeAI variant with explicit temperature control (for creative writing)
async function safeAIWithTemp(systemPrompt, userPrompt, maxTokens = 800, temperature = 0.85) {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  maxTokens,
      temperature,
      system:      [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages:    [{ role: 'user', content: userPrompt }],
    });
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    console.error('safeAIWithTemp call failed:', err.message);
    return null;
  }
}


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /character-dilemma
// Character Dilemma Engine — generates 5 dilemmas or compiles profile
// Called by: CharacterDilemmaEngine.jsx
// ════════════════════════════════════════════════════════════════════════

router.post('/character-dilemma', optionalAuth, async (req, res) => {
  try {
    const {
      character_id,
      character_name,
      character_type,
      character_role,
      story_context,
      existing_answers,
      generate_profile,
    } = req.body;

    // ── GENERATE PROFILE FROM COMPLETED ANSWERS ─────────────────────────
    if (generate_profile && existing_answers?.length >= 3) {
      const profileSystem = `You are building a character profile for a literary fiction system.
The character has revealed themselves through a series of dilemmas.
Each dilemma had two choices — both defensible, both costly.
The character's choices under pressure ARE their profile.

From the pattern of choices, extract:
1. core_belief — what this character fundamentally believes about the world (one sentence)
2. primary_defense — how they protect themselves: rationalize | withdraw | intellectualize | perform | displace | minimize | confront
3. wound — the founding pain beneath their behavior (one sentence, specific)
4. operating_logic — what they are always trying to do in any situation (one sentence)
5. relationship_to_protagonist — how they function in JustAWoman's story specifically

Return ONLY valid JSON. No preamble. No markdown.`;

      const profileUser = `CHARACTER: ${character_name} (${character_type})
ROLE: ${character_role}

DILEMMA ANSWERS:
${existing_answers.map((a, i) =>
  `${i + 1}. "${a.dilemma}"\n   Chose: "${a.choice}"\n   Cost: "${a.cost}"`
).join('\n\n')}

Build the profile from what these choices reveal.`;

      const raw = await safeAI(profileSystem, profileUser, 600);
      let profile = null;

      try {
        const cleaned = raw?.replace(/```json|```/g, '').trim();
        profile = JSON.parse(cleaned);
      } catch {
        profile = { raw };
      }

      // Write back to registry_characters if character_id provided
      if (character_id && profile && !profile.raw) {
        try {
          await RegistryCharacter.update({
            belief_pressured:   profile.core_belief,
            writer_notes:       [
              `Primary defense: ${profile.primary_defense}`,
              `Wound: ${profile.wound}`,
              `Operating logic: ${profile.operating_logic}`,
              `Relationship to protagonist: ${profile.relationship_to_protagonist}`,
            ].join('\n'),
          }, { where: { id: character_id } });
        } catch (e) {
          console.error('Profile write error:', e.message);
        }
      }

      return res.json({ ok: true, profile, written: !!character_id });
    }

    // ── GENERATE DILEMMAS ────────────────────────────────────────────────
    const dilemmaSystem = `You are a literary character architect for LalaVerse — a franchise built around 
JustAWoman, a content creator building an AI fashion character called Lala.

Your job is to generate dilemmas that reveal character through pressure — not through questions.
A dilemma presents two choices. Both must be defensible. Both must be costly.
The character's choice reveals what they value when forced to commit.

RULES FOR DILEMMAS:
— Both options must be things a reasonable person would choose
— Each choice must cost something real — relationship, self-image, consistency, control
— The dilemma must be specific to this character's position in the story
— Never include "or" options that are obviously right/wrong
— The cost question ("which costs more to admit?") is always the real question
— Dilemmas escalate: first three are external, last two touch the wound directly

Format each dilemma as:
{
  "id": 1,
  "setup": "The situation that forces the choice",
  "option_a": "First choice — stated in first person",
  "option_b": "Second choice — stated in first person", 
  "cost_question": "Which of these costs you more to live with?"
}

Return ONLY a JSON array of 5 dilemma objects. No preamble. No markdown.`;

    const previousContext = existing_answers?.length
      ? `\n\nPREVIOUS CHOICES:\n${existing_answers.map(a =>
          `— "${a.dilemma_setup}" → chose: "${a.choice}" → cost: "${a.cost}"`
        ).join('\n')}\n\nBuild on these. Don't repeat territory already covered. The final dilemmas should press closer to the wound.`
      : '';

    const dilemmaUser = `CHARACTER: ${character_name}
TYPE: ${character_type}
ROLE IN STORY: ${character_role || 'Not yet defined'}
CURRENT STORY CONTEXT: ${story_context || 'Book 1 — JustAWoman building Lala, struggling with visibility'}
${previousContext}

Generate 5 dilemmas that will reveal who this character actually is.`;

    const raw = await safeAI(dilemmaSystem, dilemmaUser, 1200);
    let dilemmas = [];

    try {
      const cleaned = raw?.replace(/```json|```/g, '').trim();
      dilemmas = JSON.parse(cleaned);
    } catch {
      const FALLBACKS = {
        pressure: [
          { id: 1, setup: 'She is about to take a risk that might not pay off.', option_a: 'I say nothing and let her decide.', option_b: 'I name my concern once, clearly.', cost_question: 'Which one do you live with easier?' },
          { id: 2, setup: 'She asks for your honest opinion on something she has already decided.', option_a: 'I tell her the truth.', option_b: 'I support the decision she has already made.', cost_question: 'Which costs more?' },
          { id: 3, setup: 'Someone else is getting the credit for work you helped with.', option_a: 'I bring it up.', option_b: 'I let it go — the work speaks for itself.', cost_question: 'Which silence is harder?' },
          { id: 4, setup: 'You realize you have been performing a version of yourself that is useful but not true.', option_a: 'I keep performing — it works.', option_b: 'I stop and risk being less useful.', cost_question: 'Which version do you lose?' },
          { id: 5, setup: 'The person you care about most is about to make the same mistake again.', option_a: 'I intervene.', option_b: 'I watch.', cost_question: 'Which love is harder?' },
        ],
        mirror: [
          { id: 1, setup: 'Your success is being used as evidence that she is failing.', option_a: 'I distance myself from the comparison.', option_b: 'I acknowledge it directly.', cost_question: 'Which do you choose?' },
          { id: 2, setup: 'She asks you how you do it — and the real answer would hurt her.', option_a: 'I tell her the truth.', option_b: 'I soften it.', cost_question: 'Which costs her more?' },
          { id: 3, setup: 'You see yourself in someone you don\'t respect.', option_a: 'I examine the similarity.', option_b: 'I reject the comparison.', cost_question: 'Which is more honest?' },
          { id: 4, setup: 'The thing that makes you effective is the same thing that makes you lonely.', option_a: 'I keep the edge.', option_b: 'I soften and risk mediocrity.', cost_question: 'Which loss is real?' },
          { id: 5, setup: 'Someone sees the real you. The version you don\'t perform.', option_a: 'I let them keep seeing.', option_b: 'I close the door.', cost_question: 'Which is the wound?' },
        ],
        support: [
          { id: 1, setup: 'You see the pattern repeating. You have seen it before.', option_a: 'I name the pattern.', option_b: 'I wait for her to see it herself.', cost_question: 'Which one serves her better?' },
          { id: 2, setup: 'She is leaning on you harder than you can carry right now.', option_a: 'I hold it.', option_b: 'I tell her I need space.', cost_question: 'Which relationship survives?' },
          { id: 3, setup: 'Your advice was wrong. She followed it and it cost her.', option_a: 'I own it.', option_b: 'I reframe it as learning.', cost_question: 'Which is braver?' },
          { id: 4, setup: 'She is growing past you. The dynamic is shifting.', option_a: 'I adapt.', option_b: 'I hold the role I know.', cost_question: 'Which loss hurts more?' },
          { id: 5, setup: 'You realize your support has been enabling, not helping.', option_a: 'I pull back.', option_b: 'I keep going — she needs someone.', cost_question: 'Which guilt can you carry?' },
        ],
      };
      dilemmas = FALLBACKS[character_type] || FALLBACKS.pressure;
    }

    res.json({ ok: true, dilemmas, character_name, round: (existing_answers?.length || 0) + 1 });

  } catch (err) {
    console.error('POST /character-dilemma error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /attribute-voices
// Narrator vs Character Voice — line attribution
// Called by: VoiceAttributionButton in StoryTeller chapter header
// ════════════════════════════════════════════════════════════════════════

router.post('/attribute-voices', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, lines, book_context } = req.body;

    if (!lines?.length) {
      return res.status(400).json({ error: 'lines array required' });
    }

    const system = `You are analyzing lines from a literary memoir for voice attribution.

The book is "Before Lala" — first-person literary memoir by JustAWoman, 
a content creator building an AI fashion character. 80% first person, 
15% close third reflection, 5% Lala proto-voice.

VOICE TYPES:
- narrator     — JustAWoman speaking from a reflective distance, past tense, 
                 assembled and considered. The author looking back.
- interior     — JustAWoman in the raw moment. Present tense or visceral past.
                 Unfiltered. The gap between what she posts and what she feels.
- dialogue     — A character speaking aloud. Contains quotation marks or clear 
                 speech act.
- lala         — The intrusive thought with a different texture. Confident, styled,
                 brief. Sounds like a version of her that has no constraints.
                 Often single-sentence. Often italicized. Often arrives unbidden.
- transition   — A structural line that moves between scenes or time. Not 
                 emotional — logistical.

For each line, return:
{
  "id": "the line UUID",
  "voice_type": "narrator|interior|dialogue|lala|transition",
  "confidence": 0.0 to 1.0,
  "signal": "one short phrase explaining what in the line gave it away"
}

Return ONLY a JSON array. No preamble. No markdown fences.`;

    const linesFormatted = lines
      .sort((a, b) => a.order_index - b.order_index)
      .map((l, i) => `[${i + 1}] ID:${l.id}\n${l.content}`)
      .join('\n\n');

    const user = `${book_context ? `CHAPTER CONTEXT: ${book_context}\n\n` : ''}LINES TO ATTRIBUTE:\n\n${linesFormatted}

Attribute each line's voice. Return the JSON array.`;

    const raw = await safeAI(system, user, 2000);
    let attributions = [];

    try {
      const cleaned = raw?.replace(/```json|```/g, '').trim();
      attributions = JSON.parse(cleaned);
    } catch {
      attributions = lines.map(l => ({
        id:         l.id,
        voice_type: 'unattributed',
        confidence: 0,
        signal:     'attribution failed — run again',
      }));
    }

    // Update the database records (unconfirmed — author must accept)
    if (StorytellerLine && attributions.length > 0) {
      for (const attr of attributions) {
        if (!attr.id) continue;
        try {
          await StorytellerLine.update(
            {
              voice_type:       attr.voice_type,
              voice_confidence: attr.confidence,
              voice_confirmed:  false,
            },
            { where: { id: attr.id } }
          );
        } catch (e) {
          console.error('Voice update error for line', attr.id, e.message);
        }
      }
    }

    // Summary stats
    const summary = attributions.reduce((acc, a) => {
      acc[a.voice_type] = (acc[a.voice_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      ok:           true,
      chapter_id,
      total:        attributions.length,
      attributions,
      summary,
      note:         'All attributions are suggestions. Confirm or override in the editor.',
    });

  } catch (err) {
    console.error('POST /attribute-voices error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /confirm-voice
// Author confirms or overrides a voice attribution for a single line
// ════════════════════════════════════════════════════════════════════════

router.post('/confirm-voice', optionalAuth, async (req, res) => {
  try {
    const { line_id, voice_type } = req.body;

    await StorytellerLine.update(
      { voice_type, voice_confirmed: true },
      { where: { id: line_id } }
    );

    res.json({ ok: true, line_id, voice_type, confirmed: true });

  } catch (err) {
    console.error('POST /confirm-voice error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// POST /ai-writer-action
// Character-aware AI writing: dialogue, interior monologue, reaction, lala moment
// Used by WriteModeAIWriter component
// ════════════════════════════════════════════════════════════════════════

router.post('/ai-writer-action', optionalAuth, async (req, res) => {
  try {
    const {
      character,       // { name, type, role, belief_pressured, emotional_function, writer_notes }
      character_id,    // registry PK — used for deep voice lookup
      recent_prose,    // last ~600 chars of current writing
      chapter_context, // { scene_goal, theme, emotional_arc_start, emotional_arc_end, pov }
      previous_chapter_digest, // last ~500 chars of previous chapter (continuity)
      action,          // 'continue' | 'dialogue' | 'interior' | 'reaction' | 'lala'
      length,          // 'paragraph' | 'sentence'
      tone,            // optional — 'intimate' | 'urgent' | 'detached' | 'raw'
      retry_hint,      // random seed string to force variation on retries
      stream,          // boolean — if true, use SSE streaming
    } = req.body;

    // Load voice + narrative context in parallel
    const [charVoice, wmCtx] = await Promise.all([
      character_id ? getCharacterVoiceContext(character_id) : null,
      character_id ? loadWriteModeContext(character_id) : null,
    ]);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    // Build relationship voice hint from shared context (for who she's with)
    let relationshipVoiceHint = '';
    if (wmCtx?.relationships && character?.name) {
      relationshipVoiceHint = `\nRelationship dynamics are included in the narrative context above — modulate voice based on who is present in the scene.`;
    }

    const ACTION_PROMPTS = {
      continue: `Write what happens next in this character's voice.
        Continue the prose seamlessly — same rhythm, same emotional temperature.
        Two to four sentences. Predict the next beat: the next breath,
        the next small action, the next thought that would cross their mind.
        Do not restart or summarize. Just continue.`,

      dialogue: `Write the next line of dialogue this character speaks aloud.
        It must come from their specific belief system and defense mechanism.
        One to three sentences maximum. In quotation marks.`,

      interior: `Write what this character is thinking but not saying.
        Interior monologue — raw, present tense, unfiltered.
        Two to four sentences. No quotation marks.`,

      reaction: `Write how this character internally or externally responds
        to the last thing that happened in the prose.
        One paragraph. Specific to who they are under pressure.`,

      lala: `Write the intrusive thought that crosses JustAWoman's mind —
        the one she would never post. The one that sounds exactly like
        who she wishes she could be. Confident, styled, brief.
        One sentence. Italicized in asterisks. This is Lala's proto-voice.`,

      deepen: `Take what was just written and go beneath the surface.
        Add emotional texture, sensory detail, or subtext that the character
        would feel but the narrator barely names. Don't rewrite — deepen.
        Add one to three sentences that sit inside or right after the last beat.
        Same voice, same rhythm, more weight.`,

      nudge: `Suggest a creative direction for the next beat of writing.
        Not prose — a brief writer's note: what could happen next, what tension
        could surface, what the character might do or avoid.
        One to two sentences, written as a suggestion to the author.
        Be specific to the character and the scene.`,
    };

    const charName = charVoice?.name || character?.name || 'JustAWoman';
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const charRules = charVoice?.charRules || '';

    const system = `You are writing for a literary memoir called "Before Lala."
Protagonist: JustAWoman — content creator, building Lala, invisible while trying.
Write with precision. Every word earns its place.
Match the prose style of the recent writing exactly.
Do not explain or comment. Only return the prose itself.
${charVoiceBlock ? '\n' + charVoiceBlock : ''}${charRules ? '\n' + charRules : ''}${narrativeContext}`;

    const user = `CHARACTER: ${charName} (${character?.type || 'unknown'})
ROLE: ${character?.role || ''}
${character?.core_wound ? `CORE WOUND: ${character.core_wound}` : ''}
${character?.core_desire ? `CORE DESIRE: ${character.core_desire}` : ''}
${character?.core_fear ? `CORE FEAR: ${character.core_fear}` : ''}
${character?.description ? `WHO THEY ARE: ${character.description}` : ''}
BELIEF PRESSURED: ${character?.belief_pressured || 'unknown'}
EMOTIONAL FUNCTION: ${character?.emotional_function || ''}
WRITER NOTES: ${character?.writer_notes ? character.writer_notes.slice(0, 300) : ''}
${relationshipVoiceHint}
CHAPTER CONTEXT:
Scene goal: ${chapter_context?.scene_goal || 'not set'}
Theme: ${chapter_context?.theme || 'not set'}
Emotional arc: ${chapter_context?.emotional_arc_start || '?'} → ${chapter_context?.emotional_arc_end || '?'}
${previous_chapter_digest ? `\nPREVIOUS CHAPTER (for continuity — do not repeat, but maintain thread):\n${previous_chapter_digest}\n` : ''}
RECENT PROSE:
${recent_prose || '(start of chapter)'}

ACTION: ${ACTION_PROMPTS[action] || ACTION_PROMPTS.dialogue}${tone ? `\n\nTONE: Write in a ${tone} register — let that coloring shape word choice and pacing.` : ''}${retry_hint ? `\n\nIMPORTANT: Write a COMPLETELY DIFFERENT version than before. Vary the tone, word choice, and angle. Variation seed: ${retry_hint}` : ''}`;

    // Use higher temperature for creative writing; bump further on retries
    const temp = retry_hint ? 1.0 : 0.85;
    const maxTokens = length === 'full' ? 800 : length === 'sentence' ? 150 : 350;

    if (stream && anthropic) {
      // ── SSE STREAMING PATH ──
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const MODELS = ['claude-sonnet-4-6'];
      let streamed = false;
      for (const model of MODELS) {
        try {
          console.log(`ai-writer-action stream: trying ${model}`);
          const streamResp = anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            temperature: temp,
            system,
            messages: [{ role: 'user', content: user }],
          });
          streamResp.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          });
          await streamResp.finalMessage();
          res.write(`data: ${JSON.stringify({ type: 'done', action })}\n\n`);
          res.end();
          streamed = true;
          break;
        } catch (err) {
          const status = err?.status || err?.error?.status;
          if (status === 529 || status === 503 || status === 404) {
            console.log(`ai-writer-action stream: ${model} status ${status}, trying next`);
            continue;
          }
          console.error('ai-writer-action stream error:', err.message);
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI generation failed' })}\n\n`);
          res.end();
          streamed = true;
          break;
        }
      }
      if (!streamed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI is busy — please try again in a moment' })}\n\n`);
        res.end();
      }
    } else {
      // ── NON-STREAMING PATH (backward compat) ──
      const result = await safeAIWithTemp(system, user, maxTokens, temp);
      res.json({ ok: true, content: result, action });
    }

  } catch (err) {
    console.error('POST /ai-writer-action error:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
module.exports.router = router;
module.exports.safeAI = safeAI;
module.exports.safeAIWithTemp = safeAIWithTemp;
