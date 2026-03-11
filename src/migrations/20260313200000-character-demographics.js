'use strict';

/**
 * Character Demographics Layer
 * Adds 25 demographic columns to registry_characters:
 * identity, geography, class, family, education/career, physical, online presence.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const cols = [

      // ── IDENTITY ─────────────────────────────────────────────
      ['age', Sequelize.INTEGER],
      ['birth_year', Sequelize.INTEGER],
      ['cultural_background', Sequelize.TEXT],
      ['nationality', Sequelize.TEXT],
      ['first_language', Sequelize.TEXT],

      // ── GEOGRAPHY ────────────────────────────────────────────
      ['hometown', Sequelize.TEXT],
      ['current_city', Sequelize.ENUM(
        'nova_prime',
        'velour_city',
        'the_drift',
        'solenne',
        'cascade_row',
        'outside_lalaverse',
        'unknown'
      )],
      ['city_migration_history', Sequelize.TEXT],

      // ── CLASS ────────────────────────────────────────────────
      ['class_origin', Sequelize.ENUM(
        'poverty','working_class','lower_middle','middle_class',
        'upper_middle','wealthy','old_money','unknown'
      )],
      ['current_class', Sequelize.ENUM(
        'poverty','working_class','lower_middle','middle_class',
        'upper_middle','wealthy','old_money','unknown'
      )],
      ['class_mobility_direction', Sequelize.ENUM(
        'ascending','descending','stable','volatile','unknown'
      )],

      // ── FAMILY ───────────────────────────────────────────────
      ['family_structure', Sequelize.ENUM(
        'two_parents_intact',
        'single_mother',
        'single_father',
        'raised_by_grandparents',
        'raised_by_other_relatives',
        'blended_family',
        'foster_or_adopted',
        'effectively_alone',
        'unknown'
      )],
      ['parents_status', Sequelize.TEXT],
      ['sibling_position', Sequelize.ENUM(
        'only_child','oldest','middle','youngest','unknown'
      )],
      ['sibling_count', Sequelize.INTEGER],
      ['relationship_status', Sequelize.ENUM(
        'single','dating','committed','married','separated',
        'divorced','widowed','complicated','unknown'
      )],
      ['has_children', Sequelize.BOOLEAN],
      ['children_ages', Sequelize.TEXT],

      // ── EDUCATION & CAREER TIMELINE ───────────────────────────
      ['education_experience', Sequelize.TEXT],
      ['career_history', Sequelize.TEXT],
      ['years_posting', Sequelize.INTEGER],

      // ── PHYSICAL PRESENCE ────────────────────────────────────
      ['physical_presence', Sequelize.TEXT],
      // NOTE: voice_signature already exists as JSONB — using demographic_voice_signature
      ['demographic_voice_signature', Sequelize.TEXT],

      // ── ONLINE PRESENCE ──────────────────────────────────────
      ['platform_primary', Sequelize.ENUM(
        'lalaverse_main','multi_platform','live_first','archive_heavy','unknown'
      )],
      ['follower_tier', Sequelize.ENUM(
        'ghost','micro','mid','macro','mega','unknown'
      )],
    ];

    for (const [name, type] of cols) {
      try {
        await queryInterface.addColumn('registry_characters', name, {
          type, allowNull: true, defaultValue: null,
        });
      } catch (e) {
        if (e.message && e.message.includes('already exists')) {
          console.log(`  ↳ Column ${name} already exists, skipping`);
        } else {
          throw e;
        }
      }
    }
  },

  down: async (queryInterface) => {
    const names = [
      'age','birth_year','cultural_background','nationality','first_language',
      'hometown','current_city','city_migration_history',
      'class_origin','current_class','class_mobility_direction',
      'family_structure','parents_status','sibling_position','sibling_count',
      'relationship_status','has_children','children_ages',
      'education_experience','career_history','years_posting',
      'physical_presence','demographic_voice_signature',
      'platform_primary','follower_tier',
    ];
    for (const name of names) {
      try {
        await queryInterface.removeColumn('registry_characters', name);
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) {
          console.log(`  ↳ Column ${name} does not exist, skipping`);
        } else {
          throw e;
        }
      }
    }
  }
};
