'use strict';

/**
 * P0a-3a (AI egress gateway): SSE smoke tests for the four streaming sites in
 * the memories hub, which now stream through a client built by
 * createAnthropicClient():
 *   - POST /assistant-command-stream   (routes/memories/assistant.js)
 *   - POST /voice-to-story, stream     (routes/memories/stories.js)
 *   - POST /story-continue, stream     (routes/memories/stories.js)
 *   - POST /ai-writer-action, stream   (routes/memories/stories.js)
 *
 * For each: event delivery, normal completion, error handling and client
 * disconnect, against the contract the code had before P0a-3a. These tests
 * pass on the pre-migration code too, except the ones that check the stream
 * runs on the factory client.
 *
 * The real route handler runs with a fake request and response; the SDK
 * stream is a scripted fake (text events, then finalMessage(), abort()).
 * The middleware chain of each route is checked by name, so authorization
 * and rate limiting are pinned as well. The response fake throws
 * ERR_HTTP_HEADERS_SENT when a JSON body is sent after the SSE headers were
 * flushed, as Express does. No network, no key, no database.
 */

const { EventEmitter } = require('events');

// ── Shared across Jest module registries ──────────────────────────────────
const mockFactoryClients = [];
const mockStreamCalls = [];
const mockScripts = [];

class MockStream extends EventEmitter {
  constructor(script) {
    super();
    this.script = script;
    this.aborted = false;
    this.done = new Promise((resolve, reject) => { this.resolveDone = resolve; this.rejectDone = reject; });
    this.done.catch(() => {});
    setImmediate(() => this.run());
  }

  async run() {
    for (const chunk of this.script.chunks || []) {
      if (this.aborted) return;
      this.emit('text', chunk);
      await new Promise((r) => setImmediate(r));
    }
    if (this.script.hang) return; // until abort()
    if (this.script.error) { this.rejectDone(this.script.error); return; }
    this.resolveDone({ content: [{ type: 'text', text: (this.script.chunks || []).join('') }] });
  }

  finalMessage() { return this.done; }

  abort() {
    this.aborted = true;
    this.rejectDone(Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' }));
  }
}

jest.mock('@anthropic-ai/sdk', () => function Anthropic() {
  const client = this;
  this.messages = {
    create: jest.fn(async () => ({ content: [{ type: 'text', text: '' }] })),
    stream: (params) => {
      const stream = new MockStream(mockScripts.shift() || { chunks: [] });
      mockStreamCalls.push({ client, params, stream });
      return stream;
    },
  };
});
jest.mock('../../../src/services/anthropicClient', () => {
  const actual = jest.requireActual('../../../src/services/anthropicClient');
  return {
    createAnthropicClient: (...args) => {
      const client = actual.createAnthropicClient(...args);
      mockFactoryClients.push(client);
      return client;
    },
  };
});
jest.mock('../../../src/models', () => {
  const model = new Proxy({}, {
    get: (t, k) => (k === 'then' ? undefined
      : (k === 'findAll' ? async () => [] : (k === 'count' ? async () => 0 : async () => null))),
  });
  const sequelize = { query: async () => [], QueryTypes: { SELECT: 'SELECT' }, transaction: async (fn) => (fn ? fn({}) : {}), literal: (s) => s, fn: () => null, col: () => null };
  return new Proxy({ sequelize, Sequelize: { Op: {} } }, { get: (t, k) => (k in t ? t[k] : model) });
});
// stories.js reads character voice and write-mode context from these two; nothing found.
jest.mock('../../../src/routes/memories/helpers', () => ({
  ...jest.requireActual('../../../src/routes/memories/helpers'),
  getCharacterVoiceContext: jest.fn(async () => null),
}));
jest.mock('../../../src/routes/memories/engine', () => ({
  ...jest.requireActual('../../../src/routes/memories/engine'),
  loadWriteModeContext: jest.fn(async () => null),
  buildWriteModeContextBlock: jest.fn(() => ''),
}));

// Module-level timers (engine.js job cleanup, the assistant limiter's store)
// go on a fake clock, as in the other tests that load these routes, so they
// do not hold the worker open. setImmediate stays real for the fake streams.
jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
const assistantRouter = require('../../../src/routes/memories/assistant');
const storiesRouter = require('../../../src/routes/memories/stories');
const { requireAuth } = require('../../../src/middleware/auth');
const { aiRateLimiter } = require('../../../src/middleware/aiRateLimiter');

// ── Fakes ─────────────────────────────────────────────────────────────────
function fakeReq(body) {
  const req = new EventEmitter();
  Object.assign(req, { body, user: { id: 'u1', role: 'ADMIN' }, headers: {}, query: {}, params: {} });
  return req;
}

function fakeRes() {
  const res = {
    headers: {}, writes: [], ended: false, headersSent: false, statusCode: 200, body: undefined,
    setHeader(k, v) {
      if (this.headersSent) throw Object.assign(new Error('Cannot set headers after they are sent to the client'), { code: 'ERR_HTTP_HEADERS_SENT' });
      this.headers[k.toLowerCase()] = v;
    },
    flushHeaders() { this.headersSent = true; },
    write(s) { this.writes.push(s); return true; },
    end() { this.ended = true; },
    status(c) { this.statusCode = c; return this; },
    json(o) {
      this.setHeader('Content-Type', 'application/json');
      this.body = o; this.headersSent = true; this.ended = true;
      return this;
    },
  };
  return res;
}

const events = (res) => res.writes.map((w) => JSON.parse(w.replace(/^data: /, '').trim()));

function route(router, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
  if (!layer) throw new Error(`no POST ${path}`);
  const stack = layer.route.stack;
  return { handles: stack.map((s) => s.handle), handle: stack[stack.length - 1].handle };
}

/** Runs a handler; resolves { res, error } once it settles. */
async function run(router, path, body, { duringStream } = {}) {
  const req = fakeReq(body);
  const res = fakeRes();
  const pending = route(router, path).handle(req, res).then(() => null, (e) => e);
  if (duringStream) await duringStream(req, res);
  const error = await pending;
  return { res, error, req };
}

const waitFor = async (cond) => { for (let i = 0; i < 200 && !cond(); i += 1) await new Promise((r) => setImmediate(r)); };
const SSE_HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' };
const overloaded = () => Object.assign(new Error('Overloaded'), { status: 529 });
const badRequest = () => Object.assign(new Error('bad request'), { status: 400 });

beforeEach(() => {
  mockStreamCalls.length = 0;
  mockScripts.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ── POST /assistant-command-stream ────────────────────────────────────────
describe('POST /assistant-command-stream', () => {
  const PATH = '/assistant-command-stream';
  const BODY = { message: 'Who is in the cast?', history: [], context: {} };

  test('middleware unchanged: requireAuth, aiRateLimiter, the assistant limiter, then the handler', () => {
    const { handles } = route(assistantRouter, PATH);
    expect(handles).toHaveLength(4);
    expect(handles[0]).toBe(requireAuth);
    expect(handles[1]).toBe(aiRateLimiter);
  });

  test('delivers each chunk as a token event, then a done event, and ends', async () => {
    mockScripts.push({ chunks: ['Hel', 'lo'] });
    const { res, error } = await run(assistantRouter, PATH, BODY);
    expect(error).toBeNull();
    expect(res.headers).toMatchObject(SSE_HEADERS);
    expect(events(res)).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo' },
      { type: 'done', reply: 'Hello', action: null, navigate: null, refresh: null, nextBestAction: null },
    ]);
    expect(res.ended).toBe(true);
    expect(mockStreamCalls).toHaveLength(1);
    const { params } = mockStreamCalls[0];
    expect(params).toMatchObject({ model: 'claude-sonnet-4-6', max_tokens: 2048 });
    expect(typeof params.system).toBe('string');
    expect(params.messages.at(-1)).toEqual({ role: 'user', content: 'Who is in the cast?' });
  });

  test('streams through a client built by the factory', async () => {
    mockScripts.push({ chunks: ['ok'] });
    await run(assistantRouter, PATH, BODY);
    expect(mockFactoryClients).toContain(mockStreamCalls[0].client);
  });

  test('a 529 before any text retries once, then completes', async () => {
    mockScripts.push({ chunks: [], error: overloaded() }, { chunks: ['Second'] });
    const { res, error } = await run(assistantRouter, PATH, BODY);
    expect(error).toBeNull();
    expect(mockStreamCalls).toHaveLength(2);
    expect(events(res).map((e) => e.type)).toEqual(['token', 'done']);
    expect(events(res)[1].reply).toBe('Second');
  });

  test('a non-retryable error becomes an error event with its type, and the response ends', async () => {
    mockScripts.push({ chunks: [], error: badRequest() });
    const { res, error } = await run(assistantRouter, PATH, BODY);
    expect(error).toBeNull();
    expect(mockStreamCalls).toHaveLength(1);
    const last = events(res).at(-1);
    expect(last).toMatchObject({ type: 'error', errorType: 'bad_request', retryable: false, error: 'bad request' });
    expect(res.ended).toBe(true);
  });

  test('client disconnect aborts the stream and stops writing tokens', async () => {
    mockScripts.push({ chunks: ['first'], hang: true });
    const { res } = await run(assistantRouter, PATH, BODY, {
      duringStream: async (req, liveRes) => {
        await waitFor(() => liveRes.writes.length >= 1);
        req.emit('close');
        mockStreamCalls[0].stream.emit('text', 'after-close');
      },
    });
    expect(mockStreamCalls[0].stream.aborted).toBe(true);
    const tokens = events(res).filter((e) => e.type === 'token').map((e) => e.text);
    expect(tokens).toEqual(['first']);
  });
});

// ── stories.js streaming routes ───────────────────────────────────────────
const STORIES = [
  {
    path: '/voice-to-story',
    body: { spoken: 'She opened the door.', stream: true },
    first: [{ type: 'processing' }],
    done: { type: 'done', hint: null },
    params: { model: 'claude-sonnet-4-6', max_tokens: 900 },
    nonRetryable: 'outer-json', // the outer catch sends JSON after the SSE headers were flushed
  },
  {
    path: '/story-continue',
    body: { current_prose: 'She stood at the window.', stream: true },
    first: [],
    done: { type: 'done' },
    params: { model: 'claude-sonnet-4-6', max_tokens: 900 },
    nonRetryable: 'outer-json',
  },
  {
    path: '/ai-writer-action',
    body: { action: 'continue', recent_prose: 'She waited.', length: 'paragraph', stream: true },
    first: [],
    done: { type: 'done', action: 'continue' },
    params: { model: 'claude-sonnet-4-6', max_tokens: 350, temperature: 0.85 },
    nonRetryable: 'in-stream', // handled inside the stream loop
  },
];

describe.each(STORIES)('POST $path (stream: true)', (r) => {
  test('middleware unchanged: requireAuth, aiRateLimiter, then the handler', () => {
    const { handles } = route(storiesRouter, r.path);
    expect(handles).toHaveLength(3);
    expect(handles[0]).toBe(requireAuth);
    expect(handles[1]).toBe(aiRateLimiter);
  });

  test('delivers each chunk as a text event, then done, and ends', async () => {
    mockScripts.push({ chunks: ['One ', 'two.'] });
    const { res, error } = await run(storiesRouter, r.path, r.body);
    expect(error).toBeNull();
    expect(res.headers).toMatchObject(SSE_HEADERS);
    expect(events(res)).toEqual([...r.first, { type: 'text', text: 'One ' }, { type: 'text', text: 'two.' }, r.done]);
    expect(res.ended).toBe(true);
    expect(mockStreamCalls).toHaveLength(1);
    expect(mockStreamCalls[0].params).toMatchObject(r.params);
  });

  test('streams through a client built by the factory', async () => {
    mockScripts.push({ chunks: ['ok'] });
    await run(storiesRouter, r.path, r.body);
    expect(mockFactoryClients).toContain(mockStreamCalls[0].client);
  });

  test('a 529 on the only model ends with the "AI is busy" error event', async () => {
    mockScripts.push({ chunks: [], error: overloaded() });
    const { res, error } = await run(storiesRouter, r.path, r.body);
    expect(error).toBeNull();
    expect(events(res)).toEqual([...r.first, { type: 'error', error: 'AI is busy — please try again in a moment' }]);
    expect(res.ended).toBe(true);
  });

  test('a non-retryable error keeps its existing handling', async () => {
    mockScripts.push({ chunks: [], error: badRequest() });
    const { res, error } = await run(storiesRouter, r.path, r.body);
    if (r.nonRetryable === 'in-stream') {
      expect(error).toBeNull();
      expect(events(res)).toEqual([{ type: 'error', error: 'AI generation failed' }]);
      expect(res.ended).toBe(true);
    } else {
      // Existing behaviour, unchanged here: the route's outer catch answers with
      // JSON after the SSE headers were sent, which Express refuses.
      expect(error).toMatchObject({ code: 'ERR_HTTP_HEADERS_SENT' });
      expect(events(res)).toEqual(r.first);
      expect(res.ended).toBe(false);
    }
  });

  test('client disconnect: no abort listener (existing behaviour); the stream runs to done', async () => {
    mockScripts.push({ chunks: ['a', 'b', 'c'] });
    const { res, error } = await run(storiesRouter, r.path, r.body, {
      duringStream: async (req) => {
        await waitFor(() => mockStreamCalls.length === 1);
        req.emit('close');
      },
    });
    expect(error).toBeNull();
    expect(mockStreamCalls[0].stream.aborted).toBe(false);
    expect(events(res).at(-1)).toEqual(r.done);
    expect(res.ended).toBe(true);
  });
});
