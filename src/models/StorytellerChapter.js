'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StorytellerChapter = sequelize.define('StorytellerChapter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    book_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    chapter_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    badge: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'storyteller_chapters',
    timestamps: true,
    underscored: true,
  });

  StorytellerChapter.associate = (models) => {
    StorytellerChapter.belongsTo(models.StorytellerBook, { foreignKey: 'book_id', as: 'book' });
    StorytellerChapter.hasMany(models.StorytellerLine, { foreignKey: 'chapter_id', as: 'lines', onDelete: 'CASCADE' });
  };

  return StorytellerChapter;
};
