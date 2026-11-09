'use strict';

/**
 * src/services/anthropicClient.js: the shared Anthropic client factory
 * (AI egress gateway, G3 milestone P0a-1). A routing seam only: a client it
 * builds must behave exactly like `new Anthropic(options)`.
 *
 * The real SDK and the real aiCostTracker, with a fake fetch and the usage
 * table mocked. No network, no database, no key.
 */

const mockRows = [];
let mockSum = async () => 0;
jest.mock('../../../src/models', () => ({
  AIUsageLog: { create: async (row) => { mockRows.push(row); }, sum: (...a) => mockSum(...a) },
}));

const tracker = require('../../../src/services/aiCostTracker');
const Anthropic = require('@anthropic-ai/sdk');
const { createAnthropicClient } = require('../../../src/services/anthropicClient');

const MESSAGE = {
  id: 'm1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 500 },
};
const PARAMS = { model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: 'x' }] };
const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
const SSE = [
  ev('message_start', { type: 'message_start', message: { ...MESSAGE, content: [], usage: { input_tokens: 1000, output_tokens: 1 } } }),
  ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
  ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } }),
  ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
  ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 500 } }),
  ev('message_stop', { type: 'message_stop' }),
];

let requests = [];
let respond = 'ok';
const fakeFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  requests.push({ url: String(url), body });
  if (respond === 'overloaded') {
    return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }),
      { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '0' } });
  }
  if (body.stream) {
    const enc = new TextEncoder();
    const stream = new ReadableStream({ start(c) { SSE.forEach((s) => c.enqueue(enc.encode(s))); c.close(); } });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }
  return new Response(JSON.stringify(MESSAGE), { status: 200, headers: { 'content-type': 'application/json' } });
};
const settle = () => new Promise((r) => setTimeout(r, 30));

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'];
let savedEnv;
beforeEach(async () => {
  await settle(); // let usage rows from the previous test land first
  mockRows.length = 0;
  requests = [];
  respond = 'ok';
  mockSum = async () => 0;
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  jest.restoreAllMocks();
});

describe('options and SDK defaults are those of new Anthropic(options)', () => {
  test('options pass through unchanged', () => {
    const c = createAnthropicClient({ apiKey: 'test-key', maxRetries: 0, timeout: 1234, fetch: fakeFetch });
    expect(c.apiKey).toBe('test-key');
    expect(c.maxRetries).toBe(0);
    expect(c.timeout).toBe(1234);
  });

  test('omitted options keep the SDK defaults: 2 retries, a 10-minute timeout, the provider base URL', () => {
    const viaFactory = createAnthropicClient({ apiKey: 'k' });
    const direct = new Anthropic({ apiKey: 'k' });
    for (const field of ['maxRetries', 'timeout', 'baseURL', 'apiKey']) expect(viaFactory[field]).toEqual(direct[field]);
    expect(viaFactory.maxRetries).toBe(2);
    expect(viaFactory.timeout).toBe(600000);
  });

  test('the client is the SDK class and shares the Messages prototype the cost tracker patches', () => {
    const c = createAnthropicClient({ apiKey: 'k' });
    const direct = new Anthropic({ apiKey: 'k' });
    expect(c).toBeInstanceOf(Anthropic.default);
    expect(Object.getPrototypeOf(c.messages)).toBe(Object.getPrototypeOf(direct.messages));
  });

  test('every call returns a new client (lifetimes stay with the caller)', () => {
    expect(createAnthropicClient({ apiKey: 'k' })).not.toBe(createAnthropicClient({ apiKey: 'k' }));
  });
});

describe('environment handling is unchanged', () => {
  test('with no options, the key and base URL come from the environment, as for new Anthropic()', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-for-test';
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9/test-base';
    const viaFactory = createAnthropicClient();
    const direct = new Anthropic();
    expect(viaFactory.apiKey).toBe('env-key-for-test');
    expect(viaFactory.baseURL).toBe('http://127.0.0.1:9/test-base');
    expect([viaFactory.apiKey, viaFactory.baseURL]).toEqual([direct.apiKey, direct.baseURL]);
  });

  test('the environment is read when a client is built, not when the factory loads', () => {
    process.env.ANTHROPIC_API_KEY = 'first';
    const first = createAnthropicClient();
    process.env.ANTHROPIC_API_KEY = 'second';
    const second = createAnthropicClient();
    expect([first.apiKey, second.apiKey]).toEqual(['first', 'second']);
  });

  test('ANTHROPIC_BASE_URL is honoured exactly as today (P0a adds no routing)', async () => {
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9/elsewhere';
    await createAnthropicClient({ apiKey: 'k', fetch: fakeFetch, maxRetries: 0 }).messages.create(PARAMS);
    expect(requests[0].url).toBe('http://127.0.0.1:9/elsewhere/v1/messages');
  });
});

describe('retries are the SDK default unless the caller says otherwise', () => {
  test('default: an overloaded (529) answer is retried twice, three requests in all', async () => {
    respond = 'overloaded';
    await expect(createAnthropicClient({ apiKey: 'k', fetch: fakeFetch }).messages.create(PARAMS)).rejects.toMatchObject({ status: 529 });
    expect(requests).toHaveLength(3);
    await settle();
    // The tracker logs per create() call, not per HTTP attempt: one row for three requests.
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toMatchObject({ is_error: true, cost_usd: 0 });
  });

  test('maxRetries: 0 (iconCue, eventConceptDraft) still sends exactly one request', async () => {
    respond = 'overloaded';
    await expect(createAnthropicClient({ apiKey: 'k', fetch: fakeFetch, maxRetries: 0 }).messages.create(PARAMS)).rejects.toMatchObject({ status: 529 });
    expect(requests).toHaveLength(1);
  });
});

describe('the cost tracker still applies to clients from the factory', () => {
  test('the patch is installed, and a plain call is logged once at its real usage', async () => {
    expect(tracker.calculateCost).toEqual(expect.any(Function));
    await createAnthropicClient({ apiKey: 'k', fetch: fakeFetch, maxRetries: 0 }).messages.create(PARAMS);
    await settle();
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toMatchObject({ model_name: 'claude-sonnet-4-6', input_tokens: 1000, output_tokens: 500, is_error: false });
    expect(Number(mockRows[0].cost_usd)).toBeCloseTo(tracker.calculateCost('claude-sonnet-4-6', MESSAGE.usage), 6);
  });

  test('a stream is logged once, when it ends, at its real usage', async () => {
    await createAnthropicClient({ apiKey: 'k', fetch: fakeFetch, maxRetries: 0 }).messages.stream(PARAMS).finalMessage();
    await settle();
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toMatchObject({ input_tokens: 1000, output_tokens: 500, is_error: false });
  });

  test('the daily budget gate refuses before any request is sent', async () => {
    mockSum = async () => 1e9; // far past any cap
    await tracker.refreshSpend();
    await expect(createAnthropicClient({ apiKey: 'k', fetch: fakeFetch, maxRetries: 0 }).messages.create(PARAMS))
      .rejects.toMatchObject({ status: 429, code: 'AI_BUDGET_EXCEEDED' });
    expect(requests).toHaveLength(0);
    mockSum = async () => 0;
    await tracker.refreshSpend();
  });
});

describe('SDK export shapes and Jest mocks', () => {
  const FACTORY = '../../../src/services/anthropicClient';
  /** Load the factory in an isolated registry with the SDK replaced by `shape`. */
  function withSdk(shape, fn) {
    let result;
    jest.isolateModules(() => {
      jest.doMock('@anthropic-ai/sdk', () => shape);
      result = fn(require(FACTORY));
    });
    jest.dontMock('@anthropic-ai/sdk');
    return result;
  }

  test('a function export is the constructor (the real SDK and every mock in tests/)', () => {
    const Fake = jest.fn(function Fake() { this.messages = { create: jest.fn() }; });
    const c = withSdk(Fake, (f) => f.createAnthropicClient({ apiKey: 'x' }));
    expect(c).toBeInstanceOf(Fake);
  });

  test('a function export wins over its .default, as at the 138 direct-require call sites', () => {
    const Module = jest.fn(function Module() {});
    Module.default = jest.fn(function Other() {});
    withSdk(Module, (f) => f.createAnthropicClient());
    expect(Module).toHaveBeenCalledTimes(1);
    expect(Module.default).not.toHaveBeenCalled();
  });

  test('an object export uses .default, then .Anthropic', () => {
    const D = jest.fn(function D() {});
    const A = jest.fn(function A() {});
    expect(withSdk({ default: D, Anthropic: A }, (f) => f.createAnthropicClient())).toBeInstanceOf(D);
    expect(withSdk({ Anthropic: A }, (f) => f.createAnthropicClient())).toBeInstanceOf(A);
  });

  test('an export with no constructor fails loudly', () => {
    expect(() => withSdk({}, (f) => f.createAnthropicClient())).toThrow(/exports no client constructor/);
  });

  test('arguments reach the constructor exactly: none when none, the same object when given', () => {
    const Fake = jest.fn(function Fake() {});
    const opts = { apiKey: 'x', maxRetries: 0, timeout: 10000 };
    withSdk(Fake, (f) => { f.createAnthropicClient(); f.createAnthropicClient(opts); });
    expect(Fake.mock.calls[0]).toHaveLength(0);
    expect(Fake.mock.calls[1]).toHaveLength(1);
    expect(Fake.mock.calls[1][0]).toBe(opts);
  });

  test('mockImplementation on a mocked SDK applies to factory clients, as callers’ tests expect', () => {
    const create = jest.fn();
    const Fake = jest.fn().mockImplementation(() => ({ messages: { create } }));
    const c = withSdk(Fake, (f) => f.createAnthropicClient({ apiKey: 'x' }));
    expect(c.messages.create).toBe(create);
  });
});

describe('no side effects when the factory loads', () => {
  test('loading builds no client, loads no SDK, reads no environment and starts no timer', () => {
    const sdkFactory = jest.fn(() => jest.fn());
    const envReads = [];
    const realEnv = process.env;
    jest.useFakeTimers();
    try {
      jest.isolateModules(() => {
        jest.doMock('@anthropic-ai/sdk', sdkFactory);
        process.env = new Proxy(realEnv, { get(t, k) { if (typeof k === 'string') envReads.push(k); return t[k]; } });
        try {
          const mod = require('../../../src/services/anthropicClient');
          expect(Object.keys(mod)).toEqual(['createAnthropicClient']);
        } finally {
          process.env = realEnv;
        }
      });
      expect(sdkFactory).not.toHaveBeenCalled();
      expect(envReads).toEqual([]);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.dontMock('@anthropic-ai/sdk');
      jest.useRealTimers();
    }
  });
});
