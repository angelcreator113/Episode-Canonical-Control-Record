// ============================================================================
// Task #1859 — generateSingleProfile races the AI call against a 120s timeout.
// The timer is cleared once the race settles, so a fast AI response leaves no
// pending timer, and a slow one still rejects with the unchanged message.
// Mocked, no database, no AI call: the Anthropic SDK is a jest mock and db is
// null so the save path is skipped. Jest fake timers.
// ============================================================================

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/models', () => ({}));

const { generateSingleProfile } = require('../../../src/routes/socialProfileBulkRoutes');

const creator = { handle: 'glowtheory', platform: 'tiktok', vibe_sentence: 'skincare lab energy' };
const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const opts = { db: null, seriesId: null, characterContext: null };

beforeEach(() => {
  mockCreate.mockReset();
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('generateSingleProfile timeout timer (Task #1859)', () => {
  it('a fast AI response leaves no pending timer', async () => {
    mockCreate.mockResolvedValue(modelReply({ display_name: 'Glow Theory', archetype: 'polished_curator' }));

    const result = await generateSingleProfile(creator, opts);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a failed AI call also leaves no pending timer', async () => {
    mockCreate.mockRejectedValue(new Error('upstream 529'));

    await expect(generateSingleProfile(creator, opts)).rejects.toThrow('upstream 529');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a slow AI response still rejects with the 120s timeout message', async () => {
    mockCreate.mockImplementation(() => new Promise(() => {})); // never settles

    const settled = expect(generateSingleProfile(creator, opts)).rejects.toThrow('AI call timed out after 120s');

    jest.advanceTimersByTime(119999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);

    await settled;
    expect(jest.getTimerCount()).toBe(0);
  });
});
