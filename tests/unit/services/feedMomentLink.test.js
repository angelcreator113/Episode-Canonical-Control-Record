/**
 * services/feedMomentLink — a beat points at a post (the Feed project,
 * step 3, 2026-10-04; docs/FEED_POSTS.md).
 */
const { linkMomentToPost, LinkError } = require('../../../src/services/feedMomentLink');

const SHOW = 's-1';
function makeModels({ moment = { id: 'm-1', episode_id: 'ep-1' }, post = null, postShow = SHOW } = {}) {
  const momentRow = moment && { ...moment, update: jest.fn(async function (u) { Object.assign(this, u); }) };
  const FeedMoment = { findOne: jest.fn(async () => momentRow) };
  const FeedPost = { findOne: jest.fn(async ({ attributes }) => {
    if (!post) return null;
    if (attributes && attributes.length === 1 && attributes[0] === 'show_id') return { show_id: postShow };
    return { ...post, toJSON: () => post };
  }) };
  return { FeedMoment, FeedPost, momentRow };
}

describe('linkMomentToPost', () => {
  test('links a live post of the show to the moment', async () => {
    const m = makeModels({ post: { id: 'p-1', status: 'live', episode_id: null } });
    const { moment, post } = await linkMomentToPost(m, { showId: SHOW, momentId: 'm-1', feedPostId: 'p-1' });
    expect(m.momentRow.update).toHaveBeenCalledWith({ feed_post_id: 'p-1' });
    expect(moment.feed_post_id).toBe('p-1');
    expect(post.id).toBe('p-1');
    expect(m.FeedMoment.findOne).toHaveBeenCalledWith({ where: { id: 'm-1', show_id: SHOW } });
  });
  test('a draft post links only to a beat of its own episode', async () => {
    const own = makeModels({ post: { id: 'p-2', status: 'draft', episode_id: 'ep-1' } });
    await expect(linkMomentToPost(own, { showId: SHOW, momentId: 'm-1', feedPostId: 'p-2' })).resolves.toBeTruthy();
    const other = makeModels({ post: { id: 'p-3', status: 'draft', episode_id: 'ep-9' } });
    await expect(linkMomentToPost(other, { showId: SHOW, momentId: 'm-1', feedPostId: 'p-3' })).rejects.toMatchObject({ status: 400, message: /its own episode/ });
  });
  test('refuses another show\'s post, a missing post, a missing moment', async () => {
    await expect(linkMomentToPost(makeModels({ post: { id: 'p-4', status: 'live' }, postShow: 's-2' }), { showId: SHOW, momentId: 'm-1', feedPostId: 'p-4' }))
      .rejects.toMatchObject({ status: 400, message: /another show/ });
    await expect(linkMomentToPost(makeModels({ post: null }), { showId: SHOW, momentId: 'm-1', feedPostId: 'p-x' }))
      .rejects.toMatchObject({ status: 404, message: 'Post not found' });
    await expect(linkMomentToPost(makeModels({ moment: null }), { showId: SHOW, momentId: 'm-x', feedPostId: 'p-1' }))
      .rejects.toMatchObject({ status: 404, message: 'Moment not found' });
    expect(new LinkError(409, 'x').status).toBe(409);
  });
  test('null unlinks', async () => {
    const m = makeModels({ moment: { id: 'm-1', episode_id: 'ep-1', feed_post_id: 'p-1' } });
    const { post } = await linkMomentToPost(m, { showId: SHOW, momentId: 'm-1', feedPostId: null });
    expect(post).toBeNull();
    expect(m.momentRow.update).toHaveBeenCalledWith({ feed_post_id: null });
    expect(m.FeedPost.findOne).not.toHaveBeenCalled();
  });
});
