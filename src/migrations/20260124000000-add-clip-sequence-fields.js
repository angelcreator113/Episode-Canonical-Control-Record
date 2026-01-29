'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Make scene_library_id nullable (for notes support)
    await queryInterface.changeColumn('episode_scenes', 'scene_library_id', {
      type: Sequelize.UUID,
      allowNull: true, // Changed from false to true
      references: {
        model: 'scene_library',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Reference to the scene in the library (nullable for notes)',
    });

    // 2. Add 'type' enum column
    await queryInterface.addColumn('episode_scenes', 'type', {
      type: Sequelize.ENUM('clip', 'note'),
      allowNull: false,
      defaultValue: 'clip',
      comment: 'Type of sequence item: clip from library or manual note',
    });

    // 3. Add 'manual_duration_seconds' for notes
    await queryInterface.addColumn('episode_scenes', 'manual_duration_seconds', {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: true,
      comment: 'Manual duration for notes or missing clips',
    });

    // 4. Add 'title_override' for custom titles
    await queryInterface.addColumn('episode_scenes', 'title_override', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Override title for this sequence item',
    });

    // 5. Add 'note_text' for note content
    await queryInterface.addColumn('episode_scenes', 'note_text', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Text content for note-type items',
    });

    // 6. Add 'added_by' for tracking who added
    await queryInterface.addColumn('episode_scenes', 'added_by', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'User who added this item to the sequence',
    });

    // 7. Add 'last_edited_at' for tracking edits
    await queryInterface.addColumn('episode_scenes', 'last_edited_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last time this item was edited',
    });

    // 8. Add index on 'type' for filtering
    await queryInterface.addIndex('episode_scenes', ['type'], {
      name: 'idx_episode_scenes_type',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('episode_scenes', 'idx_episode_scenes_type');

    // Remove new columns
    await queryInterface.removeColumn('episode_scenes', 'last_edited_at');
    await queryInterface.removeColumn('episode_scenes', 'added_by');
    await queryInterface.removeColumn('episode_scenes', 'note_text');
    await queryInterface.removeColumn('episode_scenes', 'title_override');
    await queryInterface.removeColumn('episode_scenes', 'manual_duration_seconds');
    await queryInterface.removeColumn('episode_scenes', 'type');

    // Restore scene_library_id to non-nullable
    await queryInterface.changeColumn('episode_scenes', 'scene_library_id', {
      type: Sequelize.UUID,
      allowNull: false, // Restored to false
      references: {
        model: 'scene_library',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Reference to the scene in the library',
    });
  },
};
