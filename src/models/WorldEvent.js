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
    // venue_location_id, venue_name, venue_address — migration 20260709 (may not exist)
    // source_calendar_event_id — migration 20260711 (may not exist)
    // opportunity_id — migration 20260719 (may not exist)
    location_hint: { type: DataTypes.TEXT, allowNull: true },
    scene_set_id: { type: DataTypes.UUID, allowNull: true },

    // ── Timeline ──
    // event_date, event_time, guest_list — migration 20260709 (may not exist)

    // ── Invitation ──
    invitation_asset_id: { type: DataTypes.UUID, allowNull: true },
    // invitation_details — migration 20260709 (may not exist)

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
      defaultValue: ['MailPanel', 'InviteLetterOverlay', 'WardrobeList', 'CareerList'],
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

    // ── Event chaining (added by migration 20260723000000) ──
    parent_event_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Links to the event that spawned this one (event chaining)',
    },
    chain_position: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Position in event chain (0=origin, 1=first sequel, etc.)',
    },
    chain_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Narrative explanation of why this event was spawned',
    },
    momentum_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
      comment: 'Cumulative score from feed engagement that influenced this event',
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
    // WorldLocation venue — venue_location_id column may not exist (migration 20260709)
    // Opportunity reverse link — opportunity_id column may not exist (migration 20260719)
    // These associations are disabled until migrations run on the DB

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
    // Source calendar event — source_calendar_event_id may not exist (migration 20260711)

    // Event chaining — self-referencing (migration 20260723)
    WorldEvent.belongsTo(models.WorldEvent, {
      foreignKey: 'parent_event_id',
      as: 'parentEvent',
    });
    WorldEvent.hasMany(models.WorldEvent, {
      foreignKey: 'parent_event_id',
      as: 'childEvents',
    });
  };

  return WorldEvent;
};
