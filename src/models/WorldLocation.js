'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorldLocation = sequelize.define('WorldLocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    universe_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location_type: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'interior', // interior, exterior, virtual, transitional
    },
    parent_location_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'world_locations', key: 'id' },
    },
    sensory_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}, // { sight, sound, smell, texture, atmosphere }
    },
    narrative_role: {
      type: DataTypes.STRING(100),
      allowNull: true, // sanctuary, battleground, crossroads, prison, haven
    },
    associated_characters: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    first_appearance_chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    style_guide: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Property style guide — materials, palette, hardware, architecture cascading to child rooms',
    },
    floor_plan: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Floor plan — room connections, doorway links, spatial layout',
    },
    property_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Property classification: penthouse, mansion, apartment, townhouse, studio',
    },
  }, {
    tableName: 'world_locations',
    timestamps: true,
    underscored: true,
  });

  WorldLocation.associate = (models) => {
    if (models.Universe) {
      WorldLocation.belongsTo(models.Universe, {
        foreignKey: 'universe_id',
        as: 'universe',
      });
    }
    WorldLocation.belongsTo(WorldLocation, {
      foreignKey: 'parent_location_id',
      as: 'parentLocation',
    });
    WorldLocation.hasMany(WorldLocation, {
      foreignKey: 'parent_location_id',
      as: 'childLocations',
    });
    if (models.SceneSet) {
      WorldLocation.hasMany(models.SceneSet, {
        foreignKey: 'world_location_id',
        as: 'sceneSets',
      });
    }
  };

  return WorldLocation;
};
