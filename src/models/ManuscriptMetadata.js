'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ManuscriptMetadata extends Model {
    static associate(_models) {}
  }
  ManuscriptMetadata.init({
    id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    series_id:        { type: DataTypes.INTEGER, allowNull: true },
    book_id:          { type: DataTypes.INTEGER, allowNull: false },
    stories_included: { type: DataTypes.INTEGER, defaultValue: 0 },
    book_title:       { type: DataTypes.STRING(300), allowNull: true },
    tagline:          { type: DataTypes.TEXT, allowNull: true },
    amazon_description:    { type: DataTypes.TEXT, allowNull: true },
    one_line_logline:      { type: DataTypes.TEXT, allowNull: true },
    section_establishment: { type: DataTypes.STRING(300), allowNull: true },
    section_pressure:      { type: DataTypes.STRING(300), allowNull: true },
    section_crisis:        { type: DataTypes.STRING(300), allowNull: true },
    section_integration:   { type: DataTypes.STRING(300), allowNull: true },
    table_of_contents:     { type: DataTypes.JSONB, defaultValue: [] },
    dominant_themes:       { type: DataTypes.JSONB, defaultValue: [] },
    recurring_motifs:      { type: DataTypes.JSONB, defaultValue: [] },
    pain_point_summary:    { type: DataTypes.JSONB, defaultValue: [] },
    lala_seed_count:       { type: DataTypes.INTEGER, defaultValue: 0 },
    lala_seed_moments:     { type: DataTypes.JSONB, defaultValue: [] },
    generated_at:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    generation_model:      { type: DataTypes.STRING(60), allowNull: true },
    author_approved:       { type: DataTypes.BOOLEAN, defaultValue: false },
    approved_at:           { type: DataTypes.DATE, allowNull: true },
    author_overrides:      { type: DataTypes.JSONB, defaultValue: {} },
  }, { sequelize, modelName: 'ManuscriptMetadata', tableName: 'manuscript_metadata', underscored: true });
  return ManuscriptMetadata;
};
