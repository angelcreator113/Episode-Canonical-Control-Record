'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SceneSet extends Model {
    static associate(models) {
      SceneSet.hasMany(models.SceneAngle, {
        foreignKey: 'scene_set_id',
        as: 'angles',
      });
      SceneSet.belongsTo(models.SceneAngle, {
        foreignKey: 'cover_angle_id',
        as: 'coverAngle',
        constraints: false,
      });
      if (models.Universe) {
        SceneSet.belongsTo(models.Universe, {
          foreignKey: 'universe_id',
          as: 'universe',
        });
      }
      if (models.Show) {
        SceneSet.belongsTo(models.Show, {
          foreignKey: 'show_id',
          as: 'show',
        });
      }
      if (models.SceneSetEpisode) {
        SceneSet.belongsToMany(models.Episode, {
          through: models.SceneSetEpisode,
          foreignKey: 'scene_set_id',
          otherKey: 'episode_id',
          as: 'episodes',
        });
      }
    }

    // Return the angle best suited for a given beat number
    angleForBeat(beatNumber) {
      if (!this.angles) return null;
      return this.angles.find(a =>
        Array.isArray(a.beat_affinity) && a.beat_affinity.includes(beatNumber)
      ) || this.angles[0] || null;
    }

    // Return the primary (first complete) still image URL
    get primaryStillUrl() {
      if (!this.angles) return null;
      const complete = this.angles.find(a => a.still_image_url && a.generation_status === 'complete');
      return complete?.still_image_url || null;
    }

    // Is this scene fully generated (at least one complete angle)
    get isReady() {
      if (!this.angles) return false;
      return this.angles.some(a => a.generation_status === 'complete');
    }
  }

  SceneSet.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    universe_id: { type: DataTypes.UUID, allowNull: true },
    show_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    scene_type: {
      type: DataTypes.ENUM('HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION', 'OTHER'),
      allowNull: false,
    },
    canonical_description: { type: DataTypes.TEXT, allowNull: true },
    script_context: { type: DataTypes.TEXT, allowNull: true },
    visual_language: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    aesthetic_tags: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    mood_tags: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    base_runway_prompt: { type: DataTypes.TEXT, allowNull: true },
    base_runway_seed: { type: DataTypes.STRING, allowNull: true },
    base_runway_model: { type: DataTypes.STRING, allowNull: true, defaultValue: 'gen3a_turbo' },
    base_still_url: { type: DataTypes.TEXT, allowNull: true },
    style_reference_url: { type: DataTypes.TEXT, allowNull: true },
    negative_prompt: { type: DataTypes.TEXT, allowNull: true },
    variation_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
    generation_status: {
      type: DataTypes.ENUM('pending', 'generating', 'complete', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    generation_cost: { type: DataTypes.DECIMAL(10, 4), allowNull: true, defaultValue: 0 },
    tier_requirement: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_franchise_asset: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_unlocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    event_compatibility: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    status_value: {
      type: DataTypes.ENUM('humble', 'aspirational', 'elite', 'intimidating'),
      allowNull: true,
    },
    intimacy_value: { type: DataTypes.INTEGER, allowNull: true },
    spectacle_value: { type: DataTypes.INTEGER, allowNull: true },
    cover_angle_id: { type: DataTypes.UUID, allowNull: true },
    canvas_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Scene Studio canvas settings for this scene set',
    },
  }, {
    sequelize,
    modelName: 'SceneSet',
    tableName: 'scene_sets',
    underscored: true,
    paranoid: true,
    timestamps: true,
  });

  return SceneSet;
};
