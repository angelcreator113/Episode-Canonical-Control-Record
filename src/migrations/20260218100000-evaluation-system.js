/**
 * Migration: Episode Evaluation System
 * 
 * Creates:
 *   - character_state (running stat snapshot per character per show/season)
 *   - character_state_history (append-only ledger of all stat changes)
 *   - Adds evaluation_json, evaluation_status, formula_version to episodes
 * 
 * Location: src/migrations/20260218100000-evaluation-system.js
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ─── character_state ───
    await queryInterface.createTable('character_state', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: true, // null = global show-level stats
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'lala, justawoman, guest:<id>',
      },
      coins: {
        type: Sequelize.INTEGER,
        defaultValue: 500,
      },
      reputation: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: '0-10 scale',
      },
      brand_trust: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: '0-10 scale',
      },
      influence: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: '0-10 scale',
      },
      stress: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '0-10 scale',
      },
      last_applied_episode_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Unique constraint: one state per character per show per season
    await queryInterface.addIndex('character_state', ['show_id', 'season_id', 'character_key'], {
      unique: true,
      name: 'idx_character_state_unique',
      where: { season_id: { [Sequelize.Op.ne]: null } },
    }).catch(() => {
      // Partial unique index might not be supported, add regular unique
      return queryInterface.addIndex('character_state', ['show_id', 'character_key'], {
        unique: false,
        name: 'idx_character_state_lookup',
      });
    });

    await queryInterface.addIndex('character_state', ['character_key'], {
      name: 'idx_character_state_key',
    });

    // ─── character_state_history (append-only ledger) ───
    await queryInterface.createTable('character_state_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      character_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      evaluation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the evaluation snapshot on the episode',
      },
      source: {
        type: Sequelize.ENUM('computed', 'override', 'manual'),
        allowNull: false,
        defaultValue: 'computed',
      },
      deltas_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: '{"coins":-150,"reputation":1,"stress":1}',
      },
      state_after_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Snapshot of character state after applying deltas',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('character_state_history', ['episode_id'], {
      name: 'idx_csh_episode',
    });

    await queryInterface.addIndex('character_state_history', ['character_key', 'show_id'], {
      name: 'idx_csh_character_show',
    });

    await queryInterface.addIndex('character_state_history', ['created_at'], {
      name: 'idx_csh_created',
    });

    // ─── Add evaluation columns to episodes table ───
    const tableDesc = await queryInterface.describeTable('episodes');

    if (!tableDesc.evaluation_json) {
      await queryInterface.addColumn('episodes', 'evaluation_json', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Stores score, tier, style_scores, overrides, stat_deltas',
      });
    }

    if (!tableDesc.evaluation_status) {
      await queryInterface.addColumn('episodes', 'evaluation_status', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
        comment: 'null | computed | accepted',
      });
    }

    if (!tableDesc.formula_version) {
      await queryInterface.addColumn('episodes', 'formula_version', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'e.g. v1.0',
      });
    }

    console.log('✅ Evaluation system tables created');
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('episodes', 'evaluation_json').catch(() => {});
    await queryInterface.removeColumn('episodes', 'evaluation_status').catch(() => {});
    await queryInterface.removeColumn('episodes', 'formula_version').catch(() => {});
    await queryInterface.dropTable('character_state_history').catch(() => {});
    await queryInterface.dropTable('character_state').catch(() => {});
    console.log('✅ Evaluation system tables dropped');
  },
};
