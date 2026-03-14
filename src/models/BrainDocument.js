'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BrainDocument extends Model {
    static associate(models) {
      // Intentionally isolated
    }
  }

  BrainDocument.init(
    {
      id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      source_name:     { type: DataTypes.STRING(300), allowNull: false },
      document_text:   { type: DataTypes.TEXT, allowNull: false },
      entries_created: { type: DataTypes.INTEGER, defaultValue: 0 },
      ingested_by:     { type: DataTypes.STRING(100), defaultValue: 'manual' },
      ingested_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName:   'BrainDocument',
      tableName:   'brain_documents',
      underscored: true,
    }
  );

  return BrainDocument;
};
