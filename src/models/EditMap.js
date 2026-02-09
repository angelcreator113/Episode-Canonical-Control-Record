module.exports = (sequelize, DataTypes) => {
  const EditMap = sequelize.define('EditMap', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    raw_footage_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    analysis_version: {
      type: DataTypes.STRING(50),
      defaultValue: '1.0'
    },
    
    // Audio understanding
    transcript: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Word-level timestamps from ASR'
    },
    speaker_segments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Diarization: who spoke when'
    },
    audio_events: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Non-speech: laughter, music, silence'
    },
    
    // Character tracking
    character_presence: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Who is visible on screen when'
    },
    active_speaker_timeline: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Voice linked to person tracks'
    },
    
    // Editing structure
    scene_boundaries: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Auto-detected cuts and scene changes'
    },
    b_roll_opportunities: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Moments where overlays work'
    },
    suggested_cuts: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Natural edit points (breaths, pauses)'
    },
    
    // Metadata
    duration_seconds: {
      type: DataTypes.INTEGER,
      comment: 'Total video duration'
    },
    processing_status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
      comment: 'pending, processing, completed, failed'
    },
    processing_started_at: {
      type: DataTypes.DATE
    },
    processing_completed_at: {
      type: DataTypes.DATE
    },
    error_message: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'edit_maps',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['episode_id'] },
      { fields: ['raw_footage_id'] },
      { fields: ['processing_status'] }
    ]
  });

  EditMap.associate = (models) => {
    EditMap.belongsTo(models.Episode, { 
      foreignKey: 'episode_id',
      onDelete: 'CASCADE'
    });
    EditMap.belongsTo(models.RawFootage, { 
      foreignKey: 'raw_footage_id',
      onDelete: 'CASCADE'
    });
  };

  return EditMap;
};
