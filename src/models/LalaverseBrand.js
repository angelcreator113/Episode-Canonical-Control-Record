'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LalaverseBrand', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  slug:               DataTypes.STRING,
  name:               DataTypes.STRING,
  type:               { type: DataTypes.STRING, defaultValue: 'lalaverse' },
  category:           DataTypes.STRING,
  description:        DataTypes.TEXT,
  aesthetic:          DataTypes.TEXT,
  niche:              DataTypes.TEXT,
  founder:            DataTypes.TEXT,
  press_angle:        DataTypes.TEXT,
  contact_name:       DataTypes.STRING,
  contact_email:      DataTypes.STRING,
  partnership_status: DataTypes.STRING,
  website:            DataTypes.STRING,
}, { tableName: 'lalaverse_brands', timestamps: true, underscored: true });
