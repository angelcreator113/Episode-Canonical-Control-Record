const { DataTypes } = require('sequelize');

/**
 * Beat Model
 * Auto-generated timing beats linking script to timeline
 * Phase 2.5 - Animatic System
 */
module.exports = (sequelize) => {
  const Beat = sequelize.define(
    'Beat',
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
        comment: 'Scene this beat belongs to',
      },
      beat_type: {
        type: DataTypes.ENUM('dialogue', 'ui_action', 'sfx', 'music', 'cta', 'transition'),
        allowNull: false,
        field: 'beat_type',
        comment: 'Type of beat: dialogue, ui_action, sfx, music, cta, transition',
      },
      character_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'character_id',
        comment: 'Optional character reference (can link to character_profiles)',
      },
      label: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Human-readable label: "LaLa asks question", "Subscribe CTA"',
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
      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Flexible JSONB: {line, emotion, script_line_id, notes}',
      },
      status: {
        type: DataTypes.ENUM('draft', 'locked', 'approved'),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'Beat status: draft, locked, approved',
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
      tableName: 'beats',
      timestamps: true,
      paranoid: false,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['scene_id'],
          name: 'idx_beats_scene',
        },
        {
          fields: ['character_id'],
          name: 'idx_beats_character',
          where: {
            character_id: {
              [sequelize.Sequelize.Op.ne]: null,
            },
          },
        },
        {
          fields: ['beat_type'],
          name: 'idx_beats_type',
        },
        {
          fields: ['status'],
          name: 'idx_beats_status',
        },
        {
          fields: ['scene_id', 'start_time'],
          name: 'idx_beats_time',
        },
      ],
      comment: 'Auto-generated timing beats linking script to timeline',
    }
  );

  Beat.associate = (models) => {
    // Beat belongs to Scene
    Beat.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
      onDelete: 'CASCADE',
    });

    // Beat can optionally link to CharacterProfile
    if (models.CharacterProfile) {
      Beat.belongsTo(models.CharacterProfile, {
        foreignKey: 'character_id',
        as: 'character',
        constraints: false, // No FK constraint in DB
      });
    }
  };

  return Beat;
};
