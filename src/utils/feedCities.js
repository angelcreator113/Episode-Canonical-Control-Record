'use strict';

/**
 * The LalaVerse Feed's cities: the five DREAM cities (utils/lalaHome
 * DREAM_CITIES) as social_profiles.city stores them, with each city's
 * creator culture for a generation prompt.
 *
 * The July 2026 unification (migration 20260725000000-unify-dream-cities)
 * renamed the five old cities to DREAM ones, but the Feed scheduler kept
 * offering the old names, so every LalaVerse profile it made since then
 * carries one (migration 20261008140000-feed-profiles-dream-cities renames
 * them as July did). feedCity reads an old name as its DREAM city.
 */

const { DREAM_CITIES, dreamCityName } = require('./lalaHome');

const keyOf = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

// social_profiles.city's DREAM values: dazzle_district, radiance_row, ...
const DREAM_CITY_KEYS = Object.freeze(DREAM_CITIES.map(keyOf));

const DREAM_CITY_CULTURE = Object.freeze({
  dazzle_district: 'Fashion capital of the LalaVerse. Couture houses, runway shows, designer studios. Polished curators dominate. Every sidewalk is a runway. Brand deals are currency.',
  radiance_row:    'Beauty & wellness heartland. Skincare labs, salons, beauty schools, product launches. Experimental, aesthetic, transformation culture. Reinvention is the local religion.',
  echo_park:       'Entertainment & nightlife hub. Music studios, comedy clubs, creator houses, viral content. Chaotic, loud, viral culture. Something happens here that becomes a meme by morning.',
  ascent_tower:    'Tech & innovation district. Digital platforms, creator economy tools, startup incubators. Futuristic, ambitious. The city building the tools everyone else uses.',
  maverick_harbor: 'Creator economy & counter-culture. Content houses, podcast networks, collab spaces, underground scenes. Collaborative, entrepreneurial, anti-algorithm. Fame is suspicious here.',
});

// July's mapping, old city → DREAM city.
const LEGACY_TO_DREAM = Object.freeze({
  nova_prime: 'dazzle_district',
  solenne: 'radiance_row',
  velour_city: 'echo_park',
  cascade_row: 'ascent_tower',
  the_drift: 'maverick_harbor',
});

/** The DREAM city key a value names ("Echo Park", "echo_park", or an old name), else null. */
function feedCity(value) {
  const name = dreamCityName(value);
  if (name) return keyOf(name);
  return LEGACY_TO_DREAM[keyOf(value)] || null;
}

/** A DREAM city at random (the scheduler's fallback spark). */
function randomFeedCity(random = Math.random) {
  return DREAM_CITY_KEYS[Math.min(DREAM_CITY_KEYS.length - 1, Math.floor(random() * DREAM_CITY_KEYS.length))];
}

module.exports = { DREAM_CITY_CULTURE, DREAM_CITY_KEYS, LEGACY_TO_DREAM, feedCity, randomFeedCity };
