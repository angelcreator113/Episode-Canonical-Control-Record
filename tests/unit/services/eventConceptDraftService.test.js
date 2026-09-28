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
  parseTaxonomy,
  parseName,
  normaliseTime,
  FORMALITY_SCALE,
  R8_CONTRACT,
  MODELS,
  DRAFT_TIMEOUT_MS,
  NAME_LIMIT,
  CONTEXT_MAX,
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
const TAXONOMY = { category: 'fitness', format: 'workout_class', event_time: '18:30' };
const { CATEGORY_VALUES, FORMAT_VALUES } = require('../../../src/models/WorldEvent');
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

  test('Task #2126: the same one call also returns category, format and start time', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, ...TAXONOMY, styling: STYLING })));
    const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
    expect(draft).toEqual({ ...REPLY, ...TAXONOMY, styling: STYLING });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  test('Task #2126: each invalid taxonomy field is dropped alone; concept and styling kept', async () => {
    const cases = [
      [{ category: 'wellness_retreat' }, 'category'],
      [{ format: 'rave' }, 'format'],
      [{ event_time: '6:30pm' }, 'event_time'],
    ];
    for (const [bad, dropped] of cases) {
      mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, ...TAXONOMY, ...bad, styling: STYLING })));
      const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
      const expected = { ...REPLY, ...TAXONOMY, styling: STYLING };
      delete expected[dropped];
      expect(draft).toEqual(expected);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(dropped));
    }
  });

  test('Task #2135: the same one call also returns a valid name, as the last field', async () => {
    const full = { ...REPLY, ...TAXONOMY, styling: STYLING, name: 'Golden Hour Sculpt Social' };
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify(full)));
    const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
    expect(draft).toEqual(full);
    expect(Object.keys(draft).pop()).toBe('name');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  test('Task #2135: an unusable name is dropped alone, with a warning; everything else is kept', async () => {
    const cases = [
      ['missing', undefined],
      ['empty', '   '],
      ['only quotation marks', '"“”"'],
      ['the fallback pattern', 'Event with Maya Moves'],
      ['the fallback pattern, other case and quoted', '"event with maya moves"'],
      [`${NAME_LIMIT} characters`, 'x'.repeat(NAME_LIMIT)],
      ['over the limit', 'The Golden Hour Rooftop Sculpt and Recovery Social'],
    ];
    for (const [label, name] of cases) {
      console.warn.mockClear();
      mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, ...TAXONOMY, styling: STYLING, name })));
      const draft = await draftEventConcept(PROFILE, { userId: 'u1' });
      expect({ label, draft }).toEqual({ label, draft: { ...REPLY, ...TAXONOMY, styling: STYLING } });
      expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/name .*fallback name/));
    }
  });

  test('Task #2135: double quotes are stripped anywhere, straight and curly; the name is never truncated', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify({ ...REPLY, name: '“Golden  "Hour"”' })));
    expect((await draftEventConcept(PROFILE, { userId: 'u1' })).name).toBe('Golden Hour');
    const justUnder = 'y'.repeat(NAME_LIMIT - 1);
    expect(parseName(justUnder, PROFILE)).toBe(justUnder);
    expect(parseName(`${justUnder}y`, PROFILE)).toBe('');
  });

  test('Task #2135 review: apostrophes inside the name are kept; single quotes wrapping it are stripped', () => {
    expect(parseName("Maya's Golden Hour", PROFILE)).toBe("Maya's Golden Hour");
    expect(parseName('Maya’s Golden Hour', PROFILE)).toBe('Maya’s Golden Hour');
    expect(parseName("'Golden Hour'", PROFILE)).toBe('Golden Hour');
    expect(parseName('‘Golden Hour’', PROFILE)).toBe('Golden Hour');
    expect(parseName('“Maya’s Golden Hour”', PROFILE)).toBe('Maya’s Golden Hour');
    expect(parseName(`"'Golden Hour'"`, PROFILE)).toBe('Golden Hour');
    // A lone wrapping quote is left as written.
    expect(parseName("Golden Hour'", PROFILE)).toBe("Golden Hour'");
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
    expect(prompt).toContain('a single word or a hyphenated compound such as old-money or smart-casual');
    expect(prompt).toContain('styling_brief');
  });

  test('Task #2126: category and format lists come from the model\'s own isIn arrays', () => {
    const prompt = buildDraftPrompt(PROFILE, {});
    expect(prompt).toContain(`category: exactly one of ${CATEGORY_VALUES.join(', ')}.`);
    expect(prompt).toContain(`format: exactly one of ${FORMAT_VALUES.join(', ')}.`);
    expect(prompt).toContain('24-hour HH:MM');
    expect(prompt).not.toMatch(/invent a venue, date, time/);
  });

  test('Task #2135: asks for the name last, with the suggest-names name rules, and no show name', () => {
    const prompt = buildDraftPrompt(PROFILE, { showName: 'Styling Adventures with Lala' });
    expect(NAME_LIMIT).toBe(40);
    expect(prompt).toContain('Each name is under 40 characters.');
    expect(prompt).toContain('No quotation marks in the name itself.');
    expect(prompt).toContain('- name: write this last, from the concept, activity and format above.');
    expect(prompt).not.toMatch(/Do not name the event/);
    expect(prompt).not.toMatch(/Styling Adventures/);
    // Name is the last field asked for and the last key in the JSON shape.
    const fieldLines = prompt.split('Rules:')[0];
    expect(fieldLines.lastIndexOf('- name:')).toBeGreaterThan(fieldLines.lastIndexOf('- styling'));
    expect(fieldLines.lastIndexOf('- name:')).toBeGreaterThan(fieldLines.lastIndexOf('- format:'));
    expect(prompt.trim().endsWith('"name": "..."}')).toBe(true);
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

  test('keywords: hyphenated compounds kept; spaces and underscores become hyphens; other shapes dropped', () => {
    const out = parseStyling({ ...STYLING, dress_code_keywords: ['old-money', 'Smart Casual', 'black_tie', 'glam!', 'two  words here', 'chic'] });
    expect(out.dress_code_keywords).toEqual(['old-money', 'smart-casual', 'black-tie', 'two-words-here', 'chic']);
    // Dropped shapes don't count toward the minimum of 3.
    expect(parseStyling({ ...STYLING, dress_code_keywords: ['glam!', '***', 'bold', 'soft'] })).toBeNull();
  });

  test('formality is normalised (case, spaces, underscores) before the five-value check', () => {
    const withFormality = (f) => parseStyling({ ...STYLING, styling_brief: { ...STYLING.styling_brief, formality: f } });
    expect(withFormality('Smart Casual').styling_brief.formality).toBe('smart-casual');
    expect(withFormality('black_tie').styling_brief.formality).toBe('black-tie');
    expect(withFormality('  FORMAL ').styling_brief.formality).toBe('formal');
    expect(withFormality('very fancy')).toBeNull();
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

describe('parseTaxonomy', () => {
  test('normalises category and format: lower-case, spaces and hyphens to underscores', () => {
    expect(parseTaxonomy({ category: 'Brunch Dining', format: 'pop-up', event_time: '11:00' }))
      .toEqual({ category: 'brunch_dining', format: 'pop_up', event_time: '11:00' });
    expect(parseTaxonomy({ category: ' FITNESS ', format: 'Run Club', event_time: '07:00' }))
      .toEqual({ category: 'fitness', format: 'run_club', event_time: '07:00' });
  });

  test('missing fields are simply absent', () => {
    expect(parseTaxonomy({})).toEqual({});
  });
});

describe('normaliseTime', () => {
  test('zero-pads valid 24h times; rejects anything else', () => {
    expect(normaliseTime('9:05')).toBe('09:05');
    expect(normaliseTime('18:30')).toBe('18:30');
    expect(normaliseTime('00:00')).toBe('00:00');
    for (const bad of ['24:00', '12:60', '6:30pm', '1830', '9:5', '', null, 18.5]) {
      expect(normaliseTime(bad)).toBe('');
    }
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

// Task #2154 (§8(v)): an optional calendar context. from-profile passes none,
// and its prompt is byte-for-byte what it was.
describe('buildDraftPrompt context (Task #2154)', () => {
  const CAL = { title: 'Holiday Gala', theme: 'luxury_prestige', description: "The season's biggest night." };

  test('from-profile prompt unchanged: exact text up to "Write these:"', () => {
    const prompt = buildDraftPrompt(PROFILE, { venueName: 'The Loft', userId: 'u1' });
    expect(prompt.slice(0, prompt.indexOf('Write these:') + 'Write these:'.length)).toBe(
      "Draft a fictional social event in Lala's world, fitting the Feed creator it was started from.\n"
      + '\n'
      + 'Started from Feed creator: Maya Moves\n'
      + "Creator's niche: fitness\n"
      + "Creator's archetype: soft life\n"
      + 'Venue: The Loft\n'
      + '\n'
      + 'Write these:',
    );
    expect(prompt).not.toMatch(/calendar event/i);
  });

  test('no context, an empty context and an all-blank context give the same prompt', () => {
    const base = buildDraftPrompt(PROFILE, { venueName: 'The Loft' });
    expect(buildDraftPrompt(PROFILE, { venueName: 'The Loft', context: undefined })).toBe(base);
    expect(buildDraftPrompt(PROFILE, { venueName: 'The Loft', context: {} })).toBe(base);
    expect(buildDraftPrompt(PROFILE, { venueName: 'The Loft', context: { title: '  ', theme: null } })).toBe(base);
  });

  test('the context appears in the prompt, and the model is told the event must fit it', () => {
    const prompt = buildDraftPrompt(PROFILE, { venueName: 'The Loft', context: CAL });
    expect(prompt).toContain('This event is part of the calendar event below. The concept, activity, description, styling and name must fit it.');
    expect(prompt).toContain('Calendar event: Holiday Gala');
    expect(prompt).toContain('Theme: luxury prestige');
    expect(prompt).toContain("What the world knows about it: The season's biggest night.");
    // After the block, the only change is the dropped host rule.
    const tail = (p) => p.slice(p.indexOf('Write these:'));
    const HOST_RULE = "- Do not call the creator the event's organizer or host.\n";
    expect(tail(prompt)).toBe(tail(buildDraftPrompt(PROFILE, { venueName: 'The Loft' })).replace(HOST_RULE, ''));
  });

  test('with context the creator is the host: host wording allowed, the no-host rule dropped', () => {
    const prompt = buildDraftPrompt(PROFILE, { venueName: 'The Loft', context: CAL });
    expect(prompt.startsWith("Draft a fictional social event in Lala's world, hosted by the Feed creator below.\n")).toBe(true);
    expect(prompt).toContain('Host (a Feed creator): Maya Moves');
    expect(prompt).not.toContain('Started from Feed creator');
    expect(prompt).not.toMatch(/Do not call the creator the event's organizer or host/);
    // Without context the rule and the "started from" wording stay.
    const plain = buildDraftPrompt(PROFILE, { venueName: 'The Loft' });
    expect(plain).toContain("- Do not call the creator the event's organizer or host.");
    expect(plain).toContain('Started from Feed creator: Maya Moves');
    expect(plain).not.toContain('Host (a Feed creator)');
  });

  test('context fields are capped like the draft fields; a missing one is left out', () => {
    const prompt = buildDraftPrompt(null, { context: { title: 'T '.repeat(300), description: 'word '.repeat(400) } });
    const line = (label) => prompt.split('\n').find((l) => l.startsWith(label)).slice(label.length);
    expect(line('Calendar event: ').length).toBeLessThanOrEqual(CONTEXT_MAX.title);
    expect(line('What the world knows about it: ').length).toBeLessThanOrEqual(CONTEXT_MAX.description);
    expect(prompt).not.toContain('Theme:');
  });

  test('draftEventConcept sends the context to the model', async () => {
    mockMessagesCreate.mockResolvedValue(reply(JSON.stringify(REPLY)));
    await draftEventConcept(PROFILE, { venueName: 'The Loft', userId: 'ctx-user', context: CAL });
    const sent = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(sent).toContain('Calendar event: Holiday Gala');
  });
});
