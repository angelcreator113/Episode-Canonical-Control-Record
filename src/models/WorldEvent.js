'use strict';
const { DataTypes } = require('sequelize');

/**
 * WorldEvent Model — LalaVerse events (galas, brand deals, parties, dates).
 *
 * Previously managed via raw SQL. This model adds proper associations,
 * venue linking, invitation details, and guest list management.
 */
module.exports = (sequelize) => {
  const WorldEvent = sequelize.define('WorldEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    season_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    arc_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Identity
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    event_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'invite',
      comment: 'invite | upgrade | guest | fail_test | deliverable | brand_deal',
    },
    host: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Host character name or entity',
    },
    host_brand: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Maison Belle, Luxe Cosmetics, etc.',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── Venue & Location ──
    venue_location_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'world_locations', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to WorldLocation — the venue where this event takes place',
    },
    venue_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Display name: "Club Noir"',
    },
    venue_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Full address for invitation: "742 Ocean Drive, South Beach, Miami"',
    },
    location_hint: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descriptive text: "Parisian rooftop garden, golden hour"',
    },
    source_calendar_event_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'story_calendar_events', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'The cultural calendar event that spawned this world event',
    },
    scene_set_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'scene_sets', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Visual scene set for this event venue',
    },

    // ── Date & Time ──
    event_date: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Story date: "Friday, March 15th" or "Tonight"',
    },
    event_time: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Event time: "9:00 PM - 2:00 AM"',
    },

    // ── Guest List ──
    guest_list: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '[{ character_id, character_name, rsvp_status, plus_one }]',
    },

    // ── Invitation ──
    invitation_asset_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'assets', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Generated invitation card image',
    },
    invitation_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ tagline, rsvp_by, attire_note, special_instructions, hosted_by }',
    },

    // ── Scoring ──
    prestige: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: '1-10',
    },
    cost_coins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    strictness: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: '1-10',
    },
    deadline_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'medium',
    },
    deadline_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    dress_code: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    dress_code_keywords: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },

    // ── Narrative ──
    narrative_stakes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    canon_consequences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    seeds_future_events: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },

    // ── Production ──
    overlay_template: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'luxury_invite',
    },
    required_ui_overlays: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: ['MailPanel', 'InviteLetterOverlay', 'ToDoList'],
    },
    browse_pool_bias: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'balanced',
    },
    browse_pool_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 8,
    },
    rewards: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },

    // ── Career ──
    is_paid: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    payment_amount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    requirements: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    career_tier: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    career_milestone: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    fail_consequence: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    success_unlock: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── Status ──
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
      comment: 'draft | ready | used | archived',
    },
    used_in_episode_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    times_used: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  }, {
    tableName: 'world_events',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  WorldEvent.associate = (models) => {
    // Venue location
    if (models.WorldLocation) {
      WorldEvent.belongsTo(models.WorldLocation, {
        foreignKey: 'venue_location_id',
        as: 'venue',
      });
    }
    // Visual scene set
    if (models.SceneSet) {
      WorldEvent.belongsTo(models.SceneSet, {
        foreignKey: 'scene_set_id',
        as: 'sceneSet',
      });
    }
    // Invitation image
    if (models.Asset) {
      WorldEvent.belongsTo(models.Asset, {
        foreignKey: 'invitation_asset_id',
        as: 'invitationAsset',
      });
    }
    // Show
    if (models.Show) {
      WorldEvent.belongsTo(models.Show, {
        foreignKey: 'show_id',
        as: 'show',
      });
    }
    // Episode used in
    if (models.Episode) {
      WorldEvent.belongsTo(models.Episode, {
        foreignKey: 'used_in_episode_id',
        as: 'usedInEpisode',
      });
    }
    // Source cultural calendar event
    if (models.StoryCalendarEvent) {
      WorldEvent.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'source_calendar_event_id',
        as: 'sourceCalendarEvent',
      });
    }
  };

  return WorldEvent;
};
