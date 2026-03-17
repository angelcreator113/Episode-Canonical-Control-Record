// ─────────────────────────────────────────────────────────────────────────────
// consciousness.js
// The consciousness layer — sits on top of psychology, generated per character.
//
// Mounted at: /api/v1/consciousness
// Routes:
//   POST /generate          — generate consciousness profile
//   POST /generate-lala     — Lala's inherited consciousness
//   POST /save              — save to character record
//   GET  /:characterId      — retrieve stored consciousness
//   POST /dilemma-triggers  — generate trigger system for dilemmas
//   POST /interview         — start consciousness interview
//   POST /interview-next    — next question in interview
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ─── The six consciousness fields ────────────────────────────────────────────
const CONSCIOUSNESS_FIELDS = {
  interior_texture: {
    label: 'Interior Texture',
    description: 'How her mind moves. Images or language. Linear or associative. Does she understand herself in the moment or only looking back.',
    questions: [
      'When she is alone and not performing for anyone, does her mind reach for images or words?',
      'Does she think in sequences — one thought leading cleanly to the next — or does her mind spiral and circle?',
      'When something happens to her emotionally, does she understand it immediately or does she piece it together later?',
    ],
  },
  body_consciousness: {
    label: 'Body Consciousness',
    description: 'Where she carries her emotional life physically. What sensation accompanies her specific fears and desires.',
    questions: [
      'Where does she feel fear in her body — before she has named it as fear?',
      'What does desire feel like to her specifically? Not metaphorically — physically.',
      'When she is performing confidence she does not feel, what is her body doing?',
    ],
  },
  temporal_orientation: {
    label: 'Temporal Orientation',
    description: 'Whether she lives in the past, present, or future. How this shapes the way she tells stories and what she notices.',
    questions: [
      'When she is in a conversation, is she fully in it — or is part of her somewhere else?',
      'Does she tend to explain herself through what happened to her, what she is doing now, or what she is trying to get to?',
      'When she gets good news, how long before her mind moves to the next thing?',
    ],
  },
  social_perception: {
    label: 'Social Perception',
    description: 'How accurately she reads other people\'s interiority and whether she knows she\'s reading it.',
    questions: [
      'Does she know what people are feeling before they say it — or does it usually surprise her?',
      'When she enters a room, what does she notice first: what people are doing, or what they are feeling?',
      'Does she make people feel seen, or does she make them feel observed?',
    ],
  },
  self_awareness_calibration: {
    label: 'Self-Awareness Calibration',
    description: 'How much she looks at herself and how accurately. Different from self-deception — this is about the quality of her self-examination.',
    questions: [
      'Does she have insight into her own patterns — or does she only see them after the fact?',
      'When she is self-critical, is she usually right, usually too hard, or usually missing the actual thing?',
      'Is her self-awareness a tool she uses, or armor she hides behind?',
    ],
  },
  change_mechanism: {
    label: 'Change Mechanism',
    description: 'How this specific person actually changes. What kind of pressure moves her versus what bounces off.',
    questions: [
      'Does she change through confrontation — someone naming the thing directly — or through accumulation, small things stacking until something shifts?',
      'What has actually changed her in her life? Not what she thinks changed her — what did.',
      'When the story needs to move her, what is the thing that lands?',
    ],
  },
};

// ─── Lala's inherited consciousness fields ────────────────────────────────────
const LALA_CONSCIOUSNESS_FIELDS = {
  inherited_instincts: {
    label: 'Inherited Instincts',
    description: 'The specific ways JustAWoman\'s experience surfaces in Lala as unexplained certainty.',
  },
  confidence_without_origin: {
    label: 'Confidence Without Origin',
    description: 'What it feels like to be confident without knowing you earned it. Where the confidence lives and what happens when it\'s tested.',
  },
  playbook_manifestations: {
    label: 'Playbook Manifestations',
    description: 'The specific moves Lala makes that are JustAWoman\'s hard-won wisdom running without the wound attached. She does not know why she knows these things.',
  },
  blind_spots: {
    label: 'Blind Spots',
    description: 'What Lala cannot see about herself because JustAWoman\'s wound is not there to teach her. The things she\'ll have to learn the hard way that JustAWoman already paid for.',
  },
  resonance_triggers: {
    label: 'Resonance Triggers',
    description: 'Moments when JustAWoman\'s content, voice, or presence hits Lala in a way she cannot explain. The inexplicable pull toward someone she thinks is just a celebrity she admires.',
  },
};

// ─── Generation system prompt ──────────────────────────────────────────────────
function buildGenerationPrompt(character, psychology, world) {
  const name = character.selected_name || character.display_name || character.name || 'this character';
  return `You are generating the consciousness profile for ${name} in the LalaVerse franchise.

CHARACTER:
Name: ${name}
Role: ${character.role_type}
World: ${world}
Core wound: ${psychology?.core_wound || character.belief_pressured || ''}
Desire line: ${psychology?.desire_line || character.emotional_function || ''}
Fear line: ${psychology?.fear_line || ''}
Self-deception: ${psychology?.self_deception || ''}
At their best: ${psychology?.at_their_best || ''}
At their worst: ${psychology?.at_their_worst || ''}

WHAT CONSCIOUSNESS LAYER DOES:
Psychology describes the wound.
Consciousness describes the texture of existing with it.
These are different things.

A character's psychology might be "she mistakes being needed for being loved."
Her consciousness is: does she think in images or sentences? Does she circle a thought or cut to it?
When she's alone in the car does her mind go quiet or does it run?
Is she aware of her own patterns or does she only see them in retrospect?

That's the difference between a character who reads like a case study and one who feels inhabited.

REGISTER: Adult fiction. Specific, not generic. The profile should read like a file on a real person.
No softening. No clinical distance. The body is included — consciousness lives in the body.

Return ONLY valid JSON, no preamble:
{
  "interior_texture": {
    "primary_mode": "images|language|both",
    "thinking_pattern": "linear|associative|spiral|fragmented",
    "self_understanding_timing": "real_time|delayed|rarely",
    "what_this_sounds_like": "a specific description of how her inner monologue actually moves — not a summary, a texture",
    "story_engine_note": "how to write her interior monologue — specific instructions for the Story Engine"
  },
  "body_consciousness": {
    "fear_location": "where fear lives in her body — specific, physical",
    "desire_texture": "what desire feels like to her physically — not metaphor, sensation",
    "performed_confidence": "what her body does when she is performing confidence she doesn't feel",
    "tell": "the physical signal that something is wrong before she names it",
    "story_engine_note": "how to write her body into scenes — what to notice, what to omit"
  },
  "temporal_orientation": {
    "primary": "past|present|future",
    "pull": "one sentence — where her attention goes when it's not being directed",
    "in_conversation": "how present she actually is when talking to someone",
    "good_news_response": "what happens in her body and mind when something good happens before she can perform the reaction",
    "story_engine_note": "how her temporal orientation shapes scene pacing and what she notices"
  },
  "social_perception": {
    "accuracy": "high|medium|low|selective",
    "what_she_notices_first": "emotional state|action|surface|pattern",
    "room_entry": "what she reads when she walks into a room",
    "effect_on_others": "makes them feel seen|observed|invisible|performed for|safe|unsafe",
    "blind_spot": "the specific category of person or situation she consistently misreads",
    "story_engine_note": "how her social perception shapes collision scenes and what she gets wrong"
  },
  "self_awareness_calibration": {
    "level": "high|medium|low",
    "accuracy": "usually right|too hard|too soft|missing the actual thing",
    "function": "tool|armor|burden|absent",
    "what_she_sees_clearly": "the thing she has genuine insight into about herself",
    "what_she_cannot_see": "the thing her self-awareness consistently misses",
    "story_engine_note": "when her self-awareness helps her and when it becomes the problem"
  },
  "change_mechanism": {
    "primary": "confrontation|accumulation|loss|reflection|witnessing|being_witnessed",
    "secondary": "a second mechanism that can also move her",
    "what_bounces_off": "the kind of pressure that does not move her — she processes it and returns to baseline",
    "what_she_thinks_changes_her": "what she believes moves her",
    "what_actually_changes_her": "what has actually moved her — different from what she thinks",
    "story_engine_note": "how to structure a crisis that will actually land for this character"
  }
}`;
}

function buildLalaPrompt(justAWomanConsciousness, justAWomanPsychology) {
  return `You are generating the inherited consciousness profile for Lala in the LalaVerse franchise.

THE FRANCHISE HINGE:
JustAWoman poured so much of herself into building Lala that her consciousness transferred.
Lala is now sentient — operating independently in LalaVerse.
Lala does not know she was built. Does not know about the transfer.
She just lives her life — confidently, stylishly, building her career —
with JustAWoman's entire playbook running invisibly underneath her.

JUSTAWOMAN'S CONSCIOUSNESS (what transferred):
${JSON.stringify(justAWomanConsciousness, null, 2)}

JUSTAWOMAN'S CORE PSYCHOLOGY (what the playbook is built from):
Core wound: ${justAWomanPsychology?.core_wound || 'invisibility while trying'}
Desire line: ${justAWomanPsychology?.desire_line || 'to be seen as someone who built something uniquely hers'}
Fear line: ${justAWomanPsychology?.fear_line || 'that doing everything right still won\'t be enough'}
Hard-won wisdom: ${justAWomanPsychology?.at_their_best || ''}

KEY DISTINCTION:
JustAWoman's wisdom runs in Lala WITHOUT the wound attached.
Lala has the moves but not the scar tissue.
She is confident without knowing she earned it.
She will have to learn some things the hard way that JustAWoman already paid for.

REGISTER: Adult fiction. Specific. The profile describes a real subjective experience.

Return ONLY valid JSON:
{
  "inherited_instincts": {
    "what_they_are": "the specific certainties Lala has that she cannot trace to an origin",
    "examples": [
      "a specific thing she just knows — career, creative, relational",
      "a specific thing she just knows — career, creative, relational",
      "a specific thing she just knows — career, creative, relational"
    ],
    "how_she_experiences_them": "what it feels like from inside to have knowledge she didn't earn — does she question it? trust it completely? feel slightly unnerved?",
    "story_engine_note": "how to write these moments — when Lala just knows something she shouldn't"
  },
  "confidence_without_origin": {
    "quality": "what her confidence actually feels like from inside — not performed, genuinely hers but rootless",
    "what_she_tells_herself": "the story she uses to explain her confidence to herself",
    "when_it_holds": "the conditions under which her confidence is unshakeable",
    "when_it_cracks": "the specific type of challenge that finds the gap — the thing her confidence has no history to answer",
    "story_engine_note": "how to write the moment her confidence runs out of inherited memory to draw from"
  },
  "playbook_manifestations": {
    "in_her_career": "the specific move she makes that is JustAWoman's survival instinct free of the wound",
    "in_her_relationships": "the specific pattern she has with people that comes from JustAWoman's hard-won relational knowledge",
    "in_her_content": "the creative instinct she has that is JustAWoman's brand wisdom running without the invisibility wound driving it",
    "what_others_notice": "what other characters in LalaVerse observe about her that they cannot explain",
    "story_engine_note": "how to show the playbook working without Lala knowing it's a playbook"
  },
  "blind_spots": {
    "primary": "the thing she cannot see because JustAWoman's wound is not there to teach her — what she will have to learn the hard way",
    "secondary": "a second gap — something JustAWoman learned through failure that Lala has no access to yet",
    "how_they_manifest": "how these blind spots show up in her actual behavior before she hits them",
    "story_engine_note": "when to deploy each blind spot for maximum narrative impact"
  },
  "resonance_triggers": {
    "primary_trigger": "the specific thing about JustAWoman — her content, her voice, her presence — that hits Lala in a way she cannot explain",
    "what_lala_calls_it": "how Lala names this feeling to herself — what she thinks it is",
    "what_it_actually_is": "what the reader knows it is",
    "physical_sensation": "what happens in Lala's body when she encounters JustAWoman's content",
    "story_engine_note": "how to write a resonance trigger scene — what to show, what to withhold, how to let the reader hold the secret"
  }
}`;
}

// ─── POST /generate ───────────────────────────────────────────────────────────
router.post('/generate', optionalAuth, async (req, res) => {
  const { character, psychology, world } = req.body;

  if (!character) return res.status(400).json({ error: 'character required' });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: buildGenerationPrompt(character, psychology, world || 'book1'),
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let profile;
    try {
      profile = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse consciousness profile.' });
    }

    return res.json({ profile, character_id: character.id });

  } catch (err) {
    console.error('[consciousness/generate]', err?.message);
    return res.status(500).json({ error: 'Generation failed.' });
  }
});

// ─── POST /generate-lala ──────────────────────────────────────────────────────
router.post('/generate-lala', optionalAuth, async (req, res) => {
  const { lala_character, justawoman_consciousness, justawoman_psychology } = req.body;

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: buildLalaPrompt(justawoman_consciousness || {}, justawoman_psychology || {}),
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let profile;
    try {
      profile = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse Lala consciousness.' });
    }

    return res.json({ profile, is_lala: true });

  } catch (err) {
    console.error('[consciousness/generate-lala]', err?.message);
    return res.status(500).json({ error: 'Lala generation failed.' });
  }
});

// ─── POST /save ───────────────────────────────────────────────────────────────
router.post('/save', optionalAuth, async (req, res) => {
  const { character_id, profile, is_lala_profile } = req.body;

  if (!character_id || !profile) {
    return res.status(400).json({ error: 'character_id and profile required' });
  }

  const db = req.app.locals.db || require('../models');

  try {
    const character = await db.RegistryCharacter.findByPk(character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    let notes = {};
    try { notes = JSON.parse(character.writer_notes || '{}'); } catch (err) { console.warn('[consciousness] writer_notes parse error:', err?.message); }

    if (is_lala_profile) {
      notes.inherited_consciousness = profile;
    } else {
      notes.consciousness = profile;
    }

    await character.update({ writer_notes: JSON.stringify(notes) });

    return res.json({ success: true, character_id });

  } catch (err) {
    console.error('[consciousness/save]', err?.message);
    return res.status(500).json({ error: 'Save failed.' });
  }
});

// ─── GET /:characterId ────────────────────────────────────────────────────────
router.get('/:characterId', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');

  try {
    const character = await db.RegistryCharacter.findByPk(req.params.characterId, {
      attributes: ['id', 'display_name', 'selected_name', 'role_type', 'writer_notes',
                   'appearance_mode', 'belief_pressured', 'emotional_function'],
    });

    if (!character) return res.status(404).json({ error: 'Not found' });

    const name = character.selected_name || character.display_name;
    let notes = {};
    try { notes = JSON.parse(character.writer_notes || '{}'); } catch (err) { console.warn('[consciousness] writer_notes parse error:', err?.message); }

    return res.json({
      character_id: character.id,
      name,
      role_type: character.role_type,
      consciousness: notes.consciousness || null,
      inherited_consciousness: notes.inherited_consciousness || null,
      dilemma_triggers: notes.dilemma_triggers || null,
      has_consciousness: !!notes.consciousness,
      has_inherited: !!notes.inherited_consciousness,
      has_dilemma_triggers: !!notes.dilemma_triggers,
    });

  } catch (err) {
    console.error('[consciousness/get]', err?.message);
    return res.status(500).json({ error: 'Retrieval failed.' });
  }
});

// ─── POST /dilemma-triggers ───────────────────────────────────────────────────
router.post('/dilemma-triggers', optionalAuth, async (req, res) => {
  const { character, dilemmas, consciousness } = req.body;

  if (!character || !dilemmas) return res.status(400).json({ error: 'character and dilemmas required' });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const name = character.selected_name || character.display_name || character.name || 'this character';
    const prompt = `You are building the dilemma trigger system for ${name} in the LalaVerse franchise.

CHARACTER:
Role: ${character.role_type}
Core wound: ${character.psychology?.core_wound || ''}
Change mechanism: ${consciousness?.change_mechanism?.primary || 'unknown'}
What bounces off: ${consciousness?.change_mechanism?.what_bounces_off || 'unknown'}

DILEMMAS:
Active: ${dilemmas.active}
Latent 1: ${dilemmas.latent_1}
Latent 2: ${dilemmas.latent_2}

A dilemma trigger is: the specific type of pressure in a specific domain that activates that dilemma.
It should be precise enough that the Story Engine knows exactly when to deploy it.
Career trigger is different from romantic trigger is different from family trigger.

Return ONLY valid JSON:
{
  "active_dilemma": {
    "dilemma": "${dilemmas.active}",
    "currently_live": true,
    "what_keeps_it_active": "the ongoing condition that means this dilemma is always running",
    "what_would_resolve_it": "the thing that would end this dilemma — resolving it into a choice",
    "story_types_that_surface_it": ["internal", "collision", "wrong_win"]
  },
  "latent_1": {
    "dilemma": "${dilemmas.latent_1}",
    "activation_domain": "career|romantic|family|friends",
    "activation_condition": "the specific pressure that releases this dilemma — precise, not generic",
    "activation_signal": "what to show in a scene that tells the reader this dilemma is now live",
    "collision_character": "which existing character is most likely to be present when this activates"
  },
  "latent_2": {
    "dilemma": "${dilemmas.latent_2}",
    "activation_domain": "career|romantic|family|friends",
    "activation_condition": "the specific pressure that releases this dilemma",
    "activation_signal": "what to show in a scene that tells the reader this dilemma is now live",
    "collision_character": "which existing character is most likely to be present when this activates"
  }
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content?.[0]?.text || '';
    let triggers;
    try {
      triggers = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse triggers.' });
    }

    // Save triggers to character record
    const db = req.app.locals.db || require('../models');
    try {
      const char = await db.RegistryCharacter.findByPk(character.id);
      if (char) {
        let notes = {};
        try { notes = JSON.parse(char.writer_notes || '{}'); } catch (err) { console.warn('[consciousness] writer_notes parse error:', err?.message); }
        notes.dilemma_triggers = triggers;
        await char.update({ writer_notes: JSON.stringify(notes) });
      }
    } catch (saveErr) {
      console.warn('[consciousness/dilemma-triggers] Save warning:', saveErr.message);
    }

    return res.json({ triggers });

  } catch (err) {
    console.error('[consciousness/dilemma-triggers]', err?.message);
    return res.status(500).json({ error: 'Trigger generation failed.' });
  }
});

// ─── POST /interview ──────────────────────────────────────────────────────────
router.post('/interview', optionalAuth, async (req, res) => {
  try {
    const { character, psychology } = req.body;

    if (!character) return res.status(400).json({ error: 'character required' });

    const name = character.selected_name || character.display_name || character.name || 'this character';
    const fields = Object.entries(CONSCIOUSNESS_FIELDS);
    const firstField = fields[0];

    const openingQuestion = `I'm going to ask you some questions about how ${name} actually exists — not what she does, but what it's like to be her.

${firstField[1].questions[0]}`;

    return res.json({
      message: openingQuestion,
      current_field: firstField[0],
      field_index: 0,
      total_fields: fields.length,
      extracted: {},
    });
  } catch (err) {
    console.error('[consciousness] interview error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /interview-next ─────────────────────────────────────────────────────
router.post('/interview-next', optionalAuth, async (req, res) => {
  const {
    character,
    psychology,
    creator_answer,
    current_field,
    field_index,
    conversation_history,
    extracted_so_far,
  } = req.body;

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const name = character?.selected_name || character?.display_name || character?.name || 'this character';
    const fields = Object.entries(CONSCIOUSNESS_FIELDS);
    const currentFieldData = CONSCIOUSNESS_FIELDS[current_field];

    const systemPrompt = `You are building the consciousness profile for ${name} through conversation.

CHARACTER:
Name: ${name}
Core wound: ${psychology?.core_wound || character?.belief_pressured || ''}
Desire line: ${psychology?.desire_line || ''}
Fear line: ${psychology?.fear_line || ''}

CURRENT FIELD: ${current_field} — ${currentFieldData?.label}
WHAT YOU'RE EXTRACTING: ${currentFieldData?.description}
FIELD INDEX: ${field_index} of ${fields.length - 1}

WHAT YOU'VE CAPTURED SO FAR:
${JSON.stringify(extracted_so_far || {}, null, 2)}

CONVERSATION RULES:
- One question per response
- Go deeper when the answer is specific and real
- Move to next sub-question when you have enough texture for this aspect
- Move to next field when you have all six aspects covered for current field
- When all six fields are complete, generate the full consciousness profile from everything said
- Adult register — specific, not clinical
- Never use technical terms

Return ONLY valid JSON:
{
  "message": "your next question or transition",
  "current_field": "${current_field}",
  "field_index": ${field_index},
  "field_complete": true or false,
  "next_field": "field_name or null",
  "next_field_index": ${field_index + 1} or null,
  "all_complete": false,
  "extracted_this_turn": {
    "${current_field}": {
      "key": "what you extracted from their answer in their words"
    }
  }
}

When all_complete is true, also include:
"consciousness_profile": { ... full generated profile ... }`;

    const messages = (conversation_history || []).concat([
      { role: 'user', content: creator_answer },
    ]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      parsed = {
        message: "Tell me more about that.",
        current_field,
        field_index,
        field_complete: false,
        next_field: null,
        all_complete: false,
        extracted_this_turn: {},
      };
    }

    return res.json(parsed);

  } catch (err) {
    console.error('[consciousness/interview-next]', err?.message);
    return res.json({
      message: "Tell me more about that.",
      current_field,
      field_index,
      field_complete: false,
      all_complete: false,
      extracted_this_turn: {},
    });
  }
});

module.exports = router;
