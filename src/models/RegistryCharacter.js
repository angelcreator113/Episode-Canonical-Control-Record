/**
 * RegistryCharacter Model
 * An individual character within a CharacterRegistry
 * Location: src/models/RegistryCharacter.js
 */

'use strict';

const { DataTypes } = require('sequelize');

/* ── Author-Only Fields (never returned to non-author clients) ── */
const AUTHOR_ONLY_FIELDS = [
  'de_blind_spot',
  'de_blind_spot_evidence',
  'de_blind_spot_crack_condition',
  'de_actual_narrative_gap',
];

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
    world: {
      type: DataTypes.ENUM('book-1', 'lalaverse', 'series-2'),
      allowNull: true,
      comment: 'Which world this character belongs to.',
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
    intimate_eligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
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

    /* ── Section 10: Deep Profile (DEPRECATED — legacy 14-dimension anthropology) ── */
    /* The canonical depth system is the Character Depth Engine (de_* columns below).
       deep_profile is retained for backward compatibility but the story engine
       reads from de_* columns. New integrations should use /api/v1/character-depth. */
    deep_profile: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'DEPRECATED: Legacy 14-dimension anthropology. Canonical system is de_* columns (10-dimension Depth Engine).',
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

    /* ── Character Depth Engine (Section 9–13) ── */

    // Body
    body_relationship: { type: DataTypes.TEXT, allowNull: true },
    body_history: { type: DataTypes.TEXT, allowNull: true },
    body_currency: { type: DataTypes.TEXT, allowNull: true },
    body_control_pattern: { type: DataTypes.TEXT, allowNull: true },

    // Money
    money_behavior_pattern: {
      type: DataTypes.ENUM(
        'hoarder','compulsive_giver','spends_to_feel_powerful',
        'deprives_out_of_guilt','uses_money_to_control',
        'performs_wealth','balanced','unknown'
      ),
      allowNull: true,
    },
    money_behavior_note: { type: DataTypes.TEXT, allowNull: true },

    // Time (v2 — expanded from original time_orientation ENUM)
    time_orientation_v2: {
      type: DataTypes.ENUM(
        'past_anchored','future_focused','present_impulsive',
        'suspended','cyclical','unknown'
      ),
      allowNull: true,
    },
    time_orientation_note: { type: DataTypes.TEXT, allowNull: true },

    // Change (v2 — ENUM classifier alongside existing JSONB change_capacity)
    change_capacity_v2: {
      type: DataTypes.ENUM(
        'rigid','slow','conditional','fluid','ready','unknown'
      ),
      allowNull: true,
    },
    change_conditions: { type: DataTypes.TEXT, allowNull: true },
    change_blocker: { type: DataTypes.TEXT, allowNull: true },

    // Circumstance
    circumstance_advantages: { type: DataTypes.TEXT, allowNull: true },
    circumstance_disadvantages: { type: DataTypes.TEXT, allowNull: true },
    luck_belief: {
      type: DataTypes.ENUM(
        'merit_based','rigged','divinely_ordered','random','relational','chaotic','unknown'
      ),
      allowNull: true,
    },
    luck_belief_vs_stated: { type: DataTypes.TEXT, allowNull: true },

    // Self-narrative (self_narrative already exists above — these extend it)
    actual_narrative: { type: DataTypes.TEXT, allowNull: true },
    narrative_gap_type: {
      type: DataTypes.ENUM(
        'villain_misidentified','hero_exaggerated','wound_mislocated',
        'cause_reversed','timeline_collapsed','significance_inverted',
        'none_yet','unknown'
      ),
      allowNull: true,
    },

    // Blind spot (blind_spot TEXT already exists above — these extend it)
    blind_spot_category: {
      type: DataTypes.ENUM(
        'self_assessment','motivation','impact','pattern',
        'relationship','wound','unknown'
      ),
      allowNull: true,
    },
    blind_spot_visible_to: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
    },

    // Cosmology (v2 — ENUM alongside existing TEXT operative_cosmology)
    operative_cosmology_v2: {
      type: DataTypes.ENUM(
        'merit_based','rigged','divinely_ordered','random','relational','unknown'
      ),
      allowNull: true,
    },
    cosmology_vs_stated_religion: { type: DataTypes.TEXT, allowNull: true },

    // Foreclosed possibility
    foreclosed_category: {
      type: DataTypes.ENUM(
        'love','safety','belonging','success','rest','joy',
        'visibility','being_known','being_chosen','starting_over','none','unknown'
      ),
      allowNull: true,
    },
    foreclosure_origin: { type: DataTypes.TEXT, allowNull: true },
    foreclosure_vs_stated_want: { type: DataTypes.TEXT, allowNull: true },

    // Joy
    joy_source: { type: DataTypes.TEXT, allowNull: true },
    joy_accessibility: {
      type: DataTypes.ENUM(
        'freely_accessible','conditional','buried','forgotten','unknown'
      ),
      allowNull: true,
    },
    joy_vs_ambition: { type: DataTypes.TEXT, allowNull: true },

    /* ── Character Depth Engine v2 (10 dimensions — de_ prefix) ── */
    // NOTE: Using STRING instead of ENUM in the model for deployment safety.
    // The migration creates proper ENUM types in PostgreSQL.
    // Sequelize STRING is compatible with Postgres ENUM columns at query time.

    // Body
    de_body_relationship: { type: DataTypes.STRING, allowNull: true },
    de_body_currency: { type: DataTypes.INTEGER, allowNull: true },
    de_body_control: { type: DataTypes.INTEGER, allowNull: true },
    de_body_comfort: { type: DataTypes.INTEGER, allowNull: true },
    de_body_history: { type: DataTypes.TEXT, allowNull: true },

    // Money
    de_money_behavior: { type: DataTypes.STRING, allowNull: true },
    de_money_origin_class: { type: DataTypes.STRING, allowNull: true },
    de_money_current_class: { type: DataTypes.STRING, allowNull: true },
    de_class_gap_direction: { type: DataTypes.STRING, allowNull: true },
    de_money_wound: { type: DataTypes.TEXT, allowNull: true },

    // Time
    de_time_orientation: { type: DataTypes.STRING, allowNull: true },
    de_time_wound: { type: DataTypes.TEXT, allowNull: true },

    // Luck & Circumstance
    de_world_belief: { type: DataTypes.STRING, allowNull: true },
    de_circumstance_advantages: { type: DataTypes.TEXT, allowNull: true },
    de_circumstance_disadvantages: { type: DataTypes.TEXT, allowNull: true },
    de_luck_interpretation: { type: DataTypes.INTEGER, allowNull: true },
    de_circumstance_wound: { type: DataTypes.TEXT, allowNull: true },

    // Self-Narrative
    de_self_narrative_origin: { type: DataTypes.TEXT, allowNull: true },
    de_self_narrative_turning_point: { type: DataTypes.TEXT, allowNull: true },
    de_self_narrative_villain: { type: DataTypes.TEXT, allowNull: true },
    de_actual_narrative_gap: { type: DataTypes.TEXT, allowNull: true, comment: 'AUTHOR ONLY' },
    de_therapy_target: { type: DataTypes.TEXT, allowNull: true },

    // Blind Spot — AUTHOR ONLY
    de_blind_spot_category: { type: DataTypes.STRING, allowNull: true },
    de_blind_spot: { type: DataTypes.TEXT, allowNull: true, comment: 'AUTHOR ONLY' },
    de_blind_spot_evidence: { type: DataTypes.TEXT, allowNull: true, comment: 'AUTHOR ONLY' },
    de_blind_spot_crack_condition: { type: DataTypes.TEXT, allowNull: true, comment: 'AUTHOR ONLY' },

    // Change Capacity
    de_change_capacity: { type: DataTypes.STRING, allowNull: true },
    de_change_capacity_score: { type: DataTypes.INTEGER, allowNull: true },
    de_change_condition: { type: DataTypes.TEXT, allowNull: true },
    de_change_witness: { type: DataTypes.TEXT, allowNull: true },
    de_arc_function: { type: DataTypes.STRING, allowNull: true },

    // Operative Cosmology
    de_operative_cosmology: { type: DataTypes.STRING, allowNull: true },
    de_stated_religion: { type: DataTypes.TEXT, allowNull: true },
    de_cosmology_conflict: { type: DataTypes.TEXT, allowNull: true },
    de_meaning_making_style: { type: DataTypes.TEXT, allowNull: true },

    // Foreclosed Possibility
    de_foreclosed_possibilities: { type: DataTypes.JSONB, allowNull: true },
    de_foreclosure_origins: { type: DataTypes.JSONB, allowNull: true },
    de_foreclosure_visibility: { type: DataTypes.JSONB, allowNull: true },
    de_crack_conditions: { type: DataTypes.JSONB, allowNull: true },

    // Joy
    de_joy_trigger: { type: DataTypes.TEXT, allowNull: true },
    de_joy_body_location: { type: DataTypes.TEXT, allowNull: true },
    de_joy_origin: { type: DataTypes.TEXT, allowNull: true },
    de_forbidden_joy: { type: DataTypes.TEXT, allowNull: true },
    de_joy_threat_response: { type: DataTypes.STRING, allowNull: true },
    de_joy_current_access: { type: DataTypes.INTEGER, allowNull: true },

    /* ── Demographics Layer ── */
    // NOTE: Using STRING instead of ENUM in the model for deployment safety.
    // The migration creates proper ENUM types in PostgreSQL.
    // Sequelize STRING is compatible with Postgres ENUM columns at query time.

    // Identity
    pronouns: { type: DataTypes.STRING, allowNull: true },
    age: { type: DataTypes.INTEGER, allowNull: true },
    birth_year: { type: DataTypes.INTEGER, allowNull: true },
    cultural_background: { type: DataTypes.TEXT, allowNull: true },
    nationality: { type: DataTypes.TEXT, allowNull: true },
    first_language: { type: DataTypes.TEXT, allowNull: true },

    // Geography
    hometown: { type: DataTypes.TEXT, allowNull: true },
    current_city: { type: DataTypes.STRING, allowNull: true },
    city_migration_history: { type: DataTypes.TEXT, allowNull: true },

    // Class
    class_origin: { type: DataTypes.STRING, allowNull: true },
    current_class: { type: DataTypes.STRING, allowNull: true },
    class_mobility_direction: { type: DataTypes.STRING, allowNull: true },

    // Family
    family_structure: { type: DataTypes.STRING, allowNull: true },
    parents_status: { type: DataTypes.TEXT, allowNull: true },
    sibling_position: { type: DataTypes.STRING, allowNull: true },
    sibling_count: { type: DataTypes.INTEGER, allowNull: true },
    relationship_status: { type: DataTypes.STRING, allowNull: true },
    has_children: { type: DataTypes.BOOLEAN, allowNull: true },
    children_ages: { type: DataTypes.TEXT, allowNull: true },

    // Education & Career
    education_experience: { type: DataTypes.TEXT, allowNull: true },
    career_history: { type: DataTypes.TEXT, allowNull: true },
    years_posting: { type: DataTypes.INTEGER, allowNull: true },

    // Physical Presence & Voice
    // TECH-015: physical_presence is social-perceptual only — how they take up space,
    // what people notice before she speaks. No height, weight, or measurements.
    physical_presence: { type: DataTypes.TEXT, allowNull: true },
    // NOTE: This is the demographics-layer TEXT voice signature (how demographics shape speech).
    // Distinct from voice_signature (JSONB, Section 7) which captures dialogue patterns/structure.
    demographic_voice_signature: { type: DataTypes.TEXT, allowNull: true },

    // Online Presence
    platform_primary: { type: DataTypes.STRING, allowNull: true },
    follower_tier: { type: DataTypes.STRING, allowNull: true },

    // ── Social Intelligence (synced from SocialProfile) ──────────────────────
    celebrity_tier: { type: DataTypes.STRING(20), allowNull: true },       // accessible/selective/exclusive/untouchable
    platform_presences: { type: DataTypes.JSONB, allowNull: true },        // multi-platform footprint
    public_persona: { type: DataTypes.TEXT, allowNull: true },             // what audiences believe
    private_reality: { type: DataTypes.TEXT, allowNull: true },            // what's actually true
    primary_income_source: { type: DataTypes.STRING(100), allowNull: true },
    income_breakdown: { type: DataTypes.JSONB, allowNull: true },          // { brand_deals: 40, subs: 50, ... }
    monthly_earnings_range: { type: DataTypes.STRING(50), allowNull: true },
    clout_score: { type: DataTypes.INTEGER, allowNull: true },             // 0-100
    drama_magnet: { type: DataTypes.BOOLEAN, allowNull: true },
    social_leverage: { type: DataTypes.TEXT, allowNull: true },            // narrative summary of their power
    content_category: { type: DataTypes.STRING(100), allowNull: true },    // fashion, beauty, creator_economy
    brand_partnerships: { type: DataTypes.JSONB, allowNull: true },        // [{brand, type, visible}]
    controversy_history: { type: DataTypes.JSONB, allowNull: true },       // [{event, severity}]
    secret_connections: { type: DataTypes.JSONB, allowNull: true },        // hidden relationships
    rebrand_history: { type: DataTypes.JSONB, allowNull: true },           // past handles/niches
    social_synced_at: { type: DataTypes.DATE, allowNull: true },           // last sync from feed profile
  }, {
    tableName: 'registry_characters',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  /* ── Auto-populate section defaults on every creation path ── */
  const applyDefaults = (instance) => {
    if (instance.aesthetic_dna === null || instance.aesthetic_dna === undefined) instance.aesthetic_dna = {};
    if (instance.career_status === null || instance.career_status === undefined) instance.career_status = {};
    if (instance.relationships_map === null || instance.relationships_map === undefined) instance.relationships_map = {};
    if (instance.story_presence === null || instance.story_presence === undefined) instance.story_presence = {};
    if (instance.voice_signature === null || instance.voice_signature === undefined) instance.voice_signature = {};
    if (instance.evolution_tracking === null || instance.evolution_tracking === undefined) instance.evolution_tracking = {};
    if (instance.species === null || instance.species === undefined) instance.species = 'human';
    if (instance.is_alive === null || instance.is_alive === undefined) instance.is_alive = true;
  };
  RegistryCharacter.beforeCreate(applyDefaults);
  RegistryCharacter.beforeBulkCreate((instances) => instances.forEach(applyDefaults));

  RegistryCharacter.associate = (models) => {
    if (models.CharacterRegistry) {
      RegistryCharacter.belongsTo(models.CharacterRegistry, {
        foreignKey: 'registry_id',
        as: 'registry',
      });
    }
  };

  RegistryCharacter.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;

  return RegistryCharacter;
};

module.exports.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;
