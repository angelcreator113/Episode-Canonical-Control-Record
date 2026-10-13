'use strict';

/**
 * A post's location (Task #3090; Evoni, 2026-10-13): a Dream City or a
 * canonical venue (world_locations). A venue supplies its city: its own
 * `city`, else the nearest parent location whose name or city is a Dream
 * City (feedCities.feedCity). A post with a place shows in that city's feed
 * (feedCities.cityPostsSql). A tag is only a label: nothing here moves a
 * profile's city or says Lala travelled.
 *
 *   resolvePlace(models, { place_city, place_location_id })
 *       → { values: { place_city, place_location_id } } or { error }
 *       an absent key is left alone (undefined values); null clears
 *   listPlaces(models)   → { cities: [{ key, name }], venues: [{ id, name, city }] }
 *       every location but one named for a Dream City, by name
 *   withPlaces(models, posts) → each post with place: { city, location_id, name } or null
 */

const { DREAM_CITY_KEYS, feedCity } = require('./feedCities');
const { dreamCityName } = require('./lalaHome');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARENT_DEPTH = 4;

const cityName = (key) => dreamCityName(key) || key;

/** The Dream City a venue is in, walking up its parents; null when none says. */
async function venueCity(models, location) {
  let here = location;
  for (let depth = 0; here && depth <= PARENT_DEPTH; depth += 1) {
    const city = feedCity(here.city) || feedCity(here.name);
    if (city) return city;
    if (!here.parent_location_id) return null;
    here = await models.WorldLocation.findByPk(here.parent_location_id, { attributes: ['id', 'name', 'city', 'parent_location_id'] });
  }
  return null;
}

async function resolvePlace(models, body = {}) {
  const values = {};
  if (body.place_location_id !== undefined) {
    if (body.place_location_id === null || body.place_location_id === '') {
      values.place_location_id = null;
    } else {
      const id = String(body.place_location_id);
      if (!UUID_RE.test(id)) return { error: 'place_location_id must be a venue id.' };
      const venue = await models.WorldLocation.findByPk(id, { attributes: ['id', 'name', 'city', 'parent_location_id'] });
      if (!venue) return { error: 'That venue was not found.' };
      values.place_location_id = venue.id;
      // The venue supplies its city; a city sent alongside it is not used.
      values.place_city = await venueCity(models, venue);
      return { values };
    }
  }
  if (body.place_city !== undefined) {
    if (body.place_city === null || body.place_city === '') values.place_city = null;
    else {
      const key = feedCity(body.place_city);
      if (!key || !DREAM_CITY_KEYS.includes(key)) return { error: `place_city must be one of ${DREAM_CITY_KEYS.join(', ')}.` };
      values.place_city = key;
    }
  }
  return { values };
}

async function listPlaces(models) {
  const cities = DREAM_CITY_KEYS.map((key) => ({ key, name: cityName(key) }));
  const rows = models.WorldLocation
    ? await models.WorldLocation.findAll({ attributes: ['id', 'name', 'city', 'parent_location_id'], order: [['name', 'ASC']] })
    : [];
  // Every location is read once, so each venue's parents are walked in memory.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cityOf = (row) => {
    let here = row;
    for (let depth = 0; here && depth <= PARENT_DEPTH; depth += 1) {
      const city = feedCity(here.city) || feedCity(here.name);
      if (city) return city;
      here = here.parent_location_id ? byId.get(here.parent_location_id) : null;
    }
    return null;
  };
  // A location named for a Dream City is that city, already offered above.
  const venues = rows.filter((row) => !feedCity(row.name)).map((row) => ({ id: row.id, name: row.name, city: cityOf(row) }));
  return { cities, venues };
}

async function withPlaces(models, posts) {
  const ids = [...new Set(posts.map((p) => p.place_location_id).filter(Boolean))];
  let names = new Map();
  if (ids.length && models.WorldLocation) {
    try {
      const rows = await models.WorldLocation.findAll({ where: { id: ids }, attributes: ['id', 'name'] });
      names = new Map(rows.map((r) => [r.id, r.name]));
    } catch (err) {
      console.error('[FeedPlaces] venue names could not be read:', err.message);
    }
  }
  return posts.map((p) => ({
    ...p,
    place: p.place_city || p.place_location_id
      ? { city: p.place_city || null, city_name: p.place_city ? cityName(p.place_city) : null, location_id: p.place_location_id || null, name: p.place_location_id ? names.get(p.place_location_id) || null : null }
      : null,
  }));
}

module.exports = { resolvePlace, listPlaces, withPlaces, venueCity };
