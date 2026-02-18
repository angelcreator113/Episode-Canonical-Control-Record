/**
 * Decision Logger
 * 
 * Records user decisions for future learning:
 *   - Beat type overrides (when user changes inferred beat type)
 *   - Autofix accepted/rejected (VOICE_ACTIVATE, Login insertions)
 *   - Evaluation overrides (tier bumps with reasons + costs)
 *   - Title choices (which of generated titles was picked)
 *   - Style match adjustments (outfit/accessory slider changes)
 *   - Browse pool selections (which items were browsed vs selected)
 *   - Transition/SFX suggestions accepted/rejected
 * 
 * Uses existing user_decisions + decision_patterns tables.
 * 
 * Location: src/utils/decisionLogger.js
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── DECISION TYPES ───

const DECISION_TYPES = {
  // Script
  BEAT_TYPE_OVERRIDE: 'beat_type_override',
  AUTOFIX_ACCEPTED: 'autofix_accepted',
  AUTOFIX_REJECTED: 'autofix_rejected',
  SCRIPT_FORMATTED: 'script_formatted',

  // Evaluation
  EVALUATION_COMPUTED: 'evaluation_computed',
  TIER_OVERRIDE: 'tier_override',
  STYLE_ADJUST: 'style_adjust',
  EVALUATION_ACCEPTED: 'evaluation_accepted',
  EVALUATION_RERUN: 'evaluation_rerun',

  // Content
  TITLE_CHOSEN: 'title_chosen',
  NARRATIVE_STYLE_CHOSEN: 'narrative_style_chosen',
  DESCRIPTION_EDITED: 'description_edited',

  // Browse Pool
  BROWSE_POOL_GENERATED: 'browse_pool_generated',
  BROWSE_BIAS_CHOSEN: 'browse_bias_chosen',
  BROWSE_ITEM_SWAPPED: 'browse_item_swapped',

  // Timeline
  TRANSITION_CHOSEN: 'transition_chosen',
  SFX_CHOSEN: 'sfx_chosen',
  DURATION_ADJUSTED: 'duration_adjusted',

  // Scene Composer
  SCENE_CREATED_FROM_SCRIPT: 'scene_created_from_script',
  SCENE_REORDERED: 'scene_reordered',
  ELEMENT_PLACED: 'element_placed',
};


/**
 * DecisionLogger class — wraps database writes for decision logging
 */
class DecisionLogger {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.buffer = [];
    this.flushInterval = null;
    this.bufferSize = 10;
  }

  /**
   * Log a decision
   * 
   * @param {object} params
   * @param {string} params.type - Decision type (from DECISION_TYPES)
   * @param {string} [params.episode_id] - Episode UUID
   * @param {string} [params.show_id] - Show UUID
   * @param {string} [params.user_id] - User UUID
   * @param {object} params.context - What was the situation
   * @param {object} params.decision - What did the user choose
   * @param {object} [params.alternatives] - What other options existed
   * @param {number} [params.confidence] - System confidence in suggestion (0-1)
   * @param {string} [params.source] - Where in the UI this happened
   */
  async log({
    type,
    episode_id = null,
    show_id = null,
    user_id = null,
    context = {},
    decision = {},
    alternatives = null,
    confidence = null,
    source = null,
  }) {
    const entry = {
      id: uuidv4(),
      type,
      episode_id,
      show_id,
      user_id,
      context_json: context,
      decision_json: decision,
      alternatives_json: alternatives,
      confidence,
      source,
      created_at: new Date(),
    };

    // Try direct write, fall back to buffer
    try {
      await this._writeToDb(entry);
    } catch (e) {
      // Buffer for later
      this.buffer.push(entry);
      if (this.buffer.length >= this.bufferSize) {
        await this.flush();
      }
      console.log('Decision buffered:', type, e.message);
    }
  }

  /**
   * Flush buffered decisions to DB
   */
  async flush() {
    if (this.buffer.length === 0) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    for (const entry of toFlush) {
      try {
        await this._writeToDb(entry);
      } catch (e) {
        console.error('Failed to flush decision:', entry.type, e.message);
      }
    }
  }

  /**
   * Write a single decision to the database
   */
  async _writeToDb(entry) {
    if (!this.sequelize) return;

    await this.sequelize.query(
      `INSERT INTO decision_log 
       (id, type, episode_id, show_id, user_id, context_json, decision_json, alternatives_json, confidence, source, created_at)
       VALUES (:id, :type, :episode_id, :show_id, :user_id, :context_json, :decision_json, :alternatives_json, :confidence, :source, :created_at)`,
      {
        replacements: {
          id: entry.id,
          type: entry.type,
          episode_id: entry.episode_id,
          show_id: entry.show_id,
          user_id: entry.user_id,
          context_json: JSON.stringify(entry.context_json),
          decision_json: JSON.stringify(entry.decision_json),
          alternatives_json: entry.alternatives_json ? JSON.stringify(entry.alternatives_json) : null,
          confidence: entry.confidence,
          source: entry.source,
          created_at: entry.created_at,
        },
      }
    );
  }

  // ═══════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════

  /**
   * Log a tier override decision
   */
  async logTierOverride({ episode_id, show_id, tier_from, tier_to, reason_code, costs, score }) {
    return this.log({
      type: DECISION_TYPES.TIER_OVERRIDE,
      episode_id,
      show_id,
      context: { tier_from, score },
      decision: { tier_to, reason_code, costs },
      alternatives: { could_accept: true, could_override_down: tier_from !== 'fail' },
      source: 'evaluate_page',
    });
  }

  /**
   * Log an evaluation acceptance
   */
  async logEvaluationAccepted({ episode_id, show_id, score, tier, had_overrides, stat_deltas }) {
    return this.log({
      type: DECISION_TYPES.EVALUATION_ACCEPTED,
      episode_id,
      show_id,
      context: { score, tier, had_overrides },
      decision: { accepted: true, stat_deltas },
      source: 'evaluate_page',
    });
  }

  /**
   * Log an autofix acceptance
   */
  async logAutofixAccepted({ episode_id, show_id, fix_type, fix_code, inserted_content }) {
    return this.log({
      type: DECISION_TYPES.AUTOFIX_ACCEPTED,
      episode_id,
      show_id,
      context: { fix_type, fix_code },
      decision: { accepted: true, content_preview: inserted_content?.substring(0, 200) },
      source: 'script_editor',
    });
  }

  /**
   * Log an autofix rejection
   */
  async logAutofixRejected({ episode_id, show_id, fix_type, fix_code }) {
    return this.log({
      type: DECISION_TYPES.AUTOFIX_REJECTED,
      episode_id,
      show_id,
      context: { fix_type, fix_code },
      decision: { accepted: false },
      source: 'script_editor',
    });
  }

  /**
   * Log a browse pool generation
   */
  async logBrowsePoolGenerated({ episode_id, show_id, bias, pool_size, total_items, has_wardrobe }) {
    return this.log({
      type: DECISION_TYPES.BROWSE_POOL_GENERATED,
      episode_id,
      show_id,
      context: { has_wardrobe },
      decision: { bias, pool_size, total_items },
      source: 'evaluate_page',
    });
  }

  /**
   * Log a style adjustment
   */
  async logStyleAdjust({ episode_id, show_id, field, system_value, user_value, reason }) {
    return this.log({
      type: DECISION_TYPES.STYLE_ADJUST,
      episode_id,
      show_id,
      context: { field, system_value },
      decision: { user_value, reason },
      confidence: null,
      source: 'evaluate_page',
    });
  }

  /**
   * Log a narrative style choice
   */
  async logNarrativeStyleChosen({ episode_id, show_id, style_chosen, options_available }) {
    return this.log({
      type: DECISION_TYPES.NARRATIVE_STYLE_CHOSEN,
      episode_id,
      show_id,
      context: { options_available },
      decision: { style: style_chosen },
      source: 'evaluate_page',
    });
  }

  /**
   * Log a script format action
   */
  async logScriptFormatted({ episode_id, show_id, beats_before, beats_after, lines_before, lines_after }) {
    return this.log({
      type: DECISION_TYPES.SCRIPT_FORMATTED,
      episode_id,
      show_id,
      context: { beats_before, lines_before },
      decision: { beats_after, lines_after },
      source: 'script_editor',
    });
  }
}


// ─── QUERY HELPERS (for World Admin page) ───

/**
 * Get decision statistics for a show
 */
async function getDecisionStats(sequelize, showId) {
  const [results] = await sequelize.query(
    `SELECT type, COUNT(*) as count, 
     MAX(created_at) as last_used
     FROM decision_log
     WHERE show_id = :showId
     GROUP BY type
     ORDER BY count DESC`,
    { replacements: { showId } }
  );
  return results;
}

/**
 * Get override patterns (what reasons are used most)
 */
async function getOverridePatterns(sequelize, showId) {
  const [results] = await sequelize.query(
    `SELECT 
       decision_json->>'reason_code' as reason_code,
       decision_json->>'tier_to' as tier_to,
       COUNT(*) as times_used,
       AVG((context_json->>'score')::int) as avg_score_when_used
     FROM decision_log
     WHERE show_id = :showId AND type = 'tier_override'
     GROUP BY decision_json->>'reason_code', decision_json->>'tier_to'
     ORDER BY times_used DESC`,
    { replacements: { showId } }
  );
  return results;
}

/**
 * Get autofix acceptance rate
 */
async function getAutofixStats(sequelize, showId) {
  const [results] = await sequelize.query(
    `SELECT 
       context_json->>'fix_code' as fix_code,
       type,
       COUNT(*) as count
     FROM decision_log
     WHERE show_id = :showId AND type IN ('autofix_accepted', 'autofix_rejected')
     GROUP BY context_json->>'fix_code', type
     ORDER BY fix_code, type`,
    { replacements: { showId } }
  );
  return results;
}

/**
 * Get recent decisions for a show
 */
async function getRecentDecisions(sequelize, showId, limit = 50) {
  const [results] = await sequelize.query(
    `SELECT * FROM decision_log
     WHERE show_id = :showId
     ORDER BY created_at DESC
     LIMIT :limit`,
    { replacements: { showId, limit } }
  );
  return results;
}


module.exports = {
  DecisionLogger,
  DECISION_TYPES,
  getDecisionStats,
  getOverridePatterns,
  getAutofixStats,
  getRecentDecisions,
};
