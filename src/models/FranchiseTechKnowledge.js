// models/FranchiseTechKnowledge.js
// Franchise Brain — technical knowledge entries (platform specs, pipeline configs, integration details)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FranchiseTechKnowledge = sequelize.define('FranchiseTechKnowledge', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('platform', 'pipeline', 'integration', 'infrastructure', 'api', 'format', 'constraint'),
      allowNull: false,
      defaultValue: 'platform',
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
    source_document: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending_review', 'active', 'superseded', 'archived'),
      defaultValue: 'pending_review',
    },
  }, {
    tableName: 'franchise_tech_knowledge',
    underscored: true,
    timestamps: true,
  });

  return FranchiseTechKnowledge;
};
