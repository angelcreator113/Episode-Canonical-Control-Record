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
 * the automation's), read up the parent chain until one has a city. When
 * both cities are known, Lala travels when they differ. When either is
 * unknown, the fallback decides: the event's category travel_destination.
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

/** The city of a World Location, read up its parents. null when none has one. */
async function locationCity(sequelize, locationId, { transaction } = {}) {
  let id = locationId;
  for (let depth = 0; id && depth < PARENT_DEPTH; depth += 1) {
    const [rows] = await sequelize.query(
      'SELECT city, parent_location_id FROM world_locations WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id }, transaction }
    );
    const row = rows?.[0];
    if (!row) return null;
    if (normCity(row.city)) return row.city;
    id = row.parent_location_id;
  }
  return null;
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
  const city = locationId ? await locationCity(sequelize, locationId, { transaction }) : null;
  if (!home || !city) return { ...fallback, city, home_city: home?.city || null };
  const travels = normCity(city) !== normCity(home.city);
  return { travels, reason: travels ? 'outside_home' : 'home_city', city, home_city: home.city };
}

module.exports = {
  HOME_FIELDS,
  normCity,
  readLalaHome,
  readLalaHomeBody,
  locationCity,
  lalaTravelsFor,
};
