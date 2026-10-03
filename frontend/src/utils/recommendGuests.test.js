/**
 * recommendGuests — the few people the story should use, with a role and
 * why (Evoni, 2026-10-03, episode creation step 5).
 */
import { describe, test, expect } from 'vitest';
import { recommendGuests, roleFor } from './recommendGuests';

const profile = (id, extra = {}) => ({ id, handle: `h${id}`, display_name: `P${id}`, lala_relevance_score: 0, ...extra });

describe('roleFor', () => {
  test('the first rule that fits gives the role and why', () => {
    expect(roleFor({ lalaRelationship: 'competitive' })).toEqual({ role: 'tension', reason: 'Competes with Lala' });
    expect(roleFor({ hostRelationship: 'feud', lalaRelationship: 'direct' }).role).toBe('rival');
    expect(roleFor({ lalaRelationship: 'direct' }).role).toBe('friend');
    expect(roleFor({ hostRelationship: 'ex' }).role).toBe('wildcard');
    expect(roleFor({ careerPressure: 'ahead' }).role).toBe('mentor');
    expect(roleFor({ lalaRelationship: 'aware' }).role).toBe('opportunity');
    expect(roleFor({ lalaRelationship: 'mutual_unaware' }).role).toBe('wildcard');
    expect(roleFor({})).toEqual({ role: 'opportunity', reason: 'Relevant to Lala on the Feed' });
  });
});

describe('recommendGuests', () => {
  test('ranks by how they know Lala, the organizer, the venue and the invite, mixing roles', () => {
    const picks = recommendGuests({
      guests: [
        { profile_id: 1, display_name: 'Maya', relationship: 'collab' },
        { profile_id: 2, display_name: 'Tasha', relationship: 'rival' },
      ],
      profiles: [
        profile(1, { display_name: 'Maya Chen', lala_relationship: 'aware' }),
        profile(2, { display_name: 'Tasha Monroe', lala_relationship: 'mutual_unaware' }),
        profile(3, { display_name: 'Dana', lala_relationship: 'direct', frequent_venues: ['loc-1'] }),
        profile(4, { display_name: 'Nobody', lala_relevance_score: 10 }),
      ],
      venueLocationId: 'loc-1',
    });
    expect(picks.map((p) => [p.display_name, p.role])).toEqual([
      ['Dana', 'friend'],
      ['Maya Chen', 'opportunity'],
      ['Tasha Monroe', 'rival'],
    ]);
    expect(picks[0]).toMatchObject({ invited: false, reason: 'Knows Lala; often at this venue' });
    expect(picks[1]).toMatchObject({ invited: true, profile_id: 1 });
  });

  test('a repeated role costs enough to let a different role through when close', () => {
    const picks = recommendGuests({
      profiles: [
        profile(1, { lala_relationship: 'direct' }),
        profile(2, { lala_relationship: 'direct', lala_relevance_score: 10 }),
        profile(3, { lala_relationship: 'competitive' }),
      ],
      count: 2,
    });
    expect(picks.map((p) => p.role)).toEqual(['friend', 'tension']);
  });

  test('never the organizer, anyone already featured, or JustAWoman\'s records', () => {
    const picks = recommendGuests({
      guests: [{ profile_id: 5, featured: true }],
      profiles: [
        profile(4, { lala_relationship: 'direct' }),
        profile(5, { lala_relationship: 'direct' }),
        profile(6, { is_justawoman_record: true, lala_relationship: 'direct' }),
        profile(7, { lala_relationship: 'justawoman' }),
        profile(8),
      ],
      organizerProfileId: 4,
    });
    expect(picks.map((p) => p.profile_id)).toEqual([8]);
  });

  test('invited guests without a Feed profile loaded still count, by their invite', () => {
    const picks = recommendGuests({ guests: [{ profile_id: 9, display_name: 'Zoe', relationship: 'bestie' }] });
    expect(picks).toEqual([expect.objectContaining({ profile_id: 9, display_name: 'Zoe', invited: true, role: 'opportunity', reason: "In the organizer's circle" })]);
  });

  test('nothing to recommend from', () => {
    expect(recommendGuests()).toEqual([]);
  });
});
