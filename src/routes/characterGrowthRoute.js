// routes/characterGrowthRoute.js
//
// POST /api/v1/memories/character-growth          — fires after approved scene, evolves characters
// GET  /api/v1/memories/character-growth/flagged  — list contradictions awaiting author review
// POST /api/v1/memories/character-growth/:id/review — author accepts/reverts/modifies a flag

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS THAT GROW SILENTLY vs FIELDS THAT FLAG CONTRADICTIONS
// ─────────────────────────────────────────────────────────────────────────────
const SILENT_FIELDS = [
  'voice_notes',
  'behavior_pattern',
  'arc_summary',
  'notes',
  'secret',
  'appearance',
];

const CONTRADICTION_FIELDS = [
  'wound',
  'psychology',
  'relationship_to_jaw',
  'world_exists',
  'pain_point_category',
];

// ─────────────────────────────────────────────────────────────────────────────
// GROWTH SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const GROWTH_SYSTEM = `You are the Character Growth Engine for Prime Studios — a literary production system for the LalaVerse franchise.

Your job: read an approved scene and its character revelations, then determine how each character in the scene has grown, shifted, or evolved. Be specific. Be honest. Characters grow through scenes — wounds crack, voices sharpen, behaviors reveal themselves more clearly.

FRANCHISE RULES:
- JustAWoman's self-possession is foundational — it cannot erode. Her confidence is her baseline, not a destination.
- She does NOT compare herself to other women. She watches and gets inspired and pushes harder.
- She wants to be LEGENDARY. Every growth update must serve that arc or complicate it meaningfully.
- Lala does NOT know she was built by JustAWoman. Never update Lala's self-awareness.
- David is not the obstacle. His concern comes from love. His growth is accumulating invisible emotional labor.
- Interior Monologue and Composite/Fictional characters NEVER promote to LalaVerse canon.
- Coaching realization comes in Book 2. If a scene brings JustAWoman close to it, note it — do not write it.

GROWTH TYPES:
- SILENT: Voice notes, behavior patterns, arc summary, notes, appearance details — these update automatically without author review.
- FLAGGED: Core wound, psychology, relationship to JustAWoman, world_exists, pain point category — these require author review if the scene contradicts the registry.

Respond ONLY in valid JSON. No markdown. No backticks.`;

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: character-growth
// Fires after an approved scene — reads the scene, evolves the characters
// ─────────────────────────────────────────────────────────────────────────────
router.post('/character-growth', optionalAuth, async (req, res) => {
  const { story_id, scene_proposal_id } = req.body;

  if (!story_id) return res.status(400).json({ error: 'story_id required' });

  try {
    const story = await db.StorytellerStory.findByPk(story_id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const characterNames = story.characters_in_scene || [];
    if (!characterNames.length) {
      return res.json({ ok: true, message: 'No characters to evolve', updates: [] });
    }

    // Load character registry entries
    const characters = await db.RegistryCharacter.findAll({
      where: { status: { [db.Sequelize.Op.in]: ['approved', 'edited', 'finalized'] } },
    });

    const matched = characters.filter(c => {
      const name = c.selected_name || c.name || '';
      return characterNames.some(n =>
        name.toLowerCase().includes(n.toLowerCase()) ||
        n.toLowerCase().includes(name.toLowerCase())
      );
    });

    if (!matched.length) {
      return res.json({ ok: true, message: 'No matched characters found', updates: [] });
    }

    // Approved scene text
    const sceneText = story.evaluation_result?.approved_version || story.story_a || '';
    const plotMemory = story.plot_memory_proposal?.content || '';
    const characterRevelation = story.character_revelation_proposal?.content || '';

    const growthPrompt = `An approved scene has been written and confirmed for the LalaVerse franchise. Read it and determine how each character has grown or evolved.

APPROVED SCENE:
${sceneText}

PLOT MEMORY (what happened):
${plotMemory}

CHARACTER REVELATION (what was learned):
${characterRevelation}

CHARACTERS TO EVOLVE:
${matched.map(c => `
CHARACTER: ${c.selected_name || c.name}
Type: ${c.character_type}
Current wound: ${c.wound || 'not documented'}
Current voice notes: ${c.voice_notes || 'not documented'}
Current psychology: ${c.psychology || 'not documented'}
Current arc summary: ${c.arc_summary || 'not documented'}
Current relationship to JustAWoman: ${c.relationship_to_jaw || 'not documented'}
Current behavior pattern: ${c.behavior_pattern || 'not documented'}
`).join('\n---\n')}

For each character, determine what this scene revealed or shifted. Be specific — not "she grew stronger" but what exactly cracked, sharpened, or emerged.

Respond with this exact JSON structure:

{
  "character_updates": [
    {
      "character_name": "exact name from registry",
      "silent_updates": [
        {
          "field": "field name (voice_notes | behavior_pattern | arc_summary | notes | appearance)",
          "previous_value": "what the registry currently says or 'not documented'",
          "new_value": "the updated value — specific, earned by this scene",
          "growth_source": "the specific moment in the scene that drove this update"
        }
      ],
      "contradiction_checks": [
        {
          "field": "field name (wound | psychology | relationship_to_jaw | pain_point_category)",
          "current_value": "what the registry says",
          "scene_revealed": "what this scene showed about this field",
          "is_contradiction": true or false,
          "proposed_update": "only if is_contradiction is true — what the update would be",
          "contradiction_reasoning": "only if is_contradiction is true — why this is a genuine shift not a temporary state"
        }
      ],
      "overall_growth_note": "One sentence on where this character is now in their arc that they weren't before this scene"
    }
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: GROWTH_SYSTEM,
      messages: [{ role: 'user', content: growthPrompt }],
    });

    const rawText = response.content[0].text;
    let growthData;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      growthData = JSON.parse(clean);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse growth data', raw: rawText });
    }

    const updates = [];
    const flags = [];

    for (const charUpdate of growthData.character_updates || []) {
      const character = matched.find(c =>
        (c.selected_name || c.name || '').toLowerCase() === charUpdate.character_name.toLowerCase()
      );
      if (!character) continue;

      // Respect finalized rule — no updates to finalized characters
      if (character.status === 'finalized') continue;

      // ── Apply silent updates ──────────────────────────────────────────────
      const silentChanges = {};
      for (const update of charUpdate.silent_updates || []) {
        if (SILENT_FIELDS.includes(update.field) && update.new_value) {
          silentChanges[update.field] = update.new_value;

          await db.CharacterGrowthLog.create({
            character_id: character.id,
            story_id: story_id,
            scene_proposal_id: scene_proposal_id || null,
            field_updated: update.field,
            previous_value: update.previous_value,
            new_value: update.new_value,
            update_type: 'silent',
            growth_source: update.growth_source,
          });

          updates.push({
            character: charUpdate.character_name,
            field: update.field,
            type: 'silent',
            new_value: update.new_value,
          });
        }
      }

      if (Object.keys(silentChanges).length) {
        await character.update(silentChanges);
      }

      // ── Flag contradictions — do NOT auto-apply ───────────────────────────
      for (const check of charUpdate.contradiction_checks || []) {
        if (check.is_contradiction && check.proposed_update) {
          const log = await db.CharacterGrowthLog.create({
            character_id: character.id,
            story_id: story_id,
            scene_proposal_id: scene_proposal_id || null,
            field_updated: check.field,
            previous_value: check.current_value,
            new_value: check.proposed_update,
            update_type: 'flagged_contradiction',
            growth_source: check.contradiction_reasoning,
          });

          flags.push({
            log_id: log.id,
            character: charUpdate.character_name,
            field: check.field,
            current_value: check.current_value,
            proposed_update: check.proposed_update,
            reasoning: check.contradiction_reasoning,
          });
        }
      }
    }

    return res.json({
      ok: true,
      silent_updates: updates.length,
      flagged_contradictions: flags.length,
      updates,
      flags,
      message: flags.length
        ? `${updates.length} character fields updated silently. ${flags.length} contradiction(s) flagged for your review.`
        : `${updates.length} character fields updated silently. No contradictions detected.`,
    });

  } catch (err) {
    console.error('Character growth error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: flagged contradictions
// Author reviews only what actually contradicts the registry
// ─────────────────────────────────────────────────────────────────────────────
router.get('/character-growth/flagged', optionalAuth, async (req, res) => {
  try {
    const flags = await db.CharacterGrowthLog.findAll({
      where: {
        update_type: 'flagged_contradiction',
        author_reviewed: false,
      },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: db.RegistryCharacter,
          as: 'character',
          attributes: ['id', 'name', 'selected_name', 'wound', 'psychology'],
        },
      ],
    });

    return res.json({ flags, count: flags.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3: review a flagged contradiction
// Author accepts / reverts / modifies
// ─────────────────────────────────────────────────────────────────────────────
router.post('/character-growth/:id/review', optionalAuth, async (req, res) => {
  const { decision, modified_value, author_note } = req.body;
  // decision: 'accepted' | 'reverted' | 'modified'

  if (!['accepted', 'reverted', 'modified'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be: accepted | reverted | modified' });
  }

  try {
    const log = await db.CharacterGrowthLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Growth log not found' });

    const character = await db.RegistryCharacter.findByPk(log.character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    if (character.status === 'finalized') {
      return res.status(403).json({ error: 'Cannot update a finalized character' });
    }

    if (decision === 'accepted') {
      // Apply the proposed update
      await character.update({ [log.field_updated]: log.new_value });
    } else if (decision === 'modified' && modified_value) {
      // Apply the author's version
      await character.update({ [log.field_updated]: modified_value });
      await log.update({ new_value: modified_value });
    }
    // 'reverted' — do nothing to the character, just mark reviewed

    await log.update({
      author_reviewed: true,
      author_decision: decision,
      author_note: author_note || null,
      reviewed_at: new Date(),
    });

    return res.json({
      ok: true,
      decision,
      character_updated: decision !== 'reverted',
      field: log.field_updated,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: character growth history
// Full evolution timeline for a character
// ─────────────────────────────────────────────────────────────────────────────
router.get('/character-growth/history/:characterId', optionalAuth, async (req, res) => {
  try {
    const logs = await db.CharacterGrowthLog.findAll({
      where: { character_id: req.params.characterId },
      order: [['created_at', 'ASC']],
    });
    return res.json({ logs, total: logs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
