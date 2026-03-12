'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PageContent extends Model {}
  PageContent.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    page_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    constant_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'PageContent',
    tableName: 'page_content',
    underscored: true,
    paranoid: false,
    indexes: [
      { unique: true, fields: ['page_name', 'constant_key'] },
    ],
  });
  return PageContent;
};
