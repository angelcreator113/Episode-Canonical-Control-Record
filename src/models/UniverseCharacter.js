/**
 * UniverseCharacter Model
 * Characters promoted to LalaVerse universe level from registries.
 * Location: src/models/UniverseCharacter.js
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UniverseCharacter = sequelize.define('UniverseCharacter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    universe_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    registry_character_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Links back to the registry character that was promoted',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Canonical name at universe level',
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'pressure | mirror | support | shadow | special | protagonist',
    },
    canon_tier: {
      type: DataTypes.STRING(50),
      defaultValue: 'supporting_canon',
      comment: 'core_canon | supporting_canon | minor_canon',
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Universe-level role description',
    },
    first_appeared: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    first_book_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    first_show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
      comment: 'active | evolving | archived',
    },
    portrait_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'universe_characters',
    underscored: true,
    timestamps: true,
  });

  UniverseCharacter.associate = (models) => {
    if (models.Universe) {
      UniverseCharacter.belongsTo(models.Universe, {
        foreignKey: 'universe_id',
        as: 'universe',
      });
    }
    if (models.RegistryCharacter) {
      UniverseCharacter.belongsTo(models.RegistryCharacter, {
        foreignKey: 'registry_character_id',
        as: 'registryCharacter',
      });
    }
  };

  return UniverseCharacter;
};
