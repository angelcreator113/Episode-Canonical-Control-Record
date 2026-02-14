'use strict';
const { DataTypes } = require('sequelize');

/**
 * TimelineData Model
 * Stores beats, markers, audio clips, and character clips for an episode's timeline.
 * One-to-one relationship with Episode (unique episode_id).
 */
module.exports = (sequelize) => {
  const TimelineData = sequelize.define(
    'TimelineData',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'episode_id',
        references: {
          model: 'episodes',
          key: 'id',
        },
      },
      beats: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of beat objects for the timeline',
      },
      markers: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of marker objects for the timeline',
      },
      audio_clips: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'audio_clips',
        comment: 'Array of audio clip objects for the timeline',
      },
      character_clips: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'character_clips',
        comment: 'Array of character clip objects for the timeline',
      },
      keyframes: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of keyframe objects for element animations',
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
      sequelize,
      modelName: 'TimelineData',
      tableName: 'timeline_data',
      timestamps: true,
      underscored: true,
      paranoid: false,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimelineData.associate = function (models) {
    TimelineData.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });
  };

  TimelineData.prototype.toJSON = function () {
    return {
      id: this.id,
      episodeId: this.episode_id,
      beats: this.beats || [],
      markers: this.markers || [],
      audioClips: this.audio_clips || [],
      characterClips: this.character_clips || [],
      keyframes: this.keyframes || [],
      createdAt: this.created_at,
      updatedAt: this.updated_at,
    };
  };

  return TimelineData;
};
