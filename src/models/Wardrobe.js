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
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Character who wears this: lala, justawoman, guest',
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

      // Image storage
      s3_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Full S3 URL for wardrobe item image',
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

      // Metadata
      color: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      season: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
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

      // Library reference
      library_item_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'wardrobe_library',
          key: 'id',
        },
        comment: 'Reference to wardrobe library item',
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
          fields: ['character'],
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

    // Belongs to library item (optional)
    Wardrobe.belongsTo(models.WardrobeLibrary, {
      foreignKey: 'library_item_id',
      as: 'libraryItem',
    });
  };

  return Wardrobe;
};
