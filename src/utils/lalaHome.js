'use strict';

/**
 * Lala's home, and whether an event takes her away from it (D13 travel,
 * Evoni 2026-09-30):
 *
 *   "Lala's home is 246 Olddy Paveway Ln, Echo Park, Los Angeles; store it
 *   as a show setting (address, neighbourhood Echo Park, city Los Angeles).
 *   Travel and accommodation are drafted only when an event's location is
 *   outside Los Angeles (fallback: category travel_destination); [...]
 *   Getting around within Los Angeles (rides, valet) is event spending, not
 *   travel."
 *
 * The setting is shows.metadata.lala_home = { address, neighbourhood, city }
 * (migration 20261001190000; edited at Show Settings, GET/PUT
 * /api/v1/shows/:id/lala-home).
 *
 * An event's location is its venue's World Location (venue_location_id, or
 * the automation's), read up the parent chain until one has a city (and,
 * failing that, a district). Lala is home when that place is her home city
 * or her home neighbourhood: in the LalaVerse, Echo Park is one of the DREAM
 * cities, so a venue there carries city "Echo Park" (worldStudio's seed),
 * and an Echo Park event drafted travel (Evoni, 2026-10-01: "LA events
 * never draft travel"). Otherwise she travels when the city is known and
 * differs. When it is unknown, the fallback decides: the event's category
 * travel_destination.
 */

const HOME_FIELDS = Object.freeze(['address', 'neighbourhood', 'city']);
const FIELD_MAX = 200;
const PARENT_DEPTH = 6;

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[lalaHome] stored JSON parse failed:', err.message);
    return fallback;
  }
}

const normCity = (city) => String(city || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The lala_home setting from a show's metadata, or null when it has no city. */
function readLalaHome(metadata) {
  const home = parseJson(metadata, {})?.lala_home;
  if (!home || typeof home !== 'object' || !normCity(home.city)) return null;
  return Object.fromEntries(HOME_FIELDS.map((f) => [f, home[f] == null ? null : String(home[f])]));
}

/** Validates a lala_home body: { value } or { error }. Every field is text; the city is required. */
function readLalaHomeBody(body) {
  const b = body && typeof body === 'object' ? body : {};
  const value = {};
  for (const f of HOME_FIELDS) {
    const v = b[f] == null ? '' : String(b[f]).trim();
    if (v.length > FIELD_MAX) return { error: `${f} must be at most ${FIELD_MAX} characters` };
    value[f] = v || null;
  }
  if (!value.city) return { error: 'city is required: it decides when Lala travels' };
  return { value };
}

/**
 * The place of a World Location, read up its parents: { city, district },
 * the first city found and the first district found (null when none).
 */
async function locationPlace(sequelize, locationId, { transaction } = {}) {
  let id = locationId;
  let district = null;
  for (let depth = 0; id && depth < PARENT_DEPTH; depth += 1) {
    const [rows] = await sequelize.query(
      'SELECT city, district, parent_location_id FROM world_locations WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id }, transaction }
    );
    const row = rows?.[0];
    if (!row) break;
    if (!district && normCity(row.district)) district = row.district;
    if (normCity(row.city)) return { city: row.city, district };
    id = row.parent_location_id;
  }
  return { city: null, district };
}

/** The city of a World Location, read up its parents. null when none has one. */
async function locationCity(sequelize, locationId, options = {}) {
  return (await locationPlace(sequelize, locationId, options)).city;
}

/** Whether a place name is Lala's home city or home neighbourhood. */
function isHomePlace(name, home) {
  const n = normCity(name);
  if (!n || !home) return false;
  return n === normCity(home.city) || (Boolean(normCity(home.neighbourhood)) && n === normCity(home.neighbourhood));
}

/**
 * Whether the event takes Lala away from home: { travels, reason, city,
 * home_city }. reason is 'outside_home' or 'home_city' when both cities are
 * known, else 'category' (the fallback).
 */
async function lalaTravelsFor(sequelize, event, { transaction } = {}) {
  const fallback = { travels: event?.category === 'travel_destination', reason: 'category', city: null, home_city: null };
  if (!event) return fallback;
  let home = null;
  if (event.show_id) {
    const [shows] = await sequelize.query('SELECT metadata FROM shows WHERE id = :id LIMIT 1', { replacements: { id: event.show_id }, transaction });
    home = readLalaHome(shows?.[0]?.metadata);
  }
  const automation = parseJson(event.canon_consequences, {})?.automation || {};
  const locationId = event.venue_location_id || automation.venue_location_id || null;
  const { city, district } = locationId ? await locationPlace(sequelize, locationId, { transaction }) : { city: null, district: null };
  // A district counts only where no city is known (a Paris venue in a
  // district that happens to share the name is still Paris).
  if (home && (isHomePlace(city, home) || (!normCity(city) && isHomePlace(district, home)))) {
    return { travels: false, reason: 'home_city', city: city || district, home_city: home.city };
  }
  if (!home || !city) return { ...fallback, city, home_city: home?.city || null };
  return { travels: true, reason: 'outside_home', city, home_city: home.city };
}

module.exports = {
  HOME_FIELDS,
  normCity,
  readLalaHome,
  readLalaHomeBody,
  locationPlace,
  locationCity,
  isHomePlace,
  lalaTravelsFor,
};
