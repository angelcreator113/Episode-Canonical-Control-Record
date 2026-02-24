/**
 * CharacterTherapy_backend.js
 *
 * src/routes/therapy.js
 *
 * ROUTES:
 *   POST /api/v1/therapy/session-open      character arrives with an event
 *   POST /api/v1/therapy/session-respond   author responds, state updates
 *   POST /api/v1/therapy/reveal            author gives / locks a truth
 *   POST /api/v1/therapy/session-close     session ends, profile saves
 *   GET  /api/v1/therapy/profile/:charId   full psychological state
 */

'use strict';

const express = require('express');
const router  = express.Router();

let optionalAuth;
try {
  const m = require('../middleware/auth');
  optionalAuth = m.optionalAuth || m.authenticate || ((q,r,n)=>n());
} catch { optionalAuth = (q,r,n) => n(); }

let anthropic;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch { anthropic = null; }

// ── WOUND MEMORY PATTERNS ────────────────────────────────────────────────

const WOUND_PATTERNS = {
  the_husband: {
    wound:    'The people he loves most always leave for something bigger than him.',
    patterns: [
      'stayed up late', 'working on', 'didn\'t tell him', 'didn\'t tell me',
      'chose', 'instead of', 'more important', 'focused on', 'distracted',
      'didn\'t notice', 'forgot', 'cancelled', 'busy', 'not there',
    ],
    echo: 'This rhymes with every other time someone chose something over him.',
  },
  justawoman: {
    wound:    'The people who love her most become the ceiling she has to push through.',
    patterns: [
      'stop', 'too much', 'realistic', 'practical', 'not sure', 'worried',
      'slow down', 'careful', 'maybe don\'t', 'is it worth', 'afford',
      'what if it doesn\'t', 'already have', 'enough',
    ],
    echo: 'She has heard this before \u2014 from people who loved her and meant well.',
  },
  lala: {
    wound:    'She has never had to earn belief in herself. She doesn\'t know that yet.',
    patterns: [
      'where did that come from', 'always known', 'just feels right',
      'natural', 'easy for you', 'born with', 'lucky', 'effortless',
    ],
    echo: 'A flicker \u2014 like she learned this somewhere she can\'t remember.',
  },
  the_comparison_creator: {
    wound:    'She has been made into a mirror for other people\'s inadequacy her whole life.',
    patterns: [
      'because of you', 'your fault', 'makes me feel', 'compared to you',
      'wish i was', 'why can\'t i', 'you make it look', 'unlike me',
    ],
    echo: 'She has been someone\'s measuring stick before. She is tired of it.',
  },
  the_almost_mentor: {
    wound:    'They were never fully saved by anyone either. They built it alone.',
    patterns: [
      'need you', 'help me', 'don\'t leave', 'stay', 'where were you',
      'you disappeared', 'i needed you', 'show me', 'teach me',
    ],
    echo: 'They wanted someone to stay for them once too.',
  },
  the_witness: {
    wound:    'She has watched people she loves repeat the same cycle her whole life.',
    patterns: [
      'again', 'same thing', 'always does this', 'every time',
      'here we go', 'like before', 'pattern', 'cycle', 'won\'t change',
    ],
    echo: 'She has watched this exact sequence before. She knows how it ends.',
  },
};

// ── SAFE AI CALL ──────────────────────────────────────────────────────────

async function safeAI(prompt, maxTokens = 600) {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    });
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    console.error('AI call failed:', err.message);
    try {
      const res = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }],
      });
      return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    } catch (err2) {
      console.error('AI fallback failed:', err2.message);
      return null;
    }
  }
}

// ── DEJA VU DETECTION ────────────────────────────────────────────────────

function detectDejaVu(archetypeKey, eventText, conversationText = '') {
  const patterns = WOUND_PATTERNS[archetypeKey];
  if (!patterns) return { triggered: false };
  const combined = (eventText + ' ' + conversationText).toLowerCase();
  const matched  = patterns.patterns.filter(p => combined.includes(p.toLowerCase()));
  if (matched.length >= 2) {
    return {
      triggered:  true,
      wound:      patterns.wound,
      echo:       patterns.echo,
      trigger:    matched.slice(0, 2).join(', '),
      wound_echo: patterns.echo,
    };
  }
  return { triggered: false };
}

// ── EMOTIONAL STATE UPDATE ────────────────────────────────────────────────

function updateEmotionalState(current, baseline, shifts = {}) {
  const next = { ...current };
  for (const [dim, delta] of Object.entries(shifts)) {
    if (next[dim] !== undefined) {
      next[dim] = Math.max(baseline[dim] || 0, Math.min(10, next[dim] + delta));
    }
  }
  return next;
}

// ── BUILD THERAPY CONTEXT ────────────────────────────────────────────────

function buildTherapyContext(body) {
  const {
    character_name, archetype, nature,
    emotional_state, baseline, known, sensed, never_knows,
    primary_defense, deja_vu_events, sessions_completed,
  } = body;

  const highEmotions = Object.entries(emotional_state || {})
    .filter(([, v]) => v >= 6)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  const knowledgeContext = [
    known?.length     ? `KNOWS CONSCIOUSLY: ${known.slice(-5).join(' / ')}` : '',
    sensed?.length    ? `SENSES BUT CANNOT NAME: ${sensed.slice(-5).join(' / ')}` : '',
    never_knows?.length ? `[AUTHOR LOCKED \u2014 CHARACTER NEVER KNOWS: ${never_knows.join(' / ')}]` : '',
  ].filter(Boolean).join('\n');

  return `CHARACTER: ${character_name} (archetype: ${archetype})
NATURE: ${nature?.nature || 'Unknown'}
WOUND: ${nature?.wound || 'Unknown'}
UNSAYABLE THING: ${nature?.unsayable || 'Unknown'}
PRIMARY DEFENSE: ${primary_defense || 'rationalize'}
SESSIONS COMPLETED: ${sessions_completed || 0}

EMOTIONAL STATE (1\u201310): ${JSON.stringify(emotional_state)}
${highEmotions ? `ELEVATED: ${highEmotions}` : ''}

${knowledgeContext}

CRITICAL RULES:
\u2014 This character only knows what is listed under KNOWS CONSCIOUSLY.
\u2014 They sense what is under SENSES but cannot articulate it clearly.
\u2014 They must NEVER reference anything under AUTHOR LOCKED.
\u2014 Their nature is constitutional \u2014 it shapes every response regardless of content.
\u2014 Their wound colors how they interpret every event.
\u2014 They are NOT performing for anyone. This is private.
\u2014 First person. Authentic. Contradictions are allowed \u2014 encouraged.
\u2014 Short sentences when emotion peaks. Longer when they\u2019re processing.
\u2014 Never neat. Never resolved at the end. They leave still carrying something.`;
}

// ════════════════════════════════════════════════════════════════════════
// ROUTE 1: POST /session-open
// ════════════════════════════════════════════════════════════════════════

router.post('/session-open', optionalAuth, async (req, res) => {
  try {
    const { event, ...rest } = req.body;
    const archetypeKey = rest.archetype?.toLowerCase().replace(/\s+/g,'_').replace(/the_/,'');
    const context = buildTherapyContext(rest);

    const dejaVu = detectDejaVu(archetypeKey, event);

    const emotionalShifts = {
      confusion: +2,
      fear:      dejaVu.triggered ? +2 : +1,
      anger:     rest.primary_defense === 'confront' ? +2 : 0,
    };
    const updatedState = updateEmotionalState(
      rest.emotional_state || {},
      rest.baseline || {},
      emotionalShifts
    );

    const dejaVuInstruction = dejaVu.triggered
      ? `\nDEJA VU TRIGGERED: The event pattern matches their wound.
         They feel a familiar dread they cannot explain \u2014 "${dejaVu.echo}"
         This feeling should surface subtly in their opening \u2014 not named, just felt.
         A hesitation. A sentence that trails. A metaphor that comes from nowhere.`
      : '';

    const prompt = `${context}

WHAT JUST HAPPENED IN THE STORY:
"${event}"
${dejaVuInstruction}

The character just knocked on the door and came in.
They are carrying this event. They don't fully understand it yet.
They are coming to the author \u2014 the one person who knows everything \u2014 to process it.

Write their opening. How they arrive. What they lead with.
NOT what actually happened \u2014 what they THINK happened, filtered through their wound.

Remember: they have limited knowledge. They interpret events through their nature.
Their defense mechanism shapes how they present this \u2014 not raw emotion, processed through ${rest.primary_defense || 'rationalization'}.

2\u20134 sentences. They are beginning, not concluding. End with something unresolved.`;

    const opening = await safeAI(prompt, 250)
      || `I've been sitting with this for a while. Something happened and I'm not sure how to feel about it.`;

    res.json({
      opening,
      deja_vu_triggered:    dejaVu.triggered,
      deja_vu_event:        dejaVu.triggered ? {
        trigger:    event.slice(0, 60),
        wound_echo: dejaVu.echo,
      } : null,
      updated_emotional_state: updatedState,
    });

  } catch (err) {
    console.error('POST /session-open error:', err);
    res.json({
      opening: `I've been sitting with this. Something happened and I don't know what to make of it.`,
      deja_vu_triggered: false,
      deja_vu_event: null,
      updated_emotional_state: req.body.emotional_state,
    });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 2: POST /session-respond
// ════════════════════════════════════════════════════════════════════════

router.post('/session-respond', optionalAuth, async (req, res) => {
  try {
    const {
      author_response,
      conversation,
      ...rest
    } = req.body;

    const archetypeKey = rest.archetype?.toLowerCase().replace(/\s+/g,'_').replace(/the_/,'');
    const context = buildTherapyContext(rest);

    const historyText = (conversation || [])
      .slice(-6)
      .map(m => `${m.role === 'character' ? rest.character_name : 'AUTHOR'}: ${m.content}`)
      .join('\n\n');

    const fullConvoText = conversation?.map(m => m.content).join(' ') || '';
    const dejaVu = detectDejaVu(archetypeKey, author_response, fullConvoText);

    const THRESHOLDS = [
      { id: 'anger',    level: 7, note: 'says the thing they promised never to say' },
      { id: 'fear',     level: 7, note: 'freezes or flees instead of responding' },
      { id: 'grief',    level: 6, note: 'stops protecting the wound \u2014 it shows' },
      { id: 'shame',    level: 7, note: 'collapses inward \u2014 becomes unavailable' },
      { id: 'hope',     level: 7, note: 'acts against their own protection \u2014 takes the risk' },
      { id: 'betrayal', level: 6, note: 'rewrites the history to protect themselves' },
    ];
    const state = rest.emotional_state || {};
    const thresholdCrossed = THRESHOLDS.find(t => (state[t.id] || 0) >= t.level) || null;

    const dejaVuInstruction = dejaVu.triggered
      ? `\nDEJA VU TRIGGERED by author's words: "${dejaVu.echo}"
         Let it surface as a flicker \u2014 a phrase that comes from nowhere,
         a hesitation, a moment where they seem to be remembering something they can't place.`
      : '';

    const thresholdInstruction = thresholdCrossed
      ? `\nTHRESHOLD: Their ${thresholdCrossed.id} is at ${state[thresholdCrossed.id]}/10.
         At this level, this character ${thresholdCrossed.note}.
         This should happen in their response \u2014 not announced, just present.`
      : '';

    const prompt = `${context}

CONVERSATION SO FAR:
${historyText}

AUTHOR JUST SAID:
"${author_response}"
${dejaVuInstruction}
${thresholdInstruction}

Respond as ${rest.character_name}.
They are processing what the author just told them through their nature and wound.
They might push back. They might get quieter. They might say something that surprises even them.
They are NOT performing. They are not trying to impress anyone.

Remember: their defense mechanism is ${rest.primary_defense || 'rationalize'}.
They will use it \u2014 consciously or not.

2\u20134 sentences. Still not resolved. They are in the middle of something.`;

    const response = await safeAI(prompt, 250)
      || `I hear you. I'm just not sure that changes how I feel about it.`;

    const authorLower = author_response.toLowerCase();
    const shifts = {};
    if (authorLower.includes('angry') || authorLower.includes('mad')) shifts.anger = +1;
    if (authorLower.includes('afraid') || authorLower.includes('scared')) shifts.fear = +1;
    if (authorLower.includes('you\'re right') || authorLower.includes('i know')) shifts.confusion = -1;
    if (dejaVu.triggered) { shifts.fear = (shifts.fear || 0) + 1; }
    if (thresholdCrossed?.id === 'hope') shifts.hope = +1;

    const updatedState = updateEmotionalState(state, rest.baseline || {}, shifts);

    const notePrompt = `Given this character exchange, write ONE sentence (max 12 words) capturing
what was newly revealed about ${rest.character_name}'s psychology.
Start with their name. Be specific to what just happened.
Exchange: Author said "${author_response.slice(0,100)}" / Character responded "${response.slice(0,100)}"`;

    const sessionNote = await safeAI(notePrompt, 60) || null;

    res.json({
      response,
      updated_emotional_state: updatedState,
      deja_vu_triggered:       dejaVu.triggered,
      deja_vu_event:           dejaVu.triggered ? { trigger: author_response.slice(0,60), wound_echo: dejaVu.echo } : null,
      threshold_crossed:       thresholdCrossed ? { dimension: thresholdCrossed.id, note: thresholdCrossed.note } : null,
      session_note:            sessionNote,
    });

  } catch (err) {
    console.error('POST /session-respond error:', err);
    res.json({
      response: `I hear you. I just need a moment with that.`,
      updated_emotional_state: req.body.emotional_state,
      deja_vu_triggered: false,
      threshold_crossed: null,
      session_note: null,
    });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 3: POST /reveal
// ════════════════════════════════════════════════════════════════════════

router.post('/reveal', optionalAuth, async (req, res) => {
  try {
    const {
      reveal_content,
      reveal_type,
      conversation,
      ...rest
    } = req.body;

    const context = buildTherapyContext(rest);
    const historyText = (conversation || [])
      .slice(-4)
      .map(m => `${m.role === 'character' ? rest.character_name : 'AUTHOR'}: ${m.content}`)
      .join('\n\n');

    const REVEAL_PROMPTS = {
      full: `The author just gave them the full truth: "${reveal_content}"
They now CONSCIOUSLY KNOW this. It costs them something.
Truth received at this level shifts the ground underneath them.
How do they receive it? NOT with neat acceptance.
With their defense mechanism activated. With their wound fresh.
The cost might be: having to rewrite what they believed.
Having to admit something about themselves. Losing a protection.
Write their response \u2014 3\u20135 sentences. Something in them shifts. It shows.`,

      partial: `The author gave them a partial truth \u2014 enough to sense but not enough to name.
"${reveal_content}"
They feel the shape of something without seeing it clearly.
It lands like: a familiar feeling they can't source.
A sentence they can't finish. A knowing that sits just below language.
Write their response \u2014 2\u20134 sentences. They sense. They don't know. That gap is uncomfortable.`,

      never: `The author has decided this character will NEVER know: "${reveal_content}"
The author is not telling them this. The author is locking it.
But the character is in the room. They are still talking.
Write what they say in this moment \u2014 unaware of what they will never find out.
Something ordinary. Something that shows how the not-knowing shapes them
without them realizing. 2\u20133 sentences.`,
    };

    const revealInstruction = REVEAL_PROMPTS[reveal_type] || REVEAL_PROMPTS.partial;

    const prompt = `${context}

CONVERSATION SO FAR:
${historyText}

${revealInstruction}

Their nature: ${rest.nature?.nature || 'unknown'}
Their defense: ${rest.primary_defense || 'rationalize'}

Character response only. No explanation. No preamble.`;

    const response = await safeAI(prompt, 300)
      || (reveal_type === 'never'
        ? `I think I just need to accept that I might not get everything I want from this.`
        : `I don't know what to do with that. I need a minute.`);

    const costPrompt = reveal_type !== 'never'
      ? `In 10 words or fewer: what does receiving this truth cost ${rest.character_name}?
         Truth: "${reveal_content}"
         Nature: "${rest.nature?.wound}"
         Be specific. Start with a verb.`
      : null;

    const revelationCost = costPrompt ? (await safeAI(costPrompt, 40)) : null;

    const shifts = reveal_type === 'full'
      ? { confusion: -2, grief: +2, hope: reveal_content.toLowerCase().includes('love') ? +1 : 0 }
      : reveal_type === 'partial'
      ? { confusion: +1, longing: +1 }
      : {};

    const updatedState = updateEmotionalState(
      rest.emotional_state || {},
      rest.baseline || {},
      shifts
    );

    res.json({
      response,
      revelation_cost:         revelationCost,
      updated_emotional_state: updatedState,
      session_note:            `${rest.character_name}: ${reveal_type === 'never' ? 'locked from knowing \u2014 ' : 'received \u2014 '}${reveal_content.slice(0,50)}`,
    });

  } catch (err) {
    console.error('POST /reveal error:', err);
    res.json({
      response: `I don't know what to do with that.`,
      revelation_cost: null,
      updated_emotional_state: req.body.emotional_state,
      session_note: null,
    });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 4: POST /session-close
// ════════════════════════════════════════════════════════════════════════

router.post('/session-close', optionalAuth, async (req, res) => {
  try {
    const {
      character_id,
      emotional_state,
      baseline,
      known,
      sensed,
      never_knows,
      deja_vu_events,
      session_log,
      sessions_completed,
    } = req.body;

    const models = req.app.get('models');

    const updatedBaseline = { ...(baseline || {}) };
    if ((emotional_state?.fear || 0) >= 7 && (updatedBaseline.fear || 0) < 6) {
      updatedBaseline.fear = (updatedBaseline.fear || 0) + 0.5;
    }
    if ((emotional_state?.betrayal || 0) >= 6 && (updatedBaseline.betrayal || 0) < 5) {
      updatedBaseline.betrayal = (updatedBaseline.betrayal || 0) + 0.5;
    }

    const decayedState = {};
    for (const [dim, val] of Object.entries(emotional_state || {})) {
      const base = updatedBaseline[dim] || 0;
      decayedState[dim] = val > base
        ? Math.max(base, val - 1)
        : val;
    }

    if (models?.CharacterTherapyProfile) {
      await models.CharacterTherapyProfile.upsert({
        character_id,
        emotional_state:     decayedState,
        baseline:            updatedBaseline,
        known:               known || [],
        sensed:              sensed || [],
        never_knows:         never_knows || [],
        deja_vu_events:      deja_vu_events || [],
        sessions_completed:  sessions_completed || 1,
        session_log_history: session_log || [],
      });
    }

    res.json({
      ok:               true,
      decayed_state:    decayedState,
      updated_baseline: updatedBaseline,
    });

  } catch (err) {
    console.error('POST /session-close error:', err);
    res.json({ ok: true });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 5: GET /profile/:charId
// ════════════════════════════════════════════════════════════════════════

router.get('/profile/:charId', optionalAuth, async (req, res) => {
  try {
    const { charId } = req.params;
    const models = req.app.get('models');

    if (!models?.CharacterTherapyProfile) {
      return res.json({});
    }

    const profile = await models.CharacterTherapyProfile.findOne({
      where: { character_id: charId },
    });

    res.json(profile || {});

  } catch (err) {
    console.error('GET /profile error:', err);
    res.json({});
  }
});

module.exports = router;
