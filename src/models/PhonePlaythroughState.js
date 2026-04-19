'use strict';
const { DataTypes } = require('sequelize');

/**
 * PhonePlaythroughState — per-user, per-episode runtime state for the playable
 * Lala's Phone experience.
 *
 * Schema mirrors the in-memory state the editor preview uses, so the same
 * phoneRuntime evaluator works in both places. Unique index on (user_id,
 * episode_id) enforces one active playthrough per episode per user — reset
 * edits in place rather than creating a new row.
 */
module.exports = (sequelize) => {
  const PhonePlaythroughState = sequelize.define('PhonePlaythroughState', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.STRING(255), allowNull: false },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    show_id: { type: DataTypes.UUID, allowNull: false },
    // Free-form flags driven by `set_state` actions. Keys match the schema we
    // accept in conditions/actions (snake_case identifier).
    state_flags: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    // Every screen the user lands on is pushed here so `visited:<id>`
    // conditions can resolve. Bounded at a reasonable max in the route handler.
    visited_screens: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    // Mission ids whose reward actions have already fired for this playthrough.
    // The runtime uses this to avoid re-firing rewards on every tap after a
    // mission first completes. Mirrors visited_screens in shape.
    completed_mission_ids: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    last_screen_id: { type: DataTypes.STRING(255), allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'phone_playthrough_state',
    underscored: true,
    paranoid: true,
    timestamps: true,
    createdAt: 'started_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  PhonePlaythroughState.associate = (models) => {
    if (models.Episode) {
      PhonePlaythroughState.belongsTo(models.Episode, { foreignKey: 'episode_id', onDelete: 'CASCADE' });
    }
    if (models.Show) {
      PhonePlaythroughState.belongsTo(models.Show, { foreignKey: 'show_id', onDelete: 'CASCADE' });
    }
  };

  return PhonePlaythroughState;
};
