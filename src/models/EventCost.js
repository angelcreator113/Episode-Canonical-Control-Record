'use strict';
const { DataTypes } = require('sequelize');

/**
 * EventCost — one itemised cost of an event, and who pays it (deal build
 * PR 1, Task #2319; docs/DEAL_DESIGN.md §8 M-4). Travel is a reimbursement,
 * not income (QUESTION 4, docs/EVENT_EPISODE_FLOW.md §8(cc)). No code reads
 * or writes these yet; the itemised-costs PR does.
 *
 * Migration: 20260929200003-create-event-costs.js.
 */
const COST_KINDS = Object.freeze(['entry', 'travel', 'glam', 'styling', 'accommodation', 'extras', 'other']);
const COST_PAID_BY = Object.freeze(['lala', 'host', 'brand']);

module.exports = (sequelize) => {
  const EventCost = sequelize.define('EventCost', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    event_id: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [COST_KINDS] } },
    label: { type: DataTypes.STRING(200), allowNull: true },
    amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    paid_by: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'lala', validate: { isIn: [COST_PAID_BY] } },
  }, {
    tableName: 'event_costs',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  EventCost.associate = (models) => {
    if (models.WorldEvent) EventCost.belongsTo(models.WorldEvent, { foreignKey: 'event_id', as: 'event' });
  };

  EventCost.KINDS = COST_KINDS;
  EventCost.PAID_BY = COST_PAID_BY;

  return EventCost;
};

module.exports.COST_KINDS = COST_KINDS;
module.exports.COST_PAID_BY = COST_PAID_BY;
