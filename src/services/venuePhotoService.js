'use strict';

/**
 * A venue's own photo (Evoni, 2026-10-17: "the venue has its own photo"),
 * kept on its World Location (world_locations.venue_photo_url, migration
 * 20261017043106), apart from the scene set's main photo.
 *
 * Read with raw SQL, not through the WorldLocation model: a database the
 * migration has not reached yet has no column, and every reader then sees
 * no venue photo rather than an error.
 */

/** Map<locationId, url> for the locations that have a venue photo. */
async function venuePhotosFor(sequelize, locationIds) {
  const ids = [...new Set((locationIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  try {
    const [rows] = await sequelize.query(
      `SELECT id, venue_photo_url FROM world_locations
        WHERE id IN (:ids) AND venue_photo_url IS NOT NULL AND deleted_at IS NULL`,
      { replacements: { ids } });
    return new Map(rows.map((r) => [String(r.id), r.venue_photo_url]));
  } catch (err) {
    console.warn('[VenuePhoto] venue photos not read:', err.message);
    return new Map();
  }
}

/** Sets (url) or clears (null) a location's venue photo; returns the previous one. */
async function writeVenuePhoto(sequelize, locationId, url) {
  return sequelize.transaction(async (transaction) => {
    const [[row]] = await sequelize.query(
      'SELECT venue_photo_url FROM world_locations WHERE id = :id AND deleted_at IS NULL FOR UPDATE',
      { replacements: { id: locationId }, transaction });
    if (!row) return { found: false, previous: null };
    await sequelize.query('UPDATE world_locations SET venue_photo_url = :url, updated_at = NOW() WHERE id = :id',
      { replacements: { id: locationId, url }, transaction });
    return { found: true, previous: row.venue_photo_url || null };
  });
}

module.exports = { venuePhotosFor, writeVenuePhoto };
