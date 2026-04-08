'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (!desc.source_calendar_event_id) {
      await queryInterface.addColumn('world_events', 'source_calendar_event_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to StoryCalendarEvent — the cultural moment that spawned this event',
      });
      await queryInterface.addIndex('world_events', ['source_calendar_event_id'], {
        name: 'idx_world_events_source_calendar',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'source_calendar_event_id').catch(() => {});
  },
};
