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

    /* ── Portrait Image ── */
    portrait_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /* ── Section 1: Core Identity additions ── */
    canon_tier: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    first_appearance: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    era_introduced: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    creator: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    /* ── Identity Fields ── */
    gender: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    ethnicity: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    species: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: 'human',
    },

    /* ── Death Tracking ── */
    is_alive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    death_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    death_cause: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    death_impact: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /* ── Character DNA Triad: wound + desire + hidden_want ── */
    hidden_want: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'What they actually want but will not admit — structural, stable as the wound',
    },

    /* ── Section 2: Essence Profile ── */
    core_desire: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    core_fear: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    core_wound: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    mask_persona: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    truth_persona: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    character_archetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    signature_trait: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    emotional_baseline: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    /* ── Section 3: Aesthetic DNA ── */
    aesthetic_dna: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 4: Career & Status ── */
    career_status: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 5: Relationships ── */
    relationships_map: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 6: Story Presence ── */
    story_presence: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 7: Voice & Dialogue Signature ── */
    voice_signature: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 8: Evolution Tracking ── */
    evolution_tracking: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 9: Living Context (current life architecture) ── */
    living_context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Section 10: Deep Profile (14-dimension character anthropology) ── */
    deep_profile: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Accumulative character anthropology — grows through generation, scene revelation, and writer input',
    },

    /* ── Section 11: Registry Sync fields ── */
    wound_depth: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      allowNull: true,
    },
    belief_pressured: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    emotional_function: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    writer_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /* ── Therapy Dilemma Profile fields ── */
    therapy_primary_defense: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    therapy_emotional_state: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    therapy_baseline: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    /* ── Character Generation v2: Interior Architecture ── */
    depth_level: {
      type: DataTypes.ENUM('sparked', 'breathing', 'active', 'alive'),
      allowNull: true,
      defaultValue: null,
    },
    want_architecture: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    wound: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    the_mask: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    living_state: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    triggers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    blind_spot: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    change_capacity: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    self_narrative: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    operative_cosmology: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    foreclosed_possibility: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    experience_of_joy: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    time_orientation: {
      type: DataTypes.ENUM('past_anchored', 'future_obsessed', 'impulsive_present', 'waiting'),
      allowNull: true,
    },
    dilemma: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    social_presence: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    feed_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ghost_characters: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    family_tree: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    belonging_map: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    generation_context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    prose_overview: {
      type: DataTypes.TEXT,
      allowNull: true,
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
