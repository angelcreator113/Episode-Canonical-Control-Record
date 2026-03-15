// Migration: 20260315100000-texture-layer.js

module.exports = {
  up: async (queryInterface, Sequelize) => {

    await queryInterface.createTable('story_texture', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      story_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      character_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      registry_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      // ── Inner thought ─────────────────────────────────────────
      inner_thought_type: {
        type: Sequelize.ENUM('filed_thought', 'loud_secret', 'revision'),
        allowNull: true,
      },
      inner_thought_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Italicized interior insert. Appears after charged moment in story.',
      },
      inner_thought_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Conflict scene ────────────────────────────────────────
      conflict_eligible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      conflict_trigger: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The specific thing that started it 3 minutes ago.',
      },
      conflict_surface_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What they are arguing about on the surface.',
      },
      conflict_subtext: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What each character is actually fighting about underneath.',
      },
      conflict_silence_beat: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The moment where someone stops talking.',
      },
      conflict_resolution_type: {
        type: Sequelize.ENUM(
          'deflected', 'deferred', 'exploded', 'absorbed', 'weaponized'
        ),
        allowNull: true,
      },
      conflict_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Body narrator ─────────────────────────────────────────
      body_narrator_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What her body knows before she does.',
      },
      body_narrator_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Private moment ────────────────────────────────────────
      private_moment_eligible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True if this story is the chapter position point for a private moment.',
      },
      private_moment_setting: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      private_moment_held_thing: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What she is not doing yet. What she is waiting to do.',
      },
      private_moment_sensory_anchor: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'One specific physical detail. No metaphors.',
      },
      private_moment_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Full private moment. Ends without completing.',
      },
      private_moment_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Online self post ──────────────────────────────────────
      post_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What she posted. Sounds like confidence. Reader knows what is underneath.',
      },
      post_platform: {
        type: Sequelize.ENUM('instagram', 'tiktok', 'youtube', 'twitter'),
        allowNull: true,
      },
      post_audience_bestie: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How the bestie who felt seen received this post.',
      },
      post_audience_paying_man: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How the man who opened his wallet received this post.',
      },
      post_audience_competitive_woman: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How the woman who felt competitive received this post.',
      },
      post_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Bleed generator ───────────────────────────────────────
      bleed_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Story 47 only. Lala voice bleeding through JustAWoman narrative.',
      },
      bleed_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // ── Phone appearances ─────────────────────────────────────
      phone_appeared: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      phone_context: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'How the phone appeared in this story. Weight increases with each appearance.',
      },

      // ── Amber notes ───────────────────────────────────────────
      amber_notes: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'What Amber noticed. Array of { type, note } objects.',
      },
      amber_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // ── Assembly ──────────────────────────────────────────────
      fully_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True when author has confirmed all applicable texture layers.',
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('story_texture', ['character_key', 'story_number']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('story_texture');
  },
};
