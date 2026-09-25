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
    // category/format — Evoni's taxonomy ruling, 2026-09-22
    // (docs/EVENT_EPISODE_FLOW.md §8(k)/(l)). Nullable, no default, no
    // backfill on existing rows. isIn is skipped by Sequelize on a null
    // value when allowNull is true (node_modules/sequelize/lib/instance-
    // validator.js's _singleAttrValidate), so existing NULL rows are safe.
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'fashion | social | brunch_dining | beauty_wellness | creator_brand | arts_entertainment | luxury_prestige | community_local | travel_destination | personal_relationship',
      validate: {
        isIn: [['fashion', 'social', 'brunch_dining', 'beauty_wellness', 'creator_brand', 'arts_entertainment', 'luxury_prestige', 'community_local', 'travel_destination', 'personal_relationship']],
      },
    },
    format: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'cocktail_party | garden_soiree | gallery_opening | gala | brunch | concert | brand_launch | premiere',
      validate: {
        isIn: [['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere']],
      },
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
    // venue_location_id, venue_name, venue_address — migration 20260709.
    // Confirmed present in the 2026-09-17 canon capture
    // (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt: uuid /
    // character varying(200) / character varying(255), all nullable,
    // matching the migration's own addColumn calls exactly) — declared
    // here rather than left as a "may not exist" hedge (Task #1646).
    venue_location_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to WorldLocation — the venue where this event takes place',
    },
    venue_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Display name: "Club Noir" (may differ from WorldLocation name)',
    },
    venue_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Full address for invitation: "742 Ocean Drive, South Beach, Miami"',
    },
    // source_calendar_event_id — migration 20260711 (may not exist)
    // opportunity_id — migration 20260719. Confirmed present in the
    // 2026-09-17 canon capture (uuid, nullable) and declared here (Task
    // #1814): convertOpportunityToEvent passes it to WorldEvent.create,
    // which dropped it silently while the column was undeclared.
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'The opportunity this event was created from, when there was one',
    },
    location_hint: { type: DataTypes.TEXT, allowNull: true },
    scene_set_id: { type: DataTypes.UUID, allowNull: true },

    // ── Timeline ──
    // event_date, event_time — migration 20260709. Confirmed present in the
    // 2026-09-17 canon capture (character varying(50), nullable, matching
    // the migration exactly) — declared here rather than left as a "may
    // not exist" hedge (Task #1646). guest_list stays hedged below;
    // out of this task's scope.
    event_date: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Story date of the event: "Friday, March 15th" or "Tonight at 9pm"',
    },
    event_time: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Event time: "9:00 PM - 2:00 AM"',
    },
    // guest_list — migration 20260709 (may not exist)

    // ── Invitation ──
    invitation_asset_id: { type: DataTypes.UUID, allowNull: true },
    // Invitation style (Task #1870). Migration 20260703000000 added these
    // five columns and the 2026-09-17 canon capture has them (varchar /
    // jsonb, nullable). The model did not declare them, so Sequelize dropped
    // them from every WorldEvent.create — POST /events/from-profile sent
    // them and only the canon_consequences.automation copy was stored.
    theme: { type: DataTypes.STRING(100), allowNull: true },
    mood: { type: DataTypes.STRING(100), allowNull: true },
    color_palette: { type: DataTypes.JSONB, allowNull: true },
    floral_style: { type: DataTypes.STRING(50), allowNull: true },
    border_style: { type: DataTypes.STRING(50), allowNull: true },
    // invitation_details — migration 20260709 (may not exist)

    // ── Feed Origin ──
    // FK to social_profiles when this event was spawned via
    // POST /world/:showId/events/from-profile. Mirrors the value buried in
    // canon_consequences.automation.host_profile_id but is queryable, so
    // joins, dashboards, and downstream services don't have to extract from
    // JSONB. Migration 20260807; nullable for events created any other way.
    source_profile_id: { type: DataTypes.INTEGER, allowNull: true },

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

    // ── Wardrobe ──
    // Outfit chosen when the event is created. The episode reads this
    // through used_in_episode_id so creators only pick wardrobe once
    // (on the event) and every episode that uses the event inherits it.
    outfit_set_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    outfit_pieces: {
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
    // Access requirements — what Lala must have to take part (today:
    // reputation_min, brand_trust_min, coins_min). One of the four kinds of
    // term (docs/EVENT_EPISODE_FLOW.md §8(t) item 1); never holds
    // deliverables or restrictions.
    requirements: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    // Restrictions — what Lala agrees not to do, [{type, description}]
    // (Task #1814, migration 20260924000000). Deliverables live in
    // event_deliverables (EventDeliverable.js); compensation is is_paid /
    // payment_amount above.
    restrictions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
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
    // Opportunity reverse link — opportunity_id is declared above (Task
    // #1814); no association is added here, nothing reads through one yet.
    // Deliverables — EventDeliverable.belongsTo(WorldEvent) (Task #1814).

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
    // Source feed profile — durable FK alongside the legacy JSONB copy in
    // canon_consequences.automation.host_profile_id (migration 20260807).
    if (models.SocialProfile) {
      WorldEvent.belongsTo(models.SocialProfile, {
        foreignKey: 'source_profile_id',
        as: 'sourceProfile',
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

  // Every field this model declared before Task #1640 added category/format
  // (2026-09-22), plus venue_location_id/venue_name/venue_address/
  // event_date/event_time (Task #1646, confirmed against the 2026-09-17
  // canon capture and moved out of the undeclared "may not exist" set —
  // see those fields' declarations above), plus the three Sequelize-
  // managed timestamp columns. An unrestricted findAll/findOne/findByPk
  // (no `attributes` option) already only selects the model's own declared
  // fields, not every world_events column — this file's own comments
  // document several migrated columns deliberately left undeclared for
  // exactly this reason ("may not exist"). category/format are the two
  // newest such columns still excluded here — deliberately, not an
  // oversight, so call sites that pass this constant as `attributes` keep
  // returning exactly what they always have without requesting the two
  // columns a not-yet-migrated database won't have yet.
  // theme/mood/color_palette/floral_style/border_style (Task #1870) are
  // included: all five are in the 2026-09-17 canon capture.
  // restrictions and opportunity_id (Task #1814) ARE included:
  // opportunity_id is in the 2026-09-17 canon capture, and restrictions
  // arrives with migration 20260924000000, which both deploy workflows run
  // (sequelize-cli db:migrate) before the app restarts. If that migration
  // has not run, model reads of world_events fail on the missing column
  // (the list route then falls back to raw SQL) — the migration must land
  // with this code.
  WorldEvent.CURRENT_ATTRIBUTES = [
    'id', 'show_id', 'season_id', 'arc_id', 'name', 'event_type',
    'host', 'host_brand', 'description', 'location_hint', 'scene_set_id',
    'venue_location_id', 'venue_name', 'venue_address', 'event_date', 'event_time',
    'invitation_asset_id', 'theme', 'mood', 'color_palette', 'floral_style',
    'border_style', 'source_profile_id', 'prestige', 'cost_coins',
    'strictness', 'deadline_type', 'deadline_minutes', 'dress_code',
    'dress_code_keywords', 'outfit_set_id', 'outfit_pieces',
    'narrative_stakes', 'canon_consequences', 'seeds_future_events',
    'overlay_template', 'required_ui_overlays', 'browse_pool_bias',
    'browse_pool_size', 'rewards', 'is_paid', 'payment_amount',
    'requirements', 'restrictions', 'opportunity_id', 'career_tier',
    'career_milestone', 'fail_consequence', 'success_unlock', 'status',
    'used_in_episode_id', 'times_used',
    'parent_event_id', 'chain_position', 'chain_reason', 'momentum_score',
    'created_at', 'updated_at', 'deleted_at',
  ];

  return WorldEvent;
};
