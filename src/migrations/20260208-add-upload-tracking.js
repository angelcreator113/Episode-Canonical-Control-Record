'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if raw_footage table exists, if not we'll create stubs for it
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes('raw_footage')) {
      // Create raw_footage table with upload tracking
      await queryInterface.createTable('raw_footage', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE'
        },
        s3_key: {
          type: Sequelize.STRING(1000),
          allowNull: false,
          comment: 'S3 path to video file'
        },
        file_size: {
          type: Sequelize.BIGINT,
          comment: 'File size in bytes'
        },
        duration_seconds: {
          type: Sequelize.INTEGER,
          comment: 'Video duration'
        },
        upload_purpose: {
          type: Sequelize.STRING(100),
          comment: 'Why was this uploaded? (main_footage, b_roll, audio_only, reference)'
        },
        character_visible: {
          type: Sequelize.JSONB,
          comment: 'Which characters are in this footage'
        },
        intended_scene_id: {
          type: Sequelize.UUID,
          references: { model: 'scenes', key: 'id' },
          comment: 'Which scene this belongs to (user-specified)'
        },
        recording_context: {
          type: Sequelize.JSONB,
          defaultValue: {},
          comment: 'Camera, location, lighting, etc.'
        },
        
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      });

      // Add indexes to raw_footage
      await queryInterface.addIndex('raw_footage', ['episode_id']);
      await queryInterface.addIndex('raw_footage', ['upload_purpose']);
    } else {
      // Add columns if table exists
      const table = await queryInterface.describeTable('raw_footage');
      
      if (!table.upload_purpose) {
        await queryInterface.addColumn('raw_footage', 'upload_purpose', {
          type: Sequelize.STRING(100),
          comment: 'Why was this uploaded? (main_footage, b_roll, audio_only, reference)'
        });
      }
      
      if (!table.character_visible) {
        await queryInterface.addColumn('raw_footage', 'character_visible', {
          type: Sequelize.JSONB,
          comment: 'Which characters are in this footage'
        });
      }
      
      if (!table.intended_scene_id) {
        await queryInterface.addColumn('raw_footage', 'intended_scene_id', {
          type: Sequelize.UUID,
          references: { model: 'scenes', key: 'id' },
          comment: 'Which scene this belongs to (user-specified)'
        });
      }
      
      if (!table.recording_context) {
        await queryInterface.addColumn('raw_footage', 'recording_context', {
          type: Sequelize.JSONB,
          defaultValue: {},
          comment: 'Camera, location, lighting, etc.'
        });
      }
    }

    // Create upload logs table
    await queryInterface.createTable('upload_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING(255),
        comment: 'User who uploaded'
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'CASCADE'
      },
      raw_footage_id: {
        type: Sequelize.UUID,
        references: { model: 'raw_footage', key: 'id' },
        onDelete: 'CASCADE'
      },
      file_type: {
        type: Sequelize.STRING(50),
        comment: 'mp4, mov, mkv, etc.'
      },
      file_size: {
        type: Sequelize.BIGINT,
        comment: 'File size in bytes'
      },
      upload_duration_ms: {
        type: Sequelize.INTEGER,
        comment: 'How long upload took'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: 'Additional upload metadata'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes to upload_logs
    await queryInterface.addIndex('upload_logs', ['episode_id']);
    await queryInterface.addIndex('upload_logs', ['user_id']);
    await queryInterface.addIndex('upload_logs', ['raw_footage_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('upload_logs');
    // Don't drop raw_footage if it existed before
  }
};
