/**
 * T9 (docs/EVENT_EPISODE_FLOW.md §8(cc); Task #2395): the Career
 * Checklist's AI goals are bounded by the event's scale, in the prompt and
 * on the server; a failed call writes the minimum from the event's fields,
 * not a fixed list. The AI client is mocked.
 */
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn((input) => input),
}));
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const { generateCareerTasks } = require('../../../src/services/todoListService');

const replies = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ slot: `s${i}`, label: `Goal ${i}`, goal: true, ...extra }));
const aiReturns = (tasks) => mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(tasks) }] });

const EVENT = { name: 'Maison Rue Launch', host: 'Celeste Rue', host_brand: 'Maison Rue', venue_name: 'The Glasshouse', dress_code: 'Black tie florals', format: 'brand_launch' };

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('generateCareerTasks (T9)', () => {
  test('the prompt asks for the event\'s count', async () => {
    aiReturns(replies(2));
    await generateCareerTasks({ ...EVENT, prestige: 3 });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toMatch(/Write 2 to 3 career tasks/);
    aiReturns(replies(5));
    await generateCareerTasks({ ...EVENT, prestige: 9 });
    expect(mockCreate.mock.calls[1][0].messages[0].content).toMatch(/Write 4 to 6 career tasks/);
  });

  test('a reply over the maximum is trimmed to it', async () => {
    aiReturns(replies(9));
    expect(await generateCareerTasks({ ...EVENT, prestige: 2 })).toHaveLength(3);
    aiReturns(replies(9));
    const major = await generateCareerTasks({ ...EVENT, prestige: 8 });
    expect(major).toHaveLength(6);
    expect(major.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('a short reply is kept and logged, not padded', async () => {
    aiReturns(replies(1));
    const tasks = await generateCareerTasks({ ...EVENT, prestige: 9 });
    expect(tasks.map((t) => t.label)).toEqual(['Goal 0']);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/\[CareerList\] 1 goal task\(s\) for a major event, below its minimum of 4/));
  });

  test('no item is required, whatever the AI says (T1)', async () => {
    aiReturns(replies(3, { required: true }));
    const tasks = await generateCareerTasks({ ...EVENT, prestige: 5 });
    expect(tasks.every((t) => t.required === false)).toBe(true);
  });

  test('one unreadable reply is retried once', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: 'not json' }] });
    aiReturns(replies(3));
    const tasks = await generateCareerTasks({ ...EVENT, prestige: 5 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(tasks).toHaveLength(3);
  });

  test('both attempts fail: the minimum, written from the event\'s fields', async () => {
    mockCreate.mockRejectedValue(new Error('overloaded'));
    const small = await generateCareerTasks({ ...EVENT, prestige: 3 });
    const major = await generateCareerTasks({ ...EVENT, prestige: 9 });
    expect(small).toHaveLength(2);
    expect(major).toHaveLength(4);
    const text = major.map((t) => `${t.label} ${t.description}`).join(' | ');
    expect(text).toMatch(/Black tie florals/);
    expect(text).toMatch(/The Glasshouse/);
    expect(text).toMatch(/Celeste Rue/);
    for (const t of major) expect(t).toMatchObject({ task_source: 'goal', required: false });
  });
});
