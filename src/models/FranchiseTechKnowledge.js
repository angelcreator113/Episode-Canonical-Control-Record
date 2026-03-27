'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FranchiseTechKnowledge extends Model {
    static associate(_models) {
      // Completely isolated from story knowledge — intentional by design
    }
  }

  FranchiseTechKnowledge.init(
    {
      id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      category: {
        type: DataTypes.ENUM(
          'deployed_system', 'route_registry', 'schema',
          'architecture_rule', 'build_pattern', 'pending_build', 'integration'
        ),
        defaultValue: 'deployed_system',
      },
      severity: {
        type: DataTypes.ENUM('critical', 'important', 'context'),
        defaultValue: 'important',
      },
      applies_to:       { type: DataTypes.JSONB, defaultValue: [] },
      source_document:  { type: DataTypes.STRING(100), allowNull: true },
      source_version:   { type: DataTypes.STRING(20), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'pending_review', 'superseded', 'archived'),
        defaultValue: 'active',
      },
      extracted_by: {
        type: DataTypes.ENUM(
          'document_ingestion', 'conversation_extraction', 'direct_entry', 'system'
        ),
        defaultValue: 'direct_entry',
      },
      injection_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
      last_injected_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName:   'FranchiseTechKnowledge',
      tableName:   'franchise_tech_knowledge',
      underscored: true,
    }
  );

  return FranchiseTechKnowledge;
};
