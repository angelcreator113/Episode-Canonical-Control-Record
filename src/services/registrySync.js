/**
 * registrySync.js
 * src/services/registrySync.js
 *
 * Real-time registry sync service.
 * Fires on four triggers. Updates character profile immediately.
 *
 * TRIGGERS:
 *   1. Therapy session closes → emotional state delta
 *   2. Memory confirmed → write to character profile field
 *   3. Line approved → extract character moments (batched per chapter)
 *   4. Pain point tagged → wound depth + active wounds
 *
 * USAGE:
 *   const registrySync = require('../services/registrySync');
 *
 *   // In therapy route, after session close:
 *   await registrySync.onTherapySessionClose(session, models);
 *
 *   // In memories route, after memory confirmed:
 *   await registrySync.onMemoryConfirmed(memory, models);
 *
 *   // In storyteller route, after line approved:
 *   await registrySync.onLineApproved(line, chapterContext, models);
 *
 *   // In memories route, after pain point saved:
 *   await registrySync.onPainPointTagged(painPoint, models);
 *
 * All functions are fire-and-forget safe — they catch their own errors
 * and never interrupt the calling route.
 */

'use strict';

const registrySync = {

  // ══════════════════════════════════════════════════════════════════════
  // TRIGGER 1: Therapy session closes
  // Updates: emotional_baseline, wound_depth, defense_mechanism, writer_notes
  // ══════════════════════════════════════════════════════════════════════

  async onTherapySessionClose(session, models) {
    try {
      if (!session?.character_id) return;

      const character = await models.RegistryCharacter.findByPk(session.character_id);
      if (!character) return;
      if (character.status === 'finalized') return; // respect the lock

      // Build delta from session data
      const updates = {};

      // Emotional state — session stores start/end emotional readings
      if (session.emotional_state_end) {
        updates.emotional_function = _mergeEmotionalState(
          character.emotional_function,
          session.emotional_state_end,
          session.session_number
        );
      }

      // Defense mechanism shifts — if therapist detected a change
      if (session.defense_shift_detected && session.new_defense_mechanism) {
        updates.writer_notes = _appendNote(
          character.writer_notes,
          `Session ${session.session_number}: Defense shift detected — ${session.new_defense_mechanism}`,
          'therapy'
        );
      }

      // Wound depth — track how many times the wound was activated
      if (session.wound_activated) {
        const currentDepth = character.wound_depth || 0;
        updates.wound_depth = Math.min(10, currentDepth + 1);
      }

      // Breakthrough — session marked as breakthrough
      if (session.breakthrough_moment) {
        updates.writer_notes = _appendNote(
          updates.writer_notes || character.writer_notes,
          `Session ${session.session_number} breakthrough: ${session.breakthrough_moment}`,
          'therapy'
        );
      }

      if (Object.keys(updates).length > 0) {
        await models.RegistryCharacter.update(updates, {
          where: { id: session.character_id },
        });
        console.log(`[registrySync] Therapy close → updated ${character.selected_name || character.name}`);
      }

    } catch (err) {
      console.error('[registrySync] onTherapySessionClose error:', err.message);
    }
  },


  // ══════════════════════════════════════════════════════════════════════
  // TRIGGER 2: Memory confirmed
  // Updates: belief_pressured, writer_notes, personality_matrix
  // ══════════════════════════════════════════════════════════════════════

  async onMemoryConfirmed(memory, models) {
    try {
      if (!memory?.character_id) return;

      const character = await models.RegistryCharacter.findByPk(memory.character_id);
      if (!character) return;
      if (character.status === 'finalized') return;

      const updates = {};

      // Memory type drives which field gets updated
      switch (memory.type) {
        case 'belief':
          // Confirmed belief memory → update or enrich belief_pressured
          if (memory.statement && !character.belief_pressured) {
            updates.belief_pressured = memory.statement;
          } else if (memory.statement) {
            updates.writer_notes = _appendNote(
              character.writer_notes,
              `Confirmed belief: "${memory.statement}" (confidence: ${memory.confidence})`,
              'memory'
            );
          }
          break;

        case 'constraint':
          // Constraint memory → adds to what limits this character
          updates.writer_notes = _appendNote(
            character.writer_notes,
            `Confirmed constraint: "${memory.statement}"`,
            'memory'
          );
          break;

        case 'character_dynamic':
          // Dynamic with another character → enriches relationship data
          updates.writer_notes = _appendNote(
            character.writer_notes,
            `Confirmed dynamic: "${memory.statement}"`,
            'memory'
          );
          break;

        case 'pain_point':
          // Pain point confirmed → feeds wound tracking
          await this.onPainPointTagged({
            character_id: memory.character_id,
            category:     memory.tags?.[0] || 'untagged',
            statement:    memory.statement,
            confidence:   memory.confidence,
          }, models);
          break;
      }

      if (Object.keys(updates).length > 0) {
        await models.RegistryCharacter.update(updates, {
          where: { id: memory.character_id },
        });
        console.log(`[registrySync] Memory confirmed → updated ${character.selected_name || character.name}`);
      }

    } catch (err) {
      console.error('[registrySync] onMemoryConfirmed error:', err.message);
    }
  },


  // ══════════════════════════════════════════════════════════════════════
  // TRIGGER 3: Line approved
  // Extracts character moments from the line content via Claude
  // Batches — only fires full extraction every 5 approvals per chapter
  // Updates: writer_notes with extracted moments
  // ══════════════════════════════════════════════════════════════════════

  async onLineApproved(line, chapterContext, models) {
    try {
      if (!line?.content) return;

      // Only run extraction every 5 approvals per chapter
      // to avoid hammering Claude on every single keystroke approval
      const approvedCount = await models.StorytellerLine.count({
        where: {
          chapter_id: line.chapter_id,
          status:     'approved',
        },
      });

      if (approvedCount % 5 !== 0) return; // only on 5, 10, 15, 20...

      // Get the last 10 approved lines for context
      const recentLines = await models.StorytellerLine.findAll({
        where:  { chapter_id: line.chapter_id, status: 'approved' },
        order:  [['order_index', 'DESC']],
        limit:  10,
      });

      if (recentLines.length < 3) return; // not enough to extract from

      // Get registry characters for this show to match against
      const registries = await models.CharacterRegistry.findAll({
        where: { show_id: chapterContext?.show_id },
        include: [{ model: models.RegistryCharacter, as: 'characters' }],
      });

      const allCharacters = registries.flatMap(r => r.characters || []);
      if (allCharacters.length === 0) return;

      // Ask Claude to extract character moments from recent lines
      const extractionPrompt = `You are analyzing approved manuscript lines for character moments.

CHARACTERS IN THIS STORY:
${allCharacters.map(c => `- ${c.selected_name || c.name} (${c.type}): ${c.role}`).join('\n')}

RECENT APPROVED LINES:
${recentLines.map(l => l.content).reverse().join('\n')}

Extract character moments — specific things revealed about each character through action, 
dialogue, or implication. Only extract what is genuinely new information about who they are.

Return ONLY JSON: 
{
  "moments": [
    {
      "character_name": "name matching the list above",
      "moment": "one sentence describing what was revealed",
      "field": "belief | behavior | relationship | wound | strength"
    }
  ]
}
If nothing new is revealed, return { "moments": [] }`;

      const raw = await _callClaude(extractionPrompt, 600);
      if (!raw) return;

      let extracted;
      try {
        extracted = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch { return; }

      if (!extracted?.moments?.length) return;

      // Write extracted moments back to matching characters
      for (const moment of extracted.moments) {
        const character = allCharacters.find(c =>
          (c.selected_name || c.name).toLowerCase() === moment.character_name.toLowerCase()
        );
        if (!character) continue;
        if (character.status === 'finalized') continue;

        await models.RegistryCharacter.update({
          writer_notes: _appendNote(
            character.writer_notes,
            `From story (line ~${approvedCount}): ${moment.moment}`,
            'story'
          ),
        }, { where: { id: character.id } });

        console.log(`[registrySync] Line approved → extracted moment for ${character.selected_name || character.name}`);
      }

    } catch (err) {
      console.error('[registrySync] onLineApproved error:', err.message);
    }
  },


  // ══════════════════════════════════════════════════════════════════════
  // TRIGGER 4: Pain point tagged
  // Updates: wound_depth, active_wounds[], writer_notes
  // ══════════════════════════════════════════════════════════════════════

  async onPainPointTagged(painPoint, models) {
    try {
      if (!painPoint?.character_id) return;

      const character = await models.RegistryCharacter.findByPk(painPoint.character_id);
      if (!character) return;
      if (character.status === 'finalized') return;

      const updates = {};

      // Increment wound depth (capped at 10)
      const currentDepth = character.wound_depth || 0;
      updates.wound_depth = Math.min(10, currentDepth + 0.5); // pain points add half a point

      // Track active wound categories in personality_matrix or writer_notes
      const existingNotes = character.writer_notes || '';
      const categoryLabel = _painPointLabel(painPoint.category);

      updates.writer_notes = _appendNote(
        existingNotes,
        `Pain point: ${categoryLabel} — "${painPoint.statement}"`,
        'pain_point'
      );

      // Update personality_matrix JSONB if it exists
      if (character.personality_matrix) {
        try {
          const matrix = typeof character.personality_matrix === 'string'
            ? JSON.parse(character.personality_matrix)
            : character.personality_matrix;

          // Pain points affect specific dimensions
          const PAIN_TO_DIMENSION = {
            comparison_spiral:     { dimension: 'confidence',   delta: -0.5 },
            visibility_gap:        { dimension: 'confidence',   delta: -0.3 },
            identity_drift:        { dimension: 'softness',     delta: +0.3 },
            financial_risk:        { dimension: 'drama',        delta: +0.4 },
            consistency_collapse:  { dimension: 'playfulness',  delta: -0.2 },
            clarity_deficit:       { dimension: 'drama',        delta: +0.3 },
            external_validation:   { dimension: 'confidence',   delta: -0.4 },
            restart_cycle:         { dimension: 'luxury_tone',  delta: -0.2 },
          };

          const effect = PAIN_TO_DIMENSION[painPoint.category];
          if (effect && matrix[effect.dimension] !== undefined) {
            matrix[effect.dimension] = Math.max(0, Math.min(10,
              matrix[effect.dimension] + effect.delta
            ));
            updates.personality_matrix = matrix;
          }
        } catch {}
      }

      await models.RegistryCharacter.update(updates, {
        where: { id: painPoint.character_id },
      });

      console.log(`[registrySync] Pain point → updated wound depth for ${character.selected_name || character.name}`);

    } catch (err) {
      console.error('[registrySync] onPainPointTagged error:', err.message);
    }
  },

};


// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function _appendNote(existing, newNote, source) {
  const prefix = {
    therapy:    '🔵',
    memory:     '◈',
    story:      '📖',
    pain_point: '⚡',
  }[source] || '·';

  const timestamp = new Date().toISOString().slice(0, 10);
  const line = `${prefix} [${timestamp}] ${newNote}`;

  if (!existing || existing.trim() === '') return line;
  return `${existing.trim()}\n${line}`;
}

function _mergeEmotionalState(existing, newState, sessionNumber) {
  if (!existing) return `After session ${sessionNumber}: ${newState}`;
  return `${existing}\nAfter session ${sessionNumber}: ${newState}`;
}

function _painPointLabel(category) {
  const LABELS = {
    comparison_spiral:    'Comparison Spiral',
    visibility_gap:       'Visibility Gap',
    identity_drift:       'Identity Drift',
    financial_risk:       'Financial Risk',
    consistency_collapse: 'Consistency Collapse',
    clarity_deficit:      'Clarity Deficit',
    external_validation:  'External Validation',
    restart_cycle:        'Restart Cycle',
  };
  return LABELS[category] || category;
}

async function _callClaude(prompt, maxTokens = 600) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    });

    return msg.content?.[0]?.text || null;
  } catch (err) {
    console.error('[registrySync] Claude call failed:', err.message);
    return null;
  }
}

module.exports = registrySync;
