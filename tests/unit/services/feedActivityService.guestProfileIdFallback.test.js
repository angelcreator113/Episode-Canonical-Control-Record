/**
 * feedActivityService — generatePostEventActivity's guest profile_id/id
 * fallback
 *
 * Task #1686: a simulated feed post for a guest used to carry
 * `profile_id: guest.profile_id`, which was undefined for any guest
 * written by the opportunity pipeline's old, id-keyed shape — an
 * unlinkable post with no error. Now falls back to guest.id
 * (docs/GUEST_OWNERSHIP_READ.md §6).
 */

const { generatePostEventActivity } = require('../../../src/services/feedActivityService');

function makeEvent(guestProfiles) {
  return {
    id: 'event-1',
    name: 'Test Gala',
    canon_consequences: {
      automation: {
        host_profile_id: null,
        host_handle: 'the-host',
        guest_profiles: guestProfiles,
      },
    },
  };
}

describe('generatePostEventActivity — guest profile_id/id fallback', () => {
  it('carries profile_id through for a guest in the current profile_id shape', async () => {
    const event = makeEvent([{ profile_id: 'profile-current', handle: 'current-shape', relationship: 'industry' }]);

    const posts = await generatePostEventActivity(event, {});

    expect(posts).toHaveLength(1);
    expect(posts[0].profile_id).toBe('profile-current');
  });

  it('falls back to id for a guest still in the old, pre-fix shape', async () => {
    const event = makeEvent([{ id: 'profile-old', handle: 'old-shape', relationship: 'industry' }]);

    const posts = await generatePostEventActivity(event, {});

    expect(posts).toHaveLength(1);
    expect(posts[0].profile_id).toBe('profile-old');
  });
});
