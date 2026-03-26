'use strict';
module.exports = {
  up: async (queryInterface, _Sequelize) => {
    const cols = [

      // ── BODY ──────────────────────────────────────────────────
      ['body_relationship', Sequelize.TEXT],
      ['body_history', Sequelize.TEXT],
      ['body_currency', Sequelize.TEXT],
      ['body_control_pattern', Sequelize.TEXT],

      // ── MONEY ─────────────────────────────────────────────────
      ['money_behavior_pattern', Sequelize.ENUM(
        'hoarder','compulsive_giver','spends_to_feel_powerful',
        'deprives_out_of_guilt','uses_money_to_control',
        'performs_wealth','balanced','unknown'
      )],
      ['money_behavior_note', Sequelize.TEXT],

      // ── TIME ──────────────────────────────────────────────────
      ['time_orientation_v2', Sequelize.ENUM(
        'past_anchored','future_focused','present_impulsive',
        'suspended','cyclical','unknown'
      )],
      ['time_orientation_note', Sequelize.TEXT],

      // ── CHANGE ────────────────────────────────────────────────
      ['change_capacity_v2', Sequelize.ENUM(
        'rigid','slow','conditional','fluid','ready','unknown'
      )],
      ['change_conditions', Sequelize.TEXT],
      ['change_blocker', Sequelize.TEXT],

      // ── CIRCUMSTANCE ──────────────────────────────────────────
      ['circumstance_advantages', Sequelize.TEXT],
      ['circumstance_disadvantages', Sequelize.TEXT],
      ['luck_belief', Sequelize.ENUM(
        'merit_based','rigged','divinely_ordered','random',
        'relational','chaotic','unknown'
      )],
      ['luck_belief_vs_stated', Sequelize.TEXT],

      // ── SELF-NARRATIVE ────────────────────────────────────────
      // self_narrative already exists as TEXT — no re-add needed
      ['actual_narrative', Sequelize.TEXT],
      ['narrative_gap_type', Sequelize.ENUM(
        'villain_misidentified','hero_exaggerated','wound_mislocated',
        'cause_reversed','timeline_collapsed','significance_inverted',
        'none_yet','unknown'
      )],

      // ── BLIND SPOT ───────────────────────────────────────────
      // blind_spot already exists as TEXT — no re-add needed
      ['blind_spot_category', Sequelize.ENUM(
        'self_assessment','motivation','impact','pattern',
        'relationship','wound','unknown'
      )],
      // blind_spot_visible_to: array of character IDs who can see it
      ['blind_spot_visible_to', Sequelize.ARRAY(Sequelize.UUID)],

      // ── COSMOLOGY ─────────────────────────────────────────────
      ['operative_cosmology_v2', Sequelize.ENUM(
        'merit_based','rigged','divinely_ordered','random',
        'relational','unknown'
      )],
      ['cosmology_vs_stated_religion', Sequelize.TEXT],

      // ── FORECLOSED POSSIBILITY ────────────────────────────────
      ['foreclosed_category', Sequelize.ENUM(
        'love','safety','belonging','success','rest','joy',
        'visibility','being_known','being_chosen','starting_over',
        'none','unknown'
      )],
      ['foreclosure_origin', Sequelize.TEXT],
      ['foreclosure_vs_stated_want', Sequelize.TEXT],

      // ── JOY ───────────────────────────────────────────────────
      ['joy_source', Sequelize.TEXT],
      ['joy_accessibility', Sequelize.ENUM(
        'freely_accessible','conditional','buried','forgotten','unknown'
      )],
      ['joy_vs_ambition', Sequelize.TEXT],
    ];

    for (const [name, type] of cols) {
      try {
        await queryInterface.addColumn('registry_characters', name, {
          type,
          allowNull: true,
          defaultValue: null,
        });
      } catch (e) {
        // Column may already exist — skip gracefully
        if (e.message && e.message.includes('already exists')) {
          console.log(`  ↳ Column ${name} already exists, skipping`);
        } else {
          throw e;
        }
      }
    }
  },

  down: async (queryInterface, _Sequelize) => {
    const names = [
      'body_relationship','body_history','body_currency','body_control_pattern',
      'money_behavior_pattern','money_behavior_note',
      'time_orientation_v2','time_orientation_note',
      'change_capacity_v2','change_conditions','change_blocker',
      'circumstance_advantages','circumstance_disadvantages','luck_belief','luck_belief_vs_stated',
      'actual_narrative','narrative_gap_type',
      'blind_spot_category','blind_spot_visible_to',
      'operative_cosmology_v2','cosmology_vs_stated_religion',
      'foreclosed_category','foreclosure_origin','foreclosure_vs_stated_want',
      'joy_source','joy_accessibility','joy_vs_ambition',
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
