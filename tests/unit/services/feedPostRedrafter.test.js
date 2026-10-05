/**
 * services/feedPostRedrafter — a draft post rewritten in its poster's
 * voice (Lala's Feed → Redraft in their voice, Evoni, 2026-10-05). A live
 * post is locked; the old text comes back for undo. The Anthropic client
 * is a stub.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: mockCreate } }; });

const { redraftPost, buildPrompt, posterProfile } = require('../../../src/services/feedPostRedrafter');
const { DraftError } = require('../../../src/services/feedCommentDrafter');

const VOICE = { id: 7, handle: 'stableofficial', display_name: 'Stable', archetype: 'brand', posting_voice: 'crisp, proud, a little smug', content_persona: 'a shoe label that loves its makers' };

function makeModels({ post, profiles = [VOICE] } = {}) {
  const row = post && { ...post, update: jest.fn(async (fields) => Object.assign(row, fields)) };
  return {
    row,
    FeedPost: { findOne: jest.fn(async () => row || null) },
    SocialProfile: { findOne: jest.fn(async ({ where }) => profiles.find((p) => (where.id != null ? p.id === where.id : p.handle === where.handle)) || null) },
  };
}
const DRAFT = { id: 'p-1', show_id: 's-1', status: 'draft', poster_handle: 'stableofficial', content_text: 'Our pump, her design.', narrative_function: 'brand_moment' };

beforeEach(() => { mockCreate.mockReset(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('redraftPost', () => {
  test('rewrites the draft in the poster\'s profile voice and returns the old text', async () => {
    const m = makeModels({ post: DRAFT });
    mockCreate.mockResolvedValue({ content: [{ text: '"She drew it. We built it. You\'ll want it."' }] });
    const out = await redraftPost(m, 'p-1', { note: 'shorter' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-6');
    expect(call.messages[0].content).toContain('voice: crisp, proud, a little smug');
    expect(call.messages[0].content).toContain("Evoni's note for this redraft: shorter");
    expect(call.messages[0].content).toContain('What the post does: brand moment');
    expect(call.messages[0].content).toContain('Our pump, her design.');
    expect(m.row.update).toHaveBeenCalledWith({ content_text: "She drew it. We built it. You'll want it.", ai_generated: true });
    expect(out.previous_text).toBe('Our pump, her design.');
    expect(out.voice).toBe('stableofficial');
  });

  test('a live post is locked, a missing post is 404, an overlong note is 400, no key is 503', async () => {
    await expect(redraftPost(makeModels({ post: { ...DRAFT, status: 'live' } }), 'p-1')).rejects.toMatchObject({ status: 409 });
    await expect(redraftPost(makeModels({}), 'nope')).rejects.toMatchObject({ status: 404 });
    await expect(redraftPost(makeModels({ post: DRAFT }), 'p-1', { note: 'x'.repeat(301) })).rejects.toMatchObject({ status: 400 });
    delete process.env.ANTHROPIC_API_KEY;
    await expect(redraftPost(makeModels({ post: DRAFT }), 'p-1')).rejects.toMatchObject({ status: 503 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('an empty answer is a 502 and leaves the draft as it was', async () => {
    const m = makeModels({ post: DRAFT });
    mockCreate.mockResolvedValue({ content: [{ text: '   ' }] });
    const err = await redraftPost(m, 'p-1').catch((e) => e);
    expect(err).toBeInstanceOf(DraftError);
    expect(err.status).toBe(502);
    expect(m.row.update).not.toHaveBeenCalled();
  });
});

describe('posterProfile and the prompt', () => {
  test('the profile is found by id, else by handle; without one the draft sets the voice', async () => {
    expect((await posterProfile(makeModels({}), { social_profile_id: 7 })).handle).toBe('stableofficial');
    expect((await posterProfile(makeModels({}), { poster_handle: '@stableofficial' })).id).toBe(7);
    expect(await posterProfile(makeModels({}), { poster_handle: 'nobody' })).toBeNull();
    expect(buildPrompt({ poster_handle: 'lala', content_text: 'hi' }, null, null)).toContain('No profile is on file: take the voice from the draft itself.');
  });
});
