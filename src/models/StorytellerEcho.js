'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StorytellerEcho extends Model {
    static associate(models) {
      StorytellerEcho.belongsTo(models.StorytellerBook, {
        foreignKey: 'book_id',
        as: 'book',
      });
      StorytellerEcho.belongsTo(models.StorytellerChapter, {
        foreignKey: 'source_chapter_id',
        as: 'sourceChapter',
      });
      StorytellerEcho.belongsTo(models.StorytellerChapter, {
        foreignKey: 'target_chapter_id',
        as: 'targetChapter',
      });
    }
  }

  StorytellerEcho.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      book_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      source_chapter_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      source_line_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      source_line_content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      target_chapter_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      landing_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'planted',
      },
    },
    {
      sequelize,
      modelName: 'StorytellerEcho',
      tableName: 'storyteller_echoes',
      timestamps: true,
      underscored: true,
    }
  );

  return StorytellerEcho;
};
