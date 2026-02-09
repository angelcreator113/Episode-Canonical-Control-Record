'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table already exists
    const tableExists = await queryInterface.tableExists('lala_episode_formulas');
    if (tableExists) {
      console.log('lala_episode_formulas table already exists, skipping creation');
      return;
    }

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
      
      // 1. OPENING RITUAL (Brand Anchor)
      opening_ritual: {
        type: Sequelize.JSONB,
        defaultValue: {
          lala_line: "Bestie, come style me — I'm ready for a new slay. Logging in…",
          emotional_vibe: null // confidence, softness, power, romance, reset, glow-up
        }
      },
      
      // 2. THE INTERRUPTION (Story Trigger)
      interruption: {
        type: Sequelize.JSONB,
        defaultValue: {
          type: null, // invitation, message, challenge, quest, realization
          content: null
        }
      },
      
      // 3. THE REVEAL (Adventure Begins)
      reveal: {
        type: Sequelize.JSONB,
        defaultValue: {
          event_theme: null,
          why_it_matters: null
        }
      },
      
      // 4. THE INTENTION (Identity)
      intention: {
        type: Sequelize.JSONB,
        defaultValue: {
          identity_stepping_into: null,
          how_she_wants_to_feel: null
        }
      },
      
      // 5. TRANSFORMATION LOOP (Core Gameplay)
      transformation: {
        type: Sequelize.JSONB,
        defaultValue: {
          outfit_vibe: null,
          accessory_vibe: null,
          shoe_energy: null,
          final_touch: null,
          signature_detail: null
        }
      },
      
      // 6. THE PAYOFF (Mirror the Viewer)
      payoff: {
        type: Sequelize.JSONB,
        defaultValue: {
          fantasy_unlocked: null,
          emotion_affirmed: null,
          what_this_look_makes_you_feel: null
        }
      },
      
      // 7. THE INVITATION (Soft Conversion)
      invitation: {
        type: Sequelize.JSONB,
        defaultValue: {
          audience_action: null, // style_own_version, comment, shop, join_next
          call_to_action: null
        }
      },
      
      // 8. THE CLIFFHANGER (Return Loop)
      cliffhanger: {
        type: Sequelize.JSONB,
        defaultValue: {
          tease_for_next: null,
          hint_content: null
        }
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Episode Timeline Structure (from your template)
    await queryInterface.createTable('lala_episode_timeline', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' }
      },
      
      // Timeline Beats (in order)
      beats: {
        type: Sequelize.JSONB,
        defaultValue: [
          {
            beat_name: 'stream_open',
            duration_min: 1,
            duration_max: 2,
            layout: 'twitch',
            music: 'instrumental_low',
            ui_elements: ['coins', 'mail', 'todo', 'bestie_news'],
            lala_state: 'idle',
            player_control: 'full',
            content: {
              host_welcome: null,
              recap_last_episode: null,
              vibe_setter: null
            }
          },
          {
            beat_name: 'inciting_moment',
            duration_min: 1,
            duration_max: 1,
            layout: 'twitch',
            music: 'instrumental_low',
            trigger_type: null,
            content: {
              message_content: null,
              event_established: null,
              stakes: null
            },
            micro_goals_activated: ['personal', 'friendship', 'career']
          },
          {
            beat_name: 'todo_list_styling_intent',
            duration_min: 1,
            duration_max: 1,
            layout: 'twitch',
            music: 'instrumental_low',
            content: {
              todo_items: [],
              styling_energy: null,
              outfit_rules: ['owned', 'gifted', 'brand_promoted']
            }
          },
          {
            beat_name: 'styling_gameplay',
            duration_min: 3,
            duration_max: 4,
            layout: 'twitch',
            music: 'instrumental_low',
            player_control: 'full',
            styling_items: [],
            audience_interaction: true
          },
          {
            beat_name: 'cash_grab_quest',
            duration_min: 0.5,
            duration_max: 1,
            layout: 'twitch',
            music: 'instrumental_low',
            optional: true,
            quest_options: [],
            player_choice: null
          },
          {
            beat_name: 'final_check_handoff',
            duration_min: 1,
            duration_max: 1,
            layout: 'twitch_to_cinematic',
            music: 'instrumental_fade',
            content: {
              outfit_recap: null,
              audience_address: null,
              lock_in_moment: null
            },
            player_control: 'lost'
          },
          {
            beat_name: 'event_mode',
            duration_min: 2,
            duration_max: 3,
            layout: 'cinematic',
            music: 'instrumental_cinematic',
            lala_state: 'autonomous',
            player_control: 'none',
            friend_archetypes: [],
            no_pauses: true
          },
          {
            beat_name: 'outcome_summary',
            duration_min: 0.5,
            duration_max: 0.5,
            layout: 'cinematic',
            music: 'instrumental_soft',
            content: {
              coins_change: null,
              reputation_shift: null,
              relationship_movement: null,
              brand_interest: null
            }
          },
          {
            beat_name: 'screenplay_moment',
            duration_min: 0.75,
            duration_max: 1,
            layout: 'full_cinematic',
            music: 'vocals',
            ui_elements: [],
            visuals_only: true,
            content_type: null
          },
          {
            beat_name: 'cliffhanger_tag',
            duration_min: 0.5,
            duration_max: 0.5,
            layout: 'twitch',
            music: 'instrumental_resume',
            content: {
              new_trigger: null,
              lala_reaction: null,
              player_reaction: null
            }
          },
          {
            beat_name: 'end_screen',
            duration_min: 0.5,
            duration_max: 0.5,
            layout: 'end_card',
            music: 'instrumental_brief',
            content: {
              subscribe_reminder: true,
              next_tease: null
            }
          }
        ]
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Micro Goals System
    await queryInterface.createTable('lala_micro_goals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' }
      },
      
      goal_category: {
        type: Sequelize.STRING(50),
        comment: 'personal, friendship, career'
      },
      
      goal_text: {
        type: Sequelize.TEXT
      },
      
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'active',
        comment: 'active, achieved, failed, deferred'
      },
      
      visible_to_audience: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Friend Archetypes
    await queryInterface.createTable('lala_friend_archetypes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' }
      },
      
      archetype: {
        type: Sequelize.STRING(50),
        comment: 'believer, grounder, instigator, opportunist'
      },
      
      character_name: {
        type: Sequelize.STRING(255)
      },
      
      dialogue_moments: {
        type: Sequelize.JSONB,
        comment: 'Pre-written dialogue for event mode'
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Cash Grab Quests
    await queryInterface.createTable('lala_cash_grab_quests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' }
      },
      
      quest_type: {
        type: Sequelize.STRING(100),
        comment: 'answer_comments, post_story, mention_brand, go_live'
      },
      
      quest_text: {
        type: Sequelize.TEXT
      },
      
      coin_reward: {
        type: Sequelize.INTEGER
      },
      
      time_cost_seconds: {
        type: Sequelize.INTEGER
      },
      
      player_choice: {
        type: Sequelize.STRING(50),
        comment: 'accept, reject, extension'
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Indexes
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
