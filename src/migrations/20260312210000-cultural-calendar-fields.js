'use strict';

/**
 * Migration: 20260312210000-cultural-calendar-fields
 *
 * Adds cultural-calendar-specific columns to story_calendar_events:
 *   severity_level, cultural_category, activities (JSONB),
 *   phrases (JSONB), is_micro_event
 *
 * Idempotent — checks describeTable before adding each column.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('story_calendar_events');

    if (!table.severity_level) {
      await queryInterface.addColumn('story_calendar_events', 'severity_level', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'major | largest_event | awards_peak | null',
      });
    }

    if (!table.cultural_category) {
      await queryInterface.addColumn('story_calendar_events', 'cultural_category', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'fashion, beauty, lifestyle, entrepreneur, music, nightlife, awards, etc.',
      });
    }

    if (!table.activities) {
      await queryInterface.addColumn('story_calendar_events', 'activities', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of activity strings for this event',
      });
    }

    if (!table.phrases) {
      await queryInterface.addColumn('story_calendar_events', 'phrases', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of iconic phrase strings for this event',
      });
    }

    if (!table.is_micro_event) {
      await queryInterface.addColumn('story_calendar_events', 'is_micro_event', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True for floating events with no fixed month',
      });
    }

    // Add index on cultural_category for filtering
    const indexes = await queryInterface.showIndex('story_calendar_events');
    const hasCatIdx = indexes.some(i => i.name === 'story_calendar_events_cultural_category');
    if (!hasCatIdx) {
      await queryInterface.addIndex('story_calendar_events', ['cultural_category'], {
        name: 'story_calendar_events_cultural_category',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('story_calendar_events', 'severity_level').catch(() => {});
    await queryInterface.removeColumn('story_calendar_events', 'cultural_category').catch(() => {});
    await queryInterface.removeColumn('story_calendar_events', 'activities').catch(() => {});
    await queryInterface.removeColumn('story_calendar_events', 'phrases').catch(() => {});
    await queryInterface.removeColumn('story_calendar_events', 'is_micro_event').catch(() => {});
  },
};
