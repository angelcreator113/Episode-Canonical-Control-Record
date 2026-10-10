// ─── EpisodeLookbookImage.js ─────────────────────────────────────────────────
// One photo in an episode's Lookbook, sorted into a style sheet spot
// (migration 20261010120000; Task #2812). episode_id is kept on the row so
// every read and write can check the image belongs to the episode.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EpisodeLookbookImage extends Model {
    static associate(_models) {}
  }
  EpisodeLookbookImage.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    lookbook_id:       { type: DataTypes.UUID, allowNull: false, references: { model: 'episode_lookbooks', key: 'id' } },
    episode_id:        { type: DataTypes.UUID, allowNull: false, references: { model: 'episodes', key: 'id' } },
    category:          { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unsorted' },
    source:            { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'upload' },
    image_url:         { type: DataTypes.TEXT, allowNull: true },
    s3_key:            { type: DataTypes.TEXT, allowNull: true },
    scene_set_id:      { type: DataTypes.UUID, allowNull: true, references: { model: 'scene_sets', key: 'id' } },
    scene_angle_id:    { type: DataTypes.UUID, allowNull: true, references: { model: 'scene_angles', key: 'id' } },
    scene_set_look_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'scene_set_looks', key: 'id' } },
    wardrobe_id:       { type: DataTypes.UUID, allowNull: true, references: { model: 'wardrobe', key: 'id' } },
    in_lookbook:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    content_type:      { type: DataTypes.STRING(50), allowNull: true },
    width:             { type: DataTypes.INTEGER, allowNull: true },
    height:            { type: DataTypes.INTEGER, allowNull: true },
    file_size_bytes:   { type: DataTypes.INTEGER, allowNull: true },
    file_name:         { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'EpisodeLookbookImage',
    tableName: 'episode_lookbook_images', underscored: true,
    paranoid: true,
  });
  return EpisodeLookbookImage;
};
