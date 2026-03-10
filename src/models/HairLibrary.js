'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class HairLibrary extends Model {
    static associate(models) {
      // Hair styles belong to a show
      if (models.Show) {
        HairLibrary.belongsTo(models.Show, {
          foreignKey: 'show_id',
          as: 'show',
        });
      }
    }
  }
  HairLibrary.init(
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
        comment: 'Style name — e.g. "Silk Press Bob", "High Bun Glam"',
      },
      description: {
        type: DataTypes.TEXT,
        comment: 'Short description of this style and when Lala wears it',
      },
      // ── Tagging ─────────────────────────────────────────────────────
      vibe_tags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Style energy tags — ["sleek", "editorial", "natural", "glam", ...]',
      },
      occasion_tags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Best-fit occasions — ["gala", "press_day", "date", "casual", ...]',
      },
      event_types: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Maps to world_events event_category — ["industry", "dating", "family", "social_drama"]',
      },
      // ── Asset ───────────────────────────────────────────────────────
      reference_photo_url: {
        type: DataTypes.STRING,
        comment: 'S3 URL or external reference for this hair style',
      },
      // ── Color / State ────────────────────────────────────────────────
      color_state: {
        type: DataTypes.STRING,
        comment: 'e.g. "natural black", "honey blonde highlights", "auburn"',
      },
      length: {
        type: DataTypes.STRING,
        comment: 'e.g. "pixie", "bob", "shoulder", "mid-back", "waist-length"',
      },
      texture: {
        type: DataTypes.STRING,
        comment: 'e.g. "silk press", "natural coils", "waves", "straight"',
      },
      // ── Franchise ───────────────────────────────────────────────────
      career_echo_potential: {
        type: DataTypes.TEXT,
        comment: 'How this look connects to JustAWoman\'s real journey or franchise mythology. Nullable.',
      },
      is_justAWoman_style: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'True when this represents one of JustAWoman\'s actual real-world styles',
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
      modelName: 'HairLibrary',
      tableName: 'hair_library',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return HairLibrary;
};
