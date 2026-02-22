'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookSeries = sequelize.define('BookSeries', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    universe_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    protagonist_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Who this series follows. Series 1 = JustAWoman. Series 2 = Lala.',
    },
  }, {
    tableName: 'book_series',
    timestamps: true,
    underscored: true,
  });

  BookSeries.associate = (models) => {
    BookSeries.belongsTo(models.Universe, {
      foreignKey: 'universe_id',
      as: 'universe',
    });
    BookSeries.hasMany(models.StorytellerBook, {
      foreignKey: 'series_id',
      as: 'books',
    });
    if (models.Show) {
      BookSeries.belongsTo(models.Show, {
        foreignKey: 'show_id',
        as: 'show',
      });
    }
  };

  return BookSeries;
};
