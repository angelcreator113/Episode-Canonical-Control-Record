'use strict';

/**
 * Character Depth Engine v2 — 10 new depth dimensions
 * Adds body, money, time, luck/circumstance, self-narrative, blind spot,
 * change capacity, operative cosmology, foreclosed possibility, and joy
 * columns to registry_characters.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {

    // Helper — create ENUM type only if it doesn't exist yet
    async function ensureEnum(name, values) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT 1 FROM pg_type WHERE typname = :name`,
        { replacements: { name } }
      );
      if (rows.length === 0) {
        await queryInterface.sequelize.query(
          `CREATE TYPE "${name}" AS ENUM (${values.map(v => `'${v}'`).join(', ')})`
        );
      }
    }

    // ── ENUM types ──────────────────────────────────────────────────────────
    await ensureEnum('enum_body_relationship', ['currency','discipline','burden','stranger','home','evidence']);
    await ensureEnum('enum_money_behavior', ['hoarder','compulsive_giver','spend_to_feel','deprivation_guilt','control','performs_wealth','performs_poverty']);
    await ensureEnum('enum_money_class', ['poverty','working_class','middle_class','upper_middle','wealthy','ultra_wealthy']);
    await ensureEnum('enum_class_gap_direction', ['up','down','stable']);
    await ensureEnum('enum_time_orientation_de', ['past_anchored','future_oriented','present_impulsive','perpetual_waiter','cyclical']);
    await ensureEnum('enum_world_belief', ['random','rigged','effort','divine','strategy']);
    await ensureEnum('enum_blind_spot_cat_de', ['impact','pattern','motivation','strength','wound']);
    await ensureEnum('enum_change_capacity_de', ['highly_rigid','conditionally_open','cyclically_mobile','highly_fluid','fixed_by_choice']);
    await ensureEnum('enum_arc_function', ['arc','fixed','both']);
    await ensureEnum('enum_operative_cosmology_de', ['deserving','contractual','indifferent','relational','authored']);
    await ensureEnum('enum_joy_threat_response', ['fight','grieve','deny']);

    // ── Columns ─────────────────────────────────────────────────────────────
    const cols = [
      // Body
      ['de_body_relationship',    'enum_body_relationship'],
      ['de_body_currency',        Sequelize.INTEGER],
      ['de_body_control',         Sequelize.INTEGER],
      ['de_body_comfort',         Sequelize.INTEGER],
      ['de_body_history',         Sequelize.TEXT],

      // Money
      ['de_money_behavior',       'enum_money_behavior'],
      ['de_money_origin_class',   'enum_money_class'],
      ['de_money_current_class',  'enum_money_class'],
      ['de_class_gap_direction',  'enum_class_gap_direction'],
      ['de_money_wound',          Sequelize.TEXT],

      // Time
      ['de_time_orientation',     'enum_time_orientation_de'],
      ['de_time_wound',           Sequelize.TEXT],

      // Luck & Circumstance
      ['de_world_belief',         'enum_world_belief'],
      ['de_circumstance_advantages',   Sequelize.TEXT],
      ['de_circumstance_disadvantages', Sequelize.TEXT],
      ['de_luck_interpretation',  Sequelize.INTEGER],
      ['de_circumstance_wound',   Sequelize.TEXT],

      // Self-Narrative
      ['de_self_narrative_origin',         Sequelize.TEXT],
      ['de_self_narrative_turning_point',   Sequelize.TEXT],
      ['de_self_narrative_villain',         Sequelize.TEXT],
      ['de_actual_narrative_gap',           Sequelize.TEXT],  // AUTHOR ONLY
      ['de_therapy_target',                Sequelize.TEXT],

      // Blind Spot — AUTHOR ONLY
      ['de_blind_spot_category',       'enum_blind_spot_cat_de'],
      ['de_blind_spot',                Sequelize.TEXT],
      ['de_blind_spot_evidence',       Sequelize.TEXT],
      ['de_blind_spot_crack_condition', Sequelize.TEXT],

      // Change Capacity
      ['de_change_capacity',       'enum_change_capacity_de'],
      ['de_change_capacity_score', Sequelize.INTEGER],
      ['de_change_condition',      Sequelize.TEXT],
      ['de_change_witness',        Sequelize.TEXT],
      ['de_arc_function',          'enum_arc_function'],

      // Operative Cosmology
      ['de_operative_cosmology',   'enum_operative_cosmology_de'],
      ['de_stated_religion',       Sequelize.TEXT],
      ['de_cosmology_conflict',    Sequelize.TEXT],
      ['de_meaning_making_style',  Sequelize.TEXT],

      // Foreclosed Possibility
      ['de_foreclosed_possibilities',  Sequelize.JSONB],
      ['de_foreclosure_origins',       Sequelize.JSONB],
      ['de_foreclosure_visibility',    Sequelize.JSONB],
      ['de_crack_conditions',          Sequelize.JSONB],

      // Joy
      ['de_joy_trigger',           Sequelize.TEXT],
      ['de_joy_body_location',     Sequelize.TEXT],
      ['de_joy_origin',            Sequelize.TEXT],
      ['de_forbidden_joy',         Sequelize.TEXT],
      ['de_joy_threat_response',   'enum_joy_threat_response'],
      ['de_joy_current_access',    Sequelize.INTEGER],
    ];

    for (const [name, typeOrEnum] of cols) {
      try {
        const colDef = {
          allowNull: true,
          defaultValue: null,
        };

        if (typeof typeOrEnum === 'string') {
          // Custom ENUM — reference by name
          colDef.type = `"${typeOrEnum}"`;
          await queryInterface.sequelize.query(
            `ALTER TABLE "registry_characters" ADD COLUMN IF NOT EXISTS "${name}" "${typeOrEnum}"`
          );
        } else {
          colDef.type = typeOrEnum;
          await queryInterface.addColumn('registry_characters', name, colDef);
        }
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
      'de_body_relationship','de_body_currency','de_body_control','de_body_comfort','de_body_history',
      'de_money_behavior','de_money_origin_class','de_money_current_class','de_class_gap_direction','de_money_wound',
      'de_time_orientation','de_time_wound',
      'de_world_belief','de_circumstance_advantages','de_circumstance_disadvantages','de_luck_interpretation','de_circumstance_wound',
      'de_self_narrative_origin','de_self_narrative_turning_point','de_self_narrative_villain','de_actual_narrative_gap','de_therapy_target',
      'de_blind_spot_category','de_blind_spot','de_blind_spot_evidence','de_blind_spot_crack_condition',
      'de_change_capacity','de_change_capacity_score','de_change_condition','de_change_witness','de_arc_function',
      'de_operative_cosmology','de_stated_religion','de_cosmology_conflict','de_meaning_making_style',
      'de_foreclosed_possibilities','de_foreclosure_origins','de_foreclosure_visibility','de_crack_conditions',
      'de_joy_trigger','de_joy_body_location','de_joy_origin','de_forbidden_joy','de_joy_threat_response','de_joy_current_access',
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

    // Drop ENUM types
    const enums = [
      'enum_body_relationship','enum_money_behavior','enum_money_class',
      'enum_class_gap_direction','enum_time_orientation_de','enum_world_belief',
      'enum_blind_spot_cat_de','enum_change_capacity_de','enum_arc_function',
      'enum_operative_cosmology_de','enum_joy_threat_response',
    ];
    for (const name of enums) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${name}"`);
    }
  }
};
