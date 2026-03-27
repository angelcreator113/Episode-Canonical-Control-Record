'use strict';

/**
 * Corrective Migration: Ensure registry_characters has all required columns
 * ─────────────────────────────────────────────────────────────────────────────
 * Problem: The deploy pipeline's `db:migrate | tail -10` swallows migration
 * failures (exit code of `tail` = 0 regardless of db:migrate result).
 * Migration 20260312100000-character-generation-redesign.js likely failed
 * on dev RDS, leaving registry_characters missing 21 columns that the
 * RegistryCharacter model expects → SELECT queries fail → 500 errors.
 *
 * This migration is fully idempotent — it checks each column/ENUM before
 * creating so it's safe to run regardless of current DB state.
 * ─────────────────────────────────────────────────────────────────────────────
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('registry_characters');

    // ── Helper: add column only if missing ──
    async function addIfMissing(col, definition) {
      if (!desc[col]) {
        await queryInterface.addColumn('registry_characters', col, definition);
        console.log(`  ✅ Added column: ${col}`);
      }
    }

    // ── 1. Create ENUM types if they don't exist ──
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_registry_characters_depth_level') THEN
          CREATE TYPE "enum_registry_characters_depth_level" AS ENUM('sparked', 'breathing', 'active', 'alive');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_registry_characters_time_orientation') THEN
          CREATE TYPE "enum_registry_characters_time_orientation" AS ENUM('past_anchored', 'future_obsessed', 'impulsive_present', 'waiting');
        END IF;
      END $$;
    `);

    // ── 2. Character Generation v2 columns (from 20260312100000) ──

    await addIfMissing('depth_level', {
      type: Sequelize.ENUM('sparked', 'breathing', 'active', 'alive'),
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('want_architecture', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('wound', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('the_mask', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('living_state', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('triggers', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('blind_spot', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('change_capacity', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('self_narrative', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('operative_cosmology', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('foreclosed_possibility', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('experience_of_joy', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('time_orientation', {
      type: Sequelize.ENUM('past_anchored', 'future_obsessed', 'impulsive_present', 'waiting'),
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('dilemma', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('social_presence', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('feed_profile_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('ghost_characters', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('family_tree', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('belonging_map', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('generation_context', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('prose_overview', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    // ── 3. Also ensure earlier dossier fields exist (from 20260222210000) ──
    // These may also be missing if that migration failed on dev

    await addIfMissing('portrait_url', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('canon_tier', { type: Sequelize.STRING(50), allowNull: true });
    await addIfMissing('first_appearance', { type: Sequelize.STRING(255), allowNull: true });
    await addIfMissing('era_introduced', { type: Sequelize.STRING(100), allowNull: true });
    await addIfMissing('creator', { type: Sequelize.STRING(255), allowNull: true });
    await addIfMissing('gender', { type: Sequelize.STRING(80), allowNull: true });
    await addIfMissing('ethnicity', { type: Sequelize.STRING(150), allowNull: true });
    await addIfMissing('species', { type: Sequelize.STRING(150), allowNull: true, defaultValue: 'human' });
    await addIfMissing('is_alive', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await addIfMissing('death_date', { type: Sequelize.DATEONLY, allowNull: true });
    await addIfMissing('death_cause', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('death_impact', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('hidden_want', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('core_desire', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('core_fear', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('core_wound', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('mask_persona', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('truth_persona', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('character_archetype', { type: Sequelize.STRING(100), allowNull: true });
    await addIfMissing('signature_trait', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('emotional_baseline', { type: Sequelize.STRING(100), allowNull: true });
    await addIfMissing('aesthetic_dna', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('career_status', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('relationships_map', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('story_presence', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('voice_signature', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('evolution_tracking', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('living_context', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('deep_profile', { type: Sequelize.JSONB, allowNull: true, defaultValue: {} });

    // ── 4. Sync fields (from 20260226000001) ──
    await addIfMissing('wound_depth', { type: Sequelize.FLOAT, defaultValue: 0, allowNull: true });
    await addIfMissing('belief_pressured', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('emotional_function', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('writer_notes', { type: Sequelize.TEXT, allowNull: true });

    // ── 5. Therapy fields (from 20260310190000) ──
    await addIfMissing('therapy_primary_defense', { type: Sequelize.TEXT, allowNull: true });
    await addIfMissing('therapy_emotional_state', { type: Sequelize.JSONB, allowNull: true });
    await addIfMissing('therapy_baseline', { type: Sequelize.JSONB, allowNull: true });

    // ── 6. Data migrations (only if columns were just created) ──
    // Migrate existing status → depth_level for any rows that have status but no depth_level
    if (!desc.depth_level) {
      await queryInterface.sequelize.query(`
        UPDATE registry_characters
        SET depth_level = CASE
          WHEN status = 'draft'      THEN 'sparked'::enum_registry_characters_depth_level
          WHEN status = 'accepted'   THEN 'breathing'::enum_registry_characters_depth_level
          WHEN status = 'finalized'  THEN 'alive'::enum_registry_characters_depth_level
          WHEN status = 'declined'   THEN 'sparked'::enum_registry_characters_depth_level
          ELSE 'sparked'::enum_registry_characters_depth_level
        END
        WHERE depth_level IS NULL AND status IS NOT NULL;
      `);
    }

    // Migrate want fields
    if (!desc.want_architecture) {
      await queryInterface.sequelize.query(`
        UPDATE registry_characters
        SET want_architecture = jsonb_build_object(
          'surface_want',   COALESCE(core_desire, ''),
          'real_want',      '',
          'forbidden_want', COALESCE(hidden_want, '')
        )
        WHERE (core_desire IS NOT NULL OR hidden_want IS NOT NULL)
          AND want_architecture IS NULL;
      `);
    }

    // Migrate wound
    if (!desc.wound) {
      await queryInterface.sequelize.query(`
        UPDATE registry_characters
        SET wound = jsonb_build_object(
          'description',                    COALESCE(core_wound, ''),
          'origin_period',                  '',
          'deep_profile_dimensions_affected', '[]'::jsonb,
          'downstream_effects',             ''
        )
        WHERE core_wound IS NOT NULL AND core_wound != ''
          AND wound IS NULL;
      `);
    }

    // Migrate mask
    if (!desc.the_mask) {
      await queryInterface.sequelize.query(`
        UPDATE registry_characters
        SET the_mask = jsonb_build_object(
          'description',        COALESCE(mask_persona, ''),
          'divergence_map',     '[]'::jsonb,
          'feed_profile_is_mask', false
        )
        WHERE mask_persona IS NOT NULL AND mask_persona != ''
          AND the_mask IS NULL;
      `);
    }

    // Migrate living context
    if (!desc.living_state) {
      await queryInterface.sequelize.query(`
        UPDATE registry_characters
        SET living_state = living_context
        WHERE living_context IS NOT NULL
          AND living_state IS NULL;
      `);
    }

    console.log('✅ registry_characters column fix complete');
  },

  async down(_queryInterface) {
    // This is a corrective migration — down is a no-op
    // The original migrations handle their own down logic
  },
};
