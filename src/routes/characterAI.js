'use strict';

/**
 * src/routes/characterAI.js
 *
 * AI-powered character writing assistant.
 * Uses all available data (character profiles, memories, relationships,
 * universe context, approved lines) to help write story content.
 *
 * Base path: /api/v1/character-ai
 *
 * Endpoints:
 *   POST /write-scene           — Generate a scene featuring a character
 *   POST /character-monologue   — Generate inner monologue / voice piece
 *   POST /build-profile         — Auto-fill character profile from story data
 *   POST /suggest-gaps          — Identify what's underdeveloped
 *   POST /what-happens-next     — Predict/generate next story beat for character
 */

const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { Op } = require('sequelize');

// ── Auth middleware ──
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ── Models ──
const db = require('../models');
const {
  RegistryCharacter, CharacterRegistry, CharacterRelationship,
  StorytellerMemory, StorytellerLine, StorytellerBook, StorytellerChapter,
  CharacterTherapyProfile, Universe, BookSeries,
} = db;
const { buildUniverseContext } = require('../utils/universeContext');

// ── Anthropic ──
const anthropic = new Anthropic();
const PRIMARY_MODEL  = 'claude-sonnet-4-6';
const FALLBACK_MODEL = 'claude-sonnet-4-20250514';

async function callClaude(systemPrompt, userMessage, maxTokens = 4000) {
  const model = PRIMARY_MODEL;
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return res.content[0]?.text || '';
  } catch (err) {
    if (err.status === 529 || err.message?.includes('overloaded')) {
      const res = await anthropic.messages.create({
        model: FALLBACK_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      return res.content[0]?.text || '';
    }
    throw err;
  }
}


/* ─────────────────────────────────────────────
   SHARED: Gather all context for a character
   ───────────────────────────────────────────── */
async function gatherCharacterContext(characterId) {
  // 1. Character profile
  const character = await RegistryCharacter.findByPk(characterId, {
    include: [{ model: CharacterRegistry, as: 'registry' }],
  });
  if (!character) return null;

  // 2. Universe context (from registry → book)
  let universeContext = '';
  if (character.registry?.book_tag) {
    try {
      const book = await StorytellerBook.findOne({
        where: {
          [Op.or]: [
            { title: { [Op.iLike]: `%${character.registry.book_tag}%` } },
            { title: { [Op.iLike]: '%book 1%' } },
            { title: { [Op.iLike]: '%before lala%' } },
          ],
        },
      });
      if (book) {
        universeContext = await buildUniverseContext(book.id, db);
      }
    } catch (e) { /* no universe context */ }
  }

  // 3. Memories for this character
  let memories = [];
  try {
    memories = await StorytellerMemory.findAll({
      where: {
        character_id: characterId,
        confirmed: true,
      },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
  } catch (e) { /* no memories */ }

  // 4. Relationships
  let relationships = [];
  try {
    const charName = character.selected_name || character.display_name;
    relationships = await CharacterRelationship.findAll({
      where: {
        [Op.or]: [
          { source_name: { [Op.iLike]: `%${charName}%` } },
          { target_name: { [Op.iLike]: `%${charName}%` } },
        ],
      },
    });
  } catch (e) { /* no relationships */ }

  // 5. Therapy profile
  let therapy = null;
  try {
    therapy = await CharacterTherapyProfile.findOne({
      where: { character_id: characterId },
    });
  } catch (e) { /* no therapy */ }

  // 6. All characters in same registry (for ensemble context)
  let castMembers = [];
  try {
    castMembers = await RegistryCharacter.findAll({
      where: {
        registry_id: character.registry_id,
        id: { [Op.ne]: characterId },
      },
      attributes: ['display_name', 'selected_name', 'role_type', 'core_belief', 'core_wound', 'core_desire', 'subtitle'],
    });
  } catch (e) { /* no cast */ }

  // 7. Recent approved lines mentioning character
  let recentLines = [];
  try {
    const charName = character.selected_name || character.display_name;
    recentLines = await StorytellerLine.findAll({
      where: {
        status: { [Op.in]: ['approved', 'edited'] },
        text: { [Op.iLike]: `%${charName}%` },
      },
      order: [['created_at', 'DESC']],
      limit: 30,
    });
  } catch (e) { /* no lines */ }

  // 8. All approved lines (for general story context)
  let allApprovedLines = [];
  try {
    allApprovedLines = await StorytellerLine.findAll({
      where: { status: { [Op.in]: ['approved', 'edited'] } },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
  } catch (e) { /* no lines */ }

  return {
    character,
    universeContext,
    memories,
    relationships,
    therapy,
    castMembers,
    recentLines,
    allApprovedLines,
  };
}


/* ─────────────────────────────────────────────
   SHARED: Format context into prompt blocks
   ───────────────────────────────────────────── */
function formatCharacterBlock(character) {
  const c = character;
  const parts = [];
  parts.push(`═══ CHARACTER: ${c.selected_name || c.display_name} ═══`);
  if (c.subtitle) parts.push(`Subtitle: ${c.subtitle}`);
  parts.push(`Role: ${c.role_label || c.role_type}`);
  if (c.description) parts.push(`Description: ${c.description}`);
  if (c.core_belief) parts.push(`Core Belief: ${c.core_belief}`);
  if (c.core_desire) parts.push(`Core Desire: ${c.core_desire}`);
  if (c.core_fear) parts.push(`Core Fear: ${c.core_fear}`);
  if (c.core_wound) parts.push(`Core Wound: ${c.core_wound}`);
  if (c.mask_persona) parts.push(`Mask (Public): ${c.mask_persona}`);
  if (c.truth_persona) parts.push(`Truth (Private): ${c.truth_persona}`);
  if (c.character_archetype) parts.push(`Archetype: ${c.character_archetype}`);
  if (c.signature_trait) parts.push(`Signature Trait: ${c.signature_trait}`);
  if (c.emotional_baseline) parts.push(`Emotional Baseline: ${c.emotional_baseline}`);
  if (c.pressure_type) parts.push(`Pressure Type: ${c.pressure_type}`);
  if (c.pressure_quote) parts.push(`Pressure Quote: "${c.pressure_quote}"`);
  if (c.appearance_mode) parts.push(`Appearance Mode: ${c.appearance_mode}`);

  // JSONB fields
  const vSig = c.voice_signature;
  if (vSig && typeof vSig === 'object') {
    parts.push('\nVOICE SIGNATURE:');
    if (vSig.speech_pattern) parts.push(`  Speech Pattern: ${vSig.speech_pattern}`);
    if (vSig.vocabulary_tone) parts.push(`  Vocabulary Tone: ${vSig.vocabulary_tone}`);
    if (vSig.catchphrases) parts.push(`  Catchphrases: ${vSig.catchphrases}`);
    if (vSig.internal_monologue_style) parts.push(`  Internal Monologue: ${vSig.internal_monologue_style}`);
    if (vSig.emotional_reactivity) parts.push(`  Emotional Reactivity: ${vSig.emotional_reactivity}`);
  }

  const aes = c.aesthetic_dna;
  if (aes && typeof aes === 'object') {
    parts.push('\nAESTHETIC:');
    if (aes.era_aesthetic) parts.push(`  Era: ${aes.era_aesthetic}`);
    if (aes.color_palette) parts.push(`  Palette: ${aes.color_palette}`);
    if (aes.signature_silhouette) parts.push(`  Silhouette: ${aes.signature_silhouette}`);
  }

  const career = c.career_status;
  if (career && typeof career === 'object') {
    parts.push('\nCAREER:');
    if (career.profession) parts.push(`  Profession: ${career.profession}`);
    if (career.career_goal) parts.push(`  Ambition: ${career.career_goal}`);
    if (career.ongoing_arc) parts.push(`  Ongoing Arc: ${career.ongoing_arc}`);
  }

  return parts.join('\n');
}

function formatMemories(memories) {
  if (!memories.length) return '';
  const parts = ['═══ CONFIRMED MEMORIES ═══'];
  const byType = {};
  memories.forEach(m => {
    const type = m.type || 'general';
    if (!byType[type]) byType[type] = [];
    byType[type].push(m.statement);
  });
  Object.entries(byType).forEach(([type, stmts]) => {
    parts.push(`\n${type.toUpperCase()}:`);
    stmts.forEach(s => parts.push(`  • ${s}`));
  });
  return parts.join('\n');
}

function formatRelationships(relationships, charName) {
  if (!relationships.length) return '';
  const parts = ['═══ RELATIONSHIPS ═══'];
  relationships.forEach(r => {
    const isSource = r.source_name?.toLowerCase().includes(charName.toLowerCase());
    const other = isSource ? r.target_name : r.source_name;
    parts.push(`\n${other}:`);
    if (r.label) parts.push(`  Type: ${r.label}`);
    if (r.subtext) parts.push(`  Subtext: ${r.subtext}`);
    if (r.source_knows) parts.push(`  ${r.source_name} knows: ${r.source_knows}`);
    if (r.target_knows) parts.push(`  ${r.target_name} knows: ${r.target_knows}`);
    if (r.reader_knows) parts.push(`  Reader knows: ${r.reader_knows}`);
    if (r.intensity) parts.push(`  Intensity: ${r.intensity}/5`);
  });
  return parts.join('\n');
}

function formatCast(castMembers) {
  if (!castMembers.length) return '';
  const parts = ['═══ OTHER CHARACTERS IN THE WORLD ═══'];
  castMembers.forEach(c => {
    const name = c.selected_name || c.display_name;
    parts.push(`• ${name} (${c.role_type}) — ${c.subtitle || c.core_belief || ''}`);
  });
  return parts.join('\n');
}

function formatTherapy(therapy) {
  if (!therapy) return '';
  const parts = ['═══ THERAPY PROFILE ═══'];
  const es = therapy.emotional_state;
  if (es && typeof es === 'object') {
    parts.push(`Current Emotional State: ${JSON.stringify(es)}`);
  }
  if (therapy.primary_defense) parts.push(`Primary Defense: ${therapy.primary_defense}`);
  if (therapy.sessions_completed) parts.push(`Sessions Completed: ${therapy.sessions_completed}`);
  const known = therapy.known;
  if (known && typeof known === 'object' && Object.keys(known).length) {
    parts.push(`What they know about themselves: ${JSON.stringify(known)}`);
  }
  const sensed = therapy.sensed;
  if (sensed && typeof sensed === 'object' && Object.keys(sensed).length) {
    parts.push(`What they sense but can't name: ${JSON.stringify(sensed)}`);
  }
  return parts.join('\n');
}

function formatRecentStory(allLines) {
  if (!allLines.length) return '';
  const parts = ['═══ RECENT STORY (latest approved lines) ═══'];
  allLines.slice(0, 30).reverse().forEach(l => {
    parts.push(l.text);
  });
  return parts.join('\n');
}


/* ═════════════════════════════════════════════
   ENDPOINT 1: WRITE A SCENE
   ═════════════════════════════════════════════ */
router.post('/write-scene', optionalAuth, async (req, res) => {
  try {
    const { character_id, situation, mood, other_characters, length } = req.body;
    if (!character_id) return res.status(400).json({ success: false, error: 'character_id required' });

    const ctx = await gatherCharacterContext(character_id);
    if (!ctx) return res.status(404).json({ success: false, error: 'Character not found' });

    const { character, universeContext, memories, relationships, therapy, castMembers, allApprovedLines } = ctx;
    const charName = character.selected_name || character.display_name;

    const systemPrompt = `${universeContext}

${formatCharacterBlock(character)}

${formatMemories(memories)}

${formatRelationships(relationships, charName)}

${formatCast(castMembers)}

${formatTherapy(therapy)}

${formatRecentStory(allApprovedLines)}

You are co-writing a literary memoir/novel with a first-time author. You have deep knowledge of this 
character — their psychology, wounds, desires, voice, relationships, and everything that has happened 
in the story so far.

Your job is to write a scene featuring ${charName}. The author will describe the situation and you 
will write it in the established voice of the narrative.

WRITING RULES:
- Write in the voice established by the existing story (first person JustAWoman if that's the POV)
- Use specific details, not generalities. "The $297 course" not "an expensive course"
- Vary sentence rhythm — short when tension peaks, longer when something opens
- Ground scenes in physical, sensory detail
- Honor the character's psychological profile — their wound shapes what they notice
- Honor relationship dynamics — who knows what, what's unspoken
- Never give a character clarity they haven't earned
- Pain points are invisible — they surface through behavior, never by name
- Let the gap between what she says and what she means do the work
- Humor comes from honesty, not performance
- Build momentum — each line makes the next one necessary
- End on something that pulls forward, not a conclusion

${length === 'short' ? 'Write 3-5 paragraphs.' : length === 'long' ? 'Write 8-12 paragraphs.' : 'Write 5-8 paragraphs.'}

Respond with ONLY the prose. No preamble. No explanation. No quotes around it.`;

    const userMsg = situation
      ? `Write a scene where: ${situation}${mood ? `\nMood/feeling: ${mood}` : ''}${other_characters ? `\nOther characters present: ${other_characters}` : ''}`
      : `Write a scene featuring ${charName} that feels true to who they are right now in the story. ${mood ? `Mood: ${mood}` : ''}`;

    const prose = await callClaude(systemPrompt, userMsg, length === 'long' ? 6000 : 4000);

    return res.json({
      success: true,
      prose,
      character_name: charName,
      context_used: {
        memories: memories.length,
        relationships: relationships.length,
        cast_members: castMembers.length,
        recent_lines: allApprovedLines.length,
        has_universe: !!universeContext,
        has_therapy: !!therapy,
      },
    });
  } catch (err) {
    console.error('[CharacterAI] write-scene error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate scene' });
  }
});


/* ═════════════════════════════════════════════
   ENDPOINT 2: CHARACTER MONOLOGUE
   ═════════════════════════════════════════════ */
router.post('/character-monologue', optionalAuth, async (req, res) => {
  try {
    const { character_id, prompt, moment } = req.body;
    if (!character_id) return res.status(400).json({ success: false, error: 'character_id required' });

    const ctx = await gatherCharacterContext(character_id);
    if (!ctx) return res.status(404).json({ success: false, error: 'Character not found' });

    const { character, universeContext, memories, relationships, therapy, allApprovedLines } = ctx;
    const charName = character.selected_name || character.display_name;

    const systemPrompt = `${universeContext}

${formatCharacterBlock(character)}

${formatMemories(memories)}

${formatRelationships(relationships, charName)}

${formatTherapy(therapy)}

${formatRecentStory(allApprovedLines)}

You are writing an internal monologue for ${charName}. This is their private inner voice — 
what they think but never say out loud.

VOICE RULES:
- This is the character's REAL voice, not their public mask
- Honor their core wound, fear, and desire — those shape every thought
- Use their established speech patterns and vocabulary tone
- If they have a therapy profile, honor what they know, what they sense, and what they can never see
- The monologue should feel like eavesdropping on their most unguarded moment
- Contradictions are welcome — people lie to themselves constantly
- Speak in feelings and images, not explanations
- 3-6 paragraphs. Raw. Honest. No performance.

Respond with ONLY the monologue. No preamble. No quotes.`;

    const userMsg = moment
      ? `Write ${charName}'s inner monologue in this moment: ${moment}${prompt ? `\n\nAdditional context: ${prompt}` : ''}`
      : prompt
        ? `Write ${charName}'s inner monologue: ${prompt}`
        : `Write what ${charName} is thinking right now, based on where the story is.`;

    const prose = await callClaude(systemPrompt, userMsg, 3000);

    return res.json({ success: true, prose, character_name: charName });
  } catch (err) {
    console.error('[CharacterAI] monologue error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate monologue' });
  }
});


/* ═════════════════════════════════════════════
   ENDPOINT 3: BUILD PROFILE FROM STORY DATA
   ═════════════════════════════════════════════ */
router.post('/build-profile', optionalAuth, async (req, res) => {
  try {
    const { character_id } = req.body;
    if (!character_id) return res.status(400).json({ success: false, error: 'character_id required' });

    const ctx = await gatherCharacterContext(character_id);
    if (!ctx) return res.status(404).json({ success: false, error: 'Character not found' });

    const { character, universeContext, memories, relationships, therapy, recentLines, allApprovedLines } = ctx;
    const charName = character.selected_name || character.display_name;

    const systemPrompt = `${universeContext}

You are analyzing all available data about the character "${charName}" in this narrative universe.
You have their existing profile, all confirmed memories about them, their relationships, and every 
approved story line that mentions them.

Your job: Generate a comprehensive character profile by reading everything the author has already 
written and established. Fill in what the story has SHOWN, not what you'd invent.

CURRENT PROFILE:
${formatCharacterBlock(character)}

${formatMemories(memories)}

${formatRelationships(relationships, charName)}

${formatTherapy(therapy)}

STORY LINES MENTIONING ${charName.toUpperCase()}:
${recentLines.map(l => l.text).join('\n')}

RECENT STORY CONTEXT:
${allApprovedLines.slice(0, 20).map(l => l.text).join('\n')}

Based on ALL of this data, generate a comprehensive profile update. Only include fields where 
the story provides clear evidence. Do NOT invent — only extract what's there.

Respond with valid JSON:
{
  "core_desire": "...",
  "core_fear": "...",
  "core_wound": "...",
  "mask_persona": "What they show the world",
  "truth_persona": "Who they really are",
  "signature_trait": "...",
  "emotional_baseline": "...",
  "description": "A 2-3 sentence character summary based on the story",
  "voice_signature": {
    "speech_pattern": "...",
    "vocabulary_tone": "...",
    "internal_monologue_style": "..."
  },
  "story_presence": {
    "current_story_status": "Where they are in the arc right now",
    "unresolved_threads": "What hasn't been resolved yet"
  },
  "relationships_map": {
    "allies": "...",
    "rivals": "...",
    "dynamic_notes": "..."
  },
  "ai_summary": "A 3-4 sentence summary of who this character IS based on the story evidence",
  "evidence": ["Quote or memory that supports each major conclusion"]
}

Only include fields you have evidence for. Leave others out entirely.`;

    const result = await callClaude(systemPrompt, `Analyze all available story data and generate a character profile for ${charName}.`, 5000);

    // Try to parse JSON
    let profile;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      profile = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      profile = null;
    }

    return res.json({
      success: true,
      profile,
      raw: result,
      character_name: charName,
      data_sources: {
        memories: memories.length,
        relationships: relationships.length,
        lines_mentioning: recentLines.length,
        recent_lines: allApprovedLines.length,
        has_therapy: !!therapy,
      },
    });
  } catch (err) {
    console.error('[CharacterAI] build-profile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to build profile' });
  }
});


/* ═════════════════════════════════════════════
   ENDPOINT 4: SUGGEST GAPS
   ═════════════════════════════════════════════ */
router.post('/suggest-gaps', optionalAuth, async (req, res) => {
  try {
    const { character_id } = req.body;
    if (!character_id) return res.status(400).json({ success: false, error: 'character_id required' });

    const ctx = await gatherCharacterContext(character_id);
    if (!ctx) return res.status(404).json({ success: false, error: 'Character not found' });

    const { character, memories, relationships, therapy, castMembers, recentLines } = ctx;
    const charName = character.selected_name || character.display_name;

    const systemPrompt = `You are a narrative development consultant analyzing a character in a literary project.

CURRENT CHARACTER PROFILE:
${formatCharacterBlock(character)}

${formatMemories(memories)}
${formatRelationships(relationships, charName)}
${formatTherapy(therapy)}

This character has ${recentLines.length} story lines that mention them, ${memories.length} confirmed memories, and ${relationships.length} documented relationships.

The cast includes: ${castMembers.map(c => c.selected_name || c.display_name).join(', ')}

Your job: Identify what's UNDERDEVELOPED about this character — what the author should explore, 
deepen, or establish. Be specific and actionable.

Think about:
- Psychology gaps (missing wound, desire, fear, or mask/truth)
- Relationship gaps (characters they should have a documented dynamic with)
- Voice gaps (no speech patterns, no monologue style established)
- Story gaps (no unresolved threads, no evolution tracking)
- Scene opportunities (moments that would reveal who this character really is)

Respond with valid JSON:
{
  "gaps": [
    {
      "area": "psychology|relationships|voice|story|aesthetic|career",
      "severity": "critical|important|nice_to_have",
      "title": "Short title",
      "detail": "What's missing and why it matters",
      "suggestion": "What the author could write or explore to fill this"
    }
  ],
  "scene_prompts": [
    "A specific scene idea that would reveal something about this character"
  ],
  "overall_depth_score": "1-10 rating of how well-developed this character is",
  "strongest_aspect": "What's best-developed about them",
  "weakest_aspect": "What needs the most attention"
}`;

    const result = await callClaude(systemPrompt, `Analyze ${charName} and identify gaps in their development.`, 4000);

    let analysis;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      analysis = null;
    }

    return res.json({ success: true, analysis, raw: result, character_name: charName });
  } catch (err) {
    console.error('[CharacterAI] suggest-gaps error:', err);
    return res.status(500).json({ success: false, error: 'Failed to analyze gaps' });
  }
});


/* ═════════════════════════════════════════════
   ENDPOINT 5: WHAT HAPPENS NEXT
   ═════════════════════════════════════════════ */
router.post('/what-happens-next', optionalAuth, async (req, res) => {
  try {
    const { character_id, direction } = req.body;
    if (!character_id) return res.status(400).json({ success: false, error: 'character_id required' });

    const ctx = await gatherCharacterContext(character_id);
    if (!ctx) return res.status(404).json({ success: false, error: 'Character not found' });

    const { character, universeContext, memories, relationships, therapy, castMembers, allApprovedLines } = ctx;
    const charName = character.selected_name || character.display_name;

    const systemPrompt = `${universeContext}

${formatCharacterBlock(character)}

${formatMemories(memories)}

${formatRelationships(relationships, charName)}

${formatTherapy(therapy)}

${formatCast(castMembers)}

${formatRecentStory(allApprovedLines)}

You are a story architect who understands narrative gravity — what MUST happen next based on 
everything that has been established. You understand wound logic, desire lines, and how 
relationships create pressure.

Based on EVERYTHING you know about ${charName} — their psychology, their relationships, 
what has happened in the story, and the unresolved threads — generate 3 possible next beats.

Each beat should:
- Feel inevitable based on what came before
- Reveal something new about the character
- Create pressure or movement
- Honor the character's wound and how it distorts their perception

${direction ? `The author wants the story to move in this direction: ${direction}` : ''}

Respond with valid JSON:
{
  "beats": [
    {
      "title": "3-5 word title",
      "description": "What happens in 2-3 sentences",
      "why": "Why this feels inevitable based on the character's psychology",
      "tone": "The emotional texture of this beat",
      "characters_involved": ["who else is in this scene"],
      "prose_preview": "A 2-3 sentence taste of how this beat would read in prose"
    }
  ],
  "story_tension": "What's the core unresolved tension driving this character forward right now?"
}`;

    const result = await callClaude(systemPrompt, 
      `Based on everything established about ${charName}, what happens next?${direction ? ` Direction: ${direction}` : ''}`, 
      5000);

    let beats;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      beats = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      beats = null;
    }

    return res.json({ success: true, beats, raw: result, character_name: charName });
  } catch (err) {
    console.error('[CharacterAI] what-happens-next error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate story beats' });
  }
});


module.exports = router;
