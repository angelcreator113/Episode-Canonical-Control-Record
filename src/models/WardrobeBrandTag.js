'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WardrobeBrandTag', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardrobe_item_id:    DataTypes.UUID,
  wardrobe_item_name:  DataTypes.STRING,
  brand_id:            DataTypes.UUID,
  show_id:             DataTypes.UUID,
  chapter_id:          DataTypes.UUID,
  event_name:          DataTypes.STRING,
  scene_summary:       DataTypes.TEXT,
  coverage_status:     { type: DataTypes.STRING, defaultValue: 'uncovered' },
  coverage_content:    DataTypes.TEXT,
  coverage_author:     DataTypes.STRING,
  coverage_url:        DataTypes.STRING,
  coverage_generated:  DataTypes.DATE,
  coverage_published:  DataTypes.DATE,
}, { tableName: 'wardrobe_brand_tags', timestamps: true, underscored: true });
