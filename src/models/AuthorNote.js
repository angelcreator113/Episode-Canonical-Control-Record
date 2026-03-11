'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AuthorNote extends Model {
    static associate() {
      // Polymorphic — no DB-level FK constraints
    }
  }
  AuthorNote.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    entity_type: {
      type: DataTypes.ENUM(
        'feed_profile', 'character', 'entanglement',
        'calendar_event', 'relationship', 'crossing'
      ),
      allowNull: false,
    },
    entity_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    note_text: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    note_type: {
      type: DataTypes.ENUM('intent', 'watch', 'plant', 'amber_context', 'private'),
      allowNull: false,
    },
    visible_to_amber: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.ENUM('evoni', 'amber'),
      allowNull: false,
    },
  }, {
    sequelize,
    modelName:   'AuthorNote',
    tableName:   'author_notes',
    underscored: true,
    paranoid:    false,
  });
  return AuthorNote;
};
