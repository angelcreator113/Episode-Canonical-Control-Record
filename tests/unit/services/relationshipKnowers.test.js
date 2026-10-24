/**
 * Who knows about a relationship (services/relationshipKnowers, 2026-10-23),
 * without a database: the line each writer reads, what a knower entry may
 * be, and how the migration finds people named in the old "knows" notes.
 */
const { secrecyLine, entryOf, KnowerError } = require('../../../src/services/relationshipKnowers');
const { namedInNotes } = require('../../../src/migrations/20261024100000-relationship-known-by');

const entry = (public_state, names, kind = 'romance') => ({
  public_state, kind,
  pair: [{ id: 'a', name: 'Lala' }, { id: 'b', name: 'Marcus Hale' }],
  knowers: names.map((name) => ({ name })),
});

describe('secrecyLine', () => {
  test('secret: only the knowers know, nobody else mentions it', () => {
    expect(secrecyLine(entry('secret', ['Jade Monroe'])))
      .toBe("Lala and Marcus Hale's romance is SECRET: only Jade Monroe knows. Nobody else mentions it.");
    expect(secrecyLine(entry('secret', ['Jade Monroe', 'Dre', 'Nia'])))
      .toBe("Lala and Marcus Hale's romance is SECRET: only Jade Monroe, Dre and Nia know. Nobody else mentions it.");
    expect(secrecyLine(entry('secret', [])))
      .toBe("Lala and Marcus Hale's romance is SECRET: only the two of them know. Nobody else mentions it.");
  });

  test('rumoured: the knowers know for sure, everyone else may only hint', () => {
    expect(secrecyLine(entry('rumoured', ['Jade Monroe'])))
      .toBe("Lala and Marcus Hale's romance is RUMOURED: Jade Monroe knows for sure; everyone else has only heard talk, so they may hint at it or ask, never state it as fact.");
    expect(secrecyLine(entry('rumoured', [], 'relationship (rival)')))
      .toBe("Lala and Marcus Hale's relationship (rival) is RUMOURED: everyone else has only heard talk, so they may hint at it or ask, never state it as fact.");
  });

  test('known: anyone may mention it', () => {
    expect(secrecyLine(entry('known', ['Jade Monroe']))).toBe("Lala and Marcus Hale's romance is KNOWN: anyone may mention it.");
  });
});

describe('entryOf', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  test('a character id, a profile id or a name', () => {
    expect(entryOf(id)).toEqual({ registry_character_id: id });
    expect(entryOf(12)).toEqual({ profile_id: 12 });
    expect(entryOf('  The doorman ')).toEqual({ name: 'The doorman' });
    expect(entryOf({ profile_id: '7', since_episode_id: id, how: ' saw it ' })).toEqual({ profile_id: 7, since_episode_id: id, how: 'saw it' });
  });

  test('refuses what is not one person', () => {
    expect(() => entryOf(null)).toThrow(KnowerError);
    expect(() => entryOf('  ')).toThrow(KnowerError);
    expect(() => entryOf({ registry_character_id: id, name: 'Jade' })).toThrow(/one of/);
    expect(() => entryOf({ registry_character_id: 'jade' })).toThrow(/by their id/);
    expect(() => entryOf({ profile_id: -1 })).toThrow(/Feed profile/);
    expect(() => entryOf({ name: 'Jade', since_episode_id: 'four' })).toThrow(/episode id/);
    expect(() => entryOf(['Jade'])).toThrow(KnowerError);
  });
});

describe('namedInNotes (the migration backfill)', () => {
  const people = [
    { id: 'l', display_name: 'Lala' },
    { id: 'm', display_name: 'Truthville', selected_name: 'Marcus Hale' },
    { id: 'j', display_name: 'Jade Monroe' },
    { id: 'j2', display_name: 'Jade Park' },
    { id: 'd', display_name: 'Dre' },
  ];
  const ids = (text) => namedInNotes(text, people, ['l', 'm']).map((p) => p.id);

  test('full names and display names, whole words only, never the two of them', () => {
    expect(ids('Jade Monroe saw them; truthville denies it')).toEqual(['j']);
    expect(ids('Dre heard it from Lala')).toEqual(['d']);
    expect(ids('Andre has no clue')).toEqual([]);
    expect(ids('')).toEqual([]);
    expect(ids(null)).toEqual([]);
  });

  test('a first name only when one person has it', () => {
    expect(ids('Jade knows')).toEqual([]);
    expect(namedInNotes('Marcus told her', [...people, { id: 'x', display_name: 'Nia' }], ['l', 'j']).map((p) => p.id)).toEqual(['m']);
  });
});
