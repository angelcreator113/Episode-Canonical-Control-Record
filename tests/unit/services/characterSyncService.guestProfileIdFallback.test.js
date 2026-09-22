/**
 * characterSyncService — syncAfterEvent's guest profile_id/id fallback
 *
 * Task #1686: guest_profiles entries written by assembleGuestList
 * (eventAutomationService.js, the from-profile and calendar-driven paths)
 * key the Social Profile link as profile_id. Guests written by the
 * opportunity pipeline before this task's fix (feedEventPipelineService.js)
 * keyed it as id instead — syncAfterEvent's guard, `if (!guest.profile_id)
 * continue`, silently skipped every one of those guests, so they never
 * accumulated a relationship with Lala. syncAfterEvent now falls back to
 * guest.id when guest.profile_id is absent, so guests already stored the
 * old way start resolving with no data repair (docs/GUEST_OWNERSHIP_READ.md
 * §6).
 */

const { syncAfterEvent } = require('../../../src/services/characterSyncService');

function makeProfile(overrides = {}) {
  const profile = {
    id: 'profile-1',
    handle: 'someone',
    current_state: 'rising',
    full_profile: {},
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

describe('syncAfterEvent — guest profile_id/id fallback', () => {
  it('resolves a guest stored with the current profile_id shape (assembleGuestList)', async () => {
    const guestProfile = makeProfile({ id: 'profile-current' });
    const findByPk = jest.fn(async (id) => (id === 'profile-current' ? guestProfile : null));
    const models = { SocialProfile: { findByPk } };

    const event = makeEvent([{ profile_id: 'profile-current', handle: 'current-shape' }]);
    const result = await syncAfterEvent(event, episode, models);

    expect(findByPk).toHaveBeenCalledWith('profile-current');
    expect(guestProfile.update).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(1);
  });

  it('still resolves a guest stored with the old id-only shape (opportunity pipeline, pre-fix)', async () => {
    const guestProfile = makeProfile({ id: 'profile-old' });
    const findByPk = jest.fn(async (id) => (id === 'profile-old' ? guestProfile : null));
    const models = { SocialProfile: { findByPk } };

    // No profile_id key at all — exactly what scheduleOpportunityAsEvent
    // wrote before this task's fix.
    const event = makeEvent([{ id: 'profile-old', handle: 'old-shape' }]);
    const result = await syncAfterEvent(event, episode, models);

    expect(findByPk).toHaveBeenCalledWith('profile-old');
    expect(guestProfile.update).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(1);
  });

  it('still skips a guest with neither key, same as before', async () => {
    const findByPk = jest.fn();
    const models = { SocialProfile: { findByPk } };

    const event = makeEvent([{ handle: 'no-link-at-all' }]);
    const result = await syncAfterEvent(event, episode, models);

    expect(findByPk).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });
});
