/**
 * The Feed's cities are the five DREAM cities (utils/feedCities). The July
 * unification (migration 20260725000000-unify-dream-cities) renamed the
 * old five, but the Feed scheduler kept offering them, so the profiles it
 * made since carried old names. feedCity reads an old name as July mapped
 * it, and migration 20261008140000-feed-profiles-dream-cities renames the
 * stored ones by the same mapping.
 */
const { Sequelize, DataTypes } = require('sequelize');
const {
  DREAM_CITY_CULTURE, DREAM_CITY_KEYS, LEGACY_TO_DREAM, feedCity, randomFeedCity,
} = require('../../../src/utils/feedCities');
const { DREAM_CITIES } = require('../../../src/utils/lalaHome');
const { RENAMES } = require('../../../src/migrations/20261008140000-feed-profiles-dream-cities');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const { rawAttributes } = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

describe('the Feed\'s cities', () => {
  it('are the five DREAM cities, as social_profiles.city stores them, each with its culture', () => {
    expect(DREAM_CITY_KEYS).toEqual(['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor']);
    expect(DREAM_CITY_KEYS).toHaveLength(DREAM_CITIES.length);
    expect(Object.keys(DREAM_CITY_CULTURE)).toEqual(DREAM_CITY_KEYS);
    for (const key of DREAM_CITY_KEYS) expect(rawAttributes.city.values).toContain(key);
  });

  it('read a DREAM city by its key or its name', () => {
    expect(feedCity('echo_park')).toBe('echo_park');
    expect(feedCity('Echo Park')).toBe('echo_park');
    expect(feedCity('  maverick-harbor ')).toBe('maverick_harbor');
    expect(feedCity('ASCENT TOWER')).toBe('ascent_tower');
  });

  it('read an old city as July mapped it', () => {
    expect(feedCity('nova_prime')).toBe('dazzle_district');
    expect(feedCity('Solenne')).toBe('radiance_row');
    expect(feedCity('Velour City')).toBe('echo_park');
    expect(feedCity('cascade_row')).toBe('ascent_tower');
    expect(feedCity('The Drift')).toBe('maverick_harbor');
  });

  it('read anything else as no city', () => {
    for (const value of ['gotham', 'outside_lalaverse', 'unknown', '', null, undefined, 7]) {
      expect(feedCity(value)).toBeNull();
    }
  });

  it('map the old names to DREAM cities as the migration does', () => {
    expect(Object.entries(LEGACY_TO_DREAM).sort()).toEqual([...RENAMES].sort());
    for (const [, to] of RENAMES) expect(DREAM_CITY_KEYS).toContain(to);
  });

  it('give a DREAM city at random, at either end of the draw', () => {
    expect(randomFeedCity(() => 0)).toBe('dazzle_district');
    expect(randomFeedCity(() => 0.99999)).toBe('maverick_harbor');
    expect(randomFeedCity(() => 1)).toBe('maverick_harbor');
    for (let i = 0; i < 50; i++) expect(DREAM_CITY_KEYS).toContain(randomFeedCity());
  });
});
