'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StorytellerLine = sequelize.define('StorytellerLine', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    group_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'edited', 'rejected'),
      defaultValue: 'pending',
    },
    source_tags: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    original_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    edited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    voice_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'unattributed',
    },
    voice_confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    voice_confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'storyteller_lines',
    timestamps: true,
    underscored: true,
  });

  StorytellerLine.associate = (models) => {
    StorytellerLine.belongsTo(models.StorytellerChapter, { foreignKey: 'chapter_id', as: 'chapter' });
  };

  return StorytellerLine;
};
