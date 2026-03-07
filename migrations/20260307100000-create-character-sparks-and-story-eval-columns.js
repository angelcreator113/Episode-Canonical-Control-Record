'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Create character_sparks table ──────────────────────────
    await queryInterface.createTable('character_sparks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      desire_line: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'What they want — one sentence',
      },
      wound: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'What broke them — one sentence',
      },
      prefill_result: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Claude Opus 4.5 pre-fill expansion (full character DNA)',
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'draft | prefilled | committed',
      },
      registry_character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Links to registry_characters once committed',
      },
      registry_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Target character registry',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // ── 2. Add evaluation + multi-agent columns to storyteller_stories ──
    const cols = [
      ['tone_dial',                    Sequelize.STRING(50)],
      ['characters_in_scene',          Sequelize.JSONB],
      ['registry_dossiers_used',       Sequelize.JSONB],
      ['scene_brief',                  Sequelize.TEXT],
      ['story_a',                      Sequelize.TEXT],
      ['story_b',                      Sequelize.TEXT],
      ['story_c',                      Sequelize.TEXT],
      ['evaluation_result',            Sequelize.JSONB],
      ['plot_memory_proposal',         Sequelize.JSONB],
      ['character_revelation_proposal', Sequelize.JSONB],
      ['registry_update_proposals',    Sequelize.JSONB],
      ['memory_confirmed_at',          Sequelize.DATE],
      ['written_back_at',              Sequelize.DATE],
      ['written_back_chapter_id',      Sequelize.UUID],
    ];

    for (const [col, type] of cols) {
      try {
        await queryInterface.addColumn('storyteller_stories', col, {
          type,
          allowNull: true,
        });
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
    }
  },

  async down(queryInterface) {
    const cols = [
      'tone_dial', 'characters_in_scene', 'registry_dossiers_used',
      'scene_brief', 'story_a', 'story_b', 'story_c',
      'evaluation_result', 'plot_memory_proposal',
      'character_revelation_proposal', 'registry_update_proposals',
      'memory_confirmed_at', 'written_back_at', 'written_back_chapter_id',
    ];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn('storyteller_stories', col);
      } catch (_) { /* ignore */ }
    }
    await queryInterface.dropTable('character_sparks');
  },
};
