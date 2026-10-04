/**
 * services/feedCommentDrafter — reactions drafted in the characters' voices,
 * as draft comment records for approval (the Feed project, step 4,
 * 2026-10-04; docs/FEED_POSTS.md rule 6). The Anthropic client is a stub.
 */
const { Op } = require('sequelize');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: mockCreate } }; });

const { pickReactors, draftReactions, recountComments, buildPrompt, DraftError } = require('../../../src/services/feedCommentDrafter');

const P = (id, handle, extra = {}) => ({ id, handle, display_name: handle, status: 'generated', lala_relevance_score: 5, ...extra });
const POST = { id: 'p-1', show_id: 's-1', social_profile_id: 1, poster_handle: 'lala', poster_display_name: 'Lala', poster_platform: 'instagram', content_text: 'Gala tonight.', narrative_function: 'flex' };

function makeModels({ rels = [], profiles = [], count = 0 } = {}) {
  const SocialProfileRelationship = { findAll: jest.fn(async () => rels) };
  const SocialProfile = { findAll: jest.fn(async ({ where, limit }) => {
    let list = profiles;
    if (where.id?.[Op.in]) list = list.filter((p) => where.id[Op.in].includes(p.id));
    if (where.id?.[Op.notIn]) list = list.filter((p) => !where.id[Op.notIn].includes(p.id));
    return limit ? list.slice(0, limit) : list;
  }) };
  const FeedComment = { count: jest.fn(async () => count), create: jest.fn(async (row) => ({ id: `c-${row.sort_order}`, ...row })) };
  const FeedPost = { findOne: jest.fn(async () => POST), update: jest.fn(async () => [1]) };
  return { SocialProfileRelationship, SocialProfile, FeedComment, FeedPost };
}

beforeEach(() => { mockCreate.mockReset(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('pickReactors', () => {
  test('the poster\'s connections first (by drama), then the most Lala-relevant, never the poster', async () => {
    const m = makeModels({
      rels: [{ source_profile_id: 1, target_profile_id: 2, relationship_type: 'rival', drama_level: 8 }, { source_profile_id: 3, target_profile_id: 1, relationship_type: 'bestie', drama_level: 2 }],
      profiles: [P(1, 'lala'), P(2, 'rival'), P(3, 'bestie'), P(4, 'fan', { lala_relevance_score: 9 }), P(5, 'other', { lala_relevance_score: 1 })],
    });
    const picked = await pickReactors(m, POST, { limit: 3 });
    expect(picked.map((r) => [r.profile.handle, r.relationship])).toEqual([['rival', 'rival'], ['bestie', 'bestie'], ['fan', null]]);
    const topUp = m.SocialProfile.findAll.mock.calls[1][0];
    expect(topUp.where.id[Op.notIn].sort()).toEqual([1, 2, 3]);
    expect(topUp.order).toEqual([['lala_relevance_score', 'DESC'], ['id', 'ASC']]);
  });
  test('a post with no profile falls back to relevance', async () => {
    const m = makeModels({ profiles: [P(4, 'fan'), P(5, 'other')] });
    const picked = await pickReactors(m, { ...POST, social_profile_id: null }, { limit: 1 });
    expect(picked.map((r) => r.profile.handle)).toEqual(['fan']);
    expect(m.SocialProfileRelationship.findAll).not.toHaveBeenCalled();
  });
});

describe('draftReactions', () => {
  test('asks once for the reactors\' comments and saves them as drafts with a voice note', async () => {
    const m = makeModels({ rels: [{ source_profile_id: 1, target_profile_id: 2, relationship_type: 'rival', drama_level: 5 }], profiles: [P(1, 'lala'), P(2, 'rival', { posting_voice: 'cool, clipped' })], count: 2 });
    mockCreate.mockResolvedValue({ content: [{ text: 'Sure:\n[{"handle":"@rival","text":"Cute. Bold choice for a Tuesday."}]' }] });
    const { drafts, reactors } = await draftReactions(m, 'p-1', { limit: 1 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('@rival');
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('relationship to the poster: rival');
    expect(reactors).toHaveLength(1);
    expect(drafts).toHaveLength(1);
    expect(m.FeedComment.create).toHaveBeenCalledWith(expect.objectContaining({
      feed_post_id: 'p-1', show_id: 's-1', social_profile_id: 2, handle: 'rival', text: 'Cute. Bold choice for a Tuesday.',
      status: 'draft', sort_order: 2, ai_generated: true, generation_model: 'claude-sonnet-4-6', voice_note: 'rival of the poster',
    }));
  });
  test('picked reactors are used as given; an unreadable answer is a 502, no key a 503, no post a 404', async () => {
    const m = makeModels({ profiles: [P(4, 'fan'), P(5, 'other')] });
    mockCreate.mockResolvedValue({ content: [{ text: '[{"handle":"other","text":"ok"}]' }] });
    const { drafts } = await draftReactions(m, 'p-1', { reactorIds: [5] });
    expect(drafts[0].handle).toBe('other');
    expect(m.SocialProfileRelationship.findAll).not.toHaveBeenCalled();

    mockCreate.mockResolvedValue({ content: [{ text: 'no json here' }] });
    await expect(draftReactions(m, 'p-1', { reactorIds: [5] })).rejects.toMatchObject({ status: 502 });
    delete process.env.ANTHROPIC_API_KEY;
    await expect(draftReactions(m, 'p-1')).rejects.toMatchObject({ status: 503 });
    process.env.ANTHROPIC_API_KEY = 'test';
    m.FeedPost.findOne.mockResolvedValueOnce(null);
    await expect(draftReactions(m, 'p-x')).rejects.toBeInstanceOf(DraftError);
  });
  test('nobody to react is a 409, not a silent empty answer', async () => {
    const m = makeModels({ profiles: [] });
    await expect(draftReactions(m, 'p-1')).rejects.toMatchObject({ status: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('recountComments and the prompt', () => {
  test('comments_count is the live comments', async () => {
    const m = makeModels({ count: 3 });
    expect(await recountComments(m, 'p-1')).toBe(3);
    expect(m.FeedComment.count).toHaveBeenCalledWith({ where: { feed_post_id: 'p-1', status: 'live' } });
    expect(m.FeedPost.update).toHaveBeenCalledWith({ comments_count: 3 }, { where: { id: 'p-1' } });
  });
  test('the prompt carries the post, each voice and the JSON shape', () => {
    const text = buildPrompt(POST, [{ profile: P(2, 'rival', { archetype: 'polished_curator', posting_voice: 'v' }), relationship: 'rival' }]);
    expect(text).toContain('@lala (Lala) on instagram');
    expect(text).toContain('"Gala tonight."');
    expect(text).toContain('1. @rival (rival), polished curator');
    expect(text).toContain('voice: v');
    expect(text).toContain('[{ "handle": "...", "text": "..." }]');
  });
});
