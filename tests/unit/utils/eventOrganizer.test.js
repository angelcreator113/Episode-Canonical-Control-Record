// eventOrganizer (Task #1791) — the event's creator organizer: source_profile_id
// first, the automation copy's host_profile_id as the fallback.
const { eventCreatorOrganizer, isOrganizedByProfile } = require('../../../src/utils/eventOrganizer');

const copy = (automation) => ({ canon_consequences: { automation } });

describe('eventCreatorOrganizer — the four cases', () => {
  test('(a) source_profile_id only: the column, no copied names', () => {
    expect(eventCreatorOrganizer({ source_profile_id: 7, host: 'Mika', canon_consequences: {} })).toEqual({
      profileId: 7, handle: null, displayName: null, registryCharacterId: null, fromSavedCopy: false,
    });
  });
  test('(b) the automation copy only: the copy, with its names', () => {
    expect(eventCreatorOrganizer(copy({ host_profile_id: 7, host_handle: 'mika', host_display_name: 'Mika', host_registry_character_id: 'rc1' }))).toEqual({
      profileId: 7, handle: 'mika', displayName: 'Mika', registryCharacterId: 'rc1', fromSavedCopy: true,
    });
  });
  test('(c) both naming the same person: the column, with the copy\'s names', () => {
    expect(eventCreatorOrganizer({ source_profile_id: 7, ...copy({ host_profile_id: '7', host_handle: 'mika', host_display_name: 'Mika' }) })).toMatchObject({
      profileId: 7, handle: 'mika', displayName: 'Mika', fromSavedCopy: false,
    });
  });
  test('(d) a brand organizer with neither: no creator', () => {
    expect(eventCreatorOrganizer({ host_brand: 'Velour', source_profile_id: null, ...copy({ host_brand: 'Velour' }) })).toBeNull();
  });
});

describe('eventCreatorOrganizer — edges', () => {
  test('column and copy naming different people: the column wins and the copy\'s names are not used', () => {
    expect(eventCreatorOrganizer({ source_profile_id: 9, ...copy({ host_profile_id: 7, host_handle: 'mika', host_display_name: 'Mika' }) })).toEqual({
      profileId: 9, handle: null, displayName: null, registryCharacterId: null, fromSavedCopy: false,
    });
  });
  test('canon_consequences stored as a JSON string is read', () => {
    expect(eventCreatorOrganizer({ canon_consequences: JSON.stringify({ automation: { host_profile_id: 7 } }) }).profileId).toBe(7);
  });
  test('no event, no canon_consequences, or an empty copy id: no creator', () => {
    expect(eventCreatorOrganizer(null)).toBeNull();
    expect(eventCreatorOrganizer({})).toBeNull();
    expect(eventCreatorOrganizer(copy({ host_profile_id: '' }))).toBeNull();
  });
});

describe('isOrganizedByProfile', () => {
  test('matches the resolved creator across number and string ids', () => {
    expect(isOrganizedByProfile({ source_profile_id: 7 }, '7')).toBe(true);
    expect(isOrganizedByProfile(copy({ host_profile_id: 7 }), 7)).toBe(true);
    expect(isOrganizedByProfile({ source_profile_id: 9, ...copy({ host_profile_id: 7 }) }, 7)).toBe(false);
    expect(isOrganizedByProfile({ host_brand: 'Velour' }, 7)).toBe(false);
    expect(isOrganizedByProfile({ source_profile_id: 7 }, null)).toBe(false);
  });
});
