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
  parseStyling,
  FORMALITY_SCALE,
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
const STYLING = {
  dress_code: 'Sleek performance activewear with a light layer for the social',
  dress_code_keywords: ['practical', 'modern', 'comfortable', 'clean'],
  styling_brief: {
    activity: 'A sculpt class on mats, then standing and mingling',
    formality: 'casual',
    function_requirements: ['full range of movement', 'breathable fabric'],
    avoid: ['loose jewellery', 'heels'],
    style_direction: 'Polished athleisure that goes straight from class to drinks.',
    environment: 'Open-air rooftop at sunset',
    footwear_requirements: 'clean training shoes',
  },
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

  test('Task #2124: the same one call also returns valid styling', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, styling: STYLING })));
    const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
    expect(draft).toEqual({ ...REPLY, styling: STYLING });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate.mock.calls[0][0].max_tokens).toBe(1000);
  });

  test('Task #2124: invalid styling keeps the concept draft, styling omitted, with a warning', async () => {
    const bad = { ...STYLING, styling_brief: { ...STYLING.styling_brief, formality: 'very fancy' } };
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, styling: bad })));
    const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
    expect(draft).toEqual(REPLY);
    expect(draft).not.toHaveProperty('styling');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/styling missing or invalid/));
  });

  test('Task #2124: missing styling keeps the concept draft', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify(REPLY)));
    expect(await draftEventConcept(PROFILE, { userId: 'u1' })).toEqual(REPLY);
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

  test('Task #2124: asks for styling on the wardrobe\'s own formality scale and tag words', () => {
    const prompt = buildDraftPrompt(PROFILE, {});
    expect(FORMALITY_SCALE).toEqual(['casual', 'smart-casual', 'business', 'formal', 'black-tie']);
    expect(prompt).toContain('exactly one of casual, smart-casual, business, formal, black-tie');
    expect(prompt).toContain('dress_code_keywords');
    expect(prompt).toContain('old-money');
    expect(prompt).toContain('styling_brief');
  });

  test('with no facts it still asks for a simple draft and invents nothing', () => {
    expect(buildDraftPrompt({}, {})).toContain('do not invent specifics');
  });
});

describe('parseStyling', () => {
  test('a valid styling object passes through', () => {
    expect(parseStyling(STYLING)).toEqual(STYLING);
  });

  test('keywords: lower-cased, de-duplicated, at most 8; fewer than 3 is invalid', () => {
    const many = ['Elegant', 'elegant', 'bold', 'soft', 'modern', 'clean', 'classic', 'fresh', 'cozy', 'minimal'];
    expect(parseStyling({ ...STYLING, dress_code_keywords: many }).dress_code_keywords)
      .toEqual(['elegant', 'bold', 'soft', 'modern', 'clean', 'classic', 'fresh', 'cozy']);
    expect(parseStyling({ ...STYLING, dress_code_keywords: ['bold', 'Bold', 'soft'] })).toBeNull();
  });

  test('each required field is required', () => {
    expect(parseStyling({ ...STYLING, dress_code: '' })).toBeNull();
    expect(parseStyling({ ...STYLING, styling_brief: undefined })).toBeNull();
    for (const field of ['activity', 'formality', 'function_requirements', 'avoid', 'style_direction']) {
      const { [field]: _omit, ...brief } = STYLING.styling_brief;
      expect(parseStyling({ ...STYLING, styling_brief: brief })).toBeNull();
    }
    expect(parseStyling({ ...STYLING, styling_brief: { ...STYLING.styling_brief, avoid: [] } })).toBeNull();
  });

  test('optional fields are dropped when empty; a lone string counts as a one-item list', () => {
    const { environment: _e, footwear_requirements: _f, ...rest } = STYLING.styling_brief;
    const out = parseStyling({ ...STYLING, styling_brief: { ...rest, environment: '  ', avoid: 'heels' } });
    expect(out.styling_brief).not.toHaveProperty('environment');
    expect(out.styling_brief).not.toHaveProperty('footwear_requirements');
    expect(out.styling_brief.avoid).toEqual(['heels']);
  });

  test('caps the dress code at the 200-character column limit', () => {
    const out = parseStyling({ ...STYLING, dress_code: 'smart '.repeat(60).trim() });
    expect(out.dress_code.length).toBeLessThanOrEqual(200);
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
