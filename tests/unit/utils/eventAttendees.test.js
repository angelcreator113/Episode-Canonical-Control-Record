/**
 * Who attended an event (Task #3082; Evoni, 2026-10-13): the host by
 * default, alongside the Event Package's Guests; the older guest_list column
 * and invitations do not count.
 */
const { eventAttendees } = require('../../../src/utils/eventAttendees');

describe('eventAttendees', () => {
  test('the Guests and the host (the organizer field first)', () => {
    const ev = { source_profile_id: 7, canon_consequences: { automation: { host_profile_id: 9, guest_profiles: [{ profile_id: 3 }, { social_profile_id: 4 }, 5] } } };
    expect([...eventAttendees(ev)].sort()).toEqual([3, 4, 5, 7]);
  });

  test('the host from the automation copy when the field is empty; stored JSON is read', () => {
    const ev = { source_profile_id: null, canon_consequences: JSON.stringify({ automation: { host_profile_id: 9, guest_profiles: [{ profile_id: 3 }] } }) };
    expect([...eventAttendees(ev)].sort()).toEqual([3, 9]);
  });

  test('the legacy guest_list does not count; bad entries are skipped; a brand event has no host', () => {
    const ev = { guest_list: [{ profile_id: 11 }], canon_consequences: { automation: { guest_profiles: [{ profile_id: 'x' }, null, { profile_id: 2 }] } } };
    expect([...eventAttendees(ev)]).toEqual([2]);
    expect(eventAttendees({}).size).toBe(0);
    expect(eventAttendees({ canon_consequences: '{bad' }).size).toBe(0);
  });
});
