'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MultiProductContent extends Model {
    static associate(models) {}
  }
  MultiProductContent.init({
    id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    story_id: { type: DataTypes.INTEGER, allowNull: false },
    format: {
      type: DataTypes.ENUM(
        'instagram_caption', 'tiktok_concept', 'howto_lesson',
        'bestie_newsletter', 'behind_the_scenes'
      ),
      allowNull: false,
    },
    content:       { type: DataTypes.TEXT, allowNull: false },
    headline:      { type: DataTypes.STRING(200), allowNull: true },
    emotional_core: { type: DataTypes.TEXT, allowNull: true },
    book2_seed:    { type: DataTypes.BOOLEAN, defaultValue: false },
    status: {
      type: DataTypes.ENUM('draft', 'approved', 'posted', 'archived'),
      defaultValue: 'draft',
    },
    posted_at:   { type: DataTypes.DATE, allowNull: true },
    author_note: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'MultiProductContent',
    tableName: 'multi_product_content', underscored: true,
  });
  return MultiProductContent;
};
