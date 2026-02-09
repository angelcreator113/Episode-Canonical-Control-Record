'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // The Lala Formula Template
    await queryInterface.createTable('lala_episode_formulas', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' },
        unique: true
      },
      opening_ritual: {
        type: Sequelize.JSONB,
        defaultValue: {
          lala_line: "Bestie, come style me  I'm ready for a new slay. Logging in",
          emotional_vibe: null
        }
      },
      interruption: {
        type: Sequelize.JSONB,
        defaultValue: { type: null, content: null }
      },
      reveal: {
        type: Sequelize.JSONB,
        defaultValue: { event_theme: null, why_it_matters: null }
      },
      intention: {
        type: Sequelize.JSONB,
        defaultValue: { identity_stepping_into: null, how_she_wants_to_feel: null }
      },
      transformation: {
        type: Sequelize.JSONB,
        defaultValue: { outfit_vibe: null, accessory_vibe: null, shoe_energy: null, final_touch: null, signature_detail: null }
      },
      payoff: {
        type: Sequelize.JSONB,
        defaultValue: { fantasy_unlocked: null, emotion_affirmed: null, what_this_look_makes_you_feel: null }
      },
      invitation: {
        type: Sequelize.JSONB,
        defaultValue: { audience_action: null, call_to_action: null }
      },
      cliffhanger: {
        type: Sequelize.JSONB,
        defaultValue: { tease_for_next: null, hint_content: null }
      },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('lala_episode_timeline', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      episode_id: { type: Sequelize.UUID, references: { model: 'episodes', key: 'id' } },
      beats: { type: Sequelize.JSONB, defaultValue: [] },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('lala_micro_goals', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      episode_id: { type: Sequelize.UUID, references: { model: 'episodes', key: 'id' } },
      goal_category: { type: Sequelize.STRING(50) },
      goal_text: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING(50), defaultValue: 'active' },
      visible_to_audience: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('lala_friend_archetypes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      episode_id: { type: Sequelize.UUID, references: { model: 'episodes', key: 'id' } },
      archetype: { type: Sequelize.STRING(50) },
      character_name: { type: Sequelize.STRING(255) },
      dialogue_moments: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('lala_cash_grab_quests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      episode_id: { type: Sequelize.UUID, references: { model: 'episodes', key: 'id' } },
      quest_type: { type: Sequelize.STRING(100) },
      quest_text: { type: Sequelize.TEXT },
      coin_reward: { type: Sequelize.INTEGER },
      time_cost_seconds: { type: Sequelize.INTEGER },
      player_choice: { type: Sequelize.STRING(50) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.addIndex('lala_episode_formulas', ['episode_id']);
    await queryInterface.addIndex('lala_episode_timeline', ['episode_id']);
    await queryInterface.addIndex('lala_micro_goals', ['episode_id']);
    await queryInterface.addIndex('lala_friend_archetypes', ['episode_id']);
    await queryInterface.addIndex('lala_cash_grab_quests', ['episode_id']);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('lala_cash_grab_quests');
    await queryInterface.dropTable('lala_friend_archetypes');
    await queryInterface.dropTable('lala_micro_goals');
    await queryInterface.dropTable('lala_episode_timeline');
    await queryInterface.dropTable('lala_episode_formulas');
  }
};
