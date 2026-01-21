const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OutfitSet = sequelize.define(
    'OutfitSet',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
      },
      character: {
        type: DataTypes.STRING,
      },
      occasion: {
        type: DataTypes.STRING,
      },
      season: {
        type: DataTypes.STRING,
      },
      items: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
    },
    {
      tableName: 'outfit_sets',
      timestamps: true,
      underscored: true,
    }
  );

  return OutfitSet;
};
