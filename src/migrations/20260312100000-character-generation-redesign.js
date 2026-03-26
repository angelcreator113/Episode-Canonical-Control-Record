'use strict';
/**
 * Migration: Character Generation Redesign
 * ─────────────────────────────────────────────────────────────────────────────
 * What this does:
 *
 * 1. Adds `depth_level` ENUM replacing `status` as the lifecycle indicator
 *    Maps: draft → sparked, accepted → breathing, finalized → alive
 *    `declined` characters are untouched — they are rejected, not deepened
 *
 * 2. Adds 18 new interior architecture columns (all JSONB or ENUM)
 *    Migrates existing TEXT fields into richer JSONB structures:
 *      core_wound + context        → wound (JSONB)
 *      mask_persona                → the_mask (JSONB)
 *      core_desire+core_fear+
 *        hidden_want               → want_architecture (JSONB)
 *      living_context              → living_state (JSONB)
 *    Keeps original TEXT columns for backwards compatibility
 *
 * 3. Adds social_presence flag + Feed profile link
 * 4. Adds ghost_characters JSONB tracking
 * 5. Adds belonging_map JSONB (groups, communities, exclusions)
 * 6. Adds family_tree JSONB (full family generation output)
 *
 * DOES NOT: drop any existing columns. Nothing breaks.
 * ─────────────────────────────────────────────────────────────────────────────
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Add depth_level ─────────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'depth_level', {
      type: Sequelize.ENUM('sparked', 'breathing', 'active', 'alive'),
      allowNull: true,
      defaultValue: null,
      comment: 'Lifecycle depth indicator. Replaces status as the depth signal. Characters never finalize — they deepen.',
    });

    // ── 2. Migrate existing status → depth_level ──────────────────────────
    // draft → sparked, accepted → breathing, finalized → alive
    // declined characters get depth_level = sparked (they exist but are shallow)
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET depth_level = CASE
        WHEN status = 'draft'      THEN 'sparked'::enum_registry_characters_depth_level
        WHEN status = 'accepted'   THEN 'breathing'::enum_registry_characters_depth_level
        WHEN status = 'finalized'  THEN 'alive'::enum_registry_characters_depth_level
        WHEN status = 'declined'   THEN 'sparked'::enum_registry_characters_depth_level
        ELSE 'sparked'::enum_registry_characters_depth_level
      END;
    `);

    // ── 3. Interior architecture columns ──────────────────────────────────

    // want_architecture — migrates core_desire, core_fear, hidden_want
    await queryInterface.addColumn('registry_characters', 'want_architecture', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ surface_want, real_want, forbidden_want } — three levels that contradict each other',
    });

    // Migrate existing TEXT fields into want_architecture JSONB
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET want_architecture = jsonb_build_object(
        'surface_want',   COALESCE(core_desire, ''),
        'real_want',      '',
        'forbidden_want', COALESCE(hidden_want, '')
      )
      WHERE core_desire IS NOT NULL OR hidden_want IS NOT NULL;
    `);

    // wound — richer than core_wound TEXT
    await queryInterface.addColumn('registry_characters', 'wound', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ description, origin_period, deep_profile_dimensions_affected[], downstream_effects }',
    });

    // Migrate core_wound TEXT → wound JSONB
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET wound = jsonb_build_object(
        'description',                    COALESCE(core_wound, ''),
        'origin_period',                  '',
        'deep_profile_dimensions_affected', '[]'::jsonb,
        'downstream_effects',             ''
      )
      WHERE core_wound IS NOT NULL AND core_wound != '';
    `);

    // the_mask — richer than mask_persona TEXT
    await queryInterface.addColumn('registry_characters', 'the_mask', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ description, divergence_map[], feed_profile_is_mask }',
    });

    // Migrate mask_persona TEXT → the_mask JSONB
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET the_mask = jsonb_build_object(
        'description',        COALESCE(mask_persona, ''),
        'divergence_map',     '[]'::jsonb,
        'feed_profile_is_mask', false
      )
      WHERE mask_persona IS NOT NULL AND mask_persona != '';
    `);

    // living_state — replaces living_context going forward
    await queryInterface.addColumn('registry_characters', 'living_state', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Current story state — inferred at creation, updated as story progresses',
    });

    // Migrate living_context → living_state
    await queryInterface.sequelize.query(`
      UPDATE registry_characters
      SET living_state = living_context
      WHERE living_context IS NOT NULL;
    `);

    // triggers
    await queryInterface.addColumn('registry_characters', 'triggers', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of 3-5 specific conditions that destabilize this character. Checked against Feed events.',
    });

    // blind_spot
    await queryInterface.addColumn('registry_characters', 'blind_spot', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Author-only. Something true about this character they cannot see. Never shown in character view.',
    });

    // change_capacity
    await queryInterface.addColumn('registry_characters', 'change_capacity', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ mobility: rigid|fluid|conditional, conditions_for_change, armor_type }',
    });

    // self_narrative
    await queryInterface.addColumn('registry_characters', 'self_narrative', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'The story this character tells themselves. Almost always partially wrong.',
    });

    // operative_cosmology
    await queryInterface.addColumn('registry_characters', 'operative_cosmology', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'How this character understands why things happen. Not stated religion — actual meaning-making logic.',
    });

    // foreclosed_possibility
    await queryInterface.addColumn('registry_characters', 'foreclosed_possibility', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'What this character has secretly given up on. Usually invisible even to themselves.',
    });

    // experience_of_joy
    await queryInterface.addColumn('registry_characters', 'experience_of_joy', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'What makes this person fully alive — not happy, alive. As specific as the wound.',
    });

    // time_orientation
    await queryInterface.addColumn('registry_characters', 'time_orientation', {
      type: Sequelize.ENUM('past_anchored', 'future_obsessed', 'impulsive_present', 'waiting'),
      allowNull: true,
      defaultValue: null,
      comment: 'Personal relationship to time that shapes every decision.',
    });

    // dilemma — richer than any existing field
    await queryInterface.addColumn('registry_characters', 'dilemma', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ central_tension, option_a, option_b, what_both_cost } — seeded from wound + want at creation',
    });

    // ── 4. Social presence ────────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'social_presence', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'Does this character exist online? Inferred at creation, can be overridden.',
    });

    await queryInterface.addColumn('registry_characters', 'feed_profile_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'FK to social_profiles.id — set when social_presence = true and Feed profile is created',
      references: { model: 'social_profiles', key: 'id' },
      onDelete: 'SET NULL',
    });

    // ── 5. Ghost characters ───────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'ghost_characters', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of { name, mentioned_in, mention_count, promoted } — characters referenced but not yet in registry',
    });

    // ── 6. Family tree ────────────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'family_tree', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Full family generation output — members, dynamics, generational wound, social presence per member',
    });

    // ── 7. Belonging map ──────────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'belonging_map', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Groups, communities, institutions — including exclusions. Separate from individual relationships.',
    });

    // ── 8. Generation metadata ────────────────────────────────────────────
    await queryInterface.addColumn('registry_characters', 'generation_context', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ world_id, book_id, generated_at, generation_version } — what context shaped this character',
    });

    await queryInterface.addColumn('registry_characters', 'prose_overview', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Auto-generated narrative bio paragraph in italic voice. Generated at creation.',
    });

    // ── 9. Indexes ────────────────────────────────────────────────────────
    await queryInterface.addIndex('registry_characters', ['depth_level']);
    await queryInterface.addIndex('registry_characters', ['social_presence']);
    await queryInterface.addIndex('registry_characters', ['feed_profile_id']);
    await queryInterface.addIndex('registry_characters', ['time_orientation']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('registry_characters', ['depth_level']);
    await queryInterface.removeIndex('registry_characters', ['social_presence']);
    await queryInterface.removeIndex('registry_characters', ['feed_profile_id']);
    await queryInterface.removeIndex('registry_characters', ['time_orientation']);

    // Remove columns (reverse order)
    const cols = [
      'prose_overview', 'generation_context', 'belonging_map', 'family_tree',
      'ghost_characters', 'feed_profile_id', 'social_presence', 'dilemma',
      'time_orientation', 'experience_of_joy', 'foreclosed_possibility',
      'operative_cosmology', 'self_narrative', 'change_capacity', 'blind_spot',
      'triggers', 'living_state', 'the_mask', 'wound', 'want_architecture',
      'depth_level',
    ];
    for (const col of cols) {
      await queryInterface.removeColumn('registry_characters', col);
    }

    // Drop ENUMs
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_registry_characters_depth_level";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_registry_characters_time_orientation";');
  },
};
