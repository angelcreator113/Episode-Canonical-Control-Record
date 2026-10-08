/**
 * registry_characters.current_city and relationship_status are ENUMs that
 * refuse anything off their lists. utils/registryDemographics gives the
 * values they accept: the five DREAM cities (an old name read as July
 * mapped it), outside_lalaverse and unknown; and the registry's
 * relationship statuses, with World Studio's "engaged" and
 * "its_complicated" read as the registry names them.
 */
const {
  REGISTRY_CITY_KEYS, RELATIONSHIP_STATUSES,
  registryCity, cityNamedIn, worldCharacterCity, registryRelationshipStatus,
} = require('../../../src/utils/registryDemographics');
const { DREAM_CITIES, RENAMES } = require('../../../src/migrations/20261008150000-registry-characters-dream-cities');
const feedMigration = require('../../../src/migrations/20261008140000-feed-profiles-dream-cities');

describe('registry demographics', () => {
  it('a registry city is a DREAM city, outside_lalaverse or unknown', () => {
    expect(REGISTRY_CITY_KEYS).toEqual([...DREAM_CITIES, 'outside_lalaverse', 'unknown']);
    expect(registryCity('echo_park')).toBe('echo_park');
    expect(registryCity('Radiance Row')).toBe('radiance_row');
    expect(registryCity('Outside LalaVerse')).toBe('outside_lalaverse');
    expect(registryCity('unknown')).toBe('unknown');
  });

  it('an old city reads as July mapped it, the mapping the migration renames by', () => {
    expect(RENAMES).toEqual(feedMigration.RENAMES);
    for (const [from, to] of RENAMES) expect(registryCity(from)).toBe(to);
    expect(registryCity('Velour City')).toBe('echo_park');
  });

  it('anything else is no city', () => {
    for (const value of ['gotham', 'a loft in Echo Park', '', null, undefined]) expect(registryCity(value)).toBeNull();
  });

  it('a text names a DREAM city only when it names exactly one', () => {
    expect(cityNamedIn('a loft above a club in Echo Park')).toBe('echo_park');
    expect(cityNamedIn('Dazzle District, the penthouse floor')).toBe('dazzle_district');
    expect(cityNamedIn('commutes from Maverick-Harbor')).toBe('maverick_harbor');
    expect(cityNamedIn('between Echo Park and Radiance Row')).toBeNull();
    expect(cityNamedIn('downtown, near the river')).toBeNull();
    expect(cityNamedIn(null)).toBeNull();
  });

  it('a World Studio character: a LalaVerse one is in the city its location names; a Book 1 one is outside the LalaVerse', () => {
    expect(worldCharacterCity('lalaverse', 'a loft above a club in Echo Park')).toBe('echo_park');
    expect(worldCharacterCity('lalaverse', 'ascent_tower')).toBe('ascent_tower');
    expect(worldCharacterCity('lalaverse', 'nova_prime')).toBe('dazzle_district');
    expect(worldCharacterCity('lalaverse', 'somewhere glamorous')).toBeNull();
    expect(worldCharacterCity('lalaverse', null)).toBeNull();
    expect(worldCharacterCity('book-1', 'Atlanta, a two-bedroom near her mother')).toBe('outside_lalaverse');
  });

  it('a relationship status the registry accepts, with World Studio\'s two words read as the registry names them', () => {
    expect(RELATIONSHIP_STATUSES).toEqual(['single', 'dating', 'committed', 'married', 'separated', 'divorced', 'widowed', 'complicated', 'unknown']);
    expect(registryRelationshipStatus('engaged')).toBe('committed');
    expect(registryRelationshipStatus('its_complicated')).toBe('complicated');
    expect(registryRelationshipStatus("It's complicated")).toBe('complicated');
    expect(registryRelationshipStatus('Married')).toBe('married');
    for (const value of ['situationship', '', null]) expect(registryRelationshipStatus(value)).toBeNull();
  });
});
