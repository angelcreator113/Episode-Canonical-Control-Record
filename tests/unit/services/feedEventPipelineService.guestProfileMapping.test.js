/**
 * feedEventPipelineService — toGuestProfile
 *
 * Task #1686: the opportunity pipeline's guest_profiles writer
 * (scheduleOpportunityAsEvent) used to shape each guest as
 * { id, handle, display_name } — every other guest_profiles writer
 * (assembleGuestList, eventAutomationService.js) uses { profile_id, ... }.
 * Every profile_id-reading consumer (characterSyncService,
 * storyGenerationService, episodeScriptWriterService, feedActivityService)
 * silently dropped guests written the old way. toGuestProfile is the named,
 * extracted mapping function that fixes this — tested here on its own since
 * scheduleOpportunityAsEvent itself has a pre-existing, unrelated bug (it
 * references `prestige` before its own `const prestige` declaration,
 * `feedEventPipelineService.js` around the venue-generation call) that
 * throws a ReferenceError before ever reaching the guest-mapping line,
 * making the full function untestable without fixing that separate bug —
 * reported, not fixed, per this task's scope.
 */

const { toGuestProfile } = require('../../../src/services/feedEventPipelineService');

describe('toGuestProfile', () => {
  it('shapes a raw social_profiles row into a profile_id-keyed guest, matching assembleGuestList', () => {
    const row = { id: 'profile-42', handle: 'glossygal', display_name: 'Glossy Gal', platform: 'instagram', follower_tier: 'mid' };

    const guest = toGuestProfile(row);

    expect(guest).toEqual({ profile_id: 'profile-42', handle: 'glossygal', display_name: 'Glossy Gal' });
    expect(guest.id).toBeUndefined();
  });

  it('maps a whole result set the same way scheduleOpportunityAsEvent would', () => {
    const rows = [
      { id: 'p1', handle: 'a', display_name: 'A' },
      { id: 'p2', handle: 'b', display_name: 'B' },
    ];

    const guests = rows.map(toGuestProfile);

    expect(guests).toEqual([
      { profile_id: 'p1', handle: 'a', display_name: 'A' },
      { profile_id: 'p2', handle: 'b', display_name: 'B' },
    ]);
  });
});
