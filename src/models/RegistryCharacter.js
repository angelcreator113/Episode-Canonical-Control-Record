/**
 * RegistryCharacter Model
 * An individual character within a CharacterRegistry
 * Location: src/models/RegistryCharacter.js
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RegistryCharacter = sequelize.define('RegistryCharacter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    registry_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    character_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    display_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    role_type: {
      type: DataTypes.ENUM('protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'),
      defaultValue: 'pressure',
    },
    role_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    appearance_mode: {
      type: DataTypes.ENUM('on_page', 'composite', 'observed', 'invisible', 'brief'),
      defaultValue: 'on_page',
    },
    status: {
      type: DataTypes.ENUM('draft', 'accepted', 'declined', 'finalized'),
      defaultValue: 'draft',
    },
    core_belief: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pressure_type: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pressure_quote: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    personality: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    job_options: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    name_options: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    selected_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    personality_matrix: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    extra_fields: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'registry_characters',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  RegistryCharacter.associate = (models) => {
    if (models.CharacterRegistry) {
      RegistryCharacter.belongsTo(models.CharacterRegistry, {
        foreignKey: 'registry_id',
        as: 'registry',
      });
    }
  };

  return RegistryCharacter;
};
