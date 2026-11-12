'use strict';

/**
 * P0a-2 pilot (AI egress gateway): six admin-only cast suggestion services
 * build their Anthropic client through createAnthropicClient() instead of
 * `new Anthropic()`. Only the construction changed; this pins everything
 * else for each service:
 *   - the client is built lazily (not when the module loads), once, through
 *     the factory, with exactly { apiKey: process.env.ANTHROPIC_API_KEY };
 *   - the client is reused on later calls;
 *   - the request is unchanged (model, max_tokens, one user message);
 *   - errors are unchanged: a provider error propagates as the same object
 *     after a warning, and an unreadable answer is the service's own 502.
 *
 * The SDK is mocked: no network and no key. Only the database-reading
 * helpers each service calls are stubbed; prompts, parsing and errors run as
 * written.
 */

// Shared across Jest module registries: each service requires the factory
// lazily, after isolateModules has returned, so it may get another copy of
// the factory mock than the one load() sees. Recording here avoids that.
const mockConstructed = [];
const mockFactoryCalls = [];
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic(options) {
  mockConstructed.push(options);
  this.messages = { create: (...a) => mockCreate(...a) };
});
jest.mock('../../../src/services/anthropicClient', () => {
  const actual = jest.requireActual('../../../src/services/anthropicClient');
  return {
    createAnthropicClient: (...a) => {
      mockFactoryCalls.push(a);
      return actual.createAnthropicClient(...a);
    },
  };
});

// Database-reading helpers only; everything else in these modules is real.
jest.mock('../../../src/services/characterFile', () => ({
  characterFilePrompt: jest.fn(async () => ({ file: { character: { selected_name: 'Maren' } }, block: 'x'.repeat(500) })),
}));
jest.mock('../../../src/services/characterFacts', () => ({
  ...jest.requireActual('../../../src/services/characterFacts'),
  factsOf: jest.fn(async () => ({})),
  factsPromptBlock: jest.fn(() => 'FACTS: none decided'),
}));
jest.mock('../../../src/services/characterConsistency', () => ({
  ...jest.requireActual('../../../src/services/characterConsistency'),
  checkCharacter: jest.fn(async () => ({
    flags: [{ id: 'f1', fix: null, editable: true, text: 'She owns a yacht.', found: 'yacht', field_label: 'Bio', expected: 'no yacht' }],
  })),
}));
jest.mock('../../../src/services/societyArchetypes', () => ({
  ...jest.requireActual('../../../src/services/societyArchetypes'),
  loadSocietyArchetypes: jest.fn(async () => [
    { name: 'Fashion Creator', content: 'outfits' },
    { name: 'Beauty Creator', content: 'makeup' },
  ]),
}));

const MODEL = 'claude-sonnet-4-6';
const reply = (text) => ({ content: [{ type: 'text', text }] });
const DB = {};
const CHARACTER = { selected_name: 'Maren', description: 'A stylist who resells vintage.', core_wound: 'Left behind.' };

/** One row per migrated service: how to call its paid function, and what it sends. */
const SERVICES = [
  {
    name: 'characterTypology',
    path: '../../../src/services/characterTypology',
    call: (m) => m.suggestTypology(CHARACTER),
    maxTokens: 400,
    ok: '{"enneagram": {"type": 4, "wing": 5}, "mbti": "INFJ", "why": "w"}',
    errorName: 'TypologyError',
  },
  {
    name: 'characterPressure',
    path: '../../../src/services/characterPressure',
    call: (m) => m.pressureTest(DB, { character: CHARACTER }),
    maxTokens: 2500,
    ok: '{"questions": [{"question": "Can she afford it?", "about": "money", "verdict": "answers", "answer": "Yes.", "cites": [], "fix": null}]}',
    errorName: 'PressureError',
  },
  {
    name: 'factsSuggest',
    path: '../../../src/services/factsSuggest',
    call: (m) => m.suggestFacts(DB, { character: CHARACTER }),
    maxTokens: 600,
    ok: '{"occupation": "Vintage reseller", "why": "w"}',
  },
  {
    name: 'checkAutofix',
    path: '../../../src/services/checkAutofix',
    call: (m) => m.suggestFixes(DB, { character: CHARACTER }),
    maxTokens: 250 * 1 + 300, // one open flag
    ok: '{"items": [{"n": 1, "verdict": "fine", "why": "a figure of speech"}]}',
  },
  {
    name: 'contentPillars',
    path: '../../../src/services/contentPillars',
    call: (m) => m.suggestPillars(DB, 'Fashion Creator'),
    maxTokens: 600,
    ok: '{"pillars": [{"name": "Hauls", "share": 60, "example": "e"}, {"name": "Styling", "share": 40, "example": "e"}]}',
  },
  {
    name: 'audienceMap',
    path: '../../../src/services/audienceMap',
    call: (m) => m.suggestAudience(DB, 'Fashion Creator'),
    maxTokens: 400,
    ok: '{"shares": ["Beauty Creator"], "competes": [], "why": "w"}',
  },
];

let savedKey;
beforeEach(() => {
  mockConstructed.length = 0;
  mockFactoryCalls.length = 0;
  mockCreate.mockReset();
  savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
  jest.restoreAllMocks();
});

/** A fresh copy of the service, so its memoized client starts empty. */
function load(path) {
  let mod;
  jest.isolateModules(() => { mod = require(path); });
  return { mod };
}

describe.each(SERVICES)('$name builds its client through the factory, with nothing else changed', (svc) => {
  test('no client is built when the module loads', () => {
    load(svc.path);
    expect(mockFactoryCalls).toHaveLength(0);
    expect(mockConstructed).toHaveLength(0);
  });

  test('first call: one client, through the factory, with exactly { apiKey } from the environment', async () => {
    const { mod } = load(svc.path);
    mockCreate.mockResolvedValue(reply(svc.ok));
    await svc.call(mod);
    expect(mockFactoryCalls).toEqual([[{ apiKey: 'test-key-not-real' }]]);
    expect(mockConstructed).toEqual([{ apiKey: 'test-key-not-real' }]);
  });

  test('the client is reused: a second call builds no new client', async () => {
    const { mod } = load(svc.path);
    mockCreate.mockResolvedValue(reply(svc.ok));
    await svc.call(mod);
    await svc.call(mod);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockFactoryCalls).toHaveLength(1);
    expect(mockConstructed).toHaveLength(1);
  });

  test(`the request is unchanged: ${MODEL}, its max_tokens, one user message`, async () => {
    const { mod } = load(svc.path);
    mockCreate.mockResolvedValue(reply(svc.ok));
    await svc.call(mod);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [params, ...rest] = mockCreate.mock.calls[0];
    expect(rest).toEqual([]);
    expect(Object.keys(params).sort()).toEqual(['max_tokens', 'messages', 'model']);
    expect(params.model).toBe(MODEL);
    expect(params.max_tokens).toBe(svc.maxTokens);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0]).toEqual({ role: 'user', content: expect.any(String) });
  });

  test('a provider error propagates as the same error, after one attempt and a warning', async () => {
    const { mod } = load(svc.path);
    const providerErr = Object.assign(new Error('Overloaded'), { status: 529 });
    mockCreate.mockRejectedValue(providerErr);
    await expect(svc.call(mod)).rejects.toBe(providerErr);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`[${svc.name}]`), 'Overloaded');
  });

  test('an unreadable answer is the service’s own 502, as before', async () => {
    const { mod } = load(svc.path);
    mockCreate.mockResolvedValue(reply('not json at all'));
    const err = await svc.call(mod).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/could not be read\. Try again\./);
    if (svc.errorName) expect(err.name).toBe(svc.errorName);
  });
});

test('all six services are covered, and none still builds a client directly', () => {
  const { scanSource } = require('../../../scripts/aigw/anthropicInventory');
  const fs = require('fs');
  const path = require('path');
  expect(SERVICES.map((s) => s.name).sort()).toEqual(
    ['audienceMap', 'characterPressure', 'characterTypology', 'checkAutofix', 'contentPillars', 'factsSuggest'],
  );
  for (const s of SERVICES) {
    const file = path.join(__dirname, '../../../src/services', `${s.name}.js`);
    expect(scanSource(fs.readFileSync(file, 'utf8'), `src/services/${s.name}.js`)).toMatchObject({ constructions: 0, sdkImports: 0 });
  }
});
