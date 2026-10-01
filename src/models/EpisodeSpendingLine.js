'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeSpendingLine — one thing Lala buys during the event (drinks,
 * valet, photo booth and the like): Evoni's event cost split ruling,
 * 2026-09-30 (docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa)). It lives in the
 * episode's Money tab, editable until Complete, quantity × unit_price, and
 * is charged at Complete (financialTransactionService.finalizeEpisodeFinancials).
 *
 * source: 'extras' (drafted from the event's extras at Start Episode),
 * 'carried' (moved from an extras event_costs row, source_cost_id), or null
 * (added by hand). drafted_quantity / drafted_unit_price hold the drafted
 * copy: Auto-drafted while the line equals them, Edited once it differs.
 *
 * Migration: 20261001180000-create-episode-spending-lines.js.
 */
const SPENDING_SOURCES = Object.freeze(['extras', 'carried']);

module.exports = (sequelize) => {
  const EpisodeSpendingLine = sequelize.define('EpisodeSpendingLine', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    event_id: { type: DataTypes.UUID, allowNull: true },
    label: { type: DataTypes.STRING(200), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    unit_price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    source: { type: DataTypes.STRING(20), allowNull: true, validate: { isIn: [SPENDING_SOURCES] } },
    source_cost_id: { type: DataTypes.UUID, allowNull: true },
    drafted_quantity: { type: DataTypes.INTEGER, allowNull: true },
    drafted_unit_price: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'episode_spending_lines',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  EpisodeSpendingLine.associate = (models) => {
    if (models.Episode) EpisodeSpendingLine.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
  };

  EpisodeSpendingLine.SOURCES = SPENDING_SOURCES;
  return EpisodeSpendingLine;
};

module.exports.SPENDING_SOURCES = SPENDING_SOURCES;
