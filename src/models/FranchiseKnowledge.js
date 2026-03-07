// models/FranchiseKnowledge.js
// Franchise Knowledge Base — every locked decision, character truth, and absolute law

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FranchiseKnowledge = sequelize.define('FranchiseKnowledge', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('character', 'narrative', 'locked_decision', 'franchise_law', 'technical', 'brand', 'world'),
      allowNull: false,
      defaultValue: 'narrative',
    },
    severity: {
      type: DataTypes.ENUM('critical', 'important', 'context'),
      allowNull: false,
      defaultValue: 'important',
    },
    applies_to: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    always_inject: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    source_document: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    source_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    extracted_by: {
      type: DataTypes.ENUM('document_ingestion', 'conversation_extraction', 'direct_entry', 'system'),
      defaultValue: 'direct_entry',
    },
    status: {
      type: DataTypes.ENUM('pending_review', 'active', 'superseded', 'archived'),
      defaultValue: 'pending_review',
    },
    superseded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    review_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    injection_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_injected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'franchise_knowledge',
    underscored: true,
    timestamps: true,
  });

  return FranchiseKnowledge;
};
