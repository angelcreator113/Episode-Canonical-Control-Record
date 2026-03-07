'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterGrowthLog = sequelize.define('CharacterGrowthLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    character_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    story_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    scene_proposal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    field_updated: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    previous_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    update_type: {
      type: DataTypes.ENUM('silent', 'flagged_contradiction'),
      defaultValue: 'silent',
    },
    growth_source: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    author_reviewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    author_decision: {
      type: DataTypes.ENUM('accepted', 'reverted', 'modified'),
      allowNull: true,
    },
    author_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'character_growth_log',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  CharacterGrowthLog.associate = (models) => {
    CharacterGrowthLog.belongsTo(models.RegistryCharacter, {
      foreignKey: 'character_id',
      as: 'character',
    });
    CharacterGrowthLog.belongsTo(models.SceneProposal, {
      foreignKey: 'scene_proposal_id',
      as: 'sceneProposal',
    });
  };

  return CharacterGrowthLog;
};
