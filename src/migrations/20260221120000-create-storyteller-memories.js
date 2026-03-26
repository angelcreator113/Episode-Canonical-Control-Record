'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storyteller_memories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },

      // Source — which line this memory was extracted from
      line_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'storyteller_lines',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },

      // Which character this memory belongs to (from registry_characters)
      // Nullable — a memory may be extracted before a character is assigned
      character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'registry_characters',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },

      // Memory classification
      // goal | preference | relationship | belief | event | constraint | transformation
      type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      // The memory expressed as a plain-language statement
      // e.g. "Frankie feels intimidated by Chloe — aspiration, not hostility"
      statement: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // 0.0–1.0 — how confident the system is in this extraction
      // Inferred by Claude API. User confirmation overrides to 1.0.
      confidence: {
        type: Sequelize.DECIMAL(4, 3),
        allowNull: false,
        defaultValue: 0.0,
      },

      // CRITICAL: Inferred memories are inert until confirmed.
      // confirmed = false → cannot trigger narrative synthesis
      // confirmed = true  → writes to Character Registry, can drive scene generation
      confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Whether the user manually edited the statement after extraction
      // If true, the system treats this as user-authored — never overwrites it
      protected: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Where the memory came from (mirrors storyteller_lines.source_type)
      // voice | text | scene | manual
      source_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      // Pointer back to the raw source — session timestamp, audio ref, etc.
      source_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      // Freeform tags for filtering and clustering
      // Stored as JSON array e.g. ["identity", "comparison", "relationship"]
      tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },

      // When the user confirmed this memory (null if still inferred)
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Index on line_id — primary access pattern: get all memories for a line
    await queryInterface.addIndex('storyteller_memories', ['line_id'], {
      name: 'idx_storyteller_memories_line_id',
    });

    // Index on character_id — fetch all memories for a character (Memory Bank panel)
    await queryInterface.addIndex('storyteller_memories', ['character_id'], {
      name: 'idx_storyteller_memories_character_id',
    });

    // Index on confirmed — fast filter for synthesis (only confirmed memories drive generation)
    await queryInterface.addIndex('storyteller_memories', ['confirmed'], {
      name: 'idx_storyteller_memories_confirmed',
    });

    // Composite — fetch confirmed memories for a specific character (most common query in Phase 2)
    await queryInterface.addIndex(
      'storyteller_memories',
      ['character_id', 'confirmed'],
      { name: 'idx_storyteller_memories_character_confirmed' }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('storyteller_memories');
  },
};
