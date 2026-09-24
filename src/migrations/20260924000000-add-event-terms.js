'use strict';

/**
 * Event terms, slice 1a (Task #1814). Evoni's storage ruling (option E),
 * following the deliverables doctrine (docs/EVENT_EPISODE_FLOW.md §8(t)):
 * the four kinds of term never share one field.
 *
 *   access requirements — world_events.requirements (unchanged, not here)
 *   compensation        — world_events.is_paid / payment_amount (unchanged)
 *   restrictions        — world_events.restrictions, new JSONB array,
 *                         default []; each entry { type, description }
 *   deliverables        — event_deliverables, new table, one row per
 *                         deliverable the event owes
 *
 * event_deliverables.status is a STRING checked by the model
 * (EventDeliverable.js validate: isIn), not a Postgres ENUM, so a later
 * slice can widen it without a migration. Values: pending | completed |
 * submitted | approved. In slice 1a every row stays pending; recording
 * fulfilment is slice 1b. due_date is character varying(50), the same
 * story-date convention as world_events.event_date.
 *
 * episode_id is stamped by Start Episode (generateEpisodeFromEvent) when
 * the terms are snapshotted onto the brief.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const events = await queryInterface.describeTable('world_events');
    if (!events.restrictions) {
      await queryInterface.addColumn('world_events', 'restrictions', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'What Lala agrees not to do: [{type, description}] (Task #1814)',
      });
    }

    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tableNames.includes('event_deliverables')) {
      await queryInterface.createTable('event_deliverables', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'world_events', key: 'id' },
          onDelete: 'CASCADE',
          comment: 'The world_event that owes this deliverable',
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        deliverable_type: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Free-form kind (post, story, appearance …); from Opportunity.deliverables[].type when carried',
        },
        due_date: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Story date, same convention as world_events.event_date',
        },
        required: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'pending | completed | submitted | approved',
        },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        submitted_at: { type: Sequelize.DATE, allowNull: true },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'SET NULL',
          comment: 'Stamped by Start Episode when the terms are snapshotted',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });

      await queryInterface.addIndex('event_deliverables', ['event_id'], {
        name: 'idx_event_deliverables_event_id',
      });
      await queryInterface.addIndex('event_deliverables', ['episode_id'], {
        name: 'idx_event_deliverables_episode_id',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tableNames.includes('event_deliverables')) {
      await queryInterface.dropTable('event_deliverables');
    }

    const events = await queryInterface.describeTable('world_events');
    if (events.restrictions) {
      await queryInterface.removeColumn('world_events', 'restrictions');
    }
  },
};
