/** The cast's sorting: Lala, her world (LalaVerse feed profiles), and the old system. */
import { describe, test, expect } from 'vitest';
import { findLala, feedPeople, oldSystem, sameNames, sameNameNote, archetypeLabel, castCounts } from './theCast';

const CHARS = [
  { id: 'l', display_name: 'Lala', character_key: 'lala', role_type: 'special' },
  { id: 's', display_name: 'STUDIO BY SABLE', character_key: 'studio_by_sable' },
  { id: 'j1', display_name: 'Jade (Business Coach)' },
  { id: 'j2', display_name: 'Jade' },
  { id: 'd', display_name: 'Diego Martinez' },
  { id: 'r', display_name: 'Rival' },
];
const PROFILES = [
  { id: 1, feed_layer: 'lalaverse', handle: 'studiobysable', display_name: 'STUDIO BY SABLE', society_archetype: 'the_peer', registry_character_id: 's' },
  { id: 2, feed_layer: 'lalaverse', handle: 'slowsift', display_name: null, archetype: 'soft_life', registry_character_id: null },
  { id: 3, feed_layer: 'real_world', handle: 'celeb', registry_character_id: 'r' },
];

describe('the cast', () => {
  test('Lala by her key, else her name', () => {
    expect(findLala(CHARS).id).toBe('l');
    expect(findLala([{ id: 'x', display_name: ' lala ' }]).id).toBe('x');
    expect(findLala([{ id: 'y', display_name: 'Lalah' }])).toBeNull();
  });

  test('her world is the LalaVerse profiles, with their characters; real-world ones are not', () => {
    const people = feedPeople(PROFILES, CHARS);
    expect(people.map((p) => p.name)).toEqual(['STUDIO BY SABLE', 'slowsift']);
    expect(people[0]).toMatchObject({ handle: 'studiobysable', archetype: 'The peer', characterId: 's' });
    expect(people[0].character.id).toBe('s');
    expect(people[1]).toMatchObject({ archetype: 'Soft life', characterId: null, character: null });
  });

  test('the old system is every other character, Lala aside, by name; a real-world link does not count', () => {
    expect(oldSystem(CHARS, PROFILES, findLala(CHARS)).map((c) => c.id)).toEqual(['d', 'j2', 'j1', 'r']);
  });

  test('characters sharing a first name are flagged', () => {
    const twins = sameNames(CHARS);
    expect(twins).toEqual({ j1: 2, j2: 2 });
    expect(sameNameNote(2, 'Jade (Business Coach)')).toBe('Two "Jade"s');
  });

  test('no archetype reads as none', () => {
    expect(archetypeLabel({})).toBeNull();
  });
});

describe('castCounts: the Characters tile counts as The cast does', () => {
  const REGS = [
    { id: 'r1', show_id: 's1', characters: [{ id: 'l', display_name: 'Lala', character_key: 'lala' }, { id: 's', display_name: 'Sable' }, { id: 'd', display_name: 'Diego' }, { id: 'k', display_name: 'Kim' }] },
    { id: 'r2', show_id: 's2', characters: [{ id: 'o', display_name: 'Other' }] },
  ];
  const PROFS = [{ id: 1, feed_layer: 'lalaverse', registry_character_id: 's' }, { id: 2, feed_layer: 'lalaverse' }, { id: 3, feed_layer: 'real_world' }];

  test("the show's registry: feed people, and its old system less the kept", () => {
    expect(castCounts({ registries: REGS, profiles: PROFS, showId: 's1' })).toEqual({ people: 2, toReview: 2, registryId: 'r1' });
    expect(castCounts({ registries: REGS, profiles: PROFS, showId: 's1', review: { byId: { k: { cast_review: 'kept' } } } }).toReview).toBe(1);
  });

  test('the only registry when none is the show\'s; none chosen among several', () => {
    expect(castCounts({ registries: [{ ...REGS[0], show_id: null }], profiles: PROFS, showId: 's9' }).registryId).toBe('r1');
    expect(castCounts({ registries: REGS, profiles: PROFS, showId: 's9' })).toEqual({ people: 2, toReview: null, registryId: null });
  });
});
