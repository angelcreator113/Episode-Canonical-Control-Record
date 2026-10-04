/**
 * services/feedMomentLink createMomentForPost — put a post at a beat
 * (2026-10-04, picked from the Social Media wall).
 */
const { createMomentForPost } = require('../../../src/services/feedMomentLink');

function makeModels({ episode = { id: 'ep-1' }, post = { id: 'p-1', show_id: 's-1', status: 'live', episode_id: null, poster_handle: 'lala' }, existing = null, count = 2 } = {}) {
  const FeedMoment = {
    findOne: jest.fn(async () => existing),
    count: jest.fn(async () => count),
    create: jest.fn(async (row) => ({ id: 'm-new', ...row, toJSON() { return this; } })),
  };
  const FeedPost = { findOne: jest.fn(async () => post && { ...post, toJSON: () => post }) };
  const Episode = { findOne: jest.fn(async () => episode) };
  return { FeedMoment, FeedPost, Episode };
}
const args = (o = {}) => ({ showId: 's-1', episodeId: 'ep-1', beatNumber: 5, feedPostId: 'p-1', ...o });

describe('createMomentForPost', () => {
  test('creates the beat\'s phone moment pointing at the post, after the beat\'s other moments', async () => {
    const m = makeModels();
    const { moment, created } = await createMomentForPost(m, args());
    expect(created).toBe(true);
    expect(m.Episode.findOne).toHaveBeenCalledWith({ where: { id: 'ep-1', show_id: 's-1' }, attributes: ['id'] });
    expect(m.FeedMoment.create).toHaveBeenCalledWith({ show_id: 's-1', episode_id: 'ep-1', beat_number: 5, phone_screen_type: 'post', trigger_handle: 'lala', feed_post_id: 'p-1', sort_order: 2 });
    expect(moment.id).toBe('m-new');
  });
  test('the same post at the same beat is not doubled', async () => {
    const m = makeModels({ existing: { id: 'm-old' } });
    const { moment, created } = await createMomentForPost(m, args());
    expect(created).toBe(false);
    expect(moment.id).toBe('m-old');
    expect(m.FeedMoment.create).not.toHaveBeenCalled();
  });
  test('refuses a bad beat, another show\'s episode or post, a draft outside its episode', async () => {
    await expect(createMomentForPost(makeModels(), args({ beatNumber: 15 }))).rejects.toMatchObject({ status: 400, message: 'beat_number must be 1-14' });
    await expect(createMomentForPost(makeModels(), args({ feedPostId: null }))).rejects.toMatchObject({ status: 400 });
    await expect(createMomentForPost(makeModels({ episode: null }), args())).rejects.toMatchObject({ status: 404, message: 'Episode not found in this show' });
    await expect(createMomentForPost(makeModels({ post: { id: 'p-1', show_id: 's-2', status: 'live' } }), args())).rejects.toMatchObject({ status: 400, message: /another show/ });
    await expect(createMomentForPost(makeModels({ post: { id: 'p-1', show_id: 's-1', status: 'draft', episode_id: 'ep-9' } }), args())).rejects.toMatchObject({ status: 400, message: /its own episode/ });
    await expect(createMomentForPost(makeModels({ post: null }), args())).rejects.toMatchObject({ status: 404, message: 'Post not found' });
  });
});
