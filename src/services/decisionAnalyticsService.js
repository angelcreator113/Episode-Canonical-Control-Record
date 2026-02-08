const { sequelize } = require('../models');
const { Op } = require('sequelize');

class DecisionAnalyticsService {

  /**
   * Get overall decision statistics
   */
  async getOverallStats(filters = {}) {
    const whereClause = this.buildWhereClause(filters);
    
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_decisions,
        COUNT(DISTINCT created_by) as unique_users,
        COUNT(DISTINCT episode_id) as episodes_with_decisions,
        COUNT(DISTINCT decision_type) as decision_types_used,
        MIN(created_at) as first_decision,
        MAX(created_at) as last_decision
      FROM user_decisions
      ${whereClause.sql}
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return stats[0] || {};
  }

  /**
   * Get decisions by type (breakdown)
   */
  async getDecisionsByType(filters = {}) {
    const whereClause = this.buildWhereClause(filters);

    const results = await sequelize.query(`
      SELECT 
        decision_type,
        COUNT(*) as count,
        COUNT(DISTINCT episode_id) as episodes,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM user_decisions
      ${whereClause.sql}
      GROUP BY decision_type
      ORDER BY count DESC
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Get most frequently chosen values for a decision type
   */
  async getTopChoices(decisionType, limit = 10, filters = {}) {
    const whereClause = this.buildWhereClause({
      ...filters,
      decision_type: decisionType
    });

    const results = await sequelize.query(`
      SELECT 
        chosen_option::text as chosen_value,
        COUNT(*) as frequency,
        COUNT(DISTINCT created_by) as users,
        COUNT(DISTINCT episode_id) as episodes,
        AVG(ai_confidence_score) as avg_confidence
      FROM user_decisions
      ${whereClause.sql}
      GROUP BY chosen_option::text
      ORDER BY frequency DESC
      LIMIT :limit
    `, {
      replacements: {
        ...whereClause.replacements,
        limit
      },
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Get decision timeline (decisions over time)
   */
  async getDecisionTimeline(interval = 'day', filters = {}) {
    const whereClause = this.buildWhereClause(filters);
    
    // Determine SQL date truncation based on interval
    const dateTrunc = {
      hour: "date_trunc('hour', created_at)",
      day: "date_trunc('day', created_at)",
      week: "date_trunc('week', created_at)",
      month: "date_trunc('month', created_at)"
    }[interval] || "date_trunc('day', created_at)";

    const results = await sequelize.query(`
      SELECT 
        ${dateTrunc} as period,
        decision_type,
        COUNT(*) as count
      FROM user_decisions
      ${whereClause.sql}
      GROUP BY period, decision_type
      ORDER BY period ASC, decision_type
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Detect patterns (AI-ready insights)
   */
  async detectPatterns(filters = {}) {
    const patterns = [];

    // Pattern 1: Frequently paired decisions
    const pairedDecisions = await this.findPairedDecisions(filters);
    if (pairedDecisions.length > 0) {
      patterns.push({
        type: 'frequently_paired',
        description: 'Decisions that often happen together',
        data: pairedDecisions
      });
    }

    // Pattern 2: Time-based patterns
    const timePatterns = await this.findTimePatterns(filters);
    if (timePatterns.length > 0) {
      patterns.push({
        type: 'time_based',
        description: 'Decisions clustered by time of day',
        data: timePatterns
      });
    }

    // Pattern 3: User preferences
    const preferences = await this.findUserPreferences(filters);
    if (preferences.length > 0) {
      patterns.push({
        type: 'user_preferences',
        description: 'Strong user preferences detected',
        data: preferences
      });
    }

    return patterns;
  }

  /**
   * Find decisions that frequently occur together
   */
  async findPairedDecisions(filters = {}) {
    const whereClause = this.buildWhereClause(filters, 'd1');

    const results = await sequelize.query(`
      SELECT 
        d1.decision_type as type1,
        d1.chosen_option::text as value1,
        d2.decision_type as type2,
        d2.chosen_option::text as value2,
        COUNT(*) as frequency
      FROM user_decisions d1
      JOIN user_decisions d2 
        ON d1.episode_id = d2.episode_id 
        AND d1.id < d2.id
        AND d1.created_at::date = d2.created_at::date
      WHERE d1.decision_type != d2.decision_type
        ${whereClause.sql ? 'AND ' + whereClause.sql.replace('WHERE', '') : ''}
      GROUP BY type1, value1, type2, value2
      HAVING COUNT(*) >= 3
      ORDER BY frequency DESC
      LIMIT 20
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Find time-based patterns
   */
  async findTimePatterns(filters = {}) {
    const whereClause = this.buildWhereClause(filters);

    const results = await sequelize.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour_of_day,
        decision_type,
        chosen_option::text as chosen_value,
        COUNT(*) as frequency
      FROM user_decisions
      ${whereClause.sql}
      GROUP BY hour_of_day, decision_type, chosen_option::text
      HAVING COUNT(*) >= 5
      ORDER BY hour_of_day, frequency DESC
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Find strong user preferences
   */
  async findUserPreferences(filters = {}) {
    const whereClause = this.buildWhereClause(filters);

    const results = await sequelize.query(`
      WITH choice_stats AS (
        SELECT 
          decision_type,
          chosen_option::text as chosen_value,
          COUNT(*) as frequency,
          COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY decision_type) as percentage
        FROM user_decisions
        ${whereClause.sql}
        GROUP BY decision_type, chosen_option::text
      )
      SELECT 
        decision_type,
        chosen_value,
        frequency,
        ROUND(percentage::numeric, 2) as percentage
      FROM choice_stats
      WHERE percentage >= 60
      ORDER BY percentage DESC, frequency DESC
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Export decision data for AI training
   */
  async exportForTraining(filters = {}) {
    const whereClause = this.buildWhereClause(filters);

    const decisions = await sequelize.query(`
      SELECT 
        id,
        created_by as user_id,
        episode_id,
        decision_type,
        chosen_option as chosen_value,
        rejected_options as available_options,
        context_data as context,
        ai_confidence_score,
        user_rating,
        created_at
      FROM user_decisions
      ${whereClause.sql}
      ORDER BY created_at ASC
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return {
      export_date: new Date().toISOString(),
      total_decisions: decisions.length,
      filters_applied: filters,
      decisions: decisions
    };
  }

  /**
   * Get decision distribution (for charts)
   */
  async getDecisionDistribution(decisionType, filters = {}) {
    const whereClause = this.buildWhereClause({
      ...filters,
      decision_type: decisionType
    });

    const results = await sequelize.query(`
      SELECT 
        chosen_option::text as label,
        COUNT(*) as value,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM user_decisions
      ${whereClause.sql}
      GROUP BY chosen_option::text
      ORDER BY value DESC
    `, {
      replacements: whereClause.replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  }

  /**
   * Helper: Build WHERE clause from filters
   */
  buildWhereClause(filters = {}, tableAlias = '') {
    const conditions = [];
    const replacements = {};
    const prefix = tableAlias ? `${tableAlias}.` : '';

    if (filters.user_id) {
      conditions.push(`${prefix}created_by = :user_id`);
      replacements.user_id = filters.user_id;
    }

    if (filters.episode_id) {
      conditions.push(`${prefix}episode_id = :episode_id::uuid`);
      replacements.episode_id = filters.episode_id;
    }

    if (filters.decision_type) {
      conditions.push(`${prefix}decision_type = :decision_type`);
      replacements.decision_type = filters.decision_type;
    }

    if (filters.start_date) {
      conditions.push(`${prefix}created_at >= :start_date`);
      replacements.start_date = filters.start_date;
    }

    if (filters.end_date) {
      conditions.push(`${prefix}created_at <= :end_date`);
      replacements.end_date = filters.end_date;
    }

    const sql = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return { sql, replacements };
  }
}

module.exports = new DecisionAnalyticsService();
