'use strict';
const { DataTypes } = require('sequelize');

/**
 * Episode Model
 * Stores core episode metadata for "Styling Adventures w Lala"
 */
module.exports = (sequelize) => {
  const Episode = sequelize.define('Episode', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    showName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255],
        notEmpty: true,
      },
    },
    seasonNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true,
        min: 1,
      },
    },
    episodeNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true,
        min: 1,
      },
    },
    episodeTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255],
        notEmpty: true,
      },
    },
    airDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plotSummary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    director: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    writer: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 1,
      },
    },
    rating: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
      validate: {
        min: 0,
        max: 10,
      },
    },
    genre: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Media references
    thumbnailUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    posterUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    videoUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    // S3 references
    rawVideoS3Key: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'S3 key for original uploaded video',
    },
    processedVideoS3Key: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'S3 key for processed/encoded video',
    },
    metadataJsonS3Key: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'S3 key for extracted metadata JSON',
    },

    // Status tracking
    processingStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'complete', 'failed'),
      defaultValue: 'pending',
      comment: 'Current processing status of episode',
    },

    // Timestamps
    uploadDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When episode was first uploaded',
    },
    lastModified: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: DataTypes.NOW,
      comment: 'Last time episode was modified',
    },

    // Soft delete
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp for compliance',
    },
  }, {
    sequelize,
    modelName: 'Episode',
    tableName: 'episodes',
    timestamps: true,
    createdAt: 'uploadDate',
    updatedAt: 'lastModified',
    paranoid: false, // Manual soft delete via deletedAt
    indexes: [
      {
        name: 'idx_show_season_episode',
        fields: ['showName', 'seasonNumber', 'episodeNumber'],
        unique: true,
      },
      {
        name: 'idx_air_date',
        fields: ['airDate'],
      },
      {
        name: 'idx_processing_status',
        fields: ['processingStatus'],
      },
      {
        name: 'idx_deleted_at',
        fields: ['deletedAt'],
      },
    ],
    scopes: {
      // Exclude soft-deleted records
      active: {
        where: {
          deletedAt: null,
        },
      },
      // Only deleted records
      deleted: {
        where: {
          deletedAt: {
            [sequelize.Sequelize.Op.ne]: null,
          },
        },
      },
      // Processing episodes
      processing: {
        where: {
          processingStatus: 'processing',
        },
      },
      // Failed episodes
      failed: {
        where: {
          processingStatus: 'failed',
        },
      },
    },
  });

  /**
   * Instance Methods
   */

  /**
   * Mark episode as deleted (soft delete)
   */
  Episode.prototype.softDelete = async function() {
    this.deletedAt = new Date();
    return this.save();
  };

  /**
   * Restore soft-deleted episode
   */
  Episode.prototype.restore = async function() {
    this.deletedAt = null;
    return this.save();
  };

  /**
   * Update processing status
   */
  Episode.prototype.updateStatus = async function(status) {
    if (!['pending', 'processing', 'complete', 'failed'].includes(status)) {
      throw new Error('Invalid processing status');
    }
    this.processingStatus = status;
    return this.save();
  };

  /**
   * Get S3 bucket and key information
   */
  Episode.prototype.getS3Info = function() {
    return {
      bucket: process.env.AWS_S3_BUCKET_STORAGE || 'episode-metadata-storage-dev',
      keys: {
        raw: this.rawVideoS3Key,
        processed: this.processedVideoS3Key,
        metadata: this.metadataJsonS3Key,
      },
    };
  };

  /**
   * Class Methods
   */

  /**
   * Find active episodes (excluding soft-deleted)
   */
  Episode.findActive = function(options = {}) {
    return Episode.scope('active').findAll(options);
  };

  /**
   * Find by show name and season
   */
  Episode.findBySeason = async function(showName, seasonNumber) {
    return Episode.scope('active').findAll({
      where: { showName, seasonNumber },
      order: [['episodeNumber', 'ASC']],
    });
  };

  /**
   * Find by show name, season, and episode number
   */
  Episode.findByEpisodeNumber = async function(showName, seasonNumber, episodeNumber) {
    return Episode.scope('active').findOne({
      where: { showName, seasonNumber, episodeNumber },
    });
  };

  /**
   * Get processing queue information
   */
  Episode.getProcessingStatus = async function(id) {
    const episode = await Episode.findByPk(id, {
      attributes: ['id', 'episodeTitle', 'processingStatus', 'uploadDate'],
    });
    return episode;
  };

  /**
   * Get episodes requiring processing
   */
  Episode.getPendingProcessing = function() {
    return Episode.scope(['active', 'processing']).findAll({
      order: [['uploadDate', 'ASC']],
    });
  };

  return Episode;
};
