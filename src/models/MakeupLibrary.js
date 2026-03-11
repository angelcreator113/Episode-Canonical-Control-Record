'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class MakeupLibrary extends Model {
    static associate(models) {
      if (models.Show) {
        MakeupLibrary.belongsTo(models.Show, {
          foreignKey: 'show_id',
          as: 'show',
        });
      }
    }
  }
  MakeupLibrary.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE',
      },
      // ── Identity ────────────────────────────────────────────────────
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Look name — e.g. "Soft Glam", "No Makeup Makeup", "Editorial Bold"',
      },
      description: {
        type: DataTypes.TEXT,
        comment: 'What this look communicates and when Lala wears it',
      },
      // ── Tagging ─────────────────────────────────────────────────────
      mood_tag: {
        type: DataTypes.STRING,
        comment: 'Single dominant mood — "confident", "soft", "editorial", "sultry", "fresh"',
      },
      occasion_tags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Best-fit occasions — ["gala", "press_day", "date", "daytime", ...]',
      },
      event_types: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Maps to world_events event_category — ["industry", "dating", "family", "social_drama"]',
      },
      aesthetic_tags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Style keywords that match wardrobe aesthetic_tags — ["minimal", "glam", "clean", ...]',
      },
      // ── Look Components ──────────────────────────────────────────────
      skin_finish: {
        type: DataTypes.STRING,
        comment: 'e.g. "dewy", "matte", "satin", "glazed"',
      },
      eye_look: {
        type: DataTypes.STRING,
        comment: 'e.g. "cut crease", "soft smoky", "clean liner", "bare"',
      },
      lip_look: {
        type: DataTypes.STRING,
        comment: 'e.g. "nude gloss", "deep berry", "red", "bare"',
      },
      // ── Asset ───────────────────────────────────────────────────────
      reference_photo_url: {
        type: DataTypes.STRING,
        comment: 'S3 URL or external reference for this makeup look',
      },
      // ── Franchise ───────────────────────────────────────────────────
      career_echo_potential: {
        type: DataTypes.TEXT,
        comment: 'How this look connects to JustAWoman\'s real journey or franchise mythology. Nullable.',
      },
      is_justAWoman_style: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'True when this represents one of JustAWoman\'s actual real-world makeup looks',
      },
      // ── Brand ────────────────────────────────────────────────────────
      featured_brand: {
        type: DataTypes.STRING,
        comment: 'In-world brand featured in this look — e.g. "Ori Beauty"',
      },
      // ── Status ──────────────────────────────────────────────────────
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'MakeupLibrary',
      tableName: 'makeup_library',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return MakeupLibrary;
};
