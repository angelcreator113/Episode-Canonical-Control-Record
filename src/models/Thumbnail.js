'use strict';
const { DataTypes } = require('sequelize');

/**
 * Thumbnail Model
 * Stores thumbnail image metadata and S3 references
 */
module.exports = (sequelize) => {
  const Thumbnail = sequelize.define('Thumbnail', {
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

    // File info
    s3Bucket: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'S3 bucket name where thumbnail is stored',
    },
    s3Key: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
      comment: 'S3 object key (path) for thumbnail',
    },
    fileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 0,
      },
      comment: 'File size in bytes',
    },
    mimeType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'image/jpeg',
      validate: {
        isIn: [['image/jpeg', 'image/png', 'image/webp', 'image/gif']],
      },
    },

    // Image metadata
    widthPixels: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 1,
      },
      comment: 'Image width in pixels',
    },
    heightPixels: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 1,
      },
      comment: 'Image height in pixels',
    },
    format: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [['jpeg', 'png', 'webp', 'gif']],
      },
    },

    // Thumbnail type and metadata
    thumbnailType: {
      type: DataTypes.ENUM('primary', 'cover', 'poster', 'frame'),
      defaultValue: 'primary',
      comment: 'Type of thumbnail (primary/cover/poster/frame)',
    },
    positionSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 0,
      },
      comment: 'Video timestamp (in seconds) for frame thumbnails',
    },

    // Generation metadata
    generatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When thumbnail was generated',
    },
    qualityRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        isDecimal: true,
        min: 0,
        max: 10,
      },
      comment: 'Quality rating (0-10) for thumbnail',
    },
  }, {
    sequelize,
    modelName: 'Thumbnail',
    tableName: 'thumbnails',
    timestamps: false,
    indexes: [
      {
        name: 'idx_episode_id',
        fields: ['episodeId'],
      },
      {
        name: 'idx_s3_key',
        fields: ['s3Key'],
      },
      {
        name: 'idx_thumbnail_type',
        fields: ['episodeId', 'thumbnailType'],
      },
    ],
  });

  /**
   * Instance Methods
   */

  /**
   * Get S3 URL for thumbnail
   */
  Thumbnail.prototype.getS3Url = function() {
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${this.s3Bucket}.s3.${region}.amazonaws.com/${this.s3Key}`;
  };

  /**
   * Get CloudFront URL if available
   */
  Thumbnail.prototype.getCloudfrontUrl = function() {
    if (!process.env.CLOUDFRONT_DOMAIN) {
      return this.getS3Url();
    }
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${this.s3Key}`;
  };

  /**
   * Update quality rating
   */
  Thumbnail.prototype.setQualityRating = async function(rating) {
    if (rating < 0 || rating > 10) {
      throw new Error('Quality rating must be between 0 and 10');
    }
    this.qualityRating = rating;
    return this.save();
  };

  /**
   * Class Methods
   */

  /**
   * Find primary thumbnail for episode
   */
  Thumbnail.getPrimary = async function(episodeId) {
    return Thumbnail.findOne({
      where: {
        episodeId,
        thumbnailType: 'primary',
      },
    });
  };

  /**
   * Find all thumbnails for episode by type
   */
  Thumbnail.findByType = async function(episodeId, type) {
    return Thumbnail.findAll({
      where: {
        episodeId,
        thumbnailType: type,
      },
      order: [['generatedAt', 'DESC']],
    });
  };

  /**
   * Find frame thumbnail at specific time
   */
  Thumbnail.findFrame = async function(episodeId, positionSeconds) {
    return Thumbnail.findOne({
      where: {
        episodeId,
        thumbnailType: 'frame',
        positionSeconds,
      },
    });
  };

  /**
   * Create or update primary thumbnail
   */
  Thumbnail.createPrimary = async function(episodeId, s3Data) {
    const [thumbnail] = await Thumbnail.findOrCreate({
      where: {
        episodeId,
        thumbnailType: 'primary',
      },
      defaults: {
        episodeId,
        thumbnailType: 'primary',
        ...s3Data,
      },
    });

    return thumbnail;
  };

  /**
   * Get thumbnail count for episode
   */
  Thumbnail.countForEpisode = async function(episodeId) {
    return Thumbnail.count({
      where: { episodeId },
    });
  };

  return Thumbnail;
};
