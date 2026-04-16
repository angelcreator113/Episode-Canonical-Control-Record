'use strict';
const { DataTypes } = require('sequelize');

/**
 * PhoneMission — read-only observer of playthrough state.
 *
 * Each mission has a list of objectives, where each objective is a condition
 * rule that gets evaluated against the player's current state. When all
 * objectives pass, the mission is "complete." No reward actions in v1 — that's
 * a follow-up once creators actually use missions and tell us what they want.
 *
 * `start_condition` optional: when set, the mission isn't active until it
 * evaluates to true (lets authors gate a mission on an earlier beat).
 * `episode_id` nullable: null means show-wide (e.g. onboarding).
 */
module.exports = (sequelize) => {
  const PhoneMission = sequelize.define('PhoneMission', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    episode_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    icon_url: { type: DataTypes.STRING(500), allowNull: true },
    // Optional gate — same condition grammar as zones/content. Null means "always active".
    start_condition: { type: DataTypes.JSONB, allowNull: true },
    // Array of { id, label, condition: [{key, op, value}, ...] }. An objective
    // is "complete" when its condition array ANDs to true.
    objectives: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // Actions that fire ONCE when the mission transitions from incomplete →
    // complete. Same allowlist as zone actions (navigate / set_state /
    // show_toast / complete_episode). Tracked via playthrough.completed_mission_ids.
    reward_actions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'phone_missions',
    underscored: true,
    paranoid: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  PhoneMission.associate = (models) => {
    if (models.Show) {
      PhoneMission.belongsTo(models.Show, { foreignKey: 'show_id', onDelete: 'CASCADE' });
    }
    if (models.Episode) {
      PhoneMission.belongsTo(models.Episode, { foreignKey: 'episode_id', onDelete: 'SET NULL' });
    }
  };

  return PhoneMission;
};
