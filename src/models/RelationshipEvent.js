'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RelationshipEvent = sequelize.define('RelationshipEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    relationship_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'character_relationships', key: 'id' },
    },
    event_type: {
      type: DataTypes.STRING(80),
      allowNull: false, // first_meeting, betrayal, reconciliation, confession, breakup, escalation, milestone
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    story_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    story_date: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tension_before: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tension_after: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    relationship_stage: {
      type: DataTypes.STRING(80),
      allowNull: true, // strangers, acquaintances, friends, close_friends, lovers, partners, exes, enemies
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'relationship_events',
    timestamps: true,
    underscored: true,
  });

  RelationshipEvent.associate = (models) => {
    RelationshipEvent.belongsTo(models.CharacterRelationship, {
      foreignKey: 'relationship_id',
      as: 'relationship',
    });
  };

  return RelationshipEvent;
};
