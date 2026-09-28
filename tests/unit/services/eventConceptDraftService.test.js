// ============================================================================
// Task #2122 — eventConceptDraftService.draftEventConcept (§8(u) R1, R8; §8(v)).
// The creation draft never blocks creation: every failure returns null.
// Anthropic SDK mocked at the module boundary; no network, no database.
// ============================================================================

const mockMessagesCreate = jest.fn();
const mockClientOptions = [];
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation((opts) => {
  mockClientOptions.push(opts);
  return { messages: { create: (...a) => mockMessagesCreate(...a) } };
}));

const {
  draftEventConcept,
  buildDraftPrompt,
  parseDraftReply,
  resetDraftLimit,
  R8_CONTRACT,
  MODELS,
  DRAFT_TIMEOUT_MS,
} = require('../../../src/services/eventConceptDraftService');

const PROFILE = { display_name: 'Maya Moves', handle: 'mayamoves', content_category: 'fitness', archetype: 'soft_life' };
const REPLY = {
  concept: 'A sunset sculpt workout that ends in a recovery social.',
  activity: 'Guests take a guided rooftop sculpt class, then stretch and share mocktails.',
  description: 'Maya Moves is celebrating the end of summer with a golden-hour sculpt session on the rooftop. '
    + 'Expect a guided class, a slow stretch as the sun goes down, and a relaxed social afterwards.',
};
const reply = (text) => ({ content: [{ text }] });

const originalKey = process.env.ANTHROPIC_API_KEY;
const originalMax = process.env.AI_RATE_LIMIT_PER_IP;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.AI_RATE_LIMIT_PER_IP;
  mockMessagesCreate.mockReset();
  mockClientOptions.length = 0;
  resetDraftLimit();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
  if (originalMax === undefined) delete process.env.AI_RATE_LIMIT_PER_IP; else process.env.AI_RATE_LIMIT_PER_IP = originalMax;
});

describe('draftEventConcept', () => {
  test('a valid JSON reply gives the three fields, from one Haiku 4.5 call', async () => {
    mockMessagesCreate.mockResolvedValue(reply(`Here you go:\n${JSON.stringify(REPLY)}`));
    const draft = await draftEventConcept(PROFILE, { venueName: 'The Loft', userId: 'u1' });
    expect(draft).toEqual(REPLY);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    expect(MODELS).toEqual(['claude-haiku-4-5-20251001']);
  });

  test('one attempt only: 10s timeout, SDK retries off, no retry on overload', async () => {
    const overloaded = Object.assign(new Error('Overloaded'), { status: 529 });
    mockMessagesCreate.mockRejectedValue(overloaded);
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toBeNull();
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(DRAFT_TIMEOUT_MS).toBe(10000);
    expect(mockClientOptions).toEqual([{ timeout: 10000, maxRetries: 0 }]);
  });

  test('a malformed reply gives null', async () => {
    mockMessagesCreate.mockResolvedValue(reply('{"concept": "half a reply"'));
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toBeNull();
  });

  test('a reply missing a field gives null', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ concept: 'x', activity: 'y' })));
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toBeNull();
  });

  test('a thrown error (e.g. aiCostTracker\'s budget refusal) gives null, never a throw', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('Daily AI budget exceeded'));
    await expect(draftEventConcept(PROFILE, { userId: 'u1' })).resolves.toBeNull();
  });

  test('no API key: no call, null', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toBeNull();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  test('over the draft limit: null and no call made; other users are unaffected', async () => {
    process.env.AI_RATE_LIMIT_PER_IP = '2';
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify(REPLY)));
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toEqual(REPLY);
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toEqual(REPLY);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toBeNull();
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

    expect(await draftEventConcept(PROFILE, { userId: 'u2' })).toEqual(REPLY);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(3);
  });
});

describe('buildDraftPrompt', () => {
  test('quotes the R8 contract verbatim and carries the creator facts', () => {
    const prompt = buildDraftPrompt(PROFILE, { venueName: 'The Loft' });
    expect(R8_CONTRACT).toBe('The public event description explains why the event exists, what attendees will actually do, the setting/atmosphere, and what guests should expect. It contains no database stats, evaluation language, or private story consequences.');
    expect(prompt).toContain(R8_CONTRACT);
    expect(prompt).toContain('Maya Moves');
    expect(prompt).toContain("Creator's niche: fitness");
    expect(prompt).toContain('Venue: The Loft');
  });

  test('has no show name: the context\'s show is never read', () => {
    const prompt = buildDraftPrompt(PROFILE, { showName: 'Styling Adventures with Lala', venueName: null });
    expect(prompt).not.toMatch(/Styling Adventures/);
    expect(prompt).not.toMatch(/content-creator show/);
  });

  test('with no facts it still asks for a simple draft and invents nothing', () => {
    expect(buildDraftPrompt({}, {})).toContain('do not invent specifics');
  });
});

describe('parseDraftReply', () => {
  test('caps each field at a word boundary', () => {
    const long = 'word '.repeat(400).trim();
    const draft = parseDraftReply(JSON.stringify({ concept: long, activity: 'a', description: long }));
    expect(draft.concept.length).toBeLessThanOrEqual(300);
    expect(draft.concept.endsWith('word')).toBe(true);
    expect(draft.description.length).toBeLessThanOrEqual(1200);
  });

  test('non-string or empty input gives null', () => {
    expect(parseDraftReply(undefined)).toBeNull();
    expect(parseDraftReply('no json here')).toBeNull();
    expect(parseDraftReply('{"concept": "", "activity": "a", "description": "d"}')).toBeNull();
  });
});
