/**
 * services/feedPostStatus — draft and live (the Feed project, step 2,
 * 2026-10-04; docs/FEED_POSTS.md).
 */
const { statusWhere, isLive, LOCKED_MESSAGE, STATUSES } = require('../../../src/services/feedPostStatus');

describe('statusWhere', () => {
  test('live by default, all for both, one of the two by name, else an error', () => {
    expect(statusWhere(undefined)).toEqual({ status: 'live' });
    expect(statusWhere('')).toEqual({ status: 'live' });
    expect(statusWhere('all')).toEqual({});
    expect(statusWhere('draft')).toEqual({ status: 'draft' });
    expect(statusWhere('live')).toEqual({ status: 'live' });
    expect(statusWhere('archived')).toEqual({ error: 'status must be draft, live or all' });
    expect(STATUSES).toEqual(['draft', 'live']);
  });
});

describe('isLive and the lock', () => {
  test('a live post is locked; a draft is not', () => {
    expect(isLive({ status: 'live' })).toBe(true);
    expect(isLive({ status: 'draft' })).toBe(false);
    expect(isLive(null)).toBe(false);
    expect(LOCKED_MESSAGE).toMatch(/only deleted/);
  });
});

test('publishing no longer releases drafts: there is no release-all (Task #2749)', () => {
  expect(require('../../../src/services/feedPostStatus')).not.toHaveProperty('publishEpisodePosts');
});
