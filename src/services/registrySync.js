/**
 * registrySync.js
 * src/services/registrySync.js
 *
 * Real-time registry sync service.
 * Fires on three triggers. Updates character profile immediately.
 * (The therapy session-close trigger is retired with the Therapy Room,
 * 2026-10-18: it wrote into the character with no approval step.)
 *
 * TRIGGERS:
 *   2. Memory confirmed → write to character profile field
 *   3. Line approved → extract character moments (batched per chapter)
 *   4. Pain point tagged → wound depth + active wounds
 *
 * USAGE:
 *   const registrySync = require('../services/registrySync');
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
  // TRIGGER 2: Memory confirmed
  // Updates: belief_pressured, writer_notes, personality_matrix
  // ══════════════════════════════════════════════════════════════════════

  async onMemoryConfirmed(memory, models) {
    try {
      if (!memory?.character_id) return;

      // F-Reg-2 fix group 2 (v1.2 R2), row 71: read, compute and write under a
      // row lock, so a note or belief written by a concurrent trigger since the
      // read is built on rather than overwritten. A pain point is handed to
      // onPainPointTagged after this transaction, which takes its own lock.
      const sequelize = models.RegistryCharacter.sequelize;
      const found = await sequelize.transaction(async (transaction) => {
        const character = await models.RegistryCharacter.findByPk(memory.character_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!character) return false;
        if (character.status === 'finalized') return false;

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
        }

        if (Object.keys(updates).length > 0) {
          await models.RegistryCharacter.update(updates, {
            where: { id: memory.character_id },
            transaction,
          });
          console.log(`[registrySync] Memory confirmed → updated ${character.selected_name || character.name}`);
        }
        return true;
      });

      if (found && memory.type === 'pain_point') {
        // Pain point confirmed → feeds wound tracking
        await this.onPainPointTagged({
          character_id: memory.character_id,
          category:     memory.tags?.[0] || 'untagged',
          statement:    memory.statement,
          confidence:   memory.confidence,
        }, models);
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
      // #1883: StorytellerLine declares sort_order, not order_index; the old
      // order failed on every call.
      const recentLines = await models.StorytellerLine.findAll({
        where:  { chapter_id: line.chapter_id, status: 'approved' },
        order:  [['sort_order', 'DESC']],
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
${recentLines.map(l => l.text).reverse().join('\n')}

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

        // F-Reg-2 fix group 2 (v1.2 R2), row 72: the characters were read
        // before the AI call, so each note is appended to the row's current
        // writer_notes, read under a lock, and the finalized check reads the
        // current status too.
        const written = await models.RegistryCharacter.sequelize.transaction(async (transaction) => {
          const current = await models.RegistryCharacter.findByPk(character.id, {
            attributes: ['id', 'status', 'writer_notes'], transaction, lock: transaction.LOCK.UPDATE,
          });
          if (!current || current.status === 'finalized') return false;
          await models.RegistryCharacter.update({
            writer_notes: _appendNote(
              current.writer_notes,
              `From story (line ~${approvedCount}): ${moment.moment}`,
              'story'
            ),
          }, { where: { id: character.id }, transaction });
          return true;
        });
        if (!written) continue;

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

      // F-Reg-2 fix group 2 (v1.2 R2), row 73: read, compute and write under a
      // row lock, and change a copy of personality_matrix, so a depth, note or
      // matrix change made by a concurrent trigger since the read is built on
      // rather than overwritten.
      const sequelize = models.RegistryCharacter.sequelize;
      await sequelize.transaction(async (transaction) => {
        const character = await models.RegistryCharacter.findByPk(painPoint.character_id, { transaction, lock: transaction.LOCK.UPDATE });
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
              : JSON.parse(JSON.stringify(character.personality_matrix));

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
          } catch (err) { console.warn('[registrySync] personality matrix compute error:', err?.message); }
        }

        await models.RegistryCharacter.update(updates, {
          where: { id: painPoint.character_id },
          transaction,
        });

        console.log(`[registrySync] Pain point → updated wound depth for ${character.selected_name || character.name}`);
      });

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
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    });

    return msg.content?.[0]?.text || null;
  } catch (err) {
    console.error('[registrySync] Claude call failed:', err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// FEED PROFILE SYNC
// When registry character fields that map to Feed profile fields change,
// push the update to the linked SocialProfile.
// ══════════════════════════════════════════════════════════════════════

const SYNCABLE_TO_FEED = ['follower_tier', 'current_state'];
const { FOLLOWER_TIER_KEYS } = require('../utils/followerTiers');

async function syncFeedProfileFromRegistry(characterId, updatedFields, models) {
  try {
    const relevantUpdate = {};
    for (const key of Object.keys(updatedFields)) {
      if (SYNCABLE_TO_FEED.includes(key)) {
        relevantUpdate[key] = updatedFields[key];
      }
    }
    // A Feed profile's tier is one of the six count tiers; the registry's ghost and unknown stay
    // in the registry (Evoni, 2026-10-13, Task #3106).
    if ('follower_tier' in relevantUpdate && !FOLLOWER_TIER_KEYS.includes(relevantUpdate.follower_tier)) {
      delete relevantUpdate.follower_tier;
    }
    if (!Object.keys(relevantUpdate).length) return;

    // The character's profile is its feed_profile_id, the one link (C3).
    const character = await models.RegistryCharacter.findByPk(characterId, { attributes: ['feed_profile_id'] });
    if (!character?.feed_profile_id) return;
    await models.SocialProfile.update(relevantUpdate, {
      where: { id: character.feed_profile_id },
    });

    console.log(`[registrySync] Feed profile synced for character ${characterId}:`, Object.keys(relevantUpdate));
  } catch (err) {
    console.error('[registrySync] syncFeedProfileFromRegistry error:', err.message);
  }
}

registrySync.syncFeedProfileFromRegistry = syncFeedProfileFromRegistry;

module.exports = registrySync;
