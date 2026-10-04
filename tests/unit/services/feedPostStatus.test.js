/**
 * services/feedPostStatus — draft and live (the Feed project, step 2,
 * 2026-10-04; docs/FEED_POSTS.md).
 */
const { statusWhere, isLive, publishEpisodePosts, LOCKED_MESSAGE, STATUSES } = require('../../../src/services/feedPostStatus');

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

describe('publishEpisodePosts', () => {
  test('dates the undated drafts at the publish moment, then sets the episode\'s drafts live', async () => {
    const update = jest.fn(async () => [3]);
    const at = new Date('2026-09-20T20:00:00Z');
    const went = await publishEpisodePosts({ FeedPost: { update } }, 'ep-1', { publishedAt: at });
    expect(went).toBe(3);
    expect(update).toHaveBeenNthCalledWith(1, { posted_at: at }, { where: { episode_id: 'ep-1', status: 'draft', posted_at: null } });
    expect(update).toHaveBeenNthCalledWith(2, { status: 'live' }, { where: { episode_id: 'ep-1', status: 'draft' } });
  });
  test('nothing to do without a model or an episode', async () => {
    expect(await publishEpisodePosts({}, 'ep-1')).toBe(0);
    expect(await publishEpisodePosts({ FeedPost: { update: jest.fn() } }, null)).toBe(0);
  });
});
