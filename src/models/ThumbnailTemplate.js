'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailTemplate Model
 * Stores template configurations for composite thumbnails
 */
module.exports = (sequelize) => {
  const ThumbnailTemplate = sequelize.define(
    'ThumbnailTemplate',
    {
      id: {
        type: DataTypes.STRING(100),
        primaryKey: true,
        comment: 'Template ID: youtube-hero, instagram-feed, etc.',
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Display name: YouTube Hero, Instagram Feed',
      },
      platform: {
        type: DataTypes.STRING(50),
        comment: 'Target platform: YOUTUBE, INSTAGRAM, TIKTOK, FACEBOOK, TWITTER, PINTEREST',
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Canvas width in pixels',
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Canvas height in pixels',
      },
      aspect_ratio: {
        type: DataTypes.STRING(20),
        comment: 'Aspect ratio: 16:9, 1:1, 9:16, etc.',
      },
      layout_config: {
        type: DataTypes.JSONB,
        comment: 'Layer configuration: {background, lala, guest, text}',
      },
    },
    {
      tableName: 'thumbnail_templates',
      timestamps: true,
      underscored: true,
    }
  );

  return ThumbnailTemplate;
};
