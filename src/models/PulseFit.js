// ─── PulseFit.js ─────────────────────────────────────────────────────────────
// One of Lala's everyday fits: a photo, an optional caption and the story
// date she wore it (migration 20261011210000; Task #2922). Uploaded in
// Admin › The Pulse › Uploads; The Pulse's "Check out the latest fit" reads it.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseFit extends Model {
    static associate(_models) {}
  }
  PulseFit.init({
    id:         { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:    { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    image_url:  { type: DataTypes.TEXT, allowNull: false },
    s3_key:     { type: DataTypes.TEXT, allowNull: true },
    image_alt:  { type: DataTypes.STRING(300), allowNull: true },
    caption:    { type: DataTypes.TEXT, allowNull: true },
    story_date: { type: DataTypes.DATEONLY, allowNull: true },
    // The story time it was uploaded at (migration 20261011220000; Task #2937).
    story_order: { type: DataTypes.INTEGER, allowNull: true },
    width:      { type: DataTypes.INTEGER, allowNull: true },
    height:     { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize, modelName: 'PulseFit',
    tableName: 'pulse_fits', underscored: true,
    paranoid: true,
  });
  return PulseFit;
};
