'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FranchiseKnowledge extends Model {
    static associate(_models) {
      // Intentionally isolated — no foreign key associations
    }
  }

  FranchiseKnowledge.init(
    {
      id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      category: {
        type: DataTypes.ENUM(
          'character', 'narrative', 'locked_decision',
          'franchise_law', 'technical', 'brand', 'world'
        ),
        defaultValue: 'narrative',
      },
      severity: {
        type: DataTypes.ENUM('critical', 'important', 'context'),
        defaultValue: 'important',
      },
      applies_to:       { type: DataTypes.JSONB, defaultValue: [] },
      always_inject:    { type: DataTypes.BOOLEAN, defaultValue: false },
      source_document:  { type: DataTypes.STRING(200), allowNull: true },
      source_version:   { type: DataTypes.STRING(20), allowNull: true },
      extracted_by: {
        type: DataTypes.ENUM(
          'document_ingestion', 'conversation_extraction', 'direct_entry', 'system'
        ),
        defaultValue: 'direct_entry',
      },
      status: {
        type: DataTypes.ENUM('pending_review', 'active', 'superseded', 'archived'),
        defaultValue: 'pending_review',
      },
      superseded_by:    { type: DataTypes.INTEGER, allowNull: true },
      review_note:      { type: DataTypes.TEXT, allowNull: true },
      injection_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
      last_injected_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName:   'FranchiseKnowledge',
      tableName:   'franchise_knowledge',
      underscored: true,
    }
  );

  return FranchiseKnowledge;
};
