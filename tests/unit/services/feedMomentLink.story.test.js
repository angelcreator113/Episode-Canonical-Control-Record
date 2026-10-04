/**
 * The story clock at the beat (docs/FEED_POSTS.md rule 9): a post can be
 * put at a beat only when it exists by then in story time.
 */
const { createMomentForPost, linkMomentToPost } = require('../../../src/services/feedMomentLink');

const EPISODES = { 'ep-2': { id: 'ep-2', episode_number: 2 }, 'ep-3': { id: 'ep-3', episode_number: 3 } };
function makeModels(post) {
  return {
    Episode: { findOne: jest.fn(async ({ where }) => EPISODES[where.id] || null) },
    FeedPost: { findOne: jest.fn(async () => ({ show_id: 's-1', ...post, toJSON: () => post })) },
    FeedMoment: {
      // By id (the link route) it is the beat's moment; by episode and beat (the duplicate check) there is none.
      findOne: jest.fn(async ({ where }) => (where.id ? { id: 'm-1', episode_id: 'ep-2', update: jest.fn() } : null)),
      count: jest.fn(async () => 0),
      create: jest.fn(async (row) => ({ id: 'm-new', ...row })),
    },
  };
}
const put = (models, episodeId) => createMomentForPost(models, { showId: 's-1', episodeId, beatNumber: 5, feedPostId: 'p-1' });

describe('story clock at the beat', () => {
  test('an earlier episode\'s post, or a wall post stamped before, may be shown', async () => {
    await expect(put(makeModels({ id: 'p-1', status: 'live', episode_id: 'ep-2', timeline_position: 'after_episode' }), 'ep-3')).resolves.toMatchObject({ created: true, story: 'ok' });
    await expect(put(makeModels({ id: 'p-1', status: 'live', episode_id: null, story_order: 27 }), 'ep-3')).resolves.toMatchObject({ story: 'ok' });
  });
  test('a post from later in story time is refused with 409', async () => {
    await expect(put(makeModels({ id: 'p-1', status: 'live', episode_id: 'ep-3' }), 'ep-2')).rejects.toMatchObject({ status: 409, message: /During Ep 3; a beat of Ep 2 is earlier/ });
    await expect(put(makeModels({ id: 'p-1', status: 'draft', episode_id: 'ep-2', timeline_position: 'after_episode' }), 'ep-2')).rejects.toMatchObject({ status: 409, message: /After Ep 2/ });
    await expect(put(makeModels({ id: 'p-1', status: 'live', episode_id: null, story_order: 47 }), 'ep-3')).rejects.toMatchObject({ status: 409 });
  });
  test('an older wall post with no stamp passes as unknown', async () => {
    await expect(put(makeModels({ id: 'p-1', status: 'live', episode_id: null }), 'ep-2')).resolves.toMatchObject({ story: 'unknown' });
  });
  test('linking an existing moment checks the same clock', async () => {
    const m = makeModels({ id: 'p-1', status: 'live', episode_id: 'ep-3' });
    await expect(linkMomentToPost(m, { showId: 's-1', momentId: 'm-1', feedPostId: 'p-1' })).rejects.toMatchObject({ status: 409 });
  });
});
