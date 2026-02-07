'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('scenes');
    
    // Add scene_type column
    if (!table.scene_type) {
      await queryInterface.addColumn('scenes', 'scene_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }
    
    // Add production_status column
    if (!table.production_status) {
      await queryInterface.addColumn('scenes', 'production_status', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'draft',
      });
    }
    
    // Add mood column
    if (!table.mood) {
      await queryInterface.addColumn('scenes', 'mood', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    
    // Add characters column (JSON array)
    if (!table.characters) {
      await queryInterface.addColumn('scenes', 'characters', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      });
    }
    
    // Add props column (JSON array)
    if (!table.props) {
      await queryInterface.addColumn('scenes', 'props', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      });
    }
    
    // Add camera_angles column (JSON array)
    if (!table.camera_angles) {
      await queryInterface.addColumn('scenes', 'camera_angles', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      });
    }
    
    // Add lighting column
    if (!table.lighting) {
      await queryInterface.addColumn('scenes', 'lighting', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    
    // Add audio_notes column
    if (!table.audio_notes) {
      await queryInterface.addColumn('scenes', 'audio_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    
    // Add is_locked column
    if (!table.is_locked) {
      await queryInterface.addColumn('scenes', 'is_locked', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    
    // Add trim_start_seconds column
    if (!table.trim_start_seconds) {
      await queryInterface.addColumn('scenes', 'trim_start_seconds', {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      });
    }
    
    // Add trim_end_seconds column
    if (!table.trim_end_seconds) {
      await queryInterface.addColumn('scenes', 'trim_end_seconds', {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('scenes', 'scene_type');
    await queryInterface.removeColumn('scenes', 'production_status');
    await queryInterface.removeColumn('scenes', 'mood');
    await queryInterface.removeColumn('scenes', 'characters');
    await queryInterface.removeColumn('scenes', 'props');
    await queryInterface.removeColumn('scenes', 'camera_angles');
    await queryInterface.removeColumn('scenes', 'lighting');
    await queryInterface.removeColumn('scenes', 'audio_notes');
    await queryInterface.removeColumn('scenes', 'is_locked');
    await queryInterface.removeColumn('scenes', 'trim_start_seconds');
    await queryInterface.removeColumn('scenes', 'trim_end_seconds');
  },
};
