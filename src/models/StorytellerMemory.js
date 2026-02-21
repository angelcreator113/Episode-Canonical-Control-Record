'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StorytellerMemory = sequelize.define(
    'StorytellerMemory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      line_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // Nullable — may be unassigned when first extracted
      character_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // goal | preference | relationship | belief | event | constraint | transformation
      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          isIn: {
            args: [[
              'goal',
              'preference',
              'relationship',
              'belief',
              'event',
              'constraint',
              'transformation',
            ]],
            msg: 'type must be one of: goal, preference, relationship, belief, event, constraint, transformation',
          },
        },
      },

      statement: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'statement cannot be empty' },
        },
      },

      // 0.000–1.000 — system-assigned confidence score from Claude extraction
      confidence: {
        type: DataTypes.DECIMAL(4, 3),
        allowNull: false,
        defaultValue: 0.0,
        validate: {
          min: 0,
          max: 1,
        },
      },

      // CRITICAL: false = inert (cannot drive synthesis)
      //           true  = active (feeds Character Registry + scene generation)
      confirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // If user edits the statement, flip this to true — system never overwrites
      protected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // voice | text | scene | manual
      source_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      source_ref: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      // JSON array of strings e.g. ["identity", "comparison", "style"]
      tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },

      // Set when user hits confirm — null if still inferred
      confirmed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'storyteller_memories',
      timestamps: true,
      underscored: true, // maps createdAt → created_at, updatedAt → updated_at
    }
  );

  // Associations — call from your main models/index.js associate block
  StorytellerMemory.associate = (models) => {
    // A memory belongs to the line it was extracted from
    StorytellerMemory.belongsTo(models.StorytellerLine, {
      foreignKey: 'line_id',
      as: 'line',
    });

    // A memory may belong to a character (can be null pre-assignment)
    if (models.RegistryCharacter) {
      StorytellerMemory.belongsTo(models.RegistryCharacter, {
        foreignKey: 'character_id',
        as: 'character',
      });
    }
  };

  return StorytellerMemory;
};
