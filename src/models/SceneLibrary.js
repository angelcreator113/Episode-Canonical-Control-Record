const { DataTypes } = require('sequelize');

/**
 * SceneLibrary Model
 * Master repository of scene clips (show-specific)
 * Each clip represents a semantic scene, reusable across episodes
 */
module.exports = (sequelize) => {
  const SceneLibrary = sequelize.define(
    'SceneLibrary',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'show_id',
        comment: 'Show this scene belongs to',
      },
      showId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('show_id');
        },
        set(value) {
          this.setDataValue('show_id', value);
        },
      },
      video_asset_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'video_asset_url',
        comment: 'S3 URL to the video file',
      },
      videoAssetUrl: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('video_asset_url');
        },
        set(value) {
          this.setDataValue('video_asset_url', value);
        },
      },
      thumbnail_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'thumbnail_url',
        comment: 'S3 URL to the thumbnail',
      },
      thumbnailUrl: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('thumbnail_url');
        },
        set(value) {
          this.setDataValue('thumbnail_url', value);
        },
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Scene title/name',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Scene description',
      },
      characters: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Characters appearing in this scene',
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Tags for organization (intro clip, b-roll, transition, etc.)',
      },
      duration_seconds: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'duration_seconds',
        comment: 'Video duration in seconds (auto-extracted)',
      },
      durationSeconds: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('duration_seconds');
        },
        set(value) {
          this.setDataValue('duration_seconds', value);
        },
      },
      resolution: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Video resolution (e.g., 1920x1080)',
      },
      file_size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'file_size_bytes',
        comment: 'File size in bytes',
      },
      fileSizeBytes: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('file_size_bytes');
        },
        set(value) {
          this.setDataValue('file_size_bytes', value);
        },
      },
      processing_status: {
        type: DataTypes.ENUM('uploading', 'processing', 'ready', 'failed'),
        allowNull: false,
        defaultValue: 'uploading',
        field: 'processing_status',
        comment: 'Processing status of the video',
      },
      processingStatus: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('processing_status');
        },
        set(value) {
          this.setDataValue('processing_status', value);
        },
      },
      processing_error: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'processing_error',
        comment: 'Error message if processing failed',
      },
      processingError: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('processing_error');
        },
        set(value) {
          this.setDataValue('processing_error', value);
        },
      },
      s3_key: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 's3_key',
        comment: 'S3 object key for the video file',
      },
      s3Key: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('s3_key');
        },
        set(value) {
          this.setDataValue('s3_key', value);
        },
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'created_by',
        comment: 'User who created this scene',
      },
      createdBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('created_by');
        },
        set(value) {
          this.setDataValue('created_by', value);
        },
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'updated_by',
        comment: 'User who last updated this scene',
      },
      updatedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('updated_by');
        },
        set(value) {
          this.setDataValue('updated_by', value);
        },
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
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      tableName: 'scene_library',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      indexes: [
        {
          fields: ['show_id'],
        },
        {
          fields: ['processing_status'],
        },
        {
          fields: ['created_at'],
        },
      ],
      hooks: {
        afterFind: async (result) => {
          // Generate signed URLs for S3 assets
          const S3Service = require('../services/S3Service');
          const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'primepisodes-assets';
          
          const generateSignedUrls = async (scene) => {
            if (!scene) return;
            
            // Generate signed URL for thumbnail (7 days expiry)
            if (scene.thumbnail_url && scene.thumbnail_url.startsWith('shows/')) {
              try {
                scene.thumbnail_url = await S3Service.getPreSignedUrl(
                  BUCKET_NAME,
                  scene.thumbnail_url,
                  604800 // 7 days
                );
              } catch (error) {
                console.error('Failed to generate signed URL for thumbnail:', error);
              }
            }
            
            // Generate signed URL for video (7 days expiry)
            if (scene.video_asset_url && scene.video_asset_url.startsWith('shows/')) {
              try {
                scene.video_asset_url = await S3Service.getPreSignedUrl(
                  BUCKET_NAME,
                  scene.video_asset_url,
                  604800 // 7 days
                );
              } catch (error) {
                console.error('Failed to generate signed URL for video:', error);
              }
            }
          };
          
          // Handle both single result and array of results
          if (Array.isArray(result)) {
            await Promise.all(result.map(generateSignedUrls));
          } else if (result) {
            await generateSignedUrls(result);
          }
        },
      },
    }
  );

  SceneLibrary.associate = (models) => {
    // Belongs to Show
    SceneLibrary.belongsTo(models.Show, {
      foreignKey: 'show_id',
      as: 'show',
    });

    // Has many episode scene assignments
    SceneLibrary.hasMany(models.EpisodeScene, {
      foreignKey: 'scene_library_id',
      as: 'episodeScenes',
    });
  };

  return SceneLibrary;
};
