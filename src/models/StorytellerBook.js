'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StorytellerBook = sequelize.define('StorytellerBook', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    character_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    season_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    week_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    primary_pov: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    timeline_position: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    canon_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'draft',
    },
    status: {
      type: DataTypes.ENUM('draft', 'in_review', 'locked'),
      defaultValue: 'draft',
    },
    compiled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    series_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    era_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    era_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'storyteller_books',
    timestamps: true,
    underscored: true,
  });

  StorytellerBook.associate = (models) => {
    StorytellerBook.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
    StorytellerBook.hasMany(models.StorytellerChapter, { foreignKey: 'book_id', as: 'chapters', onDelete: 'CASCADE' });
    if (models.BookSeries) {
      StorytellerBook.belongsTo(models.BookSeries, { foreignKey: 'series_id', as: 'series' });
    }
  };

  return StorytellerBook;
};
