'use strict';

const TABLES = [
  'character_relationships',
  'character_sparks',
  'franchise_knowledge',
  'intimate_scenes',
  'relationship_events',
  'scene_continuations',
  'story_revisions',
  'story_threads',
  'world_character_batches',
  'world_characters',
  'world_locations',
  'world_state_snapshots',
  'world_timeline_events',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table).catch(() => null);
      if (!desc) continue; // table doesn't exist
      if (desc.deleted_at) continue; // already has it
      await queryInterface.addColumn(table, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table).catch(() => null);
      if (!desc || !desc.deleted_at) continue;
      await queryInterface.removeColumn(table, 'deleted_at');
    }
  },
};
