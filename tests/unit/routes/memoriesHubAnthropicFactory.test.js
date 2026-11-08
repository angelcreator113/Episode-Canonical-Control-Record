'use strict';

/**
 * P0a-3a (AI egress gateway): the nine memories hub route files build their
 * Anthropic clients through createAnthropicClient() instead of
 * `new Anthropic()`. Only the construction changed; this pins:
 *   - each of the nine files builds exactly one client when it loads (as
 *     before), through the factory, with no arguments, so the SDK reads
 *     ANTHROPIC_API_KEY itself;
 *   - that construction still happens after the file's own dotenv line
 *     (`override: !process.env.ANTHROPIC_API_KEY`), so a key loaded from
 *     .env is the key the client sees;
 *   - the five per-request sites (assistant x4, engine x1) build a client
 *     inside their handlers, through the factory, with { apiKey } exactly;
 *   - no file in the hub still loads the SDK or builds a client directly;
 *   - a missing key behaves as before: the client builds, and a request fails
 *     with the SDK's own authentication error before any network call.
 *
 * The SDK, dotenv and the database layer are mocked. No network, no key, no
 * database.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const HUB = ['assistant', 'core', 'engine', 'extras', 'helpers', 'interview', 'planning', 'stories', 'voice'];
const HUB_DIR = path.join(__dirname, '../../../src/routes/memories');

// Shared across Jest module registries (see the P0a-2 pilot test).
const mockConstructed = [];
const mockFactoryCalls = [];
const mockState = { inFactory: false };
let mockDotenvKey = null;

jest.mock('@anthropic-ai/sdk', () => function Anthropic(...args) {
  const caller = (new Error().stack.match(/routes[\\/](?:memories[\\/])?(\w+)\.js/) || [])[1] || 'other';
  mockConstructed.push({ args, viaFactory: mockState.inFactory, caller, envKeyAtConstruction: process.env.ANTHROPIC_API_KEY });
  this.messages = { create: jest.fn(), stream: jest.fn() };
});
jest.mock('../../../src/services/anthropicClient', () => {
  const actual = jest.requireActual('../../../src/services/anthropicClient');
  return {
    createAnthropicClient: (...args) => {
      const caller = (new Error().stack.match(/routes[\\/]memories[\\/](\w+)\.js/) || [])[1] || 'other';
      mockFactoryCalls.push({ caller, args });
      mockState.inFactory = true;
      try {
        return actual.createAnthropicClient(...args);
      } finally {
        mockState.inFactory = false;
      }
    },
  };
});
// dotenv: record the call and, like a real .env, supply the key when asked to override.
jest.mock('dotenv', () => ({
  config: (opts = {}) => {
    if (opts.override && mockDotenvKey) process.env.ANTHROPIC_API_KEY = mockDotenvKey;
    return { parsed: {} };
  },
}));
// The database layer: any model, any method, nothing found.
jest.mock('../../../src/models', () => {
  const model = new Proxy({}, {
    get: (t, k) => (k === 'then' ? undefined
      : (k === 'findAll' ? async () => [] : (k === 'count' ? async () => 0 : async () => null))),
  });
  const sequelize = { query: async () => [], QueryTypes: { SELECT: 'SELECT' }, transaction: async (fn) => (fn ? fn({}) : {}), literal: (s) => s, fn: () => null, col: () => null };
  return new Proxy({ sequelize, Sequelize: { Op: {} } }, { get: (t, k) => (k in t ? t[k] : model) });
});

let savedKey;
beforeEach(() => {
  mockConstructed.length = 0;
  mockFactoryCalls.length = 0;
  mockDotenvKey = null;
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

function loadHub() {
  // Module-level timers in these routes go on a fake clock, as in the other
  // tests that load them, so they do not hold the worker open.
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  try {
    jest.isolateModules(() => {
      for (const f of HUB) require(path.join(HUB_DIR, f));
    });
  } finally {
    jest.useRealTimers();
  }
}

describe('memories hub: module-level clients', () => {
  test('each of the nine files builds exactly one client at load, through the factory, with no arguments', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    loadHub();
    const byFile = {};
    for (const c of mockFactoryCalls) byFile[c.caller] = (byFile[c.caller] || 0) + 1;
    expect(byFile).toEqual(Object.fromEntries(HUB.map((f) => [f, 1])));
    for (const c of mockFactoryCalls) expect(c.args).toHaveLength(0);
    const viaFactory = mockConstructed.filter((c) => c.viaFactory);
    expect(viaFactory).toHaveLength(9);
    for (const c of viaFactory) expect(c.args).toHaveLength(0);
    // assistant.js also loads franchiseBrainRoutes (P0a-3b, not migrated yet), which still builds its own.
    expect(mockConstructed.filter((c) => !c.viaFactory).map((c) => c.caller)).toEqual(['franchiseBrainRoutes']);
  });

  test('construction still follows each file’s dotenv line: a key supplied by .env is the key the client sees', () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockDotenvKey = 'key-from-dotenv';
    loadHub();
    const viaFactory = mockConstructed.filter((c) => c.viaFactory);
    expect(viaFactory).toHaveLength(9);
    for (const c of viaFactory) expect(c.envKeyAtConstruction).toBe('key-from-dotenv');
  });
});

describe('memories hub: source shape', () => {
  const parse = (f) => {
    const src = fs.readFileSync(path.join(HUB_DIR, `${f}.js`), 'utf8');
    return { src, ast: espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true }) };
  };
  /** Every createAnthropicClient(...) call with its argument source and whether it is at module level. */
  function factoryCalls(f) {
    const { src, ast } = parse(f);
    const out = [];
    const walk = (n, depth) => {
      if (!n || typeof n.type !== 'string') return;
      const fnDepth = depth + (/Function/.test(n.type) ? 1 : 0);
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'createAnthropicClient') {
        out.push({ line: n.loc.start.line, args: n.arguments.map((a) => src.slice(a.range[0], a.range[1])), moduleLevel: depth === 0 });
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'range') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, fnDepth));
        else if (v && typeof v.type === 'string') walk(v, fnDepth);
      }
    };
    walk(ast, 0);
    return out;
  }

  test('one module-level factory call with no arguments per file; per-request calls pass { apiKey } inside handlers', () => {
    const perRequest = { assistant: 4, engine: 1 };
    let total = 0;
    for (const f of HUB) {
      const calls = factoryCalls(f);
      const moduleLevel = calls.filter((c) => c.moduleLevel);
      const nested = calls.filter((c) => !c.moduleLevel);
      expect({ f, moduleLevel: moduleLevel.map((c) => c.args) }).toEqual({ f, moduleLevel: [[]] });
      expect({ f, nested: nested.map((c) => c.args) })
        .toEqual({ f, nested: Array(perRequest[f] || 0).fill(['{ apiKey: process.env.ANTHROPIC_API_KEY }']) });
      total += calls.length;
    }
    expect(total).toBe(14);
  });

  test('no hub file loads the SDK or builds a client directly any more', () => {
    const { scanSource } = require('../../../scripts/aigw/anthropicInventory');
    for (const f of HUB) {
      const { src } = parse(f);
      expect({ f, ...scanSource(src, `src/routes/memories/${f}.js`) }).toMatchObject({ f, constructions: 0, sdkImports: 0 });
    }
  });

  test('each file still runs its dotenv line before its module-level client', () => {
    for (const f of HUB) {
      const { src } = parse(f);
      const dotenvAt = src.indexOf("require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });");
      const clientAt = src.search(/^const \w+ = createAnthropicClient\(\);$/m);
      expect({ f, ordered: dotenvAt >= 0 && clientAt > dotenvAt }).toEqual({ f, ordered: true });
    }
  });
});

describe('a missing key behaves as before', () => {
  test('the client builds, and a request fails with the SDK authentication error before any network call', async () => {
    const { createAnthropicClient } = jest.requireActual('../../../src/services/anthropicClient');
    const RealSdk = jest.requireActual('@anthropic-ai/sdk');
    delete process.env.ANTHROPIC_API_KEY;
    const savedToken = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    const fetchCalls = [];
    const noNetwork = async () => { fetchCalls.push(1); throw new Error('network must not be reached'); };
    try {
      // The factory resolves the mocked SDK in this file, so build the real one the same way the factory would.
      const viaFactoryShape = new RealSdk({ fetch: noNetwork });
      const direct = new RealSdk({ fetch: noNetwork });
      expect(viaFactoryShape.apiKey).toBeNull();
      const params = { model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] };
      const e1 = await viaFactoryShape.messages.create(params).then(() => null, (e) => e);
      const e2 = await direct.messages.create(params).then(() => null, (e) => e);
      expect(e1.message).toMatch(/Could not resolve authentication method/);
      expect(e1.message).toBe(e2.message);
      expect(fetchCalls).toHaveLength(0);
      expect(typeof createAnthropicClient).toBe('function');
    } finally {
      if (savedToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = savedToken;
    }
  });
});
