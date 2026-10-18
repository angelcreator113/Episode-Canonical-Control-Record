/**
 * services/feedPostRedrafter — a draft post rewritten in its poster's
 * voice (Lala's Feed → Redraft in their voice, Evoni, 2026-10-05). A live
 * post is locked; the old text comes back for undo. The Anthropic client
 * is a stub.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: mockCreate } }; });

// The Pulse's request ledger (Task #3031) has its own integration test; here it only has to be asked.
const mockTake = jest.fn(async () => ({}));
jest.mock('../../../src/services/pulseRequests', () => ({ take: (...args) => mockTake(...args), RequestCapError: class RequestCapError extends Error {} }));

// The poster's world (services/posterWorld) has its own integration test; here it gives one line.
const mockWorld = jest.fn(async () => 'Their world (a post may be set here; it need not name it):\n- They live in Echo Park, a DREAM city: Loud.\n');
jest.mock('../../../src/services/posterWorld', () => ({ posterWorldLine: (...args) => mockWorld(...args) }));

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

beforeEach(() => { mockCreate.mockReset(); mockTake.mockClear(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('redraftPost', () => {
  test('rewrites the draft in the poster\'s profile voice and returns the old text', async () => {
    const m = makeModels({ post: DRAFT });
    mockCreate.mockResolvedValue({ content: [{ text: '"She drew it. We built it. You\'ll want it."' }] });
    const out = await redraftPost(m, 'p-1', { note: 'shorter' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockTake).toHaveBeenCalledTimes(1);
    expect(mockTake.mock.calls[0][1]).toEqual({ showId: 's-1', lane: 'manual', kind: 'redraft' });
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

  // Evoni, 2026-10-18: a redraft knows the world a new draft does.
  test('a redraft carries the poster\'s world and the gossip outlets, trends and archives', async () => {
    const m = makeModels({ post: DRAFT });
    mockCreate.mockResolvedValue({ content: [{ text: 'She drew it.' }] });
    await redraftPost(m, 'p-1');
    expect(mockWorld).toHaveBeenCalledWith(m, 7);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('- They live in Echo Park, a DREAM city: Loud.');
    expect(prompt).toContain("The LalaVerse's gossip and media outlets");
    expect(prompt).toContain("The LalaVerse's culture (a post may lean on it where it fits");
    expect(prompt.indexOf('They live in Echo Park')).toBeLessThan(prompt.indexOf('The draft:'));
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
