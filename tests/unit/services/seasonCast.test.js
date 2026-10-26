/**
 * services/seasonCast castFrom (the Season page's Cast tab, 2026-10-26):
 * who appears in which slot and what changed between them, per part, from
 * what was read. Pure.
 */
const { castFrom, eventPeople } = require('../../../src/services/seasonCast');

const arc = { id: 'arc1', title: 'S1', season_number: 1, phases: [
  { phase: 1, title: 'First', episode_start: 1, episode_end: 2 },
  { phase: 2, title: 'Second', episode_start: 3, episode_end: 4 },
] };
const event = (host, guests) => ({ id: `ev-${host}`, name: `Hosted by ${host}`, source_profile_id: host, canon_consequences: { automation: { guest_profiles: guests.map((g) => ({ profile_id: g })) } } });
const profiles = new Map([
  ['10', { name: 'Truthville', character_id: 'c-truth' }],
  ['11', { name: 'Marcus', character_id: null }],
]);

describe('eventPeople', () => {
  it('reads the host (the field, else the copy) and the guests without the host', () => {
    expect(eventPeople(event(10, [11, 10]))).toEqual({ host: 10, guests: ['11'] });
    expect(eventPeople({ canon_consequences: JSON.stringify({ automation: { host_profile_id: 12, guest_profiles: [{ id: 13 }] } }) })).toEqual({ host: 12, guests: ['13'] });
    expect(eventPeople(null)).toEqual({ host: null, guests: [] });
  });
});

describe('castFrom', () => {
  const slots = [
    { slot_number: 2, phase: 1, episode_id: 'ep2', event: event(10, [11]) },
    { slot_number: 3, phase: 2, episode_id: 'ep3', event: null },
    { slot_number: 11, phase: 2, episode_id: null, event: event(10, []) },
  ];

  it('lists each person once with their slots and roles, most episodes first, Lala first', () => {
    const out = castFrom({
      arc, slots, profiles, lalaId: 'c-lala',
      records: [{ episode_id: 'ep3', characters: [{ character_id: 'c-lala', name: 'Lala' }, { character_id: 'c-truth', name: 'Truthville' }], relationships: [] }],
    });
    expect(out.people.map((p) => [p.name, p.slots, p.roles])).toEqual([
      ['Lala', [3], { 3: 'story' }],
      ['Truthville', [2, 3, 11], { 2: 'host', 3: 'story', 11: 'host' }],
      ['Marcus', [2], { 2: 'guest' }],
    ]);
    // A linked character links the person page; an unlinked profile does not.
    expect(out.people.find((p) => p.name === 'Truthville').character_id).toBe('c-truth');
    expect(out.people.find((p) => p.name === 'Marcus')).toMatchObject({ character_id: null, key: 'profile:11', profile_id: 11 });
    expect(out.people[0].is_lala).toBe(true);
  });

  it('puts each relationship change in its part, a saved row over the record\'s line for the same pair', () => {
    const out = castFrom({
      arc, slots, profiles,
      relEvents: [{ episode_id: 'ep3', a_id: 'c-truth', b_id: 'c-lala', a_name: 'Truthville', b_name: 'Lala', relationship_type: 'rival', stage_before: 'friends', stage_after: 'enemies' }],
      records: [{ episode_id: 'ep3', characters: [], relationships: [
        { a: 'c-lala', b: 'c-truth', a_name: 'Lala', b_name: 'Truthville', stage_after: 'rivals', keep: true },
        { a: 'c-lala', b: 'profile:11', a_name: 'Lala', b_name: 'Marcus', stage_before: 'strangers', stage_after: 'friends', keep: true },
        { a: 'c-lala', b: 'c-x', a_name: 'Lala', b_name: 'X', keep: false },
      ] }],
    });
    expect(out.parts.map((p) => [p.phase, p.title, p.changes.length])).toEqual([[1, 'First', 0], [2, 'Second', 2]]);
    const [marcus, truth] = out.parts[1].changes;
    expect(truth).toMatchObject({ slot_number: 3, source: 'saved', stage_before: 'friends', stage_after: 'enemies', a: { id: 'c-truth', name: 'Truthville' } });
    expect(marcus).toMatchObject({ source: 'record', a: { name: 'Lala' }, b: { id: null, name: 'Marcus' }, stage_after: 'friends' });
  });

  it('a slot of another season and an empty season read as nobody', () => {
    const out = castFrom({ arc, slots: [], records: [{ episode_id: 'elsewhere', characters: [{ character_id: 'c1', name: 'One' }], relationships: [] }] });
    expect(out.people).toEqual([]);
    expect(out.parts.every((p) => p.changes.length === 0)).toBe(true);
    expect(castFrom({}).arc).toBeNull();
  });
});
