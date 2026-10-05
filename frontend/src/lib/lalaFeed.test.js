import { describe, test, expect } from 'vitest';
import { postsFor, posterName, isLalasPost, postOrigin, goesLive, timeAgo } from './lalaFeed';

const drafts = [
  { id: 'd1', poster_handle: 'lala', content_text: 'a', status: 'draft' },
  { id: 'd2', poster_handle: 'stable', episode_id: 'e1', status: 'draft', ai_generated: true },
];
const live = [{ id: 'l1', poster_handle: 'mayaxo', status: 'live' }];

describe("Lala's Feed helpers", () => {
  test('Queue holds drafts waiting on approval, Scheduled the episode drafts, Live the posted ones', () => {
    expect(postsFor('queue', drafts, live).map((p) => p.id)).toEqual(['d1']);
    expect(postsFor('scheduled', drafts, live).map((p) => p.id)).toEqual(['d2']);
    expect(postsFor('live', drafts, live).map((p) => p.id)).toEqual(['l1']);
    expect(postsFor('queue', null, null)).toEqual([]);
    expect(postsFor('deleted', drafts, live, [{ id: 'x' }]).map((p) => p.id)).toEqual(['x']);
    expect(postsFor('deleted', drafts, live, null)).toEqual([]);
  });

  test('a poster is their display name, their profile name, or their handle', () => {
    expect(posterName({ poster_display_name: 'Lala', poster_handle: 'lala' })).toBe('Lala');
    expect(posterName({ socialProfile: { display_name: 'Maya' }, poster_handle: 'mayaxo' })).toBe('Maya');
    expect(posterName({ poster_handle: '@stable' })).toBe('@stable');
    expect(posterName({})).toBe('Lala');
  });

  test('where a post came from', () => {
    expect(isLalasPost({ poster_handle: '@Lala' })).toBe(true);
    expect(postOrigin({ poster_handle: 'lala' })).toBe('Written by you');
    expect(postOrigin({ poster_handle: 'lala', ai_generated: true })).toBe('Drafted in her voice');
    expect(postOrigin({ poster_handle: 'stable', ai_generated: true })).toBe('Drafted from their profile and voice');
  });

  test('when a draft goes live', () => {
    expect(goesLive(drafts[0])).toBe('Goes live when you approve it');
    expect(goesLive(drafts[1], [{ id: 'e1', episode_number: 4 }])).toBe('Goes live with Episode 4');
    expect(goesLive(live[0])).toBeNull();
  });

  test('time ago', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(timeAgo('2026-10-05T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-05T11:46:00Z', now)).toBe('14 minutes ago');
    expect(timeAgo('2026-10-05T10:00:00Z', now)).toBe('2 hours ago');
    expect(timeAgo('2026-10-03T12:00:00Z', now)).toBe('2 days ago');
    expect(timeAgo(null, now)).toBeNull();
  });
});
