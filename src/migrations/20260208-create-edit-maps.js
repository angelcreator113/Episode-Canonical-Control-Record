'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Edit Maps (AI analysis results)
    await queryInterface.createTable('edit_maps', {
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
      raw_footage_id: {
        type: Sequelize.UUID,
        references: { model: 'raw_footage', key: 'id' },
        onDelete: 'CASCADE'
      },
      analysis_version: {
        type: Sequelize.STRING(50),
        defaultValue: '1.0'
      },
      
      // AUDIO UNDERSTANDING
      transcript: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Word-level timestamps from ASR'
      },
      speaker_segments: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Diarization: who spoke when'
      },
      audio_events: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: 'Non-speech: laughter, music, silence'
      },
      
      // CHARACTER TRACKING
      character_presence: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Who is visible on screen when'
      },
      active_speaker_timeline: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Voice linked to person tracks'
      },
      
      // EDITING STRUCTURE
      scene_boundaries: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Auto-detected cuts and scene changes'
      },
      b_roll_opportunities: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Moments where overlays work'
      },
      suggested_cuts: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Natural edit points (breaths, pauses)'
      },
      
      // METADATA
      duration_seconds: {
        type: Sequelize.INTEGER,
        comment: 'Total video duration'
      },
      processing_status: {
        type: Sequelize.STRING(50),
        defaultValue: 'pending',
        comment: 'pending, processing, completed, failed'
      },
      processing_started_at: {
        type: Sequelize.DATE
      },
      processing_completed_at: {
        type: Sequelize.DATE
      },
      error_message: {
        type: Sequelize.TEXT
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

    // Character Profiles (learned per show)
    await queryInterface.createTable('character_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE'
      },
      character_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      
      // EDITING STYLE PER CHARACTER
      editing_style: {
        type: Sequelize.JSONB,
        defaultValue: {
          pacing: 'medium',           // fast, medium, slow
          preferred_framing: 'medium', // close, medium, wide
          reaction_frequency: 0.5,     // 0-1 scale
          overlay_behavior: 'minimal', // minimal, moderate, heavy
          cut_on_emphasis: true,       // cut on gesture peaks
          cut_on_breath: false         // cut on breath pauses
        },
        comment: 'Per-character editing style preferences'
      },
      
      // VOICE/FACE IDS
      voice_embedding: {
        type: Sequelize.JSONB,
        comment: 'Voice signature for diarization'
      },
      face_embeddings: {
        type: Sequelize.JSONB,
        comment: 'Face signatures for recognition'
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

    // Indexes
    await queryInterface.addIndex('edit_maps', ['episode_id']);
    await queryInterface.addIndex('edit_maps', ['raw_footage_id']);
    await queryInterface.addIndex('edit_maps', ['processing_status']);
    await queryInterface.addIndex('character_profiles', ['show_id']);
    await queryInterface.addIndex('character_profiles', ['character_name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('character_profiles');
    await queryInterface.dropTable('edit_maps');
  }
};
