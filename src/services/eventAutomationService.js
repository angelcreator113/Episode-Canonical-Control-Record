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

/**
 * Find the best host profile for a cultural event.
 * Picks the highest-scoring profile whose content_category matches the event.
 *
 * @param {object} calendarEvent — StoryCalendarEvent
 * @param {object} models — Sequelize models
 * @param {object} [options] — { excludeIds: [] }
 * @returns {object|null} SocialProfile
 */
async function findHostProfile(calendarEvent, models, options = {}) {
  const { SocialProfile } = models;
  if (!SocialProfile) return null;

  const category = calendarEvent.cultural_category || calendarEvent.event_type || 'default';
  const contentMatches = CATEGORY_TO_CONTENT[category] || CATEGORY_TO_CONTENT.fashion;

  const { Op } = require('sequelize');
  const where = {
    status: { [Op.in]: ['finalized', 'generated'] },
    feed_layer: 'lalaverse',
  };

  if (contentMatches.length > 0) {
    where.content_category = { [Op.in]: contentMatches };
  }

  if (options.excludeIds?.length) {
    where.id = { [Op.notIn]: options.excludeIds };
  }

  const profile = await SocialProfile.findOne({
    where,
    order: [['lala_relevance_score', 'DESC']],
    attributes: ['id', 'handle', 'display_name', 'content_category', 'lala_relevance_score', 'geographic_base', 'brand_partnerships', 'registry_character_id'],
  });

  return profile;
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

  // 2. Fill remaining spots with category-matched profiles
  if (guests.length < maxGuests) {
    const category = calendarEvent.cultural_category || 'default';
    const contentMatches = CATEGORY_TO_CONTENT[category] || [];
    const excludeIds = [hostProfile?.id, ...guests.map(g => g.profile_id)].filter(Boolean);

    const fillers = await SocialProfile.findAll({
      where: {
        status: { [Op.in]: ['finalized', 'generated'] },
        feed_layer: 'lalaverse',
        ...(contentMatches.length > 0 ? { content_category: { [Op.in]: contentMatches } } : {}),
        ...(excludeIds.length > 0 ? { id: { [Op.notIn]: excludeIds } } : {}),
      },
      order: [['lala_relevance_score', 'DESC']],
      limit: maxGuests - guests.length,
      attributes: ['id', 'handle', 'display_name'],
    });

    for (const p of fillers) {
      guests.push({
        profile_id: p.id,
        handle: p.handle,
        display_name: p.display_name,
        relationship: 'industry',
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
    const automationData = {
      host_profile_id: host?.id || null,
      host_handle: host?.handle || null,
      host_display_name: hostName,
      host_registry_character_id: host?.registry_character_id || null,
      venue_location_id: venue?.id || null,
      venue_name: venueName,
      venue_address: venueAddress,
      guest_profiles: guestList,
      source_calendar_event_id: calendarEvent.id,
      source_calendar_title: calendarEvent.title,
      automated_at: new Date().toISOString(),
    };

    // Create the world event using existing columns only
    const eventData = {
      id: uuidv4(),
      show_id: showId,
      name: eventName,
      event_type: i === 0 ? 'invite' : (i === 1 ? 'guest' : 'upgrade'),
      host: hostName,
      host_brand: host?.brand_partnerships?.[0]?.brand || null,
      description: `${calendarEvent.title} — ${calendarEvent.what_world_knows || eventName}`,
      prestige,
      location_hint: venueAddress || calendarEvent.location_name || venueName || null,
      dress_code: calendarEvent.activities?.dress_code || null,
      narrative_stakes: calendarEvent.what_only_we_know || null,
      canon_consequences: { automation: automationData },
      status: 'draft',
    };

    // Use WorldEvent model if available, fall back to raw SQL
    if (models.WorldEvent) {
      const event = await models.WorldEvent.create(eventData);
      createdEvents.push(event.toJSON());
    } else {
      await models.sequelize.query(
        `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, description,
         prestige, location_hint, dress_code, narrative_stakes, canon_consequences, status, created_at, updated_at)
         VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :description,
         :prestige, :location_hint, :dress_code, :narrative_stakes, :canon_consequences, :status, NOW(), NOW())`,
        {
          replacements: {
            ...eventData,
            canon_consequences: JSON.stringify(eventData.canon_consequences),
          },
        }
      );
      createdEvents.push(eventData);
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
