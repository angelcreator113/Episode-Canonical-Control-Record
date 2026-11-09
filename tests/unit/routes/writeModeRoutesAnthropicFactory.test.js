'use strict';

/**
 * P0a-3b (AI egress gateway): the remaining 18 WriteMode, novel, franchise,
 * Amber and onboarding route files build their Anthropic clients through
 * createAnthropicClient() instead of `new Anthropic()`. Only the
 * construction changed; this pins, for each file:
 *   - the 15 module-level clients are still built when the file loads, once,
 *     through the factory, with no arguments;
 *   - bookFromShowRoutes still builds its client lazily, on first use, and
 *     memoizes it;
 *   - onboarding.js still builds a client per request, with { apiKey };
 *   - stories.js (approved Option A) keeps its guarded SDK import and both
 *     availability checks, and builds per request with { apiKey }:
 *       POST /social/import        without a key (or SDK) the AI step is skipped
 *       POST /social/:id/detect-lala  without a key (or SDK) it answers 503
 *   - no direct construction or SDK import is left, except stories.js's
 *     guarded import, which the availability checks still read.
 *
 * The SDK and the database layer are mocked. No network, no key, no
 * database. Constructions are counted at the SDK, so the behaviour checks
 * also hold for the code before P0a-3b; only the factory checks do not.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROUTES_DIR = path.join(__dirname, '../../../src/routes');
const MODULE_LEVEL = [
  'amberDiagnosticRoutes', 'amberSessionRoutes', 'characterGrowthRoute', 'characterSparkRoute',
  'episodeOrchestrationRoute', 'eventGeneratorRoute', 'franchiseBrainRoutes', 'generate-script-from-book',
  'novelIntelligenceRoutes', 'pdfIngestRoute', 'sceneProposeRoute', 'storyEvaluationRoutes', 'storyteller',
  'tierFeatures', 'upgradeRoutes',
];
const OTHERS = ['bookFromShowRoutes', 'onboarding', 'stories'];
const ALL = [...MODULE_LEVEL, ...OTHERS];

// Shared across Jest module registries (see the P0a-2 pilot test).
const mockConstructed = [];
const mockFactoryCalls = [];
const mockState = { inFactory: false, reply: '{}' };
const mockRecord = { current: null };
// The nearest application file on the stack (skipping the factory), e.g.
// 'routes/storyteller' or 'services/registrySync'.
const nearestRoute = () => {
  for (const line of new Error().stack.split('\n')) {
    const m = line.match(/src[\\/]((?:routes|services|controllers)[\\/][\w\\/-]+)\.js/);
    if (m && !/anthropicClient$/.test(m[1])) return m[1].replace(/\\/g, '/');
  }
  return 'other';
};

function mockSdkFactory() {
  return function Anthropic(...args) {
    mockConstructed.push({ args, viaFactory: mockState.inFactory, caller: nearestRoute() });
    this.messages = { create: jest.fn(async () => ({ content: [{ type: 'text', text: mockState.reply }] })), stream: jest.fn() };
  };
}
jest.mock('@anthropic-ai/sdk', () => mockSdkFactory());
jest.mock('../../../src/services/anthropicClient', () => {
  const actual = jest.requireActual('../../../src/services/anthropicClient');
  return {
    createAnthropicClient: (...args) => {
      mockFactoryCalls.push({ caller: nearestRoute(), args });
      mockState.inFactory = true;
      try {
        return actual.createAnthropicClient(...args);
      } finally {
        mockState.inFactory = false;
      }
    },
  };
});
jest.mock('../../../src/models', () => {
  const model = new Proxy({}, {
    get: (t, k) => (k === 'then' ? undefined
      : (k === 'findAll' ? async () => [] : (k === 'count' ? async () => 0 : async () => null))),
  });
  const SocialMediaImport = {
    create: async (row) => { mockRecord.current = { ...row, update: jest.fn(async () => {}) }; return mockRecord.current; },
    findByPk: async () => mockRecord.current,
    findAll: async () => [],
  };
  const sequelize = { query: async () => [], QueryTypes: { SELECT: 'SELECT' }, transaction: async (fn) => (fn ? fn({}) : {}), literal: (s) => s, fn: () => null, col: () => null };
  return new Proxy({ sequelize, Sequelize: { Op: {} }, SocialMediaImport }, { get: (t, k) => (k in t ? t[k] : model) });
});

// No network, ever: if any code path reached a real SDK, its request would
// fail here instead of leaving the machine.
const realFetch = global.fetch;
const mockNetworkAttempts = [];
beforeAll(() => {
  global.fetch = async (url) => {
    mockNetworkAttempts.push(String(url));
    throw new Error('network is disabled in this test');
  };
});
afterAll(() => { global.fetch = realFetch; });
afterEach(() => { expect(mockNetworkAttempts).toEqual([]); });

let savedKey;
beforeEach(() => {
  mockConstructed.length = 0;
  mockFactoryCalls.length = 0;
  mockState.reply = '{}';
  mockRecord.current = null;
  savedKey = process.env.ANTHROPIC_API_KEY;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
  jest.restoreAllMocks();
});

/** Load route files in a fresh registry, with module-level timers on a fake clock. */
function load(files) {
  const mods = {};
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  try {
    jest.isolateModules(() => {
      for (const f of files) mods[f] = require(path.join(ROUTES_DIR, f));
    });
  } finally {
    jest.useRealTimers();
  }
  return mods;
}

const count = (list, pred = () => true) => {
  const out = {};
  for (const c of list.filter(pred)) out[c.caller] = (out[c.caller] || 0) + 1;
  return out;
};

describe('when the files load', () => {
  test('each of the 15 module-level files builds exactly one client, through the factory, with no arguments', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    load(MODULE_LEVEL);
    const mine = (c) => MODULE_LEVEL.map((f) => `routes/${f}`).includes(c.caller);
    const one = Object.fromEntries(MODULE_LEVEL.map((f) => [`routes/${f}`, 1]));
    expect(count(mockConstructed, mine)).toEqual(one);
    for (const c of mockConstructed.filter(mine)) expect(c.args).toHaveLength(0);
    expect(count(mockFactoryCalls, mine)).toEqual(one);
    expect(mockConstructed.filter((c) => mine(c) && !c.viaFactory)).toEqual([]);
  });

  test('bookFromShowRoutes, onboarding and stories build nothing at load (lazy and per-request, as before)', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    load(OTHERS);
    expect(mockConstructed.filter((c) => OTHERS.map((f) => `routes/${f}`).includes(c.caller))).toEqual([]);
  });
});

describe('source shape', () => {
  const parse = (f) => {
    const src = fs.readFileSync(path.join(ROUTES_DIR, `${f}.js`), 'utf8');
    return { src, ast: espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true }) };
  };
  function factoryCalls(f) {
    const { src, ast } = parse(f);
    const out = [];
    const walk = (n, depth) => {
      if (!n || typeof n.type !== 'string') return;
      const d = depth + (/Function/.test(n.type) ? 1 : 0);
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'createAnthropicClient') {
        out.push({ args: n.arguments.map((a) => src.slice(a.range[0], a.range[1])), moduleLevel: depth === 0 });
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'range') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, d));
        else if (v && typeof v.type === 'string') walk(v, d);
      }
    };
    walk(ast, 0);
    return out;
  }
  const API_KEY = '{ apiKey: process.env.ANTHROPIC_API_KEY }';

  test('module-level files: one module-level factory call with no arguments, nothing else', () => {
    for (const f of MODULE_LEVEL) expect({ f, calls: factoryCalls(f) }).toEqual({ f, calls: [{ args: [], moduleLevel: true }] });
  });

  test('bookFromShowRoutes: the factory call stays inside the memoized getClient', () => {
    const { src } = parse('bookFromShowRoutes');
    expect(src).toContain('const getClient = () => { if (!client) client = createAnthropicClient(); return client; };');
    expect(factoryCalls('bookFromShowRoutes')).toEqual([{ args: [], moduleLevel: false }]);
  });

  test('onboarding and stories: two per-request factory calls each, with { apiKey }', () => {
    for (const f of ['onboarding', 'stories']) {
      expect({ f, calls: factoryCalls(f) }).toEqual({ f, calls: [{ args: [API_KEY], moduleLevel: false }, { args: [API_KEY], moduleLevel: false }] });
    }
  });

  test('stories.js keeps its guarded SDK import and both availability checks (Option A)', () => {
    const { src } = parse('stories');
    expect(src).toMatch(/let Anthropic;\ntry \{\n {2}Anthropic = require\('@anthropic-ai\/sdk'\)\.default \|\| require\('@anthropic-ai\/sdk'\);\n\} catch \(e\) \{/);
    expect(src).toContain('if (Anthropic && process.env.ANTHROPIC_API_KEY) {');
    expect(src).toContain('if (!Anthropic || !process.env.ANTHROPIC_API_KEY) {');
  });

  test('no direct construction is left in the 18 files; only stories.js keeps its 2 guarded imports', () => {
    const { scanSource } = require('../../../scripts/aigw/anthropicInventory');
    for (const f of ALL) {
      const r = scanSource(parse(f).src, `src/routes/${f}.js`);
      expect({ f, constructions: r.constructions, sdkImports: r.sdkImports })
        .toEqual({ f, constructions: 0, sdkImports: f === 'stories' ? 2 : 0 });
    }
  });
});

describe('stories.js behaviour (Option A)', () => {
  function handler(router, routePath) {
    const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods.post);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  }
  async function call(router, routePath, { body = {}, params = {} } = {}) {
    const res = {
      statusCode: 200, body: undefined,
      status(c) { this.statusCode = c; return this; },
      json(o) { this.body = o; return this; },
    };
    await handler(router, routePath)({ body, params, user: { id: 'u1' } }, res);
    return res;
  }
  const IMPORT = { character_key: 'maren', platform: 'instagram', raw_content: 'Sunday reset.' };
  const ANALYSIS = '{"detected_voice": "warm", "emotional_tags": ["calm"], "parsed_content": "Sunday reset.", "lala_detected": false, "lala_markers": []}';

  test('POST /social/import without a key: saved, AI skipped, no client built', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { stories } = load(['stories']);
    const res = await call(stories, '/social/import', { body: IMPORT });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, ai_analyzed: false });
    expect(mockConstructed).toEqual([]);
  });

  test('POST /social/import with a key: one client with exactly { apiKey }, analysis saved', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    mockState.reply = ANALYSIS;
    const { stories } = load(['stories']);
    const res = await call(stories, '/social/import', { body: IMPORT });
    expect(res.body).toMatchObject({ success: true, ai_analyzed: true });
    expect(mockConstructed.map((c) => c.args)).toEqual([[{ apiKey: 'test-key-not-real' }]]);
  });

  test('POST /social/:id/detect-lala: 404 for an unknown import, 503 without a key, no client built', async () => {
    const { stories } = load(['stories']);
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    let res = await call(stories, '/social/:id/detect-lala', { params: { id: 'nope' } });
    expect(res.statusCode).toBe(404);
    delete process.env.ANTHROPIC_API_KEY;
    mockRecord.current = { id: 'imp1', character_key: 'maren', raw_content: 'x', update: jest.fn() };
    res = await call(stories, '/social/:id/detect-lala', { params: { id: 'imp1' } });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'AI service not available' });
    expect(mockConstructed).toEqual([]);
  });

  test('POST /social/:id/detect-lala with a key: one client with exactly { apiKey }', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    mockState.reply = '{"lala_detected": false}';
    const { stories } = load(['stories']);
    mockRecord.current = { id: 'imp1', character_key: 'maren', raw_content: 'x', update: jest.fn() };
    await call(stories, '/social/:id/detect-lala', { params: { id: 'imp1' } });
    expect(mockConstructed.map((c) => c.args)).toEqual([[{ apiKey: 'test-key-not-real' }]]);
  });

  test('SDK unavailable: the guarded import catches it; import skips AI and detect-lala answers 503, even with a key', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    jest.resetModules();
    jest.doMock('@anthropic-ai/sdk', () => { throw new Error("Cannot find module '@anthropic-ai/sdk'"); });
    let stories;
    try {
      ({ stories } = load(['stories']));
    } finally {
      jest.resetModules();
      jest.doMock('@anthropic-ai/sdk', () => mockSdkFactory()); // the same mock again, never the real SDK
    }
    const imported = await call(stories, '/social/import', { body: IMPORT });
    expect(imported.body).toMatchObject({ success: true, ai_analyzed: false });
    mockRecord.current = { id: 'imp1', character_key: 'maren', raw_content: 'x', update: jest.fn() };
    const detected = await call(stories, '/social/:id/detect-lala', { params: { id: 'imp1' } });
    expect(detected.statusCode).toBe(503);
    expect(mockConstructed).toEqual([]);
    expect(mockFactoryCalls).toEqual([]);
  });

  test('with a key, both routes build their client through the factory', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    mockState.reply = ANALYSIS;
    const { stories } = load(['stories']);
    await call(stories, '/social/import', { body: IMPORT });
    await call(stories, '/social/:id/detect-lala', { params: { id: mockRecord.current.id } });
    expect(mockFactoryCalls.map((c) => [c.caller, c.args])).toEqual([
      ['routes/stories', [{ apiKey: 'test-key-not-real' }]],
      ['routes/stories', [{ apiKey: 'test-key-not-real' }]],
    ]);
    expect(mockConstructed.every((c) => c.viaFactory)).toBe(true);
  });
});
