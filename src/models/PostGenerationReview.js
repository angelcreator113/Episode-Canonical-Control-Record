// ─── PostGenerationReview.js ─────────────────────────────────────────────────
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PostGenerationReview extends Model {
    static associate(_models) {}
  }
  PostGenerationReview.init({
    id:                        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    story_id:                  { type: DataTypes.INTEGER, allowNull: false },
    approved_version_reviewed: { type: DataTypes.TEXT, allowNull: false },
    violations:                { type: DataTypes.JSONB, defaultValue: [] },
    warnings:                  { type: DataTypes.JSONB, defaultValue: [] },
    passed:                    { type: DataTypes.BOOLEAN, defaultValue: true },
    knowledge_entries_checked: { type: DataTypes.INTEGER, defaultValue: 0 },
    review_note:               { type: DataTypes.TEXT, allowNull: true },
    author_acknowledged:       { type: DataTypes.BOOLEAN, defaultValue: false },
    acknowledged_at:           { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PostGenerationReview',
    tableName: 'post_generation_reviews', underscored: true,
  });
  return PostGenerationReview;
};
