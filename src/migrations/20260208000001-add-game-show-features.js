'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Show Format Types - columns already exist, skip them
    // await queryInterface.addColumn('shows', 'show_format', {
    //   type: Sequelize.STRING(50),
    //   defaultValue: 'traditional',
    //   comment: 'traditional, game_show, interactive, documentary'
    // });

    // await queryInterface.addColumn('shows', 'format_config', {
    //   type: Sequelize.JSONB,
    //   defaultValue: {},
    //   comment: 'Format-specific configuration'
    // });

    // Example format_config for "Styling Adventures with Lala":
    // {
    //   layout_style: "twitch",
    //   player_character: "JustAWomanInHerPrime",
    //   ai_character: "Lala",
    //   interactive_elements: true,
    //   has_photoshoot_phase: true,
    //   ui_overlay_required: true
    // }

    // Interactive Elements (for game shows)
    await queryInterface.createTable('interactive_elements', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'CASCADE'
      },
      
      // Timing
      appears_at: {
        type: Sequelize.DECIMAL(10, 3),
        comment: 'When does this element appear in timeline'
      },
      disappears_at: {
        type: Sequelize.DECIMAL(10, 3)
      },
      
      // Element Type
      element_type: {
        type: Sequelize.STRING(50),
        comment: 'fashion_choice, prompt, poll, button, overlay'
      },
      
      // Content
      content: {
        type: Sequelize.JSONB,
        comment: 'Element-specific data'
      },
      // Example content for fashion_choice:
      // {
      //   prompt: "Choose your next outfit",
      //   options: [
      //     { id: 1, name: "Pink Sequin Dress", image_url: "...", price: 299 },
      //     { id: 2, name: "Black Jumpsuit", image_url: "...", price: 199 }
      //   ],
      //   timer_seconds: 30
      // }
      
      // Positioning
      screen_position: {
        type: Sequelize.JSONB,
        comment: 'Where on screen (x, y, width, height as percentages)'
      },
      
      // Style
      ui_style: {
        type: Sequelize.JSONB,
        comment: 'CSS-like styling for the element'
      },
      
      // Behavior
      requires_input: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Does this pause until user interacts?'
      },
      auto_advance_after: {
        type: Sequelize.INTEGER,
        comment: 'Auto-advance after N seconds if no input'
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

    // Layout Templates (for different show formats)
    await queryInterface.createTable('layout_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      show_id: {
        type: Sequelize.UUID,
        references: { model: 'shows', key: 'id' }
      },
      
      name: {
        type: Sequelize.STRING(255),
        comment: 'e.g., "Twitch Gameplay Layout", "Photoshoot Reveal Layout"'
      },
      
      // Layout Definition
      layout_type: {
        type: Sequelize.STRING(50),
        comment: 'twitch, split_screen, picture_in_picture, full_screen, cinematic'
      },
      
      regions: {
        type: Sequelize.JSONB,
        comment: 'Screen regions and what goes in them'
      },
      // Example regions for Twitch layout:
      // {
      //   main_feed: { x: 20, y: 10, width: 60, height: 70, content: "player_camera" },
      //   ui_panel_right: { x: 82, y: 10, width: 16, height: 80, content: "fashion_choices" },
      //   chat_overlay: { x: 2, y: 10, width: 16, height: 80, content: "live_chat" },
      //   bottom_bar: { x: 2, y: 82, width: 96, height: 16, content: "prompts" }
      // }
      
      // Transitions
      transition_in: {
        type: Sequelize.STRING(50),
        comment: 'How to transition into this layout'
      },
      transition_out: {
        type: Sequelize.STRING(50)
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

    // Phase Transitions (e.g., Gameplay → Photoshoot)
    await queryInterface.createTable('episode_phases', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'CASCADE'
      },
      
      phase_name: {
        type: Sequelize.STRING(100),
        comment: 'intro, gameplay, ai_interaction, photoshoot, outro'
      },
      
      // Timing
      start_time: {
        type: Sequelize.DECIMAL(10, 3)
      },
      end_time: {
        type: Sequelize.DECIMAL(10, 3)
      },
      
      // Layout
      layout_template_id: {
        type: Sequelize.UUID,
        references: { model: 'layout_templates', key: 'id' }
      },
      
      // Character Configuration
      active_characters: {
        type: Sequelize.JSONB,
        comment: 'Which characters are visible/active'
      },
      // Example:
      // {
      //   player: { visible: true, camera: "main_feed", control: "user" },
      //   ai: { visible: true, camera: "overlay", control: "system", mode: "fashion_advisor" }
      // }
      
      // Metadata
      phase_config: {
        type: Sequelize.JSONB,
        comment: 'Phase-specific settings'
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

    // AI Character Interactions
    await queryInterface.createTable('ai_interactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      episode_id: {
        type: Sequelize.UUID,
        references: { model: 'episodes', key: 'id' }
      },
      character_id: {
        type: Sequelize.UUID,
        references: { model: 'character_profiles', key: 'id' },
        comment: 'The AI character (e.g., Lala)'
      },
      
      // Timing
      trigger_time: {
        type: Sequelize.DECIMAL(10, 3),
        comment: 'When does AI activate'
      },
      
      // Interaction Type
      interaction_type: {
        type: Sequelize.STRING(50),
        comment: 'advice, challenge, feedback, system_message'
      },
      
      // Content
      ai_dialogue: {
        type: Sequelize.TEXT,
        comment: 'What AI says (can be text-to-speech)'
      },
      visual_treatment: {
        type: Sequelize.STRING(50),
        comment: 'hologram, screen_overlay, avatar, voice_only'
      },
      
      // Voice
      voice_sample_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Pre-recorded or synthesized voice'
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Indexes
    await queryInterface.addIndex('interactive_elements', ['episode_id', 'appears_at']);
    await queryInterface.addIndex('layout_templates', ['show_id']);
    await queryInterface.addIndex('episode_phases', ['episode_id', 'start_time']);
    await queryInterface.addIndex('ai_interactions', ['episode_id', 'trigger_time']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_interactions');
    await queryInterface.dropTable('episode_phases');
    await queryInterface.dropTable('layout_templates');
    await queryInterface.dropTable('interactive_elements');
    await queryInterface.removeColumn('shows', 'format_config');
    await queryInterface.removeColumn('shows', 'show_format');
  }
};
