// ============================================================================
// aiCostTracker — streamed calls and the icon-cue call (#1731)
// ============================================================================
// The real tracker and the real SDK, with a fake fetch and AIUsageLog.create
// captured. A streamed call must write exactly one row, at its real usage,
// when the stream ends: completed, aborted by its consumer, or dropped. The
// icon-cue call must go through the SDK so the tracker sees it. No network,
// no database.

const mockRows = [];
jest.mock('../../../src/models', () => ({ AIUsageLog: { create: async (row) => { mockRows.push(row); } } }));
jest.mock('../../../src/db', () => ({ pool: { query: jest.fn() } }));

const tracker = require('../../../src/services/aiCostTracker');
const Anthropic = require('@anthropic-ai/sdk');

const MESSAGE = {
  id: 'm1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: '[]' }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 500 },
};
const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
const HEAD = [
  ev('message_start', { type: 'message_start', message: { ...MESSAGE, content: [], usage: { input_tokens: 1000, output_tokens: 1 } } }),
  ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
  ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } }),
];
const TAIL = [
  ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
  ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 500 } }),
  ev('message_stop', { type: 'message_stop' }),
];

let mode;
const requests = [];
const fakeFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  requests.push({ url: String(url), body });
  if (!body.stream) {
    return new Response(JSON.stringify(MESSAGE), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      HEAD.forEach((c) => controller.enqueue(enc.encode(c)));
      if (mode === 'complete') { TAIL.forEach((c) => controller.enqueue(enc.encode(c))); controller.close(); }
      if (mode === 'drop') setTimeout(() => controller.error(new Error('socket hang up')), 10);
      if (mode === 'hang') init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

const PARAMS = { model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: 'x' }] };
const settle = () => new Promise((r) => setTimeout(r, 30));
const client = () => new Anthropic({ apiKey: 'test', fetch: fakeFetch, maxRetries: 0 });

beforeEach(() => {
  mockRows.length = 0;
  requests.length = 0;
  mode = 'complete';
});

test('a plain call is logged once at its real usage', async () => {
  await client().messages.create(PARAMS);
  await settle();
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ input_tokens: 1000, output_tokens: 500, is_error: false });
  expect(mockRows[0].cost_usd).toBeGreaterThan(0);
});

test('a completed stream is logged once, at its real usage, not $0', async () => {
  await client().messages.stream(PARAMS).finalMessage();
  await settle();
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ input_tokens: 1000, output_tokens: 500, is_error: false, error_type: null });
  expect(mockRows[0].cost_usd).toBeCloseTo(0.0105, 6);
});

test('a stream aborted by its consumer is logged once with the usage reported so far', async () => {
  mode = 'hang';
  const s = client().messages.stream(PARAMS);
  s.on('text', () => setTimeout(() => s.abort(), 5));
  await s.done().catch(() => {});
  await settle();
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ input_tokens: 1000, output_tokens: 1, is_error: true });
  expect(mockRows[0].cost_usd).toBeGreaterThan(0);
});

test('a stream whose connection drops is logged once with the usage reported so far', async () => {
  mode = 'drop';
  await client().messages.stream(PARAMS).finalMessage().catch(() => {});
  await settle();
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]).toMatchObject({ input_tokens: 1000, output_tokens: 1, is_error: true });
  expect(mockRows[0].cost_usd).toBeGreaterThan(0);
});

test('streamed spend counts toward the daily budget counter', async () => {
  const before = tracker.getDailySpend();
  await client().messages.stream(PARAMS).finalMessage();
  await settle();
  expect(tracker.getDailySpend() - before).toBeCloseTo(0.0105, 6);
});

describe('icon cues', () => {
  const realFetch = global.fetch;
  beforeEach(() => { global.fetch = fakeFetch; process.env.ANTHROPIC_API_KEY = 'test'; });
  afterEach(() => { global.fetch = realFetch; });

  test('callClaudeAPI goes through the SDK, is logged, and returns the text', async () => {
    const iconCues = require('../../../src/services/iconCueGeneratorService');
    const text = await iconCues.callClaudeAPI('prompt');
    await settle();
    expect(text).toBe('[]');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toMatch(/\/v1\/messages$/);
    expect(requests[0].body).toMatchObject({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: 'prompt' }] });
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toMatchObject({ model_name: 'claude-sonnet-4-20250514', input_tokens: 1000, output_tokens: 500 });
  });
});
