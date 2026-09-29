'use strict';
const { DataTypes } = require('sequelize');

/**
 * EventDeliverable — one thing Lala promises to produce for an event
 * (Task #1814, slice 1a; docs/EVENT_EPISODE_FLOW.md §8(t) item 1).
 *
 * An Opportunity proposes deliverables (Opportunity.deliverables); both
 * opportunity-to-event paths copy them here (eventTermsService.js,
 * insertEventDeliverables). The Event Package owns them and edits them
 * until Start Episode, which stamps episode_id and snapshots them onto the
 * brief (EpisodeBrief.event_metadata.terms).
 *
 * Fulfilment is its own lifecycle (§8(t) item 4): pending → completed →
 * submitted → approved, each with its own timestamp. Rows are written
 * pending; after Start Episode the status POST in
 * src/routes/eventDeliverables.js moves one forward a step at a time
 * (validateDeliverableTransition in eventTermsService.js; Task #1815).
 *
 * owed_to says who the deliverable is owed to, host or brand (T2, §8(bb);
 * Task #2294). The one task list shows a host row as a host requirement and
 * a brand row as a brand deliverable.
 *
 * fee is the Prime Coins the deliverable pays on approval (deal build PR 1,
 * Task #2319); no code reads it yet.
 *
 * Migrations: 20260924000000-add-event-terms.js,
 * 20260929190000-add-event-deliverables-owed-to.js,
 * 20260929200001-add-event-deliverables-fee.js.
 */
const DELIVERABLE_STATUSES = ['pending', 'completed', 'submitted', 'approved'];
const DELIVERABLE_OWED_TO = ['host', 'brand'];

module.exports = (sequelize) => {
  const EventDeliverable = sequelize.define('EventDeliverable', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    event_id: { type: DataTypes.UUID, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    deliverable_type: { type: DataTypes.STRING(50), allowNull: true },
    // Story date, same convention as world_events.event_date.
    due_date: { type: DataTypes.STRING(50), allowNull: true },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | completed | submitted | approved',
      validate: { isIn: [DELIVERABLE_STATUSES] },
    },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    episode_id: { type: DataTypes.UUID, allowNull: true },
    owed_to: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'host',
      comment: 'host | brand',
      validate: { isIn: [DELIVERABLE_OWED_TO] },
    },
    fee: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'event_deliverables',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  EventDeliverable.associate = (models) => {
    if (models.WorldEvent) EventDeliverable.belongsTo(models.WorldEvent, { foreignKey: 'event_id', as: 'event' });
    if (models.Episode) EventDeliverable.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
  };

  EventDeliverable.STATUSES = DELIVERABLE_STATUSES;
  EventDeliverable.OWED_TO = DELIVERABLE_OWED_TO;

  return EventDeliverable;
};
