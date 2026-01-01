/**
 * FileStorage Model
 * Tracks all files associated with episodes (videos, images, scripts)
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FileStorage = sequelize.define(
    'FileStorage',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      file_type: {
        type: DataTypes.ENUM('video', 'image', 'script'),
        allowNull: false,
      },
      file_size: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'File size in bytes',
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      s3_key: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true,
      },
      s3_bucket: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      s3_etag: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      s3_version_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      upload_status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending',
      },
      upload_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional file metadata (duration, dimensions, codec, etc.)',
      },
      indexing_status: {
        type: DataTypes.ENUM('pending', 'indexed', 'failed'),
        defaultValue: 'pending',
      },
      indexed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      processing_job_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'ProcessingQueues',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      access_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      last_accessed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'FileStorages',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['episode_id'] },
        { fields: ['file_type'] },
        { fields: ['upload_status'] },
        { fields: ['indexing_status'] },
        { fields: ['s3_key'] },
        { fields: ['created_at'] },
      ],
    }
  );

  FileStorage.associate = (models) => {
    FileStorage.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    FileStorage.belongsTo(models.ProcessingQueue, {
      foreignKey: 'processing_job_id',
      as: 'processingJob',
    });
  };

  return FileStorage;
};
