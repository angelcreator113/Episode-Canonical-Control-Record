'use strict';

/**
 * Feed-to-Event Pipeline Service
 *
 * Connects the full lifecycle:
 *   Feed Profiles → Opportunities → Events → Episodes
 *
 * 1. Scans feed profiles for opportunity triggers (brand deals, events, collabs)
 * 2. Auto-generates opportunities from feed activity
 * 3. Converts opportunities to fully-formed events with venue, guests, stakes
 * 4. Suggests events based on current narrative state
 */

const { v4: uuidv4 } = require('uuid');

// ── MODELING & CAREER EVENT TYPES ────────────────────────────────────────────

const EVENT_TYPE_CONFIGS = {
  casting_call: {
    event_type: 'invite',
    prestige_range: [4, 7],
    venue_theme: 'Professional casting studio with white backdrop, director chairs, camera equipment, runway tape marks on floor',
    dress_code: 'model-off-duty chic',
    narrative_template: 'Lala has been called to audition. The room will be full of competition.',
  },
  runway: {
    event_type: 'invite',
    prestige_range: [6, 10],
    venue_theme: 'High-fashion runway venue with dramatic lighting, long catwalk, front row seating, backstage mirror stations',
    dress_code: 'runway — designer provides',
    narrative_template: 'The runway is the ultimate test. Everyone is watching. One walk changes everything.',
  },
  editorial: {
    event_type: 'brand_deal',
    prestige_range: [5, 9],
    venue_theme: 'Magazine editorial studio with professional lighting rigs, wardrobe racks, makeup stations, creative director mood boards',
    dress_code: 'editorial — styled on set',
    narrative_template: 'A magazine wants Lala. The images will live forever. The pressure is permanent.',
  },
  campaign: {
    event_type: 'brand_deal',
    prestige_range: [5, 8],
    venue_theme: 'Brand campaign set with product displays, branded backdrop, professional photography setup, creative team workstations',
    dress_code: 'brand-aligned',
    narrative_template: 'A brand is betting on Lala\'s face. Deliver or lose the relationship.',
  },
  ambassador: {
    event_type: 'brand_deal',
    prestige_range: [7, 10],
    venue_theme: 'Exclusive brand ambassador launch event — luxury venue with brand installations, VIP lounge, press wall, champagne reception',
    dress_code: 'brand signature',
    narrative_template: 'Ambassador status. This is long-term. Every appearance matters now.',
  },
  podcast: {
    event_type: 'invite',
    prestige_range: [3, 6],
    venue_theme: 'Intimate podcast studio with professional microphones, soundproofing panels, warm lighting, two comfortable chairs facing each other',
    dress_code: 'camera-ready casual',
    narrative_template: 'An honest conversation. The audience will hear what Lala really thinks.',
  },
  interview: {
    event_type: 'invite',
    prestige_range: [4, 7],
    venue_theme: 'Press interview room with branded backdrop, professional lighting, journalist seating area, recorded for publication',
    dress_code: 'polished professional',
    narrative_template: 'Every word will be quoted. The press shapes the narrative Lala can\'t control.',
  },
  award_show: {
    event_type: 'invite',
    prestige_range: [8, 10],
    venue_theme: 'Grand award ceremony venue with red carpet entrance, crystal chandeliers, stage with podium, celebrity seating, photographers pit',
    dress_code: 'red carpet — show-stopping',
    narrative_template: 'The biggest night. The red carpet. The cameras. This is what everything was building toward.',
  },
  social_event: {
    event_type: 'invite',
    prestige_range: [3, 7],
    venue_theme: 'Trendy social venue with creative decor, ambient lighting, photo-worthy installations, cocktail area',
    dress_code: 'chic',
    narrative_template: 'A social gathering where connections are made and impressions are everything.',
  },
  brand_deal: {
    event_type: 'brand_deal',
    prestige_range: [4, 8],
    venue_theme: 'Brand activation space with product showcases, content creation stations, branded experiences, influencer photo moments',
    dress_code: 'on-brand',
    narrative_template: 'Content creation with stakes. The brand is watching the metrics.',
  },
};

// ── GENERATE OPPORTUNITIES FROM FEED PROFILES ────────────────────────────────

async function generateOpportunitiesFromFeed(showId, models) {
  const { sequelize } = models;
  const generated = [];

  // Get active feed profiles with high Lala relevance
  const [profiles] = await sequelize.query(
    `SELECT id, handle, display_name, platform, content_category, archetype,
            follower_tier, celebrity_tier, brand_partnerships, career_pressure,
            lala_relevance_score, follow_motivation
     FROM social_profiles
     WHERE status IN ('generated', 'finalized', 'crossed')
     AND lala_relevance_score >= 5
     ORDER BY lala_relevance_score DESC
     LIMIT 15`
  );

  // Get existing opportunities to avoid duplicates
  const [existingOpps] = await sequelize.query(
    `SELECT connector_handle, opportunity_type, name FROM opportunities
     WHERE show_id = :showId AND status NOT IN ('archived', 'declined', 'expired') AND deleted_at IS NULL`,
    { replacements: { showId } }
  );
  const existingSet = new Set(existingOpps.map(o => `${o.connector_handle}:${o.opportunity_type}`));

  // Also check existing events to avoid duplicate concepts
  const [existingEvents] = await sequelize.query(
    `SELECT name, host, event_type FROM world_events
     WHERE show_id = :showId AND status NOT IN ('archived') AND deleted_at IS NULL`,
    { replacements: { showId } }
  );
  const existingEventNames = new Set(existingEvents.map(e => e.name?.toLowerCase().trim()));
  const existingEventTypes = {};
  existingEvents.forEach(e => {
    const t = e.event_type || 'invite';
    existingEventTypes[t] = (existingEventTypes[t] || 0) + 1;
  });

  // Limit: max 2 of the same opportunity type active at once
  const oppTypeCounts = {};
  existingOpps.forEach(o => {
    oppTypeCounts[o.opportunity_type] = (oppTypeCounts[o.opportunity_type] || 0) + 1;
  });

  for (const profile of profiles) {
    const p = profile;
    const partnerships = typeof p.brand_partnerships === 'string' ? JSON.parse(p.brand_partnerships) : (p.brand_partnerships || []);

    // Determine what kind of opportunity this profile would generate
    const oppTypes = [];

    if (p.follower_tier === 'mega' || p.celebrity_tier === 'exclusive') {
      oppTypes.push({ type: 'award_show', reason: `${p.display_name || p.handle} is hosting a prestige event` });
    }
    if (p.content_category === 'fashion' || p.archetype === 'polished_curator') {
      oppTypes.push({ type: 'runway', reason: `${p.display_name || p.handle} is curating a fashion showcase` });
      oppTypes.push({ type: 'editorial', reason: `${p.display_name || p.handle} wants Lala for a fashion editorial` });
    }
    if (p.content_category === 'beauty') {
      oppTypes.push({ type: 'campaign', reason: `Beauty brand connected through ${p.handle}` });
    }
    if (partnerships.length > 0) {
      const brand = partnerships[0]?.brand || partnerships[0];
      oppTypes.push({ type: 'brand_deal', reason: `${brand} reached out through ${p.handle}` });
    }
    if (p.archetype === 'community_builder' || p.follow_motivation === 'relatability') {
      oppTypes.push({ type: 'podcast', reason: `${p.display_name || p.handle} invited Lala on their show` });
    }
    if (p.career_pressure === 'ahead') {
      oppTypes.push({ type: 'casting_call', reason: `Modeling agency noticed Lala through ${p.handle}'s network` });
    }

    // Create opportunities (skip duplicates, limit per type)
    for (const opp of oppTypes.slice(0, 1)) { // 1 opportunity per profile
      const key = `${p.handle}:${opp.type}`;
      if (existingSet.has(key)) continue;

      // Skip if already 2+ of this type active
      if ((oppTypeCounts[opp.type] || 0) >= 2) continue;

      // Skip if an event with similar name already exists
      const proposedName = `${p.display_name || p.handle}'s ${opp.type.replace(/_/g, ' ')}`;
      if (existingEventNames.has(proposedName.toLowerCase().trim())) continue;

      const config = EVENT_TYPE_CONFIGS[opp.type] || EVENT_TYPE_CONFIGS.social_event;
      const prestige = config.prestige_range[0] + Math.floor(Math.random() * (config.prestige_range[1] - config.prestige_range[0]));

      try {
        const oppId = uuidv4();
        await sequelize.query(
          `INSERT INTO opportunities (id, show_id, name, opportunity_type, category, status,
           brand_or_company, connector_profile_id, connector_handle, connection_story,
           prestige, narrative_stakes, what_lala_wants, wardrobe_brief,
           status_history, created_at, updated_at)
           VALUES (:id, :showId, :name, :type, :category, 'offered',
           :brand, :profileId, :handle, :story,
           :prestige, :stakes, :wants, :wardrobe,
           :history, NOW(), NOW())`,
          { replacements: {
            id: oppId, showId,
            name: `${p.display_name || p.handle}'s ${opp.type.replace(/_/g, ' ')}`,
            type: opp.type,
            category: p.content_category || 'fashion',
            brand: partnerships[0]?.brand || null,
            profileId: p.id,
            handle: p.handle,
            story: opp.reason,
            prestige,
            stakes: config.narrative_template,
            wants: `Prove herself in ${opp.type.replace(/_/g, ' ')}`,
            wardrobe: JSON.stringify({ dress_code: config.dress_code, venue_theme: config.venue_theme }),
            history: JSON.stringify([{ status: 'offered', date: new Date().toISOString(), note: opp.reason }]),
          } }
        );

        generated.push({
          id: oppId,
          name: `${p.display_name || p.handle}'s ${opp.type.replace(/_/g, ' ')}`,
          type: opp.type,
          connector: p.handle,
          prestige,
        });
        existingSet.add(key);
      } catch (err) {
        console.warn(`[FeedPipeline] Failed to create opportunity from ${p.handle}:`, err.message);
      }
    }
  }

  return generated;
}

// ── SCHEDULE OPPORTUNITY AS EVENT (ONE-CLICK) ────────────────────────────────

async function scheduleOpportunityAsEvent(opportunityId, showId, models) {
  const { sequelize } = models;

  // Load opportunity
  const [oppRows] = await sequelize.query(
    'SELECT * FROM opportunities WHERE id = :id AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { id: opportunityId, showId } }
  );
  const opp = oppRows?.[0];
  if (!opp) throw new Error('Opportunity not found');

  // Check if this opportunity already has an event
  if (opp.event_id) throw new Error(`This opportunity already has an event scheduled`);

  // Check if an event with the same name already exists
  const [dupeCheck] = await sequelize.query(
    `SELECT id, name FROM world_events WHERE show_id = :showId AND name = :name AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId, name: opp.name } }
  );
  if (dupeCheck?.length > 0) throw new Error(`An event named "${opp.name}" already exists`);

  const config = EVENT_TYPE_CONFIGS[opp.opportunity_type] || EVENT_TYPE_CONFIGS.social_event;
  const wardrobe = typeof opp.wardrobe_brief === 'string' ? JSON.parse(opp.wardrobe_brief) : (opp.wardrobe_brief || {});
  const venueTheme = wardrobe.venue_theme || config.venue_theme;
  const prestige = opp.prestige || config.prestige_range[0] + 2;

  // Find guest profiles from feed (connected to the host)
  let guestProfiles = [];
  if (opp.connector_profile_id) {
    try {
      const [guests] = await sequelize.query(
        `SELECT id, handle, display_name, platform, follower_tier
         FROM social_profiles
         WHERE id != :hostId AND status IN ('generated', 'finalized', 'crossed')
         AND lala_relevance_score >= 3
         ORDER BY RANDOM() LIMIT 6`,
        { replacements: { hostId: opp.connector_profile_id } }
      );
      guestProfiles = guests || [];
    } catch { /* skip */ }
  }

  // Generate event date (1-3 weeks from now)
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7 + Math.floor(Math.random() * 14));
  const eventDateStr = eventDate.toISOString().split('T')[0];
  const eventTime = prestige >= 7 ? '20:00' : prestige >= 4 ? '19:00' : '14:00';

  // Create the world event
  const eventId = uuidv4();
  const eventData = {
    id: eventId,
    show_id: showId,
    name: opp.name,
    event_type: config.event_type,
    host: opp.brand_or_company || opp.connector_handle || opp.name,
    host_brand: opp.brand_or_company || null,
    description: opp.narrative_stakes || config.narrative_template,
    prestige,
    cost_coins: prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50,
    strictness: Math.min(10, prestige + 1),
    deadline_type: prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low',
    dress_code: wardrobe.dress_code || config.dress_code,
    location_hint: venueTheme,
    narrative_stakes: opp.what_could_go_wrong || opp.narrative_stakes || config.narrative_template,
    canon_consequences: JSON.stringify({
      automation: {
        source: 'opportunity_pipeline',
        opportunity_id: opp.id,
        opportunity_type: opp.opportunity_type,
        host_handle: opp.connector_handle,
        host_display_name: opp.brand_or_company || opp.connector_handle,
        host_profile_id: opp.connector_profile_id,
        venue_theme: venueTheme,
        event_date: eventDateStr,
        event_time: eventTime,
        guest_profiles: guestProfiles.map(g => ({ id: g.id, handle: g.handle, display_name: g.display_name })),
        career_milestone: opp.career_milestone || null,
      },
    }),
    status: 'ready',
  };

  await sequelize.query(
    `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, description,
     prestige, cost_coins, strictness, deadline_type, dress_code, location_hint,
     narrative_stakes, canon_consequences, status, created_at, updated_at)
     VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :description,
     :prestige, :cost_coins, :strictness, :deadline_type, :dress_code, :location_hint,
     :narrative_stakes, :canon_consequences, :status, NOW(), NOW())`,
    { replacements: eventData }
  );

  // Update opportunity with event link
  await sequelize.query(
    `UPDATE opportunities SET event_id = :eventId, status = 'booked',
     status_history = status_history || :historyEntry::jsonb,
     updated_at = NOW() WHERE id = :oppId`,
    { replacements: {
      eventId, oppId: opp.id,
      historyEntry: JSON.stringify([{ status: 'booked', date: new Date().toISOString(), note: 'Scheduled as event' }]),
    } }
  );

  return { event_id: eventId, opportunity: opp, event_data: eventData, guests: guestProfiles.length };
}

// ── AI-SUGGEST EVENTS BASED ON NARRATIVE STATE ──────────────────────────────

async function suggestNextEvents(showId, models) {
  const { sequelize } = models;

  // Get current state
  const [episodes] = await sequelize.query(
    `SELECT COUNT(*) as count FROM episodes WHERE show_id = :showId AND deleted_at IS NULL`,
    { replacements: { showId } }
  );
  const episodeCount = parseInt(episodes[0]?.count) || 0;

  // Get active opportunities
  const [opps] = await sequelize.query(
    `SELECT id, name, opportunity_type, prestige, connector_handle, brand_or_company, status, narrative_stakes
     FROM opportunities WHERE show_id = :showId AND status IN ('offered', 'considering', 'booked') AND deleted_at IS NULL
     ORDER BY prestige DESC LIMIT 10`,
    { replacements: { showId } }
  );

  // Get career goals
  let goals = [];
  try {
    const [goalRows] = await sequelize.query(
      `SELECT title, type, target_metric, target_value, current_value
       FROM career_goals WHERE show_id = :showId AND status = 'active'
       ORDER BY type ASC LIMIT 5`,
      { replacements: { showId } }
    );
    goals = goalRows || [];
  } catch { /* table may not exist */ }

  // Build suggestions
  const suggestions = [];

  // 1. Active opportunities ready to schedule
  for (const opp of opps.filter(o => o.status === 'offered' || o.status === 'considering')) {
    suggestions.push({
      source: 'opportunity',
      type: opp.opportunity_type,
      name: opp.name,
      prestige: opp.prestige,
      reason: `${opp.connector_handle || opp.brand_or_company} is waiting for a response`,
      opportunity_id: opp.id,
      action: 'schedule',
    });
  }

  // 2. Goal-driven suggestions
  for (const goal of goals) {
    if (goal.target_metric === 'reputation' && episodeCount < 5) {
      suggestions.push({
        source: 'career_goal',
        type: 'social_event',
        name: `Networking event for "${goal.title}"`,
        prestige: 4,
        reason: `Build reputation toward goal: ${goal.title}`,
        action: 'create',
      });
    }
    if (goal.target_metric === 'coins') {
      suggestions.push({
        source: 'career_goal',
        type: 'brand_deal',
        name: `Brand deal to fund "${goal.title}"`,
        prestige: 5,
        reason: `Need income: $${goal.target_value - goal.current_value} remaining`,
        action: 'create',
      });
    }
  }

  // 3. Narrative arc suggestions based on episode count
  if (episodeCount <= 2) {
    suggestions.push({
      source: 'narrative',
      type: 'social_event',
      name: 'Introductory social gathering',
      prestige: 3,
      reason: 'Early episodes need low-stakes events to establish the world',
      action: 'create',
    });
  } else if (episodeCount >= 5 && episodeCount <= 7) {
    suggestions.push({
      source: 'narrative',
      type: 'casting_call',
      name: 'First modeling audition',
      prestige: 6,
      reason: 'Mid-season — time to raise the stakes with a career-defining moment',
      action: 'create',
    });
  }

  return suggestions;
}

module.exports = {
  EVENT_TYPE_CONFIGS,
  generateOpportunitiesFromFeed,
  scheduleOpportunityAsEvent,
  suggestNextEvents,
};
