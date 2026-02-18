/**
 * Evaluation Routes
 * 
 * GET  /api/v1/characters/:key/state       — Get current character stats
 * POST /api/v1/episodes/:id/evaluate        — Compute score (no mutation)
 * POST /api/v1/episodes/:id/override        — Override tier or style scores
 * POST /api/v1/episodes/:id/accept          — Apply stat deltas, lock outcome
 * 
 * Location: src/routes/evaluation.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  evaluate,
  computeOutfitMatch,
  computeAccessoryMatch,
  computeStatDeltas,
  applyDeltas,
  validateOverride,
  generateNarrativeLine,
  DEFAULT_STATS,
  FORMULA_VERSION,
  OVERRIDE_REASONS,
  TIERS,
  TIER_ORDER,
} = require('../utils/evaluationFormula');

// Optional auth
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}


// ─── HELPERS ───

async function getModels() {
  try {
    return require('../models');
  } catch (e) {
    return null;
  }
}

async function getOrCreateCharacterState(sequelize, showId, seasonId, characterKey) {
  const [CharacterState] = await sequelize.query(
    `SELECT * FROM character_state
     WHERE show_id = :showId
     AND character_key = :characterKey
     AND (season_id = :seasonId OR season_id IS NULL)
     ORDER BY season_id DESC NULLS LAST
     LIMIT 1`,
    {
      replacements: { showId, seasonId: seasonId || null, characterKey },
      type: sequelize.QueryTypes.SELECT,
    }
  ).then(rows => [rows]).catch(() => [[]]);

  if (CharacterState && CharacterState.length > 0) {
    return CharacterState[0];
  }

  // Auto-seed with defaults
  const id = uuidv4();
  await sequelize.query(
    `INSERT INTO character_state (id, show_id, season_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
     VALUES (:id, :showId, :seasonId, :characterKey, :coins, :reputation, :brand_trust, :influence, :stress, NOW(), NOW())`,
    {
      replacements: {
        id,
        showId,
        seasonId: seasonId || null,
        characterKey,
        ...DEFAULT_STATS,
      },
    }
  );

  return {
    id,
    show_id: showId,
    season_id: seasonId,
    character_key: characterKey,
    ...DEFAULT_STATS,
    last_applied_episode_id: null,
  };
}

/**
 * Parse [EVENT:] tag from script content
 */
function parseEventTag(scriptContent) {
  if (!scriptContent) return null;

  const match = scriptContent.match(/\[EVENT:\s*(.+?)\]/i);
  if (!match) return null;

  const raw = match[1];
  const event = {};
  const pairs = raw.match(/(\w+)=(?:"([^"]+)"|(\S+))/g) || [];

  for (const pair of pairs) {
    const m = pair.match(/(\w+)=(?:"([^"]+)"|(\S+))/);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2] || m[3];
      event[key] = isNaN(val) ? val : parseFloat(val);
    }
  }

  return event;
}

/**
 * Parse [EPISODE_INTENT:] tag
 */
function parseIntentTag(scriptContent) {
  if (!scriptContent) return null;
  const match = scriptContent.match(/\[EPISODE_INTENT:\s*"?([^"\]]+)"?\]/i);
  return match ? match[1].trim() : null;
}


// ═══════════════════════════════════════════
// GET /api/v1/characters/:key/state
// ═══════════════════════════════════════════

router.get('/characters/:key/state', optionalAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { show_id, season_id, scope = 'season' } = req.query;

    if (!show_id) {
      return res.status(400).json({ error: 'show_id query parameter is required' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const state = await getOrCreateCharacterState(
      models.sequelize,
      show_id,
      scope === 'global' ? null : season_id || null,
      key
    );

    return res.json({
      success: true,
      scope,
      character_key: key,
      state: {
        coins: state.coins,
        reputation: state.reputation,
        brand_trust: state.brand_trust,
        influence: state.influence,
        stress: state.stress,
      },
      last_applied_episode_id: state.last_applied_episode_id,
      state_id: state.id,
    });
  } catch (error) {
    console.error('Get character state error:', error);
    return res.status(500).json({ error: 'Failed to get character state', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/episodes/:id/evaluate
// ═══════════════════════════════════════════

router.post('/episodes/:id/evaluate', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      character_key = 'lala',
      scope = 'season',
      use_episode_intent = true,
    } = req.body;

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Load episode
    const episode = await models.Episode.findByPk(id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    // Parse event from script
    const scriptContent = episode.script_content || '';
    const event = parseEventTag(scriptContent);
    const intent = use_episode_intent ? parseIntentTag(scriptContent) : null;

    if (!event) {
      return res.status(422).json({
        error: 'No [EVENT:] tag found in script',
        hint: 'Add an [EVENT: name="..." prestige=7 cost=150 strictness=6 deadline="high"] tag to your script.',
      });
    }

    // Get character state
    const showId = episode.show_id;
    const seasonId = null; // TODO: derive from episode.season_id when available
    const state = await getOrCreateCharacterState(models.sequelize, showId, seasonId, character_key);

    // Get wardrobe items for style scoring
    let styleScores = { outfit_match: null, accessory_match: null, deadline_penalty: null };
    try {
      const [wardrobeItems] = await models.sequelize.query(
        `SELECT w.* FROM wardrobe w
         JOIN episode_wardrobe ew ON ew.wardrobe_id = w.id
         WHERE ew.episode_id = :episodeId`,
        { replacements: { episodeId: id }, type: models.sequelize.QueryTypes.SELECT }
      ).then(rows => [rows]).catch(() => [[]]);

      if (wardrobeItems && wardrobeItems.length > 0) {
        // Find outfit (dress, top, bottom)
        const outfitItem = wardrobeItems.find(w =>
          ['dress', 'top', 'bottom', 'outfit'].includes((w.clothing_category || '').toLowerCase())
        );
        const accessoryItems = wardrobeItems.filter(w =>
          ['accessories', 'jewelry', 'hat', 'scarf'].includes((w.clothing_category || '').toLowerCase())
        );

        if (outfitItem) {
          const tags = typeof outfitItem.tags === 'string' ? JSON.parse(outfitItem.tags) : outfitItem.tags;
          styleScores.outfit_match = computeOutfitMatch(event, { tags });
        }
        if (accessoryItems.length > 0) {
          const parsedItems = accessoryItems.map(a => ({
            tags: typeof a.tags === 'string' ? JSON.parse(a.tags) : a.tags,
          }));
          styleScores.accessory_match = computeAccessoryMatch(event, parsedItems);
        }
      }
    } catch (e) {
      console.log('Wardrobe query skipped:', e.message);
    }

    // Compute evaluation
    const evaluation = evaluate({
      state: {
        coins: state.coins,
        reputation: state.reputation,
        brand_trust: state.brand_trust,
        influence: state.influence,
        stress: state.stress,
      },
      event,
      style: styleScores,
      intent,
      bonuses: { total_boost: 0 },
    });

    // Generate narrative lines
    const narrativeLines = generateNarrativeLine(evaluation);

    // Compute stat deltas
    const statDeltas = computeStatDeltas(evaluation, event, []);

    // Build evaluation JSON
    const evaluationJson = {
      ...evaluation,
      stat_deltas: statDeltas,
      narrative_lines: narrativeLines,
      event_parsed: event,
      intent,
      character_key,
      scope,
      evaluated_at: new Date().toISOString(),
      warnings: [],
    };

    // Check out-of-order
    if (state.last_applied_episode_id) {
      try {
        const lastEp = await models.Episode.findByPk(state.last_applied_episode_id);
        if (lastEp && episode.episode_number && lastEp.episode_number) {
          if (episode.episode_number <= lastEp.episode_number) {
            evaluationJson.warnings.push({
              code: 'OUT_OF_ORDER_EPISODE',
              message: `This is Episode ${episode.episode_number} but the last applied was Episode ${lastEp.episode_number}.`,
            });
          }
        }
      } catch (e) { /* skip check */ }
    }

    // Suggest available overrides
    evaluationJson.suggested_overrides = Object.entries(OVERRIDE_REASONS).map(([code, info]) => ({
      reason_code: code,
      label: info.label,
      category: info.category,
      allowed: true,
      max_tier_bump: info.maxTierBump,
    }));

    // Save to episode (compute only, not accepted)
    await episode.update({
      evaluation_json: evaluationJson,
      evaluation_status: 'computed',
      formula_version: FORMULA_VERSION,
    });

    return res.json({
      success: true,
      episode_id: id,
      evaluation: evaluationJson,
    });
  } catch (error) {
    console.error('Evaluate episode error:', error);
    return res.status(500).json({ error: 'Evaluation failed', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/episodes/:id/override
// ═══════════════════════════════════════════

router.post('/episodes/:id/override', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      override_type = 'tier_change', // 'tier_change' | 'style_adjust'
      tier_to,
      outfit_match,
      accessory_match,
      reason_code,
      costs = {},
      impact = {},
      narrative_line,
    } = req.body;

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const episode = await models.Episode.findByPk(id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    if (episode.evaluation_status !== 'computed') {
      return res.status(400).json({ error: 'Episode must be evaluated before overriding. Current status: ' + episode.evaluation_status });
    }

    const evalJson = episode.evaluation_json;
    if (!evalJson) return res.status(400).json({ error: 'No evaluation data found' });

    // ─── TIER CHANGE ───
    if (override_type === 'tier_change') {
      if (!tier_to) return res.status(400).json({ error: 'tier_to is required for tier_change' });
      if (!reason_code) return res.status(400).json({ error: 'reason_code is required' });

      const validation = validateOverride(evalJson.tier_final, tier_to);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Check max 1 tier override per episode
      const existingOverrides = (evalJson.overrides || []).filter(o => o.type === 'tier_change');
      if (existingOverrides.length >= 1) {
        return res.status(400).json({ error: 'Maximum one tier override per episode (MVP rule).' });
      }

      const override = {
        type: 'tier_change',
        tier_from: evalJson.tier_final,
        tier_to,
        reason_code,
        costs,
        impact,
        narrative_line: narrative_line || null,
        applied_by: 'user',
        applied_at: new Date().toISOString(),
      };

      evalJson.tier_final = tier_to;
      evalJson.overrides = [...(evalJson.overrides || []), override];

      // Recalculate stat deltas with override
      evalJson.stat_deltas = computeStatDeltas(
        { ...evalJson, tier_final: tier_to },
        evalJson.event_parsed,
        evalJson.overrides
      );

      // Regenerate narrative
      evalJson.narrative_lines = generateNarrativeLine({ ...evalJson, tier_final: tier_to });
    }

    // ─── STYLE ADJUST ───
    if (override_type === 'style_adjust') {
      if (outfit_match !== undefined) {
        evalJson.style_scores = evalJson.style_scores || {};
        evalJson.style_scores.outfit_match_original = evalJson.breakdown?.outfit_match?.value;
        evalJson.style_scores.outfit_match = outfit_match;
      }
      if (accessory_match !== undefined) {
        evalJson.style_scores = evalJson.style_scores || {};
        evalJson.style_scores.accessory_match_original = evalJson.breakdown?.accessory_match?.value;
        evalJson.style_scores.accessory_match = accessory_match;
      }

      const styleOverride = {
        type: 'style_adjust',
        reason_code: reason_code || 'CREATOR_ADJUSTMENT_STYLE_MATCH',
        outfit_match,
        accessory_match,
        applied_by: 'user',
        applied_at: new Date().toISOString(),
      };

      evalJson.overrides = [...(evalJson.overrides || []), styleOverride];

      // Note: style adjust doesn't re-run the full formula. It's just metadata.
      // The score was already computed. Style adjust is for the display/record.
    }

    await episode.update({ evaluation_json: evalJson });

    return res.json({
      success: true,
      episode_id: id,
      evaluation: evalJson,
    });
  } catch (error) {
    console.error('Override error:', error);
    return res.status(500).json({ error: 'Override failed', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/episodes/:id/accept
// ═══════════════════════════════════════════

router.post('/episodes/:id/accept', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      apply_scope = 'season',
      allow_out_of_order = false,
    } = req.body;

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const episode = await models.Episode.findByPk(id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    if (episode.evaluation_status === 'accepted') {
      return res.status(400).json({ error: 'Episode already accepted. Use re-evaluate first.' });
    }

    if (episode.evaluation_status !== 'computed') {
      return res.status(400).json({ error: 'Episode must be evaluated first.' });
    }

    const evalJson = episode.evaluation_json;
    if (!evalJson) return res.status(400).json({ error: 'No evaluation data found' });

    const characterKey = evalJson.character_key || 'lala';
    const showId = episode.show_id;
    const seasonId = apply_scope === 'global' ? null : null; // TODO: season support

    // Get current state
    const state = await getOrCreateCharacterState(models.sequelize, showId, seasonId, characterKey);
    const warnings = [];

    // Out-of-order check
    if (state.last_applied_episode_id && state.last_applied_episode_id !== id) {
      try {
        const lastEp = await models.Episode.findByPk(state.last_applied_episode_id);
        if (lastEp && episode.episode_number && lastEp.episode_number) {
          if (episode.episode_number <= lastEp.episode_number) {
            if (!allow_out_of_order) {
              return res.status(400).json({
                error: 'Out of order',
                message: `Last accepted was Episode ${lastEp.episode_number}. This is Episode ${episode.episode_number}. Set allow_out_of_order=true to proceed.`,
                code: 'OUT_OF_ORDER_APPLY',
              });
            }
            warnings.push({
              code: 'OUT_OF_ORDER_APPLY',
              message: `Applied Episode ${episode.episode_number} before Episode ${lastEp.episode_number + 1}.`,
            });
          }
        }
      } catch (e) { /* skip */ }
    }

    // Apply stat deltas
    const deltas = evalJson.stat_deltas || {};
    const currentState = {
      coins: state.coins,
      reputation: state.reputation,
      brand_trust: state.brand_trust,
      influence: state.influence,
      stress: state.stress,
    };
    const newState = applyDeltas(currentState, deltas);

    // Update character_state
    await models.sequelize.query(
      `UPDATE character_state
       SET coins = :coins, reputation = :reputation, brand_trust = :brand_trust,
           influence = :influence, stress = :stress,
           last_applied_episode_id = :episodeId, updated_at = NOW()
       WHERE id = :stateId`,
      {
        replacements: {
          ...newState,
          episodeId: id,
          stateId: state.id,
        },
      }
    );

    // Write to character_state_history ledger
    await models.sequelize.query(
      `INSERT INTO character_state_history
       (id, show_id, season_id, character_key, episode_id, source, deltas_json, state_after_json, notes, created_at)
       VALUES (:id, :showId, :seasonId, :characterKey, :episodeId, :source, :deltas, :stateAfter, :notes, NOW())`,
      {
        replacements: {
          id: uuidv4(),
          showId,
          seasonId: seasonId || null,
          characterKey,
          episodeId: id,
          source: (evalJson.overrides || []).length > 0 ? 'override' : 'computed',
          deltas: JSON.stringify(deltas),
          stateAfter: JSON.stringify(newState),
          notes: evalJson.narrative_lines?.short || null,
        },
      }
    );

    // Mark episode as accepted
    evalJson.accepted_at = new Date().toISOString();
    await episode.update({
      evaluation_json: evalJson,
      evaluation_status: 'accepted',
    });

    return res.json({
      success: true,
      episode_id: id,
      accepted: true,
      applied_deltas: deltas,
      previous_state: currentState,
      new_state: newState,
      tier_final: evalJson.tier_final,
      score: evalJson.score,
      narrative: evalJson.narrative_lines?.short,
      warnings,
    });
  } catch (error) {
    console.error('Accept error:', error);
    return res.status(500).json({ error: 'Accept failed', message: error.message });
  }
});


module.exports = router;
