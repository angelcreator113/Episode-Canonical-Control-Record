'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Opportunity extends Model {
    static associate(models) {
      if (models.Show) Opportunity.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
      if (models.Episode) Opportunity.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
      if (models.WorldEvent) Opportunity.belongsTo(models.WorldEvent, { foreignKey: 'event_id', as: 'event' });
      if (models.SocialProfile) Opportunity.belongsTo(models.SocialProfile, { foreignKey: 'connector_profile_id', as: 'connector' });
    }
  }

  Opportunity.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },

    // ── Core Identity ────────────────────────────────────────────────────
    name: { type: DataTypes.STRING(255), allowNull: false },              // "Velour Magazine Cover Shoot"
    opportunity_type: {
      type: DataTypes.STRING(50), allowNull: false,
      // modeling, runway, editorial, campaign, ambassador, brand_deal,
      // podcast, interview, panel, award_show, pr_gifting, casting_call
    },
    category: {
      type: DataTypes.STRING(50), allowNull: true,
      // fashion, beauty, lifestyle, luxury, entertainment, media, tech
    },

    // ── Pipeline Status ──────────────────────────────────────────────────
    status: {
      type: DataTypes.STRING(30), allowNull: false, defaultValue: 'offered',
      // offered → considering → negotiating → booked → preparing → active → completed → paid → archived
      // OR: offered → declined / offered → expired / booked → cancelled
    },
    status_history: { type: DataTypes.JSONB, defaultValue: [] },          // [{status, date, note}]

    // ── Who & Where ──────────────────────────────────────────────────────
    brand_or_company: { type: DataTypes.STRING(200), allowNull: true },   // "Velour Magazine", "Maison Belle"
    contact_name: { type: DataTypes.STRING(200), allowNull: true },       // "Creative Director"
    connector_profile_id: { type: DataTypes.INTEGER, allowNull: true },   // feed profile who connected Lala
    connector_handle: { type: DataTypes.STRING(100), allowNull: true },   // @handle of connector
    connection_story: { type: DataTypes.TEXT, allowNull: true },           // "Met at Nova Prime Fashion Week afterparty"
    venue_name: { type: DataTypes.STRING(200), allowNull: true },
    venue_address: { type: DataTypes.TEXT, allowNull: true },

    // ── Dates & Deadlines ────────────────────────────────────────────────
    offer_date: { type: DataTypes.DATEONLY, allowNull: true },
    response_deadline: { type: DataTypes.DATEONLY, allowNull: true },
    booking_date: { type: DataTypes.DATEONLY, allowNull: true },
    shoot_date: { type: DataTypes.DATEONLY, allowNull: true },            // the actual work day
    publish_date: { type: DataTypes.DATEONLY, allowNull: true },          // when it goes live/public

    // ── Financial ────────────────────────────────────────────────────────
    payment_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    payment_type: { type: DataTypes.STRING(50), allowNull: true },        // flat_fee, per_post, retainer, trade, unpaid
    payment_status: { type: DataTypes.STRING(30), defaultValue: 'pending' }, // pending, partial, paid, disputed
    expenses: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },        // travel, styling, etc.
    net_value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },       // payment - expenses

    // ── Requirements & Deliverables ──────────────────────────────────────
    deliverables: { type: DataTypes.JSONB, defaultValue: [] },            // [{type, description, due_date, completed}]
    wardrobe_brief: { type: DataTypes.JSONB, allowNull: true },           // {dress_code, brands_required, style_direction, provided_pieces}
    content_requirements: { type: DataTypes.JSONB, defaultValue: [] },    // [{platform, post_type, caption_approval, usage_rights}]
    exclusivity: { type: DataTypes.TEXT, allowNull: true },               // "No competing beauty brands for 90 days"

    // ── Prestige & Career Impact ─────────────────────────────────────────
    prestige: { type: DataTypes.INTEGER, defaultValue: 5 },               // 1-10
    career_impact: { type: DataTypes.TEXT, allowNull: true },             // "Opens doors to Paris Fashion Week"
    career_milestone: { type: DataTypes.STRING(200), allowNull: true },   // "First magazine cover"
    unlocks: { type: DataTypes.JSONB, defaultValue: [] },                 // [{type, description}] — what completing this opens up
    reputation_risk: { type: DataTypes.TEXT, allowNull: true },           // "Brand has controversial history"

    // ── Narrative Stakes ─────────────────────────────────────────────────
    narrative_stakes: { type: DataTypes.TEXT, allowNull: true },
    what_lala_wants: { type: DataTypes.TEXT, allowNull: true },           // "Prove she belongs in high fashion"
    what_could_go_wrong: { type: DataTypes.TEXT, allowNull: true },       // "Underprepared, compared to supermodels"
    emotional_arc: { type: DataTypes.STRING(100), allowNull: true },      // "anxiety → confidence → validation"

    // ── Season & Calendar ────────────────────────────────────────────────
    season: { type: DataTypes.STRING(50), allowNull: true },              // "FW26", "SS27", "Holiday 2026"
    calendar_window: { type: DataTypes.STRING(100), allowNull: true },    // "Fashion Week", "Award Season"

    // ── Linked Episode ───────────────────────────────────────────────────
    event_id: { type: DataTypes.UUID, allowNull: true },                  // world event if created
    episode_id: { type: DataTypes.UUID, allowNull: true },                // episode if produced

    // ── Feed Impact ──────────────────────────────────────────────────────
    feed_reactions: { type: DataTypes.JSONB, defaultValue: [] },          // [{profile_handle, reaction_type, content}]
    social_boost: { type: DataTypes.INTEGER, defaultValue: 0 },           // estimated follower gain
    content_generated: { type: DataTypes.JSONB, defaultValue: [] },       // [{type, platform, content}] — posts from this opp
  }, {
    sequelize,
    modelName: 'Opportunity',
    tableName: 'opportunities',
    underscored: true,
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  return Opportunity;
};
