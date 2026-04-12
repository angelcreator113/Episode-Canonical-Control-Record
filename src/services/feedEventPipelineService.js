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

const Anthropic = require('@anthropic-ai/sdk');

// ── MODELING & CAREER EVENT TYPES ────────────────────────────────────────────

const EVENT_TYPE_CONFIGS = {
  casting_call: {
    event_type: 'invite',
    prestige_range: [4, 7],
    venue_pool: [
      'Professional casting studio with white backdrop, director chairs, camera equipment, runway tape marks on floor',
      'Converted loft space in the garment district — exposed brick, industrial lighting, folding chairs, a line of girls who all look the same',
      'Boutique modeling agency boardroom — glass walls, portfolio books on the table, a casting director who never looks up from her phone',
      'Pop-up casting call in a rented hotel ballroom — velvet drapes, mirrors everywhere, tension you can taste',
      'Downtown studio with concrete floors and skylight — minimal, editorial, the kind of space that makes everyone look like a photograph',
    ],
    dress_code: 'model-off-duty chic',
    narrative_template: 'Lala has been called to audition. The room will be full of competition.',
  },
  runway: {
    event_type: 'invite',
    prestige_range: [6, 10],
    venue_pool: [
      'High-fashion runway venue with dramatic lighting, long catwalk, front row seating, backstage mirror stations',
      'Rooftop runway overlooking the city — sunset backdrop, wind machines, photographers hanging over the edge for the shot',
      'Underground warehouse turned runway — raw concrete, neon accents, bass-heavy music shaking the floor',
      'Museum gallery runway — walking through art installations, each look framed like a painting, silence except for heels',
      'Luxury hotel grand ballroom — chandeliers dimmed to spotlight, 200 seats, every seat filled with someone who matters',
    ],
    dress_code: 'runway — designer provides',
    narrative_template: 'The runway is the ultimate test. Everyone is watching. One walk changes everything.',
  },
  editorial: {
    event_type: 'brand_deal',
    prestige_range: [5, 9],
    venue_pool: [
      'Magazine editorial studio with professional lighting rigs, wardrobe racks, makeup stations, creative director mood boards',
      'Outdoor location shoot — golden hour on a rooftop garden, wind catching fabric, a photographer who speaks in whispers',
      'Vintage mansion rented for the day — every room a different set, wardrobe changes in hallways, champagne between takes',
      'Minimalist white studio with a single prop — a chair, a mirror, a flower. The creative director says "make it yours"',
      'Beachfront editorial shoot — sand in everything, sun too bright, but the images will be the most beautiful she\'s ever taken',
    ],
    dress_code: 'editorial — styled on set',
    narrative_template: 'A magazine wants Lala. The images will live forever. The pressure is permanent.',
  },
  campaign: {
    event_type: 'brand_deal',
    prestige_range: [5, 8],
    venue_pool: [
      'Brand campaign set with product displays, branded backdrop, professional photography setup, creative team workstations',
      'Penthouse suite converted to a content studio — brand products artfully scattered, ring lights in every corner',
      'Outdoor urban set — graffiti walls, vintage car, brand product in hand, the whole thing feels like a music video',
      'Clean modern studio — seamless paper backdrop, precise lighting, a creative director with a shot list and zero patience',
      'Brand pop-up experience space — interactive installations, neon signage, designed for content creation from every angle',
    ],
    dress_code: 'brand-aligned',
    narrative_template: 'A brand is betting on Lala\'s face. Deliver or lose the relationship.',
  },
  ambassador: {
    event_type: 'brand_deal',
    prestige_range: [7, 10],
    venue_pool: [
      'Exclusive brand ambassador launch event — luxury venue with brand installations, VIP lounge, press wall, champagne reception',
      'Private dinner at a Michelin-starred restaurant — 12 seats, the CEO across the table, every course paired with brand conversation',
      'Flagship store after-hours — the brand cleared the space for Lala, her name on the window, photographers waiting outside',
      'Yacht deck launch party — marina at sunset, select guest list, the brand\'s logo projected on the water',
      'Art gallery partnership reveal — her face on the wall next to the brand, press line, speeches, the contract weight in her purse',
    ],
    dress_code: 'brand signature',
    narrative_template: 'Ambassador status. This is long-term. Every appearance matters now.',
  },
  podcast: {
    event_type: 'invite',
    prestige_range: [3, 6],
    venue_pool: [
      'Intimate podcast studio with professional microphones, soundproofing panels, warm lighting, two comfortable chairs facing each other',
      'Host\'s living room — casual, a couch, two glasses of wine, the mic almost hidden. It feels like a conversation until you remember it\'s recorded',
      'Co-working space podcast booth — glass walls, people walking by, a timer counting down. 45 minutes to say something real',
      'Rooftop recording session — city noise in the background, golden hour, the host asks the question nobody else has asked',
      'Late-night studio session — dim lighting, jazz playing low, the host leans in and says "let\'s go deeper"',
    ],
    dress_code: 'camera-ready casual',
    narrative_template: 'An honest conversation. The audience will hear what Lala really thinks.',
  },
  interview: {
    event_type: 'invite',
    prestige_range: [4, 7],
    venue_pool: [
      'Press interview room with branded backdrop, professional lighting, journalist seating area, recorded for publication',
      'Magazine office — the editor\'s desk, a recorder between them, framed covers on every wall reminding Lala who\'s been here before',
      'Video interview set — two cameras, a teleprompter she won\'t use, a host who smiles but asks hard questions',
      'Coffee shop interview — casual but the journalist is taking notes, every sip of coffee is a pause she\'ll regret or be grateful for',
      'Backstage interview at an event — hair still done, adrenaline still up, a journalist catches her before the mask comes off',
    ],
    dress_code: 'polished professional',
    narrative_template: 'Every word will be quoted. The press shapes the narrative Lala can\'t control.',
  },
  award_show: {
    event_type: 'invite',
    prestige_range: [8, 10],
    venue_pool: [
      'Grand award ceremony venue with red carpet entrance, crystal chandeliers, stage with podium, celebrity seating, photographers pit',
      'Historic theater — velvet seats, gold leaf ceiling, a stage where legends have stood. Lala\'s seat is in the third row. For now.',
      'Modern glass venue — floor-to-ceiling windows, city lights as backdrop, the award is transparent crystal and weighs more than she expected',
      'Outdoor gala under the stars — string lights, a stage built over water, the walk to the podium is the longest walk of her life',
      'Intimate industry awards — only 100 people but every one of them decides careers. No cameras allowed. What happens here shapes the next year.',
    ],
    dress_code: 'red carpet — show-stopping',
    narrative_template: 'The biggest night. The red carpet. The cameras. This is what everything was building toward.',
  },
  social_event: {
    event_type: 'invite',
    prestige_range: [3, 7],
    venue_pool: [
      'Trendy social venue with creative decor, ambient lighting, photo-worthy installations, cocktail area',
      'Rooftop party — the city below, music too loud to think, everyone performing for each other\'s phones',
      'Art gallery opening — wine in plastic cups, conversations about meaning, creators pretending they came for the art',
      'Private members\' club — leather chairs, no phones allowed, the kind of quiet that costs money',
      'Beach bonfire gathering — sand between toes, someone brought a guitar, the influencers are barefoot and it\'s the most authentic they\'ve looked all year',
      'Warehouse party — converted industrial space, DJ in the corner, everyone arrived separately but the group photo will look like they planned it',
    ],
    dress_code: 'chic',
    narrative_template: 'A social gathering where connections are made and impressions are everything.',
  },
  brand_deal: {
    event_type: 'brand_deal',
    prestige_range: [4, 8],
    venue_pool: [
      'Brand activation space with product showcases, content creation stations, branded experiences, influencer photo moments',
      'Concept store takeover — the brand redesigned the space around Lala\'s aesthetic, her name on the door for one day only',
      'Studio shoot with full creative team — hair, makeup, styling, a shot list that leaves room for her ideas. Maybe.',
      'Brand headquarters tour — the design lab, the archive, the meeting where they show her the next collection before anyone else sees it',
      'Pop-up event — a branded experience that exists for 48 hours, designed for content, dismantled before anyone can get tired of it',
    ],
    dress_code: 'on-brand',
    narrative_template: 'Content creation with stakes. The brand is watching the metrics.',
  },
};

/**
 * Pick a random venue from the pool for an event type.
 */
function pickVenue(eventType) {
  const config = EVENT_TYPE_CONFIGS[eventType] || EVENT_TYPE_CONFIGS.social_event;
  const pool = config.venue_pool || [config.venue_theme || 'Exclusive venue'];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * AI-generate a unique venue description for a specific event.
 * Uses event name, host, prestige, and arc phase for context.
 * Falls back to random pool pick if AI unavailable.
 */
async function generateUniqueVenue(eventName, eventType, host, prestige, showId) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return pickVenue(eventType);

    // Get arc context for phase-aware venue generation
    let phaseContext = '';
    try {
      const { getArcContext } = require('./arcProgressionService');
      const arc = await getArcContext(showId, { sequelize: require('../models').sequelize });
      if (arc) {
        phaseContext = `\nSeason Phase: ${arc.current_phase.title} — ${arc.current_phase.tagline}
Emotional Temperature: ${arc.emotional_temperature}`;
      }
    } catch { /* skip */ }

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Write a ONE-SENTENCE venue description for this event in a luxury fashion life simulator:

Event: ${eventName}
Type: ${eventType.replace(/_/g, ' ')}
Host: ${host || 'unknown'}
Prestige: ${prestige}/10${phaseContext}

The venue should feel SPECIFIC and CINEMATIC — not generic. Include sensory details (lighting, sounds, textures, what you see when you walk in). Make it feel like a place that exists in one specific moment.

${prestige >= 8 ? 'This is HIGH PRESTIGE — exclusive, intimidating, the kind of place where your outfit is your resume.' : prestige >= 5 ? 'MID PRESTIGE — impressive but accessible, the kind of place where you can still be yourself if you\'re brave enough.' : 'INTIMATE — small, personal, the stakes are emotional not social.'}

Return ONLY the venue description, one sentence, no quotes.` }],
    });

    const venue = response.content[0]?.text?.trim();
    return venue || pickVenue(eventType);
  } catch {
    return pickVenue(eventType);
  }
}

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
            wardrobe: JSON.stringify({ dress_code: config.dress_code, venue_theme: pickVenue(opp.type) }),
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
  const venueTheme = await generateUniqueVenue(opp.name, opp.opportunity_type, opp.connector_handle, prestige, showId);
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

  // 3. Arc-aware narrative suggestions — phase determines event tier
  let arcPhase = null;
  let maxPrestige = 10;
  try {
    const { getArcContext } = require('./arcProgressionService');
    const arc = await getArcContext(showId, { sequelize });
    if (arc) {
      arcPhase = arc.current_phase;
      maxPrestige = arc.feed_behavior?.event_prestige_max || 10;
    }
  } catch { /* arc system not available */ }

  const phaseNum = arcPhase?.number || (episodeCount <= 8 ? 1 : episodeCount <= 16 ? 2 : 3);

  if (phaseNum === 1) {
    // Foundation — low-stakes, prove you belong
    if (episodeCount <= 2) {
      suggestions.push({ source: 'narrative', type: 'social_event', name: 'Introductory social gathering', prestige: 3,
        reason: 'Phase 1: Foundation — early episodes need low-stakes events to establish the world', action: 'create' });
    }
    if (episodeCount >= 3 && episodeCount <= 6) {
      suggestions.push({ source: 'narrative', type: 'casting_call', name: 'First audition — prove you belong', prestige: Math.min(5, maxPrestige),
        reason: `Phase 1: Foundation — time for Lala to test herself (max prestige ${maxPrestige})`, action: 'create' });
    }
    if (episodeCount >= 6) {
      suggestions.push({ source: 'narrative', type: 'podcast', name: 'First interview — tell your story', prestige: Math.min(4, maxPrestige),
        reason: 'Phase 1: Foundation — Lala needs to articulate who she is', action: 'create' });
    }
  } else if (phaseNum === 2) {
    // Ascension — competitive, climbing
    suggestions.push({ source: 'narrative', type: 'runway', name: 'Competitive runway — stakes are real now', prestige: Math.min(7, maxPrestige),
      reason: 'Phase 2: Ascension — the competition is real and everyone is watching', action: 'create' });
    suggestions.push({ source: 'narrative', type: 'campaign', name: 'Brand campaign — prove you can deliver', prestige: Math.min(6, maxPrestige),
      reason: 'Phase 2: Ascension — brands are testing Lala with real money', action: 'create' });
  } else {
    // Legacy — prestige events, building her own room
    suggestions.push({ source: 'narrative', type: 'award_show', name: 'Award show — the biggest stage', prestige: Math.min(9, maxPrestige),
      reason: 'Phase 3: Legacy — this is what everything was building toward', action: 'create' });
    suggestions.push({ source: 'narrative', type: 'social_event', name: 'Host your own event — build the room', prestige: Math.min(8, maxPrestige),
      reason: 'Phase 3: Legacy — stop entering rooms, start building them', action: 'create' });
  }

  return suggestions;
}

// ── EVENT CHAINING — SPAWN SEQUEL EVENTS FROM MOMENTUM ─────────────────────

/**
 * Chain a sequel event from a completed event based on feed engagement momentum.
 *
 * When an event generates strong feed engagement (viral posts, high momentum),
 * this function creates a follow-up event that narratively flows from the original.
 *
 * @param {string} parentEventId - The completed event that spawns a sequel
 * @param {object} chainConfig - { type, reason, suggested_prestige }
 * @param {string} showId
 * @param {object} models
 * @returns {object} The new chained event
 */
async function chainEventFromMomentum(parentEventId, chainConfig, showId, models) {
  const { sequelize } = models;

  // Load parent event
  const [parentRows] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :id AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { id: parentEventId, showId } }
  );
  const parent = parentRows?.[0];
  if (!parent) throw new Error('Parent event not found');

  const chainPosition = (parent.chain_position || 0) + 1;
  if (chainPosition > 5) throw new Error('Maximum chain depth reached (5 events)');

  const config = EVENT_TYPE_CONFIGS[chainConfig.type] || EVENT_TYPE_CONFIGS.social_event;
  const prestige = chainConfig.suggested_prestige || Math.min(10, (parent.prestige || 5) + 1);

  // Inherit and evolve guest list from parent
  let parentAuto = {};
  try {
    parentAuto = typeof parent.canon_consequences === 'string'
      ? JSON.parse(parent.canon_consequences)?.automation || {}
      : parent.canon_consequences?.automation || {};
  } catch { /* use empty */ }

  const guestProfiles = parentAuto.guest_profiles || [];

  // Create the chained event
  const eventId = uuidv4();
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7 + Math.floor(Math.random() * 14));

  const CHAIN_NARRATIVES = {
    brand_deal: `After the buzz from "${parent.name}", a brand wants to capitalize on Lala's momentum.`,
    interview: `Everyone's talking about "${parent.name}". An interviewer wants the real story.`,
    award_show: `"${parent.name}" put Lala on the radar. Now comes the invitation she's been waiting for.`,
    runway: `The fashion world noticed "${parent.name}". A designer wants Lala to walk.`,
    podcast: `The conversation from "${parent.name}" isn't over. Someone wants it on record.`,
    social_event: `The connections from "${parent.name}" led to a new circle. Time to show up again.`,
    casting_call: `A casting director saw the content from "${parent.name}". Lala got the call.`,
    campaign: `The viral moment from "${parent.name}" caught a creative director's eye.`,
  };

  const eventData = {
    id: eventId,
    show_id: showId,
    name: `${chainConfig.type.replace(/_/g, ' ')} (from ${parent.name})`.slice(0, 200),
    event_type: config.event_type,
    host: parent.host_brand || parent.host || 'Industry Connection',
    description: CHAIN_NARRATIVES[chainConfig.type] || `Follow-up to "${parent.name}" driven by feed momentum.`,
    prestige,
    cost_coins: prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50,
    strictness: Math.min(10, prestige + 1),
    deadline_type: prestige >= 8 ? 'urgent' : 'medium',
    dress_code: config.dress_code,
    location_hint: await generateUniqueVenue(`${chainConfig.type.replace(/_/g, ' ')} (from ${parent.name})`, chainConfig.type, parent.host, prestige, showId),
    narrative_stakes: chainConfig.reason || CHAIN_NARRATIVES[chainConfig.type],
    canon_consequences: JSON.stringify({
      automation: {
        source: 'event_chain',
        parent_event_id: parentEventId,
        parent_event_name: parent.name,
        chain_position: chainPosition,
        host_handle: parentAuto.host_handle || null,
        guest_profiles: guestProfiles.slice(0, 6),
        momentum_driven: true,
      },
    }),
    seeds_future_events: JSON.stringify([{
      type: 'momentum_chain',
      from_event: parent.name,
      reason: chainConfig.reason,
    }]),
    parent_event_id: parentEventId,
    chain_position: chainPosition,
    chain_reason: chainConfig.reason,
    momentum_score: 0,
    status: 'ready',
  };

  await sequelize.query(
    `INSERT INTO world_events (id, show_id, name, event_type, host, description,
     prestige, cost_coins, strictness, deadline_type, dress_code, location_hint,
     narrative_stakes, canon_consequences, seeds_future_events,
     parent_event_id, chain_position, chain_reason, momentum_score,
     status, created_at, updated_at)
     VALUES (:id, :show_id, :name, :event_type, :host, :description,
     :prestige, :cost_coins, :strictness, :deadline_type, :dress_code, :location_hint,
     :narrative_stakes, :canon_consequences, :seeds_future_events,
     :parent_event_id, :chain_position, :chain_reason, :momentum_score,
     :status, NOW(), NOW())`,
    { replacements: eventData }
  );

  // Update parent event's seeds_future_events
  try {
    const existingSeeds = typeof parent.seeds_future_events === 'string'
      ? JSON.parse(parent.seeds_future_events) || []
      : parent.seeds_future_events || [];
    existingSeeds.push({ chained_event_id: eventId, type: chainConfig.type, reason: chainConfig.reason });
    await sequelize.query(
      'UPDATE world_events SET seeds_future_events = :seeds, updated_at = NOW() WHERE id = :id',
      { replacements: { seeds: JSON.stringify(existingSeeds), id: parentEventId } }
    );
  } catch { /* non-critical */ }

  console.log(`[EventChain] Chained "${eventData.name}" (position ${chainPosition}) from "${parent.name}"`);

  return {
    event_id: eventId,
    name: eventData.name,
    type: chainConfig.type,
    prestige,
    chain_position: chainPosition,
    parent_event: parent.name,
    reason: chainConfig.reason,
  };
}

/**
 * Get the full event chain for a given event — parent, siblings, and children.
 */
async function getEventChain(eventId, showId, models) {
  const { sequelize } = models;

  // Find the root of the chain
  const [event] = await sequelize.query(
    'SELECT id, parent_event_id, chain_position FROM world_events WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: eventId } }
  );
  if (!event?.[0]) throw new Error('Event not found');

  let rootId = event[0].id;
  if (event[0].parent_event_id) {
    // Walk up to root
    let current = event[0];
    while (current.parent_event_id) {
      const [parent] = await sequelize.query(
        'SELECT id, parent_event_id, chain_position FROM world_events WHERE id = :id AND deleted_at IS NULL',
        { replacements: { id: current.parent_event_id } }
      );
      if (!parent?.[0]) break;
      current = parent[0];
    }
    rootId = current.id;
  }

  // Get entire chain from root
  const [chain] = await sequelize.query(
    `WITH RECURSIVE event_chain AS (
       SELECT id, name, event_type, prestige, status, chain_position, chain_reason,
              parent_event_id, momentum_score, created_at
       FROM world_events WHERE id = :rootId AND deleted_at IS NULL
       UNION ALL
       SELECT we.id, we.name, we.event_type, we.prestige, we.status, we.chain_position, we.chain_reason,
              we.parent_event_id, we.momentum_score, we.created_at
       FROM world_events we
       INNER JOIN event_chain ec ON we.parent_event_id = ec.id
       WHERE we.deleted_at IS NULL
     )
     SELECT * FROM event_chain ORDER BY chain_position ASC, created_at ASC`,
    { replacements: { rootId } }
  );

  return {
    root_event_id: rootId,
    chain_length: chain.length,
    events: chain,
  };
}

module.exports = {
  EVENT_TYPE_CONFIGS,
  pickVenue,
  generateUniqueVenue,
  generateOpportunitiesFromFeed,
  scheduleOpportunityAsEvent,
  suggestNextEvents,
  chainEventFromMomentum,
  getEventChain,
};
