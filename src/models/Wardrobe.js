'use strict';
const { DataTypes } = require('sequelize');

/**
 * Wardrobe Model
 * Stores clothing and fashion items worn by characters
 */
module.exports = (sequelize) => {
  const Wardrobe = sequelize.define(
    'Wardrobe',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Name/description of the clothing item',
      },
      character: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Character name (denormalized for quick filtering)',
      },
      character_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'FK to characters.id',
      },
      clothing_category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Category: dress, top, bottom, shoes, accessories, jewelry, perfume',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // S3 storage
      s3_key: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'S3 object key',
      },
      s3_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Full S3 URL for wardrobe item image',
      },
      s3_key_processed: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'S3 key for background-removed image',
      },
      s3_url_processed: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Full S3 URL for background-removed image',
      },
      thumbnail_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Thumbnail image URL',
      },

      // Shopping / sourcing
      brand: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      purchase_link: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      // Metadata
      color: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      size: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      season: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      occasion: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      outfit_set_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      outfit_set_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      scene_description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      outfit_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      times_worn: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      last_worn_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_favorite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      library_item_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'FK to wardrobe_library.id',
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Primary show ownership',
      },

      // ═══════════════════════════════════════
      // GAME LAYER FIELDS
      // ═══════════════════════════════════════

      tier: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'basic',
        comment: 'basic | mid | luxury | elite',
      },
      lock_type: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: 'none',
        comment: 'none | coin | reputation | brand_exclusive | season_drop',
      },
      unlock_requirement: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'JSON with unlock conditions (brand_trust_min, event_completed, etc)',
      },
      is_owned: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether LáLá currently owns this item',
      },
      is_visible: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
        comment: 'Whether item is visible in closet (hidden elite items)',
      },
      era_alignment: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'foundation | glow_up | luxury | prime | legacy',
      },
      aesthetic_tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Style tags: casual, elegant, bold, romantic, etc',
      },
      event_types: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Events this item suits: gala, brunch, meetup, etc',
      },
      outfit_match_weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5,
        comment: 'Priority weight for outfit matching (1-10)',
      },
      coin_cost: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'In-game coin cost to unlock',
      },
      reputation_required: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Min reputation tier to unlock',
      },
      influence_required: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Min influence score to unlock',
      },
      season_unlock_episode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Episode number when item drops',
      },
      lala_reaction_own: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'LáLá reaction when she owns this item',
      },
      lala_reaction_locked: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'LáLá reaction when item is locked',
      },
      lala_reaction_reject: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'LáLá reaction when item doesn\'t suit the event',
      },

      // Timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      },
    },
    {
      tableName: 'wardrobe',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          fields: ['character_id'],
        },
        {
          fields: ['clothing_category'],
        },
        {
          fields: ['is_favorite'],
        },
        {
          fields: ['deleted_at'],
        },
        {
          fields: ['tier'],
        },
        {
          fields: ['lock_type'],
        },
        {
          fields: ['is_owned'],
        },
        {
          fields: ['era_alignment'],
        },
      ],
    }
  );

  // Instance methods
  Wardrobe.prototype.incrementWearCount = async function (wornDate = new Date()) {
    this.times_worn += 1;
    this.last_worn_date = wornDate;
    await this.save();
    return this;
  };

  // Class methods
  Wardrobe.findByCharacter = async function (character) {
    return this.findAll({
      where: {
        character,
        deleted_at: null,
      },
      order: [['created_at', 'DESC']],
    });
  };

  Wardrobe.findFavorites = async function () {
    return this.findAll({
      where: {
        is_favorite: true,
        deleted_at: null,
      },
      order: [['last_worn_date', 'DESC']],
    });
  };

  // Define associations
  Wardrobe.associate = function (models) {
    // Many-to-many with Episodes through EpisodeWardrobe junction table
    Wardrobe.belongsToMany(models.Episode, {
      through: models.EpisodeWardrobe,
      foreignKey: 'wardrobe_id',
      otherKey: 'episode_id',
      as: 'episodes',
    });

    // Has many episode wardrobe entries
    Wardrobe.hasMany(models.EpisodeWardrobe, {
      foreignKey: 'wardrobe_id',
      as: 'episodeLinks',
    });

    // Belongs to Character
    Wardrobe.belongsTo(models.Character, {
      foreignKey: 'character_id',
      as: 'characterModel',
    });
  };

  return Wardrobe;
};
