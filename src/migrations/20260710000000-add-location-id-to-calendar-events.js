'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('story_calendar_events').catch(() => ({}));
    if (!desc.location_id) {
      await queryInterface.addColumn('story_calendar_events', 'location_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'world_locations', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to WorldLocation — links calendar event to a specific location',
      });
      await queryInterface.addIndex('story_calendar_events', ['location_id'], {
        name: 'idx_calendar_events_location',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('story_calendar_events', 'location_id').catch(() => {});
  },
};
