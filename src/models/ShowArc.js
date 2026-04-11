'use strict';
const { DataTypes } = require('sequelize');

/**
 * ShowArc — narrative arc container for a show/season.
 *
 * An arc spans multiple episodes and contains phases (sub-arcs).
 * Arc 1 of "Styling Adventures with Lala" is the full 24-episode season
 * with 3 phases: Foundation, Ascension, Legacy.
 *
 * Auto-progression fires at phase boundaries (ep 8, 16, 24).
 * Manual override lets the showrunner advance/extend with warnings.
 * Narrative debt tracks failed goals carried forward as emotional weight.
 */
module.exports = (sequelize) => {
  const ShowArc = sequelize.define('ShowArc', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },

    // Arc identity
    arc_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    title: { type: DataTypes.STRING(200), allowNull: false },
    tagline: { type: DataTypes.STRING(300), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    season_number: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },

    // Episode range for the entire arc
    episode_start: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    episode_end: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 24 },

    // Phases (sub-arcs) — JSONB array of phase definitions
    // [{
    //   phase: 1, title: 'Foundation', tagline: 'Prove you belong',
    //   episode_start: 1, episode_end: 8,
    //   status: 'active' | 'completed' | 'upcoming',
    //   activated_at, completed_at, activated_by: 'auto' | 'manual',
    //   emotional_arc: 'aspiration → first failure → recovery',
    //   feed_behavior: { follow_bias: 'aspiration', event_prestige_max: 6 },
    //   goal_summary: { total: 8, completed: 3, failed: 1, carried: 1 }
    // }]
    phases: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Current position
    current_phase: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    current_episode: { type: DataTypes.INTEGER, allowNull: true },

    // Arc status
    status: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active',
      // upcoming | active | completed
    },

    // Narrative debt — failed/incomplete goals that carry emotional weight
    // [{ goal_id, goal_title, target_metric, achieved, target, phase,
    //    narrative_weight: 'Lala never hit rep 5 — she carries that insecurity',
    //    affects: ['feed_tone', 'event_stakes', 'script_prompts'] }]
    narrative_debt: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Progression log — who triggered each transition and when
    // [{ from_phase, to_phase, triggered_by: 'auto'|'manual', trigger_reason,
    //    episode_number, timestamp, goals_carried, warning_acknowledged }]
    progression_log: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Emotional temperature — computed from goal completion + narrative debt
    emotional_temperature: {
      type: DataTypes.STRING(30), allowNull: true,
      // confident | anxious | desperate | rising | unstoppable | broken
    },

    icon: { type: DataTypes.STRING(10), allowNull: true, defaultValue: '📖' },
    color: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '#B8962E' },
  }, {
    tableName: 'show_arcs',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  ShowArc.associate = (models) => {
    if (models.Show) ShowArc.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
  };

  return ShowArc;
};
