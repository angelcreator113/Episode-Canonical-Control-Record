// ─── PulseReveal.js ──────────────────────────────────────────────────────────
// When an item on The Pulse is revealed (migration 20261011230000; Task
// #2938; The Pulse spec §5): one row per post, image, event or character,
// placing its reveal on the story clock (services/pulseReveals.js). Before
// that moment the item is hidden or a blurred "first look" teaser.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseReveal extends Model {
    static associate(_models) {}
  }
  PulseReveal.init({
    id:          { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:     { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    item_type:   { type: DataTypes.STRING(20), allowNull: false },   // post | image | event | character
    item_id:     { type: DataTypes.STRING(64), allowNull: false },
    image_kind:  { type: DataTypes.STRING(20), allowNull: true },    // fit | city | city_bubble | cover | post_photo
    event_id:    { type: DataTypes.UUID, allowNull: true },
    episode_id:  { type: DataTypes.UUID, allowNull: true },
    moment:      { type: DataTypes.STRING(20), allowNull: false },   // announced … after | story_time
    story_order: { type: DataTypes.INTEGER, allowNull: true },
    mode:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'teaser' }, // hidden | teaser
    source:      { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'set' },    // set | derived
    // The teaser image, cut from the existing one (migration 20261013020000; Task #3034).
    teaser_style: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'crop' }, // crop | blur
    crop_json:    { type: DataTypes.JSONB, allowNull: true },    // { x, y, w, h } as fractions of the image
    teaser_url:   { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'PulseReveal',
    tableName: 'pulse_reveals', underscored: true,
    paranoid: true,
  });
  return PulseReveal;
};
