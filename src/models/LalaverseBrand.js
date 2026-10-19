'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LalaverseBrand', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  slug:               DataTypes.STRING,
  name:               DataTypes.STRING,
  type:               { type: DataTypes.STRING, defaultValue: 'lalaverse' },
  // brand | outlet | agency | venue (constants/companyKinds; migration
  // 20261019100000): every company in Lala's world, not only fashion brands.
  kind:               { type: DataTypes.STRING(20), defaultValue: 'brand' },
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
  // The approved personality (constants/brandPersonalities, migration
  // 20261018140000): what the brand believes, apart from its established
  // canon above, which it never changes.
  personality:        DataTypes.JSONB,
}, { tableName: 'lalaverse_brands', timestamps: true, underscored: true });
