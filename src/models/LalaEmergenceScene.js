'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LalaEmergenceScene = sequelize.define('LalaEmergenceScene', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    line_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    chapter_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    book_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    line_order: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    line_content: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    chapter_title: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    emotional_context: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    scene_type: {
      type:         DataTypes.STRING,
      defaultValue: 'lala_emergence',
      allowNull:    false,
    },
    confirmed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull:    false,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    canon_tier: {
      type:         DataTypes.STRING,
      defaultValue: 'proto',
      allowNull:    false,
    },
    detection_method: {
      type:         DataTypes.STRING,
      defaultValue: 'auto',
      allowNull:    false,
    },
    franchise_anchor: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull:    false,
    },
  }, {
    tableName:  'lala_emergence_scenes',
    timestamps: true,
    underscored: true,
  });

  return LalaEmergenceScene;
};
