'use strict';
const { DataTypes } = require('sequelize');

/**
 * MetadataStorage Model
 * Stores extracted and generated metadata for episodes
 */
module.exports = (sequelize) => {
  const MetadataStorage = sequelize.define('MetadataStorage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    episodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'episodes',
        key: 'id',
      },
    },

    // OCR/text extraction
    extractedText: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Text extracted via OCR from episode',
    },

    // ML/AI analysis results
    scenesDetected: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of detected scenes with timestamps and descriptions',
    },
    sentimentAnalysis: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Sentiment analysis results by scene',
    },
    visualObjects: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Detected objects, people, and visual elements',
    },
    transcription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Speech-to-text transcription',
    },

    // Tags and categories
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'User-defined tags as JSON array',
    },
    categories: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Categories, warnings, and classifications',
    },

    // Processing metadata
    extractionTimestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When metadata was extracted',
    },
    processingDurationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 0,
      },
      comment: 'How long extraction took in seconds',
    },
  }, {
    sequelize,
    modelName: 'MetadataStorage',
    tableName: 'metadata_storage',
    timestamps: false,
    indexes: [
      {
        name: 'idx_episode_id',
        fields: ['episodeId'],
      },
    ],
  });

  /**
   * Associations (defined in index.js)
   */

  /**
   * Instance Methods
   */

  /**
   * Update extracted text
   */
  MetadataStorage.prototype.updateExtractedText = async function(text) {
    this.extractedText = text;
    this.extractionTimestamp = new Date();
    return this.save();
  };

  /**
   * Add tags to metadata
   */
  MetadataStorage.prototype.addTags = async function(newTags) {
    const currentTags = this.tags || [];
    this.tags = [...new Set([...currentTags, ...newTags])]; // Remove duplicates
    return this.save();
  };

  /**
   * Set detected scenes
   */
  MetadataStorage.prototype.setDetectedScenes = async function(scenes, duration) {
    this.scenesDetected = scenes;
    this.processingDurationSeconds = duration;
    this.extractionTimestamp = new Date();
    return this.save();
  };

  /**
   * Class Methods
   */

  /**
   * Get all metadata for episode
   */
  MetadataStorage.getForEpisode = async function(episodeId) {
    return MetadataStorage.findOne({
      where: { episodeId },
    });
  };

  /**
   * Create or update metadata for episode
   */
  MetadataStorage.createOrUpdate = async function(episodeId, data) {
    const [metadata, created] = await MetadataStorage.findOrCreate({
      where: { episodeId },
      defaults: {
        episodeId,
        ...data,
      },
    });

    if (!created) {
      Object.assign(metadata, data);
      await metadata.save();
    }

    return metadata;
  };

  return MetadataStorage;
};
