'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('scenes');
    
    // Add script_notes column
    if (!table.script_notes) {
      await queryInterface.addColumn('scenes', 'script_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    
    // Add start_timecode column
    if (!table.start_timecode) {
      await queryInterface.addColumn('scenes', 'start_timecode', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    
    // Add end_timecode column
    if (!table.end_timecode) {
      await queryInterface.addColumn('scenes', 'end_timecode', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    
    // Add locked_at column
    if (!table.locked_at) {
      await queryInterface.addColumn('scenes', 'locked_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    
    // Add locked_by column
    if (!table.locked_by) {
      await queryInterface.addColumn('scenes', 'locked_by', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    
    // Add created_by column
    if (!table.created_by) {
      await queryInterface.addColumn('scenes', 'created_by', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    
    // Add updated_by column
    if (!table.updated_by) {
      await queryInterface.addColumn('scenes', 'updated_by', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    
    // Add thumbnail_id column
    if (!table.thumbnail_id) {
      await queryInterface.addColumn('scenes', 'thumbnail_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'thumbnails',
          key: 'id',
        },
      });
    }
    
    // Add assets column (JSON object)
    if (!table.assets) {
      await queryInterface.addColumn('scenes', 'assets', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      });
    }
    
    // Add raw_footage_s3_key column
    if (!table.raw_footage_s3_key) {
      await queryInterface.addColumn('scenes', 'raw_footage_s3_key', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
    
    // Add ai_scene_detected column - rename from ai_detected if exists
    if (!table.ai_scene_detected) {
      if (table.ai_detected) {
        await queryInterface.renameColumn('scenes', 'ai_detected', 'ai_scene_detected');
      } else {
        await queryInterface.addColumn('scenes', 'ai_scene_detected', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('scenes', 'script_notes');
    await queryInterface.removeColumn('scenes', 'start_timecode');
    await queryInterface.removeColumn('scenes', 'end_timecode');
    await queryInterface.removeColumn('scenes', 'locked_at');
    await queryInterface.removeColumn('scenes', 'locked_by');
    await queryInterface.removeColumn('scenes', 'created_by');
    await queryInterface.removeColumn('scenes', 'updated_by');
    await queryInterface.removeColumn('scenes', 'thumbnail_id');
    await queryInterface.removeColumn('scenes', 'assets');
    await queryInterface.removeColumn('scenes', 'raw_footage_s3_key');
    
    // Rename back if it was renamed
    const table = await queryInterface.describeTable('scenes');
    if (table.ai_scene_detected && !table.ai_detected) {
      await queryInterface.renameColumn('scenes', 'ai_scene_detected', 'ai_detected');
    }
  },
};
