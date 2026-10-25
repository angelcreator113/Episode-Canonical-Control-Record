// ============================================================================
// Rewrite line, three versions (Evoni, 2026-10-25: "When I ask the script to
// rewrite it's basically writing the same thing."): Tighter / Punchier / New
// angle in strict JSON, parsed robustly; a direction chip and her note go in
// the prompt; her other lines are the voice; a version too close to the
// original is asked for once more, bolder, then dropped, or the lot comes
// back flagged tooSimilar. Mocked: no database, no network, no real API.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockRules = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});
jest.mock('../../../src/models', () => ({
  EpisodeBrief: {}, Episode: {}, ScenePlan: {}, SceneSet: {}, FranchiseKnowledge: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/services/scenePlannerService', () => ({ generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: jest.fn() }));
jest.mock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
jest.mock('../../../src/services/brainRules', () => ({ selectInjectedRules: (...a) => mockRules(...a) }));
jest.mock('../../../src/services/groundedScriptGeneratorService', () => ({ generateGroundedBeat: jest.fn(), generateGroundedScript: jest.fn() }));

const router = require('../../../src/routes/episodeBriefRoutes');
const rv = require('../../../src/utils/rewriteLineVersions');

const app = express();
app.use(express.json());
app.use('/api/v1/episode-brief', router);

const URL = '/api/v1/episode-brief/ep1/rewrite-line';
const LINE = 'Prime: "Hey besties, it has been a minute since we logged in to see the closet together."';
const reply = (text) => ({ content: [{ type: 'text', text }] });
const json = (versions) => JSON.stringify({ versions });
const THREE = [
  { angle: 'Tighter', text: 'Besties. Too long. Closet, now.' },
  { angle: 'Punchier', text: 'We are BACK, besties, and the closet missed us.' },
  { angle: 'New angle', text: 'Okay, confession: who else forgot what our closet looks like?' },
];
const promptOf = (i = 0) => mockCreate.mock.calls[i][0].messages[0].content;
const post = (body) => request(app).post(URL).send({ line: LINE, speaker: 'Prime', ...body });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockCreate.mockReset();
  mockRules.mockReset();
  mockRules.mockResolvedValue({ rules: [] });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the reply', () => {
  test('strict JSON: three versions with their angles, the first as rewrittenLine, on Sonnet with 700 tokens', async () => {
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.versions).toEqual(THREE);
    expect(res.body.rewrittenLine).toBe(THREE[0].text);
    expect(res.body.original).toBe(LINE);
    expect(res.body.tooSimilar).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: 'claude-sonnet-4-6', max_tokens: 700 });
  });

  test('JSON in a code fence, with a speaker prefix and quotes on a version, is read', async () => {
    mockCreate.mockResolvedValueOnce(reply(`Here you go:\n\`\`\`json\n${json([{ angle: 'tighter', text: 'Prime: "Besties. Closet. Now."' }, THREE[1], THREE[2]])}\n\`\`\``));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.versions.map((v) => v.angle)).toEqual(['Tighter', 'Punchier', 'New angle']);
    expect(res.body.versions[0].text).toBe('Besties. Closet. Now.');
  });

  test('not JSON: one version per line, labels read', async () => {
    mockCreate.mockResolvedValueOnce(reply(`1. Tighter: ${THREE[0].text}\n2. Punchier: ${THREE[1].text}\n3. New angle: ${THREE[2].text}`));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.versions).toEqual(THREE);
  });

  test('nothing usable: a 502 that says so', async () => {
    mockCreate.mockResolvedValueOnce(reply('{"versions": []}'));
    const res = await post({});
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/no rewrite/);
  });
});

describe('must differ', () => {
  const copy = 'Hey besties, it has been a minute since we logged in to see the closet.';

  test('a version too close is asked for once more, bolder, for its angle only', async () => {
    mockCreate
      .mockResolvedValueOnce(reply(json([THREE[0], { angle: 'Punchier', text: copy }, THREE[2]])))
      .mockResolvedValueOnce(reply(json([{ angle: 'Punchier', text: 'Closet check, besties: we are SO overdue.' }])));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const again = promptOf(1);
    expect(again).toContain('TOO CLOSE TO THE ORIGINAL');
    expect(again).toContain(`- Punchier: "${copy}"`);
    expect(again).toContain('{"angle":"Punchier","text":"..."}');
    expect(again).not.toContain('{"angle":"Tighter"');
    expect(res.body.versions.map((v) => v.text)).toEqual([THREE[0].text, 'Closet check, besties: we are SO overdue.', THREE[2].text]);
    expect(res.body.retried).toBe(true);
  });

  test('still too close after the retry: dropped, the others stay', async () => {
    mockCreate
      .mockResolvedValueOnce(reply(json([THREE[0], { angle: 'Punchier', text: copy }, THREE[2]])))
      .mockResolvedValueOnce(reply(json([{ angle: 'Punchier', text: copy }])));
    const res = await post({});
    expect(res.body.versions.map((v) => v.angle)).toEqual(['Tighter', 'New angle']);
    expect(res.body.tooSimilar).toBeUndefined();
  });

  test('none differ: all come back, flagged tooSimilar', async () => {
    const same = [{ angle: 'Tighter', text: copy }, { angle: 'Punchier', text: 'Besties, hey: a minute since we logged in to see the closet together.' }, { angle: 'New angle', text: `So, ${copy}` }];
    mockCreate.mockResolvedValue(reply(json(same)));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(res.body.tooSimilar).toBe(true);
    expect(res.body.versions).toHaveLength(3);
    expect(res.body.rewrittenLine).toBe(copy);
  });

  test('a refused budget on the retry keeps the first versions', async () => {
    mockCreate
      .mockResolvedValueOnce(reply(json([THREE[0], { angle: 'Punchier', text: copy }, THREE[2]])))
      .mockRejectedValueOnce(Object.assign(new Error('AI daily budget exceeded'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.versions.map((v) => v.angle)).toEqual(['Tighter', 'New angle']);
  });

  test('the overlap leaves out stopwords, names, numbers and show terms', () => {
    expect(rv.overlap(LINE, 'Besties! Closet time, finally.')).toBe(0);
    expect(rv.overlap(LINE, copy)).toBeGreaterThan(0.6);
    // Names and numbers kept from the original do not count against a version.
    const fact = 'Lala: "Marcus sent 500 coins to Nia before the gala tonight."';
    expect(rv.overlap(fact, 'Five hundred coins? Marcus, Nia, the gala: wow.')).toBeLessThanOrEqual(0.6);
    expect(rv.tooClose('Lala: Hi besties.', 'Hi besties.')).toBe(true);
  });
});

describe('the prompt', () => {
  test('without a direction: the three angles, the must-differ rule, strict JSON', async () => {
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    await post({});
    const p = promptOf();
    expect(p).toContain('1. "Tighter": about half the length of the original, same meaning.');
    expect(p).toContain('2. "Punchier": more energy and a stronger opening.');
    expect(p).toContain('3. "New angle": a different way into the same moment: a question, a confession or a joke.');
    expect(p).toContain('Open differently from the original');
    expect(p).toContain('Use a different sentence structure');
    expect(p).toContain("Reuse no more than about a third of the original's words");
    expect(p).toContain('Keep the facts: the coins, the names, the event and what happens stay the same.');
    expect(p).toContain('Return ONLY strict JSON');
    expect(p).not.toContain('DIRECTION:');
  });

  test('a direction and her note go in, and every version follows them', async () => {
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    await post({ direction: 'funnier', instruction: 'Make her tease the chat\nabout the outfit.' });
    const p = promptOf();
    expect(p).toContain('DIRECTION: Funnier:');
    expect(p).toContain('HER NOTE ON HOW TO REWRITE IT: "Make her tease the chat about the outfit."');
    expect(p).toContain('Every version follows the direction and her note, and the versions still differ from each other.');
  });

  test('her other lines are the voice to write like, the line itself left out', async () => {
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    await post({ voiceSamples: ['Okay besties, real talk.', LINE, 'I am not crying, you are.'] });
    const p = promptOf();
    expect(p).toContain('HOW THIS SPEAKER SOUNDS: write like these, her other lines in this episode');
    expect(p).toContain('- Okay besties, real talk.');
    expect(p).toContain('- I am not crying, you are.');
    expect(p.match(/- Prime: "Hey besties/g)).toBeNull();
  });

  test("Lala's lines are named as hers", async () => {
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    await post({ line: 'Lala: "Bestie, the closet is calling."', speaker: 'Lala', voiceSamples: ['Bestie. No.'] });
    expect(promptOf()).toContain("write like these, Lala's other lines in this episode");
    expect(promptOf()).toContain('Write as Lala:');
  });

  test('the Show Brain rules: voice and character first, at most 12; the beat stays', async () => {
    const rules = [
      ...Array.from({ length: 14 }, (_, i) => ({ title: `Money rule ${i + 1}`, content: '{}' })),
      { title: 'Lala voice rule', content: JSON.stringify({ summary: 'short and sure' }) },
      { title: 'Character rule: Prime', content: 'plain' },
    ];
    mockRules.mockResolvedValue({ rules });
    mockCreate.mockResolvedValueOnce(reply(json(THREE)));
    await post({ beatLines: [LINE, 'Prime: "Lets go ahead and login."'], beatName: 'Opening Ritual' });
    const p = promptOf();
    expect(p).toContain('Lala voice rule: short and sure');
    expect(p).toContain('Character rule: Prime');
    expect(p).toContain('Money rule 10');
    expect(p).not.toContain('Money rule 11');
    expect(p).toContain(`>> ${LINE}   <- the line to rewrite`);
    expect(p).toContain('BEAT: Opening Ritual');
  });
});

describe('the request is checked', () => {
  test.each([
    [{ line: '' }, 'line is required'],
    [{ direction: 'louder' }, /direction must be one of/],
    [{ instruction: 'x'.repeat(301) }, /at most 300 characters/],
    [{ instruction: 42 }, 'instruction must be text'],
    [{ voiceSamples: 'one line' }, 'voiceSamples must be a list of lines'],
    [{ voiceSamples: Array.from({ length: 9 }, () => 'a line') }, /at most 8 lines/],
    [{ voiceSamples: ['y'.repeat(301)] }, /at most 300 characters/],
    [{ voiceSamples: [7] }, 'voiceSamples must be a list of lines'],
    [{ showId: 'show-a' }, 'showId must be a show id (UUID)'],
  ])('%j is a 400', async (body, error) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    if (error instanceof RegExp) expect(res.body.error).toMatch(error); else expect(res.body.error).toBe(error);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('every direction key is taken', async () => {
    for (const direction of Object.keys(rv.DIRECTIONS)) {
      mockCreate.mockResolvedValueOnce(reply(json(THREE)));
      const res = await post({ direction });
      expect(res.status).toBe(200);
      expect(promptOf(mockCreate.mock.calls.length - 1)).toContain(`DIRECTION: ${rv.DIRECTIONS[direction].guide}`);
    }
  });

  test('a refused budget is a 429 with its code, after one call', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded ($5.00 / $5). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const res = await post({});
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
