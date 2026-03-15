/**
 * WorldCharacter Model
 * Full LalaVerse world characters — real people in Lala's world, not PNOS forces.
 * Location: src/models/WorldCharacter.js
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorldCharacter = sequelize.define('WorldCharacter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    registry_character_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Identity
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    gender: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    age_range: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    occupation: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    world_location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Character type
    character_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'love_interest | industry_peer | mentor | antagonist | rival | collaborator | one_night_stand | recurring',
    },

    // Romantic/intimate eligibility
    intimate_eligible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // Aesthetic DNA
    aesthetic: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // What they want
    surface_want: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    real_want: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    what_they_want_from_lala: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Relationship to Lala
    how_they_meet: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dynamic: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tension_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Intimate profile
    intimate_style: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    intimate_dynamic: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    what_lala_feels: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Arc
    arc_role: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    exit_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Status
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'draft',
    },
    current_tension: {
      type: DataTypes.STRING(50),
      defaultValue: 'Stable',
    },

    // Career Echo
    career_echo_connection: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    career_echo_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Expanded profile columns
    sexuality: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    attracted_to: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    how_they_love: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    desire_they_wont_admit: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    relationship_graph: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    family_layer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    origin_story: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    public_persona: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    private_reality: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    relationship_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    committed_to: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    moral_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fidelity_pattern: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Dossier-aligned essence fields
    core_fear: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    character_archetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    emotional_baseline: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    at_their_best: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    at_their_worst: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Dossier-aligned aesthetic fields
    color_palette: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    signature_silhouette: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    signature_accessories: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    glam_energy: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Dossier-aligned voice fields
    speech_pattern: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    vocabulary_tone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    catchphrases: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    internal_monologue_style: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Dossier-aligned career field
    career_goal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // World tag (which world/layer this character belongs to)
    world_tag: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'world_characters',
    underscored: true,
    timestamps: true,
  });

  /* ── Auto-populate section defaults on every creation path ── */
  const applyDefaults = (instance) => {
    if (instance.relationship_graph === null || instance.relationship_graph === undefined) instance.relationship_graph = [];
    if (instance.current_tension === null || instance.current_tension === undefined) instance.current_tension = 'Stable';
    if (instance.status === null || instance.status === undefined) instance.status = 'draft';
  };
  WorldCharacter.beforeCreate(applyDefaults);
  WorldCharacter.beforeBulkCreate((instances) => instances.forEach(applyDefaults));

  WorldCharacter.associate = (models) => {
    if (models.RegistryCharacter) {
      WorldCharacter.belongsTo(models.RegistryCharacter, {
        foreignKey: 'registry_character_id',
        as: 'registryCharacter',
      });
    }
  };

  return WorldCharacter;
};
