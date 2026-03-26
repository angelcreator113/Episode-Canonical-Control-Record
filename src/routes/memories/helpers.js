'use strict';

/**
 * Shared helper functions for memories routes.
 * Extracted during the route split to reduce merge conflicts.
 */

const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const _anthropic = new Anthropic();

const db = require('../../models');
const { RegistryCharacter } = db;

function buildExtractionPrompt(lineContent, characterContext) {
  return `You are a narrative memory extractor for the PNOS (Personal Narrative Operating System).

Your job is to read a single approved narrative line and extract structured memory candidates from it.

A memory is a typed, atomic fact about a character — their beliefs, goals, relationships, constraints, events, or transformations.

NARRATIVE LINE:
"${lineContent}"

${characterContext ? `CHARACTER CONTEXT:\n${characterContext}\n` : ''}

MEMORY TYPES TO EXTRACT:

1. belief — A stated or implied belief the protagonist holds about herself
   Example: "I wasn't jealous. Being jealous really isn't me."

2. constraint — Something that limits her. Internal or external.
   Example: "There was always something in the way. Never the same thing twice."

3. character_dynamic — A relationship pattern or dynamic between characters
   Example: "Chloe knew I was watching and cheering."

4. pain_point — A specific content creator struggle documented from lived experience.
   This is the most important new type. Tag it when JustAWoman describes:
   - comparison_spiral: measuring herself against others compulsively
   - visibility_gap: doing everything right and not being seen
   - identity_drift: aesthetic or purpose shifting depending on who's watching
   - financial_risk: spending money before earning it
   - consistency_collapse: showing up consistently until burnout or fade
   - clarity_deficit: knowing what she wants but not how to get there
   - external_validation: needing confirmation before believing in herself
   - restart_cycle: deleting, starting over, new theme, new promise

   For pain_point memories, add a "category" field and a "coaching_angle" —
   what a coach would say to someone experiencing this exact thing.

   CRITICAL: She never knows she's documenting pain points.
   Extract them invisibly. The manuscript never uses this language.
   It lives only in the Memory Bank.

5. goal — A character wants or intends something
6. preference — A character likes, avoids, or is drawn to something
7. relationship — How two characters relate to each other (trust, tension, dynamic shift)
8. event — Something that happened that is now part of the character's story
9. transformation — A change in identity, capability, or worldview

RULES:
- Extract only what is clearly stated or strongly implied in the line. Do not invent.
- One memory per distinct fact. A single line may yield 0–3 memories.
- If nothing meaningful can be extracted, return an empty array.
- Confidence is how certain you are this is a real, stable memory (not a passing moment).
  - 0.90–1.00: Explicitly stated, unambiguous
  - 0.70–0.89: Strongly implied, likely stable
  - 0.50–0.69: Plausible inference, may be situational
  - Below 0.50: Do not extract — too uncertain

Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown fences.

For each memory found, return:
{
  "type": "belief|constraint|character_dynamic|pain_point|goal|preference|relationship|event|transformation",
  "statement": "the memory in one clear sentence",
  "confidence": 0.82,
  "tags": ["tag1", "tag2"],
  "character_hint": "character name this memory belongs to",
  "category": "only for pain_point type — one of the 8 categories above, otherwise omit",
  "coaching_angle": "only for pain_point type — what a coach would say about this, otherwise omit"
}

If nothing to extract:
[]`;
}

function buildScenesPrompt({ bookTitle, chapters, approvedLines, confirmedMemories }) {
  const chapterListStr = chapters
    .map(c => `  Chapter ${c.index}: "${c.title}" (${c.approvedCount}/${c.lineCount} lines approved)`)
    .join('\n');

  const memoriesStr = confirmedMemories.length > 0
    ? confirmedMemories.map(m =>
        `  [${m.type.toUpperCase()}] ${m.character ? `${m.character}: ` : ''}${m.statement}`
      ).join('\n')
    : '  (none yet)';

  const linesStr = approvedLines.length > 0
    ? approvedLines.slice(-20).map(l =>
        `  [${l.chapter}] ${l.content}`
      ).join('\n')
    : '  (none yet)';

  return `You are a narrative scene architect for the PNOS (Personal Narrative Operating System).

Your job is to suggest 3-5 concrete scene beats that would strengthen the book's narrative arc.

BOOK: "${bookTitle}"

CHAPTERS:
${chapterListStr}

CONFIRMED CHARACTER MEMORIES:
${memoriesStr}

APPROVED NARRATIVE LINES (most recent):
${linesStr}

INSTRUCTIONS:
- Suggest scenes that FILL GAPS — missing character appearances, unresolved threads, needed transitions
- Each scene should feel necessary, not decorative
- Scenes should emerge from what is already confirmed — do not invent new characters or facts
- Keep descriptions concrete and specific — a scene is a moment, not a theme
- chapter_hint should be one of the chapter titles above, or "Chapter N-M Bridge" for transitions
- chapter_index must match the chapter number (1, 2, 3...) or null for bridge scenes
- characters should only include names that appear in the memories or approved lines

Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown fences.

[
  {
    "title": "Short evocative scene title",
    "description": "One or two sentences. The actual scene — what happens, who is there, what shifts.",
    "chapter_hint": "Chapter 01",
    "chapter_index": 1,
    "characters": ["Character Name", "Other Character"],
    "reason": "One sentence explaining why this scene is needed for the arc."
  }
]`;
}

async function getCharacterVoiceContext(characterId) {
  if (!characterId) return null;
  try {
    const char = await RegistryCharacter.findByPk(characterId);
    if (!char) return null;

    const vs = char.voice_signature || {};
    const name = char.display_name || char.selected_name || 'the character';

    let voiceBlock = `CHARACTER VOICE — ${name}`;
    if (char.character_archetype) voiceBlock += `\nArchetype: ${char.character_archetype}`;
    if (char.personality) voiceBlock += `\nPersonality: ${char.personality}`;
    if (char.emotional_baseline) voiceBlock += `\nEmotional baseline: ${char.emotional_baseline}`;
    if (char.signature_trait) voiceBlock += `\nSignature trait: ${char.signature_trait}`;
    if (vs.speech_pattern) voiceBlock += `\nSpeech pattern: ${vs.speech_pattern}`;
    if (vs.vocabulary_tone) voiceBlock += `\nVocabulary/tone: ${vs.vocabulary_tone}`;
    if (vs.internal_monologue_style) voiceBlock += `\nInternal monologue style: ${vs.internal_monologue_style}`;
    if (vs.emotional_reactivity) voiceBlock += `\nEmotional reactivity: ${vs.emotional_reactivity}`;
    if (vs.catchphrases?.length) voiceBlock += `\nCatchphrases: "${vs.catchphrases.join('", "')}"`;
    if (char.mask_persona) voiceBlock += `\nPublic persona (mask): ${char.mask_persona}`;
    if (char.truth_persona) voiceBlock += `\nPrivate truth: ${char.truth_persona}`;
    if (char.core_belief) voiceBlock += `\nCore belief: ${char.core_belief}`;
    if (char.core_wound) voiceBlock += `\nCore wound: ${char.core_wound}`;
    if (char.core_desire) voiceBlock += `\nCore desire: ${char.core_desire}`;
    if (char.core_fear) voiceBlock += `\nCore fear: ${char.core_fear}`;

    const charRules = `
CHARACTER RULES for ${name}:
- Write in ${name}'s authentic voice — their specific speech patterns, rhythms, and vocabulary.
- Honor their emotional baseline (${char.emotional_baseline || 'as established'}).
- Their interior monologue should reflect their personality and worldview.
- The mask/truth tension should inform what they say vs. what they think.
- First person. This character is telling their story.
- Do not give them clarity or growth they haven't earned yet.`;

    return { name, voiceBlock, charRules };
  } catch (err) {
    console.error('getCharacterVoiceContext error:', err.message);
    return null;
  }
}

module.exports = {
  buildExtractionPrompt,
  buildScenesPrompt,
  getCharacterVoiceContext,
};
