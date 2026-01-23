'use strict';
const { DataTypes } = require('sequelize');

/**
 * OutfitSetItems Model
 * Junction table linking outfit sets to individual wardrobe items
 */
module.exports = (sequelize) => {
  const OutfitSetItems = sequelize.define(
    'OutfitSetItems',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // References
      outfitSetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'outfit_set_id',
        references: {
          model: 'wardrobe_library',
          key: 'id',
        },
      },
      wardrobeItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'wardrobe_item_id',
        references: {
          model: 'wardrobe_library',
          key: 'id',
        },
      },
      // Order and organization
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      layer: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'base, mid, outer, accessory',
      },
      isOptional: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_optional',
      },
      // Metadata
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      tableName: 'outfit_set_items',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false, // No updated_at column in this table
      indexes: [
        {
          unique: true,
          fields: ['outfit_set_id', 'wardrobe_item_id'],
          name: 'outfit_set_items_unique',
        },
        { fields: ['outfit_set_id'] },
        { fields: ['wardrobe_item_id'] },
      ],
    }
  );

  // Associations will be defined in models/index.js
  OutfitSetItems.associate = function (models) {
    // Belongs to outfit set
    OutfitSetItems.belongsTo(models.WardrobeLibrary, {
      foreignKey: 'outfit_set_id',
      as: 'outfitSet',
    });

    // Belongs to wardrobe item
    OutfitSetItems.belongsTo(models.WardrobeLibrary, {
      foreignKey: 'wardrobe_item_id',
      as: 'wardrobeItem',
    });
  };

  return OutfitSetItems;
};
