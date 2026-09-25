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
const { autoScheduledEventDate, AUTO_DATE_KEY } = require('../utils/eventDateDefault');

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
    is_justawoman_record: { [Op.ne]: true },  // Never pick JustAWoman as host
  };

  if (options.excludeIds?.length) {
    where.id = { [Op.notIn]: options.excludeIds };
  }

  // Get candidate profiles — broader search, then rank
  // Filter by celebrity_tier: untouchable never hosts, exclusive only for prestige 8+
  let candidates;
  try {
    candidates = await SocialProfile.findAll({
      where: {
        ...where,
        [Op.or]: [
          { celebrity_tier: null },
          { celebrity_tier: 'accessible' },
          ...(severity >= 5 ? [{ celebrity_tier: 'selective' }] : []),
          ...(severity >= 8 ? [{ celebrity_tier: 'exclusive' }] : []),
        ],
      },
      order: [['lala_relevance_score', 'DESC']],
      limit: 20,
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype',
        'follower_tier', 'lala_relevance_score', 'geographic_base', 'brand_partnerships',
        'registry_character_id', 'revenue_streams', 'celebrity_tier', 'platform',
        'city', 'frequent_venues'],
    });
  } catch {
    // Fallback if celebrity_tier column doesn't exist yet
    candidates = await SocialProfile.findAll({
      where,
      order: [['lala_relevance_score', 'DESC']],
      limit: 20,
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype',
        'follower_tier', 'lala_relevance_score', 'geographic_base', 'brand_partnerships',
        'registry_character_id', 'revenue_streams', 'city', 'frequent_venues'],
    });
  }

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
 * Priority: host's frequent venues → host's city → category match → any venue
 *
 * @param {object} calendarEvent — StoryCalendarEvent
 * @param {object} models — Sequelize models
 * @param {object} hostProfile — optional SocialProfile of the host
 * @returns {object|null} WorldLocation
 */
async function findVenue(calendarEvent, models, hostProfile) {
  const { WorldLocation } = models;
  if (!WorldLocation) return null;

  const { Op } = require('sequelize');
  const category = calendarEvent.cultural_category || 'default';
  const venueTypes = CATEGORY_TO_VENUE[category] || ['restaurant', 'hotel', 'rooftop'];

  // 1. Check host's frequent venues first
  if (hostProfile?.frequent_venues?.length > 0) {
    try {
      const hostVenue = await WorldLocation.findOne({
        where: {
          id: { [Op.in]: hostProfile.frequent_venues },
          venue_type: { [Op.in]: venueTypes },
        },
      }).catch(() => null);
      if (hostVenue) return hostVenue;
    } catch (e) { console.warn('[eventAutomation] host venue lookup:', e?.message); }
  }

  // 2. Try venues in the host's city
  if (hostProfile?.city) {
    const cityName = (hostProfile.city || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    try {
      const cityVenue = await WorldLocation.findOne({
        where: {
          city: { [Op.iLike]: `%${cityName}%` },
          venue_type: { [Op.in]: venueTypes },
        },
        order: [['created_at', 'DESC']],
      }).catch(() => null);
      if (cityVenue) return cityVenue;
    } catch (e) { console.warn('[eventAutomation] city venue lookup:', e?.message); }
  }

  // 3. Category match across all locations
  let venue = await WorldLocation.findOne({
    where: { venue_type: { [Op.in]: venueTypes } },
    order: [['created_at', 'DESC']],
  }).catch(() => null);

  // 4. Fallback: any venue
  if (!venue) {
    venue = await WorldLocation.findOne({
      where: { location_type: { [Op.in]: ['venue', 'interior'] } },
      order: [['created_at', 'DESC']],
    }).catch(() => null);
  }

  return venue;
}

/**
 * Ensure a venue exists in WorldLocations. If the event has venue data
 * but no matching location, auto-create one.
 */
async function ensureVenueLocation(venueName, venueAddress, category, models) {
  const { WorldLocation } = models;
  if (!WorldLocation || !venueName) return null;

  const { Op } = require('sequelize');

  // Check if a location with this name already exists
  try {
    const existing = await WorldLocation.findOne({
      where: { name: { [Op.iLike]: venueName } },
    });
    if (existing) return existing;
  } catch { /* iLike may not work on all DBs */ }

  // Parse address parts
  const addressParts = (venueAddress || '').split(',').map(s => s.trim());
  const streetAddress = addressParts[0] || null;
  const district = addressParts[1] || null;
  const city = addressParts[2] || null;

  // Map category to venue type
  const CATEGORY_VENUE_TYPES = {
    fashion: 'gallery', beauty: 'salon', lifestyle: 'restaurant',
    music: 'club', food: 'restaurant', creator_economy: 'studio',
    creative: 'gallery', drama: 'lounge',
  };
  const venueType = CATEGORY_VENUE_TYPES[(category || '').toLowerCase()] || 'venue';

  // Create the location
  try {
    const { v4: uuidv4 } = require('uuid');
    const location = await WorldLocation.create({
      id: uuidv4(),
      name: venueName,
      location_type: 'venue',
      street_address: streetAddress,
      district,
      city: city || 'Nova Prime',
      venue_type: venueType,
    });
    console.log(`[EventAutomation] Auto-created venue: ${venueName} (${venueType})`);
    return location;
  } catch (err) {
    // Try minimal create if some columns don't exist
    try {
      const { v4: uuidv4 } = require('uuid');
      const location = await WorldLocation.create({
        id: uuidv4(),
        name: venueName,
        location_type: 'venue',
      });
      return location;
    } catch {
      console.warn('[EventAutomation] Failed to auto-create venue:', err.message);
      return null;
    }
  }
}

/**
 * Who may be chosen as a guest, in either stage of assembleGuestList
 * (Task #1800) — one place, so the two stages cannot drift apart again.
 *   - status finalized, generated or crossed (no drafts, no archived
 *     profiles). Crossed profiles are eligible (Evoni, Task #1804):
 *     crossing freezes nothing on the Feed, and a crossed profile is a
 *     deeper character, more story-relevant rather than less;
 *   - LalaVerse profiles only (feed_layer defaults to 'real_world');
 *   - never JustAWoman (she is the host, not an attendee);
 *   - celebrity_tier null, accessible or selective — untouchable profiles
 *     do not turn up at a prestige-3 brunch.
 * celebrity_tier is added by migration 20260713000000; the old try/catch
 * around this condition wrapped a plain assignment and guarded nothing.
 */
function guestEligibilityWhere(Op) {
  return {
    status: { [Op.in]: ['finalized', 'generated', 'crossed'] },
    feed_layer: 'lalaverse',
    is_justawoman_record: { [Op.ne]: true },
    [Op.or]: [{ celebrity_tier: null }, { celebrity_tier: 'accessible' }, { celebrity_tier: 'selective' }],
  };
}

/**
 * Score one fill-stage guest candidate against the guests already chosen
 * (Task #1796). Category match: the candidate's content fits the event's
 * cultural category (+20). Lala relationship: how directly they touch
 * Lala's story — direct (+15), competitive (+12), aware (+8). Archetype
 * and tier diversity: a kind of creator, and a follower tier, not yet on
 * the list (+10, +8).
 */
function scoreGuestCandidate(pData, contentMatches, usedArchetypes, usedTiers) {
  let score = 0;
  if (contentMatches.includes(pData.content_category)) score += 20;
  if (!usedArchetypes.has(pData.archetype)) score += 10;
  if (!usedTiers.has(pData.follower_tier)) score += 8;
  if (pData.lala_relationship === 'direct') score += 15;
  if (pData.lala_relationship === 'competitive') score += 12;
  if (pData.lala_relationship === 'aware') score += 8;
  return score;
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

  // 1. Get profiles with direct relationships to the host, in either
  // direction. The columns are source_profile_id / target_profile_id (the
  // model and migration 20260311120000); this stage queried profile_a_id /
  // profile_b_id from #453 until Task #1860, so every lookup failed and no
  // related guest was ever chosen.
  if (SocialProfileRelationship && hostProfile) {
    try {
      // Which relations invite (Evoni, Tasks #1860 and #1866):
      //   - hidden relations never do (#1860); NULL visibility reads as the
      //     model default, 'public'; 'rumored' is treated as public — a
      //     rumour is known in the world, just not confirmed (#1866 rule 4);
      //   - direction gates: mutual, or pointing from host to guest. A
      //     guest-to-host link means someone knows the host, not that the
      //     host would invite them. NULL direction reads as the model and
      //     migration default, 'mutual' (#1866 rule 1);
      //   - secret_link never invites, whatever its visibility; feud and ex
      //     do (#1866 rule 5).
      // The same rules are applied in the query and to the rows it returns.
      const hostId = hostProfile.id;
      const invites = (r) => {
        if (r.public_visibility === 'hidden') return false;
        if (r.relationship_type === 'secret_link') return false;
        const direction = r.direction ?? 'mutual';
        if (direction === 'mutual') return true;
        if (direction === 'source_to_target') return r.source_profile_id === hostId;
        if (direction === 'target_to_source') return r.target_profile_id === hostId;
        return false;
      };

      // No row limit and no drama_level ordering (#1866 rules 2 and 3):
      // eligibility applies before maxGuests, so an ineligible relation
      // cannot use up a slot, and drama is a signal for the script, not a
      // selection weight. id ASC is the order until relevance to the event
      // is defined — the same data always gives the same list (#1796).
      const byId = (a, b) => (typeof a.id === 'number' ? a.id : Infinity) - (typeof b.id === 'number' ? b.id : Infinity) || 0;
      const relationships = (await SocialProfileRelationship.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: [
              { source_profile_id: hostId },
              { target_profile_id: hostId },
            ] },
            { [Op.or]: [
              { public_visibility: { [Op.ne]: 'hidden' } },
              { public_visibility: null },
            ] },
            { relationship_type: { [Op.ne]: 'secret_link' } },
            { [Op.or]: [
              { direction: 'mutual' },
              { direction: null },
              { source_profile_id: hostId, direction: 'source_to_target' },
              { target_profile_id: hostId, direction: 'target_to_source' },
            ] },
          ],
        },
        order: [['id', 'ASC']],
      })).filter(invites).sort(byId);

      // One entry per person, labelled by their first relation by id: two
      // relationship types to the same profile (collab and rival, say)
      // still make one guest.
      const relationByPerson = new Map();
      for (const r of relationships) {
        const other = r.source_profile_id === hostId ? r.target_profile_id : r.source_profile_id;
        if (other && !relationByPerson.has(other)) relationByPerson.set(other, r);
      }
      const relatedIds = [...relationByPerson.keys()];

      if (relatedIds.length > 0) {
        // A guest arriving through a relationship is no more eligible than
        // one arriving through the fill query below (Evoni, Tasks #1796 and
        // #1800), so this stage applies the same rules: guestEligibilityWhere.
        // A related profile filtered out here leaves its slot to the fill
        // stage, and to the next eligible relation (#1866 rule 3).
        const relatedProfiles = await SocialProfile.findAll({
          where: { ...guestEligibilityWhere(Op), id: { [Op.in]: relatedIds } },
          attributes: ['id', 'handle', 'display_name'],
        });
        const profileById = new Map(relatedProfiles.map(p => [p.id, p]));

        for (const id of relatedIds) {
          if (guests.length >= maxGuests) break;
          const p = profileById.get(id);
          if (!p) continue;
          guests.push({
            profile_id: p.id,
            handle: p.handle,
            display_name: p.display_name,
            relationship: relationByPerson.get(id).relationship_type || 'network',
          });
        }
      }
    } catch (err) {
      // The relationships table may not exist. Logged, because a failure
      // here quietly leaves the event with no related guests (Task #1800).
      console.warn('[EventAutomation] Relationship-stage guest lookup failed:', err.message);
    }
  }

  // 2. Fill remaining spots — mix of category matches, diverse archetypes and tiers
  if (guests.length < maxGuests) {
    const category = calendarEvent.cultural_category || 'default';
    const contentMatches = CATEGORY_TO_CONTENT[category] || [];
    const excludeIds = [hostProfile?.id, ...guests.map(g => g.profile_id)].filter(Boolean);

    // Get more candidates than needed, then diversify. Same eligibility
    // rules as the relationship stage (guestEligibilityWhere).
    const guestWhere = {
      ...guestEligibilityWhere(Op),
      ...(excludeIds.length > 0 ? { id: { [Op.notIn]: excludeIds } } : {}),
    };
    const candidatePool = await SocialProfile.findAll({
      where: guestWhere,
      // id breaks relevance ties, so the same data always gives the same
      // pool (Task #1796).
      order: [['lala_relevance_score', 'DESC'], ['id', 'ASC']],
      limit: Math.max(20, maxGuests * 3),
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype', 'follower_tier', 'lala_relationship'],
    });

    // Score and pick, one guest at a time (Task #1796). Every remaining
    // candidate is scored, the best is taken, its archetype and tier are
    // recorded, and the rest are rescored — so the diversity bonuses reward
    // a candidate who differs from the guests already chosen. (This used to
    // score only the first `remaining` candidates and keep all of them, and
    // filled usedArchetypes/usedTiers only after choosing, so no bonus ever
    // changed who was picked: the guests were the top N by relevance.)
    // Ties go to the earlier candidate in the pool's own order.
    const usedArchetypes = new Set();
    const usedTiers = new Set();
    const remaining = maxGuests - guests.length;
    const pool = candidatePool.map(p => (p.toJSON ? p.toJSON() : p));
    const chosen = [];

    while (chosen.length < remaining && pool.length > 0) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      pool.forEach((pData, i) => {
        const score = scoreGuestCandidate(pData, contentMatches, usedArchetypes, usedTiers);
        if (score > bestScore) { bestScore = score; bestIndex = i; }
      });
      const [pick] = pool.splice(bestIndex, 1);
      usedArchetypes.add(pick.archetype);
      usedTiers.add(pick.follower_tier);
      chosen.push(pick);
    }

    for (const data of chosen) {
      guests.push({
        profile_id: data.id,
        handle: data.handle,
        display_name: data.display_name,
        relationship: contentMatches.includes(data.content_category) ? 'industry' : 'scene',
        archetype: data.archetype,
        follower_tier: data.follower_tier,
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

    // Task #1771 (same fix as #1765/#1766 for from-profile): a host
    // creator's brand partnership is their sponsor, not the event's
    // organizer. This used to write the first partnership's brand to the
    // host_brand column and to automation.host_brand, and
    // resolveEventOrganizer (frontend eventReadiness.js) lets a brand in
    // either home win over the creator, so the Event Package read
    // "Organized by <sponsor>". The creator stays the organizer (the
    // automation.host_* copy below); host_brand is null in both homes (the
    // key is kept, as in from-profile). A calendar event carries no brand
    // of its own (StoryCalendarEvent has no brand or host field), so
    // nothing here is the calendar's organizer being dropped.
    // The partnerships are kept as automation.brand_partnerships, only when
    // at least one well-formed { brand } entry exists (read by
    // characterSyncService.generatePostEventOpportunities as brand
    // sources), and the first one still names the sponsor in the social
    // task copy below.
    const partnerships = Array.isArray(host?.brand_partnerships)
      ? host.brand_partnerships.filter(b => b && typeof b === 'object' && b.brand)
      : [];
    // Same value the social task copy always used (first partnership).
    const sponsorBrand = host?.brand_partnerships?.[0]?.brand || null;

    // Find venue
    let venue = await findVenue(calendarEvent, models, host);

    // Auto-create venue if none found
    if (!venue && calendarEvent.title) {
      venue = await ensureVenueLocation(
        calendarEvent.location_name || `${calendarEvent.title} Venue`,
        calendarEvent.location_address || null,
        calendarEvent.cultural_category,
        models
      );
    }
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

    // Event date: the system default, 45 days out (Task #1755, replacing
    // the random 1-3 weeks this used to pick); flagged below as
    // automation.event_date_auto so the Event Package labels it.
    const eventDateStr = autoScheduledEventDate();
    // No event time (Task #1757): a calendar event supplies none, and this
    // used to derive one from prestige (20:00/19:00/18:00) and save it to
    // the column and the automation copy. The Event Package suggests one.

    const automationData = {
      host_profile_id: host?.id || null,
      host_handle: host?.handle || null,
      host_display_name: hostName,
      host_registry_character_id: host?.registry_character_id || null,
      host_brand: null,
      ...(partnerships.length > 0 ? { brand_partnerships: partnerships } : {}),
      venue_location_id: venue?.id || null,
      venue_name: venueName,
      venue_address: venueAddress,
      guest_profiles: guestList,
      source_calendar_event_id: calendarEvent.id,
      source_calendar_title: calendarEvent.title,
      automated_at: new Date().toISOString(),
      event_date: eventDateStr,
      [AUTO_DATE_KEY]: eventDateStr,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      dress_code: calendarEvent.activities?.dress_code || null,
      // Auto-generated social tasks
      social_tasks: (() => {
        try {
          const { buildSocialTasks } = require('./episodeGeneratorService');
          const eventType = i === 0 ? 'invite' : (i === 1 ? 'guest' : 'upgrade');
          return buildSocialTasks(
            eventType,
            host
              ? {
                  platform: host.platform || 'instagram',
                  content_category: host.content_category,
                  handle: host.handle,
                  display_name: host.display_name || hostName,
                }
              : null,
            [],
            {
              event_name: eventName,
              host_name: hostName,
              host_handle: host?.handle || null,
              // Sponsor copy, not an organizer field: buildSocialTasks
              // only uses it in task text ("Create a post with @host
              // (<sponsor>)", "Tease the <sponsor> collaboration"), which
              // is true of a creator's partner brand.
              host_brand: sponsorBrand,
              venue_name: venueName,
              dress_code: calendarEvent.activities?.dress_code || null,
              guest_names: guestList.map(g => g.display_name || g.handle).filter(Boolean),
            }
          );
        } catch { return []; }
      })(),
    };

    const eventData = {
      id: uuidv4(),
      show_id: showId,
      name: eventName,
      event_type: i === 0 ? 'invite' : (i === 1 ? 'guest' : 'upgrade'),
      host: hostName,
      host_brand: null,
      description: `${calendarEvent.title} — ${calendarEvent.what_world_knows || eventName}`,
      prestige,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      location_hint: venueAddress || calendarEvent.location_name || venueName || null,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      event_date: eventDateStr,
      event_time: null,
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
  ensureVenueLocation,
  assembleGuestList,
  guestEligibilityWhere,
  scoreGuestCandidate,
  generateEventName,
  spawnEventsFromCalendar,
  CATEGORY_TO_CONTENT,
  CATEGORY_TO_VENUE,
  EVENT_TEMPLATES,
};
