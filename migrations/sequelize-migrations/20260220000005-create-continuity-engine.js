'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── continuity_timelines ──────────────────────────────────
    await queryInterface.createTable('continuity_timelines', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onDelete: 'SET NULL',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'Untitled Timeline',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      season_tag: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'locked'),
        defaultValue: 'draft',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // ── continuity_characters ─────────────────────────────────
    await queryInterface.createTable('continuity_characters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      timeline_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'continuity_timelines', key: 'id' },
        onDelete: 'CASCADE',
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#5b7fff',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // ── continuity_beats ──────────────────────────────────────
    await queryInterface.createTable('continuity_beats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      timeline_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'continuity_timelines', key: 'id' },
        onDelete: 'CASCADE',
      },
      beat_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      name: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      time_tag: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Episode/time label e.g. "Ep 03 · Evening · 7:30pm"',
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // ── continuity_beat_characters (join table) ───────────────
    await queryInterface.createTable('continuity_beat_characters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      beat_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'continuity_beats', key: 'id' },
        onDelete: 'CASCADE',
      },
      character_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'continuity_characters', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // ── Indexes ───────────────────────────────────────────────
    await queryInterface.addIndex('continuity_timelines', ['show_id'], { name: 'idx_continuity_timelines_show' });
    await queryInterface.addIndex('continuity_characters', ['timeline_id'], { name: 'idx_continuity_characters_timeline' });
    await queryInterface.addIndex('continuity_characters', ['timeline_id', 'character_key'], {
      name: 'idx_continuity_characters_timeline_key',
      unique: true,
    });
    await queryInterface.addIndex('continuity_beats', ['timeline_id'], { name: 'idx_continuity_beats_timeline' });
    await queryInterface.addIndex('continuity_beats', ['timeline_id', 'beat_number'], {
      name: 'idx_continuity_beats_timeline_num',
    });
    await queryInterface.addIndex('continuity_beat_characters', ['beat_id'], { name: 'idx_continuity_bc_beat' });
    await queryInterface.addIndex('continuity_beat_characters', ['character_id'], { name: 'idx_continuity_bc_char' });
    await queryInterface.addIndex('continuity_beat_characters', ['beat_id', 'character_id'], {
      name: 'idx_continuity_bc_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('continuity_beat_characters');
    await queryInterface.dropTable('continuity_beats');
    await queryInterface.dropTable('continuity_characters');
    await queryInterface.dropTable('continuity_timelines');
  },
};
