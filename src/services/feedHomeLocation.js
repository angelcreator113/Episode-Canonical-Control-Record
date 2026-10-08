'use strict';

/**
 * A LalaVerse Feed creator's place on the DREAM map: a signature venue in
 * their city, where they create, host and build their brand (their
 * home_location_id), and up to three of the city's other venues as places
 * they frequent (frequent_venues, the signature venue first).
 *
 * /generate gave one to each LalaVerse creator it made; bulk import and
 * the Feed scheduler made them with none. All three call this now.
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

/** Gives a saved profile its signature venue and frequent venues in `city` (a DREAM city key). Returns the venue, or null. */
async function assignHomeLocation(db, profile, city) {
  if (!db?.WorldLocation || !profile || !city) return null;
  const cityName = city.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const displayName = profile.display_name || profile.handle || 'Creator';
  const category = profile.content_category || '';
  const venueInfo = CREATOR_VENUE_MAP[category] || CREATOR_VENUE_MAP[category.split('/')[0]] || { type: 'other', label: 'Studio' };
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

module.exports = { assignHomeLocation, backfillHomeLocations, CREATOR_VENUE_MAP };
