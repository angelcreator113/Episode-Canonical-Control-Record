'use strict';
const { DataTypes } = require('sequelize');

/**
 * SeasonSlot — one of a season's 24 episode slots (Season Arc, Evoni's
 * rulings A2–A8, docs/EVENT_EPISODE_FLOW.md §8(ff); migration
 * 20261001230000-create-season-slots).
 *
 * A slot's state is computed on read (seasonSlotService.slotState): done,
 * in production, event ready, needs an event. The intention and result
 * columns are filled by later Season Arc PRs.
 */
module.exports = (sequelize) => {
  const SeasonSlot = sequelize.define('SeasonSlot', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    arc_id: { type: DataTypes.UUID, allowNull: false },
    season_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    slot_number: { type: DataTypes.INTEGER, allowNull: false },
    phase: { type: DataTypes.INTEGER, allowNull: false },

    event_id: { type: DataTypes.UUID, allowNull: true },
    episode_id: { type: DataTypes.UUID, allowNull: true },

    // Intention (A3)
    story_purpose: { type: DataTypes.TEXT, allowNull: true }, // the primary purpose's text (A10)
    // A10: up to three purposes, primary first: [{ text, primary, story_thread_id }]
    story_purposes: { type: DataTypes.JSONB, allowNull: true },
    career_focus: { type: DataTypes.TEXT, allowNull: true },
    desired_pressure: { type: DataTypes.STRING(10), allowNull: true }, // Low | Medium | High | Peak
    story_thread_id: { type: DataTypes.UUID, allowNull: true }, // the primary purpose's thread (A10)
    outcome_range: { type: DataTypes.JSONB, allowNull: true },
    intention_source: { type: DataTypes.STRING(20), allowNull: true }, // auto-drafted | edited

    // Result (A6, A8)
    actual_outcome: { type: DataTypes.STRING(10), allowNull: true },
    actual_pressure: { type: DataTypes.STRING(10), allowNull: true },
    accepted_at: { type: DataTypes.DATE, allowNull: true },

    locked_at: { type: DataTypes.DATE, allowNull: true }, // A7: set at Start Episode
  }, {
    tableName: 'season_slots',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  SeasonSlot.associate = (models) => {
    if (models.ShowArc) SeasonSlot.belongsTo(models.ShowArc, { foreignKey: 'arc_id', as: 'arc' });
  };

  return SeasonSlot;
};
