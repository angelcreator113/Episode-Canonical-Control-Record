'use strict';

/**
 * A LalaVerse Feed creator's place on the DREAM map: a signature venue in
 * their city, where they create, host and build their brand (their
 * home_location_id), and up to three of the city's other venues as places
 * they frequent (frequent_venues, the signature venue first).
 *
 * /generate gave one to each LalaVerse creator it made; bulk import and
 * the Feed scheduler made them with none. All three call this now.
 *
 * The studio's type comes from studioFor: the niche's words, then the
 * content type. studioRetypes / applyStudioRetypes fix the studios made
 * before that, with Evoni's approval (Universe › Locations).
 */

const { Op } = require('sequelize');
const { feedCity } = require('../utils/feedCities');

// The venue a creator works from, by content category.
const CREATOR_VENUE_MAP = {
  fashion: { type: 'boutique', label: 'Showroom' },
  beauty: { type: 'salon', label: 'Studio' },
  music: { type: 'recording_studio', label: 'Studio' },
  entertainment: { type: 'recording_studio', label: 'Studio' },
  fitness: { type: 'gym', label: 'Gym' },
  food: { type: 'restaurant', label: 'Kitchen' },
  lifestyle: { type: 'cafe', label: 'Space' },
  tech: { type: 'coworking', label: 'Lab' },
  art: { type: 'gallery', label: 'Gallery' },
};

// Studio types (Evoni, 2026-10-18: every studio read "venue · other").
// Niches are free text now, so the old exact-key match above rarely hit:
// the niche's words are read first, then the Society content type.
const NICHE_VENUES = [
  [/\b(fashion|style|styling|outfit|thrift|vintage|designer|wardrobe|streetwear|couture)/i, { type: 'boutique', label: 'Showroom' }],
  [/\b(beauty|skin|makeup|make-up|hair|nail|cosmetic|lash|brow)/i, { type: 'salon', label: 'Studio' }],
  [/\b(music|beat|dj|producer|song|rap|singer|vocal|audio)/i, { type: 'recording_studio', label: 'Studio' }],
  [/\b(fitness|gym|workout|yoga|pilates|training|athlet)/i, { type: 'gym', label: 'Gym' }],
  [/\b(food|cook|chef|bak|recipe|kitchen|cuisine)/i, { type: 'restaurant', label: 'Kitchen' }],
  [/\b(wellness|therapy|mindful|meditat|self-care|healing)/i, { type: 'spa', label: 'Space' }],
  [/\b(art|paint|photograph|illustrat|gallery|sculpt)/i, { type: 'gallery', label: 'Gallery' }],
  [/\b(tech|startup|business|finance|money|entrepreneur|invest|career)/i, { type: 'office', label: 'Office' }],
  [/\b(comedy|entertain|skit|film|video|documentary|podcast|vlog)/i, { type: 'studio', label: 'Studio' }],
  [/\b(travel|luxury|hotel)/i, { type: 'hotel', label: 'Suite' }],
];
const TYPE_VENUES = {
  'The Beauty Oracle': { type: 'salon', label: 'Studio' },
  'The Trendsetter': { type: 'boutique', label: 'Showroom' },
  'The Luxury Icon': { type: 'boutique', label: 'Showroom' },
  'The Hustle Mogul': { type: 'office', label: 'Office' },
  'The Wellness Guide': { type: 'spa', label: 'Space' },
  'The Archivist': { type: 'gallery', label: 'Archive' },
  'The Rebel': { type: 'gallery', label: 'Studio' },
  'The Connector': { type: 'cafe', label: 'Space' },
  'The Educator': { type: 'studio', label: 'Studio' },
  'The Entertainer': { type: 'studio', label: 'Studio' },
  'The Commentator': { type: 'studio', label: 'Studio' },
  'The Main Character': { type: 'studio', label: 'Studio' },
  'The Drama Magnet': { type: 'studio', label: 'Studio' },
  'The Relatable Friend': { type: 'studio', label: 'Studio' },
  'The Viral Wildcard': { type: 'studio', label: 'Studio' },
};
const STUDIO_TYPES = Object.freeze(['boutique', 'salon', 'recording_studio', 'gym', 'restaurant', 'spa', 'gallery', 'office', 'coworking', 'studio', 'hotel', 'cafe']);

/** The venue a creator works from: their niche's words first, then their content type; null when neither says. */
function studioFor(profile) {
  const niche = String(profile?.content_category || '');
  const key = CREATOR_VENUE_MAP[niche.toLowerCase()] || CREATOR_VENUE_MAP[niche.toLowerCase().split('/')[0]];
  if (key) return { ...key, why: `their niche is ${niche}` };
  for (const [re, venue] of NICHE_VENUES) if (re.test(niche)) return { ...venue, why: `their niche is ${niche}` };
  const byType = TYPE_VENUES[profile?.society_archetype];
  return byType ? { ...byType, why: `they are known as ${profile.society_archetype}` } : null;
}

/** Gives a saved profile its signature venue and frequent venues in `city` (a DREAM city key). Returns the venue, or null. */
async function assignHomeLocation(db, profile, city) {
  if (!db?.WorldLocation || !profile || !city) return null;
  const cityName = city.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const displayName = profile.display_name || profile.handle || 'Creator';
  const venueInfo = studioFor(profile) || { type: 'other', label: 'Studio' };
  const slug = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${venueInfo.label.toLowerCase()}`;

  // Their signature venue, where they work and host.
  let homeLoc = await db.WorldLocation.create({
    name: `${displayName}'s ${venueInfo.label}`,
    slug,
    location_type: 'venue',
    venue_type: venueInfo.type,
    city: cityName,
    description: `${displayName}'s signature ${venueInfo.label.toLowerCase()} in ${cityName}. Where they create, host, and build their brand.`,
    narrative_role: 'sanctuary',
  }).catch((err) => {
    console.warn(`[feedHomeLocation] no signature venue for ${displayName}:`, err?.message);
    return null;
  });

  // A slug already taken: one of the city's venues instead.
  if (!homeLoc) {
    homeLoc = await db.WorldLocation.findOne({
      where: { city: { [Op.iLike]: `%${cityName}%` }, location_type: 'venue' },
      order: db.sequelize.random(),
    }).catch((err) => {
      console.warn(`[feedHomeLocation] no venue in ${cityName}:`, err?.message);
      return null;
    });
  }
  if (homeLoc) {
    await profile.update({ home_location_id: homeLoc.id });
  }

  // Up to three of the city's other venues as places they frequent.
  const cityVenues = await db.WorldLocation.findAll({
    where: {
      city: { [Op.iLike]: `%${cityName}%` },
      location_type: 'venue',
      ...(homeLoc ? { id: { [Op.ne]: homeLoc.id } } : {}),
    },
    order: db.sequelize.random(),
    limit: 3,
  }).catch((err) => {
    console.warn(`[feedHomeLocation] could not read ${cityName}'s venues:`, err?.message);
    return [];
  });
  if (cityVenues.length > 0 || homeLoc) {
    const venueIds = [...(homeLoc ? [homeLoc.id] : []), ...cityVenues.map((v) => v.id)];
    await profile.update({ frequent_venues: venueIds });
  }
  return homeLoc;
}

/**
 * Gives each LalaVerse creator with a DREAM city and no home its place on
 * the DREAM map: the one-time backfill (scripts/backfill-feed-homes.js) for
 * the creators the Feed scheduler and bulk import made before they called
 * assignHomeLocation. Only a creator with no home_location_id is touched,
 * so a second run does nothing. `dryRun` lists them and writes nothing;
 * `ids` and `limit` narrow the run.
 */
async function backfillHomeLocations(db, { dryRun = false, ids = null, limit = null } = {}) {
  const where = { feed_layer: 'lalaverse', city: { [Op.ne]: null }, home_location_id: null };
  if (ids?.length) where.id = { [Op.in]: ids };
  const total = await db.SocialProfile.count({ where });
  const profiles = await db.SocialProfile.findAll({ where, order: [['id', 'ASC']], ...(limit ? { limit } : {}) });

  const results = [];
  for (const profile of profiles) {
    const row = { id: profile.id, handle: profile.handle, city: profile.city };
    const city = feedCity(profile.city);
    if (!city) {
      results.push({ ...row, status: 'not_a_dream_city' });
      continue;
    }
    if (dryRun) {
      results.push({ ...row, status: 'would_assign' });
      continue;
    }
    try {
      const home = await assignHomeLocation(db, profile, city);
      results.push(home
        ? { ...row, status: 'assigned', home_location_id: home.id, home_name: home.name }
        : { ...row, status: 'no_venue' });
    } catch (err) {
      console.error(`[feedHomeLocation] backfill: no home for ${profile.handle}:`, err?.message);
      results.push({ ...row, status: 'failed', error: err?.message });
    }
  }
  return { total, results };
}

/**
 * Studios typed "other" (made before studioFor) with a better type for the
 * creator who lives there, for Evoni to approve (Evoni, 2026-10-18: "yes
 * start the studio types"). A studio still named "<name>'s Studio" also
 * gets its new label ("SHOWROOM.LUX's Showroom"). Nothing is written.
 */
async function studioRetypes(db) {
  const venues = await db.WorldLocation.findAll({
    where: { location_type: 'venue', [Op.or]: [{ venue_type: null }, { venue_type: 'other' }] },
    attributes: ['id', 'name', 'venue_type', 'description'],
  });
  if (!venues.length) return [];
  const residents = await db.SocialProfile.findAll({
    where: { home_location_id: { [Op.in]: venues.map((v) => v.id) } },
    attributes: ['id', 'handle', 'display_name', 'content_category', 'society_archetype', 'home_location_id'],
  });
  const byHome = new Map();
  for (const r of residents) byHome.set(r.home_location_id, [...(byHome.get(r.home_location_id) || []), r]);
  const out = [];
  for (const v of venues) {
    const people = byHome.get(v.id) || [];
    if (people.length !== 1) continue;
    const p = people[0];
    const studio = studioFor(p);
    if (!studio) continue;
    const owner = p.display_name || p.handle || 'Creator';
    const generated = v.name === `${owner}'s Studio`;
    out.push({
      location_id: v.id, name: v.name, venue_type: v.venue_type || null,
      proposed: { venue_type: studio.type, name: generated ? `${owner}'s ${studio.label}` : v.name },
      resident: { id: p.id, handle: p.handle, display_name: p.display_name },
      why: studio.why,
    });
  }
  return out;
}

/** Applies approved studio types [{ location_id, venue_type, name? }]; returns how many changed. */
async function applyStudioRetypes(db, items) {
  let changed = 0;
  for (const it of Array.isArray(items) ? items : []) {
    if (!STUDIO_TYPES.includes(it?.venue_type)) continue;
    const loc = await db.WorldLocation.findByPk(it.location_id);
    if (!loc || loc.location_type !== 'venue') continue;
    const name = typeof it.name === 'string' && it.name.trim() ? it.name.trim().slice(0, 255) : loc.name;
    const label = name.match(/'s ([A-Z][a-z]+)$/)?.[1];
    const description = label && loc.description ? loc.description.replace(/signature studio\b/, `signature ${label.toLowerCase()}`) : loc.description;
    await loc.update({ venue_type: it.venue_type, name, description });
    changed += 1;
  }
  return changed;
}

module.exports = { assignHomeLocation, backfillHomeLocations, studioFor, studioRetypes, applyStudioRetypes, CREATOR_VENUE_MAP, STUDIO_TYPES };
