const { DataTypes } = require('sequelize');

/**
 * CharacterClip Model  
 * Video clips for each character in each scene
 * Enables per-character editing workflow
 * Phase 2.5 - Animatic System
 */
module.exports = (sequelize) => {
  const CharacterClip = sequelize.define(
    'CharacterClip',
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
        comment: 'Scene this clip belongs to',
      },
      character_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'character_id',
        comment: 'Character ID (can link to character_profiles)',
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
        comment: 'Optional link to script beat',
      },
      role: {
        type: DataTypes.ENUM('dialogue', 'reaction', 'idle', 'transition', 'placeholder'),
        allowNull: false,
        comment: 'Clip role: dialogue (speaking), reaction (responding), idle (listening), transition (movement), placeholder',
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
      video_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'video_url',
        comment: 'S3 URL to video clip (NULL for placeholders)',
      },
      expression: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Expression: interested, skeptical, amused, neutral, excited',
      },
      animation_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'animation_type',
        comment: 'For idle clips: listening, thinking, reacting',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Flexible JSONB: {trim_in, hold_frames, effects, generation_params}',
      },
      status: {
        type: DataTypes.ENUM('placeholder', 'generated', 'approved', 'needs_regen'),
        allowNull: false,
        defaultValue: 'placeholder',
        comment: 'Clip status: placeholder, generated, approved, needs_regen',
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
      tableName: 'character_clips',
      timestamps: true,
      paranoid: false,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['scene_id'],
          name: 'idx_character_clips_scene',
        },
        {
          fields: ['character_id'],
          name: 'idx_character_clips_character',
        },
        {
          fields: ['beat_id'],
          name: 'idx_character_clips_beat',
          where: {
            beat_id: {
              [sequelize.Sequelize.Op.ne]: null,
            },
          },
        },
        {
          fields: ['role'],
          name: 'idx_character_clips_role',
        },
        {
          fields: ['scene_id', 'start_time'],
          name: 'idx_character_clips_time',
        },
        {
          fields: ['status'],
          name: 'idx_character_clips_status',
        },
      ],
      comment: 'Video clips for each character, enabling per-character editing',
    }
  );

  CharacterClip.associate = (models) => {
    // CharacterClip belongs to Scene
    CharacterClip.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
      onDelete: 'CASCADE',
    });

    // CharacterClip can link to Beat
    CharacterClip.belongsTo(models.Beat, {
      foreignKey: 'beat_id',
      as: 'beat',
      onDelete: 'SET NULL',
    });

    // CharacterClip can link to CharacterProfile (no FK constraint)
    if (models.CharacterProfile) {
      CharacterClip.belongsTo(models.CharacterProfile, {
        foreignKey: 'character_id',
        as: 'character',
        constraints: false,
      });
    }
  };

  return CharacterClip;
};
