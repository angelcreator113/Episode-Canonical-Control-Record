'use strict';

/**
 * Event Automation Service
 *
 * Automates the Cultural Calendar → World Events pipeline:
 * 1. Picks relevant hosts from feed profiles based on event type
 * 2. Matches venues from WorldLocations
 * 3. Assembles guest lists from profile relationships
 * 4. Creates draft world events ready for editorial review
 *
 * This service uses EXISTING fields only (no unmigrated columns).
 * Host/venue/guest data stored in world_events.canon_consequences JSONB
 * as { automation: { host_profile_id, venue_location_id, guest_profiles } }
 * until dedicated columns are migrated.
 */

const { v4: uuidv4 } = require('uuid');

// ─── CATEGORY MAPPING ────────────────────────────────────────────────────────
// Maps cultural calendar categories to feed profile content categories

const CATEGORY_TO_CONTENT = {
  fashion: ['fashion', 'luxury', 'style', 'modeling', 'design'],
  beauty: ['beauty', 'skincare', 'makeup', 'wellness'],
  music: ['music', 'entertainment', 'dj', 'producer'],
  art: ['art', 'photography', 'creative', 'gallery'],
  food: ['food', 'culinary', 'restaurant', 'chef'],
  nightlife: ['nightlife', 'club', 'entertainment', 'dj'],
  fitness: ['fitness', 'wellness', 'health', 'athlete'],
  tech: ['tech', 'startup', 'creator_economy'],
  film: ['film', 'cinema', 'entertainment', 'acting'],
  charity: ['philanthropy', 'activism', 'community'],
};

// Maps cultural categories to venue types
const CATEGORY_TO_VENUE = {
  fashion: ['gallery', 'hotel', 'rooftop', 'restaurant'],
  beauty: ['salon', 'spa', 'hotel', 'boutique'],
  music: ['club', 'bar', 'recording_studio', 'theater'],
  art: ['gallery', 'museum', 'rooftop', 'park'],
  food: ['restaurant', 'rooftop', 'hotel'],
  nightlife: ['club', 'bar', 'rooftop', 'hotel'],
  fitness: ['gym', 'yoga_studio', 'beach', 'park'],
  film: ['theater', 'cinema', 'hotel', 'rooftop'],
};

// Event name templates per category
const EVENT_TEMPLATES = {
  fashion: [
    '{host} Presents: {calendar} Collection Preview',
    'The {host} {calendar} After-Party',
    '{calendar} VIP Lounge — Hosted by {host}',
  ],
  beauty: [
    '{host} {calendar} Beauty Pop-Up',
    'Glow Hour: {host}\'s {calendar} Launch',
    '{calendar} Beauty Masterclass with {host}',
  ],
  music: [
    '{host} Live at {venue} — {calendar}',
    '{calendar} Kickoff Party — DJ {host}',
    'The {host} {calendar} Experience',
  ],
  art: [
    '{host} Gallery Night — {calendar}',
    '{calendar} Collector\'s Preview at {venue}',
    '{host}\'s {calendar} Opening Reception',
  ],
  default: [
    '{host} Presents: A {calendar} Evening',
    '{calendar} Celebration at {venue}',
    'An Evening with {host} — {calendar}',
  ],
};

// ─── CORE FUNCTIONS ──────────────────────────────────────────────────────────

// Maps archetypes to event hosting styles
const ARCHETYPE_EVENT_FIT = {
  polished_curator: ['invite', 'brand_deal', 'upgrade'], // hosts elegant events
  messy_transparent: ['guest', 'invite'],                 // attends, doesn't host formal events
  soft_life: ['invite', 'brand_deal'],                    // luxury events
  explicitly_paid: ['brand_deal'],                        // only paid appearances
  overnight_rise: ['invite', 'guest'],                    // new to the scene
  cautionary: ['guest'],                                  // attends, risky to host
  the_peer: ['invite', 'guest'],                          // collaborative events
  the_watcher: [],                                        // doesn't host
  chaos_creator: ['invite'],                              // hosts wild events
  community_builder: ['invite', 'guest', 'upgrade'],      // hosts community events
};

// Maps follower tiers to prestige ranges they can host
const TIER_PRESTIGE = {
  mega: { min: 6, max: 10 },
  macro: { min: 4, max: 8 },
  mid: { min: 2, max: 6 },
  micro: { min: 1, max: 4 },
};

/**
 * Find the best host profile for a cultural event.
 * Uses multi-factor matching: content category, archetype fit,
 * follower tier vs event prestige, brand partnerships.
 */
async function findHostProfile(calendarEvent, models, options = {}) {
  const { SocialProfile } = models;
  if (!SocialProfile) return null;

  const category = calendarEvent.cultural_category || calendarEvent.event_type || 'default';
  const contentMatches = CATEGORY_TO_CONTENT[category] || CATEGORY_TO_CONTENT.fashion;
  const severity = calendarEvent.severity_level || 5;

  const { Op } = require('sequelize');
  const where = {
    status: { [Op.in]: ['finalized', 'generated'] },
    feed_layer: 'lalaverse',
  };

  if (options.excludeIds?.length) {
    where.id = { [Op.notIn]: options.excludeIds };
  }

  // Get candidate profiles — broader search, then rank
  const candidates = await SocialProfile.findAll({
    where,
    order: [['lala_relevance_score', 'DESC']],
    limit: 20,
    attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype',
      'follower_tier', 'lala_relevance_score', 'geographic_base', 'brand_partnerships',
      'registry_character_id', 'revenue_streams'],
  });

  if (candidates.length === 0) return null;

  // Score each candidate
  const scored = candidates.map(profile => {
    let score = 0;
    const p = profile.toJSON ? profile.toJSON() : profile;

    // Content category match (0-30 points)
    if (contentMatches.includes(p.content_category)) score += 30;
    else if (p.content_category) score += 5; // any category > none

    // Archetype hosting fit (0-25 points)
    const archFit = ARCHETYPE_EVENT_FIT[p.archetype] || ['invite'];
    if (archFit.includes('invite')) score += 15;
    if (archFit.includes('brand_deal')) score += 10;
    if (archFit.length === 0) score -= 20; // watchers don't host

    // Follower tier vs event severity (0-20 points)
    const tierRange = TIER_PRESTIGE[p.follower_tier] || TIER_PRESTIGE.mid;
    if (severity >= tierRange.min && severity <= tierRange.max) score += 20;
    else if (severity < tierRange.min) score += 10; // overqualified is ok
    else score += 5; // underqualified gets some points

    // Brand partnerships relevance (0-15 points)
    const brands = Array.isArray(p.brand_partnerships) ? p.brand_partnerships : [];
    if (brands.length > 0) score += 10;
    if (brands.some(b => contentMatches.some(cm =>
      (b.brand || '').toLowerCase().includes(cm) || cm.includes((b.brand || '').toLowerCase())
    ))) score += 5;

    // Lala relevance bonus (0-10 points)
    score += Math.min(10, Math.round((p.lala_relevance_score || 0)));

    return { profile, score };
  });

  // Sort by score descending, return top match
  scored.sort((a, b) => b.score - a.score);

  console.log(`[EventAutomation] Host matching for "${calendarEvent.title}" (${category}, severity ${severity}):`);
  scored.slice(0, 3).forEach((s, i) => {
    const p = s.profile.toJSON ? s.profile.toJSON() : s.profile;
    console.log(`  ${i + 1}. ${p.handle} (${p.content_category}, ${p.archetype}, ${p.follower_tier}) → score: ${s.score}`);
  });

  return scored[0]?.profile || null;
}

/**
 * Find a matching venue for a cultural event.
 *
 * @param {object} calendarEvent — StoryCalendarEvent
 * @param {object} models — Sequelize models
 * @returns {object|null} WorldLocation
 */
async function findVenue(calendarEvent, models) {
  const { WorldLocation } = models;
  if (!WorldLocation) return null;

  const category = calendarEvent.cultural_category || 'default';
  const venueTypes = CATEGORY_TO_VENUE[category] || ['restaurant', 'hotel', 'rooftop'];

  // Try to find a venue matching the category
  const { Op } = require('sequelize');
  let venue = await WorldLocation.findOne({
    where: {
      venue_type: { [Op.in]: venueTypes },
    },
    order: [['created_at', 'DESC']],
  }).catch(() => null);

  // Fallback: any venue
  if (!venue) {
    venue = await WorldLocation.findOne({
      where: {
        location_type: { [Op.in]: ['venue', 'interior'] },
      },
      order: [['created_at', 'DESC']],
    }).catch(() => null);
  }

  return venue;
}

/**
 * Assemble a guest list from profiles related to the host.
 *
 * @param {object} hostProfile — SocialProfile of the host
 * @param {object} calendarEvent — StoryCalendarEvent
 * @param {object} models — Sequelize models
 * @param {number} [maxGuests=8] — max number of guests
 * @returns {Array} Array of { profile_id, handle, display_name, relationship }
 */
async function assembleGuestList(hostProfile, calendarEvent, models, maxGuests = 8) {
  const { SocialProfile, SocialProfileRelationship } = models;
  if (!SocialProfile) return [];

  const guests = [];
  const { Op } = require('sequelize');

  // 1. Get profiles with direct relationships to the host
  if (SocialProfileRelationship && hostProfile) {
    try {
      const relationships = await SocialProfileRelationship.findAll({
        where: {
          [Op.or]: [
            { profile_a_id: hostProfile.id },
            { profile_b_id: hostProfile.id },
          ],
        },
        limit: maxGuests,
      });

      const relatedIds = relationships.map(r =>
        r.profile_a_id === hostProfile.id ? r.profile_b_id : r.profile_a_id
      ).filter(Boolean);

      if (relatedIds.length > 0) {
        const relatedProfiles = await SocialProfile.findAll({
          where: { id: { [Op.in]: relatedIds } },
          attributes: ['id', 'handle', 'display_name'],
        });

        for (const p of relatedProfiles) {
          const rel = relationships.find(r =>
            r.profile_a_id === p.id || r.profile_b_id === p.id
          );
          guests.push({
            profile_id: p.id,
            handle: p.handle,
            display_name: p.display_name,
            relationship: rel?.relationship_type || 'network',
          });
        }
      }
    } catch { /* relationships table may not exist */ }
  }

  // 2. Fill remaining spots — mix of category matches, diverse archetypes and tiers
  if (guests.length < maxGuests) {
    const category = calendarEvent.cultural_category || 'default';
    const contentMatches = CATEGORY_TO_CONTENT[category] || [];
    const excludeIds = [hostProfile?.id, ...guests.map(g => g.profile_id)].filter(Boolean);

    // Get more candidates than needed, then diversify
    const candidatePool = await SocialProfile.findAll({
      where: {
        status: { [Op.in]: ['finalized', 'generated'] },
        feed_layer: 'lalaverse',
        ...(excludeIds.length > 0 ? { id: { [Op.notIn]: excludeIds } } : {}),
      },
      order: [['lala_relevance_score', 'DESC']],
      limit: Math.max(20, maxGuests * 3),
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype', 'follower_tier', 'lala_relationship'],
    });

    // Score and rank: category match + diversity bonus
    const usedArchetypes = new Set();
    const usedTiers = new Set();
    const remaining = maxGuests - guests.length;
    const selected = [];

    for (const p of candidatePool) {
      if (selected.length >= remaining) break;
      const pData = p.toJSON ? p.toJSON() : p;

      let score = 0;
      // Category match
      if (contentMatches.includes(pData.content_category)) score += 20;
      // Archetype diversity bonus
      if (!usedArchetypes.has(pData.archetype)) score += 10;
      // Tier diversity bonus
      if (!usedTiers.has(pData.follower_tier)) score += 8;
      // Lala relationship bonus — direct connections more interesting
      if (pData.lala_relationship === 'direct') score += 15;
      if (pData.lala_relationship === 'competitive') score += 12;
      if (pData.lala_relationship === 'aware') score += 8;

      selected.push({ profile: p, score, data: pData });
    }

    // Sort by score, pick top N
    selected.sort((a, b) => b.score - a.score);

    for (const s of selected.slice(0, remaining)) {
      usedArchetypes.add(s.data.archetype);
      usedTiers.add(s.data.follower_tier);
      guests.push({
        profile_id: s.data.id,
        handle: s.data.handle,
        display_name: s.data.display_name,
        relationship: contentMatches.includes(s.data.content_category) ? 'industry' : 'scene',
        archetype: s.data.archetype,
        follower_tier: s.data.follower_tier,
      });
    }
  }

  return guests;
}

/**
 * Generate an event name from templates.
 */
function generateEventName(category, hostName, calendarTitle, venueName) {
  const templates = EVENT_TEMPLATES[category] || EVENT_TEMPLATES.default;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template
    .replace('{host}', hostName || 'A Special Host')
    .replace('{calendar}', calendarTitle || 'Event')
    .replace('{venue}', venueName || 'an Exclusive Venue');
}

/**
 * Auto-spawn world events from a cultural calendar event.
 *
 * Creates 1-3 draft events with matched hosts, venues, and guest lists.
 * All automation data stored in canon_consequences.automation JSONB
 * (no new columns needed).
 *
 * @param {object} calendarEvent — StoryCalendarEvent instance
 * @param {string} showId — show to create events for
 * @param {object} models — Sequelize models
 * @param {object} [options] — { eventCount: 1-3, maxGuests: 8 }
 * @returns {Array} Created world events
 */
async function spawnEventsFromCalendar(calendarEvent, showId, models, options = {}) {
  const { eventCount = 1, maxGuests = 8 } = options;
  const createdEvents = [];
  const usedHostIds = [];

  for (let i = 0; i < eventCount; i++) {
    // Find host
    const host = await findHostProfile(calendarEvent, models, { excludeIds: usedHostIds });
    if (host) usedHostIds.push(host.id);

    const hostName = host?.display_name || host?.handle || null;

    // Find venue
    const venue = await findVenue(calendarEvent, models);
    const venueName = venue?.name || null;
    const venueAddress = venue
      ? [venue.street_address, venue.district, venue.city].filter(Boolean).join(', ')
      : calendarEvent.location_address || null;

    // Assemble guest list
    const guestList = host
      ? await assembleGuestList(host, calendarEvent, models, maxGuests)
      : [];

    // Generate event name
    const category = calendarEvent.cultural_category || 'default';
    const eventName = generateEventName(category, hostName, calendarEvent.title, venueName);

    // Determine prestige from calendar severity
    const prestige = Math.min(10, (calendarEvent.severity_level || 5) + Math.floor(Math.random() * 3));

    // Store automation data in canon_consequences (existing JSONB field)
    // Derive cost and strictness from prestige
    const costCoins = prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50;
    const strictness = Math.min(10, prestige + Math.floor(Math.random() * 2));
    const deadlineType = prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low';

    // Generate event date (next 1-3 weeks from now)
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 7 + Math.floor(Math.random() * 14));
    const eventDateStr = eventDate.toISOString().split('T')[0];
    const eventTimeStr = prestige >= 7 ? '20:00' : prestige >= 4 ? '19:00' : '18:00';

    const automationData = {
      host_profile_id: host?.id || null,
      host_handle: host?.handle || null,
      host_display_name: hostName,
      host_registry_character_id: host?.registry_character_id || null,
      host_brand: host?.brand_partnerships?.[0]?.brand || null,
      venue_location_id: venue?.id || null,
      venue_name: venueName,
      venue_address: venueAddress,
      guest_profiles: guestList,
      source_calendar_event_id: calendarEvent.id,
      source_calendar_title: calendarEvent.title,
      automated_at: new Date().toISOString(),
      event_date: eventDateStr,
      event_time: eventTimeStr,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      dress_code: calendarEvent.activities?.dress_code || null,
    };

    const eventData = {
      id: uuidv4(),
      show_id: showId,
      name: eventName,
      event_type: i === 0 ? 'invite' : (i === 1 ? 'guest' : 'upgrade'),
      host: hostName,
      host_brand: host?.brand_partnerships?.[0]?.brand || null,
      description: `${calendarEvent.title} — ${calendarEvent.what_world_knows || eventName}`,
      prestige,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      location_hint: venueAddress || calendarEvent.location_name || venueName || null,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      event_date: eventDateStr,
      event_time: eventTimeStr,
      dress_code: calendarEvent.activities?.dress_code || null,
      narrative_stakes: calendarEvent.what_only_we_know || null,
      canon_consequences: { automation: automationData },
      status: 'ready',
    };

    // Use WorldEvent model if available, fall back to raw SQL
    try {
      if (models.WorldEvent) {
        const event = await models.WorldEvent.create(eventData);
        createdEvents.push(event.toJSON());
      } else {
        await models.sequelize.query(
          `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, description,
           prestige, cost_coins, strictness, deadline_type, location_hint, venue_name, venue_address,
           event_date, event_time, dress_code, narrative_stakes, canon_consequences, status, created_at, updated_at)
           VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :description,
           :prestige, :cost_coins, :strictness, :deadline_type, :location_hint, :venue_name, :venue_address,
           :event_date, :event_time, :dress_code, :narrative_stakes, :canon_consequences, :status, NOW(), NOW())`,
          {
            replacements: {
              ...eventData,
              canon_consequences: JSON.stringify(eventData.canon_consequences),
            },
          }
        );
        createdEvents.push(eventData);
      }
    } catch (createErr) {
      console.error(`[EventAutomation] Failed to create event "${eventName}":`, createErr.message);
      // Try raw SQL as last resort — minimal columns
      try {
        await models.sequelize.query(
          `INSERT INTO world_events (id, show_id, name, event_type, host, description, prestige, cost_coins, strictness,
           location_hint, venue_name, venue_address, event_date, event_time, canon_consequences, status, created_at, updated_at)
           VALUES (:id, :show_id, :name, :event_type, :host, :description, :prestige, :cost_coins, :strictness,
           :location_hint, :venue_name, :venue_address, :event_date, :event_time, :canon_consequences, 'draft', NOW(), NOW())`,
          {
            replacements: {
              id: eventData.id, show_id: showId, name: eventName,
              event_type: eventData.event_type, host: hostName || null,
              description: eventData.description || eventName,
              prestige, cost_coins: eventData.cost_coins || 100, strictness: eventData.strictness || 5,
              location_hint: eventData.location_hint || null,
              venue_name: eventData.venue_name || null, venue_address: eventData.venue_address || null,
              event_date: eventData.event_date || null, event_time: eventData.event_time || null,
              canon_consequences: JSON.stringify(eventData.canon_consequences),
            },
          }
        );
        createdEvents.push(eventData);
      } catch (sqlErr) {
        console.error(`[EventAutomation] Raw SQL fallback also failed:`, sqlErr.message);
        throw new Error(`Event creation failed: ${createErr.message}`);
      }
    }
  }

  return createdEvents;
}

module.exports = {
  findHostProfile,
  findVenue,
  assembleGuestList,
  generateEventName,
  spawnEventsFromCalendar,
  CATEGORY_TO_CONTENT,
  CATEGORY_TO_VENUE,
  EVENT_TEMPLATES,
};
