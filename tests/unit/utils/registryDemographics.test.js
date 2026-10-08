/**
 * registry_characters.current_city and relationship_status are ENUMs that
 * refuse anything off their lists. utils/registryDemographics gives the
 * values they accept: the five DREAM cities (an old name read as July
 * mapped it), outside_lalaverse and unknown; and the registry's
 * relationship statuses, with World Studio's "engaged" and
 * "its_complicated" read as the registry names them. It lists the
 * registry's other demographic ENUMs too, for the writers that save an AI's
 * values: registryValue reads a value, or an old prompt's word, into one;
 * fitRegistryEnums does a whole record.
 */
const {
  REGISTRY_CITY_KEYS, RELATIONSHIP_STATUSES, REGISTRY_ENUMS,
  registryCity, cityNamedIn, worldCharacterCity, registryRelationshipStatus,
  registryValue, registryChoices, fitRegistryEnums,
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
    expect(registryRelationshipStatus('partnered')).toBe('committed'); // the character generator's word
  });

  it('every registry ENUM a writer fills, and its values as a prompt asks for them', () => {
    expect(Object.keys(REGISTRY_ENUMS)).toEqual([
      'current_city', 'class_origin', 'current_class', 'class_mobility_direction', 'family_structure',
      'sibling_position', 'relationship_status', 'platform_primary', 'follower_tier',
    ]);
    expect(REGISTRY_ENUMS.current_city).toBe(REGISTRY_CITY_KEYS);
    expect(REGISTRY_ENUMS.relationship_status).toBe(RELATIONSHIP_STATUSES);
    for (const values of Object.values(REGISTRY_ENUMS)) expect(values[values.length - 1]).toBe('unknown');
    expect(registryChoices('sibling_position')).toBe('only_child, oldest, middle, youngest');
    expect(registryChoices('platform_primary', ' | ')).toBe('lalaverse_main | multi_platform | live_first | archive_heavy');
    expect(registryChoices('not_a_field')).toBe('');
  });

  it('a registry value is the value itself, in any case or spacing', () => {
    expect(registryValue('class_origin', 'Middle Class')).toBe('middle_class');
    expect(registryValue('sibling_position', 'only child')).toBe('only_child');
    expect(registryValue('family_structure', 'foster-or-adopted')).toBe('foster_or_adopted');
    expect(registryValue('follower_tier', 'MACRO')).toBe('macro');
    expect(registryValue('current_city', 'Echo Park')).toBe('echo_park');
    expect(registryValue('current_city', 'velour_city')).toBe('echo_park');
  });

  it('an old prompt\'s word reads as the registry value it means', () => {
    const read = {
      class_origin: { destitute: 'poverty', working_poor: 'poverty', middle: 'middle_class' },
      current_class: { destitute: 'poverty', middle: 'middle_class' },
      class_mobility_direction: { upward: 'ascending', downward: 'descending' },
      family_structure: {
        two_parent_stable: 'two_parents_intact', two_parent_volatile: 'two_parents_intact', nuclear: 'two_parents_intact',
        foster: 'foster_or_adopted', blended: 'blended_family',
      },
      sibling_position: { only: 'only_child', eldest: 'oldest' },
      relationship_status: { partnered: 'committed', engaged: 'committed' },
      follower_tier: { nano: 'micro', 'mid-tier': 'mid' },
    };
    for (const [field, words] of Object.entries(read)) {
      for (const [word, value] of Object.entries(words)) expect([field, word, registryValue(field, word)]).toEqual([field, word, value]);
    }
  });

  it('a word with more than one reading, or none, is no value: the writer leaves the field empty', () => {
    const none = [
      ['family_structure', 'single_parent'], ['family_structure', 'single parent'], ['family_structure', 'raised_by_relatives'],
      ['family_structure', 'chosen_family'], ['family_structure', 'extended'], ['platform_primary', 'instagram'],
      ['platform_primary', 'TikTok'], ['class_origin', 'rich'], ['follower_tier', ''], ['follower_tier', null], ['age', 30],
    ];
    for (const [field, value] of none) expect([field, value, registryValue(field, value)]).toEqual([field, value, null]);
  });

  it('a record\'s ENUM fields read as the registry stores them; one it cannot read is left out and listed; the rest is kept', () => {
    const { fitted, skipped } = fitRegistryEnums({
      display_name: 'Nia', age: 29, class_origin: 'destitute', family_structure: 'single_parent',
      platform_primary: 'instagram', follower_tier: 'mid', current_city: 'Echo Park', sibling_position: null,
    });
    expect(fitted).toEqual({
      display_name: 'Nia', age: 29, class_origin: 'poverty', follower_tier: 'mid', current_city: 'echo_park', sibling_position: null,
    });
    expect(skipped).toEqual([
      { field: 'family_structure', value: 'single_parent' },
      { field: 'platform_primary', value: 'instagram' },
    ]);
  });
});
