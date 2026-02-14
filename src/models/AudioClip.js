const { DataTypes } = require('sequelize');

/**
 * AudioClip Model
 * Audio tracks for dialogue, ambience, music, SFX
 * Supports TTS now, real voice-over swap later
 * Phase 2.5 - Animatic System
 */
module.exports = (sequelize) => {
  const AudioClip = sequelize.define(
    'AudioClip',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'scene_id',
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'Scene this audio clip belongs to',
      },
      beat_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'beat_id',
        references: {
          model: 'beats',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Optional link to dialogue beat',
      },
      track_type: {
        type: DataTypes.ENUM('dialogue', 'ambience', 'music', 'sfx', 'foley'),
        allowNull: false,
        field: 'track_type',
        comment: 'Track type: dialogue, ambience, music, sfx, foley',
      },
      start_time: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
        },
        field: 'start_time',
        comment: 'Scene-relative start time in seconds',
      },
      duration: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0.001,
        },
        comment: 'Duration in seconds',
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'S3 URL to audio file',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Flexible JSONB: {volume, source, voice, fade_in, fade_out, waveform_data}',
      },
      status: {
        type: DataTypes.ENUM('tts', 'temp_recording', 'final', 'needs_replacement'),
        allowNull: false,
        defaultValue: 'tts',
        comment: 'Audio status: tts, temp_recording, final, needs_replacement',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      tableName: 'audio_clips',
      timestamps: true,
      paranoid: false,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['scene_id'],
          name: 'idx_audio_clips_scene',
        },
        {
          fields: ['beat_id'],
          name: 'idx_audio_clips_beat',
          where: {
            beat_id: {
              [sequelize.Sequelize.Op.ne]: null,
            },
          },
        },
        {
          fields: ['track_type'],
          name: 'idx_audio_clips_type',
        },
        {
          fields: ['scene_id', 'start_time'],
          name: 'idx_audio_clips_time',
        },
        {
          fields: ['status'],
          name: 'idx_audio_clips_status',
        },
      ],
      comment: 'Audio tracks: dialogue (TTS→VO), ambience, music, SFX',
    }
  );

  AudioClip.associate = (models) => {
    // AudioClip belongs to Scene
    AudioClip.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
      onDelete: 'CASCADE',
    });

    // AudioClip can link to Beat
    AudioClip.belongsTo(models.Beat, {
      foreignKey: 'beat_id',
      as: 'beat',
      onDelete: 'SET NULL',
    });
  };

  return AudioClip;
};
