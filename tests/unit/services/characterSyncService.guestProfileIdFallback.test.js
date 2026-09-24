/**
 * characterSyncService — the guest profile_id/id fallback
 *
 * Task #1686: guest_profiles entries written by assembleGuestList
 * (eventAutomationService.js, the from-profile and calendar-driven paths)
 * key the Social Profile link as profile_id. Guests written by the
 * opportunity pipeline before this task's fix (feedEventPipelineService.js)
 * keyed it as id instead — the old syncAfterEvent guard, `if
 * (!guest.profile_id) continue`, silently skipped every one of those
 * guests, so they never accumulated a relationship with Lala. The guest
 * readers fall back to guest.id when guest.profile_id is absent, so guests
 * already stored the old way resolve with no data repair
 * (docs/GUEST_OWNERSHIP_READ.md §6).
 *
 * Task #1818 split syncAfterEvent into recordEventHistory (generation) and
 * applyEventOutcome (completion); both keep the fallback.
 */

const { recordEventHistory, applyEventOutcome } = require('../../../src/services/characterSyncService');

function makeProfile(overrides = {}) {
  const profile = {
    id: 'profile-1',
    handle: 'someone',
    current_state: 'controversial',
    full_profile: {
      attended_events: [
        { event_id: 'older-1', date: new Date().toISOString() },
        { event_id: 'older-2', date: new Date().toISOString() },
      ],
    },
    lala_relevance_score: 0,
    update: jest.fn(async (updates) => Object.assign(profile, updates)),
    ...overrides,
  };
  return profile;
}

function makeEvent(guestProfiles) {
  return {
    id: 'event-1',
    name: 'Test Gala',
    prestige: 5,
    canon_consequences: { automation: { guest_profiles: guestProfiles } },
  };
}

const episode = { id: 'episode-1', episode_number: 1, evaluation_json: null };

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

describe.each([
  ['recordEventHistory (generation)', (event, models) => recordEventHistory(event, episode, models), r => r.updated],
  // fail on a controversial guest → cancelled, so the guest is written.
  ['applyEventOutcome (completion)', (event, models) => applyEventOutcome(event, 'fail', models), r => r.guests_updated],
])('%s — guest profile_id/id fallback', (_label, run, count) => {
  it('resolves a guest stored with the current profile_id shape (assembleGuestList)', async () => {
    const guestProfile = makeProfile({ id: 'profile-current' });
    const findByPk = jest.fn(async (id) => (id === 'profile-current' ? guestProfile : null));
    const models = { SocialProfile: { findByPk } };

    const event = makeEvent([{ profile_id: 'profile-current', handle: 'current-shape' }]);
    const result = await run(event, models);

    expect(findByPk).toHaveBeenCalledWith('profile-current');
    expect(guestProfile.update).toHaveBeenCalledTimes(1);
    expect(count(result)).toBe(1);
  });

  it('still resolves a guest stored with the old id-only shape (opportunity pipeline, pre-fix)', async () => {
    const guestProfile = makeProfile({ id: 'profile-old' });
    const findByPk = jest.fn(async (id) => (id === 'profile-old' ? guestProfile : null));
    const models = { SocialProfile: { findByPk } };

    // No profile_id key at all — exactly what scheduleOpportunityAsEvent
    // wrote before this task's fix.
    const event = makeEvent([{ id: 'profile-old', handle: 'old-shape' }]);
    const result = await run(event, models);

    expect(findByPk).toHaveBeenCalledWith('profile-old');
    expect(guestProfile.update).toHaveBeenCalledTimes(1);
    expect(count(result)).toBe(1);
  });

  it('still skips a guest with neither key, same as before', async () => {
    const findByPk = jest.fn();
    const models = { SocialProfile: { findByPk } };

    const event = makeEvent([{ handle: 'no-link-at-all' }]);
    const result = await run(event, models);

    expect(findByPk).not.toHaveBeenCalled();
    expect(count(result)).toBe(0);
  });
});
