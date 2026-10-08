'use strict';

/**
 * A LalaVerse Feed creator's place on the DREAM map: a signature venue in
 * their city, where they create, host and build their brand (their
 * home_location_id), and up to three of the city's other venues as places
 * they frequent (frequent_venues, the signature venue first).
 *
 * /generate gave one to each LalaVerse creator it made; bulk import made
 * them with none. Both call this now.
 */

const { Op } = require('sequelize');

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

module.exports = { assignHomeLocation, CREATOR_VENUE_MAP };
